import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const EXTENSION_DIR = dirname(fileURLToPath(import.meta.url));

export const DEFAULT_CONFIG = Object.freeze({
  enabled: true,
  blockPipInstall: true,
  blockUvSystemInstall: true,
  blockUserWideToolInstall: true,
  currentVenvPath: ".venv",
  notify: true,
  allowedCommandRegexes: [],
  extraHint: "",
});

const ENV_ASSIGNMENT = String.raw`[A-Za-z_][A-Za-z0-9_]*=(?:"(?:\\.|[^"])*"|'[^']*'|[^\s;&|()]+)`;
const WRAPPER = String.raw`(?:(?:sudo|doas|command)\s+|${ENV_ASSIGNMENT}\s+|env\s+(?:-[^\s]+\s+)*(?:${ENV_ASSIGNMENT}\s+)*)*`;
const EXECUTABLE_PATH = String.raw`(?:[^\s;&|()]+[\\/])?`;
const PYTHON = String.raw`${EXECUTABLE_PATH}(?:python(?:3(?:\.\d+)?)?|py)`;
const PIP = String.raw`${EXECUTABLE_PATH}pip(?:3(?:\.\d+)?)?`;
const UV = String.raw`${EXECUTABLE_PATH}uv`;
const PIPX = String.raw`${EXECUTABLE_PATH}pipx`;
const TOKEN = String.raw`(?:"(?:\\.|[^"])*"|'[^']*'|[^\s;&|()]+)`;
const REST_OF_SEGMENT = String.raw`[^;&|\n]*`;

const PIP_OPTIONS_BEFORE_INSTALL = optionTokensBefore(String.raw`install`);
const PYTHON_OPTIONS_BEFORE_MODULE = optionTokensBefore(String.raw`-m`);
const UV_OPTIONS_BEFORE_SUBCOMMAND = optionTokensBefore(String.raw`(?:pip|tool)`);
const PIPX_OPTIONS_BEFORE_INSTALL = optionTokensBefore(String.raw`install`);

const PIP_INSTALL_PATTERNS = [
  new RegExp(String.raw`^\s*(${WRAPPER}${PIP}${PIP_OPTIONS_BEFORE_INSTALL}\s+install\b${REST_OF_SEGMENT})`, "i"),
  new RegExp(
    String.raw`^\s*(${WRAPPER}${PYTHON}${PYTHON_OPTIONS_BEFORE_MODULE}\s+-m\s+pip${PIP_OPTIONS_BEFORE_INSTALL}\s+install\b${REST_OF_SEGMENT})`,
    "i",
  ),
];

const UV_PIP_INSTALL_PATTERNS = [
  new RegExp(String.raw`^\s*(${WRAPPER}${UV}${UV_OPTIONS_BEFORE_SUBCOMMAND}\s+pip\s+install\b${REST_OF_SEGMENT})`, "i"),
  new RegExp(
    String.raw`^\s*(${WRAPPER}${PYTHON}${PYTHON_OPTIONS_BEFORE_MODULE}\s+-m\s+uv${UV_OPTIONS_BEFORE_SUBCOMMAND}\s+pip\s+install\b${REST_OF_SEGMENT})`,
    "i",
  ),
];

const USER_TOOL_INSTALL_PATTERNS = [
  new RegExp(String.raw`^\s*(${WRAPPER}${PIPX}${PIPX_OPTIONS_BEFORE_INSTALL}\s+install\b${REST_OF_SEGMENT})`, "i"),
  new RegExp(String.raw`^\s*(${WRAPPER}${UV}${UV_OPTIONS_BEFORE_SUBCOMMAND}\s+tool\s+install\b${REST_OF_SEGMENT})`, "i"),
  new RegExp(
    String.raw`^\s*(${WRAPPER}${PYTHON}${PYTHON_OPTIONS_BEFORE_MODULE}\s+-m\s+uv${UV_OPTIONS_BEFORE_SUBCOMMAND}\s+tool\s+install\b${REST_OF_SEGMENT})`,
    "i",
  ),
];

export function loadConfig(cwd = process.cwd(), options = {}) {
  const includeProjectConfig = options.includeProjectConfig !== false;
  let config = { ...DEFAULT_CONFIG };
  const candidates = [
    join(EXTENSION_DIR, "config.json"),
    includeProjectConfig ? join(cwd, ".pi", "extensions", "pi-pip2uv", "config.json") : undefined,
    includeProjectConfig ? join(cwd, ".pi", "extensions", "pip-uv-guard", "config.json") : undefined,
    process.env.PI_PIP2UV_CONFIG,
    process.env.PI_PIP_UV_GUARD_CONFIG,
  ].filter(Boolean);

  const seen = new Set();
  for (const candidate of candidates) {
    const absolutePath = resolve(cwd, candidate);
    if (seen.has(absolutePath) || !existsSync(absolutePath)) continue;
    seen.add(absolutePath);

    const loaded = readJsonObject(absolutePath);
    if (loaded) config = { ...config, ...loaded };
  }

  return normalizeConfig(config);
}

export function normalizeConfig(value = {}) {
  const config = { ...DEFAULT_CONFIG };

  for (const key of [
    "enabled",
    "blockPipInstall",
    "blockUvSystemInstall",
    "blockUserWideToolInstall",
    "notify",
  ]) {
    if (typeof value[key] === "boolean") config[key] = value[key];
  }

  if (typeof value.currentVenvPath === "string" && value.currentVenvPath.trim()) {
    config.currentVenvPath = value.currentVenvPath.trim();
  }

  if (Array.isArray(value.allowedCommandRegexes)) {
    config.allowedCommandRegexes = value.allowedCommandRegexes.filter(
      (entry) => typeof entry === "string" && entry.trim(),
    );
  }

  if (typeof value.extraHint === "string") {
    config.extraHint = value.extraHint.trim();
  }

  return config;
}

export function findUnsafePythonInstall(command, cwd = process.cwd(), inputConfig = {}) {
  const config = normalizeConfig(inputConfig);
  if (!config.enabled || typeof command !== "string" || !command.trim()) return null;

  const text = normalizeShellCommand(command);
  const hits = [];

  if (config.blockPipInstall) {
    hits.push(
      ...collectMatches(PIP_INSTALL_PATTERNS, text, {
        kind: "pip",
        why: "pip/pip3/python -m pip install is disallowed; use uv for dependency changes",
      }),
    );
  }

  if (config.blockUvSystemInstall) {
    hits.push(
      ...collectMatches(UV_PIP_INSTALL_PATTERNS, text, {
        kind: "uv-system",
        why: "uv pip install --system explicitly mutates system Python",
      }).filter((hit) => hasSystemFlag(hit.snippet)),
    );
  }

  if (config.blockUserWideToolInstall) {
    hits.push(
      ...collectMatches(USER_TOOL_INSTALL_PATTERNS, text, {
        kind: "user-tool",
        why: "pipx install / uv tool install installs Python tools user-wide, not into this project",
      }),
    );
  }

  return hits
    .filter((hit) => !isAllowedByRegex(hit, config))
    .sort((a, b) => a.index - b.index)[0] ?? null;
}

export function buildReason(hit, cwd = process.cwd(), inputConfig = {}) {
  const config = normalizeConfig(inputConfig);
  const hasProject = existsSync(join(cwd, "pyproject.toml"));
  const hasLock = existsSync(join(cwd, "uv.lock"));
  const hasVenv = existsSync(join(cwd, config.currentVenvPath));
  const venvPath = resolve(cwd, config.currentVenvPath);

  const lines = [
    "Blocked by pi-pip2uv: use uv instead of pip for Python dependency changes.",
    `Reason: ${hit.why}.`,
    `Matched command: ${hit.snippet}`,
    "",
    "Recommended uv workflow:",
  ];

  if (!hasVenv) {
    lines.push(`  uv venv ${config.currentVenvPath}        # create the local virtual environment first`);
  }

  if (hasProject) {
    lines.push("  uv add <package>          # project dependency; updates pyproject.toml, uv.lock, and .venv");
  } else {
    lines.push("  uv init                   # optional: initialize a uv project with pyproject.toml");
    lines.push("  uv add <package>          # add a dependency once this is a uv project");
  }

  lines.push(`  uv pip install <package>  # pip-style install into ${hasVenv ? config.currentVenvPath : "the local .venv"}`);
  if (hasLock) lines.push("  uv sync                   # sync uv.lock into .venv");
  lines.push("  uv run <command>          # run commands inside the project environment");

  if (hit.kind === "user-tool") {
    lines.push("  uvx <tool>                # run a Python CLI tool temporarily, if needed");
  }

  lines.push("");
  lines.push(`Current working directory: ${cwd}`);
  lines.push(`Expected local venv: ${venvPath}`);

  if (config.extraHint) {
    lines.push("");
    lines.push(config.extraHint);
  }

  return lines.join("\n");
}

export function normalizeShellCommand(command) {
  return String(command).replace(/\\\r?\n/g, " ").trim();
}

function collectMatches(patterns, text, metadata) {
  const hits = [];

  for (const segment of splitShellSegments(text)) {
    for (const pattern of patterns) {
      const match = pattern.exec(segment.text);
      if (!match?.[1]) continue;

      const localIndex = match.index + match[0].indexOf(match[1]);
      const snippet = segment.text.slice(localIndex, localIndex + match[1].length).trim();
      if (!snippet) continue;

      hits.push({
        snippet,
        index: segment.index + localIndex,
        ...metadata,
      });
    }
  }

  return dedupeHits(hits);
}

function splitShellSegments(text) {
  const segments = [];
  let start = 0;
  let quote = null;

  for (let index = 0; index < text.length; index++) {
    const char = text[index];

    if (quote) {
      if (quote === '"' && char === "\\") {
        index++;
        continue;
      }
      if (char === quote) quote = null;
      continue;
    }

    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }

    if (isShellSeparator(char)) {
      pushSegment(segments, text, start, index);
      if ((char === "&" && text[index + 1] === "&") || (char === "|" && text[index + 1] === "|")) {
        index++;
      }
      start = index + 1;
    }
  }

  pushSegment(segments, text, start, text.length);
  return segments;
}

function pushSegment(segments, text, start, end) {
  const raw = text.slice(start, end);
  if (!raw.trim()) return;

  const leadingWhitespace = raw.match(/^\s*/)?.[0].length ?? 0;
  segments.push({
    text: raw.slice(leadingWhitespace),
    index: start + leadingWhitespace,
  });
}

function isShellSeparator(char) {
  return char === ";" || char === "\n" || char === "&" || char === "|" || char === "(" || char === ")";
}

function optionTokensBefore(stopPattern) {
  return String.raw`(?:\s+-{1,2}[^\s;&|()=]+(?:=${TOKEN})?(?:\s+(?!(?:${stopPattern})\b|-{1,2})${TOKEN})?)*`;
}

function dedupeHits(hits) {
  const seen = new Set();
  const unique = [];

  for (const hit of hits) {
    const key = `${hit.kind}\0${hit.index}\0${hit.snippet}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(hit);
  }

  return unique;
}

function hasSystemFlag(snippet) {
  return /(?:^|\s)--system(?:[=\s]|$)/i.test(snippet);
}

function isAllowedByRegex(hit, config) {
  return matchesAnyRegex(hit.snippet, config.allowedCommandRegexes);
}

function matchesAnyRegex(value, patterns) {
  for (const pattern of patterns ?? []) {
    try {
      if (new RegExp(pattern, "i").test(value)) return true;
    } catch {
      // Ignore invalid user-provided regexes; built-in guard rules still apply.
    }
  }
  return false;
}

function readJsonObject(path) {
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
  } catch {
    return null;
  }
  return null;
}

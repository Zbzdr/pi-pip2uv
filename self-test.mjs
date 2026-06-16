import assert from "node:assert/strict";
import { findUnsafePythonInstall, loadConfig } from "./detector.mjs";

const cwd = process.cwd();
const config = loadConfig(cwd);

const cases = [
  ["pip install requests", true],
  ["pip3 install requests", true],
  ["pip3.12 install requests", true],
  ["python -m pip install requests", true],
  ["python3 -m pip install -r requirements.txt", true],
  ["python -m pip --disable-pip-version-check install requests", true],
  ["pip --python .venv install requests", true],
  ["python -W ignore -m pip install requests", true],
  ["uv --project . pip install --system requests", true],
  ["sudo pip install requests", true],
  ["env PIP_DISABLE_PIP_VERSION_CHECK=1 pip install requests", true],
  ["pip install --user requests", true],
  ["./.venv/bin/pip install requests", true],
  ["source .venv/bin/activate && pip install requests", true],
  ["VIRTUAL_ENV=.venv pip install requests", true],
  ["uv pip install --system requests", true],
  ["uv pip install requests --system", true],
  ["python -m uv pip install --system requests", true],
  ["pipx install black", true],
  ["uv tool install ruff", true],
  ["python -m uv tool install ruff", true],
  ["uv add requests", false],
  ["uv pip install requests", false],
  ["uv sync", false],
  ["uv run python main.py", false],
  ["echo \"pip install requests\"", false],
  ["printf 'x; pip install requests'", false],
];

for (const [command, shouldBlock] of cases) {
  const hit = findUnsafePythonInstall(command, cwd, config);
  assert.equal(Boolean(hit), shouldBlock, `${command} => ${hit ? "blocked" : "allowed"}`);
}

const allowConfig = { ...config, allowedCommandRegexes: ["safe-package"] };
assert.equal(
  Boolean(findUnsafePythonInstall("pip install safe-package", cwd, allowConfig)),
  false,
  "allowedCommandRegexes should allow matching dangerous snippets",
);
const unallowedHit = findUnsafePythonInstall("pip install safe-package; pip install other-package", cwd, allowConfig);
assert.equal(Boolean(unallowedHit), true, "allowedCommandRegexes should not allow later unmatched snippets");
assert.match(unallowedHit.snippet, /other-package/);

console.log(`pi-pip2uv self-test passed (${cases.length + 3} cases).`);

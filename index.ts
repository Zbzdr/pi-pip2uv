import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { buildReason, findUnsafePythonInstall, loadConfig } from "./detector.mjs";

export default function (pi: ExtensionAPI) {
  pi.on("tool_call", (event, ctx) => {
    if (event.toolName !== "bash") return undefined;

    const command = event.input?.command;
    if (typeof command !== "string") return undefined;

    const config = loadConfig(ctx.cwd, configLoadOptions(ctx, ctx.cwd));
    const hit = findUnsafePythonInstall(command, ctx.cwd, config);
    if (!hit) return undefined;

    const reason = buildReason(hit, ctx.cwd, config);
    if (config.notify && ctx.hasUI) {
      ctx.ui.notify("pi-pip2uv blocked a global Python install; use uv + current .venv instead.", "warning");
    }

    return { block: true, reason };
  });

  // Also guard commands typed with ! / !! in interactive mode.
  pi.on("user_bash", (event, ctx) => {
    const cwd = event.cwd ?? ctx.cwd;
    const command = event.command;
    if (typeof command !== "string") return undefined;

    const config = loadConfig(cwd, configLoadOptions(ctx, cwd));
    const hit = findUnsafePythonInstall(command, cwd, config);
    if (!hit) return undefined;

    return {
      result: {
        output: buildReason(hit, cwd, config),
        exitCode: 1,
        cancelled: false,
        truncated: false,
      },
    };
  });
}

function configLoadOptions(ctx: ExtensionContext, cwd: string) {
  return {
    includeProjectConfig: cwd === ctx.cwd && ctx.isProjectTrusted(),
  };
}

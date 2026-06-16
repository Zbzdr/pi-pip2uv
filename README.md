# pi-pip2uv

[中文文档](./README.zh-CN.md)

A small [pi](https://pi.dev) extension that blocks `pip install`-style Python dependency changes and tells the agent to use [`uv`](https://docs.astral.sh/uv/) with the current project environment instead.

In pi and many other coding-agent workflows, agents may reach for global Python / pip installs when trying to make a script run, instead of respecting the project's local virtual environment. `pi-pip2uv` acts as a runtime guardrail: it blocks those unmanaged installs and points the agent back to `uv` and the local `.venv` workflow. This is especially useful for small scripts and tool projects, where a lightweight runtime check can be more reliable than relying only on skills, AGENTS.md, or prompt instructions.

The guard uses a strict policy: it also blocks `.venv/bin/pip install ...`, so agents consistently prefer `uv` for Python dependency changes.

## What it blocks

Blocked by default:

- `pip install ...`
- `pip3 install ...`
- `python -m pip install ...`
- `uv pip install --system ...`
- `pipx install ...`
- `uv tool install ...`

Allowed by default:

- `uv add ...`
- `uv pip install ...`
- `uv sync`
- `uv run ...`
- `uvx ...`

## Install

From npm:

```bash
pi install npm:pi-pip2uv
```

Pin a specific npm version:

```bash
pi install npm:pi-pip2uv@0.1.0
```

From GitHub:

```bash
pi install git:github.com/Zbzdr/pi-pip2uv@v0.1.0
```

Or test from a local checkout:

```bash
pi -e ./index.ts
```

Restart pi or run `/reload` after changing installed extensions.

## Updating

For unpinned npm installs:

```bash
pi update npm:pi-pip2uv
```

or update all pi packages:

```bash
pi update --extensions
```

For pinned npm versions or GitHub tags, install the newer version explicitly:

```bash
pi install npm:pi-pip2uv@0.1.1
pi install git:github.com/Zbzdr/pi-pip2uv@v0.1.1
```

## Load order

For best results, load `pi-pip2uv` before generic permission/prompt extensions. This lets it block disallowed Python dependency changes immediately, while unrelated commands continue to your normal permission system.

For example, with `@gotgenes/pi-permission-system`, put it after `pi-pip2uv` in `~/.pi/agent/settings.json`:

```json
{
  "packages": [
    "npm:pi-pip2uv",
    "npm:@gotgenes/pi-permission-system"
  ]
}
```

Project-local installs also run before user/global packages after the project is trusted.

### If a permission system loads first

If a permission extension loads before `pi-pip2uv`, you can allow the `pip`/`uv install` patterns in that permission system so they pass through to `pi-pip2uv`. Keep those allow rules specific to install commands that `pi-pip2uv` will block; unrelated commands should still be handled by your permission system.

Loading `pi-pip2uv` before permission prompts is still the cleanest setup when you control package order.

## Configuration

Default configuration lives in `config.json` next to the extension.

When installed globally, trusted projects can override config at:

```text
.pi/extensions/pi-pip2uv/config.json
```

Environment variable override:

```bash
export PI_PIP2UV_CONFIG=/absolute/path/to/config.json
```

Legacy environment variable `PI_PIP_UV_GUARD_CONFIG` is also accepted.

Example config:

```json
{
  "enabled": true,
  "blockPipInstall": true,
  "blockUvSystemInstall": true,
  "blockUserWideToolInstall": true,
  "currentVenvPath": ".venv",
  "notify": true,
  "allowedCommandRegexes": [],
  "extraHint": ""
}
```

### `allowedCommandRegexes`

`allowedCommandRegexes` is applied per matched dangerous command snippet. Allowing one snippet does not allow later unsafe snippets in the same shell command.

Use allow rules sparingly and make them as specific as possible; they intentionally weaken the guard.

## Test

```bash
npm test
```

You can also run:

```bash
node self-test.mjs
```

## Security

pi extensions run with your local user permissions. Review extension source before installing third-party packages.

`pi-pip2uv` is a policy guard, not a sandbox. It intercepts pi bash tool calls and interactive `!` / `!!` user bash commands before execution, but real isolation should come from your OS, container, VM, or sandbox policy.

## Acknowledgements

This project was primarily written with [pi](https://pi.dev) and GPT-5.5.

## License

MIT

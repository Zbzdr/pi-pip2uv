# pi-pip2uv

[中文文档](./README.zh-CN.md)

A small [pi](https://pi.dev) extension that blocks `pip install`-style Python dependency changes and tells the agent to use [`uv`](https://docs.astral.sh/uv/) with the current project environment instead.

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

If you installed the unpinned npm package:

```bash
pi update npm:pi-pip2uv
```

or update all pi packages:

```bash
pi update --extensions
```

If you pinned a specific npm version, for example `npm:pi-pip2uv@0.1.0`, pi treats it as pinned. Move to a newer version by installing the new version explicitly:

```bash
pi install npm:pi-pip2uv@0.1.1
```

For a GitHub install pinned to a tag, move to a newer tag the same way:

```bash
pi install git:github.com/Zbzdr/pi-pip2uv@v0.1.1
```

To publish a new npm release as the maintainer:

```bash
npm test
npm version patch   # or minor / major
npm publish --access public
git push --follow-tags
```

## Load order

For best results, load `pi-pip2uv` before generic permission/prompt extensions. This lets it block disallowed Python dependency changes immediately, while unrelated commands continue to your normal permission system.

For global packages, put it before permission packages in `~/.pi/agent/settings.json`:

```json
{
  "packages": [
    "npm:pi-pip2uv",
    "npm:@gotgenes/pi-permission-system"
  ]
}
```

Project-local installs also run before user/global packages after the project is trusted.

## Configuration

Default configuration lives in `config.json` next to the extension.

When installed globally, trusted projects can override config at:

```text
.pi/extensions/pi-pip2uv/config.json
```

The legacy path below is also accepted for compatibility:

```text
.pi/extensions/pip-uv-guard/config.json
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

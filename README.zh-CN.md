# pi-pip2uv

一个小型 [pi](https://pi.dev) 扩展，用于拦截 `pip install` 风格的 Python 依赖变更，并提示 agent 使用 [`uv`](https://docs.astral.sh/uv/) 和当前项目环境。

这个扩展有意保持严格：即使是 `.venv/bin/pip install ...` 也会被拦截，因为目标是让 agent 养成一致使用 `uv` 的习惯。

## 拦截策略

默认拦截：

- `pip install ...`
- `pip3 install ...`
- `python -m pip install ...`
- `uv pip install --system ...`
- `pipx install ...`
- `uv tool install ...`

默认允许：

- `uv add ...`
- `uv pip install ...`
- `uv sync`
- `uv run ...`
- `uvx ...`

## 安装

从 GitHub 安装：

```bash
pi install git:github.com/Zbzdr/pi-pip2uv@v0.1.0
```

本地测试：

```bash
pi -e ./index.ts
```

安装或修改扩展后，重启 pi 或执行 `/reload`。

## 加载顺序建议

建议让 `pi-pip2uv` 加载在通用 permission / prompt 类扩展之前。这样它可以直接拦截明确禁止的 Python 依赖变更，而其它无关命令仍会继续交给你的 permission system 处理。

如果使用全局 package，可以在 `~/.pi/agent/settings.json` 中把它放在 permission 插件前面：

```json
{
  "packages": [
    "git:github.com/Zbzdr/pi-pip2uv@v0.1.0",
    "npm:@gotgenes/pi-permission-system"
  ]
}
```

项目级安装在项目被信任后，通常也会早于用户级 / 全局 package 执行。

## 配置

默认配置位于扩展旁边的 `config.json`。

全局安装时，受信任项目可以在下面的位置提供项目级覆盖配置：

```text
.pi/extensions/pi-pip2uv/config.json
```

为了兼容旧名称，也支持：

```text
.pi/extensions/pip-uv-guard/config.json
```

也可以通过环境变量指定配置文件：

```bash
export PI_PIP2UV_CONFIG=/absolute/path/to/config.json
```

旧环境变量 `PI_PIP_UV_GUARD_CONFIG` 也仍然可用。

配置示例：

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

`allowedCommandRegexes` 会逐个作用于匹配到的危险命令片段。放行一个片段不会导致同一条 shell 命令中后续未匹配的危险片段被放行。

请谨慎使用 allow 规则，并尽量写得精确；它会有意降低 guard 的严格程度。

## 测试

```bash
npm test
```

或者直接运行：

```bash
node self-test.mjs
```

## 安全说明

pi 扩展会以你的本地用户权限运行。安装第三方扩展前，请先审查源码。

`pi-pip2uv` 是一个策略 guard，不是沙箱。它会在执行前拦截 pi 的 bash tool 调用，以及交互模式下的 `!` / `!!` 用户 bash 命令。但真正的隔离仍应由操作系统、容器、虚拟机或其它沙箱策略提供。

## License

MIT

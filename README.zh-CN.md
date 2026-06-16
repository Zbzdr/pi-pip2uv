# pi-pip2uv

一个小型 [pi](https://pi.dev) 扩展，用于拦截 `pip install` 风格的 Python 依赖变更，并提示 agent 使用 [`uv`](https://docs.astral.sh/uv/) 和当前项目环境。

pi-agent 以及许多 coding agent 在写代码、为了跑通脚本时，常常会顺手用全局 Python / pip 安装依赖一把梭，而缺少项目级 `.venv` 的边界意识。这个插件会及时阻断并提示它回到 `uv` 和本地 `.venv` 的工作流。它在小型工具项目里会很好用，而且比单纯依赖 skill、AGENTS.md 或提示词提醒更让人安心。

这个扩展采用较严格的策略：即使执行 `.venv/bin/pip install ...` 也会被拦截；目的是让 agent 在处理 Python 依赖变更时始终优先使用 `uv`。

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

从 npm 安装：

```bash
pi install npm:pi-pip2uv
```

固定安装某个 npm 版本：

```bash
pi install npm:pi-pip2uv@0.1.0
```

从 GitHub 安装：

```bash
pi install git:github.com/Zbzdr/pi-pip2uv@v0.1.0
```

本地测试：

```bash
pi -e ./index.ts
```

安装或修改扩展后，重启 pi 或执行 `/reload`。

## 更新

如果安装的是未固定版本的 npm package：

```bash
pi update npm:pi-pip2uv
```

或者更新所有 pi package：

```bash
pi update --extensions
```

如果安装的是固定 npm 版本或 GitHub tag，需要显式安装新版本：

```bash
pi install npm:pi-pip2uv@0.1.1
pi install git:github.com/Zbzdr/pi-pip2uv@v0.1.1
```

## 加载顺序建议

建议让 `pi-pip2uv` 加载在通用 permission / prompt 类扩展之前。这样它可以直接拦截明确禁止的 Python 依赖变更，而其它无关命令仍会继续交给你的 permission system 处理。

以 `@gotgenes/pi-permission-system` 为例，可以在 `~/.pi/agent/settings.json` 中把它放在 `pi-pip2uv` 后面：

```json
{
  "packages": [
    "npm:pi-pip2uv",
    "npm:@gotgenes/pi-permission-system"
  ]
}
```

项目级安装在项目被信任后，通常也会早于用户级 / 全局 package 执行。

### 如果 permission system 先加载

如果某个 permission 扩展加载在 `pi-pip2uv` 之前，可以在该 permission system 中放行 `pip` / `uv install` 相关模式，让它们继续传递给 `pi-pip2uv` 处理。allow 规则应尽量写得精确，只覆盖会被 `pi-pip2uv` 拦截的安装命令；无关命令仍应由你的 permission system 正常处理。

如果你能控制 package 顺序，让 `pi-pip2uv` 加载在 permission prompt 之前仍然是最干净的方案。

## 配置

默认配置位于扩展旁边的 `config.json`。

全局安装时，受信任项目可以在下面的位置提供项目级覆盖配置：

```text
.pi/extensions/pi-pip2uv/config.json
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

## 致谢

本项目主要由 [pi](https://pi.dev) 与 GPT-5.5 协作编写。

## License

MIT

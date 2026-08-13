<p align="center">
  <h1 align="center">DevEco Code · 个人增强版</h1>
</p>
<p align="center">面向 HarmonyOS 开发场景的 AI Agent 工具 · Windows 桌面安装版</p>
<p align="center">
  <a href="README.en.md">English</a> · 简体中文
</p>

<p align="center">
  <img alt="Node.js" src="https://img.shields.io/badge/Node.js-%3E%3D22-green.svg" />
  <img alt="platform" src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%E5%BC%80%E5%8F%91%E4%B8%AD%20%7C%20Linux%20%E5%BC%80%E5%8F%91%E4%B8%AD-blue.svg" />
  <a href="https://developer.huawei.com/consumer/cn/deveco-studio/"><img alt="DevEco Studio" src="https://img.shields.io/badge/DevEco%20Studio-%3E%3D6.1-orange.svg" /></a>
  <a href="LICENSE"><img alt="License" src="https://img.shields.io/badge/license-MIT-green.svg" /></a>
</p>

<p align="center">
  <img src="https://raw.gitcode.com/openharmony-sig/deveco-code/raw/develop/assets/readme/readme-screenshot.png" alt="DevEco Code" width="600">
</p>

***

## 本项目（个人增强版 · Windows 桌面安装版）

> 本仓库是 DevEco Code 的个人定制版本：基于 opencode 构建的 **Windows 桌面安装版**（便携式，非 npm CLI 版），在原版基础上新增了**手机配对系统**、**任务进度可视化**、**环境自检** 等一系列体验增强，适合日常本地开发使用。
>
> 官方原版（npm CLI 版）请见文末「[官方项目](#官方项目)」。

### 核心亮点

| 能力 | 说明 |
| --- | --- |
| 📊 **任务进度可视化** | TRAE Work 风格任务面板，将「待办」与「上下文占用」合并为单一面板，实时展示任务进度、状态流转与上下文分布，开发过程一目了然 |
| 📱 **手机配对系统** | 桌面端生成本地二维码，鸿蒙手机端（Mate 80 Pro 等）扫码即可配对；配对后可在手机上查看电脑端会话、收发消息 |
| 🔍 **环境自检（env-doctor）** | 启动时自动检测开发环境（DevEco Studio / HDC / Hvigor / Node 等），给出缺失项与修复指引 |
| 🎨 **UI 精修** | 任务面板采用玻璃拟态卡片、语义化配色、精确字重排版，明暗主题自适应 |
| 🛠 **体验修复** | 修复待办状态不同步、上下文恒显示 0%、模型图片不可见、手机端全屏布局遮挡等多项问题 |

---

### 1. 任务进度可视化（核心亮点）

在 AI Agent 工具中，**任务过程往往是黑盒**：用户看不到 Agent 正在做什么、做到了哪一步、上下文还剩多少。本项目将「任务面板」从辅助信息提升为主交互视图，让 Agent 的工作过程**可视化、可追踪、可掌控**。

#### 能力详情

- **单一面板合并视图**：将原本分散的「待办列表」与「上下文占用」合并为同一面板，左侧展示当前任务流，右侧展示上下文消耗情况，避免在多个面板间来回切换。
- **实时任务进度**：任务以卡片形式列出，状态以颜色与图标语义化区分（待开始 / 进行中 / 已完成 / 已阻塞），点击可展开子任务树。
- **上下文占用可视化**：以进度条 + 百分比形式展示当前会话上下文使用率，并对接近上限时给出红色预警，避免突发截断。
- **玻璃拟态卡片**：面板整体采用 frosted glass 效果，配合语义化配色与精确字重排版，明暗主题自动适配，长时间观看不易疲劳。
- **状态同步修复**：修复了原版「待办状态不同步」「上下文恒显示 0%」等问题，面板数据与真实执行状态保持一致。

#### 适用场景

- 长会话任务管理：清晰看到每一步 Agent 的执行结果与待办剩余项
- 多任务并行：快速切换不同任务上下文，避免混淆
- 上下文预算管理：在逼近模型上下文上限前主动拆分会话

---

### 2. 手机配对系统

将「电脑端 AI Agent」延伸到「口袋里的鸿蒙手机」。配对完成后，可在手机端实时查看电脑端会话、收发消息，**离开工位也能继续跟进 Agent 的工作**。

#### 工作流程

1. **桌面端生成二维码**：在 DevEco Code 设置面板中开启手机配对，桌面端自动生成包含本地配对信息的二维码。
2. **鸿蒙手机扫码配对**：使用搭载 HarmonyOS 的手机（已验证 Mate 80 Pro 等）扫描二维码，完成设备配对。
3. **手机端查看与交互**：配对后，手机端可：
   - 实时查看电脑端会话内容
   - 在手机上向 Agent 发送新消息
   - 接收 Agent 的回复与任务完成通知

#### 技术细节

- 配对协议详见 [REMOTE-BRIDGE-PROTOCOL.md](./REMOTE-BRIDGE-PROTOCOL.md)
- 仅在**本地局域网**内通信，不经过外部服务器，数据隐私可控
- 鸿蒙手机端应用源码位于独立仓库 `deveco-code-mobile`

#### 体验修复

- 修复手机端全屏布局被状态栏 / 导航栏遮挡问题
- 修复模型图片在手机端不可见问题
- 优化手机端长会话滚动性能

---

### 3. 环境自检（env-doctor）

启动时自动扫描本地开发环境，给出**缺失项清单与修复指引**，避免因环境问题导致构建、调试失败。

#### 检测项

| 检测项 | 说明 |
| --- | --- |
| DevEco Studio | 检测安装路径、版本号，校验是否 ≥ 6.1 |
| HDC | HarmonyOS Device Connector，用于真机调试与日志收集 |
| Hvigor | HarmonyOS 构建工具链 |
| Node.js | 校验版本是否 ≥ 22 |
| `DEVECO_HOME` | 环境变量是否已正确配置 |

#### 输出示例

```
✓ Node.js        v22.11.0
✓ DevEco Studio  6.1.0
✗ HDC            未检测到，请检查 DevEco Studio 安装
✗ DEVECO_HOME    未配置，请设置指向 DevEco Studio 安装目录
```

---

### 4. UI 精修

- **玻璃拟态卡片**：frosted glass + 模糊背景，层级清晰
- **语义化配色**：成功 / 警告 / 错误 / 信息四态配色统一
- **精确字重排版**：标题、正文、辅助文字字重分明
- **明暗主题自适应**：跟随系统主题自动切换

---

### 5. 体验修复清单

| # | 问题 | 修复 |
| --- | --- | --- |
| 1 | 待办状态不同步 | 重构任务状态同步机制，面板与执行状态强一致 |
| 2 | 上下文恒显示 0% | 修复上下文计算逻辑，实时反映真实占用 |
| 3 | 模型图片不可见 | 修复图片资源加载路径 |
| 4 | 手机端全屏布局遮挡 | 适配安全区，状态栏 / 导航栏不再遮挡内容 |
| 5 | 长会话滚动卡顿 | 虚拟列表优化，万条消息流畅滚动 |

---

### 本地开发

```bash
# 修改源码后重新编译并覆盖到本地安装目录
cd packages/desktop && bun run install:local
```

默认目录为 Windows 的 `E:\finish\DevEco Code`、macOS 的 `/Applications/DevEco Code.app`，以及 Linux 的 `~/.local/opt/DevEco Code`。可通过 `DEVECO_CODE_INSTALL_DIR` 指向其他已解包的应用目录。

配对协议说明见 [REMOTE-BRIDGE-PROTOCOL.md](./REMOTE-BRIDGE-PROTOCOL.md)。

---

### 核心代码边界（Core boundary）

本仓库通过 better-harness core-change-watch 的边界配置**显式声明**核心代码目录，替代无配置时的按候选推断回退（inferred-core-boundary），使 diff 影响评估与后续检查/实现建议（`inspect-primary-core`、`apply-targeted-implementation`）的目标落在真实热核目录。

**判定依据**（180 天窗口热文件 + 包级 commit 汇总）：

- **包级 commit 汇总**：`packages/opencode` 以 216 次提交领先全部包（其次 core 39、app 35、sdk 33），为主要热核载体
- **热文件分布**：180 天热文件前五全部位于 `packages/opencode/src`（`agent/agent.ts` 33、`tui/routes/session/index.tsx` 32、`tui/component/prompt/index.tsx` 28、`session/prompt.ts` 28、`provider/provider.ts` 28）
- **sdk 的排除**：`packages/sdk/js/src` 的热度集中在生成输出 `v2/gen/`（非手写源码，生成物改动不应判定为核心变更），故 include 目录但排除生成子目录

**配置位置**：`.better-harness/core-code`（每行一个模式；`#` 注释，`!` 前缀排除；排除规则须置于 include 之后）

| 规则 | 含义 |
| --- | --- |
| `packages/opencode/src/` | 主热核：opencode 源码（agent / tui / session / provider / tool 等） |
| `packages/sdk/js/src/` | 次热核：sdk 手写源码 |
| `!packages/sdk/js/src/v2/gen/` | 排除 SDK 生成输出，生成物改动不触发核心边界 |

**效果**：configured 边界下，follow-up 检查与实现建议优先采用配置目录内的 180 天热文件；若热核跨包（如 opencode 与 sdk 同时热），每个 include 目录都会被独立覆盖。

---

## 跨平台开发计划

当前个人增强版的跨平台支持情况：

| 平台 | 状态 | 说明 |
| --- | --- | --- |
| Windows | ✅ 已发布 | 当前主力维护版本 |
| macOS | ✅ 已支持 | 复用 Electron 跨平台架构，原生模块（node-pty / @parcel/watcher）已为 darwin-arm64 与 darwin-x64 准备；环境自检已适配 `/Applications/DevEco-Studio.app/Contents` 路径 |
| Linux | 🚧 开发中 | 基于 Electron 跨平台方案，适配主流发行版（Ubuntu / Debian / Arch 等） |

### macOS 版技术细节

- **打包**：`electron-builder` 配置 `mac.target: ["dmg", "zip"]`，已开启 `hardenedRuntime` 与 `notarize`，entitlements 见 [resources/entitlements.plist](./packages/desktop/resources/entitlements.plist)
- **原生模块**：`@lydell/node-pty-darwin-arm64` / `@lydell/node-pty-darwin-x64` / `@parcel/watcher-darwin-*` 均在 [packages/desktop/package.json](./packages/desktop/package.json) 的 `optionalDependencies` 中
- **窗口**：[windows.ts](./packages/desktop/src/main/windows.ts) 已为 darwin 启用 `titleBarStyle: "hidden"` + `trafficLightPosition`，与系统红绿灯按钮对齐
- **菜单**：[menu.ts](./packages/desktop/src/main/menu.ts) 已为 darwin 注册原生菜单
- **环境自检**：[env-doctor](./packages/desktop/src/main/env-doctor/) 已适配 macOS DevEco Studio 安装路径（`.app/Contents`），`DEVECO_HOME` 指向 `Contents` 目录
- **本地开发**：`bun run install:local` 在 macOS 上会覆盖到 `/Applications/DevEco Code.app/Contents/Resources/app/out/`，并通过 `osascript` 优雅退出已运行实例

### 打包 macOS 版

#### 方式一：本地打包

```bash
cd packages/desktop
bun run build
bun run package:mac    # 产出 dist/opencode-desktop-mac-${arch}.dmg 与 .zip
```

> ⚠️ macOS 公证（notarize）需要 Apple 开发者证书与 App Store Connect API Key，配置以下环境变量后才会执行公证步骤：
> - `CSC_LINK` / `CSC_KEY_PASSWORD`：p12 证书与密码
> - `APPLE_API_KEY` / `APPLE_API_KEY_ID` / `APPLE_API_ISSUER`：API Key 文件路径与凭据

#### 方式二：GitHub Actions 自动构建

推 tag 或手动触发 [.github/workflows/build-mac.yml](./.github/workflows/build-mac.yml) 即可在 GitHub 托管的 macOS runner 上构建 arm64 + x64 双架构 dmg，并自动上传到 Release。

```bash
# 触发自动构建（推 tag）
git tag v1.0.0
git push origin v1.0.0

# 或手动触发
# GitHub 仓库 → Actions → build-mac → Run workflow
```

代码签名 / 公证为可选项，需在仓库 Settings → Secrets and variables → Actions 中配置：
- **Variables**：`APPLE_CODESIGN_ENABLED=true`（启用开关）
- **Secrets**：`APPLE_CERTIFICATE` / `APPLE_CERTIFICATE_PASSWORD` / `APPLE_API_KEY_ID` / `APPLE_API_ISSUER` / `APPLE_API_KEY_P8`

未配置时 workflow 仍会产出未签名版本，用户首次打开需右键 → 打开。

### Linux 版技术路线

- **跨平台框架**：采用 [Electron](https://www.electronjs.org/) 作为桌面壳层，复用现有 Web 前端代码，最大化跨平台一致性
- **打包基线**：[build-linux.yml](./.github/workflows/build-linux.yml) 已支持 Linux x64 CI，产出 AppImage、deb 与 rpm 安装包；可推送 `linux-build` 分支或在 Actions 中手动触发
- **本地开发**：将解包后的应用放到 `~/.local/opt/DevEco Code`，或设置 `DEVECO_CODE_INSTALL_DIR`，然后运行 `bun run install:local`
- **原生模块迁移**：环境自检已覆盖 `/opt/DevEco-Studio`、`/usr/local/DevEco-Studio` 与用户级安装目录；其他涉及系统调用的模块仍需真机验证
- **鸿蒙生态约束**：HarmonyOS 编译构建、模拟器与真机调试依赖 [DevEco Studio](https://developer.huawei.com/consumer/cn/deveco-studio/)，目前 DevEco Studio 仅提供 Windows 与 macOS 版本；Linux 版将聚焦「代码生成 / 代码审查 / 知识检索」等不依赖 DevEco Studio 的能力

### 进度跟踪

Mac 版与 Linux 版的开发进度将在本仓库的 [Issues](../../issues) 与 [Projects](../../projects) 中跟踪，欢迎关注与反馈。

---

## 官方项目

本仓库基于官方 [DevEco Code](https://gitcode.com/openharmony-sig/deveco-code) 扩展开发。以下为官方原版（npm CLI 版）的相关信息：

- **官方仓库**：[openharmony-sig/deveco-code](https://gitcode.com/openharmony-sig/deveco-code)
- **官方文档**：[README (官方原版)](https://gitcode.com/openharmony-sig/deveco-code/blob/develop/README.md) · [FAQ](https://gitcode.com/openharmony-sig/deveco-code/wiki/FAQ.md) · [OpenCode TUI 文档](https://opencode.ai/docs/zh-cn/tui/)
- **官方安装**：`npm install -g @deveco/deveco-code`（[NPM 包](https://www.npmjs.com/package/@deveco/deveco-code)）
- **官方支持平台**：Windows x64 · macOS arm64 · macOS x64（暂不支持 Linux）
- **问题反馈**：官方原版问题请到 [GitCode Issue](https://gitcode.com/openharmony-sig/deveco-code/issues) 反馈；本个人增强版的问题请在本仓库 Issue 反馈

> DevEco Code 基于 [OpenCode](https://opencode.ai) 扩展开发，但**并非** OpenCode 团队出品，与 OpenCode 团队无任何附属或关联关系。

---

## 参与贡献

欢迎贡献！请在提交 Pull Request 前阅读 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 开源许可

[MIT License](LICENSE)

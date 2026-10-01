---
title: Codex 更新后打不开？一个针对 Windows 运行时暂存故障的修复工具
date: 2026-10-01 12:00:00
updated: 2026-10-01 12:00:00
tags:
  - Bug
  - Windows
  - Codex
  - Focus
description: 更新后后台进程仍在，但窗口没有出现？Codex Windows Runtime Fix 针对 cua_node 运行时暂存未完成这一特定故障，提供检测、重建与验证工具。
excerpt: 更新后后台进程仍在，但窗口没有出现？这个开源工具针对 cua_node 运行时暂存未完成这一特定故障，提供检测、重建与验证。本文介绍适用条件、使用方式与项目入口。
---

更新应用后，后台进程还在，窗口却迟迟不出现。如果同时发现 `cua_node` 目录里反复生成未完成的 `.staging-*` 暂存目录，可以看看这个项目：

**[Codex Windows Runtime Fix · 查看 GitHub 仓库](https://github.com/chadoshamot/codex-windows-runtime-fix)**

这是一个非官方社区修复工具，针对 Windows 上观察到的一种运行时暂存故障。本文根据项目 README 整理，介绍适用场景与使用方式；完整源码和最新说明以仓库为准。

<!-- more -->

## 哪种情况可以参考这个工具？

项目 README 描述的故障具有以下特征：

- Codex / ChatGPT 桌面应用在更新之前可以正常使用。
- 更新后，任务管理器里仍有 `ChatGPT.exe` 进程，但应用窗口没有出现。
- 以下目录中有一个或多个未完成的 `.staging-*` 目录：

```text
%LOCALAPPDATA%\OpenAI\Codex\runtimes\cua_node
```

例如，目录中存在多个 `.staging-运行时ID-随机后缀`，而相应的最终运行时目录缺失或不完整。

**仅凭“窗口打不开”不能确认是这个问题。** 如果没有符合条件的暂存目录，工具会拒绝修复；它并不覆盖所有启动失败的原因。

## 修复思路：从应用自带的运行时重建

工具使用已安装应用包中自带的 `cua_node` 运行时，重建应用预期的本地运行时目录。根据 README，脚本的主要步骤是：

1. 停止现有的 ChatGPT / Codex 进程。
2. 检测已安装的 `OpenAI.Codex` Windows 应用包。
3. 检查包内运行时是否包含 `bin\node.exe`、`bin\node_repl.exe` 和 `manifest.json`。
4. 从最新的 `.staging-*` 目录名中识别运行时 ID。
5. 检查最终运行时是否已完整存在；需要修复时，将应用包内的运行时复制到预期目录。
6. 对比文件数量、总字节数，并检查关键文件。
7. 只有验证通过后，才自动启动应用。

运行时 ID 动态识别，不依赖写死的应用版本或某个固定哈希。复制步骤使用 `xcopy`，具体实现可直接在仓库中查看。

## 如何使用

### 方式一：双击启动器

打开 **[GitHub 仓库](https://github.com/chadoshamot/codex-windows-runtime-fix)**，下载以下两个文件，放在同一个文件夹中：

```text
Fix-CodexRuntime.bat
Fix-CodexRuntime.ps1
```

保存正在进行的工作后，查看脚本内容，再双击 `Fix-CodexRuntime.bat`。脚本会停止现有应用进程；如果 Windows 显示 UAC 提示，请核对提示并自行决定是否继续。

### 方式二：直接运行 PowerShell 脚本

在保存脚本的文件夹打开 PowerShell，执行：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\Fix-CodexRuntime.ps1"
```

这条命令对当前启动的 PowerShell 进程使用 `Bypass` 执行策略。请在阅读并信任脚本后执行，完整操作说明见 [仓库 README](https://github.com/chadoshamot/codex-windows-runtime-fix#usage)。

## 检查失败时会怎样？

README 明确列出了一组终止条件，包括找不到应用包、匹配到多个应用包、包内运行时不完整、没有暂存目录、目录名格式异常、复制失败，以及文件数量、总字节数或关键文件检查失败。

遇到这些情况，脚本会终止，不会继续猜测。它不会自动删除旧运行时或暂存目录。

文件数量、大小和关键文件的检查用于验证复制结果，并不是对所有文件内容做密码学完整性校验。

## 隐私与适用边界

根据项目 README，修复脚本本身不联网、不上传数据、不收集遥测，也不读取对话、账户凭据、浏览器 Cookie 或任意用户文档。启动后的桌面应用可能联网，这是另一个独立行为。

这仍然是一个会修改应用本地运行时目录的**非官方方案**，与 OpenAI 无隶属关系，也没有获得官方背书。未来应用包布局或运行时机制变化后，它可能失效。本文没有独立复测脚本的修复效果。

## 反馈问题与查看源码

如果工具未能完成修复，可在 [仓库 Issues](https://github.com/chadoshamot/codex-windows-runtime-fix/issues) 提供 Windows 版本、Codex 版本、脚本显示的运行时 ID、暂存尝试次数、文件数量、字节数与最终错误信息。

发布日志或截图前，请删除个人信息，不要直接上传未经检查的私有日志、崩溃转储、凭据或 `.codex` 目录。

**[前往 GitHub：查看源码、下载脚本与最新说明](https://github.com/chadoshamot/codex-windows-runtime-fix)**

项目采用 MIT 许可证。本文是项目介绍，后续使用方式与适用范围请以仓库最新 README 为准。


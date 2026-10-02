---
title: Paper Librarian：一个本地的 AI 论文管家
date: 2026-10-02 20:10:00
updated: 2026-10-02 21:50:00
categories:
  - 设计开发
tags:
  - Tool
  - AI
  - Agent
  - Python
  - Summary
description: 本地运行的论文管理 agent：PDF 入库、双语知识库、语义检索、ModelScope 同步、每日检索，以及一位能对话的馆长。
excerpt: 整理论文库最麻烦的不是读，而是收拾。这套本地 agent 把录入、归档、检索、上云和日常维护收进一个入口，再配一位会查库、会读全文、会联网的馆长。
---

整理论文库最麻烦的从来不是读，而是收拾。下载下来的 PDF 堆在下载文件夹里，元数据要手抄，摘要要自己写，过两周想找「那篇讲 GPU 调度的文章」，只能靠回忆文件名。

**Paper Librarian** 是一套跑在本地的论文管理 agent，把录入、检索、同步和日常维护收进一个入口，另外还有一位可以对话的「馆长」。

**[Paper Librarian（AI 论文管家）· GitHub 仓库](https://github.com/chadoshamot/paper-librarian)**

它密钥自带、可直接复现：所有 API Key 都填在本地 `.env`，仓库里不含任何真实密钥或个人数据。

<!-- more -->

## 功能一览

| 环节 | 做什么 |
| --- | --- |
| 录入 | PDF → 抓元数据 → AI 阅读全文生成摘要 → 自动分类 / 归档 / 重命名 → 生成双语 Markdown 卡片 |
| 检索 | 语义向量 + 关键词 + 标题加权，支持精准与探索（MMR）两种模式 |
| 论文库 | 大领域 → 方向 → work 三级目录树，可跳原文、就地改元数据、删除 |
| 每日检索 | 多源抓取 + 质量评分 + LLM 裁判，输出日报，可推库或发邮件 |
| 馆长 agent | 用对话完成查库、深读、联网搜索、下载入库、上云、去重 |
| 上云 | ModelScope 增量同步，PDF 走 git-lfs，知识库走 Markdown |

录入环节值得单独说一句：分类、归档、重命名不是按文件名猜的，而是先让模型读完全文生成摘要，再按摘要结果决定去处。顺序反过来之后，整理出来的库才像手动维护过的样子。

## 馆长 agent：一个统一入口

网页界面右侧有一个常驻聊天栏，也就是馆长 agent。它以 DeepSeek 为主体掌握全局并做决策，只在需要联网时调用 Kimi 的 web-search，搜索结果回传给它拍板。

它能调用的工具分几类：

- **查库与深读**：`search_library`、`get_paper`、`deep_read`、`compare_papers`、`library_stats`、`list_by_area`，回答里用反引号给出可点击的 pid 引用
- **联网搜索**：`web_search`，用来补库外的最新进展
- **维护库**：`download_paper`、`ingest_paper`、`reclassify_paper`、`edit_paper`、`fix_metadata`、`fix_all_titles`、`fix_summary`、`find_duplicates`、`mark_read` 等，凡是在网页上能做的它都能做
- **需要确认的动作**：`delete_paper` 与 `push_to_cloud` 只先生成计划，等你在对话里点「确认执行」后才真正动手

它的行为不写死在代码里，而是仓库根目录的 `AGENT.md`：身份、任务、工具、记忆规范、回答规范、禁止事项都在里面，每次问答前自动加载。想调整它的行为，改这个文件即可。

记忆分两层，都只存本地、不上云：`agent-memory.md` 记录使用者的画像、偏好与纠错，`agent-notes/{pid}.md` 存单篇深读笔记和对话里逐步积累的洞察。

## 桌面版

`paperbook.pyw` 把整套 Web 界面装进一个原生窗口，双击即开，关闭窗口自动停服。

- Windows 走系统自带的 WebView2 渲染；没有 WebView2 时回退为默认浏览器打开
- 顶部导航有「设置」控制台，模型、检索、每日检索、质量权重、云端仓库，以及 `.env` 里的各家密钥都能在界面里改
- 密钥仍然只落在本地 `.env`
- 想加桌面或开始菜单快捷方式，右键 `install-shortcuts.ps1` 用 PowerShell 运行，脚本与路径无关，项目搬到别处重跑一次即可

## 安装

环境要求是 Python 3.10+（推荐 3.11 / 3.12）和带 git-lfs 的 Git。

```bash
git clone https://github.com/chadoshamot/paper-librarian.git
cd paper-librarian
python setup.py
```

`setup.py` 是交互式的：检查 Python、建目录、导入或初始化论文库、生成配置与 `.env`、装依赖、冒烟验证。可选项直接回车跳过，对应功能会优雅降级。

跑起来有三种方式：

```bash
python -m service          # 交互式 CLI 主菜单
python -m service.web      # 网页界面，默认 http://127.0.0.1:8000
python -m service.desktop  # PaperBook 桌面壳
```

常用命令：

```bash
python -m service.ingest papers/xxx.pdf                          # 完整录入一篇
python -m service.search "GPU 集群调度" --mode explore --top 10  # 语义检索 / 探索
python -m service.cloud sync                                     # 增量同步到 ModelScope
python -m service.daily --top 10                                 # 生成当日检索日报
```

## 密钥配置

所有密钥只写在 `.env`，而 `.env` 已被 `.gitignore` 排除，永远不会被提交；仓库里只有空值的 `.env.example`。论文库、PDF、检索索引、嵌入模型、日报、馆长记忆同样全部被 gitignore，由 `setup.py` 在本机生成。

密钥按需填写，只有 DeepSeek 是必需的：

| 密钥 | 用途 | 是否必填 |
| --- | --- | --- |
| `DEEPSEEK_API_KEY` | 分类、摘要、每日裁判、馆长 agent | 是 |
| `MODELSCOPE_TOKEN` | 自建库与云端同步 | 自建库模式需要 |
| `MOONSHOT_API_KEY` | 馆长联网搜索（Kimi） | 否 |
| `ZOTERO_USER_ID` / `ZOTERO_API_KEY` | Zotero 跳转链接 | 否 |
| `SMTP_*` | 日报邮件推送 | 否 |

可选项不填时，对应功能会返回友好错误，其余照常。DeepSeek 不填则录入、分类、每日裁判与馆长 agent 不可用，但检索与浏览仍然能用。

## 两种数据模式与定时任务

- **示例库**：如果设置了环境变量 `MODELSCOPE_DEMO_NS`，`setup.py` 会 clone 一个公开示例库，克隆完就能检索浏览，零 token
- **自建库**：填自己的 ModelScope namespace 与 token，用 `python -m service.ingest` 建库，再 `python -m service.cloud sync` 上云

每日检索可以挂到系统定时任务上：Windows 用 `schtasks`，Linux / macOS 用 cron，仓库里给了可以直接改路径的现成命令。

## 注意事项

- 首次检索会下载 jina-v2-base-zh 嵌入模型，几百 MB，之后走缓存
- PDF 上云依赖 git-lfs；如果 clone 下来的 PDF 是文本指针而不是真文件，需要装好 LFS 再重新同步
- 用 conda 时，要用目标环境执行 `setup.py` 与 `python -m service`，避免依赖装错环境
- 换 LLM 要同时改 `.env` 的 key 与 `config.yml` 的 model 段（provider / base_url / model 三处）

## 项目结构

```text
service/            # 服务代码，含 desktop.py 桌面壳与 settings.py 设置读写
paperbook.pyw       # PaperBook 桌面启动器，双击打开，无终端黑窗
AGENT.md            # 馆长 agent 的操作手册
setup.py            # 一键安装（交互式生成 .env / 配置 / 数据）
config.example.yml  # 配置模板
taxonomy.yml        # 分类学
knowledge-base/     # 双语知识库（gitignored，本地生成）
agent-memory.md     # 馆长全局记忆（本地，不上云）
```

如果同样被论文文件夹折磨，可以直接 clone 下来试；用起来有问题欢迎到仓库开 Issue。

**[前往 GitHub：源码与最新说明](https://github.com/chadoshamot/paper-librarian)**

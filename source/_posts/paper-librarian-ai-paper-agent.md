---
title: Paper Librarian v2.0：一个本地的 AI 论文管家
date: 2026-10-05 20:22:00
updated: 2026-10-05 20:22:00
categories:
  - 设计开发
tags:
  - Tool
  - AI
  - Agent
  - Python
  - Summary
description: 本地运行的论文管理 agent v2.0 版：PDF 入库、双语知识库、语义检索、ModelScope 同步、每日检索，以及一位会查库、会读全文、会联网、记得住上下文的馆长。
excerpt: 整理论文库最麻烦的不是读，而是收拾。这套本地 agent 把录入、归档、检索、上云和日常维护收进一个入口，v2.0 又补上了双击即开的桌面软件和一位有记忆的馆长。
---

整理论文库最麻烦的从来不是读，而是收拾。下载下来的 PDF 堆在下载文件夹里，元数据要手抄，摘要要自己写，过两周想找「那篇讲 GPU 调度的文章」，只能靠回忆文件名。

**Paper Librarian** 是一套跑在本地的论文管理 agent，把录入、检索、同步和日常维护收进一个入口，另外还有一位可以对话的「馆长」。项目今天更新到 **v2.0**：桌面版 PaperBook 成了主推入口，馆长补齐了下载、上云、去重这些写操作，每日检索换上了自己的研究需求文件，还补了英文说明和聊天记录归档。

**[Paper Librarian（AI 论文管家）· GitHub 仓库](https://github.com/chadoshamot/paper-librarian)**

它密钥自带、可直接复现：所有 API Key 都填在本地 `.env`，仓库里不含任何真实密钥或个人数据。

<!-- more -->

## v2.0 更新了什么

| 更新 | 说明 |
| --- | --- |
| 桌面版转正 | PaperBook 从附属入口变成主推界面，双击 `paperbook.pyw` 或 `PaperBook.bat` 即开，无终端黑窗，新增「设置」控制台 |
| 馆长补齐写操作 | 新增下载入库、推送上云、查重去重、批量修正标题等能力，网页能做的它都能做 |
| 每日检索换配置 | 检索方向从配置项迁到根目录 `research-profile.md`，网页内可直接编辑并保存快照 |
| 聊天记录归档 | 对话自动保存并同步到私有 ModelScope 仓库，支持历史会话继续与删除 |
| 中英双语说明 | 新增 `README_EN.md`，README 顶部可切换语言，同时统一了项目标志与品牌 |
| 工程加固 | 后台任务队列串行执行写操作、研究需求版本冲突检测、原子文件写入，并补上离线回归测试 |

加一个小注：仓库目前没有打 `v2.0` 的 git tag 或 Release 页，这个版本号是按这批更新的实际体量（新界面入口、新写操作、新配置体系、双语说明）标定的，装的时候认 README 即可。

## 功能一览

| 环节 | 做什么 |
| --- | --- |
| 录入 | PDF → 抓元数据 → AI 阅读全文生成摘要 → 自动分类 / 归档 / 重命名 → 生成双语 Markdown 卡片；网页上传可一次多选，逐个排队入库 |
| 检索 | 语义向量 + 关键词 + 标题加权，支持精准与探索（MMR）两种模式 |
| 论文库 | 大领域 → 方向 → work 三级目录树，可跳原文、就地改元数据、按标题与已读状态筛选 |
| 每日检索 | 多源抓取 + 质量评分 + LLM 裁判，输出日报，可推库或发邮件；检索方向写在 `research-profile.md` |
| 馆长 agent | 用对话完成查库、深读、联网搜索、下载入库、上云、去重 |
| 上云 | ModelScope 增量同步，PDF 走 git-lfs，知识库走 Markdown，聊天记录另存私有仓库 |
| 界面 | 交互式 CLI + 零依赖 Web 界面 + PaperBook 桌面版，三处共用同一个馆长 agent |

录入环节值得单独说一句：分类、归档、重命名不是按文件名猜的，而是先让模型读完全文生成摘要，再按摘要结果决定去处。顺序反过来之后，整理出来的库才像手动维护过的样子。

## 馆长 agent：一个统一入口

网页界面右侧有一个常驻聊天栏，也就是馆长 agent，宽度可以拖拽调整。它以 DeepSeek 为主体掌握全局并做决策，只在需要联网时调用 Kimi 的 web-search，搜索结果回传给它拍板。

它能调用的工具分几类：

- **查库与深读**：`search_library`、`get_paper`、`deep_read`、`compare_papers`、`library_stats`、`list_by_area`，回答里用反引号给出可点击的 pid 引用
- **联网搜索**：`web_search`，用来补库外的最新进展，带来源链接
- **维护库**：`download_paper`（下载后自动录入）、`ingest_paper`、`reclassify_paper`、`edit_paper`、`fix_metadata`、`fix_all_titles`、`fix_summary`、`find_duplicates`、`deduplicate_papers`、`mark_read`、`pull_library`、`push_to_cloud`、`run_daily_retrieval`、`read_daily_report`、`send_daily_email` 等，凡是在网页上能做的它都能做
- **需要确认的动作**：`delete_paper` 与 `push_to_cloud` 只先生成计划，等你在对话里点「确认执行」后才真正动手

论文库里的「让馆长整理」会让它自己检查缺失信息和重复论文，拟一份整理计划出来；论文详情页的「与馆长讨论这篇论文」会自动带上真实 pid。对话过程中会显示当前工具的执行进度，结束后可以展开执行记录，恢复历史会话时这些记录也一起保留。

它的行为不写死在代码里，而是仓库根目录的 `AGENT.md`：身份、任务、工具、记忆规范、回答规范、禁止事项都在里面，每次问答前自动加载。想调整它的行为，改这个文件即可。

记忆分两层，都只存本地、不上云：`agent-memory.md` 记录使用者的画像、偏好与纠错，`agent-notes/{pid}.md` 存单篇深读笔记和对话里逐步积累的洞察。

## 聊天记录：自动保存，可追溯

与馆长的每一次对话都会自动写进本地 `chat-logs/`，并同步到你的私有 ModelScope 仓库（`your-namespace/paper-chat-logs`，可见性设为 private，与公开的知识库、PDF 仓库隔离，聊天内容不公开）。

- 每轮问答结束即保存并推送，不用手动操作；没有 token 时先存本地，填好后下次补传
- 对话右上角「🕘 历史」里有会话列表（标题 + 时间 + 轮数），点击就能接着上次继续聊，适合跨天延续同一个上下文
- 历史列表里也能删除单条会话，本地与云端一并清掉

## 桌面版 PaperBook

不用每次进终端起服务。`paperbook.pyw` 把整套 Web 界面装进一个原生窗口，双击即开，关闭窗口自动停服，没有终端黑窗；不想用 `.pyw` 也可以双击 `PaperBook.bat`。

- Windows 走系统自带的 WebView2 渲染（Win11 预装），没有 WebView2 时回退为默认浏览器打开
- 首次使用先装桌面依赖：`python -m pip install pywebview pythonnet`，`requirements.txt` 里已经包含
- 顶部导航有「设置」控制台，模型、检索、每日检索、质量权重、云端仓库，以及 `.env` 里的各家密钥都能在界面里改，保存后立即生效
- 密钥仍然只落在本地 `.env`
- 想加桌面或开始菜单快捷方式，右键 `install-shortcuts.ps1` 用 PowerShell 运行，脚本与路径无关，项目搬到别处重跑一次即可

命令行同样可以起桌面壳：`python -m service.desktop`。

## 安装

环境要求是 Python 3.10+（推荐 3.11 / 3.12；3.14 部分依赖 wheel 可能滞后）和带 git-lfs 的 Git。

```bash
git clone https://github.com/chadoshamot/paper-librarian.git
cd paper-librarian
python setup.py
```

`setup.py` 是交互式的：检查 Python、建目录、导入或初始化论文库、生成配置与 `.env`、装依赖、冒烟验证。可选项直接回车跳过，对应功能会优雅降级。

跑起来主要有两种方式：

```bash
python -m service          # 交互式 CLI 主菜单
python -m service.web      # 网页界面，默认 http://127.0.0.1:8000
```

常用命令：

```bash
python -m service.ingest papers/xxx.pdf                          # 完整录入一篇
python -m service.search "GPU 集群调度" --mode explore --top 10  # 语义检索 / 探索
python -m service.cloud sync                                     # 增量同步到 ModelScope
python -m service.daily --top 10                                 # 生成当日检索日报
```

Web 和桌面共用同一套本地 HTTP 服务，前端通过 JSON API 发起任务并轮询进度；CLI 直接调用同一组领域模块。Web 的写任务走在一条有界队列里串行执行，避免同一进程内的 manifest 与云端 git 改动互相覆盖。需要说明的是，多个独立 CLI 进程同时改同一个库时还没有跨进程锁。

## 密钥配置

所有密钥只写在 `.env`，而 `.env` 已被 `.gitignore` 排除，永远不会被提交；仓库里只有空值的 `.env.example`。论文库、PDF、检索索引、嵌入模型、日报、馆长记忆、深读笔记和聊天记录同样全部被 gitignore，由 `setup.py` 在本机生成。`config.example.yml` 里的 `__NAMESPACE__` 是占位符，安装时会替换成你自填的 ModelScope 用户名；`service/reconcile_truth.py` 里带的是一张空校准表，不随仓库携带任何个人数据。

密钥按需填写，只有 DeepSeek 是必需的：

| 密钥 | 用途 | 是否必填 |
| --- | --- | --- |
| `DEEPSEEK_API_KEY` | 分类、摘要、每日裁判、馆长 agent | 是 |
| `MODELSCOPE_TOKEN` | 自建库与云端同步 | 自建库模式需要 |
| `MOONSHOT_API_KEY` | 馆长联网搜索（Kimi） | 否 |
| `ZOTERO_USER_ID` / `ZOTERO_API_KEY` | Zotero 跳转链接 | 否 |
| `SMTP_*` | 日报邮件推送 | 否 |

可选项不填时，对应功能会返回友好错误，其余照常。DeepSeek 不填则录入、分类、每日裁判与馆长 agent 不可用，但检索与浏览仍然能用。

## 研究需求与每日检索

`python -m service.daily` 从 arXiv、OpenAlex、Semantic Scholar 抓候选，跨源去重、剔除本库已有，再按质量评分排序，输出 `reports/daily/YYYY-MM-DD.md` 与 `.json`。即使当天没有候选也会更新日报，不会继续展示旧的推荐。

检索方向不再散落在配置里，而是统一收进根目录的 `research-profile.md`：研究目标、兴趣关键词、推荐偏好、篇数和时间范围都写在 YAML frontmatter 与正文里，供推荐裁判、深读和馆长对话共同使用；评分权重仍在 `knowledge-base/config.yml` 的 `quality` 段。

在「每日简报 → 我的论文需求」里展开编辑器，就能直接改这些内容并保存，也可以展开「直接编辑 Markdown 文件」改原文。多窗口或 agent 同时编辑时，旧版本的保存会被拒绝，重新加载后再合并修改。每次保存都会把当时的配置快照存到 `reports/daily/profiles/YYYY-MM-DD.md`，文件本体只留在本地，不进入公开的云仓库。

每日检索可以挂到系统定时任务上：

**Windows（任务计划程序）**

```powershell
schtasks /Create /TN "PaperLibrarianDaily" /TR "D:\你的路径\paper-librarian\run_daily.bat" /SC DAILY /ST 08:00 /F
```

**Linux / macOS（cron）**

```cron
0 8 * * * /path/to/paper-librarian/run_daily.sh
```

定时仍由系统任务触发，在网页里保存需求并不会自动创建新的计划任务。

## 两种数据模式

- **示例库**：如果设置了环境变量 `MODELSCOPE_DEMO_NS`，`setup.py` 会 clone 一个公开示例库，克隆完就能检索浏览，零 token
- **自建库**：填自己的 ModelScope namespace 与 token，用 `python -m service.ingest` 建库，再 `python -m service.cloud sync` 上云

## 注意事项

- 首次检索会下载 jina-v2-base-zh 嵌入模型，几百 MB（走 `hf-mirror.com` 镜像），之后走缓存
- PDF 上云依赖 git-lfs；如果 clone 下来的 PDF 是文本指针而不是真文件，需要装好 LFS 再重新同步
- 用 conda 时，要用目标环境执行 `setup.py` 与 `python -m service`，避免依赖装错环境
- 换 LLM 要同时改 `.env` 的 key 与 `config.yml` 的 model 段（provider / base_url / model 三处）；换联网对话模型改 `chat` 段
- PDF 深读会跨页面抽取正文并记录页码与截断情况；扫描版或抽不出文本的 PDF 仍然需要 OCR，它不会假装读到了全文

## 项目结构

```text
service/            # 服务代码，含 desktop.py 桌面壳与 settings.py 设置读写
service/static/     # 独立的 index.html / app.css / app.js，无构建步骤
service/jobs.py     # 有界后台任务队列，写任务串行、进度事件隔离
service/research_profile.py  # 研究需求的迁移、校验与版本冲突检测
paperbook.pyw       # PaperBook 桌面启动器，双击打开，无终端黑窗
PaperBook.bat       # 桌面启动的 bat 版，等价于双击 pyw
assets/logo.png     # 项目标志，README / Web / 桌面图标共用
README.md           # 中文说明（顶部可切换语言）
README_EN.md        # 英文说明
install-shortcuts.ps1  # 一键创建快捷方式（Windows，右键运行）
AGENT.md            # 馆长 agent 的操作手册
setup.py            # 一键安装（交互式生成 .env / 配置 / 数据）
config.example.yml  # 配置模板
taxonomy.yml        # 分类学
tests/              # 离线流程与 HTTP 接口回归测试
knowledge-base/     # 双语知识库（gitignored，本地生成）
chat-logs/          # 聊天记录（私有仓库 paper-chat-logs 的本地副本，gitignored）
agent-memory.md     # 馆长全局记忆（本地，不上云）
agent-notes/        # 馆长单篇深读笔记（本地，不上云）
research-profile.md # 研究目标与每日推荐配置（本地，gitignored）
```

回归测试是离线的，不调用真实模型、云端或邮件，也不碰个人论文库：

```powershell
py -3.14 -m unittest discover -s tests -v
node --check service/static/app.js
py -3.14 tests/ui_smoke.py   # 可选：用已安装的 Chrome，临时库加模拟 agent
```

如果同样被论文文件夹折磨，可以直接 clone 下来试；用起来有问题欢迎到仓库开 Issue。

**[前往 GitHub：源码与最新说明](https://github.com/chadoshamot/paper-librarian)**

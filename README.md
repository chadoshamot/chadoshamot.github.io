# shamot 博客

中文个人博客，采用 Hexo 与 Stellar 2.0.0，目标地址为 https://chadoshamot.github.io/ 。

## 本地使用

需要 Node.js 22 或更高版本。

```powershell
npm ci
npm run doctor
npm run build
npm run server
```

浏览器访问 http://localhost:4000 。

## 编辑与写作

- 网站标题、语言和地址：`_config.yml`
- 简介、导航和外观：`_config.stellar.yml`
- 关于页：`source/about/index.md`
- 博客文章：`source/_posts/`
- 头像：`_config.stellar.yml` 的 `leftbar.brand.image.src`，使用 GitHub 头像；浏览器标签图标由 `_config.yml` 的 `favicon` 使用同一 GitHub 头像
- 个人签名：只修改 `_config.stellar.yml` 的 `leftbar.brand.tagline`，侧栏与首页同步更新
- 最近更新：`source/_data/widgets.yml` 的 `recent.limit`，默认 9，按文章 updated 倒序，不足时显示全部
- 黑色背景、白色正文、渐变与无边框布局：`source/assets/shamot.css`
- 各板块配色：`_config.stellar.yml` 的 `leftbar.menu` → `accent`，该值同时控制选中导航和板块正文链接
- 栏目内部导航、项目与探索页面：`scripts/presentation.js`
- 友链：`source/friends/index.md`

网站提供米黄（`#E8DBBA`）、藏蓝（`#2A486E`）、澄绿（`#2A484E`）三种配色，可通过侧栏和手机顶部的“网站配色”下拉框直接选择，并记住选择。米黄为首次访问的默认配色；旧的深色偏好会迁移为藏蓝。米黄保留柔和侧栏渐变，藏蓝与澄绿使用纯色背景。

浅色样式在 `source/assets/shamot-light.css`；两种深色样式在 `source/assets/shamot-dark.css`；配色选择与记忆在 `source/assets/shamot-palette.js`。

侧栏渐变属于页面背景，区域之间依靠留白区分。博客用黄色、项目用青色、探索用紫色、友链用绿色、关于用珊瑚色；选中时文字和右侧菱形使用板块配色。滚动入场采用 300ms、5px 位移，尊重系统的减少动态效果设置。

博客有近期发布、分类、标签、专栏、归档。分类为思考、技术、经验、设计开发、学习，使用 `source/_data/taxonomy.yml` 管理名称与颜色；分类目录映射在 `_config.yml` 的 `category_map`。文章所属分类会自动变成同名标签，文章列表、正文和标签页使用相同颜色，并分别适配米黄与深色背景。尚无文章的分类也保留入口。

项目有所有项目、应用程序、实用工具、博客相关、博采众长；在 `source/_data/projects.yml` 维护项目，`category` 填 applications、tools、blog-related 或 inspirations。所属栏目自动显示为彩色标签，列表与详情页保持一致。探索保留 OKR 与手记、收藏夹、解决方案与在线工具。关于博主的分组为话题、音乐、运动、其他，可直接编辑 `source/about/index.md`。

创建新文章：`npx hexo new post "article-slug"`，然后修改 Markdown 顶部的标题、发表日期、分类与标签。例如：

```yaml
title: 文章标题
date: 2026-10-02 12:00:00
categories:
  - 技术
tags:
  - Tool
  - Linux
  - Focus
```

“技术”标签会在构建时自动补上。文章属于多个平级分类时，使用 `categories: [[技术], [经验]]`，避免 Hexo 将普通列表解释为父子分类。

年份归档由 Hexo 与 Stellar 按文章 `date` 自动生成，按年份倒序展示全部文章。推送新文章后，GitHub Actions 自动重建归档，无需维护年份目录或列表；`updated` 仅用于最近更新排序。

标签是三个平级维度：类型（Note/Exp/Tool/Bug）、领域（按文章添加）、视角（Summary/Focus）。每篇通常选择一个类型、一个或多个领域、可选一个视角。只有使用过的标签才会出现在标签页。

## GitHub Pages

1. 使用 `https://github.com/chadoshamot/chadoshamot.github.io` 仓库；若已有内容，先检查并合并，避免覆盖。
2. 将本目录源码推送到 `main`，包含 `package-lock.json`；不上传 `node_modules` 和 `public`。
3. 仓库 Settings → Pages → Source 选择 GitHub Actions。
4. `.github/workflows/pages.yml` 会安装依赖、检查主题并生成、部署网站。

推送后可在仓库 Actions 中查看部署进度，线上地址为 https://chadoshamot.github.io/ 。

首篇文章根据用户指定的项目 README 编写。文章中的仓库地址来自原项目 Git 配置，已通过远端读取确认仓库存在；修复效果未独立复测。

Stellar 的图像处理依赖 sharp 使用 `overrides` 更新到已修复审计问题的 0.35.4 或更新版本；精确安装版本由锁文件固定。
## 网站终端与 DeepSeek Harness

现在可以在网站按 `↑ ↑ ↓ ↓ ← → ← → B A B A` 调出终端。仅支持电脑物理键盘输入，已移除屏幕键盘入口。

首次使用：安装 Node.js **22.19 或更新版本**和 Git，在仓库里运行 `npm ci`、`npm run bridge:start`（Windows 也可双击 `Start-Terminal.cmd`）。打开本机 `http://127.0.0.1:4317/pair`，把页面上的 `connect ...` 命令粘贴进网页终端。浏览器如询问“本地网络访问”，需要允许；受浏览器限制时可用同一地址下的 `/console`。

终端采用 Linux 风格提示符，在正文中输入命令并按 Enter 执行。`help zh` 查看[中文帮助](source/assets/terminal-help-zh.txt)，`help en` 查看[英文帮助](source/assets/terminal-help.txt)，可追加关键词查找。`connect` 可逐步输入本机地址和配对码，不必手工拼接整行命令。`resources` 列出所有资源的本机绝对位置。典型流程：

```text
mount graduate "D:/blog-media"
import "@graduate/article.md" my-post --category "学习"
edit @site/source/_posts/my-post.md
preview start 4000
changes
publish "Add my post"
```

`harness install` 安装官方 `@deepseek-ai/dsh`；`harness configure` 打开官方本机界面。在 **Settings → Models** 保存 API Key，或使用官方账号登录入口进行浏览器授权。终端 `harness ask "Inspect this blog"` 真正调用官方 headless CLI，流式展示执行事件，并在下次提问继续会话。API Key 路由为 `harness model deepseek-official deepseek-flash`；完成官方账号授权后可选择 `deepseek-account` 路由。不要把密码或 Key 写进文章、配置文件或聊天中。

本地桥只监听 `127.0.0.1`，作弊码只负责打开界面，资源访问需要一次性配对。文件命令默认访问仓库，额外目录需 `mount`；`shell` 是你主动执行的本机 PowerShell 命令。GitHub Pages 无法运行本机进程，本机桥需保持运行。换一台电脑需在那台电脑启动桥，未安装远程访问服务。

`.shamot/` 保存本机 Harness、账号/密钥、会话、备份和回收站，并被 Git 忽略。API Key 使用官方凭据存储；仅在本机文件中保存（不是云端同步，也不是声称加密）。关闭桥后配对失效，重新启动后重新连接。输入 `harness` 进入独立的 AI 屏幕，`/exit` 返回网站命令模式；两者的输出和历史分开。按照资源访问要求，Harness 默认 full 权限（当前系统账号权限范围）；`harness access workspace` 可收回写入范围。需要官方交互界面时使用 `harness web`。AI 修改后可以检查 `changes`，再明确执行 `publish`。额外会话日志贡献和遥测已关闭，正常模型请求仍会发送任务所需上下文。

## 本地目录与发布位置

项目完整目录：YOUR_PROJECT_DIR。源码推送到 chadoshamot/chadoshamot.github.io，由 GitHub Actions 发布到 https://chadoshamot.github.io/。原 blog_page 仓库保留。

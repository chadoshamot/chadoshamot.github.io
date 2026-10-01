# shamot 博客

中文个人博客，采用 Hexo 与 Stellar 2.0.0，目标地址为 https://chadoshamot.github.io/blog_page/ 。

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
- 本地标识图：`source/assets/shamot.svg`

创建新文章：`npx hexo new post "article-slug"`，然后修改 Markdown 顶部的标题与标签。

标签是三个平级维度：类型（Note/Exp/Tool/Bug）、领域（按文章添加）、视角（Summary/Focus）。每篇通常选择一个类型、一个或多个领域、可选一个视角。只有使用过的标签才会出现在标签页。

## GitHub Pages

1. 使用 `https://github.com/chadoshamot/blog_page` 仓库；若已有内容，先检查并合并，避免覆盖。
2. 将本目录源码推送到 `main`，包含 `package-lock.json`；不上传 `node_modules` 和 `public`。
3. 仓库 Settings → Pages → Source 选择 GitHub Actions。
4. `.github/workflows/pages.yml` 会安装依赖、检查主题并生成、部署网站。

配置文件和部署流程已准备；本目录的生成结果不表示远端已上线。

首篇文章根据用户指定的项目 README 编写。文章中的仓库地址来自原项目 Git 配置，已通过远端读取确认仓库存在；修复效果未独立复测。

Stellar 的图像处理依赖 sharp 使用 `overrides` 更新到已修复审计问题的 0.35.4 或更新版本；精确安装版本由锁文件固定。

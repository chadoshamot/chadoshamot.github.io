const cheerio = require('cheerio');
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const blogTabs = [['近期发布',''],['分类','blog/categories/'],['标签','blog/tags/'],['专栏','topic/'],['归档','blog/archives/']];
const projectTabs = [['所有项目','wiki/'],['应用程序','wiki/applications/'],['实用工具','wiki/tools/'],['博客搭档','wiki/companions/'],['博客主题','wiki/themes/'],['iOS','wiki/ios/']];
const exploreGroups = [
 ['探索',[['OKR & 手记','notes/'],['收藏夹','notes/bookmarks/']]],
 ['解决方案',[['Mac 相关问题','notes/solutions/mac/'],['iOS 相关问题','notes/solutions/ios/'],['Flutter 相关问题','notes/solutions/flutter/'],['Node.js 相关问题','notes/solutions/nodejs/'],['服务器相关问题','notes/solutions/server/']]],
 ['在线工具',[['JSON 在线解析工具','https://www.json.cn/'],['PNG 转 WEBP 工具','https://squoosh.app/']]]
];
hexo.extend.filter.register('after_render:html', html => {
 const $ = cheerio.load(html);
 const root = hexo.config.root;
 const menu = hexo.theme.config.leftbar.menu;
 const active = $('#leftbar-region .widget-instance--menu .is-active').first();
 const section = menu.find(item => item.title === active.attr('title') || item.title === active.find('.ui-collection__title').text().trim()) || menu[0];
 $('html').attr('style', `--shamot-accent:${section.accent};--theme:${section.accent};--accent:${section.accent};--link:${section.accent}`);
 const switchButton = `<select class="shamot-palette-select" aria-label="网站配色" data-shamot-palette onchange="setShamotPalette(this.value)"><option value="beige">米黄</option><option value="navy">藏蓝</option><option value="green">澄绿</option></select>`;
 $('.widget-instance--menu').first().before(`<div class="shamot-theme-control">${switchButton}</div>`);
 $('body').attr('data-section', section.id).prepend(`<header class="shamot-mobile-header"><a href="${root}">shamot<span aria-hidden="true">.</span></a><div class="shamot-mobile-actions">${switchButton}<button type="button" data-shell-action="toggle-leftbar-drawer" aria-label="打开导航" aria-controls="leftbar-region">菜单 ☰</button></div></header>`);
 const canonical = $('link[rel=canonical]').attr('href') || $('meta[property="og:url"]').attr('content') || '';
 const pathname = canonical ? new URL(canonical).pathname.replace(root,'') : '';
 const tabs = section.id === 'post' ? blogTabs : section.id === 'projects' ? projectTabs : null;
 if(tabs) {
  const nav = tabs.map(([title, route]) => `<a href="${root+route}" ${pathname===route ? 'aria-current="page"' : ''}>${title}</a>`).join('');
  $('.site-main').prepend(`<nav class="shamot-section-nav" aria-label="${section.title}导航">${nav}</nav>`);
 }
 if(section.id === 'explore') {
  const nav = exploreGroups.map(([title,links]) => `<section><h3>${title}</h3>${links.map(([label,url]) => `<a href="${url.startsWith('https:') ? url : root+url}" ${pathname===url ? 'aria-current="page"' : ''}>${esc(label)}</a>`).join('')}</section>`).join('');
  $('.recent-widget').first().after(`<nav class="shamot-explore-nav" aria-label="探索目录">${nav}</nav>`);
 }
 $('.recent-widget').css('--theme',menu[0].accent).css('--item-theme',menu[0].accent);
 if($('body').attr('data-page-type') === 'index' && pathname === '') {
  $('.shamot-section-nav').after(`<section class="shamot-intro"><p class="shamot-eyebrow">SHAMOT / BLOG</p><h1 id="shamot-intro-title">学习、实践与记录</h1><p class="shamot-intro-description">${esc(hexo.theme.config.leftbar.brand.tagline)}</p></section>`);
 }
 return $.html();
});
hexo.extend.generator.register('shamot-sections', locals => {
 const pages = [];
 const add = (path,title,menu,content) => pages.push({path:path+'index.html',layout:'page',data:{title,layout:'page',active_menu:menu,rightbar:{widgets:[]},content:content.startsWith('<div') ? content : hexo.render.renderSync({text:content,engine:'markdown'})}});
 const project = `<div><a class="shamot-project" href="${hexo.config.root}wiki/codex-windows-runtime-fix/"><span class="shamot-eyebrow">WINDOWS / OPEN SOURCE</span><h2>Codex Windows Runtime Fix</h2><p>针对 Windows 上特定运行时暂存故障的检测、重建与验证工具。</p><span class="shamot-project-meta">实用工具 · PowerShell · 查看项目 →</span></a></div>`;
 projectTabs.forEach(([title,path])=>add(path,title==='所有项目'?'项目':title,'projects',path==='wiki/'||path==='wiki/tools/' ? project : '这里还没有项目。新的项目会按类型整理在这里。'));
 add('wiki/codex-windows-runtime-fix/','Codex Windows Runtime Fix','projects',`针对 Windows 上观察到的一种 Codex 运行时暂存故障的非官方社区工具。\n\n## 项目入口\n\n[查看 GitHub 仓库](https://github.com/chadoshamot/codex-windows-runtime-fix)\n\n[阅读介绍文章](${hexo.config.root}posts/codex-windows-runtime-fix/)\n\n## 适用范围\n\n面向更新后窗口未出现、并伴随 cua_node 暂存目录异常的特定情况。使用条件、操作步骤与最新说明以仓库 README 为准。`);
 add('blog/categories/','分类','post','文章以多维标签整理，暂不设置互斥的分类。\n\n[按标签浏览]('+hexo.config.root+'blog/tags/)');
 add('topic/','专栏','post','这里用于整理围绕同一主题连续写作的文章。\n\n目前还没有专栏，可以先浏览[近期发布]('+hexo.config.root+')。');
 add('notes/','OKR & 手记','explore','记录阶段目标、实践进展和随手想到的事情。\n\n## 手记\n\n目前还没有手记。\n\n## OKR\n\n阶段目标尚未公开。');
 add('notes/bookmarks/','收藏夹','explore','## 网站与文档\n\n- [Stellar 官方文档](https://xaoxuu.com/wiki/stellar/)\n- [Hexo 官方文档](https://hexo.io/zh-cn/docs/)\n- [我的 GitHub](https://github.com/chadoshamot)');
 exploreGroups[1][1].forEach(([title,path])=>add(path,title,'explore','这里用于整理'+title.replace('相关问题','')+'的解决方案。\n\n目前还没有记录。'));
 return pages;
});

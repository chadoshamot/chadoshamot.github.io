// Site-owned presentation; theme files and published article routes stay independent.
hexo.extend.filter.register('after_render:html', function (html) {
  var root = hexo.config.root;
  var mobileHeader = '<header class="shamot-mobile-header"><a href="' + root + '">shamot<span aria-hidden="true">.</span></a><button type="button" data-shell-action="toggle-leftbar-drawer" aria-label="打开导航" aria-controls="leftbar-region">菜单 <span aria-hidden="true">☰</span></button></header>';
  html = html.replace(/(<body[^>]*>)/, '$1' + mobileHeader);
  if (/data-page-type="index"/.test(html)) {
    var intro = '<section class="shamot-intro" aria-labelledby="shamot-intro-title"><p class="shamot-eyebrow">SHAMOT / BLOG</p><h1 id="shamot-intro-title">把遇到的问题，<br>写成可以回看的记录<span>.</span></h1><p class="shamot-intro-description">记录学习、实践与解决问题的过程。</p></section><div class="shamot-list-heading"><h2>近期文章</h2><span>持续记录，慢慢积累</span></div>';
    html = html.replace(/(<main[^>]*class="site-main"[^>]*>)/, '$1' + intro);
  }
  return html;
});

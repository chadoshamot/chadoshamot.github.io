const cheerio = require('cheerio');
const escapeText = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const taxonomy = () => hexo.locals.get('data').taxonomy;
function colors(name) {
  const data = taxonomy();
  const known = [...data.categories, ...data.project_categories].find(item => item.name === name) || data.tags[name];
  if (known) return known;
  let hash = 0;
  for (const char of name) hash = ((hash * 31) + char.codePointAt(0)) >>> 0;
  return {light:`hsl(${hash % 360} 40% 35%)`,dark:`hsl(${hash % 360} 60% 78%)`};
}
function chip(name, href) {
  const c=colors(name);
  const attributes=`class="shamot-colored-tag" style="--tag-light:${c.light};--tag-dark:${c.dark}"`;
  return href ? `<a href="${escapeText(href)}" ${attributes}>${escapeText(name)}</a>` : `<span ${attributes}>${escapeText(name)}</span>`;
}
hexo.extend.filter.register('before_generate', async function () {
  // Use the site-owned overview so empty configured categories remain visible.
  // Hexo's singular "category" generator still renders populated article lists.
  hexo.extend.generator.register('categories', () => []);
  const names=new Set(taxonomy().categories.map(c=>c.name));
  for (const post of hexo.model('Post').find({published:true}).toArray()) {
    const categoryTags=post.categories.toArray().map(c=>c.name).filter(name=>names.has(name));
    const current=post.tags.toArray().map(t=>t.name);
    if(categoryTags.some(name=>!current.includes(name))) await post.setTags([...new Set([...current,...categoryTags])]);
  }
  hexo.locals.invalidate();
}, 5);
hexo.extend.generator.register('shamot-categories', locals => {
  const root=hexo.config.root;
  const pages=[];
  const rows=taxonomy().categories.map(item=>{
    const category=locals.categories.findOne({name:item.name});
    const count=category ? category.posts.length : 0;
    const href=root+'blog/categories/'+item.slug+'/';
    if(!count) pages.push({path:'blog/categories/'+item.slug+'/index.html',layout:'page',data:{title:item.name,active_menu:'post',content:`<p>${chip(item.name)} · 暂无文章</p>`}});
    return `<li>${chip(item.name,href)}<span class="shamot-category-count">${count} 篇</span></li>`;
  }).join('');
  pages.push({path:'blog/categories/index.html',layout:'page',data:{title:'分类',active_menu:'post',content:`<div><ul class="shamot-category-list">${rows}</ul></div>`}});
  return pages;
});
hexo.extend.filter.register('after_render:html', html => {
  const $=cheerio.load(html);
  $('.card-tags .tag-chip, .article-tags a.tag, #tags a.tag, .widget-wrapper.tagcloud a, .cap.breadcrumb > span').each((_,node)=>{
    const tag=$(node), name=tag.text().trim();
    if(!name) return;
    const c=colors(name);
    tag.addClass('shamot-colored-tag').attr('style',`--tag-light:${c.light};--tag-dark:${c.dark}`);
  });
  if($('body').attr('data-section') === 'projects') {
    $('.shamot-section-nav a').each((_,node)=>{
      const tag=$(node),name=tag.text().trim();
      const c=taxonomy().project_categories.find(item=>item.name===name);
      if(c) tag.addClass('shamot-colored-tag').attr('style',`--tag-light:${c.light};--tag-dark:${c.dark}`);
    });
  }
  // 列表卡片用带文件夹图标的 breadcrumb 显示文章分类，因此不再重复渲染同名的 # 标签。
  // 卡片最多显示 5 个标签（主题 tagLinks.slice(0,5)），分类标签追加在最后，标签多的文章会被它挤出列表。
  $('.card-tags').each((_,node)=>{
    const tags=$(node), name=tags.siblings('.cap.breadcrumb').text().trim();
    if(!name) return;
    tags.children('.tag-chip').filter((_,chip)=>$(chip).text().trim()===name).remove();
  });
  return $.html();
});
hexo.extend.helper.register('shamot_chip', chip);

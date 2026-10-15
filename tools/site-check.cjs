'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{load}=require('cheerio');
const root=path.resolve(__dirname,'..'),output=path.join(root,'public');
const read=name=>fs.readFileSync(path.join(output,name),'utf8');
const cover=read('index.html'),$=load(cover);
assert.equal($('html').attr('lang'),'en');assert($('html').is('[data-shamot-cover]'));assert.equal($('.post-list').length,0);
assert(cover.includes('/assets/cover/app.js'));assert(cover.includes('/assets/cover/great-vibes.ttf'));assert(cover.includes('/assets/shamot-terminal.js'));
for(const item of ['assets/cover/app.js','assets/cover/app.css','assets/cover/great-vibes.ttf','assets/cover/licenses/react-bits.md','assets/cover/licenses/great-vibes.txt','assets/cover/licenses/octicons.txt'])assert(fs.statSync(path.join(output,item)).size>0,item);
assert(!read('assets/cover/app.js').includes('/demo-assets/'));
const pages=['blog/index.html','blog/categories/index.html','blog/archives/index.html','wiki/index.html','notes/index.html','friends/index.html','about/index.html','posts/infra-learning-day6/index.html'];
for(const page of pages){const doc=load(read(page));assert.equal(doc('#leftbar-region a[title="博客"]').attr('href'),'/blog/',page);doc('.shamot-section-nav a').each((_,link)=>{assert.notEqual(doc(link).attr('href'),'/',page)});assert(doc('[data-shamot-palette] option[value="purple"]').length,page);assert(doc('link[href^="/assets/shamot-content-palettes.css"]').length,page)}
const blog=load(read('blog/index.html'));assert(blog('.post-list .post-card').length>0);assert.equal(blog('.shamot-section-nav a[aria-current="page"]').first().attr('href'),'/blog/');assert(blog('#shamot-intro-title').length);
for(const slug of ['infra-learning-day1','infra-learning-day2','infra-learning-day3','infra-learning-day4','infra-learning-day5','infra-learning-day6','paper-librarian-ai-paper-agent','myalgo-algorithm-notes','codex-windows-runtime-fix'])assert(load(read('posts/'+slug+'/index.html'))('h1').length,slug);
console.log('PASS: root cover, built assets/licenses, /blog/ article index, sidebar/top navigation, shared palettes and existing article URLs.');

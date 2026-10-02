'use strict';
const yaml=require('js-yaml');
const tabs=[['topics','话题'],['music','音乐'],['sports','运动'],['other','其他']];
const idPattern=/^[a-z][a-z0-9-]{0,79}$/;
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function text(value,name,max=10000){if(typeof value!=='string'||!value.trim()||value.length>max||value.includes('\0'))throw Error(`${name} must be nonempty text (maximum ${max} characters).`);}
function keys(object,allowed,name){if(!object||typeof object!=='object'||Array.isArray(object)||Object.keys(object).some(k=>!allowed.includes(k)))throw Error(`Invalid fields in ${name}.`);}
function validate(data){
 keys(data,['version',...tabs.map(([key])=>key)],'about data');
 if(data.version!==1)throw Error('About data version must be 1.');
 for(const [key] of tabs){
  const items=data[key];if(!Array.isArray(items)||items.length>100)throw Error(`${key} must contain an array of up to 100 entries.`);
  const ids=new Set();
  for(const item of items){
   keys(item,['id','title','paragraphs','links'],key+' entry');
   if(typeof item.id!=='string'||!idPattern.test(item.id)||ids.has(item.id))throw Error(`Invalid or duplicate entry ID in ${key}. Use lowercase letters, numbers and hyphens.`);ids.add(item.id);
   text(item.title,'Title',200);
   if(!Array.isArray(item.paragraphs)||!item.paragraphs.length||item.paragraphs.length>32)throw Error('Provide between 1 and 32 paragraphs.');
   item.paragraphs.forEach(p=>text(p,'Paragraph'));
   if(!Array.isArray(item.links)||item.links.length>12)throw Error('Links must be an array of up to 12 links.');
   for(const link of item.links){
    keys(link,['title','url'],'link');text(link.title,'Link title',300);text(link.url,'Link URL',8192);
    let url;try{url=new URL(link.url);}catch{throw Error('Link URL must be an absolute HTTP or HTTPS URL.');}
    if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw Error('Link URL must be HTTP or HTTPS without embedded credentials.');
   }
  }
 }
 return data;
}
const parse=source=>validate(yaml.load(source));
const serialize=data=>'# 关于博主：通过 about 命令或 about edit 管理；四个标签页固定。\n'+yaml.dump(validate(data),{lineWidth:100,noRefs:true});
function options(args){
 const fields={};
 while(args.length){const flag=args.shift();
  if(flag==='--title'){if(fields.title!==undefined)throw Error('Use --title once.');fields.title=args.shift();text(fields.title,'Title',200);}
  else if(flag==='--text'){const value=args.shift();text(value,'Paragraph');(fields.paragraphs ||= []).push(value);}
  else if(flag==='--link'){const title=args.shift(),url=args.shift();text(title,'Link title',300);text(url,'Link URL',8192);(fields.links ||= []).push({title,url});}
  else if(flag==='--clear-links'){if(fields.links?.length)throw Error('Do not combine --clear-links with --link.');fields.links=[];fields.clearLinks=true;}
  else throw Error(`Unknown option: ${flag}. Use --title, --text, --link TITLE URL or --clear-links.`);
 }
 if(fields.clearLinks&&fields.links.length)throw Error('Do not combine --clear-links with --link.');
 delete fields.clearLinks;return fields;
}
function apply(data,operation,args){
 validate(data);const key=args.shift(),id=args.shift();
 if(!tabs.some(([name])=>name===key))throw Error('Tab must be topics, music, sports or other.');
 if(typeof id!=='string'||!idPattern.test(id))throw Error('Provide an entry ID using lowercase letters, numbers and hyphens.');
 const items=data[key],index=items.findIndex(item=>item.id===id);
 if(operation==='add'){
  if(index>=0)throw Error('Entry ID already exists. Use about set to update it.');
  const fields=options(args);items.push({id,title:fields.title,paragraphs:fields.paragraphs,links:fields.links||[]});
 }else{
  if(index<0)throw Error(`Entry not found: ${key}/${id}. Use about list ${key}.`);
  if(operation==='remove'){if(args.length!==1||args[0]!=='--confirm')throw Error('Use about remove TAB ID --confirm. The original file is backed up.');items.splice(index,1);}
  else if(operation==='set'||operation==='update'){const fields=options(args);if(!Object.keys(fields).length)throw Error('Supply fields to update. Existing fields are preserved unless specified.');items[index]={...items[index],...fields};}
  else throw Error('Unknown about operation.');
 }
 return validate(data);
}
function render(data){
 validate(data);
 const nav=tabs.map(([key,title],i)=>`<div class="tab${i?'':' active'}"><a href="#shamot-about-${key}">${title}</a></div>`).join('');
 const panes=tabs.map(([key,title],i)=>{
  const items=data[key].map(item=>'<div class="tag-plugin colorful note shamot-about-note" data-about-id="'+escape(item.id)+'"><div class="body"><p class="shamot-about-note-title"><strong><span class="shamot-about-note-icon" aria-hidden="true">#</span> '+escape(item.title)+'</strong></p>'+item.paragraphs.map(p=>'<p>'+escape(p).replace(/\r?\n/g,'<br>')+'</p>').join('')+item.links.map(link=>'<p class="shamot-about-media"><a href="'+escape(link.url)+'" target="_blank" rel="noopener noreferrer">'+escape(link.title)+'</a></p>').join('')+'</div></div>').join('');
  return `<div class="tab-pane${i?'':' active'}" id="shamot-about-${key}">${items||'<p class="shamot-about-empty">这里暂时还没有内容。</p>'}</div>`;
 }).join('');
 return `<div class="tag-plugin tabs" align="center" id="shamot-about"><div class="nav-tabs">${nav}</div><div class="tab-content">${panes}</div></div>`;
}
module.exports={tabs,validate,parse,serialize,apply,render};

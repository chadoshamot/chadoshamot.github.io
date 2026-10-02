const {render}=require('../tools/about-content.cjs');
hexo.extend.tag.register('shamot_about',()=>render(hexo.locals.get('data').about));

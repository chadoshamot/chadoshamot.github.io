const {render}=require('../tools/friends-content.cjs');
hexo.extend.tag.register('shamot_friends',()=>render(hexo.locals.get('data').friends));

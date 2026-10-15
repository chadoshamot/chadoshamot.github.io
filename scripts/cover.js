const {coverRoutes}=require('../tools/cover-build.cjs');
hexo.extend.generator.register('shamot-cover',()=>coverRoutes(hexo.base_dir,{...hexo.locals.get('data').cover,avatar:hexo.theme.config.leftbar.brand.image.src}));

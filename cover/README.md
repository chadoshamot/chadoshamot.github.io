# Entrance cover

The root URL `/` is the English animated entrance. The article list is `/blog/`.
Existing `/posts/...`, `/wiki/`, `/notes/`, `/friends/`, `/about/` URLs remain valid.

- Final sources: `cover/src/`; background components: `cover/src/vendor/`.
- Cover name, signature and default selections: `source/_data/cover.yml`.
- Avatar: the shared `leftbar.brand.image.src` in `_config.stellar.yml`.
- Content colors: `source/assets/shamot-content-palettes.css`.
- Font: Great Vibes (local file), no trailing period in the headline.
- Both screens keep the six destinations, four background options and four palette shortcuts.
- Scroll down to enter, scroll up to return; mobile supports swipe and the bottom control.
- `shamot.palette` is shared by cover and content; the background choice is remembered in `shamot.cover.background`.
- Terminal remains available with the existing physical keyboard sequence. `theme` switches the cover palette too.

The Hexo generator compiles React with esbuild on every build, including terminal `build` / `publish`. It emits the cover, bundle and font routes directly; generated bundle files are not source files or manual deployment steps.

Run `npm run doctor`, `npm run build`, then `npm run site:test`. Restart an active preview after changing files outside `source/`.

Credits: React Bits (MIT + Commons Clause); Great Vibes by Robert Leuschke (SIL OFL); GitHub mark from Primer Octicons (MIT). Original notices are retained in `cover/licenses/` and emitted under `/assets/cover/licenses/`.

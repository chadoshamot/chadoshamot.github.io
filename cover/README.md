# Entrance cover

The root URL `/` is the English animated entrance. The article list is `/blog/`.
Existing `/posts/...`, `/wiki/`, `/notes/`, `/friends/`, `/about/` URLs remain valid.

- Final sources: `cover/src/`; background components: `cover/src/vendor/`.
- Cover name, signature and default selections: `source/_data/cover.yml`.
- Avatar: the shared `leftbar.brand.image.src` in `_config.stellar.yml`.
- Content colors: `source/assets/shamot-content-palettes.css`.
- Font: Great Vibes (local file), no trailing period in the headline.
- `Signature.jsx` reveals the original `shamot` font with hand-traced pen routes, once per page load after the font is ready (2 seconds from the first stroke to completion). Palette/background changes and screen navigation do not restart it. Reduced motion shows the finished name immediately. A different configured name uses static text until its own pen routes are added.
- Opening sequence: black canvas and pale signature only, then a 1.6-second reveal of the selected palette, background effect and interface after the last stroke. Scrolling waits for writing to finish; reduced motion skips the sequence. The initial HTML also paints black to avoid a palette flash before React starts.
- Both screens keep the six destinations, four background options at the bottom left and four palette shortcuts at the bottom right. On small screens, background options use a compact selector.
- Scroll down to enter, scroll up to return; mobile supports swipe and the bottom control.
- `shamot.palette` is shared by cover and content; the background choice is remembered in `shamot.cover.background`.
- Terminal remains available with the existing physical keyboard sequence. `theme` switches the cover palette too.

The Hexo generator compiles React with esbuild on every build, including terminal `build` / `publish`. It emits the cover, bundle and font routes directly; generated bundle files are not source files or manual deployment steps.

Run `npm run doctor`, `npm run build`, then `npm run site:test`. Restart an active preview after changing files outside `source/`.

Credits: React Bits (MIT + Commons Clause); Great Vibes by Robert Leuschke (SIL OFL); GitHub mark from Primer Octicons (MIT). Original notices are retained in `cover/licenses/` and emitted under `/assets/cover/licenses/`.

# Seedcartographer — static app served by nginx.
# nginx ships application/wasm in its mime.types, required for the engine.
# The unprivileged variant runs as a non-root user and listens on 8080.
FROM nginxinc/nginx-unprivileged:alpine

COPY index.html styles.css app.js worker.js seed.js search.js i18n.js \
     biomes.js coords.js slime.js markers.js presets.js favorites.js legend.js maptools.js tilecache.js sharestate.js seedsearch.js searchhistory.js userpresets.js usermarkers.js palette.js tilegrid.js relief.js profile.js \
     theme.js export.js mcfinder.js mcfinder.wasm \
     manifest.webmanifest icon.svg sw.js /usr/share/nginx/html/
COPY fonts/ /usr/share/nginx/html/fonts/

EXPOSE 8080

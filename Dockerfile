# Seedcartographer — static app served by nginx.
# nginx ships application/wasm in its mime.types, required for the engine.
FROM nginx:alpine

COPY index.html styles.css app.js worker.js seed.js search.js i18n.js \
     biomes.js coords.js slime.js markers.js presets.js favorites.js legend.js \
     theme.js export.js mcfinder.js mcfinder.wasm \
     manifest.webmanifest icon.svg sw.js /usr/share/nginx/html/
COPY fonts/ /usr/share/nginx/html/fonts/

EXPOSE 80

# Seedcartographer — static app served by nginx.
# nginx ships application/wasm in its mime.types, required for the engine.
FROM nginx:alpine

COPY index.html styles.css app.js worker.js seed.js search.js i18n.js \
     mcfinder.js mcfinder.wasm /usr/share/nginx/html/
COPY fonts/ /usr/share/nginx/html/fonts/

EXPOSE 80

# Seedcartographer — static app served by nginx.
# nginx ships application/wasm in its mime.types, required for the engine.
# The unprivileged variant runs as a non-root user and listens on 8080.

# Stamp version.js (release version + commit) and the sw.js cache version in
# a build stage, so every image — CI or a local `docker build` — shows the
# real deployed version like GitHub Pages does. The build context excludes
# .git; CI passes the commit through the GIT_COMMIT build argument instead.
# digest of node:24-alpine (Sonar S8431 forbids tag+digest together)
FROM node@sha256:a0b9bf06e4e6193cf7a0f58816cc935ff8c2a908f81e6f1a95432d679c54fbfd AS stamp
WORKDIR /app
COPY index.html styles.css app.js worker.js seed.js search.js rarebiomes.js shapes.js i18n.js version.js \
     biomes.js coords.js slime.js markers.js presets.js favorites.js legend.js maptools.js tilecache.js sharestate.js seedsearch.js searchhistory.js userpresets.js usermarkers.js userzones.js palette.js tilegrid.js relief.js compare.js profile.js gallery.js gallery.json errorreport.js tour.js keys.js \
     theme.js export.js mcfinder.js mcfinder.wasm \
     manifest.webmanifest icon.svg sw.js ./
COPY fonts/ fonts/
COPY package.json ./
COPY scripts/app-version.js scripts/sw-version.js scripts/
ARG GIT_COMMIT=""
ENV GIT_COMMIT=${GIT_COMMIT}
RUN node scripts/app-version.js . && node scripts/sw-version.js . \
 && rm -r scripts package.json

# digest of nginxinc/nginx-unprivileged:alpine (Sonar S8431: digest only)
FROM nginxinc/nginx-unprivileged@sha256:18d67281256ded39ff65e010ae4f831be18f19356f83c60bc546492c7eb6dd23
# the unprivileged base already defaults to uid 101; made explicit (S6471)
USER 101
COPY --from=stamp /app/ /usr/share/nginx/html/
COPY nginx/security-headers.conf /etc/nginx/conf.d/security-headers.conf
# replaces the base image's routing: anything outside the app's own files
# is rate-limited then dropped (see nginx/default.conf)
COPY nginx/default.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080

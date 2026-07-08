# Seedcartographer

Cherche, dans une seed Minecraft **Java** donnée, des endroits qui réunissent
plusieurs critères en même temps : un biome principal, collé à un biome voisin,
avec un certain nombre de structures à proximité. Tout le calcul de génération du
monde tourne dans le navigateur (cubiomes compilé en WebAssembly) — aucune donnée
n'est envoyée à un serveur : les polices sont auto-hébergées et l'application ne
fait aucune requête externe.

## Démo en ligne

L'application est déployée sur GitHub Pages à chaque mise à jour de `main` :
**https://akwawa.github.io/Seedcartographer/**

(Prérequis côté dépôt : Pages activé avec la source « GitHub Actions ».)

## Lancer l'application

Le module WebAssembly doit être servi par un vrai serveur web (l'ouverture
directe du fichier `index.html` ne marchera pas). Depuis ce dossier :

```bash
python3 -m http.server 8000
```

Puis ouvre http://localhost:8000 dans ton navigateur.

(N'importe quel serveur statique fait l'affaire : `npx serve`, l'extension
« Live Server » de VS Code, etc.)

### Avec Docker

Une image **multi-architecture** (`linux/amd64` et `linux/arm64` — Raspberry
Pi, serveurs ARM) est publiée sur GitHub Container Registry à chaque mise à
jour de `main` (tag `latest`) et à chaque tag `v*` (tag de version) ; chaque
pull request passe un scan de vulnérabilités Trivy (échec sur CVE critiques
corrigeables) :

```bash
docker run --rm -p 8080:8080 ghcr.io/akwawa/seedcartographer:latest
```

Puis ouvre http://localhost:8080. Pour construire l'image localement :

```bash
docker build -t seedcartographer .
docker run --rm -p 8080:8080 seedcartographer
```

## Utilisation

1. Saisis une **seed** en haut (numérique ou texte) et clique sur **Load seed**.
   La seed `141` est chargée par défaut — c'est un exemple où un *cherry grove*
   est collé à un *warm ocean* avec plusieurs villages autour (vers -384, 0).
2. Le sélecteur **Presets** charge en un clic un jeu de critères prêt à
   l'emploi (bosquet de cerisiers en bord d'océan, village + avant-poste,
   champs de champignons, spot de ferme à slimes) — modifiable ensuite.
   Règle les **critères** dans le panneau de gauche. Chaque section accepte
   plusieurs lignes (boutons « + Ajouter » / « × ») : biomes principaux
   (l'un d'eux), biomes adjacents + distance et structures (nombre minimum +
   rayon) — ces deux dernières sections se combinent en « tous » (ET) ou
   « au moins un » (OU).
3. Choisis le **rayon de recherche** (taille de la zone balayée autour du centre
   de la carte) et la **résolution** (pas d'échantillonnage en blocs).
4. Clique sur **Search this area**. Les résultats apparaissent comme épingles sur
   la carte et dans la liste ; clique une épingle pour copier la commande `/tp`.
5. **Show on map** affiche les structures (villages, etc.) dans la vue courante.
6. **Import CSV** (panneau Résultats) recharge un fichier exporté (colonnes
   `x,z,…`) et affiche les lieux comme épingles — la boucle inverse de
   l'export CSV.
7. **Export PNG** télécharge une capture de la vue courante de la carte
   (tuiles, couches, épingles) avec un cartouche seed / version / dimension /
   centre.
8. **Share link** copie une URL qui encode la seed, la vue et les critères :
   ouverte ailleurs, elle rejoue exactement la même recherche.

Glisse pour te déplacer, molette pour zoomer, clique une épingle pour la
sélectionner. Le bouton **?** en haut à droite ouvre l'aide intégrée
(critères, raccourcis carte, limites, licence).

## Bon à savoir

- **Application installable et hors-ligne (PWA).** Servie en HTTPS (ou sur
  localhost), l'application s'installe depuis le navigateur et fonctionne
  ensuite sans réseau : tous les fichiers (moteur WASM compris) sont mis en
  cache par un service worker. La version du cache est estampillée
  automatiquement au déploiement (hash de contenu des assets,
  `scripts/sw-version.js`) : tout changement d'asset invalide le cache sans
  intervention manuelle.
- **Thème clair ou sombre.** La bascule ☀/☾ en haut à droite change de thème ;
  au premier chargement le thème suit la préférence du système
  (`prefers-color-scheme`) et le choix manuel est mémorisé.
- **Interface multilingue.** L'interface est disponible en français, anglais,
  espagnol, allemand, italien et portugais brésilien : la langue du navigateur
  est détectée automatiquement et
  le sélecteur en haut à droite permet d'en changer (choix mémorisé). Les noms
  de biomes sont traduits dans les 6 langues (liste cubiomes complète,
  vérifiée par un test de parité).

- **Résolution de détection : 16 blocs.** Les biomes sont échantillonnés tous les
  16 blocs (compromis vitesse/précision). Les cherry groves et océans sont bien
  plus grands que ça, donc la détection reste fiable ; une coordonnée trouvée peut
  être à quelques blocs près du bord exact du biome.
- **Résultats déterministes.** Pour une même seed et mêmes critères, la recherche
  renvoie toujours les mêmes lieux, quel que soit l'endroit regardé (la grille est
  calée sur un repère monde absolu) — c'est ce qui rend les liens de partage fiables.
- **Combinaisons rares.** Certaines combinaisons (ex. cherry grove + warm ocean +
  2 villages) sont géographiquement rares. Si rien n'est trouvé, élargis le rayon
  ou relâche un critère.
- **Légende des biomes.** Le panneau « Légende » (repliable, en haut à droite
  de la carte) liste les biomes visibles avec leur couleur ; survoler la carte
  marque l'entrée correspondante, survoler une entrée met le biome en
  surbrillance sur la carte.
- **Favoris.** Le bouton ☆ du pop-up épingle un lieu (par seed, version et
  dimension) avec une note libre ; les favoris apparaissent dans le panneau et
  comme losanges dorés sur la carte, et sont conservés dans le navigateur
  (`localStorage`) — rien ne quitte la machine.
- **Spawn et strongholds.** Les couches « Spawn du monde » et « Forteresse de
  l'End (stronghold) » (Overworld) affichent le point d'apparition et les
  strongholds exacts ; la section « structures proches » propose les critères
  « à moins de N blocs du spawn / d'un stronghold ».
- **Chunks à slimes.** La couche « Chunks à slimes » (Overworld) les affiche en
  vert sur la carte — calculés directement depuis la seed (RNG Java), sans le
  moteur cubiomes ; la couche n'apparaît qu'à un zoom raisonnable. La section
  « structures proches » propose aussi le critère « au moins N chunks à slimes
  dans un rayon R ».
- **Trois dimensions.** Le sélecteur « Dimension » de la barre du haut bascule
  entre Overworld, Nether et End : carte, biomes, structures (forteresses,
  bastions, portails en ruine du Nether, cités de l'End) et recherche suivent
  la dimension choisie, qui est incluse dans les liens de partage et les exports.
- **Recherche multi-seeds.** Le panneau « Chercher une seed » teste de
  nombreuses seeds (aléatoires ou séquentielles depuis la seed courante) avec
  les critères du panneau, autour de l'origine du monde, sur un pool de
  workers avec progression et annulation ; cliquer une seed candidate la
  charge, centrée sur le premier lieu trouvé.
- **Version de génération sélectionnable.** Le sélecteur « Java » dans la barre
  du haut permet de choisir la version (de 1.0 à 1.21, 1.21 par défaut) : la
  carte, les structures et la recherche sont recalculées pour la version
  choisie, et la version est incluse dans les liens de partage.

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html`, `styles.css` | Interface |
| `app.js` | Carte (pan/zoom, rendu, épingles), UI, partage de lien |
| `worker.js` | Web Worker moteur — instancié deux fois : tuiles/sondes d'un côté, recherche de l'autre |
| `seed.js` | Conversion seed → entier 64 bits (partagé worker/tests) |
| `search.js` | Balayage multi-critères de la grille de biomes (partagé worker/tests) |
| `slime.js` | Calcul des chunks à slimes (RNG Java, partagé worker/tests) |
| `presets.js` | Presets de critères de recherche (partagé app/tests) |
| `i18n.js` | Traductions de l'interface (FR, EN, ES, DE, IT, PT-BR) |
| `mcfinder.js`, `mcfinder.wasm` | Moteur cubiomes compilé |
| `mcfinder.c` | Source C du wrapper — voir `BUILDING.md` pour recompiler |
| `cubiomes/` | Bibliothèque cubiomes (submodule git épinglé) |
| `build.sh` | Recompilation du WASM (vérifiée par le job CI `wasm`) |
| `fonts/` | Polices auto-hébergées (OFL 1.1) |
| `test/` | Tests unitaires (`npm test`, Node ≥ 20) |

## Développement

- **Tests unitaires** : `npm test` (utilise `node:test`).
- **Tests end-to-end** : `npm run e2e` (Playwright ; `npx playwright install chromium`
  au premier lancement, ou `CHROMIUM_PATH=/chemin/vers/chromium` pour utiliser un
  navigateur déjà installé).
- **Couverture** : `npm run coverage` génère `coverage/lcov.info` (node:test) ;
  `npm run coverage:branches` exige **100 % de couverture par branche** sur les
  modules purs partagés (vérifié en CI — les scripts CLI et les fichiers de
  test sont exclus, la colle navigateur est marquée `node:coverage ignore`
  avec justification).
- **Benchmark** : `node scripts/bench-scan.js` mesure `scanGrid` sur une grille
  synthétique réaliste ; la CI échoue si la durée dépasse le budget
  (`BENCH_BUDGET_MS`, 2 s). Côté e2e, `e2e/perf.spec.js` mesure le temps
  jusqu'au premier rendu de carte et échoue au-delà du budget
  (`RENDER_BUDGET_MS`, 15 s en CI).
- **Typage** : `npm run typecheck` (JSDoc + `tsc --noEmit` via `checkJs` sur
  les modules purs — typage statique sans migration TypeScript).
- **Lint** : `npm run lint` (ESLint) et `npm run lint:css` (stylelint) ; la CI vérifie aussi le `Dockerfile` (hadolint), les workflows (actionlint) et `build.sh` (shellcheck).
- **Lighthouse** : le job CI `lighthouse` audite la page servie et échoue
  sous les planchers de `lighthouserc.json` (performance ≥ 0,6 — les runners CI sont plus lents qu'en local,
  accessibilité ≥ 0,9, bonnes pratiques ≥ 0,9, SEO ≥ 0,8) ; en local :
  `CHROME_PATH=/chemin/vers/chromium ./node_modules/.bin/lhci autorun`.
- **Qualité** : chaque push/PR est analysé par
  [SonarQube Cloud](https://sonarcloud.io/project/overview?id=akwawa_Seedcartographer)
  (job CI `sonar`, secret `SONAR_TOKEN` requis ; l'analyse doit être en mode
  « CI-based », pas « Automatic Analysis »). La Quality Gate exige sur le
  nouveau code : **couverture ≥ 80 %**, duplication ≤ 3 % et notes
  Fiabilité/Sécurité/Maintenabilité A — la logique applicative doit donc
  vivre dans des modules purs testés (`sharestate.js`, `search.js`,
  `maptools.js`…), `app.js`/`worker.js` restant de la colle exclue de la
  couverture.
- Une CI GitHub Actions lance lint, tests unitaires et e2e sur chaque push et
  pull request.
- **Dépendances** : Dependabot ouvre chaque semaine des MR groupées (actions,
  npm, submodule cubiomes) ; une mise à jour du submodule exige de recompiler
  le WASM sur la branche de mise à jour (le job CI `wasm` échoue sinon).
- **Recompiler le WASM** : voir [`BUILDING.md`](BUILDING.md).

## Historique des versions et releases

Les modifications sont tracées dans [`CHANGELOG.md`](CHANGELOG.md) (format
Keep a Changelog) ; chaque merge request y ajoute son entrée dans la section
« Non publié ».

Les releases sont automatisées par **release-please** (workflow
`release-please.yml`) : une MR de release est maintenue sur `main` (bump de
`package.json` + section de changelog générée depuis les messages de commit) ;
sa fusion crée le tag `v*` et la release GitHub. Les messages de commit
suivent la convention
[Conventional Commits](https://www.conventionalcommits.org/fr/) —
`feat:` (Ajouté, bump mineur), `fix:` (Corrigé, bump correctif),
`feat!:`/`BREAKING CHANGE` (bump majeur), `docs:`/`chore:`/`test:`/`ci:`
(sans effet sur la version).

## Licence

Ce projet est distribué sous licence
**[CC BY-NC 4.0](LICENSE)** (Attribution – Pas d'utilisation commerciale) :
toute réutilisation doit créditer l'auteur, et l'usage commercial est interdit.
Les composants tiers (cubiomes, polices) conservent leurs licences respectives —
voir [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).

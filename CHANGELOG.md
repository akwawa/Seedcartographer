# Changelog

Toutes les modifications notables de ce projet sont documentées dans ce fichier.

Le format suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) et le
projet adhère au [versionnage sémantique](https://semver.org/lang/fr/).

**Règle de contribution** : chaque merge request ajoute son entrée dans la
section « Non publié » (catégories : Ajouté / Modifié / Corrigé / Sécurité).
Le travail courant d'un jalon part sur la branche `dev` (une MR par ticket,
base `dev`) ; `dev` n'est fusionnée vers `main` qu'une fois le jalon terminé.
Les releases sont automatisées par
[release-please](https://github.com/googleapis/release-please) : une MR de
release maintient le bump de version et une section générée depuis les
commits conventionnels ; avant de la fusionner, déplacer le contenu de
« Non publié » dans la nouvelle section de version. La fusion crée le tag
et la release GitHub.

## [Non publié]

### Ajouté
- Vérificateur d'accessibilité WCAG strict dans la CI : nouvelle spec e2e
  `e2e/a11y.spec.js` (axe-core via @axe-core/playwright) avec tous les tags
  (`wcag2a`, `wcag2aa`, `wcag2aaa`, `wcag21a`, `wcag21aa`, `wcag22aa`,
  `best-practice`) et zéro violation tolérée, sur chaque état significatif :
  chargement en thèmes sombre et clair, menu « ⋯ », dialogue d'aide, galerie,
  panneau critères ouvert, résultats + popup, mode compare, tour guidé et
  viewport mobile 390×844. Corrections révélées par le mode strict : le titre
  de la topbar devient le `<h1>` de la page, le bouton de recherche quitte le
  flux sticky pour un pied de panneau opaque qui n'obscurcit plus les
  critères (WCAG 2.5.8), cibles tactiles ≥ 24 px (sélecteurs de mode, boutons
  ×), et le survol des boutons primaires fonce (`--lapis-deep`) au lieu
  d'éclaircir pour garder un contraste ≥ 4,5:1. Seule exception documentée :
  la règle AAA `color-contrast-enhanced` (7:1), désactivée avec justification
  dans la spec. (#278)

### Modifié
- Découvrabilité : le sélecteur de comparaison de versions `#cmpVer` affiche
  une première option explicite traduite (« Comparer avec… ») au lieu d'un
  « — » nu ; les infobulles/aria des contrôles indiquent leur raccourci
  clavier — règle (R), permutation de version (V), aide (?), aller aux
  coordonnées (G), recherche (Entrée) — via i18n ; le dialogue d'aide gagne
  une section « Outils carte » décrivant règle, marqueur, sélection de zone
  et zone annotée, traduite dans les 10 langues. Gardes : test i18n de
  présence des raccourcis dans chaque locale, e2e (placeholder fr non vide,
  « (R) » dans le title de la règle, section outils carte dans l'aide). (#271)
- Panneau de critères allégé : les cinq sections optionnelles (biomes
  adjacents, part de biome, motifs géographiques, structures proches, paires
  de structures) deviennent des `<details>`/`<summary>` natifs repliés par
  défaut lorsqu'ils sont vides ; toute section recevant une clause (ajout
  manuel, permalien, preset, historique ou import) s'ouvre automatiquement.
  Le bouton « Chercher dans cette zone » est rendu collant en bas du panneau
  (fond opaque) et reste visible au chargement — l'étape 3 du tour guidé
  pointe donc un bouton à l'écran. Gardes e2e : bouton visible sans
  défilement à 1280×900 et 390×844, sections repliées/dépliées selon leur
  contenu. (#269)
- Topbar responsive : les actions secondaires (export PNG avec étiquette
  visible pour la taille, lien de partage, comparaison de seeds, comparaison
  de versions, langue, thème, palette, galerie) sont regroupées dans un menu
  « ⋯ » accessible au clavier ; la topbar principale garde l'essentiel
  (marque, seed + chargement, badge hors-ligne, aide) et ne provoque plus
  aucun défilement horizontal de la page (garde e2e à 1280/1440/1920/390 px).
  Sur mobile, les options de monde (Large Biomes, version Java, dimension)
  rejoignent le menu pour une topbar compacte, et le tour guidé ouvre le
  menu à l'étape du lien de partage. (#266)

### Corrigé
- i18n : les derniers libellés restés en anglais sont traduits dans les
  10 langues — titre de section « Presets » (fr « Préréglages », es
  « Preajustes »), options du sélecteur de dimension `#dimSel` (terminologie
  Minecraft officielle par langue : de « Oberwelt/Nether/Ende », ru « Обычный
  мир/Нижний мир/Край », ja/zh-CN incluses ; l'anglais est conservé là où la
  communauté l'utilise, ex. fr « Overworld »), libellé « Java » et infobulle
  « Generation version » du sélecteur de version, infobulle du bouton de
  thème et des inputs d'import (CSV/JSON/profil), nom de dimension dans
  l'historique des recherches. Gardes : test Node (clés présentes dans les
  10 langues ; tout attribut `title` d'index.html porte `data-i18n-title`)
  et e2e (libellés français/allemands attendus). (#270)
- Après une recherche réussie, la liste des résultats est amenée dans la zone
  visible du panneau (`scrollIntoView` fluide, sans vol de focus) au lieu de
  rester ~1300 px sous le message « N locations found ». Sur mobile, la popup
  résultat (Copy /tp) est désormais rendue au-dessus des contrôles carte
  (toggles Grid/Nether, curseur Y) : z-index dédié et ancrage en bas du
  canvas, largeur bornée au viewport. Gardes e2e : liste visible dans le
  panneau après recherche (desktop) ; popup entièrement dans le viewport
  390×844 avec bouton /tp réellement cliquable (`elementFromPoint`). (#268)
- Dialogues (aide, galerie) utilisables sur mobile : leur largeur est bornée
  à la fenêtre (`min(540px, calc(100vw - 2rem))`, 920 px pour la galerie),
  leur hauteur est limitée avec défilement interne, et ils restent centrés
  dans la fenêtre visible. Le focus clavier est désormais visible sur les
  boutons et liens des dialogues (contour 2 px identique au reste de
  l'interface). Garde e2e mobile 390×844 : dialogue d'aide entièrement dans
  le viewport, contenu défilable et anneau de focus effectivement peint. (#267)
- Mode compare : les couches de structures activées (villages, temples,
  slime chunks…) s'affichent désormais aussi sur la carte de droite,
  calculées pour la seed B via son worker dédié, avec les mêmes toggles que
  la carte principale ; les surcouches personnelles (pins de résultats,
  favoris, marqueurs, zones) restent liées à la seed A sur la carte
  principale, et la sortie du mode libère les points de la seed B. (#261)
- Image Docker : la version affichée dans le dialogue d'aide restait le
  placeholder « dev » car `version.js` était copié tel quel sans passer par
  les scripts d'estampillage. Le Dockerfile estampille désormais la version
  (et la version de cache du service worker) dans un stage de build dédié,
  si bien que toute image — construite par la CI ou localement — affiche la
  version releasée comme GitHub Pages ; la CI injecte le commit via
  l'argument de build `GIT_COMMIT`. (#260)

## [0.11.0](https://github.com/akwawa/Seedcartographer/compare/v0.10.0...v0.11.0) (2026-07-20)

### Ajouté
- Comparateur de seeds côte à côte : un bouton « Comparer des seeds » dans la
  barre supérieure (ou le raccourci ⇆ sur chaque candidate de la recherche
  multi-seeds) scinde la carte en deux vues synchronisées — même centre et
  même zoom, le déplacement et le zoom sur l'une entraînant l'autre dans les
  deux sens. La vue de droite a son propre champ de seed (« Seed B ») et son
  propre worker de rendu avec cache de tuiles dédié, de sorte que le rendu de
  comparaison ne ralentit jamais la carte principale. La sortie du mode
  restaure la carte unique et libère le worker et les tuiles de comparaison.
  Libellés traduits dans les dix langues, logique pure extraite dans
  `compare.js` (état du mode, synchronisation du viewport) couverte par des
  tests unitaires, et test e2e de synchronisation. (#250)
- Annotations de zones sur la carte : un outil « zone » dans la barre
  d'outils permet de dessiner au glisser un rectangle nommé en coordonnées
  monde (« base ici », « farm là »), avec nom et couleur (petite palette)
  modifiables et suppression via un éditeur ouvert au clic sur la zone. Les
  zones suivent le zoom et le déplacement, s'affichent au-dessus des tuiles
  et sont converties Nether⇄Overworld (1:8, bordure pointillée) lors d'un
  changement de dimension. Elles sont persistées dans le profil
  (localStorage) et incluses dans l'export/import de profil ainsi que dans
  le code de synchronisation, avec les mêmes règles de fusion que les
  marqueurs. Libellés traduits dans les dix langues. (#251)
- Section « Biomes rares » : un bouton par biome rare (champs de champignons,
  badlands, badlands érodés, bosquet de cerisiers, pics de glace, jungle,
  jungle de bambous, marais de mangrove) lance une recherche du plus proche
  en anneaux croissants depuis le centre de la vue, dans le worker, avec
  barre de progression et annulation. Le rayon s'étend automatiquement
  jusqu'à 10 240 blocs ; le résultat centre la carte avec un pin temporaire
  et sa pop-up, et un message clair (traduit dans les dix langues) s'affiche
  si le biome est introuvable dans la limite. (#252)
- Indicateur discret « hors ligne » dans la barre supérieure quand le
  navigateur perd la connexion (événements online/offline), traduit dans les
  dix langues, et test e2e du mode hors-ligne complet : démarrage de
  l'application, rendu des tuiles, recherche et disponibilité de
  `gallery.json` et du worker via le service worker sans réseau. (#253)

## [0.10.0](https://github.com/akwawa/Seedcartographer/compare/v0.9.0...v0.10.0) (2026-07-17)

### Ajouté
- Export PNG haute résolution de la carte (mode poster) : un sélecteur de
  taille à côté du bouton « Exporter PNG » propose la taille actuelle, 2048 px
  ou 4096 px. Le rendu se fait tuile par tuile dans le worker (l'interface
  reste fluide) avec barre de progression et annulation, le cartouche est
  redimensionné proportionnellement, et un message clair s'affiche si
  l'export dépasse les limites mémoire du navigateur. (#231)
- Raccourcis clavier : `Enter` lance la recherche depuis n'importe quel champ
  du panneau de critères, `+`/`-` zooment la carte, `G` ouvre « aller aux
  coordonnées », `R` active/désactive l'outil règle, `?` ouvre l'aide et
  `Échap` ferme le dialogue/outil/pop-up actif. Les raccourcis lettres sont
  inactifs pendant la frappe dans un champ et pendant le tour guidé (où
  `Échap` passe le tour). La logique touche+contexte→action vit dans le
  module pur `keys.js` ; une fiche des raccourcis, traduite dans les dix
  langues, est ajoutée au dialogue d'aide. (#230)
- Mini-tour guidé à la première visite : quatre bulles ancrées sur les
  éléments réels de l'interface (seed → critères → recherche →
  partage/export) avec compteur d'étape, boutons « Suivant »/« Passer »,
  navigation clavier et focus piégé dans la bulle. Mémorisé via
  `localStorage`, relançable depuis le dialogue d'aide (« Revoir le
  tour ») et traduit dans les dix langues. (#229)
- Quatre nouvelles langues : japonais, russe, polonais et chinois simplifié.
  Toutes les clés d'interface, les textes d'aide et les noms de biomes sont
  traduits avec la terminologie officielle de Minecraft dans chaque langue.
  Le sélecteur de langue les propose et la détection automatique reconnaît
  `ja`, `ru`, `pl` et les variantes chinoises (`zh`, `zh-CN`, `zh-Hans`… ;
  `zh-TW`/`zh-HK` retombent sur le chinois simplifié en attendant une table
  traditionnelle dédiée) (#228).
- Recherche sans biome : une option « N'importe quel biome » dans le sélecteur
  de biome principal permet une recherche portant uniquement sur des critères
  de structures (ex. « 3 villages dans un rayon donné, biome indifférent »).
  Le moteur court-circuite alors la passe biome et évalue directement les
  emplacements de structures ; partage, presets et historique restent
  compatibles et les libellés sont traduits dans les 6 langues (#227).

## [0.9.0](https://github.com/akwawa/Seedcartographer/compare/v0.8.0...v0.9.0) (2026-07-17)

### Ajouté
- Veille cubiomes : un workflow hebdomadaire (`cubiomes-watch.yml`) compare le
  HEAD amont de Cubitect/cubiomes au submodule épinglé et ouvre (ou
  rafraîchit) automatiquement une issue quand l'amont avance — pour ne pas
  rater l'arrivée du support des versions 26.x (#225).

### Corrigé
- CI : déploiement GitHub Pages cassé depuis le double-build (#207) — les
  scripts de stamping de version refusent par conception tout chemin hors de
  leur répertoire courant (`insideCwd`), or `pages.yml` les appelait sur
  `../_site` depuis `build-main`/`build-dev`. Chaque build est désormais
  stagé dans son propre checkout puis copié vers `_site` (#240).

### Modifié
- Migration ES modules, finition : `worker.js` et `app.js` utilisent le
  top-level await des modules au lieu d'une chaîne de promesses / d'un appel
  `init()` flottant (règle Sonar S7785, apparue avec le passage en modules)
  (#224).
- Migration ES modules, étape finale : `"type": "module"` officialisé dans
  `package.json` (fin du warning Node `MODULE_TYPELESS_PACKAGE_JSON`) ; les
  derniers fichiers CommonJS (`eslint.config.js`, `playwright.config.js`,
  `scripts/*.js`, specs Playwright `e2e/*.js`) passent en `import`/`export`
  natifs (#224).
- Migration ES modules, étape 1 : la couche de test Node passe en modules
  ES natifs (`test/*.test.mjs`, `import` pour les builtins Node,
  `createRequire` pour charger les sources encore double-mode CommonJS).
  Aucun changement côté navigateur : les sources restent chargées par
  balises `<script>` classiques et `importScripts` (#224).
- Migration ES modules, étape 2 : la page principale passe en modules ES —
  `index.html` charge `app.js` via `<script type="module">` et `app.js`
  importe explicitement ses dépendances pure-logique (i18n, biomes, coords,
  presets, favoris, légende, outils carte, caches de tuiles, partage,
  recherche de seeds, historique, presets/marqueurs utilisateur, profil,
  galerie, thème, export, version, rapport d'erreurs), qui perdent leur
  garde CommonJS au profit d'`export`. Les fichiers partagés avec
  `worker.js` via `importScripts` (seed, shapes, search, slime, markers,
  palette, tilegrid, relief) restent des scripts classiques à globals
  jusqu'à l'étape 3 ; les tests Node importent désormais directement les
  sources converties (#224).
- Migration ES modules, étape 3 (finale) : `worker.js` devient un module
  worker (`new Worker(..., { type: 'module' })`, `import` au lieu
  d'`importScripts`) et la glue Emscripten est rebâtie en module ES
  (`-sEXPORT_ES6=1` dans `build.sh`, emsdk 6.0.2). Les huit derniers
  fichiers classiques (seed, shapes, search, slime, markers, palette,
  tilegrid, relief) passent en `export` natif ; `app.js` les importe
  explicitement — ce qui corrige au passage l'import manquant de
  `sortHitsByDist` (tri des résultats par distance au spawn) — et
  `index.html` ne charge plus que le module `app.js`. Plus aucun
  `createRequire` dans les tests Node, plus de top-level await dans
  `seedsearch.js` (#224).

## [0.8.0](https://github.com/akwawa/Seedcartographer/compare/v0.7.0...v0.8.0) (2026-07-14)

### Ajouté
- Code de synchronisation pour le profil : dans le panneau Profil, « Obtenir
  le code » encode favoris/presets/historique/marqueurs en un code
  compressé (même codec que les liens de partage) à copier ; « Coller un
  code » sur l'autre appareil le décode et fusionne (mêmes règles que
  l'import fichier existant). Aucun serveur, aucun compte — tout reste
  dans le navigateur (#211).
- Suivi d'erreurs en production : les erreurs JS non attrapées, les
  promesses rejetées et les erreurs du worker envoient un événement Umami
  personnalisé (`error`) — message tronqué, nom de fichier seul (jamais
  d'URL complète), aucune seed ni coordonnée. Rien n'est envoyé si Umami
  n'est pas chargé (mode hors-ligne/dev). Logique de formatage pure et
  testée (`errorreport.js`) ; câblage `window.onerror`/
  `unhandledrejection`/`worker.onerror` vérifié par un test e2e (#210).

### Modifié
- Aide : mention que la génération (cubiomes) s'arrête à Minecraft 1.21 —
  le contenu des sorties 26.x (nouveaux biomes, structures) n'est pas
  encore généré ici ; traduit dans les 6 langues (#209).
- Branche `dev` de staging : le travail courant d'un jalon part désormais sur
  `dev` (fusionnée vers `main` seulement en fin de jalon) — CI complète
  (tests, lint, Sonar, e2e, wasm, Lighthouse) sur push vers `dev` comme vers
  `main` ; image Docker publiée sous le tag `dev` ; GitHub Pages déploie en
  plus une prévisualisation sous `/dev/` à chaque déploiement, reconstruite
  depuis les deux branches à chaque fois pour que l'une n'écrase jamais
  l'autre (#207).

### Corrigé
- CI : badge OpenSSF Scorecard bloqué sur « invalid repo » — le pin
  `github/codeql-action` utilisé par `scorecard.yml`/`codeql.yml` était trop
  ancien et faisait échouer la vérification d'intégrité du workflow
  (« imposter commit »), empêchant toute publication de résultats vers le
  jeu de données public de Scorecard (#216).
- CI : job Docker (`docker.yml`) qui échouait systématiquement à l'étape SBOM
  — les étapes SBOM/cosign reconstruisaient la référence d'image avec la
  casse réelle du dépôt (`.../Seedcartographer`) au lieu de la forme en
  minuscules réellement poussée sur GHCR ; `syft`/cosign ne pouvaient donc
  jamais résoudre l'image à signer (#218).

## [0.7.0](https://github.com/akwawa/Seedcartographer/compare/v0.6.0...v0.7.0) (2026-07-09)

### Modifié
- Page `gallery.html` retirée : la galerie de seeds n'est plus accessible
  qu'en modal depuis l'application (bouton « Gallery »). Le lien « Open as
  a page » et `gallerypage.js` (son script dédié) sont supprimés ; les
  cartes, `gallery.js` et `gallery.json` restent inchangés (#205).
- Découplage visible : l'interface ne référence plus le dépôt GitHub — le
  lien « GitHub » du dialogue d'aide est retiré et la licence pointe vers le
  texte officiel sur creativecommons.org ; le crédit cubiomes (projet tiers)
  est conservé (#178).

### Sécurité
- Vérification finale du jalon 0.7.0 : passage en revue du stock complet
  SonarCloud et des alertes de code scanning. Correction des 4 derniers
  points ouverts (`c:S886`, boucles imbriquées `mcfinder.c` — bornage
  `maxN` dupliqué dans les deux en-têtes de boucle remplacé par un retour
  anticipé unique ; `mcfinder.wasm`/`mcfinder.js` reconstruits à l'identique
  avec l'emsdk épinglé, tests unitaires et e2e complets au vert). Seule
  alerte CodeQL restante (`js/unused-local-variable` sur `setLang`,
  `i18n.js`) classée faux positif et rejetée : `setLang` est appelée
  depuis `app.js` en tant que global inter-fichiers via balise `<script>`
  (non un import ES), invisible à l'analyse mono-fichier de CodeQL — même
  limitation déjà documentée pour `tsc` (#191).
- Couverture de tests à 100 % (lignes, branches, fonctions) : test manquant
  pour `favWorld` (favorites.js) et exclusion explicite (`node:coverage
  disable`/`enable`) du bloc DOM de `i18n.js` (`detectLang`/`t`/`applyI18n`/
  `setLang`, déjà exercé par la suite e2e, jamais par les tests Node). Les
  seuils du script `coverage:branches` sont relevés à 100 % lignes +
  branches + fonctions pour verrouiller en CI (#190).
- SBOM et signature de l'image Docker : chaque image publiée (`main`/`latest`
  et tags `v*`) est accompagnée d'un SBOM SPDX (Syft) et signée sans clé
  (keyless, identité OIDC GitHub Actions) avec cosign ; instructions
  `cosign verify`/`verify-attestation` dans le README (#189).
- Chemins hors application refusés : l'image Docker ne répond plus qu'aux
  fichiers qu'elle sert réellement — toute autre requête (sondes
  automatisées : `wp-login.php`, `.env`…) est rate-limitée (5 req/min par
  IP) puis la connexion est fermée sans réponse (444), au lieu d'un 404
  exploitable ; exemple de déploiement `deploy/docker-compose.yml` avec un
  conteneur fail2ban qui bannit au niveau hôte les clients qui persistent
  (documenté dans le README) (#188).
- Content-Security-Policy : une politique stricte (`default-src 'self'`,
  script/connect autorisés uniquement vers analytics.super-h.fr, moteur WASM
  via `'wasm-unsafe-eval'`, aucun style/script/objet en ligne, `frame-ancestors
  'none'`) protège l'app et la galerie — livrée en `<meta>` (GitHub Pages) et
  en vrai en-tête HTTP (image Docker). Le script inline de `gallery.html`
  est extrait vers `gallerypage.js` (prérequis : une CSP stricte interdit
  `unsafe-inline`) (#187).
- En-têtes de sécurité nginx : l'image Docker ajoute désormais
  `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
  `Referrer-Policy: strict-origin-when-cross-origin`,
  `Cross-Origin-Opener-Policy: same-origin` et une `Permissions-Policy`
  restrictive (aucune fonctionnalité n'a besoin de caméra, micro,
  géolocalisation…) sur toutes les réponses (conf versionnée
  `nginx/security-headers.conf`, vérifiée par un test qui lance l'image et
  interroge une vraie réponse HTTP) (#186).
- Audit des workflows : `zizmor` analyse `.github/workflows/` dans le job
  `static` de la CI (injections, permissions excessives, persistance de
  crédentiels…) — correction du seul type de finding détecté :
  `persist-credentials: false` sur chaque `actions/checkout` qui n'a pas
  besoin de pousser (aucun de nos workflows ne pousse avec ce credential :
  release-please, `gh release create` et le déploiement Pages utilisent
  leurs propres jetons) (#184).
- Interdiction d'innerHTML : les quatre derniers usages (vidage de listes de
  résultats et de couches de structures) passent par `textContent`, et une
  règle ESLint (`no-restricted-properties`/`no-restricted-syntax`) bannit
  `innerHTML`, `outerHTML` et `insertAdjacentHTML` sur tout le projet — les
  chaînes non fiables (liens de partage, imports CSV/JSON) ne peuvent plus
  être interprétées comme du HTML (#185).
- Analyse statique CodeQL : le workflow `codeql.yml` exécute les requêtes
  `security-and-quality` sur le JavaScript à chaque PR, à chaque push sur
  `main` et chaque semaine, avec publication des résultats vers le code
  scanning (#183).
- Posture mesurée : le workflow OpenSSF Scorecard évalue chaque semaine (et à
  chaque push sur `main`) la sécurité de la chaîne d'approvisionnement du
  dépôt, publie les résultats vers le code scanning et alimente le badge du
  README (#182).
- Chaîne d'approvisionnement : `lockfile-lint` vérifie en CI (et via
  `npm run lint:lockfile`) que `package-lock.json` ne résout que vers le
  registre npm en HTTPS, avec noms de paquets cohérents et intégrité sha512
  (#181).
- Politique de sécurité : `SECURITY.md` documente les versions supportées et
  le signalement privé des vulnérabilités (GitHub private vulnerability
  reporting) avec des délais de réponse indicatifs (#180).

### Modifié
- Découplage visible : l'interface ne référence plus le dépôt GitHub — le
  lien « GitHub » du dialogue d'aide est retiré et la licence pointe vers le
  texte officiel sur creativecommons.org ; le crédit cubiomes (projet tiers)
  est conservé (#178).

## [0.6.0](https://github.com/akwawa/Seedcartographer/compare/v0.5.0...v0.6.0) (2026-07-09)

### Corrigé
- Dézoom profond : la carte se remplit désormais entièrement au-delà de
  l'échelle moteur maximale — cache de tuiles et plafond de peinture
  dimensionnés sur la vue courante (les tuiles visibles ne sont plus
  évincées ni écartées du budget par les restes d'anciens niveaux de zoom),
  contrôle de flux des requêtes de tuiles (file centre-d'abord, fenêtre de
  4 en vol) et zoom-out de la minimap borné à ce que le moteur peut servir
  (#176).

### Ajouté
- Structures sur les vignettes : les aperçus de la galerie superposent les
  marqueurs de structures de la zone (villages, avant-postes, temples…) avec
  les couleurs des couches de la carte ; couches slime chunks, spawn et
  strongholds exclues (trop denses ou trop coûteuses pour une vignette) (#174).
- Galerie en modal : le bouton « Galerie » ouvre désormais un dialogue dans
  l'app — cards avec une vignette du lieu rendue par le moteur WASM, clic qui
  applique l'entrée en direct (seed, version, dimension, vue, critères) sans
  rechargement ; `gallery.html` reste accessible en lien direct (#172).
- Statistiques d'usage : le site intègre le script [Umami](https://umami.is/)
  (auto-hébergé sur analytics.super-h.fr, sans cookies) pour compter les
  visites de façon anonyme ; le dialogue d'aide (6 langues) et le README
  informent que les calculs et données restent locaux et que seules ces
  statistiques anonymes sont collectées (#168).
- Version visible : le dialogue d'aide affiche la version déployée et le
  commit (« v0.6.0 (abc1234) ») — un `version.js` committé en valeur « dev »
  est régénéré à chaque déploiement (GitHub Pages et image Docker) par
  `scripts/app-version.js` depuis `package.json` (release-please) et le HEAD
  git (#167).
- Domaine personnalisé : le site est servi sous **seedcarto.com** (fichier
  `CNAME` déployé sur GitHub Pages, liens canoniques et README mis à jour)
  (#166).
- Motifs géographiques : un bloc « Motifs » accepte des clauses de forme —
  île (terre entourée d'eau), eau enclose (baie/lagon) et enclave (biome A
  entouré de biome B) avec une taille maximale — détectées par analyse de
  composantes connexes bornée sur la grille de biomes (remplissage 4-connexe
  avec tampon de génération, module pur shapes.js testé et benchmarké en CI) ;
  combinables ET/OU avec les autres critères et incluses dans le lien de
  partage (#146).
- Critères multi-Y : chaque clause de biome adjacent peut préciser sa propre
  altitude (champ « à Y » optionnel) — la recherche génère une grille de
  biomes par couche demandée et combine les critères entre couches, pour
  trouver des spots où sous-sol et surface coïncident (ex. lush caves à
  Y=-40 sous un village en surface) ; fonctionne aussi dans la recherche
  multi-seeds et le lien de partage transporte l'altitude (#145).
- Galerie de seeds : une page statique embarquée (`gallery.html`, lien
  « Galerie » dans la barre du haut) liste des lieux remarquables édités
  dans `gallery.json` (versionné, validé par test — chaque entrée a été
  vérifiée avec l'application) ; chaque carte ouvre l'app via un lien de
  partage pré-rempli (seed, vue et critères le cas échéant), avec titres et
  descriptions localisés en/fr (#144).
- Recherche multi-seeds reprenable : l'état d'une recherche (mode, seed de
  départ, lots restants, seeds testées, candidates trouvées) est sauvegardé
  dans le navigateur à chaque lot terminé — après une annulation ou un
  rechargement de page, un bouton « Reprendre (n/total) » relance la
  recherche là où elle s'était arrêtée en conservant les candidates (les
  quelques seeds re-testées sont dédupliquées) ; sérialisation défensive en
  module pur (seedsearch.js) (#143).
- Critères en pourcentage de zone : un bloc « Part de biome » accepte des
  clauses « au moins N % du biome X dans un rayon R » (combinables ET/OU),
  évaluées statistiquement sur la grille de biomes existante (sous-
  échantillonnage régulier sur les grands rayons) et incluses dans le lien
  de partage, les presets et l'historique (#142).
- Permaliens raccourcis : le hash des liens de partage est compressé
  (deflate via `CompressionStream`, préfixe `z.`) quand le navigateur le
  permet, avec repli sur le format existant sinon — les anciens liens non
  compressés restent lisibles pour toujours (codec pur dans sharestate.js,
  testé) (#141).
- Export/import du profil : un panneau « Profil » sauvegarde en un fichier
  JSON tout l'état local (favoris, presets personnalisés, historique des
  recherches, marqueurs) et le réimporte avec fusion défensive — chaque liste
  repasse par le parseur de son module, doublons ignorés, presets remplacés
  par nom, plafonds respectés (module pur profile.js testé) (#140).

## [0.5.0](https://github.com/akwawa/Seedcartographer/compare/v0.4.0...v0.5.0) (2026-07-08)

### Ajouté
- Tri des résultats : un sélecteur au-dessus de la liste permet de trier par
  distance au spawn du monde (le spawn accompagne désormais la réponse de
  recherche, Overworld uniquement) en plus de l'ordre de recherche ;
  comparateur pur `sortHitsByDist` testé (#139).
- Couche relief (Overworld) : une case « Relief » superpose un ombrage type
  hillshade (lumière du nord-ouest) aux couleurs de biomes — la hauteur de
  surface est échantillonnée par le worker sur une grille adaptée au zoom
  (relief.js, module pur testé) et l'ombrage est cuit dans les tuiles du
  damier, mises en cache sous une clé dédiée pour un aller-retour instantané
  (#138).
- Tests de mutation : `npm run mutation` lance Stryker sur les 19 modules
  purs partagés (runner `node --test`, seuil `break` sous lequel le run
  échoue) ; le workflow CI `mutation` l'exécute sur chaque push vers `main`,
  chaque semaine et à la demande — le run complet (~1700 mutants, ~25 min)
  reste hors du gate de PR (#137).
- Noms de biomes intégralement traduits : les 11 noms hérités (pré-1.18 —
  montagnes, toundra enneigée, taïgas géantes, savane délabrée…) rejoignent
  les 94 déjà traduits dans les 6 langues, et un test de parité garantit
  désormais que chaque langue couvre exactement la liste des biomes du
  submodule cubiomes (#136).
- Copie de zone : le bouton ⬚ active un mode sélection — glisser trace un
  rectangle sur la carte (dimensions en blocs affichées en direct), puis une
  barre propose l'export PNG recadré de la sélection et la copie des
  coordonnées (« x0, z0 → x1, z1 (L × H) ») ; Échap annule (#135).
- Grille Nether ⇄ Overworld : une couche « grille Nether » superpose en
  pointillés orange les pas « ronds » de la dimension liée (÷8 depuis
  l'Overworld, ×8 depuis le Nether) avec les coordonnées liées en étiquette,
  et le HUD affiche le point sous le curseur dans les deux référentiels —
  pour planifier les liaisons de portails (#134).
- Marqueurs personnalisés : le bouton 📍 active un mode « poser un
  marqueur » — chaque clic sur la carte épingle un losange violet nommable,
  lié à la seed/version/dimension comme les favoris, listé dans un panneau
  dédié (renommer, recentrer, supprimer), persisté dans le navigateur et
  exportable/importable en JSON (fusion sans doublons) (#133).
- Comparaison de versions A/B : un sélecteur « vs » dans la barre du haut
  arme une version de comparaison et le bouton ⇄ (ou la touche V sur la
  carte) permute la génération en conservant la vue — le cache de tuiles
  étant par version, l'aller-retour est instantané une fois les deux côtés
  rendus (#132).
- Budget de performance e2e : un test mesure le temps entre le chargement de
  la page et le premier rendu effectif de la carte (tuile peinte sur le
  canvas) et fait échouer la CI au-delà du budget (`RENDER_BUDGET_MS`),
  la durée étant journalisée à chaque run (#131).
- Audit Lighthouse en CI : la page servie est auditée à chaque MR et le
  pipeline échoue sous les planchers configurés (performance ≥ 0,6,
  accessibilité ≥ 0,9, bonnes pratiques ≥ 0,9, SEO ≥ 0,8) (#130).

## [0.4.0](https://github.com/akwawa/Seedcartographer/compare/v0.3.0...v0.4.0) (2026-07-08)

### Ajouté
- Couverture par branche exigée : tous les chemins des modules purs partagés
  sont testés (11 nouveaux tests — cap de résultats de `scanGrid`, wrap 32
  bits du hash Java, modes OU, entrées dégénérées des parseurs…) et le job CI
  `test` échoue sous 100 % de branches (`--test-coverage-branches`) ; la
  colle spécifique au navigateur est exclue explicitement avec justification
  (#128).
- Rendu en damier progressif : la carte est composée de tuiles fixes de
  256 cellules alignées monde, demandées séparément au worker (les plus
  proches du centre d'abord) — le cache LRU devient vraiment réutilisable au
  pan (une zone déjà vue n'est jamais régénérée), le rendu arrive tuile par
  tuile, et changer de vue annule les tuiles hors écran encore en file
  (génération côté worker) ; la légende agrège les biomes des tuiles
  visibles (#114).
- Recherche multi-seeds : les seeds candidates sont notées et triées — nombre
  de lieux trouvés puis distance du meilleur lieu à l'origine, affichés dans
  la liste (« N ⚑ · D blocs ») ; le clic charge toujours la seed centrée sur
  son meilleur lieu (désormais le plus proche de l'origine, pas le premier
  balayé) (#113).
- Palette haute lisibilité : le bouton 🎨 bascule la carte et la légende sur
  des couleurs adaptées au daltonisme (teintes sûres Okabe–Ito cyclées par
  biome, ombrées par la luminance d'origine pour préserver le relief
  terre/mer) ; le remappage est une table 256×3 côté worker (gratuit au
  rendu) et le choix est mémorisé comme le thème (#112).
- Presets personnalisés : « Enregistrer » sauvegarde les critères courants
  sous un nom libre (avec la dimension) dans le navigateur (`localStorage`,
  parsing défensif, plafond 30) ; ils apparaissent dans le sélecteur de
  presets sous un groupe dédié, se rejouent d'un clic et se suppriment
  (réenregistrer sous le même nom remplace) (#111).
- Historique des recherches : les 10 dernières recherches (monde, critères,
  zone) sont conservées dans le navigateur (`localStorage`) et listées dans
  le panneau « Recherches récentes » — un clic restaure la seed, la version,
  la dimension et les critères puis relance la recherche ; relancer une
  recherche identique la remonte en tête sans doublon (#110).
- Outil règle : le bouton 📏 sur la carte active un mode mesure — deux clics
  tracent un segment et affichent la distance en blocs (euclidienne et par
  axes, aperçu en direct au survol), Échap ou re-clic sur le bouton pour
  sortir ; logique de mesure en module pur testé (#109).
- Contrôle « aller à » sur la carte : un champ « x, z » (Entrée ou bouton)
  recentre la vue sur les coordonnées saisies, avec validation (deux entiers,
  bordure du monde) et signalement visuel des entrées invalides ; le lien de
  partage reflète la nouvelle position (#108).

### Corrigé
- Les 4 Maintainability Issues SonarCloud restantes sont corrigées : le
  dispatch de messages du worker passe par une table de handlers et la
  boucle de `scanGrid` délègue les critères par cellule à un helper
  (complexité cognitive sous le seuil), plus un paramètre par défaut et un
  optional chaining — le stock projet retombe à 0 (#126).
- Stock SonarCloud ramené à zéro (41 issues ouvertes, dont la seule
  vulnérabilité : l'image Docker tournait en root — remplacée par
  `nginx-unprivileged` sur le port 8080) : refactors de complexité
  (`scanGrid`, `worker.js`, `app.js`), assertions de tests reconnues par
  l'analyse, `Number.parseInt`, optional chaining, et deux suppressions
  justifiées `NOSONAR` (fallback `execCommand` en http, parité Java de
  `charCodeAt`) (#107).
- Réactivité du rendu restaurée : la minimap se régénère sur son propre
  débounce (400 ms) au lieu de doubler chaque rendu moteur, la peinture du
  cache de tuiles est bornée aux 8 tuiles les plus utiles, et la minimap
  n'est plus redessinée à chaque frame de déplacement (#106).
- La minimap couvre désormais toute sa surface : la tuile grossière rendue
  par le worker était dessinée en 1:1 dans le coin (zones noires) au lieu
  d'être cadrée sur le canvas via la transformation vue→minimap (#105).

## [0.3.0](https://github.com/akwawa/Seedcartographer/compare/v0.2.0...v0.3.0) (2026-07-07)

### Ajouté
- Recherche multi-seeds : le panneau « Chercher une seed » balaye des seeds
  aléatoires ou séquentielles et teste les critères courants autour de
  l'origine du monde sur un pool de workers (progression, annulation, liste
  cliquable des seeds candidates) (#56).
- Critères de structures avancés : paires de structures (« un T1 et un T2 à
  moins de N blocs l'un de l'autre »), option « dans le biome principal » par
  clause de structure, et détection des quad witch huts (filtre quad-base de
  cubiomes + spot AFK optimal, recompilation WASM) disponible comme calque et
  comme critère (#57).
- Couverture de tests étendue : la logique du lien de partage (sérialisation
  du hash, assainissement des valeurs non fiables, migration des anciens
  liens) et les transformations écran⇄monde sont extraites d'`app.js` dans le
  module pur `sharestate.js`, testé unitairement ; le seuil de couverture
  (≥ 80 % sur le nouveau code) exigé par la Quality Gate est documenté (#66).
- Cache LRU des tuiles rendues (par seed/version/dimension/altitude/échelle) :
  les zones déjà connues se redessinent instantanément pendant le pan/zoom,
  la nouvelle tuile venant les recouvrir à son arrivée (#61).
- Critère d'altitude de surface (Overworld) : « surface entre Y min et Y max »
  via `approxSurfaceY` (mapApproxHeight de cubiomes, recompilation WASM) —
  trouver des pics > 150 ou des plaines basses ; la hauteur n'est
  échantillonnée que sur les cellules déjà candidates (#59).
- Curseur d'altitude (couche Y, −64 à 320) : le rendu de la carte, la sonde
  de biome du HUD et la recherche utilisent l'altitude choisie — un Y bas
  révèle les biomes souterrains (lush caves, deep dark…) ; l'altitude est
  conservée dans le lien de partage (#58).
- Repères de navigation : échelle graphique (longueurs « rondes » adaptées au
  zoom), grille de coordonnées adaptative (chunks/régions selon le zoom,
  optionnelle) et minimap d'ensemble cliquable pour recentrer la carte (#60).
- Support mobile et tactile : pinch-zoom à deux doigts sur la carte, panneau
  de critères repliable en tiroir sur petit écran, cibles tactiles agrandies
  sur les appareils à pointeur grossier (#62).
- Accessibilité : navigation clavier de la carte (flèches, +/-, Échap),
  labels ARIA sur les contrôles dynamiques et la carte (traduits), focus
  visibles, contrastes conformes WCAG AA et audit axe-core dans les tests
  e2e sur les deux thèmes (#64).
- Typage progressif : les modules purs (seed, search, export, coords, slime,
  markers, presets, favoris, légende, thème, scripts) sont annotés en JSDoc et
  vérifiés par `tsc --noEmit` (`checkJs`) dans le job CI `test`
  ([#65](https://github.com/akwawa/Seedcartographer/issues/65)).
- Micro-benchmark de performance de `scanGrid` exécuté en CI (grille
  synthétique déterministe, meilleur temps sur 5 exécutions) : le job `test`
  échoue si le budget de temps est dépassé, les durées sont journalisées
  ([#67](https://github.com/akwawa/Seedcartographer/issues/67)).
- Deux nouvelles langues d'interface : italien et portugais brésilien —
  interface complète et noms de biomes traduits, vérifiés par les tests de
  parité ([#63](https://github.com/akwawa/Seedcartographer/issues/63)).

## [0.2.0](https://github.com/akwawa/Seedcartographer/compare/v0.1.0...v0.2.0) (2026-07-06)

### Ajouté

- Spawn du monde et strongholds (positions exactes vérifiées par biomes,
  moteur cubiomes recompilé) : couches activables sur la carte (Overworld) et
  critères de recherche « à moins de N blocs du spawn / d'un stronghold »
  ([#41](https://github.com/akwawa/Seedcartographer/issues/41)).
- Page d'aide intégrée (bouton « ? ») : critères ET/OU/absent, raccourcis
  carte, limites connues, licence et crédits — traduite dans les 4 langues
  ([#55](https://github.com/akwawa/Seedcartographer/issues/55)).
- Image Docker multi-architecture (`linux/amd64` + `linux/arm64`, QEMU/buildx)
  et scan de vulnérabilités Trivy en pull request, en échec sur CVE critiques
  corrigeables ([#54](https://github.com/akwawa/Seedcartographer/issues/54)).
- Releases automatisées avec release-please : MR de release maintenue en
  continu (bump `package.json`, section de changelog générée), tag et release
  GitHub créés à sa fusion ; convention Conventional Commits documentée
  ([#53](https://github.com/akwawa/Seedcartographer/issues/53)).
- Thème clair : bascule ☀/☾ dans la barre du haut, détection
  `prefers-color-scheme`, choix mémorisé (`localStorage`), couleur de
  l'interface navigateur (`theme-color`) ajustée dynamiquement
  ([#49](https://github.com/akwawa/Seedcartographer/issues/49)).
- Import CSV de lieux (format de l'export existant, `x,z,…`) : les lieux
  s'affichent comme épingles sur la carte et dans la liste ; lignes invalides
  ignorées, en-tête optionnel
  ([#48](https://github.com/akwawa/Seedcartographer/issues/48)).
- Export PNG de la vue de carte (tuiles, couches, épingles) avec cartouche
  seed / version / dimension / coordonnées du centre, téléchargé localement
  ([#47](https://github.com/akwawa/Seedcartographer/issues/47)).
- Légende repliable des biomes visibles sur la carte (couleur + nom localisé),
  avec surbrillance croisée : le survol de la carte marque l'entrée
  correspondante, le survol d'une entrée atténue les autres biomes sur la
  carte ([#45](https://github.com/akwawa/Seedcartographer/issues/45)).
- Favoris : épingler un lieu depuis le pop-up (☆), note libre, liste par
  seed/version/dimension, losanges dorés permanents sur la carte, persistance
  `localStorage` — aucune donnée ne quitte le navigateur
  ([#44](https://github.com/akwawa/Seedcartographer/issues/44)).
- Presets de critères de recherche chargeables en un clic (bosquet de
  cerisiers en bord d'océan, village + avant-poste, champs de champignons,
  spot de ferme à slimes), libellés traduits
  ([#43](https://github.com/akwawa/Seedcartographer/issues/43)).
- Chunks à slimes (calculés depuis la seed, RNG Java pur) : couche activable
  sur la carte (Overworld) et critère de recherche « au moins N chunks à
  slimes dans un rayon R »
  ([#42](https://github.com/akwawa/Seedcartographer/issues/42)).
- Mises à jour automatiques des dépendances avec Dependabot : actions GitHub
  (SHA épinglés), devDependencies npm et submodule cubiomes, regroupées chaque
  semaine ([#52](https://github.com/akwawa/Seedcartographer/issues/52)).
- Pop-up de lieu : coordonnées équivalentes Nether ⇄ Overworld (÷8 / ×8) avec
  copie en un clic ([#46](https://github.com/akwawa/Seedcartographer/issues/46)).
- `CHANGELOG.md` au format Keep a Changelog, avec la règle de mise à jour par
  merge request ([#40](https://github.com/akwawa/Seedcartographer/issues/40)).

### Modifié

- La recherche tourne dans un second Web Worker avec sa propre instance du
  moteur WASM : les rendus de tuiles et les sondes de biome ne partagent plus
  sa file de messages — la carte reste totalement fluide pendant une longue
  recherche ([#50](https://github.com/akwawa/Seedcartographer/issues/50)).
- La version du cache du service worker n'est plus incrémentée à la main :
  les déploiements Pages et Docker l'estampillent avec un hash de contenu des
  assets (`scripts/sw-version.js`), invalidant le cache à chaque changement
  ([#51](https://github.com/akwawa/Seedcartographer/issues/51)).

### Corrigé

- Le job CI `sonar` n'échoue plus sur les MR Dependabot : le scan est sauté
  quand le secret `SONAR_TOKEN` n'est pas disponible, comme documenté
  ([#89](https://github.com/akwawa/Seedcartographer/issues/89)).
- Démo GitHub Pages et image Docker réparées : les modules récents
  (`coords.js`, `slime.js`, `presets.js`, `favorites.js`, `legend.js`,
  `theme.js`, et côté Docker aussi `biomes.js`, `export.js`, `sw.js`,
  manifest, icône) manquaient dans les listes de déploiement ; un test de
  non-régression aligne désormais ces listes sur `sw.js`
  ([#79](https://github.com/akwawa/Seedcartographer/issues/79)).

## [0.1.0] — 2026-07-06

Première version publiée. Contenu du jalon
[0.1.0](https://github.com/akwawa/Seedcartographer/milestone/1) (20 merge requests).

### Ajouté
- **Sélecteur de version Java** (1.0 → 1.21) recalculant carte, structures et
  recherche (#3).
- **Dimensions Nether et End** : carte, biomes et structures propres à chaque
  dimension (forteresses, bastions, portails en ruine, cités de l'End) (#33).
- **Critères de recherche composables** : plusieurs biomes principaux (l'un
  de), clauses de biomes adjacents et de structures combinées en ET/OU (#9),
  critère « biome absent » (NON) (#26).
- **Recherche annulable** avec barre de progression, tuiles fluides pendant la
  recherche (#31).
- **Interface multilingue** (français, anglais, espagnol, allemand) avec
  détection automatique et choix mémorisé (#7), **noms de biomes traduits** (#28).
- **Export CSV / JSON** des résultats (monde, critères complets, lieux) (#27).
- **PWA** : application installable et utilisable hors-ligne (service worker,
  manifest, icône) (#30).
- **Image Docker** publiée sur GHCR (`latest` + versions) (#13), **démo GitHub
  Pages** (#38), **release automatisée** au tag (#39).
- **Chaîne qualité** : ESLint (#25), tests unitaires et CI (#1), tests
  end-to-end Playwright (#29), SonarQube Cloud avec couverture (#35), hadolint
  / actionlint / shellcheck / stylelint (#37).
- **Build WASM reproductible** : cubiomes en submodule épinglé, `build.sh`,
  vérification byte-identique en CI (#32).
- Fermeture du pop-up de résultat (bouton ×, clic carte, nouvelle recherche) (#5).

### Corrigé
- Les échecs de recherche (zone trop grande) ne s'affichent plus comme
  « aucun résultat » ; échec de chargement WASM signalé ; presse-papiers
  fonctionnel en `http://` ; tuiles en échec signalées (#1).
- Compatibilité Chrome ≥ 149 du moteur WASM (`GROWABLE_ARRAYBUFFERS=0`) (#32).
- Avertissement de dépréciation Node 20 des actions CI (#11).

### Sécurité
- Licence **CC BY-NC 4.0** et notices tierces (cubiomes MIT, polices OFL) (#1).
- Polices auto-hébergées : plus aucune requête externe (#1).
- Validation des liens de partage (hash) ; suppression des `innerHTML`
  interpolés (#1, #9).
- Workflows durcis : token en moindre privilège, actions épinglées par SHA,
  `npm ci --ignore-scripts` (#35).

[Non publié]: https://github.com/akwawa/Seedcartographer/compare/v0.7.0...HEAD
[0.1.0]: https://github.com/akwawa/Seedcartographer/releases/tag/v0.1.0

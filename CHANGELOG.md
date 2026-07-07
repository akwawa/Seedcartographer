# Changelog

Toutes les modifications notables de ce projet sont documentées dans ce fichier.

Le format suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) et le
projet adhère au [versionnage sémantique](https://semver.org/lang/fr/).

**Règle de contribution** : chaque merge request ajoute son entrée dans la
section « Non publié » (catégories : Ajouté / Modifié / Corrigé / Sécurité).
Les releases sont automatisées par
[release-please](https://github.com/googleapis/release-please) : une MR de
release maintient le bump de version et une section générée depuis les
commits conventionnels ; avant de la fusionner, déplacer le contenu de
« Non publié » dans la nouvelle section de version. La fusion crée le tag
et la release GitHub.

## [0.3.0](https://github.com/akwawa/Seedcartographer/compare/v0.2.0...v0.3.0) (2026-07-07)


### Ajouté

* add Italian and Brazilian Portuguese UI languages ([28d3258](https://github.com/akwawa/Seedcartographer/commit/28d3258bb6d7dad6f41e9755e8b8a6d8c39c147b)), closes [#63](https://github.com/akwawa/Seedcartographer/issues/63)
* extract share-state logic into a tested pure module ([a169203](https://github.com/akwawa/Seedcartographer/commit/a169203556b6067f73edb9d6df933f2c2aae6d8d)), closes [#66](https://github.com/akwawa/Seedcartographer/issues/66)
* full mobile and touch support ([6a89366](https://github.com/akwawa/Seedcartographer/commit/6a8936613fd7a030b188d5d4cd9c56cc167ede02)), closes [#62](https://github.com/akwawa/Seedcartographer/issues/62)
* gate CI on a scanGrid performance benchmark ([245194c](https://github.com/akwawa/Seedcartographer/commit/245194c3b626fc31614497ffc0127a76c356a4d9)), closes [#67](https://github.com/akwawa/Seedcartographer/issues/67)
* keyboard navigation, ARIA labels and WCAG AA contrast ([f69f303](https://github.com/akwawa/Seedcartographer/commit/f69f3039f5a6ba60dd7ad1732e019073716f9602)), closes [#64](https://github.com/akwawa/Seedcartographer/issues/64)
* LRU tile cache for smooth pan/zoom ([f0c8f4a](https://github.com/akwawa/Seedcartographer/commit/f0c8f4a934b7d1f12c79fadc4df80c9dbdc50cb2)), closes [#61](https://github.com/akwawa/Seedcartographer/issues/61)
* multi-seed search with a worker pool ([e100adb](https://github.com/akwawa/Seedcartographer/commit/e100adbbb3912cd200d3a55d254acb6639e70c97)), closes [#56](https://github.com/akwawa/Seedcartographer/issues/56)
* progressive typing with JSDoc and checkJs ([a463128](https://github.com/akwawa/Seedcartographer/commit/a46312867bd5cba1596160287d890e8076b944e0)), closes [#65](https://github.com/akwawa/Seedcartographer/issues/65)
* scale bar, adaptive coordinate grid and clickable minimap ([f1ac7b7](https://github.com/akwawa/Seedcartographer/commit/f1ac7b741612eac4c243bb5500e95fb967604491)), closes [#60](https://github.com/akwawa/Seedcartographer/issues/60)
* structure pairs, in-main-biome flag and quad witch hut detection ([59568d5](https://github.com/akwawa/Seedcartographer/commit/59568d53a260acd5eee025324ac8a5b988592e34)), closes [#57](https://github.com/akwawa/Seedcartographer/issues/57)
* surface-height search criterion ([8b25c84](https://github.com/akwawa/Seedcartographer/commit/8b25c84dd0ec4778fff6d03008d28e41f151c1d2)), closes [#59](https://github.com/akwawa/Seedcartographer/issues/59)
* Y-layer slider for 3D biomes ([975a8ea](https://github.com/akwawa/Seedcartographer/commit/975a8ead383ea787e6669fc90d9b7c9d59112848)), closes [#58](https://github.com/akwawa/Seedcartographer/issues/58)


### Corrigé

* address Sonar findings on advanced structure criteria ([c7d79f3](https://github.com/akwawa/Seedcartographer/commit/c7d79f32bee797954b5147595e86edd0a666e22d))
* assert pinch-zoom result explicitly per S2699 and drop temp debug step ([65052f4](https://github.com/akwawa/Seedcartographer/commit/65052f4b36bcce775299bdc172f59801e82b031a))
* Number.parseInt in export meta and node:assert import per Sonar ([91af2c2](https://github.com/akwawa/Seedcartographer/commit/91af2c2b064ad77cae6503cb4b4cb08ab6b4f043))
* Number.parseInt per S7773 and drop temp debug step ([c28d950](https://github.com/akwawa/Seedcartographer/commit/c28d950d2b982771dbc8772117a2335914fd7864))
* optional chaining per S6582 and drop temp debug step ([26a2e59](https://github.com/akwawa/Seedcartographer/commit/26a2e59ee6e1c81548af8df3d02dc96e740f529c))
* optional chaining per S6582 and drop temp debug step ([8059db6](https://github.com/akwawa/Seedcartographer/commit/8059db6733f3b42c343e75b65bab7858daeb74eb))
* plain expect assertion in pinch test for S2699 ([f06be82](https://github.com/akwawa/Seedcartographer/commit/f06be8248387dd0c55eeb12107904813498aaa1d))
* restore ci.yml formatting after debug-step removal ([c45ae03](https://github.com/akwawa/Seedcartographer/commit/c45ae03d36f603dd5f04f7fa6f5db701f462e02d))
* use Array.at(-1) per S7755 and drop temp debug step ([3bafd4c](https://github.com/akwawa/Seedcartographer/commit/3bafd4c0008dc98d56263b8c73bc8a8340c44edc))
* use native progress, output and dialog elements per Sonar a11y rules ([4ec40c1](https://github.com/akwawa/Seedcartographer/commit/4ec40c17b2c2636e670c2f4a24fd89215200b888))
* use RegExp.exec per S6594 and drop temp debug step ([0b3e5bd](https://github.com/akwawa/Seedcartographer/commit/0b3e5bd752c815b4bf1cf6887eb3c33db69017eb))


### Modifié

* address Sonar findings on the benchmark script ([1511140](https://github.com/akwawa/Seedcartographer/commit/1511140db38264abc818751b3568273ca590e274))

## [Non publié]

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

[Non publié]: https://github.com/akwawa/Seedcartographer/compare/v0.2.0...HEAD
[0.1.0]: https://github.com/akwawa/Seedcartographer/releases/tag/v0.1.0

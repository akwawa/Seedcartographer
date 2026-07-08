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

## [0.4.0](https://github.com/akwawa/Seedcartographer/compare/v0.3.0...v0.4.0) (2026-07-08)


### Ajouté

* add a go-to-coordinates control on the map ([9b41551](https://github.com/akwawa/Seedcartographer/commit/9b41551d6b256ae74f4b7107193824c217d96b94)), closes [#108](https://github.com/akwawa/Seedcartographer/issues/108)
* add a high-visibility (colorblind-friendly) map palette ([37ecca1](https://github.com/akwawa/Seedcartographer/commit/37ecca1ede4a992a0781648db47147fc542203d1)), closes [#112](https://github.com/akwawa/Seedcartographer/issues/112)
* add a ruler tool to measure map distances ([9da5d82](https://github.com/akwawa/Seedcartographer/commit/9da5d822b4bae6cb251bac274fba8ab50bbcb48e)), closes [#109](https://github.com/akwawa/Seedcartographer/issues/109)
* contrôle « aller aux coordonnées » sur la carte ([30d816b](https://github.com/akwawa/Seedcartographer/commit/30d816b725abddef4deb768949b09dfcb4a80140))
* couverture par branche à 100 % sur les modules purs ([bc27ce4](https://github.com/akwawa/Seedcartographer/commit/bc27ce486e9d9cc9ad1c6332eef55c9c4aef4619))
* historique des recherches récentes rejouables ([ccdcad3](https://github.com/akwawa/Seedcartographer/commit/ccdcad3279043a68425e4b6eb93b9fd397392661))
* keep a replayable history of recent searches ([cf66ca3](https://github.com/akwawa/Seedcartographer/commit/cf66ca378cd68668a606f47f4341af3d5ce1dae6)), closes [#110](https://github.com/akwawa/Seedcartographer/issues/110)
* outil règle pour mesurer une distance sur la carte ([7af23f6](https://github.com/akwawa/Seedcartographer/commit/7af23f6ff727959e5fb74b97e401583a7ef7c119))
* palette haute lisibilité (daltonisme) pour la carte ([f446e1d](https://github.com/akwawa/Seedcartographer/commit/f446e1da2a9154365ae248dbb6034481425a9e86))
* presets personnalisés — sauvegarder ses jeux de critères ([f10aebd](https://github.com/akwawa/Seedcartographer/commit/f10aebda1ddd2a8f128c4560cbea9b7c0d427a7c))
* render the map as a progressive checkerboard of fixed tiles ([f48261f](https://github.com/akwawa/Seedcartographer/commit/f48261f44510417086ebbaa009593e8c36247e63)), closes [#114](https://github.com/akwawa/Seedcartographer/issues/114)
* rendu en damier progressif de tuiles fixes 256 px ([b19e3a0](https://github.com/akwawa/Seedcartographer/commit/b19e3a0665ba040506e6604f2bab3a5c4e3640db))
* require full branch coverage on the shared pure modules ([ca2f3b5](https://github.com/akwawa/Seedcartographer/commit/ca2f3b57d9f92b418e55e5c9ebff2c393bbc5b6a)), closes [#128](https://github.com/akwawa/Seedcartographer/issues/128)
* save custom criteria presets ([ea74499](https://github.com/akwawa/Seedcartographer/commit/ea74499c253947ab8546f0e67347514eb1dfe759)), closes [#111](https://github.com/akwawa/Seedcartographer/issues/111)
* score and sort the multi-seed candidates ([e440ef9](https://github.com/akwawa/Seedcartographer/commit/e440ef93a47976a51a21d9d1b9e8b50567583f15)), closes [#113](https://github.com/akwawa/Seedcartographer/issues/113)
* score et tri des seeds candidates (multi-seeds) ([c30eb7b](https://github.com/akwawa/Seedcartographer/commit/c30eb7b1033087178a34e17b5ccc0ae709ad08e8))


### Corrigé

* address the Sonar findings on the ruler change ([cf9435e](https://github.com/akwawa/Seedcartographer/commit/cf9435ebd1f0feaf64811be01e8503aea527f9af))
* assert minimap paint coverage explicitly per S2699 ([35fc96d](https://github.com/akwawa/Seedcartographer/commit/35fc96d652880482728e674656def4e4310b8c08))
* bring the SonarCloud project stock to zero ([62a4752](https://github.com/akwawa/Seedcartographer/commit/62a47529a48cb479a36fd2e64e3b1667c78fcc2b)), closes [#107](https://github.com/akwawa/Seedcartographer/issues/107)
* clear the remaining Sonar maintainability issues ([89f23ce](https://github.com/akwawa/Seedcartographer/commit/89f23cef03a604489449ce1222f45d5bd1636182)), closes [#126](https://github.com/akwawa/Seedcartographer/issues/126)
* deduplicate in-flight tile requests ([fa05de1](https://github.com/akwawa/Seedcartographer/commit/fa05de17442eda540de8f293798799d0af555b61))
* make the go-to parser regex linear-time ([c9cfcc8](https://github.com/akwawa/Seedcartographer/commit/c9cfcc89ea66bc95300f262f3a8ca3db7b71613c))
* map the minimap tile onto the whole canvas ([a5239eb](https://github.com/akwawa/Seedcartographer/commit/a5239eba003baef49180f31eb9528cb8cb3c4e09)), closes [#105](https://github.com/akwawa/Seedcartographer/issues/105)
* ramener le stock SonarCloud à zéro ([3268318](https://github.com/akwawa/Seedcartographer/commit/32683186860d50d5d9e66d914a6498615ecd57a6))
* restore render responsiveness ([f945b90](https://github.com/akwawa/Seedcartographer/commit/f945b9091bbe710570a7f57e92363b725224f4dd)), closes [#106](https://github.com/akwawa/Seedcartographer/issues/106)
* traiter les Maintainability Issues Sonar restantes ([0079cf2](https://github.com/akwawa/Seedcartographer/commit/0079cf29bbb5af16c4a304fd1fa8146df5759eaf))

## [Non publié]

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

[Non publié]: https://github.com/akwawa/Seedcartographer/compare/v0.3.0...HEAD
[0.1.0]: https://github.com/akwawa/Seedcartographer/releases/tag/v0.1.0

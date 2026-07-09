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

## [0.6.0](https://github.com/akwawa/Seedcartographer/compare/v0.5.0...v0.6.0) (2026-07-09)


### Ajouté

* add anonymous Umami usage statistics and disclose them ([0b46289](https://github.com/akwawa/Seedcartographer/commit/0b46289946e7932aefda995420af9dc4e1d7bf7d))
* add anonymous Umami usage statistics and disclose them ([1ebb768](https://github.com/akwawa/Seedcartographer/commit/1ebb76867e4d322bf03e3de8259e3a80a39a675d)), closes [#168](https://github.com/akwawa/Seedcartographer/issues/168)
* afficher la version déployée dans l'aide ([1de140d](https://github.com/akwawa/Seedcartographer/commit/1de140d7fbf46cb4e2019849892cee64c93af576))
* biome-share criteria (percentage of area within a radius) ([209c36d](https://github.com/akwawa/Seedcartographer/commit/209c36d04b055b5104c080d651002f46579efff3)), closes [#142](https://github.com/akwawa/Seedcartographer/issues/142)
* compress the share-link hash with CompressionStream ([f4d51e4](https://github.com/akwawa/Seedcartographer/commit/f4d51e41a90bd13b6f086fd3fab872e1deba3820)), closes [#141](https://github.com/akwawa/Seedcartographer/issues/141)
* critères de biomes en pourcentage de zone ([e41c9ed](https://github.com/akwawa/Seedcartographer/commit/e41c9edec0b44294d54961f081b8414c9f05fd27))
* critères multi-Y (biome en profondeur ET en surface) ([dea7e37](https://github.com/akwawa/Seedcartographer/commit/dea7e37b400ec632be4c424e6f4d798a8411bdb0))
* domaine personnalisé seedcarto.com ([2db7a3b](https://github.com/akwawa/Seedcartographer/commit/2db7a3bdd4da1c5ecf3b857b0e9cc4b0e15479be))
* embedded gallery of remarkable seeds ([947f234](https://github.com/akwawa/Seedcartographer/commit/947f234728f53dc198cbde2439c90e5bdc9dd5c4)), closes [#144](https://github.com/akwawa/Seedcartographer/issues/144)
* export/import complet du profil ([08a9693](https://github.com/akwawa/Seedcartographer/commit/08a9693e4293d794fbdfeda40363e0f674a5e5e2))
* galerie de seeds remarquables ([7de37bd](https://github.com/akwawa/Seedcartographer/commit/7de37bd3f556a799fbebde8a718a1de253a1897e))
* geographic-pattern criteria (island, lagoon, enclave) ([c042a1c](https://github.com/akwawa/Seedcartographer/commit/c042a1c44bd72d849d5987cebd19032bfb42261d)), closes [#146](https://github.com/akwawa/Seedcartographer/issues/146)
* motifs géographiques (île, baie/lagon, enclave) ([0a83f13](https://github.com/akwawa/Seedcartographer/commit/0a83f13a7edbc297a9b36a7a0ecda92b44cf7bb1))
* open the seed gallery in an in-app modal with rendered thumbnails ([ceb3dc8](https://github.com/akwawa/Seedcartographer/commit/ceb3dc84296e2de582e03fa35cd4bf486d2005bb))
* open the seed gallery in an in-app modal with rendered thumbnails ([b755648](https://github.com/akwawa/Seedcartographer/commit/b7556481583db70104b231b055e81ee1d81960c8)), closes [#172](https://github.com/akwawa/Seedcartographer/issues/172)
* overlay structure markers on gallery thumbnails ([c6dae08](https://github.com/akwawa/Seedcartographer/commit/c6dae088eafc9e26b3cde11768995c968c011ce2))
* overlay structure markers on gallery thumbnails ([664a5d9](https://github.com/akwawa/Seedcartographer/commit/664a5d9c0b2c092d2541e7bc5b4f6fe6fbc61444)), closes [#174](https://github.com/akwawa/Seedcartographer/issues/174)
* per-clause Y layer for adjacent-biome criteria ([5963717](https://github.com/akwawa/Seedcartographer/commit/59637172151d13d29ab356c00a730999ca115686)), closes [#145](https://github.com/akwawa/Seedcartographer/issues/145)
* permaliens compressés (hash de partage deflate) ([7aa03f0](https://github.com/akwawa/Seedcartographer/commit/7aa03f061b57f0d5c36b4e630028557d3e78c386))
* recherche multi-seeds reprenable ([d777d26](https://github.com/akwawa/Seedcartographer/commit/d777d26a05033b2e132147964817df67f10c44aa))
* resumable multi-seed search ([855573b](https://github.com/akwawa/Seedcartographer/commit/855573bcdb25a00045f920f50c6ade41a78e97b8)), closes [#143](https://github.com/akwawa/Seedcartographer/issues/143)
* serve the site under seedcarto.com ([0b7616e](https://github.com/akwawa/Seedcartographer/commit/0b7616e06662247dcd3663b406af7ad7f1e310f1)), closes [#166](https://github.com/akwawa/Seedcartographer/issues/166)
* show the deployed version in the help dialog ([429fcb5](https://github.com/akwawa/Seedcartographer/commit/429fcb52d2631b1d3f20311754601bf1fd7d8f96)), closes [#167](https://github.com/akwawa/Seedcartographer/issues/167)


### Corrigé

* address the sonar findings on the shape scan ([911c53a](https://github.com/akwawa/Seedcartographer/commit/911c53a6c95d1f324b63ac8d609812ecdb52e5c1))
* canonicalize the app-version target path ([33ef5f3](https://github.com/akwawa/Seedcartographer/commit/33ef5f391037d5ec3749d68f8b53e55692958567))
* declare the WHATWG globals used by the share-hash codec ([c4f2034](https://github.com/akwawa/Seedcartographer/commit/c4f20343c7dcd64795b3d78c7f1be58f7c1e6f17))
* extract the scan loop and the main-grid generation ([bbfe485](https://github.com/akwawa/Seedcartographer/commit/bbfe4857b28a1e971d5939ce0d0cd16b7e446544))
* fill the whole viewport at deep zoom-outs ([560c209](https://github.com/akwawa/Seedcartographer/commit/560c20933d556cf2d13abf638f587a8fb344bc93))
* fill the whole viewport at deep zoom-outs ([cb5feb9](https://github.com/akwawa/Seedcartographer/commit/cb5feb9ff6e1dc8bd96b8f5557d1fb359c358a07)), closes [#176](https://github.com/akwawa/Seedcartographer/issues/176)
* keep the gallery dimension whitelist in a Set ([aaa1ace](https://github.com/akwawa/Seedcartographer/commit/aaa1ace5fb290606ca3e25ae96d2a41d6e7f2383))
* pass the grid context to floodComponent as one object ([bc1afa5](https://github.com/akwawa/Seedcartographer/commit/bc1afa55c264989cb080f9be5d00a7e6dd7625e7))
* read the git commit without spawning a subprocess ([5793e5a](https://github.com/akwawa/Seedcartographer/commit/5793e5a5a4804fb3b354cda43bd3bde061d3b671)), closes [#167](https://github.com/akwawa/Seedcartographer/issues/167)
* split the multi-Y additions under the complexity threshold ([2a20624](https://github.com/akwawa/Seedcartographer/commit/2a206246a11a5110977b5a3618ca8a7b4bf5f675))
* use code-point string APIs in the share-hash codec ([985972c](https://github.com/akwawa/Seedcartographer/commit/985972c1e213b0b6865d047c7db0bebe6e20501e))
* use includes() for the null check in parseSeedRun ([9cb34c2](https://github.com/akwawa/Seedcartographer/commit/9cb34c25db701095c7ec4134b639d2f256536319))

## [Non publié]

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

[Non publié]: https://github.com/akwawa/Seedcartographer/compare/v0.5.0...HEAD
[0.1.0]: https://github.com/akwawa/Seedcartographer/releases/tag/v0.1.0

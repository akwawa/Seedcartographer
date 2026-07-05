# Seedcartographer

Cherche, dans une seed Minecraft **Java** donnée, des endroits qui réunissent
plusieurs critères en même temps : un biome principal, collé à un biome voisin,
avec un certain nombre de structures à proximité. Tout le calcul de génération du
monde tourne dans le navigateur (cubiomes compilé en WebAssembly) — aucune donnée
n'est envoyée à un serveur : les polices sont auto-hébergées et l'application ne
fait aucune requête externe.

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

Une image est publiée sur GitHub Container Registry à chaque mise à jour de
`main` (tag `latest`) et à chaque tag `v*` (tag de version) :

```bash
docker run --rm -p 8080:80 ghcr.io/akwawa/seedcartographer:latest
```

Puis ouvre http://localhost:8080. Pour construire l'image localement :

```bash
docker build -t seedcartographer .
docker run --rm -p 8080:80 seedcartographer
```

## Utilisation

1. Saisis une **seed** en haut (numérique ou texte) et clique sur **Load seed**.
   La seed `141` est chargée par défaut — c'est un exemple où un *cherry grove*
   est collé à un *warm ocean* avec plusieurs villages autour (vers -384, 0).
2. Règle les **critères** dans le panneau de gauche. Chaque section accepte
   plusieurs lignes (boutons « + Ajouter » / « × ») : biomes principaux
   (l'un d'eux), biomes adjacents + distance et structures (nombre minimum +
   rayon) — ces deux dernières sections se combinent en « tous » (ET) ou
   « au moins un » (OU).
3. Choisis le **rayon de recherche** (taille de la zone balayée autour du centre
   de la carte) et la **résolution** (pas d'échantillonnage en blocs).
4. Clique sur **Search this area**. Les résultats apparaissent comme épingles sur
   la carte et dans la liste ; clique une épingle pour copier la commande `/tp`.
5. **Show on map** affiche les structures (villages, etc.) dans la vue courante.
6. **Share link** copie une URL qui encode la seed, la vue et les critères :
   ouverte ailleurs, elle rejoue exactement la même recherche.

Glisse pour te déplacer, molette pour zoomer, clique une épingle pour la
sélectionner.

## Bon à savoir

- **Application installable et hors-ligne (PWA).** Servie en HTTPS (ou sur
  localhost), l'application s'installe depuis le navigateur et fonctionne
  ensuite sans réseau : tous les fichiers (moteur WASM compris) sont mis en
  cache par un service worker. Pour publier une mise à jour, incrémenter
  `VERSION` dans `sw.js`.
- **Interface multilingue.** L'interface est disponible en français, anglais,
  espagnol et allemand : la langue du navigateur est détectée automatiquement et
  le sélecteur en haut à droite permet d'en changer (choix mémorisé). Les noms
  de biomes restent ceux du moteur cubiomes (identifiants techniques).

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
- **Trois dimensions.** Le sélecteur « Dimension » de la barre du haut bascule
  entre Overworld, Nether et End : carte, biomes, structures (forteresses,
  bastions, portails en ruine du Nether, cités de l'End) et recherche suivent
  la dimension choisie, qui est incluse dans les liens de partage et les exports.
- **Version de génération sélectionnable.** Le sélecteur « Java » dans la barre
  du haut permet de choisir la version (de 1.0 à 1.21, 1.21 par défaut) : la
  carte, les structures et la recherche sont recalculées pour la version
  choisie, et la version est incluse dans les liens de partage.

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html`, `styles.css` | Interface |
| `app.js` | Carte (pan/zoom, rendu, épingles), UI, partage de lien |
| `worker.js` | Web Worker : possède l'instance WASM (tuiles + recherche) |
| `seed.js` | Conversion seed → entier 64 bits (partagé worker/tests) |
| `search.js` | Balayage multi-critères de la grille de biomes (partagé worker/tests) |
| `i18n.js` | Traductions de l'interface (FR, EN, ES, DE) |
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
- Une CI GitHub Actions lance lint, tests unitaires et e2e sur chaque push et
  pull request.
- **Recompiler le WASM** : voir [`BUILDING.md`](BUILDING.md).

## Licence

Ce projet est distribué sous licence
**[CC BY-NC 4.0](LICENSE)** (Attribution – Pas d'utilisation commerciale) :
toute réutilisation doit créditer l'auteur, et l'usage commercial est interdit.
Les composants tiers (cubiomes, polices) conservent leurs licences respectives —
voir [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).

# Seedcartographer

Cherche, dans une seed Minecraft **Java** donnée, des endroits qui réunissent
plusieurs critères en même temps : un biome principal, collé à un biome voisin,
avec un certain nombre de structures à proximité. Tout le calcul de génération du
monde tourne dans le navigateur (cubiomes compilé en WebAssembly) — aucune donnée
n'est envoyée à un serveur.

## Lancer l'application

Le module WebAssembly doit être servi par un vrai serveur web (l'ouverture
directe du fichier `index.html` ne marchera pas). Depuis ce dossier :

```bash
python3 -m http.server 8000
```

Puis ouvre http://localhost:8000 dans ton navigateur.

(N'importe quel serveur statique fait l'affaire : `npx serve`, l'extension
« Live Server » de VS Code, etc.)

## Utilisation

1. Saisis une **seed** en haut (numérique ou texte) et clique sur **Load seed**.
   La seed `141` est chargée par défaut — c'est un exemple où un *cherry grove*
   est collé à un *warm ocean* avec plusieurs villages autour (vers -384, 0).
2. Règle les **critères** dans le panneau de gauche : biome principal, biome
   adjacent + distance, structure + nombre minimum + rayon.
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
- **Version de génération : Java 1.21** (limite de la bibliothèque cubiomes
  embarquée). D'autres versions pourront être ajoutées.

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html`, `styles.css` | Interface |
| `app.js` | Carte (pan/zoom, rendu, épingles), UI, partage de lien |
| `worker.js` | Web Worker : possède l'instance WASM (tuiles + recherche) |
| `mcfinder.js`, `mcfinder.wasm` | Moteur cubiomes compilé |
| `mcfinder.c` | Source C du wrapper (pour référence / recompilation) |

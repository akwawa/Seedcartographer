# Dossier CII Best Practices (bestpractices.dev)

Ce document prépare l'inscription du projet au badge **OpenSSF Best
Practices** (ex-CII Best Practices), niveau **passing**, sur
<https://www.bestpractices.dev/>.

## Démarche

1. Le mainteneur crée un compte sur <https://www.bestpractices.dev/> (connexion
   GitHub) et ajoute le projet (`github.com/akwawa/Seedcartographer`).
2. Il répond au questionnaire « passing » en s'appuyant sur les réponses
   préparées ci-dessous (chaque critère se répond « Met », « Unmet » ou
   « N/A », avec une justification et souvent une URL).
3. Une fois le badge obtenu, il ajoute la ligne de badge (voir tout en bas)
   au `README.md`.

## Réponses préparées, section par section

### Basics

- **Description du projet** : « Met » — le `README.md` décrit ce que fait
  l'application (recherche multi-critères dans une seed Minecraft Java,
  calcul entièrement dans le navigateur via cubiomes/WebAssembly) et comment
  la lancer.
- **Comment contribuer / obtenir de l'aide** : « Met » — la section
  « Développement » du `README.md` documente tests, lint, couverture,
  typage, convention de commits et flux de branches (`dev` → `main`) ;
  le `CHANGELOG.md` documente la règle « une entrée par merge request ».
- **Licence FLOSS publiée** : le projet publie sa licence dans `LICENSE`
  (**CC BY-NC 4.0**, Attribution – Pas d'utilisation commerciale).
  ⚠️ Point d'attention : CC BY-NC 4.0 n'est **pas** une licence approuvée
  OSI/FSF (clause non commerciale) ; le critère `floss_license` sera
  probablement évalué « Unmet ». Les critères de *publication* de la
  licence (`license_location`) sont « Met » (fichier `LICENSE` à la racine,
  référencé dans le README).
- **Documentation basique** : « Met » — `README.md` (utilisation),
  `BUILDING.md` (recompilation du WASM), `SECURITY.md`,
  `THIRD_PARTY_NOTICES.md`.
- **Site HTTPS** : « Met » — dépôt sur GitHub (HTTPS), application déployée
  sur <https://seedcarto.com/> (GitHub Pages, HTTPS), badges et API en HTTPS.
- **Discussion** : « Met » — issues et discussions GitHub publiques.
- **Langue** : la documentation est en français, l'interface est traduite en
  11 langues dont l'anglais.

### Change Control

- **Dépôt de sources public versionné** : « Met » —
  <https://github.com/akwawa/Seedcartographer>, historique git complet,
  contributions par merge requests.
- **Suivi des versions provisoires** : « Met » — chaque commit est visible ;
  la branche `dev` porte le travail du jalon courant avant fusion vers `main`.
- **Numérotation unique des versions** : « Met » — versionnage sémantique
  (`package.json`), releases automatisées par **release-please** à partir
  des commits conventionnels.
- **Notes de version** : « Met » — `CHANGELOG.md` au format Keep a Changelog
  (en français), plus les notes générées sur chaque release GitHub taguée
  (`v*`).

### Reporting

- **Processus de signalement de bogues** : « Met » — issues GitHub publiques ;
  les rapports reçoivent une réponse et le CHANGELOG trace les corrections
  (catégorie « Corrigé », référence `#ticket`).
- **Processus de signalement de vulnérabilités** : « Met » — `SECURITY.md`
  documente le signalement **privé** via GitHub Security Advisories
  (<https://github.com/akwawa/Seedcartographer/security/advisories/new>),
  avec accusé de réception sous 7 jours et plan de correction sous 30 jours.
- **Archive publique des rapports** : « Met » — issues GitHub et avis de
  sécurité publiés.

### Quality

- **Système de build fonctionnel** : « Met » — application statique ; le
  module WASM se recompile avec `build.sh` (documenté dans `BUILDING.md`)
  et la CI vérifie que le build est **reproductible** (job `wasm` : la
  recompilation doit produire le binaire commité).
- **Suite de tests automatisée** : « Met » — plus de 349 tests unitaires
  (`node:test`, `npm test`) et 90 tests end-to-end Playwright
  (`npm run e2e`), lancés en CI GitHub Actions sur chaque push et PR.
- **Nouveaux tests pour les nouvelles fonctionnalités** : « Met » — la
  couverture est **verrouillée à 100 %** (lignes, branches, fonctions) sur
  les modules purs partagés (`npm run coverage:branches`, gate CI) : toute
  fonctionnalité non testée fait échouer la CI. Des tests de mutation
  **Stryker** complètent le dispositif (workflow `mutation`, seuil `break`).
- **Avertissements activés** : « Met » — ESLint, stylelint, `tsc --noEmit`
  (JSDoc/`checkJs`), hadolint (Dockerfile), actionlint (workflows),
  shellcheck (`build.sh`), zizmor (durcissement des workflows), tous
  bloquants en CI. S'y ajoutent des budgets de performance (benchmark
  `scanGrid`, temps de premier rendu e2e) et un audit d'accessibilité
  strict axe-core + Lighthouse.

### Security

- **Connaissance des bonnes pratiques de développement sécurisé** : « Met » —
  périmètre décrit dans `SECURITY.md` (injection via liens de partage et
  fichiers importés, chaîne de build, image nginx).
- **Cryptographie** : « N/A » — l'application n'implémente **aucune
  cryptographie maison** et ne gère ni authentification ni données privées
  (tout tourne dans le navigateur, aucune donnée utilisateur transmise à un
  serveur). Les critères `crypto_*` se répondent « N/A ». La livraison est
  protégée par TLS (HTTPS partout) et les images Docker sont **signées
  keyless avec cosign** (vérifiables, SBOM SPDX attaché).
- **Livraison sécurisée** : « Met » — HTTPS pour le site, le dépôt et le
  registre ; images `ghcr.io` signées cosign et scannées **Trivy** (échec
  sur CVE critiques corrigeables) ; actions CI épinglées par SHA.
- **Vulnérabilités connues corrigées** : « Met » — **Dependabot**
  hebdomadaire (actions, npm, submodule cubiomes), `npm audit` maintenu à
  **zéro** vulnérabilité en CI, `lockfile-lint` sur le lockfile.
- **Pas de fuite de credentials** : « Met » — secrets uniquement via les
  secrets GitHub Actions ; analyse CodeQL et secret scanning GitHub actifs.

### Analysis

- **Analyse statique** : « Met » — **SonarCloud** (quality gate bloquante :
  couverture ≥ 80 % sur le nouveau code, duplication ≤ 3 %, notes
  Fiabilité/Sécurité/Maintenabilité A), **CodeQL**, ESLint/stylelint,
  hadolint, actionlint, shellcheck, zizmor.
- **Analyse statique orientée vulnérabilités** : « Met » — CodeQL et
  SonarCloud incluent des règles de sécurité ; OpenSSF **Scorecard**
  hebdomadaire (résultats publiés en code scanning et badge README).
- **Analyse dynamique** : « Met » — 90 tests e2e Playwright sur
  l'application réelle, audit axe-core strict, benchmarks de performance ;
  les tests de mutation Stryker valident la qualité de la suite. (Pas de
  fuzzing dédié : le critère `dynamic_analysis` reste « Met » via les tests
  e2e, `dynamic_analysis_unsafe` est « N/A » — JavaScript, pas de code
  mémoire-unsafe côté application.)

## PAT Branch-Protection pour Scorecard

Le check **Branch-Protection** de Scorecard ne peut pas lire les règles de
protection de branche avec le `GITHUB_TOKEN` par défaut. Pour l'activer :

1. Créer un **fine-grained PAT** (Settings → Developer settings →
   Fine-grained tokens) limité au seul dépôt `Seedcartographer`, avec
   l'unique permission **« Administration: read-only »** (lecture des
   branch protection rules), et une expiration raisonnable.
2. L'enregistrer comme **secret de dépôt** nommé `SCORECARD_TOKEN`
   (Settings → Secrets and variables → Actions).
3. Le workflow `.github/workflows/scorecard.yml` l'utilise automatiquement
   s'il est présent, et retombe sur le `GITHUB_TOKEN` par défaut sinon.

## Badge à ajouter au README

Une fois l'inscription faite et l'identifiant de projet attribué par
bestpractices.dev, coller cette ligne dans le `README.md` (remplacer
`<ID_PROJET>`) :

```markdown
[![OpenSSF Best Practices](https://www.bestpractices.dev/projects/<ID_PROJET>/badge)](https://www.bestpractices.dev/projects/<ID_PROJET>)
```

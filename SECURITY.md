# Politique de sécurité

## Versions supportées

Seul le code de la dernière release (et la branche `main`) reçoit des
correctifs de sécurité.

| Version          | Supportée |
| ---------------- | --------- |
| dernière release | ✅        |
| antérieures      | ❌        |

## Signaler une vulnérabilité

Merci de **ne pas ouvrir d'issue publique** pour une vulnérabilité.

Utilisez le signalement privé GitHub :
**Security → Report a vulnerability** sur ce dépôt
(<https://github.com/akwawa/Seedcartographer/security/advisories/new>).

Ce que vous pouvez attendre :

- accusé de réception sous **7 jours** ;
- diagnostic et plan de correction sous **30 jours** pour un problème
  confirmé ;
- crédit dans l'avis de sécurité publié, si vous le souhaitez.

## Périmètre

L'application est entièrement statique : les calculs tournent dans le
navigateur et aucune donnée utilisateur n'est transmise à un serveur (seules
des statistiques d'usage anonymes, sans cookies, sont collectées via Umami).
Les sujets d'intérêt typiques sont : injection via les liens de partage ou
les fichiers importés (CSV, profil JSON), faiblesses de la chaîne de build
(workflows GitHub Actions, image Docker) et contournement des protections
de l'image nginx.

# Prévisualisation GitHub Codespaces

Environnement de test visuel privé, indépendant de la production VPS.  
Base SQLite et compte entièrement fictifs, créés uniquement dans le Codespace.

## Prérequis (une fois)

Dans **GitHub → Settings → Secrets and variables → Codespaces** (repository) :

| Secret                     | Rôle                                                                                                                                                    |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CODESPACES_DEMO_PASSWORD` | Mot de passe du compte démo (≥ 12 caractères). Conservez-le aussi dans votre gestionnaire de mots de passe : les secrets GitHub sont en écriture seule. |
| `AUTH_SESSION_SECRET`      | Secret de signature des cookies (≥ 32 caractères). Génération : `npm run auth:secret`.                                                                  |

Ne jamais y mettre les secrets ou la base de production.

Compte démo (email documenté, non secret) :

```text
demo@energy-tracker.local
```

## Démarrer une prévisualisation

Dans le terminal du Codespace :

```bash
npm run codespaces:preview
```

Cette commande :

1. vérifie que l’on est dans GitHub Codespaces ;
2. valide la présence de `CODESPACES_DEMO_PASSWORD` et `AUTH_SESSION_SECRET` **avant** toute écriture en base ;
3. utilise uniquement `data/codespaces-demo.sqlite` ;
4. applique les migrations et un seed idempotent (aucune donnée si déjà présent) ;
5. build puis démarre Fastify sur le port **3000** (SPA + API, une seule URL) ;
6. affiche l’URL HTTPS privée ou l’instruction d’ouvrir le port 3000.

Le démarrage normal **ne supprime jamais** la base.

## Réinitialiser la base de démo

Uniquement dans un Codespace, avec confirmation explicite :

```bash
npm run codespaces:reset -- --confirm
npm run codespaces:preview
```

Sans `--confirm`, ou hors Codespaces, ou si le chemin n’est pas le fichier canonique `data/codespaces-demo.sqlite` (liens symboliques et chemins personnalisés refusés), la commande échoue. Seuls ce fichier et ses éventuels `-wal` / `-shm` sont supprimés.

## Parcours iPhone (Safari)

1. Ouvrir le dépôt ou la PR sur GitHub (Safari).
2. Menu **Code** → onglet **Codespaces** → **Create codespace on \<branche\>** (ou rouvrir un Codespace existant).
3. Attendre la fin de `postCreateCommand` (`npm ci` + outils natifs).
4. Terminal : `npm run codespaces:preview`.
5. Panneau **Ports** → port **3000** (visibilité **private**) → **Open in Browser**.
6. Se connecter avec `demo@energy-tracker.local` et le mot de passe du secret.
7. Tester saisie, historique, graphes.
8. Menu du Codespace → **Stop codespace**.

Sur une réouverture du même Codespace, la base démo et le compte sont conservés : même email, même secret password.

## Réglages cookies (Codespaces)

- Une seule origine HTTPS (port 3000) — pas de Vite séparé.
- `AUTH_COOKIE_SECURE=true`, `TRUST_PROXY=true`, `APP_HOST=0.0.0.0`.
- Cookie `energy_tracker_session` : HttpOnly, SameSite=Lax, Path=/, Secure.
- Port 3000 en **private** uniquement. Aucun port API distinct exposé.

Ces réglages sont appliqués par `codespaces:preview` uniquement ; ils ne modifient pas la production VPS.

## Limites

- L’éditeur Codespaces est peu confortable sur iPhone ; une commande + ouverture du port reste le minimum réaliste.
- Quota Codespaces : arrêter le Codespace après le test.
- Ne pas merger cette doc avec un déploiement VPS ; ne pas copier la base ou les secrets de production.

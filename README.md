# Energy Tracker

Application personnelle mobile-first de suivi de l’énergie, de la fatigue et de l’envie.

Ce n’est pas un outil médical, de diagnostic, de traitement ou de productivité.

## Spécification

La source de vérité du projet est `[docs/spec-energy-tracker.md](docs/spec-energy-tracker.md)`.

## Prérequis

- Node **22** (fichier `.nvmrc`)
- npm (fourni avec Node)

Avec nvm :

```bash
nvm use
```

## Fuseau horaire

Tous les horodatages sont stockés en UTC. L’interface affichera les dates et heures dans le fuseau `Europe/Paris`. Une heure locale ne doit jamais être interprétée comme une heure UTC.

L’API n’accepte un `timestamp` (ainsi que `from` / `to`) que s’il s’agit d’une date ISO 8601 complète **avec fuseau explicite** (`Z` ou offset du type `+02:00`). Exemples valides : `2026-09-06T15:45:00.000Z`, `2026-09-06T17:45:00+02:00`. Une valeur sans fuseau, par exemple `2026-09-06T15:45:00`, est refusée.

## Ports

- Frontend Vite (développement) : [http://localhost:5173](http://localhost:5173)
- API Fastify : [http://127.0.0.1:3000](http://127.0.0.1:3000) (`APP_PORT`, défaut `3000`)

En développement, Vite proxyfie `/api` et `/health` vers Fastify. On peut donc tester :

- [http://localhost:5173/health](http://localhost:5173/health)
- [http://localhost:5173/api/entries](http://localhost:5173/api/entries)

L’accès direct à Fastify sur le port 3000 reste disponible.

## Lancer en local

```bash
nvm use
npm install
cp .env.example .env
```

Générer un hash Argon2id (saisie masquée, le hash s’affiche uniquement sur stdout) :

```bash
npm run auth:hash
```

Si tu préfères éviter toute saisie interactive, tu peux aussi piped depuis `read -s` :

```bash
read -s PASS
printf '%s' "$PASS" | npm run auth:hash
unset PASS
```

Générer `AUTH_SESSION_SECRET` (32 octets aléatoires en hexadécimal) :

```bash
npm run auth:secret
```

Coller les valeurs dans `.env`, ainsi que `AUTH_OWNER_EMAIL` (email du compte propriétaire, jamais hardcodé). En local, garder :

```dotenv
AUTH_COOKIE_SECURE=false
TRUST_PROXY=false
```

Ne jamais coller un vrai secret dans Git, le README ou `.env.example`.

Puis :

```bash
npm run migrate
npm run dev
```

`npm run migrate` a besoin de `AUTH_OWNER_EMAIL` et de `AUTH_PASSWORD_HASH` **uniquement** pour créer le compte propriétaire (migration `003_multi_account`). `npm run dev` lance Vite et Fastify ensemble. Sans `AUTH_SESSION_SECRET` valide, le serveur refuse de démarrer. Après la migration 003, `AUTH_PASSWORD_HASH` n’est plus lu au login.

Vérifier login / logout :

- ouvrir [http://localhost:5173/login](http://localhost:5173/login) ;
- se connecter avec l’email du compte et le mot de passe correspondant au hash utilisé à la migration (ou créé via `create-user`) ;
- `/`, `/history` et `/charts` doivent être accessibles et ne montrer que les entrées de ce compte ;
- `GET /api/entries` sans cookie doit renvoyer `401` ;
- « Se déconnecter » ramène à `/login` ;
- un nouvel appel à `/api/entries` doit encore renvoyer `401`.

Dans les outils du navigateur, le cookie `energy_tracker_session` est `HttpOnly`, `SameSite=Lax`, `Path=/`, et `Secure` est absent en local (`AUTH_COOKIE_SECURE=false`).

Scripts séparés :

```bash
npm run dev:client
npm run dev:server
```

Pages frontend :

- `/login` — connexion (accessible sans session)
- `/` — saisie rapide connectée à `POST /api/entries`
- `/history` — historique réel (`GET /api/entries`, pagination « Charger plus », modification et suppression)
- `/charts` — graphes énergie / fatigue (périodes 7, 30 et 90 jours) et résumé descriptif de la période active

API disponible :

- `GET /health` — public
- `POST /api/auth/login` — public
- `POST /api/auth/logout` — public
- `GET /api/auth/session` — public (répond `401` sans session valide)
- `POST /api/entries` — protégé
- `GET /api/entries?from=&to=&limit=&offset=` — protégé
- `GET /api/entries/:id` — protégé
- `PATCH /api/entries/:id` — protégé
- `DELETE /api/entries/:id` — protégé

`limit` vaut 50 par défaut et 100 au maximum. Une `limit` supérieure à 100 est refusée (`400`). `offset` doit être un entier ≥ 0. `from` et `to` sont inclusifs.

L’identifiant `:id` doit être un UUID v4. Un identifiant mal formé vaut `400`. Une entrée absente **ou appartenant à un autre compte** vaut `404` (`Entrée introuvable.`). Le serveur rattache et filtre toujours par l’utilisateur de session ; un `userId` / `user_id` envoyé par le client est refusé (`400`). Il n’y a pas d’inscription publique.

`POST` refuse les champs inconnus (`userId`, `user_id`, `id`, etc.). `PATCH` n’accepte que `timestamp`, `energy`, `fatigue`, `desire`, `context` et `activity`. Un champ à `null` retire `desire`, `context` ou `activity`. `id`, `created_at` et `updated_at` ne sont pas modifiables. `updated_at` est mis à jour côté serveur uniquement après un PATCH réussi. L’interface d’édition n’envoie jamais `timestamp` : la date et l’heure restent affichées en lecture seule dans `Europe/Paris`.

Les graphes n’utilisent pas de route `/api/stats`. Ils relisent `GET /api/entries` avec `from` / `to`, page par page (`limit=100`), jusqu’à avoir toutes les entrées de la période, une page vide, ou 1 000 entrées. Au-delà, un message indique que la vue ne peut pas charger davantage. Le résumé au-dessus du graphe (moyennes énergie / fatigue / envie) est calculé uniquement côté client à partir de ces entrées déjà chargées. Une absence d’envie n’est jamais comptée comme zéro. Pendant un changement de période, le résumé et le graphe restent masqués jusqu’à ce que les nouvelles données correspondent à la période demandée.

Périodes des graphes (instants UTC inclusifs, fenêtre glissante) :

- `to` = instant actuel ;
- `from` = instant actuel moins 7, 30 ou 90 × 24 heures.

Les dates affichées passent toujours par `Intl.DateTimeFormat` avec `timeZone: 'Europe/Paris'`. Une chaîne ISO sans fuseau n’est jamais traitée comme une heure locale.

La courbe envie n’apparaît que s’il existe au moins deux entrées de la période avec une valeur `desire`. Les points sans envie restent vides : aucune valeur zéro n’est inventée. Chaque saisie est un point horodaté, sans moyenne journalière.

## Base SQLite

Chemin par défaut : `./data/energy-tracker.sqlite` (`DATABASE_PATH`). Le répertoire parent est créé si besoin. La base, ses journaux WAL/SHM et `data/` ne sont pas versionnés. Aucune donnée de démonstration n’est créée automatiquement.

Après un clone ou un changement de machine :

```bash
npm run migrate
```

Les migrations sont versionnées dans `migrations/` (fichiers SQL) et, pour le multi-compte, via l’étape programmatique `003_multi_account`. Une migration déjà appliquée n’est pas rejouée. Aucune migration destructive n’est exécutée automatiquement.

La table `users` stocke email normalisé et `password_hash` Argon2id. `is_owner` marque le compte propriétaire unique ; il n’est jamais exposé par HTTP et ne sert pas à autoriser les entrées. Les sessions sont liées à `user_id`. La migration 003 recrée `sessions` : tout le monde doit se reconnecter. Une session expirée est refusée, supprimée, et le cookie est effacé. Le logout détruit uniquement la session du cookie courant.

Créer un compte supplémentaire (jamais via HTTP) :

```bash
docker compose exec -it energy-tracker npm run create-user
```

En local hors Docker : `npm run create-user` (TTY obligatoire). Email, mot de passe (12 à 1024 caractères) et confirmation. Le mot de passe n’est ni affiché, ni passé en argument, ni stocké en clair.

La limitation des tentatives de connexion (5 échecs / 15 minutes / IP) est en mémoire : elle est réinitialisée au redémarrage du process.

## Lint, tests, formatage et build

```bash
npm run lint
npm run format
npm run test
npm run test:client
npm run test:watch
npm run test:client:watch
npm run build
npm start
```

`npm run test` enchaîne les tests API (`tsx --test`) et les tests frontend (Vitest). `npm run test:client` lance uniquement Vitest.

`npm run build` produit :

- le client dans `dist/client`
- le serveur dans `dist/server`

`npm start` exécute `dist/server/index.js` (API + fichiers statiques de `dist/client`). Il ne dépend pas des sources TypeScript. Faire `npm run migrate` avant si la base n’existe pas encore.

`preview` sert uniquement le build Vite, sans l’API.

## Variables d’environnement

Copier `.env.example` vers `.env`. Ne jamais y mettre de secret réel dans Git.

- `APP_PORT` — port Fastify (défaut `3000`)
- `APP_HOST` — interface d’écoute (défaut `127.0.0.1` en local). En Docker, Compose force `0.0.0.0` pour que Caddy (sur l’hôte) ou `127.0.0.1:3020` puissent joindre le conteneur.
- `DATABASE_PATH` — chemin SQLite (défaut `./data/energy-tracker.sqlite` ; en Docker `/data/energy-tracker.sqlite`)
- `AUTH_SESSION_SECRET` — secret long et aléatoire pour signer le cookie (obligatoire au démarrage, au moins 32 caractères)
- `AUTH_OWNER_EMAIL` — email du compte propriétaire Lucas, **uniquement pour la migration `003_multi_account`**. Jamais hardcodé, jamais committé.
- `AUTH_PASSWORD_HASH` — hash Argon2id du mot de passe actuel de Lucas, **uniquement pour la migration `003_multi_account`** (copie vers `users.password_hash`). Après 003, ce hash n’est plus utilisé au login. Le modifier dans `.env` ne change pas le mot de passe.
- `AUTH_COOKIE_SECURE` — `false` en HTTP local, `true` uniquement en production HTTPS. Contrôle seulement l’attribut `Secure` du cookie. Derrière HTTPS, `true` est obligatoire.
- `AUTH_SESSION_TTL_SECONDS` — durée de session en secondes (défaut `1209600`, soit 14 jours)
- `TRUST_PROXY` — `false` en développement local. Ne pas le lier à `AUTH_COOKIE_SECURE`.
- `NODE_ENV` — `production` dans Compose ; ne pas lancer le serveur en mode développement dans Docker

`TRUST_PROXY=true` uniquement quand Fastify n’est pas exposé publiquement et que seul un reverse proxy de confiance peut joindre l’application. Tant que Fastify écoute directement sur une interface accessible depuis Internet, laisser `TRUST_PROXY=false`.

En production HTTPS derrière reverse proxy : `AUTH_COOKIE_SECURE=true` **et**, séparément, `TRUST_PROXY=true` seulement dans la configuration réseau décrite ci-dessus. Les secrets se collent à la main dans `.env` sur le VPS, jamais dans Git, l’image, Compose ou les logs.

## Docker

`argon2` et `better-sqlite3` sont des modules natifs. L’image se construit sous Linux (Node 22, Debian Bookworm). Ne jamais copier `node_modules` depuis macOS.

`npm start` **n’applique pas** les migrations. Les lancer à la main, un seul process à la fois, **après avoir arrêté** le conteneur s’il tourne déjà.

Le fichier Compose publie `127.0.0.1:3020:3000` (stratégie A) : Fastify écoute **dans** le conteneur sur le port 3000 ; Docker le mappe uniquement sur `127.0.0.1:3020` de l’hôte, pour éviter le conflit avec `mercury-parser` déjà sur le port 3000 du VPS. Caddy, installé sur l’hôte (pas dans Docker), peut joindre Fastify sans exposer le port sur Internet. Ne pas publier `3020` (ni `3000`) sur `0.0.0.0`.

Garde-fous Compose : `init: true`, `no-new-privileges`, `stop_grace_period: 20s`, `pids_limit: 100`, `mem_limit: 512m`. Le système de fichiers du conteneur n’est pas en lecture seule : SQLite (WAL) doit écrire dans `/data`.

### Construction et démarrage local Docker

```bash
cp .env.example .env
# remplir AUTH_OWNER_EMAIL, AUTH_PASSWORD_HASH (pour 003) et AUTH_SESSION_SECRET
# garder AUTH_COOKIE_SECURE=false et TRUST_PROXY=false en HTTP local
docker compose build
docker compose stop energy-tracker
docker compose run --rm --no-deps energy-tracker npm run migrate
docker compose up -d
docker compose ps
docker compose logs -f energy-tracker
curl -i http://127.0.0.1:3020/health
```

### Mise à jour sur le VPS

Ne jamais utiliser `docker compose down -v` : cette commande supprimerait le volume nommé `energy_tracker_data` et donc la base SQLite.

`docker compose run` hérite du volume `energy_tracker_data:/data` et de `DATABASE_PATH=/data/energy-tracker.sqlite`. Il n’expose pas `127.0.0.1:3020` (pas de flag `--no-ports` : il n’existe pas en Compose v2).

Avant d’appliquer `003_multi_account` en production : ajouter `AUTH_OWNER_EMAIL` dans `.env` (chmod 600), conserver `AUTH_PASSWORD_HASH` le temps de la migration, puis sauvegarder.

```bash
sh scripts/docker-backup.sh
git pull --ff-only
docker compose build
docker compose stop energy-tracker
docker compose run --rm --no-deps energy-tracker npm run migrate
docker compose up -d
docker compose ps
docker compose logs --tail=100 energy-tracker
docker compose exec -it energy-tracker npm run create-user
```

### Validation après déploiement

- `curl -i http://127.0.0.1:3020/health` et healthcheck Compose (`docker compose ps`)
- accès HTTPS via le reverse proxy (hors de ce dépôt)
- page `/login` (email + mot de passe)
- connexion du compte propriétaire : l’historique existant est toujours là
- un second compte ne voit pas ces entrées
- `docker compose restart energy-tracker` (sans `-v`) puis vérification que l’entrée existe encore
- déconnexion et refus de l’API sans session (`401`)

### Reverse proxy (prérequis uniquement)

Ce projet ne configure pas le reverse proxy, le domaine, le DNS ni TLS.

- HTTPS est obligatoire en production.
- Le proxy doit transmettre le trafic à Fastify. Pour Caddy sur l’hôte : `reverse_proxy 127.0.0.1:3020`.
- Le port Fastify ne doit pas être exposé publiquement.
- Si `TRUST_PROXY=true`, le proxy doit être le **seul** chemin d’accès à Fastify.
- Le proxy doit transmettre les en-têtes habituels (`Host`, `X-Forwarded-For`, `X-Forwarded-Proto`).
- Les cookies de session doivent être `Secure` (`AUTH_COOKIE_SECURE=true`) grâce à HTTPS.

Pour rattacher plus tard le conteneur à un réseau Docker de reverse proxy (stratégie B) : retirer `ports`, ajouter un réseau externe dont **vous** connaissez le nom, par exemple :

```yaml
networks:
  proxy:
    external: true
    name: ${PROXY_NETWORK}
```

Ne pas inventer ce nom. Laisser la stratégie A tant que le proxy écoute sur l’hôte.

### Sauvegarde et restauration SQLite

La base utilise le mode WAL. Ne jamais copier le fichier `.sqlite` pendant que l’application écrit. Les scripts arrêtent le conteneur, puis `better-sqlite3` produit **un seul** fichier cohérent :

`backups/energy-tracker-YYYYMMDD-HHMMSS.sqlite`

Pas de cron dans le MVP. Emplacement sur le VPS : `./backups/` à la racine du clone (non versionné).

Sauvegarde :

```bash
sh scripts/docker-backup.sh
```

Restauration (fichier daté existant) :

```bash
sh scripts/docker-restore.sh backups/energy-tracker-YYYYMMDD-HHMMSS.sqlite
```

Procédure de restauration :

1. arrêter l’application (le script le fait) ;
2. sauvegarder l’état actuel dans `backups/energy-tracker-before-restore-*.sqlite` ;
3. remplacer la base à partir du fichier choisi ;
4. le process non-root réécrit `/data` (permissions `node`) ;
5. redémarrer ;
6. vérifier `/health` puis la page de login.

Ne jamais utiliser `docker compose down -v`. Un rollback de la migration 003 exige **à la fois** `scripts/docker-restore.sh` vers la sauvegarde pré-003 **et** le redéploiement de l’image/commit d’avant le multi-compte.

## Note pour les sliders

Les curseurs d’énergie, de fatigue et d’envie sont de vrais `input type="range"` :

- glissement du pouce ;
- tap ou clic n’importe où sur la piste (valeur entière la plus proche) ;
- clavier (flèches, Home, End) ;
- affichage `6 / 10`, ou `— / 10` tant qu’aucune valeur n’est choisie ;
- grandes zones tactiles adaptées à l’iPhone.

L’envie reste facultative : **Ajouter l’envie** révèle le curseur, **Retirer** l’efface. Aucune valeur n’est envoyée tant qu’elle n’a pas été choisie.

## État actuel

Jalon Multi-compte V1 : comptes isolés (email + mot de passe), migration 003 vers un propriétaire, CLI `create-user`, pas d’inscription publique. PWA et notifications restent hors périmètre.

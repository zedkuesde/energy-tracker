# Energy Tracker

Application personnelle mobile-first de suivi de l’énergie, de la fatigue et de l’envie.

Ce n’est pas un outil médical, de diagnostic, de traitement ou de productivité.

## Spécification

La source de vérité du projet est [`docs/spec-energy-tracker.md`](docs/spec-energy-tracker.md).

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
npm run migrate
npm run dev
```

`npm run dev` lance Vite et Fastify ensemble.

Scripts séparés :

```bash
npm run dev:client
npm run dev:server
```

Pages frontend (squelette, formulaire non branché) :

- `/` — saisie (squelette)
- `/history` — historique (placeholder)
- `/charts` — graphes (placeholder)

API disponible dès le Jalon 2 :

- `GET /health`
- `POST /api/entries`
- `GET /api/entries?from=&to=&limit=&offset=`

`limit` vaut 50 par défaut et 100 au maximum. Une `limit` supérieure à 100 est refusée (`400`). `offset` doit être un entier ≥ 0. `from` et `to` sont inclusifs.

## Base SQLite

Chemin par défaut : `./data/energy-tracker.sqlite` (`DATABASE_PATH`). Le répertoire parent est créé si besoin. La base, ses journaux WAL/SHM et `data/` ne sont pas versionnés. Aucune donnée de démonstration n’est créée automatiquement.

Après un clone ou un changement de machine :

```bash
npm run migrate
```

Les migrations sont versionnées dans `migrations/`. Une migration déjà appliquée n’est pas rejouée. Aucune migration destructive n’est exécutée automatiquement.

## Lint, tests, formatage et build

```bash
npm run lint
npm run format
npm run test
npm run test:watch
npm run build
npm start
```

`npm run build` produit :

- le client dans `dist/client`
- le serveur dans `dist/server`

`npm start` exécute `dist/server/index.js` (API + fichiers statiques de `dist/client`). Il ne dépend pas des sources TypeScript. Faire `npm run migrate` avant si la base n’existe pas encore.

`preview` sert uniquement le build Vite, sans l’API.

## Variables d’environnement

Copier `.env.example` vers `.env` si besoin. Ne jamais y mettre de secret réel dans Git.

- `APP_PORT` — port Fastify (défaut `3000`)
- `DATABASE_PATH` — chemin SQLite (défaut `./data/energy-tracker.sqlite`)

Les variables d’authentification sont réservées au Jalon 5.

## Note pour le Jalon 3 (sliders)

Ne pas changer le formulaire visuel tant que le Jalon 3 n’est pas ouvert. Les sliders devront alors :

- être manipulables par glissement ;
- déplacer leur valeur vers l’endroit attendu lorsqu’on appuie ou clique directement sur la piste ;
- rester utilisables au clavier ;
- afficher clairement la valeur sélectionnée ;
- offrir de grandes zones tactiles adaptées à l’iPhone.

## État actuel

Jalon 2 : API Fastify, SQLite locale, migrations et tests. Le frontend du Jalon 1 n’enregistre pas encore d’entrée. Pas d’authentification, Docker, PWA, historique réel ni graphes.

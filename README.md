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

Tous les horodatages seront stockés en UTC. L’interface affichera les dates et heures dans le fuseau `Europe/Paris`. Une heure locale ne doit jamais être interprétée comme une heure UTC.

## Lancer en local (Jalon 1)

```bash
nvm use
npm install
npm run dev
```

Ouvre ensuite [http://localhost:5173](http://localhost:5173).

Pages disponibles :

- `/` — saisie (squelette)
- `/history` — historique (placeholder)
- `/charts` — graphes (placeholder)

## Lint, formatage et build

```bash
npm run lint
npm run format
npm run build
npm run preview
```

`preview` sert le build de production en local.

## Variables d’environnement

Copier `.env.example` vers `.env` si besoin. Ne jamais y mettre de secret réel dans Git. Ces variables serviront surtout à partir du Jalon 2 (base SQLite) et du Jalon 5 (authentification). Au Jalon 1, Vite n’en a pas besoin.

## État actuel

Jalon 1 : squelette Vite / React / TypeScript, navigation et pages placeholder. Pas encore de base SQLite, d’API, d’authentification ni de formulaire de saisie.

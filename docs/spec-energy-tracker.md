# Prompt Cursor — Energy Tracker

Tu es un développeur senior chargé de construire une petite application personnelle de suivi d’énergie, de fatigue et d’envie pour Lucas, utilisateur adulte avec TDAH.

## Mission et limites

Créer une web app mobile-first, simple, calme et agréable, qui permette à Lucas d’enregistrer rapidement son état du moment et de visualiser son évolution dans le temps.

Le but est d’externaliser quelques observations utiles sans créer une nouvelle obligation quotidienne.

Ce projet n’est pas :

- une plateforme de productivité ;
- un outil médical ;
- un outil de diagnostic ;
- un outil de traitement ;
- une application de recommandations, de prédictions ou de corrélations.

Ne pas ajouter de fonctionnalités non demandées au MVP.

## Indicateurs du MVP

Chaque entrée contient :

- `timestamp` : date et heure de l’observation, stockées en UTC ;
- `energy` : obligatoire, entier de 0 à 10 ; énergie ou capacité disponible pour agir maintenant ;
- `fatigue` : obligatoire, entier de 0 à 10 ; fatigue ou coût ressenti maintenant ;
- `desire` : facultatif, entier de 0 à 10 ; envie de faire quelque chose ;
- `context` : facultatif, texte libre court de 280 caractères maximum ;
- `activity` : facultatif, valeur de l’énumération `rest`, `work`, `transport`, `leisure`, `creative`, `sport`, `other`.

Énergie et fatigue sont deux axes indépendants. Ne jamais calculer automatiquement `fatigue = 10 - energy`.

Dans l’interface, afficher les libellés français suivants pour `activity` :

- Repos ;
- Travail ;
- Transport ;
- Loisir ;
- Activité créative ;
- Sport ;
- Autre.

Un champ texte vide doit être converti en `null`. Normaliser les espaces superflus dans `context`.

Ne pas ajouter au MVP :

- motivation ;
- humeur détaillée ;
- traitement ;
- sommeil automatique ;
- symptômes médicaux ;
- corrélations ;
- recommandations intelligentes ;
- IA ;
- gamification ;
- notifications ;
- rappels ;
- intégration Apple Santé ;
- synchronisation avec des services externes.

## Principes UX

- Une saisie complète doit prendre moins de 10 secondes.
- L’interface doit être conçue d’abord pour un iPhone et l’usage au pouce.
- Afficher immédiatement les trois valeurs principales avec des contrôles tactiles lisibles.
- Les contrôles doivent montrer clairement la valeur sélectionnée de 0 à 10.
- Utiliser des labels textuels visibles, pas seulement la couleur ou une icône.
- Énergie et fatigue sont obligatoires.
- Envie, contexte et activité restent facultatifs.
- Le contexte et l’activité ne doivent jamais bloquer l’enregistrement.
- Le bouton « Enregistrer » doit être très visible et accessible sans défilement excessif.
- Après sauvegarde, afficher une confirmation courte et calme, sans score, série, récompense ou pression à recommencer.
- Ne jamais imposer une saisie lorsque l’utilisateur consulte l’historique ou les graphes.
- Ne pas afficher de grands tableaux par défaut.
- Gérer les valeurs facultatives et les jeux de données vides sans erreur.
- Prévoir un contraste suffisant, de grandes cibles tactiles et un fonctionnement clavier correct.
- L’application doit fonctionner correctement sans notification dans le MVP.
- Ne pas utiliser de vocabulaire médical ou culpabilisant.

## Stack et choix techniques

Avant toute création de fichiers, inspecter le dépôt existant et réutiliser ce qui est déjà présent lorsque cela reste cohérent.

Si le dépôt est vide, utiliser par défaut :

- frontend : React + TypeScript + Vite ;
- backend : Node.js + TypeScript avec une API REST légère ;
- base de données : SQLite ;
- styles : CSS simple ou Tailwind seulement s’il est déjà configuré ;
- graphiques : bibliothèque légère et maintenue, par exemple Recharts ;
- tests : tests unitaires et d’intégration adaptés à la stack choisie.

Ne pas ajouter de dépendance lourde sans justification explicite.

Le code doit être simple, typé, lisible et facile à maintenir par une seule personne.

Avant toute implémentation, expliquer brièvement :

1. la stack retenue ;
2. le gestionnaire de paquets choisi ;
3. la solution retenue pour SQLite et les migrations ;
4. la solution d’authentification ;
5. l’arborescence ;
6. le plan d’implémentation du Jalon 1.

## Modèle de données

Créer une migration initiale dès le départ.

Table `energy_entries` :

- `id` : identifiant unique ;
- `timestamp` : date et heure ISO en UTC ;
- `energy` : entier obligatoire de 0 à 10 ;
- `fatigue` : entier obligatoire de 0 à 10 ;
- `desire` : entier nullable de 0 à 10 ;
- `context` : texte nullable, maximum 280 caractères ;
- `activity` : texte nullable, limité aux valeurs de l’énumération définie ;
- `created_at` : date et heure UTC ;
- `updated_at` : date et heure UTC.

Validation côté serveur obligatoire :

- `energy` et `fatigue` sont obligatoires et compris entre 0 et 10 ;
- `desire`, s’il est présent, est compris entre 0 et 10 ;
- `timestamp`, s’il est fourni, est valide ;
- `context` ne dépasse pas 280 caractères ;
- `activity`, si elle est présente, appartient à l’énumération autorisée ;
- les chaînes de caractères vides sont converties en `null` ;
- les espaces superflus de `context` sont normalisés ;
- les requêtes trop volumineuses sont refusées ;
- les erreurs de validation retournent un JSON compréhensible.

## Fuseau horaire

- Stocker tous les timestamps en UTC.
- Lorsque le client ne fournit pas de `timestamp`, le serveur utilise l’instant courant en UTC.
- Afficher les dates et heures dans le fuseau `Europe/Paris`.
- Ne jamais interpréter une heure locale comme une heure UTC.
- Tester le comportement lors des changements CET/CEST.
- Documenter explicitement cette règle dans le README.

## Écrans du MVP

### Saisie rapide

Route : `/` ou `/log`.

Contenu :

- titre : « Comment tu te sens maintenant ? » ;
- contrôle énergie de 0 à 10 ;
- contrôle fatigue de 0 à 10 ;
- contrôle envie facultatif ;
- champ contexte facultatif ;
- choix activité facultatif ;
- bouton « Enregistrer » très visible.

Après sauvegarde :

- afficher une confirmation courte ;
- remettre le formulaire dans un état clairement prêt pour une nouvelle saisie ;
- ne pas perdre une saisie utilisateur sans message en cas d’erreur réseau ;
- désactiver le bouton pendant la requête afin d’éviter un double enregistrement ;
- réactiver le bouton en cas d’erreur.

### Historique

Route : `/history`.

- liste chronologique inversée ;
- date et heure formatées dans `Europe/Paris` ;
- valeurs immédiatement lisibles ;
- contexte et activité affichés seulement s’ils existent ;
- pagination ou chargement progressif ;
- état vide clair ;
- possibilité d’éditer une entrée ;
- possibilité de supprimer une entrée ;
- demander une confirmation explicite dans l’interface avant suppression ;
- ne pas afficher les données sous forme de tableau dense.

### Graphes

Route : `/charts`.

- courbes énergie et fatigue ;
- courbe envie seulement lorsqu’il existe suffisamment de données pertinentes ;
- filtres 7 jours, 30 jours et 90 jours ;
- tooltip avec date, heure et valeurs ;
- légende claire ;
- gestion correcte de zéro donnée, une donnée et plusieurs jours de données ;
- ne pas afficher de corrélation, de causalité ou d’interprétation automatique ;
- ne pas ajouter de moyenne mobile sans validation explicite ultérieure ;
- ne pas déduire de conseils ou recommandations à partir des données.

## API REST

Toutes les réponses utilisent du JSON cohérent, des codes HTTP corrects et des messages d’erreur compréhensibles.

Toutes les routes `/api/*` doivent être protégées selon la solution d’authentification retenue.

### `POST /api/entries`

Créer une entrée.

- Retourner `201 Created` avec l’entrée créée.
- Générer le timestamp côté serveur s’il est absent.
- Normaliser et valider toutes les données côté serveur.
- Retourner une erreur `400` claire en cas de données invalides.

### `GET /api/entries?from=&to=&limit=&offset=`

Lister les entrées.

- Trier par `timestamp` décroissant, puis par `id`.
- Utiliser `limit=50` par défaut et `limit=100` maximum.
- Accepter uniquement un `offset` entier positif ou nul.
- Valider `from` et `to` lorsqu’ils sont fournis.
- Retourner une structure de type :

```json
{
  "data": [],
  "pagination": {
    "limit": 50,
    "offset": 0,
    "total": 0
  }
}
```

### `GET /api/entries/:id`

Récupérer une entrée.

- Retourner `404 Not Found` si elle n’existe pas.

### `PATCH /api/entries/:id`

Corriger une entrée existante.

- Autoriser uniquement les champs modifiables prévus.
- Valider les données avec les mêmes règles que lors de la création.
- Mettre à jour `updated_at`.
- Retourner `404 Not Found` si elle n’existe pas.

### `DELETE /api/entries/:id`

Supprimer une entrée.

- La confirmation est gérée dans l’interface avant l’appel API.
- Retourner `204 No Content` si la suppression réussit.
- Retourner `404 Not Found` si elle n’existe pas.

Pour les graphes, commencer par utiliser les entrées renvoyées par `GET /api/entries` avec des bornes `from` et `to`.

Ne créer `GET /api/stats?range=7d|30d|90d` que si un calcul côté serveur devient réellement nécessaire. Si cette route est créée, documenter précisément son contrat de réponse et conserver une seule source de vérité.

## Authentification et sécurité

L’application est personnelle, mais accessible depuis l’extérieur.

- Mettre en place une protection d’accès dès le MVP.
- Ne jamais protéger uniquement l’interface frontend.
- Toutes les routes `/api/*`, y compris les routes de lecture, modification et suppression, doivent être protégées côté serveur ou par un reverse proxy qui protège aussi l’API.
- Ne jamais coder de secret en dur.
- Lire les secrets depuis des variables d’environnement.
- Ne jamais écrire de secret dans les logs.
- Limiter la taille des requêtes.
- Valider toutes les entrées côté serveur.
- Ne pas exposer la base SQLite, un explorateur de fichiers ou un outil d’administration publiquement.
- Documenter le déploiement derrière HTTPS et reverse proxy.
- Expliquer brièvement le mécanisme d’authentification retenu avant de l’implémenter.
- Privilégier une solution simple, explicite et maintenable.

## Contraintes SQLite

- Utiliser une base SQLite persistante.
- Créer une migration initiale.
- Ne jamais inclure la base de production dans l’image Docker.
- Activer le mode WAL si la bibliothèque choisie le permet.
- Configurer un délai d’attente raisonnable en cas de verrouillage.
- Créer le répertoire de données au démarrage si nécessaire.
- Ne jamais exécuter automatiquement une migration destructive en production.
- Tester le démarrage avec une base vide et avec une base existante.
- Prévoir une stratégie documentée de sauvegarde et de restauration.
- Ne jamais versionner la base SQLite, ses fichiers journaux ou ses sauvegardes dans Git.

## Déploiement Docker et VPS

Le projet doit être déployable de manière reproductible sur un VPS utilisant Docker.

Architecture cible :

```text
iPhone Safari / PWA installée
        ↓ HTTPS
reverse proxy du VPS
        ↓
conteneur Docker Energy Tracker
        ↓
volume Docker persistant SQLite
```

Contraintes de déploiement :

- Fournir un `Dockerfile` de production multi-stage.
- Fournir un `compose.yaml` ou `docker-compose.yml` de production.
- Monter un volume Docker persistant dédié à SQLite.
- Rendre le chemin de la base configurable avec `DATABASE_PATH`.
- Exposer uniquement le port applicatif indispensable au reverse proxy.
- Ne pas exposer directement l’application, SQLite ou un outil d’administration sur Internet.
- Prévoir une route de santé non sensible, par exemple `/health`.
- La route `/health` ne doit retourner aucune donnée personnelle, aucun secret et aucun détail de la base.
- Utiliser un fichier `.env` non versionné.
- Fournir un `.env.example` sans secret réel.
- Ajouter à `.gitignore` :
  - `.env` ;
  - fichiers SQLite ;
  - fichiers SQLite `-wal` et `-shm` ;
  - répertoires de sauvegardes ;
  - dépendances ;
  - artefacts de build ;
  - fichiers spécifiques à macOS si nécessaire.
- Documenter :
  - lancement local ;
  - tests ;
  - build ;
  - démarrage Docker ;
  - consultation des logs ;
  - mise à jour depuis Git ;
  - arrêt et redémarrage ;
  - sauvegarde SQLite ;
  - restauration SQLite ;
  - variables d’environnement ;
  - prérequis du reverse proxy HTTPS.
- Ne jamais placer de certificat TLS, mot de passe, token ou clé privée dans Git.

## Installation écran d’accueil iOS

L’application doit pouvoir être ajoutée manuellement à l’écran d’accueil d’un iPhone dès le MVP.

Implémenter une PWA minimale, sans notifications et sans promesse de fonctionnement hors connexion :

- fournir un manifeste web valide ;
- définir un nom, un nom court, `start_url`, `display: standalone`, des couleurs de thème et d’arrière-plan ;
- fournir des icônes adaptées, dont une icône compatible avec l’écran d’accueil iOS ;
- ajouter les balises HTML et meta-tags nécessaires à une intégration iOS propre ;
- vérifier que l’application s’ouvre correctement depuis l’icône de l’écran d’accueil ;
- documenter dans le README les étapes d’installation sur iPhone :
  Safari → Partager → Sur l’écran d’accueil → activer « Ouvrir comme app web » si l’option est affichée ;
- ne pas implémenter de notification push ;
- ne pas demander de permission de notification ;
- ne pas annoncer de fonctionnement hors connexion tant qu’il n’a pas été réellement testé ;
- ne pas rendre l’installation obligatoire pour utiliser l’application ;
- l’application doit rester pleinement utilisable dans Safari sans installation.

Le test réel de l’installation iOS doit être effectué après déploiement HTTPS sur le VPS, depuis un véritable iPhone.

## Fonctions hors MVP

Ne pas implémenter les notifications, Telegram, PWA avancée, mode offline, Apple Santé, import de sommeil, IA, recommandations, corrélations ou synchronisation externe dans les premières étapes.

Prévoir uniquement, sans les implémenter, une possibilité d’extension future :

```text
notification_preferences
- enabled
- channel
- schedule
- quiet_hours
```

Phase ultérieure possible, seulement si l’usage réel le justifie :

- service worker plus complet ;
- cache offline ;
- PWA avancée ;
- Web Push ;
- Push API et VAPID ;
- permission de notification ;
- serveur de souscription ;
- test réel sur iPhone lorsque l’application est fermée ;
- notifications désactivables ;
- heures silencieuses ;
- import manuel d’une durée ou qualité de sommeil ;
- étude séparée des solutions compatibles avec Apple Santé.

Ne jamais présenter les notifications PWA sur iPhone comme garanties avant un test réel.

Ne pas supposer qu’une web app peut lire directement les données Apple Santé.

## Jalons

### Jalon 0 — Inspection et proposition

Avant de coder :

1. Inspecter le dépôt et ses fichiers existants.
2. Lire le README, la spécification et les scripts disponibles.
3. Identifier la stack déjà présente.
4. Vérifier les versions de Node, du gestionnaire de paquets et de SQLite.
5. Proposer brièvement la stack retenue, l’arborescence et les choix importants.
6. Proposer la solution d’authentification MVP avant de l’implémenter.
7. Proposer le plan précis du Jalon 1.
8. Ne pas créer beaucoup de fichiers avant cette proposition.
9. Attendre une validation explicite avant de commencer le Jalon 1.

### Jalon 1 — Squelette local

- initialiser ou compléter le projet ;
- démarrer localement ;
- afficher une page mobile-first ;
- ajouter lint et formatage s’ils sont absents ;
- documenter les commandes de lancement ;
- vérifier que le build de production fonctionne ;
- ne pas commencer la persistance SQLite ni l’authentification complète sans validation du jalon.

### Jalon 2 — Base de données et API

- créer la migration SQLite ;
- configurer la persistance locale ;
- implémenter `POST /api/entries` ;
- implémenter `GET /api/entries` ;
- ajouter la validation serveur ;
- ajouter les tests de création et de lecture ;
- vérifier le stockage UTC ;
- ne pas commencer l’historique ou les graphes sans validation du jalon.

### Jalon 3 — Saisie rapide

- construire le formulaire ;
- permettre l’enregistrement en moins de 10 secondes ;
- gérer validation et erreurs réseau ;
- empêcher les doubles soumissions ;
- tester le rendu mobile ;
- ne pas enregistrer de données fictives persistantes dans la base réelle ;
- ne pas commencer les graphes sans validation du jalon.

### Jalon 4 — Historique et graphes

- afficher l’historique ;
- ajouter édition et suppression avec confirmation ;
- afficher les graphes énergie et fatigue ;
- ajouter les plages 7, 30 et 90 jours ;
- gérer les absences de données ;
- vérifier l’affichage dans `Europe/Paris` ;
- ne pas ajouter d’interprétation des données.

### Jalon 5 — Sécurité, Docker, VPS et installation iOS

- ajouter la protection d’accès retenue ;
- vérifier que l’API est protégée et non seulement le frontend ;
- documenter les variables d’environnement ;
- préparer Docker et Docker Compose ;
- configurer la persistance SQLite par volume Docker ;
- documenter sauvegarde et restauration ;
- ajouter le manifeste et les icônes nécessaires à l’installation sur écran d’accueil iOS ;
- vérifier l’affichage en mode standalone ;
- déployer uniquement après validation locale ;
- tester l’installation réelle depuis Safari sur l’iPhone, une fois l’application disponible en HTTPS sur le VPS.

### Jalon 6 — Usage réel

Pendant deux à trois semaines :

- ne pas ajouter de fonctionnalité intelligente ;
- observer si les entrées sont réellement utilisées ;
- noter les champs inutiles ou pénibles ;
- vérifier l’utilité réelle des graphes ;
- vérifier si l’installation iOS est utile au quotidien ;
- décider ensuite si les notifications sont réellement nécessaires.

### Jalon 7 — Évolutions éventuelles

Seulement si l’usage réel le justifie :

- PWA avancée ;
- manifest enrichi ;
- service worker ;
- cache offline ;
- Web Push ;
- serveur de souscription ;
- test iPhone lorsque l’application est fermée ;
- notifications désactivables ;
- heures silencieuses ;
- import manuel de sommeil.

## Tests indispensables

- création valide ;
- énergie hors de 0 à 10 refusée ;
- fatigue hors de 0 à 10 refusée ;
- envie hors de 0 à 10 refusée ;
- envie absente acceptée ;
- contexte absent accepté ;
- activité absente acceptée ;
- activité invalide refusée ;
- texte de contexte supérieur à 280 caractères refusé ;
- chaînes vides converties en `null` ;
- espaces superflus normalisés dans le contexte ;
- timestamp UTC affiché correctement dans `Europe/Paris` ;
- changement CET/CEST ;
- pagination ;
- historique vide ;
- graphe sans donnée ;
- graphe avec une seule donnée ;
- graphe avec plusieurs jours ;
- affichage mobile ;
- fonctionnement clavier ;
- perte réseau pendant la saisie ;
- prévention du double enregistrement ;
- accès non authentifié refusé ;
- build de production ;
- démarrage Docker avec volume SQLite persistant ;
- conservation des données après redémarrage ou reconstruction du conteneur ;
- route `/health` sans donnée sensible ;
- manifeste web valide ;
- icônes présentes et accessibles ;
- application installable manuellement depuis Safari sur iPhone ;
- ouverture correcte depuis l’icône en mode standalone ;
- application disponible en HTTPS en production ;
- aucune notification ni permission de notification demandée dans le MVP.

## Règles de travail

- Ne pas construire de fonctionnalité non demandée.
- Ne pas ajouter de traitement, sommeil automatique, IA, recommandations, corrélations, rappels ou notifications au MVP.
- Ne pas transformer ce suivi en outil médical.
- Ne pas utiliser de données fictives persistantes dans la base réelle.
- Ajouter les tests au fur et à mesure.
- Faire des commits petits, atomiques et compréhensibles.
- Ne jamais modifier ou supprimer les données existantes sans nécessité et sans l’indiquer clairement.
- Ne jamais ajouter de vrai secret dans Git, le code, le README ou les exemples de configuration.
- À chaque jalon, résumer :
  - ce qui fonctionne ;
  - ce qui reste à faire ;
  - les fichiers importants modifiés ;
  - les commandes exactes pour tester ;
  - les éventuelles décisions ou questions bloquantes.
- Ne pas passer au jalon suivant tant que les critères du jalon en cours ne sont pas vérifiés.
- Si une décision technique importante n’est pas couverte par cette spécification, l’expliquer et demander une validation avant de l’implémenter.

## Résultat attendu du MVP local

À la fin du Jalon 4, on doit pouvoir :

1. ouvrir l’application sur iPhone ou dans une simulation mobile ;
2. saisir énergie et fatigue en quelques secondes ;
3. enregistrer l’entrée dans SQLite ;
4. voir l’entrée dans l’historique ;
5. corriger ou supprimer une entrée ;
6. voir les graphes sur 7 jours ;
7. comprendre comment lancer et tester le projet localement.

## Résultat attendu du MVP déployé

À la fin du Jalon 5, on doit aussi pouvoir :

1. déployer l’application avec Docker sur un VPS ;
2. conserver les données SQLite après une reconstruction du conteneur ;
3. protéger l’accès à l’application et à son API ;
4. accéder à l’application uniquement derrière HTTPS ;
5. sauvegarder et restaurer la base ;
6. ouvrir l’application sur iPhone via Safari ;
7. ajouter manuellement l’application à l’écran d’accueil iOS ;
8. ouvrir l’application depuis son icône en mode standalone ;
9. utiliser l’application sans notification, sans rappel et sans promesse de fonctionnement hors connexion.

## Première instruction

Commence uniquement par le Jalon 0.

Inspecte le dépôt et lis `README.md` ainsi que cette spécification. Ensuite, présente brièvement :

1. la stack retenue ;
2. l’arborescence proposée ;
3. le choix SQLite et le chemin de données ;
4. le choix d’authentification MVP ;
5. le plan exact du Jalon 1 ;
6. les commandes prévues pour lancer, tester et builder le projet.

N’écris, ne crées et ne modifies aucun fichier avant une validation explicite.
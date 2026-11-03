# Tests de fiabilité WebOS v32

La suite couvre l’interface et l’intégration des fournisseurs avec des réponses HTTP simulées. Elle ne prouve pas qu’un compte réel a accès aux modèles, ni qu’un réseau scolaire autorise les jeux.

## Exécution

Prérequis : Node.js, Playwright avec Chromium et un serveur HTTP statique.

```sh
npm install --no-save playwright serve
npx playwright install chromium
npx serve . -l 3000 --no-clipboard
```

Dans un autre terminal :

```sh
node tests/reliability.mjs
node tests/v30.mjs
node tests/v31.mjs
node tests/v32.mjs
```

Pour une autre URL :

```sh
WEBOS_TEST_URL=https://votre-apercu/ node tests/reliability.mjs
```

La suite n’utilise que des clés fictives, intercepte les requêtes IA et le proxy, et ne transmet aucune clé réelle. Les captures de QA sont enregistrées dans le workspace du banc de test.

## Couverture

- Navigation IA visible, validation des adresses et absence de fausse coche verte en cas d’erreur.
- Arrêt d’une requête en cours, réactivation du contrôle et bascule indépendante du mode Boost.
- Synchronisation des fournisseurs/modèles entre le widget et l’app.
- Formats de requêtes Groq, Gemini et OpenRouter ; aucune substitution silencieuse du modèle.
- Actualisation du catalogue, exclusion des modèles audio/classification, tests séquentiels et retrait d’un modèle définitivement absent.
- Conservation des modèles après erreur temporaire de quota ; résultats explicites.
- Exclusion des clés API de l’observation DOM, même lorsque leur champ est révélé.
- Nouvel onglet local, recherche via le proxy intégré avec accès à l’onglet officiel, historique, ajout et fermeture d’onglets.
- Fin des tentatives proxy après trois essais ; absence de redirection tardive après retour à l’accueil.
- Ouverture des apps principales sans nouvelle exception JavaScript.
- Widget à 1440 × 900, 375 × 812 et 1280 × 480.

## Régressions v30

Exécuter `node tests/v30.mjs` pour les raccourcis bureau/barre des tâches, le mode officiel pour les comptes, les préférences existantes, la restauration différée des onglets, les six jeux locaux, les hubs, les sept habillages, la sauvegarde sans clés et le mobile 375 px. Les réponses du proxy sont simulées pour ce scénario, comme dans le test de fiabilité. Aucun compte utilisateur réel n’est connecté par les tests.

Le test couvre aussi un navigateur dans lequel `localStorage` est refusé : les réglages fonctionnent en mémoire et l’interface indique que leur persistance n’est pas disponible.

## Vérification réelle des modèles

Dans l’app Assistant IA, sélectionner le fournisseur, enregistrer sa propre clé puis cliquer sur « Tester les modèles (quota) ». Ce bouton consomme le quota du compte. Il ne déclenche aucune des actions générées pendant le test.

Les listes initiales sont des modèles documentés, pas une garantie d’accès. Le diagnostic utilise le catalogue du fournisseur et garde les résultats du catalogue pendant sept jours sur cet appareil. Un refus d’authentification ou de quota arrête les tests restants sans supprimer leurs modèles. Les options de vision dépendent du modèle et ne sont pas validées par le test de conversation JSON.

## Régressions v32

La suite `v32.mjs` couvre 25 cycles réduction/restauration sans déplacement, quatre cycles maximisation/restauration, les catégories avec recherche, les contrôles de stockage ajoutés tardivement, le code de curseur RW Designer fourni (base64, points et animation), le rejet des URL dangereuses et l’absence d’exécution de HTML.

Les autres scénarios vérifient l’IA sans clé et son délai partagé de 45 secondes, l’absence d’en-tête Authorization pour ce fournisseur, la recherche suivie de la sélection du premier résultat, la sélection d’une vidéo après chargement asynchrone, l’annulation pendant l’attente, le retrait des modèles définitivement absents et l’exclusion persistante des modèles « conversation seulement » du pilotage. Les API et le contenu distant sont simulés dans cette suite, pas la logique de l’interface. La lecture distante réelle d’une vidéo et les jeux tiers ne sont pas attestés par ces fixtures.

Le bouton « Tester tous mes fournisseurs » utilise seulement les clés enregistrées sur l’appareil courant et signale les fournisseurs non testés faute de clé. Une erreur de budget, d’accès, de réseau ou de quota n’est pas une preuve qu’un modèle a disparu. Les diagnostics n’exécutent jamais les actions produites par les modèles.

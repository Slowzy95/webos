# Tests de fiabilité WebOS v34

## Régressions v44 : jeux et Discord

`node tests/v44.mjs` utilise le serveur parent sur le port 3000. La suite
vérifie les URL canoniques avec ou sans slash final, l'absence de relance
après 22 secondes, la progression d'une application lente, les messages
associés à une requête et un arrêt borné qui conserve le cadre.

Le module réellement utilisé par UV et Scramjet est testé avec un document
initial `about:blank`, un conteneur SPA vide, l'apparition d'un formulaire et
un sous-cadre publicitaire en erreur. Le proxy dispose aussi d'un modèle
de recherche par défaut lorsqu'une saisie n'est pas une URL.

Test distant distinct effectué dans le WebOS intégré avec UV/Epoxy et le
Wisp existant : le formulaire de connexion Discord apparaît sans identifiant
saisi, et le hub Bloxd.io affiche ses cartes et images sans changer de serveur.
Une connexion authentifiée et une partie complète restent non validées.
Une nouvelle tentative Discord a également rencontré une réponse distante
HTTP 429 et un démarrage lent. Le formulaire observé une fois ne garantit
donc ni la disponibilité de Discord, ni l'absence de limitation distante.

Le vieux script `lstimer.js` a été retiré du proxy : il remplaçait les
minuteurs de 1 et 5 secondes par de faux identifiants et supprimait d'autres
minuteurs sans distinguer leur usage. Le suivi réel de 1 seconde et la
visibilité des boutons sont couverts par la suite v44.
VanJS 1.5.2 est également servi localement, avec sa licence et son empreinte :
la suite vérifie que les onglets démarrent même lorsque les CDN publics sont
inaccessibles. Une panne CDN a été reproduite pendant le test réel et laissait
auparavant le proxy sans aucun cadre d'application.

## Régressions v43

Avec `webos` et `proxy` côte à côte et leur dossier parent servi sur le port
3000, lancer `node tests/v43.mjs`. Cette suite vérifie la grille initiale, le
glisser Ctrl+A sans suppression, le maintien de la forme des groupes, les
collisions, les applications ajoutées/restaurées, la persistance et le mobile.
Elle vérifie également, avec des réponses Gemini simulées, le masquage d'une
limite explicite égale à zéro, le maintien d'un modèle temporairement limité,
l'isolation par clé et le bouton de réaffichage. Une image reste jointe après
l'erreur de quota.

Les tests du proxy utilisent son véritable runtime UV pour résoudre les imports
dynamiques. Ils vérifient aussi l'initialisation concurrente du transport partagé
et les listes de transfert de `postMessage` dans un scénario contrôlé. Relancer
`v42.mjs` et `v30.mjs` pour les réglages, les onglets, les applications et les
sauvegardes existantes.

Vérification distante distincte : l'accueil de https://bloxd.io/ s'affiche via
UV/Epoxy après correction de `rewriteImport`, avec ses images et des modules
JavaScript effectivement chargés. Une partie complète n'est pas validée :
l'écran de politique de confidentialité demande une acceptation explicite.
Des erreurs de transfert `MessagePort` restent observables dans reCAPTCHA.
Ce résultat ne valide ni une connexion Discord ni tous les jeux ni tous les
transports. Aucun contournement de vérification anti-robot n'est ajouté.

Aucune clé Gemini réelle n'est utilisée par ces tests. Le compteur local WebOS
n'est pas une mesure des quotas Google, qui s'appliquent au projet, comme
l'indique la [documentation des limites Gemini](https://ai.google.dev/gemini-api/docs/rate-limits).

## Régressions v42

Avec les dépôts `webos` et `proxy` côte à côte, servir leur dossier parent sur
le port 3000 puis lancer `node tests/v42.mjs`. Chromium est lancé avec
`channel: 'chromium'`. La suite vérifie les réglages choisis avant l'ouverture
du navigateur, le mode manuel UV/Epoxy, les nouvelles ouvertures et leurs
onglets sources, les modalités image OpenRouter et les gardes de liens réels
des deux moteurs dans des cadres de test.

Les réponses distantes sont simulées. Ce résultat ne valide ni une connexion
Discord, ni un jeu tiers, ni une clé IA réelle, ni un échange WebSocket Wisp.
Les modèles ne sont pas supprimés sur la seule base d'un refus d'image.

Nouveau : `node tests/v34.mjs` (publication avec file d’attente, onglet détaché, bureau, titre YouTube FR/EN). Les anciens tests v33 simulent l’ancien service de partage (restful-api.dev) et doivent être adaptés au nouveau stockage TextDB.

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
node tests/v33.mjs
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

## Régressions v33

`v33.mjs` vérifie la publication d’un curseur animé sur une galerie simulée, son application dans un client indépendant, le maintien des anciennes entrées, la copie réimportable, le refus des scripts et des publications trop volumineuses, et l’absence d’écriture si la lecture de la galerie échoue. Aucun faux curseur n’est envoyé à la galerie publique.

Le scénario navigateur conserve trois onglets YouTube et l’état d’un jeu simulé. Il contrôle les URL des lecteurs conservées au changement d’onglet et l’ouverture des services dans le même navigateur. Les tests de titres portent sur accents, ponctuation, mots manquants, fautes légères, numéros d’épisode, ambiguïtés et titres sans rapport.

Le bouton de suppression du widget est testé avec confirmation, annulation et requête IA en attente. Les clés et les onglets doivent rester, l’historique enregistré doit être vide et aucune réponse tardive ne doit réapparaître. Les exceptions de la page WebOS sont vérifiées séparément de celles des lecteurs distants : la lecture d’un flux YouTube et les jeux tiers réels ne sont pas attestés par ces fixtures.

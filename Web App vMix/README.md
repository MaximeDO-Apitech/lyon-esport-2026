# LES Graphics Studio — Lyon e-Sport 2026

Application de régie graphique web pour le canal logique `stream`. Elle regroupe une bibliothèque de modèles, un pupitre brouillon/aperçu/programme, une attente animée et un synthé transparent. Les deux sorties utilisent le même moteur de rendu que leurs aperçus.

Le logo servi par l’application est une copie binaire intacte de `DA 2026/logos/Lyon E-sport/Copie de Copie de Logo_les2022_blanc_transparent.png`. Ce bloc-marque horizontal entièrement blanc remplace partout l’ancien logo avec « Lyon » en rouge. Les règles de marque et les choix de composition sont consignés dans [DESIGN.md](./DESIGN.md).

## Installation et lancement

Prérequis : Node.js 22.13 ou plus récent.

```powershell
npm ci
npm run dev
```

Le serveur de développement indique son port au démarrage. Sur le port par défaut :

- pupitre : `http://localhost:3000/admin/control` ;
- bibliothèque : `http://localhost:3000/admin/library` ;
- statut régie : `http://localhost:3000/admin/status` ;
- aperçu attente : `http://localhost:3000/preview/attente` ;
- aperçu synthé : `http://localhost:3000/preview/synthe` ;
- aperçu et banc de test du stinger : `http://localhost:3000/preview/stinger` ;
- sortie attente : `http://localhost:3000/output/attente` ;
- sortie synthé : `http://localhost:3000/output/synthe` ;
- sortie alpha brute du stinger : `http://localhost:3000/output/stinger`.

Pour une exploitation sans serveur de développement ni hot reload :

```powershell
npm run build
npm run start
```

## Configuration vMix

Créer deux entrées **Web Browser** distinctes, en 1920 × 1080, 30 fps et sans audio :

- `http://ADRESSE_DU_SERVEUR:3000/output/attente` ;
- `http://ADRESSE_DU_SERVEUR:3000/output/synthe`.

La première sortie est plein écran. La seconde garde un alpha nul hors du bandeau ; aucun damier ni fond de test n’est rendu sur `/output/synthe`. Les URL restent stables quand le contenu publié change.

Le pupitre affiche un moniteur de l’état graphique rendu par l’application. Ce moniteur n’est pas un retour vidéo de vMix.

## Supervision de la régie

La page `http://localhost:3000/admin/status` rassemble les contrôles utiles avant et pendant une diffusion :

- présence des Browser Sources **attente**, **synthé** et **marqueur replay** ;
- concordance entre la révision programme attendue et celle réellement rendue ;
- fraîcheur du dernier heartbeat de chaque sortie ;
- état courant du compteur, du synthé et du marqueur replay ;
- dernières commandes appliquées par les pupitres ou l’API.

Chaque sortie de diffusion envoie un heartbeat dès son chargement, après chaque changement de révision, puis toutes les cinq secondes. Une sortie sans signal depuis quinze secondes est indiquée comme absente. L’interface distingue ainsi trois situations : **connectée et à jour**, **absente ou silencieuse**, et **connectée sur une ancienne révision**.

Les aperçus et moniteurs intégrés au pupitre ne sont pas comptés comme sorties vMix. La page confirme que le navigateur de rendu reçoit le bon état applicatif ; elle ne remplace pas un retour vidéo du mélangeur.

## Fonctionnement du stinger

Le stinger principal est désormais fondé sur les deux masters vidéo fournis, sans reconstruction HTML, SVG ou GSAP :

| Variante | Durée | Images | Fenêtre plein cadre | Coupe vMix |
| --- | ---: | ---: | --- | ---: |
| Court — 2 s | 2 000 ms | 120 | index 64 à 99 | 1 300 ms, index 78 |
| Long — 5 s | 5 000 ms | 300 | index 64 à 281 | 1 300 ms, index 78 |

Les masters sont en ProRes 4444 alpha 12 bits, 1920 × 1080 à 60 images/s et sans audio. La variante longue conserve le cartouche partenaires CGI entre environ 2,15 et 4,30 secondes. Les originaux restent en lecture seule ; les séquences de diffusion sont des dérivés distincts dont l’alpha est sécurisé uniquement aux images nécessaires.

### Tester le stinger dans l’application

Ouvrir `http://localhost:3000/preview/stinger`. Ce banc de test permet de :

- choisir `Court — 2 s` ou `Long — 5 s` ;
- lancer une simulation A → B à vitesse normale ou au ralenti ;
- déplacer la tête de lecture à une milliseconde précise ;
- vérifier la bascule de A vers B à 1 300 ms ;
- contrôler l’alpha sur damier, fond clair, fond sombre ou mire contrastée ;
- ouvrir `/output/stinger`, qui montre uniquement le rendu RGBA du stinger.

Ces essais sont isolés : ils ne modifient pas l’état programme et n’envoient aucune commande à vMix. Un second déclenchement est ignoré pendant une lecture, et le stinger revient à l’état prêt lorsqu’elle se termine. Recharger la page ne relance pas automatiquement la transition.

### Préparer les séquences de diffusion

Le pipeline analyse les masters avec `ffprobe`, vérifie leurs empreintes, corrige l’alpha puis extrait directement 120 et 300 images PNG RGBA. Il produit aussi les proxies WebM utilisés par le navigateur :

```powershell
npm run export:stinger -- --short "C:\Users\maximed\Downloads\Stinger-V2-court-compressed.mov" --long "C:\Users\maximed\Downloads\Stinger-V2-Long-compressed.mov"
```

La livraison est générée dans `deliverables/stinger-principal-les/v2/` :

- `court-2s/png-sequence/` contient 120 images ;
- `long-5s/png-sequence/` contient 300 images ;
- `manifest.json` consigne la cadence, les temps, le point de coupe, l’alpha et les ressources utilisées ;
- `verification.json` contient les mesures alpha 12 bits et les contrôles des dérivés ;
- chaque séquence possède son `SHA256SUMS.txt`.

Le cycle navigateur peut aussi être contrôlé avec :

```powershell
npm run test:stinger-browser
```

### Installer le stinger dans vMix

Les routes `/output/stinger?variant=short` et `/output/stinger?variant=long` servent à l’aperçu et aux tests automatisés, mais elles ne synchronisent pas la coupe de vMix. Pour la diffusion, utiliser le mécanisme natif de stinger avec la séquence PNG :

1. Ajouter une entrée **Image Sequence / Stinger** à partir du fichier `0001` de la variante voulue. Grâce à la numérotation continue, vMix charge toute la séquence.
2. Choisir un emplacement libre ; ne pas écraser un slot déjà utilisé, notamment par le replay.
3. Régler **Effect** sur `Cut`.
4. Sélectionner la séquence dans **Stinger Input**.
5. Régler **Duration** sur `2000 ms` ou `5000 ms`, et **Stinger Cut Point** sur `1300 ms` dans les deux cas.
6. Laisser la vitesse à 1 et désactiver toute boucle.
7. Affecter le stinger à un bouton de transition, puis tester A → B avec des sources claires, sombres et contrastées.

Le choix d’afficher le stinger au-dessus ou en dessous des overlays actifs dépend de la conduite souhaitée. Il faut notamment vérifier ce réglage avec le synthé à l’écran. Le guide d’exploitation détaillé se trouve dans [`docs/stinger-principal-les.md`](./docs/stinger-principal-les.md).

## Procédure synthé

1. Ouvrir **Pupitre**, puis sélectionner **Synthé**.
2. Saisir le nom/pseudonyme et, si nécessaire, la fonction et l’organisation. Le brouillon est synchronisé, sans toucher au programme.
3. Cliquer **Prévisualiser** pour figer une révision vérifiée.
4. Cliquer **Publier la prévisualisation**. Cette action ne montre pas le synthé.
5. Cliquer **Afficher** pour lancer l’entrée de 400 ms.
6. Cliquer **Masquer** pour lancer la sortie de 300 ms, ou **Vider immédiatement** en cas d’urgence.

Une publication effectuée pendant que le synthé est visible provoque une sortie, un remplacement atomique du contenu, puis une nouvelle entrée.

## Compteur

Le compteur programme accepte une durée ou une heure cible Europe/Paris, enregistrée en UTC. Il n’est ni démarré ni réinitialisé par une publication. Les commandes démarrer, pause, reprendre, réinitialiser, afficher les chiffres et masquer les chiffres sont indépendantes. À zéro, l’affichage reste sur `00:00`.

## API HTTP

- `GET /api/health` : santé et révision persistée ;
- `GET /api/graphics/state` : instantané complet, heure serveur, modèles, préréglages et accusés des sorties ;
- `POST /api/graphics/command` : commande identifiée et validée ;
- `POST /api/graphics/render-ack` : accusé d’application d’une sortie de diffusion.

Exemple local pour masquer explicitement le synthé :

```powershell
$body = @{ id = "companion-synthe-hide-001"; type = "synthe.hide" } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "http://localhost:3000/api/graphics/command" -ContentType "application/json" -Body $body
```

Chaque identifiant de commande doit être unique. Un doublon est reconnu sans rejouer l’action. Une réponse positive signifie que le serveur a accepté la commande ; l’accusé de rendu est présenté séparément dans le pupitre.

Les commandes sont autorisées sans jeton uniquement sur l’interface de boucle locale. Pour une régie LAN, définir `LES_ADMIN_TOKEN` avant le lancement puis renseigner ce même jeton dans le champ de session du pupitre :

```powershell
$env:LES_ADMIN_TOKEN = "une-valeur-longue-et-secrete"
npm run start
```

Pour Companion, ajouter `Authorization: Bearer une-valeur-longue-et-secrete`. Les pages de sortie n’embarquent aucun secret. Les origines étrangères sont refusées.

## Données et validations

L’état, les révisions, les préréglages, les commandes dédupliquées et les accusés sont persistés dans la base D1 liée sous le nom `DB`. Le premier lancement publie uniquement l’attente officielle ; le synthé reste masqué et vide.

Les statuts **Ressources manquantes**, **À valider visuellement** et **Validé** sont distincts. Les tests automatiques ne valident jamais artistiquement un modèle.

La ressource `Eurostile Extended Regular`, ajoutée au dossier `DA 2026/éléments source/typographies`, est désormais embarquée localement et déclarée disponible dans la bibliothèque. Les sorties existantes conservent Eurostile Extended Black et Gotham Black aux endroits prévus.

## Vérifications du dépôt

```powershell
npm test
npm run lint
npx tsc --noEmit
npm run build
```

Les captures de contrôle se trouvent dans `captures/`. La finition des quatre angles, la séparation avec les matrices, les repères pointillés volontairement asymétriques et la respiration synchronisée de l’attente sont consignés dans [`docs/waiting-r9-validation.md`](./docs/waiting-r9-validation.md). Le paramètre `freeze` de `/preview/attente` permet de figer uniquement l’aperçu, par exemple `/preview/attente?freeze=0.25`; `guides=1` ajoute le cadre, les zones d’autorité, les boîtes de matrices et les axes de contrôle uniquement sur cette route d’aperçu. Aucun de ces paramètres n’affecte la sortie programme.

Les contrôles dédiés de cette version peuvent être rejoués avec un serveur local déjà lancé :

```powershell
npm run verify:waiting -- --base-url http://localhost:3000
npm run proof:waiting -- --base-url http://localhost:3000
```

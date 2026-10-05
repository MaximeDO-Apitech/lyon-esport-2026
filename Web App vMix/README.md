# LES Graphics Studio — Lyon e-Sport 2026

Application de régie graphique web pour le canal logique `stream`. Elle regroupe une bibliothèque de modèles, un pupitre brouillon/aperçu/programme, une attente animée et un synthé transparent. Les deux sorties utilisent le même moteur de rendu que leurs aperçus.

Le logo servi par l’application est une copie binaire intacte de `Logo/Logo/Bloc_marque_sans-fond_blanc.png`. Les règles de marque et les choix de composition sont consignés dans [DESIGN.md](./DESIGN.md).

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

Le stinger est la transition animée qui masque le passage d’une source vMix A vers une source B. Il dure **1 200 ms**, est calculé en **1920 × 1080 à 60 images/s**, possède un canal alpha et ne contient pas d’audio.

Son principe est le suivant :

1. Au départ, l’image du stinger est transparente et la source A reste visible.
2. Un volet angulaire cyan et orange balaie l’écran de gauche à droite. Il devient entièrement opaque avant la coupe.
3. À **600 ms**, vMix remplace instantanément A par B. Cette coupe est invisible, car le stinger recouvre alors tous les pixels de l’écran.
4. Le volet se dégage vers la droite et révèle la source B.
5. À **1 160 ms**, l’image est redevenue transparente ; la composition se termine à 1 200 ms.

| Temps | État |
| ---: | --- |
| 0 ms | image transparente, source A visible |
| 320 ms | écran entièrement couvert |
| 600 ms | point de coupe A → B, image `0037` |
| 800 ms | début du dégagement |
| 1 160 ms | retour à la transparence |
| 1 200 ms | fin de la transition |

La fenêtre opaque fonctionnelle est déclarée de **320 à 800 ms**. L’export actuellement livré a été mesuré comme totalement opaque de 250 à 800 ms ; le point de coupe à 600 ms dispose donc d’une marge de sécurité de part et d’autre.

### Tester le stinger dans l’application

Ouvrir `http://localhost:3000/preview/stinger`. Ce banc de test permet de :

- lancer une simulation A → B à vitesse normale ou au ralenti ;
- déplacer la tête de lecture à une milliseconde précise ;
- vérifier la bascule de A vers B à 600 ms ;
- afficher un damier pour contrôler la transparence ;
- ouvrir `/output/stinger`, qui montre uniquement le rendu RGBA du stinger.

Ces essais sont isolés : ils ne modifient pas l’état programme et n’envoient aucune commande à vMix. Un second déclenchement est ignoré pendant une lecture, et le stinger revient à l’état prêt lorsqu’elle se termine. Recharger la page ne relance pas automatiquement la transition.

### Exporter la séquence de diffusion

Le rendu web sert de source déterministe pour produire les 72 images PNG RGBA utilisées par vMix. Le script positionne la timeline GSAP image par image ; il ne réalise pas une capture vidéo en temps réel.

Avec le serveur de développement lancé dans un premier terminal :

```powershell
npm run dev
```

lancer dans un second terminal :

```powershell
npm run export:stinger
```

La livraison est générée dans `deliverables/stinger-principal-les/v1/` :

- `png-sequence/` contient les fichiers `stinger-principal-les-0001.png` à `stinger-principal-les-0072.png` ;
- `manifest.json` consigne la cadence, les temps, le point de coupe, l’alpha et les ressources utilisées ;
- `verification.json` contient les contrôles automatiques de dimensions, numérotation, transparence et opacité ;
- `demo-a-stinger-b.gif` illustre le résultat, mais ne doit pas être utilisé comme source de diffusion.

Le cycle navigateur peut aussi être contrôlé avec :

```powershell
npm run test:stinger-browser
```

### Installer le stinger dans vMix

La route `/output/stinger` est utile pour l’aperçu, l’export et les tests automatisés, mais elle ne synchronise pas la coupe de vMix. Pour la diffusion, utiliser le mécanisme natif de stinger avec la séquence PNG :

1. Ajouter une entrée **Image Sequence / Stinger** à partir de `deliverables/stinger-principal-les/v1/png-sequence/stinger-principal-les-0001.png`. Grâce à la numérotation continue, vMix charge toute la séquence.
2. Dans les paramètres **Overlay**, affecter l’entrée à **Stinger 1** — ou à un emplacement libre.
3. Régler **Effect** sur `Cut`.
4. Sélectionner la séquence dans **Stinger Input**.
5. Régler **Duration** sur `1200 ms` et **Stinger Cut Point** sur `600 ms`.
6. Affecter **Stinger 1** à un bouton de transition, puis tester A → B avec des sources claires, sombres et contrastées.
7. Vérifier le résultat sur la cadence et la version de vMix réellement utilisées en régie. La livraison est produite à 60 images/s, mais cette cadence reste à confirmer sur la machine de diffusion.

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

La ressource `Eurostile Extended Regular` n’est pas présente dans les fichiers fournis. Elle est signalée comme manquante dans la bibliothèque, mais elle ne bloque pas les deux modèles V1, qui utilisent Eurostile Extended Black et Gotham Black aux endroits prévus.

## Vérifications du dépôt

```powershell
npm test
npm run lint
npx tsc --noEmit
npm run build
```

Les captures de contrôle se trouvent dans `captures/`. Le paramètre `freeze` de `/preview/attente` permet de figer uniquement l’aperçu, par exemple `/preview/attente?freeze=0.5`; il n’affecte jamais la sortie programme.

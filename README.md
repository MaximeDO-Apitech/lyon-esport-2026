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
- aperçu attente : `http://localhost:3000/preview/attente` ;
- aperçu synthé : `http://localhost:3000/preview/synthe` ;
- sortie attente : `http://localhost:3000/output/attente` ;
- sortie synthé : `http://localhost:3000/output/synthe`.

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

# Contrat Spectra retenu

Ce document decrit la sortie consommee par le Frontend officiel, pas le port d'ingestion des observateurs.

## Transport et abonnement

- transport : **Socket.IO**, client et serveur `4.8.1` ; ce n'est pas un WebSocket brut ;
- endpoint : origine `http(s)://hote:port` fournie par `LES_SPECTRA_ENDPOINT` ;
- port du Server `v0.3.5` : `5200`, code en dur dans `src/connector/websocketOutgoing.ts` ; il doit etre confirme sur l'instance installee ;
- path : `/socket.io` par defaut, surchargeable par `LES_SPECTRA_PATH` ;
- namespace : `/` ; aucune namespace alternative n'est inventee ;
- abonnement : a `connect`, emission de l'evenement `logon` avec **une chaine JSON** `{"groupCode":"..."}` ;
- accuse : `logon_success` ;
- donnees : evenement `match_data`, payload **chaine JSON** ;
- desabonnement : aucun evenement dedie n'existe dans la sortie examinee ; la deconnexion Socket.IO retire le socket de sa room ;
- reconnexion : nettoyage complet de l'ancien socket, temporisation exponentielle bornee a 30 s avec jitter, nouveau `logon` ;
- changement de groupe : purge du tampon et du Replicant live, nouvel `sessionId`, puis nouvelle connexion.

Preuves : [SocketService Frontend v0.3.6](https://github.com/ValoSpectra/Spectra-Frontend/blob/51f6759be3fe783bace28a753df15933876e6db1/src/app/services/SocketService.ts), [sortie Server v0.3.5](https://github.com/ValoSpectra/Spectra-Server/blob/6e106b5585ebdca4c924c180c7aab3478a54cdf1/src/connector/websocketOutgoing.ts), [boucle MatchController](https://github.com/ValoSpectra/Spectra-Server/blob/6e106b5585ebdca4c924c180c7aab3478a54cdf1/src/controller/MatchController.ts).

## Snapshot, ordre et horloges

Le serveur emet un **snapshot complet** seulement quand son `eventNumber` interne progresse ; la boucle controle ce point toutes les 100 ms. Un snapshot initial est envoye apres le logon si le match existe. Le serveur supprime `eventNumber`, `groupSecret`, les secrets playercam et ses timers internes avant emission. Par consequent :

- aucune revision Spectra n'est disponible en sortie ;
- NodeCG cree une revision locale uniquement pour l'atomicite de publication ;
- une revision NodeCG n'est jamais presentee comme un numero d'evenement Spectra ;
- les doublons strictement identiques sont comptes sans republier le modele ;
- une absence de paquet pendant une pause devient `quiet`, pas une panne ;
- un transport coupe devient `stale` apres 15 s ; selon le reglage programme, les donnees dynamiques sont masquees ou tout le HUD disparait ;
- le dernier paquet et le dernier changement sont deux horloges distinctes.

Le Server ne fournit pas de champ d'ordre global au consommateur : l'extension ne peut donc pas prouver qu'un paquet applicatif est obsolete autrement qu'en isolant les sockets par generation et en rejetant les callbacks d'une ancienne connexion.

## Authentification et configuration

Le consommateur de sortie fournit seulement le `groupCode`. Le `groupSecret` est reserve a l'ingestion des clients et ne doit jamais etre demande ni replique par NodeCG. Le code de groupe est lu cote serveur, conserve en memoire de l'extension et masque dans le statut. Les equipes, joueurs, alias, logos, serie, carte et outils proviennent du snapshot Spectra ; NodeCG ne propose aucun editeur metier.

Le Client distingue l'observateur principal et les clients auxiliaires/Player Clients. L'extension ne se connecte pas a ces canaux d'ingestion. Preuves : [connectorService Client v0.3.4](https://github.com/ValoSpectra/Spectra-Client/blob/a07fd0853129f548ecffc4476e19af5cd20a8988eb/src/services/connectorService.ts), [types d'evenements Client](https://github.com/ValoSpectra/Spectra-Client/blob/a07fd0853129f548ecffc4476e19af5cd20a8988eb/src/services/formattingService.ts).

## Limites confirmees

- selection d'observateur : aucun identifiant d'observateur n'est expose par le contrat de sortie examine ; le bundle affiche `isObserved` du snapshot et documente cette limite ;
- fin de partie : `isRunning`, `roundPhase`, score et snapshot final sont relayes, sans minuterie inventee ;
- erreurs d'abonnement : la sortie officielle emet `logon_success` mais aucun `logon_fail` dans le fichier examine ; l'absence d'accuse reste visible comme `transport-connected` sans `subscribed` ;
- resets : pas de marqueur explicite en sortie ; un changement de groupe est le seul reset garanti localement ;
- mapban, statistiques externes et playercams utilisent d'autres services dans le Frontend et restent hors perimetre ;
- aucune instance Spectra de l'evenement n'etait accessible pendant ce lot : **integration reelle a verifier**. Les fixtures sont synthetiques, nommees comme telles, et ne prouvent pas l'abonnement live.

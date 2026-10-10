# Procedure operateur, vMix et retour arriere

## Avant le direct

1. Configurer la rencontre, les equipes, les joueurs, les alias, les logos, la serie et la carte dans les outils Spectra. Ne rien ressaisir dans NodeCG.
2. Verifier que le Server Spectra expose sa **sortie Frontend** et non son port d'ingestion. Pour `v0.3.5`, le code public ecoute `5200`; confirmer la configuration de l'instance evenement.
3. Sur la regie NodeCG, ouvrir PowerShell, definir `LES_SPECTRA_ENDPOINT`, puis lancer `npm start` depuis `NodeCG`.
4. Ouvrir `http://127.0.0.1:9090/`, espace **LES Valorant**.
5. Dans **Connexion**, saisir le code de groupe. Attendre successivement transport connecte, abonnement accuse, puis source `live`. `transport-connected` seul ne prouve pas qu'un observateur alimente le groupe.
6. Dans **Diagnostic**, verifier les deux equipes, les joueurs, les champs absents et les capacites. Une modification de nom/logo dans Spectra doit apparaitre apres son workflow de publication ; aucun contournement NodeCG n'existe.
7. Dans **Apercu**, commencer par la fixture synthetique, puis passer aux donnees live. Choisir compact/complet dans le pupitre. Publier l'apercu copie seulement la presentation et laisse le programme masque.
8. Calibrer le delai graphique de **tout le snapshot** entre 0 et 15 000 ms. Mesurer separement : delai camera observateur, delai d'arrivee Spectra, puis delai final du stream. Le tampon ne predit aucune donnee.

## Entree vMix 29

La version installee mesuree est `29.0.0.49`. L'aide v29 confirme que Web Browser utilise CEF, accepte largeur/hauteur explicites et alpha si le fond de page n'est pas defini.

Creer manuellement, sans modifier automatiquement le preset :

- type : **Web Browser** ;
- URL locale exacte : `http://127.0.0.1:9090/bundles/les-valorant/graphics/hud.html` ;
- Width : `1920` ; Height : `1080` ;
- audio : coupe/non utilise ;
- clavier : desactive hors test ;
- layer : au-dessus de l'entree video Valorant, qui reste separee.

Sur une machine vMix distincte, remplacer `127.0.0.1` par l'hote NodeCG seulement apres avoir active authentification, TLS ou reverse proxy et filtrage reseau. Utiliser l'URL graphique fournie par le menu **Graphics** de NodeCG si l'authentification ajoute une cle ; ne committer ni ne copier cette cle dans la documentation.

## Conduite antenne

- **Afficher le HUD** : retire l'urgence puis rend la presentation programme courante ;
- **Masquer** : transition courte de 160 ms ;
- **Urgence transparent** : alpha nul immediat, sans attendre Spectra ;
- **Entrer en replay** : suppression explicite du HUD live ;
- **Quitter le replay** : rend le HUD de nouveau eligible, sans minuterie qui devine la fin ;
- **Compact** : score/contexte, rails et carte observee desactives par defaut ;
- **Complet** : rails 5v5 et joueur observe, a utiliser seulement apres recette avec le HUD natif effectivement compatible/masque.

Une commande « appliquee » signifie que l'extension NodeCG l'a validee. Elle ne prouve pas que l'entree vMix est a l'antenne ; le retour programme vMix reste la preuve.

## Pannes

- Source `quiet` : le transport est connecte mais aucun nouveau snapshot n'est arrive depuis 15 s. Un etat de jeu inchange peut etre legitime ; ne pas basculer automatiquement.
- Source `stale` : transport coupe depuis au moins 15 s. Avec l'option par defaut, le HUD entier est masque ; sans auto-hide, les valeurs dynamiques disparaissent.
- Groupe errone : saisir le nouveau code ; l'ancien snapshot et le tampon sont purges avant la nouvelle connexion.
- NodeCG ne repond plus : retirer/desactiver manuellement l'overlay Web Browser dans vMix. L'urgence NodeCG ne peut pas fonctionner si NodeCG est arrete.
- Spectra revient : attendre `subscribed` puis un nouveau snapshot coherent ; aucune animation historique n'est rejouee.

## Migration et retour arriere

| Asset | URL actuelle | URL NodeCG | Etat / condition de retrait |
| --- | --- | --- | --- |
| HUD Valorant LES | aucun | `/bundles/les-valorant/graphics/hud.html` | nouvelle tranche fonctionnelle ; qualification Spectra/vMix encore requise |
| Attente | `/output/attente` sur l'app port 3000 | non migree | conserver jusqu'a migration visuelle et fonctionnelle dediee |
| Synthe | `/output/synthe` | non migre | conserver rendu, etat, compteurs et animation valides |
| Stinger court/long | sequence native vMix + routes de test | non migre | conserver les masters et points de coupe existants |
| Replay in/out/marker | `/output/replay-*` | non migre | conserver le pack et les commandes existantes |

Retour arriere : masquer l'entree NodeCG Valorant et restaurer la composition precedente dans vMix. Aucun preset ni service Spectra n'est modifie par ce lot. L'app historique et ses URL restent intactes ; il n'existe pas deux sources concurrentes pour le match Valorant puisque seul Spectra fournit les identites et scores.

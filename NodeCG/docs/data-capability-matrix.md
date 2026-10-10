# Matrice des donnees et capacites

`null` signifie inconnu/absent. Le HUD n'affiche jamais `0`, `mort`, `100 %` ou une seconde restante a la place d'une valeur inconnue.

| Champ demande | Source exacte | Disponibilite / unite | Validite | Traitement si absent |
| --- | --- | --- | --- | --- |
| Equipes / noms / tricodes | `teams[0..1].teamName/teamTricode` | Snapshot Spectra | chaine non vide | tiret neutre, jamais de saisie locale |
| Identite d'equipe stable | position configuree `teams[0]` / `teams[1]` | toujours si snapshot valide | cle locale `spectra-left-team/right-team` | snapshot refuse si moins de deux equipes |
| Logo d'equipe | `teamUrl` | URL HTTPS | hote explicitement autorise par env | image masquee ; pas de proxy arbitraire |
| Cote attaque/defense | `team.isAttacking` | booleen | vrai/faux uniquement | libelle `COTE INCONNU`, aucune deduction par couleur/score |
| Position ecran | index gauche/droite du contrat Frontend | toujours | distincte du cote | conservee lors du changement de cote |
| Score de manches | `roundsWon` | entier ≥ 0 | entier borne | tiret ; aucune reconstruction locale |
| Joueurs / ordre | `team.players` | 0 a 5 par equipe | ordre Spectra conserve | slot masque ; pas de tri par kills |
| Identifiant joueur | `playerId` | chaine/nombre converti en chaine | non vide | cle de slot locale signalee comme inconnue |
| Nom / nom complet | `name`, `fullName` | texte Unicode | tronque defensivement, jamais reecrit | tiret |
| Agent | `agentInternal` | identifiant interne Spectra | chaine non vide | initiale/jeton masque par tiret ; aucune image inventee |
| Vivant/mort | `isAlive` | booleen | vrai/faux uniquement | `ETAT —`, pas `MORT` |
| Joueur observe | `isObserved` | exactement un attendu | zero : absent ; plusieurs : avertissement et aucune selection | carte observee masquee |
| Arme / bouclier / credits | `highestWeapon`, `armorName`, `money` | scoreboard disponible ; credits entiers | `scoreboardAvailable` ou auxiliaire scoreboard | `Equipement inconnu` et champs masques |
| K/D/A | `kills/deaths/assists` | scoreboard disponible | entiers ≥ 0 | `KDA —` |
| Ultime | `currUltPoints/maxUltPoints/ultReady` | scoreboard disponible | entiers + booleen | masque |
| Capacites | `abilities.*` | Player Client/auxiliaire selon `auxiliaryAvailable.abilities` | entiers ≥ 0 | masque, jamais trois zeros |
| Sante | `health` | Player Client/auxiliaire selon `auxiliaryAvailable.health`, PV | entier 0–200 seulement quand disponible | `PV —`, aucune barre 100 % |
| Spike porte | `hasSpike` | snapshot joueur | booleen | aucune icone |
| Spike pose/defuse/explose | `spikeState.*` | snapshot match | booleens | module silencieux |
| Manche | `roundNumber` | entier | 0–200 | tiret |
| Phase | `roundPhase` | chaine Spectra brute | texte borne | tiret ; pas de phase reconstruite |
| Timer de manche | non expose dans `IMatchData` | **non pris en charge** | aucune | module absent ; aucune duree supposee |
| Carte | `map` | chaine | non vide | tiret |
| Serie | `tools.seriesInfo.needed/wonLeft/wonRight` | cartes / entier | entiers bornes | ligne repliee |
| Tournoi | `tools.tournamentInfo.name` | chaine | non vide | retire de la ligne |
| Resultats de manche | `roundRecord` optionnel | expose par equipe mais non prioritaire | non qualifie live | non rendu dans ce lot |
| Mapban | endpoint separe du Frontend | **hors Server principal** | non integre | desactive explicitement |
| Playercams | service externe/config protegee | **hors HUD prioritaire** | non integre | desactive explicitement |

Les drapeaux observes sont publies dans `diagnostics.capabilities`. La matrice correspond au modele de [Types.ts du Frontend v0.3.6](https://github.com/ValoSpectra/Spectra-Frontend/blob/51f6759be3fe783bace28a753df15933876e6db1/src/app/services/Types.ts) et au modele `Player` du Server, mais seule une capture de l'instance evenement pourra qualifier les champs effectivement disponibles.

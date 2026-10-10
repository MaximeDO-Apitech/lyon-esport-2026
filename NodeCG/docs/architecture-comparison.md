# Architecture, versions et decisions de migration

## Versions examinees le 11 octobre 2026

| Projet | Version de production retenue | Commit du tag | Branche de developpement observee | Decision |
| --- | --- | --- | --- | --- |
| NodeCG | `2.8.0`, publiee le 28 juin 2026 | `29d70b39f514d1649b27c8d0ca2281f07b63e7bd` (`nodecg-v2.8.0`) | `main` etait au meme commit lors de l'audit | Runtime exact `nodecg@2.8.0`, lock npm commite. Version stable courante, pas une branche `main`. |
| Spectra Server | `v0.3.5` | `6e106b5585ebdca4c924c180c7aab3478a54cdf1` | `64782ac2dcd5863aa179a084c8f402c3be794ebe`, un correctif BattleRiffle apres le tag | Contrat de sortie du tag ; la branche a ete lue pour detecter le changement, pas embarquee. |
| Spectra Frontend | `v0.3.6` | `51f6759be3fe783bace28a753df15933876e6db1` | `1e81de161c35d4b6f5e4fb6056c6db100734bf96`, un correctif Gecko apres le tag | Client de reference du protocole du tag ; pas de code Angular copie. |
| Spectra Client | `v0.3.4` | `a07fd0853129f548ecffc4476e19af5cd20a8988eb` | identique au tag | Lu pour l'authentification observateur/Player Client et la provenance des donnees ; inchange. |
| vMix installe | `29.0.0.49` | binaire local `C:\Program Files (x86)\vMix\vMix64.exe` | sans objet | Confronte a l'aide Web Browser v29 ; aucune modification du preset. |

Sources : [release NodeCG 2.8.0](https://github.com/nodecg/nodecg/releases/tag/nodecg-v2.8.0), [manifest NodeCG](https://www.nodecg.dev/docs/manifest/), [installation NodeCG](https://www.nodecg.dev/docs/installing-new/), [Spectra Server v0.3.5](https://github.com/ValoSpectra/Spectra-Server/tree/6e106b5585ebdca4c924c180c7aab3478a54cdf1), [Spectra Frontend v0.3.6](https://github.com/ValoSpectra/Spectra-Frontend/tree/51f6759be3fe783bace28a753df15933876e6db1), [Spectra Client v0.3.4](https://github.com/ValoSpectra/Spectra-Client/tree/a07fd0853129f548ecffc4476e19af5cd20a8988eb), [aide vMix 29](https://www.vmix.com/help29/WebBrowser.html).

## Comparaison ciblee

| Responsabilite | Application actuelle | Spectra | NodeCG | Decision de migration | Preuve examinee |
| --- | --- | --- | --- | --- | --- |
| Collecte Valorant | Aucune collecte | Client/Overwolf collecte ; Server reconstruit | Ne collecte pas le jeu | **Conserver** Spectra, ne rien ajouter cote jeu | Spectra Client `src/services/gepService.ts`, `connectorService.ts`; `Web App vMix/lib/graphics/` ne contient aucun collecteur |
| Configuration metier | Synthes et attente locaux, pas de roster Valorant | Client envoie equipes, joueurs, alias et outils | Lecture seule des identites | **Conserver** dans Spectra ; **ne pas creer** d'editeur NodeCG | Spectra Client `connectorService.ts` et `formattingService.ts`; panneau `dashboard/connection.html` sans formulaire d'equipe |
| Protocole | API HTTP/SSE propre aux anciens habillages | Socket.IO 4.8.1, `logon`, `match_data` | Adaptateur unique dans l'extension | **Adapter** seulement la sortie officielle | Frontend `src/app/services/SocketService.ts`; Server `src/connector/websocketOutgoing.ts`; `src/spectra-connector.ts` |
| Etat partage | Store D1 et routes `/api/graphics/*` | Etat de match en memoire serveur | Replicants schemas | **Deplacer** uniquement le nouvel etat Valorant vers NodeCG ; anciens assets inchanges | `Web App vMix/lib/graphics/store.ts`; `schemas/*.json`; `src/index.ts` |
| Dashboard | Pupitre Next valide pour attente/synthe/replay/stinger | Frontend d'overlay, pas pupitre LES | Quatre panneaux LES | **Ajouter** le pupitre Valorant ; **conserver** temporairement l'ancien | `Web App vMix/components/admin/`; `package.json#nodecg.dashboardPanels` |
| Bibliotheque | Bibliotheque de modeles locale | Ressources propres au frontend Spectra | Aucun clone de bibliotheque | **Conserver** l'existant et **ne pas porter** Angular | `Web App vMix/components/admin/library-studio.tsx`; Frontend `src/app/components/` non copie |
| Rendu | Next/vinext pour attente/synthe et sorties replay | Angular, look Spectra | HTML/CSS/JS original LES | **Ajouter** le HUD LES ; **preserver** toutes les anciennes URL | `Web App vMix/app/output/`; `graphics/hud.*` |
| Animations | Assets et transitions valides | Animations du frontend Spectra | Transitions d'etat 140–160 ms | **Adapter** au HUD, sans rejouer l'historique | `Web App vMix/components/graphics/`; `graphics/hud.css` |
| Previsualisation | Routes `/preview/*` distinctes | Routes de test Angular | Surface `preview` et fixture isolee | **Conserver** la separation preview/programme | `dashboard/preview.js`; `src/presentation.ts` |
| Securite | Jeton d'admin pour l'app actuelle | Groupe/session cote Spectra ; sortie publique par code | Secrets en variables serveur, config loopback | **Remplacer** l'exposition du nouvel outil par NodeCG local/authentifie ; jamais de secret en Replicant | `Web App vMix/lib/graphics/auth.ts`; `cfg/nodecg.json`; `src/index.ts` |
| Persistance | D1 pour etat graphique | Etat live en memoire ; donnees metier propres a Spectra | Presentation persistante, live non persistant | **Adapter** : aucun ancien score restaure | Options `persistent` dans `src/index.ts`; docs NodeCG Replicants |
| Diagnostic | `/admin/status`, heartbeats de sorties | Logs et `/status`/extras | Statut transport/source distinct et vue normalisee | **Ajouter** sans payload brut | `Web App vMix/lib/operations/`; `dashboard/diagnostics.*` |
| Deploiement | App Next/vinext port 3000 | Services Spectra separes | NodeCG port 9090 | **Coexister**, puis migrer asset par asset | `Web App vMix/README.md`; `NodeCG/README.md` |
| Tests | Tests Node et scripts navigateur des assets valides | Pas importes dans ce depot | Tests Node + demarrage/HTTP | **Conserver** les tests existants et **ajouter** ceux du bundle | `Web App vMix/tests/`; `NodeCG/tests/`; `docs/test-report.md` |

## Architecture livree

```text
VALORANT / clients Spectra existants
              |
              v
Spectra Server existant -- Socket.IO sortie officielle :5200
              |
              v (une connexion par extension)
NodeCG 2.8.0 / extension les-valorant
  connecteur -> validation -> normalisation -> tampon coherent
              |
              +-- Replicants schemas (live non persistant)
              +-- messages de commande valides
              |
              v
HUD LES transparent 1920x1080 + preview/dashboard
              |
              v
vMix Web Browser 29 (video du jeu sur une autre entree)
```

Le projet `Web App vMix` reste le responsable exclusif de l'attente, du synthe, des stingers et du replay. Aucun fichier ni URL de ces assets n'a ete change. La condition de retrait est une migration et une recette separees de chaque asset, avec correspondance d'URL et validation vMix ; ce lot ne les bascule pas.

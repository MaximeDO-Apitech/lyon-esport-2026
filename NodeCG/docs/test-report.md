# Rapport de tests — 11 octobre 2026

## Execute et reussi

Commande :

```powershell
cd NodeCG
npm run check
```

Resultat final : build TypeScript puis **14/14 tests passes** :

- normalisation sans code de groupe/token brut ;
- sante/statistiques absentes conservees a `null` ;
- refus d'un snapshot sans deux equipes ;
- changement de cote sans permutation d'identite/score et selection observee ambigue neutralisee ;
- arret d'urgence ;
- publication preview sans affichage programme ;
- delai borne a 15 s ;
- publication atomique apres delai ;
- purge de l'ancienne session, ordre du tampon et commande dupliquee ;
- validation/normalisation du code de groupe ;
- vrai serveur Socket.IO de test : un seul socket, `logon` JSON-stringifie, `logon_success`, `match_data`.

NodeCG a ensuite ete lance avec `nodecg@2.8.0`. L'extension `les-valorant` a ete montee et le serveur a ecoute sur `http://localhost:9090`. Les dix ressources controlees (dashboard, HTML/CSS/JS du HUD, fixture et image de reference) ont retourne HTTP 200. Ce demarrage a eu lieu sans endpoint Spectra, donc avec le statut attendu `integration live a qualifier`.

La non-regression de `Web App vMix` a aussi ete executee : **31/31 tests passes**, ESLint sans erreur, `tsc --noEmit` sans erreur et build vinext reussi. Les routes attente, synthe, stinger et replay restent presentes dans le build.

Mesure ponctuelle du processus NodeCG au repos apres lancement : working set `136,9 MiB`, memoire privee `126,4 MiB`, 14 threads et 280 handles. Il s'agit d'une mesure unique sur ce PC, pas d'une promesse de charge ni d'un soak test. Les ressources propres au HUD servies mesuraient environ 3,5 KiB HTML, 9 KiB CSS et 8,8 KiB JS, hors fontes (environ 209 KiB) ; l'image de gameplay et la fixture ne sont chargees qu'en apercu explicite.

Le connecteur ne publie pas a 60 Hz : il suit les snapshots Spectra, deduplique les objets identiques et ne maintient qu'une connexion amont, quel que soit le nombre de panneaux/apercus/graphiques NodeCG.

## Audit de dependances

`npm audit --omit=dev` signale **9 vulnerabilites moderees, 0 high, 0 critical**, toutes transitives du runtime NodeCG 2.8.0 (`typeorm`, `sprintf-js`, OpenTelemetry et adaptateurs NodeCG). La proposition npm de « correction » remplace NodeCG par 2.6.2 et n'a pas ete appliquee : ce serait un changement de runtime non verifie et potentiellement regressif. L'instance reste liee a la boucle locale par defaut ; reevaluer les avis avant toute exposition LAN/Internet.

## Non execute / a qualifier

- aucune instance Spectra evenement accessible : pas d'abonnement reel, session invalide reelle, changement d'identite dans Spectra ni Player Clients ;
- navigateur de recette integre indisponible : pas de capture pixel, mesure DOM, animation temps reel ni comparaison 1920/1280/960 ;
- pas de capture spectateur Valorant recente : cohabitation HUD native non qualifiee ;
- pas de lancement dans le CEF Web Browser de vMix 29.0.0.49 ;
- pas de modification du preset vMix ;
- pas de test prolonge : aucune affirmation de deux heures ou de 60 fps ;
- pas de validation artistique utilisateur.

## Scenario de qualification live restant

Connecter l'instance Spectra retenue, anonymiser et sauvegarder un snapshot reel autorise avec versions, puis rejouer : snapshot initial, pause sans changement, coupure/reconnexion, groupe invalide, changement de groupe, donnees partielles, Player Client present/absent, changement de cote, prolongations, joueur observe, fin de manche/match. Completer ensuite la recette navigateur et vMix de `hud-cohabitation.md`.

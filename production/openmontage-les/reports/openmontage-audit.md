# Audit OpenMontage × Lyon e-Sport

Date du contrôle : 7 octobre 2026. Cet audit décrit le commit local installé ;
il ne transforme pas une disponibilité déclarée par le registre en preuve de
fonctionnement.

## Résultat

OpenMontage est exploitable comme atelier séparé pour les contrôles locaux,
Backlot et de futures compositions isolées. Il ne doit pas devenir une
dépendance de `Web App vMix`, ni écrire directement dans ses sorties programme.

Le dépôt LES contenait déjà de nombreuses modifications en cours, notamment sur
l’attente et les stingers. Aucun fichier de `Web App vMix`, aucun master et
aucune référence existante n’a été modifié par ce pilote.

## Installation réelle

| Élément | État observé |
| --- | --- |
| Mode d’ajout | Sous-module/dépôt Git imbriqué sous `tools/OpenMontage` |
| Commit | `9327439db69021ab4b0e2776729bf3b58fdb5a87` |
| État interne | Propre ; `.env`, `.venv`, modèles et rendus locaux sont ignorés |
| Licence OpenMontage | AGPL-3.0, notice conservée dans le sous-module |
| Python | 3.11.9 ; pip 26.2.1 |
| FFmpeg / ffprobe | 9.0.2, build Gyan |
| Node / npm | 24.19.0 / 11.8.0 |
| Remotion | 4.0.484 |
| HyperFrames | 0.8.140 |
| Piper | 1.8.0 avec voix locale installée |

Le sous-module préserve l’historique et les notices. Cette séparation technique
ne constitue pas, à elle seule, une conclusion juridique sur une redistribution
future avec le reste du produit.

## Registre et capacités

La méthode demandée `registry.provider_menu_summary()` existe et s’exécute. Le
prévol protégé, avec FFmpeg et le venv dans `PATH` et sans identifiants de
fournisseurs hérités, retourne :

| Capacité | Déclaré | Configuré | Test fonctionnel dans ce pilote |
| --- | ---: | ---: | --- |
| Analyse | 13 | 7 | FFprobe, hachage et balayage alpha intégral testés |
| Traitement audio | 2 | 2 | Non utilisé ; stingers silencieux |
| Graphisme | 3 | 1 | Mermaid déclaré, non testé |
| Capture écran | 2 | 2 | Déclaré, non testé |
| TTS | 13 | 1 | Piper avait passé un smoke test ; non utilisé ici |
| Post-production vidéo | 9 | 9 | FFmpeg testé ; HyperFrames diagnostiqué |
| Génération d’images | 23 | 0 | Bloquée et hors périmètre |
| Génération vidéo | 31 | 0 | Bloquée et hors périmètre |
| Génération musicale | 5 | 0 | Bloquée et hors périmètre |

`configured` signifie que le registre a trouvé une route disponible. Cela ne
prouve ni son rendu final, ni sa disponibilité hors connexion. Le prévol du
registre peut lui-même vérifier des paquets ; il n’est donc pas présenté comme
un test offline.

### Moteurs de composition

- FFmpeg : disponible et réellement utilisé pour sonder les deux masters et
  scanner 870 912 000 échantillons alpha.
- Remotion : disponible ; le rendu officiel `code-to-screen` existe et a été
  produit localement en H.264 1920 × 1080, 30/1, 25,045 s. Ce smoke test opaque
  ne prouve pas un export alpha LES.
- HyperFrames : `doctor` sort avec le code 0 et rapporte Node, FFmpeg, ffprobe et
  Chrome disponibles. Aucun rendu LES ni export alpha n’a été réalisé.
- Backlot : le CLI et l’aide ont été chargés. Le tableau n’a pas été substitué à
  la bibliothèque et aucun serveur permanent n’a été ajouté.

Backlot ne fournit pas de schéma propre dans ce commit : il lit `project.json`,
les checkpoints, événements et artefacts canoniques. Le pilote n’a donc pas
inventé de champs Backlot et n’a pas simulé une exécution de pipeline.

Les absences optionnelles observées comprennent whisper.cpp, Kokoro, MusicGen,
Docker et Blender. Elles ne bloquent pas le pilote. `npm audit` signale dans les
dépendances amont 2 vulnérabilités modérées et 3 élevées, aucune critique ; aucun
`npm audit fix` n’a modifié le sous-module.

## Budget et confinement du pilote

La configuration amont n’est pas adaptée telle quelle : elle est en mode
`warn`, avec un budget de 10 USD. Le pilote passe par `run-local.ps1`, qui :

- n’expose qu’une liste fermée de commandes locales autorisées ;
- retire les variables dont le nom ressemble à un secret du processus enfant,
  sans lire ni afficher leur valeur ;
- applique un garde proxy externe et autorise localhost ;
- ne fournit aucune commande arbitraire de génération ;
- documente un `CostTracker` en mode `cap` avec un total de 0 USD.

Le test avec un double local accepte une réservation à 0 USD et refuse 0,01 USD
avec `BudgetExceededError`. Aucun fournisseur réel n’est appelé. Ce wrapper est
une défense de projet, pas un pare-feu du système d’exploitation ; seules ses
commandes listées sont autorisées pour ce pilote.

Le fichier `.env` local contient 43 entrées déclarées, sans valeur de clé API ;
seule `MINIMAX_REGION` porte une valeur non secrète. Aucune valeur de variable
d’environnement n’a été imprimée pendant l’audit.

## Compatibilités et conflits explicites

| Règle amont | Décision LES |
| --- | --- |
| Pipeline animation : recherche, trois concepts, narration et publication | Inadapté à la qualification de maîtres silencieux ; aucun faux artefact n’est créé |
| `video-reference-analyst` | Non applicable : ces MOV sont les résultats de référence, pas une demande d’imitation |
| Atelier : identité nouvelle et composants créatifs non réutilisés | Conflit avec une marque live ; réutiliser les composants LES approuvés est souhaité |
| Défaut 30 i/s | Interdit pour ces stingers ; la cadence 60/1 est conservée |
| Sortie MP4/H.264 | Insuffisante pour l’alpha de diffusion |
| Polices conseillées par HyperFrames | Ne remplacent jamais Eurostile/Gotham ; support local à prouver avant rendu |
| Backlot « replay » | Suivi d’une production uniquement, sans rapport avec le ralenti vMix |

Le profil validé et le contrat complémentaire se trouvent dans `profile/`.
La revue des deux médias est aussi enregistrée dans le format canonique
`source_media_review` d’OpenMontage sous `reports/data/source-media-review.json` ;
aucun checkpoint de pipeline fictif n’a été créé.

## Passage proposé vers la bibliothèque

Le schéma `schemas/les-asset-handoff.schema.json` décrit un échange par fichier
préparé et métadonnées : provenance, SHA-256 source et dérivé, dimensions,
cadence rationnelle, nombre d’images, alpha, coupe, résultats de test et
approbation humaine.

Un futur import devra copier vers une nouvelle version préparée, refuser les
URL, chemins absolus et traversées `..`, valider le schéma et ne jamais servir
le workspace, ses journaux ou ses secrets. Le statut initial reste `candidate` ;
aucun succès OpenMontage ne devient automatiquement l’asset en programme.

## Seconde étape proposée — non exécutée

Une virgule de rubrique silencieuse de 2 s, 1920 × 1080, 60/1, construite
uniquement avec des ressources approuvées, serait un bon test limité.

- HyperFrames convient au HTML/GSAP et au motion design, mais l’interface locale
  observée est orientée MP4. Il faut d’abord qualifier le chargement déterministe
  des fontes LES et ajouter un chemin d’export alpha isolé.
- Remotion convient à une composition React isolée et son runtime est déjà testé,
  mais il ne doit pas entraîner la migration de la bibliothèque ou du pupitre.
- Tant que PNG RGBA, ProRes 4444 ou WebM alpha ne sont pas prouvés dans le chemin
  choisi, l’export LES existant reste la référence.

Le moteur, le codec alpha exact et le lancement de cette création nécessitent
une validation explicite avant toute exécution.

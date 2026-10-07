# Contrat de production LES pour OpenMontage

Le playbook YAML respecte les champs réellement acceptés par le schéma
`openmontage/styles/playbook`. Ce document porte les règles de gouvernance qui
ne doivent pas être encodées dans des champs arbitraires ignorés par le moteur.

## Autorité et périmètre

1. Les sources de marque et les décisions validées du projet LES priment sur les
   playbooks, scores esthétiques et exemples OpenMontage.
2. OpenMontage est un atelier séparé. L’application Node/web, le pupitre, les
   routes, états, commandes et assets déjà chargés en programme ne dépendent pas
   de lui.
3. Toute production reste candidate jusqu’à approbation humaine, puis recette
   sur le matériel réel. Aucun statut OpenMontage ne publie un asset.
4. Les compositions, preuves et journaux sont écrits sous un espace de travail
   dédié. Un adaptateur ne cible jamais `Web App vMix` comme workspace rendu.

## Adaptation explicite des règles amont

- `video-reference-analyst.md` ne s’applique pas au pilote : les MOV sont des
  maîtres à qualifier, pas des références demandant une imitation.
- `pipeline_defs/animation.yaml` impose recherche, concepts, audio et étapes de
  publication adaptés à une nouvelle vidéo. Le pilote est une qualification
  média locale ; il n’invente donc ni recherche de tendances, ni narration, ni
  musique, ni jalons approuvés.
- `bespoke-composition.md` demande une identité nouvelle et interdit la
  réutilisation créative. Pour une marque live, la cohérence prévaut : les
  composants LES approuvés sont réutilisables et souhaités. Le sur-mesure porte
  sur la composition et le mouvement de l’asset, pas sur le remplacement de la
  direction artistique commune.
- Le défaut OpenMontage à 30 i/s et la sortie MP4/H.264 ne s’appliquent pas aux
  stingers 60 i/s ni aux exports alpha. Cadence et codec sont décidés par asset.
- Les recommandations typographiques HyperFrames ne remplacent pas les fontes
  LES. Si le compilateur ne les prend pas en charge, l’export reste bloqué tant
  qu’un chargement local déterministe et licencié n’est pas prouvé.

## Choix de mécanisme

- Inspection, hachage, ffprobe, extraction d’images et mesure alpha : FFmpeg et
  outils locaux, sans runtime de composition.
- Nouvelle composition HTML/GSAP : HyperFrames est un candidat naturel, mais
  nécessite un workspace isolé, un test des fontes locales et une adaptation
  d’export alpha.
- Remotion reste un candidat parallèle pour une composition React et ne remplace
  pas la bibliothèque ou le pupitre.
- Le choix HyperFrames/Remotion doit être présenté et approuvé avant une nouvelle
  création. Aucun basculement silencieux n’est autorisé.

## Règles par famille

- Attente : mouvement calme, boucle déterministe, compteur live séparé.
- Transition : mouvement bref, 1920 × 1080, cadence 60/1 conservée, coupe testée
  à l’image près, silence par défaut.
- Synthé : lisibilité et stabilité, animation d’entrée/sortie courte, données
  live séparées du décor.
- Replay : aucune confusion entre le replay de suivi Backlot et le ralenti vMix.

## Alpha et silence

- Un média alpha n’est jamais validé à partir d’un MP4 opaque.
- La transparence d’entrée/sortie, la couverture de coupe, les franges et les
  niveaux colorimétriques sont des contrôles distincts.
- Pour un asset silencieux, l’audio est `non applicable — silence demandé` ; une
  piste vide n’est pas ajoutée.

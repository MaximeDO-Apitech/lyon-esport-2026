# Direction artistique — LES Graphics Studio

Ce document sépare les règles officielles constatées dans les sources de marque des décisions d’implémentation propres à la V1. En cas de contradiction, les sources officielles priment.

## Règles officielles

Sources examinées : les exemplaires fournis de `Univers Graphique.pdf`, les fichiers de logo du dossier `Logo`, les éléments graphiques livrés avec la direction artistique et les cinq visuels de communication du 5 octobre 2026 (`05_17_00 PM`, `05_16_58 PM`, `05_16_55 PM`, `05_16_47 PM`, `05_16_43 PM`). Les vidéos `WIP-V4-STREAM-1920-ALED-Compressed.mov`, `STREAM-PROBLEME-TECHNIQUE-V5-1920.mp4` et `Stinger-V1-court-compressed.mov` ont également été examinées comme points de comparaison de l'habillage plein écran.

Palette unique :

- blanc `#FAFBFB` ;
- bleu nuit / noir `#010A14` ;
- orange solaire `#FCC766` ;
- orange `#EF7B28` ;
- cyan `#01F7FD`.

Typographies nommées par la charte : Eurostile Extd Black, Eurostile Extd Regular et Gotham. Les sorties utilisent exclusivement les fichiers locaux autorisés présents dans le projet. Aucun CDN ni téléchargement de police n’est effectué en exploitation.

Le bloc-marque officiel est affiché dans ses couleurs sources, sans filtre, contour, recadrage, recoloration, redessin, extrusion, déformation ni altération du ratio. Il reste fixe et pleinement opaque. Le fichier public `public/assets/Bloc_marque_sans-fond_blanc.png` est une copie binaire intacte du fichier explicitement choisi par le responsable scène.

Les motifs officiels utilisés sont les flammes/volutes, le fond `Elements-01`, l’angle cyan, la ligne de points et le nuage de points fournis. Ils restent décoratifs, vivent dans les couches périphériques et ne passent pas devant le logo, le message ni le compteur. La ligne de points n’est jamais utilisée comme une grande colonne répétitive : elle devient un repère latéral court et local.

## Décomposition vérifiée de l’univers graphique

Le PDF fourni est une planche unique qui place explicitement les familles suivantes :

- neuf flammes individuelles (flamme 1 à 7, 9 et 10) disposées comme une bibliothèque de gestes lumineux ; elles servent à construire des masses, pas à remplir uniformément l’image ;
- un angle cyan dont l’orientation source correspond à un coin haut droit ; il peut être retourné pour encadrer un groupe d’information, sans imposer un cadre aux quatre coins du viewport ;
- une paire compacte de lignes de points verticales, avec terminaisons lumineuses ; cette famille fonctionne comme un rail technique local, jamais comme une succession de colonnes sur toute la largeur ;
- deux nuages de points triangulaires, l’un dans son orientation source et l’autre retourné de 180 degrés ; ils créent une diagonale et perdent progressivement en densité vers le centre ;
- le fond sombre Elements-01, utilisé comme couche de profondeur ;
- un logo néon alternatif, volontairement exclu de cette sortie afin de conserver exclusivement le bloc-marque validé par le responsable scène.

Les grands exports Flamme-02 et Flamme-03 du pack reprennent le vocabulaire des flammes individuelles sous forme de masses déjà composées. Les visuels de communication montrent une relation spatiale commune : un geste dominant entre par la gauche et longe la partie haute ; un rappel plus léger reste ancré au bord droit dans la moitié basse. L’écran d’attente reprend cette relation avec les exports intacts, sans reconstruire littéralement une affiche.

Logique d’usage retenue :

- un seul petit jeu d’angles encadre le groupe message-compteur, et non le viewport ;
- les matrices de points occupent le haut droit et le bas gauche, en retrait du centre ;
- les petites sphères lumineuses sont attachées aux rails, matrices et crêtes de flammes, plutôt que dispersées au hasard ;
- les rubans et leurs halos portent l’énergie sur la périphérie haut-gauche / droite-basse ;
- le fond donne la matière, tandis que le logo, le titre et le compteur restent dans une zone centrale stable.
## Ressources disponibles

- bloc-marque officiel : disponible ;
- Flammes 01, 02 et 03 : disponibles ;
- Angle et Ligne-points : disponibles ;
- Eurostile Extended Black : disponible ;
- Gotham Black : disponible ;
- Eurostile Extended Regular : manquante.

La police manquante est visible dans l’administration. Elle ne bloque pas la V1, car aucun texte de sortie ne prétend utiliser cette graisse. Toute évolution qui l’exigerait devra attendre le fichier autorisé.

## Propositions d’implémentation V1 — à valider visuellement

### Attente

- canevas de travail 1920 × 1080 et réduction uniforme dans les aperçus ;
- centre visuel du logo autour de `y = 365 px`, dans une enveloppe maximale de 326 × 260 px adaptée au vrai ratio ;
- message centré à partir de `y = 560 px` ;
- compteur numérique seul, centré à partir de `y = 724 px`, sans libellé secondaire ;
- centre sombre, motifs concentrés sur les bords ;
- profondeur de fond issue de `Elements-01`, conservé intact et cadré derrière les autres couches ;
- un seul jeu compact de quatre angles officiels autour du groupe message-compteur, une matrice en haut à droite, une matrice en bas à gauche et deux rails latéraux courts ;
- six nœuds lumineux rattachés aux trajectoires des deux rubans, avec une dérive perceptible de quelques dizaines de pixels, dans les couleurs officielles ;
- lueur cyan discrète située derrière le logo, jamais appliquée au fichier du logo ;
- boucle GSAP déterministe de 15 secondes, sans caméra, flash, glitch ou pulsation du logo ;
- un ruban officiel dominant en haut à gauche et une volute officielle plus légère ancrée sur le bord droit dans la moitié basse, sans nappe d’énergie posée au sol ;
- aucune translation globale des flammes : leur mouvement est une déformation interne locale à deux échelles, de faible amplitude, pilotée par des fonctions périodiques qui retrouvent exactement leur état initial à 15 secondes ;
- respiration très lente de l’atmosphère périphérique et du halo placé derrière le logo ;
- dérive sinusoïdale discrète des matrices et rails, plus ample sur les nœuds lumineux attachés aux trajectoires ; toutes les phases retrouvent exactement leur état initial à 15 secondes ;
- aucune colonne de points répétitive et aucun cadre technique continu ;
- marge visuelle de sécurité de 64 px entre les rubans et les enveloppes du logo, du message et du compteur ;
- compteur piloté par une horloge distincte de la boucle décorative.

### Synthé individuel

- canevas transparent 1920 × 1080 ;
- bandeau à `x = 96 px`, marge basse de 100 px, hauteur voisine de 150 px ;
- largeur dictée par le contenu, plafonnée à 1100 px ;
- fond bleu nuit fortement opaque avec coupe angulaire, filet cyan et ponctuation orange ;
- aucun logo dans cette V1 ;
- nom/pseudonyme en Eurostile Extended Black ; fonction et organisation en Gotham Black ;
- champs secondaires réellement optionnels, sans séparateur orphelin ;
- entrée 400 ms et sortie 300 ms, sans rebond ni morphing des lettres.

### Administration

L’interface de régie utilise une police système pour les contrôles techniques et les deux polices locales pour quelques repères de marque. Elle ne fait pas partie d’une sortie de diffusion. Les damiers et fonds clair/sombre n’existent que dans les aperçus du synthé.

## Validation

Les modèles `les.attente.v1` et `les.synthe.individuel.v1` restent marqués **À valider visuellement**. Les captures, tests et mesures techniques n’équivalent pas à l’approbation artistique du responsable scène. Une modification du modèle ou d’une ressource doit incrémenter sa révision de ressource et invalider une éventuelle validation antérieure.

Règle pour les futurs écrans plein format : partir des compositions approuvées et en extraire les relations de placement — geste principal, rappel, groupe éditorial et respiration — avant d’ajouter tout motif. Ne pas déduire un habillage d’un inventaire de fichiers ni remettre par défaut de grandes flammes en bas, quatre angles de viewport ou un cadre technique continu. Les ornements doivent être justifiés par une relation visible dans les références et rester hors des enveloppes éditoriales.

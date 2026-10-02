# Direction artistique — LES Graphics Studio

Ce document sépare les règles officielles constatées dans les sources de marque des décisions d’implémentation propres à la V1. En cas de contradiction, les sources officielles priment.

## Règles officielles

Sources examinées : les exemplaires fournis de `Univers Graphique.pdf`, les fichiers de logo du dossier `Logo` et les éléments graphiques livrés avec la direction artistique.

Palette unique :

- blanc `#FAFBFB` ;
- bleu nuit / noir `#010A14` ;
- orange solaire `#FCC766` ;
- orange `#EF7B28` ;
- cyan `#01F7FD`.

Typographies nommées par la charte : Eurostile Extd Black, Eurostile Extd Regular et Gotham. Les sorties utilisent exclusivement les fichiers locaux autorisés présents dans le projet. Aucun CDN ni téléchargement de police n’est effectué en exploitation.

Le bloc-marque officiel est affiché dans ses couleurs sources, sans filtre, contour, recadrage, recoloration, redessin, extrusion, déformation ni altération du ratio. Il reste fixe et pleinement opaque. Le fichier public `public/assets/Bloc_marque_sans-fond_blanc.png` est une copie binaire intacte du fichier explicitement choisi par le responsable scène.

Les motifs officiels utilisés sont les flammes/volutes fournies. Ils restent décoratifs et ne passent pas devant le logo, le message ni le compteur. La ligne de points reste disponible mais n’est plus utilisée sur l’écran d’attente, afin de préserver une hiérarchie plus nette.

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
- centre sombre, motifs concentrés aux bords et dans la partie basse ;
- lueur cyan discrète située derrière le logo, jamais appliquée au fichier du logo ;
- boucle GSAP déterministe de 15 secondes, sans caméra, flash, glitch ou pulsation du logo ;
- une masse de flamme officielle dominante à gauche et un rappel plus léger à droite, sans troisième nappe superposée au centre ;
- aucune translation globale des flammes : leur mouvement est une déformation interne locale à deux échelles, de faible amplitude, pilotée par des fonctions périodiques qui retrouvent exactement leur état initial à 15 secondes ;
- respiration très lente de l’atmosphère basse et du halo placé derrière le logo ; aucun balayage traversant ni colonne de points ;
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

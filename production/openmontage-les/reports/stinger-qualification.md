# Qualification locale des stingers maîtres V2

Statut global : **contrôle technique effectué, revue visuelle effectuée,
approbation humaine et recette vMix en attente**.

Le pilote n’a ni régénéré les dérivés existants, ni corrigé, ni déplacé les
masters. Les deux fichiers ont conservé leur attribut lecture seule et leurs
empreintes attendues.

## Inventaire technique confirmé

| Propriété | Court | Long |
| --- | --- | --- |
| Fichier | `Stinger-V2-court-compressed.mov` | `Stinger-V2-Long-compressed.mov` |
| SHA-256 | `148513D14E94751BEC2077281CA584A9B3824A17A812D6A3658F90264998CC54` | `F5EA1ACF0140C4FF9DDAB069997A4390C4E2781785F2A8583D49E367F3185732` |
| Taille | 57 382 230 octets | 252 433 634 octets |
| Conteneur / codec | MOV / Apple ProRes 4444 | MOV / Apple ProRes 4444 |
| Format pixel | `yuva444p12le` | `yuva444p12le` |
| Définition | 1920 × 1080 | 1920 × 1080 |
| Cadence | 60/1 i/s | 60/1 i/s |
| Durée / images | 2,000 s / 120 | 5,000 s / 300 |
| Colorimétrie signalée | BT.709, plage TV, progressif | BT.709, plage TV, progressif |
| Audio | absent | absent |
| Second flux | timecode `01:00:00:00` | timecode `01:00:00:00` |

Le contrôle audio est **non applicable — silence demandé**. Le flux timecode
n’est pas une piste audio.

## Mesure alpha exhaustive

FFmpeg a décodé le canal alpha 12 bits natif ; NumPy a compté chaque valeur de
chaque image 1920 × 1080. Le contrôle porte sur 420 images et 870 912 000 pixels,
sans rééchantillonnage temporel.

| Mesure | Court | Long |
| --- | ---: | ---: |
| Première image avec alpha non nul | 1 | 1 |
| Première couverture sans pixel transparent | 64 | 64 |
| Dernière couverture sans pixel transparent | 99 | 281 |
| Dernière image avec alpha non nul | 118 | 299 |
| Première / dernière image alpha 4095 partout | aucune | aucune |
| Coupe proposée | index 78, 1 300 ms | index 78, 1 300 ms |

La fenêtre de coupe est donc couverte image par image : 64–99 inclus pour le
court et 64–281 inclus pour le long. Chaque pixel y a un alpha non nul. En
revanche, ces fenêtres ne sont pas parfaitement opaques dans les masters : sur
chaque image, 1 027 pixels de la colonne gauche valent au minimum 3967/4095,
soit environ 96,87 %, au lieu de 4095. Le défaut est présent à l’image de coupe
78 pour les deux variantes.

Le court commence à l’image 0 transparente et finit à l’image 119 transparente.
Le long commence transparent, mais sa dernière image 299 conserve 8 775 pixels
non nuls, avec un maximum alpha de 1365/4095. Le résidu est visible sur damier
comme un petit angle gris près du centre bas.

## Décomposition visuelle observée

- Entrée : repère cyan isolé, puis révélation du lion et de ses angles dans une
  plaque sombre avant l’extension plein cadre.
- Couverture : fond sombre plein cadre, logo LES central, flammes cyan/orange en
  diagonale périphérique, angles cyan et ponctuations matricielles.
- Court : maintien compact, puis retrait symétrique vers la transparence.
- Long : même ouverture, maintien prolongé et apparition du cartouche partenaires
  autour de 2,15–4,30 s ; il ne s’agit pas d’un ralenti du court.
- Sortie : retrait de la composition ; le résidu de l’image 299 du long reste
  techniquement et visuellement distinct d’une fin transparente.

Les planches natives ont été regardées sur transparence, damier, fond clair et
fond sombre. Aucun halo coloré manifeste n’est visible à l’échelle 480 × 270 par
case. Ce constat ne remplace pas une classification pixel par pixel de
l’association RGB/alpha : la prémultiplication exacte reste **non testée**. Les
preuves existantes sont compatibles avec des contours prémultipliés, mais aucun
`premultiply` ou `unpremultiply` global n’est recommandé sans test dédié.

La métadonnée BT.709/plage TV est confirmée. La conformité artistique des
niveaux, la fidélité sur la chaîne de diffusion et la lisibilité sur les sources
réelles restent à valider dans vMix.

## Constats et suites proposées

1. **Opacité imparfaite sur la colonne gauche — gravité modérée.**
   - Asset : court et long, images 64–99 / 64–281, notamment index 78.
   - Preuve : alpha minimum 3967, 1 027 pixels sous 4095 par image.
   - Correction proposée : conserver la correction minimale déjà documentée sur
     le dérivé de diffusion, limitée à la fenêtre de couverture ; ne pas modifier
     le master.
   - Nouveau contrôle : le dérivé existant annonce 4095 partout dans ces fenêtres,
     mais il n’a pas été régénéré par ce pilote.

2. **Résidu sur la dernière image longue — gravité élevée pour une fin alpha.**
   - Asset : long, index 299 à 4 983,33 ms.
   - Preuve : 8 775 pixels non nuls, maximum 1365 ; capture plein cadre sur damier.
   - Correction proposée : forcer seulement l’alpha de l’image 299 à zéro dans le
     dérivé préparé, comme le fait déjà le pipeline existant ; master intact.
   - Nouveau contrôle : le manifeste existant déclare la dernière image du dérivé
     transparente. La recette vMix reste à faire.

3. **Association RGB/alpha — investigation.**
   - Preuve : pas de frange évidente sur les planches réellement inspectées.
   - Limite : aucune mesure exhaustive des couleurs dans les pixels semi-transparents.
   - Complément : test ciblé straight/premultiplied sur les bords si une nouvelle
     conversion de codec est envisagée.

4. **Audio — non applicable.**
   - Silence demandé et absence de piste audio confirmée ; aucune piste vide ajoutée.

## Trois validations distinctes

1. **Contrôle technique : effectué.** Métadonnées, empreintes, cadence, nombre
   d’images, silence et canal alpha vérifiés.
2. **Revue visuelle et motion par l’agent : effectuée sur les captures natives.**
   Elle constate la cohérence des phases et le résidu final long ; elle ne vaut
   pas approbation graphique.
3. **Approbation humaine et recette vMix : non effectuées.** Le point de coupe à
   1 300 ms reste une proposition techniquement sûre, à tester A→B sur fonds clair,
   sombre et fortement contrasté, sur le matériel réel.

## Preuves

- Données par image : `reports/data/stinger-alpha-analysis.json`.
- Captures sans correction : `reports/proofs/native-masters/`.
- Capture du résidu long :
  `reports/proofs/native-masters/long-frame-0299-native-checker.png`.
- Copies identiques des planches préexistantes après correction étroite :
  `reports/proofs/stinger-contact-sheets/`.
- Provenance et séparation des preuves : `reports/proof-manifest.json`.

Les planches préexistantes montrent le dérivé sécurisé, car leur génération
appliquait la correction alpha étroite. Elles sont conservées comme comparaison,
pas présentées comme des captures brutes des maîtres.

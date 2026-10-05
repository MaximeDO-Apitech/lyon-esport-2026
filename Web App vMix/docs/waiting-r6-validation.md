# Validation technique — attente r6

La révision `les-da-2026-r6` remplace le bloc-marque vertical rouge et blanc par le logo horizontal entièrement blanc demandé : `DA 2026/logos/Lyon E-sport/Copie de Copie de Logo_les2022_blanc_transparent.png`.

Le fichier public est une copie binaire intacte de la source (`SHA-256 3F08D41E08330F7B00E44C8CB8A07600D7B701CD053571E101BCCED94731E721`). Son enveloppe de mise en page mesure 560 × 279 px. Comme la source contient des marges transparentes, les contrôles de collision utilisent ses limites alpha réelles : 1 698 × 895 px à partir de `(463, 246)` dans l’image source de 2 709 × 1 348 px.

Le contrôle automatisé `scripts/verify-waiting-layout.mjs` confirme :

- un canevas CSS de 1 920 × 1 080 ;
- les deux matrices, les deux rails courts et le jeu de quatre angles attendus ;
- l’absence des anciens angles de viewport et cadres continus ;
- une marge utile minimale de 68,7 px entre le logo visible et le ruban supérieur gauche ;
- toutes les marges décoratives supérieures au seuil technique de 48 px.

Les cinq captures figées de contrôle et le rapport JSON se trouvent dans `captures/waiting-r6/`. Cette validation est technique ; le modèle reste marqué « À valider visuellement » jusqu’à approbation artistique.

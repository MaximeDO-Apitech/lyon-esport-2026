# Licences et provenance

## Logiciels et code examines

- NodeCG `2.8.0` : MIT, confirme par le package npm et le [depot au commit retenu](https://github.com/nodecg/nodecg/tree/29d70b39f514d1649b27c8d0ca2281f07b63e7bd).
- Spectra Server `v0.3.5` : le fichier `LICENSE.md` est Elastic License 2.0. Le champ `license` de son `package.json` annonce encore `GPL-3.0-only`, incoherence amont a ne pas resoudre arbitrairement.
- Spectra Frontend `v0.3.6` : `LICENSE.md` Elastic License 2.0.
- Spectra Client `v0.3.4` : GPL-3.0.

Le bundle LES n'embarque aucun fichier TypeScript/Angular, asset agent, composant ou interface Spectra. Le contrat est reimplemente a partir des evenements publics consommes par le Frontend. Les noms d'evenements et formes de donnees sont necessaires a l'interoperabilite ; aucune fonctionnalite protegee, cle ou watermark n'est contourne.

Liens : [licence Server](https://github.com/ValoSpectra/Spectra-Server/blob/6e106b5585ebdca4c924c180c7aab3478a54cdf1/LICENSE.md), [licence Frontend](https://github.com/ValoSpectra/Spectra-Frontend/blob/51f6759be3fe783bace28a753df15933876e6db1/LICENSE.md), [licence Client](https://github.com/ValoSpectra/Spectra-Client/blob/a07fd0853129f548ecffc4476e19af5cd20a8988eb/LICENSE).

## Ressources graphiques

- fontes `EurostileExtendedBlack.ttf`, `EurostileExtendedRegular.ttf`, `GothamBlack.otf` : copies binaires des fichiers fournis dans `DA 2026/éléments source/typographies`. Le depot ne documente pas ici leurs droits au-dela de cette mise a disposition interne ; ne pas redistribuer separement sans verification contractuelle ;
- `reference-gameplay.jpg` : screengrab officiel inchangé provenant du [VALORANT Asset Kit](https://playvalorant.com/en-us/news/game-updates/valorant-asset-kit/), utilise seulement comme fond d'apercu/test ; Riot invite presse et createurs a utiliser ces fichiers sous reserve de son « Legal Jibber Jabber » ;
- aucune image d'agent, arme ou logo d'equipe Spectra n'est copiee ; les logos distants sont refuses par defaut et ne sont affiches que pour des hotes HTTPS explicitement autorises.

Ce document consigne la provenance technique, pas un avis juridique ni une approbation Riot.

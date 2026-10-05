# Pack replay Lyon e-Sport 2026

Statut : **prototype fonctionnel — à valider visuellement et sur le preset vMix réel**.

Le pack comprend trois éléments indépendants. Il n’impose aucune durée de replay et ne pilote aucune source vidéo.

| Élément | Identifiant | Durée | Coupe | Sortie web | Livrable de secours |
|---|---|---:|---:|---|---|
| Entrée replay | `replay-in-les` | 800 ms | 400 ms | `/output/replay-in` | 48 PNG RGBA à 60 i/s |
| Marqueur | `replay-marker-les` | persistant | — | `/output/replay-marker` | PNG RGBA 1920 × 1080 |
| Sortie replay | `replay-out-les` | 600 ms | 300 ms | `/output/replay-out` | 36 PNG RGBA à 60 i/s |

La cadence de 60 i/s est celle du prototype. Elle doit être confirmée avec la cadence réelle du preset et des sorties vMix.

## Fichiers livrés

- `deliverables/replay-pack-les/v1/replay-in-les/png-sequence/`
- `deliverables/replay-pack-les/v1/replay-out-les/png-sequence/`
- `deliverables/replay-pack-les/v1/replay-marker-les/replay-marker-les.png`
- `deliverables/replay-pack-les/v1/demo-replay-complet.gif`
- `deliverables/replay-pack-les/v1/manifest.json`
- un `manifest.json` et un `verification.json` dans chaque dossier de composant

Les séquences PNG sont générées localement par `npm run export:replay`. Elles ne sont pas versionnées afin d’éviter d’alourdir le dépôt. Les manifestes, vérifications, miniatures, PNG de secours et GIF de démonstration sont conservés.

## Chargement des transitions dans vMix

La documentation officielle vMix recommande l’entrée **Image Sequence / Stinger** pour une animation avec canal alpha. vMix charge la suite à partir du premier fichier numéroté. Références : [Image Sequence / Stinger](https://www.vmix.com/help29/ImageSequence.html) et [Stinger Transitions](https://www.vmix.com/help29/StingerTransitions.html).

Avant toute affectation :

1. Ouvrir une copie du preset vMix de production.
2. Relever les banques **Stinger 1 / Stinger 2** déjà utilisées.
3. Ne jamais remplacer le stinger principal LES ni une transition existante sans validation.
4. Affecter les éléments replay uniquement aux banques réellement libres.

Pour l’entrée :

1. **Add Input → Image Sequence / Stinger**.
2. Sélectionner `replay-in-les-0001.png`.
3. Vérifier que vMix détecte les 48 images et le canal alpha.
4. Dans les paramètres Stinger, choisir l’entrée créée.
5. Régler **Effect = Cut**, **Duration = 800 ms**, **Stinger Cut Point = 400 ms**.
6. Tester la bascule du direct A vers le replay B.

Pour la sortie :

1. Ajouter une seconde entrée **Image Sequence / Stinger**.
2. Sélectionner `replay-out-les-0001.png`.
3. Vérifier les 36 images et le canal alpha.
4. Régler **Effect = Cut**, **Duration = 600 ms**, **Stinger Cut Point = 300 ms**.
5. Tester la bascule du replay C vers le direct A.

La case **Display underneath overlays** détermine si le stinger passe sous les overlays actifs. Pour que la transition masque aussi le marqueur replay et les synthés, cette case doit rester décochée. Ce comportement doit cependant être vérifié sur le preset réel avant diffusion.

vMix expose seulement les banques disponibles dans le preset et l’édition utilisée. Si le stinger principal occupe déjà une banque et qu’il n’en reste pas deux, ne pas écraser sa configuration. Conserver les deux entrées replay non affectées et décider en répétition d’un workflow validé : preset dédié replay, réaffectation contrôlée, ou orchestration overlay/coupe séparée. Aucune de ces décisions n’est codée automatiquement dans l’application.

## Chargement du marqueur dans vMix

### Option recommandée : sortie web persistante

La sortie web conserve l’animation de 150 ms à l’entrée, 130 ms à la sortie et la position publiée depuis le pupitre.

1. Ajouter une entrée **Web Browser**.
2. URL : `http://ADRESSE_DU_SERVEUR:PORT/output/replay-marker`.
3. Largeur : **1920** ; hauteur : **1080**.
4. Vérifier la transparence sur une mire claire puis sombre.
5. Affecter cette entrée à un Overlay disponible.
6. Régler l’Overlay sur **Fullscreen**, effet **Cut**, durée d’effet minimale et **Duration = 0** pour désactiver la fermeture automatique.
7. Activer l’Overlay une fois au début de l’exploitation. Les boutons du pupitre contrôlent ensuite le contenu interne sans retirer l’entrée vMix.

La sortie Web Browser vMix prend en charge les fonds transparents et le canal alpha. Références : [Web Browser](https://www.vmix.com/help29/WebBrowser.html) et [Overlays](https://www.vmix.com/help29/Overlay2.html).

### Option de secours : PNG fixe

Ajouter `replay-marker-les.png` comme entrée Image et l’utiliser comme Overlay. Le PNG respecte la position par défaut en haut à gauche, mais n’offre ni animation ni position publiée depuis l’application. L’opérateur doit alors afficher et masquer directement l’Overlay vMix.

### Arrêt d’urgence

Le bouton **Masquer immédiatement** du pupitre force l’état interne à `hidden` sans animation. Si l’application ou le réseau ne répond plus, utiliser directement **Overlay Input Off** dans vMix sur l’entrée marqueur. Ce geste reste le dernier niveau de sécurité.

## Pupitre et API

Pupitre : `/admin/control`  
Banc de test sans ordre programme : `/preview/replay`

Le pupitre sépare :

- le brouillon de position ;
- la prévisualisation ;
- la position publiée au programme ;
- les commandes explicites Afficher, Masquer et Masquer immédiatement.

Une publication de position n’affiche jamais automatiquement le marqueur. Une commande d’affichage ne change jamais la source replay. Le message « Commande graphique appliquée » confirme uniquement l’état de l’application, pas l’état du mixeur ni la source réellement à l’antenne.

Endpoint : `POST /api/replay/command`  
Content-Type : `application/json`

Afficher :

```json
{
  "id": "companion:marker.show:IDENTIFIANT_UNIQUE",
  "type": "marker.show"
}
```

Masquer avec animation :

```json
{
  "id": "companion:marker.hide:IDENTIFIANT_UNIQUE",
  "type": "marker.hide"
}
```

Masquer immédiatement :

```json
{
  "id": "companion:marker.hide.immediate:IDENTIFIANT_UNIQUE",
  "type": "marker.hide.immediate"
}
```

Chaque pression doit fournir un identifiant différent composé uniquement de lettres, chiffres, points, tirets bas, deux-points ou tirets. Une commande `show` reçue alors que le marqueur est déjà visible ne rejoue pas l’animation d’entrée.

Si `LES_ADMIN_TOKEN` est configuré, ajouter :

```http
Authorization: Bearer VOTRE_JETON
```

## Configuration Companion

Utiliser une connexion **Generic HTTP Requests**. Le module officiel permet les requêtes POST, un corps JSON, le Content-Type et des headers personnalisés : [documentation du module Generic HTTP](https://github.com/bitfocus/companion-module-generic-http/blob/master/companion/HELP.md).

Configuration conseillée :

- Base URL : `http://ADRESSE_DU_SERVEUR:PORT/`
- Method : **POST**
- URI : `api/replay/command`
- Content Type : **application/json**
- Body : l’un des trois objets ci-dessus
- Header si nécessaire : `{"Authorization":"Bearer VOTRE_JETON"}`

Remplacer `IDENTIFIANT_UNIQUE` par une variable Companion qui produit une valeur ASCII différente à chaque pression. Vérifier la syntaxe de variable disponible dans la version de Companion installée ; ne pas utiliser un identifiant statique, car l’API mémorise les commandes pour garantir l’idempotence.

Boutons recommandés :

1. **REPLAY IN** : déclenche la transition d’entrée vMix vers la source replay sélectionnée.
2. **REPLAY MARK ON** : POST `marker.show`.
3. **REPLAY ANGLE** : change uniquement la source/angle replay dans vMix ; le marqueur reste affiché.
4. **REPLAY OUT** : lance la sortie vMix vers le direct.
5. **REPLAY MARK OFF** : POST `marker.hide`, à envoyer sous la couverture de sortie.
6. **PANIC REPLAY OFF** : POST `marker.hide.immediate`, doublé si possible d’un **Overlay Input Off** vMix.

Ne pas créer de macro avec une durée fixe entre l’entrée et la sortie : la durée dépend du contenu réellement rejoué.

## Check-list de répétition

- Tester en progressif à la cadence exacte du preset.
- Confirmer l’ordre de numérotation des PNG.
- Confirmer 800/400 ms pour l’entrée et 600/300 ms pour la sortie.
- Vérifier l’opacité totale au moment des deux coupes.
- Vérifier le marqueur sur image claire, sombre et en mouvement.
- Vérifier le passage B → C sans disparition ni rejeu du marqueur.
- Vérifier une sortie anticipée.
- Vérifier que le stinger passe au-dessus des overlays attendus.
- Vérifier le masquage d’urgence vMix sans réseau.
- Tester les raccourcis Companion avec de vrais identifiants uniques.
- Conserver une copie du preset vMix avant toute affectation.


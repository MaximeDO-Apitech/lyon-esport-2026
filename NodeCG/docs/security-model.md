# Modele de securite

## Frontiere serveur/navigateur

Le bundle n'utilise pas `nodecg.bundleConfig` pour la connexion Spectra : selon le contexte NodeCG, une configuration de bundle peut etre accessible aux surfaces clientes. `LES_SPECTRA_ENDPOINT`, `LES_SPECTRA_GROUP_CODE` et la liste d'hotes restent donc dans l'environnement du processus extension.

Les navigateurs recoivent seulement :

- un indice masque du groupe, jamais le code complet ;
- un statut de connexion sans URL Spectra ;
- le modele normalise necessaire au HUD ;
- la presentation et les diagnostics agreges.

Le payload brut, `groupSecret`, token d'organisation, secrets playercam, URL privees non autorisees et champs inconnus ne sont jamais copies dans les Replicants ni journalises. L'adaptateur construit une allowlist de champs au lieu de retirer quelques champs d'un objet brut.

## Commandes et Replicants

Les panneaux fournis envoient des messages NodeCG. L'extension valide types, bornes, action et identifiant, puis deduplique les 200 derniers identifiants. Les schemas JSON valident aussi chaque mutation de Replicant.

Limite importante : NodeCG 2.8 ne transforme pas un Replicant en objet cryptographiquement « lecture seule » pour un client authentifie. L'absence de champs editables dans l'UI ne suffit donc pas a securiser l'ecriture. Il faut considerer tout acces dashboard/graphic comme privilegie, activer l'authentification NodeCG hors boucle locale et ne pas exposer Socket.IO NodeCG a Internet. Le graphique fourni n'ecrit jamais les Replicants ; les commandes passent par l'extension.

## Reseau et ressources

- configuration livree : bind `127.0.0.1:9090`, sans exposition LAN ;
- LAN : exemple d'authentification locale et `forceHttpsReturn`, a completer hors Git avec un vrai secret et un reverse proxy/TLS ;
- endpoint Spectra : seulement `http`/`https`, aucun identifiant dans l'URL ;
- logos : seulement HTTPS et nom d'hote explicitement present dans `LES_SPECTRA_ASSET_HOSTS` ; vide par defaut ;
- aucun proxy d'URL, CDN de developpement, IA, OpenMontage ou HyperFrames en execution ;
- fontes et fixture locales ; le fond gameplay n'est charge que par le parametre d'apercu explicite ;
- etat live `persistent:false`, donc aucun ancien score n'est relu du disque ; au redemarrage, le programme est force masque avec urgence transparente meme si la configuration graphique etait persistee.

## Dependances

Les versions directes sont exactes dans `package.json` et transitives verrouillees par `package-lock.json`. Le resultat `npm audit --omit=dev` et sa decision de non-downgrade sont consignes dans `test-report.md`. Refaire l'audit avant l'ouverture LAN et a chaque mise a jour NodeCG.

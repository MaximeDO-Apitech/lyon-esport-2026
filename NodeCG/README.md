# LES Valorant — bundle NodeCG

Ce dossier est un vrai projet/bundle NodeCG autonome. Spectra reste la source de verite du match ; l'extension ouvre l'unique connexion amont, valide et normalise ses snapshots ; les panneaux et le graphique ne parlent qu'a NodeCG. La video de jeu ne traverse jamais ce bundle.

## Demarrage local sur la regie

Prerequis testes : Node.js `24.20.0` sur Windows, NodeCG `2.8.0` verrouille dans `package-lock.json`. NodeCG documente Node.js 22 comme version d'installation ; le projet conserve `>=22` et a aussi ete demarre avec la version 24 installee.

```powershell
cd "C:\Users\maximed\Documents\Lyon e-Sport 2026\NodeCG"
npm ci
npm run check

$env:LES_SPECTRA_PROFILE = "production"
$env:LES_SPECTRA_ENDPOINT = "http://ADRESSE_DU_SERVEUR_SPECTRA:5200"
$env:LES_SPECTRA_PATH = "/socket.io"
npm start
```

Le code de groupe peut etre fourni temporairement par `LES_SPECTRA_GROUP_CODE` ou saisi dans le panneau **VALORANT — Connexion**. Il n'est pas publie dans un Replicant et seul un indice masque est visible.

Routes locales exactes :

- Dashboard NodeCG : `http://127.0.0.1:9090/` ;
- graphique vMix : `http://127.0.0.1:9090/bundles/les-valorant/graphics/hud.html` ;
- apercu synthetique isole : `http://127.0.0.1:9090/bundles/les-valorant/graphics/hud.html?surface=preview&fixture=synthetic&backdrop=reference`.

Le `cfg/nodecg.json` livre volontairement une ecoute sur `127.0.0.1`. Pour separer regie et vMix sur le LAN, activer l'authentification NodeCG et TLS/reverse proxy a partir de `config/nodecg.lan-auth.example.json` ; ne pas exposer une instance anonyme sur Internet.

## Commandes

```powershell
npm run build
npm run typecheck
npm test
npm run check
npm start
```

`npm start` compile avant de lancer NodeCG. Les sorties de compilation, la base SQLite, les logs et les secrets locaux sont ignores par Git.

## Organisation

- `src/spectra-connector.ts` : une connexion Socket.IO, logon, reconnexion et nettoyage ;
- `src/adapter.ts` : validation defensive et modele de vue autorise ;
- `src/snapshot-buffer.ts` : delai coherent de tout le snapshot ;
- `src/presentation.ts` : commandes de programme/apercu validees ;
- `src/index.ts` : Replicants, messages et orchestration ;
- `dashboard/` : connexion, controle, diagnostic et apercu ;
- `graphics/` : HUD transparent fixe 1920 × 1080 ;
- `schemas/` : schemas JSON des quatre Replicants ;
- `tests/` : contrat, donnees partielles, presentation, tampon et connexion unique.

Documentation detaillee :

- [architecture et comparaison](docs/architecture-comparison.md) ;
- [contrat Spectra](docs/spectra-contract.md) ;
- [matrice des donnees](docs/data-capability-matrix.md) ;
- [exploitation, vMix et retour arriere](docs/operator-runbook.md) ;
- [audit HUD natif et modes](docs/hud-cohabitation.md) ;
- [modele de securite](docs/security-model.md) ;
- [tests et limites](docs/test-report.md) ;
- [licences et provenance](docs/licenses-and-provenance.md).

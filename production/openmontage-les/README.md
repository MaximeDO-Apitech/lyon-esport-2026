# Atelier OpenMontage — profil Lyon e-Sport

Ce dossier relie OpenMontage à l’atelier de production LES sans introduire de
dépendance dans l’application de diffusion `Web App vMix`.

## Périmètre

- OpenMontage prépare, analyse et documente des médias hors programme.
- Les fichiers maîtres restent externes, en lecture seule et identifiés par SHA-256.
- Aucun résultat n’est publié ni sélectionné automatiquement dans vMix.
- Les opérations autorisées par `run-local.ps1` sont locales et à coût API nul.
- Les productions lourdes, Backlot et les journaux restent hors du chemin de rendu live.

## Commandes reproductibles

Depuis la racine du dépôt :

```powershell
& ".\production\openmontage-les\run-local.ps1" offline-preflight
& ".\production\openmontage-les\run-local.ps1" validate-profile
& ".\production\openmontage-les\run-local.ps1" budget-test
& ".\production\openmontage-les\run-local.ps1" stinger-audit
& ".\production\openmontage-les\run-local.ps1" stinger-captures
```

Backlot reste un tableau séparé et facultatif :

```powershell
& ".\production\openmontage-les\run-local.ps1" backlot
```

`stinger-audit` lit par défaut les deux maîtres dans
`C:\Users\maximed\Downloads`. Des chemins alternatifs peuvent être fournis avec
`-ShortMaster` et `-LongMaster`.

## Contenu

- `profile/les-playbook.yaml` : profil compatible avec le schéma de playbook
  OpenMontage installé ;
- `profile/production-contract.md` : règles LES que le schéma générique ne sait
  pas exprimer sans ambiguïté ;
- `policy/zero-cost-policy.json` : périmètre local et budget nul ;
- `schemas/les-asset-handoff.schema.json` : contrat proposé pour un futur import
  contrôlé dans la bibliothèque ;
- `reports/` : audit de l’installation et qualification du pilote ;
- `scripts/` : contrôles reproductibles, sans modification des maîtres.

Les fichiers JSON générés dans `reports/data/` sont des preuves techniques. Ils
ne valent ni approbation artistique, ni recette vMix.

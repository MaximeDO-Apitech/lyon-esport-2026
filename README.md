# Écran d’attente animé — Lyon e-Sport 2026

Source navigateur 16:9 conçue pour vMix. Le logo officiel utilisé est une copie binaire intacte de `Logo/Logo/Bloc_marque_sans-fond_blanc.png`.

## Lancer en local

```powershell
npm run dev
```

- Sortie propre : `http://localhost:3000/`
- Contrôle régie : `http://localhost:3000/control`

Le port exact est indiqué par le serveur au démarrage.

## Paramètres de sortie

- Heure cible locale : `/?target=2026-11-13T19:00:00`
- Durée à partir du chargement, en secondes : `/?duration=900`
- Zone réservée sans valeur : `/`
- Compteur masqué : `/?countdown=off`

## vMix

Ajouter une entrée **Web Browser** en 1920 × 1080, à 30 fps, sans audio. Utiliser l’URL préparée dans `/control`.

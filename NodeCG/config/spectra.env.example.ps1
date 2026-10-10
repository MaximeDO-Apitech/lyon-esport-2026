# Profil sans secret. Copier les valeurs dans la session PowerShell de la regie.
$env:LES_SPECTRA_PROFILE = "production"
$env:LES_SPECTRA_ENDPOINT = "http://127.0.0.1:5200"
$env:LES_SPECTRA_PATH = "/socket.io"

# Le code de groupe peut etre laisse vide puis saisi dans le panneau Connexion.
# Ne jamais committer la vraie valeur.
$env:LES_SPECTRA_GROUP_CODE = ""

# Liste explicite, separee par des virgules, des hotes HTTPS autorises pour les logos.
# Vide par defaut : les logos distants sont masques sans casser le HUD.
$env:LES_SPECTRA_ASSET_HOSTS = ""

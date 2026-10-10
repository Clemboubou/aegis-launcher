# Publie une nouvelle version du launcher : construit l'installeur, puis crée la version correspondante
# sur GitHub. Les launchers déjà installés la téléchargent et s'installent seuls à leur prochain démarrage.
# Avant de lancer ce script : augmenter « version » dans package.json.
# -Essai : construit l'installeur sans rien publier.
param([switch]$Essai)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$racine = Split-Path $PSScriptRoot -Parent
Set-Location $racine

function Arreter($message) {
  Write-Host ''
  Write-Host $message -ForegroundColor Red
  exit 1
}

foreach ($outil in @(
    @{ nom = 'npm'; aide = 'Node.js est introuvable. Installez la version LTS depuis https://nodejs.org, puis relancez.' },
    @{ nom = 'gh'; aide = 'GitHub CLI est introuvable. Installez-le (winget install GitHub.cli), connectez-vous avec « gh auth login », puis relancez.' })) {
  if (-not (Get-Command $outil.nom -ErrorAction SilentlyContinue)) { Arreter $outil.aide }
}

$version = (Get-Content (Join-Path $racine 'package.json') -Raw | ConvertFrom-Json).version
$etiquette = "v$version"

if (-not $Essai) {
  gh release view $etiquette *> $null
  if ($LASTEXITCODE -eq 0) { Arreter "La version $version est déjà publiée. Augmentez « version » dans package.json, puis relancez." }
  if (git status --porcelain) { Arreter 'Des modifications ne sont pas encore envoyées sur GitHub. Publiez-les (git commit, git push), puis relancez.' }
}

Write-Host "Construction du launcher $version..."
if (-not (Test-Path (Join-Path $racine 'node_modules'))) { npm install --no-audit --no-fund | Out-Null }
npm run dist | Out-Null
if ($LASTEXITCODE -ne 0) { Arreter 'La construction a échoué. Relancez « npm run dist » pour voir le détail.' }

# Les trois fichiers dont les launchers installés ont besoin pour se mettre à jour.
$dist = Join-Path $racine 'dist'
$fichiers = @("Aegis-Launcher-Setup-$version.exe", "Aegis-Launcher-Setup-$version.exe.blockmap", 'latest.yml') | ForEach-Object { Join-Path $dist $_ }
foreach ($fichier in $fichiers) {
  if (-not (Test-Path $fichier)) { Arreter "Fichier manquant après la construction : $fichier" }
}

if ($Essai) {
  Write-Host ''
  Write-Host "Essai terminé : l'installeur est dans dist\, rien n'a été publié." -ForegroundColor Green
  exit 0
}

gh release create $etiquette $fichiers --title "Aegis Launcher $version" --notes "Mise à jour du launcher."
if ($LASTEXITCODE -ne 0) { Arreter 'La publication sur GitHub a échoué. Vérifiez la connexion et vos droits sur le dépôt.' }

Write-Host ''
Write-Host "Version $version publiée. Les launchers installés se mettront à jour à leur prochain démarrage." -ForegroundColor Green
Write-Host "Pour un nouveau joueur, l'installeur est : dist\Aegis-Launcher-Setup-$version.exe"

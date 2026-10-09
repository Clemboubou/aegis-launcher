# Publie le pack de mods : tout fichier .jar déposé dans pack\mods est ajouté au pack,
# tout mod retiré de pack\mods en est enlevé, puis le pack est envoyé sur GitHub.
# -Essai : fait tout sauf l'envoi (rien n'est publié).
param([switch]$Essai)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$racine = Split-Path $PSScriptRoot -Parent
$pack = Join-Path $racine 'pack'
$mods = Join-Path $pack 'mods'
$packwiz = Join-Path $racine 'tools\packwiz\packwiz.exe'

function Arreter($message) {
  Write-Host ''
  Write-Host $message -ForegroundColor Red
  exit 1
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Arreter 'Git est introuvable. Installez-le depuis https://git-scm.com/download/win, puis relancez.'
}

# packwiz n'est pas dans le dépôt : il est téléchargé à la première utilisation.
if (-not (Test-Path $packwiz)) {
  Write-Host 'Téléchargement de packwiz...'
  $dossier = Split-Path $packwiz -Parent
  New-Item -ItemType Directory -Force $dossier | Out-Null
  $zip = Join-Path $dossier 'packwiz.zip'
  Invoke-WebRequest 'https://nightly.link/packwiz/packwiz/workflows/go/main/Windows%2064-bit.zip' -OutFile $zip
  Expand-Archive $zip $dossier -Force
  Remove-Item $zip
}

Set-Location $racine

# Récupère d'abord les changements publiés par quelqu'un d'autre.
if (-not $Essai) {
  git pull --quiet --rebase --autostash
  if ($LASTEXITCODE -ne 0) { Arreter 'Impossible de récupérer la dernière version du dépôt. Vérifiez la connexion et vos droits.' }
}

Set-Location $pack

# Un .jar connu de Modrinth est remplacé par une simple référence : les joueurs le téléchargeront
# depuis Modrinth. Un .jar inconnu reste dans le pack et sera distribué depuis GitHub.
foreach ($jar in Get-ChildItem $mods -Filter *.jar -ErrorAction SilentlyContinue) {
  $empreinte = (Get-FileHash $jar.FullName -Algorithm SHA1).Hash.ToLower()
  $version = $null
  try { $version = Invoke-RestMethod "https://api.modrinth.com/v2/version_file/$($empreinte)?algorithm=sha1" } catch {}
  if ($version) {
    Write-Host "$($jar.Name) : trouvé sur Modrinth."
    & $packwiz modrinth add --project-id $version.project_id --version-id $version.id -y | Out-Null
    if ($LASTEXITCODE -ne 0) { Arreter "packwiz n'a pas pu ajouter $($jar.Name)." }
    Remove-Item $jar.FullName
  } else {
    Write-Host "$($jar.Name) : inconnu de Modrinth, il sera distribué depuis GitHub." -ForegroundColor Yellow
    if ($jar.Length -gt 95MB) { Arreter "$($jar.Name) dépasse 95 Mo, la limite de GitHub pour un fichier." }
  }
}

& $packwiz refresh | Out-Null
if ($LASTEXITCODE -ne 0) { Arreter 'packwiz n''a pas pu mettre le pack à jour.' }

Set-Location $racine
git add pack
$changements = @(git diff --cached --name-status -- pack/mods)
if (-not (git diff --cached --name-only -- pack)) {
  Write-Host ''
  Write-Host 'Rien à publier : le pack est déjà à jour.'
  exit 0
}

# Résumé lisible : un mod par ligne, avec ce qui lui arrive.
$libelles = @{ A = 'ajouté'; D = 'retiré'; M = 'mis à jour' }
$resume = foreach ($ligne in $changements) {
  $etat, $fichier = $ligne -split "`t", 2
  $nom = [IO.Path]::GetFileName($fichier) -replace '\.pw\.toml$|\.jar$', ''
  "$nom ($($libelles[$etat.Substring(0, 1)]))"
}
Write-Host ''
Write-Host 'Changements :'
$resume | ForEach-Object { Write-Host "  $_" }

if ($Essai) {
  git reset --quiet -- pack
  Write-Host ''
  Write-Host 'Essai : rien n''a été publié.'
  exit 0
}

$message = if ($resume) { "Pack : $($resume -join ', ')" } else { 'Pack : mise à jour' }
git commit --quiet -m $message
git push --quiet
if ($LASTEXITCODE -ne 0) { Arreter 'L''envoi vers GitHub a échoué. Vérifiez la connexion et vos droits sur le dépôt.' }

Write-Host ''
Write-Host 'Pack publié. Les joueurs le recevront à leur prochain lancement.' -ForegroundColor Green
Write-Host 'Pensez à installer les mêmes mods sur le serveur.'

# Aegis Launcher

Launcher du serveur Minecraft Aegis (RP post-apocalyptique). Prototype Electron.

## Lancer

```
npm install
npm start
```

## Ce que fait le prototype

- Connexion à un compte Microsoft (jeton de rafraîchissement chiffré par Windows).
- Installation de Java 17, Minecraft 1.20.1 et Forge dans `%APPDATA%\.aegis\bin`.
- Vérification et réparation des fichiers à chaque lancement.
- Lancement du jeu dans `%APPDATA%\.aegis\game` (mods, config, saves).
- Réglage de la mémoire allouée.

## Configuration

`launcher.config.json` : nom, version de Minecraft et de Forge, adresse du serveur (connexion directe au lancement si `server.host` est rempli), liens.

## Tests

- `npm run test:install` : installe le jeu hors interface et vérifie la commande de lancement.
- `AEGIS_HIDDEN=1` avec `--remote-debugging-port=9334`, puis `node scripts/screenshot.js sortie.png` : capture l'interface sans afficher la fenêtre.

## Pas encore fait

- Synchronisation du modpack depuis un manifeste.
- Mise à jour automatique du launcher, installeur, icône.
- Application Azure dédiée (le prototype utilise l'identifiant par défaut de `msmc`).

Non affilié à Mojang ni à Microsoft.

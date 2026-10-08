# Aegis Launcher

**NOT AN OFFICIAL MINECRAFT PRODUCT. NOT APPROVED BY OR ASSOCIATED WITH MOJANG OR MICROSOFT.**

Aegis Launcher is a free, open-source launcher for a single community Minecraft: Java Edition roleplay server (Aegis, post-apocalyptic RP, Minecraft 1.20.1 with Forge).

- Players sign in with their own Microsoft account. The launcher checks that the account owns Minecraft: Java Edition. There is no offline mode.
- The game, its libraries, its assets and the Java runtime are downloaded from the official Mojang servers, and Forge from the official Forge servers. The launcher does not redistribute any game file.
- The launcher does not bypass or disable any authentication, licence or safety check.

Publisher: Clemboubou. Contact: [open an issue](https://github.com/Clemboubou/aegis-launcher/issues).

---

## En français

Launcher du serveur Minecraft Aegis (RP post-apocalyptique). Prototype Electron, non affilié à Mojang ni à Microsoft.

### Lancer

```
npm install
npm start
```

### Ce que fait le prototype

- Connexion à un compte Microsoft (jeton de rafraîchissement chiffré par Windows).
- Installation de Java 17, Minecraft 1.20.1 et Forge dans `%APPDATA%\.aegis\bin`.
- Vérification et réparation des fichiers à chaque lancement.
- Lancement du jeu dans `%APPDATA%\.aegis\game` (mods, config, saves).
- Réglage de la mémoire allouée.

### Configuration

`launcher.config.json` : nom, version de Minecraft et de Forge, application Azure utilisée pour la connexion, adresse du serveur (connexion directe au lancement si `server.host` est rempli), liens.

### Tests

- `npm run test:install` : installe le jeu hors interface et vérifie la commande de lancement.
- `AEGIS_HIDDEN=1` avec `--remote-debugging-port=9334`, puis `node scripts/screenshot.js sortie.png` : capture l'interface sans afficher la fenêtre.

### Pas encore fait

- Synchronisation du modpack depuis un manifeste.
- Mise à jour automatique du launcher, installeur, icône.

## Licence

[MIT](LICENSE)

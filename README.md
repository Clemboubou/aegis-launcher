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

### Deux moteurs

`engine` dans `launcher.config.json` choisit qui fait la connexion et le lancement. L'interface est la même dans les deux cas.

- `prism` (actif) : Aegis installe [Prism Launcher](https://prismlauncher.org) dans `%APPDATA%\.aegis\prism` et le pilote. La connexion Microsoft se fait dans une fenêtre Prism, une seule fois ; Prism installe Java, Minecraft et Forge, puis lance le jeu avec la mémoire choisie dans Aegis. [packwiz](https://packwiz.infra.link) met les mods à jour avant chaque lancement.
- `native` : Aegis fait tout lui-même (connexion Microsoft, installation dans `%APPDATA%\.aegis\bin`, lancement dans `%APPDATA%\.aegis\game`). Utilisable quand l'application Azure du launcher aura été approuvée par Mojang.

### Modifier le pack de mods

Les mods sont décrits dans `pack\`. Avec le binaire packwiz placé dans `tools\packwiz\`, depuis le dossier `pack\` :

```
..\tools\packwiz\packwiz.exe modrinth add <nom du mod>
..\tools\packwiz\packwiz.exe remove <nom du mod>
..\tools\packwiz\packwiz.exe refresh
```

Les joueurs reçoivent le changement au lancement suivant, une fois `pack\` poussé sur la branche `main`. En développement (`npm start`), le pack est lu directement dans le dépôt local.

### Configuration

`launcher.config.json` : nom, version de Minecraft et de Forge, moteur, adresse publique du pack (`packUrl`), version de Prism et son empreinte, application Azure du moteur natif, adresse du serveur (connexion directe au lancement si `server.host` est rempli), liens.

### Tests

- `npm run test:install` : installe le jeu hors interface et vérifie la commande de lancement.
- `AEGIS_HIDDEN=1` avec `--remote-debugging-port=9334`, puis `node scripts/screenshot.js sortie.png` : capture l'interface sans afficher la fenêtre.

### Pas encore fait

- Mise à jour automatique du launcher.
- Synchronisation des mods pour le moteur natif.

## Licence

[MIT](LICENSE)

# Guide du launcher Aegis

Ce guide s'adresse à la personne qui administre le serveur Aegis. Il explique comment fonctionne le launcher, ce qui est déjà en place, et comment ajouter des mods pour que tous les joueurs les reçoivent automatiquement.

## En bref

- Les joueurs installent **Aegis Launcher**, se connectent une fois avec leur compte Microsoft, puis cliquent sur **Jouer**.
- Le launcher installe tout seul Java, Minecraft 1.20.1, Forge 47.4.10 et les mods.
- La liste des mods est stockée dans le dossier `pack\` du dépôt GitHub. Quand vous la modifiez et la publiez, chaque joueur reçoit le changement à son prochain lancement, sans rien réinstaller.
- Le serveur doit rester en mode en ligne (`online-mode=true`) : le launcher ne fonctionne qu'avec des comptes Minecraft officiels.

## Comment ça marche

Le launcher a deux parties.

**L'interface Aegis** est ce que voit le joueur : le fond, le bouton **Se connecter** ou **Jouer**, et les réglages (mémoire allouée, dossier du jeu).

**Prism Launcher** est le moteur caché. C'est un launcher libre, déjà autorisé par Mojang à connecter des comptes Microsoft. Aegis le télécharge au premier démarrage et le pilote :

1. Au clic sur **Se connecter**, une fenêtre Prism s'ouvre pour la connexion Microsoft. Elle se referme seule une fois le compte enregistré. Cette étape n'a lieu qu'une fois.
2. Au clic sur **Jouer**, Aegis transmet à Prism la mémoire choisie, puis Prism installe ce qui manque et lance le jeu. Les fenêtres de Prism sont masquées : le joueur ne voit que la barre « Préparation du jeu » d'Aegis, puis Minecraft. Si rien n'avance pendant 90 secondes (long téléchargement du premier lancement, ou erreur), la fenêtre de Prism est réaffichée pour montrer ce qui se passe.
3. Juste avant le lancement, un outil appelé **packwiz** compare les mods du joueur avec la liste publiée, télécharge les nouveaux, met à jour ceux qui ont changé et retire ceux qui ont été supprimés.

Tout est rangé chez le joueur dans `%APPDATA%\.aegis`. Son dossier de jeu (sauvegardes, captures, options) se trouve dans `%APPDATA%\.aegis\prism\instances\Aegis\.minecraft`.

## Ce qui est déjà fait

- L'interface, avec connexion, bouton Jouer et réglage de la mémoire.
- L'installation automatique de Prism, de Java, de Minecraft et de Forge.
- La mise à jour automatique des mods, avec deux mods de test dans le pack (JEI et sa dépendance MezzConfig).
- L'installeur Windows (`Aegis Launcher Setup <version>.exe`) et une version sans installation (`Aegis Launcher.exe`).
- Le dépôt public : `https://github.com/Clemboubou/aegis-launcher`.

## Ce qui reste à faire

- **Adresse du serveur.** Elle n'est pas encore renseignée, donc le jeu s'ouvre sur le menu principal. Une fois renseignée, le jeu rejoint le serveur directement (voir « Changer l'adresse du serveur »).
- **Liste des mods définitive.** Remplacer les deux mods de test par ceux du serveur.
- **Mise à jour du launcher lui-même.** Elle n'est pas automatique : une nouvelle version du launcher doit être redistribuée aux joueurs. Cela ne concerne pas les mods, qui se mettent à jour seuls.

## Ce qu'il vous faut pour gérer les mods

1. **Un compte GitHub avec le droit d'écrire dans le dépôt.** Demandez à être ajouté comme collaborateur du dépôt `Clemboubou/aegis-launcher`.
2. **Git** : `https://git-scm.com/download/win`

Récupérez ensuite le projet, une seule fois :

```
git clone https://github.com/Clemboubou/aegis-launcher
```

## La méthode simple : `Publier.cmd`

1. Déposez les fichiers `.jar` des mods à ajouter dans le dossier `pack\mods\` du projet.
2. Pour retirer un mod, supprimez son fichier dans ce même dossier (`<nom>.pw.toml`, ou le `.jar`).
3. Double-cliquez sur `Publier.cmd`, à la racine du projet.

Le script affiche la liste des changements, puis les envoie sur GitHub. Chaque joueur les reçoit à son prochain clic sur **Jouer**. Il n'y a ni launcher à reconstruire, ni fichier à envoyer.

Ce que fait le script :

- Il récupère d'abord la dernière version du dépôt, au cas où quelqu'un d'autre aurait publié.
- Il télécharge packwiz à la première utilisation.
- Pour chaque `.jar`, il cherche le mod sur Modrinth à partir de son empreinte. S'il le trouve, il remplace le fichier par une simple référence (`<nom>.pw.toml`) : les joueurs téléchargeront le mod depuis Modrinth, et ses dépendances sont ajoutées automatiquement.
- Un `.jar` inconnu de Modrinth reste dans le pack et sera distribué depuis GitHub. Vérifiez alors que sa licence autorise la redistribution, puisque le dépôt est public. La limite est de 95 Mo par fichier.

GitHub peut mettre jusqu'à cinq minutes à servir la nouvelle version : un joueur qui relance le jeu juste après une publication peut encore recevoir l'ancien pack.

Pour voir ce que le script ferait sans rien publier, lancez `Publier.cmd -Essai` depuis un terminal.

### Les mods à téléchargement manuel

Certains auteurs interdisent sur CurseForge le téléchargement de leur mod par des outils tiers. Un tel mod ne doit pas être mis dans le pack : il ferait échouer la mise à jour de tous les joueurs. C'est le cas aujourd'hui de **TakKit** et de **Zcraft Decoration**.

Ces mods sont listés à part, dans `pack\manual.json`. Au clic sur **Jouer**, si l'un d'eux manque chez le joueur, le launcher ouvre sa page de téléchargement officielle dans le navigateur, attend que le fichier arrive dans le dossier Téléchargements, puis le range lui-même dans le jeu. Le joueur n'a cette étape à faire qu'une fois par fichier.

Chaque entrée de `manual.json` décrit un fichier :

```json
{
  "name": "TakKit",
  "filename": "takkit-1.3.1-1.20.1.jar",
  "folder": "mods",
  "size": 550601,
  "sha1": "c18b109e5f8a6343de7eb786afbd4c753a040271",
  "url": "https://www.curseforge.com/minecraft/mc-mods/takkit/download/7013819"
}
```

`size` est la taille du fichier en octets, `sha1` son empreinte, et `url` l'adresse de téléchargement CurseForge (`…/download/<numéro du fichier>`). Pour obtenir l'empreinte d'un fichier : `Get-FileHash <fichier> -Algorithm SHA1` dans PowerShell, à écrire en minuscules. Si vous changez la version d'un de ces mods sur le serveur, mettez à jour son entrée, puis publiez avec `Publier.cmd`. Retirer une entrée fait supprimer le fichier chez les joueurs.

**N'oubliez pas le serveur.** Le launcher ne s'occupe que des joueurs. Les mods doivent aussi être installés, dans la même version, dans le dossier `mods` du serveur chez l'hébergeur. Si les versions diffèrent, Forge refuse la connexion. Regardez la liste affichée par le script : elle inclut les dépendances ajoutées automatiquement, à installer elles aussi sur le serveur.

Le reste de cette partie décrit la méthode manuelle, utile pour les cas particuliers.

## Méthode manuelle : packwiz

packwiz est l'outil qui gère la liste des mods. `Publier.cmd` l'installe dans `tools\packwiz\`. Les commandes ci-dessous se lancent depuis le dossier `pack\` :

```
cd pack
```

## Ajouter un mod à la main

### Un mod présent sur Modrinth (cas recommandé)

```
..\tools\packwiz\packwiz.exe modrinth add <nom ou adresse du mod>
```

Exemple : `..\tools\packwiz\packwiz.exe modrinth add jei`. packwiz choisit la version compatible avec Minecraft 1.20.1 et Forge, et ajoute aussi les mods dont il dépend.

### Un mod présent sur CurseForge

```
..\tools\packwiz\packwiz.exe curseforge add <nom ou adresse du mod>
```

Préférez Modrinth quand le mod existe aux deux endroits. Certains auteurs interdisent le téléchargement de leur mod CurseForge par des outils tiers : dans ce cas, chaque joueur devra télécharger ce mod à la main dans une fenêtre qui s'affiche au lancement.

### Un mod qui n'est sur aucune plateforme

Copiez le fichier `.jar` dans `pack\mods\`, puis lancez :

```
..\tools\packwiz\packwiz.exe refresh
```

Le fichier sera alors distribué directement depuis le dépôt GitHub. Vérifiez que la licence du mod autorise sa redistribution, puisque le dépôt est public.

### Un mod réservé au client ou au serveur

Chaque mod a un fichier `pack\mods\<nom>.pw.toml`. La ligne `side` indique où il s'installe : `"both"` (client et serveur), `"client"` ou `"server"`. Après modification, relancez `packwiz refresh`.

## Publier après une modification manuelle

Un changement n'atteint les joueurs qu'après publication sur GitHub. Double-cliquez sur `Publier.cmd`, ou faites-le à la main depuis la racine du projet :

```
git add pack
git commit -m "Ajout du mod <nom>"
git push
```

## Retirer ou mettre à jour un mod

```
..\tools\packwiz\packwiz.exe remove <nom>
..\tools\packwiz\packwiz.exe update <nom>
..\tools\packwiz\packwiz.exe update --all
..\tools\packwiz\packwiz.exe list
```

`remove` retire le mod du pack, et le launcher l'efface chez les joueurs. `update` passe un mod à sa dernière version compatible, `update --all` le fait pour tous. Publiez ensuite avec `Publier.cmd`, et mettez à jour le serveur de la même façon.

## Fichiers de configuration des mods

Les fichiers placés dans `pack\config\` sont distribués aux joueurs comme les mods (après `packwiz refresh` et publication). Par défaut, un fichier modifié dans le pack remplace celui du joueur à son prochain lancement. Ne mettez donc dans le pack que les configurations qui doivent être identiques pour tout le monde, et pas les réglages personnels comme les touches.

## Changer l'adresse du serveur, la version de Forge ou de Minecraft

Ces réglages sont dans `launcher.config.json`, à la racine du projet :

- `server.host` et `server.port` : adresse du serveur. Si `host` est rempli, le jeu rejoint le serveur dès le lancement.
- `minecraft` et `forge` : versions installées chez les joueurs.

Contrairement aux mods, ces réglages sont intégrés au launcher. Après les avoir modifiés, il faut **reconstruire le launcher et le redistribuer** aux joueurs (section suivante). Si vous changez la version de Forge ou de Minecraft, changez-la aussi dans `pack\pack.toml`.

## Reconstruire le launcher

À faire seulement après une modification du code, de l'interface ou de `launcher.config.json`. Il faut **Node.js** (`https://nodejs.org`, version LTS).

```
npm install
npm run dist
```

Les deux fichiers à distribuer apparaissent dans `dist\` : `Aegis Launcher Setup <version>.exe` (installeur) et `Aegis Launcher.exe` (sans installation). Pour tester sans reconstruire : `npm start`.

Pour changer le numéro de version, modifiez `version` dans `package.json`. Pour changer l'icône, remplacez `build\icon.png` (512 × 512). Le fond de l'interface est `src\renderer\assets\background.png`.

## Ce que fait un joueur

1. Il lance `Aegis Launcher Setup <version>.exe`. Windows peut afficher un avertissement « Windows a protégé votre ordinateur », car le fichier n'est pas signé : cliquer sur **Informations complémentaires**, puis **Exécuter quand même**.
2. Il clique sur **Se connecter** et entre son compte Microsoft dans la fenêtre Prism.
3. Il clique sur **Jouer**. Le premier lancement télécharge plusieurs centaines de Mo ; les suivants sont rapides.
4. Il règle la mémoire dans les réglages (roue dentée). Le changement s'applique au lancement suivant.

Il doit posséder Minecraft : Java Edition.

## En cas de problème

- **« Installation interrompue »** : le téléchargement a échoué. Vérifier la connexion et recliquer sur **Jouer**.
- **Un joueur n'a pas reçu un mod** : vérifier que le changement a bien été publié (`git push`), puis lui faire relancer le jeu.
- **Forge refuse la connexion au serveur** : la liste des mods du serveur ne correspond pas à celle du pack.
- **Tout remettre à zéro chez un joueur** : fermer le launcher, puis supprimer le dossier `%APPDATA%\.aegis`. Attention, cela efface aussi ses sauvegardes locales et sa connexion.
- **Journaux** : `%APPDATA%\.aegis\launcher.log` pour le launcher, `%APPDATA%\.aegis\prism\logs` pour Prism, et `logs\latest.log` dans le dossier de jeu pour Minecraft.

## Et plus tard : se passer de la fenêtre Prism

Une demande d'autorisation a été envoyée à Mojang le 9 octobre 2026 pour que le launcher puisse connecter les comptes Microsoft lui-même, sans passer par Prism. L'application concernée s'appelle « Aegis Launcher » et appartient au compte Microsoft de Clément. Mojang n'annonce aucun délai.

Si l'autorisation arrive, la connexion pourra se faire directement dans l'interface Aegis. Ce mode existe déjà dans le code (`"engine": "native"` dans `launcher.config.json`), mais il ne gère pas encore la mise à jour des mods : il ne faut donc pas l'activer tel quel. Rien ne presse, le fonctionnement actuel est complet.

## Règles à respecter

- Le launcher n'a pas de mode hors ligne et ne doit pas en avoir : il a été présenté ainsi à Mojang, et le dépôt public le dit.
- Le launcher ne redistribue aucun fichier du jeu. Minecraft et Forge sont téléchargés depuis leurs serveurs officiels.
- Le launcher n'est pas un produit officiel Minecraft. La mention « Non affilié à Mojang ni à Microsoft » doit rester visible.

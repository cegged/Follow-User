# Follow User

A [Vencord](https://github.com/Vendicated/Vencord) plugin that adds a **Follow User** option to the user context menu, so you are always in the same voice channel as them.

## Features

- Follow a user from their right-click menu and join their voice channel automatically
- Indicator above the server list showing who you follow and where they are
  - Click to join, right-click to pause, resume or unfollow
- Optionally leave when they leave, move back when you get moved, and join once a full channel frees up
- Notification when the followed user joins a voice channel while following is paused

## Usage

### 1. Follow someone

Right-click a user and choose **Follow User**. Click it again (**Unfollow User**) to stop.

<img src="images/context-menu.png" alt="Follow User option in the user context menu" width="279">

### 2. The indicator

The user you follow appears at the top of the server list. The green badge means they are in a voice channel you can join. Hover it to see where they are, click it to join them.

<img src="images/indicator.png" alt="Follow indicator in the server list" width="64">

### 3. Pause or unfollow

Right-click the indicator to pause following, stop following, or open the settings.

<img src="images/indicator-menu.png" alt="Indicator context menu" width="156">

### 4. Settings

<img src="images/settings.png" alt="Follow User settings" width="675">

## Installation

This is a user plugin, so you need to [build Vencord from source](https://docs.vencord.dev/installing/).

```sh
cd Vencord/src/userplugins
git clone https://github.com/cegged/Follow-User
cd ../..
pnpm build
pnpm inject
```

Then enable **Follow User** in Vencord's plugin settings.

## Author

cegged · [GitHub](https://github.com/cegged) · Discord `@c3g`

## License

[GPL-3.0-or-later](LICENSE)

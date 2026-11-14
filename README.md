# Follow User

A [Vencord](https://github.com/Vendicated/Vencord) plugin that adds a **Follow User** option to the user context menu, so you are always in the same voice channel as them.

## Features

- Follow a user from their right-click menu and join their voice channel automatically
- Indicator above the server list showing who you follow and where they are
  - Click to join, right-click to pause, resume or unfollow
- Optionally leave when they leave, move back when you get moved, and join once a full channel frees up
- Notification when the followed user joins a voice channel while following is paused

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

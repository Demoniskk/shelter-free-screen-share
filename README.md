# Free Screen Share for shelter

A [shelter](https://github.com/uwu/shelter) plugin that unlocks all screen share quality presets (higher resolutions and frame rates) without Nitro.

Made by **Demoniskk**, based on the original [moonlight extension by redstonekasi](https://github.com/redstonekasi/moonlight-extensions/tree/main/src/freeScreenShare).

## Install

In Discord, open **Settings → shelter → Plugins → Add plugin** and paste:

```
https://demoniskk.github.io/shelter-free-screen-share/free-screen-share/
```

## Checking it works

Open the developer console (`Ctrl+Shift+I`) and filter for `freeScreenShare`. You should see:

```
[freeScreenShare] patched
[freeScreenShare] self-test: high=true mid=true
```

If something breaks after a Discord update, please open an issue and include those console lines.

## How it works

The moonlight version rewrites Discord's source so `canStreamQuality` always returns `true`. shelter can't rewrite source, and the object holding `canStreamQuality` is frozen, so this plugin works one step earlier: it wraps `User.isPremiumWithFractionalPremiumOnly`, which `canStreamQuality` calls first. When that call comes from `canStreamQuality`, the plugin makes your account look like Nitro (`premiumType = 2`, `perks = null`) for the rest of that one synchronous check, then restores your real values. Nothing else should see the change.

## Notes

- This only unlocks the quality options in the client. Discord's servers may still limit what you actually stream.
- Client mods are against Discord's Terms of Service. Use at your own risk.
- It depends on internal Discord names (`canStreamQuality`, `isPremiumWithFractionalPremiumOnly`), so a Discord update may break it.

## Building

```sh
npm install
npx lune ci                               # builds to dist/
npx lune dev plugins/free-screen-share    # live dev server for shelter's lune dev mode
```

## License

[AGPL-3.0](LICENSE), the same license as the original moonlight extension.

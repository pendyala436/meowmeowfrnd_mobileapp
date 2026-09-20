# FRND Theme Pack — 30 drop-in color themes

Each `.css` file in this folder is a **complete, self-contained theme** —
it redefines every design token (`:root` + `.dark`) used across the app:
backgrounds, cards, popovers, primary/secondary/muted/accent, destructive,
borders, ring, both radius scales, success/warning/info, gold (crown /
superlike), verified (blue check), vip (purple), glassmorphism, online/
offline/busy/away status dots, male/female gender colors, all 5 gradients,
all 3 shadows, and the full sidebar palette. Nothing outside these files
needs to change — every component already reads from these variable names.

## How to apply a theme

**Option A — replace the default theme**
Open `src/index.css`, delete the existing `:root { ... }` / `.dark { ... }`
block inside `@layer base` (roughly lines 118–320), and paste in the full
contents of the theme file you want.

**Option B — scoped/switchable themes (recommended)**
Import all 30 files and toggle them at runtime with a `data-theme`
attribute on `<html>`:

```css
/* src/index.css, near the top */
@import './themes/theme-01-sunset-coral.css';
@import './themes/theme-02-cherry-blaze.css';
/* ...import the rest you want available... */
```

Then wrap each file's blocks in an attribute selector instead of `:root`
(swap `:root {` for `[data-theme="sunset-coral"] {` and `.dark {` for
`[data-theme="sunset-coral"].dark {`), and switch with:

```ts
document.documentElement.setAttribute('data-theme', 'sunset-coral');
```

## Palette index

| # | Theme | Primary | Primary glow | VIP accent | File |
|---|-------|---------|--------------|------------|------|
| 01 | Sunset Coral | `#DD0E0E` | `#F23A3A` | `#358BB6` | `theme-01-sunset-coral.css` |
| 02 | Cherry Blaze | `#DD370E` | `#F25F3A` | `#3571B6` | `theme-02-cherry-blaze.css` |
| 03 | Rose Ember | `#DD610E` | `#F2843A` | `#3557B6` | `theme-03-rose-ember.css` |
| 04 | Marigold Punch | `#DD8A0E` | `#F2A93A` | `#353DB6` | `theme-04-marigold-punch.css` |
| 05 | Golden Hour | `#F1C927` | `#F5D866` | `#4635B6` | `theme-05-golden-hour.css` |
| 06 | Chartreuse Zing | `#F1F127` | `#F5F566` | `#6035B6` | `theme-06-chartreuse-zing.css` |
| 07 | Lime Spark | `#C9F127` | `#D8F566` | `#7A35B6` | `theme-07-lime-spark.css` |
| 08 | Meadow Fresh | `#A0F127` | `#BCF566` | `#9335B6` | `theme-08-meadow-fresh.css` |
| 09 | Fern Signal | `#6FF019` | `#96F457` | `#AD35B6` | `theme-09-fern-signal.css` |
| 10 | Pine Verified | `#44F019` | `#77F457` | `#9E2E8F` | `theme-10-pine-verified.css` |
| 11 | Emerald Current | `#19F019` | `#57F457` | `#9E2E79` | `theme-11-emerald-current.css` |
| 12 | Teal Tide | `#19F044` | `#57F477` | `#9E2E62` | `theme-12-teal-tide.css` |
| 13 | Aqua Mint | `#19F06F` | `#57F496` | `#9E2E4C` | `theme-13-aqua-mint.css` |
| 14 | Cyan Pulse | `#19F09A` | `#57F4B5` | `#9E2E35` | `theme-14-cyan-pulse.css` |
| 15 | Sky Signal | `#19F0C5` | `#57F4D5` | `#9E3D2E` | `theme-15-sky-signal.css` |
| 16 | Azure Wave | `#19F0F0` | `#57F4F4` | `#9E532E` | `theme-16-azure-wave.css` |
| 17 | Cobalt Rush | `#19C5F0` | `#57D5F4` | `#9E6A2E` | `theme-17-cobalt-rush.css` |
| 18 | Sapphire Glow | `#199AF0` | `#57B5F4` | `#C29D38` | `theme-18-sapphire-glow.css` |
| 19 | Indigo Spark | `#196FF0` | `#5796F4` | `#C2B938` | `theme-19-indigo-spark.css` |
| 20 | Violet Flame | `#1944F0` | `#5777F4` | `#AFC238` | `theme-20-violet-flame.css` |
| 21 | Amethyst Bloom | `#1919F0` | `#5757F4` | `#94C238` | `theme-21-amethyst-bloom.css` |
| 22 | Orchid Pop | `#4419F0` | `#7757F4` | `#71B635` | `theme-22-orchid-pop.css` |
| 23 | Plum Velvet | `#6F19F0` | `#9657F4` | `#57B635` | `theme-23-plum-velvet.css` |
| 24 | Magenta Pulse | `#9A19F0` | `#B557F4` | `#3DB635` | `theme-24-magenta-pulse.css` |
| 25 | Fuchsia Burst | `#C519F0` | `#D557F4` | `#35B646` | `theme-25-fuchsia-burst.css` |
| 26 | Berry Crush | `#DD0EDD` | `#F23AF2` | `#35B660` | `theme-26-berry-crush.css` |
| 27 | Rose Quartz | `#DD0EB3` | `#F23ACE` | `#35B67A` | `theme-27-rose-quartz.css` |
| 28 | Coral Blush | `#DD0E8A` | `#F23AA9` | `#35B693` | `theme-28-coral-blush.css` |
| 29 | Watermelon Pop | `#DD0E61` | `#F23A84` | `#35B6AD` | `theme-29-watermelon-pop.css` |
| 30 | Bubblegum Bright | `#DD0E37` | `#F23A5F` | `#35A5B6` | `theme-30-bubblegum-bright.css` |

Gold (`#FFB800`), Online green (`#8BC34A`), and Verified blue (`#4C84E5`)
are held constant across all 30 themes so status meaning stays
recognizable no matter which brand palette is active.

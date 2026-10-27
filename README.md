# Layer Mixer

Plan your layering before you paint: combine acrylic paint tones from shadow to highlight and preview the result on a shaded form. Ranges can be mixed within one recipe.

Vibecoded by Duempelhuber.

![Layer Mixer](screenshot.png)

## Included paint ranges

| Brand | Ranges |
|---|---|
| Warhammer | Tone Pro, Base & Layer, Air, Primer, Dry, Shade, Contrast, Technical |
| The Army Painter | Warpaints Fanatic, Warpaints Air, Colour Primer, Speedpaint, Wash, Effects |
| Monument Hobbies | Pro Acryl, Expert Acrylics, Prime, 1-Step, Wash, Specials |
| Vallejo | Model Color, Game Color, Squidmar Color, Mecha Color, Model Air, Game Air, Premium Color, Primer, Xpress Color, Metal Color, Liquid Metal, True Metallic Metal, Wash FX, Weathering FX, Pigment FX, Diorama FX, Auxiliary |

## How to use

1. Download **`layer-mixer.html`** from the latest [release](../../releases/latest).
2. Double-click the file. It opens in your web browser (Chrome, Edge, Firefox or Safari).
3. No installation, no account, no internet connection needed.

**Updating:** download the new `layer-mixer.html` and replace the old file in the same place. Your saved recipes stay in the browser. The version is shown in the top right corner of the tool.

**In the tool**

- The tool opens on a start screen with an overview of your paints and a short guide. *Start* at the top of the list on the left brings you back to it.
- Select a layer in the recipe (Deep shadow, Shadow, Base, Highlight, Top highlight), then click a paint in the chart.
- Choose a brand and a range in the list on the left. One brand is open at a time; pin a brand to keep it open. Paints you use are marked in the chart, and the list shows how many are in the recipe.
- Ranges marked with an eye and the metallic, clear and fluorescent paints are listed for reference only and can't be added to a recipe. Products without a colour of their own show a letter: M medium, V varnish, P primer.
- *Smooth* shows a soft blend, *Stepped* shows the individual layers.
- Choose the form for the preview: sphere, cylinder, cone, block or cloth.
- Drag on the preview to move the light (or use the arrow keys). Double-click or *Reset light* brings it back.
- *Light strength* (button next to the form name) sets how much of the form the highlights cover.
- The enlarge button next to the form name shows the preview large, with all controls and the recipe. Esc brings it back.
- *Paints needed* lists the pots you need for the recipe.
- Load one of the examples, or save your own recipes. Saved recipes stay in your browser on your computer.
- *My paints* (top left) lets you mark the paints you own: click a paint, drag across several, or click a row name. *Mine* then shows only your paints, and *Paints needed* highlights the ones you are missing.
- *Save* writes your paints and recipes to a file, *Load* reads it back, for example on another computer. In Chrome and Edge, *Save as* lets you choose where the file goes; *Save* then updates that file.
- *Clear* (in My paints) removes all your paints and saved recipes after a confirmation.
- The **?** in the top right corner explains the tool and its marks.

## Colour data

Most Vallejo colour values come from [miniature-paints](https://github.com/Arcturus5404/miniature-paints) by Rick Fleuren, MIT License (`data/LICENSE-miniature-paints.txt`). Paints missing there (Squidmar Color, True Metallic Metal, Pigment FX, Diorama FX and a few new ones) are sampled from Vallejo's product images; for pigments and textures these values are rough.

## Fonts

Layer Mixer uses Bricolage Grotesque by The Bricolage Grotesque Project Authors, licensed under the SIL Open Font License 1.1 (`src/fonts/OFL.txt`).

## Privacy

Layer Mixer runs completely offline. It does not load anything from the internet and does not send any data anywhere.

## Notes

Layer Mixer is vibecoded: the code was written with an AI coding assistant (Claude by Anthropic) under the direction of Duempelhuber, who designed and reviewed it.

Colour values are screen colours, not an exact match for the paint in the pot. Compare on the model before you paint.

Layer Mixer is a private, non-commercial project and is not affiliated with Games Workshop or The Army Painter. All product names are trademarks of their respective owners and are only used to identify the products.

## License

Copyright (c) 2026 Duempelhuber. All rights reserved. The tool may be downloaded and used for personal, non-commercial purposes; any redistribution or modification requires permission. See [LICENSE](LICENSE).

## Changes

See [ChangeLog.txt](ChangeLog.txt).

## For contributors

```
data/            one JSON file per paint range
src/             the app (HTML, CSS, JS) and its icon
build.py         bundles everything into dist/layer-mixer.html
tests/           automated browser tests (Playwright)
```

Build and test:

```
python3 build.py
npm install playwright && node tests/run-tests.js
```

Releasing: set `VERSION` in `build.py`, add an entry to `ChangeLog.txt` and push to `main`. If that version has no release yet, a GitHub Actions workflow builds the tool, runs the tests and publishes the release with `layer-mixer.html` and the change log entry.

Adding a paint range: create `data/<brand>-<range>.json` in the same format as the existing files (unique `id`, `brand`, `range`, `short`, optional `color`, and `rows` of `paints` with `name` and `hex`, ordered dark → light; optional per paint: `type`, `info`; per range: `series` (paints form a fixed dark → light series and get position numbers), `numbered` (tones), `info`, `translucent`), add the file name to `RANGES` in `build.py`, then build and test. Ranges with the same `brand` are grouped under one brand tab.

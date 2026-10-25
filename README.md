# Layer Mixer

Plan your layering before you paint: combine acrylic paint tones from shadow to highlight and preview the result on a shaded sphere. Ranges can be mixed within one recipe.

Vibecoded by Duempelhuber.

![Layer Mixer](screenshot.png)

## Included paint ranges

| Brand | Range | Paints |
|---|---|---|
| Warhammer | Tone Pro | 30 colours × 5 tones |
| Warhammer | Colour (Base & Layer) | 130 paints, plus 22 metallics for reference |
| Warhammer | Shade | 23 washes, for reference |
| The Army Painter | Warpaints Fanatic | 27 colour ranges, 170 paints |

## How to use

1. Download **`layer-mixer.html`** from the latest [release](../../releases/latest).
2. Double-click the file. It opens in your web browser (Chrome, Edge, Firefox or Safari).
3. No installation, no account, no internet connection needed.

**Updating:** download the new `layer-mixer.html` and replace the old file in the same place. Your saved recipes stay in the browser. The version is shown in the top right corner of the tool.

**In the tool**

- Select a layer in the recipe (Deep shadow, Shadow, Base, Highlight, Top highlight), then click a paint in the chart.
- Choose a brand with the tabs at the top and a range with the buttons below. Paints you use are marked in the chart.
- Metallics and shades are listed for reference only and can't be added to a recipe.
- *Smooth* shows a soft blend, *Stepped* shows the individual layers.
- Drag on the sphere to move the light (or use the arrow keys). Double-click or *Reset light* brings it back.
- *Paints needed* lists the pots you need for the recipe.
- Load one of the examples, or save your own recipes. Saved recipes stay in your browser on your computer.

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

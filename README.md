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
| AK Interactive | 3rd Gen Standard, 3rd Gen Figures, 3rd Gen AFV, 3rd Gen Air, Quick Gen, Dual Exo, Dense Acrylic, Primer & Spray, Acrylic Wash, Ink, Glow & Fluor, Metallics, Abteilung 502 Oils, Weathering, Markers & Pencils, Auxiliary |
| Two Thin Coats | Two Thin Coats |
| Scale75 | Scalecolor, Fantasy & Games, Warfront, Scalecolor Games, Scalecolor Artist, Drop & Paint, Primer, Metal n' Alchemy, Inktensity, Instant Colors, FX Fluor, Floww Oils, Soil Works, Auxiliary |

## How to use

1. Download **`layer-mixer.html`** from the latest [release](../../releases/latest).
2. Double-click the file. It opens in your web browser (Chrome, Edge, Firefox or Safari).
3. No installation, no account, no internet connection needed.

**Updating:** download the new `layer-mixer.html` and replace the old file in the same place. Your saved recipes stay in the browser. The version is shown in the top right corner of the tool.

**In the tool**

Pick paints for the five layers of a recipe, from deep shadow to top highlight, and see them on a shaded form.

- Choose a brand and range on the left, select a layer in the recipe and click a paint.
- Drag on the preview to move the light. The buttons next to it change the form, blending and light strength, or enlarge the view.
- Paints marked with an eye are for reference only.
- Recipes can be saved in the browser or copied as text.
- **My paints:** mark the paints you own. Save and Load keep them in a file.
- The **?** button explains the rest.

## Colour data

Most Vallejo colour values come from [miniature-paints](https://github.com/Arcturus5404/miniature-paints) by Rick Fleuren, MIT License (`data/LICENSE-miniature-paints.txt`). Paints missing there (Squidmar Color, True Metallic Metal, Pigment FX, Diorama FX and a few new ones) are sampled from Vallejo's product images; for pigments and textures these values are rough.

AK Interactive 3rd Gen colour values also come from miniature-paints. All other AK colours are sampled from AK's product images (swatches, strokes, bottle and jar contents). True Metal and the metallic markers use the colour of the matching Xtreme Metal. Weathering products, markers and pencils are rough values.

Two Thin Coats colour values come from miniature-paints. Scale75 colour values come from miniature-paints where available; Scalecolor Games, Drop & Paint, Floww Oils, the newer Inktensity and Artist inks and some Soil Works products are sampled from Scale75's product images.

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

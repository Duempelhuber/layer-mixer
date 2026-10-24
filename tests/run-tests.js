// Run:  node tests/run-tests.js   (needs: npm i playwright, after python3 build.py)
const { chromium } = require('playwright');
const assert = require('assert');
const fs = require('fs'), path = require('path');
const DIST = path.resolve(__dirname, '../dist');
const BUILT = fs.readdirSync(DIST).filter(f => /^layer-mixer.*\.html$/.test(f));
if (BUILT.length !== 1 || BUILT[0] !== 'layer-mixer.html') { console.error('Expected exactly dist/layer-mixer.html, found: ' + BUILT.join(', ')); process.exit(1); }
const FILE = 'file://' + path.join(DIST, BUILT[0]);
const SRC = fs.readFileSync(path.resolve(__dirname, '../src/layer-mixer.html'), 'utf8');

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write']);
  const p = await ctx.newPage();
  const errs = [], ext = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  p.on('request', r => { const u = r.url(); if (!u.startsWith('file://') && !u.startsWith('data:')) ext.push(u); });
  let pass = 0, fail = 0;
  const t = async (n, f) => { try { await f(); pass++; console.log('OK  ', n); } catch (e) { fail++; console.log('FAIL', n, '-', e.message); } };
  const px = (x, y) => p.evaluate(([x, y]) => Array.from(document.querySelector('#sphere').getContext('2d').getImageData(x, y, 1, 1).data), [x, y]);
  const sw = id => `.sw[data-id="${id}"]`;
  const filled = () => p.locator('.slot .pname').count();
  const BRAND = { tp: 'warhammer', wc: 'warhammer', ws: 'warhammer', wf: 'the-army-painter' };
  const goRange = async key => { await p.click(`#brand-${BRAND[key]}`); if (await p.getAttribute(`#tab-${key}`, 'aria-selected') !== 'true') await p.click(`#tab-${key}`); };

  await p.goto(FILE);

  await t('Brand tabs + range pills, Warhammer / Tone Pro selected first', async () => {
    assert.deepEqual(await p.locator('.btab').evaluateAll(b => b.map(x => x.firstChild.textContent)), ['Warhammer', 'The Army Painter']);
    assert.equal(await p.getAttribute('#brand-warhammer', 'aria-selected'), 'true');
    assert.deepEqual(await p.locator('.pill').evaluateAll(b => b.map(x => x.dataset.k)), ['tp', 'wc', 'ws']);
    assert.equal(await p.getAttribute('#tab-tp', 'aria-selected'), 'true');
  });
  await t('Tone Pro chart: 30 strips, 150 swatches, numbered', async () => {
    assert.equal(await p.locator('.strip').count(), 30);
    assert.equal(await p.locator('.sw').count(), 150);
    assert.equal(await p.locator('.sw .n').count(), 150);
    const fam = await p.locator('.strip .label small').allTextContents();
    assert.equal(fam.length, 30); assert(fam.every(f => /^[A-Z][a-z]+$/.test(f)), fam.join(','));
    assert.equal(await p.textContent('.strip:has-text("Ultramar Blue") small'), 'Blue');
  });
  await t('Tabs show only brand and range name', async () => {
    assert(!/paints|tones|ranges/.test(await p.textContent('#brands')));
    assert(!/paints|tones/.test(await p.textContent('#ranges')));
  });
  await t('Starts empty, shadow layer active, sphere empty', async () => {
    assert.equal(await filled(), 0);
    assert.equal(await p.getAttribute('.slot[data-slot="0"]', 'aria-pressed'), 'true');
    assert.equal((await px(190, 190))[3], 0);
    assert.equal(await p.textContent('#lg-layer'), 'Deep shadow');
    const names = await p.locator('.slot .lname').allTextContents();
    assert.deepEqual(names, ['Deep shadow','Shadow','Base','Highlight','Top highlight','Edge highlight']);
  });
  await t('Fixed file name without version (recipes survive overwriting)', async () => { assert.equal(BUILT[0], 'layer-mixer.html'); });
  await t('Version shown, credit in footer', async () => { const v = await p.evaluate(() => VERSION); assert.match(v, /^\d+\.\d+$/); assert.equal(await p.textContent('#version'), 'v' + v); assert.equal(await p.textContent('.notes .credit'), `Layer Mixer v${v} · by Duempelhuber`); });

  await t('Pick fills layer, advances, marks swatch and tab', async () => {
    await p.click(sw('tp:Ultramar Blue 1'));
    assert.equal(await filled(), 1);
    assert.equal(await p.getAttribute('.slot[data-slot="1"]', 'aria-pressed'), 'true');
    assert.equal(await p.textContent(sw('tp:Ultramar Blue 1') + ' .slot-mark'), 'D');
    assert.equal(await p.textContent('.inrec[data-k="tp"]'), '1');
    assert.equal(await p.textContent('.inrec[data-b="Warhammer"]'), '1 in recipe');
    assert.equal(await p.locator('.inrec[data-k="wf"]').isHidden(), true);
    const c = await px(190, 190); assert.equal(c[3], 255);
  });
  await t('Auto-advance runs through all six layers incl. edge highlight', async () => {
    await p.click('#btn-clear');
    for (const n of [1,2,3,4,5]) await p.click(sw(`tp:Ultramar Blue ${n}`));
    assert.equal(await p.textContent('#lg-layer'), 'Edge highlight');
    await p.click(sw('tp:Blackstone Void 5'));
    assert.equal(await p.locator('.slot .pname').count(), 6);
    assert.equal(await p.textContent('#lg-layer'), 'Edge highlight');
    await p.click('#btn-clear'); await p.click(sw('tp:Ultramar Blue 1'));
  });
  await t('Tab switch to Fanatic: 27 strips, 170 swatches, numbered, no extra text', async () => {
    await goRange('wf');
    assert.equal(await p.getAttribute('#tab-wf', 'aria-selected'), 'true');
    assert.equal(await p.locator('.pill').count(), 1);
    assert.equal(await p.locator('.strip').count(), 27);
    assert.equal(await p.locator('.sw').count(), 170);
    const nums = await p.locator('.strip:has-text("Yellows") .sw .n').allTextContents();
    assert.deepEqual(nums, ['1','2','3','4','5','6','7']);
    assert.equal(await p.locator('.sw .n').count(), 170);
    assert.equal(await p.locator('.strip .label small').count(), 0, 'no extra text under Fanatic range names');
    const greys = await p.locator('.strip:has-text("Black & Greys") .sw').evaluateAll(b => b.map(x => x.getAttribute('data-id')));
    assert.deepEqual(greys.slice(0, 3), ['wf:Matt Black', 'wf:Ironclad Grey', 'wf:Deep Grey']);
  });
  await t('Cross-range recipe: Fanatic paint shows range tag, paints needed lists 2 ranges', async () => {
    await p.click(sw('wf:Alpha Blue'));
    const meta = await p.locator('.slot[data-slot="1"] .pmeta').textContent();
    assert(meta.includes('Fanatic') && meta.includes('Strong Pale Blues'), meta);
    const shop = await p.textContent('#shop');
    assert(shop.includes('2 ranges') && shop.includes('Ultramar Blue 1') && shop.includes('Alpha Blue'), shop);
  });
  await t('Paints needed lists every Tone Pro tone, grouped by colour', async () => {
    await p.click('#btn-clear');
    await p.click('#presets .chip:has-text("Ultramarines blue")');
    const items = await p.locator('#shop li span:not(.rtag)').allTextContents();
    assert.deepEqual(items, ['Ultramar Blue 1, 2, 5', 'Ultramarine Blue · Alpha Blue · Augur Blue']);
    await p.click('#btn-clear'); await goRange('tp'); await p.click(sw('tp:Ultramar Blue 1')); await goRange('wf'); await p.click(sw('wf:Alpha Blue'));
  });
  await t('Arrow keys switch tabs and keep recipe marks', async () => {
    await p.focus('#brand-the-army-painter'); await p.keyboard.press('ArrowRight');
    assert.equal(await p.getAttribute('#brand-warhammer', 'aria-selected'), 'true');
    assert.equal(await p.evaluate(() => document.activeElement.id), 'brand-warhammer');
    assert.equal(await p.getAttribute('#tab-tp', 'aria-selected'), 'true');
    await p.focus('#tab-tp'); await p.keyboard.press('ArrowRight');
    assert.equal(await p.evaluate(() => document.activeElement.id), 'tab-wc');
    await p.keyboard.press('ArrowLeft');
    assert.equal(await p.evaluate(() => document.activeElement.id), 'tab-tp');
    assert.equal(await p.locator('.sw.used').count(), 1);
  });
  await t('Tooltip on hover shows name and range', async () => {
    await p.hover(sw('tp:Stormwolf Blue 5'));
    const txt = await p.textContent('#tip');
    assert(await p.isVisible('#tip') && txt.includes('Stormwolf Blue 5') && txt.includes('Warhammer · Tone Pro'), txt);
    await p.mouse.move(5, 5);
  });
  await t('Tooltip on keyboard focus', async () => {
    await p.focus(sw('tp:Carmine Blades 1'));
    assert((await p.textContent('#tip')).includes('Carmine Blades 1'));
    await p.focus('#btn-copy'); assert.equal(await p.isVisible('#tip'), false);
  });
  await t('Clear single layer', async () => {
    await p.click('.slot[data-slot="1"] .x');
    assert.equal(await filled(), 1);
    assert.equal(await p.getAttribute('.slot[data-slot="1"]', 'aria-pressed'), 'true');
  });
  await t('Selecting a layer by keyboard', async () => {
    await p.focus('.slot[data-slot="5"]'); await p.keyboard.press('Enter');
    assert.equal(await p.textContent('#lg-layer'), 'Edge highlight');
  });

  await t('All examples load with valid paints, dark → light', async () => {
    const r = await p.evaluate(() => PRESETS.map(x => ({ n: x.name, ok: x.layers.every(id => !id || BY_ID[id]), l: x.layers.slice(0, 5).filter(Boolean).map(id => lum(BY_ID[id].hex)) })));
    assert.equal(r.length, 3);
    for (const x of r) { assert(x.ok, x.n + ' has unknown paint'); for (let i = 1; i < x.l.length; i++) assert(x.l[i] > x.l[i - 1], x.n + ' not ascending'); }
    for (const x of r) { await p.click(`#presets .chip:has-text("${x.n}")`); assert((await filled()) >= 5, x.n); }
  });
  await t('Edge highlight shows as glint in its own colour', async () => {
    await p.click('#btn-clear'); await p.click(sw('tp:Dataslate Grey 1')); await p.click('.slot[data-slot="5"]'); await p.click(sw('tp:Blackstone Void 5'));
    const c = await px(291, 80); assert(c[0] > 235 && c[1] > 235 && c[2] > 235, JSON.stringify(c));
  });
  await t('Edge highlight is a normal layer (no "optional" label), picking sets no status text', async () => {
    assert.equal(await p.locator('.optional').count(), 0);
    assert.equal(await p.locator('.slot').count(), 6);
    assert.equal(await p.textContent('#status'), '');
  });
  const bright = c => c[0] + c[1] + c[2];
  await t('Heading is "Sphere", no Reverse button', async () => {
    assert.equal(await p.textContent('.stage-ctl h2'), 'Sphere');
    assert.equal(await p.locator('#btn-reverse').count(), 0);
    assert.equal(await p.locator('#btn-light').count(), 1);
  });
  await t('Dragging on the sphere moves the light', async () => {
    await p.click('#presets .chip:has-text("Imperial Fists yellow")');
    const tr0 = await px(291, 80), bl0 = await px(89, 300);
    assert(bright(tr0) > bright(bl0), 'default light should come from top right');
    const box = await p.locator('#sphere').boundingBox();
    await p.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
    await p.mouse.down(); await p.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.8, { steps: 5 }); await p.mouse.up();
    const tr1 = await px(291, 80), bl1 = await px(89, 300);
    assert(bright(bl1) > bright(tr1), `light should now come from bottom left ${tr1} ${bl1}`);
    assert.equal(await p.locator('.slot .pname').count(), 5, 'recipe unchanged');
  });
  await t('Reset light restores the default', async () => {
    const before = await px(291, 80);
    await p.click('#btn-light');
    const after = await px(291, 80);
    assert(bright(after) > bright(before));
    await p.click('#btn-clear'); await p.click('#presets .chip:has-text("Imperial Fists yellow")');
  });
  await t('Arrow keys move the light, Home resets', async () => {
    const ref = await px(80, 190);
    await p.focus('#sphere'); for (let i = 0; i < 12; i++) await p.keyboard.press('ArrowLeft');
    assert(bright(await px(80, 190)) > bright(ref), 'left side should get brighter');
    await p.keyboard.press('Home'); assert.deepEqual(await px(80, 190), ref);
  });
  await t('Double-click resets the light', async () => {
    const ref = await px(291, 80);
    await p.focus('#sphere'); await p.keyboard.press('ArrowDown'); await p.keyboard.press('ArrowDown');
    assert.notDeepEqual(await px(291, 80), ref);
    await p.dblclick('#sphere'); assert.deepEqual(await px(291, 80), ref);
  });
  await t('Stepped mode changes rendering', async () => {
    const a = await px(150, 260); await p.click('#mode-steps'); const b = await px(150, 260);
    assert.notDeepEqual(a, b); await p.click('#mode-smooth');
  });
  await t('Copy recipe puts readable text on clipboard', async () => {
    await p.click('#presets .chip:has-text("Ultramarines blue")');
    await p.click('#btn-copy');
    const clip = await p.evaluate(() => navigator.clipboard.readText());
    assert(clip.startsWith('Deep shadow: Ultramar Blue 1 (Warhammer Tone Pro)') && clip.includes('\nHighlight: Alpha Blue (The Army Painter Warpaints Fanatic)') && clip.includes('Edge highlight: Augur Blue'), clip);
  });
  await t('Clear all', async () => { await p.click('#btn-clear'); assert.equal(await filled(), 0); assert.equal((await px(190, 190))[3], 0); });

  await t('Save, reload, load, delete; names are not interpreted as HTML', async () => {
    await p.click('#presets .chip:has-text("Ultramarines blue")');
    await p.fill('#save-name', '<img src=x onerror=alert(1)>');
    await p.click('#save-form button');
    assert.equal(await p.locator('#saved img').count(), 0);
    await p.reload();
    assert.equal(await p.locator('#saved .chip').count(), 1);
    await p.click('#saved .chip'); assert.equal(await filled(), 6);
    await p.click('#saved .del'); assert.equal(await p.locator('#saved .chip').count(), 0);
  });
  await t('Empty recipe is not saved', async () => {
    await p.click('#btn-clear'); await p.fill('#save-name', 'x'); await p.click('#save-form button');
    assert.equal(await p.locator('#saved .chip').count(), 0);
  });
  await t('Corrupt storage does not break the tool', async () => {
    await p.evaluate(() => localStorage.setItem('layer-mixer-recipes-v2', '{broken'));
    await p.reload(); assert.equal(await p.locator('.sw').count(), 150);
    await p.evaluate(() => localStorage.setItem('layer-mixer-recipes-v2', JSON.stringify([{ name: 'odd', layers: ['tp:Nope', 42, 'wf:Alpha Blue'] }])));
    await p.reload(); await p.click('#saved .chip'); assert.equal(await filled(), 1);
  });
  await t('Recipes from the Tone Pro only version are migrated', async () => {
    await p.evaluate(() => { localStorage.clear(); localStorage.setItem('tonepro-rezepte-v1', JSON.stringify([{ name: 'Old one', layers: [['Ultramar Blue', 1], ['Ultramar Blue', 3], null, null, null, ['Blackstone Void', 5]] }])); });
    await p.reload(); await p.click('#saved .chip:has-text("Old one")');
    const names = await p.locator('.slot .pname').allTextContents();
    assert.deepEqual(names, ['Ultramar Blue 1', 'Ultramar Blue 3', 'Blackstone Void 5']);
    await p.evaluate(() => localStorage.clear());
  });

  await t('Warhammer Colour: 21 groups, Base marks, long groups wrap', async () => {
    await goRange('wc');
    assert.equal(await p.locator('.strip').count(), 21);
    assert.equal(await p.locator('.sw').count(), 152);
    assert(await p.locator('.sw .tm').count() > 40, 'base marks');
    assert.equal(await p.locator(sw('wc:Calgar Blue') + ' .tm').count(), 0, 'layer has no mark');
    assert.equal(await p.locator(sw('wc:Macragge Blue') + ' .tm').count(), 1, 'base has mark');
    const h = await p.locator('.strip:has-text("Skin") .ramp').evaluate(e => e.getBoundingClientRect().height);
    assert(h > 60, 'Skin row should wrap to two lines, height ' + h);
    assert((await p.textContent('#legend')).includes('Base paint'));
  });
  await t('Colour paints can be used, tooltip shows Base/Layer', async () => {
    await p.click('#btn-clear');
    await p.click(sw('wc:Macragge Blue'));
    assert.equal(await filled(), 1);
    await p.hover(sw('wc:Calgar Blue')); assert((await p.textContent('#tip')).includes('Blue · Layer'));
    await p.mouse.move(5, 5);
  });
  await t('Metallics are reference only', async () => {
    const before = await filled();
    const id = await p.locator('.strip:has-text("Gold & brass") .sw').first().getAttribute('data-id');
    await p.click(sw(id), { force: true });
    assert.equal(await filled(), before, 'metallic must not be added');
    assert((await p.textContent('#status')).includes('reference only'));
    assert.equal(await p.getAttribute(sw(id), 'aria-disabled'), 'true');
    assert(await p.isVisible('#infonote'));
    assert.equal(await p.locator('.sw.metal').count(), 22);
  });
  await t('Shades are reference only and marked translucent', async () => {
    await goRange('ws');
    assert.equal(await p.locator('.sw.wash').count(), 23);
    assert((await p.textContent('#tab-ws')).includes('reference'));
    assert((await p.textContent('#infonote')).includes('translucent'));
    const before = await filled();
    await p.click(sw('ws:Nuln Oil'), { force: true }); assert.equal(await filled(), before);
    assert(!(await p.textContent('#legend')).includes('Click to place'));
  });
  await t('Brand remembers its last range; badges count per range and brand', async () => {
    await goRange('wc');
    await p.click('#brand-the-army-painter'); await p.click('#brand-warhammer');
    assert.equal(await p.getAttribute('#tab-wc', 'aria-selected'), 'true');
    assert.equal(await p.textContent('.inrec[data-k="wc"]'), '1');
    const n = await p.evaluate(() => layers.filter(id => id && BY_ID[id].brand === 'Warhammer').length);
    assert.equal(await p.textContent('.inrec[data-b="Warhammer"]'), `${n} in recipe`);
  });
  await t('Saved recipes never load reference-only paints', async () => {
    await p.evaluate(() => localStorage.setItem('layer-mixer-recipes-v2', JSON.stringify([{ name: 'sneaky', layers: ['ws:Nuln Oil', 'wc:Retributor Armour', 'wc:Kantor Blue'] }])));
    await p.reload(); await p.click('#saved .chip');
    assert.deepEqual(await p.locator('.slot .pname').allTextContents(), ['Kantor Blue']);
    await p.evaluate(() => localStorage.clear()); await p.reload();
  });
  await t('Data: unique ids, valid hex, Fanatic rows 6–7 paints', async () => {
    const r = await p.evaluate(() => ({ ids: Object.keys(BY_ID).length, hex: Object.values(BY_ID).every(x => /^#[0-9a-f]{6}$/.test(x.hex)), wf: RANGE_BY_KEY.wf.rows.map(r => r.paints.length) }));
    assert.equal(r.ids, 495); assert(r.hex); assert(r.wf.every(n => n >= 6 && n <= 7), r.wf);
  });
  await t('Every swatch and slot has an accessible name', async () => {
    const missing = await p.evaluate(() => [...document.querySelectorAll('.sw,.slot,.btab,.pill')].filter(e => !(e.getAttribute('aria-label') || e.textContent.trim())).length);
    assert.equal(missing, 0);
  });
  await t('Security: no innerHTML/eval/external URLs in source', async () => {
    assert(!/innerHTML|outerHTML|insertAdjacentHTML|eval\(|new Function|document\.write/.test(SRC));
    assert(!/https?:\/\//.test(fs.readFileSync(path.join(DIST, BUILT[0]), 'utf8')));
  });
  await t('No network requests', async () => { assert.equal(ext.length, 0, ext.join(' ')); });

  for (const [w, h] of [[1280, 800], [1100, 700]]) {
    await t(`No horizontal overflow at ${w}×${h}`, async () => {
      await p.setViewportSize({ width: w, height: h }); await p.reload();
      const o = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      assert(o <= 0, 'overflow ' + o);
      const clipped = await p.evaluate(() => [...document.querySelectorAll('.strip')].filter(s => s.querySelector('.ramp').scrollWidth > s.querySelector('.ramp').clientWidth + 1).length);
      assert.equal(clipped, 0, clipped + ' strips clipped');
    });
  }
  await t('No JS errors', async () => { assert.equal(errs.length, 0, errs.join(' | ')); });

  console.log(`\n${pass} passed, ${fail} failed`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})();

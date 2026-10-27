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
  const BRAND = { tp: 'warhammer', wc: 'warhammer', wd: 'warhammer', ws: 'warhammer', wf: 'the-army-painter', apa: 'the-army-painter', app: 'the-army-painter', aps: 'the-army-painter', apw: 'the-army-painter', ape: 'the-army-painter', pa: 'monument-hobbies', pae: 'monument-hobbies', pap: 'monument-hobbies', pa1: 'monument-hobbies', paw: 'monument-hobbies', pat: 'monument-hobbies' };
  const brand = async slug => {   // select a brand in the sidebar (the current one is only opened)
    const cur = await p.evaluate(() => brandOf(current).slug);
    if (cur === slug) { if (await p.getAttribute(`#brand-${slug}`, 'aria-expanded') === 'false') await p.click(`#brand-${slug}`); return; }
    await p.click(`#brand-${slug}`); };
  const sideKeys = sel => p.evaluate(sel => [...document.querySelectorAll(`#side .rg[data-b="${brandOf(current).name}"]`)].filter(x => sel === 'all' || (sel === 'ref') === !!x.querySelector('.eye')).map(x => x.dataset.k), sel);
  const rangeKeys = () => sideKeys('all');
  const usableKeys = () => sideKeys('use');
  const refKeys = () => sideKeys('ref');
  const brandCount = async name => { const t = await p.textContent(`#side .inrec[data-bc="${name}"]`); return +t.match(/\d+/)[0]; };
  const goRange = async key => { await brand(BRAND[key]); if (await p.getAttribute(`#tab-${key}`, 'aria-selected') !== 'true') await p.click(`#tab-${key}`); };

  await p.goto(FILE + '#tp');   // straight to a range; the start screen has its own test

  await t('Sidebar: brands and ranges, Warhammer / Tone Pro selected first', async () => {
    const names = ['Warhammer', 'The Army Painter', 'Monument Hobbies'];
      assert.deepEqual(await p.locator('#side .bh .bn').allTextContents(), names);
      assert.equal(await p.getAttribute('#brand-warhammer', 'aria-expanded'), 'true');
    assert.deepEqual(await rangeKeys(), ['tp', 'wc', 'wa', 'wpr', 'wd', 'ws', 'wct', 'wt']);
    assert.equal(await p.getAttribute('#tab-tp', 'aria-selected'), 'true');
  });
  await t('Tone Pro chart: 30 strips, 150 swatches, numbered', async () => {
    assert.equal(await p.locator('.strip').count(), 30);
    assert.equal(await p.locator('.sw').count(), 150);
    assert.equal(await p.locator('.sw .n').count(), 150);
    assert.equal(await p.locator('.strip .label small').count(), 0, 'no colour family under Tone Pro names');
  });
  await t('Sidebar shows only brand and range names', async () => {
    assert(!/paints|tones/.test(await p.textContent('#side')));
  });
  await t('Starts empty, shadow layer active, sphere empty', async () => {
    assert.equal(await filled(), 0);
    assert.equal(await p.getAttribute('.slot[data-slot="0"]', 'aria-pressed'), 'true');
    assert.equal((await px(190, 190))[3], 0);
    assert.equal(await p.textContent('.slot.active .lname'), 'Deep shadow');
    const names = await p.locator('.slot .lname').allTextContents();
    assert.deepEqual(names, ['Deep shadow','Shadow','Base','Highlight','Top highlight']);
  });
  await t('Fixed file name without version (recipes survive overwriting)', async () => { assert.equal(BUILT[0], 'layer-mixer.html'); });
  await t('Little text: no header hint, no legend, no info boxes, one footer note', async () => {
    assert.equal(await p.locator('.hint,#legend,#infonote').count(), 0);
    assert.equal(await p.locator('#notes p').count(), 2);
  });
  await t('Paints needed hidden while the recipe is empty; one Recipes section', async () => {
    assert(await p.locator('#shop').isHidden());
    assert.deepEqual(await p.locator('.bench h2:visible').allTextContents(), ['Sphere', 'Recipe', 'Recipes']);
    assert.equal(await p.locator('.empty-note').count(), 0);
  });
  await t('Version shown, credit in footer', async () => { const v = await p.evaluate(() => VERSION); assert.match(v, /^\d+\.\d+$/); assert.equal(await p.textContent('#version'), 'v' + v); assert.equal(await p.textContent('.notes .credit'), `Layer Mixer v${v} · Vibecoded by Duempelhuber`); });

  await t('Pick fills layer, advances, marks swatch and tab', async () => {
    await p.click(sw('tp:Ultramar Blue 1'));
    assert.equal(await filled(), 1);
    assert.equal(await p.getAttribute('.slot[data-slot="1"]', 'aria-pressed'), 'true');
    assert.equal(await p.textContent(sw('tp:Ultramar Blue 1') + ' .slot-mark'), 'D');
    assert.equal(await p.textContent('.inrec[data-k="tp"]'), '1');
    assert.equal(await brandCount('Warhammer'), 1);
    assert.equal(await p.locator('.inrec[data-k="wf"]').isHidden(), true);
    const c = await px(190, 190); assert.equal(c[3], 255);
  });
  await t('Auto-advance runs through all five layers', async () => {
    await p.click('#btn-clear');
    for (const n of [1,2,3,4,5]) await p.click(sw(`tp:Ultramar Blue ${n}`));
    assert.equal(await p.locator('.slot .pname').count(), 5);
    assert.equal(await p.textContent('.slot.active .lname'), 'Top highlight');
    await p.click('#btn-clear'); await p.click(sw('tp:Ultramar Blue 1'));
  });
  await t('Tab switch to Fanatic: 27 triads numbered, extra rows without numbers', async () => {
    await goRange('wf');
    assert.equal(await p.getAttribute('#tab-wf', 'aria-selected'), 'true');
    assert.deepEqual(await rangeKeys(), ['wf', 'apa', 'app', 'aps', 'apw', 'ape']);
    assert.equal(await p.locator('.strip').count(), 32);
    assert.equal(await p.locator('.sw').count(), 194);
    await p.setViewportSize({ width: 1440, height: 900 });
    const tops = await p.locator('.strip:has-text("Yellows") .sw').evaluateAll(b => b.map(x => Math.round(x.getBoundingClientRect().top)));
    assert.equal(new Set(tops).size, 1, 'seven Fanatic swatches on one line at 1440');
    const nums = await p.locator('.strip:has-text("Yellows") .sw .n').allTextContents();
    assert.deepEqual(nums, ['1','2','3','4','5','6','7']);
    assert.equal(await p.locator('.sw .n').count(), 170, 'only triad paints are numbered');
    assert.equal(await p.locator('.strip:has-text("Masterclass") .sw .n').count(), 0);
    assert.equal(await p.locator('.strip .label small').count(), 0, 'no extra text under Fanatic range names');
    const greys = await p.locator('.strip:has-text("Black & greys") .sw').evaluateAll(b => b.map(x => x.getAttribute('data-id')));
    assert.deepEqual(greys.slice(0, 3), ['wf:Matt Black', 'wf:Ironclad Grey', 'wf:Deep Grey'], 'Fanatic keeps the manufacturer row');
  });
  await t('Cross-range recipe: Fanatic paint shows range tag, paints needed lists 2 ranges', async () => {
    await p.click(sw('wf:Alpha Blue'));
    const meta = await p.locator('.slot[data-slot="1"] .pmeta').textContent();
    assert(meta.includes('Fanatic') && meta.includes('Strong pale blues'), meta);
    const shop = await p.textContent('#shop');
    assert(shop.includes('2 ranges') && shop.includes('Ultramar Blue 1') && shop.includes('Alpha Blue'), shop);
  });
  await t('Paints needed lists every Tone Pro tone, grouped by colour', async () => {
    await p.click('#btn-clear');
    await p.click('#presets .chip:has-text("Ultramarines blue")');
    const items = await p.locator('#shop li .items').allTextContents();
    assert.deepEqual(items, ['Ultramar Blue 1, 2, 5', 'Ultramarine Blue · Alpha Blue']);
    await p.click('#btn-clear'); await goRange('tp'); await p.click(sw('tp:Ultramar Blue 1')); await goRange('wf'); await p.click(sw('wf:Alpha Blue'));
  });
  await t('Sidebar: keyboard, one brand open, pins; recipe marks kept', async () => {
    const focused = () => p.evaluate(() => document.activeElement.id);
      await goRange('tp'); await p.focus('#tab-tp');
      await p.keyboard.press('ArrowDown'); assert.equal(await focused(), 'tab-wc');
      await p.keyboard.press('ArrowUp'); await p.keyboard.press('ArrowLeft'); assert.equal(await focused(), 'brand-warhammer');
      const exp = slug => p.getAttribute(`#brand-${slug}`, 'aria-expanded');
      await p.keyboard.press('ArrowLeft'); assert.equal(await exp('warhammer'), 'false', 'the current brand can be closed');
      assert.equal(await p.textContent('#brand-warhammer .sub'), 'Tone Pro', 'a closed current brand names its range');
      assert.equal(await p.getAttribute('#brand-warhammer', 'tabindex'), '0', 'and keeps the tab stop');
      assert.equal(await p.locator('#side [tabindex="0"]').count(), 1);
      await p.keyboard.press('ArrowRight'); assert.equal(await exp('warhammer'), 'true');
      await p.click('#brand-the-army-painter'); assert.equal(await exp('the-army-painter'), 'true');
      assert.equal(await exp('warhammer'), 'false', 'only one brand is open'); assert.equal(await p.getAttribute('#tab-wf', 'aria-selected'), 'true');
      await p.click('#brand-monument-hobbies'); assert.equal(await exp('the-army-painter'), 'false'); assert.equal(await exp('monument-hobbies'), 'true');
      await p.hover('#brand-the-army-painter'); await p.click('.bhrow:has(#brand-the-army-painter) .bpin');
      assert.equal(await exp('the-army-painter'), 'true', 'pinning opens'); assert.equal(await exp('monument-hobbies'), 'true');
      await p.click('#brand-warhammer'); assert.equal(await exp('monument-hobbies'), 'false');
      assert.equal(await exp('the-army-painter'), 'true', 'a pinned brand stays open'); assert.equal(await exp('warhammer'), 'true');
      assert.deepEqual(await p.evaluate(() => JSON.parse(localStorage.getItem('layer-mixer-side-pins-v1'))), ['The Army Painter'], 'pins are remembered');
      await p.focus('#brand-the-army-painter'); await p.keyboard.press('p');
      assert.equal(await p.getAttribute('.bhrow:has(#brand-the-army-painter) .bpin', 'aria-pressed'), 'false', 'P toggles the pin');
      await p.click('#brand-warhammer'); await p.click('#brand-warhammer').catch(() => {});
      if (await exp('warhammer') === 'false') await p.click('#brand-warhammer');
      await goRange('tp'); assert.equal(await exp('the-army-painter'), 'false');
      assert.equal(await p.getAttribute('#panel', 'role'), 'region');
      assert.equal(await p.locator('#side [tabindex="0"]').count(), 1, 'one tab stop in the tree');
    assert.equal(await p.locator('.sw.used').count(), 1);
  });
  await t('Tooltip on hover shows name and target layer', async () => {
    await p.hover(sw('tp:Stormwolf Blue 5'));
    const txt = await p.textContent('#tip');
    assert(await p.isVisible('#tip') && txt.includes('Stormwolf Blue 5') && /→ \w/.test(txt), txt);
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
    await p.focus('.slot[data-slot="4"]'); await p.keyboard.press('Enter');
    assert.equal(await p.textContent('.slot.active .lname'), 'Top highlight');
  });

  await t('All examples load with valid paints, dark → light', async () => {
    const r = await p.evaluate(() => PRESETS.map(x => ({ n: x.name, ok: x.layers.every(id => !id || BY_ID[id]), l: x.layers.slice(0, 5).filter(Boolean).map(id => lum(BY_ID[id].hex)) })));
    assert.equal(r.length, 3);
    for (const x of r) { assert(x.ok, x.n + ' has unknown paint'); for (let i = 1; i < x.l.length; i++) assert(x.l[i] > x.l[i - 1], x.n + ' not ascending'); }
    for (const x of r) { await p.click(`#presets .chip:has-text("${x.n}")`); assert((await filled()) >= 5, x.n); }
  });
  await t('A single paint is shown flat (one colour, no light and shadow)', async () => {
    await p.click('#btn-clear'); await p.click(sw('tp:Dataslate Grey 3'));
    const lit = await px(291, 80), dark = await px(100, 300);
    assert.deepEqual(lit.slice(0, 3), dark.slice(0, 3));
    await p.click('#mode-steps'); assert.deepEqual((await px(291, 80)).slice(0, 3), (await px(100, 300)).slice(0, 3));
    await p.click('#mode-smooth');
  });
  await t('Five layers, no edge highlight, picking sets no status text', async () => {
    assert.equal(await p.locator('.optional').count(), 0);
    assert.equal(await p.locator('.slot').count(), 5);
    assert(!(await p.textContent('#recipe')).includes('Edge'));
    assert.equal(await p.textContent('#status'), '');
  });
  const bright = c => c[0] + c[1] + c[2];
  await t('Heading is "Sphere", no Reverse button', async () => {
    assert.equal((await p.textContent('#drag-hint')).trim(), '☀ Drag to move light');
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
    const img = () => p.evaluate(() => document.querySelector('#sphere').toDataURL());
    const ref = await img();
    await p.focus('#sphere'); await p.keyboard.press('ArrowDown'); await p.keyboard.press('ArrowDown');
    assert.notEqual(await img(), ref);
    await p.dblclick('#sphere'); assert.equal(await img(), ref);
  });
  await t('Stepped mode changes rendering', async () => {
    const a = await px(150, 260); await p.click('#mode-steps'); const b = await px(150, 260);
    assert.notDeepEqual(a, b); await p.click('#mode-smooth');
  });
  await t('Copy recipe puts readable text on clipboard', async () => {
    await p.click('#presets .chip:has-text("Ultramarines blue")');
    await p.click('#btn-copy');
    const clip = await p.evaluate(() => navigator.clipboard.readText());
    assert(clip.startsWith('Deep shadow: Ultramar Blue 1 (Warhammer Tone Pro)') && clip.includes('\nHighlight: Alpha Blue (The Army Painter Warpaints Fanatic)') && clip.includes('Top highlight: Ultramar Blue 5') && !clip.includes('Edge'), clip);
  });
  await t('Clear all', async () => { await p.click('#btn-clear'); assert.equal(await filled(), 0); assert.equal((await px(190, 190))[3], 0); });

  await t('Save, reload, load, delete; names are not interpreted as HTML', async () => {
    await p.click('#presets .chip:has-text("Ultramarines blue")');
    await p.fill('#save-name', '<img src=x onerror=alert(1)>');
    await p.click('#save-form button');
    assert.equal(await p.locator('#saved img').count(), 0);
    await p.reload();
    assert.equal(await p.locator('#saved .chip').count(), 1);
    await p.click('#saved .chip'); assert.equal(await filled(), 5);
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
    assert.deepEqual(names, ['Ultramar Blue 1', 'Ultramar Blue 3'], 'old edge highlight is dropped');
    await p.evaluate(() => localStorage.clear());
  });

  await t('Warhammer Colour: 23 groups, Base marks, long groups wrap', async () => {
    await goRange('wc');
    assert.equal(await p.locator('.strip').count(), 23);
    assert.equal(await p.locator('.sw').count(), 150);
    assert(!(await p.locator('.sw .n').allTextContents()).some(x => /\d/.test(x)), 'Colour swatches carry no numbers');
    assert.equal(await p.locator('.sw .n').count(), 150, 'every Colour paint shows B or L');
    assert.equal(await p.textContent(sw('wc:Calgar Blue') + ' .n'), 'L');
    assert.equal(await p.textContent(sw('wc:Macragge Blue') + ' .n'), 'B');
    assert.equal(await p.textContent(sw('wc:Castellax Bronze') + ' .n'), 'L');
    assert.equal(await p.textContent(sw('wc:Warpfiend Grey') + ' .n'), 'L');
    assert.equal(await p.locator('[data-id="wc:Ceramite White"], [data-id="wc:Perisher Pink"]').count(), 0, 'removed paints');
    const h = await p.locator('.strip:has-text("Skin") .ramp').evaluate(e => e.getBoundingClientRect().height);
    assert(h > 60, 'Skin row should wrap to two lines, height ' + h);
    await p.hover(sw('wc:Macragge Blue')); assert((await p.textContent('#tip')).includes('Base paint')); await p.mouse.move(5, 5);
  });
  await t('Colour paints can be used, tooltip shows Base/Layer', async () => {
    await p.click('#btn-clear');
    await p.click(sw('wc:Macragge Blue'));
    assert.equal(await filled(), 1);
    await p.hover(sw('wc:Calgar Blue')); assert((await p.textContent('#tip')).includes('Blue · Layer paint'));
    await p.mouse.move(5, 5);
  });
  await t('Metallics are reference only', async () => {
    const before = await filled();
    const id = await p.locator('.strip:has-text("Gold & brass") .sw').first().getAttribute('data-id');
    await p.click(sw(id), { force: true });
    assert.equal(await filled(), before, 'metallic must not be added');
    assert.equal(await p.textContent('#status'), '', 'no message');
    assert((await p.textContent('#tip')).includes('reference only'));
    assert.equal(await p.getAttribute(sw(id), 'aria-disabled'), 'true');
    assert(+(await p.locator(sw(id)).evaluate(e => getComputedStyle(e).opacity)) < 1, 'dimmed');
    await p.mouse.move(5, 5);
    assert.equal(await p.locator('.sw.metal').count(), 22);
  });
  await t('Shades are reference only and marked translucent', async () => {
    await goRange('ws');
    assert.equal(await p.locator('.sw.wash').count(), 19);
    assert.deepEqual(await p.locator('.strip .label').evaluateAll(l => l.map(x => x.firstChild.textContent)), ['Yellow','Orange','Red','Purple','Blue','Turquoise','Green','Brown','Bone & skin','Black','Grey']);
    assert.notEqual(await p.locator('.sw.wash').first().evaluate(e => getComputedStyle(e).backgroundImage), 'none', 'hatching visible');
    assert.equal(await p.locator('.sw .n').count(), 0, 'Shade swatches carry no numbers');
    assert((await p.textContent('#tab-ws')).includes('reference'));
    await p.hover(sw('ws:Nuln Oil')); assert((await p.textContent('#tip')).includes('reference only')); await p.mouse.move(5, 5);
    const before = await filled();
    await p.click(sw('ws:Nuln Oil'), { force: true }); assert.equal(await filled(), before);

  });
  await t('Warhammer Dry: selectable, grouped, no numbers, metallics reference only', async () => {
    await goRange('wd');
    assert.equal(await p.locator('.strip').count(), 13);
    assert.equal(await p.locator('.sw').count(), 31);
    assert.equal(await p.locator('.sw .n').count(), 0);
    assert.equal(await p.locator('.sw.metal').count(), 2);
    await p.click('#btn-clear'); await p.click(sw('wd:Praxeti White'));
    assert.deepEqual(await p.locator('.slot .pname').allTextContents(), ['Praxeti White']);
    assert((await p.locator('.slot[data-slot="0"] .pmeta').textContent()).includes('Dry'));
    await p.click(sw('wd:Sigmarite'), { force: true }); assert.equal(await filled(), 1);
    assert.equal(await p.textContent('.inrec[data-k="wd"]'), '1');
    await p.click('#btn-clear');
  });
  await t('Brand remembers its last range; badges count per range and brand', async () => {
    await goRange('wc'); await p.click('#btn-clear'); await p.click(sw('wc:Macragge Blue'));
    await brand('the-army-painter'); await brand('warhammer');
    assert.equal(await p.getAttribute('#tab-wc', 'aria-selected'), 'true');
    assert.equal(await p.textContent('.inrec[data-k="wc"]'), '1');
    const n = await p.evaluate(() => layers.filter(id => id && BY_ID[id].brand === 'Warhammer').length);
    assert.equal(await brandCount('Warhammer'), n);
  });
  await t('Saved recipes never load reference-only paints', async () => {
    await p.evaluate(() => localStorage.setItem('layer-mixer-recipes-v2', JSON.stringify([{ name: 'sneaky', layers: ['ws:Nuln Oil', 'wc:Retributor Armour', 'wc:Kantor Blue'] }])));
    await p.reload(); await p.click('#saved .chip');
    assert.deepEqual(await p.locator('.slot .pname').allTextContents(), ['Kantor Blue']);
    await p.evaluate(() => localStorage.clear()); await p.reload();
  });
  await t('Data: unique ids, valid hex, Fanatic rows 6–7 paints', async () => {
    const r = await p.evaluate(() => ({ ids: Object.keys(BY_ID).length, hex: Object.values(BY_ID).every(x => /^#[0-9a-f]{6}$/.test(x.hex)), wf: RANGE_BY_KEY.wf.rows.filter(r => r.series !== false).map(r => r.paints.length) }));
    assert.equal(r.ids, 1223); assert(r.hex); assert(r.wf.every(n => n >= 6 && n <= 7), r.wf);
  });
  await t('Every swatch and slot has an accessible name', async () => {
    const missing = await p.evaluate(() => [...document.querySelectorAll('.sw,.slot,#side .bh,#side .rg,#side .bpin')].filter(e => !(e.getAttribute('aria-label') || e.textContent.trim())).length);
    assert.equal(missing, 0);
  });
  await t('Security: no innerHTML/eval/external URLs in source', async () => {
    assert(!/innerHTML|outerHTML|insertAdjacentHTML|eval\(|new Function|document\.write/.test(SRC));
    /* the SVG namespace is an identifier, not a request */
    assert(!/https?:\/\//.test(fs.readFileSync(path.join(DIST, BUILT[0]), 'utf8').split('http://www.w3.org/2000/svg').join('')));
  });
  await t('Right column fits 1440×900 without scrolling (recipe loaded)', async () => {
    await p.setViewportSize({ width: 1440, height: 900 }); await p.reload();
    await p.click('#presets .chip:has-text("Ultramarines blue")');
    const o = await p.evaluate(() => { const b = document.querySelector('#bench'); return b.scrollHeight - b.clientHeight; });
    assert(o <= 0, 'overflow ' + o);
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
  await t('Shapes: switch, label, centred, inside canvas', async () => {
    await p.click('.chip:has-text("Ultramarines")');
    const box = () => p.evaluate(() => { const c = document.querySelector('#sphere'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1;
      for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 128) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      return { h: y1 - y0 + 1, top: y0, bottom: c.height - 1 - y1, left: x0, right: c.width - 1 - x1 }; });
    const hs = [];
    for (const [k, name] of [['cylinder', 'Cylinder'], ['cone', 'Cone'], ['roundcube', 'Block'], ['cloth', 'Cloth'], ['sphere', 'Sphere']]) {
      await p.click(`[data-shape=${k}]`);
      assert.equal(await p.getAttribute(`[data-shape=${k}]`, 'aria-pressed'), 'true');
      assert.equal(await p.locator('.shapes [aria-pressed=true]').count(), 1);
      assert.equal(await p.textContent('#shape-name'), name);
      assert((await p.getAttribute('#sphere', 'aria-label')).startsWith(name));
      const b = await box(); hs.push(b.h);
      assert(b.top >= 4 && b.bottom >= 4 && b.left >= 4 && b.right >= 4, `${k} touches edge ${JSON.stringify(b)}`);
      assert(Math.abs(b.top - b.bottom) <= 6 && Math.abs(b.left - b.right) <= 6, `${k} not centred ${JSON.stringify(b)}`);
      assert(b.h > 200, `${k} too small ${b.h}`);
    }
    const nonSphere = hs.slice(0, 3), avg = nonSphere.reduce((a, b) => a + b) / 3;
    assert(nonSphere.every(h => Math.abs(h - avg) / avg < 0.05), `sizes differ ${hs}`);
  });
  await t('Shapes: empty recipe shows a dim form, sphere keeps the dashed circle', async () => {
    await p.click('#btn-clear'); await p.click('[data-shape=roundcube]');
    const c = await px(190, 190); assert(c[3] === 255 && c[0] < 80, `${c}`);
    await p.click('[data-shape=sphere]'); assert.equal((await px(190, 190))[3], 0);
  });
  await t('Advanced: light strength changes highlight size, popover opens and closes', async () => {
    await p.click('.chip:has-text("Ultramarines")'); await p.click('[data-shape=sphere]'); await p.click('#mode-steps');
    const top = () => p.evaluate(() => { const c = document.querySelector('#sphere'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      const t = window.__topRgb; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 3] === 255 && d[i] === t[0] && d[i + 1] === t[1] && d[i + 2] === t[2]) n++; return n; });
    await p.evaluate(() => { window.__topRgb = hexToRgb(BY_ID[layers[4]].hex).map(Math.round); });
    assert.equal(await p.isHidden('#adv'), true);
    await p.click('#btn-adv'); assert.equal(await p.getAttribute('#btn-adv', 'aria-expanded'), 'true'); assert.equal(await p.isVisible('#light-str'), true);
    const mid = await top();
    await p.fill('#light-str', '0'); const soft = await top();
    await p.fill('#light-str', '100'); const strong = await top();
    assert(soft < mid && mid < strong, `${soft} ${mid} ${strong}`);
    await p.fill('#light-str', '50');
    await p.keyboard.press('Escape'); assert.equal(await p.isHidden('#adv'), true);
    await p.click('#mode-smooth');
  });
  await t('Smooth cylinder has no hard jump next to the flat top', async () => {
    await p.click('.chip:has-text("Ultramarines")'); await p.click('[data-shape=cylinder]'); await p.click('#mode-smooth');
    const maxStep = await p.evaluate(() => { const c = document.querySelector('#sphere'), y = 300, d = c.getContext('2d').getImageData(0, y, c.width, 1).data; let m = 0;
      for (let x = 80; x < 300; x++) { const o = x * 4; if (d[o + 3] < 255 || d[o + 7] < 255) continue; m = Math.max(m, Math.abs(d[o] - d[o + 4]) + Math.abs(d[o + 1] - d[o + 5]) + Math.abs(d[o + 2] - d[o + 6])); } return m; });
    assert(maxStep <= 12, `step ${maxStep}`);
    await p.click('[data-shape=sphere]');
  });
  await t('Block: face colours follow the light and are stable', async () => {
    await p.click('.chip:has-text("Ultramarines")'); await p.click('[data-shape=roundcube]'); await p.click('#mode-steps');
    const lum = c => c[0] + c[1] + c[2];
    const faces = () => Promise.all([px(110, 200), px(270, 200), px(190, 80)]);   // left, right, top
    await p.evaluate(() => setLight(.7, .1)); const a = await faces();
    await p.evaluate(() => setLight(-.5, .5)); await p.evaluate(() => setLight(.7, .1)); const a2 = await faces();
    assert.deepEqual(a, a2);
    assert(lum(a[1]) > lum(a[0]), `right face lit ${a}`);
    await p.evaluate(() => setLight(-.7, .1)); const b = await faces();
    assert(lum(b[0]) > lum(b[1]), `left face lit ${b}`);
    await p.evaluate(() => setLight(...DEFAULT_LIGHT)); await p.click('#mode-smooth'); await p.click('[data-shape=sphere]');
  });
  await t('Air: selectable; metallics and clears reference only', async () => {
    await p.setViewportSize({ width: 1440, height: 900 });
    await p.click('#btn-clear'); await brand('warhammer'); await p.click('#tab-wa');
    assert.equal(await p.locator('.sw').count(), 77);
    await p.click(sw('wa:Macragge Blue')); assert.equal(await filled(), 1);
    assert.equal(await p.evaluate(() => BY_ID['wa:Macragge Blue'].hex), await p.evaluate(() => BY_ID['wc:Macragge Blue'].hex), 'same value as Base');
    const before = await filled();
    await p.click(sw('wa:Leadbelcher'), { force: true }); await p.click(sw('wa:Angron Red Clear'), { force: true }); assert.equal(await filled(), before);
    await p.hover(sw('wa:Angron Red Clear')); assert((await p.textContent('#tip')).includes('Reference only')); assert(!(await p.textContent('#tip')).includes('Clear · '), 'no repeated row name');
    await p.hover(sw('wa:Runefang Steel')); assert((await p.textContent('#tip')).includes('Metallic · reference only')); await p.mouse.move(5, 5);
    assert(await p.locator(sw('wa:Angron Red Clear')).evaluate(e => e.classList.contains('wash')));
    assert.equal(await p.locator('.sw.n, .sw .n').count(), 0, 'no numbers or letters on Air');
    assert.equal(await p.locator(sw('wa:Air Caste Thinner')).count(), 0);
  });
  await t('Primer: sprays and brush-on primer selectable, metallic primers reference only', async () => {
    await p.click('#tab-wpr'); assert.equal(await p.locator('.sw').count(), 12);
    assert((await p.textContent('#tab-wpr')).trim().startsWith('Primer'));
    for (const n of ['Purity Seal', 'The Fang', 'Corax White', 'Caliban Green']) assert.equal(await p.locator(sw('wpr:' + n)).count(), 0, n);
    const before = await filled();
    await p.click(sw('wpr:Wraithbone')); await p.click(sw('wpr:Imperial Primer')); assert.equal(await filled(), before + 2);
    await p.click(sw('wpr:Retributor Armour'), { force: true }); assert.equal(await filled(), before + 2);
    assert.equal(await p.locator(sw('wpr:Munitorum Varnish')).count(), 0, 'varnish lives under Technical');
  });
  await t('Reference ranges marked with an eye, reference rows muted', async () => {
    await brand('warhammer');
      assert.deepEqual(await refKeys(), ['ws', 'wct', 'wt']); assert.equal(await p.locator('#side .rg .eye').count(), 3);
      for (const [w, h] of [[1440, 900], [1280, 800], [1100, 700]]) { await p.setViewportSize({ width: w, height: h });
        assert(await p.evaluate(() => { const r = document.querySelector('#tab-wt').getBoundingClientRect(); return r.width > 0 && r.right <= document.querySelector('#side').getBoundingClientRect().right; }), `Technical visible at ${w}`); }
      await p.setViewportSize({ width: 1440, height: 900 });
    await p.click('#tab-wa');
    assert.equal(await p.locator('.strip.ref').count(), 3);
    await p.click('#tab-wct'); assert.equal(await p.locator('.strip.ref').count(), 0);
  });
  await t('Contrast and Technical: reference only, grouped', async () => {
    await p.click('#tab-wct'); assert.equal(await p.locator('.sw').count(), 61);
    assert.equal(await p.locator('.sw:not(.info)').count(), 0);
    assert.equal(await p.locator('.strip').count(), 13);
    await p.hover(sw('wct:Blood Angels Red')); assert((await p.textContent('#tip')).includes('Contrast · reference only')); await p.mouse.move(5, 5);
    await p.click('#tab-wt'); assert.equal(await p.locator('.sw').count(), 25);
    for (const n of ['Lahmian Medium', 'Contrast Medium', "'Ardcoat", 'Stormshield', 'Munitorum Varnish']) assert(await p.locator(sw('wt:' + n)).evaluate(e => e.classList.contains('medium')), n);
    const before = await filled(); await p.click(sw('wt:Typhus Corrosion'), { force: true }); assert.equal(await filled(), before);
    await p.click('#tab-tp');
  });
  await t('Look: dark marks on light swatches, range tabs do not shift when selected', async () => {
    await p.setViewportSize({ width: 1440, height: 900 }); await brand('warhammer'); await p.click('#tab-tp');
    assert(await p.locator(sw('tp:Hawkshroud Yellow 5')).evaluate(e => e.classList.contains('light')));
    assert(!(await p.locator(sw('tp:Carmine Blades 1')).evaluate(e => e.classList.contains('light'))));
    const x = () => p.locator('#tab-wt').evaluate(e => Math.round(e.getBoundingClientRect().left));
    const a1 = await x(); await p.click('#tab-wa'); const a2 = await x(); await p.click('#tab-tp');
    assert.equal(a1, a2, 'tabs moved');
  });
  await t('Look: empty preview outline visible, five tones on one line at 1262 and 1440', async () => {
    await p.click('#btn-clear'); await p.click('[data-shape=sphere]');
    const ring = await p.evaluate(() => { const c = document.querySelector('#sphere'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0, lum = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 40) { n++; lum = Math.max(lum, d[i] + d[i + 1] + d[i + 2]); } return { n, lum }; });
    assert(ring.n > 500 && ring.lum > 200, JSON.stringify(ring));
    for (const w of [1262, 1440]) {
      await p.setViewportSize({ width: w, height: 900 }); await brand('warhammer'); await p.click('#tab-tp');
      const wrapped = await p.evaluate(() => [...document.querySelectorAll('.strip')].filter(x => { const t = [...x.querySelectorAll('.sw')].map(e => e.getBoundingClientRect().top); return Math.max(...t) - Math.min(...t) > 2; }).length);
      assert.equal(wrapped, 0, `wrapped rows at ${w}`);
    }
    await p.setViewportSize({ width: 1440, height: 900 });
  });
  await t('Pro Acryl: six ranges, usable and reference split, picks work', async () => {
    await p.setViewportSize({ width: 1440, height: 900 }); await p.click('#btn-clear');
    await brand('monument-hobbies');
    assert.deepEqual(await usableKeys(), ['pa', 'pae', 'pap']);
    assert.deepEqual(await refKeys(), ['pa1', 'paw', 'pat']);
    await goRange('pa'); assert.equal(await p.locator('.sw').count(), 122); assert.equal(await p.locator('.sw .n').count(), 0, 'no numbers');
    await p.click(sw('pa:Bold Titanium White')); assert.equal(await filled(), 1);
    const before = await filled(); await p.click(sw('pa:Rich Gold'), { force: true }); assert.equal(await filled(), before, 'metallic is reference only');
    await goRange('pae'); assert.equal(await p.locator('.sw').count(), 22);
    await goRange('pap'); assert.equal(await p.locator('.sw').count(), 13); await p.click(sw('pap:White')); assert.equal(await filled(), 2);
    await goRange('pa1'); assert.equal(await p.locator('.sw.contrast').count(), 24);
    await goRange('paw'); assert.equal(await p.locator('.sw.wash').count(), 16);
    await goRange('pat'); assert.equal(await p.locator('.sw').count(), 29); assert.equal(await p.locator('.sw:not(.info)').count(), 0);
    assert.match(await p.textContent('#notes'), /not affiliated with any of the paint manufacturers/);
    await p.click('#btn-clear'); await brand('warhammer'); await p.click('#tab-tp');
  });
  await t('Army Painter: Air and Primer selectable, Speedpaint/Wash/Effects reference', async () => {
    await p.setViewportSize({ width: 1440, height: 900 }); await p.click('#btn-clear');
    await goRange('apa'); assert.equal(await p.locator('.sw').count(), 126);
    for (const [n, g] of [['Traitor Red', 'Brown'], ['Husk Brown', 'Brown'], ['Daemonic Yellow', 'Yellow'], ['Lava Orange', 'Orange'], ['Pure Red', 'Red']])
      assert.equal(await p.locator(sw('apa:' + n)).evaluate(e => e.closest('.strip').querySelector('.label').firstChild.textContent.trim()), g, n); assert.equal(await p.locator('.sw .n').count(), 0);
    await p.click(sw('apa:Matt Black')); assert.equal(await filled(), 1);
    await p.click(sw('apa:Gun Metal'), { force: true }); assert.equal(await filled(), 1, 'metallic is reference only');
    await goRange('app'); await p.click(sw('app:Matt Black')); assert.equal(await filled(), 2);
    await goRange('aps'); assert.equal(await p.locator('.sw.contrast').count(), 89, 'Speedpaint colours, not the medium');
    assert.equal(await p.locator('.sw[data-id^="aps:Speedpaint Medium"]').count(), 1, 'one Speedpaint Medium');
    assert.deepEqual(await p.locator('.strip .label').evaluateAll(e => e.map(x => x.textContent.trim())), ['Yellow', 'Orange', 'Red', 'Pink', 'Purple', 'Blue', 'Turquoise', 'Green', 'Brown', 'Bone & skin', 'Black', 'Grey', 'White', 'Metallics', 'Medium']);
    await goRange('apw'); assert.equal(await p.locator('.sw.wash').count(), 18);
    await goRange('ape'); assert.equal(await p.locator('.sw:not(.info)').count(), 0);
    assert.equal(await p.locator('.strip:has-text("Glow") .sw:not(.unknown):not(.medium)').count(), 5, 'glows have their colour');
    assert.equal(await p.evaluate(() => BY_ID['ape:Plasma Coil Glow'].hex), '#01c6fe');
    assert.deepEqual(await refKeys(), ['aps', 'apw', 'ape']);
    await goRange('pat'); assert.equal(await p.locator('.strip:has-text("Basing texture") .sw:not(.unknown):not(.medium)').count(), 8, 'textures have their colour');
    assert.equal(await p.evaluate(() => BY_ID['pat:Red Earth (fine)'].hex), '#d56132');
    await p.click('#btn-clear'); await brand('warhammer'); await p.click('#tab-tp');
  });
  await t('Colour groups are never merged (e.g. no "Yellow & orange")', async () => {
    const bad = await p.evaluate(() => RANGES.flatMap(r => r.rows.map(x => `${r.short}: ${x.label}`)).filter(l => /yellow.*orange|orange.*(red|yellow)|red.*(pink|purple)|pink.*purple|blue.*turquoise|turquoise.*jade|brown.*(bone|sepia)|skin.*bone/i.test(l)));
    assert.deepEqual(bad, []);
  });
  await t('Black, grey and white are separate rows, only where a range has them', async () => {
    const res = await p.evaluate(() => {
      const BLACK = ['Nuln Oil', 'Dark Tone', 'Dark Blue Tone'];
      const tone = x => { const n = x.name; if (BLACK.includes(n) || /Black/.test(n)) return 'Black'; if (/White/.test(n)) return 'White'; if (/Grey/.test(n)) return 'Grey';
        const l = [1, 3, 5].reduce((a, i) => a + parseInt(x.hex.slice(i, i + 2), 16), 0) / 765; return l < .15 ? 'Black' : l > .85 ? 'White' : 'Grey'; };
      const mixed = RANGES.flatMap(r => r.rows.filter(x => /^(black|grey|white)\b.*(&|,)/i.test(x.label) && r.id !== 'wf').map(x => `${r.short}: ${x.label}`));
      const wrong = RANGES.flatMap(r => r.rows.filter(x => ['Black', 'Grey', 'White'].includes(x.label))
        .flatMap(x => x.paints.filter(q => tone(q) !== x.label).map(q => `${r.short}: ${q.name} in ${x.label}`)));
      const empty = RANGES.flatMap(r => r.rows.filter(x => !x.paints.length).map(x => `${r.short}: ${x.label}`));
      return { mixed, wrong, empty, pae: RANGES.find(r => r.id === 'pae').rows.map(x => x.label).slice(-2) };
    });
    assert.deepEqual(res.mixed, [], 'no mixed neutral groups'); assert.deepEqual(res.wrong, []); assert.deepEqual(res.empty, [], 'no empty rows');
    assert.deepEqual(res.pae, ['Black', 'White'], 'Expert Acrylics has no grey row');
  });
  await t('Colourless products show a letter (V varnish, P primer, M medium) and no pattern', async () => {
    const m = await p.evaluate(() => Object.values(BY_ID).filter(x => x.medium).map(x => [x.id, x.abbr]));
    assert(m.length >= 20, m.length);
    assert(m.every(([, a]) => /^[MVP]$/.test(a)), JSON.stringify(m));
    const map = Object.fromEntries(m);
    assert.equal(map["wt:Lahmian Medium"], 'M'); assert.equal(map["wt:'Ardcoat"], 'V'); assert.equal(map["ape:Brush-On Primer"], 'P'); assert.equal(map["apw:Wash Medium"], 'M');
    await goRange('apw');
    const st = await p.locator(sw('apw:Wash Medium')).evaluate(e => { const c = getComputedStyle(e), a = getComputedStyle(e, '::after'); return { img: c.backgroundImage, txt: a.content }; });
    assert.equal(st.img, 'none'); assert.equal(st.txt, '"M"');
    await goRange('aps'); assert(!(await p.locator(sw('aps:Speedpaint Medium')).evaluate(e => e.classList.contains('contrast'))));
    await brand('warhammer'); await p.click('#tab-tp');
  });
  await t('Range names follow the manufacturers', async () => {
    const names = await p.evaluate(() => BRANDS.map(b => b.name + ': ' + b.ranges.map(k => RANGE_BY_KEY[k].range).join(', ')));
    assert.deepEqual(names, ['Warhammer: Tone Pro, Base & Layer, Air, Primer, Dry, Shade, Contrast, Technical',
      'The Army Painter: Warpaints Fanatic, Warpaints Air, Colour Primer, Speedpaint, Wash, Effects',
      'Monument Hobbies: Pro Acryl, Expert Acrylics, Prime, 1-Step, Wash, Specials']);
  });
  await t('Inventory: mode switch, mark by click, row and drag; counts; persists', async () => {
    await p.setViewportSize({ width: 1440, height: 900 }); await p.evaluate(() => localStorage.removeItem('layer-mixer-owned-v1')); await p.reload();
    assert(await p.locator('#filter').isHidden(), 'no filter without inventory');
    assert(await p.locator('#inv-panel').isHidden());
    await p.click('#mode-inv');
    assert(await p.locator('#inv-panel').isVisible()); assert(await p.locator('#recipe').isHidden());
    assert(await p.locator('#filter').isVisible(), 'in My paints the filter is always there');
    assert(await p.locator('#show-mine').isDisabled(), 'but off while nothing is marked');
    const top0 = await p.locator(sw('tp:Ultramar Blue 1')).evaluate(e => e.getBoundingClientRect().top);
    await p.click(sw('tp:Ultramar Blue 1'));
    assert.equal(await p.locator(sw('tp:Ultramar Blue 1')).evaluate(e => e.getBoundingClientRect().top), top0, 'the chart does not jump');
    assert(!(await p.locator('#show-mine').isDisabled())); assert(await p.locator(sw('tp:Ultramar Blue 1')).evaluate(e => e.classList.contains('owned')));
    assert.equal(await filled(), 0, 'a click in My paints mode does not touch the recipe');
    await p.click(sw('tp:Ultramar Blue 1')); assert(!(await p.locator(sw('tp:Ultramar Blue 1')).evaluate(e => e.classList.contains('owned'))), 'click again removes');
    await p.click('.strip:has-text("Ultramar Blue") .label'); assert.equal(await p.locator('.strip:has-text("Ultramar Blue") .sw.owned').count(), 5, 'row name marks the whole row');
    // drag across Carmine Blades 1-3
    const box = async id => p.locator(sw(id)).boundingBox();
    const a = await box('tp:Carmine Blades 1'), c = await box('tp:Carmine Blades 3');
    await p.mouse.move(a.x + 10, a.y + 10); await p.mouse.down(); await p.mouse.move(c.x + 10, c.y + 10, { steps: 8 }); await p.mouse.up();
    assert.equal(await p.locator('.strip:has-text("Carmine Blades") .sw.owned').count(), 3, 'drag marks several');
    assert.match(await p.textContent('#inv-brands .cur'), /Warhammer8 \/ \d+/);
    assert.match(await p.textContent('#inv-brands .inv-ranges li.on'), /Tone Pro8 \/ 150/);
    assert.equal(await p.locator('#side .own-count').count(), 0, 'no inventory counters in the sidebar');
    await goRange('ws'); await p.click(sw('ws:Nuln Oil'), { force: true }); // reference-only paints can be owned too
    assert(await p.locator(sw('ws:Nuln Oil')).evaluate(e => e.classList.contains('owned')));
    await p.reload(); await goRange('tp');
    assert.equal(await p.evaluate(() => owned.size), 9, 'inventory survives a reload');
    assert(await p.locator(sw('tp:Ultramar Blue 3')).evaluate(e => !!e.querySelector('.own')), 'owned mark also shown in Mix mode');
    const dots = await p.locator('.sw.owned .own').evaluateAll(d => [...new Set(d.map(x => getComputedStyle(x).backgroundColor))]);
    assert.deepEqual(dots, ['rgb(255, 255, 255)'], 'owned dots are always white');
    const onLight = await p.evaluate(() => { const b = document.querySelector('.sw.light'); const d = document.createElement('span'); d.className = 'own'; b.append(d);
      const c = getComputedStyle(d).backgroundColor; d.remove(); return c; });
    assert.equal(onLight, 'rgb(255, 255, 255)', 'white on light paints too');
  });
  await t('Inventory: Mine filter and missing paints in Paints needed', async () => {
    assert(await p.locator('#filter').isVisible());
    await p.click('#show-mine');
    assert.equal(await p.locator('.strip:visible').count(), 2, 'only rows with owned paints');
    assert(await p.locator(sw('tp:Ultramar Blue 1')).isVisible()); assert(!(await p.locator(sw('tp:Carmine Blades 4')).isVisible()));
    const tops = await p.locator('.strip:has-text("Carmine Blades") .sw').evaluateAll(b => b.map(x => x.getBoundingClientRect().left));
    assert.equal(tops.length, 5, 'triad positions are kept');
    await p.click('#show-all');
    await p.click('#presets .chip:has-text("Ultramarines blue")');
    assert.equal(await p.textContent('#shop .shop-head span'), '2 missing');
    assert.deepEqual(await p.locator('#shop .missing').allTextContents(), ['Ultramarine Blue', 'Alpha Blue']);
  });
  await t('Inventory: export and import (paints and recipes)', async () => {
    await p.click('#mode-inv');
    assert.deepEqual(await p.locator('#inv-panel .btn:visible').allTextContents(), ['Save', 'Save as', 'Load'], 'Chromium has the file picker');
    // a fake file picker: Save as asks once, Save then writes to the same file without asking
    await p.evaluate(() => {
      window.__asked = 0; window.__writes = [];
      const h = { name: 'my-paints.json', queryPermission: async () => 'granted',
        createWritable: async () => ({ write: async d => window.__writes.push(d), close: async () => {} }) };
      window.showSaveFilePicker = async () => { window.__asked++; return h; };
    });
    await p.click('#btn-saveas');
    await p.waitForFunction(() => window.__writes.length === 1);
    assert.equal(await p.textContent('#inv-status'), 'Saved to my-paints.json.');
    await p.click('#btn-export'); await p.waitForFunction(() => window.__writes.length === 2);
    assert.equal(await p.evaluate(() => window.__asked), 1, 'Save writes to the remembered file without a dialog');
    assert.equal(JSON.parse(await p.evaluate(() => window.__writes[1])).owned.length, 9);
    await p.evaluate(() => { invFile = null; window.__writes = []; }); await p.click('#btn-export');
    await p.waitForFunction(() => window.__writes.length === 1);
    assert.equal(await p.evaluate(() => window.__asked), 2, 'Save without a remembered file asks like Save as');
    // browsers without the file picker: no Save as, Save is a download, Load uses the file input
    await p.addInitScript(() => { delete window.showSaveFilePicker; delete window.showOpenFilePicker; });
    await p.reload(); await p.click('#mode-inv');
    assert.deepEqual(await p.locator('#inv-panel .btn:visible').allTextContents(), ['Save', 'Load']);
    const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#btn-export')]);
    assert.equal(dl.suggestedFilename(), 'layer-mixer-my-paints.json');
    const file = await dl.path(); const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.equal(data.app, 'layer-mixer'); assert.equal(data.owned.length, 9); assert(Array.isArray(data.recipes));
    await p.evaluate(() => { localStorage.removeItem('layer-mixer-owned-v1'); }); await p.reload(); await p.click('#mode-inv');
    assert.equal(await p.evaluate(() => owned.size), 0);
    data.recipes.push({ name: 'Imported', layers: ['tp:Ultramar Blue 2', 'nope:Bad'] }); data.owned.push('nope:Bad');
    const tmp = path.join(require('os').tmpdir(), 'lm-import.json'); fs.writeFileSync(tmp, JSON.stringify(data));
    await p.setInputFiles('#import-file', tmp);
    await p.waitForFunction(() => owned.size === 9);
    assert.match(await p.textContent('#inv-status'), /Loaded 9 paints and \d+ recipes/);
    assert(await p.locator('#saved .chip:has-text("Imported")').count() === 1);
    fs.writeFileSync(tmp, '{"nope":1}'); await p.setInputFiles('#import-file', tmp);
    await p.waitForFunction(() => /not a Layer Mixer file/.test(document.querySelector('#inv-status').textContent));
    assert.equal(await p.evaluate(() => owned.size), 9, 'a bad file changes nothing');
    await p.click('#mode-mix'); await p.evaluate(() => localStorage.removeItem('layer-mixer-owned-v1')); await p.reload();
  });
  await t('Inventory: keyboard, screen reader states, safe import', async () => {
    await p.click('#mode-inv'); await goRange('tp');
    await p.focus(sw('tp:Khemri Sands 2')); await p.keyboard.press('Enter');
    assert.equal(await p.getAttribute(sw('tp:Khemri Sands 2'), 'aria-pressed'), 'true', 'Enter toggles');
    await p.keyboard.press('Space'); assert.equal(await p.getAttribute(sw('tp:Khemri Sands 2'), 'aria-pressed'), 'false');
    await p.focus('.strip:has-text("Khemri Sands") .label'); await p.keyboard.press('Enter');
    assert.equal(await p.locator('.strip:has-text("Khemri Sands") .sw.owned').count(), 5, 'row by keyboard');
    await goRange('ws'); assert.equal(await p.locator('.sw[aria-disabled]').count(), 0, 'reference paints are not "disabled" while sorting paints');
    const before = await p.evaluate(() => owned.size);
    const tmp = path.join(require('os').tmpdir(), 'lm-bad.json'); fs.writeFileSync(tmp, JSON.stringify({ app: 'layer-mixer', owned: 'x' }));
    await p.setInputFiles('#import-file', tmp); await p.waitForFunction(() => /not a Layer Mixer file/.test(document.querySelector('#inv-status').textContent));
    assert.equal(await p.evaluate(() => owned.size), before, 'malformed file leaves the inventory alone');
    fs.writeFileSync(tmp, JSON.stringify({ app: 'layer-mixer', owned: ['tp:Ultramar Blue 1'] }));
    p.once('dialog', d => d.dismiss()); await p.setInputFiles('#import-file', tmp); await p.waitForTimeout(300);
    assert.equal(await p.evaluate(() => owned.size), before, 'cancel keeps the inventory');
    p.once('dialog', d => d.accept()); await p.setInputFiles('#import-file', tmp); await p.waitForFunction(() => owned.size === 1);
    await p.click('#mode-mix'); await goRange('ws'); assert(await p.locator('.sw[aria-disabled]').count() > 0);
    await p.evaluate(() => localStorage.removeItem('layer-mixer-owned-v1')); await p.reload(); await goRange('tp');
  });
  await t('Help: opens from the header, closes with Esc, button or backdrop, fits the screen', async () => {
    await p.setViewportSize({ width: 1440, height: 900 });
    assert(!(await p.locator('#help').isVisible()));
    await p.click('#btn-help'); assert(await p.locator('#help').isVisible());
    assert.equal(await p.evaluate(() => document.activeElement.id), 'help-close', 'focus moves into the help');
    assert.deepEqual(await p.locator('#help h3').allTextContents(), ['Mix', 'Preview', 'Recipes', 'My paints', 'Marks']);
    assert.equal(await p.locator('#help .legend > span').count(), 8);
    assert.equal(await p.locator('#help-saveas').isVisible(), await p.evaluate(() => canPick), 'Save as is only explained where the browser has it');
    await p.mouse.click(await p.evaluate(() => document.querySelector('#help').getBoundingClientRect().left + 8), 450);
    assert(await p.locator('#help').isVisible(), 'a click inside the help does not close it');
    assert(await p.evaluate(() => { const d = document.querySelector('#help'); return d.scrollHeight <= d.clientHeight; }), 'no scrolling at 1440×900');
    await p.keyboard.press('Escape'); assert(!(await p.locator('#help').isVisible()));
    assert.equal(await p.evaluate(() => document.activeElement.id), 'btn-help', 'focus returns to the button');
    await p.click('#btn-help'); await p.click('#help-close'); assert(!(await p.locator('#help').isVisible()));
    await p.click('#btn-help'); await p.mouse.click(10, 450); assert(!(await p.locator('#help').isVisible()), 'backdrop click closes');
    await p.setViewportSize({ width: 1100, height: 700 }); await p.click('#btn-help');
    assert(await p.evaluate(() => { const r = document.querySelector('#help').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight; }));
    await p.keyboard.press('Escape'); await p.setViewportSize({ width: 1440, height: 900 });
  });
  await t('Start screen: shown on opening, dashboard, guide, marks; a range leaves it', async () => {
    await p.evaluate(() => localStorage.removeItem('layer-mixer-owned-v1'));
    await p.goto(FILE); await p.setViewportSize({ width: 1440, height: 900 });
    assert(await p.locator('#home').isVisible(), 'start screen on opening'); assert(!(await p.locator('#strips').isVisible()));
    assert.equal(await p.getAttribute('#nav-home', 'aria-selected'), 'true');
    assert.equal(await p.locator('#side .rg[aria-selected="true"]').count(), 0, 'no range selected');
    assert.equal(await p.locator('#side .bh[aria-expanded="true"]').count(), 0, 'no brand open on the start screen');
    assert(await p.locator('#home .dash.empty').isVisible(), 'empty dashboard invites to mark paints');
    assert.equal(await p.locator('#home .step').count(), 4); assert.equal(await p.locator('#home .marks .lg').count(), 8);
    assert(await p.evaluate(() => { const r = document.querySelector('#home').getBoundingClientRect(); return r.bottom <= innerHeight; }), 'fits 1440×900');
    assert.equal(await p.getAttribute('#panel', 'aria-labelledby'), 'nav-home', 'the main area is named Start');
    assert.equal(await p.textContent('.slot.active .ph'), 'Choose a range on the left…');
    assert.equal(await p.locator('#home .steps button, #home .steps a').count(), 0, 'guide cards are not links');
    await p.click('#home .cta'); assert.equal(await p.getAttribute('#mode-inv', 'aria-pressed'), 'true', 'Open My paints');
    await p.click('#nav-home'); assert.equal(await p.getAttribute('#mode-inv', 'aria-pressed'), 'false', 'Start leaves My paints mode');
    assert(await p.locator('#sphere').isVisible()); await p.click('#home .cta');
    assert(await p.locator('#strips').isVisible()); await p.click(sw('tp:Ultramar Blue 1')); await p.click(sw('tp:Ultramar Blue 2')); await p.click('#mode-mix');
    await p.click('#nav-home'); assert(await p.locator('#home').isVisible(), 'Start returns');
    assert.match(await p.textContent('#home .dash .total'), /^2 \/ \d+$/);
    assert.equal(await p.locator('#home .mosaic i').count(), 2);
    assert.equal(await p.textContent('#home .brow[data-b="Warhammer"] .cnt'), '2 / 525');
    assert.equal(await p.getAttribute('#home .brow[data-b="Warhammer"]', 'aria-label'), 'Warhammer, 2 of 525 owned');
    await p.click('#home .brow[data-b="Warhammer"]'); assert.equal(await p.locator('#home .rrow').count(), 8, 'a brand opens its ranges');
    await p.click('#home .rrow:has-text("Tone Pro")'); assert(await p.locator('#strips').isVisible(), 'a range row opens the chart');
    assert.equal(await p.evaluate(() => document.activeElement.id), 'tab-tp', 'focus moves to the range');
    assert.equal(await p.getAttribute('#tab-tp', 'aria-selected'), 'true'); assert.match(p.url(), /#tp$/);
    assert.equal(await p.getAttribute('#brand-warhammer', 'aria-expanded'), 'true', 'the brand of the range opens');
    await p.click('#nav-home'); assert.equal(await p.locator('#side .bh[aria-expanded="true"]').count(), 0, 'Start closes the brand again');
    if (await p.getAttribute('#home .brow[data-b="Warhammer"]', 'aria-expanded') !== 'true') await p.click('#home .brow[data-b="Warhammer"]');
    await p.click('#home .rrow:has-text("Tone Pro")');
    await p.click('#nav-home'); await p.click('#brand-warhammer'); assert(!(await p.locator('#home').isVisible()), 'a brand in the sidebar leaves it');
    await p.click('#nav-home'); await p.click('#brand-the-army-painter'); assert.equal(await p.getAttribute('#tab-wf', 'aria-selected'), 'true');
    await p.click('#brand-warhammer'); await p.click('#tab-wc');
    await p.reload(); assert.equal(await p.getAttribute('#tab-wc', 'aria-selected'), 'true', 'a range in the address opens directly');
    await p.setViewportSize({ width: 1100, height: 700 }); await p.click('#nav-home');
    assert.equal(await p.evaluate(() => document.documentElement.scrollWidth), 1100, 'no horizontal scroll at 1100');
    await p.setViewportSize({ width: 1440, height: 900 });
    await p.evaluate(() => localStorage.removeItem('layer-mixer-owned-v1')); await p.goto(FILE + '#tp');
  });
  await t('Clear everything: separated, needs a confirmation, empties paints and recipes', async () => {
    await p.click('#mode-inv'); await goRange('tp');
    await p.click(sw('tp:Khemri Sands 1')); await p.click('#mode-mix'); await p.click(sw('tp:Khemri Sands 2'));
    await p.evaluate(() => { writeSaved([{ name: 'Keep me', layers: ['tp:Khemri Sands 1'] }]); renderSaved(); });
    await p.click('#mode-inv');
    assert.equal(await p.textContent('#btn-reset'), 'Clear');
    await p.click('#btn-reset'); assert(await p.locator('#reset-dlg').isVisible());
    assert.equal(await p.evaluate(() => document.activeElement.id), 'reset-cancel', 'Cancel has the focus');
    assert(await p.locator('#reset-go').isDisabled(), 'Clear is locked until the box is ticked');
    await p.keyboard.press('Enter'); assert(!(await p.locator('#reset-dlg').isVisible()), 'Enter cancels');
    assert(await p.evaluate(() => owned.size) > 0, 'nothing removed');
    await p.click('#btn-reset'); await p.keyboard.press('Escape'); assert(await p.evaluate(() => owned.size) > 0, 'Esc cancels');
    await p.click('#btn-reset'); await p.check('#reset-ok'); await p.click('#reset-go');
    assert.equal(await p.evaluate(() => owned.size), 0, 'paints removed'); assert.equal(await p.evaluate(() => readSaved().length), 0, 'saved recipes removed');
    assert.equal(await p.evaluate(() => layers.filter(Boolean).length), 0, 'recipe empty');
    assert.equal(await p.evaluate(() => invFile), null, 'the remembered save file is forgotten');
    assert.equal(await p.evaluate(() => JSON.parse(localStorage.getItem('layer-mixer-owned-v1')).length), 0, 'stored paints empty');
    await p.click('#mode-mix');
  });
  await t('Columns follow the window: Fanatic uses two columns when wide, never wraps a triad', async () => {
    const cols = () => p.evaluate(() => new Set([...document.querySelectorAll('.strip')].map(x => Math.round(x.getBoundingClientRect().left))).size);
    const wrapped = () => p.evaluate(() => [...document.querySelectorAll('.strip')].filter(x => { const t = [...x.querySelectorAll('.sw')].map(e => e.getBoundingClientRect().top); return Math.max(...t) - Math.min(...t) > 4; }).length);
    await goRange('wf');
    for (const [w, n] of [[1440, 1], [1700, 2], [1920, 2]]) { await p.setViewportSize({ width: w, height: 900 }); assert.equal(await cols(), n, `Fanatic at ${w}`); assert.equal(await wrapped(), 0, `no wrapped triad at ${w}`); }
    await goRange('tp'); await p.setViewportSize({ width: 1440, height: 900 }); assert.equal(await cols(), 2, 'Tone Pro in two columns at 1440');
  });
  await t('Disclaimer: planning aid, colours differ, not affiliated; also on the start screen', async () => {
    const t = await p.textContent('#notes p');
    assert.match(t, /^Screen colours are a planning aid and differ from the actual paints\./);
    assert.match(t, /not affiliated with any of the paint manufacturers listed\. All brand and product names belong to their respective owners\.$/);
    assert(!/Games Workshop|Army Painter|Monument/.test(t), 'no list of manufacturers that grows with every brand');
    assert.equal(await p.evaluate(() => document.querySelector('#home .home-note')?.textContent ?? DISCLAIMER), t);
  });
  await t('No JS errors', async () => { assert.equal(errs.length, 0, errs.join(' | ')); });

  console.log(`\n${pass} passed, ${fail} failed`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})();

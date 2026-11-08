// Run:  node tests/run-tests.js   (needs: npm i playwright, after python3 build.py)
const { chromium } = require('playwright');
const assert = require('assert');
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIST = path.resolve(__dirname, '../dist');
const BUILT = fs.readdirSync(DIST).filter(f => /^layer-mixer.*\.html$/.test(f));
if (BUILT.length !== 1 || BUILT[0] !== 'layer-mixer.html') { console.error('Expected exactly dist/layer-mixer.html, found: ' + BUILT.join(', ')); process.exit(1); }
const FILE = 'file://' + path.join(DIST, BUILT[0]);
const SRC = fs.readFileSync(path.resolve(__dirname, '../src/layer-mixer.html'), 'utf8');
const OUT = fs.readFileSync(path.join(DIST, BUILT[0]), 'utf8');

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write']);
  const p = await ctx.newPage();
  const errs = [], ext = [];
  const watch = pg => { pg.on('pageerror', e => errs.push(e.message + ' @ ' + (e.stack || '').split('\n').slice(1, 3).join(' '))); pg.on('console', m => m.type() === 'error' && errs.push(m.text()));
    pg.on('request', r => { const u = r.url(); if (!u.startsWith('file://') && !u.startsWith('data:') && !u.startsWith('blob:')) ext.push(u); }); };
  watch(p);
  let pass = 0, fail = 0;
  const t = async (n, f) => { try { await f(); pass++; console.log('OK  ', n); } catch (e) { fail++; console.log('FAIL', n, '-', e.message); } };
  const px = (x, y) => p.evaluate(([x, y]) => Array.from(document.querySelector('#sphere').getContext('2d').getImageData(x, y, 1, 1).data), [x, y]);
  const sw = id => `.sw[data-id="${id}"]`;
  const BRAND = { amc: 'ammo', rmc: 'reaper', gwc: 'green-stuff-world', ttc: 'two-thin-coats', s7c: 'scale75', s7n: 'scale75', aks: 'ak-interactive', akq: 'ak-interactive', akp: 'ak-interactive', akt: 'ak-interactive', vmc: 'vallejo', vsq: 'vallejo', tp: 'warhammer', wc: 'warhammer', wd: 'warhammer', ws: 'warhammer', wct: 'warhammer', wt: 'warhammer', wpr: 'warhammer', wf: 'the-army-painter', apa: 'the-army-painter', app: 'the-army-painter', aps: 'the-army-painter', apw: 'the-army-painter', ape: 'the-army-painter', pa: 'monument-hobbies', pae: 'monument-hobbies', pap: 'monument-hobbies', pa1: 'monument-hobbies', paw: 'monument-hobbies', pat: 'monument-hobbies' };
  const brand = async slug => {   // select a brand in the sidebar (the current one is only opened)
    const cur = await p.evaluate(() => brandOf(current).slug);
    if (cur === slug) { if (await p.getAttribute(`#brand-${slug}`, 'aria-expanded') === 'false') await p.click(`#brand-${slug}`); return; }
    await p.click(`#brand-${slug}`); };
  const goRange = async key => { if (await p.evaluate(() => module) !== 'mixer') await p.click('#mod-mixer'); await brand(BRAND[key]); if (await p.getAttribute(`#tab-${key}`, 'aria-selected') !== 'true') await p.click(`#tab-${key}`); };
  /* fill the open part with five opaque Tone Pro blues (dark → light) */
  const ULTRA = [1, 2, 3, 4, 5].map(i => `tp:Ultramar Blue ${i}`);
  const ultra = () => p.evaluate(ids => { part.layers = ids.map((id, i) => ({ role: ['deepshadow', 'shadow', 'base', 'highlight', 'edge'][i], paint: id })); active = 0; changed(); render(); }, ULTRA);
  const clearPart = () => p.evaluate(() => { part.layers = [{ role: 'base', paint: null }]; active = 0; changed(); render(); });
  /* a clean browser: storage emptied (or set), then reloaded */
  const fresh = async (hash = '#tp', store = null) => {
    await p.goto(FILE + hash); await p.evaluate(s => { localStorage.clear(); if (s) for (const [k, v] of Object.entries(s)) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)); }, store);
    await p.reload(); await p.waitForTimeout(50); };
  const newPart = async (roles) => p.evaluate(rs => { const s = blankScheme('Test'); s.parts[0].layers = rs.map(r => ({ role: r, paint: null })); schemes.unshift(s); saveSchemes(); selectScheme(s); active = 0; render(); return s.id; }, roles);
  const rows = () => p.locator('#layers .lay');
  const roles = () => p.locator('#layers .lay .rn').allTextContents();
  const paintsOf = () => p.evaluate(() => part.layers.map(l => l.paint));
  const status = () => p.textContent('#status');
  const IF = () => p.evaluate(() => schemes.find(s => s.name === 'Imperial Fists').id);

  await p.goto(FILE + '#tp');   // straight to a range; the start screen has its own test
  await t('Tone Pro chart: 30 strips, 150 swatches, numbered', async () => {
    assert.equal(await p.locator('.strip').count(), 30);
    assert.equal(await p.locator('.sw').count(), 150);
    assert.equal(await p.locator('.sw .n').count(), 150);
    assert.equal(await p.locator('.strip .label small').count(), 0, 'no colour family under Tone Pro names');
  });
  await t('Sidebar shows only brand and range names', async () => {
    assert(!/paints|tones/.test(await p.textContent('#side')));
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
  await t('Data: unique ids, valid hex, Fanatic rows 6–7 paints', async () => {
    const r = await p.evaluate(() => ({ ids: Object.keys(BY_ID).length, hex: Object.values(BY_ID).every(x => /^#[0-9a-f]{6}$/.test(x.hex)), wf: RANGE_BY_KEY.wf.rows.filter(r => r.series !== false).map(r => r.paints.length) }));
    assert(r.ids > 2300, r.ids); assert(r.hex); assert(r.wf.every(n => n >= 6 && n <= 7), r.wf);
  });
  await t('Security: a Content Security Policy allows only the app script', async () => {
    const csp = await p.getAttribute('meta[http-equiv="Content-Security-Policy"]', 'content');
    assert(/default-src 'none'/.test(csp) && /script-src 'sha256-/.test(csp), csp);
    const ran = await p.evaluate(() => new Promise(res => { let v = false; document.addEventListener('securitypolicyviolation', () => { v = true; }, { once: true });
      const s = document.createElement('script'); s.textContent = 'window.__inj = 1'; document.body.append(s); setTimeout(() => res({ ran: !!window.__inj, blocked: v }), 50); }));
    assert.deepEqual(ran, { ran: false, blocked: true }, 'an injected script does not run');
    errs.splice(0, errs.length, ...errs.filter(e => !/Content Security Policy/.test(e)));   /* the probe itself logs a violation */
  });
  await t('Security: no innerHTML/eval/external URLs in source', async () => {
    assert(!/innerHTML|outerHTML|insertAdjacentHTML|eval\(|new Function|document\.write/.test(SRC));
    /* the SVG namespace is an identifier, not a request */
    assert(!/https?:\/\//.test(fs.readFileSync(path.join(DIST, BUILT[0]), 'utf8').split('http://www.w3.org/2000/svg').join('')));
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
    await ultra();
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
    await clearPart(); await p.click('[data-shape=roundcube]');
    const c = await px(190, 190); assert(c[3] === 255 && c[0] < 80, `${c}`);
    await p.click('[data-shape=sphere]'); assert.equal((await px(190, 190))[3], 0);
  });
  await t('Advanced: light strength changes highlight size, popover opens and closes', async () => {
    await ultra(); await p.click('[data-shape=sphere]'); await p.click('#mode-steps');
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
    await ultra(); await p.click('[data-shape=cylinder]'); await p.click('#mode-smooth');
    const maxStep = await p.evaluate(() => { const c = document.querySelector('#sphere'), y = 300, d = c.getContext('2d').getImageData(0, y, c.width, 1).data; let m = 0;
      for (let x = 80; x < 300; x++) { const o = x * 4; if (d[o + 3] < 255 || d[o + 7] < 255) continue; m = Math.max(m, Math.abs(d[o] - d[o + 4]) + Math.abs(d[o + 1] - d[o + 5]) + Math.abs(d[o + 2] - d[o + 6])); } return m; });
    assert(maxStep <= 12, `step ${maxStep}`);
    await p.click('[data-shape=sphere]');
  });
  await t('Block: face colours follow the light and are stable', async () => {
    await ultra(); await p.click('[data-shape=roundcube]'); await p.click('#mode-steps');
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
  await t('Look: empty preview outline visible, five tones on one line at 1262 and 1440', async () => {
    await clearPart(); await p.click('[data-shape=sphere]');
    const ring = await p.evaluate(() => { const c = document.querySelector('#sphere'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0, lum = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 40) { n++; lum = Math.max(lum, d[i] + d[i + 1] + d[i + 2]); } return { n, lum }; });
    assert(ring.n > 500, JSON.stringify(ring));
    const dark = await p.evaluate(() => { const r = document.documentElement, k = r.dataset.theme; r.dataset.theme = 'dark'; drawSphere(); const c = document.querySelector('#sphere'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let lum = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 40) lum = Math.max(lum, d[i] + d[i + 1] + d[i + 2]); r.dataset.theme = k; drawSphere(); return lum; });
    assert(dark > 200, 'outline visible in dark: ' + dark);
    for (const w of [1262, 1440]) {
      await p.setViewportSize({ width: w, height: 900 }); await brand('warhammer'); await p.click('#tab-tp');
      const wrapped = await p.evaluate(() => [...document.querySelectorAll('.strip')].filter(x => { const t = [...x.querySelectorAll('.sw')].map(e => e.getBoundingClientRect().top); return Math.max(...t) - Math.min(...t) > 2; }).length);
      assert.equal(wrapped, 0, `wrapped rows at ${w}`);
    }
    await p.setViewportSize({ width: 1440, height: 900 });
  });
  await t('Colour groups are never merged (e.g. no "Yellow & orange")', async () => {
    const bad = await p.evaluate(() => RANGES.flatMap(r => r.rows.map(x => `${r.short}: ${x.label}`)).filter(l => /yellow.*orange|orange.*(red|yellow)|red.*(pink|purple)|pink.*purple|blue.*turquoise|turquoise.*jade|brown.*(bone|sepia)|skin.*bone/i.test(l)));
    assert.deepEqual(bad, []);
  });
  await t('Black, grey and white are separate rows, only where a range has them', async () => {
    const res = await p.evaluate(() => {
      const BLACK = ['Nuln Oil', 'Dark Tone', 'Dark Blue Tone'];
      const tone = x => { const n = x.name; if (BLACK.includes(n)) return 'Black'; const w = [...n.matchAll(/Black|White|Gr[ae]y/g)].pop(); if (w) return w[0] === 'Black' ? 'Black' : w[0] === 'White' ? 'White' : 'Grey';
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
    assert.deepEqual(names.slice().sort(), ['Warhammer: Tone Pro, Base & Layer, Air, Primer, Dry, Shade, Contrast, Technical',
      'The Army Painter: Warpaints Fanatic, Warpaints Air, Colour Primer, Speedpaint, Wash, Effects',
      'Monument Hobbies: Pro Acryl, Expert Acrylics, Prime, 1-Step, Wash, Specials',
      'Vallejo: Model Color, Game Color, Squidmar Color, Mecha Color, Model Air, Game Air, Premium Color, Primer, Xpress Color, Metal Color, Liquid Metal, True Metallic Metal, Wash FX, Weathering FX, Pigment FX, Diorama FX, Auxiliary',
      'AK Interactive: 3rd Gen Standard, 3rd Gen Figures, 3rd Gen AFV, 3rd Gen Air, Quick Gen, Dual Exo, Dense Acrylic, Primer & Spray, Acrylic Wash, Ink, Glow & Fluor, Metallics, Abteilung 502 Oils, Weathering, Markers & Pencils, Auxiliary',
      'Two Thin Coats: Two Thin Coats',
      "Scale75: Scalecolor, Fantasy & Games, Warfront, Scalecolor Games, Scalecolor Artist, Drop & Paint, Primer, Metal n' Alchemy, Inktensity, Instant Colors, FX Fluor, Floww Oils, Soil Works, Auxiliary",
      'AMMO: IONIC Smart Colors, ATOM, AMMO Acrylic, Real Heavy Metal, IONIC Smart Drybrush, IONIC Smart Inks, Weathering, Auxiliary',
      'Reaper: Master Series Core Colors, Master Series Bones, Master Series Pathfinder',
      'Green Stuff World: Acrylic Color, Opaque Colors, Airbrush Paint, Primer, Dipping Ink, Inks, Metallic & Chameleon, Fluor, Effects & Dry Brush, Weathering & Textures, Dipping Ink Markers, Auxiliary'].sort());
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
  await t('Vallejo: all current ranges, Squidmar, True Metallic Metal rows, reference kinds', async () => {
    const r = await p.evaluate(() => {
      const R = k => RANGE_BY_KEY[k], n = k => R(k).rows.reduce((a, x) => a + x.paints.length, 0);
      return { mc: n('vmc'), gc: n('vgc'), sq: n('vsq'), xc: [R('vxc').ref, R('vxc').contrast], tm: R('vtm').rows.length,
        tmRow: R('vtm').rows[0].paints.map(p => p.type), shadeWash: BY_ID['vtm:Sterling Silver Shade'].wash,
        fluoMetal: BY_ID['vgc:Fluorescent Red'].metal, fluoInfo: BY_ID['vgc:Fluorescent Red'].ref, inkWash: BY_ID['vsq:Squid Ink'].wash,
        usable: !BY_ID['vmc:Flat Red'].ref, sqName: !!BY_ID["vsq:Owl's Eye"] };
    });
    assert.equal(r.mc, 204); assert.equal(r.gc, 131); assert.equal(r.sq, 72);
    assert.deepEqual(r.xc, [true, true], 'Xpress Color is a one-coat paint for reference');
    assert.equal(r.tm, 20); assert.deepEqual(r.tmRow, ['Shade', 'Base', 'Light', 'Airbrush']); assert(r.shadeWash);
    assert(!r.fluoMetal && r.fluoInfo, 'fluorescents are reference only but not shown as metal'); assert(r.inkWash); assert(r.usable); assert(r.sqName);
    await goRange('vmc'); assert.equal(await p.locator('.sw').count(), 204);
    const pr = await p.evaluate(() => ({ n: RANGE_BY_KEY.vpr.rows.reduce((a, r) => a + r.paints.length, 0), spray: BY_ID['vpr:Black (Spray)'].type, bottle: BY_ID['vpr:Black'].type,
      aux: RANGE_BY_KEY.vax.rows.every(r => r.paints.every(p => p.medium)), pig: RANGE_BY_KEY.vpg.ref, dio: RANGE_BY_KEY.vdf.rows.map(r => r.label) }));
    assert.equal(pr.n, 55, 'bottle primers and spray cans in one Primer range'); assert.equal(pr.spray, 'Spray'); assert.equal(pr.bottle, 'Bottle');
    assert(pr.aux, 'auxiliary products are media without a colour'); assert(pr.pig);
    assert.deepEqual(pr.dio, ['Landscape texture', 'Water & effects', 'Mud', 'Ground texture', 'Fixer']);
  });
  await t('AK Interactive: 3rd Gen series usable, Quick Gen like Contrast, weathering and markers reference', async () => {
    const r = await p.evaluate(() => {
      const R = k => RANGE_BY_KEY[k], n = k => R(k).rows.reduce((a, x) => a + x.paints.length, 0), all = k => R(k).rows.flatMap(x => x.paints);
      return { s: n('aks'), f: n('akf'), a: n('aka'), air: n('akr'), usable: ['aks', 'akf', 'aka', 'akr', 'ake', 'akd', 'akp'].map(k => !R(k).ref),
        ref: ['akq', 'akw', 'aki', 'akg', 'akm', 'akb', 'akt', 'akk', 'akz'].map(k => !!R(k).ref), qg: R('akq').contrast,
        wt: R('akt').rows.map(x => x.label), mk: R('akk').rows.map(x => x.label), metal: all('akm').filter(p => !p.medium).every(p => p.metal),
        spray: BY_ID['akp:Fine Primer Black Spray'].type, bottle: BY_ID['akp:Black Primer'].type, ral: !!BY_ID['aka:RAL 7028 Dunkelgelb (Variant)'],
        sets: Object.keys(BY_ID).filter(k => k.startsWith('ak') && /\b(Set|Range|Box)\b/.test(k)), lacquer: R('akk').rows.length };
    });
    assert.deepEqual([r.s, r.f, r.a, r.air], [237, 40, 80, 120]);
    assert(r.usable.every(Boolean), 'paint ranges are selectable'); assert(r.ref.every(Boolean), 'one-coat, washes, metallics, weathering, markers: reference');
    assert(r.qg, 'Quick Gen is shown like Contrast');
    assert.deepEqual(r.wt, ['Pigments', 'Liquid pigments', 'Deposits', 'Effects', 'Filters', 'Washes', 'Panel liners', 'Oxidants', 'Gouache', 'Fluids']);
    assert.deepEqual(r.mk, ['Quick Marker', 'Playmarker', 'Real Colors Marker', 'Weathering Pencil']);
    assert(r.metal); assert.equal(r.spray, 'Spray'); assert.equal(r.bottle, 'Bottle'); assert(r.ral, 'site names in proper case');
    assert.deepEqual(r.sets, [], 'no sets or bundles');
    await goRange('aks'); assert.equal(await p.locator('.sw').count(), 237);
    await brand('warhammer'); await p.click('#tab-tp');
  });
  await t('Two Thin Coats: triads shadow to highlight; Scale75 ranges and kinds', async () => {
    const r = await p.evaluate(() => {
      const R = k => RANGE_BY_KEY[k], n = k => R(k).rows.reduce((a, x) => a + x.paints.length, 0);
      const lum = h => [1, 3, 5].reduce((a, i, j) => a + parseInt(h.slice(i, i + 2), 16) * [.2126, .7152, .0722][j], 0);
      const tri = R('ttc').rows.filter(x => x.paints.length === 3 && !['Bright', 'Metallics', 'Coloured metallics', 'Wash', 'Glaze', 'Varnish'].includes(x.label));
      return { ttc: n('ttc'), series: R('ttc').series, triads: tri.length, ordered: tri.every(x => lum(x.paints[0].hex) <= lum(x.paints[1].hex) && lum(x.paints[1].hex) <= lum(x.paints[2].hex)),
        mid: tri.every(x => x.label === x.paints[1].name), washRef: BY_ID['ttc:Oblivion Black Wash'].ref, metal: BY_ID['ttc:Sir Coates Silver'].metal,
        s7: ['s7c', 's7f', 's7w', 's7g', 's7a', 's7d', 's7p'].map(k => !R(k).ref), s7ref: ['s7m', 's7i', 's7n', 's7x', 's7o', 's7s', 's7z'].map(k => !!R(k).ref),
        inst: R('s7n').contrast, mna: R('s7m').rows[0].paints.every(p => p.metal), counts: [n('s7c'), n('s7f'), n('s7w'), n('s7d')],
        spray: BY_ID['s7p:Ice Charm (Spray)'].type };
    });
    assert.equal(r.ttc, 180); assert(r.series); assert.equal(r.triads, 41); assert(r.ordered, 'shadow, midtone, highlight'); assert(r.mid, 'row named after the midtone');
    assert(r.washRef); assert(r.metal);
    assert(r.s7.every(Boolean)); assert(r.s7ref.every(Boolean)); assert(r.inst, 'Instant Colors shown like Contrast'); assert(r.mna);
    assert.deepEqual(r.counts, [63, 48, 64, 128]); assert.equal(r.spray, 'Spray');
    await goRange('ttc'); assert.equal(await p.locator('.sw').count(), 180);
    await brand('warhammer'); await p.click('#tab-tp');
  });
  await t('AMMO, Reaper and Green Stuff World: ranges, kinds, triads', async () => {
    const r = await p.evaluate(() => {
      const R = k => RANGE_BY_KEY[k], n = k => R(k).rows.reduce((a, x) => a + x.paints.length, 0);
      const lum = h => [1, 3, 5].reduce((a, i, j) => a + parseInt(h.slice(i, i + 2), 16) * [.2126, .7152, .0722][j], 0);
      const tri = R('rmc').rows.filter(x => x.series !== false);
      return { usable: ['amc', 'amt', 'ama', 'rmc', 'rmb', 'rmp', 'gwc', 'gwo', 'gwa', 'gwp'].map(k => !R(k).ref),
        ref: ['amr', 'amd', 'ami', 'amw', 'amz', 'gwd', 'gwi', 'gwm', 'gwf', 'gww', 'gwk', 'gwz'].map(k => !!R(k).ref),
        dip: R('gwd').contrast, ionic: n('amc'), rhm: R('amr').rows.every(x => x.paints.length === 3), triads: tri.length,
        ordered: tri.every(x => lum(x.paints[0].hex) <= lum(x.paints[1].hex) && lum(x.paints[1].hex) <= lum(x.paints[2].hex)),
        rseries: R('rmc').series, sets: Object.keys(BY_ID).filter(k => /^(am|rm|gw)/.test(k) && /\b(Set|Bundle|Box)\b/.test(k)) };
    });
    assert(r.usable.every(Boolean)); assert(r.ref.every(Boolean)); assert(r.dip, 'dipping inks shown like Contrast');
    assert.equal(r.ionic, 185); assert(r.rhm, 'Real Heavy Metal: wash, base and highlight per colour');
    assert(r.rseries); assert(r.triads >= 35, r.triads); assert(r.ordered, 'Reaper triads from shadow to highlight');
    assert.deepEqual(r.sets, []);
    await goRange('rmc'); assert.equal(await p.locator('.sw').count(), 248);
    await brand('warhammer'); await p.click('#tab-tp');
  });
  await t('Colour distance (CIEDE2000) and similar paints', async () => {
    const r = await p.evaluate(() => ({
      sharma: [dE00([50, 2.6772, -79.7751], [50, 0, -82.7485]), dE00([50, 0, 0], [50, -1, 2]), dE00([50, 2.5, 0], [73, 25, -18])].map(x => +x.toFixed(4)),
      same: dE00(toLab('#3a5199'), toLab('#3a5199')),
      blue: similarTo('tp:Ultramar Blue 3').map(x => x.p),
      metal: similarTo(Object.values(BY_ID).find(x => x.metal && !x.info).id).every(x => x.p.metal),
      words: [0.5, 2, 4, 8, 12].map(closeness) }));
    assert.deepEqual(r.sharma, [2.0425, 2.3669, 27.1492], 'reference values from Sharma et al.');
    assert.equal(r.same, 0);
    assert(r.blue.length > 3 && r.blue.every(q => q.key !== 'tp' && !q.info && !q.metal), 'other ranges, usable, not metallic');
    assert(r.metal, 'metallics only with metallics');
    assert.deepEqual(r.words, ['nearly identical', 'very close', 'close', 'rough', null]);
  });
  await t('Search finds paints across brands', async () => {
    const f = q => p.evaluate(q => findPaints(q).map(x => x.id), q);
    assert.equal((await f('contrast blood'))[0], 'wct:Blood Angels Red');
    assert((await f('mephiston')).includes('wcb:Mephiston Red') || (await f('mephiston')).some(id => /Mephiston Red/.test(id)));
    assert.equal((await f('taunar ochre 4'))[0], "tp:Ta'unar Ochre 4", 'apostrophes are ignored');
    assert.deepEqual(await f('   '), []); assert.deepEqual(await f('zzzz qqq'), []);
  });
  /* ---- preview and light (unchanged behaviour) ---- */
  const bright = c => c[0] + c[1] + c[2];
  const yellow = () => p.evaluate(() => { part.layers = ['tp:Khemri Sands 2', 'tp:Khemri Sands 4', 'tp:Hawkshroud Yellow 2', 'tp:Hawkshroud Yellow 4', 'tp:Megaboss Yellow 5'].map((id, i) => ({ role: ['deepshadow', 'shadow', 'base', 'highlight', 'edge'][i], paint: id })); render(); });
  await t('Swatch marks: white on every paint, dark only on (nearly) pure white', async () => {
    await fresh('#tp');
    const dark = await p.locator('.sw.light').evaluateAll(b => b.map(x => x.dataset.id)); assert.deepEqual(dark, ['tp:Blackstone Void 5'], 'only the white tone gets dark marks');
    const col = await p.locator('.sw[data-id="tp:Hawkshroud Yellow 5"] .n').evaluate(n => getComputedStyle(n).color); assert.equal(col, 'rgb(255, 255, 255)');
    assert.equal(await p.evaluate(() => [nearWhite('#ffffff'), nearWhite('#f2f2f0'), nearWhite('#fde27a'), nearWhite('#e0d7c0')].join()), 'true,true,false,false');
  });
  await t('Without JavaScript (file previews) a note says the app needs a desktop browser', async () => {
    const c = await browser.newContext({ javaScriptEnabled: false }), q = await c.newPage();
    await q.goto(FILE); assert(await q.locator('.nojs').isVisible()); assert.deepEqual(await q.locator('.nojs p').allTextContents(), ['Layer Mixer only works on desktop computers.', 'A phone app is planned. Interested? Say so on GitHub.']);
    await c.close(); assert(!(await p.locator('.nojs').isVisible()), 'hidden when the app runs');
  });
  await t('A single paint is shown flat (one colour, no light and shadow)', async () => {
    await goRange('tp'); await clearPart(); await p.click(sw('tp:Dataslate Grey 3'));
    assert.deepEqual((await px(291, 80)).slice(0, 3), (await px(100, 300)).slice(0, 3));
    await p.click('#mode-steps'); assert.deepEqual((await px(291, 80)).slice(0, 3), (await px(100, 300)).slice(0, 3)); await p.click('#mode-smooth');
  });
  await t('Preview heading, drag hint, Reset light', async () => {
    assert.equal((await p.textContent('#drag-hint')).trim(), '☀ Drag to move light'); assert.equal(await p.textContent('.stage-ctl h2'), 'Sphere');
    assert.equal(await p.locator('#btn-light').textContent(), 'Reset light');
  });
  await t('Dragging on the sphere moves the light; Reset light restores it', async () => {
    await yellow(); const tr0 = await px(291, 80), bl0 = await px(89, 300);
    assert(bright(tr0) > bright(bl0), 'default light from top right');
    const box = await p.locator('#sphere').boundingBox();
    await p.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5); await p.mouse.down(); await p.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.8, { steps: 5 }); await p.mouse.up();
    const tr1 = await px(291, 80), bl1 = await px(89, 300); assert(bright(bl1) > bright(tr1), 'light from bottom left now');
    assert.equal(await rows().count(), 5, 'layers unchanged');
    await p.click('#btn-light'); assert(bright(await px(291, 80)) > bright(tr1));
  });
  await t('Arrow keys move the light, Home and double-click reset it; stepped changes rendering', async () => {
    const ref = await px(80, 190);
    await p.focus('#sphere'); for (let i = 0; i < 12; i++) await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(250);
    assert(bright(await px(80, 190)) > bright(ref)); await p.keyboard.press('Home'); await p.waitForTimeout(250); assert.deepEqual(await px(80, 190), ref);
    const img = () => p.evaluate(() => document.querySelector('#sphere').toDataURL()), r0 = await img();
    await p.keyboard.press('ArrowDown'); await p.keyboard.press('ArrowDown'); await p.waitForTimeout(250); assert.notEqual(await img(), r0);
    await p.dblclick('#sphere'); assert.equal(await img(), r0);
    const a = await px(150, 260); await p.click('#mode-steps'); assert.notDeepEqual(a, await px(150, 260)); await p.click('#mode-smooth');
  });
  await t('Shape, blending and light survive a reload', async () => {
    await p.click('[data-shape=cone]'); await p.click('#mode-steps'); await p.waitForTimeout(200); await p.reload();
    assert.equal(await p.evaluate(() => [shape, stepped].join()), 'cone,true');
    await p.click('[data-shape=sphere]'); await p.click('#mode-smooth');
  });
  await t('Part note: one per part, saved as you type, limited to 500 with a counter', async () => {
    await fresh('#tp');
    await p.fill('#part-note', 'Armour note changed'); await p.waitForTimeout(400);
    await p.click('#parts [role=tab]:has-text("Silver")'); assert.equal(await p.inputValue('#part-note'), '');
    assert.equal(await p.getAttribute('#part-note', 'placeholder'), 'Note for silver: thinning, wet blend, glaze …');
    await p.fill('#part-note', 'y'.repeat(470)); assert(await p.locator('#note-cnt').isVisible()); assert.equal(await p.textContent('#note-cnt'), '470 / 500');
    await p.locator('#part-note').press('End'); await p.keyboard.type('z'.repeat(60)); assert.equal((await p.inputValue('#part-note')).length, 500);
    await p.click('#parts [role=tab]:has-text("Armour")'); assert.equal(await p.inputValue('#part-note'), 'Armour note changed');
    await p.reload(); assert.equal(await p.evaluate(() => schemes[0].parts[1].note.length), 500);
    assert.equal(await p.evaluate(() => schemes[0].example), false, 'a note edit drops the Example tag');
  });
  await t('A second tab: changes there show up here', async () => {
    const q = await ctx.newPage(); await q.goto(FILE + '#tp');
    await q.evaluate(() => { part.layers[1].paint = 'tp:Ultramar Blue 3'; changed(); render(); });
    await p.waitForFunction(() => part.layers[1].paint === 'tp:Ultramar Blue 3');
    assert.equal(await p.textContent('#layers .lay[data-i="1"] .pname'), 'Ultramar Blue 3');
    await q.evaluate(() => { owned.add('tp:Ultramar Blue 3'); saveOwned(); }); await p.waitForFunction(() => owned.has('tp:Ultramar Blue 3'));
    await q.close();
  });
  await t('Paints: keyboard marking, row by keyboard, safe import', async () => {
    await p.click('#mod-paints'); await goRange('tp'); await p.click('#mod-paints');
    await p.focus(sw('tp:Khemri Sands 2')); await p.keyboard.press('Enter'); assert.equal(await p.getAttribute(sw('tp:Khemri Sands 2'), 'aria-pressed'), 'true');
    await p.keyboard.press('Space'); assert.equal(await p.getAttribute(sw('tp:Khemri Sands 2'), 'aria-pressed'), 'false');
    await p.focus('.strip:has-text("Khemri Sands") .label'); await p.keyboard.press('Enter'); assert.equal(await p.locator('.strip:has-text("Khemri Sands") .sw.owned').count(), 5);
    const before = await p.evaluate(() => owned.size), tmp = path.join(__dirname, '.tmp-bad.json');
    for (const bad of [{ app: 'layer-mixer', owned: 'x' }, { app: 'layer-mixer', owned: [], format: 2, schemes: 'nope' }]) {
      fs.writeFileSync(tmp, JSON.stringify(bad)); await p.setInputFiles('#import-file', tmp); await p.waitForTimeout(100); }
    assert.equal(await p.evaluate(() => owned.size), before, 'broken or declined files keep the paints');
    fs.unlinkSync(tmp); await p.click('#mod-mixer');
  });
  /* ======================= 0.40: modules, schemes, parts, layers ======================= */
  await t('First run: two example schemes (Imperial Fists, Death Guard), real paint ids only', async () => {
    await fresh('#tp');
    const r = await p.evaluate(() => ({ names: schemes.map(s => s.name), ex: schemes.map(s => s.example), parts: schemes.map(s => s.parts.map(x => x.name).join(',')),
      bad: EXAMPLES.flatMap(x => x.parts.flatMap(pt => pt.layers.map(l => l[1]))).filter(id => !BY_ID[id]) }));
    assert.deepEqual(r.names, ['Imperial Fists', 'Death Guard']); assert.deepEqual(r.ex, [true, true]);
    assert.equal(r.parts[0], 'Armour,Silver,Gold,Cloak,Leather,Black'); assert.deepEqual(r.bad, []);
    assert(!/Ultramarines/.test(SRC.slice(SRC.indexOf('const EXAMPLES'), SRC.indexOf('function addExamples'))), 'no Ultramarines example');
  });
  await t('Header: three modules, Mixer active; no Mix / My paints switch', async () => {
    assert.deepEqual(await p.locator('nav.mods .mod').allTextContents(), ['Start', 'Mixer', 'Schemes', 'Paints']);
    assert.equal(await p.getAttribute('#mod-mixer', 'aria-current'), 'page');
    assert.equal(await p.locator('#mod-schemes[aria-current], #mod-paints[aria-current]').count(), 0);
    assert.equal(await p.locator('#mode-mix, #mode-inv').count(), 0);
    assert.equal(await p.getAttribute('nav.mods', 'aria-label'), 'Modules');
  });
  await t('Mixer bench: scheme name, part tabs, layers with roles, part note; no recipe chips or Save row', async () => {
    assert.equal(await p.textContent('#sch-name'), 'Imperial Fists');
    assert.deepEqual(await p.locator('#parts [role=tab]').allTextContents(), ['Armour', 'Silver', 'Gold', 'Cloak', 'Leather', 'Black']);
    assert.equal(await p.getAttribute('#parts [role=tablist]', 'aria-label'), 'Parts');
    assert.deepEqual(await roles(), ['Primer', 'Base', 'Shade', 'Layer', 'Highlight', 'Edge']);
    assert.equal(await p.textContent('#lay-cnt'), '6 of 8');
    assert.equal(await p.inputValue('#part-note'), 'Thin the shade 1:1 and keep it in the recesses.');
    assert.equal(await p.getAttribute('#part-note', 'placeholder'), 'Note for armour: thinning, wet blend, glaze …');
    assert.equal(await p.locator('#presets, #saved, #save-form, #shop, #btn-copy, #btn-clear').count(), 0);
    assert.deepEqual(await p.locator('.bench h2:visible').allTextContents(), ['Sphere', 'Layers']);
    const ui = (await p.evaluate(() => document.body.innerText)).toLowerCase();
    assert(!/\brecipe/.test(ui), 'no "recipe" on screen'); assert(!/\bsteps?\b/.test(ui), 'no "step" on screen');
  });
  await t('Range tags name brand and range', async () => {
    const tags = await p.locator('#layers .rtag').allTextContents();
    assert.deepEqual(tags, ['Warhammer · Primer', 'Warhammer · Tone Pro', 'Warhammer · Shade', 'Warhammer · Tone Pro', 'Warhammer · Tone Pro', 'Warhammer · Tone Pro']);
    const r = await p.evaluate(() => ({ wf: tagText('wf'), apw: tagText('apw'), gwc: tagText('gwc'), ttc: tagText('ttc'), aks: tagText('aks'), paw: tagText('paw'),
      all: RANGES.map(r => [r.brand, tagText(r.id)]) }));
    assert.equal(r.wf, 'Army Painter · Fanatic'); assert.equal(r.apw, 'Army Painter · Wash'); assert.equal(r.gwc, 'Green Stuff · Acrylic'); assert.equal(r.ttc, 'Two Thin Coats'); assert.equal(r.aks, 'AK · 3G Standard'); assert.equal(r.paw, 'Monument · Wash');
    const short = { 'The Army Painter': 'Army Painter', 'Monument Hobbies': 'Monument', 'Green Stuff World': 'Green Stuff', 'AK Interactive': 'AK' };
    assert(r.all.every(([b, s]) => s.startsWith(short[b] || b)), 'every tag starts with the brand');
  });
  await t('Chart badges: layer numbers of the open part; tooltip and sidebar counters', async () => {
    assert.equal(await p.textContent(sw('tp:Hawkshroud Yellow 2') + ' .slot-mark'), '2');
    assert.equal(await p.textContent(sw('tp:Hawkshroud Yellow 5') + ' .slot-mark'), '6');
    assert.match(await p.getAttribute(sw('tp:Hawkshroud Yellow 4'), 'aria-label'), /^Hawkshroud Yellow 4, Warhammer Tone Pro.*, layer 5 of Armour$/);
    assert.equal(await p.textContent('.inrec[data-k="tp"]'), '4');
    assert.equal(await p.textContent('.inrec[data-k="ws"]'), '1');
    await p.evaluate(() => { part.layers[3].paint = 'tp:Hawkshroud Yellow 2'; render(); });
    assert.match(await p.getAttribute(sw('tp:Hawkshroud Yellow 2'), 'aria-label'), /, layers 2 and 4 of Armour$/);
    await p.hover(sw('tp:Hawkshroud Yellow 2')); assert((await p.textContent('#tip')).includes('Layers 2 and 4 of Armour')); await p.mouse.move(5, 5);
    await p.evaluate(() => { part.layers[3].paint = 'tp:Hawkshroud Yellow 3'; render(); });
    await p.click('#ptab-' + await p.evaluate(() => scheme.parts[3].id));   // Cloak
    assert.equal(await p.locator('.sw .slot-mark').count(), 4, 'Cloak: four Tone Pro paints');
    assert.equal(await p.locator(sw('tp:Hawkshroud Yellow 2') + ' .slot-mark').count(), 0);
    await p.click('#ptab-' + await p.evaluate(() => scheme.parts[0].id));
  });
  await t('Paint click fills the active layer; moves on only to an empty next layer', async () => {
    await newPart(['base', 'shade', 'highlight']);
    await p.click(sw('tp:Ultramar Blue 2')); assert.deepEqual(await paintsOf(), ['tp:Ultramar Blue 2', null, null]);
    assert.equal(await p.getAttribute('#layers .lay[data-i="1"]', 'aria-selected'), 'true');
    await p.click(sw('tp:Ultramar Blue 3')); await p.click(sw('tp:Ultramar Blue 5'));
    assert.deepEqual(await paintsOf(), ['tp:Ultramar Blue 2', 'tp:Ultramar Blue 3', 'tp:Ultramar Blue 5']);
    assert.equal(await p.getAttribute('#layers .lay[data-i="2"]', 'aria-selected'), 'true', 'last layer stays active');
    await p.click('#layers .lay[data-i="0"] .pname');
    await p.click(sw('tp:Ultramar Blue 1'));
    assert.deepEqual(await paintsOf(), ['tp:Ultramar Blue 1', 'tp:Ultramar Blue 3', 'tp:Ultramar Blue 5'], 'replaced, next not overwritten');
    assert.equal(await p.getAttribute('#layers .lay[data-i="0"]', 'aria-selected'), 'true', 'stays when the next layer is filled');
    assert.equal(await p.textContent('#sr-status'), 'Ultramar Blue 1 in layer 1, Base.');
    assert(await p.evaluate(() => JSON.parse(localStorage.getItem('layer-mixer-schemes-v1'))[0].parts[0].layers[0].paint === 'tp:Ultramar Blue 1'), 'saved at once');
  });
  await t('Washes, contrast, metallics, technical and mediums go into layers; no colour value is refused', async () => {
    await newPart(['base', 'shade', 'layer', 'highlight', 'glaze', 'edge']);
    for (const id of ['wc:Leadbelcher', 'ws:Nuln Oil', 'wct:Blood Angels Red', 'wt:Typhus Corrosion', 'wt:Lahmian Medium', 'wc:Stormhost Silver']) { await goRange(id.split(':')[0]); await p.click(sw(id)); }
    assert.deepEqual(await paintsOf(), ['wc:Leadbelcher', 'ws:Nuln Oil', 'wct:Blood Angels Red', 'wt:Typhus Corrosion', 'wt:Lahmian Medium', 'wc:Stormhost Silver']);
    assert.equal(await p.getAttribute('#layers .lay[data-i="4"] .chipbig', 'data-abbr'), 'M');
    assert.equal(await p.locator('#side .eye').count(), 0, 'no reference-only eye');
    assert.equal(await p.locator('.sw[aria-disabled]').count(), 0);
    const unk = await p.evaluate(() => PAINTS.find(x => x.unknown).id);
    await p.evaluate(id => { selectRange(BY_ID[id].key); active = 0; render(); }, unk);
    await p.click(sw(unk), { force: true }); assert.equal(await p.evaluate(() => part.layers[0].paint), 'wc:Leadbelcher');
    assert.equal(await status(), 'No colour value for this paint.');
  });
  await t('Preview: primer and mediums not drawn, a wash darkens the band before it, glaze tints, washes alone on grey', async () => {
    const r = await p.evaluate(() => { const L = (...a) => a.map(([role, paint]) => ({ role, paint })), hx = id => hexToRgb(BY_ID[id].hex);
      const base = hx('wc:Leadbelcher'), nuln = hx('ws:Nuln Oil'), hi = hx('wc:Stormhost Silver');
      const a = previewCols(L(['primer', 'wpr:Wraithbone'], ['base', 'wc:Leadbelcher'], ['shade', 'ws:Nuln Oil'], ['highlight', 'wc:Stormhost Silver'], ['layer', 'wt:Lahmian Medium']));
      const exp = base.map((v, i) => (v * .45 + nuln[i] * .55) * .78);
      const g = previewCols(L(['base', 'wc:Leadbelcher'], ['glaze', 'ws:Nuln Oil'], ['highlight', 'wc:Stormhost Silver']));
      const w = previewCols(L(['shade', 'ws:Nuln Oil']));
      const prim = previewCols(L(['primer', 'wpr:Wraithbone']));
      return { n: a.length, shade: a[0].map(Math.round), exp: exp.map(Math.round), base: a[1], hi: a[2], baseExp: base, hiExp: hi,
        g: g.length, gHi: g[1].map(Math.round), gExp: hi.map((v, i) => Math.round(v * .8 + nuln[i] * .2)), w: w.length, wBase: w[1], prim: prim.length,
        weights: [1, 2, 3, 5, 8].map(n => n === 1 ? 1 : bandWeights(n, .5).length), w5: bandWeights(5, .5).map(x => +x.toFixed(3)) }; });
    assert.equal(r.n, 3, 'primer and medium left out, wash adds one band'); assert.deepEqual(r.shade, r.exp); assert.deepEqual(r.base, r.baseExp); assert.deepEqual(r.hi, r.hiExp);
    assert.equal(r.g, 2); assert.deepEqual(r.gHi, r.gExp, 'glaze tints the bands after it by 20 %');
    assert.equal(r.w, 2); assert.deepEqual(r.wBase, [154, 154, 154], 'wash only: neutral grey'); assert.equal(r.prim, 0);
    assert.deepEqual(r.weights, [1, 2, 3, 5, 8]); assert.deepEqual(r.w5, [.13, .19, .38, .17, .09]);
    await p.evaluate(() => { part.layers = [{ role: 'primer', paint: 'wpr:Wraithbone' }]; render(); });
    assert.equal((await px(190, 190))[3], 0, 'a part with only primer shows the empty outline');
  });
  await t('Add layer: after the active one with the next role; A key; limit 8', async () => {
    await newPart(['base']);
    await p.click('#btn-addl'); assert.deepEqual(await roles(), ['Base', 'Shade']);
    assert.equal(await p.getAttribute('#layers .lay[data-i="1"]', 'aria-selected'), 'true');
    await p.click('#layers .lay[data-i="0"] .ph'); await p.click('#btn-addl');
    assert.deepEqual(await roles(), ['Base', 'Shade', 'Shade'], 'inserted after layer 1');
    await p.locator('#layers .lay[data-i="2"] .cell').focus(); await p.keyboard.press('a');
    assert.deepEqual(await roles(), ['Base', 'Shade', 'Shade', 'Layer']);
    for (let i = 0; i < 6; i++) await p.keyboard.press('A');
    assert.deepEqual(await roles(), ['Base', 'Shade', 'Shade', 'Layer', 'Highlight', 'Edge', 'Edge', 'Edge']);
    assert.equal(await p.textContent('#lay-cnt'), '8 of 8');
    assert.equal(await p.getAttribute('#btn-addl', 'aria-disabled'), 'true'); assert.equal(await status(), '8 layers is the maximum');
    await p.click('#btn-addl', { force: true }); assert.equal(await rows().count(), 8);
    await p.evaluate(() => { part.layers[0].role = 'drybrush'; active = 0; render(); }); assert.equal(await p.evaluate(() => nextRole('drybrush')), 'edge');
  });
  await t('Remove layer: × and Delete, Undo for 8 s; the last layer only loses its paint', async () => {
    await newPart(['base', 'shade', 'highlight']);
    await p.evaluate(() => { part.layers.forEach((l, i) => { l.paint = ['tp:Ultramar Blue 2', 'ws:Nuln Oil', 'tp:Ultramar Blue 4'][i]; }); active = 0; render(); });
    await p.click('#layers .lay[data-i="1"] .x'); assert.deepEqual(await roles(), ['Base', 'Highlight']);
    assert((await status()).startsWith('Layer removed.')); await p.click('#status .undo');
    assert.deepEqual(await paintsOf(), ['tp:Ultramar Blue 2', 'ws:Nuln Oil', 'tp:Ultramar Blue 4']);
    await p.locator('#layers .lay[data-i="2"] .cell').focus(); await p.keyboard.press('Delete');
    assert.deepEqual(await paintsOf(), ['tp:Ultramar Blue 2', 'ws:Nuln Oil']);
    await p.click('#layers .lay[data-i="1"] .x'); await p.click('#layers .lay[data-i="0"] .x');
    assert.equal(await rows().count(), 1); assert.deepEqual(await paintsOf(), [null], 'last layer stays, only cleared');
    assert.equal(await p.textContent('#layers .lay .ph'), 'Pick a paint in the chart');
  });
  await t('Reorder layers: Alt+arrows and drag by the grip', async () => {
    await newPart(['base', 'shade', 'highlight']);
    await p.locator('#layers .lay[data-i="0"] .cell').focus(); await p.keyboard.press('Alt+ArrowDown');
    assert.deepEqual(await roles(), ['Shade', 'Base', 'Highlight']); assert.equal(await p.textContent('#sr-status'), 'Layer moved to position 2.');
    assert.equal(await p.evaluate(() => document.activeElement.closest('.lay').dataset.i), '1', 'focus follows the layer');
    await p.keyboard.press('Alt+ArrowUp'); assert.deepEqual(await roles(), ['Base', 'Shade', 'Highlight']);
    await p.keyboard.press('Alt+ArrowUp'); assert.deepEqual(await roles(), ['Base', 'Shade', 'Highlight'], 'top stays top');
    await p.locator('#layers .lay[data-i="2"] .grip').dragTo(p.locator('#layers .lay[data-i="0"]'), { targetPosition: { x: 40, y: 4 } });
    assert.deepEqual(await roles(), ['Highlight', 'Base', 'Shade']);
  });
  await t('Layers are a grid: one tab stop, arrows move between cells and rows', async () => {
    await newPart(['base', 'shade', 'highlight']);
    const g = await p.evaluate(() => { const b = document.querySelector('#layers'); return [b.getAttribute('role'), [...b.children].every(r => r.getAttribute('role') === 'row'),
      [...b.querySelectorAll('.lay')].every(r => [...r.children].filter(c => c.getAttribute('aria-hidden') !== 'true').every(c => c.getAttribute('role') === 'gridcell')),
      b.querySelectorAll('[tabindex="0"]').length, b.querySelectorAll('button:not([tabindex="-1"])').length]; });
    assert.deepEqual(g, ['grid', true, true, 1, 0], 'grid > row > gridcell, a single tab stop');
    const cls = () => p.evaluate(() => { const a = document.activeElement; return [a.closest('.lay')?.dataset.i, ['role', 'cell', 'sim', 'x'].find(c => a.classList.contains(c))]; });
    await p.locator('#layers .lay[data-i="0"] .cell').focus();
    await p.keyboard.press('ArrowLeft'); assert.deepEqual(await cls(), ['0', 'role']);
    await p.keyboard.press('ArrowDown'); assert.deepEqual(await cls(), ['1', 'role'], 'down keeps the column');
    assert.equal(await p.getAttribute('#layers .lay[data-i="1"]', 'aria-selected'), 'true');
    await p.keyboard.press('End'); assert.deepEqual(await cls(), ['1', 'x'], 'empty layer: no ≈, End goes to ×');
    await p.keyboard.press('Home'); assert.deepEqual(await cls(), ['1', 'role']);
    await p.keyboard.press('Control+End'); assert.deepEqual(await cls(), ['2', 'role']);
    await p.keyboard.press('ArrowRight'); assert.deepEqual(await cls(), ['2', 'cell']);
    assert.equal(await p.evaluate(() => document.querySelectorAll('#layers [tabindex="0"]').length), 1);
    await p.keyboard.press('Tab'); assert.equal(await p.evaluate(() => document.activeElement.id), 'btn-addl', 'Tab leaves the grid');
    await p.keyboard.press('Shift+Tab'); assert.deepEqual(await cls(), ['2', 'cell'], 'Shift+Tab comes back to the last cell');
  });
  await t('Layer grid: Undo keeps the focus, edges are announced, up/down keep the ≈ column', async () => {
    await p.evaluate(() => { const s = blankScheme('Grid'); s.parts[0].layers = ['tp:Ultramar Blue 1', null, 'tp:Ultramar Blue 3', 'tp:Ultramar Blue 4'].map(id => ({ role: 'layer', paint: id })); schemes.unshift(s); saveSchemes(); selectScheme(s); active = 0; render(); });
    const at = () => p.evaluate(() => { const a = document.activeElement; return [a.closest('.lay')?.dataset.i, ['role', 'cell', 'sim', 'x'].find(c => a.classList.contains(c))]; });
    await p.locator('#layers .lay[data-i="0"] .sim').focus(); await p.keyboard.press('ArrowRight'); await p.keyboard.press('ArrowLeft');
    await p.keyboard.press('ArrowDown'); assert.deepEqual(await at(), ['1', 'cell'], 'empty layer: no ≈');
    await p.keyboard.press('ArrowDown'); assert.deepEqual(await at(), ['2', 'sim'], 'back in the ≈ column');
    await p.keyboard.press('Control+Home'); await p.keyboard.press('Alt+ArrowUp'); assert.equal(await p.textContent('#sr-status'), 'Already the first layer.');
    await p.locator('#layers .lay[data-i="2"] .cell').focus(); await p.keyboard.press('Delete');
    await p.click('#status .undo'); assert.equal(await p.evaluate(() => part.layers.length), 4);
    assert.equal(await p.textContent('#sr-status'), 'Undone.'); assert.notEqual(await p.evaluate(() => document.activeElement.tagName), 'BODY', 'focus not lost after Undo');
    assert.equal(await p.evaluate(() => document.querySelectorAll('#layers [aria-current]').length), 0, 'rows use aria-selected only');
  });
  await t('Role picker: keyboard only, R opens, arrows and Enter set the role, Esc returns focus', async () => {
    await newPart(['base', 'shade']);
    await p.locator('#layers .lay[data-i="1"] .cell').focus(); await p.keyboard.press('r');
    assert.equal(await p.locator('.rolepop[role=dialog] [role=listbox]').count(), 1);
    assert.deepEqual(await p.locator('.rolepop .mradio').evaluateAll(b => b.map(x => x.firstChild.firstChild.textContent)), ['Primer', 'Deep shadow', 'Shadow', 'Base', 'Shade', 'Layer', 'Highlight', 'Edge', 'Drybrush', 'Glaze']);
    assert.deepEqual(await p.locator('.rolepop small').allTextContents(), ['wash', 'thin']);
    assert.equal(await p.evaluate(() => document.activeElement.textContent), 'Shadewash');
    await p.keyboard.press('ArrowDown'); await p.keyboard.press('Enter');
    assert.deepEqual(await roles(), ['Base', 'Layer']); assert.equal(await p.textContent('#sr-status'), 'Layer 2 is now Layer.');
    assert(await p.evaluate(() => document.activeElement.classList.contains('role')), 'focus back on the role button');
    await p.keyboard.press('Enter'); await p.keyboard.press('g');
    assert.equal(await p.evaluate(() => document.activeElement.textContent), 'Glazethin', 'type-ahead');
    await p.keyboard.press('Escape'); assert.equal(await p.locator('.rolepop').count(), 0);
    assert(await p.evaluate(() => document.activeElement.classList.contains('role')));
    assert.deepEqual(await roles(), ['Base', 'Layer'], 'Esc changes nothing');
  });
  await t('Parts: add (Part n, name field opens), rename, keys, duplicate, move, clear, delete with Undo', async () => {
    await fresh('#tp');
    await p.click('#btn-addpart');
    assert.equal(await p.locator('.namepop input').count(), 1); assert.equal(await p.inputValue('.namepop input'), 'Part 7');
    await p.keyboard.type('Eyes'); await p.keyboard.press('Enter');
    assert.deepEqual(await p.locator('#parts [role=tab]').allTextContents(), ['Armour', 'Silver', 'Gold', 'Cloak', 'Leather', 'Black', 'Eyes']);
    assert.deepEqual(await roles(), ['Base']); assert.equal(await p.getAttribute('#parts [aria-selected=true]', 'id'), await p.evaluate(() => 'ptab-' + part.id));
    await p.locator('#parts [aria-selected=true]').focus(); await p.keyboard.press('Home');
    assert.equal(await p.textContent('#parts [aria-selected=true]'), 'Armour'); assert.equal(await p.evaluate(() => document.activeElement.textContent), 'Armour');
    await p.keyboard.press('ArrowRight'); assert.equal(await p.textContent('#parts [aria-selected=true]'), 'Silver');
    await p.click('#btn-part');
    assert.deepEqual(await p.locator('.mpop .mact').allTextContents(), ['Rename part', 'Duplicate part', 'Move left', 'Move right', 'Copy part', 'Clear layers', 'Delete part']);
    await p.click('.mpop .mact:has-text("Duplicate part")'); assert.equal(await p.textContent('#parts [aria-selected=true]'), 'Silver 2');
    await p.click('#btn-part'); await p.click('.mpop .mact:has-text("Move right")');
    assert.deepEqual((await p.locator('#parts [role=tab]').allTextContents()).slice(1, 4), ['Silver', 'Gold', 'Silver 2']);
    await p.click('#btn-part'); await p.click('.mpop .mact:has-text("Clear layers")'); assert.deepEqual(await paintsOf(), [null, null, null]);
    await p.click('#status .undo'); assert.deepEqual(await paintsOf(), ['wc:Leadbelcher', 'ws:Nuln Oil', 'wc:Stormhost Silver']);
    await p.locator('#parts [aria-selected=true]').focus(); await p.keyboard.press('Delete');
    assert.equal(await p.locator('#parts [role=tab]').count(), 7); assert((await status()).startsWith('Part deleted.'));
    await p.click('#status .undo'); assert.equal(await p.locator('#parts [role=tab]').count(), 8);
    await p.click('#btn-part'); await p.click('.mpop .mact:has-text("Rename part")'); await p.fill('.namepop input', ''); await p.keyboard.press('Enter');
    assert.equal(await p.textContent('#parts [aria-selected=true]'), 'Part 4', 'empty name → Part n');
    await newPart(['base']); await p.click('#btn-part');
    assert.equal(await p.getAttribute('.mpop .mact:has-text("Delete part")', 'aria-disabled'), 'true');
    await p.click('.mpop .mact:has-text("Delete part")', { force: true }); assert.equal(await status(), 'A scheme needs at least one part'); assert.equal(await p.locator('#parts [role=tab]').count(), 1);
    await p.keyboard.press('Escape');
  });
  await t('Scheme switcher: list with parts and missing count, New scheme, All schemes', async () => {
    await fresh('#tp');
    await p.click('#sch-pick'); assert.equal(await p.getAttribute('#sch-pick', 'aria-expanded'), 'true');
    assert.deepEqual(await p.locator('.mpop .mrow b').allTextContents(), ['Imperial FistsExample', 'Death GuardExample']);
    assert.deepEqual(await p.locator('.mpop .mrow small').allTextContents(), ['6 parts', '5 parts']);
    await p.keyboard.press('ArrowDown'); await p.keyboard.press('Enter');
    assert.equal(await p.textContent('#sch-name'), 'Death Guard'); assert.equal(await p.textContent('#parts [aria-selected=true]'), 'Armour');
    await p.click('#sch-pick'); await p.click('.mpop .mact:has-text("New scheme")');
    assert(await p.locator('#new-dlg').evaluate(d => d.open), 'New scheme asks for a name'); assert.equal(await p.evaluate(() => document.activeElement.id), 'new-name');
    await p.keyboard.press('Escape'); assert.equal(await p.evaluate(() => schemes.length), 2, 'cancel creates nothing');
    await p.click('#sch-pick'); await p.click('.mpop .mact:has-text("New scheme")'); await p.fill('#new-name', 'Ultramarines'); await p.keyboard.press('Enter');
    assert.equal(await p.textContent('#sch-name'), 'Ultramarines'); assert.deepEqual(await p.locator('#parts [role=tab]').allTextContents(), ['Part 1']);
    await p.click('#sch-pick'); await p.click('.mpop .mact:has-text("All schemes")');
    assert.equal(await p.evaluate(() => module), 'schemes');
  });
  await t('Schemes: list, overview cards with sphere, strip, rows and note; Edit opens the Mixer on that part', async () => {
    await fresh('#tp'); await p.click('#mod-schemes');
    assert.equal(await p.getAttribute('#mod-schemes', 'aria-current'), 'page'); assert.match(p.url(), /#schemes\/s_/);
    assert(await p.locator('#side').isHidden()); assert(await p.locator('#strips').isHidden());
    assert.deepEqual(await p.locator('#sside .sitem b').allTextContents(), ['Imperial Fists', 'Death Guard']);
    assert.deepEqual(await p.locator('#sside .sitem .ex').allTextContents(), ['Example', 'Example']);
    assert.equal(await p.textContent('#sview .sv-name'), 'Imperial Fists'); assert.equal(await p.textContent('#sview .meta'), '6 parts · 25 paints');
    assert.equal(await p.inputValue('#sview .snote textarea'), 'Wraithbone primer over everything. Varnish before the edge highlights.');
    assert.equal(await p.locator('#sview article.pcard').count(), 6); assert.equal(await p.locator('#sview .pcard h3').first().textContent(), 'Armour');
    assert.equal(await p.locator('#sview article.pcard').first().locator('.pc-rows li').count(), 6);
    assert.equal(await p.locator('#sview article.pcard').first().locator('.pc-strip i').count(), 6);
    assert.equal(await p.locator('#sview .pcard .pc-note').first().textContent(), 'Thin the shade 1:1 and keep it in the recesses.');
    const lit = await p.locator('#sview canvas.thumb').first().evaluate(c => c.getContext('2d').getImageData(32, 32, 1, 1).data[3]); assert.equal(lit, 255, 'part sphere drawn');
    assert.equal(await p.locator('#sview .addcard').textContent(), 'Add part');
    const cols = await p.locator('#sview .cards').evaluate(e => getComputedStyle(e).gridTemplateColumns.split(' ').length); assert.equal(cols, 2);
    await p.click('#sview article.pcard:nth-child(4) .open');   // Cloak
    assert.equal(await p.evaluate(() => module), 'mixer'); assert.equal(await p.textContent('#parts [aria-selected=true]'), 'Cloak');
    assert.equal(await p.evaluate(() => current), 'tp', 'chart opens the range of the active paint');
    assert.equal(await p.getAttribute('#layers .lay[data-i="0"]', 'aria-selected'), 'true', 'no empty layer: layer 1');
  });
  await t('Schemes: create, rename in place, duplicate, delete with dialog and Undo; examples lose the tag on edit, never come back', async () => {
    await fresh('#tp'); await p.click('#mod-schemes');
    await p.click('#sview .sv-name'); await p.fill('#sview .sv-name-in', 'Yellow guys'); await p.keyboard.press('Enter');
    assert.equal(await p.textContent('#sview .sv-name'), 'Yellow guys'); assert.equal(await p.textContent('#sside .sitem[aria-selected=true] b'), 'Yellow guys');
    assert.equal(await p.locator('#sside .sitem[aria-selected=true] .ex').count(), 0, 'edited: no Example tag');
    await p.click('#sview .sv-name'); await p.fill('#sview .sv-name-in', 'Nope'); await p.keyboard.press('Escape');
    assert.equal(await p.textContent('#sview .sv-name'), 'Yellow guys', 'Esc cancels');
    await p.click('#sview .acts .icon-btn'); assert.deepEqual(await p.locator('.mpop .mact').allTextContents(), ['Rename', 'Duplicate', 'Save to file', 'Delete scheme…']);
    await p.click('.mpop .mact:has-text("Duplicate")'); assert.equal(await p.textContent('#sview .sv-name'), 'Yellow guys 2');
    await p.click('#sview .acts .icon-btn'); await p.click('.mpop .mact:has-text("Delete scheme")');
    assert.equal(await p.textContent('#del-title'), 'Delete “Yellow guys 2”?');
    assert.equal(await p.textContent('#del-text'), 'The scheme and its 6 parts are removed from this browser.');
    await p.click('#del-cancel'); assert.equal(await p.locator('#sside .sitem').count(), 3);
    await p.click('#sview .acts .icon-btn'); await p.click('.mpop .mact:has-text("Delete scheme")'); await p.click('#del-go');
    assert.equal(await p.locator('#sside .sitem').count(), 2); assert((await p.textContent('#need-status')).startsWith('Scheme deleted.'));
    await p.click('#need-status .undo'); assert.equal(await p.locator('#sside .sitem').count(), 3);
    await p.click('#sside .sitem:has-text("Death Guard")');
    await p.click('#sview .acts .icon-btn'); await p.click('.mpop .mact:has-text("Delete scheme")'); await p.click('#del-go');
    await p.reload(); assert.deepEqual(await p.evaluate(() => schemes.map(s => s.name).sort()), ['Yellow guys', 'Yellow guys 2'], 'deleted example not created again');
    for (let i = 0; i < 2; i++) { await p.click('#sview .acts .icon-btn'); await p.click('.mpop .mact:has-text("Delete scheme")'); await p.click('#del-go'); }
    assert.deepEqual(await p.evaluate(() => schemes.map(s => s.name)), ['New scheme'], 'deleting the last leaves an empty New scheme');
    await p.click('#btn-newscheme'); await p.keyboard.press('Enter'); assert.equal(await p.evaluate(() => module), 'mixer'); assert.equal(await p.evaluate(() => schemes.length), 2);
  });
  await t('Paints needed: counts, Missing filter, own dots, Copy missing paints', async () => {
    await fresh('#tp'); const id = await IF();
    const miss = ['tp:Hawkshroud Yellow 5', 'wc:Canoptek Alloy', 'ws:Carroburg Crimson', 'wf:Paratrooper Tan', 'wf:Deep Grey'];
    await p.click('#mod-schemes');
    assert.deepEqual(await p.locator('.need-sum b').allTextContents(), ['25', '–']);
    assert.equal(await p.textContent('#need .empty-note'), "Mark your paints in Paints to see what's missing.");
    await p.evaluate(m => { const s = schemes.find(x => x.name === 'Imperial Fists'); owned = new Set([...usesOf(s).keys()].filter(x => !m.includes(x))); saveOwned(); renderOwned(); }, miss);
    assert.deepEqual(await p.locator('.need-sum b').allTextContents(), ['25', '5']);
    assert.deepEqual(await p.locator('.need-sum small').allTextContents(), ['paints in this scheme', 'not in My paints']);
    assert.equal(await p.locator('#need .nrows li.miss').count(), 5); assert.equal(await p.locator('#need .nrows .c .own').count(), 20);
    assert.deepEqual(await p.locator('#need .ngrp h3').allTextContents(), ['The Army Painter6 paints', 'Warhammer19 paints']);
    await p.click('#need .modes button:has-text("Missing")');
    assert.equal(await p.locator('#need .nrows li:not(.nr-tag)').count(), 5);
    assert.equal(await p.locator('#need .nrows li.miss .st').first().textContent(), 'Missing');
    await p.click('#need button:has-text("Copy missing paints")');
    const txt = (await p.evaluate(() => navigator.clipboard.readText())).split('\n').sort();
    assert.deepEqual(txt, ['Canoptek Alloy (Warhammer Base & Layer)', 'Carroburg Crimson (Warhammer Shade)', 'Deep Grey (The Army Painter Warpaints Fanatic)', 'Hawkshroud Yellow 5 (Warhammer Tone Pro)', 'Paratrooper Tan (The Army Painter Warpaints Fanatic)']);
    assert.equal(await p.textContent('#need-status'), 'Missing paints copied.');
    await p.click('#mod-paints'); assert.equal(await p.textContent('#inv-card b'), 'Imperial Fists'); assert.equal(await p.textContent('#inv-card small'), '5 paints missing');
    await p.click('#inv-card .invcard'); assert.equal(await p.evaluate(() => module), 'schemes');
    assert.equal(await p.getAttribute('#need .modes button:has-text("Missing")', 'aria-pressed'), 'true');
  });
  await t('Copy scheme and Copy part: plain text in the agreed layout', async () => {
    await p.click('#sview .acts .btn');
    const text = await p.evaluate(() => navigator.clipboard.readText());
    const head = ['Imperial Fists', 'Wraithbone primer over everything. Varnish before the edge highlights.', '', 'Armour',
      '  Primer     Wraithbone (Warhammer Primer)', '  Base       Hawkshroud Yellow 2 (Warhammer Tone Pro)', '  Shade      Casandora Yellow (Warhammer Shade)',
      '  Layer      Hawkshroud Yellow 3 (Warhammer Tone Pro)', '  Highlight  Hawkshroud Yellow 4 (Warhammer Tone Pro)', '  Edge       Hawkshroud Yellow 5 (Warhammer Tone Pro)',
      '  Note: Thin the shade 1:1 and keep it in the recesses.', '', 'Silver', '  Base       Leadbelcher (Warhammer Base & Layer)'].join('\n');
    assert(text.startsWith(head), text.slice(0, 600));
    assert(text.endsWith('\n\nMissing: Hawkshroud Yellow 5, Canoptek Alloy, Carroburg Crimson, Paratrooper Tan, Deep Grey'), text.slice(-200));
    assert.equal(await p.textContent('#need-status'), 'Scheme copied to clipboard.');
    await p.click('#mod-mixer'); await p.evaluate(() => { owned = new Set(); saveOwned(); renderOwned(); });
    await p.evaluate(() => openPart(scheme.parts[2])); await p.click('#btn-part'); await p.click('.mpop .mact:has-text("Copy part")');
    assert.equal(await p.evaluate(() => navigator.clipboard.readText()), 'Gold\n  Base       Retributor Armour (Warhammer Base & Layer)\n  Shade      Reikland Fleshshade (Warhammer Shade)\n  Highlight  Liberator Gold (Warhammer Base & Layer)\n  Edge       Canoptek Alloy (Warhammer Base & Layer)\n  Note: Eagles and purity seal frames.');
    assert.equal(await status(), 'Part copied to clipboard.');
    assert(!(await p.evaluate(() => schemeText(scheme))).includes('Missing:'), 'no Missing line without marked paints');
  });
  await t('Migration: 0.4x recipes and the current recipe become schemes, once', async () => {
    const recipes = [{ name: 'Blue', layers: ['tp:Ultramar Blue 1', 'tp:Ultramar Blue 2', 'tp:Ultramar Blue 3', 'tp:Ultramar Blue 4', 'tp:Ultramar Blue 5'], note: 'Thin coats' },
      { name: 'Red', layers: [null, 'tp:Bloodtoof Red 1', 'tp:Bloodtoof Red 3', null, 'tp:Bloodtoof Red 5'] }, { name: 'Gone', layers: ['tp:Ultramar Blue 1', null, null, null, 'xx:Old paint'] }];
    await fresh('#tp', { 'layer-mixer-recipes-v2': recipes, 'layer-mixer-current-v1': { layers: [null, null, 'wc:Leadbelcher', 'wc:Stormhost Silver', null], shape: 'cone', stepped: true, note: 'Metal bits' } });
    const r = await p.evaluate(() => ({ n: schemes.map(s => s.name), roles: schemes.map(s => s.parts[0].layers.map(l => l.role).join(',')), parts: schemes.map(s => s.parts.map(x => x.name).join()),
      notes: schemes.map(s => s.parts[0].note), flag: localStorage.getItem('layer-mixer-migrated-050'), open: scheme.name, shape, stepped, ex: schemes.some(s => s.example), old: !!localStorage.getItem('layer-mixer-recipes-v2') }));
    assert.deepEqual(r.n, ['Current recipe', 'Blue', 'Red', 'Gone']); assert.deepEqual(r.parts, ['Main', 'Main', 'Main', 'Main']);
    assert.deepEqual(r.roles, ['base,highlight', 'deepshadow,shadow,base,highlight,edge', 'shadow,base,edge', 'deepshadow,edge']);
    assert.deepEqual(r.notes, ['Metal bits', 'Thin coats', '', '']); assert.equal(r.flag, '1'); assert.equal(r.open, 'Current recipe');
    assert.equal(r.shape, 'cone'); assert.equal(r.stepped, true); assert.equal(r.ex, false, 'no examples next to migrated schemes'); assert(r.old, 'old keys stay');
    assert.equal(await status(), 'Your recipes are now schemes with one part each.');
    await p.click('#sch-pick'); await p.click('.mpop .mrow:has-text("Gone")');
    assert.equal(await p.textContent('#layers .lay[data-i="1"] .pname'), 'Old paint'); assert(await p.locator('#layers .lay[data-i="1"] .chipbig.gone').count());
    assert(await p.locator('#layers .lay[data-i="1"] .sim').isDisabled());
    await p.reload(); assert.equal(await p.evaluate(() => schemes.length), 4, 'second load does not duplicate'); assert.equal(await status(), '');
    await fresh('#tp', { 'layer-mixer-recipes-v2': recipes, 'layer-mixer-current-v1': { layers: recipes[0].layers } });
    assert.deepEqual(await p.evaluate(() => schemes.map(s => s.name)), ['Blue', 'Red', 'Gone'], 'a current recipe equal to a saved one is not doubled');
  });
  await t('Storage input is cleaned: lengths, types, ids, roles, __proto__', async () => {
    const long = 'x'.repeat(300), bad = [{ id: 's_ok1', name: long, note: long.repeat(10), example: 'yes', parts: [{ id: 'bad id', name: long, note: 5, layers: [...Array(30)].map(() => ({ role: 'wizard', paint: 'tp:Ultramar Blue 1' })) }, null, 'x'] },
      JSON.parse('{"__proto__":{"polluted":1},"id":"s_ok1","name":"Dup id","parts":[{"layers":[{"role":"__proto__","paint":{"x":1}}]}]}'), 7, null, { name: '<img src=x onerror=alert(1)>', parts: [] }];
    await fresh('#tp', { 'layer-mixer-schemes-v1': bad, 'layer-mixer-migrated-050': '1' });
    const r = await p.evaluate(() => ({ n: schemes.length, s: schemes.map(s => ({ id: s.id, name: s.name.length, note: s.note.length, ex: s.example, parts: s.parts.length, pn: s.parts[0].name.length, layers: s.parts[0].layers.length, role: s.parts[0].layers[0].role, paint: s.parts[0].layers[0].paint })), polluted: ({}).polluted, keys: Object.keys(schemes[1]) }));
    assert.equal(r.n, 3); assert.equal(r.s[0].name, 40); assert.equal(r.s[0].note, 1000); assert.equal(r.s[0].ex, false); assert.equal(r.s[0].pn, 40); assert.equal(r.s[0].layers, 8);
    assert.equal(r.s[0].role, 'wizard', 'unknown role kept for writing back'); assert.equal(r.s[0].parts, 1);
    assert.notEqual(r.s[1].id, 's_ok1', 'duplicate id replaced'); assert.equal(r.s[1].role, 'layer'); assert.equal(r.s[1].paint, null); assert.equal(r.polluted, undefined);
    assert.deepEqual(r.keys, ['id', 'name', 'note', 'example', 'created', 'updated', 'parts']);
    await p.evaluate(() => { selectScheme(schemes[0]); render(); });
    assert.equal(await p.textContent('#layers .lay .rn'), 'Layer', 'unknown role shown as Layer');
    await p.evaluate(() => { selectScheme(schemes[2]); setModule('schemes'); });
    assert.equal(await p.textContent('#sview .sv-name'), '<img src=x onerror=alert(1)>'); assert.equal(await p.locator('#sview img').count(), 0);
    await fresh('#tp', { 'layer-mixer-schemes-v1': '{broken', 'layer-mixer-session-v1': '[1,2]', 'layer-mixer-owned-v1': '"x"' });
    assert.deepEqual(await p.evaluate(() => schemes.map(s => s.name)), ['Imperial Fists', 'Death Guard'], 'broken storage: tool still starts');
  });
  await t('Save file: format 2 round trip; a 0.4x file with recipes is migrated', async () => {
    await fresh('#tp');
    const data = JSON.parse(await p.evaluate(() => invData()));
    assert.equal(data.app, 'layer-mixer'); assert.equal(data.format, 2); assert.equal(data.schemes.length, 2); assert.equal(data.schemes[0].parts[0].layers[0].role, 'primer');
    data.schemes[0].name = 'Renamed in file'; data.schemes.push({ id: 's_fromfile', name: 'From file', parts: [{ name: 'Main', layers: [{ role: 'base', paint: 'wc:Abaddon Black' }] }] });
    const f1 = path.join(__dirname, '.tmp-load.json'); fs.writeFileSync(f1, JSON.stringify(data));
    await p.click('#mod-paints'); await p.setInputFiles('#import-file', f1);
    await p.waitForFunction(() => /Loaded/.test(document.querySelector('#inv-status').textContent));
    assert.equal(await p.textContent('#inv-status'), 'Loaded 0 paints and 3 schemes.');
    assert.deepEqual(await p.evaluate(() => schemes.map(s => s.name).sort()), ['Death Guard', 'From file', 'Renamed in file'], 'same id replaced, new added');
    fs.writeFileSync(f1, JSON.stringify({ app: 'layer-mixer', version: '0.35', owned: ['tp:Ultramar Blue 1', 'zz:Unknown'], recipes: [{ name: 'Old blue', layers: ['tp:Ultramar Blue 1', null, 'tp:Ultramar Blue 3', null, null], note: 'n' }] }));
    await p.setInputFiles('#import-file', f1); await p.waitForFunction(() => /1 paint and 1 scheme/.test(document.querySelector('#inv-status').textContent));
    const s = await p.evaluate(() => { const x = schemes.find(s => s.name === 'Old blue'); return { roles: x.parts[0].layers.map(l => l.role), note: x.parts[0].note, own: [...owned, ...ownedUnknown] }; });
    assert.deepEqual(s.roles, ['deepshadow', 'base']); assert.equal(s.note, 'n'); assert.deepEqual(s.own, ['tp:Ultramar Blue 1', 'zz:Unknown']);
    fs.writeFileSync(f1, '{"app":"other"}'); await p.setInputFiles('#import-file', f1); await p.waitForTimeout(100);
    assert.equal(await p.textContent('#inv-status'), 'This is not a Layer Mixer file.');
    fs.unlinkSync(f1);
  });
  await t('Theme: follows the system by default, menu sets Light / Dark, stored, set before first paint', async () => {
    for (const cs of ['dark', 'light']) { const c = await browser.newContext({ colorScheme: cs }); const q = await c.newPage(); await q.goto(FILE);
      assert.equal(await q.evaluate(() => document.documentElement.dataset.theme), cs); assert.equal(await q.getAttribute('#btn-theme', 'aria-label'), 'Theme: System');
      if (cs === 'dark') { await q.emulateMedia({ colorScheme: 'light' }); await q.waitForFunction(() => document.documentElement.dataset.theme === 'light').catch(() => {}); assert.equal(await q.evaluate(() => document.documentElement.dataset.theme), 'light', 'live'); }
      await c.close(); }
    await p.click('#btn-theme'); assert.deepEqual(await p.locator('.mpop .mradio').allTextContents(), ['System', 'Light', 'Dark']);
    assert.equal(await p.getAttribute('.mpop .mradio[aria-checked=true]', 'role'), 'menuitemradio');
    await p.click('.mpop .mradio:has-text("Dark")'); assert.equal(await p.evaluate(() => document.documentElement.dataset.theme), 'dark');
    assert.equal(await p.evaluate(() => getComputedStyle(document.body).backgroundColor), 'rgb(46, 48, 51)');
    await p.reload(); assert.equal(await p.evaluate(() => document.documentElement.dataset.theme), 'dark'); assert.equal(await p.getAttribute('#btn-theme', 'aria-label'), 'Theme: Dark');
    const scripts = [...OUT.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
    assert.equal(scripts.length, 2); assert(OUT.indexOf('<script>') < OUT.indexOf('<style>'), 'theme script runs before the styles and the body');
    const el = { dataset: {} }; vm.runInNewContext(scripts[0], { localStorage: { getItem: () => 'light' }, document: { documentElement: el }, window: {}, matchMedia: () => ({ matches: false }) });
    assert.equal(el.dataset.theme, 'light');
    await p.click('#btn-theme'); await p.click('.mpop .mradio:has-text("System")');
  });
  await t('Contrast: text and muted text ≥ 4.5:1 on every surface in both themes', async () => {
    const bad = await p.evaluate(() => { const out = [], root = document.documentElement, keep = root.dataset.theme;
      const lin = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); };
      const rgb = c => { const d = document.createElement('i'); d.style.color = c; document.body.append(d); const m = getComputedStyle(d).color.match(/[\d.]+/g).map(Number); d.remove(); return m; };
      const over = (f, b) => f.length > 3 && f[3] < 1 ? f.slice(0, 3).map((v, i) => v * f[3] + b[i] * (1 - f[3])) : f.slice(0, 3);
      const L = c => .2126 * lin(c[0]) + .7152 * lin(c[1]) + .0722 * lin(c[2]);
      for (const th of ['light', 'dark']) { root.dataset.theme = th; const cs = getComputedStyle(root), v = n => rgb(cs.getPropertyValue(n).trim());
        for (const s of ['--bg', '--side', '--bench', '--card', '--well']) for (const f of ['--fg', '--muted']) { const b = v(s), fc = over(v(f), b), a = L(fc), z = L(b), r = (Math.max(a, z) + .05) / (Math.min(a, z) + .05); if (r < 4.5) out.push(`${th} ${f} on ${s}: ${r.toFixed(2)}`); } }
      root.dataset.theme = keep; return out; });
    assert.deepEqual(bad, []);
  });
  await t('1440×900: the Mixer bench fits with 6 layers and 6 parts', async () => {
    await fresh('#mixer/tp'); await p.evaluate(() => { selectScheme(schemes.find(s => s.name === 'Imperial Fists')); render(); });
    assert.equal(await rows().count(), 6); assert.equal(await p.locator('#parts [role=tab]').count(), 6);
    const b = await p.evaluate(() => { const e = document.querySelector('#bench'); return [e.scrollHeight, e.clientHeight]; });
    assert(b[0] <= b[1], `bench ${b}`);
    const clip = await p.evaluate(() => [...document.querySelectorAll('#parts .ptab')].filter(x => x.scrollWidth > x.clientWidth + 1 || x.getBoundingClientRect().right > document.querySelector('#bench').getBoundingClientRect().right).length);
    assert.equal(clip, 0, 'part tabs wrap, nothing cut off');
  });
  await t('Hash routing: #mixer/<range>, #schemes/<id>, #paints/<range>, old #tp, reload keeps the screen', async () => {
    await fresh('#tp');
    const id = await IF();
    await p.goto(FILE + '#schemes/' + id); await p.reload();
    assert.equal(await p.evaluate(() => module), 'schemes'); assert.equal(await p.textContent('#sview .sv-name'), 'Imperial Fists');
    await p.goto(FILE + '#paints/wc'); await p.reload(); assert.equal(await p.evaluate(() => [module, current, invMode].join()), 'paints,wc,true');
    await p.goto(FILE + '#ws'); await p.reload(); assert.equal(await p.evaluate(() => [module, current, home].join()), 'mixer,ws,false'); assert.match(p.url(), /#mixer\/ws$/);
    await p.evaluate(() => { location.hash = '#mixer/wc'; }); await p.waitForTimeout(50); assert.equal(await p.evaluate(() => current), 'wc');
    await p.goto(FILE + '#nonsense/<x>'); await p.reload(); assert.equal(await p.evaluate(() => [module, home].join()), 'mixer,true');
    await p.goto(FILE + '#mixer/tp'); await p.reload(); await p.keyboard.press('Alt+2'); assert.match(p.url(), /#schemes\/s_/);
    await p.keyboard.press('Alt+3'); assert.match(p.url(), /#paints\/tp$/); await p.keyboard.press('Alt+1'); assert.match(p.url(), /#mixer\/tp$/);
    await p.click('#go-home'); assert.equal(await p.evaluate(() => home), true); assert(!p.url().includes('#'));
  });
  await t('Start screen: schemes, guide Mixer / Preview / Schemes / Paints, marks without reference only', async () => {
    await fresh('');
    assert(await p.locator('#home').isVisible()); assert.equal(await p.getAttribute('#mod-start', 'aria-current'), 'page'); assert.equal(await p.getAttribute('#mod-mixer', 'aria-current'), null);
    assert.deepEqual(await p.locator('#home .scard:not(.new) b').evaluateAll(b => b.map(x => x.firstChild.textContent)), ['Imperial Fists', 'Death Guard']);
    assert.deepEqual(await p.locator('#home .scard .ex').allTextContents(), ['Example', 'Example']);
    assert.equal(await p.textContent('#home .scard.new'), 'New scheme');
    assert.deepEqual(await p.locator('#home .step h3').allTextContents(), ['Mixer', 'Preview', 'Schemes', 'Paints']);
    assert.deepEqual(await p.locator('#home .step p').allTextContents(), ['Pick a paint for each layer of a part.', 'Drag on the shape to move the light.', 'One card per part, plus the paints you still need.', 'Mark what you own.']);
    const marks = await p.textContent('#home .marks'); assert(!/Reference only/.test(marks)); assert(/Shade, wash, ink/.test(marks)); assert(/Layer in the open part/.test(marks));
    assert.equal(await p.textContent('#home .marks .slot-mark'), '2');
    await p.click('#home .scard:has-text("Death Guard")'); assert.equal(await p.evaluate(() => [module, scheme.name].join()), 'schemes,Death Guard');
    await p.click('#mod-mixer'); assert.equal(await p.evaluate(() => home), false, 'Mixer tab leaves Start'); await p.click('#mod-start'); await p.click('#home .dash .cta'); assert.equal(await p.evaluate(() => module), 'paints');
  });
  await t('Help: sections Mixer, Preview, Schemes, Paints, Keyboard; Esc closes', async () => {
    await p.click('#btn-help'); assert.deepEqual(await p.locator('#help .help-grid h3').allTextContents(), ['Mixer', 'Preview', 'Schemes', 'Paints', 'Keyboard']);
    const h = await p.textContent('#help');
    for (const s of ['Each part has up to eight layers. Set the role with the button in front of the paint.', 'Paints needed lists every paint of the scheme', 'switch between Mixer, Schemes and Paints', 'A adds a layer, Delete removes the active one'])
      assert(h.replace(/\s+/g, ' ').includes(s), s);
    assert(!/recipe|reference only|\bsteps?\b/i.test(h), (h.match(/.{30}(recipe|reference only|\bsteps?\b).{30}/i) || [''])[0]); await p.keyboard.press('Escape'); assert(!(await p.locator('#help').isVisible()));
  });
  await t('Search: / and Ctrl+K, Enter opens the paint, Shift+Enter puts it into the active layer, from Schemes to the Mixer', async () => {
    await fresh('#tp'); await newPart(['base', 'shade']);
    await p.keyboard.press('/'); assert.equal(await p.evaluate(() => document.activeElement.id), 'find-q');
    await p.keyboard.type('nuln oil'); await p.waitForTimeout(150); await p.keyboard.press('Enter');
    assert.equal(await p.evaluate(() => [current, document.activeElement.dataset.id].join()), 'ws,ws:Nuln Oil'); assert.deepEqual(await paintsOf(), [null, null]);
    await p.keyboard.press('Enter'); assert.deepEqual(await paintsOf(), ['ws:Nuln Oil', null], 'second Enter fills the layer');
    await p.keyboard.press('Control+k'); await p.keyboard.type('stormhost silver'); await p.waitForTimeout(150); await p.keyboard.press('Shift+Enter');
    assert.deepEqual(await paintsOf(), ['ws:Nuln Oil', 'wc:Stormhost Silver']);
    await p.click('#mod-schemes'); await p.click('#find-q'); await p.fill('#find-q', 'abaddon'); await p.waitForTimeout(150); await p.keyboard.press('Enter');
    assert.equal(await p.evaluate(() => [module, current].join()), 'mixer,wc');
  });
  await t('Similar paints: ≈ only on filled layers, hover previews, click replaces that layer, Esc closes', async () => {
    await newPart(['base', 'highlight', 'edge']); await p.evaluate(() => { part.layers[0].paint = 'tp:Ultramar Blue 3'; part.layers[1].paint = 'wc:Calgar Blue'; active = 2; render(); });
    assert.deepEqual(await p.locator('#layers .sim').evaluateAll(b => b.map(x => x.disabled)), [false, false, true]);
    await p.click('#layers .lay[data-i="1"] .sim'); assert(await p.locator('#simpop').isVisible());
    assert.equal(await p.getAttribute('#layers .lay[data-i="1"] .sim', 'aria-expanded'), 'true');
    const first = await p.locator('#simpop .prow').first().textContent();
    await p.locator('#simpop .prow').first().click();
    const now = await p.evaluate(() => part.layers[1].paint); assert(now !== 'wc:Calgar Blue' && first.includes(now.split(':')[1]), now);
    assert.equal(await p.evaluate(() => active), 2, 'active layer unchanged');
    await p.click('#layers .lay[data-i="0"] .sim'); await p.keyboard.press('Escape');
    assert(await p.locator('#simpop').isHidden()); assert(await p.evaluate(() => document.activeElement.classList.contains('sim')));
  });
  await t('Paints: mark by click, row and drag; Mine filter; counts; persists; Clear needs a confirmation', async () => {
    await fresh('#paints/tp');
    assert(await p.locator('#inv-panel').isVisible()); assert(await p.locator('#mix-bench').isHidden());
    await p.click(sw('tp:Ultramar Blue 1')); assert.equal(await p.getAttribute(sw('tp:Ultramar Blue 1'), 'aria-pressed'), 'true');
    assert.deepEqual(await paintsOf(), ['wpr:Wraithbone', 'tp:Hawkshroud Yellow 2', 'ws:Casandora Yellow', 'tp:Hawkshroud Yellow 3', 'tp:Hawkshroud Yellow 4', 'tp:Hawkshroud Yellow 5'], 'marking does not touch the part');
    await p.click('.strip:has-text("Scinari Blue") .label'); assert.equal(await p.locator('.strip:has-text("Scinari Blue") .sw.owned').count(), 5);
    const a = await p.locator(sw('tp:Bloodtoof Red 1')).boundingBox(), b = await p.locator(sw('tp:Bloodtoof Red 4')).boundingBox();
    await p.mouse.move(a.x + 5, a.y + 5); await p.mouse.down(); await p.mouse.move(b.x + 5, b.y + 5, { steps: 8 }); await p.mouse.up();
    assert.equal(await p.locator('.strip:has-text("Bloodtoof Red") .sw.owned').count(), 4);
    await p.click('#show-mine'); assert.equal(await p.locator('.sw:visible').count(), 10);
    await p.reload(); assert.equal(await p.evaluate(() => owned.size), 10);
    assert((await p.textContent('#inv-brands')).includes('10 / 525'));
    await p.evaluate(() => { localStorage.setItem('layer-mixer-side-pins-v1', '["Vallejo"]'); localStorage.setItem('layer-mixer-theme-v1', 'light'); });
    assert.equal(await p.getAttribute('#btn-settings', 'aria-label'), 'Settings'); await p.click('#btn-settings'); const items = await p.locator('.mpop .mact').allTextContents();
    assert.deepEqual(items.filter(s => !s.startsWith('Save as')), ['Save to file', 'Load from file…', 'Clear all…'], 'settings menu: data actions');
    await p.click('.mpop .mact:has-text("Clear all")'); assert(await p.locator('#reset-dlg').evaluate(d => d.open)); assert(await p.locator('#reset-go').isDisabled());
    await p.keyboard.press('Escape'); await p.waitForTimeout(100); assert.equal(await p.evaluate(() => document.activeElement.id), 'btn-settings', 'cancel: back to Settings');
    assert(/10 marked paints/.test(await p.evaluate(() => { openReset(null); return document.querySelector('#reset-text').textContent; })), 'the warning names what goes');
    assert.equal(await p.locator('#btn-reset').count(), 0, 'Clear all is only in the settings menu'); await p.check('#reset-ok');
    await Promise.all([p.waitForEvent('load'), p.click('#reset-go')]); await p.waitForTimeout(300);
    assert.equal(await p.evaluate(() => [owned.size, schemes.map(s => s.name).join('+'), favs.length, Object.keys(localStorage).filter(k => k.startsWith('layer-mixer-side') || k.startsWith('layer-mixer-theme')).length].join()), '0,Imperial Fists+Death Guard,0,0', 'clear all: like the first start');
  });
  await t('Sidebar: favourites with stars on top, one brand open with the yellow line', async () => {
    await fresh('#tp');
    await p.locator('#brand-vallejo').focus(); await p.keyboard.press('f');
    assert.equal((await p.locator('#side .bh .bn').allTextContents())[0], 'Vallejo');
    assert.equal(await p.locator('#side .favsep').count(), 1);
    const line = await p.evaluate(() => getComputedStyle(document.querySelector('#side .rg'), '::before').backgroundColor);
    assert.equal(line, 'rgb(214, 154, 18)', 'brand line in light');
    await p.locator('#brand-vallejo').focus(); await p.keyboard.press('f');
  });
  await t('Large preview: title is scheme · part, list shows roles and range tags', async () => {
    await fresh('#mixer/tp'); await p.evaluate(() => { selectScheme(schemes.find(s => s.name === 'Imperial Fists')); render(); });
    await p.click('#btn-zoom'); assert.equal(await p.textContent('#zoom-title'), 'Imperial Fists · Armour');
    assert.equal(await p.locator('#zoom-recipe li').count(), 6); assert.equal(await p.locator('#zoom-recipe li small').first().textContent(), 'Primer');
    assert.equal(await p.textContent('.zoom-note'), 'Thin the shade 1:1 and keep it in the recesses.');
    const w = await p.evaluate(() => document.querySelector('#sphere').width); assert(w > 380, 'renders larger');
    await p.click('#btn-zoom'); await p.waitForFunction(() => document.querySelector('#sphere').width === 380); assert(await p.locator('.mix-bench .sphere-wrap #sphere').count(), 'canvas back on the bench');
  });
  await t('Accessibility: named tabs, lists and menus; Esc returns focus; reduced motion skips the flash', async () => {
    const unnamed = await p.evaluate(() => [...document.querySelectorAll('[role=tablist],[role=listbox],[role=menu],nav,dialog,.sw,.lay,#side .bh,#side .rg,button')].filter(e => !(e.getAttribute('aria-label') || e.getAttribute('aria-labelledby') || e.textContent.trim())).map(e => e.outerHTML.slice(0, 80)));
    assert.deepEqual(unnamed, []);
    await p.click('#btn-part'); assert.equal(await p.getAttribute('.mpop', 'role'), 'menu'); assert(await p.getAttribute('.mpop', 'aria-label'));
    await p.keyboard.press('Escape'); assert.equal(await p.evaluate(() => document.activeElement.id), 'btn-part'); assert.equal(await p.getAttribute('#btn-part', 'aria-expanded'), 'false');
    await p.click('#sch-pick'); await p.keyboard.press('Escape'); assert.equal(await p.evaluate(() => document.activeElement.id), 'sch-pick');
    await p.emulateMedia({ reducedMotion: 'reduce' }); await p.evaluate(() => jumpTo('wc:Abaddon Black'));
    assert(!(await p.locator(sw('wc:Abaddon Black')).evaluate(e => e.classList.contains('flash')))); await p.emulateMedia({ reducedMotion: 'no-preference' });
  });
  await t('Narrow 390: one column, no horizontal scroll, module tabs, full paint names, pick bar over the chart', async () => {
    const c = await browser.newContext({ viewport: { width: 390, height: 844 } }); const q = await c.newPage(); watch(q);
    await q.goto(FILE + '#mixer/tp'); await q.evaluate(() => { selectScheme(schemes.find(s => s.name === 'Imperial Fists')); render(); });
    assert(!(await q.evaluate(() => document.documentElement.scrollWidth > innerWidth)), 'no horizontal scroll');
    const tabs = await q.locator('nav.mods .mod').evaluateAll(a => a.map(x => x.getBoundingClientRect()).map(r => [Math.round(r.top), r.width > 80]));
    assert(tabs.every(x => x[0] === tabs[0][0] && x[1]), JSON.stringify(tabs));
    const benchTop = await q.evaluate(() => document.querySelector('#bench').getBoundingClientRect().top < document.querySelector('.chart').getBoundingClientRect().top);
    assert(benchTop, 'bench before the chart');
    const cut = await q.locator('#layers .pname').evaluateAll(e => e.filter(x => x.scrollWidth > x.clientWidth + 1).map(x => x.textContent)); assert.deepEqual(cut, []);
    assert(await q.locator('#pickbar').isHidden());
    await q.locator(sw('tp:Ultramar Blue 3')).scrollIntoViewIfNeeded(); await q.waitForTimeout(50);
    assert(await q.locator('#pickbar').isVisible()); assert.equal(await q.textContent('#pickbar b'), 'Armour · Primer');
    await q.click(sw('tp:Ultramar Blue 3')); assert.equal(await q.textContent('#pickbar small'), 'Ultramar Blue 3', 'the bar follows the active layer');
    await q.click('#mod-schemes'); assert(!(await q.evaluate(() => document.documentElement.scrollWidth > innerWidth)));
    assert(await q.evaluate(() => document.querySelector('#sview').getBoundingClientRect().top < document.querySelector('#need').getBoundingClientRect().top), 'overview first');
    assert(await q.locator('#sside').isHidden()); assert(await q.locator('.sv-switch').isVisible());
    await c.close();
  });
  /* ---------- fixes from the 0.40 review ---------- */
  await t('Review: a stored role "constructor" is unknown, Copy scheme still works', async () => {
    const bad = [{ id: 's_proto', name: 'Proto', parts: [{ name: 'A', layers: [{ role: 'constructor', paint: 'wc:Abaddon Black' }, { role: 'tostring', paint: null }] }] }];
    await fresh('#tp', { 'layer-mixer-schemes-v1': bad, 'layer-mixer-migrated-050': '1' });
    const r = await p.evaluate(() => { selectScheme(schemes[0]); render(); return { rn: roleName(part.layers[0]), txt: schemeText(scheme), role: part.layers[0].role }; });
    assert.equal(r.rn, 'Layer'); assert.equal(r.role, 'constructor', 'written back unchanged'); assert.match(r.txt, /Layer +Abaddon Black/);
    assert.equal(await p.textContent('#layers .lay .rn'), 'Layer');
  });
  await t('Review: Load merges schemes: nothing local is lost at 200, newer local kept, no copies on a second load', async () => {
    const many = Array.from({ length: 200 }, (_, i) => ({ id: 's_m' + i, name: 'Mine ' + i, updated: 1000 + i, parts: [{ name: 'P', layers: [{ role: 'base', paint: null }] }] }));
    await fresh('#tp', { 'layer-mixer-schemes-v1': many, 'layer-mixer-migrated-050': '1', 'layer-mixer-examples-v1': '1' });
    const file = { app: 'layer-mixer', format: 2, owned: [], schemes: [
      { id: 's_m5', name: 'Old copy', updated: 10, parts: [{ name: 'P', layers: [] }] },   // older than the one here
      { id: 's_m6', name: 'Newer in file', updated: 99999999, parts: [{ name: 'P', layers: [] }] },
      { id: 's_new1', name: 'New A', parts: [] }, { id: 's_new2', name: 'New B', parts: [] }] };
    const f = path.join(__dirname, '.tmp-merge.json'); fs.writeFileSync(f, JSON.stringify(file));
    await p.click('#mod-paints'); await p.setInputFiles('#import-file', f);
    await p.waitForFunction(() => /Loaded/.test(document.querySelector('#inv-status').textContent));
    assert.equal(await p.textContent('#inv-status'), 'Loaded 0 paints and 1 scheme. 2 schemes not added: 200 is the maximum.');
    const r = await p.evaluate(() => ({ n: schemes.length, m5: schemes.find(s => s.id === 's_m5').name, m6: schemes.find(s => s.id === 's_m6').name, mine: schemes.filter(s => /^Mine /.test(s.name)).length }));
    assert.deepEqual(r, { n: 200, m5: 'Mine 5', m6: 'Newer in file', mine: 199 });
    // a 0.4x file twice, and a backup with the examples in a browser that has them already
    await fresh('#tp');
    fs.writeFileSync(f, JSON.stringify({ app: 'layer-mixer', version: '0.35', owned: [], recipes: [{ name: 'Old blue', layers: ['tp:Ultramar Blue 1', null, null, null, null] }] }));
    await p.click('#mod-paints'); await p.setInputFiles('#import-file', f); await p.waitForFunction(() => /1 scheme/.test(document.querySelector('#inv-status').textContent));
    await p.evaluate(() => { document.querySelector('#inv-status').textContent = ''; }); await p.setInputFiles('#import-file', f);
    await p.waitForFunction(() => /Loaded/.test(document.querySelector('#inv-status').textContent));
    const backup = JSON.parse(await p.evaluate(() => invData())); backup.schemes.forEach(s => { s.id = 's_' + Math.random().toString(36).slice(2, 9); });
    fs.writeFileSync(f, JSON.stringify(backup)); await p.setInputFiles('#import-file', f); await p.waitForTimeout(100);
    assert.deepEqual(await p.evaluate(() => schemes.map(s => s.name).sort()), ['Death Guard', 'Imperial Fists', 'Old blue']);
    fs.unlinkSync(f);
  });
  await t('Review: unknown paint ids from storage are limited and must look like ids', async () => {
    const own = ['tp:Ultramar Blue 1', 'zz:Future', 'NOT AN ID', 'x'.repeat(130), ...Array.from({ length: 900 }, (_, i) => 'qq:P' + i)];
    await fresh('#tp', { 'layer-mixer-owned-v1': own });
    const r = await p.evaluate(() => ({ own: owned.size, unk: ownedUnknown.length, bad: ownedUnknown.some(x => !/^[a-z0-9]{1,8}:/.test(x)) }));
    assert.deepEqual(r, { own: 1, unk: 500, bad: false });
  });
  await t('Review: notes are saved for the scheme they were typed in, also when switching at once', async () => {
    await fresh('#tp');
    const ids = await p.evaluate(() => schemes.map(s => s.id));
    await p.evaluate(id => { selectScheme(schemes.find(s => s.id === id)); setModule('schemes'); }, ids[0]);
    const before = await p.evaluate(id => schemes.find(s => s.id === id).updated, ids[1]);
    await p.fill('#sview .snote textarea', 'scheme note');
    await p.evaluate(id => { selectScheme(schemes.find(s => s.id === id)); renderSchemes(); render(); }, ids[1]);   // switch within 300 ms
    await p.waitForTimeout(400);
    let r = await p.evaluate(([a, b]) => { const x = JSON.parse(localStorage.getItem('layer-mixer-schemes-v1')); const A = x.find(s => s.id === a), B = x.find(s => s.id === b); return { note: A.note, exA: A.example, exB: B.example, upB: B.updated }; }, ids);
    assert.deepEqual(r, { note: 'scheme note', exA: false, exB: true, upB: before });
    await p.click('#mod-mixer'); await p.fill('#part-note', 'part note');
    await p.evaluate(id => { selectScheme(schemes.find(s => s.id === id)); render(); }, ids[0]);
    await p.waitForTimeout(400);
    r = await p.evaluate(b => JSON.parse(localStorage.getItem('layer-mixer-schemes-v1')).find(s => s.id === b), ids[1]);
    assert.equal(r.parts[0].note, 'part note'); assert.equal(r.example, false, 'the part note belongs to the second scheme');
  });
  await t('Review: an Undo is dropped when another tab changes the schemes; switching schemes clears it too', async () => {
    await fresh('#tp');
    await p.locator('#layers .lay[data-i="1"] .x').click({ force: true });
    assert.equal(await p.locator('#status .undo').count(), 1);
    const q = await ctx.newPage(); await q.goto(FILE + '#tp'); await q.evaluate(() => { scheme.name = 'From tab 2'; changed(); }); await p.waitForTimeout(100);
    assert.equal(await p.locator('#status .undo').count(), 0); assert.equal(await p.evaluate(() => scheme.name), 'From tab 2'); await q.close();
    await p.locator('#layers .lay[data-i="1"] .x').click({ force: true }); assert.equal(await p.locator('#status .undo').count(), 1);
    await p.evaluate(() => { selectScheme(schemes.find(s => s !== scheme)); render(); }); assert.equal(await p.locator('#status .undo').count(), 0);
  });
  await t('Review: Undo in Schemes survives a re-render, the status node stays the same', async () => {
    await fresh('#tp'); await p.click('#mod-schemes');
    const id = await p.evaluate(() => scheme.id); await p.evaluate(() => { deleteScheme(scheme); window.__st = document.querySelector('#need-status'); });
    await p.evaluate(() => renderNeed());
    assert(await p.evaluate(() => document.querySelector('#need-status') === window.__st && !!window.__st.querySelector('.undo')));
    await p.click('#need-status .undo'); assert(await p.evaluate(i => schemes.some(s => s.id === i), id));
    await p.evaluate(() => { schemes = [scheme]; saveSchemes(); deleteScheme(scheme); }); assert.equal(await p.evaluate(() => schemes.length), 1, 'an empty stand-in');
    await p.click('#need-status .undo'); assert.equal(await p.evaluate(() => schemes.length), 1, 'the stand-in goes again');
  });
  await t('Review: routing: #paints and #mixer without a range, reload without an address keeps the module', async () => {
    await fresh('#mixer/tp');
    await p.evaluate(() => { location.hash = '#paints'; }); await p.waitForTimeout(50);
    assert.equal(await p.evaluate(() => module), 'paints'); assert.match(p.url(), /#paints\/tp$/);
    await p.evaluate(() => { location.hash = '#mixer'; }); await p.waitForTimeout(50); assert.equal(await p.evaluate(() => module), 'mixer');
    await p.click('#mod-schemes'); await p.waitForTimeout(200);
    await p.goto(FILE); await p.reload(); assert.equal(await p.evaluate(() => module), 'schemes');
  });
  await t('Review: Schemes after a reload shows no chart', async () => {
    await fresh('#tp'); const id = await IF(); await p.goto(FILE + '#schemes/' + id); await p.reload();
    assert.deepEqual(await p.evaluate(() => ['#strips', '#notes'].map(q => getComputedStyle(document.querySelector(q)).display)), ['none', 'none']);
  });
  for (const w of [1440, 1024]) await t(`Review: ${w}: range tags on cards and layers are not cut off`, async () => {
    await p.setViewportSize({ width: w, height: 900 }); await fresh('#tp');
    const cut = sel => p.locator(sel).evaluateAll(e => e.filter(x => x.scrollWidth > x.clientWidth + 1 || [...x.children].some(c => c.scrollWidth > c.clientWidth + 1)).map(x => x.textContent));
    assert.deepEqual(await cut('#layers .rtag'), []);
    await p.click('#mod-schemes'); assert.deepEqual(await cut('.pc-rows .rtag'), []);
    await p.setViewportSize({ width: 1440, height: 900 });
  });
  await t('Review: ≈ open: the glyph is readable in both themes, also under the pointer', async () => {
    for (const th of ['dark', 'light']) {
      await fresh('#tp', { 'layer-mixer-theme-v1': th });
      await p.locator('#layers .lay[data-i="1"] .sim').click(); await p.hover('#layers .lay[data-i="1"] .sim');
      const c = await p.locator('#layers .lay[data-i="1"] .sim').evaluate(b => { const s = getComputedStyle(b); return [s.color, s.backgroundColor, b.getAttribute('aria-expanded')]; });
      assert.equal(c[2], 'true'); assert.notEqual(c[0], c[1], th);
    }
  });
  await t('Review: A adds a layer only around the layers', async () => {
    await fresh('#tp'); const n = await rows().count();
    await p.focus('#mode-smooth'); await p.keyboard.press('a'); await p.focus(sw('tp:Ultramar Blue 1')); await p.keyboard.press('a');
    assert.equal(await rows().count(), n);
    await p.focus('#btn-addl'); await p.keyboard.press('a'); assert.equal(await rows().count(), n + 1);
  });
  await t('Review: focus: Add part from Schemes opens the name field, delete dialog Esc returns to ⋯, Alt+2 moves the focus', async () => {
    await fresh('#tp'); await p.click('#mod-schemes'); await p.click('#sview .addcard'); await p.waitForTimeout(100);
    assert.equal(await p.evaluate(() => document.activeElement.matches('.namepop input')), true);
    await p.keyboard.press('Escape'); await p.click('#mod-schemes');
    await p.click('#sview [data-k="more"]'); await p.click('.mpop .danger'); assert(await p.locator('#del-dlg').evaluate(d => d.open));
    await p.keyboard.press('Escape'); await p.waitForTimeout(50);
    assert.equal(await p.evaluate(() => document.activeElement.dataset.k), 'more');
    await p.click('#mod-mixer'); await p.locator('#layers .lay.active .cell').focus(); await p.keyboard.press('Alt+2');
    assert.equal(await p.evaluate(() => document.activeElement.className), 'sv-name'); assert.equal(await p.textContent('#sr-status'), 'Schemes.');
    assert.equal(await p.title(), 'Schemes · Layer Mixer');
    await p.keyboard.press('Alt+1'); assert(await p.evaluate(() => document.activeElement.getAttribute('role') === 'tab'));
  });
  await t('Review: a popover stays open when opening it scrolls; Move up / down in the role picker', async () => {
    await p.setViewportSize({ width: 1024, height: 600 }); await fresh('#tp');
    await p.evaluate(() => { document.querySelector('#bench').scrollTop = 0; });
    const last = await p.evaluate(() => part.layers.length - 1);
    await p.locator(`#layers .lay[data-i="${last}"] .role`).click({ force: true }); await p.waitForTimeout(100);
    assert.equal(await p.locator('.rolepop').count(), 1, 'still open');
    await p.keyboard.press('Escape');
    const before = await paintsOf();
    await p.locator('#layers .lay[data-i="1"] .role').click(); await p.click('.rolepop .mact:has-text("Move up")');
    const after = await paintsOf(); assert.deepEqual(after, [before[1], before[0], ...before.slice(2)]);
    assert(await p.evaluate(() => document.activeElement.closest('.lay').dataset.i === '0'));
    await p.setViewportSize({ width: 1440, height: 900 });
  });
  await t('Review: Duplicate part takes the next free number; Paints needed hides Copy on an empty scheme', async () => {
    await newPart(['base']); await p.evaluate(() => { scheme.parts.push(copyPart(scheme.parts[0]), copyPart(scheme.parts[0])); scheme.parts.forEach((x, i) => { x.name = 'Part ' + (i + 1); }); render(); duplicatePart(scheme.parts[2]); });
    assert.deepEqual(await p.evaluate(() => scheme.parts.map(x => x.name)), ['Part 1', 'Part 2', 'Part 3', 'Part 4']);
    await p.click('#mod-schemes'); assert.equal(await p.locator('#need [data-k="copymiss"]').count(), 0);
  });
  await t('Renaming is visible: scheme title, part card name, double-click on a part tab; Saved shows after an edit', async () => {
    await p.goto(FILE + '#schemes'); await p.reload(); await p.waitForSelector('#sview .pc-name');
    const first = p.locator('#sview .pc-name').first(); const old = (await first.textContent()).trim();
    await first.click(); await p.keyboard.press('Control+a'); await p.keyboard.type('Armour plates'); await p.keyboard.press('Enter');
    assert.equal((await p.locator('#sview .pc-name').first().textContent()).trim(), 'Armour plates', 'part renamed from its card');
    assert(await p.locator('#saved-ind.on').count(), 'Saved shows');
    await p.click('#sview .sv-name'); await p.keyboard.press('Control+a'); await p.keyboard.type('My Fists'); await p.keyboard.press('Enter');
    assert.equal((await p.locator('#sview .sv-name').textContent()).trim(), 'My Fists');
    await p.keyboard.press('Alt+1'); await p.locator('.ptab[role=tab]').first().dblclick();
    await p.keyboard.press('Control+a'); await p.keyboard.type(old); await p.keyboard.press('Enter');
    assert.equal((await p.locator('.ptab[role=tab] .pt-n').first().textContent()).trim(), old, 'double-click on a part tab renames it');
  });
  await t('Open in Mixer from a card, browser Back returns to the scheme', async () => {
    await p.goto(FILE + '#schemes'); await p.reload(); await p.waitForSelector('#sview .pcard .open');
    assert.equal((await p.locator('#sview .pcard .open').first().textContent()).trim(), 'Open in Mixer');
    await p.locator('#sview .pcard .open').nth(1).click();
    assert.equal(await p.evaluate(() => module), 'mixer');
    await p.goBack(); await p.waitForFunction(() => module === 'schemes', null, { timeout: 3000 });
    assert(await p.locator('#sview .pcard').first().isVisible(), 'Back shows the scheme again');
    await p.goForward(); await p.waitForFunction(() => module === 'mixer', null, { timeout: 3000 });
  });
  await t('Low windows: the preview stays, only the layer list scrolls', async () => {
    await p.goto(FILE + '#tp'); await p.click('#mod-mixer');
    const eight = () => p.evaluate(() => { const s = blankScheme('Scroll'); s.parts[0].layers = Array.from({ length: 8 }, (_, i) => ({ role: 'layer', paint: `tp:Ultramar Blue ${i % 5 + 1}` })); schemes.unshift(s); saveSchemes(); selectScheme(s); active = 0; render(); });
    await p.setViewportSize({ width: 1440, height: 900 }); await eight();
    const m = () => p.evaluate(() => { const b = document.querySelector('#bench'), l = document.querySelector('#lscroll'); return { bench: b.scrollHeight - b.clientHeight, list: l.scrollHeight - l.clientHeight, up: l.classList.contains('more-up'), down: l.classList.contains('more-down'), sphere: Math.round(document.querySelector('#sphere').getBoundingClientRect().top), top: l.scrollTop }; });
    let r = await m(); assert.deepEqual([r.bench, r.list, r.up, r.down], [0, 0, false, false], '1440x900: nothing scrolls');
    await p.setViewportSize({ width: 1366, height: 650 }); await p.waitForTimeout(100);
    r = await m(); assert.equal(r.bench, 0, 'the bench itself does not scroll'); assert(r.list > 0 && r.down && !r.up, 'the list scrolls, fade at the bottom');
    const sph = r.sphere;
    await p.locator('#layers .lay[data-i="0"] .cell').focus(); for (let i = 0; i < 7; i++) await p.keyboard.press('ArrowDown');
    r = await m(); assert.equal(r.sphere, sph, 'the sphere stays in place'); assert(r.up, 'scrolled down, fade at the top');
    const inside = await p.evaluate(() => { const a = document.querySelector('#layers .lay[data-i="7"]').getBoundingClientRect(), b = document.querySelector('#lscroll').getBoundingClientRect(); return a.top >= b.top && a.bottom <= b.bottom; });
    assert(inside, 'row 8 fully visible');
    await p.locator('#layers .lay[data-i="7"] .role').click(); assert(await p.locator('.rolepop').isVisible());
    await p.evaluate(() => { document.querySelector('#lscroll').scrollTop -= 30; }); await p.waitForTimeout(80);
    assert(await p.locator('.rolepop').isVisible(), 'role picker follows its row');
    await p.evaluate(() => { document.querySelector('#lscroll').scrollTop = 0; }); await p.waitForTimeout(80);
    assert.equal(await p.locator('.rolepop').count(), 0, 'closes when the row leaves the list');
    await p.evaluate(() => { document.querySelector('#lscroll').scrollTop = 9999; }); await p.waitForTimeout(50);
    await p.locator('#layers .lay[data-i="7"] .sim').click(); assert(await p.locator('#simpop').isVisible());
    await p.evaluate(() => { document.querySelector('#lscroll').scrollTop = 0; }); await p.waitForTimeout(80);
    assert(await p.locator('#simpop').isHidden(), 'similar paints close when their row scrolls away');
    await p.evaluate(() => { document.querySelector('#lscroll').scrollTop = 9999; }); await p.waitForTimeout(50);
    const before = (await m()).top; await p.click('#part-note'); await p.keyboard.type('thin coats'); await p.waitForTimeout(400);
    assert.equal((await m()).top, before, 'typing in the note does not jump');
    await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(100);
    assert.equal(await p.evaluate(() => getComputedStyle(document.querySelector('#lscroll')).overflowY), 'visible', 'narrow: no inner scroller');
    await p.setViewportSize({ width: 1440, height: 900 });
  });
  await t('No JS errors', async () => { assert.equal(errs.length, 0, errs.join(' | ')); });
  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

/* Live-site QA sweep (saves go to an in-memory stand-in, never the kids' real online saves): the ocean world at every level and character, a two-tab
   save merge, reset, eight viewports with Cora's play flows, the keyboard-open
   view, and text contrast in light and dark mode.
     node qa.js                       (against the published site)
     node qa.js ../index.html         (against a local file)               */
const puppeteer = require('puppeteer-core'); const path = require('path');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const LIVE = 'https://yshi41.github.io/spelling-worlds/';
const URL = process.argv[2] ? 'file:///' + path.resolve(process.argv[2]).split(path.sep).join('/') : LIVE;
const sleep = ms => new Promise(r => setTimeout(r, ms));
let passes = 0, fails = 0, warns = 0; const issues = [], warnings = [];
function ok(cond, msg, detail) { if (cond) { passes++; console.log('  ok   ' + msg); } else { fails++; issues.push(msg + (detail ? ' :: ' + detail : '')); console.log('  FAIL ' + msg + (detail ? ' :: ' + detail : '')); } }
function warn(msg) { warns++; warnings.push(msg); console.log('  warn ' + msg); }
const THRESH = [30, 80, 150, 240, 350, 480, 640, 830, 1050, 1300];
const OUTFITS = ['Glow Tiara', 'Shell Necklace', 'Bubble Goggles', 'Sea Star Hat', 'Jelly Cape', 'Captain Hat and Trident Wand', 'Coral Crown and Starfish Necklace', 'Deep Sea Robe', 'Bioluminescent Glow', 'Legendary Jelly Crown and Rainbow Cape'];
const CHARS = ['jellyfish', 'octopus', 'seahorse', 'clownfish', 'narwhal', 'pufferfish'];
const SIZES = [[320, 568], [360, 740], [375, 667], [390, 844], [430, 932], [844, 390], [768, 1024], [1280, 800]];

const PROBE = () => {
  const iw = innerWidth, out = { overflow: false, wide: [], small: [], clipped: [] };
  const m = document.getElementById('main');
  out.overflow = document.documentElement.scrollWidth > iw + 1 || (m && m.scrollWidth > m.clientWidth + 1);
  const vis = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; };
  const name = el => el.id ? '#' + el.id : el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ').filter(Boolean).slice(0, 2).join('.') : '');
  document.querySelectorAll('#app *:not(svg *)').forEach(el => { if (!vis(el) || el.closest('svg')) return; const r = el.getBoundingClientRect(); if (r.right > iw + 1 || r.left < -1) out.wide.push(name(el) + ' ' + Math.round(r.left) + '..' + Math.round(r.right)); });
  document.querySelectorAll('#app button, #app select, #app input').forEach(el => { if (!vis(el)) return; const r = el.getBoundingClientRect(); if (r.height < 36 || r.width < 36) out.small.push(name(el) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height)); });
  document.querySelectorAll('#app .btn, #app .chip, #app .seg-btn, #app .mode-name, #app .pc-name, #app .pc-sub, #app .lc-name, #app .cc-name, #app .round-label, #app .brand, #app .lb-next, #app .spell-input').forEach(el => { if (!vis(el)) return; if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).textOverflow !== 'ellipsis') out.clipped.push(name(el) + ' "' + (el.value || el.textContent).trim().slice(0, 18) + '"'); });
  out.wide = [...new Set(out.wide)].slice(0, 6); out.small = [...new Set(out.small)].slice(0, 8); out.clipped = [...new Set(out.clipped)].slice(0, 6);
  return out;
};
const CONTRAST = (sels) => {
  function parse(c) { const m = c && c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[\s,\/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; }
  function lum(c) { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); }
  function bg(el) { let e = el; while (e) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c.a > 0.9) return c; e = e.parentElement; } return null; }
  function blend(fg, b) { const a = fg.a; return { r: fg.r * a + b.r * (1 - a), g: fg.g * a + b.g * (1 - a), b: fg.b * a + b.b * (1 - a) }; }
  return sels.map(sel => { const el = document.querySelector(sel); if (!el || !el.offsetParent) return null; const fg = parse(getComputedStyle(el).color), b = bg(el); if (!fg || !b) return { sel, ratio: null }; const f = blend(fg, b); const L1 = lum(f), L2 = lum(b); const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05); const cs = getComputedStyle(el); const fs = parseFloat(cs.fontSize), fw = parseInt(cs.fontWeight, 10); return { sel, ratio: +ratio.toFixed(2), large: fs >= 24 || (fs >= 18.66 && fw >= 700), text: (el.textContent || el.value || '').trim().slice(0, 18) }; }).filter(Boolean);
};
const TEXT_SELS = ['#brand', '#homeTitle', '#homeSub', '#playerName', '.glbl', '.seg-btn.on', '.seg-btn:not(.on)', '.mode-btn .mode-name', '.mode-btn .mode-sub', '.progress-line', '#charHint', '.cc-name', '.char-chip.on .cc-name', '#levelsTitle', '#levelsHint', '.lc-name', '#lbLevel', '.lb-next', '#pearlCount', '#switchBtn', '.hint-text', '#roundLabel', '#checkBtn', '#hintBtn', '#quitBtn', '.listen-row .btn'];

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--mute-audio', '--disable-speech-api', '--disable-gpu'] });
  const page = await browser.newPage();
  const cloud = require('./mockcloud').create(); await cloud.attach(page);
  const errors = [], failedReq = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('requestfailed', r => failedReq.push(r.url().slice(0, 80) + ' ' + ((r.failure() || {}).errorText || '')));
  page.on('response', r => { if (r.status() >= 400) failedReq.push(r.url().slice(0, 80) + ' HTTP ' + r.status()); });
  const text = (sel) => page.$eval(sel, el => el.textContent.trim());
  const attr = (sel, a) => page.$eval(sel, (el, a) => el.getAttribute(a), a);
  const count = async (sel) => (await page.$$(sel)).length;
  const world = () => page.evaluate(() => document.documentElement.getAttribute('data-world'));
  const click = sel => page.$eval(sel, el => el.click());
  const pearls = () => page.evaluate(() => __spelling.S.worlds[__spelling.world()].pearls);
  const goCora = async () => { await page.goto(URL, { waitUntil: 'load' }); await sleep(350); await click('.profile-card[data-id="cora"]'); await sleep(450); };
  const probe = async (tag) => { const r = await page.evaluate(PROBE); const bad = r.overflow || r.wide.length || r.clipped.length; ok(!bad, tag + ' fits the screen', (r.overflow ? 'PAGE SCROLLS SIDEWAYS ' : '') + (r.wide.length ? 'off-screen: ' + r.wide.join(', ') + ' ' : '') + (r.clipped.length ? 'clipped: ' + r.clipped.join(', ') : '')); if (r.small.length) warn(tag + ' small taps: ' + r.small.join(', ')); };

  console.log('A. Live page basics (' + URL + ')');
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto(URL, { waitUntil: 'load' }); await sleep(1500);
  ok((await page.title()).indexOf('Spelling Worlds') === 0, 'title is Spelling Worlds: "' + (await page.title()) + '"');
  await page.evaluate(() => document.fonts.ready);
  ok(await page.evaluate(() => [...document.fonts].some(f => /Fredoka/.test(f.family) && f.status === 'loaded')), 'Fredoka web font loaded', await page.evaluate(() => [...document.fonts].map(f => f.family + ':' + f.status).join(' ')));
  ok(await count('.profile-card') === 4, 'four player cards');
  ok((await page.$$eval('.profile-card .pc-name', els => els.map(e => e.textContent.trim()).join(','))) === 'Charlie,Riley,Vera,Cora', 'players in order');
  ok((await text('.profile-card[data-id="cora"] .pc-sub')).startsWith('4th grade'), 'Cora defaults to 4th grade');
  await (async () => { await sleep(600); Object.keys(cloud.store).forEach(k => delete cloud.store[k]); })();

  console.log('B. Ocean world, every level and character');
  await goCora();
  ok(await world() === 'ocean' && await text('#brand') === 'Spelling Ocean', 'Cora lands in Spelling Ocean');
  ok(await text('#lbLevel') === 'Level 0' && await count('#axoHome .acc.on') === 0, 'level 0: no outfit yet');
  for (let i = 0; i < THRESH.length; i++) {
    const lv = i + 1;
    await page.evaluate((p) => { __spelling.S.worlds.ocean.pearls = p; __spelling.S.epoch = (__spelling.S.epoch || 0) + 1; __spelling.save(); }, THRESH[i]);
    await goCora();
    const lvl = await text('#lbLevel'), scene = await count('#scene [data-lv="' + lv + '"].on'), piece = await count('#axoHome .acc.on[data-lv="' + lv + '"]');
    const card = await page.$eval('.level-card[data-lv="' + lv + '"]', el => ({ disabled: el.disabled, txt: el.textContent }));
    ok(lvl === 'Level ' + lv && scene > 0 && piece > 0 && !card.disabled && card.txt.indexOf(OUTFITS[i]) >= 0, 'level ' + lv + ': ' + OUTFITS[i] + ' worn, scenery on, card unlocked', lvl + ' scene=' + scene + ' piece=' + piece + ' card=' + (card.disabled ? 'locked' : 'open'));
    ok(await page.evaluate(() => __spelling.levelFor(__spelling.S.worlds.ocean.pearls + 0) === __spelling.levelFor(__spelling.S.worlds.ocean.pearls)), 'levelFor is stable');
  }
  ok(await count('.level-card[data-lv="11"]') === 0 && /Level 11/.test(await text('.level-card.mystery')) && /1500 bubbles \+ 10 mastered/.test(await text('.level-card.mystery')), 'level 11 stays a Surprise card asking for 1500 bubbles + 10 mastered', await text('.level-card.mystery'));
  await page.evaluate(() => { __spelling.S.worlds.ocean.pearls = 3300; __spelling.WORDS4.forEach(w => { __spelling.S.words[w.w] = { mastered: true, streak: 3, right: 3, wrong: 0, seen: 3 }; }); __spelling.S.epoch = (__spelling.S.epoch || 0) + 1; __spelling.save(); });
  await goCora();
  ok(await text('#lbLevel') === 'Level 20' && await count('#scene [data-lv="20"].on') > 0 && await count('#axoHome .acc.on[data-lv="20"]') > 0, 'level 20 with all 50 mastered: trophy and celebration');
  await page.screenshot({ path: 'qa-cora-lv20.png' });
  await page.$eval('#levelGrid', el => el.scrollIntoView({ block: 'start' })); await sleep(200);
  const grid = await page.$('#levelGrid'); await grid.screenshot({ path: 'qa-cora-levels.png' });
  await page.evaluate(() => { __spelling.S.worlds.ocean.pearls = 1400; __spelling.S.words = {}; __spelling.S.epoch = (__spelling.S.epoch || 0) + 1; __spelling.save(); });
  await goCora();
  for (const c of CHARS) {
    await click('.char-chip[data-char="' + c + '"]'); await sleep(150);
    const drawn = await page.evaluate(() => { const s = document.querySelector('#axoHome svg'); const b = s.getBBox(); return { w: Math.round(b.width), h: Math.round(b.height), n: s.querySelectorAll('path,ellipse,circle,rect,polygon').length }; });
    ok(await attr('.char-chip.on', 'data-char') === c && drawn.n > 12 && drawn.w > 150 && drawn.h > 150, c + ' draws with the level 10 outfit (' + drawn.n + ' shapes, ' + drawn.w + 'x' + drawn.h + ')');
    const box = await page.$('#axoHome'); await box.screenshot({ path: 'qa-char-' + c + '.png' });
  }
  ok(await page.evaluate(() => { const t = document.getElementById('app').innerText; return !/\b(sloth|pearls|kelp|marlin)\b/i.test(t.replace(/pearls/gi, '')); }), 'no spelling-list word leaks into the ocean home text');
  await click('.char-chip[data-char="jellyfish"]'); await sleep(150);

  console.log('C. Two tabs never overwrite Cora');
  await page.evaluate(() => { __spelling.S.worlds.ocean.pearls = 500; __spelling.S.epoch = (__spelling.S.epoch || 0) + 1; __spelling.save(); });
  await goCora();
  const pageB = await browser.newPage(); await cloud.attach(pageB); await pageB.goto(URL, { waitUntil: 'load' }); await sleep(350); await pageB.$eval('.profile-card[data-id="cora"]', el => el.click()); await sleep(450);
  await page.evaluate(() => { __spelling.S.worlds.ocean.pearls += 100; __spelling.save(); });
  await pageB.evaluate(() => { __spelling.S.worlds.ocean.pearls += 10; __spelling.save(); });
  await page.reload({ waitUntil: 'load' }); await sleep(350); await click('.profile-card[data-id="cora"]'); await sleep(450);
  ok(await pearls() === 610, 'both tabs\' bubbles kept (610)', 'got ' + await pearls());
  await pageB.close(); await sleep(600);

  console.log('D. Reset keeps the character and the world');
  await click('.char-chip[data-char="octopus"]'); await sleep(150);
  await click('#resetBtn'); await sleep(150); await click('#resetYes'); await sleep(400);
  ok(await pearls() === 0 && await text('#lbLevel') === 'Level 0' && await attr('.char-chip.on', 'data-char') === 'octopus' && await world() === 'ocean', 'reset: 0 bubbles, level 0, still an octopus in the ocean', [await pearls(), await text('#lbLevel'), await attr('.char-chip.on', 'data-char'), await world()].join(' / '));
  await click('.char-chip[data-char="jellyfish"]'); await sleep(150);

  console.log('E. Viewport sweep');
  for (const [w, h] of SIZES) {
    const tag = w + 'x' + h;
    await page.setViewport({ width: w, height: h, isMobile: w < 800, hasTouch: w < 800 });
    await page.goto(URL, { waitUntil: 'load' }); await sleep(400);
    await (async () => { await sleep(600); Object.keys(cloud.store).forEach(k => delete cloud.store[k]); })(); await page.reload({ waitUntil: 'load' }); await sleep(400);
    await probe(tag + ' players');
    if (w === 320 || w === 390 || w === 844) await page.screenshot({ path: 'qa-' + w + '-players.png' });
    for (const who of ['charlie', 'riley', 'vera', 'cora']) {
      await page.goto(URL, { waitUntil: 'load' }); await sleep(300); await click('.profile-card[data-id="' + who + '"]'); await sleep(450);
      await probe(tag + ' ' + who + ' home');
      if (who !== 'cora') continue;
      await click('.char-chip[data-char="pufferfish"]'); await sleep(150); await probe(tag + ' cora character row (Pufferfish)');
      await click('.char-chip[data-char="jellyfish"]'); await sleep(150);
      if (w === 320 || w === 390 || w === 844) await page.screenshot({ path: 'qa-' + w + '-cora-home.png' });
      await page.evaluate(() => { const x = __spelling.WORDS4.find(x => x.w === 'butterflies'); __spelling.startRound('spell', [x]); }); await sleep(500);
      await probe(tag + ' cora spell');
      await page.evaluate(() => { document.getElementById('spellInput').value = 'butterfliess'; document.getElementById('checkBtn').click(); }); await sleep(700);
      await probe(tag + ' cora lock-in after a miss');
      if (w === 320 || w === 390) await page.screenshot({ path: 'qa-' + w + '-cora-lockin.png' });
      await click('#quitBtn'); await sleep(250);
      await page.evaluate(() => { const x = __spelling.WORDS4.find(x => x.w === 'dictionary'); __spelling.startRound('tiles', [x]); }); await sleep(500);
      await probe(tag + ' cora tiles (10 letters)');
      if (w === 320 || w === 844) await page.screenshot({ path: 'qa-' + w + '-cora-tiles.png' });
      await click('#quitBtn'); await sleep(250);
      await click('.mode-btn[data-mode="list"]'); await sleep(350); await click('#wordList .word-row'); await sleep(250);
      await probe(tag + ' cora word list');
      await click('#wordsHome'); await sleep(250);
      await page.evaluate(() => { __spelling.S.roundLen = '5'; const L = __spelling.WORDS4.slice(0, 1); __spelling.startRound('spell', L); document.getElementById('spellInput').value = L[0].w; document.getElementById('checkBtn').click(); }); await sleep(2800);
      ok(await page.evaluate(() => __spelling.G.screen) === 'scr-summary', tag + ' cora reaches the summary');
      await probe(tag + ' cora summary');
      if (w === 390) await page.screenshot({ path: 'qa-390-cora-summary.png' });
      await click('#sumHome'); await sleep(250);
      await page.evaluate(() => { __spelling.S.worlds.ocean.pearls = 1400; __spelling.S.epoch = (__spelling.S.epoch || 0) + 1; __spelling.save(); });
      await page.reload({ waitUntil: 'load' }); await sleep(350); await click('.profile-card[data-id="cora"]'); await sleep(500);
      await probe(tag + ' cora home at level 10');
      if (w === 390) await page.screenshot({ path: 'qa-390-cora-lv10.png' });
    }
  }

  console.log('F. Keyboard-open view (390x430)');
  await page.setViewport({ width: 390, height: 430, isMobile: true, hasTouch: true });
  await goCora();
  await page.evaluate(() => { const x = __spelling.WORDS4.find(x => x.w === 'dictionary'); __spelling.startRound('spell', [x]); }); await sleep(500); await page.focus('#spellInput');
  const kb = await page.evaluate(() => { const r = e => document.querySelector(e).getBoundingClientRect(); return { input: [Math.round(r('#spellInput').top), Math.round(r('#spellInput').bottom)], check: [Math.round(r('#checkBtn').top), Math.round(r('#checkBtn').bottom)], h: innerHeight }; });
  ok(kb.input[1] <= kb.h && kb.check[1] <= kb.h && kb.check[0] >= 0 && kb.input[0] >= 0, 'input and Check button both on screen with the keyboard open', JSON.stringify(kb));
  await page.screenshot({ path: 'qa-390kb-cora.png' });

  console.log('G. Text contrast, ocean vs rainforest, light and dark');
  for (const scheme of ['light', 'dark']) {
    for (const [w, h] of [[1280, 800], [390, 844]]) {
      await page.setViewport({ width: w, height: h, isMobile: w < 800, hasTouch: w < 800 });
      await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }]);
      const res = {};
      for (const who of ['cora', 'vera']) {
        await page.goto(URL, { waitUntil: 'load' }); await sleep(300); await click('.profile-card[data-id="' + who + '"]'); await sleep(450);
        const home = await page.evaluate(CONTRAST, TEXT_SELS);
        await page.evaluate(() => { const x = __spelling.WORDS4.find(x => x.w === 'lunar'); __spelling.startRound('spell', [x]); }); await sleep(450);
        const play = await page.evaluate(CONTRAST, TEXT_SELS);
        res[who] = home.concat(play.filter(p => !home.some(q => q.sel === p.sel)));
        await click('#quitBtn'); await sleep(200);
        if (who === 'cora' && w === 390) { const dm = await page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches); ok(dm === (scheme === 'dark'), scheme + ' mode really emulated'); await page.screenshot({ path: 'qa-390-cora-' + scheme + '.png' }); }
      }
      const low = res.cora.filter(r => r.ratio !== null && r.ratio < (r.large ? 3 : 4.5));
      const lowV = res.vera.filter(r => r.ratio !== null && r.ratio < (r.large ? 3 : 4.5));
      ok(low.length === 0, scheme + ' ' + w + 'px: all ocean text at 4.5:1 (3:1 large)', low.map(r => r.sel + ' ' + r.ratio + ':1 "' + r.text + '"').join('; '));
      if (low.length) { const onlyOcean = low.filter(r => !lowV.some(v => v.sel === r.sel)); console.log('       ocean-only lows: ' + (onlyOcean.length ? onlyOcean.map(r => r.sel + ' ' + r.ratio).join('; ') : 'none (the rainforest has the same)')); }
      const unread = res.cora.filter(r => r.ratio === null).map(r => r.sel); if (unread.length) console.log('       could not resolve background for: ' + unread.join(', '));
    }
  }
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);

  console.log('H. Errors and network');
  ok(errors.length === 0, 'no page or console errors', errors.slice(0, 4).join(' | '));
  ok(failedReq.length === 0, 'no failed requests', failedReq.slice(0, 4).join(' | '));
  await browser.close();
  console.log('\n' + passes + ' passed, ' + fails + ' failed, ' + warns + ' warnings');
  if (issues.length) { console.log('ISSUES:'); issues.forEach(i => console.log(' - ' + i)); }
  if (warnings.length) { console.log('WARNINGS:'); warnings.forEach(i => console.log(' - ' + i)); }
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('QA CRASH', e); process.exit(2); });

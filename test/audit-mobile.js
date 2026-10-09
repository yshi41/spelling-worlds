/* Mobile audit: every screen and state at phone sizes (plus landscape and tablet), against the stand-in save service.
   Flags: sideways overflow, boxes past the edge, tap targets under 36px, clipped single-line text, text under 12px,
   inputs under 16px (iOS zooms on focus), and the Check button out of reach on the play screen.
     node audit-mobile.js ../index.html [--shots]                                                        */
const puppeteer = require('puppeteer-core'); const path = require('path');
const URL = 'file:///' + path.resolve(process.argv[2] || '../index.html').split(path.sep).join('/');
const SHOTS = process.argv.indexOf('--shots') >= 0;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SIZES = [[320, 568], [360, 740], [375, 667], [390, 844], [430, 932], [844, 390], [768, 1024]];
const PROBE = () => {
  const iw = innerWidth, ih = innerHeight, out = { overflow: '', wide: [], small: [], clipped: [], tiny: [], zoom: [], reach: '' };
  const m = document.getElementById('main');
  if (document.documentElement.scrollWidth > iw + 1) out.overflow = 'document ' + document.documentElement.scrollWidth;
  if (m && m.scrollWidth > m.clientWidth + 1) out.overflow = (out.overflow ? out.overflow + ', ' : '') + 'main ' + m.scrollWidth + '>' + m.clientWidth;
  const vis = el => { const r = el.getBoundingClientRect(); if (!(r.width > 0 && r.height > 0)) return false; const cs = getComputedStyle(el); return cs.visibility !== 'hidden' && cs.opacity !== '0'; };
  const name = el => (el.id ? '#' + el.id : el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ').filter(Boolean).slice(0, 2).join('.') : ''));
  const skip = el => el.closest('svg') || el.closest('.scene, .bubbles, #confetti, .banner, .toast, .float-txt, .pearl-fly, .burst, canvas');
  const scrolls = el => { for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if (o === 'auto' || o === 'scroll') return true; } return false; };
  document.querySelectorAll('#app *').forEach(el => { if (skip(el) || !vis(el) || scrolls(el)) return; const r = el.getBoundingClientRect(); if (r.right > iw + 1 || r.left < -1) out.wide.push(name(el) + ' ' + Math.round(r.left) + '..' + Math.round(r.right)); });
  document.querySelectorAll('#app button, #app a[href], #app input, #app select, #app .chip, #app .char-chip, #app .world-chip, #app .profile-card, #app .tile.pick, #app .tile.slot, #app .word-row').forEach(el => { if (skip(el) || !vis(el)) return; const r = el.getBoundingClientRect(); if (r.height < 36 || r.width < 36) out.small.push(name(el) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height)); });
  document.querySelectorAll('#app *').forEach(el => { if (skip(el) || !vis(el)) return; const cs = getComputedStyle(el); if ((cs.whiteSpace === 'nowrap' || cs.textOverflow === 'ellipsis') && el.scrollWidth > el.clientWidth + 1 && el.textContent.trim()) out.clipped.push(name(el) + ' "' + el.textContent.trim().slice(0, 24) + '"'); });
  document.querySelectorAll('#app *').forEach(el => { if (skip(el) || !vis(el)) return; const t = Array.from(el.childNodes).some(n => n.nodeType === 3 && n.textContent.trim()); if (!t) return; const fs = parseFloat(getComputedStyle(el).fontSize); if (fs < 12) out.tiny.push(name(el) + ' ' + fs.toFixed(1) + 'px'); });
  document.querySelectorAll('#app input, #app select, #app textarea').forEach(el => { if (!vis(el)) return; const fs = parseFloat(getComputedStyle(el).fontSize); if (fs < 16) out.zoom.push(name(el) + ' ' + fs.toFixed(1) + 'px'); });
  const cb = document.getElementById('checkBtn'); if (cb && vis(cb) && !cb.closest('[hidden]')) { const r = cb.getBoundingClientRect(); if (r.bottom > ih + 1 || r.top < 0) out.reach = 'Check button at ' + Math.round(r.top) + '..' + Math.round(r.bottom) + ' of ' + ih; }
  for (const k of ['wide', 'small', 'clipped', 'tiny', 'zoom']) out[k] = [...new Set(out[k])].slice(0, 8);
  return out;
};
(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--mute-audio', '--disable-speech-api', '--disable-gpu', '--allow-file-access-from-files'] });
  const page = await b.newPage(); const cloud = require('./mockcloud').create(); await cloud.attach(page); const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.evaluateOnNewDocument(() => { window.__recs = []; function Fake() { this.started = false; window.__recs.push(this); } Fake.prototype.start = function () { this.started = true; const z = this; setTimeout(() => { z.onaudiostart && z.onaudiostart({}); }, 0); }; Fake.prototype.stop = Fake.prototype.abort = function () { this.started = false; }; window.SpeechRecognition = Fake;
    window.__hear = parts => { const r = window.__recs[window.__recs.length - 1]; if (!r || !r.started) return false; const results = parts.map(p => { const a = [{ transcript: p.t, confidence: 0.9 }]; a.isFinal = !!p.f; return a; }); r.onresult({ resultIndex: 0, results }); return true; }; });
  let issues = 0, states = 0; const seen = {};
  const report = async (tag, w) => { const r = await page.evaluate(PROBE); states++;
    const parts = []; if (r.overflow) parts.push('SIDEWAYS ' + r.overflow); if (r.wide.length) parts.push('past edge: ' + r.wide.join(', ')); if (r.small.length) parts.push('small taps: ' + r.small.join(', ')); if (r.clipped.length) parts.push('clipped: ' + r.clipped.join(', ')); if (r.tiny.length) parts.push('tiny text: ' + r.tiny.join(', ')); if (r.zoom.length) parts.push('iOS zoom: ' + r.zoom.join(', ')); if (r.reach) parts.push(r.reach);
    if (parts.length) { issues++; console.log('ISSUE ' + tag + ' | ' + parts.join(' | ')); } else console.log('ok    ' + tag);
    if (SHOTS && (w === 320 || w === 390 || w === 844)) { const f = 'mob-' + tag.replace(/[^a-z0-9]+/gi, '-') + '.png'; if (!seen[f]) { seen[f] = 1; await page.screenshot({ path: f }); } } };
  const click = sel => page.$eval(sel, el => el.click());
  const word = w => page.evaluate(w => __spelling.WORDS3.concat(__spelling.WORDS4).find(x => x.w === w), w);
  const start = async (mode, w) => { await page.evaluate((mode, w) => { const x = __spelling.WORDS3.concat(__spelling.WORDS4).find(y => y.w === w); __spelling.startRound(mode, [x]); }, mode, w); await sleep(450); };
  const quit = async () => { await page.evaluate(() => document.getElementById('quitBtn').click()); await sleep(250); };
  const pick = async (id) => { await page.goto(URL, { waitUntil: 'load' }); await sleep(500); await click('.profile-card[data-id="' + id + '"]'); await sleep(500); };
  for (const [w, h] of SIZES) {
    await page.setViewport({ width: w, height: h, isMobile: w < 800, hasTouch: true }); await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
    const T = s => w + 'x' + h + ' ' + s;
    await page.goto(URL, { waitUntil: 'load' }); await sleep(500); await report(T('players'), w);
    const kids = (w === 390 || w === 320) ? ['charlie', 'riley', 'vera', 'cora', 'addie', 'amy', 'hallie'] : ['charlie', 'hallie'];
    for (const kid of kids) {
      await pick(kid); await report(T(kid + ' home'), w);
      if (kid === 'charlie' || kid === 'hallie') {
        await click('#worldBtn'); await sleep(300); await report(T(kid + ' world picker open'), w); await click('#worldCancel'); await sleep(200);
        await page.evaluate(() => { __spelling.SW().pearls = 700; __spelling.WORDS4.slice(0, 8).forEach(x => { __spelling.S.words[x.w] = { mastered: true, streak: 3, right: 3, wrong: 0, seen: 3 }; }); ['o1', 'd1', 'o12'].forEach(id => __spelling.store.act(id, 'buy')); });
        await page.$eval('.card.store', el => el.scrollIntoView({ block: 'start' })); await sleep(200);
        for (const tab of ['outfit', 'decor', 'pet']) { await click('#storeTabs .chip[data-tab="' + tab + '"]'); await sleep(200); await report(T(kid + ' store ' + tab), w); await page.evaluate(() => document.querySelectorAll('#storeGrid details').forEach(d => { d.open = true; })); await sleep(200); await report(T(kid + ' store ' + tab + ' all open'), w); }
        await page.$eval('.card.settings', el => el.scrollIntoView({ block: 'start' })); await sleep(150); await click('#resetBtn'); await sleep(200); await report(T(kid + ' settings reset confirm'), w); await click('#resetNo'); await sleep(100);
      }
    }
    await pick('charlie');
    await start('spell', 'dictionary'); await report(T('spell'), w);
    await page.evaluate(() => { document.getElementById('spellInput').value = 'dictionery'; document.getElementById('checkBtn').click(); }); await sleep(500); await report(T('spell lock-in'), w);
    await page.evaluate(() => document.getElementById('hintBtn').click()); await sleep(250); await report(T('spell lock-in hint'), w);
    await page.evaluate(() => document.getElementById('sentBtn').click()); await sleep(250); await report(T('spell sentence'), w); await quit();
    await start('tiles', 'dictionary'); await report(T('tiles'), w);
    await page.evaluate(() => { __spelling.G.tileSel = [0, 1, 2]; }); await page.evaluate(() => { const G = __spelling.G; const used = []; G.tileSel = 'dictionery'.split('').map(ch => { for (let i = 0; i < G.tileLetters.length; i++) { if (G.tileLetters[i] === ch && used.indexOf(i) < 0) { used.push(i); return i; } } return 0; }); document.getElementById('checkBtn').click(); }); await sleep(500); await report(T('tiles lock-in'), w); await quit();
    await start('say', 'dictionary'); await sleep(1200); await report(T('say listening'), w);
    await page.evaluate(() => window.__hear([{ t: 'D I C T I O N', f: true }, { t: 'A R', f: false }])); await sleep(200); await report(T('say letters'), w);
    await page.evaluate(() => document.getElementById('micBtn').click()); await sleep(200); await report(T('say review'), w);
    await page.evaluate(() => document.getElementById('checkBtn').click()); await sleep(500); await report(T('say lock-in'), w); await quit();
    await start('spell', 'kelp'); await page.evaluate(() => { document.getElementById('spellInput').value = 'kelp'; document.getElementById('checkBtn').click(); }); await sleep(2600); await report(T('summary'), w);
    await page.evaluate(() => document.getElementById('sumHome').click()); await sleep(300);
    await click('.mode-btn[data-mode="list"]'); await sleep(400); await report(T('word list'), w);
    await click('#wordList .word-row'); await sleep(300); await report(T('word list detail'), w);
    if (w === 390) { await page.setViewport({ width: 390, height: 430, isMobile: true, hasTouch: true }); await page.evaluate(() => document.getElementById('wordsHome').click()); await sleep(200); await start('spell', 'dictionary'); await sleep(300); await report('390x430 keyboard open spell', 390); await page.evaluate(() => { document.getElementById('spellInput').value = 'dictionery'; document.getElementById('checkBtn').click(); }); await sleep(500); await report('390x430 keyboard open lock-in', 390); await quit(); }
  }
  console.log('\n' + states + ' states, ' + issues + ' with issues' + (errs.length ? ', page errors: ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close(); process.exit(issues ? 1 : 0);
})();

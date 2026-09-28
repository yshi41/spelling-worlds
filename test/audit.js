const puppeteer = require('puppeteer-core'); const path = require('path');
const URL = 'file:///' + path.resolve(process.argv[2]).split(path.sep).join('/');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SIZES = [[320, 568], [360, 740], [390, 844], [430, 932], [844, 390], [768, 1024]];
const PROBE = () => {
  const iw = innerWidth, ih = innerHeight, out = { overflow: false, wide: [], small: [], clipped: [] };
  const m = document.getElementById('main');
  out.overflow = document.documentElement.scrollWidth > iw + 1 || m.scrollWidth > m.clientWidth + 1;
  const vis = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; };
  const name = el => el.id ? '#' + el.id : el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ').filter(Boolean).slice(0, 2).join('.') : '');
  document.querySelectorAll('#app *:not(svg *)').forEach(el => { if (!vis(el) || el.closest('svg')) return; const r = el.getBoundingClientRect(); if (r.right > iw + 1 || r.left < -1) out.wide.push(name(el) + ' ' + Math.round(r.left) + '..' + Math.round(r.right)); });
  document.querySelectorAll('#app button, #app select, #app input').forEach(el => { if (!vis(el)) return; const r = el.getBoundingClientRect(); if (r.height < 36 || r.width < 36) out.small.push(name(el) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height)); });
  document.querySelectorAll('#app .btn, #app .chip, #app .seg-btn, #app .mode-name, #app .pc-name, #app .lc-name, #app .cc-name, #app .round-label, #app .brand, #app .lb-next, #app .spell-input').forEach(el => { if (!vis(el)) return; if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).textOverflow !== 'ellipsis') out.clipped.push(name(el) + ' "' + (el.value || el.textContent).trim().slice(0, 18) + '"'); });
  out.wide = [...new Set(out.wide)].slice(0, 6); out.small = [...new Set(out.small)].slice(0, 8); out.clipped = [...new Set(out.clipped)].slice(0, 6);
  return out;
};
(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--mute-audio', '--disable-speech-api'] });
  const page = await b.newPage(); const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  const click = sel => page.$eval(sel, el => el.click());
  const report = async (tag) => { const r = await page.evaluate(PROBE); const bad = r.overflow || r.wide.length || r.clipped.length; console.log((bad ? 'ISSUE ' : 'ok    ') + tag + (r.overflow ? ' | PAGE SCROLLS SIDEWAYS' : '') + (r.wide.length ? ' | off-screen: ' + r.wide.join(', ') : '') + (r.clipped.length ? ' | clipped: ' + r.clipped.join(', ') : '') + (r.small.length ? ' | small taps: ' + r.small.join(', ') : '')); };
  for (const [w, h] of SIZES) {
    await page.setViewport({ width: w, height: h, isMobile: w < 800, hasTouch: true });
    await page.goto(URL, { waitUntil: 'load' }); await sleep(400);
    await page.evaluate(() => localStorage.clear()); await page.reload({ waitUntil: 'load' }); await sleep(400);
    await report(w + 'x' + h + ' players');
    for (const who of ['charlie', 'riley', 'vera']) {
      await page.goto(URL, { waitUntil: 'load' }); await sleep(300); await click('.profile-card[data-id="' + who + '"]'); await sleep(400);
      await report(w + 'x' + h + ' ' + who + ' home');
      if (who !== 'charlie') continue;
      await page.evaluate(() => { const w = __spelling.WORDS4.find(x => x.w === 'butterflies'); __spelling.startRound('spell', [w]); }); await sleep(500);
      await report(w + 'x' + h + ' spell');
      await page.evaluate(() => { document.getElementById('spellInput').value = 'butterfliess'; document.getElementById('checkBtn').click(); }); await sleep(600);
      await report(w + 'x' + h + ' lock-in after a miss');
      if (w === 320) await page.screenshot({ path: 'm320-lockin.png' });
      await click('#quitBtn'); await sleep(200);
      await page.evaluate(() => { const w = __spelling.WORDS4.find(x => x.w === 'butterflies'); __spelling.startRound('tiles', [w]); }); await sleep(500);
      await report(w + 'x' + h + ' tiles (11 letters)');
      if (w === 320 || w === 844) await page.screenshot({ path: 'm' + w + '-tiles.png' });
      await click('#quitBtn'); await sleep(200); await click('.mode-btn[data-mode="list"]'); await sleep(300); await click('#wordList .word-row'); await sleep(200);
      await report(w + 'x' + h + ' word list');
      await click('#wordsHome'); await sleep(200);
      await page.evaluate(() => { __spelling.S.roundLen = '5'; const L = __spelling.WORDS4.slice(0, 1); __spelling.startRound('spell', L); document.getElementById('spellInput').value = L[0].w; document.getElementById('checkBtn').click(); }); await sleep(2600);
      await report(w + 'x' + h + ' summary');
      await click('#sumHome'); await sleep(200);
    }
  }
  await page.setViewport({ width: 390, height: 430, isMobile: true, hasTouch: true });
  await page.goto(URL, { waitUntil: 'load' }); await sleep(300); await click('.profile-card[data-id="vera"]'); await sleep(300);
  await page.evaluate(() => { const w = __spelling.WORDS4.find(x => x.w === 'dictionary'); __spelling.startRound('spell', [w]); }); await sleep(500); await page.focus('#spellInput');
  const kb = await page.evaluate(() => { const r = e => document.querySelector(e).getBoundingClientRect(); return { input: [Math.round(r('#spellInput').top), Math.round(r('#spellInput').bottom)], check: [Math.round(r('#checkBtn').top), Math.round(r('#checkBtn').bottom)], h: innerHeight }; });
  console.log('keyboard view 390x430 vera: input ' + kb.input + ' check ' + kb.check + ' of ' + kb.h);
  await page.screenshot({ path: 'm390kb-vera.png' });
  console.log('page errors: ' + (errs.length ? errs.slice(0, 3).join(' | ') : 'none'));
  await b.close();
})();

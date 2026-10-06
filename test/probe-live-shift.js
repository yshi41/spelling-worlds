/* hover every player tile on the published site (real web fonts) and report any box that moves, right after the hover and once fonts have loaded:
   node probe-live-shift.js [url] */
const puppeteer = require('puppeteer-core'); const sleep = ms => new Promise(r => setTimeout(r, ms));
const URL = process.argv[2] || 'https://yshi41.github.io/spelling-worlds/';
(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--mute-audio', '--disable-speech-api', '--disable-gpu'] });
  const page = await b.newPage(); const cloud = require('./mockcloud').create(); await cloud.attach(page);
  let bad = 0;
  for (const [w, h] of [[1280, 1400], [390, 1400]]) {
    await page.setViewport({ width: w, height: h }); await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
    await page.goto(URL + (URL.indexOf('?') < 0 ? '?' : '&') + 'p=' + Date.now(), { waitUntil: 'load' }); await sleep(1500); await page.evaluate(() => document.fonts.ready);
    const snap = () => page.evaluate(() => { const o = {}; let i = 0; document.querySelectorAll('header *, #scr-profiles, #scr-profiles *').forEach(e => { if (e.closest('svg') && e.tagName !== 'svg') return; const r = e.getBoundingClientRect(); if (r.width || r.height) o[(e.id ? '#' + e.id : e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.split(' ')[0] : '')) + '@' + (i++)] = [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)].join(','); }); return o; });
    const base = await snap();
    for (const id of await page.$$eval('.profile-card', els => els.map(e => e.getAttribute('data-id')))) {
      await page.hover('.profile-card[data-id="' + id + '"]'); await sleep(120); const early = await snap(); await sleep(900); const late = await snap();
      const diff = Object.keys(base).filter(k => k.indexOf('#brand@') !== 0 && (late[k] !== base[k] || early[k] !== base[k])).map(k => k + ' ' + base[k] + ' -> ' + late[k] + (early[k] !== late[k] ? ' (early ' + early[k] + ')' : ''));
      if (diff.length) bad++; console.log(w + ' hover ' + id + ': ' + (diff.length ? diff.slice(0, 8).join(' | ') : 'no shift'));
      await page.mouse.move(4, 700); await sleep(250);
    }
    console.log(w + ' fonts: ' + await page.evaluate(() => Array.from(document.fonts).filter(f => f.status === 'loaded').map(f => f.family).filter((v, i, a) => a.indexOf(v) === i).join(', ')));
  }
  console.log(bad ? 'SHIFTS: ' + bad : 'ALL STEADY'); await b.close();
})();

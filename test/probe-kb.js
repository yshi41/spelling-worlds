/* the Spell It keyboard at phone sizes: node probe-kb.js ../index.html  (saves kb-<w>x<h>.png, prints key sizes) */
const puppeteer = require('puppeteer-core'); const path = require('path');
const URL = 'file:///' + path.resolve(process.argv[2] || '../index.html').split(path.sep).join('/');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--mute-audio', '--disable-speech-api', '--disable-gpu', '--allow-file-access-from-files'] });
  const page = await browser.newPage(); const cloud = require('./mockcloud').create(); await cloud.attach(page);
  page.on('pageerror', e => console.log('pageerror', e.message));
  for (const [w, h, scheme] of [[320, 568, 'light'], [390, 844, 'dark'], [844, 390, 'light'], [768, 1024, 'light'], [1200, 900, 'light']]) {
    await page.setViewport({ width: w, height: h, isMobile: w < 800, hasTouch: w <= 1024 }); await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }]);
    await page.goto(URL, { waitUntil: 'load' }); await sleep(600);
    await page.evaluate(() => { __spelling.selectProfile('riley'); }); await sleep(400);
    await page.evaluate(() => { const x = __spelling.WORDS4.find(y => y.w === 'kelp'); __spelling.startRound('spell', [x]); }); await sleep(500);
    await page.evaluate(() => { ['k', 'e'].forEach(k => __spelling.kb.tap(k)); });
    const r = await page.evaluate(() => { const kb = document.getElementById('kb'), keys = Array.from(document.querySelectorAll('#kb .kb-key')); const ws = keys.map(k => Math.round(k.getBoundingClientRect().width)), hs = keys.map(k => Math.round(k.getBoundingClientRect().height));
      const cb = document.getElementById('checkBtn').getBoundingClientRect(); return { shown: !kb.hidden, want: __spelling.kb.want(), inputmode: document.getElementById('spellInput').getAttribute('inputmode'), keyW: Math.min(...ws) + '-' + Math.max(...ws), keyH: Math.min(...hs) + '-' + Math.max(...hs), kbBottom: Math.round(kb.getBoundingClientRect().bottom), check: Math.round(cb.top) + '..' + Math.round(cb.bottom), vh: innerHeight }; });
    console.log(w + 'x' + h + ': ' + JSON.stringify(r));
    await page.screenshot({ path: 'kb-' + w + 'x' + h + '.png' });
  }
  await browser.close(); console.log('done');
})();

/* the store tabs at phone widths: node probe-tabs.js ../index.html  (fails if a name or sub-line is wider than its tab) */
const puppeteer = require('puppeteer-core'); const path = require('path');
const URL = 'file:///' + path.resolve(process.argv[2] || '../index.html').split(path.sep).join('/');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--mute-audio', '--disable-speech-api', '--disable-gpu', '--allow-file-access-from-files'] });
  const page = await browser.newPage(); const cloud = require('./mockcloud').create(); await cloud.attach(page);
  let bad = 0;
  for (const w of [320, 360, 375, 390, 430, 768, 1200]) {
    await page.setViewport({ width: w, height: 844 }); await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
    await page.goto(URL, { waitUntil: 'load' }); await sleep(500);
    await page.evaluate(() => { __spelling.selectProfile('riley'); }); await sleep(400);
    await page.evaluate(() => document.fonts.ready); await sleep(100);
    const r = await page.evaluate(() => Array.from(document.querySelectorAll('#storeTabs .chip')).map(b => {
      const br = b.getBoundingClientRect(); const over = [];
      b.querySelectorAll('.st-name,.st-sub').forEach(s => { const sr = s.getBoundingClientRect(); if (sr.left < br.left - 0.5 || sr.right > br.right + 0.5 || s.scrollWidth > b.clientWidth + 0.5) over.push(s.className + ' ' + Math.round(sr.width) + '>' + Math.round(br.width)); });
      const name = b.querySelector('.st-name').getBoundingClientRect();
      return { tab: b.getAttribute('data-tab'), w: Math.round(br.width), h: Math.round(br.height), nameTop: Math.round(name.top - br.top), font: getComputedStyle(b.querySelector('.st-name')).fontSize, over, bar: Math.round(document.getElementById('storeTabs').getBoundingClientRect().right), vw: innerWidth };
    }));
    const tops = new Set(r.map(x => x.nameTop)), hs = new Set(r.map(x => x.h));
    const issues = r.flatMap(x => x.over).concat(tops.size > 1 ? ['names not level: ' + r.map(x => x.nameTop).join('/')] : [], hs.size > 1 ? ['heights differ: ' + r.map(x => x.h).join('/')] : [], r[0].bar > r[0].vw ? ['bar past the edge'] : []);
    if (issues.length) bad++;
    console.log(w + 'px: ' + r.map(x => x.tab + ' ' + x.w + 'x' + x.h + ' ' + x.font).join(' | ') + (issues.length ? '  ISSUES: ' + issues.join('; ') : '  ok'));
    if (w === 320 || w === 390) { await page.$eval('.card.store', el => el.scrollIntoView({ block: 'start' })); await sleep(200); const card = await page.$('.card.store'); await card.screenshot({ path: 'tabs-' + w + '.png' }); }
  }
  await browser.close(); console.log(bad ? 'FAIL ' + bad + ' widths' : 'ALL OK');
})();

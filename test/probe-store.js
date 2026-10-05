/* screenshots of the Reward Store tabs: node probe-store.js ../index.html */
const puppeteer = require('puppeteer-core'); const path = require('path');
const URL = 'file:///' + path.resolve(process.argv[2] || '../index.html').split(path.sep).join('/');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--mute-audio', '--disable-speech-api', '--disable-gpu', '--allow-file-access-from-files'] });
  const page = await browser.newPage(); const cloud = require('./mockcloud').create(); await cloud.attach(page);
  page.on('pageerror', e => console.log('pageerror', e.message));
  for (const [w, h, name, scheme] of [[1200, 900, 'desk', 'light'], [390, 844, 'phone', 'dark']]) {
    await page.setViewport({ width: w, height: h }); await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }]);
    await page.goto(URL, { waitUntil: 'load' }); await sleep(600);
    await page.evaluate(() => { __spelling.selectProfile('riley'); const S = __spelling.S; __spelling.SW().pearls = 420; __spelling.WORDS3.slice(0, 9).forEach(x => { S.words[x.w] = { mastered: true, streak: 3, right: 3, wrong: 0, seen: 3 }; }); __spelling.store.act('o1', 'buy'); __spelling.store.act('o3', 'buy'); __spelling.store.act('d2', 'buy'); __spelling.store.act('o12', 'buy'); __spelling.store.act('o21', 'buy'); __spelling.save(); __spelling.selectProfile('riley'); });
    await sleep(400);
    for (const tab of ['outfit', 'decor', 'pet']) {
      await page.evaluate(t => { document.querySelector('#storeTabs .chip[data-tab="' + t + '"]').click(); }, tab); await sleep(200);
      await page.$eval('.card.store', el => el.scrollIntoView({ block: 'start' })); await sleep(250);
      const card = await page.$('.card.store'); await card.screenshot({ path: 'store-' + name + '-' + tab + '.png' });
    }
    await page.$eval('#axoHome', el => el.scrollIntoView({ block: 'center' })); await sleep(200);
    await page.screenshot({ path: 'store-' + name + '-mascot.png' });
  }
  await browser.close(); console.log('done');
})();

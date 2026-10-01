const puppeteer = require('puppeteer-core'); const path = require('path');
const URL = 'file:///' + path.resolve('../index.html').split(path.sep).join('/');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--mute-audio','--disable-speech-api','--disable-gpu'] });
  const page = await b.newPage(); const cloud = require('./mockcloud').create(); await cloud.attach(page);
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto(URL, { waitUntil: 'load' }); await sleep(1500);
  const m = () => page.evaluate(() => [...document.querySelectorAll('.profile-card')].map(c => { const r = c.getBoundingClientRect(), s = c.querySelector('svg').getBoundingClientRect(); return c.dataset.id + ' ' + Math.round(r.width) + 'x' + Math.round(r.height) + ' svg ' + Math.round(s.width) + 'x' + Math.round(s.height) + ' world=' + document.documentElement.getAttribute('data-world'); }));
  console.log('rest', await m());
  for (const id of ['charlie','riley','vera']) { await page.hover('.profile-card[data-id="'+id+'"]'); await sleep(900); console.log('hover '+id, await m()); await page.screenshot({ path: 'hover-'+id+'.png' }); }
  await b.close();
})();

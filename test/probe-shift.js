const puppeteer = require('puppeteer-core'); const path = require('path');
const URL = process.argv[2] ? 'file:///' + path.resolve(process.argv[2]).split(path.sep).join('/') : 'file:///' + path.resolve('../index.html').split(path.sep).join('/');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--mute-audio','--disable-speech-api','--disable-gpu'] });
  const page = await b.newPage(); const cloud = require('./mockcloud').create(); await cloud.attach(page);
  let bad = 0;
  for (const [w,h] of [[1280,1400],[390,1400]]) {
    await page.setViewport({ width: w, height: h });
    await page.goto(URL, { waitUntil: 'load' }); await sleep(1500);
    const snap = () => page.evaluate(() => { const o = {}; let i = 0; document.querySelectorAll('header *, #scr-profiles, #scr-profiles *').forEach(e => { if (e.closest('svg') && e.tagName !== 'svg') return; const r = e.getBoundingClientRect(); if (!r.width) return; const k = (e.id ? '#' + e.id : e.tagName.toLowerCase() + '.' + (typeof e.className === 'string' ? e.className.split(' ')[0] : '')) + '@' + (i++); o[k] = [r.left, r.top, r.width, r.height].map(Math.round).join(','); }); return o; });
    const base = await snap();
    for (const id of ['charlie','riley','vera','cora','addie','amy','hallie']) {
      await page.hover('.profile-card[data-id="'+id+'"]'); await sleep(900);
      const s = await snap(); const diff = Object.keys(base).filter(k => s[k] !== base[k]).map(k => k + ' ' + base[k] + ' -> ' + s[k]);
      if (diff.length) bad++;
      console.log(w + ' hover ' + id + ': ' + (diff.length ? diff.slice(0, 8).join(' | ') : 'no shift'));
      await page.mouse.move(1, h - 1); await sleep(400);
    }
  }
  console.log(bad ? 'SHIFTS: ' + bad : 'ALL STEADY'); await b.close();
})();

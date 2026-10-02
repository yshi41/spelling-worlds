/* screenshots of the Say It screen with a fake microphone: node probe-say.js ../index.html */
const puppeteer = require('puppeteer-core'); const path = require('path');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = 'file:///' + path.resolve(process.argv[2] || '../index.html').split(path.sep).join('/');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--mute-audio', '--disable-speech-api', '--disable-gpu'] });
  const page = await browser.newPage(); const cloud = require('./mockcloud').create(); await cloud.attach(page);
  await page.evaluateOnNewDocument(() => { window.__recs = []; function Fake() { this.started = false; window.__recs.push(this); } Fake.prototype.start = function () { this.started = true; const z = this; setTimeout(() => { z.onaudiostart && z.onaudiostart({}); }, 0); }; Fake.prototype.stop = Fake.prototype.abort = function () { this.started = false; }; window.SpeechRecognition = Fake;
    window.__hear = parts => { const r = window.__recs[window.__recs.length - 1]; const results = parts.map(p => { const a = [{ transcript: p.t, confidence: 0.9 }]; a.isFinal = !!p.f; return a; }); r.onresult({ resultIndex: 0, results }); }; });
  for (const [w, h, name, scheme] of [[1200, 900, 'desk', 'light'], [390, 844, 'phone', 'dark'], [320, 640, 'small', 'light']]) {
    await page.setViewport({ width: w, height: h }); await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }]);
    await page.goto(URL, { waitUntil: 'load' }); await sleep(600);
    await page.click('.profile-card[data-id="riley"]'); await sleep(500);
    await page.screenshot({ path: 'say-' + name + '-home.png' });
    await page.evaluate(() => { const w = __spelling.WORDS3.find(x => x.w === 'bamboo'); __spelling.startRound('say', [w]); }); await sleep(400);
    await page.screenshot({ path: 'say-' + name + '-idle.png' });
    await page.click('#micBtn'); await sleep(100); await page.evaluate(() => window.__hear([{ t: 'B A M', f: true }, { t: 'B', f: false }])); await sleep(300);
    await page.screenshot({ path: 'say-' + name + '-listening.png' });
    await page.evaluate(() => window.__hear([{ t: 'B A M B O O', f: true }])); await sleep(100); await page.click('#micBtn'); await sleep(400);
    await page.evaluate(() => { const b = document.getElementById('checkBtn'); b.scrollIntoView({ block: 'end' }); }); await sleep(200);
    await page.screenshot({ path: 'say-' + name + '-review.png' });
  }
  await browser.close(); console.log('done');
})();

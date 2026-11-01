const test = require('node:test');
const assert = require('node:assert/strict');
const {device, chromium} = require('./audit-browser-helper.cjs');
const source = require('./fixtures/surah-1-uthmani.json');
let browser;
test.before(async () => { browser = await chromium.launch(); });
test.after(async () => { await browser.close(); });
async function review(fn, payload = source) {
  const d = await device(browser);
  try {
    await d.p.locator('a[data-app-view="iman"]').click();
    await d.p.evaluate(payload => {
      audit.hifzUpsertSegment({id:'text-check',surahN:payload.data.number,from:1,to:payload.data.numberOfAyahs,status:'memorized',reviewCount:0,intervalDays:1,nextReviewDate:'2020-01-01'});
      document.getElementById('hifzOnboardDone').click();
      window.fetch = async () => ({ok:true,json:async()=>payload});
    }, payload);
    await d.p.locator('#hifzClose').click();
    await fn(d.p);
    assert.deepEqual(d.errors, []);
  } finally { await d.c.close(); }
}
test('hifz preserves every source mark and renders with loaded Quran font', () => review(async p => {
  await p.evaluate(() => document.getElementById('hifzAlertBanner').click());
  await p.locator('#hifzRecallText').waitFor({state:'visible'});
  await p.locator('#hifzRevealBtn').click();
  assert.deepEqual(await p.locator('#hifzRecallText .hifz-ayah').evaluateAll(es=>es.map(e=>e.firstChild.textContent.slice(0,-1))), source.data.ayahs.map(a=>a.text));
  assert.match(await p.locator('#hifzRecallText').evaluate(e=>getComputedStyle(e).fontFamily), /Amiri Quran/);
  assert.equal(await p.evaluate(()=>document.fonts.check('24px "Amiri Quran"')), true);
}));
test('hifz refuses to display Quran in fallback font after font download failure', () => review(async p => {
  await p.route('**/fonts/AmiriQuran-Regular.woff2', r=>r.abort());
  await p.evaluate(() => document.getElementById('hifzAlertBanner').click());
  await p.waitForFunction(()=>document.getElementById('hifzRecallLoading').hidden);
  assert.equal(await p.locator('#hifzRecallText').isVisible(), false);
  assert.equal(await p.locator('#hifzRecallFallback').isVisible(), true);
}));

test('Al-Fajr preserves Uthmani marks and verse order in the reported passage', () => review(async p => {
  await p.evaluate(() => document.getElementById('hifzAlertBanner').click());
  await p.locator('#hifzRecallText').waitFor({state:'visible'});
  await p.locator('#hifzRevealBtn').click();
  const fixture = require('./fixtures/surah-89-uthmani.json');
  assert.deepEqual(await p.locator('#hifzRecallText .hifz-ayah').evaluateAll(es=>es.map(e=>e.firstChild.textContent.slice(0,-1))), fixture.data.ayahs.map(a=>a.text));
  assert.match(await p.locator('#hifzRecallText').evaluate(e=>getComputedStyle(e).fontFamily), /Amiri Quran/);
  assert.equal(await p.locator('#hifzRecallText .hifz-ayah-num').nth(22).textContent(), '٢٣');
}, require('./fixtures/surah-89-uthmani.json')));

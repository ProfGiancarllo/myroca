const { chromium } = require('playwright');
const ok = (n, c, x='') => console.log((c ? 'OK   ' : 'FALHA') + ' | ' + n + (x ? ' | ' + x : ''));
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 800 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route('**/api.open-meteo.com/**', r => r.abort()); await p.route('**/power.larc.nasa.gov/**', r => r.abort()); await p.route('**/server.arcgisonline.com/**', r => r.abort());
  await p.addInitScript(() => { try { localStorage.setItem('myroca_language','pt'); } catch(e){} });
  await p.goto('http://127.0.0.1:3111/?intro=0'); await p.waitForTimeout(800);
  await p.click('.auth-tabs button[data-mode=signup]');
  await p.fill('#a-name','Produtor Teste'); await p.fill('#a-email','demo@example.com'); await p.fill('#a-farm','Fazenda Demo'); await p.fill('#a-city','Rio Verde/GO');
  await p.fill('#a-pw','demo12345'); await p.fill('#a-pw2','demo12345'); await p.check('#a-consent'); await p.click('#auth-submit'); await p.waitForTimeout(2500);
  await p.evaluate(() => { const uid = Object.keys(localStorage).find(x => x.startsWith('myroca_farm_data_rio_verde_rural_v3:')); localStorage.setItem('myroca_avatar_prompted_v1:' + uid.split(':')[1], '1'); });
  await p.reload(); await p.waitForTimeout(2500);
  await p.screenshot({ path: process.env.S + '/m-home.png' });
  await p.click('#sh-h-sw'); await p.waitForTimeout(900);
  await p.screenshot({ path: process.env.S + '/m-switch.png' });
  // escolhe um talhão em ciclo (soja) e adota a melhor opção
  await p.evaluate(() => { const s = document.getElementById('rot-talhao'); const o = [...s.options].find(x => /Talhão 01/.test(x.text)); s.value = o.value; s.dispatchEvent(new Event('change')); }); await p.waitForTimeout(500);
  await p.click('.sf-row.best .sf-adopt'); await p.waitForTimeout(600);
  await p.click('[data-tab=current]'); await p.waitForTimeout(500);
  const row = await p.locator('.sf-trow', { hasText: 'Talhão 01' }).first().innerText();
  ok('Adotar pelo ranking cria a próxima safra e aparece na linha do tempo', /Próxima:/.test(row), row.replace(/\s+/g,' ').slice(0,140));
  await p.screenshot({ path: process.env.S + '/m-current.png' });
  ok('Sem erros de JS', errs.length === 0, errs.join('|'));
  await b.close();
})();

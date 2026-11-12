const { chromium } = require('playwright');
const ok = (n, c, extra='') => console.log((c ? 'OK   ' : 'FALHA') + ' | ' + n + (extra ? ' | ' + extra : ''));
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1366, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route('**/api.open-meteo.com/**', r => r.abort());
  await p.route('**/power.larc.nasa.gov/**', r => r.abort());
  await p.addInitScript(() => { try { if (!sessionStorage.getItem('lg')) { localStorage.setItem('myroca_language','pt'); } } catch(e){} });
  await p.goto('http://127.0.0.1:3111/?intro=0'); await p.waitForTimeout(800);
  await p.click('.auth-tabs button[data-mode=signup]');
  await p.fill('#a-name','Produtor Teste'); await p.fill('#a-email','demo@example.com'); await p.fill('#a-farm','Fazenda Demo'); await p.fill('#a-city','Rio Verde/GO');
  await p.fill('#a-pw','demo12345'); await p.fill('#a-pw2','demo12345'); await p.check('#a-consent'); await p.click('#auth-submit'); await p.waitForTimeout(2500);
  await p.evaluate(() => { const uid = Object.keys(localStorage).find(x => x.startsWith('myroca_farm_data_rio_verde_rural_v3:')); localStorage.setItem('myroca_avatar_prompted_v1:' + uid.split(':')[1], '1'); });
  await p.reload(); await p.waitForTimeout(2500);
  const openPlanner = async () => { await p.evaluate(() => document.getElementById('btn-rotation')?.click()); await p.waitForTimeout(900); await p.click('[data-tab=switch]'); await p.waitForTimeout(500); await p.click('.sf-details > summary'); await p.waitForTimeout(300); };
  await openPlanner();
  const t = async (s) => (await p.innerText(s)).replace(/\s+/g,' ');
  ok('1 Painel de mercado aparece com selo de exemplo', /Dados de exemplo/.test(await t('.mk-panel')));
  ok('2 Banner de decisão combinada', /Decisão combinada/.test(await t('.mk-decision')), (await t('.mk-decision')).slice(0,200));
  const cards = await p.locator('.mk-margin').count(); ok('3 Margem em cada estratégia', cards >= 2, 'cartões=' + cards);
  ok('4 Um cartão marcado como melhor margem', await p.locator('.mk-margin.best').count() === 1);
  const before = await t('.mk-decision');
  await p.screenshot({ path: process.env.S + '/mercado1.png' });
  // edita preço da soja
  await p.fill('input[data-mk=price][data-crop=soja]', '60'); await p.press('input[data-mk=price][data-crop=soja]', 'Tab'); await p.waitForTimeout(400);
  const after = await t('.mk-decision');
  ok('5 Preço digitado muda a decisão/margem', before !== after, after.slice(0,200));
  ok('6 Campo editado destacado e botão restaurar', await p.locator('.mk-in.edited').count() >= 1 && await p.locator('.mk-reset').count() === 1);
  // estresse
  await p.evaluate(() => { const r = document.getElementById('mk-stress'); r.value = '-30'; r.dispatchEvent(new Event('change')); }); await p.waitForTimeout(400);
  ok('7 Teste de queda de preço aplicado', /-30%/.test(await t('#mk-stress-val')) && /prejuízo/.test(await t('.rot-grid')), (await t('#mk-stress-val')));
  await p.screenshot({ path: process.env.S + '/mercado2.png' });
  await p.click('.mk-reset'); await p.waitForTimeout(300);
  ok('8 Restaurar limpa edições', await p.locator('.mk-in.edited').count() === 0);
  // idiomas
  for (const [code, re] of [['en',/Market and estimated margin/],['es',/Mercado y margen/],['de',/Markt und/],['zh',/市场/],['fr',/Marché et marge/]]) {
    await p.evaluate((c) => { sessionStorage.setItem('lg','1'); localStorage.setItem('myroca_language', c); }, code);
    await p.reload(); await p.waitForTimeout(2200);
    await openPlanner();
    ok('Idioma ' + code, re.test(await t('.mk-panel')) && /R\$/.test(await t('.mk-margin')), (await t('.mk-decision')).slice(0,110));
    if (code === 'zh') await p.screenshot({ path: process.env.S + '/mercado-zh.png' });
    await p.evaluate(() => document.querySelector('.rot-x')?.click());
  }
  ok('9 Sem erros de JS', errs.length === 0, errs.join(' | '));
  await b.close();
})();

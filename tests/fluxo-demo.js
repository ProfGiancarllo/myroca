const { chromium } = require('playwright');
const ok = (n, c, extra='') => console.log((c ? 'OK   ' : 'FALHA') + ' | ' + n + (extra ? ' | ' + extra : ''));
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1366, height: 800 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route('**/api.open-meteo.com/**', r => r.abort());
  await p.route('**/power.larc.nasa.gov/**', r => r.abort());
  await p.goto('http://127.0.0.1:3111/?intro=0'); await p.waitForTimeout(800);
  // 1. Cadastro
  await p.click('.auth-tabs button[data-mode=signup]');
  await p.fill('#a-name','Produtor Teste'); await p.fill('#a-email','demo@example.com'); await p.fill('#a-farm','Fazenda Demo'); await p.fill('#a-city','Rio Verde/GO');
  await p.fill('#a-pw','demo12345'); await p.fill('#a-pw2','demo12345'); await p.check('#a-consent'); await p.click('#auth-submit'); await p.waitForTimeout(2500);
  ok('1 Cadastro leva à tela Hoje', await p.isVisible('#simple-home'));
  // prepara pendências (talhão sem cultivar e sem data de plantio)
  await p.evaluate(() => {
    const uid = Object.keys(localStorage).find(x => x.startsWith('myroca_farm_data_rio_verde_rural_v3:'));
    localStorage.setItem('myroca_avatar_prompted_v1:' + uid.split(':')[1], '1');
    const d = JSON.parse(localStorage.getItem(uid)); d.talhoes[0].cultivar = ''; d.talhoes[1].plantingDate = ''; localStorage.setItem(uid, JSON.stringify(d));
  });
  await p.reload(); await p.waitForTimeout(2500);
  const txt = async (s) => (await p.innerText(s)).replace(/\s+/g, ' ');
  ok('2 Tela Hoje mostra pendências da Estrela', /2|3/.test(await txt('.sh-todo')), await txt('.sh-todo'));
  ok('3 Data de hoje correta', /12/.test(await txt('.sh-date')), await txt('.sh-date'));
  // 4. Clima: corrigir para chuva
  await p.click('#sh-fix'); await p.click('[data-wx=rain]'); await p.waitForTimeout(600);
  ok('4 Correção do clima muda o conselho', /defensiv|spraying|aplicar|appliquer|spritzen/i.test(await txt('#sh-weather')), (await txt('#sh-weather')).slice(0,120));
  await p.click('#sh-fix'); await p.click('#sh-auto'); await p.waitForTimeout(400);
  // 5. Responder pendências
  await p.click('#sh-typed'); await p.waitForTimeout(500);
  const send = async (q) => { await p.fill('#estela-input', q); await p.press('#estela-input', 'Enter'); await p.waitForTimeout(500); const y = await p.$('.estela-actions button >> nth=0'); return y; };
  const conf = async () => { const y = p.locator('.estela-actions button', { hasText: /Confirm|Confirmar/ }).last(); if (await y.count()) { await y.click(); await p.waitForTimeout(500); } };
  await send('5 de outubro'); await conf();
  await send('DM 54i52 RSF'); await conf();
  let list = await txt('#estela-list'); console.log('LIST>', list.slice(-500));
  ok('5 Estrela perguntou e gravou plantio e cultivar', /Saved|Gravado/.test(list) );
  await send('sem novidades'); await conf();
  await send('sem novidades'); await conf();
  await p.click('#estela-close'); await p.waitForTimeout(800);
  ok('6 Pendências zeradas na tela Hoje', /Tudo em dia|All up to date/.test(await txt('.sh-todo')), await txt('.sh-todo'));
  // 7. Registrar chuva
  await p.click('[data-rec=chuva]'); await p.waitForTimeout(400);
  await p.locator('.estela-actions button').last().click(); await p.waitForTimeout(300);
  await p.fill('#estela-input', '22'); await p.press('#estela-input', 'Enter'); await p.waitForTimeout(400); await conf();
  ok('7 Registro de chuva 22 mm gravado', /22/.test(await txt('#estela-list')) && /(Logged|Registrado)/i.test(await txt('#estela-list')));
  await p.click('#estela-close');
  // 8. Planejar safra
  await p.click('#sh-plan'); await p.waitForTimeout(1200);
  const rot = await p.$('.rot-card .sf-tabs');
  ok('8 Planejador de safra abre', !!rot);
  await p.screenshot({ path: 'flow_rot.png' });
  await p.click('.rot-x'); await p.waitForTimeout(400);
  // 9. Ver a fazenda
  await p.click('#sh-full'); await p.waitForTimeout(1200);
  await p.evaluate(() => document.getElementById('btn-mode-fazenda')?.click()); await p.waitForTimeout(2500);
  ok('9 Fazenda 2.5D abre com chip de clima', await p.isVisible('#weather-chip'));
  await p.screenshot({ path: 'flow_farm.png' });
  await p.click('#btn-game-more'); ok('10 Menu ⋯ mostra mover/avatar', await p.isVisible('#btn-game-move-mode'));
  await p.click('#simple-pill'); await p.waitForTimeout(500);
  ok('11 Volta ao modo Simples', await p.isVisible('#simple-home'));
  ok('12 Sem erros de JavaScript', errs.length === 0, errs.join(' ; ').slice(0,200));
  await b.close();
})();

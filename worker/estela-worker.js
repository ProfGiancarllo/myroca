// Intermediário da Estela (Cloudflare Worker). A chave da Anthropic fica SÓ aqui, como segredo.
// Segredos/variáveis: ANTHROPIC_API_KEY (segredo), ALLOWED_ORIGIN (ex.: https://seusite.com), MODEL (opcional)
const MAX_PER_IP_PER_DAY = 40;
const hits = new Map(); // limite simples por IP (reinicia quando o worker reinicia)

export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin') || '';
    const allow = env.ALLOWED_ORIGIN || '*';
    const cors = {
      'Access-Control-Allow-Origin': allow === '*' ? '*' : allow,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (req.method !== 'POST') return new Response('ok', { headers: cors });
    if (allow !== '*' && origin !== allow) return new Response('forbidden', { status: 403, headers: cors });

    const ip = req.headers.get('CF-Connecting-IP') || 'x';
    const day = new Date().toISOString().slice(0, 10);
    const key = ip + day;
    const n = (hits.get(key) || 0) + 1;
    hits.set(key, n);
    if (n > MAX_PER_IP_PER_DAY) return json({ answer: 'Limite diário de perguntas atingido. Tente amanhã.' }, cors);

    let body;
    try { body = await req.json(); } catch { return json({ answer: '' }, cors, 400); }
    const question = String(body.question || '').slice(0, 800);
    const ctx = JSON.stringify(body.context || {}).slice(0, 4000);
    if (!question) return json({ answer: '' }, cors, 400);

    const system =
      'Você é a Estela, engenheira agrônoma virtual do app MyRoça (Rio Verde-GO). ' +
      'Responda de forma curta, simples e prática para o produtor rural, no idioma da pergunta. ' +
      'Use os dados da fazenda fornecidos. Não invente números; se não souber, diga que falta informação ' +
      'e sugira consultar o agrônomo responsável. Não dê receita de defensivos nem dose.';
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: env.MODEL || 'claude-haiku-4-5',
        max_tokens: 400,
        system,
        messages: [{ role: 'user', content: `Dados da fazenda: ${ctx}\n\nPergunta: ${question}` }],
      }),
    });
    if (!r.ok) return json({ answer: '' }, cors, 502);
    const j = await r.json();
    const answer = (j.content || []).map((c) => c.text || '').join('').trim();
    return json({ answer }, cors);
  },
};

function json(o, cors, status = 200) {
  return new Response(JSON.stringify(o), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

// Intermediário da Estrela (Cloudflare Worker). As chaves ficam SÓ aqui, como segredos.
// Segredos/variáveis:
//   ANTHROPIC_API_KEY (segredo)  respostas da Estrela (rota /)
//   OPENAI_API_KEY    (segredo)  voz natural da Estrela (rota /tts)
//   ALLOWED_ORIGIN               ex.: https://seusite.com
//   MODEL (opcional)             modelo do Claude
//   TTS_VOICE (opcional)         voz da OpenAI, padrão "coral"
const MAX_PER_IP_PER_DAY = 40;
const MAX_TTS_PER_IP_PER_DAY = 200;
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
    if (new URL(req.url).pathname.replace(/\/+$/, '').endsWith('/tts')) return tts(req, env, cors, ip + day + ':tts');
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
      'Você é a Estrela, engenheira agrônoma virtual do app SpaceAgro (Rio Verde-GO). ' +
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

/** Voz natural da Estrela: transforma o texto da resposta em áudio (voz de IA da OpenAI). */
async function tts(req, env, cors, key) {
  if (!env.OPENAI_API_KEY) return new Response('voz não configurada', { status: 501, headers: cors });
  const n = (hits.get(key) || 0) + 1;
  hits.set(key, n);
  if (n > MAX_TTS_PER_IP_PER_DAY) return new Response('limite diário de voz atingido', { status: 429, headers: cors });
  let body;
  try { body = await req.json(); } catch { return new Response('', { status: 400, headers: cors }); }
  const text = String(body.text || '').replace(/\s+/g, ' ').trim().slice(0, 600);
  const lang = String(body.lang || 'pt-BR');
  if (!text) return new Response('', { status: 400, headers: cors });
  const r = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini-tts',
      voice: env.TTS_VOICE || 'coral',
      input: text,
      instructions: `Fale no idioma ${lang}, com sotaque natural desse idioma (em português, sotaque brasileiro). Tom caloroso, calmo e confiante, como uma agrônoma conversando com um produtor rural. Ritmo de conversa, sem soar como locução.`,
      response_format: 'mp3',
    }),
  });
  if (!r.ok) return new Response('', { status: 502, headers: cors });
  return new Response(r.body, { headers: { ...cors, 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' } });
}

function json(o, cors, status = 200) {
  return new Response(JSON.stringify(o), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

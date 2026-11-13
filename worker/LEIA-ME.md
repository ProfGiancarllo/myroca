# Ligar a Estrela à inteligência do Claude (passo a passo)

A chave NUNCA vai no app nem no GitHub. Ela fica guardada num "intermediário" gratuito (Cloudflare Worker).
Sem isso a Estrela continua funcionando (regras locais + dados da NASA); a IA só responde perguntas livres.

## 1) Criar a chave (você faz, eu não posso)
1. Entre em https://console.anthropic.com e faça login.
2. Em **Billing**, coloque um crédito pequeno (ex.: US$ 5) e ative um **limite mensal de gasto**.
3. Em **API Keys** → **Create Key** → dê o nome "myroca-estela". Copie a chave (começa com `sk-ant-`).
   Não cole a chave em chat, e-mail nem GitHub.

## 2) Criar o intermediário (Cloudflare, grátis)
1. Crie conta em https://dash.cloudflare.com → **Workers & Pages** → **Create** → **Create Worker** → nome `estela`.
2. Clique **Edit code**, apague tudo e cole o conteúdo do arquivo `worker/estela-worker.js`. **Deploy**.
3. Em **Settings → Variables and Secrets**:
   - **Add** tipo **Secret**: nome `ANTHROPIC_API_KEY`, valor = a chave copiada.
   - **Add** tipo **Text**: nome `ALLOWED_ORIGIN`, valor = o endereço do seu app (ex.: `https://seusite.com`). Para testar, use `*`.
4. Copie o endereço do worker (ex.: `https://estela.seunome.workers.dev`).

## 3) Avisar o app
Crie o arquivo `.env` na raiz do projeto com uma linha:
`VITE_ESTELA_URL=https://estela.seunome.workers.dev`
Depois gere o app de novo (`npm run build`). Pronto: perguntas livres vão para o Claude.

Custo: o modelo pequeno (Haiku) custa centavos por centenas de perguntas; o limite de gasto protege você.
O app envia só dados da lavoura (talhões, culturas, datas), nunca nome, telefone ou e-mail.

## 4) Voz natural da Estrela (opcional)
A Estrela fala com uma voz de IA natural (a mesma família de voz do ChatGPT), gerada pela OpenAI.
O app não usa mais a voz robótica do navegador: sem esta etapa, a Estrela só escreve, e o botão de som não aparece.

1. Entre em https://platform.openai.com, em **Billing** coloque um crédito pequeno e ative um **limite de gasto**.
2. Em **API keys** → **Create new secret key** → nome "spaceagro-voz". Copie a chave (começa com `sk-`).
3. No Worker `estela` (Cloudflare) → **Settings → Variables and Secrets**:
   - **Add** tipo **Secret**: nome `OPENAI_API_KEY`, valor = a chave copiada.
   - (Opcional) **Add** tipo **Text**: nome `TTS_VOICE` para trocar a voz. Padrão: `coral`.
     Outras vozes femininas que soam bem em português: `nova`, `shimmer`, `sage`.
4. Cole de novo o conteúdo de `worker/estela-worker.js` (ele ganhou a rota `/tts`) e clique **Deploy**.

Não precisa mudar o `.env`: a voz usa o mesmo endereço (`VITE_ESTELA_URL`) com `/tts` no final.
Custo aproximado: cerca de US$ 0,015 por minuto de fala (modelo `gpt-4o-mini-tts`). O Worker limita 200 falas por pessoa por dia.
O texto falado é só a resposta da Estrela; nenhum dado pessoal vai para a OpenAI.

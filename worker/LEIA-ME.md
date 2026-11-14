# Ligar a Estrela à API do Claude (passo a passo)

As chaves de API **nunca** vão no app nem no GitHub. Elas ficam no servidor da Estrela, um Cloudflare Worker gratuito.
Sem o servidor, a Estrela continua funcionando com as regras locais e os dados da NASA; a IA só responde as perguntas livres.

Você configura tudo pelo **painel de super admin** do app. Na Cloudflare só é preciso fazer a parte 1 uma vez.

## 1) Criar o servidor na Cloudflare (uma vez)
1. Crie uma conta em https://dash.cloudflare.com → **Workers & Pages** → **Create** → **Create Worker** → nome `estela`.
2. Clique **Edit code**, apague tudo, cole o conteúdo de `worker/estela-worker.js` e clique **Deploy**.
3. Crie o armazenamento das configurações: **Storage & Databases → KV → Create** com o nome `spaceagro-config`.
4. No Worker `estela` → **Settings → Bindings → Add → KV namespace**: nome da variável `CONFIG`, namespace `spaceagro-config`.
5. No Worker `estela` → **Settings → Variables and Secrets**:
   - **Add** tipo **Secret**: nome `ADMIN_PASSWORD`, valor = uma senha forte só sua (ex.: 20 caracteres). É a senha do painel.
   - **Add** tipo **Text**: nome `ALLOWED_ORIGIN`, valor = o endereço do app (ex.: `https://seusite.com`). Para testar, use `*`.
6. Copie o endereço do Worker (ex.: `https://estela.seunome.workers.dev`).

## 2) Criar a chave do Claude
1. Entre em https://console.anthropic.com, em **Billing** coloque um crédito e ative um **limite mensal de gasto**.
2. Em **API Keys** → **Create Key** → nome "spaceagro-estela". Copie a chave (começa com `sk-ant-`).
   Não cole a chave em chat, e-mail nem GitHub: só no painel do app.

## 3) Criar o super admin e ligar a Estrela (no app)
1. Abra o app com `?admin` no final do endereço (ex.: `https://seusite.com/?admin`).
2. Na tela **Criar super admin**, informe o endereço do Worker, a senha `ADMIN_PASSWORD` e crie sua conta (nome, e-mail e senha).
   O app só cria a conta depois que o servidor confirma a senha.
3. O painel **Administração** abre. Em **Inteligência da Estrela — API do Claude**, cole a chave, escolha o modelo e clique **Salvar**.
4. Em **Testar a Estrela**, clique **Perguntar** para conferir.

Depois disso, o painel fica em **Fazenda → Sistema → Administração** (só aparece para o super admin).
A senha `ADMIN_PASSWORD` é pedida de novo a cada aba nova; use **Bloquear painel** ao terminar.

### Modelos disponíveis no painel
- **Claude Opus 5.5** (padrão): o mais capaz. US$ 4 / US$ 20 por milhão de tokens (entrada / saída).
- **Claude Sonnet 5.5**: rápido e equilibrado. US$ 2 / US$ 10.
- **Claude Haiku 5.5**: o mais econômico. US$ 0,10 / US$ 0,50.

A Estrela usa esforço baixo (respostas curtas de conversa). Com Opus e Sonnet, se o modelo recusar uma pergunta por política,
a própria API refaz a pergunta num modelo de reserva (recurso `fallbacks`). O Worker limita 40 perguntas por pessoa por dia.

## 4) Voz natural da Estrela (opcional)
1. Em https://platform.openai.com, coloque crédito, ative um **limite de gasto** e crie uma chave em **API keys** (começa com `sk-`).
2. No painel, em **Voz natural da Estrela — OpenAI**, cole a chave, escolha a voz e clique **Salvar**. Use **Ouvir amostra** para testar.

Custo aproximado: US$ 0,015 por minuto de fala. O Worker limita 200 falas por pessoa por dia.

## Segurança
- As chaves vão do painel direto para o servidor, que guarda no KV da Cloudflare e **nunca devolve**: o painel mostra só os 4 últimos caracteres.
- Toda ação do painel exige a senha `ADMIN_PASSWORD`, conferida pelo servidor. Após 10 senhas erradas no dia, o IP fica bloqueado até o dia seguinte.
- A conta de super admin do app só libera a tela neste aparelho; quem protege as chaves é o servidor.
- O app envia ao Claude só dados da lavoura (talhões, culturas, datas), nunca nome, telefone ou e-mail.
- Alternativa sem painel: cadastre `ANTHROPIC_API_KEY` e `OPENAI_API_KEY` como Secrets direto no Worker. O painel mostra "cadastrada direto na Cloudflare".

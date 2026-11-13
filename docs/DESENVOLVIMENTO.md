# MyRoça — documento técnico para desenvolvedores

Estado do código em 13/11/2026 (ramo `main`). Objetivo: permitir que outra pessoa continue o desenvolvimento sem depender de quem escreveu.

## 1. O que é

Aplicação web (sem backend próprio) que une mapa de satélite, talhões da fazenda, clima (NASA POWER, Open-Meteo), preços de bolsa (CBOT/ICE via FRED/Yahoo) e um diário de safra, para apoiar a decisão de troca de safra e rotação de culturas. Projeto do NASA Space Apps 2026 (desafio "Adapting Farms with NASA Data"), Rio Verde (GO).

Site publicado: https://profgiancarllo.github.io/myroca/ (GitHub Pages, ramo `gh-pages`, gerado pelo workflow).

## 2. Stack

- TypeScript 5 + Vite, sem framework de UI. Telas são classes que montam HTML com template strings e delegam eventos (`innerHTML` + `addEventListener`). O estado principal fica em `src/index.ts` (classe da aplicação, ~3 mil linhas).
- Mapa: Leaflet. Cena 2.5D "Minha fazenda": `three` + `xrblocks` (`src/components/FarmGameView.ts`), hoje escondida da interface.
- Persistência: `localStorage` (dados da fazenda e da conta, por usuário) e IndexedDB (imagem de satélite em cache). Não há banco de dados nem servidor.
- Dependências de IA/voz: reconhecimento de fala (microfone) pela Web Speech API do navegador; perguntas livres e a voz natural da assistente passam por um Cloudflare Worker (`worker/`), que chama a API da Anthropic (respostas) e a da OpenAI (voz, rota `/tts`).
- `package.json` ainda tem o nome `xrblocks-example` e dependências herdadas de um template (`@google/genai`, `openai`, `rapier3d`, `mediapipe`, `uikit`...). Boa parte não é usada pelo MyRoça; vale auditar e remover.

## 3. Rodar, validar, publicar

```bash
npm install
npm run dev          # http://localhost:3000
npm run lint         # tsc --noEmit
npx vite build --base=./   # saída em dist/ (base relativa, necessária no GitHub Pages)
```

Parâmetros de URL úteis: `?intro=0` desliga o vídeo de abertura.

Publicação (`.github/workflows/publicar-site.yml`): a cada push em `main` ou `i18n-textos-fixos`, o GitHub Actions roda `scripts/atualizar-mercado.mjs`, faz o build e força o push de `dist/` no ramo `gh-pages`. Depois o GitHub executa o "pages build and deployment". Leva de 2 a 3 minutos; use Ctrl+Shift+R para ver a versão nova.

Segredos e variáveis do repositório (Settings > Secrets and variables > Actions):
- `FRED_API_KEY` (segredo): chave da API do FRED. Sem ela o script cai para o CSV público.
- `VITE_ESTELA_URL` (variável ou segredo): endereço do Cloudflare Worker da assistente. Sem ele a assistente só usa regras locais.
Nenhuma chave vai para o código nem para o site.

Atenção com caminhos de arquivos estáticos: o site fica num subcaminho (`/myroca/`), então use sempre caminhos relativos (`./assets/...`), nunca `/assets/...`.

## 4. Estrutura do código

```
index.html                 página única (ícone e meta com caminho relativo)
src/index.ts               classe da aplicação: estado, barra superior, ligação entre painéis
src/types.ts               tipos: FarmData, Talhao, DiaryEntry, HarvestHistoryItem, RotationPlan...
src/auth/                  conta local (PBKDF2 no navegador), tela de login/cadastro
src/avatar/                avatar do usuário
src/components/
  MapManager.ts            Leaflet: talhões, camadas do CAR, imagem de satélite, ferramentas de edição
  FarmGameView.ts          cena 2.5D (escondida)
  RotationPlanner.ts       planejador de safra e decisão de troca
  MarketPanel.ts           cartão e painel de mercado (gráficos SVG próprios)
  DiaryPanel.ts            diário de safra
src/estela/                assistente "Estrela": chat, regras locais, pendências, textos
src/simple/                tela do Modo Simples (padrão para novos usuários)
src/intro/IntroVideo.ts    vídeo de abertura em canvas
src/utils/
  geo.ts                   fazenda de demonstração e geometria
  storage.ts               load/save da fazenda, migração da fazenda de exemplo (demoVersion)
  nasaPower.ts             cliente NASA POWER diário, cache de 12 h
  weather.ts               Open-Meteo (condição atual)
  diaryWeather.ts          clima do dia para o diário (NASA POWER, depois Open-Meteo)
  cropCalendar.ts          fases, colheita prevista
  rotation.ts              regras de rotação e avaliação das estratégias
  agronomyRules.ts         alertas agronômicos por fase
  market.ts                modelo de mercado e margem
  decision.ts              decisão combinada (clima + lavoura + mercado)
  forecast.ts              produtividade e previsão
  farmSnapshot.ts          imagem de satélite (Esri World_Imagery) em cache no IndexedDB
  twinLook.ts, segment.ts  aparência do gêmeo digital; contorno automático de lavoura por cor
src/data/farmCar.ts        geometrias da fazenda real de demonstração (gerado, ~175 KB)
src/i18n/                  traduções (6 idiomas)
scripts/atualizar-mercado.mjs   baixa preços e futuros antes do build
worker/                    Cloudflare Worker da assistente (ver worker/LEIA-ME.md)
tests/                     testes de interface com Playwright
docs/                      documentação (mercado-dados.md, roteiro-demonstracao.md)
```

## 5. Modelo de dados

`FarmData` (`src/types.ts`): `farmName`, `referenceDate`, `simulateTime`, `talhoes: Talhao[]`, `waterPoints`, `demoVersion`.

`Talhao`: `id`, `name`, `crop`, `cultivar`, `plantingDate` (YYYY-MM-DD), `cycleDays`, `harvestDateExpected`, `areaHectares`, `coordinates: [lat, lng][]`, `harvestHistory`, `diary: DiaryEntry[]`, `rotationPlan`, `nextCropPlan`, `isExample`.

`DiaryEntry`: `id`, `date`, `type` (`plantio`, `adubacao`, `aplicacao`, `irrigacao`, `chuva`, `monitoramento`, `colheita`, `observacao`, `preparo`, `calagem`, `foliar`, `ocorrencia`, `analise_solo`), `amount` + `unit`, `product`, `category`, `target`, `depth`, `note`, `groupId` (liga registros feitos juntos em vários talhões), `weather` (`rain`, `tmax`, `tmin`, `src`).
Semântica que outros módulos usam: `irrigacao.amount` em mm (soma de irrigação em `agronomyRules`), `colheita.amount` em sc/ha (referência de produtividade em `rotation.ts` e `forecast.ts`).

Chaves do navegador (todas com sufixo `:<userId>` via `scopedKey` quando há sessão):
- `myroca_farm_data_rio_verde_rural_v3`: `FarmData` inteiro.
- `myroca_users_v1`, `myroca_session_v1`: contas locais.
- `myroca_language`, `myroca_ui_mode_v1` (`simple`/`full`), `myroca_estela_voice_v1`.
- `myroca_nasa_v1_*`: cache da NASA POWER (12 h). Preço e custo digitados pelo produtor também ficam no navegador.
- IndexedDB `myroca_snapshot_v1`: imagem de satélite (30 dias).

Migração: se todos os talhões são de exemplo e `demoVersion !== 3`, `loadFarmData` troca pela fazenda de demonstração atual. Ao mudar a demonstração, incremente `demoVersion` em `geo.ts` e na checagem de `storage.ts`.

## 6. Módulos principais

### 6.1 Mapa e fazenda real
`MapManager` usa panes próprios (`snapshot` z 250, `car` z 380). Para a demonstração, a imagem vem de `ensureSnapshot(CAR_VIEW)` (Esri export, cache de 30 dias); com zoom ≥ 15 e conexão, troca para tiles ao vivo. O zoom mínimo é `getBoundsZoom(bounds, true)` e `setMaxBounds` com viscosidade 1, para a imagem sempre preencher a tela.

`src/data/farmCar.ts` vem do CAR GO-5218805-945560B98BAC4CAC87AECD90F33C618A (SICAR, SIRGAS 2000 ≈ WGS84): limite do imóvel, Reserva Legal, vegetação nativa, APP, nascente, pista de pouso e 20 talhões gerados por divisão geométrica da área consolidada (até 650 ha). O gerador não está no repositório (foi um script Python que lê os shapefiles); se precisar regenerar, parta dos shapefiles do SICAR.

### 6.2 Clima
`nasaPower.ts`: NASA POWER diário (`PRECTOTCORR`, `T2M`, `T2M_MAX`, `T2M_MIN`, `ALLSKY_SFC_SW_DWN`), `-999` = sem dado, atraso de alguns dias, cache de 12 h.
`diaryWeather.ts`: `weatherForDates(lat, lng, datas)`. Arredonda o ponto para 0,1° para reaproveitar pedidos, busca NASA POWER e completa com Open-Meteo (forecast com `past_days` até 90 dias; archive acima disso). Cache em memória.

### 6.3 Mercado e decisão
`scripts/atualizar-mercado.mjs` gera `public/data/mercado.json` (não versionado): FRED (soja, milho, trigo, algodão em US$/t mensal e dólar), Yahoo CBOT (`ZS=F`, `ZC=F`, `ZW=F`) e ICE (`CT=F`) com preço, histórico de 2 anos e contratos futuros. Se falha, o app usa `EXAMPLE_MARKET` (selo "dados de exemplo"). Culturas sem série (sorgo, feijão, cana, pastagem) seguem como exemplo.
Preço em R$ = cotação da bolsa × US$/R$, sem prêmio ou base local. Conversões: soja e trigo bu→sc ×(60/27,2155); milho ×(60/25,4012); algodão ¢/lb→R$/@ ×2,20462×15; FRED US$/t ×0,06×câmbio por saca.

`market.ts` (`slotMargin`): preço na colheita = preço atual × fator da curva de futuros (`forwardFactor`, limitado a 0,85–1,15) quando há curva; senão metade da tendência de 12 meses, limitada a ±10%. Cenários pessimista/base/otimista pela volatilidade; produtividade × fator de risco da estratégia (1,00 / 0,93 / 0,85). `decision.ts` escolhe a "Decisão combinada": maior margem base entre estratégias sem risco alto. Limiares ficam em `market.ts` e `rotation.ts` (a confirmar com um agrônomo).

### 6.4 Diário de safra
`DiaryPanel.ts`: formulário com data, seleção de talhões (todos, por cultura ou individual), 13 tipos de evento com campos próprios, linha do tempo agrupada por `groupId`, indicador de preenchimento (talhões com registro nos últimos 7 dias) e botão que abre a Estrela. Ao salvar, cria uma `DiaryEntry` por talhão e `enrichAll()` preenche `weather` com NASA POWER/Open-Meteo (chuva informada pelo produtor tem prioridade; temperatura vem da API). Registro de `plantio` preenche `plantingDate` e `cultivar` do talhão se estiverem vazios.

### 6.5 Estrela (assistente)
`EstelaChat.ts`: regras locais (registro por voz ou texto de chuva, irrigação, adubação etc., perguntas pendentes em `pending.ts`) e, para perguntas livres, `fetch` no Worker (`VITE_ESTELA_URL`). O Worker guarda a chave da Anthropic; o app envia só dados da lavoura. O nome exibido pela IA depende do prompt em `worker/estela-worker.js`, que precisa ser republicado no Cloudflare quando mudar.

### 6.6 Internacionalização
Seis idiomas: `pt`, `es`, `en`, `de`, `zh`, `fr`. Há um dicionário global (`src/i18n/translations.ts`, função `t`) e dicionários por módulo com a mesma forma (`safraText`, `rotationText`, `marketText`, `mercadoText`, `diarioText`, `estelaText`, `simpleText`...): objetos `pt/en/es/de/zh/fr` e uma função `xx(chave, params)` que troca `{param}`. Para texto novo, crie chaves nos seis idiomas; o fallback é o inglês. Alguns rótulos estáticos montados na carga (por exemplo, botões da barra) não se atualizam sozinhos na troca de idioma.

### 6.7 Conta e acesso
`src/auth/auth.ts`: contas locais, senha com PBKDF2. Isso separa dados por usuário no mesmo aparelho, mas não é segurança: não há servidor. A interface `AuthProvider` foi pensada para trocar por um provedor online (por exemplo, Supabase).

## 7. Testes

Testes de interface com Playwright (`tests/`). Eles esperam o servidor de desenvolvimento em `http://127.0.0.1:3111` e a variável `S` apontando para uma pasta onde gravar capturas.

```bash
npx vite --port=3111 --host=127.0.0.1 &
S=/tmp/saida NODE_PATH=$(npm root -g) node tests/mercado.cjs
S=/tmp/saida NODE_PATH=$(npm root -g) node tests/safra.cjs
```

- `tests/mercado.cjs` e `tests/safra.cjs`: planejador de safra e camada de mercado.
- `tests/fluxo-demo.js`: fluxo de demonstração (como `package.json` tem `"type": "module"`, copie para `.cjs` para rodar).
Os testes simulam NASA, Open-Meteo, Esri e `data/mercado.json` com `page.route`. Servem de modelo para novos testes (cadastro de usuário de teste, "Ver a fazenda" para sair do Modo Simples). Não há testes unitários nem integração contínua com testes; apenas `tsc --noEmit` e o build.

## 8. Limitações conhecidas

- Sem backend: dados só no navegador (um aparelho, um navegador). Limpar o armazenamento apaga tudo. Falta sincronização, backup e login real.
- `FarmGameView.ts` (3 mil linhas) e `index.ts` concentram muita lógica; vale dividir por responsabilidade.
- Preços sem base local nem prêmio (B3 não tem dado aberto gratuito); sorgo, feijão, cana e pastagem sem série real.
- Talhões da fazenda real são divisão geométrica, não os talhões reais.
- Clima do diário só cobre dias já publicados (NASA com atraso de alguns dias, completado pelo Open-Meteo). Estações do INMET e outras fontes locais ainda não foram integradas.
- Imagem de satélite: Esri World_Imagery; conferir os termos de uso para produção. Open-Meteo: conferir termos para uso comercial.
- Limiares agronômicos e fatores de risco precisam de validação por agrônomo.
- Áreas: a área total da fazenda informada no cadastro ainda não limita a soma dos talhões mapeados.

## 9. Próximos passos sugeridos

1. Campo de área total no cadastro e limite da soma dos talhões ao mapear (base da cobrança por hectare: até 500 ha, US$ 0,10/ha/mês; 501 a 2.000 ha, US$ 0,08; acima de 2.000 ha, US$ 0,06; a faixa vale para todos os hectares da fazenda).
2. Backend e login real (Supabase ou similar) com migração dos dados do `localStorage`.
3. Usar o diário na decisão: custos reais por talhão (adubação, combate), produtividade medida por colheita, janela de plantio real.
4. Integrar estações meteorológicas (INMET e redes locais) ao clima do diário, com seleção da estação mais próxima.
5. Preços locais de Rio Verde (Cepea/Esalq, Conab) para substituir paridade de bolsa.
6. Testes automatizados no CI e remoção de dependências não usadas.

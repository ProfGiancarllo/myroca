# Roteiro de demonstração MyRoça (≈3 min)

**Abertura:** vídeo de ~12 s toca ao abrir o app (satélite → dados → fazenda → gêmeo digital → produtor + "Olhando de cima, a gente te ajuda."). Botão Pular/Entrar. Para desligar em testes: adicionar `?intro=0` ao endereço.

Site: https://profgiancarllo.github.io/myroca/ (abrir no Chrome, microfone permitido)

| # | Tempo | O que fazer na tela | O que dizer |
|---|-------|--------------------|-------------|
| 1 | 0:00 | Entrar (ou cadastrar). Abre a tela **Hoje**. | "O produtor abre o app e vê só o que importa hoje, sem menus." |
| 2 | 0:20 | Mostrar o cartão de clima e o aviso ("evite aplicar agora"). Tocar em **Corrigir** → escolher "Chuva". | "O clima vem de satélite (NASA/Open-Meteo). Se o produtor olha pro céu e vê outra coisa, ele corrige em um toque." |
| 3 | 0:45 | Cartão de risco de plantio (NASA). | "Dados da NASA avisam o risco de semear agora." |
| 4 | 1:00 | **O que fazer hoje** → "Responder por texto/voz". A Estela pergunta data de plantio → "5 de outubro" → Confirmar. Depois cultivar → "DM 54i52 RSF". | "A Estela percebe o que falta e pergunta. O produtor fala, ela confirma antes de gravar." |
| 5 | 1:40 | **Registrar agora → Chuva** → escolher talhão → "22" → Confirmar. | "Registro de campo em 3 toques ou por voz." |
| 6 | 2:00 | **Planejar safra** (rotação de culturas). | "Sugestão de rotação para o próximo ciclo." |
| 7 | 2:20 | **Ver a fazenda** → visão 2.5D com chip de clima; menu ⋯. | "Para quem quer ver a fazenda inteira, o modo completo." |
| 8 | 2:40 | Botão **Modo Simples** volta à tela Hoje. Fechar com: | "Simples para o produtor, completo para o técnico. Seis idiomas." |

## Plano B (se algo falhar ao vivo)
- Sem internet: clima cai para estimativa sazonal; o app segue funcionando.
- Microfone bloqueado: usar "Responder por texto".
- IA externa fora do ar: Estela responde com o motor local (registros, clima, risco NASA).

## Teste automatizado
`node tests/fluxo-demo.js` (precisa do servidor em 127.0.0.1:3111 e Playwright) executa os passos 1–8 e confere 12 verificações.
Último resultado: 12/12 OK. Não testável no sandbox: voz real, NASA/Open-Meteo reais.

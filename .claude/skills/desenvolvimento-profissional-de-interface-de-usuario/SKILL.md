---
name: desenvolvimento-profissional-de-interface-de-usuario
description: Regras obrigatórias de design profissional sem aparência de IA. Use SEMPRE antes de criar, gerar código ou modificar qualquer tela, componente, página, dashboard, formulário, menu ou estilo visual do MyRoça (sites, dashboards, CRMs, ERPs, sistemas administrativos, SaaS e aplicativos). Lista 20 padrões proibidos (gradiente roxo/azul, neon, glassmorphism, emojis, chips coloridos, KPIs com ícones, rosca decorativa, "Bem-vindo de volta", filtros falsos etc.) e um checklist de entrega.
---

# Design profissional sem aparência de IA

Versão 1.0. Vale para sites, dashboards, CRMs, ERPs, sistemas administrativos, plataformas SaaS e aplicativos.

## 1. Objetivo

Construir interfaces modernas, minimalistas, funcionais e profissionais, sem os padrões repetitivos de dashboards gerados por IA. A interface deve parecer um produto real, feito por uma equipe experiente em UX/UI e engenharia de software.

Aplique esta skill **antes** de gerar código, criar uma tela ou modificar o visual do sistema.

## 2. As 20 proibições

1. **Gradientes roxo/azul** — não use gradientes roxo e azul genéricos como identidade visual padrão.
2. **Neon sobre preto** — sem efeitos neon, brilhos exagerados ou elementos luminosos sobre fundo escuro.
3. **Vidro nos cartões** — sem glassmorphism, transparências excessivas ou desfoque decorativo em cartões.
4. **Sombras desproporcionais** — sombras discretas, consistentes e só quando servem para estabelecer hierarquia.
5. **"Sobrancelha" em todo título** — não coloque um pequeno rótulo acima de cada título sem necessidade informacional.
6. **Etiqueta "Ao vivo"** — não indique tempo real quando os dados não são de fato atualizados em tempo real.
7. **Chips coloridos** — evite excesso de etiquetas, categorias e indicadores coloridos sem função objetiva.
8. **Ícones coloridos nos KPIs** — não coloque ícones decorativos coloridos em todos os indicadores numéricos.
9. **Pílula verde com seta** — nada de indicadores genéricos de crescimento. Variação percentual só com dado real e base de comparação explícita.
10. **Emojis** — nunca em títulos, menus, cartões, botões ou indicadores.
11. **Ícones de brilho** — sem estrelas, brilhos ou símbolos de "IA" como decoração.
12. **Rosca com total no centro** — evite gráficos de rosca decorativos; prefira representações que facilitem comparação (barras, tabelas).
13. **Gráficos multicoloridos** — paleta restrita e consistente; cor só quando a categoria ou o significado justifica.
14. **Títulos genéricos** — nada de "Vendas por mês" solto. Dê nome específico e útil para a análise (ex.: "Produtividade por talhão — safra 2025/26, sc/ha").
15. **Minigráficos decorativos** — sem sparklines que não tragam informação útil.
16. **Saudações genéricas** — "Bem-vindo de volta" não é elemento principal de tela operacional.
17. **Bordas coloridas decorativas** — sem faixas ou bordas coloridas sem significado funcional.
18. **Menu lateral de enfeite** — todo item de navegação corresponde a uma funcionalidade real, rota existente ou estado claramente identificado.
19. **Filtros que não funcionam** — todo filtro altera de fato os dados exibidos. Não crie controles falsos.
20. **Insights irrelevantes** — não gere blocos automáticos de "insights" sem fundamento, relevância e possibilidade de ação.

## 3. Diretrizes visuais

- Tipografia profissional, consistente e legível.
- Priorize alinhamento, proporção e espaçamento.
- Evite componentes grandes demais.
- Crie hierarquia visual com tamanho, peso tipográfico e posicionamento — não com cor e efeito.
- Cores neutras + uma cor principal de identidade.
- Respeite a identidade visual existente do projeto (no MyRoça: o verde da marca, a paleta e os componentes já usados em `src/`). Leia os estilos atuais antes de introduzir novos.
- Layout responsivo para computador, tablet e celular.
- Nenhum elemento decorativo sem função.
- Densidade de informação equilibrada.
- Componentes reutilizáveis e padronizados; reaproveite os que já existem no projeto.

## 4. Diretrizes funcionais

Todo componente interativo tem finalidade real:

- Botões executam ações.
- Formulários validam as informações.
- Filtros modificam os resultados.
- Menus navegam corretamente.
- Gráficos usam dados reais, ou dados demonstrativos **claramente identificados** como tal.
- Indicadores mostram informação verificável.
- Buscas retornam resultados.
- Estados de carregamento, erro e ausência de dados são tratados.

**É proibido simular uma funcionalidade como se estivesse operacional.** Se algo ainda não existe, não coloque o controle, ou marque-o explicitamente como indisponível.

## 5. Experiência do usuário

O sistema deve priorizar, nesta ordem:

1. Facilidade de uso
2. Rapidez para executar tarefas
3. Clareza das informações
4. Menos cliques desnecessários
5. Consistência entre telas
6. Acessibilidade (contraste, foco visível, rótulos, navegação por teclado)
7. Responsividade
8. Feedback claro das ações

## 6. Checklist obrigatório antes da entrega

Antes de apresentar qualquer interface, verifique e relate:

- [ ] Nenhum dos 20 padrões proibidos foi usado.
- [ ] O layout respeita a identidade visual do projeto.
- [ ] Os componentes estão alinhados e espaçados de forma consistente.
- [ ] Não há elementos puramente decorativos.
- [ ] Os botões e filtros implementados funcionam (testados no app rodando).
- [ ] Os gráficos têm finalidade analítica.
- [ ] A navegação está organizada e todos os itens levam a algo real.
- [ ] A interface funciona em larguras de celular, tablet e desktop.
- [ ] Nenhum dado fictício é apresentado como real.
- [ ] O resultado tem aparência de software profissional.

Sempre que possível, verifique no navegador (app rodando) em largura de celular e de desktop antes de declarar pronto.

## 7. Regras finais

- Não adicione efeitos visuais só para o projeto parecer moderno. A modernidade vem de organização, clareza, usabilidade, desempenho e consistência.
- Se uma solicitação específica do usuário conflitar com estas diretrizes, prevalecem as instruções do usuário e o visual exigido para o projeto.

**Princípio central:** menos decoração, mais funcionalidade. Menos aparência de modelo de IA, mais identidade de produto profissional.

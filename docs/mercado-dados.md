# Camada de mercado do planejador de safra

O planejador (botão "Planejar safra") cruza três coisas na mesma decisão:

1. **Clima:** NASA POWER no talhão e a janela de semeadura (já existia).
2. **Lavoura:** histórico de produtividade do talhão e regras de rotação (Embrapa/ZARC).
3. **Mercado:** preço, tendência de 12 meses, custo e margem estimada por cenário (pessimista, base, otimista).

A produtividade usada na margem é reduzida pelo risco da estratégia: ×1,00 (favorável), ×0,93 (atenção), ×0,85 (risco alto).
A "Decisão combinada" é a estratégia de maior margem base entre as que não têm risco alto.
O teste de preço (−40% a +40%) refaz a decisão na hora.

## Dados de exemplo x dados reais

Sem arquivo de dados, o app usa valores ilustrativos e mostra o selo **"Dados de exemplo"**.
Para usar dados reais, publique `public/data/mercado.json` no formato de `public/data/mercado.exemplo.json`
(com `"example": false`, `source` e `asOf`). O app lê o arquivo sozinho; culturas ausentes mantêm o valor de exemplo.
Campos por cultura: `unit` (sc, @ ou t), `price` (R$/unidade), `trend12m` (%), `vol` (%), `yieldRef` (unidade/ha), `cost` (R$/ha), `series` (opcional, 12 preços para o minigráfico).

O produtor também pode digitar o próprio preço e custo na tabela; fica salvo no navegador (botão "Restaurar valores" limpa).

## Limites
Estimativa para planejamento, não é recomendação de compra ou venda. O preço base aplica metade da variação dos últimos 12 meses.
Limiares e fatores ficam em `src/utils/market.ts` (`RISK_YIELD_FACTOR`, cenários de produtividade) para o agrônomo ajustar.

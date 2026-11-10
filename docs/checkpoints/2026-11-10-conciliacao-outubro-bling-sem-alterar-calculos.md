# Checkpoint — Conciliação de vendas Bling, outubro 2026

Data 10/11/2026. Fonte: planilha `vendas outubro 2026 final bling.xls` fornecida pelo usuário. Projeto Supabase `gsizoiwefejsllgtsard`.

## Decisão funcional homologada
- NÃO alterar qualquer regra de cálculo da Prestação de Contas, nomenclatura de `valor_total`, relatórios, nem lógica de receita.
- Valor bruto = quantidade x preço unitário; manter desconto e frete em campos próprios.
- Valor Total do Bling não substitui os critérios já existentes do sistema.

## Ajustes pontuais em `public.compras`, executados diretamente e verificados
1. Pedido 8419: incluída T-SHIRT PESSOA ERRADA, P · Unissex · Branco, 1 un, R$ 175,00 unitário/bruto e R$ 3,31 desconto. Novo ID `cp-correcao-8419-p-branco-20261110`, com cliente, canal, prestação e data herdados do mesmo pedido. Inclusão protegida por NOT EXISTS.
2. Pedido 8382: as duas linhas do modelo T-SHIRT DEUS ABENÇOE NOSSO CORRE, GG Masculino, são legítimas e foram distinguidas por cor `Verde` e `Branco`. IDs originais preservados. Valores e quantidades mantidos.
3. Pedido 8417: SHORTS VINTAGE CÏCLO MASCULINO, XGG · Lilas: alterados os três campos `valor_unitario`, `valor_total` e `valor_bruto` de NULL para 0. Desconto R$ 175,00 foi preservado.

## Conciliação após correção
- 90 pedidos únicos, 237 linhas, 940 unidades.
- Valor bruto: R$ 93.304,13; descontos: R$ 3.632,81; frete: R$ 1.201,20.
- 0 valores totais nulos.
- View `cda_v_vendas_canal_mes` mês 2026-10: 90 pedidos, 940 peças, R$ 93.304,13.
- Antes: 90 pedidos, 236 linhas, 939 peças, R$ 93.129,13 bruto, R$ 3.629,50 descontos.
- Sem alterações de código da Prestação de Contas e sem envio de e-mail oficial.

## Pendente
A rotina de importação original ainda não foi modificada; um novo processamento da mesma planilha poderá exigir nova verificação desses três casos, principalmente o mapeamento da variação e preço zero. Não reimportar sem conferir antes as regras de deduplicação/sincronização. A homologação visual da tela financeira pelo usuário permanece pendente.

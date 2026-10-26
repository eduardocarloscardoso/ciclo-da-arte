-- ════════════════════════════════════════════════════════════════════
-- Planejamento Anual (PROJETO 6) — 09: Mix de Vendas e Custo Ideal — 26/10/2026.
-- Só ADICIONA coluna. Tipo de venda de cada canal de receita (subconta de
-- RECEITAS): 'direta' (consumidor final, inclusive Revendas — comissionadas)
-- ou 'atacado' (B2B / Private Label). Usado para o custo ideal do produto:
-- venda direta × custo_ideal_direta (25%) + atacado × custo_ideal_atacado (50%).
-- ════════════════════════════════════════════════════════════════════
alter table public.cda_pa_subconta add column if not exists tipo_venda text
  check (tipo_venda is null or tipo_venda in ('direta','atacado'));

update public.cda_pa_subconta s set tipo_venda = case when s.nome ilike 'private label%' then 'atacado' else 'direta' end
 where s.tipo_venda is null and s.conta_id in (select id from public.cda_pa_conta where tipo = 'RECEITAS');

-- Referências do custo ideal do produto (padrão do setor, "keystone"):
-- chave 'custo_ideal_direta' / 'custo_ideal_atacado' → pct_mercado (% do preço)
insert into public.cda_pa_meta_estrutura (ano, chave, pct_mercado, fonte) values
 (2026, 'custo_ideal_direta', 30, 'Venda direta: custo do produto 30% do preço (meta da Ciclo; padrão do setor ≈ 25%, markup 4×)'),
 (2026, 'custo_ideal_atacado', 50, 'Atacado/B2B: custo ≈ 50% do preço de atacado (markup 2×) — padrão do setor (RepSpark)')
on conflict (ano, chave) do nothing;

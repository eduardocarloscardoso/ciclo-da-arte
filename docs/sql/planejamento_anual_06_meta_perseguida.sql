-- ════════════════════════════════════════════════════════════════════
-- Planejamento Anual (PROJETO 6) — 06: Meta perseguida (R$/mês) e fonte da
-- referência de mercado, por centro de custo — 24/10/2026. Só ADICIONA colunas.
-- ════════════════════════════════════════════════════════════════════
-- cda_pa_meta_estrutura (ano, chave):
--   chave 'cc:<id>'            → pct_mercado (% da receita) + valor_mensal (meta perseguida R$/mês) + fonte
--   chave 'receita_mes_aberto' → valor_mensal = receita hipotética do mês ainda não fechado (simulação)
-- Subconta e total passam a ser a SOMA dos centros (congelados na tela).
alter table public.cda_pa_meta_estrutura add column if not exists valor_mensal numeric(15,2);
alter table public.cda_pa_meta_estrutura add column if not exists fonte text;

-- PROJETO 6 · Fase 1 · Script 03: Validação (somente leitura)
-- Cada linha deve retornar status = 'OK'. Valores esperados = dump do Manus (commit d0d1eadc).
with esperado(item, valor) as (values
  ('Contas',                          2::numeric),
  ('Subcontas',                       19),
  ('Centros de custo',                109),
  ('Previsto 2026 Receitas',          1293000.00),
  ('Previsto 2026 Despesas',          1564500.00),
  ('Realizado 2026 Receitas (jan-set)', 1019152.00),
  ('Realizado 2026 Despesas (jan-set)', 1157396.09),
  ('Provisao 2026 Receitas',          0.00),
  ('Provisao 2026 Despesas',          7800.00),
  ('Realizado 2025 Receitas (legado)',  2130998.09),
  ('Realizado 2025 Despesas (legado)',  2144550.48),
  ('Ultimo mes realizado 2026',       9)
), obtido(item, valor) as (
  select 'Contas', count(*)::numeric from cda_pa_conta union all
  select 'Subcontas', count(*) from cda_pa_subconta union all
  select 'Centros de custo', count(*) from cda_pa_centro_custo union all
  select 'Previsto 2026 ' || initcap(lower(tipo)), sum(previsto_anual) from cda_pa_v_resumo_anual where ano = 2026 group by tipo union all
  select 'Realizado 2026 ' || initcap(lower(tipo)) || ' (jan-set)', sum(realizado_acumulado) from cda_pa_v_resumo_anual where ano = 2026 group by tipo union all
  select 'Provisao 2026 ' || initcap(lower(tipo)), sum(provisao_prevista) from cda_pa_v_resumo_anual where ano = 2026 group by tipo union all
  select 'Realizado 2025 ' || initcap(lower(tipo)) || ' (legado)', sum(realizado_ano_anterior) from cda_pa_v_resumo_anual where ano = 2026 group by tipo union all
  select 'Ultimo mes realizado 2026', cda_pa_ultimo_mes_realizado(2026)
)
select e.item, e.valor as esperado, o.valor as obtido,
       case when o.valor = e.valor then 'OK' else 'DIVERGENTE' end as status
from esperado e left join obtido o using (item)
order by e.item;

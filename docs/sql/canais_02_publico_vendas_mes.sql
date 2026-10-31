-- ════════════════════════════════════════════════════════════════════
-- Canais de Venda (nova tela, 31/10/2026 — Cardoso): público realizado e vendas por canal/mês.
-- • cda_canal_eventos_mes.publico: público realizado no mês (soma dos eventos do canal no mês),
--   digitado em Financeiro › Canais de Venda › 📅 Eventos. Base da conversão peças ÷ público.
-- • View cda_v_vendas_canal_mes: Histórico de Compras (compras) agregado por canal e mês —
--   pedidos, peças e valor. security_invoker: respeita o RLS de compras.
-- ════════════════════════════════════════════════════════════════════
alter table public.cda_canal_eventos_mes add column if not exists publico int check (publico is null or publico >= 0);

create or replace view public.cda_v_vendas_canal_mes with (security_invoker = true) as
select c.canal_id,
       to_char(c.data_compra, 'YYYY-MM')                      as ano_mes,
       count(distinct coalesce(c.numero_pedido, c.id))::int    as pedidos,
       coalesce(sum(c.quantidade), 0)::int                     as pecas,
       round(coalesce(sum(c.valor_total), 0), 2)               as valor
  from public.compras c
 where c.canal_id is not null and c.data_compra is not null
 group by c.canal_id, to_char(c.data_compra, 'YYYY-MM');

grant select on public.cda_v_vendas_canal_mes to authenticated;

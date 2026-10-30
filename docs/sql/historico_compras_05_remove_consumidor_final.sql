-- ════════════════════════════════════════════════════════════════════
-- Histórico de Compras — remoção dos pedidos do cliente "Consumidor Final" — 30/10/2026 (Cardoso).
-- Os pedidos de Consumidor Final (5 cadastros "CONSUMIDOR FINAL ATUAL / Consumidor Final - DADOS CADASTRAIS
-- INCOMPLETOS") são as notas fiscais ao consumidor emitidas depois dos eventos, apenas contábeis; as peças
-- vendidas já estão nos pedidos de venda dos shows/eventos — dobram o histórico. Decisão de Cardoso: remover
-- todos. Esperado: 84 pedidos · ~1.285 peças · ~R$ 224 mil (ago/2022–nov/2024). Os cadastros de cliente ficam.
-- Backup em public.bkp_compras_consumidor_final_20261030.
-- ════════════════════════════════════════════════════════════════════
create table if not exists public.bkp_compras_consumidor_final_20261030 as select * from public.compras where false;
alter table public.bkp_compras_consumidor_final_20261030 enable row level security;
with alvo as (select c.id from public.compras c where c.cliente_id in (select id from public.clientes where nome ilike '%consumidor%final%')),
ins as (insert into public.bkp_compras_consumidor_final_20261030 select c.* from public.compras c where c.id in (select id from alvo) returning id)
delete from public.compras where id in (select id from ins);

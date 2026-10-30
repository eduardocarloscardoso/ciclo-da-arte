-- ════════════════════════════════════════════════════════════════════
-- Histórico de Compras — duplicidades encontradas pela checagem por TOTAL de gravação — 30/10/2026 (Cardoso).
-- Pedidos gravados 2× com o texto das linhas diferente (variação escrita de outro jeito) e mesmas peças/valor.
-- • 20 pedidos (abr–jun/2026): remove a 2ª gravação (lote mais recente), mantém a 1ª.
-- • 7832 E-COMMERCE CIRCO VOADOR: total do BLING R$ 356,00 = gravações de 26/08 (2 × R$ 178) → remove a
--   gravação de 29/07 (2 linhas, R$ 338,20).
-- Backup em public.bkp_compras_dup_por_total_20261030.
-- ════════════════════════════════════════════════════════════════════
create table if not exists public.bkp_compras_dup_por_total_20261030 as select * from public.compras where false;
alter table public.bkp_compras_dup_por_total_20261030 enable row level security;
with lista(pedido) as (values ('7788'),('7829'),('7445'),('7465'),('7472'),('7743'),('7508'),('7807'),('7800'),('7466'),
                              ('7507'),('7747'),('7818'),('7773'),('7759'),('7764'),('7840'),('7477'),('7454'),('7492')),
l as (select c.numero_pedido, c.canal_id, date_trunc('minute', c.criado_em) lote from public.compras c join lista on lista.pedido = c.numero_pedido group by 1,2,3),
ult as (select numero_pedido, canal_id, max(lote) lote from l group by 1,2 having count(*) = 2),
alvo as (
  select c.id from public.compras c join ult u on u.numero_pedido = c.numero_pedido and u.canal_id is not distinct from c.canal_id and date_trunc('minute', c.criado_em) = u.lote
  union all
  select c.id from public.compras c join public.canais ca on ca.id = c.canal_id
   where c.numero_pedido = '7832' and ca.nome = 'E-COMMERCE CIRCO VOADOR'
     and to_char(date_trunc('minute', c.criado_em) at time zone 'America/Sao_Paulo','DD/MM HH24:MI') = '29/07 07:56'),
ins as (insert into public.bkp_compras_dup_por_total_20261030 select c.* from public.compras c where c.id in (select id from alvo) returning id)
delete from public.compras where id in (select id from ins);

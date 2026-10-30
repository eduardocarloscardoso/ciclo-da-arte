-- ════════════════════════════════════════════════════════════════════
-- Histórico de Compras — remoção das duplicidades da CLASSE B1 (reimportação 3 a 7 vezes) — 30/10/2026 (Cardoso).
-- B1 = pedido (numero_pedido + canal) gravado em 3+ importações (minutos distintos) com TODAS as gravações
-- idênticas (mesmo nº de linhas e mesmo valor), ex.: 8093 Revenda Showroom/SAC 5×, 7779 7×, 8076 E-commerce
-- Luedji 3×. Regra (igual à classe A): em cada grupo idêntico (pedido, canal, produto, variação, qtd, valor,
-- data) mantém a gravação mais antiga e remove as demais — fica um único pedido.
-- Backup em public.bkp_compras_dup_classe_b1_20261030. Esperado: 46 pedidos · 202 linhas · R$ 63.623 (aprox.).
-- ════════════════════════════════════════════════════════════════════
create table if not exists public.bkp_compras_dup_classe_b1_20261030 as select * from public.compras where false;
alter table public.bkp_compras_dup_classe_b1_20261030 enable row level security;

with p as (select numero_pedido, canal_id, count(*) linhas, count(distinct date_trunc('minute', criado_em)) lotes from public.compras where numero_pedido is not null group by 1,2),
g as (select numero_pedido, canal_id, produto, coalesce(variacao,'') va, quantidade, valor_total, data_compra, count(*) n from public.compras where numero_pedido is not null group by 1,2,3,4,5,6,7 having count(*) > 1),
e as (select numero_pedido, canal_id, sum(n-1) extras from g group by 1,2),
b as (select p.numero_pedido, p.canal_id from p join e using (numero_pedido, canal_id) where p.lotes >= 2 and e.extras*2 <> p.linhas),
l as (select c.numero_pedido, c.canal_id, date_trunc('minute',c.criado_em) lote, count(*) ln, sum(c.valor_total) v from public.compras c join b using (numero_pedido, canal_id) group by 1,2,3),
b1 as (select numero_pedido, canal_id from l group by 1,2 having count(distinct (ln, v)) = 1),
alvo as (
  select c.id from (
    select c.*, row_number() over (partition by c.numero_pedido, c.canal_id, c.produto, coalesce(c.variacao,''), c.quantidade, c.valor_total, c.data_compra order by c.criado_em, c.id) rn
    from public.compras c join b1 on b1.numero_pedido = c.numero_pedido and b1.canal_id = c.canal_id) c
  where c.rn > 1),
ins as (insert into public.bkp_compras_dup_classe_b1_20261030 select c.* from public.compras c where c.id in (select id from alvo) returning id)
delete from public.compras where id in (select id from ins);

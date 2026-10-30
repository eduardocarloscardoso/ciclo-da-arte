-- ════════════════════════════════════════════════════════════════════
-- Histórico de Compras — remoção das duplicidades da CLASSE A (reimportação completa) — 30/10/2026 (Cardoso).
-- Classe A = pedido (numero_pedido + canal) cujas linhas aparecem EXATAMENTE 2 vezes, gravadas em
-- importações diferentes (minutos distintos), e todas as linhas do pedido estão duplicadas
-- (linhas gravadas = 2 × linhas extras). Ex.: pedido 8095 SHOWS LUEDJI LUNA, 28/09/2026 18:34 e 18:45.
-- Regra: em cada grupo idêntico (pedido, canal, produto, variação, qtd, valor, data) mantém a gravação
-- mais antiga e remove as demais. Backup das linhas removidas em public.bkp_compras_dup_classe_a_20261030.
-- Esperado: 117 pedidos · 283 linhas · 1.522 peças · R$ 228.911,86.
-- ════════════════════════════════════════════════════════════════════
create table if not exists public.bkp_compras_dup_classe_a_20261030 as select * from public.compras where false;
alter table public.bkp_compras_dup_classe_a_20261030 enable row level security;

with p as (
  select numero_pedido, canal_id, count(*) linhas, count(distinct date_trunc('minute', criado_em)) lotes
  from public.compras where numero_pedido is not null group by 1,2),
g as (
  select numero_pedido, canal_id, produto, coalesce(variacao,'') va, quantidade, valor_total, data_compra, count(*) n
  from public.compras where numero_pedido is not null group by 1,2,3,4,5,6,7 having count(*) > 1),
e as (select numero_pedido, canal_id, sum(n-1) extras from g group by 1,2),
classe_a as (select p.numero_pedido, p.canal_id from p join e using (numero_pedido, canal_id) where p.lotes >= 2 and e.extras * 2 = p.linhas),
alvo as (
  select c.id from (
    select c.*, row_number() over (partition by c.numero_pedido, c.canal_id, c.produto, coalesce(c.variacao,''), c.quantidade, c.valor_total, c.data_compra order by c.criado_em, c.id) rn
    from public.compras c join classe_a a on a.numero_pedido = c.numero_pedido and a.canal_id = c.canal_id) c
  where c.rn > 1),
ins as (insert into public.bkp_compras_dup_classe_a_20261030 select c.* from public.compras c where c.id in (select id from alvo) returning id)
delete from public.compras where id in (select id from ins);

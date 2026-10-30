-- ════════════════════════════════════════════════════════════════════
-- Histórico de Compras — classe B2, 5 pedidos conferidos no BLING por Cardoso — 30/10/2026.
-- Remove as gravações (lotes, horário de Brasília) que repetem o pedido, mantendo as mais antigas cujo
-- total bate com o BLING:
--   7804 FEIRAS E BAZARES (18/06/26)  remove 26/08 21:18           → fica 29/07 (20 + 34 linhas) = R$ 15.148
--   7633 SHOWS GILSONS (15/05/26)     remove 30/07 23:51           → fica 19:55 + 23:52      = R$ 17.558
--   8110 REVENDA - SHOWROOM / SAC     remove 28/09 15:46/16:49/16:54/17:01 → fica 15:34 + 15:35 = R$ 1.073
--   7990 REVENDA - SHOWROOM / SAC     remove 28/09 16:27/17:23/17:28/17:30 → fica 26/08 20:42 + 20:43 = R$ 899
--   7953 REVENDA - SHOWROOM / SAC     remove 28/09 16:27/17:23/17:28/17:30 → fica 26/08 20:42 + 20:43 = R$ 445
-- Backup em public.bkp_compras_dup_classe_b2_20261030.
-- ════════════════════════════════════════════════════════════════════
create table if not exists public.bkp_compras_dup_classe_b2_20261030 as select * from public.compras where false;
alter table public.bkp_compras_dup_classe_b2_20261030 enable row level security;
with regra(pedido, canal, lote) as (values
  ('7804','FEIRAS E BAZARES','26/08 21:18'),
  ('7633','SHOWS GILSONS','30/07 23:51'),
  ('8110','REVENDA - SHOWROOM / SAC','28/09 15:46'),('8110','REVENDA - SHOWROOM / SAC','28/09 16:49'),('8110','REVENDA - SHOWROOM / SAC','28/09 16:54'),('8110','REVENDA - SHOWROOM / SAC','28/09 17:01'),
  ('7990','REVENDA - SHOWROOM / SAC','28/09 16:27'),('7990','REVENDA - SHOWROOM / SAC','28/09 17:23'),('7990','REVENDA - SHOWROOM / SAC','28/09 17:28'),('7990','REVENDA - SHOWROOM / SAC','28/09 17:30'),
  ('7953','REVENDA - SHOWROOM / SAC','28/09 16:27'),('7953','REVENDA - SHOWROOM / SAC','28/09 17:23'),('7953','REVENDA - SHOWROOM / SAC','28/09 17:28'),('7953','REVENDA - SHOWROOM / SAC','28/09 17:30')),
alvo as (select c.id from public.compras c join public.canais ca on ca.id = c.canal_id
  join regra r on r.pedido = c.numero_pedido and r.canal = ca.nome
   and to_char(date_trunc('minute', c.criado_em) at time zone 'America/Sao_Paulo','DD/MM HH24:MI') = r.lote),
ins as (insert into public.bkp_compras_dup_classe_b2_20261030 select c.* from public.compras c where c.id in (select id from alvo) returning id)
delete from public.compras where id in (select id from ins);

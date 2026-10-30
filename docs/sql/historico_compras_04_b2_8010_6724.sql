-- ════════════════════════════════════════════════════════════════════
-- Histórico de Compras — classe B2, últimos ajustes conferidos no BLING por Cardoso — 30/10/2026.
--   8010 CICLO EM CASA (04/08/2026): remove a gravação de 28/09 15:45 (repetição de 2 peças, R$ 201,50)
--        → fica a de 15:34 = 3 peças, R$ 302,55 (total do BLING).
--   6724 CICLO BRINDES / PERMUTAS (28/11/2025, R$ 0): pedido inteiro removido do Histórico (97 linhas).
-- Mantidos sem alteração (total do BLING = gravado): 5736, 5283, 1044, 3594, 1449, 6235, 4471; 4985 (diferença
-- é só o frete); 1616 (R$ 1.520 de produtos genéricos fora do Histórico).
-- Backup em public.bkp_compras_dup_classe_b2_20261030 (mesma tabela da migração 03).
-- ════════════════════════════════════════════════════════════════════
create table if not exists public.bkp_compras_dup_classe_b2_20261030 as select * from public.compras where false;
with alvo as (
  select c.id from public.compras c join public.canais ca on ca.id = c.canal_id
  where (c.numero_pedido = '8010' and ca.nome = 'CICLO EM CASA'
         and to_char(date_trunc('minute', c.criado_em) at time zone 'America/Sao_Paulo','DD/MM HH24:MI') = '28/09 15:45')
     or (c.numero_pedido = '6724' and ca.nome = 'CICLO BRINDES / PERMUTAS')),
ins as (insert into public.bkp_compras_dup_classe_b2_20261030 select c.* from public.compras c where c.id in (select id from alvo) returning id)
delete from public.compras where id in (select id from ins);

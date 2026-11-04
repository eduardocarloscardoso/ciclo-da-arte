-- ════════════════════════════════════════════════════════════════════
-- Comercial · Segmentação de Clientes — filtro "Plano de Contas" (04/11/2026)
--
-- As tabelas cda_pa_conta / cda_pa_subconta / cda_pa_centro_custo só são
-- legíveis por admin ou por quem participa do projeto Planejamento Anual
-- (cda_pa_pode_ler). A Segmentação do Comercial precisa apenas dos NOMES da
-- estrutura de RECEITAS (Conta → Subconta → Centro de Custo + Grupo) para
-- filtrar clientes — sem nenhum valor financeiro (previsto/realizado).
--
-- Esta função devolve só essa estrutura, para qualquer membro da equipe
-- (cda_e_membro_equipe). Não altera nenhuma tabela nem política existente.
-- Consumida por cdaCarregarHierarquiaReceita() em cda-dados-compartilhados.js.
-- ════════════════════════════════════════════════════════════════════

create or replace function public.cda_seg_hierarquia_receita()
returns table (
  conta_id        bigint,
  conta_nome      text,
  subconta_id     bigint,
  subconta_nome   text,
  centro_custo_id bigint,
  centro_nome     text,
  grupo_id        bigint,
  grupo_nome      text,
  ativo           boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.nome, s.id, s.nome, cc.id, cc.nome, g.id, g.nome,
         (c.ativo and s.ativo and cc.ativo)
    from cda_pa_centro_custo cc
    join cda_pa_subconta s on s.id = cc.subconta_id
    join cda_pa_conta    c on c.id = s.conta_id
    left join cda_grupo  g on g.id = cc.grupo_id
   where c.tipo = 'RECEITAS'
     and cda_e_membro_equipe()
   order by c.ordem, s.ordem, cc.ordem;
$$;

revoke all on function public.cda_seg_hierarquia_receita() from public, anon;
grant execute on function public.cda_seg_hierarquia_receita() to authenticated;

comment on function public.cda_seg_hierarquia_receita() is
  'Estrutura de RECEITAS do Plano de Contas (somente nomes) para o filtro "Plano de Contas" da Segmentação de Clientes. Liberada a membros da equipe.';

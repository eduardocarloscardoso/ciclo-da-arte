-- BACKUP 29/10/2026 — definição em produção ANTES da migração 16 (planejamento_anual_16_importador_centro_igual_subconta.sql)
CREATE OR REPLACE FUNCTION public.cda_pa_importar_mes(p_ano integer, p_mes integer, p_tipo text, p_linhas jsonb, p_layout_vendedor boolean DEFAULT false, p_simular boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  v_nao_encontrados jsonb; v_outro_tipo jsonb; v_removidos int := 0; v_gravados int := 0; v_resultado jsonb;
begin
  if not public.cda_pa_pode_escrever() then raise exception 'Sem permissão de escrita no Planejamento Anual'; end if;
  if p_mes not between 1 and 12 then raise exception 'Mês inválido: %', p_mes; end if;
  if p_tipo not in ('RECEITAS','DESPESAS') then raise exception 'Tipo inválido: %', p_tipo; end if;

  create temp table _pa_imp on commit drop as
  with l as (
    select ord, trim(x->>'nome') nome, public.cda_pa_normalizar(x->>'nome') n, coalesce((x->>'valor')::numeric,0) valor
    from jsonb_array_elements(p_linhas) with ordinality t(x, ord)
    where trim(coalesce(x->>'nome','')) <> '' and public.cda_pa_normalizar(x->>'nome') not in ('total','totais')
  ), subs as (select public.cda_pa_normalizar(nome) n from cda_pa_subconta)
  select l.*,
    case when not p_layout_vendedor and l.n <> 'sem categoria' and (
           l.n like 'producao - custo montagem colecoes%'
           or exists (select 1 from subs where subs.n = l.n or 'despesas ' || subs.n = l.n or 'despesas com ' || subs.n = l.n))
         then true else false end as subtotal,
    coalesce(a.centro_custo_id, cc.id) centro_custo_id
  from l
  left join cda_pa_alias_importacao a on a.alias_norm = l.n
  left join lateral (select c.id from cda_pa_centro_custo c where public.cda_pa_normalizar(c.nome) = l.n order by c.id limit 1) cc on true;

  select coalesce(jsonb_agg(distinct nome), '[]') into v_nao_encontrados from _pa_imp where not subtotal and centro_custo_id is null;
  select coalesce(jsonb_agg(distinct i.nome), '[]') into v_outro_tipo
    from _pa_imp i join cda_pa_v_hierarquia h on h.centro_custo_id = i.centro_custo_id
    where not i.subtotal and h.tipo <> p_tipo;

  v_resultado := jsonb_build_object(
    'linhas', (select count(*) from _pa_imp),
    'subtotais_ignorados', (select count(*) from _pa_imp where subtotal),
    'nao_encontrados', v_nao_encontrados,
    'de_outro_tipo', v_outro_tipo,
    'total_valor', (select coalesce(sum(valor),0) from _pa_imp where not subtotal and centro_custo_id is not null),
    'previa', (select coalesce(jsonb_agg(jsonb_build_object('linha', ord, 'nome', nome, 'valor', valor,
                 'status', case when subtotal then 'subtotal' when centro_custo_id is null then 'nao_encontrado' else 'ok' end,
                 'centro_custo_id', centro_custo_id) order by ord), '[]') from _pa_imp));

  if jsonb_array_length(v_nao_encontrados) > 0 or jsonb_array_length(v_outro_tipo) > 0 or p_simular then
    return v_resultado || jsonb_build_object('gravado', false);
  end if;

  delete from cda_pa_realizado_mensal r using cda_pa_v_hierarquia h
   where r.centro_custo_id = h.centro_custo_id and h.tipo = p_tipo and r.ano = p_ano and r.mes = p_mes;
  get diagnostics v_removidos = row_count;

  insert into cda_pa_realizado_mensal (ano, mes, centro_custo_id, valor_realizado, origem, atualizado_por)
  select p_ano, p_mes, centro_custo_id, round(sum(valor), 2), 'excel', auth.jwt() ->> 'email'
  from _pa_imp where not subtotal group by centro_custo_id;
  get diagnostics v_gravados = row_count;

  return v_resultado || jsonb_build_object('gravado', true, 'removidos', v_removidos, 'gravados', v_gravados);
end $function$;

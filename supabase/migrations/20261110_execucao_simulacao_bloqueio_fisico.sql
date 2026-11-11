-- Preparação de executor transacional, deliberadamente sem capacidade de envio.
-- Bloqueio no banco garante que nem service_role pode habilitar por UPDATE.
create table if not exists public.cda_envio_lote_execucao_controle (
 lote_id bigint primary key references public.cda_envio_lotes(id) on delete restrict,
 habilitado boolean not null default false check (habilitado = false),
 autorizado_em timestamptz,
 autorizado_por uuid,
 atualizado_em timestamptz not null default now(),
 constraint cda_execucao_sem_autorizacao check (autorizado_em is null and autorizado_por is null)
);
alter table public.cda_envio_lote_execucao_controle enable row level security;
revoke all on public.cda_envio_lote_execucao_controle from anon,authenticated;
grant select on public.cda_envio_lote_execucao_controle to authenticated;
create policy cda_execucao_controle_leitura_equipe on public.cda_envio_lote_execucao_controle
 for select to authenticated using ((select public.cda_e_membro_equipe()));
-- Pré-voo de transação somente leitura, sem tentar reservar, processar ou enviar.
create or replace function public.cda_simular_execucao_lote(p_lote_id bigint)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
 v_lote record;
 v_total integer:=0; v_elegiveis integer:=0; v_bloqueados integer:=0;
 v_inativos integer:=0; v_suprimidos integer:=0; v_ja_processados integer:=0;
 v_snapshot jsonb:='[]'::jsonb;
begin
 select id,campanha_id,mensagem_id,modo,situacao into v_lote
 from public.cda_envio_lotes where id=p_lote_id;
 if not found then raise exception 'Lote não encontrado'; end if;
 if v_lote.modo<>'homologacao' then raise exception 'Modo não autorizado'; end if;
 select count(*),
 count(*) filter(where situacao='elegivel'),
 count(*) filter(where situacao='bloqueado'),
 count(*) filter(where situacao='inativo'),
 count(*) filter(where situacao='suprimido'),
 count(*) filter(where situacao='ja_processado'),
 coalesce(jsonb_agg(jsonb_build_object('item_id',id,'situacao',situacao) order by id),'[]'::jsonb)
 into v_total,v_elegiveis,v_bloqueados,v_inativos,v_suprimidos,v_ja_processados,v_snapshot
 from (
   select i.id,
    case
      when i.situacao<>'pendente' or i.tentativa_id is not null or i.resend_email_id is not null
       then 'ja_processado'
      when exists(select 1 from public.cda_email_supressoes s where s.email=lower(btrim(i.email)))
       then 'suprimido'
      when not exists(select 1 from public.cda_homologacao_destinatarios h
        where h.campanha_id=v_lote.campanha_id and h.ativo=true and lower(btrim(h.email))=lower(btrim(i.email)))
       then 'inativo'
      when i.email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
       then 'bloqueado'
      else 'elegivel'
    end situacao
   from public.cda_envio_lote_itens i where i.lote_id=p_lote_id
 ) classificados;
 return jsonb_build_object(
  'lote_id',p_lote_id,'modo','homologacao','situacao_lote',v_lote.situacao,
  'total',v_total,'elegiveis',v_elegiveis,'bloqueados',v_bloqueados,
  'inativos',v_inativos,'suprimidos',v_suprimidos,'ja_processados',v_ja_processados,
  'destinatarios',v_snapshot,'execucao_habilitada',false,'autorizacao_concedida',false,
  'simulacao',true,'chamadas_resend',0);
end $$;
revoke all on function public.cda_simular_execucao_lote(bigint) from public,anon,authenticated;
grant execute on function public.cda_simular_execucao_lote(bigint) to service_role;
-- Trava explícita: o futuro executor transacional não pode reivindicar itens até
-- uma revisão de segurança e nova migração autorizada que remova essa proibição.
create or replace function public.cda_reivindicar_item_lote(p_lote_id bigint)
returns jsonb language plpgsql security invoker set search_path='' as $$
begin
 raise exception 'EXECUTOR_BLOQUEADO: reivindicação e envio exigem implementação revisada e autorização explícita';
end $$;
revoke all on function public.cda_reivindicar_item_lote(bigint) from public,anon,authenticated;
grant execute on function public.cda_reivindicar_item_lote(bigint) to service_role;
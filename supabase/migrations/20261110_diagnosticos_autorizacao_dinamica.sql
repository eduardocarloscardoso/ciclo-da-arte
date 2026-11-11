-- Diagnósticos de homologação passam a refletir autorização real e expirável.
-- Nenhum lote é aprovado ou enviado por esta migração.
create or replace function public.cda_diagnosticar_executor_lote(p_lote_id bigint)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v record; v_total integer; v_pendentes integer;
 v_indeterminados integer; v_autorizado boolean;
begin
 select id,modo,situacao into v from public.cda_envio_lotes where id=p_lote_id;
 if not found or v.modo<>'homologacao' then raise exception 'Lote inválido'; end if;
 select count(*),count(*) filter(where situacao='pendente'),
   count(*) filter(where situacao in ('processando','indeterminado'))
   into v_total,v_pendentes,v_indeterminados
 from public.cda_envio_lote_itens where lote_id=p_lote_id;
 v_autorizado:=public.cda_lote_tem_autorizacao_valida(p_lote_id);
 return jsonb_build_object('lote_id',p_lote_id,'modo',v.modo,
   'situacao',v.situacao,'total',v_total,'pendentes',v_pendentes,
   'em_revisao',v_indeterminados,'trava_ativa',not v_autorizado,
   'pode_reivindicar',false,'pode_enviar',v_autorizado,
   'autorizado',v_autorizado,'requisicoes_resend',
   (select count(*) from public.cda_envio_lote_operacoes
     where lote_id=p_lote_id and estado<>'reservada'),
   'observacao',case when v_autorizado then
     'Executor condicionado a aprovação válida, fingerprint e prazo; enviar exige confirmação individual.'
   else 'Executor preparado; envio bloqueado até aprovação específica do lote.' end);
end $$;
create or replace function public.cda_diagnosticar_diario_lote(p_lote_id bigint)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_total bigint;v_diario bigint;v_indeterminadas bigint;
 v_chaves bigint;v_autorizado boolean;
begin
 if not exists(select 1 from public.cda_envio_lotes
   where id=p_lote_id and modo='homologacao') then
   raise exception 'Lote de homologação não encontrado';end if;
 select count(*),count(distinct chave_idempotencia)
   into v_total,v_chaves from public.cda_envio_lote_itens where lote_id=p_lote_id;
 select count(*),count(*) filter(where estado='indeterminada')
   into v_diario,v_indeterminadas from public.cda_envio_lote_operacoes
   where lote_id=p_lote_id;
 v_autorizado:=public.cda_lote_tem_autorizacao_valida(p_lote_id);
 return jsonb_build_object('lote_id',p_lote_id,'destinatarios',v_total,
   'chaves_unicas',v_chaves,'operacoes_registradas',v_diario,
   'resultados_indeterminados',v_indeterminadas,
   'envio_habilitado',v_autorizado,'autorizado',v_autorizado,
   'observacao','Diário transacional de idempotência; sem reenvio automático.');
end $$;
create or replace function public.cda_auditar_integridade_lote(p_lote_id bigint)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_total bigint;v_pendentes bigint;v_chaves bigint;
 v_tentativas bigint;v_resend bigint;v_ops bigint;
 v_ops_indeterminadas bigint;v_situacao text;v_autorizado boolean;
begin
 select situacao into v_situacao from public.cda_envio_lotes
   where id=p_lote_id and modo='homologacao';
 if not found then raise exception 'Lote de homologação não encontrado';end if;
 select count(*),count(*) filter(where situacao='pendente'),
   count(distinct chave_idempotencia),count(tentativa_id),count(resend_email_id)
   into v_total,v_pendentes,v_chaves,v_tentativas,v_resend
 from public.cda_envio_lote_itens where lote_id=p_lote_id;
 select count(*),count(*) filter(where estado='indeterminada')
   into v_ops,v_ops_indeterminadas
 from public.cda_envio_lote_operacoes where lote_id=p_lote_id;
 v_autorizado:=public.cda_lote_tem_autorizacao_valida(p_lote_id);
 return jsonb_build_object('lote_id',p_lote_id,'situacao',v_situacao,
   'destinatarios',v_total,'pendentes',v_pendentes,
   'chaves_unicas',v_chaves,'tentativas',v_tentativas,
   'resend_ids',v_resend,'operacoes',v_ops,
   'indeterminados',v_ops_indeterminadas,
   'chaves_consistentes',v_total=v_chaves,
   'sem_operacoes',v_ops=0,'envio_habilitado',v_autorizado);
end $$;
revoke all on function public.cda_diagnosticar_executor_lote(bigint) from public,anon,authenticated;
revoke all on function public.cda_diagnosticar_diario_lote(bigint) from public,anon,authenticated;
revoke all on function public.cda_auditar_integridade_lote(bigint) from public,anon,authenticated;
grant execute on function public.cda_diagnosticar_executor_lote(bigint) to service_role;
grant execute on function public.cda_diagnosticar_diario_lote(bigint) to service_role;
grant execute on function public.cda_auditar_integridade_lote(bigint) to service_role;

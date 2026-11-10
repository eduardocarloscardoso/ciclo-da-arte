-- Estado sem volta: registra a intenção de envio ANTES de HTTP.
-- Chamada ainda inacessível pelo executor, que responde 423 em 'enviar'.
create or replace function public.cda_marcar_solicitacao_lote(
 p_lote_id bigint, p_item_id bigint, p_payload_sha256 text
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_item public.cda_envio_lote_itens%rowtype;
  v_op public.cda_envio_lote_operacoes%rowtype;
begin
 if p_payload_sha256 is null or p_payload_sha256 !~ '^[0-9a-f]{64}$' then
  raise exception 'Hash de payload inválido';
 end if;
 -- Mesmo que reservada, nunca solicitar sem lote preparado e controle ativo.
 if not exists(select 1 from public.cda_envio_lote_execucao_controle c
  join public.cda_envio_lotes l on l.id=c.lote_id
  where l.id=p_lote_id and l.modo='homologacao' and l.situacao='preparado'
   and c.habilitado and c.autorizado_em is not null and c.autorizado_por is not null) then
  raise exception 'EXECUTOR_BLOQUEADO: requisição ao provedor não autorizada';
 end if;
 select * into v_item from public.cda_envio_lote_itens
   where lote_id=p_lote_id and id=p_item_id for update;
 if not found or v_item.situacao<>'processando' then
  raise exception 'Item não está reservado';
 end if;
 select * into v_op from public.cda_envio_lote_operacoes
   where lote_id=p_lote_id and item_id=p_item_id for update;
 if not found or v_op.estado<>'reservada' or
   v_op.tentativa_id is null or v_op.tentativa_id<>v_item.tentativa_id or
   v_op.payload_sha256 is distinct from p_payload_sha256 then
  raise exception 'Diário divergente ou requisição já iniciada';
 end if;
 update public.cda_envio_lote_operacoes set estado='solicitada',
   atualizado_em=now() where id=v_op.id;
 return jsonb_build_object('item_id',p_item_id,'solicitada',true,
   'chave_idempotencia',v_op.chave_idempotencia,
   'reenvio_automatico',false);
end $$;
revoke all on function public.cda_marcar_solicitacao_lote(bigint,bigint,text)
 from public,anon,authenticated;
grant execute on function public.cda_marcar_solicitacao_lote(bigint,bigint,text)
 to service_role;

-- Ajusta conclusão: aceita/indeterminada SOMENTE após marcar solicitação.
-- Falha antes de solicitar é permitida apenas no estado reservado.
create or replace function public.cda_concluir_tentativa_lote(
 p_lote_id bigint, p_item_id bigint, p_resultado text,
 p_resend_email_id text default null, p_erro text default null
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_op public.cda_envio_lote_operacoes%rowtype;
  v_item public.cda_envio_lote_itens%rowtype;
  v_situacao text;
begin
 if p_resultado not in ('aceita','falha','indeterminada') or
    p_lote_id is null or p_item_id is null then
   raise exception 'Resultado inválido';
 end if;
 select * into v_item from public.cda_envio_lote_itens
   where id=p_item_id and lote_id=p_lote_id for update;
 if not found then raise exception 'Item inexistente'; end if;
 select * into v_op from public.cda_envio_lote_operacoes
   where item_id=p_item_id and lote_id=p_lote_id for update;
 if not found or v_op.estado not in ('reservada','solicitada') or
   v_op.tentativa_id is null or v_op.tentativa_id <> v_item.tentativa_id then
   raise exception 'Operação ausente ou finalizada; não repetir';
 end if;
 if p_resultado in ('aceita','indeterminada') and v_op.estado<>'solicitada' then
   raise exception 'Solicitação ainda não iniciada, não concluir como aceita ou incerta';
 end if;
 if p_resultado='aceita' and (p_resend_email_id is null
   or btrim(p_resend_email_id)='') then
   raise exception 'Provedor aceitou mas não retornou ID';
 end if;
 if p_resultado<>'aceita' and p_resend_email_id is not null then
   raise exception 'ID do provedor inconsistente';
 end if;
 v_situacao:=case when p_resultado='aceita' then 'aceito'
   when p_resultado='falha' then 'falha' else 'indeterminado' end;
 update public.cda_envio_lote_operacoes
  set estado=p_resultado,resend_email_id=p_resend_email_id,
    atualizado_em=now() where id=v_op.id;
 update public.cda_envio_lote_itens
  set situacao=v_situacao,resend_email_id=p_resend_email_id,
    fim_processamento_em=now(),aceito_em=case when p_resultado='aceita' then now() else null end,
    erro=left(p_erro,500),atualizado_em=now() where id=p_item_id;
 update public.cda_email_tentativas
  set situacao=case when p_resultado='aceita' then 'aceito_provedor'
    when p_resultado='falha' then 'rejeitado_provedor' else 'falha_tecnica' end,
    resend_email_id=p_resend_email_id,
    erro=case when p_resultado='indeterminada' then
      'RESULTADO INDETERMINADO: NÃO REENVIAR AUTOMATICAMENTE. '||left(coalesce(p_erro,''),350)
      else left(p_erro,500) end,
    atualizado_em=now() where id=v_op.tentativa_id;
 return jsonb_build_object('lote_id',p_lote_id,'item_id',p_item_id,
   'estado',v_situacao,'resend_email_id',p_resend_email_id,'reenvio_automatico',false);
end $$;
revoke all on function public.cda_concluir_tentativa_lote(bigint,bigint,text,text,text)
 from public,anon,authenticated;
grant execute on function public.cda_concluir_tentativa_lote(bigint,bigint,text,text,text)
 to service_role;

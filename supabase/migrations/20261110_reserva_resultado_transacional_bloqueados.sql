-- Fase 2: preparação transacional da futura transmissão individual.
-- SEM autorização: constraints de cda_envio_lote_execucao_controle impedem uso real.
-- Esta migração NÃO altera essas constraints e NÃO envia e-mails.
create or replace function public.cda_reservar_tentativa_lote(
  p_lote_id bigint, p_item_id bigint, p_payload_sha256 text
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  v_lote public.cda_envio_lotes%rowtype;
  v_item public.cda_envio_lote_itens%rowtype;
  v_controle public.cda_envio_lote_execucao_controle%rowtype;
  v_tentativa_id bigint;
begin
  if p_lote_id is null or p_lote_id < 1 or p_item_id is null or p_item_id < 1
     or p_payload_sha256 is null or p_payload_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'Parâmetros inválidos';
  end if;
  select * into v_lote from public.cda_envio_lotes
   where id=p_lote_id and modo='homologacao' for update;
  if not found or v_lote.situacao <> 'preparado' then
    raise exception 'Lote de homologação não preparado';
  end if;
  select * into v_controle from public.cda_envio_lote_execucao_controle
   where lote_id=p_lote_id for update;
  -- Este teste TEM de ocorrer antes de qualquer gravação.
  if not found or v_controle.habilitado is distinct from true or
    v_controle.autorizado_em is null or v_controle.autorizado_por is null then
    raise exception 'EXECUTOR_BLOQUEADO: nenhuma tentativa pode ser reservada';
  end if;
  select * into v_item from public.cda_envio_lote_itens
   where lote_id=p_lote_id and id=p_item_id for update;
  if not found or v_item.situacao <> 'pendente' or
     v_item.tentativa_id is not null or v_item.resend_email_id is not null or
     v_item.inicio_processamento_em is not null then
    raise exception 'Item indisponível ou já utilizado';
  end if;
  if exists(select 1 from public.cda_envio_lote_operacoes
     where item_id=v_item.id or chave_idempotencia=v_item.chave_idempotencia) then
    raise exception 'Operação já registrada: não repetir';
  end if;
  if v_item.email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
    or not exists(select 1 from public.cda_homologacao_destinatarios h
      where h.campanha_id=v_lote.campanha_id and h.ativo
        and lower(btrim(h.email))=lower(btrim(v_item.email)))
    or exists(select 1 from public.cda_email_supressoes s
      where lower(btrim(s.email))=lower(btrim(v_item.email))) then
    raise exception 'Destinatário não elegível ou suprimido';
  end if;
  if not exists(select 1 from public.cda_campanha_mensagens m
    where m.id=v_lote.mensagem_id and m.campanha_id=v_lote.campanha_id) then
    raise exception 'Mensagem não pertence à campanha';
  end if;
  -- No mesmo COMMIT: tentativa + diário + status; ou nenhum deles.
  insert into public.cda_email_tentativas
    (campanha_id,mensagem_id,tipo,destinatarios,situacao)
    values(v_lote.campanha_id,v_lote.mensagem_id,'teste',
      array[lower(btrim(v_item.email))],'solicitado')
    returning id into v_tentativa_id;
  insert into public.cda_envio_lote_operacoes
    (lote_id,item_id,chave_idempotencia,estado,tentativa_id,payload_sha256)
  values(p_lote_id,v_item.id,v_item.chave_idempotencia,'reservada',
    v_tentativa_id,p_payload_sha256);
  update public.cda_envio_lote_itens
    set situacao='processando',tentativa_id=v_tentativa_id,
      inicio_processamento_em=now(),atualizado_em=now()
   where id=v_item.id and situacao='pendente';
  if not found then raise exception 'Concorrência na reserva'; end if;
  return jsonb_build_object('lote_id',p_lote_id,'item_id',v_item.id,
    'tentativa_id',v_tentativa_id,
    'chave_idempotencia',v_item.chave_idempotencia,
    'payload_sha256',p_payload_sha256,'envio_realizado',false);
end $$;
revoke all on function public.cda_reservar_tentativa_lote(bigint,bigint,text)
 from public,anon,authenticated;
grant execute on function public.cda_reservar_tentativa_lote(bigint,bigint,text)
 to service_role;

-- Desabilita o claim antigo, que não gerava tentativa/diário no mesmo commit.
-- Sem rota de bypass caso a autorização seja implementada no futuro.
create or replace function public.cda_reivindicar_item_lote(p_lote_id bigint)
returns jsonb language plpgsql security invoker set search_path='' as $$
begin
 raise exception 'CLAIM_OBSOLETO_BLOQUEADO: usar reserva transacional auditada após autorização';
end $$;
revoke all on function public.cda_reivindicar_item_lote(bigint) from public,anon,authenticated;
grant execute on function public.cda_reivindicar_item_lote(bigint) to service_role;

-- Escrita do resultado futuro: nunca permite substituir um resultado concluído.
-- O chamador futuro deverá registrar situação 'solicitada' antes da chamada HTTP.
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

-- Checagem de autorização individual, prazo e fingerprint em cada etapa de escrita.
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
   if public.cda_lote_tem_autorizacao_valida(p_lote_id) is distinct from true then
   raise exception 'EXECUTOR_BLOQUEADO: aprovação de lote ausente, expirada ou divergente';
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
create or replace function public.cda_marcar_solicitacao_lote(
 p_lote_id bigint, p_item_id bigint, p_payload_sha256 text
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare
 v_lote public.cda_envio_lotes%rowtype;
 v_controle public.cda_envio_lote_execucao_controle%rowtype;
 v_item public.cda_envio_lote_itens%rowtype;
 v_op public.cda_envio_lote_operacoes%rowtype;
begin
 if p_lote_id is null or p_item_id is null or
    p_payload_sha256 is null or p_payload_sha256 !~ '^[0-9a-f]{64}$' then
  raise exception 'Parâmetros inválidos';
 end if;
 select * into v_lote from public.cda_envio_lotes
  where id=p_lote_id and modo='homologacao' for update;
 if not found or v_lote.situacao<>'preparado' then
  raise exception 'Lote não está preparado';
 end if;
 select * into v_controle from public.cda_envio_lote_execucao_controle
  where lote_id=p_lote_id for update;
 if not found or v_controle.habilitado is distinct from true or
   v_controle.autorizado_em is null or v_controle.autorizado_por is null then
  raise exception 'EXECUTOR_BLOQUEADO: requisição ao provedor não autorizada';
 end if;
  if public.cda_lote_tem_autorizacao_valida(p_lote_id) is distinct from true then
   raise exception 'EXECUTOR_BLOQUEADO: aprovação de lote ausente, expirada ou divergente';
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
 if exists(select 1 from public.cda_email_supressoes s
   where lower(btrim(s.email))=lower(btrim(v_item.email))) or
   not exists(select 1 from public.cda_homologacao_destinatarios h
     where h.campanha_id=v_lote.campanha_id and h.ativo
       and lower(btrim(h.email))=lower(btrim(v_item.email))) then
  raise exception 'Destinatário removido ou suprimido antes de solicitar';
 end if;
 update public.cda_envio_lote_operacoes set estado='solicitada',
   atualizado_em=now() where id=v_op.id;
 return jsonb_build_object('item_id',p_item_id,'solicitada',true,
   'chave_idempotencia',v_op.chave_idempotencia,
   'reenvio_automatico',false);
end $$;

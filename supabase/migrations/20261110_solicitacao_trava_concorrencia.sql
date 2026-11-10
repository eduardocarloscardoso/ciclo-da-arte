-- Correção de concorrência: travar lote e controle na mesma ordem da reserva
-- antes de permitir o estágio "solicitada". Sem liberação de execução.
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
revoke all on function public.cda_marcar_solicitacao_lote(bigint,bigint,text)
 from public,anon,authenticated;
grant execute on function public.cda_marcar_solicitacao_lote(bigint,bigint,text)
 to service_role;
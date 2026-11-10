-- Reconciliação somente de eventos Resend previamente autenticados pelo webhook
-- e salvos em cda_email_eventos. Sem disparos ou habilitação.
create or replace function public.cda_reconciliar_evento_lote(
 p_svix_id text
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare
 v_event public.cda_email_eventos%rowtype;
 v_op public.cda_envio_lote_operacoes%rowtype;
 v_item public.cda_envio_lote_itens%rowtype;
 v_item_id bigint;
 v_prioridade_atual integer;
 v_prioridade_nova integer;
 v_nova_situacao text;
 v_novo_estado text;
begin
 if p_svix_id is null or length(p_svix_id) < 4 or length(p_svix_id) > 256 then
   raise exception 'Identificador de evento inválido';
 end if;
 select * into v_event from public.cda_email_eventos where svix_id=p_svix_id;
 if not found then return jsonb_build_object('aplicado',false,'motivo','evento_ausente'); end if;
 -- Eventos de tentativas comuns antigas NÃO pertencem a lote.
 select o.item_id into v_item_id from public.cda_envio_lote_operacoes o
   join public.cda_envio_lotes l on l.id=o.lote_id and l.modo='homologacao'
   where o.resend_email_id=v_event.resend_email_id and
         o.tentativa_id=v_event.tentativa_id
   limit 1;
 if not found then return jsonb_build_object('aplicado',false,'motivo','sem_item_lote'); end if;

 -- Mesma ordem de lock do finalizador (item -> operação).
 select * into v_item from public.cda_envio_lote_itens
   where id=v_item_id for update;
 select * into v_op from public.cda_envio_lote_operacoes
   where item_id=v_item_id and resend_email_id=v_event.resend_email_id
     and tentativa_id=v_event.tentativa_id for update;
 if not found or v_item.tentativa_id is distinct from v_event.tentativa_id
   or v_item.resend_email_id is distinct from v_event.resend_email_id then
   raise exception 'Divergência entre tentativa, operação e item';
 end if;
 if v_item.situacao not in
   ('aceito','atrasado','entregue','devolvido','reclamacao') then
   return jsonb_build_object('aplicado',false,'motivo','estado_incompativel');
 end if;
 v_prioridade_atual:=case v_item.situacao
   when 'reclamacao' then 4 when 'devolvido' then 3
   when 'entregue' then 2 when 'atrasado' then 1 else 0 end;
 v_prioridade_nova:=case v_event.tipo
   when 'email.complained' then 4 when 'email.bounced' then 3
   when 'email.delivered' then 2 when 'email.delivery_delayed' then 1 else -1 end;
 if v_prioridade_nova < 0 then
   return jsonb_build_object('aplicado',false,'motivo','tipo_ignorado');
 end if;
 if v_prioridade_nova < v_prioridade_atual then
   return jsonb_build_object('aplicado',false,'motivo','evento_anterior_prioridade');
 end if;
 v_nova_situacao:=case v_prioridade_nova
   when 4 then 'reclamacao' when 3 then 'devolvido'
   when 2 then 'entregue' else 'atrasado' end;
 v_novo_estado:=case v_prioridade_nova
   when 4 then 'reclamacao' when 3 then 'devolvida'
   when 2 then 'entregue' else 'aceita' end;
 update public.cda_envio_lote_itens
   set situacao=v_nova_situacao,ultimo_evento=v_event.tipo,
     entregue_em=case when v_event.tipo='email.delivered'
       then v_event.ocorrido_em else entregue_em end,
     atualizado_em=now()
   where id=v_item.id;
 update public.cda_envio_lote_operacoes
   set estado=v_novo_estado,atualizado_em=now() where id=v_op.id;
 return jsonb_build_object('aplicado',true,'lote_id',v_op.lote_id,
   'item_id',v_op.item_id,'situacao',v_nova_situacao,
   'sem_nova_tentativa',true);
end $$;
revoke all on function public.cda_reconciliar_evento_lote(text)
 from public,anon,authenticated;
grant execute on function public.cda_reconciliar_evento_lote(text)
 to service_role;
-- Executor de homologação: fortalecer vínculo lote/item e impedir ID Resend duplicado.
-- Não habilita envio, não cria operações e não altera os cinco itens existentes.
alter table public.cda_envio_lote_itens
  add constraint cda_envio_lote_itens_lote_id_id_unico unique(lote_id,id);

alter table public.cda_envio_lote_operacoes
  add constraint cda_operacao_lote_item_integridade
  foreign key (lote_id,item_id)
  references public.cda_envio_lote_itens(lote_id,id) on delete restrict;

create unique index cda_operacao_resend_email_id_unico
  on public.cda_envio_lote_operacoes(resend_email_id)
  where resend_email_id is not null;

-- Consulta dos indicadores de integridade, sem escrita.
create or replace function public.cda_auditar_integridade_lote(p_lote_id bigint)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  v_total bigint;
  v_pendentes bigint;
  v_chaves bigint;
  v_tentativas bigint;
  v_resend bigint;
  v_ops bigint;
  v_ops_indeterminadas bigint;
  v_situacao text;
begin
  select situacao into v_situacao from public.cda_envio_lotes
  where id=p_lote_id and modo='homologacao';
  if not found then raise exception 'Lote de homologação não encontrado'; end if;
  select count(*),count(*) filter(where situacao='pendente'),
   count(distinct chave_idempotencia),count(tentativa_id),count(resend_email_id)
   into v_total,v_pendentes,v_chaves,v_tentativas,v_resend
  from public.cda_envio_lote_itens where lote_id=p_lote_id;
  select count(*),count(*) filter(where estado='indeterminada')
   into v_ops,v_ops_indeterminadas
  from public.cda_envio_lote_operacoes where lote_id=p_lote_id;
  return jsonb_build_object(
   'lote_id',p_lote_id,'situacao',v_situacao,'destinatarios',v_total,
   'pendentes',v_pendentes,'chaves_unicas',v_chaves,'tentativas',v_tentativas,
   'resend_ids',v_resend,'operacoes',v_ops,'indeterminados',v_ops_indeterminadas,
   'chaves_consistentes',v_total=v_chaves,
   'sem_operacoes',v_ops=0,'envio_habilitado',false);
end $$;
revoke all on function public.cda_auditar_integridade_lote(bigint) from public,anon,authenticated;
grant execute on function public.cda_auditar_integridade_lote(bigint) to service_role;
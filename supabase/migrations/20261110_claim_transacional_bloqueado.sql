-- Ciclo da Arte · estrutura de reivindicação transacional de lote.
-- NÃO LIBERA EXECUÇÃO: constraint habilitado=false permanece intacta.
-- NÃO envia e-mails; NÃO grava tentativas Resend.
create or replace function public.cda_reivindicar_item_lote(p_lote_id bigint)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  v_lote public.cda_envio_lotes%rowtype;
  v_controle public.cda_envio_lote_execucao_controle%rowtype;
  v_item public.cda_envio_lote_itens%rowtype;
begin
  if p_lote_id is null or p_lote_id < 1 then
    raise exception 'Lote inválido';
  end if;
  -- Exclusão por lote: impede decisão concorrente de interrupção durante o claim.
  select * into v_lote from public.cda_envio_lotes
  where id=p_lote_id and modo='homologacao' for update;
  if not found then raise exception 'Lote de homologação não encontrado'; end if;
  if v_lote.situacao <> 'preparado' then raise exception 'Lote não está preparado'; end if;

  -- Camada de autorização: linha inexiste até autorização futura.
  -- CHECK (habilitado=false) e CHECK (autorizado_em/por IS NULL)
  -- impedem que esse caminho seja aberto por qualquer UPDATE.
  select * into v_controle from public.cda_envio_lote_execucao_controle
  where lote_id=p_lote_id for update;
  if not found or v_controle.habilitado is distinct from true
    or v_controle.autorizado_em is null or v_controle.autorizado_por is null then
    raise exception 'EXECUTOR_BLOQUEADO: nenhuma reivindicação permitida sem autorização revisada';
  end if;

  -- Só será alcançável por migração futura aprovada com revisão completa.
  -- A seleção considera o cadastro vivo e a lista de supressões.
  select i.* into v_item
  from public.cda_envio_lote_itens i
  where i.lote_id=p_lote_id
    and i.situacao='pendente'
    and i.tentativa_id is null and i.resend_email_id is null
    and i.inicio_processamento_em is null
    and i.email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
    and exists (
      select 1 from public.cda_homologacao_destinatarios h
      where h.campanha_id=v_lote.campanha_id and h.ativo=true
        and lower(btrim(h.email))=lower(btrim(i.email))
    )
    and not exists (
      select 1 from public.cda_email_supressoes s
      where lower(btrim(s.email))=lower(btrim(i.email))
    )
  order by i.id
  for update of i skip locked
  limit 1;

  if not found then
    return jsonb_build_object('lote_id',p_lote_id,'item_disponivel',false,'envio_realizado',false);
  end if;

  update public.cda_envio_lote_itens
    set situacao='processando',
        inicio_processamento_em=now(), atualizado_em=now()
  where id=v_item.id and situacao='pendente';
  if not found then raise exception 'Concorrência: item indisponível'; end if;
  -- A chave original é estável e jamais regenerada após timeout.
  -- Não retomar automaticamente itens processando/indeterminado.
  return jsonb_build_object('lote_id',p_lote_id,'item_disponivel',true,
    'item_id',v_item.id,'chave_idempotencia',v_item.chave_idempotencia,
    'envio_realizado',false);
end $$;
revoke all on function public.cda_reivindicar_item_lote(bigint) from public,anon,authenticated;
grant execute on function public.cda_reivindicar_item_lote(bigint) to service_role;

-- Diagnóstico consultivo, não cria linha de autorização nem reivindica itens.
create or replace function public.cda_diagnosticar_executor_lote(p_lote_id bigint)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v record;v_total integer;v_pendentes integer;v_indeterminados integer;
begin
  select id,modo,situacao into v from public.cda_envio_lotes where id=p_lote_id;
  if not found or v.modo<>'homologacao' then raise exception 'Lote inválido'; end if;
  select count(*),count(*) filter(where situacao='pendente'),
    count(*) filter(where situacao in ('processando','indeterminado'))
    into v_total,v_pendentes,v_indeterminados
  from public.cda_envio_lote_itens where lote_id=p_lote_id;
  return jsonb_build_object('lote_id',p_lote_id,'modo',v.modo,
    'situacao',v.situacao,'total',v_total,'pendentes',v_pendentes,
    'em_revisao',v_indeterminados,
    'trava_ativa',true,'pode_reivindicar',false,'pode_enviar',false,
    'requisicoes_resend',0,
    'observacao','Reivindicação transacional preparada, mas fisicamente bloqueada. Sem executor Resend.');
end $$;
revoke all on function public.cda_diagnosticar_executor_lote(bigint) from public,anon,authenticated;
grant execute on function public.cda_diagnosticar_executor_lote(bigint) to service_role;

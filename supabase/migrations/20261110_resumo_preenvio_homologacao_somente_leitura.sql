-- Resumo read-only para futura confirmação humana da homologação.
-- Não cria autorização nem modifica o controle de envio.
create or replace function public.cda_resumo_preenvio_homologacao(p_lote_id bigint)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
 v_lote record;
 v_destinos jsonb;
 v_total bigint;
 v_pendentes bigint;
 v_tem_ops boolean;
 v_controle record;
begin
 select l.id,l.campanha_id,l.mensagem_id,l.situacao,
   c.nome as campanha_nome,m.nome as mensagem_nome,m.assunto
 into v_lote
 from public.cda_envio_lotes l
 join public.cda_campanhas c on c.id=l.campanha_id
 join public.cda_campanha_mensagens m
   on m.id=l.mensagem_id and m.campanha_id=l.campanha_id
 where l.id=p_lote_id and l.modo='homologacao';
 if not found then raise exception 'Lote de homologação inválido'; end if;
 select coalesce(jsonb_agg(jsonb_build_object(
   'item_id',i.id,'nome',i.nome,'email',i.email,'situacao',i.situacao
 ) order by i.id),'[]'::jsonb), count(*),
 count(*) filter(where i.situacao='pendente')
 into v_destinos,v_total,v_pendentes
 from public.cda_envio_lote_itens i where i.lote_id=p_lote_id;
 select exists(select 1 from public.cda_envio_lote_operacoes
    where lote_id=p_lote_id) into v_tem_ops;
 select habilitado,autorizado_em,autorizado_por into v_controle
 from public.cda_envio_lote_execucao_controle where lote_id=p_lote_id;
 return jsonb_build_object(
  'lote_id',v_lote.id,'campanha_id',v_lote.campanha_id,
  'campanha_nome',v_lote.campanha_nome,'mensagem_id',v_lote.mensagem_id,
  'mensagem_nome',v_lote.mensagem_nome,'assunto',v_lote.assunto,
  'modo','homologacao','situacao',v_lote.situacao,'destinatarios',v_destinos,
  'total',v_total,'pendentes',v_pendentes,
  'tem_operacoes',v_tem_ops,
  'autorizado',coalesce(v_controle.habilitado,false)
     and v_controle.autorizado_em is not null
     and v_controle.autorizado_por is not null,
  'envio_habilitado',false,
  'observacao','Consulta para revisão, nenhuma autorização ou envio nesta etapa'
 );
end $$;
revoke all on function public.cda_resumo_preenvio_homologacao(bigint)
 from public,anon,authenticated;
grant execute on function public.cda_resumo_preenvio_homologacao(bigint)
 to service_role;
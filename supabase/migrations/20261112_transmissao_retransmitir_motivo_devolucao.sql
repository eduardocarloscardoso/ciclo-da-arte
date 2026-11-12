-- 12/11/2026 — Motivo da devolução e Retransmissão (decisões do usuário).
-- 1) O webhook passa a gravar o motivo da devolução informado pelo Resend.
-- 2) Retransmitir: nova transmissão com o MESMO público da anterior (sem suprimidos),
--    com a mensagem escolhida (a mesma ou uma cópia da Biblioteca). A anterior é encerrada.
-- Nenhum envio é feito por esta migração.

alter table public.cda_transmissao_envio_eventos add column if not exists motivo text;

drop function if exists public.cda_oficial_registrar_evento(text,text,text,timestamptz);
create or replace function public.cda_oficial_registrar_evento(p_svix_id text, p_resend_email_id text,
  p_tipo text, p_ocorrido_em timestamptz, p_motivo text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_e public.cda_transmissao_envios%rowtype; v_atual int; v_novo int; v_estado text;
begin
  select * into v_e from public.cda_transmissao_envios where resend_email_id=p_resend_email_id for update;
  if not found then return jsonb_build_object('aplicado',false,'motivo','sem_envio_oficial'); end if;
  insert into public.cda_transmissao_envio_eventos(envio_id,svix_id,resend_email_id,tipo,ocorrido_em,motivo)
    values(v_e.id,p_svix_id,p_resend_email_id,p_tipo,p_ocorrido_em,left(p_motivo,500)) on conflict (svix_id) do nothing;
  if not found then return jsonb_build_object('aplicado',false,'motivo','duplicado'); end if;
  v_atual:=case v_e.estado when 'reclamacao' then 4 when 'devolvida' then 3 when 'entregue' then 2
    when 'atrasado' then 1 else 0 end;
  v_novo:=case p_tipo when 'email.complained' then 4 when 'email.bounced' then 3
    when 'email.delivered' then 2 when 'email.delivery_delayed' then 1 else -1 end;
  if v_novo in (3,4) then
    insert into public.cda_email_supressoes(email,motivo)
      values(lower(btrim(v_e.email)),case v_novo when 4 then 'reclamacao_spam' else 'devolucao' end)
      on conflict (email) do nothing;
  end if;
  if v_novo<v_atual or v_novo<0 then return jsonb_build_object('aplicado',false,'motivo','prioridade'); end if;
  v_estado:=case v_novo when 4 then 'reclamacao' when 3 then 'devolvida' when 2 then 'entregue' else 'atrasado' end;
  update public.cda_transmissao_envios set estado=v_estado,ultimo_evento=p_tipo,ultimo_evento_em=p_ocorrido_em,
    erro=case when v_novo in (3,4) and p_motivo is not null then left(p_motivo,500) else erro end
   where id=v_e.id;
  return jsonb_build_object('aplicado',true,'envio_id',v_e.id,'estado',v_estado);
end $$;
revoke all on function public.cda_oficial_registrar_evento(text,text,text,timestamptz,text) from public, anon, authenticated;
grant execute on function public.cda_oficial_registrar_evento(text,text,text,timestamptz,text) to service_role;

create or replace function public.cda_oficial_retransmitir(p_origem bigint, p_mensagem_id bigint, p_usuario uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_o public.cda_transmissoes_oficiais%rowtype; v_m public.cda_campanha_mensagens%rowtype;
  v_c public.cda_campanhas%rowtype; v_b4 public.cda_transmissao_controles_b4%rowtype;
  v_novo bigint; v_aptos int; v_lotes int; v_sha text; v_tam int; v_excl int;
begin
  if p_usuario is null then raise exception 'Usuário obrigatório'; end if;
  select * into v_o from public.cda_transmissoes_oficiais where id=p_origem for update;
  if not found or v_o.situacao not in ('congelada','encerrada') then raise exception 'Transmissão de origem inválida'; end if;
  if exists(select 1 from public.cda_transmissao_lote_itens i join public.cda_transmissao_lotes l on l.id=i.lote_id
     where l.transmissao_id=v_o.id and i.situacao='pendente'
       and not exists(select 1 from public.cda_transmissao_envios e where e.item_id=i.id)) then
    raise exception 'A transmissão de origem ainda tem destinatários não enviados';
  end if;
  if exists(select 1 from public.cda_transmissao_envios where transmissao_id=v_o.id and estado='solicitada') then
    raise exception 'Há envio em processamento na transmissão de origem';
  end if;
  select * into v_m from public.cda_campanha_mensagens where id=p_mensagem_id and campanha_id=v_o.campanha_id;
  if not found then raise exception 'Mensagem não pertence à campanha'; end if;
  if coalesce(btrim(v_m.assunto),'')='' or coalesce(btrim(v_m.conteudo->>'texto'),'')='' then
    raise exception 'Mensagem sem assunto ou texto'; end if;
  select * into v_c from public.cda_campanhas where id=v_o.campanha_id;
  -- Encerra a origem (histórico preservado).
  update public.cda_transmissoes_oficiais set situacao='encerrada',atualizado_em=now() where id=v_o.id and situacao='congelada';
  update public.cda_transmissao_lotes set situacao='encerrado' where transmissao_id=v_o.id and situacao='preparado';
  update public.cda_transmissao_autorizacoes set revogado_em=now(),revogado_por=p_usuario,motivo_revogacao='encerrada'
   where transmissao_id=v_o.id and revogado_em is null;
  -- Mesmo público da origem, sem descadastrados/devolvidos/reclamações.
  create temp table tmp_publico on commit drop as
    select i.campanha_destinatario_id,i.cliente_id,lower(btrim(i.email_snapshot)) email,i.nome_snapshot nome,
      row_number() over(order by min(i.id)) pos
    from public.cda_transmissao_lote_itens i join public.cda_transmissao_lotes l on l.id=i.lote_id
    where l.transmissao_id=v_o.id
      and not exists(select 1 from public.cda_email_supressoes s where s.email=lower(btrim(i.email_snapshot)))
    group by i.campanha_destinatario_id,i.cliente_id,lower(btrim(i.email_snapshot)),i.nome_snapshot;
  select count(*) into v_aptos from tmp_publico;
  select count(distinct i.id) into v_excl from public.cda_transmissao_lote_itens i join public.cda_transmissao_lotes l on l.id=i.lote_id
    where l.transmissao_id=v_o.id;
  v_excl:=v_excl-v_aptos;
  if v_aptos=0 then raise exception 'Nenhum destinatário elegível'; end if;
  v_tam:=v_o.tamanho_lote; v_lotes:=ceil(v_aptos::numeric/v_tam)::int;
  v_sha:=encode(extensions.digest(concat_ws('|',coalesce(v_m.assunto,''),coalesce(v_m.conteudo::text,''),
      coalesce(v_m.remetente_nome,''),coalesce(v_m.remetente_email,''),coalesce(v_m.responder_para,''),
      coalesce(v_c.lgpd_base_legal,''),coalesce(v_c.lgpd_finalidade_fundamentacao,'')),'sha256'),'hex');
  insert into public.cda_transmissoes_oficiais(campanha_id,mensagem_id,nome,canal,situacao,tamanho_lote,
     base_legal_snapshot,finalidade_snapshot,conteudo_sha256,assunto_snapshot,conteudo_snapshot,remetente_snapshot,
     congelado_em,total_previsto,total_excluidos,criado_por,habilitado,validacao_lgpd_pendente)
   values(v_o.campanha_id,v_m.id,'Retransmissão · '||v_c.nome||' · '||v_m.nome,'email','congelada',v_tam,
     v_c.lgpd_base_legal,v_c.lgpd_finalidade_fundamentacao,v_sha,v_m.assunto,v_m.conteudo,
     jsonb_build_object('nome',v_m.remetente_nome,'email',v_m.remetente_email,'reply_to',v_m.responder_para),
     now(),v_aptos,v_excl,p_usuario,false,v_o.validacao_lgpd_pendente)
   returning id into v_novo;
  insert into public.cda_transmissao_lotes(transmissao_id,numero,situacao,total,habilitado)
    select v_novo,n,'preparado',least(v_tam,v_aptos-(n-1)*v_tam),false from generate_series(1,v_lotes) n;
  insert into public.cda_transmissao_lote_itens(lote_id,campanha_destinatario_id,cliente_id,email_snapshot,nome_snapshot,situacao)
    select l.id,p.campanha_destinatario_id,p.cliente_id,p.email,p.nome,'pendente'
    from tmp_publico p join public.cda_transmissao_lotes l on l.transmissao_id=v_novo and l.numero=((p.pos-1)/v_tam)+1;
  -- Mesmos controles de ritmo da origem.
  select * into v_b4 from public.cda_transmissao_controles_b4 where transmissao_id=v_o.id;
  if found then
    insert into public.cda_transmissao_controles_b4(transmissao_id,estado,max_por_minuto,max_por_hora,max_por_dia,max_por_lote,atualizado_por,atualizado_em,habilitado)
      values(v_novo,v_b4.estado,v_b4.max_por_minuto,v_b4.max_por_hora,v_b4.max_por_dia,v_b4.max_por_lote,p_usuario,now(),false);
  end if;
  insert into public.cda_transmissao_auditoria(transmissao_id,lote_id,acao,detalhe,registrado_por) values
   (v_o.id,null,'oficial_encerrada_por_retransmissao',jsonb_build_object('nova_transmissao',v_novo),p_usuario),
   (v_novo,null,'oficial_retransmissao_criada',jsonb_build_object('origem',v_o.id,'mensagem_id',v_m.id,
     'destinatarios',v_aptos,'excluidos_supressao',v_excl,'lotes',v_lotes,'conteudo_sha256',v_sha,
     'lgpd','confirmação herdada da transmissão de origem'),p_usuario);
  return jsonb_build_object('transmissao_id',v_novo,'mensagem_id',v_m.id,'destinatarios',v_aptos,'excluidos',v_excl,'lotes',v_lotes);
end $$;
revoke all on function public.cda_oficial_retransmitir(bigint,bigint,uuid) from public, anon, authenticated;
grant execute on function public.cda_oficial_retransmitir(bigint,bigint,uuid) to service_role;

-- Painel passa a listar as mensagens da campanha (para escolher na retransmissão) e pendentes.
create or replace function public.cda_oficial_painel(p_transmissao_id bigint)
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object(
    'transmissao_id',t.id,'situacao',t.situacao,'lgpd_pendente',t.validacao_lgpd_pendente,
    'base_legal',t.base_legal_snapshot,'finalidade',t.finalidade_snapshot,
    'total',t.total_previsto,'mensagem_id',t.mensagem_id,
    'pendentes',(select count(*) from public.cda_transmissao_lote_itens i join public.cda_transmissao_lotes l on l.id=i.lote_id
       where l.transmissao_id=t.id and i.situacao='pendente'
         and not exists(select 1 from public.cda_transmissao_envios e where e.item_id=i.id)),
    'mensagens',(select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'nome',m.nome) order by m.id),'[]'::jsonb)
       from public.cda_campanha_mensagens m where m.campanha_id=t.campanha_id),
    'por_estado',coalesce((select jsonb_object_agg(estado,n) from (select estado,count(*) n
       from public.cda_transmissao_envios where transmissao_id=t.id group by estado) x),'{}'::jsonb),
    'enviados_hoje',(select count(*) from public.cda_transmissao_envios where estado<>'suprimido'
       and solicitado_em>date_trunc('day',now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo'),
    'limites',(select jsonb_build_object('minuto',por_minuto,'hora',por_hora,'dia',por_dia)
       from public.cda_transmissao_limites_globais_b5 limit 1),
    'lotes',(select jsonb_agg(jsonb_build_object('lote_id',l.id,'numero',l.numero,'total',l.total,
        'preaprovado',exists(select 1 from public.cda_transmissao_preaprovacoes_b4 p where p.lote_id=l.id and p.status='preaprovado'),
        'processados',(select count(*) from public.cda_transmissao_envios e where e.lote_id=l.id),
        'autorizado_ate',(select max(a.expira_em) from public.cda_transmissao_autorizacoes a
            where a.lote_id=l.id and a.revogado_em is null and a.expira_em>now()))
       order by l.numero) from public.cda_transmissao_lotes l where l.transmissao_id=t.id))
  from public.cda_transmissoes_oficiais t where t.id=p_transmissao_id;
$$;
revoke all on function public.cda_oficial_painel(bigint) from public, anon, authenticated;
grant execute on function public.cda_oficial_painel(bigint) to service_role;

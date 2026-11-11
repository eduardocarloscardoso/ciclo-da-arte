-- Entrega 1 — Executor oficial da Transmissão Oficial (11/11/2026).
-- Reaproveita o desenho homologado do executor de homologação:
--   autorização pessoal, expirável, presa a fingerprint SHA-256;
--   registro no diário ANTES da chamada HTTP; uma linha por destinatário;
--   nenhum reenvio automático em falha ou resultado indeterminado.
-- Tabelas congeladas (transmissões, lotes, itens) NÃO são alteradas.
-- Nenhuma autorização é concedida por esta migração. Nenhum e-mail é enviado.

-- 1. Autorizações efetivas por lote ------------------------------------------
create table if not exists public.cda_transmissao_autorizacoes (
  id bigint generated always as identity primary key,
  transmissao_id bigint not null references public.cda_transmissoes_oficiais(id),
  lote_id bigint not null references public.cda_transmissao_lotes(id),
  fingerprint_sha256 text not null check (fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  autorizado_por uuid not null,
  autorizado_em timestamptz not null default now(),
  expira_em timestamptz not null,
  revogado_em timestamptz,
  revogado_por uuid,
  motivo_revogacao text,
  check (expira_em > autorizado_em and expira_em <= autorizado_em + interval '2 hours')
);
create unique index if not exists cda_transmissao_autorizacao_ativa_unica
  on public.cda_transmissao_autorizacoes(lote_id) where revogado_em is null;

-- 2. Diário de envios: uma linha por destinatário, para sempre -----------------
create table if not exists public.cda_transmissao_envios (
  id bigint generated always as identity primary key,
  transmissao_id bigint not null references public.cda_transmissoes_oficiais(id),
  lote_id bigint not null references public.cda_transmissao_lotes(id),
  item_id bigint not null unique references public.cda_transmissao_lote_itens(id),
  chave_idempotencia uuid not null unique,
  autorizacao_id bigint references public.cda_transmissao_autorizacoes(id),
  email text not null,
  payload_sha256 text check (payload_sha256 is null or payload_sha256 ~ '^[0-9a-f]{64}$'),
  estado text not null check (estado in ('solicitada','aceita','falha','indeterminada',
    'suprimido','entregue','atrasado','devolvida','reclamacao')),
  resend_email_id text unique,
  erro text,
  solicitado_em timestamptz not null default now(),
  concluido_em timestamptz,
  ultimo_evento text,
  ultimo_evento_em timestamptz,
  solicitado_por uuid
);
create index if not exists cda_transmissao_envios_solicitado_em
  on public.cda_transmissao_envios(solicitado_em) where estado <> 'suprimido';
create index if not exists cda_transmissao_envios_lote on public.cda_transmissao_envios(lote_id);

create table if not exists public.cda_transmissao_envio_eventos (
  id bigint generated always as identity primary key,
  envio_id bigint not null references public.cda_transmissao_envios(id),
  svix_id text not null unique,
  resend_email_id text not null,
  tipo text not null check (tipo in ('email.delivered','email.bounced',
    'email.delivery_delayed','email.complained')),
  ocorrido_em timestamptz not null,
  recebido_em timestamptz not null default now()
);

alter table public.cda_transmissao_autorizacoes enable row level security;
alter table public.cda_transmissao_envios enable row level security;
alter table public.cda_transmissao_envio_eventos enable row level security;
revoke all on public.cda_transmissao_autorizacoes, public.cda_transmissao_envios,
  public.cda_transmissao_envio_eventos from public, anon, authenticated;

-- 3. Fingerprint do lote: conteúdo congelado + destinatários + chaves ---------
create or replace function public.cda_oficial_fingerprint_lote(p_lote_id bigint)
returns text language sql stable security definer set search_path='' as $$
  select encode(extensions.digest(
    concat_ws('|','oficial_v1',t.id,t.conteudo_sha256,l.id,l.numero,l.total,
      (select string_agg(i.id||':'||i.email_snapshot||':'||i.chave_idempotencia,',' order by i.id)
         from public.cda_transmissao_lote_itens i where i.lote_id=l.id)),'sha256'),'hex')
  from public.cda_transmissao_lotes l
  join public.cda_transmissoes_oficiais t on t.id=l.transmissao_id
  where l.id=p_lote_id;
$$;

-- Integridade do snapshot congelado (mesma fórmula do congelamento B2).
create or replace function public.cda_oficial_snapshot_integro(p_transmissao_id bigint)
returns boolean language sql stable security definer set search_path='' as $$
  select encode(extensions.digest(concat_ws('|',coalesce(t.assunto_snapshot,''),
      coalesce(t.conteudo_snapshot::text,''),coalesce(t.remetente_snapshot->>'nome',''),
      coalesce(t.remetente_snapshot->>'email',''),coalesce(t.remetente_snapshot->>'reply_to',''),
      coalesce(t.base_legal_snapshot,''),coalesce(t.finalidade_snapshot,'')),'sha256'),'hex')
    = t.conteudo_sha256
  from public.cda_transmissoes_oficiais t where t.id=p_transmissao_id;
$$;

-- 4. Situação de um lote (somente leitura) -------------------------------------
create or replace function public.cda_oficial_status_lote(p_lote_id bigint)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_l public.cda_transmissao_lotes%rowtype; v_t public.cda_transmissoes_oficiais%rowtype;
  v_a public.cda_transmissao_autorizacoes%rowtype; v_fp text;
begin
  select * into v_l from public.cda_transmissao_lotes where id=p_lote_id;
  if not found then raise exception 'Lote inexistente'; end if;
  select * into v_t from public.cda_transmissoes_oficiais where id=v_l.transmissao_id;
  select * into v_a from public.cda_transmissao_autorizacoes
    where lote_id=p_lote_id and revogado_em is null order by id desc limit 1;
  v_fp:=public.cda_oficial_fingerprint_lote(p_lote_id);
  return jsonb_build_object(
    'lote_id',v_l.id,'numero',v_l.numero,'total',v_l.total,'situacao_lote',v_l.situacao,
    'transmissao_id',v_t.id,'situacao_transmissao',v_t.situacao,
    'lgpd_pendente',v_t.validacao_lgpd_pendente,
    'snapshot_integro',public.cda_oficial_snapshot_integro(v_t.id),
    'preaprovado',exists(select 1 from public.cda_transmissao_preaprovacoes_b4 p
       where p.lote_id=v_l.id and p.status='preaprovado'),
    'fingerprint_sha256',v_fp,
    'autorizacao',case when v_a.id is null then null else jsonb_build_object(
       'id',v_a.id,'autorizado_por',v_a.autorizado_por,'autorizado_em',v_a.autorizado_em,
       'expira_em',v_a.expira_em,'valida',v_a.expira_em>now() and v_a.fingerprint_sha256=v_fp) end,
    'pendentes',(select count(*) from public.cda_transmissao_lote_itens i
       where i.lote_id=v_l.id and i.situacao='pendente'
         and not exists(select 1 from public.cda_transmissao_envios e where e.item_id=i.id)),
    'por_estado',coalesce((select jsonb_object_agg(estado,n) from (select estado,count(*) n
       from public.cda_transmissao_envios where lote_id=v_l.id group by estado) x),'{}'::jsonb));
end $$;

-- 5. Autorizar / revogar (chamadas apenas pelo executor, service_role) --------
create or replace function public.cda_oficial_autorizar_lote(
  p_lote_id bigint, p_fingerprint text, p_usuario uuid, p_minutos integer default 60)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_l public.cda_transmissao_lotes%rowtype; v_t public.cda_transmissoes_oficiais%rowtype;
  v_id bigint; v_exp timestamptz;
begin
  if p_usuario is null or p_minutos not between 5 and 120 then raise exception 'Parâmetros inválidos'; end if;
  select * into v_l from public.cda_transmissao_lotes where id=p_lote_id for update;
  if not found or v_l.situacao<>'preparado' then raise exception 'Lote não preparado'; end if;
  select * into v_t from public.cda_transmissoes_oficiais where id=v_l.transmissao_id for update;
  if v_t.situacao<>'congelada' then raise exception 'Transmissão não congelada'; end if;
  if v_t.validacao_lgpd_pendente is not false then raise exception 'LGPD_PENDENTE: confirmar base legal antes de autorizar'; end if;
  if public.cda_oficial_snapshot_integro(v_t.id) is not true then raise exception 'Snapshot congelado divergente'; end if;
  if not exists(select 1 from public.cda_transmissao_preaprovacoes_b4 p
     where p.lote_id=v_l.id and p.status='preaprovado') then
    raise exception 'Lote sem pré-aprovação administrativa';
  end if;
  if p_fingerprint is distinct from public.cda_oficial_fingerprint_lote(v_l.id) then
    raise exception 'Fingerprint divergente; revisar o lote';
  end if;
  update public.cda_transmissao_autorizacoes set revogado_em=now(),revogado_por=p_usuario,
     motivo_revogacao='substituida' where lote_id=v_l.id and revogado_em is null;
  v_exp:=now()+make_interval(mins=>p_minutos);
  insert into public.cda_transmissao_autorizacoes(transmissao_id,lote_id,fingerprint_sha256,autorizado_por,expira_em)
    values(v_t.id,v_l.id,p_fingerprint,p_usuario,v_exp) returning id into v_id;
  insert into public.cda_transmissao_auditoria(transmissao_id,lote_id,acao,detalhe,registrado_por)
    values(v_t.id,v_l.id,'oficial_autorizacao_envio',jsonb_build_object('autorizacao_id',v_id,
      'fingerprint_sha256',p_fingerprint,'expira_em',v_exp,'total',v_l.total),p_usuario);
  return jsonb_build_object('autorizacao_id',v_id,'expira_em',v_exp,'lote_id',v_l.id);
end $$;

create or replace function public.cda_oficial_revogar_lote(p_lote_id bigint, p_usuario uuid, p_motivo text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_n integer; v_t bigint;
begin
  update public.cda_transmissao_autorizacoes set revogado_em=now(),revogado_por=p_usuario,
    motivo_revogacao=left(coalesce(p_motivo,'pausa'),200)
   where lote_id=p_lote_id and revogado_em is null returning transmissao_id into v_t;
  get diagnostics v_n=row_count;
  if v_n>0 then
    insert into public.cda_transmissao_auditoria(transmissao_id,lote_id,acao,detalhe,registrado_por)
      values(v_t,p_lote_id,'oficial_pausa_revogacao',jsonb_build_object('motivo',left(coalesce(p_motivo,'pausa'),200)),p_usuario);
  end if;
  return jsonb_build_object('revogadas',v_n);
end $$;

-- Confirmação administrativa da base legal (anuência do usuário, auditada).
create or replace function public.cda_oficial_confirmar_lgpd(p_transmissao_id bigint, p_usuario uuid, p_texto text)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  update public.cda_transmissoes_oficiais set validacao_lgpd_pendente=false,atualizado_em=now()
   where id=p_transmissao_id and situacao='congelada' and validacao_lgpd_pendente is distinct from false;
  if not found then raise exception 'Transmissão não elegível ou já confirmada'; end if;
  insert into public.cda_transmissao_auditoria(transmissao_id,lote_id,acao,detalhe,registrado_por)
    values(p_transmissao_id,null,'oficial_confirmacao_lgpd',jsonb_build_object('declaracao',left(p_texto,1000)),p_usuario);
  return jsonb_build_object('lgpd_pendente',false);
end $$;

-- 6. Reserva do próximo destinatário: trava global + limites + supressão --------
-- Retorna o envelope de dados (nunca vindo do navegador). Grava 'solicitada'
-- ANTES de qualquer HTTP. Se nada puder ser enviado agora, explica o motivo.
create or replace function public.cda_oficial_reservar_proximo(p_lote_id bigint, p_usuario uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_l public.cda_transmissao_lotes%rowtype; v_t public.cda_transmissoes_oficiais%rowtype;
  v_a public.cda_transmissao_autorizacoes%rowtype; v_i public.cda_transmissao_lote_itens%rowtype;
  v_lim public.cda_transmissao_limites_globais_b5%rowtype; v_c public.cda_transmissao_controles_b4%rowtype;
  v_min integer; v_hora integer; v_dia integer; v_envio bigint; v_camp text;
begin
  -- Serializa todas as reservas oficiais de todas as campanhas.
  perform pg_advisory_xact_lock(hashtext('cda_transmissao_oficial_envio'));
  select * into v_l from public.cda_transmissao_lotes where id=p_lote_id for update;
  if not found or v_l.situacao<>'preparado' then raise exception 'Lote não preparado'; end if;
  select * into v_t from public.cda_transmissoes_oficiais where id=v_l.transmissao_id;
  if v_t.situacao<>'congelada' or v_t.validacao_lgpd_pendente is not false then
    raise exception 'Transmissão bloqueada (situação ou LGPD)'; end if;
  select * into v_a from public.cda_transmissao_autorizacoes
   where lote_id=p_lote_id and revogado_em is null for update;
  if not found or v_a.expira_em<=now() or v_a.autorizado_por<>p_usuario
     or v_a.fingerprint_sha256 is distinct from public.cda_oficial_fingerprint_lote(p_lote_id) then
    return jsonb_build_object('reservado',false,'motivo','SEM_AUTORIZACAO');
  end if;
  select * into v_lim from public.cda_transmissao_limites_globais_b5 limit 1;
  select * into v_c from public.cda_transmissao_controles_b4 where transmissao_id=v_t.id;
  select count(*) filter (where solicitado_em>now()-interval '1 minute'),
         count(*) filter (where solicitado_em>now()-interval '1 hour'),
         count(*) filter (where solicitado_em>date_trunc('day',now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo')
    into v_min,v_hora,v_dia
    from public.cda_transmissao_envios where estado<>'suprimido' and solicitado_em>now()-interval '1 day';
  if v_min>=least(coalesce(v_lim.por_minuto,10),coalesce(v_c.max_por_minuto,10)) then
    return jsonb_build_object('reservado',false,'motivo','LIMITE_MINUTO','aguardar_segundos',15); end if;
  if v_hora>=least(coalesce(v_lim.por_hora,120),coalesce(v_c.max_por_hora,120)) then
    return jsonb_build_object('reservado',false,'motivo','LIMITE_HORA','aguardar_segundos',300); end if;
  if v_dia>=least(coalesce(v_lim.por_dia,300),coalesce(v_c.max_por_dia,300)) then
    return jsonb_build_object('reservado',false,'motivo','LIMITE_DIA'); end if;
  -- Próximo item ainda sem linha no diário.
  select i.* into v_i from public.cda_transmissao_lote_itens i
   where i.lote_id=p_lote_id and i.situacao='pendente'
     and not exists(select 1 from public.cda_transmissao_envios e where e.item_id=i.id)
   order by i.id limit 1 for update skip locked;
  if not found then return jsonb_build_object('reservado',false,'motivo','LOTE_CONCLUIDO'); end if;
  -- Descadastrado/suprimido: registra e NÃO envia.
  if exists(select 1 from public.cda_email_supressoes s where s.email=lower(btrim(v_i.email_snapshot))) then
    insert into public.cda_transmissao_envios(transmissao_id,lote_id,item_id,chave_idempotencia,autorizacao_id,
       email,estado,concluido_em,solicitado_por,erro)
     values(v_t.id,p_lote_id,v_i.id,v_i.chave_idempotencia,v_a.id,v_i.email_snapshot,'suprimido',now(),p_usuario,
       'Endereço na lista de supressão/descadastro');
    return jsonb_build_object('reservado',false,'motivo','SUPRIMIDO','item_id',v_i.id,'continuar',true);
  end if;
  insert into public.cda_transmissao_envios(transmissao_id,lote_id,item_id,chave_idempotencia,autorizacao_id,
     email,estado,solicitado_por)
   values(v_t.id,p_lote_id,v_i.id,v_i.chave_idempotencia,v_a.id,lower(btrim(v_i.email_snapshot)),'solicitada',p_usuario)
   returning id into v_envio;
  select nome into v_camp from public.cda_campanhas where id=v_t.campanha_id;
  return jsonb_build_object('reservado',true,'envio_id',v_envio,'item_id',v_i.id,
    'chave_idempotencia',v_i.chave_idempotencia,'email',lower(btrim(v_i.email_snapshot)),
    'nome',v_i.nome_snapshot,'transmissao_id',v_t.id,'lote_id',p_lote_id,'lote_numero',v_l.numero,
    'campanha_nome',v_camp,'mensagem_id',v_t.mensagem_id,'assunto',v_t.assunto_snapshot,
    'conteudo',v_t.conteudo_snapshot,'remetente',v_t.remetente_snapshot);
end $$;

-- 7. Conclusão: nunca sobrescreve resultado concluído --------------------------
create or replace function public.cda_oficial_concluir(p_envio_id bigint, p_resultado text,
  p_resend_email_id text, p_erro text, p_payload_sha256 text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_e public.cda_transmissao_envios%rowtype;
begin
  if p_resultado not in ('aceita','falha','indeterminada') then raise exception 'Resultado inválido'; end if;
  select * into v_e from public.cda_transmissao_envios where id=p_envio_id for update;
  if not found or v_e.estado<>'solicitada' then raise exception 'Envio inexistente ou já concluído'; end if;
  if p_resultado='aceita' and coalesce(btrim(p_resend_email_id),'')='' then
    raise exception 'Aceite sem ID do provedor'; end if;
  update public.cda_transmissao_envios set estado=p_resultado,
    resend_email_id=case when p_resultado='aceita' then p_resend_email_id end,
    erro=case when p_resultado='indeterminada' then 'INDETERMINADO: NÃO REENVIAR. '||left(coalesce(p_erro,''),400)
      else left(p_erro,500) end,
    payload_sha256=p_payload_sha256, concluido_em=now()
   where id=p_envio_id;
  return jsonb_build_object('envio_id',p_envio_id,'estado',p_resultado);
end $$;

-- 8. Conciliação com eventos do Resend (webhook) --------------------------------
create or replace function public.cda_oficial_registrar_evento(p_svix_id text, p_resend_email_id text,
  p_tipo text, p_ocorrido_em timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_e public.cda_transmissao_envios%rowtype; v_atual int; v_novo int; v_estado text;
begin
  select * into v_e from public.cda_transmissao_envios where resend_email_id=p_resend_email_id for update;
  if not found then return jsonb_build_object('aplicado',false,'motivo','sem_envio_oficial'); end if;
  insert into public.cda_transmissao_envio_eventos(envio_id,svix_id,resend_email_id,tipo,ocorrido_em)
    values(v_e.id,p_svix_id,p_resend_email_id,p_tipo,p_ocorrido_em) on conflict (svix_id) do nothing;
  if not found then return jsonb_build_object('aplicado',false,'motivo','duplicado'); end if;
  v_atual:=case v_e.estado when 'reclamacao' then 4 when 'devolvida' then 3 when 'entregue' then 2
    when 'atrasado' then 1 else 0 end;
  v_novo:=case p_tipo when 'email.complained' then 4 when 'email.bounced' then 3
    when 'email.delivered' then 2 when 'email.delivery_delayed' then 1 else -1 end;
  -- Reclamação ou devolução: suprime o endereço para todas as campanhas futuras.
  if v_novo in (3,4) then
    insert into public.cda_email_supressoes(email,motivo)
      values(lower(btrim(v_e.email)),case v_novo when 4 then 'reclamacao_spam' else 'devolucao' end)
      on conflict (email) do nothing;
  end if;
  if v_novo<v_atual or v_novo<0 then return jsonb_build_object('aplicado',false,'motivo','prioridade'); end if;
  v_estado:=case v_novo when 4 then 'reclamacao' when 3 then 'devolvida' when 2 then 'entregue' else 'atrasado' end;
  update public.cda_transmissao_envios set estado=v_estado,ultimo_evento=p_tipo,ultimo_evento_em=p_ocorrido_em
   where id=v_e.id;
  return jsonb_build_object('aplicado',true,'envio_id',v_e.id,'estado',v_estado);
end $$;

-- 9. Descadastro por link assinado (token validado na Edge Function) -----------
create or replace function public.cda_oficial_descadastrar_item(p_item_id bigint, p_origem text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_email text;
begin
  select lower(btrim(email_snapshot)) into v_email from public.cda_transmissao_lote_itens where id=p_item_id;
  if v_email is null then raise exception 'Item inexistente'; end if;
  insert into public.cda_email_supressoes(email,motivo)
    values(v_email,'descadastro_'||left(coalesce(p_origem,'link'),20)) on conflict (email) do nothing;
  return jsonb_build_object('descadastrado',true);
end $$;

-- 10. Painel da transmissão (somente leitura) -----------------------------------
create or replace function public.cda_oficial_painel(p_transmissao_id bigint)
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object(
    'transmissao_id',t.id,'situacao',t.situacao,'lgpd_pendente',t.validacao_lgpd_pendente,
    'base_legal',t.base_legal_snapshot,'finalidade',t.finalidade_snapshot,
    'total',t.total_previsto,
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

-- Todas as funções: exclusivamente service_role (via Edge Function autenticada).
do $$ declare f text; begin
  foreach f in array array[
    'cda_oficial_fingerprint_lote(bigint)','cda_oficial_snapshot_integro(bigint)',
    'cda_oficial_status_lote(bigint)','cda_oficial_autorizar_lote(bigint,text,uuid,integer)',
    'cda_oficial_revogar_lote(bigint,uuid,text)','cda_oficial_confirmar_lgpd(bigint,uuid,text)',
    'cda_oficial_reservar_proximo(bigint,uuid)','cda_oficial_concluir(bigint,text,text,text,text)',
    'cda_oficial_registrar_evento(text,text,text,timestamptz)',
    'cda_oficial_descadastrar_item(bigint,text)','cda_oficial_painel(bigint)']
  loop
    execute 'revoke all on function public.'||f||' from public, anon, authenticated';
    execute 'grant execute on function public.'||f||' to service_role';
  end loop;
end $$;

-- 11. Segredo HMAC dos links de descadastro (gerado no banco, nunca exposto) ----
create table if not exists public.cda_transmissao_segredos (
  nome text primary key, valor text not null, criado_em timestamptz not null default now());
alter table public.cda_transmissao_segredos enable row level security;
revoke all on public.cda_transmissao_segredos from public, anon, authenticated;
insert into public.cda_transmissao_segredos(nome,valor)
  values('descadastro_hmac',encode(extensions.gen_random_bytes(32),'hex')) on conflict (nome) do nothing;
create or replace function public.cda_oficial_segredo_descadastro()
returns text language sql stable security definer set search_path='' as $$
  select valor from public.cda_transmissao_segredos where nome='descadastro_hmac' $$;
revoke all on function public.cda_oficial_segredo_descadastro() from public, anon, authenticated;
grant execute on function public.cda_oficial_segredo_descadastro() to service_role;

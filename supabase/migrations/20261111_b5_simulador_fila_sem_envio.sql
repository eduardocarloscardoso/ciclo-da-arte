-- B5: motor de agendamento e simulação operacional. NENHUM ENVIO EXTERNO.
-- Estruturas e RPCs são de simulação imutável; nenhum acesso ao Resend.
create table if not exists public.cda_transmissao_simulacoes_b5 (
 id bigint generated always as identity primary key,
 transmissao_id bigint not null references public.cda_transmissoes_oficiais(id) on delete restrict,
 lote_id bigint not null references public.cda_transmissao_lotes(id) on delete restrict,
 status text not null default 'simulado' check(status='simulado'),
 quantidade integer not null check(quantidade between 1 and 1000),
 fingerprint_sha256 text not null check(length(fingerprint_sha256)=64),
 limite_minuto integer not null check(limite_minuto between 1 and 120),
 limite_hora integer not null check(limite_hora between 1 and 5000),
 limite_dia integer not null check(limite_dia between 1 and 20000),
 limite_lote integer not null check(limite_lote between 1 and 1000),
 inicio_previsto timestamptz not null,
 termino_previsto timestamptz not null,
 criado_por uuid not null,
 criado_em timestamptz not null default now(),
 envio_habilitado boolean not null default false check(envio_habilitado=false),
 unique(lote_id),
 unique(id,transmissao_id),
 foreign key(lote_id,transmissao_id) references public.cda_transmissao_lotes(id,transmissao_id)
);
create table if not exists public.cda_transmissao_simulacao_itens_b5 (
 simulacao_id bigint not null references public.cda_transmissao_simulacoes_b5(id) on delete restrict,
 lote_item_id bigint not null references public.cda_transmissao_lote_itens(id) on delete restrict,
 posicao integer not null check(posicao>0),
 horario_previsto timestamptz not null,
 chave_idempotencia uuid not null,
 status text not null default 'simulado' check(status='simulado'),
 resend_email_id text,
 tentativa_real integer not null default 0 check(tentativa_real=0),
 primary key(simulacao_id,lote_item_id),
 unique(simulacao_id,posicao),
 unique(simulacao_id,chave_idempotencia),
 check(resend_email_id is null)
);
create index if not exists cda_simulacao_b5_transmissao_idx
 on public.cda_transmissao_simulacoes_b5(transmissao_id,criado_em desc);
alter table public.cda_transmissao_simulacoes_b5 enable row level security;
alter table public.cda_transmissao_simulacao_itens_b5 enable row level security;
revoke all on public.cda_transmissao_simulacoes_b5,public.cda_transmissao_simulacao_itens_b5
 from anon,authenticated;

create or replace function public.cda_simular_execucao_lote_b5(p_lote_id bigint)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
 v_l public.cda_transmissao_lotes%rowtype;
 v_t public.cda_transmissoes_oficiais%rowtype;
 v_c public.cda_transmissao_controles_b4%rowtype;
 v_r public.cda_transmissao_revisoes_lotes%rowtype;
 v_p public.cda_transmissao_preaprovacoes_b4%rowtype;
 v_f text;v_qtd integer;v_id bigint;v_agora timestamptz:=date_trunc('minute',now());
 v_fim timestamptz;v_insert integer;
begin
 if not public.cda_admin_transmissao_b4() then
  raise exception 'Somente administrador autenticado';end if;
 -- Serialização para proteger mesma transmissão em simulações concorrentes.
 select * into v_l from public.cda_transmissao_lotes where id=p_lote_id for update;
 if not found or v_l.habilitado or v_l.situacao<>'preparado'
  or v_l.autorizado_em is not null then
  raise exception 'Lote não está disponível para simulação';end if;
 select * into v_t from public.cda_transmissoes_oficiais
 where id=v_l.transmissao_id for share;
 if not found or v_t.habilitado or v_t.situacao<>'congelada' then
  raise exception 'Transmissão indisponível';end if;
 if exists(select 1 from public.cda_transmissao_simulacoes_b5 where lote_id=p_lote_id) then
  raise exception 'Já existe simulação deste lote; consulte seu resultado (sem repetir)';
 end if;
 select * into v_c from public.cda_transmissao_controles_b4
 where transmissao_id=v_l.transmissao_id;
 if not found or v_c.habilitado then raise exception 'Configure os limites de planejamento';end if;
 if v_l.total>v_c.max_por_lote then raise exception 'Lote excede limite por lote';end if;
 select * into v_r from public.cda_transmissao_revisoes_lotes where lote_id=p_lote_id;
 v_f:=public.cda_fingerprint_revisao_lote_b3(p_lote_id);
 if not found or v_r.status<>'revisado' or v_r.fingerprint_sha256 is distinct from v_f then
  raise exception 'Revisão não está íntegra';end if;
 select * into v_p from public.cda_transmissao_preaprovacoes_b4 where lote_id=p_lote_id;
 if not found or v_p.status<>'preaprovado' or v_p.autoriza_envio or
    v_p.fingerprint_sha256 is distinct from v_f then
  raise exception 'Pré-aprovação administrativa vigente não encontrada';end if;
 select count(*) into v_qtd from public.cda_transmissao_lote_itens i
 where i.lote_id=p_lote_id and i.situacao='pendente';
 if v_qtd<>v_l.total or v_qtd<1 then raise exception 'Snapshot de itens divergente';end if;
 -- Limites conservadores e cumulativos para este lote:
 -- intervalo = max(pos/minuto, pos/hora, pos/dia) em suas janelas.
 with ordenados as (
   select row_number() over(order by i.id)::bigint n
   from public.cda_transmissao_lote_itens i where i.lote_id=p_lote_id and i.situacao='pendente'
 )
 select max(v_agora+
    greatest(((n-1)/v_c.max_por_minuto)*interval '1 minute',
             ((n-1)/v_c.max_por_hora)*interval '1 hour',
             ((n-1)/v_c.max_por_dia)*interval '1 day'))
 into v_fim from ordenados;
 insert into public.cda_transmissao_simulacoes_b5(
   transmissao_id,lote_id,quantidade,fingerprint_sha256,limite_minuto,limite_hora,
   limite_dia,limite_lote,inicio_previsto,termino_previsto,criado_por)
 values(v_t.id,p_lote_id,v_qtd,v_f,v_c.max_por_minuto,v_c.max_por_hora,
    v_c.max_por_dia,v_c.max_por_lote,v_agora,v_fim,auth.uid())
 returning id into v_id;
 with ordenados as (
  select i.id,i.chave_idempotencia,row_number() over(order by i.id)::bigint n
  from public.cda_transmissao_lote_itens i where i.lote_id=p_lote_id and i.situacao='pendente'
 )
 insert into public.cda_transmissao_simulacao_itens_b5(
   simulacao_id,lote_item_id,posicao,horario_previsto,chave_idempotencia)
 select v_id,id,n,
   v_agora+greatest(((n-1)/v_c.max_por_minuto)*interval '1 minute',
    ((n-1)/v_c.max_por_hora)*interval '1 hour',
    ((n-1)/v_c.max_por_dia)*interval '1 day'),chave_idempotencia
 from ordenados;
 get diagnostics v_insert=row_count;
 if v_insert<>v_qtd then raise exception 'Falha na consistência da fila simulada';end if;
 insert into public.cda_transmissao_auditoria(
   transmissao_id,lote_id,acao,detalhe,registrado_por)
 values(v_t.id,p_lote_id,'b5_simulacao_fila_sem_envio',
 jsonb_build_object('simulacao_id',v_id,'quantidade',v_qtd,
  'fingerprint_sha256',v_f,'limite_minuto',v_c.max_por_minuto,
  'limite_hora',v_c.max_por_hora,'limite_dia',v_c.max_por_dia,
  'inicio_previsto',v_agora,'termino_previsto',v_fim,
  'envio_habilitado',false,'resend_chamadas',0),auth.uid());
 return jsonb_build_object('simulacao_id',v_id,'lote_id',p_lote_id,
    'quantidade',v_qtd,'inicio_previsto',v_agora,'termino_previsto',v_fim,
    'envio_habilitado',false,'resend_chamadas',0);
end $$;
revoke all on function public.cda_simular_execucao_lote_b5(bigint) from public,anon;
grant execute on function public.cda_simular_execucao_lote_b5(bigint) to authenticated;

create or replace function public.cda_consultar_simulacoes_b5(p_transmissao_id bigint)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_json jsonb;
begin
 if not public.cda_admin_transmissao_b4() then raise exception 'Acesso restrito';end if;
 select coalesce(jsonb_agg(jsonb_build_object(
  'simulacao_id',s.id,'lote_id',s.lote_id,'numero',l.numero,
  'quantidade',s.quantidade,'fingerprint_sha256',s.fingerprint_sha256,
  'inicio_previsto',s.inicio_previsto,'termino_previsto',s.termino_previsto,
  'minuto',s.limite_minuto,'hora',s.limite_hora,'dia',s.limite_dia,
  'status',s.status,'envio_habilitado',s.envio_habilitado,
  'itens', (select count(*) from public.cda_transmissao_simulacao_itens_b5 si
             where si.simulacao_id=s.id))
  order by l.numero),'[]'::jsonb) into v_json
 from public.cda_transmissao_simulacoes_b5 s
 join public.cda_transmissao_lotes l on l.id=s.lote_id
 where s.transmissao_id=p_transmissao_id;
 return v_json;
end $$;
revoke all on function public.cda_consultar_simulacoes_b5(bigint) from public,anon;
grant execute on function public.cda_consultar_simulacoes_b5(bigint) to authenticated;

-- B4: Controles de planejamento operacional universais, sem executor e sem envio.
-- Limites e estados não autorizam transmissão: habilitado=false permanece obrigatório.
create table if not exists public.cda_transmissao_controles_b4 (
 transmissao_id bigint primary key references public.cda_transmissoes_oficiais(id) on delete restrict,
 estado text not null default 'pausado' check(estado in ('pausado','planejamento')),
 max_por_minuto integer not null default 10 check(max_por_minuto between 1 and 120),
 max_por_hora integer not null default 120 check(max_por_hora between 1 and 5000),
 max_por_dia integer not null default 300 check(max_por_dia between 1 and 20000),
 max_por_lote integer not null default 100 check(max_por_lote between 1 and 1000),
 atualizado_por uuid not null,
 atualizado_em timestamptz not null default now(),
 habilitado boolean not null default false check(habilitado=false),
 check(max_por_hora>=max_por_minuto),
 check(max_por_dia>=max_por_hora)
);
alter table public.cda_transmissao_controles_b4 enable row level security;
revoke all on public.cda_transmissao_controles_b4 from anon,authenticated;

-- Registro de pré-aprovação administrativa, NÃO autorização de envio.
create table if not exists public.cda_transmissao_preaprovacoes_b4 (
 lote_id bigint primary key references public.cda_transmissao_lotes(id) on delete restrict,
 transmissao_id bigint not null references public.cda_transmissoes_oficiais(id) on delete restrict,
 status text not null check(status in ('preaprovado','revogado')),
 fingerprint_sha256 text not null,
 quantidade integer not null check(quantidade between 1 and 1000),
 atualizado_por uuid not null,
 atualizado_em timestamptz not null default now(),
 autoriza_envio boolean not null default false check(autoriza_envio=false),
 foreign key (lote_id,transmissao_id) references public.cda_transmissao_lotes(id,transmissao_id)
);
alter table public.cda_transmissao_preaprovacoes_b4 enable row level security;
revoke all on public.cda_transmissao_preaprovacoes_b4 from anon,authenticated;

-- Uma função interna para verificação de admin, mantida inacessível a API.
create or replace function public.cda_admin_transmissao_b4()
returns boolean language sql stable security definer set search_path=''
as $$
 select auth.uid() is not null
   and auth.role()='authenticated'
   and exists(select 1 from public.equipe e join auth.users u
     on lower(btrim(e.email))=lower(btrim(u.email))
     where u.id=auth.uid() and e.is_admin is true);
$$;
revoke all on function public.cda_admin_transmissao_b4() from public,anon,authenticated;

-- Atualiza controles de planejamento, nunca estado de envio.
create or replace function public.cda_configurar_controle_b4(
 p_transmissao_id bigint,p_estado text,p_minuto integer,p_hora integer,
 p_dia integer,p_max_lote integer)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_t public.cda_transmissoes_oficiais%rowtype;
begin
 if not public.cda_admin_transmissao_b4() then raise exception 'Somente administrador autenticado';end if;
 if p_estado not in ('pausado','planejamento') or
 p_minuto not between 1 and 120 or
 p_hora not between p_minuto and 5000 or
 p_dia not between p_hora and 20000 or
 p_max_lote not between 1 and 1000 then
 raise exception 'Parâmetros de limite inválidos';end if;
 select * into v_t from public.cda_transmissoes_oficiais where id=p_transmissao_id for share;
 if not found or v_t.situacao<>'congelada' or v_t.habilitado then
 raise exception 'Transmissão indisponível para planejamento';end if;
 if exists(select 1 from public.cda_transmissao_lotes l
    where l.transmissao_id=p_transmissao_id and l.total>p_max_lote) then
 raise exception 'O limite por lote é inferior a um lote já congelado';end if;
 insert into public.cda_transmissao_controles_b4
 (transmissao_id,estado,max_por_minuto,max_por_hora,max_por_dia,max_por_lote,atualizado_por)
 values(p_transmissao_id,p_estado,p_minuto,p_hora,p_dia,p_max_lote,auth.uid())
 on conflict(transmissao_id) do update set
 estado=excluded.estado,max_por_minuto=excluded.max_por_minuto,
 max_por_hora=excluded.max_por_hora,max_por_dia=excluded.max_por_dia,
 max_por_lote=excluded.max_por_lote,atualizado_por=excluded.atualizado_por,atualizado_em=now();
 insert into public.cda_transmissao_auditoria(transmissao_id,acao,detalhe,registrado_por)
 values(p_transmissao_id,'b4_controle_planejamento',
 jsonb_build_object('estado',p_estado,'minuto',p_minuto,'hora',p_hora,
 'dia',p_dia,'max_lote',p_max_lote,'envio_habilitado',false),auth.uid());
 return jsonb_build_object('transmissao_id',p_transmissao_id,'estado',p_estado,
 'max_por_minuto',p_minuto,'max_por_hora',p_hora,'max_por_dia',p_dia,
 'max_por_lote',p_max_lote,'envio_habilitado',false);
end $$;
revoke all on function public.cda_configurar_controle_b4(bigint,text,integer,integer,integer,integer) from public,anon;
grant execute on function public.cda_configurar_controle_b4(bigint,text,integer,integer,integer,integer) to authenticated;

-- Revisar vários lotes pendentes/ revogados em uma transação. Auditados individualmente.
create or replace function public.cda_revisar_multiplos_lotes_b4(
 p_transmissao_id bigint,p_lotes bigint[])
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_lote record;v_fingerprint text;v_cont integer:=0;v_ids bigint[];
begin
 if not public.cda_admin_transmissao_b4() then raise exception 'Somente administrador autenticado';end if;
 if p_lotes is null or cardinality(p_lotes) not between 1 and 100 then
 raise exception 'Selecione de 1 a 100 lotes';end if;
 select array_agg(distinct v order by v) into v_ids from unnest(p_lotes) v;
 if cardinality(v_ids)<>cardinality(p_lotes) or array_position(v_ids,null) is not null then
 raise exception 'IDs duplicados ou inválidos';end if;
 if not exists(select 1 from public.cda_transmissoes_oficiais t
    where t.id=p_transmissao_id and t.situacao='congelada' and not t.habilitado) then
 raise exception 'Transmissão não congelada';end if;
 -- Serializa alterações concorrentes neste plano; nenhuma alteração de habilitado.
 perform pg_advisory_xact_lock(hashtextextended('cda_b4_revisao:'||p_transmissao_id,0));
 for v_lote in
  select l.id,l.numero,l.total,l.situacao,l.habilitado,l.autorizado_em,
    r.status as revisao_status
  from public.cda_transmissao_lotes l
  left join public.cda_transmissao_revisoes_lotes r on r.lote_id=l.id
  where l.id=any(v_ids) and l.transmissao_id=p_transmissao_id
  order by l.numero for update of l
 loop
  if v_lote.situacao<>'preparado' or v_lote.habilitado or
     v_lote.autorizado_em is not null or v_lote.revisao_status='revisado' then
    raise exception 'Lote % não pode ser revisado em lote',v_lote.numero;
  end if;
  if v_lote.total<1 or v_lote.total<>(
      select count(*) from public.cda_transmissao_lote_itens i
      where i.lote_id=v_lote.id and i.situacao='pendente') then
    raise exception 'Divergência de destinatários no lote %',v_lote.numero;end if;
  v_fingerprint:=public.cda_fingerprint_revisao_lote_b3(v_lote.id);
  if v_fingerprint is null then raise exception 'Fingerprint não disponível';end if;
  insert into public.cda_transmissao_revisoes_lotes
    (lote_id,transmissao_id,status,fingerprint_sha256,total_snapshot,
     registrado_por,observacao)
  values(v_lote.id,p_transmissao_id,'revisado',v_fingerprint,v_lote.total,
     auth.uid(),'Revisão múltipla B4 sem envio')
  on conflict(lote_id) do update set
   status='revisado',fingerprint_sha256=excluded.fingerprint_sha256,
   total_snapshot=excluded.total_snapshot,registrado_por=excluded.registrado_por,
   atualizado_em=now(),observacao=excluded.observacao;
  insert into public.cda_transmissao_auditoria
   (transmissao_id,lote_id,acao,detalhe,registrado_por)
  values(p_transmissao_id,v_lote.id,'b4_revisao_multipla',
   jsonb_build_object('fingerprint_sha256',v_fingerprint,
    'quantidade',v_lote.total,'envio_autorizado',false),auth.uid());
  v_cont:=v_cont+1;
 end loop;
 if v_cont<>cardinality(v_ids) then
   raise exception 'Conjunto alterado: esperados %, encontrados %',cardinality(v_ids),v_cont;
 end if;
 return jsonb_build_object('transmissao_id',p_transmissao_id,'revisados',v_cont,
   'autorizacao_envio',false,'envio_habilitado',false);
end $$;
revoke all on function public.cda_revisar_multiplos_lotes_b4(bigint,bigint[]) from public,anon;
grant execute on function public.cda_revisar_multiplos_lotes_b4(bigint,bigint[]) to authenticated;

-- Pré-aprovação do plano administrativo de um lote revisado; não cria autorização de envio.
create or replace function public.cda_preaprovar_lote_b4(
 p_lote_id bigint,p_acao text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_l public.cda_transmissao_lotes%rowtype;v_r public.cda_transmissao_revisoes_lotes%rowtype;
v_c public.cda_transmissao_controles_b4%rowtype;v_f text;v_status text;
begin
 if not public.cda_admin_transmissao_b4() then raise exception 'Somente administrador autenticado';end if;
 if p_acao not in ('preaprovar','revogar') then raise exception 'Ação inválida';end if;
 select * into v_l from public.cda_transmissao_lotes where id=p_lote_id for update;
 if not found or v_l.situacao<>'preparado' or v_l.habilitado or v_l.autorizado_em is not null then
 raise exception 'Lote indisponível para pré-aprovação';end if;
 select * into v_c from public.cda_transmissao_controles_b4 where transmissao_id=v_l.transmissao_id;
 if not found then raise exception 'Configure os limites operacionais B4';end if;
 if v_l.total>v_c.max_por_lote then raise exception 'Lote excede limite configurado';end if;
 select * into v_r from public.cda_transmissao_revisoes_lotes where lote_id=p_lote_id;
 v_f:=public.cda_fingerprint_revisao_lote_b3(p_lote_id);
 if p_acao='preaprovar' and
   (not found or v_r.status<>'revisado' or v_r.fingerprint_sha256 is distinct from v_f)
 then raise exception 'Revisão administrativa íntegra é obrigatória';end if;
 if p_acao='revogar' and not exists(
  select 1 from public.cda_transmissao_preaprovacoes_b4
  where lote_id=p_lote_id and status='preaprovado') then
 raise exception 'Não existe pré-aprovação vigente';end if;
 v_status:=case when p_acao='preaprovar' then 'preaprovado' else 'revogado' end;
 insert into public.cda_transmissao_preaprovacoes_b4
 (lote_id,transmissao_id,status,fingerprint_sha256,quantidade,atualizado_por)
 values(p_lote_id,v_l.transmissao_id,v_status,v_f,v_l.total,auth.uid())
 on conflict(lote_id) do update set status=excluded.status,
 fingerprint_sha256=excluded.fingerprint_sha256,quantidade=excluded.quantidade,
 atualizado_por=excluded.atualizado_por,atualizado_em=now();
 insert into public.cda_transmissao_auditoria
 (transmissao_id,lote_id,acao,detalhe,registrado_por)
 values(v_l.transmissao_id,p_lote_id,'b4_'||v_status,
 jsonb_build_object('fingerprint_sha256',v_f,'quantidade',v_l.total,
 'envio_autorizado',false),auth.uid());
 return jsonb_build_object('lote_id',p_lote_id,'status',v_status,
 'envio_autorizado',false,'envio_habilitado',false);
end $$;
revoke all on function public.cda_preaprovar_lote_b4(bigint,text) from public,anon;
grant execute on function public.cda_preaprovar_lote_b4(bigint,text) to authenticated;

create or replace function public.cda_consultar_controles_b4(p_transmissao_id bigint)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_c jsonb;v_p jsonb;
begin
 if not public.cda_admin_transmissao_b4() then raise exception 'Consulta restrita a administrador';end if;
 select to_jsonb(c) into v_c from public.cda_transmissao_controles_b4 c
 where c.transmissao_id=p_transmissao_id;
 select coalesce(jsonb_agg(jsonb_build_object(
   'lote_id',p.lote_id,'status',p.status,'fingerprint_sha256',p.fingerprint_sha256,
   'quantidade',p.quantidade,'atualizado_em',p.atualizado_em)
   order by p.lote_id),'[]'::jsonb) into v_p
 from public.cda_transmissao_preaprovacoes_b4 p where p.transmissao_id=p_transmissao_id;
 return jsonb_build_object('controles',v_c,'preaprovacoes',v_p,
    'executor_disponivel',false,'envio_habilitado',false);
end $$;
revoke all on function public.cda_consultar_controles_b4(bigint) from public,anon;
grant execute on function public.cda_consultar_controles_b4(bigint) to authenticated;

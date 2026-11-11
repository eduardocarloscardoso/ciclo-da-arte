-- B3: revisão administrativa por lote, sem habilitação ou autorização de envio.
-- Revisão não é a liberação técnica de transmissão; habilitado permanece false por CHECK.
create table if not exists public.cda_transmissao_revisoes_lotes (
 lote_id bigint primary key references public.cda_transmissao_lotes(id) on delete restrict,
 transmissao_id bigint not null references public.cda_transmissoes_oficiais(id) on delete restrict,
 status text not null default 'pendente' check (status in ('pendente','revisado','revogado')),
 fingerprint_sha256 text not null,
 total_snapshot integer not null check (total_snapshot>=1),
 registrado_por uuid not null,
 registrado_em timestamptz not null default now(),
 atualizado_em timestamptz not null default now(),
 observacao text not null default '',
 unique(lote_id,transmissao_id),
 foreign key(lote_id,transmissao_id)
    references public.cda_transmissao_lotes(id,transmissao_id)
);
create index if not exists cda_transmissao_revisoes_transmissao_idx
 on public.cda_transmissao_revisoes_lotes(transmissao_id,status);
alter table public.cda_transmissao_revisoes_lotes enable row level security;
revoke all on public.cda_transmissao_revisoes_lotes from anon,authenticated;

-- Imutabilidade dos snapshots e metadados essenciais depois do congelamento.
-- Regras operacionais adicionais de envio exigirão outra migração explícita.
create or replace function public.cda_fingerprint_revisao_lote_b3(p_lote_id bigint)
returns text language sql stable security definer set search_path=''
as $$
 select encode(extensions.digest(
   concat_ws('|',t.id::text,l.id::text,l.numero::text,t.conteudo_sha256,
      t.campanha_id::text,t.mensagem_id::text,
      coalesce(string_agg(i.campanha_destinatario_id::text||':'||
        lower(btrim(i.email_snapshot))||':'||i.chave_idempotencia::text,
        E'\n' order by i.id),'')),
   'sha256'),'hex')
 from public.cda_transmissao_lotes l
 join public.cda_transmissoes_oficiais t on t.id=l.transmissao_id
 join public.cda_transmissao_lote_itens i on i.lote_id=l.id
 where l.id=p_lote_id and t.situacao='congelada'
 group by t.id,l.id,l.numero,t.conteudo_sha256,t.campanha_id,t.mensagem_id;
$$;
revoke all on function public.cda_fingerprint_revisao_lote_b3(bigint) from public,anon,authenticated;

create or replace function public.cda_revisar_lote_oficial_b3(
  p_lote_id bigint, p_acao text,p_observacao text default '')
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=auth.uid();v_lote public.cda_transmissao_lotes%rowtype;
v_t public.cda_transmissoes_oficiais%rowtype;
v_fingerprint text;v_real bigint;v_acao text:=lower(btrim(p_acao));
begin
 if v_user is null or auth.role() is distinct from 'authenticated' or not exists(
    select 1 from public.equipe e join auth.users u
      on lower(btrim(u.email))=lower(btrim(e.email))
    where u.id=v_user and e.is_admin is true
 ) then raise exception 'Apenas administrador autenticado pode registrar revisão';end if;
 if v_acao not in ('revisar','revogar') then raise exception 'Ação inválida';end if;
 select * into v_lote from public.cda_transmissao_lotes where id=p_lote_id for update;
 if not found then raise exception 'Lote não encontrado';end if;
 select * into v_t from public.cda_transmissoes_oficiais where id=v_lote.transmissao_id for share;
 if v_t.situacao<>'congelada' or v_lote.situacao<>'preparado' then
   raise exception 'Lote deve estar preparado em transmissão congelada';
 end if;
 if v_t.habilitado or v_lote.habilitado or v_lote.autorizado_em is not null then
   raise exception 'Lote fora do estado de segurança B3';
 end if;
 select count(*) into v_real from public.cda_transmissao_lote_itens
 where lote_id=p_lote_id and situacao='pendente';
 if v_real<>v_lote.total or v_real<1 then raise exception 'Quantidade de itens divergente';end if;
 v_fingerprint:=public.cda_fingerprint_revisao_lote_b3(p_lote_id);
 if v_fingerprint is null then raise exception 'Impressão digital indisponível';end if;
 if v_acao='revisar' and exists(select 1 from public.cda_transmissao_revisoes_lotes
   where lote_id=p_lote_id and status='revisado') then
   raise exception 'Lote já revisado; não repetir operação';
 end if;
 if v_acao='revogar' and not exists(select 1 from public.cda_transmissao_revisoes_lotes
   where lote_id=p_lote_id and status='revisado') then
   raise exception 'Não há revisão vigente para revogar';
 end if;
 insert into public.cda_transmissao_revisoes_lotes
 (lote_id,transmissao_id,status,fingerprint_sha256,total_snapshot,
  registrado_por,observacao)
 values(p_lote_id,v_t.id,case when v_acao='revisar' then 'revisado' else 'revogado' end,
  v_fingerprint,v_real,v_user,left(coalesce(p_observacao,''),500))
 on conflict (lote_id) do update set
 status=excluded.status,
 fingerprint_sha256=excluded.fingerprint_sha256,
 total_snapshot=excluded.total_snapshot,
 registrado_por=excluded.registrado_por,
 atualizado_em=now(),
 observacao=excluded.observacao;
 insert into public.cda_transmissao_auditoria
 (transmissao_id,lote_id,acao,detalhe,registrado_por)
 values(v_t.id,p_lote_id,
   case when v_acao='revisar' then 'revisao_administrativa_b3' else 'revogacao_revisao_b3' end,
   jsonb_build_object('fingerprint_sha256',v_fingerprint,'total',v_real,
     'status',v_acao,'habilitado',false,'envio_autorizado',false,
     'observacao',left(coalesce(p_observacao,''),500)),v_user);
 return jsonb_build_object('lote_id',p_lote_id,'transmissao_id',v_t.id,
   'status',case when v_acao='revisar' then 'revisado' else 'revogado' end,
   'fingerprint_sha256',v_fingerprint,'total',v_real,
   'envio_autorizado',false,'habilitado',false);
end $$;
revoke all on function public.cda_revisar_lote_oficial_b3(bigint,text,text)
 from public,anon;
grant execute on function public.cda_revisar_lote_oficial_b3(bigint,text,text)
 to authenticated;

create or replace function public.cda_consultar_revisoes_lotes_b3(p_transmissao_id bigint)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_user uuid:=auth.uid();v_resp jsonb;
begin
 if v_user is null or auth.role() is distinct from 'authenticated' or not exists(
    select 1 from public.equipe e join auth.users u
     on lower(btrim(u.email))=lower(btrim(e.email))
    where u.id=v_user and e.is_admin is true
 ) then raise exception 'Consulta restrita a administrador';end if;
 select coalesce(jsonb_agg(jsonb_build_object(
   'lote_id',l.id,'numero',l.numero,'total',l.total,
   'situacao_lote',l.situacao,'habilitado',l.habilitado,
   'revisao_status',coalesce(r.status,'pendente'),
   'revisao_fingerprint',r.fingerprint_sha256,'revisado_em',r.atualizado_em,
   'fingerprint_atual',public.cda_fingerprint_revisao_lote_b3(l.id)
  ) order by l.numero),'[]'::jsonb) into v_resp
 from public.cda_transmissao_lotes l
 left join public.cda_transmissao_revisoes_lotes r on r.lote_id=l.id
 where l.transmissao_id=p_transmissao_id;
 return v_resp;
end $$;
revoke all on function public.cda_consultar_revisoes_lotes_b3(bigint) from public,anon;
grant execute on function public.cda_consultar_revisoes_lotes_b3(bigint) to authenticated;

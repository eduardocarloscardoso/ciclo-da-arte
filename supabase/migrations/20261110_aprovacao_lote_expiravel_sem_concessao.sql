-- Fase final: mecanismo real de autorização, SEM conceder autorização.
-- Lote pré-existente permanece DESABILITADO; não existe aprovação criada aqui.
create table if not exists public.cda_aprovacoes_envio_homologacao (
 lote_id bigint primary key references public.cda_envio_lotes(id) on delete restrict,
 fingerprint_sha256 text not null check(fingerprint_sha256 ~ '^[a-f0-9]{64}$'),
 destinatarios integer not null check(destinatarios between 1 and 5),
 autorizado_por uuid not null,
 autorizado_em timestamptz not null default now(),
 expira_em timestamptz not null,
 revogado_em timestamptz,
 check(expira_em > autorizado_em and expira_em <= autorizado_em+interval '1 hour')
);
alter table public.cda_aprovacoes_envio_homologacao enable row level security;
revoke all on public.cda_aprovacoes_envio_homologacao from public,anon,authenticated;
grant select,insert,update on public.cda_aprovacoes_envio_homologacao to service_role;

create or replace function public.cda_fingerprint_lote_homologacao(p_lote_id bigint)
returns text language sql stable security invoker set search_path='' as $$
 select encode(extensions.digest(
    concat_ws('|',l.id::text,l.campanha_id::text,l.mensagem_id::text,
       coalesce(m.atualizado_em::text,''),
       coalesce(m.assunto,''),
       coalesce(m.conteudo::text,''),
       coalesce(string_agg(
         concat_ws(':',i.id::text,lower(btrim(i.email)),coalesce(i.nome,''),
                   i.chave_idempotencia::text),
         E'\n' order by i.id),'')
    ),'sha256'),'hex')
 from public.cda_envio_lotes l
 join public.cda_campanha_mensagens m
   on m.id=l.mensagem_id and m.campanha_id=l.campanha_id
 join public.cda_envio_lote_itens i on i.lote_id=l.id
 where l.id=p_lote_id and l.modo='homologacao'
 group by l.id,l.campanha_id,l.mensagem_id,m.atualizado_em,m.assunto,m.conteudo;
$$;
revoke all on function public.cda_fingerprint_lote_homologacao(bigint) from public,anon,authenticated;
grant execute on function public.cda_fingerprint_lote_homologacao(bigint) to service_role;

-- A checagem deve ser usada por todo caminho que possa iniciar solicitação.
create or replace function public.cda_lote_tem_autorizacao_valida(p_lote_id bigint)
returns boolean language sql stable security invoker set search_path='' as $$
 select coalesce(exists(
  select 1 from public.cda_envio_lotes l
  join public.cda_envio_lote_execucao_controle c on c.lote_id=l.id
  join public.cda_aprovacoes_envio_homologacao a on a.lote_id=l.id
  where l.id=p_lote_id and l.modo='homologacao' and l.situacao='preparado'
   and c.habilitado=true
   and c.autorizado_por=a.autorizado_por and c.autorizado_em=a.autorizado_em
   and a.revogado_em is null and a.expira_em>now()
   and a.fingerprint_sha256=public.cda_fingerprint_lote_homologacao(l.id)
   and a.destinatarios=(select count(*) from public.cda_envio_lote_itens i
                        where i.lote_id=l.id)
 ),false);
$$;
revoke all on function public.cda_lote_tem_autorizacao_valida(bigint) from public,anon,authenticated;
grant execute on function public.cda_lote_tem_autorizacao_valida(bigint) to service_role;

-- Trocar CHECKs provisórios somente depois de existir validação explícita;
-- nenhuma linha é ativada nesta migração.
alter table public.cda_envio_lote_execucao_controle
 drop constraint cda_envio_lote_execucao_controle_habilitado_check;
alter table public.cda_envio_lote_execucao_controle
 drop constraint cda_execucao_sem_autorizacao;
alter table public.cda_envio_lote_execucao_controle
 add constraint cda_execucao_autorizacao_completa check(
 (habilitado=false and autorizado_em is null and autorizado_por is null) or
 (habilitado=true and autorizado_em is not null and autorizado_por is not null)
 );

-- O executor segue negado até aprovação via RPC reservada à service_role.
insert into public.cda_envio_lote_execucao_controle
 (lote_id,habilitado,autorizado_em,autorizado_por)
 select l.id,false,null,null
 from public.cda_envio_lotes l where l.id=1 and l.modo='homologacao'
 on conflict(lote_id) do nothing;

-- Aprovação exige correspondência EXATA do snapshot; não há endpoint público
-- nem é acionada nesta migração. Prazo fixo de 30min para evitar permissão eterna.
create or replace function public.cda_aprovar_lote_homologacao(
 p_lote_id bigint,p_fingerprint_sha256 text,p_autorizado_por uuid
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare
 v_lote record;
 v_quantidade integer;
 v_fingerprint text;
begin
 if p_lote_id is null or p_lote_id<1 or p_autorizado_por is null or
    p_fingerprint_sha256 !~ '^[0-9a-f]{64}$' then
   raise exception 'Dados de aprovação inválidos';
 end if;
 select id,campanha_id,mensagem_id,situacao into v_lote
 from public.cda_envio_lotes where id=p_lote_id and modo='homologacao'
 for update;
 if not found or v_lote.situacao<>'preparado' then raise exception 'Lote indisponível'; end if;
 select count(*) into v_quantidade from public.cda_envio_lote_itens
 where lote_id=p_lote_id and situacao='pendente' and tentativa_id is null
 and resend_email_id is null;
 if v_quantidade<1 or v_quantidade>5 or
    v_quantidade<>(select count(*) from public.cda_envio_lote_itens where lote_id=p_lote_id)
    or exists(select 1 from public.cda_envio_lote_operacoes where lote_id=p_lote_id)
 then raise exception 'Itens não preparados para aprovação única';end if;
 if exists(
 select 1 from public.cda_envio_lote_itens i where i.lote_id=p_lote_id and (
   not exists(select 1 from public.cda_homologacao_destinatarios h
       where h.campanha_id=v_lote.campanha_id and h.ativo
         and lower(btrim(h.email))=lower(btrim(i.email)))
   or exists(select 1 from public.cda_email_supressoes s
       where lower(btrim(s.email))=lower(btrim(i.email)))
 )) then raise exception 'Destinatário inativo ou suprimido';end if;
 v_fingerprint:=public.cda_fingerprint_lote_homologacao(p_lote_id);
 if v_fingerprint is null or v_fingerprint<>p_fingerprint_sha256
 then raise exception 'Conteúdo ou lista divergente da confirmação';end if;
 if exists(select 1 from public.cda_aprovacoes_envio_homologacao where lote_id=p_lote_id)
 then raise exception 'Já houve aprovação deste lote; revisar manualmente';end if;
 insert into public.cda_aprovacoes_envio_homologacao
 (lote_id,fingerprint_sha256,destinatarios,autorizado_por,autorizado_em,expira_em)
 values(p_lote_id,v_fingerprint,v_quantidade,p_autorizado_por,now(),now()+interval '30 minutes');
 update public.cda_envio_lote_execucao_controle c
 set habilitado=true,autorizado_por=p_autorizado_por,
     autorizado_em=(select a.autorizado_em
       from public.cda_aprovacoes_envio_homologacao a where a.lote_id=p_lote_id),
     atualizado_em=now()
 where c.lote_id=p_lote_id and c.habilitado=false;
 if not found then raise exception 'Controle indisponível ou já habilitado'; end if;
 return jsonb_build_object('lote_id',p_lote_id,'aprovado',true,
  'destinatarios',v_quantidade,'expira_em',
  (select expira_em from public.cda_aprovacoes_envio_homologacao where lote_id=p_lote_id));
end $$;
revoke all on function public.cda_aprovar_lote_homologacao(bigint,text,uuid) from public,anon,authenticated;
grant execute on function public.cda_aprovar_lote_homologacao(bigint,text,uuid) to service_role;

create or replace function public.cda_revogar_lote_homologacao(p_lote_id bigint)
returns boolean language plpgsql security invoker set search_path='' as $$
begin
 update public.cda_envio_lotes set situacao='interrompido',atualizado_em=now()
 where id=p_lote_id and modo='homologacao' and situacao='preparado';
 update public.cda_aprovacoes_envio_homologacao
   set revogado_em=coalesce(revogado_em,now()) where lote_id=p_lote_id;
 update public.cda_envio_lote_execucao_controle
   set habilitado=false,autorizado_em=null,autorizado_por=null,atualizado_em=now()
 where lote_id=p_lote_id;
 return true;
end $$;
revoke all on function public.cda_revogar_lote_homologacao(bigint) from public,anon,authenticated;
grant execute on function public.cda_revogar_lote_homologacao(bigint) to service_role;

-- Diagnóstico deve refletir aprovação verdadeira SOMENTE quando íntegra.
create or replace function public.cda_resumo_preenvio_homologacao(p_lote_id bigint)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_lote record;v_destinos jsonb;v_total bigint;v_pendentes bigint;
 v_tem_ops boolean;v_autorizado boolean;
begin
 select l.id,l.campanha_id,l.mensagem_id,l.situacao,c.nome as campanha_nome,
  m.nome as mensagem_nome,m.assunto into v_lote
 from public.cda_envio_lotes l join public.cda_campanhas c on c.id=l.campanha_id
 join public.cda_campanha_mensagens m on m.id=l.mensagem_id
 where l.id=p_lote_id and l.modo='homologacao';
 if not found then raise exception 'Lote de homologação inválido';end if;
 select coalesce(jsonb_agg(jsonb_build_object('item_id',i.id,'nome',i.nome,
  'email',i.email,'situacao',i.situacao) order by i.id),'[]'::jsonb),
  count(*),count(*) filter(where i.situacao='pendente')
 into v_destinos,v_total,v_pendentes
 from public.cda_envio_lote_itens i where i.lote_id=p_lote_id;
 select exists(select 1 from public.cda_envio_lote_operacoes
  where lote_id=p_lote_id) into v_tem_ops;
 v_autorizado:=public.cda_lote_tem_autorizacao_valida(p_lote_id);
 return jsonb_build_object('lote_id',v_lote.id,'campanha_id',v_lote.campanha_id,
  'campanha_nome',v_lote.campanha_nome,'mensagem_id',v_lote.mensagem_id,
  'mensagem_nome',v_lote.mensagem_nome,'assunto',v_lote.assunto,
  'modo','homologacao','situacao',v_lote.situacao,
  'destinatarios',v_destinos,'total',v_total,'pendentes',v_pendentes,
  'tem_operacoes',v_tem_ops,'autorizado',v_autorizado,
  'envio_habilitado',v_autorizado,'fingerprint_sha256',
  public.cda_fingerprint_lote_homologacao(p_lote_id));
end $$;
revoke all on function public.cda_resumo_preenvio_homologacao(bigint) from public,anon,authenticated;
grant execute on function public.cda_resumo_preenvio_homologacao(bigint) to service_role;

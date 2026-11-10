-- Ciclo da Arte · fase segura de preparação de lotes (sem envio)
-- Exclusivamente aditivo. Não modifica as listas, leads ou histórico existentes.
create table if not exists public.cda_envio_lotes (
  id bigint generated always as identity primary key,
  campanha_id bigint not null references public.cda_campanhas(id),
  mensagem_id bigint not null references public.cda_campanha_mensagens(id),
  modo text not null default 'homologacao' check (modo = 'homologacao'),
  situacao text not null default 'preparado' check (situacao in ('preparado','interrompido')),
  criado_por uuid,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique(campanha_id,mensagem_id,modo)
);
create table if not exists public.cda_envio_lote_itens (
  id bigint generated always as identity primary key,
  lote_id bigint not null references public.cda_envio_lotes(id) on delete restrict,
  destinatario_origem_id bigint not null references public.cda_homologacao_destinatarios(id) on delete restrict,
  pessoa_id bigint not null references public.cda_homologacao_pessoas(id) on delete restrict,
  nome text not null,
  email text not null,
  situacao text not null default 'pendente' check (situacao in ('pendente','bloqueado')),
  criado_em timestamptz not null default now()
);
create unique index if not exists cda_envio_lote_itens_unico_email
  on public.cda_envio_lote_itens (lote_id,lower(email));
create table if not exists public.cda_email_supressoes (
  email text primary key,
  motivo text not null,
  criado_em timestamptz not null default now(),
  constraint cda_email_supressoes_normalizado check(email=lower(btrim(email)))
);
alter table public.cda_envio_lotes enable row level security;
alter table public.cda_envio_lote_itens enable row level security;
alter table public.cda_email_supressoes enable row level security;
revoke all on public.cda_envio_lotes,public.cda_envio_lote_itens,public.cda_email_supressoes from anon,authenticated;
grant select on public.cda_envio_lotes,public.cda_envio_lote_itens,public.cda_email_supressoes to authenticated;
create policy cda_envio_lotes_leitura_equipe on public.cda_envio_lotes for select to authenticated using ((select public.cda_e_membro_equipe()));
create policy cda_envio_lote_itens_leitura_equipe on public.cda_envio_lote_itens for select to authenticated using ((select public.cda_e_membro_equipe()));
create policy cda_email_supressoes_leitura_equipe on public.cda_email_supressoes for select to authenticated using ((select public.cda_e_membro_equipe()));
-- A função só pode ser executada com credencial privilegiada do servidor.
-- Nunca conceder EXECUTE a anon ou authenticated.
create or replace function public.cda_preparar_lote_homologacao(
  p_campanha_id bigint, p_mensagem_id bigint, p_usuario uuid
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_lote_id bigint;
  v_criado boolean := false;
  v_quantidade integer;
begin
  if p_campanha_id is null or p_mensagem_id is null or p_usuario is null then
    raise exception 'Parâmetros obrigatórios';
  end if;
  if not exists(select 1 from public.cda_campanha_mensagens where id=p_mensagem_id and campanha_id=p_campanha_id) then
    raise exception 'Mensagem não pertence à campanha';
  end if;
  -- Único lote por campanha/mensagem nesta fase; reaproveita snapshot sem criar duplicatas.
  insert into public.cda_envio_lotes(campanha_id,mensagem_id,modo,criado_por)
  values(p_campanha_id,p_mensagem_id,'homologacao',p_usuario)
  on conflict(campanha_id,mensagem_id,modo) do nothing
  returning id into v_lote_id;
  v_criado := v_lote_id is not null;
  if v_criado then
    insert into public.cda_envio_lote_itens(lote_id,destinatario_origem_id,pessoa_id,nome,email)
    select v_lote_id,d.id,d.pessoa_id,p.nome,lower(btrim(d.email))
    from (
      select distinct on(lower(btrim(email))) *
      from public.cda_homologacao_destinatarios
      where campanha_id=p_campanha_id and ativo and lower(btrim(email)) ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
      order by lower(btrim(email)),id
    ) d
    join public.cda_homologacao_pessoas p on p.id=d.pessoa_id
    where not exists(select 1 from public.cda_email_supressoes s where s.email=lower(btrim(d.email)));
  else
    select id into v_lote_id from public.cda_envio_lotes
    where campanha_id=p_campanha_id and mensagem_id=p_mensagem_id and modo='homologacao';
  end if;
  select count(*) into v_quantidade from public.cda_envio_lote_itens where lote_id=v_lote_id;
  return jsonb_build_object('lote_id',v_lote_id,'criado',v_criado,'quantidade',v_quantidade,'envio_habilitado',false);
end;
$$;
revoke all on function public.cda_preparar_lote_homologacao(bigint,bigint,uuid) from public,anon,authenticated;
grant execute on function public.cda_preparar_lote_homologacao(bigint,bigint,uuid) to service_role;

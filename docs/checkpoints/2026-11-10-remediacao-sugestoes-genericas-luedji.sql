-- Remediação pontual Luedji Luna / campanha 4 / 2026-11-10.
-- Apenas os 867 textos genéricos; nenhuma mensagem será enviada.
-- Script controlado e idempotente, com cópia histórica não exposta ao frontend.
begin;
create table if not exists public.cda_backup_sugestoes_luedji_20261110 (
  lead_id text primary key,
  mensagem_anterior text not null,
  salvo_em timestamptz not null default now()
);
alter table public.cda_backup_sugestoes_luedji_20261110 enable row level security;
revoke all on public.cda_backup_sugestoes_luedji_20261110 from public,anon,authenticated;
grant select on public.cda_backup_sugestoes_luedji_20261110 to service_role;
do $$
declare v_total int;v_copias int;v_limpas int;v_modelos int;
begin
  select count(*) into v_total
  from public.leads_b2c where campanha_id=4
    and mensagem_sugerida ilike '%Reparamos que faz um tempo que%';
  if v_total not in (0,867) then
    raise exception 'Abortado: % mensagens genéricas; esperadas 867 ou 0 em reexecução',v_total;
  end if;
  if v_total=867 then
    insert into public.cda_backup_sugestoes_luedji_20261110(lead_id,mensagem_anterior)
    select id,mensagem_sugerida from public.leads_b2c
    where campanha_id=4 and mensagem_sugerida ilike '%Reparamos que faz um tempo que%'
    on conflict(lead_id) do nothing;
    select count(*) into v_copias from public.cda_backup_sugestoes_luedji_20261110;
    if v_copias<>867 then raise exception 'Abortado: snapshot incompleto, %/867',v_copias; end if;
    update public.leads_b2c set mensagem_sugerida=null
    where campanha_id=4 and mensagem_sugerida ilike '%Reparamos que faz um tempo que%'
      and id in(select lead_id from public.cda_backup_sugestoes_luedji_20261110);
    get diagnostics v_limpas=row_count;
    if v_limpas<>867 then raise exception 'Abortado: somente %/867 sugestões limpas',v_limpas; end if;
  end if;
  if not exists(select 1 from public.cda_campanha_mensagens where id=1 and campanha_id=4
    and nullif(btrim(conteudo->>'texto'),'') is not null
    and nullif(btrim(conteudo->>'botaoLink'),'') is not null) then
    raise exception 'Abortado: mensagem oficial LUEDJI20 não está completa';
  end if;
  update public.cda_campanhas set modelo_mensagem_sugerida=(
    select concat(
      coalesce(nullif(btrim(m.conteudo->>'saudacao'),''),'Oi, {nome}!'),
      E'\n\n',m.conteudo->>'texto',
      E'\n\n',m.conteudo->>'botaoTexto',': ',m.conteudo->>'botaoLink'
    )
    from public.cda_campanha_mensagens m where m.id=1 and m.campanha_id=4
  )
  where id=4 and nullif(btrim(modelo_mensagem_sugerida),'') is null
    and nullif(btrim(modelo_mensagem_final),'') is null;
  get diagnostics v_modelos=row_count;
  if v_modelos not in (0,1) then raise exception 'Abortado: quantidade de campanhas indevida'; end if;
end $$;
commit;

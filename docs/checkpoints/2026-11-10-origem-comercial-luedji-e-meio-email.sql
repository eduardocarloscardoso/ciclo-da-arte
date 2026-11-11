-- Ciclo da Arte: correção auditável da origem comercial dos leads da campanha 4.
-- A origem é E-COMMERCE LUEDJI LUNA (canal 1778540708009).
-- A comunicação prevista é E-mail (ID 'email'). NENHUM envio é executado.
begin;
create table if not exists public.cda_backup_origem_leads_luedji_20261110 (
  lead_id text primary key,
  campanha_id bigint not null,
  canal_id_anterior bigint,
  gravado_em timestamptz not null default now()
);
alter table public.cda_backup_origem_leads_luedji_20261110 enable row level security;
revoke all on public.cda_backup_origem_leads_luedji_20261110 from public,anon,authenticated;
create table if not exists public.cda_backup_canais_campanha_luedji_20261110 (
  campanha_id bigint primary key,
  canais_anteriores text[] not null,
  gravado_em timestamptz not null default now()
);
alter table public.cda_backup_canais_campanha_luedji_20261110 enable row level security;
revoke all on public.cda_backup_canais_campanha_luedji_20261110 from public,anon,authenticated;
do $$
declare v_total int;v_atingidos int;v_backup int;v_atualizados int;
begin
  if not exists (select 1 from public.canais where id=1778540708009 and nome='E-COMMERCE LUEDJI LUNA') then
    raise exception 'Canal de origem não localizado com nome esperado';
  end if;
  select count(*) into v_total from public.leads_b2c where campanha_id=4;
  if v_total<>867 then raise exception 'Campanha com % leads, esperados 867',v_total; end if;
  select count(*) into v_atingidos from public.leads_b2c l where l.campanha_id=4
    and exists(select 1 from public.compras c where c.cliente_id=l.cliente_id and c.canal_id=1778540708009)
    and not exists(select 1 from public.compras c where c.cliente_id=l.cliente_id and c.canal_id=1778540708679);
  if v_atingidos<>867 then raise exception 'Origem de apenas % leads comprovada; abortado',v_atingidos; end if;
  if exists (select 1 from public.leads_b2c where campanha_id=4 and canal_id is not null and canal_id<>1778540708009) then
    raise exception 'Campanha possui canal comercial conflitante';
  end if;
  insert into public.cda_backup_origem_leads_luedji_20261110(lead_id,campanha_id,canal_id_anterior)
    select id,campanha_id,canal_id from public.leads_b2c where campanha_id=4
    on conflict(lead_id) do nothing;
  select count(*) into v_backup from public.cda_backup_origem_leads_luedji_20261110;
  if v_backup<>867 then raise exception 'Backup incompleto: %',v_backup; end if;
  update public.leads_b2c set canal_id=1778540708009
    where campanha_id=4 and canal_id is null;
  get diagnostics v_atualizados=row_count;
  if v_atualizados not in (0,867) then raise exception 'Alteração parcial: %',v_atualizados; end if;
  insert into public.cda_backup_canais_campanha_luedji_20261110(campanha_id,canais_anteriores)
    select id,canais_selecionados from public.cda_campanhas where id=4
    on conflict(campanha_id) do nothing;
  if not exists(select 1 from public.cda_campanhas where id=4
     and (canais_selecionados='{}'::text[] or canais_selecionados=ARRAY['email']::text[])) then
    raise exception 'Canais de comunicação da campanha alterados por outra operação';
  end if;
  update public.cda_campanhas set canais_selecionados=ARRAY['email']::text[]
   where id=4 and canais_selecionados='{}'::text[];
  if exists(select 1 from public.leads_b2c where campanha_id=4 and canal_id<>1778540708009) then
    raise exception 'Verificação de integridade falhou';
  end if;
end $$;
commit;
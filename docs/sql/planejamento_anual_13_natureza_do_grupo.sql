-- ════════════════════════════════════════════════════════════════════
-- Ecossistema — 13: a NATUREZA das despesas vem só do GRUPO — 28/10/2026 (subetapa 2.3).
-- Aprovado por Cardoso em 28/10/2026.
-- • Centro de despesa ligado a grupo: natureza = natureza do grupo (o trigger copia;
--   trocar o grupo troca a natureza). Não há mais conflito centro × grupo.
-- • Mudar a natureza do grupo propaga para todos os seus centros.
-- • A natureza da subconta deixa de valer para centros com grupo (fica só como
--   reserva para centro ainda sem grupo).
-- • Conferido antes: 0 centros com natureza efetiva diferente do grupo → nenhum número muda.
-- Backup: cda_pa_centro_natureza_backup_20261028 (id, natureza antes) — apagar após validação.
-- ════════════════════════════════════════════════════════════════════
create table if not exists public.cda_pa_centro_natureza_backup_20261028 as
  select id, natureza from public.cda_pa_centro_custo;
alter table public.cda_pa_centro_natureza_backup_20261028 enable row level security;

create or replace function public.cda_pa_valida_grupo_centro() returns trigger
language plpgsql security definer set search_path to 'public' as $$
declare g record; tipo_conta text;
begin
  if new.grupo_id is null then return new; end if;
  select * into g from public.cda_grupo where id = new.grupo_id;
  select k.tipo into tipo_conta from public.cda_pa_subconta s join public.cda_pa_conta k on k.id = s.conta_id where s.id = new.subconta_id;
  if tipo_conta = 'RECEITAS' then
    if g.tipo <> 'Receita' then raise exception 'Centro de receita só pode ser ligado a grupo de Receita.' using errcode='23514'; end if;
    return new;
  end if;
  if g.tipo <> 'Despesa' then raise exception 'Centro de despesa só pode ser ligado a grupo de Despesa.' using errcode='23514'; end if;
  if g.natureza is not null then new.natureza := g.natureza; end if;  -- natureza vem do grupo
  return new;
end $$;

create or replace function public.cda_propaga_natureza_grupo() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  if new.tipo = 'Despesa' and new.natureza is distinct from old.natureza and new.natureza is not null then
    update public.cda_pa_centro_custo set natureza = new.natureza where grupo_id = new.id;
  end if;
  return new;
end $$;
drop trigger if exists cda_propaga_natureza_grupo on public.cda_grupo;
create trigger cda_propaga_natureza_grupo after update of natureza on public.cda_grupo
  for each row execute function public.cda_propaga_natureza_grupo();

-- Sincroniza: centros de despesa com grupo recebem a natureza do grupo (71 herdavam da subconta)
update public.cda_pa_centro_custo c set natureza = g.natureza
  from public.cda_grupo g where g.id = c.grupo_id and g.tipo = 'Despesa' and g.natureza is not null and c.natureza is distinct from g.natureza;

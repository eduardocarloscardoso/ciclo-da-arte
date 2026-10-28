-- ════════════════════════════════════════════════════════════════════
-- Ecossistema — 15: Brindes / Permutas é DESPESA variável, não receita — 28/10/2026 (Cardoso).
-- • Desfaz o lado de receita criado hoje (sem nenhum valor): centro 510009, subconta de receita
--   "BRINDES / PERMUTAS" (150004) e grupo de receita "Brindes / Permutas" (20).
-- • Centro de despesa 420008 "Brindes" → "Brindes / Permutas", do grupo Marketing fixo para
--   Marketing (variável) — natureza vem do grupo. Mercado 0,30% e Marca comum 0,30% mantidos.
--   Apelido de importação "Brindes" → 420008 (a planilha ainda usa o nome antigo).
-- • Canal do Financeiro "CICLO BRINDES / PERMUTAS" (sem valor comercial): passa a apontar para o
--   centro de DESPESA 420008 e o grupo Marketing (despesa). As regras do banco passam a aceitar canal
--   em grupo/centro de despesa (canal de saída sem valor comercial).
-- ════════════════════════════════════════════════════════════════════
create or replace function public.cda_valida_grupo_canal() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  if new.grupo_id is not null and not exists (select 1 from public.cda_grupo where id = new.grupo_id) then
    raise exception 'Grupo inexistente.' using errcode='23514';
  end if;
  return new;
end $$;
create or replace function public.cda_valida_canal_centros() returns trigger
language plpgsql security definer set search_path to 'public' as $$
declare tg text; tc text;
begin
  select tipo into tg from public.cda_grupo where id = new.grupo_id;
  if new.centro_custo_id is not null then
    select k.tipo into tc from public.cda_pa_centro_custo c join public.cda_pa_subconta s on s.id=c.subconta_id join public.cda_pa_conta k on k.id=s.conta_id where c.id=new.centro_custo_id;
    if tc = 'DESPESAS' and coalesce(tg,'') <> 'Despesa' then
      raise exception 'Canal ligado a centro de DESPESA precisa estar num grupo de Despesa (canal sem valor comercial).' using errcode='23514'; end if;
    if tc = 'RECEITAS' and coalesce(tg,'Receita') <> 'Receita' then
      raise exception 'Canal ligado a centro de RECEITA precisa estar num grupo de Receita.' using errcode='23514'; end if;
  end if;
  if new.comissao_centro_id is not null and not exists (select 1 from public.cda_pa_centro_custo c join public.cda_pa_subconta s on s.id=c.subconta_id join public.cda_pa_conta k on k.id=s.conta_id where c.id=new.comissao_centro_id and k.tipo='DESPESAS') then
    raise exception 'O destino da comissão precisa ser um centro de DESPESA.' using errcode='23514'; end if;
  return new;
end $$;
drop trigger if exists cda_valida_canal_centros on public.canais;
create trigger cda_valida_canal_centros before insert or update of centro_custo_id, comissao_centro_id, grupo_id on public.canais
  for each row execute function public.cda_valida_canal_centros();

update public.canais set grupo_id = (select id from public.cda_grupo where tipo='Despesa' and nome='Marketing'), centro_custo_id = 420008, comissao_centro_id = null
 where id = 1784125900691;

update public.cda_pa_centro_custo set nome = 'Brindes / Permutas', grupo_id = (select id from public.cda_grupo where tipo='Despesa' and nome='Marketing'),
  atualizado_por = 'Cardoso 28/10/2026 — Brindes/Permutas é despesa variável (antes "Brindes", Marketing fixo)'
 where id = 420008;
insert into public.cda_pa_alias_importacao (alias, centro_custo_id, atualizado_por)
select 'Brindes', 420008, 'Cardoso 28/10/2026 — nome antigo do centro' where not exists (select 1 from public.cda_pa_alias_importacao where alias_norm='brindes');

delete from public.cda_pa_meta_estrutura where chave = 'cc:510009';
delete from public.cda_pa_centro_custo where id = 510009;
delete from public.cda_pa_subconta where id = 150004 and nome = 'BRINDES / PERMUTAS';
delete from public.cda_grupo where tipo = 'Receita' and nome = 'Brindes / Permutas';

-- ════════════════════════════════════════════════════════════════════
-- Planejamento Anual (PROJETO 6) — 08: Mercado % congelado — 25/10/2026.
-- Só o administrador altera pct_mercado em cda_pa_meta_estrutura (centros,
-- margem de contribuição e alvo de custos fixos). Demais campos seguem a
-- regra de escrita normal. Chamadas sem usuário (manutenção no servidor) passam.
-- ════════════════════════════════════════════════════════════════════
create or replace function public.cda_pa_trava_mercado() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  if auth.jwt() ->> 'email' is null then return new; end if;
  if (tg_op = 'INSERT' and new.pct_mercado is not null)
     or (tg_op = 'UPDATE' and new.pct_mercado is distinct from old.pct_mercado) then
    if not public.cda_pa_is_admin() then
      raise exception 'Somente o administrador pode alterar o Mercado %%.' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists cda_pa_trava_mercado on public.cda_pa_meta_estrutura;
create trigger cda_pa_trava_mercado before insert or update on public.cda_pa_meta_estrutura
  for each row execute function public.cda_pa_trava_mercado();

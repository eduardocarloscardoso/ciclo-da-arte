-- ════════════════════════════════════════════════════════════════════
-- Histórico de Compras — proteção no banco contra reimportação e Consumidor Final — 30/10/2026 (Cardoso).
-- Complementa a regra do importador (financeiro.html › sincronizarHistoricoComprasDaImportacao):
--   • linha de origem 'importado' de um pedido (nº + canal) que já foi gravado há mais de 10 minutos
--     (importação anterior) é descartada — as linhas do mesmo pedido gravadas na mesma importação passam;
--   • linha de origem 'importado' de cliente "Consumidor Final" é descartada (nota contábil de evento).
-- Lançamentos manuais (origem diferente de 'importado') não são afetados.
-- ════════════════════════════════════════════════════════════════════
create or replace function public.cda_compras_bloqueia_reimportacao() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  if coalesce(new.origem,'') <> 'importado' then return new; end if;
  if new.cliente_id is not null and exists (select 1 from public.clientes c where c.id = new.cliente_id and c.nome ilike '%consumidor%final%') then
    return null;
  end if;
  if new.numero_pedido is not null and exists (
       select 1 from public.compras x
        where x.numero_pedido = new.numero_pedido and x.canal_id is not distinct from new.canal_id
          and x.criado_em < now() - interval '10 minutes') then
    return null;
  end if;
  return new;
end $$;
drop trigger if exists cda_compras_bloqueia_reimportacao on public.compras;
create trigger cda_compras_bloqueia_reimportacao before insert on public.compras
  for each row execute function public.cda_compras_bloqueia_reimportacao();

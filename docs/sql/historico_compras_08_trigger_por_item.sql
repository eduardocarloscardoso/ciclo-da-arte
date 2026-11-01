-- ════════════════════════════════════════════════════════════════════
-- Histórico de Compras — trava de reimportação por ITEM (01/11/2026, Cardoso).
-- Antes (30/10/2026): pedido importado já gravado há mais de 10 minutos (mesmo nº + canal) bloqueava
-- qualquer item novo daquele pedido — um pedido gravado pela metade (sincronização interrompida) não
-- podia ser completado na reimportação (caso do pedido 8179 de setembro/2026).
-- Agora: bloqueia só o item idêntico já gravado (mesmo nº de pedido + canal + produto + variação +
-- quantidade + valor), há mais de 10 minutos. Consumidor Final continua bloqueado.
-- O importador (financeiro.html) passou a comparar item a item e grava só os itens que faltam.
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
          and lower(trim(coalesce(x.produto,''))) = lower(trim(coalesce(new.produto,'')))
          and lower(trim(coalesce(x.variacao,''))) = lower(trim(coalesce(new.variacao,'')))
          and coalesce(x.quantidade,0) = coalesce(new.quantidade,0)
          and round(coalesce(x.valor_total,0),2) = round(coalesce(new.valor_total,0),2)
          and x.criado_em < now() - interval '10 minutes') then
    return null;
  end if;
  return new;
end $$;

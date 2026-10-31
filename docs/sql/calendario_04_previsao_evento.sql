-- ════════════════════════════════════════════════════════════════════
-- Calendário Comercial — Previsão do evento informada pelo usuário — 31/10/2026 (Cardoso).
-- • cda_cal_evento: publico_previsto (novo), projecao_status ('pendente' | 'sugerido' | 'revisado' |
--   'so_informar'), projecao_por / projecao_em (quem confirmou a previsão e quando).
--   Regra: Planejado / A confirmar / Confirmado exigem quantidade e ticket (exceto 'so_informar');
--   Total Venda Previsto = quantidade × ticket (peças × ticket por peça; e-commerce: pedidos × ticket
--   por pedido).
-- • View cda_v_prestacao_canal_mes: itens das Prestações de Contas por canal (seção) e mês — peças e
--   valor de venda. Base histórica junto com cda_v_vendas_canal_mes (Histórico de Compras).
-- • Carga (opção "a" aprovada por Cardoso): os eventos com projeção recebem quantidade e ticket
--   sugeridos pelo histórico mantendo o valor aprovado (quantidade = projeção ÷ ticket, arredondada;
--   projeção = quantidade × ticket), marcados 'sugerido' até alguém revisar. Ticket por peça dos
--   shows/feiras: Prestação quando existe, senão Histórico, 2025–2026, nos meses com evento e sem
--   nota consolidada (ticket > R$ 1.000/peça indica nota única de evento). E-commerce: ticket por
--   pedido do grupo E-commerce no mesmo mês de 2025 (Histórico).
-- ════════════════════════════════════════════════════════════════════
alter table public.cda_cal_evento add column if not exists publico_previsto int check (publico_previsto is null or publico_previsto >= 0);
alter table public.cda_cal_evento add column if not exists projecao_status text not null default 'pendente';
alter table public.cda_cal_evento drop constraint if exists cda_cal_evento_projecao_status_check;
alter table public.cda_cal_evento add constraint cda_cal_evento_projecao_status_check check (projecao_status in ('pendente','sugerido','revisado','so_informar'));
alter table public.cda_cal_evento add column if not exists projecao_por text;
alter table public.cda_cal_evento add column if not exists projecao_em timestamptz;

create or replace view public.cda_v_prestacao_canal_mes with (security_invoker = true) as
with s as (
  select p.id, coalesce(nullif(p.dados->>'mes',''), p.mes_ref) as ano_mes,
         coalesce(nullif(sec->>'canal_id','')::bigint, p.canal_id) as canal_id, sec->'itens' as itens
    from public.prestacoes p
   cross join lateral jsonb_array_elements(
     case when jsonb_typeof(p.dados->'secoes') = 'array' and jsonb_array_length(p.dados->'secoes') > 0 then p.dados->'secoes'
          else jsonb_build_array(jsonb_build_object('canal_id', p.canal_id, 'itens', p.dados->'itens')) end) sec
)
select s.canal_id, s.ano_mes, count(distinct s.id)::int as prestacoes,
       coalesce(sum((it->>'qtde')::numeric), 0)::int as pecas,
       round(coalesce(sum(coalesce((it->>'tvenda')::numeric, (it->>'total')::numeric)), 0), 2) as valor
  from s cross join lateral jsonb_array_elements(case when jsonb_typeof(s.itens) = 'array' then s.itens else '[]'::jsonb end) it
 where s.canal_id is not null and s.ano_mes ~ '^\d{4}-\d{2}$'
 group by s.canal_id, s.ano_mes;
grant select on public.cda_v_prestacao_canal_mes to authenticated;

-- ── Carga dos eventos atuais ──────────────────────────────────────────
-- Ticket por peça por centro de receita (shows / feiras)
with base as (
  select c.centro_custo_id, e.ano_mes,
         coalesce(pr.valor, v.valor) as valor, coalesce(pr.pecas, v.pecas) as pecas
    from public.cda_canal_eventos_mes e
    join public.canais c on c.id = e.canal_id
    left join public.cda_v_prestacao_canal_mes pr on pr.canal_id = e.canal_id and pr.ano_mes = e.ano_mes
    left join public.cda_v_vendas_canal_mes v on v.canal_id = e.canal_id and v.ano_mes = e.ano_mes
   where e.qtd_eventos > 0 and e.ano_mes >= '2025-01'
), tk as (
  select centro_custo_id, round(sum(valor) / nullif(sum(pecas), 0), 2) as ticket
    from base where pecas > 0 and valor / pecas <= 1000
   group by centro_custo_id
)
update public.cda_cal_evento ev
   set ticket_medio = tk.ticket,
       qtd_prevista = round(ev.projecao / tk.ticket),
       projecao = round(round(ev.projecao / tk.ticket) * tk.ticket, 2),
       criterio = 'Unidades',
       projecao_status = 'sugerido',
       memoria_projecao = 'Sugerido em 31/10/2026 — revisar: ' || round(ev.projecao / tk.ticket) || ' peças × R$ ' || replace(tk.ticket::text, '.', ',') ||
         '/peça (ticket da Prestação ou do Histórico 2025–2026, meses com evento, sem notas consolidadas). Base aprovada antes: ' || ev.memoria_projecao
  from tk
 where ev.centro_custo_id = tk.centro_custo_id and ev.campanha_id is not null and ev.projecao is not null
   and ev.qtd_prevista is null and ev.grupo_id is null and coalesce(ev.memoria_projecao,'') not ilike 'Manual%';

-- E-commerce (grupo E-commerce): ticket por pedido no mesmo mês de 2025 (data do evento → mês; Cyber Monday usa dez)
with tk as (
  select v.ano_mes, round(sum(v.valor) / nullif(sum(v.pedidos), 0), 2) as ticket
    from public.cda_v_vendas_canal_mes v join public.canais c on c.id = v.canal_id
   where c.grupo_id = 22 and v.ano_mes in ('2025-11', '2025-12')
   group by v.ano_mes
)
update public.cda_cal_evento ev
   set ticket_medio = tk.ticket,
       qtd_prevista = round(ev.projecao / tk.ticket),
       projecao = round(round(ev.projecao / tk.ticket) * tk.ticket, 2),
       criterio = 'Pedidos',
       projecao_status = 'sugerido',
       memoria_projecao = 'Sugerido em 31/10/2026 — revisar: ' || round(ev.projecao / tk.ticket) || ' pedidos × R$ ' || replace(tk.ticket::text, '.', ',') ||
         '/pedido (ticket por pedido do grupo E-commerce em ' || tk.ano_mes || '). Base aprovada antes: ' || ev.memoria_projecao
  from tk
 where ev.grupo_id = 22 and ev.campanha_id is not null and ev.projecao is not null and ev.qtd_prevista is null
   and tk.ano_mes = case when ev.evento ilike 'Cyber%' then '2025-12' else '2025-' || lpad(coalesce(ev.mes, extract(month from ev.inicio)::int)::text, 2, '0') end;

-- Eventos com números informados por Cardoso → revisados; "só informar" e "a definir"
update public.cda_cal_evento set projecao_status = 'revisado', projecao_por = coalesce(projecao_por, 'Cardoso (números informados até 30/10/2026)'), projecao_em = coalesce(projecao_em, now())
 where campanha_id is not null and projecao is not null and projecao_status = 'pendente';
update public.cda_cal_evento set projecao_status = 'so_informar'
 where campanha_id is not null and projecao is null and memoria_projecao ilike 'Só informar%';

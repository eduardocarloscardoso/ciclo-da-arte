-- ════════════════════════════════════════════════════════════════════
-- Comercial · Campanha com valores de filtro + lista congelada (04/11/2026)
--
-- Decisão de Cardoso: a SEGMENTAÇÃO guarda só QUAIS filtros usa (tipos);
-- os VALORES (qual centro de custo, qual UF, quantos dias...) ficam sempre
-- na CAMPANHA. Esta migração é só de acréscimo — não altera nem remove nada
-- que a versão em produção usa:
--   1. cda_campanhas.filtros_valores  → filtros completos (tipo + valor)
--   2. cda_campanha_destinatarios      → lista congelada da campanha
--   3. as campanhas existentes recebem os valores do segmento que usam hoje
-- A retirada dos valores de segmentos_salvos é feita na publicação
-- (comercial_segmentacao_so_tipos.sql), com backup.
-- ════════════════════════════════════════════════════════════════════

alter table public.cda_campanhas add column if not exists filtros_valores jsonb;
comment on column public.cda_campanhas.filtros_valores is
  'Filtros da campanha com valores (formato do motor de segmentação: [{tipo, operador, valor}]). A segmentação (publico_segmento_id) diz quais tipos; os valores ficam aqui.';

create table if not exists public.cda_campanha_destinatarios (
  id            bigint generated always as identity primary key,
  campanha_id   bigint not null references public.cda_campanhas(id) on delete cascade,
  cliente_id    bigint not null,
  nome          text,
  email         text,
  email_valido  boolean not null default false,
  uf            text,
  cidade        text,
  congelado_em  timestamptz not null default now(),
  congelado_por text,
  unique (campanha_id, cliente_id)
);
comment on table public.cda_campanha_destinatarios is
  'Lista congelada de cada campanha: a "foto" do público no momento da confirmação. Base do envio de e-mail (Resend) e da atribuição de vendas.';
create index if not exists cda_campanha_destinatarios_campanha on public.cda_campanha_destinatarios (campanha_id);

alter table public.cda_campanha_destinatarios enable row level security;
drop policy if exists membros_equipe on public.cda_campanha_destinatarios;
create policy membros_equipe on public.cda_campanha_destinatarios
  for all to authenticated using (cda_e_membro_equipe()) with check (cda_e_membro_equipe());

-- Campanhas existentes: copiam os valores do segmento que usam hoje
update public.cda_campanhas c
   set filtros_valores = s.filtros
  from public.segmentos_salvos s
 where s.id = c.publico_segmento_id
   and c.filtros_valores is null;

notify pgrst, 'reload schema';

-- ════════════════════════════════════════════════════════════════════
-- Comercial · Segmentação guarda só os TIPOS de filtro (publicação, 04/11/2026)
-- Rodar SOMENTE junto com a publicação do frontend novo (main), depois de
-- comercial_campanha_filtros_lista.sql. As campanhas já têm os valores em
-- cda_campanhas.filtros_valores; aqui os segmentos ficam só com {tipo}.
-- ════════════════════════════════════════════════════════════════════

-- 1. Backup
create table if not exists public.bkp_segmentos_salvos_20261104 as table public.segmentos_salvos;
create table if not exists public.bkp_cda_campanhas_20261104 as table public.cda_campanhas;

-- 2. Garantia: toda campanha que aponta para um segmento tem os seus valores
update public.cda_campanhas c
   set filtros_valores = s.filtros
  from public.segmentos_salvos s
 where s.id = c.publico_segmento_id
   and (c.filtros_valores is null or jsonb_array_length(c.filtros_valores) = 0);

-- 3. Segmentos: só os tipos (um por tipo, na ordem em que aparecem)
update public.segmentos_salvos s
   set filtros = coalesce((
         select jsonb_agg(jsonb_build_object('tipo', t.tipo) order by t.pos)
           from (select f->>'tipo' as tipo, min(ord) as pos
                   from jsonb_array_elements(s.filtros) with ordinality as e(f, ord)
                  group by f->>'tipo') t
       ), '[]'::jsonb);

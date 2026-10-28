-- ════════════════════════════════════════════════════════════════════
-- Ecossistema — 12: Canal do Financeiro → centro de receita e destino da comissão — 28/10/2026.
-- Aprovado por Cardoso em 28/10/2026 (subetapa 2.2).
-- • canais.centro_custo_id: centro de RECEITA do Planejamento onde a venda do canal é lançada
--   (vários canais podem apontar para o mesmo centro).
-- • canais.comissao_centro_id: centro de DESPESA onde a comissão do canal é lançada
--   (artista/e-commerce → Comissões Artistas Collabs; revenda → Comissões Revendas;
--   Feiras e Bazares → Eventos - Royalties/Taxas de Feiras (organizador); Showroom/SAC 5% →
--   Comissões Vendedores). Nulo = canal sem comissão.
-- • % efetivo da comissão (calculado no sistema) = Comissão × (1 − Imposto − Operacional − Royalties).
-- • Novos: grupo de receita "Canais inativos"; subconta de receita "BRINDES / PERMUTAS";
--   centros SHOWS CICLO 360 GRAUS, E-COMMERCE CICLO 360 GRAUS, REVENDAS / E-COMMERCES INATIVOS,
--   BRINDES / PERMUTAS. Cybervolt e Jonathan Ferr passam para o grupo "Canais inativos".
-- Só inclui colunas/linhas novas; nenhum valor existente é apagado.
-- ════════════════════════════════════════════════════════════════════
alter table public.canais add column if not exists centro_custo_id bigint references public.cda_pa_centro_custo(id) on delete set null;
alter table public.canais add column if not exists comissao_centro_id bigint references public.cda_pa_centro_custo(id) on delete set null;
create or replace function public.cda_valida_canal_centros() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  if new.centro_custo_id is not null and not exists (select 1 from public.cda_pa_centro_custo c join public.cda_pa_subconta s on s.id=c.subconta_id join public.cda_pa_conta k on k.id=s.conta_id where c.id=new.centro_custo_id and k.tipo='RECEITAS') then
    raise exception 'O centro do canal precisa ser um centro de RECEITA.' using errcode='23514'; end if;
  if new.comissao_centro_id is not null and not exists (select 1 from public.cda_pa_centro_custo c join public.cda_pa_subconta s on s.id=c.subconta_id join public.cda_pa_conta k on k.id=s.conta_id where c.id=new.comissao_centro_id and k.tipo='DESPESAS') then
    raise exception 'O destino da comissão precisa ser um centro de DESPESA.' using errcode='23514'; end if;
  return new;
end $$;
drop trigger if exists cda_valida_canal_centros on public.canais;
create trigger cda_valida_canal_centros before insert or update of centro_custo_id, comissao_centro_id on public.canais
  for each row execute function public.cda_valida_canal_centros();

insert into public.cda_grupo (tipo, natureza, nome, ordem)
select 'Receita', null, 'Canais inativos', 110 where not exists (select 1 from public.cda_grupo where tipo='Receita' and nome='Canais inativos');

insert into public.cda_pa_subconta (conta_id, nome, ordem, tipo_venda, atualizado_por)
select 1, 'BRINDES / PERMUTAS', 20, 'direta', 'Cardoso 28/10/2026' where not exists (select 1 from public.cda_pa_subconta where conta_id=1 and nome='BRINDES / PERMUTAS');

insert into public.cda_pa_centro_custo (subconta_id, nome, ordem, atualizado_por, grupo_id)
select v.sub, v.nome, v.ordem, 'Cardoso 28/10/2026', (select id from public.cda_grupo where tipo='Receita' and nome=v.grupo)
from (values
 (7,'SHOWS CICLO 360 GRAUS',24,'Shows de artistas'),
 (3,'E-COMMERCE CICLO 360 GRAUS',100,'E-commerce'),
 (6,'REVENDAS / E-COMMERCES INATIVOS',102,'Canais inativos'),
 ((select id from public.cda_pa_subconta where conta_id=1 and nome='BRINDES / PERMUTAS'),'BRINDES / PERMUTAS',1,'Brindes / Permutas')) v(sub, nome, ordem, grupo)
where not exists (select 1 from public.cda_pa_centro_custo c where c.subconta_id=v.sub and c.nome=v.nome);

update public.canais set grupo_id = (select id from public.cda_grupo where tipo='Receita' and nome='Canais inativos')
 where id in (1784125416538, 1784126142428);

-- canal → centro de receita (por nome do centro) e destino da comissão (id do centro de despesa)
update public.canais k set centro_custo_id = c.id, comissao_centro_id = m.dest
from (values
 (1778540708657,'PRIVATE LABEL',null::bigint),
 (1,'SHOWS DUDA BEAT',60001),(1780246180654,'SHOWS GILSONS',60001),(1778540708679,'SHOWS LUEDJI LUNA',60001),(1780173066481,'SHOWS RACHEL REIS',60001),
 (1780179954834,'SHOWS RICO DALASSAM',60001),(1785487775866,'SHOWS ZUDIZILLA',60001),(1785278166922,'SHOWS MULTIMARCAS',null),
 (1783540375824,'SHOWS CICLO 360 GRAUS',60001),
 (1778540708680,'REVENDA BAFU',30011),(1778540708481,'REVENDA CIRCO VOADOR',30011),(1778540708232,'REVENDA HOTEL JO & JOE',30011),
 (1778540708819,'REVENDA LONGBOARD PARADISE',30011),(1782323141713,'REVENDA NORTE',null),
 (1784125416538,'REVENDAS / E-COMMERCES INATIVOS',null),(1784126142428,'REVENDAS / E-COMMERCES INATIVOS',null),
 (1778540708019,'E-COMMERCE CICLO ORIGINAL',null),(1778540708797,'E-COMMERCE CIRCO VOADOR',60001),(2,'E-COMMERCE DUDA BEAT',60001),
 (1780086179953,'E-COMMERCE GILSONS',60001),(1778540708009,'E-COMMERCE LUEDJI LUNA',60001),(3,'E-COMMERCE MULTIMARCAS',null),
 (1780179827801,'E-COMMERCE NEO BXD',60001),(1778540708076,'E-COMMERCE RACHEL REIS',60001),(1778540708746,'E-COMMERCE RICO DALASSAM',60001),
 (1778540708890,'E-COMMERCE TRAMA AFETIVA',null),(1782323313149,'E-COMMERCE ZUDIZILLA',60001),(1785488015109,'E-COMMERCE MULTIMARCAS',null),
 (1783540337136,'E-COMMERCE CICLO 360 GRAUS',60001),
 (1782322947851,'E-COMMERCE / SHOWS KAÊ GUAJAJARA',60001),
 (1778540708909,'FEIRAS E BAZARES',30014),
 (1778540708105,'REVENDA CICLO - SHOWROOM / SAC',60002),(1780237393956,'CICLO EM CASA',null),(1778540708224,'VENDAS SEM VENDEDOR',null),
 (1780237756760,'CICLO COLABORADORES - VENDA SUBSIDIADA',null),(1783267195355,'CICLO COLABORADORES - VENDA SUBSIDIADA',null),(1783267126998,'CICLO COLABORADORES - VENDA SUBSIDIADA',null),
 (1783685161076,'Market Place - Vendas Terceiros',null),(1783267402754,'Market Place - Vendas Terceiros',null),
 (1784125900691,'BRINDES / PERMUTAS',null)) m(id, centro, dest)
join public.cda_pa_centro_custo c on c.nome = m.centro
join public.cda_pa_subconta s on s.id = c.subconta_id and s.conta_id = 1
where k.id = m.id;

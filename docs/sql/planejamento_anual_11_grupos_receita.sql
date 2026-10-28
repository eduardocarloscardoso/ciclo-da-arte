-- ════════════════════════════════════════════════════════════════════
-- Ecossistema — 11: Grupos de RECEITA (centros do Planejamento + canais do Financeiro) — 28/10/2026.
-- Aprovado por Cardoso em 27–28/10/2026. 10 grupos por tipo de canal.
-- • cda_grupo ganha os grupos tipo 'Receita' (sem natureza).
-- • cda_pa_centro_custo.grupo_id: 35 centros de receita ligados (centro a centro,
--   ex.: Revenda Ciclo Showroom/SAC → Venda direta Ciclo).
-- • canais.grupo_id (Financeiro — ecossistema único): 40 canais ligados. O Financeiro
--   grava os canais por upsert só com as suas colunas, então grupo_id é preservado.
-- • Trigger de validação: centro de RECEITAS só em grupo Receita; de DESPESAS só em
--   grupo Despesa com a mesma natureza. Canal só em grupo Receita.
-- Nenhum dado existente é alterado além de preencher grupo_id (antes nulo).
-- ════════════════════════════════════════════════════════════════════
create or replace function public.cda_pa_valida_grupo_centro() returns trigger
language plpgsql security definer set search_path to 'public' as $$
declare g record; nat text; tipo_conta text;
begin
  if new.grupo_id is null then return new; end if;
  select * into g from public.cda_grupo where id = new.grupo_id;
  select coalesce(new.natureza, s.natureza), k.tipo into nat, tipo_conta
    from public.cda_pa_subconta s join public.cda_pa_conta k on k.id = s.conta_id where s.id = new.subconta_id;
  if tipo_conta = 'RECEITAS' then
    if g.tipo <> 'Receita' then raise exception 'Centro de receita só pode ser ligado a grupo de Receita.' using errcode='23514'; end if;
    return new;
  end if;
  if g.tipo <> 'Despesa' then raise exception 'Centro de despesa só pode ser ligado a grupo de Despesa.' using errcode='23514'; end if;
  if g.natureza is not null and nat is distinct from g.natureza then
    raise exception 'Natureza do centro (%) diferente da natureza do grupo "%" (%).', coalesce(nat,'—'), g.nome, g.natureza using errcode='23514';
  end if;
  return new;
end $$;

alter table public.canais add column if not exists grupo_id bigint references public.cda_grupo(id) on delete set null;
create index if not exists canais_grupo_idx on public.canais(grupo_id);
create or replace function public.cda_valida_grupo_canal() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  if new.grupo_id is not null and not exists (select 1 from public.cda_grupo where id = new.grupo_id and tipo = 'Receita') then
    raise exception 'Canal só pode ser ligado a grupo de Receita.' using errcode='23514';
  end if;
  return new;
end $$;
drop trigger if exists cda_valida_grupo_canal on public.canais;
create trigger cda_valida_grupo_canal before insert or update of grupo_id on public.canais
  for each row execute function public.cda_valida_grupo_canal();

insert into public.cda_grupo (tipo, natureza, nome, ordem)
select 'Receita', null, v.nome, v.ordem from (values
 ('Atacado / Private Label',10),('Shows de artistas',20),('Revendas (lojas parceiras)',30),('E-commerce',40),
 ('Misto - E-Commerce / Shows',50),('Feiras e bazares',60),('Venda direta Ciclo',70),
 ('Vendas Subsidiadas (Colaboradores/Parceiros)',80),('Market Place',90),('Brindes / Permutas',100)) v(nome, ordem)
where not exists (select 1 from public.cda_grupo g where g.tipo = 'Receita' and g.nome = v.nome);

update public.cda_pa_centro_custo c set grupo_id = g.id from public.cda_grupo g, (values
 (14,'Atacado / Private Label'),
 (21,'Shows de artistas'),(19,'Shows de artistas'),(24,'Shows de artistas'),(20,'Shows de artistas'),(22,'Shows de artistas'),(23,'Shows de artistas'),(510003,'Shows de artistas'),
 (16,'Revendas (lojas parceiras)'),(15,'Revendas (lojas parceiras)'),(17,'Revendas (lojas parceiras)'),(420004,'Revendas (lojas parceiras)'),(18,'Revendas (lojas parceiras)'),(420005,'Revendas (lojas parceiras)'),(120002,'Revendas (lojas parceiras)'),(120001,'Revendas (lojas parceiras)'),
 (9,'E-commerce'),(3,'E-commerce'),(5,'E-commerce'),(7,'E-commerce'),(6,'E-commerce'),(10,'E-commerce'),(8,'E-commerce'),(420002,'E-commerce'),(12,'E-commerce'),(4,'E-commerce'),(240001,'E-commerce'),
 (420003,'Misto - E-Commerce / Shows'),
 (13,'Feiras e bazares'),
 (240002,'Venda direta Ciclo'),(330001,'Venda direta Ciclo'),(2,'Venda direta Ciclo'),(150001,'Venda direta Ciclo'),
 (1,'Vendas Subsidiadas (Colaboradores/Parceiros)'),
 (480003,'Market Place')) m(id, nome)
where c.id = m.id and g.tipo = 'Receita' and g.nome = m.nome;

update public.canais c set grupo_id = g.id from public.cda_grupo g, (values
 (1778540708657,'Atacado / Private Label'),
 (1,'Shows de artistas'),(1780173066481,'Shows de artistas'),(1780179954834,'Shows de artistas'),(1780246180654,'Shows de artistas'),(1785487775866,'Shows de artistas'),(1778540708679,'Shows de artistas'),(1785278166922,'Shows de artistas'),(1783540375824,'Shows de artistas'),
 (1778540708680,'Revendas (lojas parceiras)'),(1778540708481,'Revendas (lojas parceiras)'),(1778540708232,'Revendas (lojas parceiras)'),(1778540708819,'Revendas (lojas parceiras)'),(1784125416538,'Revendas (lojas parceiras)'),(1782323141713,'Revendas (lojas parceiras)'),
 (2,'E-commerce'),(3,'E-commerce'),(1778540708019,'E-commerce'),(1778540708797,'E-commerce'),(1778540708076,'E-commerce'),(1778540708746,'E-commerce'),(1778540708890,'E-commerce'),(1780086179953,'E-commerce'),(1780179827801,'E-commerce'),(1782323313149,'E-commerce'),(1785488015109,'E-commerce'),(1778540708009,'E-commerce'),(1783540337136,'E-commerce'),
 (1782322947851,'Misto - E-Commerce / Shows'),(1784126142428,'Misto - E-Commerce / Shows'),
 (1778540708909,'Feiras e bazares'),
 (1778540708105,'Venda direta Ciclo'),(1780237393956,'Venda direta Ciclo'),(1778540708224,'Venda direta Ciclo'),
 (1780237756760,'Vendas Subsidiadas (Colaboradores/Parceiros)'),(1783267126998,'Vendas Subsidiadas (Colaboradores/Parceiros)'),(1783267195355,'Vendas Subsidiadas (Colaboradores/Parceiros)'),
 (1783267402754,'Market Place'),(1783685161076,'Market Place'),
 (1784125900691,'Brindes / Permutas')) m(id, nome)
where c.id = m.id and g.tipo = 'Receita' and g.nome = m.nome;

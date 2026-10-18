
create table public.cda_orc_formulas_categoria (
 categoria_id uuid primary key references public.cda_orc_categorias(id),
 definicao jsonb not null check(jsonb_typeof(definicao)='object' and definicao->>'forma' in ('percentual','quantidade','fixo')),
 atualizado_em timestamptz not null default now()
);
alter table public.cda_orc_formulas_categoria enable row level security;
grant select,insert,update on public.cda_orc_formulas_categoria to authenticated;
do $$
declare p record;
begin for p in select * from pg_policies where schemaname='public' and tablename='cda_orc_categorias' loop
 execute format('create policy %I on public.cda_orc_formulas_categoria for %s to authenticated %s %s',p.policyname,p.cmd,case when p.qual is null then '' else 'using ('||p.qual||')' end,case when p.with_check is null then '' else 'with check ('||p.with_check||')' end);
end loop;end $$;
create or replace function public.cda_orc_previa_cadastros(vinculo uuid)
returns table(chave text,conteudo jsonb) language sql set search_path=public as $$
with v as(select * from public.cda_orc_projeto_tipos where id=vinculo and ativo)
select 'categorias',coalesce((select jsonb_agg(to_jsonb(c)||jsonb_build_object('formula',case when exists(select 1 from public.cda_orc_categorias filho where filho.pai_id=c.id and filho.ativo) then jsonb_build_object('forma','soma_filhos') else f.definicao end) order by string_to_array(c.codigo,'.')::int[]) from public.cda_orc_categorias c left join public.cda_orc_formulas_categoria f on f.categoria_id=c.id where c.tipo_id=(select tipo_id from v) and c.ativo),'[]'::jsonb)
union all select k,coalesce(p.conteudo,'{}'::jsonb) from unnest(array['premissas','dimensionamento','funcoes','calculos','produtos','participantes','participacao']) k left join public.cda_orc_padroes_tipo p on p.chave=k and p.tipo_id=(select tipo_id from v);
$$;
create or replace function public.cda_orc_salvar_formula_projeto(cadastro uuid,item uuid,anterior jsonb,nova jsonb)
returns jsonb language plpgsql set search_path=public as $$
declare doc jsonb;alvo jsonb;
begin
if jsonb_typeof(nova)<>'object' or coalesce(nova->>'forma','') not in ('percentual','quantidade','fixo') then raise exception 'Fórmula inválida';end if;
select conteudo into doc from public.cda_orc_cadastros_projeto where id=cadastro and chave='categorias' for update;
if not found then raise exception 'Cadastro indisponível';end if;
select x into alvo from jsonb_array_elements(doc) x where x->>'id'=item::text;
if alvo is null or coalesce(alvo->'formula','null'::jsonb) is distinct from coalesce(anterior,'null'::jsonb) then raise exception 'Categoria alterada; reabra o cadastro';end if;
if exists(select 1 from jsonb_array_elements(doc) x where x->>'pai_id'=item::text and coalesce((x->>'ativo')::boolean,true)) then raise exception 'Categoria totalizadora usa soma dos filhos';end if;
select jsonb_agg(case when x->>'id'=item::text then x||jsonb_build_object('formula',nova) else x end order by ord) into doc from jsonb_array_elements(doc) with ordinality z(x,ord);
update public.cda_orc_cadastros_projeto set conteudo=doc where id=cadastro;
if not found then raise exception 'Sem permissão de escrita';end if;
return doc;end $$;
revoke execute on function public.cda_orc_salvar_formula_projeto(uuid,uuid,jsonb,jsonb) from public,anon;
grant execute on function public.cda_orc_salvar_formula_projeto(uuid,uuid,jsonb,jsonb) to authenticated;

alter table public.cda_orc_formulas_categoria add column id uuid not null default gen_random_uuid() unique;

alter table public.cda_orc_categorias add column tipo_id uuid references public.cda_orc_tipos_projeto(id);
update public.cda_orc_categorias set tipo_id=(select id from public.cda_orc_tipos_projeto where codigo=1);
alter table public.cda_orc_categorias alter column tipo_id set not null;
create or replace function public.cda_orc_categoria_hierarquia() returns trigger language plpgsql security invoker set search_path=public as $$ declare p public.cda_orc_categorias;begin
if tg_op='UPDATE' then if new.pai_id is distinct from old.pai_id or new.codigo<>old.codigo or new.nivel<>old.nivel or new.ordem<>old.ordem or new.tipo_id<>old.tipo_id then raise exception 'Código e posição hierárquica são permanentes';end if;return new;end if;
perform pg_advisory_xact_lock(17261017);
if new.pai_id is null then if new.tipo_id is null then raise exception 'Selecione o tipo de projeto';end if;new.nivel:=1;select coalesce(max(ordem),0)+1 into new.ordem from public.cda_orc_categorias where pai_id is null and tipo_id=new.tipo_id;new.codigo:=new.ordem::text;
else select * into p from public.cda_orc_categorias where id=new.pai_id;if not found or p.nivel>=3 or not p.ativo then raise exception 'Pai inválido ou limite de três níveis';end if;new.tipo_id:=p.tipo_id;new.nivel:=p.nivel+1;select coalesce(max(ordem),0)+1 into new.ordem from public.cda_orc_categorias where pai_id=new.pai_id;new.codigo:=p.codigo||'.'||new.ordem::text;end if;return new;end;$$;
alter table public.cda_orc_categorias drop constraint cda_orc_categorias_codigo_key;
alter table public.cda_orc_categorias add unique(tipo_id,codigo);
create table public.cda_orc_cadastros_projeto(id uuid primary key default gen_random_uuid(),projeto_tipo_id uuid not null references public.cda_orc_projeto_tipos(id),chave text not null,conteudo jsonb not null,gerado_em timestamptz not null default now(),unique(projeto_tipo_id,chave));
alter table public.cda_orc_cadastros_projeto enable row level security;
grant select,insert,update on public.cda_orc_cadastros_projeto to authenticated;
revoke all on public.cda_orc_cadastros_projeto from anon;
create policy leitura on public.cda_orc_cadastros_projeto for select to authenticated using (exists(select 1 from public.equipe e where lower(e.email)=lower(auth.jwt()->>'email') and (e.is_admin or 'orcamento_vendas'=any(e.projetos))));
create policy inclusao on public.cda_orc_cadastros_projeto for insert to authenticated with check (exists(select 1 from public.equipe e where lower(e.email)=lower(auth.jwt()->>'email') and (e.is_admin or 'orcamento_vendas'=any(e.projetos))) and exists(select 1 from public.equipe e where lower(e.email)=lower(auth.jwt()->>'email') and coalesce(e.permissao,'leitura_escrita')='leitura_escrita'));
create policy edicao on public.cda_orc_cadastros_projeto for update to authenticated using (exists(select 1 from public.equipe e where lower(e.email)=lower(auth.jwt()->>'email') and (e.is_admin or 'orcamento_vendas'=any(e.projetos))) and exists(select 1 from public.equipe e where lower(e.email)=lower(auth.jwt()->>'email') and coalesce(e.permissao,'leitura_escrita')='leitura_escrita')) with check (exists(select 1 from public.equipe e where lower(e.email)=lower(auth.jwt()->>'email') and (e.is_admin or 'orcamento_vendas'=any(e.projetos))) and exists(select 1 from public.equipe e where lower(e.email)=lower(auth.jwt()->>'email') and coalesce(e.permissao,'leitura_escrita')='leitura_escrita'));
create function public.cda_orc_previa_cadastros(vinculo uuid) returns table(chave text,conteudo jsonb) language sql security invoker set search_path=public as $$
with v as(select * from public.cda_orc_projeto_tipos where id=vinculo and ativo), t as(select t.* from public.cda_orc_tipos_projeto t join v on v.tipo_id=t.id), d as(select to_jsonb(d) j from public.cda_orc_dimensionamento d where (select codigo from t)=1 order by atualizado_em desc limit 1)
select 'categorias',coalesce((select jsonb_agg(to_jsonb(c) order by string_to_array(c.codigo,'.')::int[]) from public.cda_orc_categorias c where c.tipo_id=(select id from t) and c.ativo),'[]'::jsonb)
union all select 'premissas',coalesce((select parametros from v),'{}'::jsonb)
union all select 'dimensionamento',coalesce((select j from d),'{}'::jsonb)
union all select 'funcoes',case when (select codigo from t)=1 then jsonb_build_array(jsonb_build_object('nome','Vendedores','unidade','profissional/show','valor_unitario',(select j->'valor_vendedor' from d)),jsonb_build_object('nome','Estoquista','unidade','profissional/show','valor_unitario',(select j->'valor_estoquista' from d)),jsonb_build_object('nome','Apoio','unidade','profissional/show','valor_unitario',(select j->'valor_apoio' from d))) else '[]'::jsonb end
union all select 'calculos',case when (select codigo from t)=1 then '{"modalidades":["Percentual","Valor fixo","Quantidade × valor unitário"],"bases":["Venda bruta","Venda após desconto comercial","Venda após descontos comerciais e financeiros","Resultado distribuível"]}'::jsonb else '{}'::jsonb end
union all select 'produtos','[]'::jsonb
union all select 'participantes',coalesce((select jsonb_agg(jsonb_build_object('pessoa_id',p.pessoa_id)) from public.cda_orc_projeto_participantes p join v on p.projeto_id=v.projeto_id where p.ativo),'[]'::jsonb)
union all select 'participacao','{}'::jsonb;
$$;
create function public.cda_orc_gerar_cadastros(vinculo uuid) returns integer language plpgsql security invoker set search_path=public as $$ declare n integer;begin
if not exists(select 1 from public.cda_orc_projeto_tipos where id=vinculo and ativo) then raise exception 'Vínculo indisponível';end if;
insert into public.cda_orc_cadastros_projeto(projeto_tipo_id,chave,conteudo) select vinculo,chave,conteudo from public.cda_orc_previa_cadastros(vinculo) on conflict(projeto_tipo_id,chave) do nothing;get diagnostics n=row_count;return n;end;$$;
revoke all on function public.cda_orc_previa_cadastros(uuid),public.cda_orc_gerar_cadastros(uuid) from public,anon;
grant execute on function public.cda_orc_previa_cadastros(uuid),public.cda_orc_gerar_cadastros(uuid) to authenticated;
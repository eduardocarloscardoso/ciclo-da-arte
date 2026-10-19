
lock table public.cda_orc_categorias in access exclusive mode;
alter table public.cda_orc_categorias disable trigger categoria_hierarquia;
insert into cda_orc_categorias(tipo_id,nome,codigo,nivel,ordem,pai_id,descritivo_calculo)
select t.id,'Lucro Líquido a ser rateado entre sócios','99',1,99,null,'Resultado líquido previsto do projeto: Receita Bruta de Vendas (categoria 1) menos o total das categorias 2 a 12, considerando cada custo uma única vez. O saldo positivo será distribuído entre os parceiros; prejuízos são apresentados sem lucro disponível para rateio.'
from cda_orc_tipos_projeto t where t.codigo=1 on conflict(tipo_id,codigo) do nothing;
insert into cda_orc_categorias(tipo_id,nome,codigo,nivel,ordem,pai_id,descritivo_calculo)
select c.tipo_id,v.nome,v.codigo,2,v.ordem,c.id,v.descritivo from cda_orc_categorias c join cda_orc_tipos_projeto t on t.id=c.tipo_id cross join (values
('Parceiro Owner Products','99.1',1,'Parcela do lucro disponível para rateio destinada ao Parceiro Owner Products. Fórmula: maior valor entre zero e o resultado da categoria 99 × percentual de participação. Não constitui nova despesa.'),
('Parceiro Fabricação','99.2',2,'Parcela do lucro disponível para rateio destinada ao Parceiro Fabricação. Fórmula: maior valor entre zero e o resultado da categoria 99 × percentual de participação. Não constitui nova despesa.')
) v(nome,codigo,ordem,descritivo) where t.codigo=1 and c.codigo='99' on conflict(tipo_id,codigo) do nothing;
alter table public.cda_orc_categorias enable trigger categoria_hierarquia;
insert into cda_orc_formulas_categoria(categoria_id,definicao)
select c.id,case when c.codigo='99' then jsonb_build_object('forma','quantidade','calculo','lucro_liquido','receita','1','deducoes',jsonb_build_array('2','3','4','5','6','7','8','9','10','11','12'),'aplicacao','projeto')
else jsonb_build_object('forma','percentual','calculo','rateio_lucro','base','Lucro positivo da categoria 99','percentual',50,'aplicacao','projeto') end
from cda_orc_categorias c join cda_orc_tipos_projeto t on t.id=c.tipo_id where t.codigo=1 and c.codigo in('99','99.1','99.2') on conflict(categoria_id) do nothing;
update cda_orc_cadastros_projeto p set conteudo=p.conteudo||coalesce((select jsonb_agg(to_jsonb(c)||jsonb_build_object('formula',f.definicao) order by c.nivel,c.ordem)
from cda_orc_projeto_tipos v join cda_orc_tipos_projeto t on t.id=v.tipo_id join cda_orc_categorias c on c.tipo_id=t.id join cda_orc_formulas_categoria f on f.categoria_id=c.id
where v.id=p.projeto_tipo_id and t.codigo=1 and c.codigo in('99','99.1','99.2') and not exists(select 1 from jsonb_array_elements(p.conteudo) x where x->>'codigo'=c.codigo)),'[]'::jsonb) where p.chave='categorias';
create function public.cda_orc_salvar_rateio_lucro(escopo text,registro uuid,pct_owner numeric,pct_fabricacao numeric,anterior jsonb)
returns boolean language plpgsql set search_path=public as $$
declare atual jsonb;doc jsonb;n integer;
begin
if pct_owner is null or pct_fabricacao is null or pct_owner<0 or pct_owner>100 or pct_fabricacao<0 or pct_fabricacao>100 or pct_owner+pct_fabricacao<>100 then raise exception 'Percentuais devem somar 100';end if;
if escopo='padrao' then
perform f.categoria_id from cda_orc_formulas_categoria f join cda_orc_categorias c on c.id=f.categoria_id where c.tipo_id=registro and c.codigo in('99.1','99.2') for update of f;
select jsonb_object_agg(c.codigo,f.definicao) into atual from cda_orc_formulas_categoria f join cda_orc_categorias c on c.id=f.categoria_id where c.tipo_id=registro and c.codigo in('99.1','99.2');
if atual is distinct from anterior or not(atual ?& array['99.1','99.2']) then raise exception 'Rateio alterado ou indisponível; reabra';end if;
update cda_orc_formulas_categoria f set definicao=f.definicao||jsonb_build_object('percentual',case when c.codigo='99.1' then pct_owner else pct_fabricacao end),atualizado_em=now() from cda_orc_categorias c where c.id=f.categoria_id and c.tipo_id=registro and c.codigo in('99.1','99.2');
get diagnostics n=row_count;if n<>2 then raise exception 'Sem permissão de escrita';end if;
elsif escopo='projeto' then
select conteudo into doc from cda_orc_cadastros_projeto where id=registro and chave='categorias' for update;if not found then raise exception 'Cadastro indisponível';end if;
select jsonb_object_agg(x->>'codigo',x->'formula') into atual from jsonb_array_elements(doc) x where x->>'codigo' in('99.1','99.2');
if atual is distinct from anterior or not(atual ?& array['99.1','99.2']) then raise exception 'Rateio alterado ou indisponível; reabra';end if;
select jsonb_agg(case when x->>'codigo' in('99.1','99.2') then x||jsonb_build_object('formula',(x->'formula')||jsonb_build_object('percentual',case when x->>'codigo'='99.1' then pct_owner else pct_fabricacao end)) else x end order by ord) into doc from jsonb_array_elements(doc) with ordinality z(x,ord);
update cda_orc_cadastros_projeto set conteudo=doc where id=registro;if not found then raise exception 'Sem permissão de escrita';end if;
else raise exception 'Escopo inválido';end if;return true;end $$;
revoke execute on function public.cda_orc_salvar_rateio_lucro(text,uuid,numeric,numeric,jsonb) from public,anon;
grant execute on function public.cda_orc_salvar_rateio_lucro(text,uuid,numeric,numeric,jsonb) to authenticated;


create or replace function public.cda_orc_previa_cadastros(vinculo uuid)
returns table(chave text,conteudo jsonb) language sql set search_path=public as $$
with v as(select * from public.cda_orc_projeto_tipos where id=vinculo and ativo)
select 'categorias',coalesce((select jsonb_agg(to_jsonb(c)||jsonb_build_object('formula',case when f.definicao->>'calculo'='lucro_liquido' then f.definicao when exists(select 1 from public.cda_orc_categorias filho where filho.pai_id=c.id and filho.ativo) then jsonb_build_object('forma','soma_filhos') else f.definicao end) order by string_to_array(c.codigo,'.')::int[]) from public.cda_orc_categorias c left join public.cda_orc_formulas_categoria f on f.categoria_id=c.id where c.tipo_id=(select tipo_id from v) and c.ativo),'[]'::jsonb)
union all select k,coalesce(p.conteudo,'{}'::jsonb) from unnest(array['premissas','dimensionamento','funcoes','calculos','produtos','participantes','participacao']) k left join public.cda_orc_padroes_tipo p on p.chave=k and p.tipo_id=(select tipo_id from v);
$$;
do $$ declare def text;novo text;begin
select pg_get_functiondef(oid) into def from pg_proc where proname='cda_orc_categoria_hierarquia' and pronamespace='public'::regnamespace;
novo:=replace(def,'where pai_id is null and tipo_id=new.tipo_id;','where pai_id is null and tipo_id=new.tipo_id and codigo<>''99'';');
if novo=def then raise exception 'Conferir função de numeração';end if;execute novo;
select pg_get_functiondef(oid) into def from pg_proc where proname='cda_orc_editar_categoria_projeto' and pronamespace='public'::regnamespace;
novo:=replace(def,'where x->>''pai_id'' is not distinct from pai::text;','where x->>''pai_id'' is not distinct from pai::text and (pai is not null or x->>''codigo''<>''99'');');
if novo=def then raise exception 'Conferir numeração do projeto';end if;execute novo;
end $$;

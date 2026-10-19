
alter table public.cda_orc_categorias add column if not exists descritivo_calculo text;
update cda_orc_categorias c set descritivo_calculo=f.definicao->>'descritivo' from cda_orc_formulas_categoria f where f.categoria_id=c.id and c.descritivo_calculo is null and f.definicao ? 'descritivo';
update cda_orc_categorias c set descritivo_calculo=case c.codigo when '1' then 'Previsão da Receita Bruta de Vendas: público por evento multiplicado pela conversão do cenário e pelo ticket médio por comprador.' when '2' then 'Descontos sobre as Vendas = Descontos Comerciais + Descontos Financeiros. Total automático das subcategorias ativas.' when '3' then 'Aplicação de um % sobre o valor do Ticket médio previsto, para que o Parceiro de Fabricação produza os produtos.' end
from cda_orc_tipos_projeto t where c.tipo_id=t.id and t.codigo=1 and c.codigo in ('1','2','3') and c.descritivo_calculo is null;
insert into cda_orc_formulas_categoria(categoria_id,definicao)
select c.id,jsonb_build_object('forma','percentual','calculo','fabricacao_ticket','base','Ticket médio × compradores','percentual',15,'aplicacao','projeto','descritivo',c.descritivo_calculo)
from cda_orc_categorias c join cda_orc_tipos_projeto t on t.id=c.tipo_id where t.codigo=1 and c.codigo='3'
on conflict(categoria_id) do update set definicao=excluded.definicao,atualizado_em=now();
update cda_orc_cadastros_projeto p set conteudo=(select jsonb_agg(x||case when c.descritivo_calculo is not null and not(x ? 'descritivo_calculo') then jsonb_build_object('descritivo_calculo',c.descritivo_calculo) else '{}'::jsonb end||case when c.codigo='3' then jsonb_build_object('formula',f.definicao) else '{}'::jsonb end order by ord) from jsonb_array_elements(p.conteudo) with ordinality z(x,ord) left join cda_orc_categorias c on c.id::text=x->>'id' left join cda_orc_formulas_categoria f on f.categoria_id=c.id)
where p.chave='categorias';
create function public.cda_orc_salvar_descritivo_calculo(escopo text,registro uuid,item uuid,anterior text,novo text)
returns boolean language plpgsql set search_path=public as $$
declare doc jsonb;alvo jsonb;n integer;
begin
if novo is null or length(novo)>10000 then raise exception 'Texto inválido';end if;
if escopo='padrao' then
update cda_orc_categorias set descritivo_calculo=novo where id=item and descritivo_calculo is not distinct from anterior;
get diagnostics n=row_count;if n<>1 then raise exception 'Cadastro alterado ou sem permissão';end if;
elsif escopo='projeto' then
select conteudo into doc from cda_orc_cadastros_projeto where id=registro and chave='categorias' for update;
if not found then raise exception 'Cadastro indisponível';end if;
select x into alvo from jsonb_array_elements(doc) x where x->>'id'=item::text;
if alvo is null or (alvo->>'descritivo_calculo') is distinct from anterior then raise exception 'Cadastro alterado';end if;
select jsonb_agg(case when x->>'id'=item::text then x||jsonb_build_object('descritivo_calculo',novo) else x end order by ord) into doc from jsonb_array_elements(doc) with ordinality z(x,ord);
update cda_orc_cadastros_projeto set conteudo=doc where id=registro;
if not found then raise exception 'Sem permissão';end if;
else raise exception 'Escopo inválido';end if;
return true;end $$;
revoke execute on function public.cda_orc_salvar_descritivo_calculo(text,uuid,uuid,text,text) from public,anon;
grant execute on function public.cda_orc_salvar_descritivo_calculo(text,uuid,uuid,text,text) to authenticated;

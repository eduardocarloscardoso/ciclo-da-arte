
do $$ declare r record;d jsonb;k text;v jsonb;begin
for r in select id,conteudo from cda_orc_padroes_tipo where chave='dimensionamento' and tipo_id in(select id from cda_orc_tipos_projeto where codigo=1) loop
d:=r.conteudo;for k,v in select key,value from jsonb_each('{"designer_evento":1,"supervisores_evento":2,"filmmaker_evento":1}'::jsonb) loop if d->k is null or d->k='null'::jsonb then d:=jsonb_set(d,array[k],v);end if;end loop;
update cda_orc_padroes_tipo set conteudo=d,atualizado_em=now() where id=r.id;end loop;
for r in select p.id,p.conteudo from cda_orc_cadastros_projeto p join cda_orc_projeto_tipos v on v.id=p.projeto_tipo_id join cda_orc_tipos_projeto t on t.id=v.tipo_id where t.codigo=1 and p.chave='dimensionamento' loop
d:=r.conteudo;for k,v in select key,value from jsonb_each('{"designer_evento":1,"supervisores_evento":2,"filmmaker_evento":1}'::jsonb) loop if d->k is null or d->k='null'::jsonb then d:=jsonb_set(d,array[k],v);end if;end loop;
update cda_orc_cadastros_projeto set conteudo=d where id=r.id;end loop;end $$;
update cda_orc_cadastros_projeto p set conteudo=p.conteudo||coalesce((select jsonb_agg(x) from jsonb_array_elements(padrao.conteudo) x where x->>'nome' in('Designer','Supervisores','Filmmaker') and not exists(select 1 from jsonb_array_elements(p.conteudo) y where y->>'nome'=x->>'nome')),'[]'::jsonb)
from cda_orc_projeto_tipos v join cda_orc_tipos_projeto t on t.id=v.tipo_id join cda_orc_padroes_tipo padrao on padrao.tipo_id=t.id and padrao.chave='funcoes' where p.projeto_tipo_id=v.id and t.codigo=1 and p.chave='funcoes';
insert into cda_orc_formulas_categoria(categoria_id,definicao)
select c.id,case when c.codigo like '9.1.%' then jsonb_build_object('forma','quantidade','calculo','gerencial_evento','quantidade_origem',case c.codigo when '9.1.1' then 'designer_evento' when '9.1.2' then 'supervisores_evento' else 'filmmaker_evento' end,'valor_origem','funcao','funcao',c.nome,'aplicacao','evento')
else jsonb_build_object('forma','quantidade','calculo','despesa_gerencial','quantidade',null,'valor',null,'unidade','unidade','aplicacao','evento') end
from cda_orc_categorias c join cda_orc_tipos_projeto t on t.id=c.tipo_id where t.codigo=1 and c.codigo in('9.1.1','9.1.2','9.1.3','9.2.1','9.2.2','9.2.3','9.2.4')
on conflict(categoria_id) do nothing;
update cda_orc_cadastros_projeto p set conteudo=(select jsonb_agg(case when c.id is not null then x||case when f.definicao is not null and (x->'formula' is null or x->'formula'='null'::jsonb) then jsonb_build_object('formula',f.definicao) else '{}'::jsonb end||case when not(x ? 'descritivo_calculo') and c.descritivo_calculo is not null then jsonb_build_object('descritivo_calculo',c.descritivo_calculo) else '{}'::jsonb end else x end order by ord) from jsonb_array_elements(p.conteudo) with ordinality z(x,ord) left join cda_orc_categorias c on c.id::text=x->>'id' and (c.codigo='9' or c.codigo like '9.%') left join cda_orc_formulas_categoria f on f.categoria_id=c.id) where p.chave='categorias';

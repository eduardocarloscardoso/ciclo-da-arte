
update cda_orc_padroes_tipo p set conteudo=(p.conteudo-'apoio_evento')||jsonb_build_object('vendedores_loja',coalesce(p.conteudo->'vendedores_loja','4'::jsonb)) where chave='dimensionamento' and tipo_id in(select id from cda_orc_tipos_projeto where codigo=1);
do $$ declare p record;d jsonb;k text;v jsonb;begin
for p in select cp.id,cp.conteudo from cda_orc_cadastros_projeto cp join cda_orc_projeto_tipos v on v.id=cp.projeto_tipo_id join cda_orc_tipos_projeto t on t.id=v.tipo_id where t.codigo=1 and cp.chave='dimensionamento' loop
d:=p.conteudo-'apoio_evento';
for k,v in select key,value from jsonb_each('{"area_loja":25,"capacidade_loja":500,"compradores_vendedor":125,"vendedores_loja":4,"estoquistas_loja":1,"apoio_loja":1}'::jsonb) loop
if d->k is null or d->k='null'::jsonb then d:=jsonb_set(d,array[k],v);end if;
end loop;d:=d||'{"arredondamento":"proximo"}'::jsonb;
update cda_orc_cadastros_projeto set conteudo=d where id=p.id;
end loop;end $$;
update cda_orc_cadastros_projeto p set conteudo=(select jsonb_agg(case when x->>'nome' in('Vendedores','Estoquista','Apoio') and (x->'valor_unitario' is null or x->'valor_unitario'='null'::jsonb) then x||'{"valor_unitario":300}'::jsonb else x end order by ord) from jsonb_array_elements(p.conteudo) with ordinality z(x,ord))
where p.chave='funcoes' and p.projeto_tipo_id in(select v.id from cda_orc_projeto_tipos v join cda_orc_tipos_projeto t on t.id=v.tipo_id where t.codigo=1);
insert into cda_orc_formulas_categoria(categoria_id,definicao)
select c.id,jsonb_build_object('forma','quantidade','calculo','equipe_loja','quantidade_origem',case c.codigo when '8.1.1' then 'estoquistas_loja' when '8.1.2' then 'apoio_loja' else 'vendedores_loja' end,'valor_origem','funcao','funcao',case c.codigo when '8.1.1' then 'Estoquista' when '8.1.2' then 'Apoio' else 'Vendedores' end,'aplicacao','evento')
from cda_orc_categorias c join cda_orc_tipos_projeto t on t.id=c.tipo_id where t.codigo=1 and c.codigo in('8.1.1','8.1.2','8.2.1')
on conflict(categoria_id) do update set definicao=excluded.definicao,atualizado_em=now();
update cda_orc_cadastros_projeto p set conteudo=(select jsonb_agg(case when c.id is not null then x||case when f.definicao is not null then jsonb_build_object('formula',f.definicao) else '{}'::jsonb end||case when not(x ? 'descritivo_calculo') and c.descritivo_calculo is not null then jsonb_build_object('descritivo_calculo',c.descritivo_calculo) else '{}'::jsonb end else x end order by ord) from jsonb_array_elements(p.conteudo) with ordinality z(x,ord) left join cda_orc_categorias c on c.id::text=x->>'id' and (c.codigo='8' or c.codigo like '8.%') left join cda_orc_formulas_categoria f on f.categoria_id=c.id) where p.chave='categorias';

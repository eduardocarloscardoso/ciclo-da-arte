
begin;
update cda_orc_categorias c set descritivo_calculo=regexp_replace(coalesce(c.descritivo_calculo,''),'^Aplicação de um % sobre o valor do Ticket médio previsto,','Cálculo por valor mensal de armazenagem multiplicado pelo número de meses,')
from cda_orc_tipos_projeto t where t.id=c.tipo_id and t.codigo=1 and c.codigo='10.2';
update cda_orc_formulas_categoria f set definicao=jsonb_build_object('forma','fixo','calculo','armazenagem_mensal','valor_mensal',880,'meses',6,'aplicacao','projeto'),atualizado_em=now()
from cda_orc_categorias c join cda_orc_tipos_projeto t on t.id=c.tipo_id where f.categoria_id=c.id and t.codigo=1 and c.codigo='10.2';
update cda_orc_cadastros_projeto p set conteudo=(select jsonb_agg(case when c.id is not null then x||jsonb_build_object('formula',f.definicao,'descritivo_calculo',regexp_replace(coalesce(x->>'descritivo_calculo',c.descritivo_calculo),'^Aplicação de um % sobre o valor do Ticket médio previsto,','Cálculo por valor mensal de armazenagem multiplicado pelo número de meses,')) else x end order by ord) from jsonb_array_elements(p.conteudo) with ordinality z(x,ord) left join cda_orc_categorias c on c.id::text=x->>'id' and c.codigo='10.2' left join cda_orc_formulas_categoria f on f.categoria_id=c.id) where p.chave='categorias';
update cda_orc_cadastros_projeto p set conteudo=(select jsonb_agg(case when coalesce(x->>'papel','')='' and m.papel is not null then x||jsonb_build_object('papel',m.papel) else x end order by ord) from jsonb_array_elements(p.conteudo) with ordinality z(x,ord) left join lateral (
select min(y->>'papel') as papel from jsonb_array_elements(padrao.conteudo) y where y->>'pessoa_id'=x->>'pessoa_id' and coalesce((y->>'ativo')::boolean,true) having count(*)=1
) m on true)
from cda_orc_projeto_tipos v join cda_orc_tipos_projeto t on t.id=v.tipo_id join cda_orc_padroes_tipo padrao on padrao.tipo_id=t.id and padrao.chave='participantes'
where p.projeto_tipo_id=v.id and t.codigo=1 and p.chave='participantes';
commit;


insert into cda_orc_formulas_categoria(categoria_id,definicao)
select c.id,jsonb_build_object('forma','percentual','calculo','participacao_cultural','base','Receita Bruta (categoria 1) - Descontos sobre as Vendas (categoria 2)','percentual',25,'aplicacao','projeto')
from cda_orc_categorias c join cda_orc_tipos_projeto t on t.id=c.tipo_id where t.codigo=1 and c.codigo='3' and c.nome='Participação parceiro(s) Cultural'
on conflict(categoria_id) do update set definicao=excluded.definicao,atualizado_em=now();
update cda_orc_cadastros_projeto p set conteudo=(select jsonb_agg(case when c.id is not null then x||jsonb_build_object('formula',f.definicao)||case when not(x ? 'descritivo_calculo') and c.descritivo_calculo is not null then jsonb_build_object('descritivo_calculo',c.descritivo_calculo) else '{}'::jsonb end else x end order by ord) from jsonb_array_elements(p.conteudo) with ordinality z(x,ord) left join cda_orc_categorias c on c.id::text=x->>'id' and c.codigo='3' and c.nome='Participação parceiro(s) Cultural' left join cda_orc_formulas_categoria f on f.categoria_id=c.id) where p.chave='categorias';

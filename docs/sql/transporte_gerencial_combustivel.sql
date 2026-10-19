
begin;
update cda_orc_formulas_categoria f set definicao=f.definicao||jsonb_build_object('quantidade',1,'valor',1000,'unidade','viagem de carro próprio · combustível (ida, volta e deslocamentos locais)','aplicacao','evento'),atualizado_em=now()
from cda_orc_categorias c join cda_orc_tipos_projeto t on t.id=c.tipo_id where f.categoria_id=c.id and t.codigo=1 and c.codigo='9.2.1';
update cda_orc_cadastros_projeto p set conteudo=(select jsonb_agg(case when c.id is not null then x||jsonb_build_object('formula',coalesce(x->'formula',f.definicao)||jsonb_build_object('quantidade',1,'valor',1000,'unidade','viagem de carro próprio · combustível (ida, volta e deslocamentos locais)','aplicacao','evento'))||case when not(x ? 'descritivo_calculo') and c.descritivo_calculo is not null then jsonb_build_object('descritivo_calculo',c.descritivo_calculo) else '{}'::jsonb end else x end order by ord) from jsonb_array_elements(p.conteudo) with ordinality z(x,ord) left join cda_orc_categorias c on c.id::text=x->>'id' and c.codigo='9.2.1' left join cda_orc_formulas_categoria f on f.categoria_id=c.id) where p.chave='categorias';
commit;

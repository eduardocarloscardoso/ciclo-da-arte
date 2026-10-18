
update public.cda_orc_padroes_tipo p set conteudo=jsonb_set(p.conteudo,'{valores}',coalesce(p.conteudo->'valores','{}'::jsonb)||'{"ticket_medio":120}'::jsonb),atualizado_em=now()
where p.chave='premissas' and p.tipo_id in(select id from cda_orc_tipos_projeto where codigo=1);
update public.cda_orc_cadastros_projeto p set conteudo=jsonb_set(p.conteudo,'{valores}',coalesce(p.conteudo->'valores','{}'::jsonb)||'{"ticket_medio":120}'::jsonb)
where p.chave='premissas' and p.projeto_tipo_id in(select v.id from cda_orc_projeto_tipos v join cda_orc_tipos_projeto t on t.id=v.tipo_id where t.codigo=1);
insert into public.cda_orc_formulas_categoria(categoria_id,definicao)
select c.id,'{"forma":"quantidade","calculo":"receita_bruta","quantidade_origem":"compradores","valor_origem":"premissa","campo_valor":"valores.ticket_medio","aplicacao":"evento"}'::jsonb
from cda_orc_categorias c join cda_orc_tipos_projeto t on t.id=c.tipo_id
where t.codigo=1 and c.codigo='1' and c.nome='Receitas de vendas'
on conflict(categoria_id) do update set definicao=excluded.definicao,atualizado_em=now();
update public.cda_orc_cadastros_projeto p set conteudo=(
select jsonb_agg(case when x->>'codigo'='1' and x->>'nome'='Receitas de vendas' then x||jsonb_build_object('formula',f.definicao) else x end order by ord)
from jsonb_array_elements(p.conteudo) with ordinality z(x,ord)
cross join lateral(select fc.definicao from cda_orc_formulas_categoria fc join cda_orc_categorias c on c.id=fc.categoria_id join cda_orc_projeto_tipos v on v.tipo_id=c.tipo_id where v.id=p.projeto_tipo_id and c.codigo='1' and c.nome='Receitas de vendas') f
) where p.chave='categorias' and exists(select 1 from cda_orc_projeto_tipos v join cda_orc_tipos_projeto t on t.id=v.tipo_id where v.id=p.projeto_tipo_id and t.codigo=1);

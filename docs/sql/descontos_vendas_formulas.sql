
insert into cda_orc_formulas_categoria(categoria_id,definicao)
select c.id,jsonb_build_object('forma','percentual','calculo','desconto_vendas','base','Venda bruta','percentual',5,'aplicacao','projeto','descritivo',case c.codigo when '2.1' then 'Valores comerciais acordados entre a Ciclo Arte e o Parceiro Cultural que poderão ser praticados em cada evento. Exemplo: 5% de desconto para pagamento via PIX. O percentual para orçamento representa o maior desconto previsto.' else 'Valores financeiros de desconto do agente financeiro (maquininhas), acordados entre a Ciclo Arte e o Parceiro Cultural, que poderão ser praticados em cada evento. Exemplo: 5% para pagamento em até 3 parcelas sem juros ao consumidor. O percentual para orçamento representa o maior desconto previsto.' end)
from cda_orc_categorias c join cda_orc_tipos_projeto t on t.id=c.tipo_id where t.codigo=1 and c.codigo in ('2.1','2.2')
on conflict(categoria_id) do update set definicao=excluded.definicao,atualizado_em=now();
update cda_orc_cadastros_projeto p set conteudo=p.conteudo||coalesce((
select jsonb_agg(to_jsonb(c)||jsonb_build_object('formula',f.definicao) order by c.ordem)
from cda_orc_projeto_tipos v join cda_orc_tipos_projeto t on t.id=v.tipo_id join cda_orc_categorias c on c.tipo_id=t.id join cda_orc_formulas_categoria f on f.categoria_id=c.id
where v.id=p.projeto_tipo_id and t.codigo=1 and c.codigo in ('2.1','2.2')
and exists(select 1 from jsonb_array_elements(p.conteudo) x where x->>'id'=c.pai_id::text)
and not exists(select 1 from jsonb_array_elements(p.conteudo) x where x->>'id'=c.id::text or x->>'codigo'=c.codigo)
),'[]'::jsonb)
where p.chave='categorias';

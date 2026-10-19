
lock table public.cda_orc_categorias in access exclusive mode;
do $$ begin
if not exists(select 1 from cda_orc_categorias c join cda_orc_tipos_projeto t on t.id=c.tipo_id where t.codigo=1 and c.codigo='3' and c.nome='Fabricação e produtos') or not exists(select 1 from cda_orc_categorias c join cda_orc_tipos_projeto t on t.id=c.tipo_id where t.codigo=1 and c.codigo='4' and c.nome='Participação parceiro(s) Cultural') then raise exception 'Numeração diferente da esperada; conferir antes da troca';end if;
end $$;
alter table public.cda_orc_categorias disable trigger categoria_hierarquia;
update public.cda_orc_categorias set codigo='troca-'||codigo where tipo_id in(select id from cda_orc_tipos_projeto where codigo=1) and (codigo in('3','4') or codigo like '3.%' or codigo like '4.%');
update public.cda_orc_categorias set codigo=case when codigo='troca-3' or codigo like 'troca-3.%' then '4'||substring(codigo from 8) else '3'||substring(codigo from 8) end,
ordem=case when pai_id is null then case when codigo='troca-3' then 4 else 3 end else ordem end
where tipo_id in(select id from cda_orc_tipos_projeto where codigo=1) and codigo like 'troca-%';
alter table public.cda_orc_categorias enable trigger categoria_hierarquia;
update public.cda_orc_cadastros_projeto p set conteudo=(
select jsonb_agg(case when x->>'codigo' in('3','4') or x->>'codigo' like '3.%' or x->>'codigo' like '4.%' then
x||jsonb_build_object('codigo',case when x->>'codigo'='3' or x->>'codigo' like '3.%' then '4'||substring(x->>'codigo' from 2) else '3'||substring(x->>'codigo' from 2) end)
||case when x->>'pai_id' is null then jsonb_build_object('ordem',case when x->>'codigo'='3' then 4 else 3 end) else '{}'::jsonb end
else x end order by ord) from jsonb_array_elements(p.conteudo) with ordinality z(x,ord))
where p.chave='categorias' and p.projeto_tipo_id in(select v.id from cda_orc_projeto_tipos v join cda_orc_tipos_projeto t on t.id=v.tipo_id where t.codigo=1);

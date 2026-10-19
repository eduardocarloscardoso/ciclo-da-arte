
lock table public.cda_orc_categorias in access exclusive mode;
do $$ begin
if exists(select 1 from cda_orc_categorias c join cda_orc_tipos_projeto t on t.id=c.tipo_id where t.codigo=1 and c.codigo in('90','91','92')) then raise exception 'Conferir códigos de resultado já existentes';end if;
end $$;
alter table public.cda_orc_categorias disable trigger categoria_hierarquia;
update cda_orc_categorias c set codigo=case c.codigo when '99' then '90' when '99.1' then '91' else '92' end,
ordem=case c.codigo when '99' then 90 when '99.1' then 91 else 92 end,nivel=1,pai_id=null,
descritivo_calculo=case c.codigo when '99' then c.descritivo_calculo when '99.1' then 'Total destinado ao Parceiro Owner Products = parcela do lucro líquido disponível da categoria 90, conforme percentual de rateio, mais Administração Ciclo Arte (categoria 6). Os componentes são apresentados separadamente. Esta apuração não altera o lucro nem constitui nova despesa.' else 'Total destinado ao Parceiro Fabricação = parcela do lucro líquido disponível da categoria 90, conforme percentual de rateio, mais Fabricação e produtos (categoria 4). Os componentes são apresentados separadamente. Esta apuração não altera o lucro nem constitui nova despesa.' end
from cda_orc_tipos_projeto t where t.id=c.tipo_id and t.codigo=1 and c.codigo in('99','99.1','99.2');
alter table public.cda_orc_categorias enable trigger categoria_hierarquia;
update cda_orc_formulas_categoria f set definicao=case when c.codigo='90' then f.definicao||jsonb_build_object('classificacao','apuracao_resultado') else f.definicao||jsonb_build_object('forma','quantidade','calculo','resultado_parceiro','base','Lucro positivo da categoria 90','categoria_vinculada',case c.codigo when '91' then '6' else '4' end,'classificacao','apuracao_resultado') end,atualizado_em=now()
from cda_orc_categorias c join cda_orc_tipos_projeto t on t.id=c.tipo_id where c.id=f.categoria_id and t.codigo=1 and c.codigo in('90','91','92');
update cda_orc_cadastros_projeto p set conteudo=(select jsonb_agg(case when c.id is not null then
x||jsonb_build_object('codigo',c.codigo,'nivel',1,'ordem',c.ordem,'pai_id',null,'descritivo_calculo',case when c.codigo='90' then coalesce(x->>'descritivo_calculo',c.descritivo_calculo) else c.descritivo_calculo end,'formula',
case when c.codigo='90' then coalesce(x->'formula',f.definicao)||jsonb_build_object('classificacao','apuracao_resultado') else coalesce(x->'formula',f.definicao)||jsonb_build_object('forma','quantidade','calculo','resultado_parceiro','base','Lucro positivo da categoria 90','categoria_vinculada',case c.codigo when '91' then '6' else '4' end,'classificacao','apuracao_resultado') end)
else x end order by ord) from jsonb_array_elements(p.conteudo) with ordinality z(x,ord) left join cda_orc_categorias c on c.id::text=x->>'id' and c.codigo in('90','91','92') left join cda_orc_formulas_categoria f on f.categoria_id=c.id)
where p.chave='categorias';
do $$ declare def text;novo text;begin
select pg_get_functiondef(oid) into def from pg_proc where proname='cda_orc_salvar_rateio_lucro' and pronamespace='public'::regnamespace;
novo:=replace(replace(def,'99.1','91'),'99.2','92');if novo=def then raise exception 'Conferir função do rateio';end if;execute novo;
select pg_get_functiondef(oid) into def from pg_proc where proname='cda_orc_categoria_hierarquia' and pronamespace='public'::regnamespace;
novo:=replace(def,'codigo<>''99''','codigo not in (''90'',''91'',''92'')');if novo=def then raise exception 'Conferir numeração';end if;execute novo;
select pg_get_functiondef(oid) into def from pg_proc where proname='cda_orc_editar_categoria_projeto' and pronamespace='public'::regnamespace;
novo:=replace(def,'x->>''codigo''<>''99''','x->>''codigo'' not in (''90'',''91'',''92'')');if novo=def then raise exception 'Conferir numeração do projeto';end if;execute novo;
end $$;

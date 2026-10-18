create function public.cda_orc_editar_categoria_projeto(cadastro uuid,acao text,item uuid default null,pai uuid default null,nome text default null) returns jsonb language plpgsql security invoker set search_path=public as $$ declare doc jsonb; alvo jsonb; superior jsonb;novo jsonb;numero integer;nivel integer;begin
select conteudo into doc from public.cda_orc_cadastros_projeto where id=cadastro and chave='categorias' for update;if not found then raise exception 'Cadastro indisponível';end if;
if acao in ('renomear','situacao') then
select x into alvo from jsonb_array_elements(doc) x where x->>'id'=item::text;if alvo is null then raise exception 'Item inexistente';end if;
if acao='renomear' then if nome is null or length(trim(nome))=0 then raise exception 'Nome obrigatório';end if;novo:=alvo||jsonb_build_object('nome',trim(nome));else novo:=alvo||jsonb_build_object('ativo',not coalesce((alvo->>'ativo')::boolean,true));end if;
select jsonb_agg(case when x->>'id'=item::text then novo else x end order by ord) into doc from jsonb_array_elements(doc) with ordinality as z(x,ord);
elsif acao='adicionar' then
if nome is null or length(trim(nome))=0 then raise exception 'Nome obrigatório';end if;
if pai is null then nivel:=1;else select x into superior from jsonb_array_elements(doc) x where x->>'id'=pai::text;if superior is null or (superior->>'nivel')::int>=3 or not coalesce((superior->>'ativo')::boolean,true) then raise exception 'Pai inválido ou terceiro nível atingido';end if;nivel:=(superior->>'nivel')::int+1;end if;
select coalesce(max((x->>'ordem')::int),0)+1 into numero from jsonb_array_elements(doc) x where x->>'pai_id' is not distinct from pai::text;
novo:=jsonb_build_object('id',gen_random_uuid(),'pai_id',pai,'nivel',nivel,'ordem',numero,'codigo',case when pai is null then numero::text else superior->>'codigo'||'.'||numero::text end,'nome',trim(nome),'ativo',true);doc:=doc||jsonb_build_array(novo);
else raise exception 'Ação inválida';end if;
update public.cda_orc_cadastros_projeto set conteudo=doc where id=cadastro;if not found then raise exception 'Sem permissão de escrita';end if;return doc;end;$$;
revoke all on function public.cda_orc_editar_categoria_projeto(uuid,text,uuid,uuid,text) from public,anon;
grant execute on function public.cda_orc_editar_categoria_projeto(uuid,text,uuid,uuid,text) to authenticated;
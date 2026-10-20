create or replace function public.cda_orc_atualizar_cadastros(vinculo uuid, anterior jsonb, padrao jsonb)
returns integer language plpgsql security invoker set search_path=public as $$
declare atual jsonb; origem jsonb; n integer;
begin
 if not exists(select 1 from public.equipe e where lower(e.email)=lower(auth.jwt()->>'email') and (e.is_admin or 'orcamento_vendas'=any(e.projetos)) and coalesce(e.permissao,'leitura_escrita')='leitura_escrita') then raise exception 'Sem permissão de edição'; end if;
 perform 1 from public.cda_orc_projeto_tipos v where v.id=vinculo and v.ativo for update;
 if not found then raise exception 'Vínculo indisponível'; end if;
 perform 1 from public.cda_orc_cadastros_projeto c where c.projeto_tipo_id=vinculo for update;
 select coalesce(jsonb_agg(jsonb_build_object('chave',c.chave,'conteudo',c.conteudo) order by c.chave),'[]'::jsonb) into atual from public.cda_orc_cadastros_projeto c where c.projeto_tipo_id=vinculo;
 select coalesce(jsonb_agg(jsonb_build_object('chave',p.chave,'conteudo',p.conteudo) order by p.chave),'[]'::jsonb) into origem from public.cda_orc_previa_cadastros(vinculo) p;
 if atual is distinct from anterior or origem is distinct from padrao then raise exception 'Os cadastros mudaram; reabra a atualização para conferir os dados atuais'; end if;
 if jsonb_array_length(origem)<>8 then raise exception 'Padrão incompleto'; end if;
 insert into public.cda_orc_cadastros_projeto(projeto_tipo_id,chave,conteudo,gerado_em)
 select vinculo,p.chave,p.conteudo,now() from jsonb_to_recordset(origem) as p(chave text,conteudo jsonb)
 on conflict(projeto_tipo_id,chave) do update set conteudo=excluded.conteudo,gerado_em=excluded.gerado_em;
 get diagnostics n=row_count;
 return n;
end;$$;
revoke all on function public.cda_orc_atualizar_cadastros(uuid,jsonb,jsonb) from public,anon;
grant execute on function public.cda_orc_atualizar_cadastros(uuid,jsonb,jsonb) to authenticated;
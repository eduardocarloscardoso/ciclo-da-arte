-- ════════════════════════════════════════════════════════════════════
-- Comercial · Campanha — modelo do e-mail (04/11/2026)
-- Só acréscimos: campos do e-mail na campanha + área de imagens
-- (Supabase Storage, leitura pública porque o e-mail precisa exibir a
-- imagem; envio/alteração só por membros da equipe).
-- ════════════════════════════════════════════════════════════════════

alter table public.cda_campanhas
  add column if not exists email_assunto  text,
  add column if not exists email_previa   text,
  add column if not exists email_conteudo jsonb;
comment on column public.cda_campanhas.email_conteudo is
  'Blocos do e-mail da campanha: imagemUrl, imagemAlt, titulo, saudacao, texto, cupomCodigo, cupomTexto, botaoTexto, botaoLink, infoTitulo, infoTexto, rodape. Montado por cdaMontarEmailCampanha().';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('campanhas-email', 'campanhas-email', true, 2097152, array['image/jpeg','image/png','image/gif','image/webp'])
on conflict (id) do nothing;

drop policy if exists campanhas_email_inserir on storage.objects;
create policy campanhas_email_inserir on storage.objects for insert to authenticated
  with check (bucket_id = 'campanhas-email' and public.cda_e_membro_equipe());
drop policy if exists campanhas_email_alterar on storage.objects;
create policy campanhas_email_alterar on storage.objects for update to authenticated
  using (bucket_id = 'campanhas-email' and public.cda_e_membro_equipe());
drop policy if exists campanhas_email_excluir on storage.objects;
create policy campanhas_email_excluir on storage.objects for delete to authenticated
  using (bucket_id = 'campanhas-email' and public.cda_e_membro_equipe());

notify pgrst, 'reload schema';

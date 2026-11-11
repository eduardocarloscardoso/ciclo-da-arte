-- Snapshot dos lotes não deve travar exclusões no CRUD já homologado.
-- IDs de origem são apenas referências históricas, sem FK para cadastros vivos.
alter table public.cda_envio_lote_itens drop constraint if exists cda_envio_lote_itens_destinatario_origem_id_fkey;
alter table public.cda_envio_lote_itens drop constraint if exists cda_envio_lote_itens_pessoa_id_fkey;
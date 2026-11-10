-- Etapa 3: estrutura de rastreio por destinatário; nenhum mecanismo de envio é habilitado.
alter table public.cda_envio_lote_itens
  add column if not exists chave_idempotencia uuid not null default gen_random_uuid(),
  add column if not exists tentativa_id bigint,
  add column if not exists resend_email_id text,
  add column if not exists inicio_processamento_em timestamptz,
  add column if not exists fim_processamento_em timestamptz,
  add column if not exists aceito_em timestamptz,
  add column if not exists entregue_em timestamptz,
  add column if not exists ultimo_evento text,
  add column if not exists erro text,
  add column if not exists atualizado_em timestamptz not null default now();
create unique index if not exists cda_envio_lote_item_chave_unica on public.cda_envio_lote_itens(chave_idempotencia);
create unique index if not exists cda_envio_lote_item_tentativa_unica on public.cda_envio_lote_itens(tentativa_id) where tentativa_id is not null;
create unique index if not exists cda_envio_lote_item_resend_unico on public.cda_envio_lote_itens(resend_email_id) where resend_email_id is not null;
alter table public.cda_envio_lote_itens drop constraint if exists cda_envio_lote_itens_situacao_check;
alter table public.cda_envio_lote_itens add constraint cda_envio_lote_itens_situacao_check
 check (situacao in ('pendente','bloqueado','processando','indeterminado','aceito','entregue','falha','devolvido','reclamacao','atrasado'));
alter table public.cda_envio_lote_itens add constraint cda_envio_lote_itens_tentativa_fk
 foreign key(tentativa_id) references public.cda_email_tentativas(id) on delete restrict;
comment on column public.cda_envio_lote_itens.chave_idempotencia is 'Chave estável por destinatário. Nunca regenerar em retomadas; ainda não há executor de disparos.';
comment on column public.cda_envio_lote_itens.tentativa_id is 'Reservado para a associação auditada com a tentativa de envio individual, quando futura execução autorizada.';

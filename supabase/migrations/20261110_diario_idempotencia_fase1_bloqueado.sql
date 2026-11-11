-- Fase 1 do futuro executor de homologação: diário de idempotência durável.
-- NÃO há trigger, scheduler, remetente nem permissão de execução nesta migration.
create table if not exists public.cda_envio_lote_operacoes (
 id bigint generated always as identity primary key,
 lote_id bigint not null references public.cda_envio_lotes(id) on delete restrict,
 item_id bigint not null references public.cda_envio_lote_itens(id) on delete restrict,
 chave_idempotencia uuid not null,
 estado text not null default 'reservada' check (
   estado in ('reservada','solicitada','aceita','entregue','falha','indeterminada','devolvida','reclamacao')
 ),
 tentativa_id bigint references public.cda_email_tentativas(id) on delete restrict,
 resend_email_id text,
 payload_sha256 text check(payload_sha256 is null or payload_sha256 ~ '^[a-f0-9]{64}$'),
 criado_em timestamptz not null default now(),
 atualizado_em timestamptz not null default now(),
 constraint cda_operacoes_item_unico unique(item_id),
 constraint cda_operacoes_chave_unica unique(chave_idempotencia)
);
create index if not exists cda_operacoes_lote_estado_idx
 on public.cda_envio_lote_operacoes(lote_id,estado);
alter table public.cda_envio_lote_operacoes enable row level security;
revoke all on public.cda_envio_lote_operacoes from public,anon,authenticated;
-- Only privileged server-side operations may eventually populate this journal.
-- Until approval there are no writers connected to the table.
grant select,insert,update on public.cda_envio_lote_operacoes to service_role;

-- Deterministic per-item inventory. This is read-only and does NOT reserve anything.
create or replace function public.cda_diagnosticar_diario_lote(p_lote_id bigint)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_total bigint;v_diario bigint;v_indeterminadas bigint;v_chaves bigint;
begin
 if not exists(select 1 from public.cda_envio_lotes where id=p_lote_id and modo='homologacao')
 then raise exception 'Lote de homologação não encontrado'; end if;
 select count(*),count(distinct chave_idempotencia)
 into v_total,v_chaves
 from public.cda_envio_lote_itens where lote_id=p_lote_id;
 select count(*),count(*) filter(where estado='indeterminada')
 into v_diario,v_indeterminadas
 from public.cda_envio_lote_operacoes where lote_id=p_lote_id;
 return jsonb_build_object('lote_id',p_lote_id,
 'destinatarios',v_total,'chaves_unicas',v_chaves,
 'operacoes_registradas',v_diario,'resultados_indeterminados',v_indeterminadas,
 'envio_habilitado',false,'autorizado',false,
 'observacao','Diário de idempotência disponível; sem processamento e sem envio.');
end $$;
revoke all on function public.cda_diagnosticar_diario_lote(bigint) from public,anon,authenticated;
grant execute on function public.cda_diagnosticar_diario_lote(bigint) to service_role;
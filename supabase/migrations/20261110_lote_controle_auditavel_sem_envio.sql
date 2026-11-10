-- Controles operacionais auditáveis do lote. Nenhum estado concede envio.
create table if not exists public.cda_envio_lote_auditoria (
 id bigint generated always as identity primary key,
 lote_id bigint not null references public.cda_envio_lotes(id) on delete restrict,
 acao text not null check (acao in ('interromper','retomar')),
 situacao_anterior text not null,
 situacao_nova text not null,
 usuario_id uuid not null,
 ocorrido_em timestamptz not null default now()
);
alter table public.cda_envio_lote_auditoria enable row level security;
revoke all on public.cda_envio_lote_auditoria from anon,authenticated;
grant select on public.cda_envio_lote_auditoria to authenticated;
create policy cda_envio_lote_auditoria_leitura_equipe on public.cda_envio_lote_auditoria
 for select to authenticated using ((select public.cda_e_membro_equipe()));
create or replace function public.cda_controlar_lote_sem_envio(p_lote_id bigint,p_acao text,p_usuario uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_status text; v_novo text; v_atualizado boolean :=false;
begin
 if p_lote_id is null or p_usuario is null or p_acao not in ('interromper','retomar') then
   raise exception 'Parâmetros inválidos';
 end if;
 select situacao into v_status from public.cda_envio_lotes
 where id=p_lote_id and modo='homologacao' for update;
 if not found then raise exception 'Lote não encontrado'; end if;
 v_novo:=case when p_acao='interromper' then 'interrompido' else 'preparado' end;
 if v_status<>v_novo then
   if (p_acao='interromper' and v_status<>'preparado') or
      (p_acao='retomar' and v_status<>'interrompido') then
     raise exception 'Transição inválida';
   end if;
   update public.cda_envio_lotes set situacao=v_novo,atualizado_em=now() where id=p_lote_id;
   insert into public.cda_envio_lote_auditoria(lote_id,acao,situacao_anterior,situacao_nova,usuario_id)
   values(p_lote_id,p_acao,v_status,v_novo,p_usuario);
   v_atualizado:=true;
 end if;
 return jsonb_build_object('lote_id',p_lote_id,'situacao',v_novo,'alterado',v_atualizado,'envio_habilitado',false);
end; $$;
revoke all on function public.cda_controlar_lote_sem_envio(bigint,text,uuid) from public,anon,authenticated;
grant execute on function public.cda_controlar_lote_sem_envio(bigint,text,uuid) to service_role;
-- Decisão do usuário (15/11/2026): bloquear só devoluções definitivas.
-- Devolução temporária (Resend bounce.type = "Transient", ex.: caixa cheia) não entra
-- mais na lista de supressão. Devolução sem tipo informado continua bloqueando (conservador).
-- Reclamação de spam continua bloqueando sempre.
create or replace function public.cda_oficial_registrar_evento(p_svix_id text, p_resend_email_id text, p_tipo text, p_ocorrido_em timestamp with time zone, p_motivo text default null::text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare v_e public.cda_transmissao_envios%rowtype; v_atual int; v_novo int; v_estado text;
begin
  select * into v_e from public.cda_transmissao_envios where resend_email_id=p_resend_email_id for update;
  if not found then return jsonb_build_object('aplicado',false,'motivo','sem_envio_oficial'); end if;
  insert into public.cda_transmissao_envio_eventos(envio_id,svix_id,resend_email_id,tipo,ocorrido_em,motivo)
    values(v_e.id,p_svix_id,p_resend_email_id,p_tipo,p_ocorrido_em,left(p_motivo,500)) on conflict (svix_id) do nothing;
  if not found then return jsonb_build_object('aplicado',false,'motivo','duplicado'); end if;
  v_atual:=case v_e.estado when 'reclamacao' then 4 when 'devolvida' then 3 when 'entregue' then 2
    when 'atrasado' then 1 else 0 end;
  v_novo:=case p_tipo when 'email.complained' then 4 when 'email.bounced' then 3
    when 'email.delivered' then 2 when 'email.delivery_delayed' then 1 else -1 end;
  if v_novo=4 or (v_novo=3 and coalesce(p_motivo,'') not ilike 'Transient%') then
    insert into public.cda_email_supressoes(email,motivo)
      values(lower(btrim(v_e.email)),case v_novo when 4 then 'reclamacao_spam' else 'devolucao' end)
      on conflict (email) do nothing;
  end if;
  if v_novo<v_atual or v_novo<0 then return jsonb_build_object('aplicado',false,'motivo','prioridade'); end if;
  v_estado:=case v_novo when 4 then 'reclamacao' when 3 then 'devolvida' when 2 then 'entregue' else 'atrasado' end;
  update public.cda_transmissao_envios set estado=v_estado,ultimo_evento=p_tipo,ultimo_evento_em=p_ocorrido_em,
    erro=case when v_novo in (3,4) and p_motivo is not null then left(p_motivo,500) else erro end
   where id=v_e.id;
  return jsonb_build_object('aplicado',true,'envio_id',v_e.id,'estado',v_estado);
end $function$;

-- Libera os 3 endereços com devolução temporária na retransmissão Luedji de 15/11
-- (nenhuma devolução definitiva registrada para eles).
delete from public.cda_email_supressoes s
 where s.motivo='devolucao'
   and s.email in (select lower(btrim(e.email)) from public.cda_transmissao_envios e
                    where e.transmissao_id=5 and e.estado='devolvida' and e.erro ilike 'Transient%')
   and not exists (select 1 from public.cda_transmissao_envios x
                    where lower(btrim(x.email))=s.email and x.estado in ('devolvida','reclamacao')
                      and coalesce(x.erro,'') not ilike 'Transient%');

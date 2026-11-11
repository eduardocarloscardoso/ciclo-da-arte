-- B5.2: reserva global SIMULADA entre campanhas, sem executor, sem token Resend.
-- Esta migração não autoriza nem transmite mensagens.
create table if not exists public.cda_transmissao_reservas_globais_b5 (
 id bigint generated always as identity primary key,
 transmissao_id bigint not null references public.cda_transmissoes_oficiais(id) on delete restrict,
 lote_id bigint not null references public.cda_transmissao_lotes(id) on delete restrict,
 simulacao_id bigint not null references public.cda_transmissao_simulacoes_b5(id) on delete restrict,
 lote_item_id bigint not null references public.cda_transmissao_lote_itens(id) on delete restrict,
 chave_idempotencia uuid not null,
 horario_reservado timestamptz not null,
 estado text not null default 'simulado_reservado' check(estado='simulado_reservado'),
 executado boolean not null default false check(executado=false),
 autorizado boolean not null default false check(autorizado=false),
 resend_id text check(resend_id is null),
 registrado_em timestamptz not null default now(),
 unique(lote_item_id),
 unique(chave_idempotencia),
 unique(simulacao_id,lote_item_id)
);
create index if not exists cda_reservas_b5_horario_idx
 on public.cda_transmissao_reservas_globais_b5(horario_reservado);
create index if not exists cda_reservas_b5_transmissao_idx
 on public.cda_transmissao_reservas_globais_b5(transmissao_id,lote_id);
alter table public.cda_transmissao_reservas_globais_b5 enable row level security;
revoke all on public.cda_transmissao_reservas_globais_b5 from anon,authenticated;

-- Parâmetros globais do planejador simulador. Não representam cota verificada do Resend.
create table if not exists public.cda_transmissao_limites_globais_b5 (
 id boolean primary key default true check(id=true),
 por_minuto integer not null default 10 check(por_minuto between 1 and 120),
 por_hora integer not null default 120 check(por_hora between 1 and 5000),
 por_dia integer not null default 300 check(por_dia between 1 and 20000),
 atualizado_em timestamptz not null default now(),
 check(por_minuto <= por_hora and por_hora <= por_dia)
);
insert into public.cda_transmissao_limites_globais_b5(id)
 values(true) on conflict(id) do nothing;
alter table public.cda_transmissao_limites_globais_b5 enable row level security;
revoke all on public.cda_transmissao_limites_globais_b5 from anon,authenticated;

-- Calcula cotas globais reservadas em janelas fixas, sob advisory lock global.
create or replace function public.cda_preparar_reserva_global_simulada_b5(p_lote_id bigint)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
 v_l public.cda_transmissao_lotes%rowtype;
 v_t public.cda_transmissoes_oficiais%rowtype;
 v_s public.cda_transmissao_simulacoes_b5%rowtype;
 v_c public.cda_transmissao_controles_b4%rowtype;
 v_g public.cda_transmissao_limites_globais_b5%rowtype;
 v_p public.cda_transmissao_preaprovacoes_b4%rowtype;
 v_r public.cda_transmissao_revisoes_lotes%rowtype;
 v_item record;
 v_slot timestamptz;
 v_inicio timestamptz;
 v_fim timestamptz;
 v_n integer:=0;
 v_min integer;
 v_hora integer;
 v_dia integer;
begin
 if not public.cda_admin_transmissao_b4() then raise exception 'Apenas administrador autenticado';end if;
 -- O limite é compartilhado entre TODAS as campanhas; serialização global.
 perform pg_advisory_xact_lock(hashtextextended('cda_b5_fila_global_simulada',0));
 select * into v_l from public.cda_transmissao_lotes where id=p_lote_id for update;
 if not found or v_l.situacao<>'preparado' or v_l.habilitado or v_l.autorizado_em is not null
 then raise exception 'Lote indisponível ou já habilitado';end if;
 select * into v_t from public.cda_transmissoes_oficiais where id=v_l.transmissao_id for share;
 if not found or v_t.habilitado or v_t.situacao<>'congelada'
 then raise exception 'Transmissão indisponível';end if;
 select * into v_s from public.cda_transmissao_simulacoes_b5 where lote_id=p_lote_id;
 if not found then raise exception 'Simulação B5 obrigatória antes de reservar slots globais';end if;
 select * into v_c from public.cda_transmissao_controles_b4 where transmissao_id=v_t.id;
 if not found or v_c.habilitado then raise exception 'Controles B4 indisponíveis';end if;
 select * into v_g from public.cda_transmissao_limites_globais_b5 where id=true;
 if not found then raise exception 'Limites globais não configurados';end if;
 select * into v_r from public.cda_transmissao_revisoes_lotes where lote_id=p_lote_id;
 if not found or v_r.status<>'revisado' or
    v_r.fingerprint_sha256 is distinct from public.cda_fingerprint_revisao_lote_b3(p_lote_id)
 then raise exception 'Revisão do lote não íntegra';end if;
 select * into v_p from public.cda_transmissao_preaprovacoes_b4 where lote_id=p_lote_id;
 if not found or v_p.status<>'preaprovado' or v_p.autoriza_envio or
    v_p.fingerprint_sha256 is distinct from v_r.fingerprint_sha256
 then raise exception 'Pré-aprovação preparatória inválida';end if;
 if v_s.fingerprint_sha256 is distinct from v_r.fingerprint_sha256 or
    v_s.quantidade<>v_l.total then raise exception 'Simulação desatualizada';end if;
 if exists(select 1 from public.cda_transmissao_reservas_globais_b5 where lote_id=p_lote_id)
 then raise exception 'Já existe fila global simulada para este lote';end if;
 if (select count(*) from public.cda_transmissao_simulacao_itens_b5
     where simulacao_id=v_s.id)<>v_l.total then raise exception 'Itens simulados incompletos';end if;
 v_min:=least(v_c.max_por_minuto,v_g.por_minuto);
 v_hora:=least(v_c.max_por_hora,v_g.por_hora);
 v_dia:=least(v_c.max_por_dia,v_g.por_dia);
 v_slot:=date_trunc('minute',now());
 for v_item in
   select i.lote_item_id,i.chave_idempotencia from public.cda_transmissao_simulacao_itens_b5 i
   where i.simulacao_id=v_s.id order by i.posicao
 loop
   -- Encontra o primeiro minuto com capacidade nas três janelas globais.
   loop
     if (select count(*) from public.cda_transmissao_reservas_globais_b5 r
          where r.horario_reservado>=date_trunc('minute',v_slot)
            and r.horario_reservado<date_trunc('minute',v_slot)+interval '1 minute')<v_min
        and (select count(*) from public.cda_transmissao_reservas_globais_b5 r
          where r.horario_reservado>=date_trunc('hour',v_slot)
            and r.horario_reservado<date_trunc('hour',v_slot)+interval '1 hour')<v_hora
        and (select count(*) from public.cda_transmissao_reservas_globais_b5 r
          where r.horario_reservado>=date_trunc('day',v_slot)
            and r.horario_reservado<date_trunc('day',v_slot)+interval '1 day')<v_dia
     then exit;end if;
     v_slot:=v_slot+interval '1 minute';
     if v_slot>now()+interval '90 days' then
       raise exception 'Não foi possível alocar slots em 90 dias';
     end if;
   end loop;
   insert into public.cda_transmissao_reservas_globais_b5
     (transmissao_id,lote_id,simulacao_id,lote_item_id,chave_idempotencia,horario_reservado)
   values(v_t.id,p_lote_id,v_s.id,v_item.lote_item_id,v_item.chave_idempotencia,v_slot);
   v_n:=v_n+1;
   if v_inicio is null then v_inicio:=v_slot;end if;
   v_fim:=v_slot;
 end loop;
 if v_n<>v_l.total then raise exception 'Contagem da fila global inconsistente';end if;
 insert into public.cda_transmissao_auditoria(transmissao_id,lote_id,acao,detalhe,registrado_por)
 values(v_t.id,p_lote_id,'b5_reserva_global_simulada_sem_envio',
 jsonb_build_object('quantidade',v_n,'limite_min',v_min,'limite_hora',v_hora,
  'limite_dia',v_dia,'inicio',v_inicio,'fim',v_fim,
  'resend_chamadas',0,'autorizacao_envio',false,'envio_habilitado',false),
 auth.uid());
 return jsonb_build_object('lote_id',p_lote_id,'reservados',v_n,'inicio',v_inicio,'fim',v_fim,
 'limites_aplicados',jsonb_build_object('minuto',v_min,'hora',v_hora,'dia',v_dia),
 'envio_habilitado',false,'resend_chamadas',0);
end $$;
revoke all on function public.cda_preparar_reserva_global_simulada_b5(bigint) from public,anon;
grant execute on function public.cda_preparar_reserva_global_simulada_b5(bigint) to authenticated;

create or replace function public.cda_consultar_reservas_globais_b5(p_transmissao_id bigint)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_r jsonb;
begin
 if not public.cda_admin_transmissao_b4() then raise exception 'Acesso restrito';end if;
 select coalesce(jsonb_agg(jsonb_build_object(
  'lote_id',r.lote_id,'numero',l.numero,'quantidade',r.total,
  'inicio',r.inicio,'fim',r.fim,'autorizado',false,'enviado',false) order by l.numero),'[]'::jsonb)
 into v_r
 from (
  select lote_id,count(*) total,min(horario_reservado) inicio,max(horario_reservado) fim
  from public.cda_transmissao_reservas_globais_b5
  where transmissao_id=p_transmissao_id
  group by lote_id
 ) r join public.cda_transmissao_lotes l on l.id=r.lote_id;
 return v_r;
end $$;
revoke all on function public.cda_consultar_reservas_globais_b5(bigint) from public,anon;
grant execute on function public.cda_consultar_reservas_globais_b5(bigint) to authenticated;

-- Decisão do usuário (Black Friday 2026): ritmo de 60 envios/min.
-- Limites efetivos = menor entre o global (b5) e o da transmissão (b4).
-- Global: 60/min, 5000/h, 8000/dia. Novas transmissões (inclusive retransmissões)
-- passam a nascer com controle b4 nos mesmos valores, via trigger.
-- Sem envio, sem alterar RPCs do executor.

update public.cda_transmissao_limites_globais_b5
   set por_minuto = 60, por_hora = 5000, por_dia = 8000, atualizado_em = now()
 where id = true;

alter table public.cda_transmissao_controles_b4
  alter column max_por_minuto set default 60,
  alter column max_por_hora   set default 5000,
  alter column max_por_dia    set default 8000;

-- Transmissões ainda não encerradas passam para o novo ritmo.
update public.cda_transmissao_controles_b4 c
   set max_por_minuto = 60, max_por_hora = 5000, max_por_dia = 8000, atualizado_em = now()
  from public.cda_transmissoes_oficiais t
 where t.id = c.transmissao_id and t.situacao <> 'encerrada';

create or replace function public.cda_oficial_controle_padrao()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.cda_transmissao_controles_b4
    (transmissao_id, estado, max_por_minuto, max_por_hora, max_por_dia, atualizado_por)
  values (new.id, 'planejamento', 60, 5000, 8000,
          coalesce(auth.uid(), new.criado_por, '00000000-0000-0000-0000-000000000000'::uuid))
  on conflict (transmissao_id) do nothing;
  return new;
end $$;
revoke all on function public.cda_oficial_controle_padrao() from public, anon, authenticated;

drop trigger if exists trg_cda_oficial_controle_padrao on public.cda_transmissoes_oficiais;
-- Constraint trigger adiado para o fim da transação: cda_oficial_retransmitir insere
-- o próprio controle b4 logo após criar a transmissão; aqui só completa quem ficou sem.
create constraint trigger trg_cda_oficial_controle_padrao
  after insert on public.cda_transmissoes_oficiais
  deferrable initially deferred
  for each row execute function public.cda_oficial_controle_padrao();

-- Transmissões não encerradas sem controle b4 recebem o padrão.
insert into public.cda_transmissao_controles_b4
  (transmissao_id, estado, max_por_minuto, max_por_hora, max_por_dia, atualizado_por)
select t.id, 'planejamento', 60, 5000, 8000, '00000000-0000-0000-0000-000000000000'::uuid
  from public.cda_transmissoes_oficiais t
 where t.situacao <> 'encerrada'
   and not exists (select 1 from public.cda_transmissao_controles_b4 c where c.transmissao_id = t.id)
on conflict (transmissao_id) do nothing;

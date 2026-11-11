-- B2: Congelamento universal transacional, auditável e irreversivelmente bloqueado para envio.
-- auth.uid + equipe.is_admin obrigatórios. Não cria endpoint de transmissão.
alter table public.cda_transmissoes_oficiais
 add column if not exists assunto_snapshot text,
 add column if not exists conteudo_snapshot jsonb,
 add column if not exists remetente_snapshot jsonb,
 add column if not exists congelado_em timestamptz,
 add column if not exists validacao_lgpd_pendente boolean not null default true;

create unique index if not exists cda_transmissao_unica_congelada
 on public.cda_transmissoes_oficiais(campanha_id,mensagem_id)
 where situacao='congelada';

create or replace function public.cda_congelar_transmissao_oficial_b2(
 p_campanha_id bigint,p_mensagem_id bigint,p_tamanho_lote integer)
returns jsonb
language plpgsql security definer
set search_path=''
as $$
declare
 v_user uuid:=auth.uid();
 v_campanha public.cda_campanhas%rowtype;
 v_mensagem public.cda_campanha_mensagens%rowtype;
 v_transmissao bigint;
 v_total integer;
 v_vazios integer;
 v_invalidos integer;
 v_duplicados integer;
 v_suprimidos integer;
 v_aptos integer;
 v_lotes integer;
 v_insertidos integer;
 v_payload_hash text;
begin
 if v_user is null or (auth.role() is distinct from 'authenticated') then
   raise exception 'Autenticação obrigatória';
 end if;
 if not exists (
   select 1 from public.equipe e join auth.users u
      on lower(btrim(u.email))=lower(btrim(e.email))
   where u.id=v_user and e.is_admin is true
 ) then raise exception 'Somente administrador autenticado pode congelar uma transmissão';end if;
 if p_tamanho_lote is null or p_tamanho_lote not between 1 and 1000 then
   raise exception 'Quantidade por lote deve estar entre 1 e 1000';
 end if;
 -- Evita duas preparações concorrentes para a mesma campanha/mensagem.
 perform pg_advisory_xact_lock(hashtextextended('cda_transmissao:'||p_campanha_id||':'||p_mensagem_id,0));
 if exists(select 1 from public.cda_transmissoes_oficiais
           where campanha_id=p_campanha_id and mensagem_id=p_mensagem_id
             and situacao='congelada') then
    raise exception 'Já existe uma transmissão congelada para esta campanha/mensagem; consulte o histórico';
 end if;
 select * into v_campanha from public.cda_campanhas where id=p_campanha_id for share;
 if not found then raise exception 'Campanha não encontrada';end if;
 select * into v_mensagem from public.cda_campanha_mensagens
 where id=p_mensagem_id and campanha_id=p_campanha_id for share;
 if not found then raise exception 'Mensagem não pertence à campanha';end if;
 if nullif(btrim(coalesce(v_campanha.lgpd_base_legal,'')),'') is null or
    nullif(btrim(coalesce(v_campanha.lgpd_finalidade_fundamentacao,'')),'') is null then
     raise exception 'Fundamentação e finalidade LGPD devem estar registradas antes do congelamento';
 end if;
 if nullif(btrim(coalesce(v_mensagem.assunto,'')),'') is null then
   raise exception 'Mensagem sem assunto; congelamento interrompido';
 end if;
 select count(*) into v_total from public.cda_campanha_destinatarios
 where campanha_id=p_campanha_id;
 if v_total=0 or v_total>20000 then
   raise exception 'Seleção não permite congelamento (limite 1 a 20000 destinatários)';
 end if;

 -- Todas as classificações são calculadas de novo no banco, não aceitamos lista do navegador.
 with candidatos as (
   select d.id,d.cliente_id,d.email,d.nome,d.email_valido,
     lower(btrim(coalesce(d.email,''))) normalizado
   from public.cda_campanha_destinatarios d where d.campanha_id=p_campanha_id
 ),classificados as (
   select *,
     row_number() over(partition by normalizado order by id) rn
   from candidatos
 ),status as (
   select *,
     case when normalizado='' then 'vazio'
          when email_valido is not true or normalizado !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then 'invalido'
          when rn>1 then 'duplicado'
          when exists(select 1 from public.cda_email_supressoes s
                 where lower(btrim(s.email))=normalizado) then 'suprimido'
          else 'apto' end motivo
   from classificados
 )
 select count(*) filter(where motivo='vazio'),
        count(*) filter(where motivo='invalido'),
        count(*) filter(where motivo='duplicado'),
        count(*) filter(where motivo='suprimido'),
        count(*) filter(where motivo='apto')
 into v_vazios,v_invalidos,v_duplicados,v_suprimidos,v_aptos
 from status;
 if v_aptos=0 then raise exception 'Nenhum destinatário elegível; não é possível congelar'; end if;
 v_lotes=ceil(v_aptos::numeric/p_tamanho_lote)::int;

 v_payload_hash=encode(extensions.digest(
   concat_ws('|',coalesce(v_mensagem.assunto,''),coalesce(v_mensagem.conteudo::text,''),
      coalesce(v_mensagem.remetente_nome,''),coalesce(v_mensagem.remetente_email,''),
      coalesce(v_mensagem.responder_para,''),coalesce(v_campanha.lgpd_base_legal,''),
      coalesce(v_campanha.lgpd_finalidade_fundamentacao,'')),'sha256'),'hex');

 insert into public.cda_transmissoes_oficiais(
   campanha_id,mensagem_id,nome,canal,situacao,tamanho_lote,
   base_legal_snapshot,finalidade_snapshot,conteudo_sha256,
   assunto_snapshot,conteudo_snapshot,remetente_snapshot,congelado_em,
   total_previsto,total_excluidos,criado_por,habilitado,validacao_lgpd_pendente)
 values(p_campanha_id,p_mensagem_id,
   'Transmissão · '||v_campanha.nome||' · '||v_mensagem.nome,
   'email','congelada',p_tamanho_lote,
   v_campanha.lgpd_base_legal,v_campanha.lgpd_finalidade_fundamentacao,v_payload_hash,
   v_mensagem.assunto,v_mensagem.conteudo,
   jsonb_build_object('nome',v_mensagem.remetente_nome,'email',v_mensagem.remetente_email,'reply_to',v_mensagem.responder_para),
   now(),v_aptos,v_total-v_aptos,v_user,false,true)
 returning id into v_transmissao;

 insert into public.cda_transmissao_lotes(transmissao_id,numero,situacao,total,habilitado)
 select v_transmissao,n,'preparado',
    least(p_tamanho_lote,v_aptos-(n-1)*p_tamanho_lote),false
 from generate_series(1,v_lotes) n;

 with candidatos as (
   select d.id,d.cliente_id,d.email,d.nome,d.email_valido,
     lower(btrim(coalesce(d.email,''))) normalizado
   from public.cda_campanha_destinatarios d where d.campanha_id=p_campanha_id
 ),classificados as (
   select *,row_number() over(partition by normalizado order by id) rn
   from candidatos
 ),aptos as (
   select *,row_number() over(order by id) pos
   from classificados c
   where normalizado<>''
     and email_valido is true
     and normalizado ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
     and rn=1
     and not exists(select 1 from public.cda_email_supressoes s
                    where lower(btrim(s.email))=c.normalizado)
 )
 insert into public.cda_transmissao_lote_itens(
    lote_id,campanha_destinatario_id,cliente_id,email_snapshot,nome_snapshot,situacao)
 select l.id,a.id,a.cliente_id,a.normalizado,a.nome,'pendente'
 from aptos a
 join public.cda_transmissao_lotes l on l.transmissao_id=v_transmissao
   and l.numero=(((a.pos-1)/p_tamanho_lote)+1);

 get diagnostics v_insertidos=row_count;
 if v_insertidos<>v_aptos then
    raise exception 'Integridade de congelamento divergente: esperado %, registrado %',v_aptos,v_insertidos;
 end if;

 insert into public.cda_transmissao_auditoria(transmissao_id,acao,detalhe,registrado_por)
 values(v_transmissao,'congelamento_b2_sem_envio',
   jsonb_build_object('campanha_id',p_campanha_id,'mensagem_id',p_mensagem_id,
     'total_origem',v_total,'incluidos',v_aptos,'sem_email',v_vazios,
     'invalidos',v_invalidos,'duplicados',v_duplicados,
     'suprimidos',v_suprimidos,'lotes',v_lotes,'tamanho_lote',p_tamanho_lote,
     'conteudo_sha256',v_payload_hash,'habilitado',false,
     'lgpd_pendente',true),v_user);
 return jsonb_build_object('transmissao_id',v_transmissao,'incluidos',v_aptos,
   'excluidos',v_total-v_aptos,'lotes',v_lotes,
   'conteudo_sha256',v_payload_hash,'habilitado',false,'lgpd_pendente',true);
end $$;
revoke all on function public.cda_congelar_transmissao_oficial_b2(bigint,bigint,integer) from public,anon;
grant execute on function public.cda_congelar_transmissao_oficial_b2(bigint,bigint,integer) to authenticated;

-- Leitura exclusiva aos administradores autenticados; não libera acesso direto às tabelas.
create or replace function public.cda_consultar_transmissoes_b2(p_campanha_id bigint)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_user uuid:=auth.uid();v_resp jsonb;
begin
 if v_user is null or auth.role() is distinct from 'authenticated' or not exists(
   select 1 from public.equipe e join auth.users u
     on lower(btrim(u.email))=lower(btrim(e.email))
   where u.id=v_user and e.is_admin is true)
 then raise exception 'Acesso restrito a administrador';end if;
 select coalesce(jsonb_agg(x order by x.id desc),'[]'::jsonb) into v_resp from (
   select t.id,t.nome,t.campanha_id,t.mensagem_id,t.situacao,t.tamanho_lote,
     t.total_previsto,t.total_excluidos,t.conteudo_sha256,t.criado_em,
     t.habilitado,t.validacao_lgpd_pendente,
     (select count(*) from public.cda_transmissao_lotes l where l.transmissao_id=t.id) lotes,
     (select coalesce(jsonb_agg(jsonb_build_object('numero',l.numero,'total',l.total,
        'situacao',l.situacao,'habilitado',l.habilitado) order by l.numero),'[]'::jsonb)
      from public.cda_transmissao_lotes l where l.transmissao_id=t.id) resumo_lotes
   from public.cda_transmissoes_oficiais t
   where t.campanha_id=p_campanha_id
 ) x;
 return v_resp;
end $$;
revoke all on function public.cda_consultar_transmissoes_b2(bigint) from public,anon;
grant execute on function public.cda_consultar_transmissoes_b2(bigint) to authenticated;

-- Estrutura universal de transmissões oficiais: SOMENTE REGISTRO / SEM EXECUTOR.
-- Não há RPC de autorização ou envio. Tabelas segregadas da homologação.
create table if not exists public.cda_transmissoes_oficiais (
 id bigint generated always as identity primary key,
 campanha_id bigint not null references public.cda_campanhas(id),
 mensagem_id bigint not null references public.cda_campanha_mensagens(id),
 nome text not null,
 canal text not null default 'email' check (canal in ('email')),
 situacao text not null default 'rascunho' check (situacao in ('rascunho','congelada','cancelada','encerrada')),
 tamanho_lote integer not null check (tamanho_lote between 1 and 1000),
 base_legal_snapshot text,
 finalidade_snapshot text,
 conteudo_sha256 text,
 total_previsto integer not null default 0 check (total_previsto >= 0),
 total_excluidos integer not null default 0 check (total_excluidos >= 0),
 habilitado boolean not null default false check (habilitado = false),
 criado_em timestamptz not null default now(),
 criado_por uuid,
 atualizado_em timestamptz not null default now(),
 unique (id,campanha_id)
);
create index if not exists cda_transmissoes_oficiais_campanha_idx on public.cda_transmissoes_oficiais(campanha_id,criado_em desc);
create table if not exists public.cda_transmissao_lotes (
 id bigint generated always as identity primary key,
 transmissao_id bigint not null references public.cda_transmissoes_oficiais(id) on delete restrict,
 numero integer not null check(numero>0),
 situacao text not null default 'rascunho' check(situacao in ('rascunho','preparado','cancelado','encerrado')),
 total integer not null default 0 check(total>=0),
 habilitado boolean not null default false check(habilitado=false),
 autorizado_em timestamptz,
 criado_em timestamptz not null default now(),
 unique(transmissao_id,numero),
 unique(id,transmissao_id)
);
create table if not exists public.cda_transmissao_lote_itens (
 id bigint generated always as identity primary key,
 lote_id bigint not null references public.cda_transmissao_lotes(id) on delete restrict,
 campanha_destinatario_id bigint not null references public.cda_campanha_destinatarios(id),
 cliente_id bigint not null references public.clientes(id),
 email_snapshot text not null check (btrim(email_snapshot)<>'' and position('@' in email_snapshot)>1),
 nome_snapshot text,
 situacao text not null default 'pendente' check (situacao in ('pendente','excluido','cancelado')),
 motivo_exclusao text,
 chave_idempotencia uuid not null default gen_random_uuid(),
 criado_em timestamptz not null default now(),
 unique(lote_id,campanha_destinatario_id),
 unique(chave_idempotencia)
);
create index if not exists cda_transmissao_lote_itens_lote_idx on public.cda_transmissao_lote_itens(lote_id,situacao);
create table if not exists public.cda_transmissao_auditoria (
 id bigint generated always as identity primary key,
 transmissao_id bigint not null references public.cda_transmissoes_oficiais(id) on delete restrict,
 lote_id bigint references public.cda_transmissao_lotes(id),
 acao text not null,
 detalhe jsonb not null default '{}'::jsonb,
 registrado_por uuid,
 registrado_em timestamptz not null default now()
);
-- Tabelas oficiais intencionalmente inacessíveis ao navegador.
-- Nenhum endpoint de execução ou autorização foi criado.
alter table public.cda_transmissoes_oficiais enable row level security;
alter table public.cda_transmissao_lotes enable row level security;
alter table public.cda_transmissao_lote_itens enable row level security;
alter table public.cda_transmissao_auditoria enable row level security;
revoke all on public.cda_transmissoes_oficiais,public.cda_transmissao_lotes,public.cda_transmissao_lote_itens,public.cda_transmissao_auditoria from anon,authenticated;
-- Sequências existentes de outros módulos permanecem intactas.

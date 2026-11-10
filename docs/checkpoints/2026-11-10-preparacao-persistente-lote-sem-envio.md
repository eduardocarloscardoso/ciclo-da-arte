# CHECKPOINT — PREPARAÇÃO PERSISTENTE DE LOTE SEM ENVIO
Data: 10/11/2026. Base: `305611e3f5ca88f6306520e36140c0a91e325966`.
Branch exclusiva: `preview/campanha-mensagens`. `main` intocada.

## Implementado
- UI em `cda-modulo-homologacao.js`: seleção de mensagem, prévia da lista ativa, preparação persistente confirmada, consulta de lote e interrupção. Botão de envio permanentemente desabilitado.
- Edge Function `cda-lote-homologacao-preview` (ACTIVE, verify_jwt true): exige usuário Supabase Auth + membro da equipe; só permite ações `status`, `preparar` e `interromper`; não contém chamada Resend nem endpoint de disparo.
- Banco: `cda_envio_lotes`, `cda_envio_lote_itens`, `cda_email_supressoes` com RLS; função transacional `cda_preparar_lote_homologacao` executável apenas por service_role. Único lote por campanha/mensagem/modo e snapshot de destinos ativos normalizados (e-mails inválidos/duplicados/suprimidos excluídos).
- Snapshot desacoplado do CRUD: exclusão de e-mails e Pessoas continua possível; IDs de origem mantidos como referência histórica.
- Migrations versionadas sob `supabase/migrations`. Banco é compartilhado com produção; apenas DDL aditivo e alteração da FK da estrutura recém-criada.
- Diff verificado, exclusivamente cinco arquivos: UI, index, Edge Function, duas migrations.

## Verificações seguras
- Antes da homologação: 0 lotes, 0 itens e 0 envios oficiais.
- Campanha 4: 875 destinatários oficiais (867 válidos), 867 leads, 4 pessoas / 5 endereços ativos para homologação.
- Nenhum e-mail foi enviado ou solicitado; nenhum lote foi criado via testes automatizados.
- Função RPC bloqueada para anon/authenticated, autorizada a service_role.
- Controle operacional de envio/retomada ainda não implementado. Não confundir preparação com disparo.

## Próximo trabalho
1. Homologar visualmente no Preview: selecionar mensagem 1; clicar **Preparar lote (sem envio)**; conferir lote persistido com 5 endereços; recarregar e conferir persistência. Não clicar em Interromper antes de avaliar comportamento.
2. Projetar envio idempotente com autorização específica, controle de concorrência e resultado indeterminado; integrar eventos Resend, bloqueios/devoluções/descadastramento; validar políticas LGPD; só então habilitar execução para homologação.
3. Modo Oficial bloqueado até autorização expressa; jamais acessar/correr disparo aos 867 leads na fase atual.

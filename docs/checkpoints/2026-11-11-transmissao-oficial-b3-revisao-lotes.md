# Checkpoint B3 — Revisão administrativa individual dos lotes (11/11/2026)

## Decisão funcional
Conferência LGPD/de destinatários já discutida com o usuário. Não interromper desenvolvimento operacional por esse tópico; mantém-se a observação jurídica e o controle de preferências/oposição antes de envios reais. A implementação B3 não autoriza envio.

## Código e arquitetura
- Branch `preview/transmissao-oficial-universal`, derivada da Production `main`, ainda não incorporada à Production.
- Migração `supabase/migrations/20261111_b3_revisao_administrativa_sem_envio.sql`.
- Tabela `cda_transmissao_revisoes_lotes`: um estado por lote (pendente/revisado/revogado), impressão digital SHA-256, quantidade, revisor, data e observação. RLS e privilégio direto revogado.
- Funções `cda_consultar_revisoes_lotes_b3` e `cda_revisar_lote_oficial_b3`: apenas administrador autenticado conforme `auth.users + equipe.is_admin`. Histórico na `cda_transmissao_auditoria`.
- Impressão digital `cda_fingerprint_revisao_lote_b3`: hashes do conteúdo congelado e de cada destinatário/identificador idempotente do lote.
- Cada revisão exige confirmação textual independente; a revogação é registrada em auditoria.
- Interface B3 na página Transmissão Oficial dentro de Comercial → Pipeline B2C; visualiza lotes, quantidade e estado, com botão Revisar (sem envio), Revogar e Atualizar.
- Texto de Governança atualizado: B2 persistente está disponível, B3 faz revisão administrativa; LGPD não bloqueia desenvolvimento. Executor e autorização operacional de envio ainda indisponíveis.
- Não há código que defina `habilitado=true` ou `autorizado_em`, e banco proíbe habilitação por `CHECK`.

## Evidência em Supabase
- Transmissão nº 1, campanha nº 4, mensagem nº 1: 867 destinatários em 29 lotes.
- Lotes 1 e 28 com 30 destinatários, lote 29 com 27; fingerprints SHA-256 têm 64 caracteres.
- Ao concluir a migração, zero revisões B3, zero lotes habilitados, zero transmissões habilitadas, uma auditoria anterior de congelamento.
- Permissões: RPCs B3 acessíveis a authenticated, negadas a anon; assinatura bruta não acessível a authenticated.

## Próximas etapas
- Validação visual pelo usuário em Preview; revisar somente quando quiser, sem transmissão.
- Controles técnicos de envio, políticas de limites, pausas, credenciais Resend, autorização operacional por lote e conciliação em etapa posterior.
- Antes do envio real: avaliar/atender requisitos legais e pedidos de oposição/supressão aplicáveis; não supor aptidão jurídica pelo status de revisão administrativa.
- Não promover a `main` antes da homologação.

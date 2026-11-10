# CHECKPOINT — MOTOR DE HOMOLOGAÇÃO · FASE 1 · DIÁRIO DURÁVEL E EXECUTOR BLOQUEADO
Data: 10/11/2026. Branch: `preview/campanha-mensagens`.
Commit funcional: `903f2f755d4dfefdc55aae9e185819768b16a1e4`.
Preview READY correspondente: `https://ciclo-da-arte-2rfqcnitb-eduardocarloscardosos-projects.vercel.app`.

## Diagnóstico
- Resend suporta `Idempotency-Key` em `POST /emails`, mas a proteção do provedor expira após 24 horas; portanto, proteção permanente deve existir no Supabase. Fonte: https://resend.com/changelog/idempotency-keys
- Funções antigas `enviar-email-teste` e `enviar-email-teste-historico-preview` continuam separadas; a primeira aceita HTML do cliente, portanto NÃO será reaproveitada diretamente para lotes.
- Webhook `resend-eventos-preview` já valida assinatura e correlaciona eventos por `resend_email_id` de tentativas conhecidas, mas a correlação com `cda_envio_lote_itens` ainda é futura.

## Implementado
1. Migration `supabase/migrations/20261110_diario_idempotencia_fase1_bloqueado.sql`: tabela `public.cda_envio_lote_operacoes`, única por `item_id` e `chave_idempotencia`, rastreia estados futuros, tentativa e Resend ID. RLS ON, nenhuma permissão anon/authenticated; no momento, zero linhas.
2. RPC `cda_diagnosticar_diario_lote` service-role-only: consulta total, chaves, operações e resultados indeterminados; não escreve nem envia.
3. Edge Function `cda-executor-homologacao-preview` v1, `verify_jwt=true`: valida sessão Supabase e `cda_e_membro_equipe`. `diagnosticar` retorna diagnósticos de trava e diário em modo leitura. `enviar` retorna sempre 423 `EXECUTOR_BLOQUEADO`. Não consulta segredo Resend nem faz chamadas para enviar.
4. Branch `main` e produção Vercel não alteradas. Nenhuma modificação de interface nesta etapa, portanto o botão Enviar da Lista de Homologação continua desabilitado.

## Verificações
- `cda_diagnosticar_diario_lote(1)`: destinatários 5, chaves únicas 5, operações 0, indeterminados 0, autorizado false, envio habilitado false.
- Acesso a tabela para anon/authenticated SELECT/INSERT: false.
- Lote #1 continua com 5 pendentes, 0 tentativas e 0 Resend IDs.
- Nova Edge Function ACTIVE v1. Autenticação funcional em navegador ainda não homologada com sessão de usuário; não realizado envio.
- Diff: só migration e nova Edge Function. Preview READY após commit funcional.

## Pendente — NÃO liberado
- Aprovação de conteúdo/campanha/lote/destinatários e autorização auditável, com expiração e revogação.
- Execução individual com reserva atômica e escrituração do diário antes de chamadas Resend, payload gerado somente a partir do servidor, hash imutável da mensagem, `Idempotency-Key` estável e tratamento sem reenvio automático de timeout >24h.
- Limites de taxa, observabilidade, descadastramento/supressão, eventos recebidos pelo webhook e correlação de entrega.
- Implementação e testes controlados do caminho Resend só após revisão; qualquer envio real ainda depende de autorização expressa do usuário. Oficial 867 permanece bloqueado.

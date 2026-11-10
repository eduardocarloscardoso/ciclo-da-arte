# CHECKPOINT — INTEGRIDADE DO DIÁRIO E IDENTIFICAÇÃO DO RASCUNHO (SEM ENVIO)
Data: 10/11/2026. Branch: `preview/campanha-mensagens`. Main não modificada.
Commit funcional: `ebbf7fe9edb5f69d7bd714a997d398539a9aa1f8`.
Preview READY: `https://ciclo-da-arte-2x7p6nru9-eduardocarloscardosos-projects.vercel.app`.

## Feito
1. Migration `supabase/migrations/20261110_auditoria_integridade_diario_lote_sem_envio.sql` aplicada no projeto oficial `gsizoiwefejsllgtsard`:
   - chave única composta no item por (lote_id,id);
   - FK composta na operação, impedindo apontar item de outro lote;
   - índice único em Resend ID não nulo, impedindo associar mesmo ID a múltiplas operações;
   - RPC read-only `cda_auditar_integridade_lote` restrita a service_role.
2. `supabase/functions/cda-executor-homologacao-preview/index.ts` v5 ACTIVE:
   - `diagnosticar` agora inclui integridade do diário e verifica consistência das chaves;
   - `conferir_conteudo` consulta operações já existentes para excluir itens anteriormente reservados da elegibilidade;
   - calcula SHA-256 determinístico por item do **rascunho** (lote, email, nome, mensagem do banco, versão, conteúdo, remetente), sem gravar ou transmitir;
   - retorna IDs, chaves e fingerprints para auditoria, mas NÃO retorna um payload definitivo do Resend. O hash do rascunho não substitui o futuro `payload_sha256` do exato JSON enviado.
   - corrigida validação regex de email para sufixo contendo ponto.
   - `enviar` continua HTTP 423 `EXECUTOR_BLOQUEADO` incondicional; NÃO contém cliente Resend nem solicita envio.
3. Decisão de 09–10/11 mantida: descadastramento não é bloqueante para homologação interna; fica no backlog da operação comercial oficial. Supressões continuam aplicáveis.

## Testes executados
- `cda_auditar_integridade_lote(1)`: 5 destinatários, 5 pendentes, 5 chaves distintas, 0 operações, 0 tentativas, 0 IDs Resend, 0 indeterminados e envio desabilitado.
- Permissões mantidas; constraints compostas consultadas e confirmadas.
- Diff de apenas 2 arquivos: migration e Edge Function.
- Vercel Preview READY em commit funcional e Edge Function ACTIVE v5.
- Sem teste autenticado em navegador do novo endpoint, portanto a conferência end-to-end ainda NÃO está homologada.
- Nenhum envio de homologação ou oficial. `main` e produção Vercel inalteradas.

## Ainda falta — próximos passos
- Montar o **payload final** do Resend no backend com correspondência visual ao modelo aprovado, com hash de seu JSON completo;
- implementar fluxo atômico de reserva + criação da tentativa + diário + tratamento de resultado ambíguo; evitar reprocessamento automático, pois proteção de Resend `Idempotency-Key` é de 24h (https://resend.com/changelog/idempotency-keys);
- implementar integração de resposta e webhook no diário do lote, controles por taxa/concor­rência e autorização explícita, mantendo disparo bloqueado até solicitação do usuário;
- revisar requisitos LGPD do modo oficial em etapa própria, sem repriorizar descadastro para a homologação interna.

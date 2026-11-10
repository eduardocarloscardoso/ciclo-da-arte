# CHECKPOINT — INTEGRAÇÃO RESEND · TRANSACIONAL + EVENTOS + ADAPTADOR (ENVIO BLOQUEADO)
Data: 10/11/2026 | Branch: `preview/campanha-mensagens` | Base: `5309d6bbff9d43f22ef90bbf408d34c4a66d3a08`
Último commit técnico antes do checkpoint: `489d350f78a6a42c27f3ad25b18074d889085114`.

## Finalizado nesta rodada
1. Reserva transacional `public.cda_reservar_tentativa_lote`: valida lote, autorização (mantida fisicamente impossível), destinatário ativo e supressões; grava tentativa + operação com hash e idempotency key + muda item para processando num único commit.
2. `public.cda_marcar_solicitacao_lote`: revalida condições sob locks lote → controle → item → operação; registra estado solicitada antes de qualquer HTTP. Sem retentativa automática.
3. `public.cda_concluir_tentativa_lote`: aplica resultado aceita/falha/indeterminada à tentativa, ao diário e ao item, recusando repetição da operação; exige que aceita/indeterminada partam de solicitada.
4. `public.cda_reivindicar_item_lote` legado agora lança `CLAIM_OBSOLETO_BLOQUEADO`; remove caminho de gravação parcial.
5. `public.cda_reconciliar_evento_lote`: reconcilia apenas registros em `cda_email_eventos` que estejam associados por `tentativa_id` + `resend_email_id` a operações do lote; prioridades monotônicas para delivered/bounced/delivery_delayed/complained.
6. `supabase/functions/resend-eventos-preview/index.ts`: copiado da versão ACTIVE v2 previamente existente, preservando assinatura Svix e validações. Acrescentada a chamada da RPC após persistir evento. Implantado como ACTIVE v3. Não altera antigos testes sem vínculo de lote.
7. `supabase/functions/cda-executor-homologacao-preview/resend-adapter.mjs`: adaptador com `POST /emails`, header `Idempotency-Key`, única tentativa por chamada e classificação conservadora de timeouts/erros HTTP como indeterminados. **Não está importado nem ligado à Edge Function de executor**; não houve chamada à API Resend.
8. Testes de adaptador `tests/resend-adapter.test.mjs`, executados localmente com mock de fetch e sem rede. Cenários de 200 c/ ID, 200 sem ID, 409, 500, 422, falha de rede e chave idempotente: aprovados.

## Verificações / segurança
- SQL testou `cda_reservar_tentativa_lote` e `cda_marcar_solicitacao_lote`: ambos retornaram `EXECUTOR_BLOQUEADO`. Claim legado retorna `CLAIM_OBSOLETO_BLOQUEADO`.
- Tentativas e operações iguais antes/depois dos testes.
- `cda_reconciliar_evento_lote` testada com Svix ID histórico, retornando `sem_item_lote`, sem qualquer mutação.
- Funções de reserva/marcação/conclusão não executáveis por anon/authenticated; exclusivamente service_role.
- `cda-executor-homologacao-preview` v7 mantém `enviar` HTTP 423, sem Resend. Sem autorização liberada, `cda_envio_lote_execucao_controle` mantém CHECK habilitado=false, autorização nula. Nenhum disparo autorizado.
- Lote #1: 5 destinatários, 5 pendentes, 5 chaves únicas, 0 tentativas, 0 operações, 0 IDs Resend, 0 envios. Oficiais 867 sem disparo.
- Diff desde base inclui somente migrations SQL, arquivos backend, teste e checkpoints. `main` não alterada. Supabase compartilhado com produção recebeu funções aditivas/redefinição de claim legado bloqueado e webhook Preview atualizado.
- Vercel READY confirmado em commit anterior `ce66defe3bc6c2eefd59fed2a336f32683cc2cf6`; publicação dos commits seguintes no Vercel não confirmada pelo list_deployments no momento do checkpoint. Como não há alteração frontend, não solicitar homologação visual.

## Em aberto (não declarar integração pronta para envio)
- Conectar adapter à Edge Function de executor, sempre condicionado à revisão do controle de autorização; hoje o adapter está desacoplado.
- Validar `conferir_payload` no executor com JWT real e comparação exata com HTML do navegador aprovado.
- Teste E2E de webhook com evento assinado e operação de lote real depois de eventual envio autorizado; hoje só teste de não aplicabilidade ao evento histórico.
- Planejar e implementar uma autorização específica, auditável, de lote com consentimento expresso do usuário; só então rever CHECKs e HTTP 423. Não habilitar agora.
- Descadastramento fora do caminho crítico do teste interno conforme decisão anterior; revisar antes de envio comercial oficial.
- Não mandar Preview para usuário em alterações sem novidades visuais.

# CHECKPOINT — FLUXO TRANSACIONAL DE TENTATIVAS, SOLICITAÇÃO E RESULTADO BLOQUEADO
Data: 10/11/2026. Branch: `preview/campanha-mensagens`. Último commit técnico: `674b786eedf92da6f767d621fdf1f0ec6f5319b4`.

## Implementação efetiva
- `20261110_reserva_resultado_transacional_bloqueados.sql`:
  - `cda_reservar_tentativa_lote(lote_id,item_id,payload_sha256)` bloqueada por `cda_envio_lote_execucao_controle`, com lock do lote e do item, checagem de origem e supressões, duplicidades, integridade da mensagem. Quando FUTURAMENTE autorizada, grava `cda_email_tentativas`, `cda_envio_lote_operacoes` e muda estado do item em uma única transação; não chama Resend.
  - `cda_concluir_tentativa_lote` guarda resultado futuro de forma correlacionada nos 3 registros, com estados `aceita/falha/indeterminada`. Resultado indeterminado bloqueia reenvio automático.
  - `cda_reivindicar_item_lote` legado agora lança `CLAIM_OBSOLETO_BLOQUEADO`, evitando caminho que não registrava tentativa+diário no mesmo commit.
- `20261110_estado_solicitacao_unica_bloqueada.sql`:
  - `cda_marcar_solicitacao_lote` implementa estado `solicitada` antes de potencial requisição HTTP, com hash obrigatório correspondente ao diário.
  - Conclusão `aceita/indeterminada` exige estado anterior `solicitada`. Não repetir conclusão depois de finalizada.
- `20261110_solicitacao_trava_concorrencia.sql`: ordem de locks lote → controle → item → operação e revalidação do cadastro ativo e supressões antes de marcar solicitação.

## Testes e evidências
- As três migrations foram aplicadas com sucesso ao Supabase compartilhado `gsizoiwefejsllgtsard`, sem alteração das CHECKs que obrigam `habilitado=false` e autorização nula.
- Teste SQL transacional com chamadas reais a `cda_reservar_tentativa_lote`, `cda_marcar_solicitacao_lote` e `cda_reivindicar_item_lote`: os três caminhos lançaram os bloqueios esperados, nenhuma escrita ocorreu.
- Permissões EXECUTE para `anon` e `authenticated` nas 3 funções novas: falsas. Somente service_role.
- Auditoria final do lote #1: 5 destinatários, 5 pendentes, 5 chaves distintas, 0 tentativas vinculadas, 0 operações, 0 Resend IDs, 0 indeterminados, envio desabilitado.
- Diff: três migrations adicionadas, sem alterações de UI, da Edge Function, nem da branch main. As migrations no Supabase repercutem no banco compartilhado, mas somente acrescentam a estrutura de funções e substituem o claim antigo (que permanece bloqueado).
- Vercel READY do commit `ce66defe3bc6c2eefd59fed2a336f32683cc2cf6`; aguardar/confirmar READY do checkpoint final.

## Próximo desenvolvimento / limitações
- **Não há envio integrado ao Resend ainda**: Edge Function v7 continua com `enviar` HTTP 423 e nenhum código de chamada à API do provedor.
- A montagem HTML/texto e cálculo de hash permanecem disponíveis somente em `conferir_payload`, mas ainda NÃO foram exercitados end-to-end com JWT válido.
- Quando autorizado futuramente, o executor deverá calcular hash do JSON real imediatamente antes de reservar, gravar transação, marcar solicitada, invocar Resend com idempotency key original, registrar resposta ou indeterminado; garantir que timeout não dispara retry automático.
- Associar os eventos verificados do Resend ao estado do item e operação; homologar teste seguro autenticado e rever autorização específica do lote antes de qualquer envio.
- O descadastramento não é caminho crítico do primeiro teste interno conforme decisão anterior, e fica para revisão da campanha oficial.
- Nenhuma mensagem enviada aos cinco testes nem aos 867 oficiais, e nenhuma permissão de envio concedida.

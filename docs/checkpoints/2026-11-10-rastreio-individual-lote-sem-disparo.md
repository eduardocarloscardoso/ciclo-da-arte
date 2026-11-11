# CHECKPOINT — RASTREABILIDADE INDIVIDUAL DE LOTE (SEM DISPARO)
Data: 10/11/2026. Branch: `preview/campanha-mensagens`. Referência inicial: `1e6360afbe3f50c044cbdddd615fdf93944b3e18`.

## Escopo concluído
- Lote #1 preservado: campanha 4, mensagem 1, modo homologação; 5 destinatários pendentes.
- Migration `20261110_lote_rastreio_idempotencia_sem_envio.sql`: chave UUID estável e exclusiva por destinatário, colunas reservadas para tentativa e ID Resend, horários/eventos/erros e estados adicionais; sem acionar envio.
- Edge Function `cda-lote-homologacao-preview` versão 3, verify_jwt true: valida sessão e membro da equipe; ações permitidas exclusivamente status/preparar/interromper. Não possui chamadas a Resend nem a outras Edge Functions de envio; retorna contadores reais e, se futuramente existir associação autenticada tentativa_id, eventos técnicos para destinatário. Chave de idempotência não é exposta no retorno.
- UI: auto-seleção quando campanha possui uma mensagem, barra de progresso por quantidade efetivamente processada, contagens por status, tabela completa (sem altura de 170px) e IDs Resend se existirem; botão Enviar lote segue desabilitado.

## Validação exclusivamente de leitura
- Lote #1: 5 itens pendentes, 5 chaves diferentes, 0 tentativas vinculadas, 0 IDs Resend.
- Histórico global: 6 tentativas antigas, 0 oficiais. Lista oficial congelada: 875; leads: 867.
- Não realizamos envios, não alteramos leads, lista oficial ou produção.
- Confira último Preview READY para testar carregamento da tela; homologação visual do usuário ainda pendente.

## Pendências
- Ainda NÃO há um executor de mensagens em lote autorizado: nenhum item é processado de fato, portanto os contadores permanecem em 0.
- Construir execução com atomicidade/claim transacional, expiração/resultado indeterminado, prevenção de replay e restrição explícita da autorização, validação de supressões e descadastramento LGPD, integração com Resend usando idempotência real suportada pelo provedor, confirmação de entrega por webhook e tratamento de devoluções; homologar em ambiente controlado e somente depois obter autorização específica.
- O modo oficial permanece bloqueado. Nunca realizar disparos sem autorização expressa.

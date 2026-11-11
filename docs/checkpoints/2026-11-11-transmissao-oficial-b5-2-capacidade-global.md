# Checkpoint B5.2 — Capacidade global simulada entre campanhas

Data: 11/11/2026. Projeto: Ciclo da Arte.
Branch: `preview/transmissao-oficial-universal`, sem merge na `main`.

## Funcionalidade universal
- Reserva SIMULADA global de capacidade por minuto, hora e dia para lotes de quaisquer campanhas, em tabela única `cda_transmissao_reservas_globais_b5`.
- Limites globais armazenados em `cda_transmissao_limites_globais_b5`, defaults conservadores 10/min, 120/h, 300/dia para planejamento, não quotas confirmadas do Resend.
- A função `cda_preparar_reserva_global_simulada_b5` exige B2 congelado, B3 revisão íntegra, B4 pré-aprovação íntegra e B5 simulação íntegra. Também valida ausência de habilitação real e de reserva duplicada.
- O backend aplica advisory lock GLOBAL e aloca horários com contadores compartilhados entre todas as campanhas; verifica capacidade em intervalos de minuto, hora e dia. Máximo 90 dias de horizonte.
- Reserva única por item e chave de idempotência, e estado fixo `simulado_reservado`, `executado=false`, `autorizado=false`, `resend_id=null`. RLS e revogação de privilégios diretos anon/authenticated.
- Leitura administrativa agregada via `cda_consultar_reservas_globais_b5`; nenhuma API de envio e nenhum token Resend.
- UI nova `cda-modulo-transmissao-b5-global.js` integrada ao simulador B5, apresenta reserva do lote selecionado e confirmação textual `RESERVAR SIMULACAO LOTE N`.
- Sem envio: nenhuma chamada Resend, autorização efetiva, executor remoto, agendamento ativo nem alteração nas tabelas de envio.

## Evidências
- Migração aditiva aplicada ao Supabase `gsizoiwefejsllgtsard`.
- Em 11/11: 1 simulação, 30 posições simuladas; 0 reservas globais, 0 transmissões e 0 lotes habilitados; 1 lote pré-aprovado.
- Supabase: RLS ativo; funções requerem administrador autenticado; acesso anon negado. JS sintaticamente válido, scripts carregados na ordem.
- Production `main` inalterada.

## Limitação e próximos marcos
- B5.2 é um PLANEJADOR ESTRUTURAL de capacidade compartilhada; NÃO é um executor de disparo de mensagens.
- Antes de habilitar executor real: autorização efetiva expressa por lote, token de execução com expiração, cotas verificadas do Resend, idempotência com tratamento de timeout e indeterminação, exclusões/supressões aplicáveis, deduplicação global por campanha/canal quando requerida, pausa e retomada segura e recebimento/conciliação de webhooks Resend.
- Simulações são ancoradas em horários de planejamento e não constituem reservas reais do provedor; resultados de múltiplos lotes e campanhas exigem homologação separada.
- Teste visual inicial: no lote nº 1 já simulado, clicar em `Preparar reserva global simulada (sem envio)`, digitar `RESERVAR SIMULACAO LOTE 1`, conferir 30 posições, horários e nenhum envio.

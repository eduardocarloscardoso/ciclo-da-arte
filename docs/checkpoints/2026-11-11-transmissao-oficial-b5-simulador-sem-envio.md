# Checkpoint B5 — Fila simulada do executor oficial universal

Data: 11/11/2026
Projeto: Ciclo da Arte, `eduardocarloscardoso/ciclo-da-arte`
Branch: `preview/transmissao-oficial-universal`
Produção: `main` inalterada.

## Contexto
B1 planejamento universal, B2 lista congelada (867 destinatários / 29 lotes), B3 revisão, B4 limites e pré-aprovação. Até o presente checkpoint, apenas lote nº 1 foi revisado e pré-aprovado; plano pausado em 10/min, 120/h, 300/dia e 100/lote.

## Entregas B5
- Tabelas `cda_transmissao_simulacoes_b5` e `cda_transmissao_simulacao_itens_b5`, com RLS ativo e sem acesso direto anon/authenticated.
- RPCs `cda_simular_execucao_lote_b5(lote_id)` e `cda_consultar_simulacoes_b5(transmissao_id)` restritas a administradores autenticados.
- Pré-condições: plano congelado, lote preparado e não habilitado, revisão B3 íntegra, pré-aprovação B4 íntegra, limites B4 persistidos, destinatários correspondentes ao snapshot, ausência de simulação anterior.
- Cálculo de slots por minuto, hora e dia para cada item usando os limites B4, persistindo chave idempotente, posição e horário previsto. As restrições do banco mantêm `status='simulado'`, `envio_habilitado=false`, `tentativa_real=0`, `resend_email_id IS NULL`. Nenhuma API Resend é chamada.
- Uma única simulação permitida por lote com assinatura digital e auditoria. Transação atômica; falhas impedem criar simulações incompletas.
- Interface isolada em `cda-modulo-transmissao-b5.js`, carregada antes de `cda-modulo-transmissao-oficial.js`. Exibe status, simulação do lote escolhido e confirmação textual `SIMULAR LOTE N`, sem pop-ups externos.
- Nenhuma chamada ao executor de homologação, nenhum token/credencial Resend, nenhum endpoint externo de envio.
- O simulador é parte da B5 preliminar, não equivale a executor real ou autorização para transmissão.

## Evidências e verificações
- Antes de teste do usuário: 0 simulações, 0 itens simulados, 0 transmissões/lotes habilitados; 1 pré-aprovação B4.
- Permissões: RPCs autenticados apenas, anon negado; RLS nas duas novas tabelas.
- CHECKs: itens não aceitam tentativa real nem ID do Resend, simulações não aceitam envio habilitado.
- Código JS de ambos os módulos e scripts embutidos no index passou pela verificação de sintaxe.
- Usuário ainda deve homologar visualmente no Preview.

## Próximas etapas
- Validar na tela a simulação do lote nº 1 (30 destinatários), conferir que horários e contagens persistem e que não existe transmissão.
- B5 real futuro: desenvolver executor oficial separado, autorização válida com prazo, limites globais entre múltiplos lotes e campanhas, idempotência de transmissão, pausa e retomada, retry seguro e políticas de oposição/supressões antes de enviar efetivamente.
- B6: monitoramento de eventos Resend e conciliação; jamais assumir que simulação prova entregabilidade.
- Nenhuma promoção à Production sem nova homologação.

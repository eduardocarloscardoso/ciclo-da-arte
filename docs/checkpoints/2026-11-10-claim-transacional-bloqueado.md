# CHECKPOINT — REIVINDICAÇÃO TRANSACIONAL PREPARADA, ENVIO FISICAMENTE BLOQUEADO
Data: 10/11/2026. Branch exclusiva: `preview/campanha-mensagens`.
Commit funcional: `03eabf7e3514a23ecdefde61006968de127d15c9`.
Preview READY: `https://ciclo-da-arte-1x1vj3z7i-eduardocarloscardosos-projects.vercel.app`.

## Implementado
- Migration `supabase/migrations/20261110_claim_transacional_bloqueado.sql`.
- Função `cda_reivindicar_item_lote` (service_role only): bloqueia a linha do lote e do controle; exige modalidade homologação + status preparado, autorização explícita e habilitação verdadeira. A tabela `cda_envio_lote_execucao_controle` já contém CHECKs imutáveis nesta etapa que proíbem habilitar e preencher autorização. Por isso nenhuma reivindicação é possível.
- Estrutura interna futura com `FOR UPDATE OF i SKIP LOCKED`, verificação da lista ativa, e-mails válidos, lista de supressões, checagem de ausência de tentativa/Resend anteriores, preservação de chave de idempotência e transição atômica para processando. Esse caminho **não foi executado nem é alcançável** com a trava.
- `cda_diagnosticar_executor_lote` apenas leitura, restrita a service_role; retorna status da trava, contagens e decisão negativa de envio.
- Edge Function `cda-lote-homologacao-preview` versão 7: mantém ações pré-existentes sem envio, consulta diagnóstico somente leitura, rejeita retorno de trava inesperado. Não invoca `cda_reivindicar_item_lote`, não contém código Resend.
- Interface `cda-modulo-homologacao.js`: indicador de trava dentro de Detalhes técnicos e auditoria. Botão Enviar permanece desabilitado. `index.html` com nova versão do módulo.
- Nenhum contato com os destinatários / sem novos envios.

## Validações
- Teste direto de `select public.cda_reivindicar_item_lote(1)` foi rejeitado com `EXECUTOR_BLOQUEADO` (resultado esperado). Depois do teste, cinco itens continuam pendentes, zero processados, zero tentativas e zero Resend IDs.
- `anon` e `authenticated`: sem EXECUTE de reivindicação; `service_role`: autorizado a invocar função, porém bloqueado pela trava física.
- Simulação: total=5, cinco pendentes, trava ativa, `pode_reivindicar=false`, `pode_enviar=false`.
- Diff: migration, Edge Function, UI e index; nenhuma alteração em `main`, funcionalidades financeiras, campanha ou lista oficial.

## Etapas ainda necessárias
- Revisão da arquitetura definitiva da autorização com aprovação explícita por campanha/mensagem/lote e validade curta, limitações de acesso e controles de revogação.
- Confirmar como Resend trata idempotência, retries, rate limiting e resultados indeterminados; testar sem envios até autorização.
- Conectar executor autenticado ao provedor após auditoria, com registro transacional de tentativas e webhook, supressões e descadastramento LGPD.
- Homologar a interface no Preview e somente então solicitar autorização específica para enviar aos cinco endereços.
- Modo oficial segue proibido.

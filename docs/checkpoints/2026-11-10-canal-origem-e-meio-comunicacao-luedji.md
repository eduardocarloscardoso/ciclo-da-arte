# CHECKPOINT — ORIGEM COMERCIAL ≠ MEIO DE COMUNICAÇÃO · LUEDJI
Data: 10/11/2026. Branch: `preview/campanha-mensagens`. Commit funcional `a7dbc578b79bfdc751c635b760ce7b7bb067bde4`.
Preview READY: `https://ciclo-da-arte-61qbb30u0-eduardocarloscardosos-projects.vercel.app`.

## Evidência
Canal E-COMMERCE LUEDJI LUNA id `1778540708009`, SHOWS LUEDJI LUNA id `1778540708679`.
Campanha 4 com 867 leads; todos com compras históricas no e-commerce, zero com compras no canal Shows, e todos `canal_id` inicialmente nulos.
`cliente_canal` apenas mantém associações históricas e não é prova suficiente de origem, por isso a origem foi validada em `compras` por lead/cliente.

## Alterações executadas
- Script transacional e idempotente auditado: `docs/checkpoints/2026-11-10-origem-comercial-luedji-e-meio-email.sql`.
- Backup privado de todos os 867 valores anteriores em `cda_backup_origem_leads_luedji_20261110`, RLS sem políticas de cliente.
- Lote 867 leads da campanha 4 com `canal_id=1778540708009` (origem comercial), sem mudar etapa, nome, e-mail, responsável ou mensagens.
- Backup dos meios anteriores e alteração de `cda_campanhas.canais_selecionados` para `['email']` para a campanha 4.
- Meios de contato permanecem herdados no formulário quando `leads_b2c.meios_selecionados` é null; não atualizamos os 867 arrays individuais.
- UI em `cda-modulo-pipeline-b2c.js`: rótulo 'Canal de origem comercial' e 'Meios de comunicação' com explicação da diferença, sem alterar handlers.
- Cache busting em `index.html`. Branch main e produção sem alteração.

## Verificações
867/867 com canal origem e-commerce, backup 867, canal de comunicação email, lista oficial congelada 875, 0 envios oficiais.
Não disparado Resend, nem afetado Lote #1 (cinco pendentes).
Validação visual pendente: cadastro de Jady deve exibir canal E-COMMERCE LUEDJI LUNA e checkbox E-mail marcado por herança, sem alterar cadastro.

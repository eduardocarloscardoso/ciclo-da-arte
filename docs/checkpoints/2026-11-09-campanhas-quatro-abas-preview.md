# Checkpoint — Campanhas em quatro abas

Data: 09/11/2026
Branch: `preview/campanha-mensagens`
Commit funcional: `ca011da5aae9da58bac293ddb07e3d0ce7445ece`
Preview Vercel READY: https://ciclo-da-arte-62vd0bn5p-eduardocarloscardosos-projects.vercel.app

## Organização visual
- **Campanha e Público** reúne Visão Geral + Público, sem redundância: público calculado, e-mails válidos da lista congelada, segmentação e critérios, total/data da lista congelada, período, responsáveis, etapa de entrada, meta e benefício. Botões Editar, Duplicar e Congelar/Recongelar Lista.
- **Mensagens** mantém mensagens vinculadas e Preparar Envio (incluindo Visualizar Mensagem e Enviar Teste).
- **Execução** mantém Adicionar Público ao Pipeline, Gerar Mensagens, Gerar Roadmap de Tarefas.
- **Resultados** mantém KPIs existentes, sem habilitar envios em massa.
- Base Legal LGPD preservada ao lado de Selecionar Campanha.

## Garantias
- Alteração exclusivamente visual em `cda-modulo-campanhas.js` e versionamento de cache em `index.html`.
- Sem alterações de Supabase, dados, filtros, lista congelada, mensagens ou rotinas dos botões.
- JS validado sintaticamente, Vercel Preview READY.
- Branch principal `main`/produção sem publicação.
- Pendente: validação funcional visual pelo usuário das quatro abas.

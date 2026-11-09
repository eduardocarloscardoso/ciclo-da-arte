# Checkpoint — Tabela operacional do Pipeline B2C
Data: 09/11/2026. Projeto Ciclo da Arte CRM/ERP.
Repositório: `eduardocarloscardoso/ciclo-da-arte`.
Branch `preview/campanha-mensagens`, sem merge em main.
Commit frontend: `1f4ad44e938e0a016960ff54b7cf8b0de201a4ce`.
Preview Vercel READY: https://ciclo-da-arte-c61yzhd7h-eduardocarloscardosos-projects.vercel.app

## Implementado
- Em Comercial → Pipeline B2C: seletor `Visualização` com `Tabela operacional` (padrão) e `Kanban` (existente preservado).
- Tabela reutiliza filtros existentes campanha, cliente, canal e responsável; acrescenta filtro de etapa e situação de acompanhamento (com/sem responsável, com/sem tarefa ativa).
- Colunas: Cliente/e-mail, Campanha, Etapa, Responsável, Canal, Tarefas ativas, Última movimentação, botão Abrir (reutiliza modal do lead/histórico/compras/tarefas).
- Paginação de 25 linhas e total de clientes por filtro; ordenação pelo nome e sem gerar todos os cards do Kanban enquanto a tabela está ativa. Permite voltar ao Kanban com movimentação já existente.
- Nenhum lead, etapa, tarefa, responsável, mensagem ou envio modificado. Sem envio em massa.

## Verificações
- JavaScript validado sintaticamente; Vercel READY.
- Supabase: Luedji 853 leads = 853 destinatários marcados e-mail válido; 853 registros de entrada no histórico e zero pares duplicados.
- Pendente homologação visual da tabela e filtros pelo usuário.

## Próxima etapa sugerida
- Com a tabela homologada, definir distribuição dos responsáveis e agenda de follow-up antes de realizar abordagens.

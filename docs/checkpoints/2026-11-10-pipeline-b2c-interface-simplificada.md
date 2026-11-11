# CHECKPOINT — PIPELINE B2C COM BARRA OPERACIONAL SIMPLIFICADA
Data: 10/11/2026. Branch exclusiva: `preview/campanha-mensagens`.
Commit funcional: `dc5905c66ea636bd96a13bde12ef3b02a7c8416d`.
Preview READY: `https://ciclo-da-arte-ohve9218i-eduardocarloscardosos-projects.vercel.app`.

## Objetivo
Reduzir poluição visual na tela principal do Pipeline B2C sem modificar segmentação, filtros de consulta ou operações já homologadas.

## Mudanças
- Barra principal: seleção da campanha, busca de lead, contador.
- Atalho "Abrir Homologação" continua visível e abre a mesma página de homologação.
- "Filtros adicionais" recolhível: Canal (filtra `lead.canalId`) e Responsável (filtra `lead.responsavelId`), ambos continuam operando somente na consulta, sem redefinir a segmentação ou atribuição.
- "Ferramentas comerciais" recolhível: Gerar textos (filtrados), Diário comercial, Comunicações da campanha e Exportar WhatsApp. Todos preservam handlers, confirmação de geração em lote e comportamento existente.
- Faixa "Visualização" (tabela/kanban, etapa, situação) não foi alterada.
- Nenhum envio Resend foi habilitado ou executado.

## Arquivos modificados
`cda-modulo-pipeline-b2c.js`; `index.html` (cache-busting).
Não houve mudanças em tabelas, Edge Functions, registros comerciais, fórmulas, `main`, nem produção.
Sintaxe JS validada. Diff conferido. Preview READY; homologação visual pendente.

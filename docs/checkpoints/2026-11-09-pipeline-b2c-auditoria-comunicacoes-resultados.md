# Diagnóstico — Pipeline B2C como centro de acompanhamento operacional
Data: 09/11/2026. Projeto: Ciclo da Arte CRM/ERP.
Repo: eduardocarloscardoso/ciclo-da-arte. Branch: preview/campanha-mensagens.
AUDITORIA SOMENTE LEITURA: não houve alterações em tabelas, funcionalidades, frontend ou produção.

## Evidência do código
- cda-modulo-pipeline-b2c.js possui Kanban de cinco etapas fixas: Novo Lead, Contato, Engajado, Compra, Fidelização.
- Filtro por campanha e por etapa. Os leads em leads_b2c já incluem campanha_id e cliente_id.
- Movimentações de etapas usam seleção obrigatória de resultado quando catálogo aplicável, e são registradas em cda_historico_interacoes.
- Existe Diário de Interações com filtro de campanha/etapa/tipo; histórico individual de lead; tarefas; aba Compras abre Histórico de Compras por cliente.
- Existe geração de mensagens e exportação WhatsApp, porém não há evidência de integração com eventos do Resend no Pipeline.
- cda_email_tentativas registra cada teste no backend, ligado a campanha_id, mensagem_id, situação, destinatários, data, ID Resend. A aba Resultados da campanha consulta esses dados sem fazer disparo em massa.

## Diagnóstico no Supabase
- leads_b2c: 286 registros; 286 com campanha_id e cliente_id; todos na etapa Novo Lead; 240 na campanha Reativação Status Em Risco (04/08/2026), 46 em CLIENTES VIPS.
- Campanha Luedji Luna (id=4): 0 leads no Pipeline, 0 interações específicas, 0 tarefas da campanha. A lista de 861 destinatários congelados NÃO implica leads adicionados ao Pipeline.
- Histórico de interações: 298 eventos; 58 com campanha_id; 298 tipo pipeline; 0 tipo e-mail.
- Tarefas: 2, ambas associadas a campanhas.
- Compras: 10.895 registros, vinculados a clientes e canais de vendas. Não existe campanha_id na tabela compras; atribuição de receita à campanha não é automática/confiável.
- cda_email_tentativas: 1 teste registrado; campo campanha_id já permite consultar a partir do Pipeline; delivery/bounce/open/click ainda não integrados via webhook.

## Recomendação de arquitetura
- Campanhas continua planejando público, mensagens, base legal e a preparação técnica de testes; mantém aba Resultados como painel **somente leitura** e consolidado.
- Pipeline B2C assume acompanhamento de relacionamento e execução comercial, incluindo consulta detalhada de comunicações/tentativas por campanha.
- Registros técnicos de envio permanecem no módulo backend dedicado (cda_email_tentativas), sem replicação em cda_historico_interacoes para cada evento de provedor.
- Próxima alteração pequena sugerida: incluir no Pipeline B2C um painel de **Comunicações da campanha** somente leitura, com filtro de campanha já existente, consultando cda_email_tentativas e cda_campanha_mensagens; depois reduzir duplicação na aba Resultados de Campanhas.
- Não adicionar automaticamente todos os destinatários congelados ao Pipeline: respeitar ação explícita Adicionar Público ao Pipeline, confirmada pelo operador. Envio em massa fica bloqueado.
- Antes de implementar atribuição de vendas, definir regra formal de campanha × compra e granularidade cliente/canal/período.

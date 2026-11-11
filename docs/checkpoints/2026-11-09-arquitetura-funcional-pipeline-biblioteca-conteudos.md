# Checkpoint funcional — Revisão integral do Pipeline B2C orientado por conteúdos
Data: 09/11/2026
Projeto: Ciclo da Arte CRM/ERP
Repo: eduardocarloscardoso/ciclo-da-arte
Branch: preview/campanha-mensagens
Status: proposta funcional para validação, **sem implementação de alterações de produto nesta etapa**.

## 1. Motivação
O Pipeline não deve ser apenas um Kanban no qual leads progridem entre cinco estados. Com o público elegível de 853 clientes da campanha Luedji Luna · São Paulo, as comunicações devem ser conduzidas por uma estratégia que seleciona conteúdos reutilizáveis, prepara ações por canal e acompanha ocorrências técnicas e respostas comerciais sem confundi-las.

## 2. Fotografia técnica (auditada)
- Campanhas: segmentos, filtros, lista congelada, LGPD e seleção de mensagens, preparo/testes e indicadores consolidados.
- Biblioteca de Mensagens já existe e armazena modelos vinculados a campanhas em cda_campanha_mensagens; **não criar biblioteca concorrente por simples renomeação**.
- Pipeline B2C: cinco etapas (Novo Lead, Contato, Engajado, Compra, Fidelização), tabela operacional, Kanban, filtros, diário, tarefas e cadastro individual.
- Rastreabilidade: cda_email_tentativas e cda_email_eventos, associadas a campanha e mensagem; webhook Resend assinado validado em teste.
- Leads: cliente_id + campanha_id; inclusão segura e sem duplicidades por campanha.
- A campanha Luedji possui 853 leads em novo_lead; os 8 clientes sem e-mail válido foram excluídos da inclusão ao Pipeline.
- Não existe, neste fluxo, um registro formal único de ação de comunicação de campanha contendo conteúdo/versão + canal + público + lote + estado + resultados por destinatário.
- Atribuição de receita à campanha não é automática; histórico de compras não tem vínculo inequívoco a campanha.

## 3. Modelo conceitual proposto
### Entidades (conceitos, não tabelas aprovadas)
A. Campanha: objetivo, público, período, oferta, base legal, canais habilitados.
B. Conteúdo: item autoral reutilizável (mensagem, imagem, vídeo, link, oferta), autor/origem, tipo, direitos/créditos, estado de aprovação, validade.
C. Versão do conteúdo: revisão imutável usada em determinada ação. Alterar rascunho não muda o que já foi enviado.
D. Plano de comunicação: campanha + propósito + público elegível + conteúdo/versão + canal + momento pretendido + responsáveis/autorização.
E. Execução: ação de envio ou contato materializada, estado operacional e destinatários associados; distingue teste de operação real.
F. Evento técnico: solicitado, aceito pelo provedor, entregue, falha, devolvido, reclamação (fonte Resend ou outro sistema).
G. Interação comercial: resposta humana, pedido, interesse, oportunidade, opt-out, atendimento ou outras ocorrências justificadas.
H. Conversão: venda transacionada com regra de atribuição explícita, com possibilidade de origem desconhecida.

### Fonte da verdade
- Biblioteca = fonte de conteúdo e versões.
- Campanhas = estratégia, elegibilidade e plano.
- Pipeline = atividades operacionais e interações por cliente/campanha.
- Serviço de envio + eventos = prova técnica de comunicação, não interpretação de resposta.
- Histórico de Compras = vendas factuais.
- Resultados Campanhas = painel agregado somente leitura, calculado a partir dessas fontes.

## 4. Etapas do Pipeline: manter provisoriamente
- Novo Lead: público associado à campanha, não necessariamente cliente novo.
- Contato: contato efetivamente realizado/registrado; não mudar só por e-mail entregue.
- Engajado: evidência de reação ou interesse; abertura técnica isolada não basta.
- Compra: compra comprovada; estabelecer regra de atribuição antes de mover automaticamente.
- Fidelização: acompanhamento pós-venda.
Proposta: distinguir **estado da comunicação** (solicitado/aceito/entregue/rejeitado) de **etapa de relacionamento** (Novo Lead etc.).

## 5. Biblioteca de Conteúdos: evolução incremental
- Reaproveitar Biblioteca de Mensagens e cda_campanha_mensagens, preservando IDs, testes e histórico.
- Introduzir conceito de catálogo de conteúdos reutilizáveis e seu vínculo com campanhas, sem migrar registros existentes precipitadamente.
- Material: mensagem, imagem, vídeo, link, oferta, chamada para ação; versão, canal compatível, finalidade, validade e direitos de uso.
- Propor jornada: Rascunho → Em revisão → Aprovado → Arquivado; conteúdos enviados mantêm versão congelada.
- Futura UI: Biblioteca de Conteúdos compartilhada com abas Mensagens, Mídias, Ofertas e Links; a categoria exata depende de validação com o usuário.
- A campanha seleciona conteúdo aprovado; o Pipeline o utiliza para uma ação específica; não duplicar arquivos no Pipeline.

## 6. Processo da campanha Luedji (exemplo)
1. Campanha mantém público de 861 congelados, 853 elegíveis para contato por e-mail; outros canais têm critérios próprios de elegibilidade.
2. Operador seleciona a mensagem/versão e recursos de mídia da Biblioteca.
3. Define canal e plano de execução, com prévia por destinatário, exclusões, LGPD e opção de oposição.
4. Autoriza ação explicitamente; execução real segue desabilitada até homologação operacional, limites e política de envio.
5. Resend registra aceite/entrega/rejeição nos eventos técnicos.
6. Interações identificáveis alimentam histórico do cliente/campanha; não inferir interesse por entrega/abertura.
7. Atividades humanas e mudança de etapa são guiadas por ocorrências comerciais.
8. Resultados consultam fontes existentes sem recriar indicadores paralelos.

## 7. Fases de homologação sugeridas
F0: validação do modelo conceitual, sem código (ESTE DOCUMENTO).
F1: inventário, organização e metadados dos conteúdos já existentes, sem perda de IDs, sem disparos.
F2: seleção de conteúdo/versão por campanha e prévia de um Plano de Comunicação.
F3: acompanhamento do plano no Pipeline e vínculo por destinatário entre ação e eventos existentes.
F4: regras de resposta/oportunidade e atribuição comercial, com comprovação pelo Histórico de Compras.
F5: autorização, limites, supressão/opt-out, lotes, auditoria e eventual habilitação gradual de envios reais — somente após autorização explícita.

## 8. Decisões pendentes de negócio
- Biblioteca de Conteúdos é compartilhada entre campanhas e utiliza permissões por perfil?
- Aprovação de materiais e direitos de uso, especialmente imagem/vídeo e ofertas.
- Canais prioritários (e-mail primeiro; WhatsApp e redes sociais posteriormente) e regras de rastreabilidade específicas.
- Gatilhos para avanço nas cinco etapas, evitando progressão por simples entrega técnica.
- Regras de atribuição de compras, inclusive quando existem várias campanhas e canais.
- Opt-out, retenção de dados, limites de frequência e governança LGPD.
- Modelo de responsável: atribuir só em oportunidades que necessitem atendimento humano, sem distribuição automática dos 853 clientes.

## 9. Restrições
NÃO alterar funcionalidades homologadas, bancos, leads, mensagens, status, pipeline ou envio durante este desenho; não publicar main. Não habilitar disparo em massa. Qualquer mudança técnica futura exige plano incremental, Preview e homologação.

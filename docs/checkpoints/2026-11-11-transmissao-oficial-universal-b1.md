# Checkpoint B1 — Arquitetura universal de transmissões oficiais (11/11/2026)

## Diretriz
Módulo reutilizável para qualquer campanha e lista congelada; não codificar nomes, destinatários nem regras particulares de Luedji Luna.
Produção em `main` permanece estável. Implementação exclusiva em `preview/transmissao-oficial-universal`.

## Já implementado nesta fase
1. Menu Comercial → Transmissão Oficial · Planejamento (separado da Lista de Homologação).
2. Seleção de qualquer campanha cadastrada e de mensagem vinculada.
3. Leitura paginada da lista congelada, exclusão simulada de e-mails vazios/inválidos, duplicados por endereço normalizado e supressões conhecidas.
4. Indicadores de elegibilidade técnica e matriz de conferências, com bloqueios LGPD/descadastro e limites do provedor ainda não resolvidos.
5. Dimensionamento universal em lotes de 1 a 1000 destinatários, apenas simulado no navegador.
6. Modelagem SQL `cda_transmissoes_oficiais`, `cda_transmissao_lotes`, `cda_transmissao_lote_itens`, `cda_transmissao_auditoria`. Todas as tabelas sem registros, RLS ativada e privilégios de anon/authenticated revogados; `habilitado=false` obrigatório nas entidades de lote e transmissão.
7. Nenhuma API ou Edge Function oficial de criação, autorização ou transmissão foi criada. Executor de homologação não é reutilizado para enviar oficialmente.
8. A lista oficial da campanha Luedji Luna continua congelada com 875 registros, dos quais 867 com e-mail válido; nenhuma mensagem oficial enviada.

## Contratos universais planejados (etapas posteriores; NÃO homologados)
B2. Conciliação de pedidos de oposição, descadastro e demais supressões, distinção de canal de vendas e canal de comunicação, fundamentação e finalidade LGPD, pré-voo auditável.
B3. Preparação persistente de snapshots via função transacional service-role com exclusão comprovada, hash do conteúdo/mensagem, chave de idempotência por item, auditoria.
B4. Autorização administrativa vinculada a usuário, fingerprint, limites, validade curta, revogação e confirmação independente; rate limit e pausa.
B5. Executor oficial isolado do executor de homologação, respeito aos limites do Resend, callbacks verificados, retomada segura, handling de falha/indeterminação/entrega.
B6. Painel operacional de lotes oficiais, estados por destinatário, métricas, download/arquivamento e liberação progressiva. Testes prévios e confirmação explícita para qualquer envio real.
Nunca assumir que validação sintática de e-mail equivale a entregabilidade ou justificativa legal. Nunca atribuir autorização tácita.

## Testes nesta entrega
- Estrutura SQL adicionada no Supabase `gsizoiwefejsllgtsard` por migração aditiva.
- Consulta de integridade: 0 transmissões, 0 lotes, 0 itens, 0 auditorias oficiais; 867 e-mails marcados válidos na campanha 4.
- Sintaxe JavaScript validada, incluindo scripts embutidos da aplicação.
- Próxima ação: homologação visual do painel no Preview. Não fazer merge em `main` antes da aprovação.

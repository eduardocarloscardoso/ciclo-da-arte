# Checkpoint — Pipeline Luedji com 853 clientes de e-mail válido
Data: 09/11/2026. Projeto `eduardocarloscardoso/ciclo-da-arte`, branch `preview/campanha-mensagens`.
Commit funcional `1a9adf4cefcc30d592feff7df9d4f6033732a616`; Vercel Preview READY: https://ciclo-da-arte-5simjzemq-eduardocarloscardosos-projects.vercel.app

## Problema identificado
A lista congelada da campanha Luedji Luna · São Paulo (id=4) continha 861 clientes, mas apenas 853 marcados `email_valido=true`; 8 registros sem e-mail válido foram incluídos indevidamente no Pipeline. O usuário indicou que o Pipeline de e-mail deve incluir somente os elegíveis.

## Correção
- Banco: retirada pontual dos 8 leads inelegíveis e seus 8 registros exclusivamente automáticos de entrada. Pré-checagem confirmou ausência de tarefas, outras interações e mudanças de etapa para esses leads. Lista congelada original permaneceu intacta, com 861 destinatários.
- Migração `cda_pipeline_incluir_somente_email_valido_da_lista_congelada`: RPC `cda_incluir_publico_pipeline_seguro` passa a comparar a seleção com **todos e somente** os destinatários com `email_valido is true` da lista congelada; bloqueia tentativas de incluir inelegíveis. Outras campanhas sem lista congelada não foram alteradas.
- Frontend: Campanhas → Execução → Adicionar público ao Pipeline filtra a lista congelada por `email_valido===true`, e o modal mostra explicitamente total congelado, excluídos por email inválido/ausente, e elegíveis.

## Verificações
Supabase após correção: 853 leads na campanha, 853 destinatários com e-mail válido, 8 inválidos/ausentes na lista, 853 registros de entrada no histórico, zero inelegíveis no Pipeline, zero pares duplicados. Vercel READY.

## Precisão terminológica
`email_valido=true` comprova apenas validade cadastral segundo a regra do CRM. Não é confirmação de entrega pelo provedor, nem verificação de caixa postal individual. Webhook Resend confirmou apenas entrega de mensagem de teste, não dos destinatários da campanha.

## Pendente
Homologação visual no Preview do Pipeline B2C e da prévia em Campanhas, sem efetuar novo envio em massa.

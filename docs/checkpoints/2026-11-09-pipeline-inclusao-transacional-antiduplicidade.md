# Checkpoint — Inclusão transacional de público no Pipeline B2C
Data: 09/11/2026. Projeto Ciclo da Arte CRM/ERP.
GitHub: `eduardocarloscardoso/ciclo-da-arte` branch `preview/campanha-mensagens` (NÃO realizar merge em main sem aprovação).
Commit funcional e cache-bust: `859fc7eb62c6d34371812d1dfe40a17243f08d1e`.
Vercel Preview READY: https://ciclo-da-arte-7xxh4fb6h-eduardocarloscardosos-projects.vercel.app
Supabase compartilhado com produção: `gsizoiwefejsllgtsard`.

## Auditoria anterior
- 286 leads existentes, 286 com cliente e campanha; zero pares duplicados `(campanha_id,cliente_id)`; sem clientes vinculados inexistentes.
- Luedji Luna id 4: lista congelada 861 IDs distintos, 0 leads; 2 tentativas Resend e 1 evento entregue.
- A inclusão anterior consultava duplicados no browser e fazia 2 inserts separados, passíveis de corrida e histórico sem sincronia em falhas parciais.

## Banco — migração aplicada
- `cda_pipeline_b2c_importacao_atomica_unicidade_por_campanha_cliente`: índice único parcial `uq_leads_b2c_campanha_cliente` em `(campanha_id,cliente_id)` para valores não nulos. Clientes podem continuar existindo em campanhas distintas.
- RPC `public.cda_incluir_publico_pipeline_seguro(p_campanha_id bigint,p_cliente_ids bigint[],p_usuario text)` SECURITY INVOKER, EXECUTE apenas authenticated e checagem adicional `auth.uid()` + `cda_e_membro_equipe()`.
- Rejeita IDs repetidos/inválidos, clientes com cadastro incompleto ou inexistentes, campanha inexistente/encerrada, etapa inválida e seleção diferente dos destinatários congelados quando há lista congelada.
- `INSERT ... ON CONFLICT DO NOTHING` retorna apenas leads novos; gera um evento de entrada em `cda_historico_interacoes` por lead dentro da mesma transação. Se falhar o evento, todo o lote é revertido.
- Permite inclusão normal de um mesmo cliente em campanhas diferentes.

## Frontend — alteração apenas na branch Preview
- `cda-dados-compartilhados.js`: substitui gravação dupla do browser por chamada única `cdaClient.rpc('cda_incluir_publico_pipeline_seguro', ...)`; valida formato da resposta.
- `index.html`: atualiza versão do JS para invalidar cache.
- Prévia e confirmação existente em Campanhas → Execução → Adicionar público ao Pipeline continuam obrigatórias; nenhum lead incluído automaticamente.

## Verificações
- Banco: índice e RPC presentes; authenticated tem permissão de executar RPC, anon não; 286 leads persistentes, 0 duplicados; 0 leads Luedji, 861 congelados; histórico de interações continua com 298 registros.
- JS validado sintaticamente e Vercel READY.
- **Pendente:** homologação prática do fluxo pela UI autenticada. Não foi executada inclusão real devido ao banco compartilhado com produção e ao requisito de confirmação do operador.
- Nota: a migração de índice e RPC ocorreu no Supabase compartilhado (ambiente vivo), sem modificar dados existentes; frontend atualizado somente no Preview, branch main não alterada.

# Checkpoint — Comparativo de Canais de Vendas nos Clientes

**Data:** 09/11/2026
**GitHub:** `eduardocarloscardoso/ciclo-da-arte`
**Branch:** `preview/campanha-mensagens`
**Commit funcional:** `2e979c1ed784b43545d47a00223ad58ebc889f5a`
**Vercel Preview READY:** https://ciclo-da-arte-accj15vfg-eduardocarloscardosos-projects.vercel.app

## Mudança
- No modal `Comercial → Clientes → Editar Cliente`, abaixo de **Collabs / Canais Vinculados**, foi incluído um painel comparativo de leitura.
- O painel separa **Canais vinculados ao cadastro** (`cliente_canal`) e **Canais com compras** (`compras.canal_id`).
- Mostra canais somente no Histórico de Compras e vínculos sem compras registradas, além da contagem de compras por canal.
- A consulta é sob demanda ao abrir cliente existente, paginada em lotes de até 1000 linhas, somente leitura. Erros de consulta são mostrados no próprio painel.
- O painel compara os vínculos atualmente exibidos no formulário; caso alterados e ainda não salvos, a observação comunica isso claramente.
- Não houve sincronização, alteração de tabelas, gravação de vínculo ou modificação de compras.
- Não altera segmentação/campanhas. Lista congelada de Luedji Luna preservada com 861 destinatários.

## Validações
- JavaScript validado sintaticamente.
- Commit no Preview e deployment Vercel READY.
- Supabase base intacta: 6608 clientes, 10895 compras, 4134 vínculos; lista da campanha Luedji Luna 861.
- Validação visual/funcional do usuário **pendente**.

## Próximos passos
- Homologar no navegador: Comercial → Clientes → localizar um cliente com compras → Editar → conferir os dois grupos e diferenças; fechar sem salvar.
- Não reconciliar automaticamente os vínculos sem definição de negócio: o canal cadastrado pode representar relacionamento comercial sem compra.

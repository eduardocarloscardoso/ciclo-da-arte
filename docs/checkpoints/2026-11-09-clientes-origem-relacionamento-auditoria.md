# Diagnóstico somente leitura — Origem do Relacionamento Comercial (09/11/2026)

**Projeto:** Ciclo da Arte CRM/ERP
**Branch:** `preview/campanha-mensagens`
**Supabase:** `gsizoiwefejsllgtsard`
**Natureza:** auditoria sem alterações de dados, tabelas ou interface.

## Conceitos homologados
- No Histórico de Compras, **Vendedor = Canal de Vendas**.
- Toda compra tem `compras.canal_id` com chave estrangeira válida para `canais.id`.
- Um mesmo cliente pode comprar em vários canais.
- Segmentação já oferece filtro específico “Comprou pelo menos 1x no canal”, além de Plano de Contas.
- A interface duplicada “Canais de Vendas da Campanha” foi retirada e usuário homologou a restauração.

## Campos já existentes
- `clientes.origem`: campo texto (“Origem”) no formulário Clientes.
- `clientes.origem_dados`: seleção “Origem dos Dados”; opções no frontend: Loja Integrada, ERP Bling, Pesquisa de Mercado, Outros.
- `clientes.responsavel_comercial`: presente, sem preenchimentos.
- `cliente_canal(cliente_id, canal_id)`: relacionamento N:N, gerenciado manualmente no formulário de Clientes.
- `compras(cliente_id, canal_id)`: relacionamento transacional do Histórico de Compras.

## Levantamento (base consultada em 09/11/2026)
- `clientes`: 6.608 registros; `origem` preenchida 405; `origem_dados` preenchida 4.976; `responsavel_comercial` preenchido 0.
- `origem_dados`: ERP Bling 4.952; importacao_bling_relatorio 18; Loja Integrada 6; sem informação 1.632.
- `origem`: vazia 6.203; os preenchidos são sobretudo marcas da importação ERP Bling por ano, mais relatório Bling e um registro Site. **Não presumir que o campo `origem` seja origem real de relacionamento.**
- `compras` contém 10.895 registros, todos com canal referenciado; 36 canais distintos em compras.
- `canais` possui 36 B2C e 7 B2B, conforme `escopo`.
- `cliente_canal`: 4.134 pares em 4.132 clientes; apenas 1 cliente consta com vínculos para mais de um canal na tabela manual.
- Pares cliente–canal distintos inferidos das compras: 5.590; 386 clientes têm compras em múltiplos canais (contagem calculada por pares nesta consulta).
- **1.851 pares compra cliente–canal não constam em `cliente_canal`**.
- **395 pares em `cliente_canal` não têm compra correspondente**. Esses vínculos podem ser relacionamentos legítimos sem compras e NÃO devem ser eliminados por inferência.

## Conclusões e próximo passo proposto
1. **Não** criar novos campos de origem de relacionamento ou outra tabela cliente–canal antes de definir semântica dos campos e origens existentes.
2. Preservar `origem_dados` como proveniência técnica/importação; `origem` foi usado majoritariamente para registrar importação, não como evidência de canal de aquisição original.
3. **Não** sincronizar automaticamente `cliente_canal` com compras sem decisão de negócio, porque os dois vínculos podem refletir fatos diferentes (relacionamento atribuído vs. compra realizada).
4. Projetar uma visualização somente leitura de “Canais com compras” ao lado dos “Canais vinculados” em Clientes, com contagem das divergências, antes de propor eventual reconciliação.
5. Ao definir Origem do Relacionamento, especificar se ela é informada manualmente, registrada pelo primeiro contato ou inferida da primeira compra, distinguindo fonte e nível de confiança.
6. A lista de envio em massa continua desabilitada; não alterar a lista congelada Luedji Luna.

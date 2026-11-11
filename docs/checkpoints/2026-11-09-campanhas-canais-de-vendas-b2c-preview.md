# Checkpoint — Canais de Vendas nas Campanhas (09/11/2026)

## Escopo técnico
- GitHub: `eduardocarloscardoso/ciclo-da-arte`
- Branch: `preview/campanha-mensagens` (não mexer em `main` sem autorização).
- Commit funcional: `0d73d9b5ed1fc6324f856283d001ff3a83204377`
- Vercel READY: https://ciclo-da-arte-mcfb4z9um-eduardocarloscardosos-projects.vercel.app
- Supabase: `gsizoiwefejsllgtsard`.

## Decisões de negócio
- Campo Vendedor no histórico das compras é o Canal de Vendas; `compras.canal_id` possui FK para `canais.id`.
- Um cliente pode ter compras em vários canais; campanha pode contemplar vários canais, sem duplicar cliente.
- O filtro comercial deve ser diferente dos meios de comunicação do Roteiro de Canais (e-mail, WhatsApp etc.).
- Todos os Canais inclui quem não possui compras, sujeito aos demais filtros comerciais/segmentação. Com canais escolhidos exige compra em pelo menos um deles.
- O contexto atual é B2C; cadastro Financeiro contém 36 canais B2C e 7 B2B.

## Implementado
- Coluna opcional por semântica `cda_campanhas.canais_vendas_ids bigint[] not null default '{}'`: array vazio = Todos os Canais.
- `cda-dados-compartilhados.js`: fromRow/toRow da seleção de IDs, independente de `canais_selecionados`.
- `cda-modulo-campanhas.js`: múltipla seleção de Canais B2C do Financeiro no formulário de campanhas, com caixa Todos os Canais, preservação ao editar/duplicar, verificação na gravação, contagem de público, card de campanha, congelamento e adição ao Pipeline se ainda não congelada. Operador OU entre canais; E com demais filtros.
- Motor `cdaMotorSegmento` existente reutilizado, inclusive filtro `canal` e os dados de compras. Nenhuma tabela de vínculo cliente-canal criada, pois a relação já é histórica por compra.
- O registro da campanha Luedji Luna manteve o padrão Todos os Canais e sua lista congelada original de 861 destinatários não foi modificada.
- JavaScript sintaticamente válido, Supabase verificado e Vercel READY.

## Validação do usuário pendente
- Editar uma campanha, identificar a seção Canais de Vendas, desmarcar Todos, selecionar dois canais B2C e observar o público; cancelar sem salvar para manter Luedji Luna.
- A atualização dos canais não altera listas previamente congeladas até o comando explícito Recongelar Lista.
- Envio em massa permanece indisponível.

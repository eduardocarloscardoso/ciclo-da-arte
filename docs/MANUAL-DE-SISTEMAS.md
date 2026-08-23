# Manual de Sistemas — Ciclo da Arte CRM/ERP

> **Público:** desenvolvedores (humanos ou Claude, em sessões futuras). Não é
> documentação de uso — para isso existe o Tutorial dentro de cada módulo do
> sistema (aba "Tutorial", só leitura para usuário final, exportável em Word).
>
> **Propósito:** registrar o *porquê* de decisões de arquitetura e convenções
> de banco que não são óbvias só lendo o código, para que qualquer sessão
> nova (minha ou de outro dev) não precise reconstruir esse contexto do zero
> por tentativa e erro. Atualizado quando uma decisão estrutural relevante
> muda — não é changelog de toda alteração pequena.

---

## 1. Arquitetura geral

- **Hub único:** `index.html` é a única página real do sistema logado. Todo
  submódulo (`cda-modulo-*.js`) é um arquivo JS separado, carregado como
  `<script>` no mesmo `index.html` e montado dentro de uma `<div>` via função
  `montarModulo*(containerId, opts)`. Não existem mais páginas HTML separadas
  por módulo (`comercial.html`/`financeiro.html` foram descontinuadas — hoje
  só restam como iframe legado para Prestação de Contas/Cardápios/Importar
  Planilha, que ainda vivem em `financeiro.html`).
- **Backend:** Supabase (projeto `gsizoiwefejsllgtsard`), acesso via cliente
  JS (`cdaClient`, chave anon) para a maior parte das operações, e via MCP
  `execute_sql`/`apply_migration` para tarefas administrativas/migrações.
- **Deploy:** GitHub (`eduardocarloscardoso/ciclo-da-arte`) → Vercel
  (deploy automático no push para `main`).
- **Módulos JS compartilhados** entre Comercial e Financeiro (mesma base de
  dados, mesma UI): `cda-modulo-clientes.js`, `cda-modulo-compras.js`,
  `cda-modulo-produtos.js`, `cda-modulo-segmentacao.js`. Todos aceitam
  `opts.editavel` para controlar se a UI de gravação aparece.

## 2. Fluxo de trabalho obrigatório (regra do usuário, não negociável)

1. **Nunca alterar sem entender o estado atual** — sempre `view`/`grep` o
   arquivo antes de editar, mesmo que a memória "lembre" do conteúdo.
2. **Backup antes de qualquer alteração** — copiar o(s) arquivo(s) para
   `backups/` (nome com timestamp) e comitar isso *antes* de aplicar a
   mudança de verdade.
3. **Nunca alterar schema sem checar impacto no frontend, nem construir
   frontend sem checar o estado do backend primeiro.**
4. **Diff pós-deploy** — depois do push, buscar o arquivo cru do GitHub
   (`raw.githubusercontent.com/{sha}/{arquivo}`) e comparar com a versão
   local, para confirmar que subiu exatamente o que devia.
5. Migrações SQL grandes: gerar `.sql` completo (não aplicar em pedaços na
   conversa) e, se o usuário for aplicar manualmente em algum momento,
   preferir um `.html` utilitário com botão "Copiar SQL Completo".

## 3. Permissões (mecanismo central, aplicado hoje só no Comercial)

Dois níveis independentes, ambos configurados em Credenciamento → aba do
colaborador → "Permissões por Submódulo":

- **Visibilidade** — `podeVerSubmodulo(projeto, slug)`. Decide se o item
  aparece no menu lateral.
- **Gravação** — `podeEscreverSubmodulo(projeto, slug)`. Decide se a UI de
  criar/editar/excluir/importar/exportar aparece dentro do submódulo. Não
  existia até ago/2026 — antes só havia o flag global `isReadOnly()`.

Ambas as funções vivem em `index.html` e consultam a mesma estrutura em
memória `CU_PERMISSOES_SUBMODULO`, carregada de duas tabelas:

- `cda_permissoes_catalogo` — lista fixa de submódulos por projeto (a fonte
  da verdade de "quais submódulos existem"). **Todo módulo deve terminar com
  um submódulo de slug relacionado a Tutorial, sempre por último em `ordem`.**
- `cda_equipe_permissoes` — nível (`desabilitado` / `leitura` /
  `leitura_escrita`) por colaborador × submódulo.

**Regra de fallback (rede de segurança) — importante para não travar acesso
por esquecimento:**
- Projeto sem *nenhuma* linha configurada para o colaborador → tudo visível
  e gravável (comportamento pré-permissões, preservado).
- Projeto *com* linhas configuradas, mas faltando a linha de um submódulo
  específico (ex: um submódulo novo foi criado depois) → esse submódulo
  específico fica **negado** por padrão. É por isso que, ao criar um
  submódulo novo num projeto que colaboradores já têm configurado, é preciso
  rodar um INSERT de seed dando `leitura_escrita` para quem já tinha alguma
  config naquele projeto — feito manualmente ao adicionar os Tutoriais de
  Financeiro/Estoque em ago/2026 (ver `cda_equipe_permissoes`).

**Padrão de implementação em cada submódulo:** `opts.editavel` (boolean,
default `true` para retrocompatibilidade). O hub calcula o valor certo em
`navigateCRM()` e passa para a função de montagem. Dentro do módulo, todo
elemento de gravação — inclusive Importar/Exportar XLSX — é condicionado a
essa flag, tanto na renderização (`(editavel ? '<button>...' : '')`) quanto
no listener (`if (editavel) host.querySelector(...).addEventListener(...)`).

**Marketing é exceção deliberada:** usa um sistema de permissão por
papel/cargo (`RC[cu.role]`) muito mais antigo, que não consulta
`podeVerSubmodulo`/`podeEscreverSubmodulo`. Não foi unificado porque o
módulo Marketing atual (na verdade um roadmap de pendências gerais da
empresa, não um sistema de marketing de verdade) será substituído por outro
módulo ainda a ser desenhado — não vale investir em unificar uma arquitetura
que vai ser descartada.

## 4. Convenções de schema não óbvias (Comercial)

| Campo | Armadilha |
|---|---|
| `clientes.situacao_legado_desativado` | O nome real da coluna no banco. **Não existe** coluna `situacao` (apesar do texto "Situação" na UI e do nome usado em variáveis JS). Causou um bug real (erro 401/"could not find column" ao salvar cliente) até ser corrigido em `CDA_CLIENTE_MAP` — qualquer novo mapeamento de cliente precisa usar o nome real da coluna. |
| `clientes.tipo_comercial` | Convenção de valores: `null`/vazio = já convertido (comprou), `'lead_b2c'` = em prospecção, `'canal_b2b'` = revenda/atacado (excluído do Pipeline B2C e da Segmentação), `'artista'`/`'imprensa'` = outros. |
| `compras.produto` vs `compras.produto_id` | `produto` é texto solto da importação, frequentemente **vazio** em registros importados do Bling. `produto_id` (FK para `produtos`) é a fonte confiável. Toda UI que mostra nome de produto deve resolver primeiro por `produto_id`, caindo no texto solto só como último recurso — bug real corrigido no Pipeline B2C em ago/2026 (só tinha o fallback, nunca tentava o join). |
| `cda_parametros_segmentacao.valor_gold` | Faixa intermediária entre Premium e VIP. No modo Automático é sempre a média exata dos outros dois (recalculado pela função `cda_executar_recalculo_valores`); no modo Manual é editável livremente pelo usuário (não travado à média, apesar do nome sugerir isso — decisão explícita do usuário). |
| `cda_status_crm` | Tabela genérica de "rótulos com cor" reaproveitada para dois `tipo` diferentes: `'segmentacao'` (Lead/Ativo/Em Risco/Premium/Gold/VIP...) e `'pipeline_resultado'` (resultados de cada etapa do Pipeline). Cuidado ao filtrar — sempre incluir o `tipo` na query. |
| Importação de compras cria produto automaticamente | Se o produto da planilha não bate com nenhum cadastro, `cda-modulo-compras.js` cria um registro em `produtos` na hora (classificando tipo de peça pelo nome via `cdaClassificarTipoPeca`), para não perder o vínculo `produto_id`. Pode gerar duplicatas de nome se a grafia variar entre importações — não há dedupe automático hoje. |
| Importação de planilha (Financeiro) — colunas invertidas | Na planilha de origem (Bling/Loja Integrada), a coluna **"Vendedor"** é interpretada como o **Canal de Venda** de fato; a coluna **"Canal de Venda"** da planilha vira `origem_dados` (metadado de proveniência, não o canal real). "Vendedor" em branco cai no canal padrão "Vendas sem vendedor". Terminologia da planilha de origem não bate com a terminologia interna — fonte comum de confusão ao auditar uma importação. |
| `prestacoes.saldo_anterior` | Propaga automaticamente do saldo da prestação anterior fechada do mesmo Collab (positivo = credor, negativo = devedor) — é um valor calculado/copiado, não editável às cegas; UI trava edição quando `status_prest === 'finalizado'`. |
| `canais.sem_frete` | Flag por canal que remove o frete do cálculo de Líquido na Prestação de Contas daquele canal — não é global, é por canal individual. |

## 5. Decisões de negócio (o "porquê", não só o "como")

- **Diversos (~21% da receita) usa "Opção A"** — participação percentual
  sempre calculada com todos os canais somados, para estabilidade
  estatística; quantidade estimada usa o preço médio real por tipo de peça
  (não o campo de quantidade, que é pouco confiável nesses registros).
- **Private Label é excluído de toda análise de Estoque/Vendas** — é
  atacado/revenda, distorceria os números de venda direta ao consumidor.
- **Toda movimentação de etapa no Pipeline B2C exige confirmação com
  resultado** — arrastar um card não move direto; existe um modal
  intermediário. Decisão para garantir que todo avanço de etapa fique com
  motivo registrado no histórico de interações, não só a data.
- **Campanhas recalculam o público toda vez que "Adicionar público" é
  clicado** — não é uma lista congelada no momento da criação da campanha.
  Evita trabalho manual de reconciliar quem entrou depois, mas também
  significa que quem já foi adicionado antes precisa ser filtrado
  explicitamente para não duplicar (verificado por `cliente_id` já existente
  com aquela `campanha_id`).
- **Prestação de Contas é agrupada por Collab/Artista, não por canal
  individual** — se um artista vende por loja própria e por revenda, as duas
  entram na mesma prestação (uma seção por canal dentro dela), porque o
  acerto financeiro é feito com a pessoa, não com o canal isoladamente.
- **Líquido = Bruto − Desconto + Frete**, com frete zerado quando o canal
  tem a flag `sem_frete` — regra fixa usada em toda prestação, não
  configurável por prestação individual (só por canal).
- **Estoque/Vendas exclui Private Label e canais B2B da análise B2C** —
  mesma lógica de exclusão do Comercial, aplicada de forma consistente em
  todo relatório de vendas por tipo de peça/canal.

## 7. Tutorial in-app é multi-módulo desde ago/2026

`cda-modulo-tutorial.js` tem um único array `CDA_TUTORIAL_CONTEUDO`
compartilhado entre Comercial e Financeiro — cada seção carrega uma tag
`modulos: ['comercial', 'financeiro']` (ou só um dos dois) e a função
`montarModuloTutorial(containerId, {modulo: '...'})` filtra o que aparece
(nav, corpo, exportação em Word) por esse valor. Seções de cadastro
compartilhado (Clientes, Compras, Produtos, Segmentação) aparecem nos dois
módulos; o resto é específico. **Ao adicionar uma seção nova, sempre incluir
a tag `modulos` — sem ela o filtro quebra (`.indexOf` em `undefined`).**

## 6. Índice de decisões por data (para achar contexto de uma mudança específica)

- **jul–ago/2026** — Consolidação `comercial.html`/`financeiro.html` →
  `index.html` único; Pipeline B2C (kanban + confirmação de movimentação);
  Segmentação com filtros combináveis; imports históricos do Bling
  (2022–2024).
- **ago/2026** — Módulo Estoque (sales-by-piece-type, planejamento de
  compras); faixa Gold na Segmentação; permissões granulares por submódulo
  (visibilidade + gravação) aplicadas no Comercial; marcação de cliente como
  Canal B2B direto do Pipeline; edição real de tarefas (não só criar);
  Tutorial adicionado a todos os módulos como último submódulo; correção do
  bug de nome de produto no Pipeline; correção do bug de coluna `situacao`
  inexistente; Tutorial in-app tornado multi-módulo (Comercial + Financeiro
  compartilhando o mesmo mecanismo, seções tageadas por `modulos`); Prestação
  por Período (consolidação multi-mês) adicionada em `financeiro.html`; duas
  Edge Functions de leitura/patch do GitHub criadas para permitir que sessões
  futuras leiam e editem o repositório sem depender do usuário informar nomes
  de arquivo (`github-listar-arquivos`, `patch-github`).

## 8. Prestação por Período (consolidação multi-mês) — ago/2026

Funções em `financeiro.html`: `abrirModalPeriodo()` → `gerarPrestacaoPeriodo(cvId,
mesIni, mesFim)` → `renderizarPeriodoPDF(d)`. Botão "📅 Prestação por Período"
na tela de Prestações (`rPrestList`).

- **Não persiste nada no banco** — é 100% derivado das prestações mensais já
  gravadas em `prestacoes`, filtradas por `cv_id` (= parceiro_id/Collab).
- **Nunca confia cegamente no `saldo_anterior` gravado** — esse campo só é
  recalculado quando alguém abre a tela daquele mês (`verPrest`), então meses
  importados/nunca abertos podem estar com o valor desatualizado. A função
  recalcula a cadeia inteira (todos os meses do collab, não só o período
  pedido) replicando a fórmula de `calcSaldoAnterior`: `saldoMensal = com +
  saldoAnterior`, encadeando mês a mês e zerando sempre que um mês tiver
  pagamento registrado (`dt_pgto` + `vl_pgto` != 0).
- **Comissão Mensal Final Devida = saldoMensal + outros_descontos** — mas
  `outros_descontos` NÃO entra na cadeia que propaga para o mês seguinte
  (só afeta o total daquele mês específico).
- **Saldo Final do Período** = a Comissão Mensal Final Devida do último mês
  do período (0 se esse último mês já tiver sido pago).
- Tabela "Resumo por Canal" agrupa por Mês Referência + Canal (uma linha por
  seção de cada mês), com totalizador geral no fim — mesmo padrão pedido para
  virar futuramente coluna padrão na prestação mensal (ainda não feito).

*(Para o histórico completo, dia a dia, ver as memórias de conversas —
este documento é o resumo estrutural, não o log.)*

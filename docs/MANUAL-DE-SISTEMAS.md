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
2. **Backup antes de qualquer alteração** — o backup dos arquivos é o
   **histórico do Git**: confirmar que o estado atual está comitado antes de
   alterar, e fazer cada mudança em commit próprio (qualquer versão é
   recuperável com `git show <commit>:<arquivo>`). A pasta `backups/` foi
   extinta em 22/10/2026 (duplicava o Git e ia junto para o site publicado).
   Para **dados** do banco, tabela de backup temporária antes de correções
   em massa, apagada após a validação.
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

## 9. Planejamento Anual (PROJETO 6) — out/2026

Módulo independente migrado do Manus ("Sistema Orçamentário Anual", commit
`d0d1eadc`). Antes era o SM-03 dentro do Financeiro. Arquivo
`cda-modulo-planejamento.js` (funções com prefixo `pa`), chave de projeto
`planejamento_anual` em `PROJETOS` (aparece no Credenciamento).

- **Tabelas `cda_pa_*`** (RLS pela tabela `equipe`, mesmo padrão de
  `cda_orc_*`): `conta` → `subconta` → `centro_custo`;
  `orcamento_previsto` (ano, centro); `realizado_mensal` (ano, mês 1–12,
  centro, `origem` manual/excel/migracao_manus/bling); `provisao` (ano,
  centro — era o "mês 13" no Manus, pode ser negativa);
  `realizado_anual_legado` (anos sem detalhe mensal, ex. 2025);
  `alias_importacao` (nomes alternativos da planilha → centro).
  Exclusão só admin; leitura/gravação para `is_admin` ou projeto
  `planejamento_anual` com `permissao = leitura_escrita`.
- **Views**: `cda_pa_v_hierarquia`, `cda_pa_v_realizado_anual` (mensal ou
  legado), `cda_pa_v_resumo_anual`. **Função** `cda_pa_ultimo_mes_realizado(ano)`
  = primeiro mês sem lançamento − 1.
- **Regras de negócio**: Previsto Mês = Previsto Anual ÷ 12; Saldo Total a
  Realizar = Previsto − (Realizado + Provisão); Saldo Mensal = saldo ÷
  (12 − último mês realizado) — decisão de out/2026, diferente do Manus,
  que usava o mês do calendário; status/cores invertidos entre Receitas e
  Despesas.
- **Importação mensal** (`cda_pa_importar_mes`, transação única no banco):
  aba com "Receita"/"Despesa" no nome; layout Centro|Valor ou
  Vendedor…Total Venda; apelido tem prioridade sobre o nome; subtotais
  (nomes de subconta, "Despesas X") ignorados; valores do mesmo centro
  somados; **se qualquer centro não for encontrado, nada é gravado**; a
  planilha substitui o mês inteiro daquela conta. `cda_pa_limpar_periodo`
  é só admin.
- **Totais de controle da migração** (conferidos centavo a centavo em
  22/10/2026): Previsto 2026 R 1.293.000,00 / D 1.564.500,00; Realizado
  jan–set/2026 R 1.019.152,00 / D 1.157.396,09; Realizado 2025 R
  2.130.998,09 / D 2.144.550,48; Provisão D 7.800,00.
- **No ar (22/10/2026)**: Tabelas Contábeis (+ apelidos), Orçamento Anual,
  Orçamento Realizado (+ importação e limpeza), Provisão Prevista, Previsto
  vs. Realizado (Comparativo Mensal com "Total Meses", Visão Trimestral
  Acumulada, Visão Anual Acumulada, Comparativo de Metas com filtro de
  status) e Tutorial. Sidebar: Planejamento Anual é o 1º projeto; submenu na
  ordem do Manus, sem "Início".
- **Decisões que diferem do Manus**: (1) meses restantes = 12 − último mês
  realizado; (2) Provisão "Auto" grava Previsto − Realizado (no Manus gravava
  o saldo já líquido da provisão, e clicar duas vezes alternava o valor);
  (3) apelidos de importação viraram tabela editável (no Manus eram fixos no
  código). Painéis consideram só cadastros ativos, como no Manus.
- **Orçamento Anual — edição**: Previsto do exercício e Realizado do ano
  anterior editáveis na linha (campos com borda dourada ✏️) e por **Importar
  Excel** (layout Manus: A Tipo · B Subconta · C Centro · D Realizado ano
  anterior · E Previsto; linhas não encontradas ou de tipo diferente são
  ignoradas e listadas). O Realizado do ano anterior só é editável quando
  aquele ano não tem lançamentos mensais (ex.: 2025); o Realizado do
  exercício não é editado aqui — é a soma dos meses e funciona como atalho
  para o Orçamento Realizado (decisão do Cardoso, 22/10/2026).
- **Orçamento Anual — colunas** (22/10/2026, pedido do Cardoso): Realizado
  ano anterior · Previsto · Previsto Mês · Realizado · **Saldo Total sem
  Provisão** (Previsto − Realizado) · **Saldo Total com Provisão** (Previsto −
  (Realizado + Provisão)), preenchido **só onde há provisão** (centro com
  provisão ≠ 0, e as subcontas/contas/totais que os contêm; demais em branco).
  O Saldo Mensal a Realizar saiu desta tela (segue
  nos painéis e na Provisão). Layout compacto (`.pa-compacta`).
- **Comparativo Mensal** (23/10/2026, regra do Cardoso): **sempre parte do
  último Orçamento Realizado lançado, mesmo parcial**. Coluna **Total
  Realizado** = Realizado acumulado (jan até o último mês realizado) +
  Provisão Prevista (substitui "Saldo Total a Real."); **Saldo Mensal a
  Real.** = (Previsto Ano − Total Realizado) ÷ (12 − último mês realizado).
  Essas duas colunas não mudam com o mês filtrado; o filtro de mês vale só
  para Previsto Mês, Realizado, Variação e Status.
- **Visão Trimestral Acumulada** (23/10/2026, pedido do Cardoso): cartões
  "Total Receitas / Despesas / Resultado **até o nºT**" — Previsto = Prev.
  Mês × meses até o fim do trimestre; Realizado = jan até o fim do
  trimestre. Colunas: Prev. Ano · Prev. Mês · 3 meses · **Total Trimestral**
  (soma dos 3 meses) · **Total Real. até o nºT** (jan até o fim do
  trimestre) · **Média Mensal Realizada Acum.** = Total Real. até o nºT ÷
  mín(3 × n, último mês realizado) — ex.: 4ºT com outubro lançado ÷ 10;
  vermelho quando Receitas abaixo ou Despesas acima do Prev. Mês. Saíram
  Provisão Prev., Saldo Total a Real. e Saldo Mensal a Real.
- **Tutorial Informativo**: botão ℹ️ na linha de filtros dos 4 painéis
  Previsto vs. Realizado; popup explica cada coluna, finalidade e fórmula
  (conteúdo em `PA_TUT` no módulo — atualizar junto com qualquer mudança de
  cálculo).
- **Status**: Comparativo Mensal OK ≤10% · Atenção 10–30% · Crítico >30%;
  Comparativo de Metas (desvio vs. Previsto Mês × meses até o último
  realizado — mesma regra para todos os centros desde 23/10/2026; Proj.
  Mensal = Saldo ÷ meses restantes) OK
  favorável · Atenção ≤10% · Crítico ≤20% · Intervenção >20% · Sem Dados.
- SQL de estrutura em `docs/sql/planejamento_anual_*.sql` (os dados
  financeiros não ficam no repositório).

## 11. Memória da última tela — out/2026

`cda-memoria-tela.js` (carregado no fim do `index.html`, depois do script
principal) envolve as funções de navegação (`openProject`, `navigateCRM`,
`navigateMkt`, `navigate`, `navigateOrcamento`, `navigatePlanejamento`) e grava
no `localStorage` do navegador, por e-mail do usuário, a última tela aberta.
`initApp()` (agora disparado em `DOMContentLoaded`) chama `cdaRestaurarTela()`
após restaurar a sessão: F5 / Ctrl+Shift+R volta ao mesmo módulo/submódulo.
No Planejamento Anual também restaura os filtros (`paEstado`). Respeita as
permissões atuais (não reabre tela de admin para quem deixou de ser admin).
Ao criar uma nova função de navegação no hub, incluí-la em `FUNCOES`.

## 10. Segurança do banco e das Edge Functions — out/2026

- **RLS em todas as tabelas do schema `public`** (22/10/2026: 0 tabelas sem
  RLS). Tabelas de Marketing/Comercial (`cda_marketing_*`, `cda_campanhas`,
  `cda_tarefas`, `cda_historico_interacoes`, `cda_status_crm`,
  `cda_parametros_segmentacao`, `cda_tutorial_comentarios`): política
  `membros_equipe` (qualquer e-mail cadastrado em `equipe`, logado). Tabelas
  de permissão (`cda_permissoes_catalogo`, `cda_equipe_permissoes`): leitura
  para membros, gravação só admin. Funções auxiliares:
  `cda_e_membro_equipe()`, `cda_e_admin_equipe()`.
- **Backups antigos** (22 tabelas `*_backup_*` de jul–ago/2026) foram
  **apagados** em 22/10/2026 por decisão do Cardoso: correções já validadas
  há meses, e as cópias guardavam dados pessoais sem uso. Sugestão (a confirmar):
  backup antes de toda correção continua obrigatório, mas é descartado após
  ~30 dias validado. Atenção: o projeto está no plano FREE do Supabase (sem
  backups automáticos do banco).
- **Edge Functions chamadas pelo sistema** (`sync-meta-ads`,
  `diagnostico-marketing`, `simular-marketing`, `exportar-excel`,
  `gerar-modelo-mensagem`): exigem o token de sessão de um membro da
  `equipe` (função `exigirMembroEquipe`); a chave pública não basta. O
  frontend envia `sb.headers.Authorization` (Marketing usa
  `cdaMktHeadersFuncao()`). Código-fonte versionado em `docs/edge-functions/`.
- Funções do GitHub (`deploy-github`, `read-github`, `patch-github`,
  `github-listar-arquivos`) são protegidas por `x-deploy-secret`.
- Funções avulsas de importação/teste do Meta (`test-meta-token`,
  `import-meta-recentes`, `import-meta-completo`, `backfill-meta-mensal`,
  `backfill-tipo-orcamento`) foram **desativadas** em 22/10/2026: código
  antigo apagado, respondem 410 a qualquer chamada. Podem ser excluídas de
  vez no painel do Supabase (Edge Functions).

*(Para o histórico completo, dia a dia, ver as memórias de conversas —
este documento é o resumo estrutural, não o log.)*

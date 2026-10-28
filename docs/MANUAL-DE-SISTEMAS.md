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
  trimestre. Colunas: Prev. Ano · Prev. Mês · 3 meses · **Prev. Tri** (Prev. Mês ×
  3) · **Total Trimestral** (soma dos 3 meses; verde/vermelho vs Prev. Tri) · **Total Real. até o nºT** (jan até o fim do
  trimestre) · **Média Mensal Realizada Acum.** = Total Real. até o nºT ÷
  mín(3 × n, último mês realizado) — ex.: 4ºT com outubro lançado ÷ 10;
  vermelho quando Receitas abaixo ou Despesas acima do Prev. Mês. Saíram
  Provisão Prev., Saldo Total a Real. e Saldo Mensal a Real. Tabela sem "R$"
  nas células (classe `.pa-estreita`) para caber em telas de 1366 px.
- **Rótulo** (23/10/2026): no Comparativo Mensal e na Visão Anual a coluna
  "Saldo Mensal a Real." passou a se chamar **Saldo Mensal Anual pendente a
  Real.** (mesmo cálculo).
- **Visão Anual Acumulada — colunas** (23/10/2026): Prev. Anual · Total Real. ·
  Provisão Prev. · **Total Real. com Prov.** (Total Real. + Provisão) · % Exec.
  (Total Real. ÷ Prev. Anual, sem provisão) · Saldo Total a Real. · Saldo
  Mensal Anual pendente a Real. Tabela compacta sem "R$" nas células.
- **Análises Estratégicas** (grupo novo no menu, 23/10/2026) —
  **Estrutura de Custos Fixos**: fixos + financeiros medidos sobre a
  **receita total** (não por canal), em % da Receita Prevista e da Receita
  Realizada (jan até o último mês), com Ref. Mercado % e Meta Interna %
  editáveis (`cda_pa_meta_estrutura`, por ano; ano sem metas herda o anterior).
  Cartões: Receita, Margem de contribuição (100% − variáveis), Fixos +
  financeiros vs metas, **Fechamento das metas** (margem − soma das metas) e
  teto de fixos para o lucro desejado. Status: OK ≤ meta · Atenção até +2 p.p.
  · Crítico acima. Metas 2026 (Cardoso): Pessoal mercado 18 / meta 15;
  Administrativas 10/10; Marketing 7,5/7,5; Financeiras 5/5.
  Abertura por **centro de custo** (23/10/2026): % do ano anterior (histórico
  próprio), Var. p.p. (tooltip com variação em R$ no ritmo anual), Mercado R$ e
  Meta R$ (= % × Receita Prevista), **Previsto − Meta** (quanto cortar do
  orçado) e meta/mercado opcionais por centro (chave `cc:<id>`). Status do
  centro: com meta → OK / Atenção (+2 p.p.) / Fora de controle; sem meta → vs
  ano anterior: +0,5 p.p. Atenção, +1 p.p. Fora de controle. Botão "Só fora de
  controle". Linha de info mostra Ocupação (aluguel+condomínio+IPTU+energia)
  vs mercado 6–10%.
- **Natureza das despesas** (`natureza` em subconta e centro; SQL
  `planejamento_anual_04_estrutura_custos.sql`): variável · fixa · financeira.
  Subconta = padrão, centro = exceção (null herda). Pré-classificação:
  Produção Varejo/Atacado, Montagem Coleções, Comerciais e Shows Grande Porte
  variáveis; demais fixas; "Financeiras - Bancos/Empréstimos" (Comerciais) e
  "Financeiras - Tarifas" (Administrativas) financeiras; "Market Place -
  Repasse" e "Anúncios - Propaganda e publicidade" (Marketing) variáveis
  (Anúncios: decisão do Cardoso, 23/10/2026). Editável na Tabela Contábil.
- **Valor vigente (reprevisão)** (23/10/2026, `cda_pa_valor_vigente`, SQL
  `planejamento_anual_05_vigente_vinculos.sql`): coluna **Vigente** na Tabela
  Contábil, por centro, com histórico (início mês/ano, valor, motivo, quem).
  Tipo pela natureza: fixa/financeira e receita recorrente = R$/mês; despesa
  variável = % da receita vinculada. Vale o registro mais recente com início ≤
  mês atual; registros futuros aparecem como "futuro". Sem cadastro = média dos
  últimos 3 meses. O Orçado nunca é alterado. Carga: Terceiros – Gerencial
  R$ 6.500/mês desde out/2026 (negociação interna).
- **Margem por Canal** (Análises Estratégicas, 23/10/2026): para cada canal
  (subconta de receita ativa) — receita prevista e margem prevista %, receita
  realizada, custos variáveis rateados, margem R$ e %, Var. p.p., participação
  na margem total, **meta de margem %** editável (`cda_pa_meta_estrutura`,
  chave `canal:<id>`) e status (OK ≥ meta · Atenção até 5 p.p. abaixo · Fora
  de controle; sem meta só acusa margem negativa). Rateio: vínculo do centro >
  vínculo da subconta > todos os canais; % informados ou proporcional à receita
  do canal no período. Rodapé: Margem total − Fixos e financeiros = Resultado
  (confere com Receitas − Despesas). Analítico abre as despesas de cada canal.
  Anúncios: vigente corrigido para 40,85% da receita do **E-commerce** (canal
  vinculado), ≈ R$ 7.000/mês.
- **Margem de contribuição de referência da empresa** (24/10/2026): parâmetro
  editável na Margem por Canal — Ref. mercado % e Meta interna %
  (`cda_pa_meta_estrutura`, chave `mc_empresa`, por ano, herda o anterior).
  Cartão e linha de total comparam a margem realizada com a meta (ou, sem
  meta, com o mercado): OK · Atenção até 5 p.p. abaixo · Fora de controle.
  Carga 2026: mercado 40% (ponto médio da faixa estimada 35–45% para
  moda/merch com lucro de 5–10%; estimativa, não estatística publicada).
  Cartões da Margem por Canal (24/10/2026, pedido do Cardoso): Vendas
  (realizado × previsto proporcional) → Custos variáveis (realizado × ideal =
  100% − referência; excesso em R$) → Margem (realizada × ideal mercado e
  meta; falta em R$) → Resultado (realizado × com a margem ideal). Saíram os
  cartões "Maior/Menor margem %".
- **Referências da empresa na Estrutura de Custos Fixos** (24/10/2026): caixa
  com Margem de contribuição (mercado/meta, chave `mc_empresa`, a mesma da
  Margem por Canal) e **Custos fixos + financeiros** (mercado/meta, chave
  `fixo_empresa`). Carga 2026: fixos mercado 30% (ponto médio da faixa
  estimada 25–35% para moda/merch com lucro de 5–10%). Cartões: Margem
  (realizada × mercado × meta), Fixos (realizado e vigente × mercado × meta,
  em % e R$), **Lucro = margem − fixos** (hoje · nas referências de mercado ·
  nas metas). Total da tabela usa a régua de fixos da empresa; a caixa avisa
  se a soma das metas por linha passar da meta total.
- **Matriz de meta perseguida** (24/10/2026, SQL
  `planejamento_anual_06_meta_perseguida.sql`): `cda_pa_meta_estrutura` ganhou
  `valor_mensal` e `fonte`. Por centro (`cc:<id>`): Mercado % (com fonte) e
  **Meta perseguida R$/mês** (digita R$ ou %, o outro é calculado sobre a
  receita base mensal). Subconta e total = soma, congelados ("provisório"
  enquanto a subconta não for aberta por centro). Receita base = realizada +
  `receita_mes_aberto` (receita hipotética do mês sem receita lançada; 2026:
  out = R$ 100.000). Status: vigente × meta (OK · Atenção até +10% · Fora).
  Pessoal **finalizado** com o Cardoso (mercado / meta R$/mês): Terceiros –
  Gerencial 5% / 6.500; Pró-labore 5% / 6.000; CLT 4% / 3.712,17; Encargos 1% / 607,01;
  Vale transporte 1% / 841,80; Rescisão 0% / 0 → Pessoal 16% / 17.660,98
  (15,78%). Apelido "Vale transporte → Salários CLT" (herdado do Manus)
  apagado em 24/10: VT de jan–out está dentro do CLT; reimportar os meses
  para separar.
- **Pendente (decidido em 24/10/2026):** ao final da estruturação, congelar
  o Mercado % e permitir a troca só ao administrador.
- **Aluguel separado: matriz × lojas** (24/10/2026): nova subconta e centro
  **"Aluguel - Espaços em Lojas"** (Despesas, natureza variável, vínculo →
  REVENDAS; lojas Bafu e Trama). Realizado jan–out/2026 separado a partir da
  planilha do Cardoso: matriz R$ 1.823,07/mês (aluguel + garagem, fixo);
  lojas 900,00 (jan, fev, abr, jul), 1.758,00 (mar), 2.897,98 (mai), 3.191,30
  (ago), 1.880,65 (jun, set, out). Totais de jan–set inalterados; outubro
  gravado conforme a planilha (+R$ 2.473,72), será sobreposto na importação
  do fechamento. Vigentes: matriz R$ 1.823,07/mês (out/26); lojas 8,19% da
  receita de Revendas (≈ R$ 1.880,65/mês, desde jun/26). Atenção: reimportar
  meses já separados exige a linha "Aluguel - Espaços em Lojas" na planilha.
- **Três réguas** (24/10/2026, pedido do Cardoso): a Estrutura de Custos
  mostra, por centro/subconta/total, **Mercado (ideal)** % · R$/mês →
  **Atual** (vigente) R$/mês · % → **A perseguir** R$/mês · %, mais Atual −
  A perseguir e A perseguir − Mercado. Previsto anual, realizado e média
  mensal ficam no botão "Mostrar estatísticas" (`paEstado.verEstat`).
  **Administrativas definida**: a perseguir = Previsto 2026 ÷ 12 (Previsto
  revisado pelo Cardoso: Aluguel 22.000, Condomínio 33.000, Contábeis 16.000,
  Transporte 12.000, IPTU 11.500, TI Compra 2.000, Limpeza 7.000, Internet
  1.200, Taxas 300; Aluguel - Espaços em Lojas 18.000); mercado 8% (Aluguel
  1,6 · Condomínio 2,0 · Contábeis 1,0 · TI Licenças 0,7 · Energia 0,9 · IPTU
  0,5 · Transporte 0,3 · Limpeza 0,3 · Locação 0,2 · Telefonia 0,15 · Internet
  0,15 · TI Compra 0,1 · Material 0,1 · demais 0). Manutenção de veículos
  mantida (tem realizado 2025).
- **Ajustes de 24/10/2026 (Administrativas, pedido do Cardoso):** jul/26 —
  R$ 1.600 movidos de TI Licenças para TI Compra de software; jul–set/26 —
  3 × R$ 1.139,05 de IPTU que estavam em Abertura Telas (apelido "Produção
  Varejo - Montagem Coleções") movidos para Predial - IPTU (totais mensais
  conferidos). Mercado: Transporte 0,30% → 0,50%; Energia 0,90% → 0,70%.
  **Plano de ação** (`cda_pa_plano_acao`, SQL 07): histórico em texto livre por
  centro (metas intermediárias, ações); anotações não se editam; exclusão só
  admin. Notas iniciais: Condomínio (repassar 1 de 5 salas a R$ 554,80 →
  R$ 2.219,20) e as metas intermediárias de Pessoal.
- **Nova matriz da Estrutura de Custos Fixos** (24/10/2026, Cardoso): colunas
  Orçado Mês (Ano Exerc. ÷ 12) · Mercado (ideal) % e R$/mês · **Realizado Média
  Ano** (realizado jan–último mês ÷ nº de meses) · **Realizado Mensal
  Consolidado** (valor vigente cadastrado com data e motivo) · **Meta mensal de
  redução** (Base − Mercado) · **Plano de ação** (📝 histórico) · Status.
  Base de comparação = Consolidado quando cadastrado (prevalece), senão Média
  Ano; status Dentro / Atenção (até 10% acima) / Acima. Saíram a média de 3
  meses e os campos "A perseguir". Subconta e total: soma (congelada); na
  subconta, o Consolidado mostra a soma das bases dos centros.
  24/10 (Cardoso): nova ordem — Orçado Mês · Realizado Mês (Média jan–último
  mês; antes "Realizado Média Ano") · Realizado Mensal Consolidado · Mercado
  (ideal, R$/mês e % em linhas separadas) · Meta mensal de redução · Plano de
  ação · Status.
  Depois: Status logo após a Meta mensal de redução e Plano de ação por último.
  Filtro Centro de Custo: na Estrutura só centros fixos/financeiros de despesa;
  na Margem por Canal só centros de receita e despesas variáveis. A lista de
  Subconta segue a mesma regra (só subcontas com algum centro da natureza).
  Linha "Financeiras" com filtro: soma só os centros da seleção (antes somava
  também Bancos/Empréstimos de Comerciais ao filtrar Administrativas).
  Mercado: Compra Ativos 0,20%; Carro, Manutenção de veículos e Taxas
  Governamentais 0% (Cardoso, 24/10) → Administrativas 8,20%.
  25/10 (Cardoso): "Financeiras - Tarifas bancárias + IOF + Juros" (cc 39)
  natureza financeira → fixa (independe das vendas); Mercado 0,10%. Backup:
  natureza anterior = 'financeira'. "Bancos/Empréstimos" (cc 30017, Comerciais)
  = só parcelas de empréstimo → natureza financeira → variável (decisão do
  Cardoso, 25/10: ligado às despesas comerciais). Backup: natureza anterior =
  'financeira'. Sem vínculo → rateado em todos os canais pela receita.
  Carro (cc 44) Mercado 0,25%.
  25/10 (Cardoso): SEM CATEGORIA 2026 reclassificado (cc 450003; antes: jan
  763,52 · fev 296,52 · mai 390,10 · jul 250,00 · ago 157,86 · set 819,00 · out
  48,89) → jan: Eventos Alim.+Estadia 356,13, Escritório Material 232,37,
  Comissões Vendedores 175,00; fev: Escritório Material 232,37; mai: Abertura
  Telas 390,10; jul: Comissões Vendedores 250,00; ago: VJ - Embalagens 157,86;
  set: Eventos Transp. Aéreo/Rod. 819,00; out: Eventos Alim.+Estadia 48,89.
  Depois: fev 64,15 → VJ - Matéria Prima - Tecidos; jan 0,02 → Eventos Alim.+
  Estadia. SEM CATEGORIA 2026 zerado.
  25/10 (Cardoso): Marketing fixo — Mercado Agências 2,2% e Brindes 0,3% (total
  2,5%). Anúncios segue variável (Margem por Canal).
  25/10: **Mercado % congelado** — só o administrador edita (centros, margem
  de contribuição e alvo de custos fixos, na Estrutura e na Margem por Canal);
  demais usuários veem o valor com 🔒. Trava no banco: SQL 08 (trigger
  cda_pa_trava_mercado).
  25/10: **Painel Resultado anual (📊)** e **Referências (⚙)** na Estrutura e na
  Margem por Canal — saem os cartões e a faixa de parâmetros; fica uma linha
  "Base: jan–out · Receita base R$/mês" com selo de mudanças. Painel em cascata
  (Receita → Variáveis → Margem → Fixos → Lucro) × Realizado / Mercado / Orçado,
  com explicação de cada linha, distância ao lucro de mercado e ponto de
  equilíbrio. Margem calculada sobre a mesma receita base (corrige a margem
  dos cartões antigos, que usava receita sem o mês hipotético e despesas com
  ele). Subconta sem valores (SEM CATEGORIA zerada) não aparece.
  25/10: Resultado anual — colunas Orçado · Realizado · Mercado (ideal, com a
  receita base) · Diferença Mercado × Realizado (meta a perseguir: ↓ reduzir
  custos / ↑ aumentar margem e lucro, em R$ e p.p.).
  25/10 (Cardoso): VT 2026 separado do CLT (cc 54 → cc 53), jan–out: 349,20 ·
  288,00 · 999,40 · 1.022,20 · 315,00 · 1.414,60 · 938,40 · 841,80 · 856,80 ·
  856,80 (total 7.882,20). Totais mensais CLT+VT conferidos (inalterados).
  25/10 (Cardoso) — **Metodologia das despesas variáveis**: % sobre a receita
  dos canais vinculados; colunas Orçado % · Realizado % (meses com receita
  fechada) · Consolidado % · Mercado % · Meta de redução (p.p. e R$) · Status ·
  Plano de ação. Marketing variável: Anúncios Mercado 25% do E-commerce (ROAS
  4); Market Place - Repasse ao Parceiro = 70% da venda do Market Place
  (Mercado e consolidado 70%; Ciclo retém 30%). VT consolidado 856,80 desde
  set/26.
  26/10 (Cardoso) — **Análises Estratégicas dividida em Receitas e Despesas.**
  Receitas: **Mix de Vendas e Custo Ideal** (canais com Tipo Direta/Atacado-B2B,
  orçado × meses/12 e realizado do período só com meses de receita fechada,
  Part., Orçado Mês, Realizado Mês, Saldo Mês (Real − Orç), Meta Mês até Fim
  Exerc. = (orçamento anual − realizado) ÷ meses restantes; bloco do custo ideal
  da Produção = Part. direta × 25% + Part. atacado × 50%, padrão "keystone").
  Revendas = venda direta (comissionadas). SQL 09: cda_pa_subconta.tipo_venda
  e referências custo_ideal_direta/atacado (em ⚙ Referências, admin).
  Despesas: Estrutura de Custos Fixos · **Estrutura de Custos Variáveis** (mesmo
  layout e cálculos dos fixos; Produção VJ+AT somada por tipo de custo, Mercado
  🔗 = custo ideal do Mix distribuído pelo peso atual; consolidados em % de
  canal convertidos em R$ pela receita média dos canais vinculados; grupo/total
  com Mercado "parcial" não mostram redução/status) · Margem por Canal.
  Ajustes 26/10: Part. realizada em verde/vermelho contra a orçada; custo ideal
  da venda direta = 30% (meta da Ciclo; setor ≈ 25%); colunas "No orçamento —
  o que planejamos" e "No realizado — o que aconteceu".
  Orçamento 2026 da Produção ajustado ao custo ideal do mix orçado (36,96% →
  R$ 530.800, −R$ 5.800), corte só em Tecidos e Fábricas (Cardoso, 26/10).
  Backup (antes → depois): VJ Tecidos 180.000 → 176.974 · AT Tecidos 40.000 →
  39.328 · VJ Fábricas 100.000 → 98.319 · AT Fábricas 25.000 → 24.579.
  **Saldo de Compras de Produção** (Receitas — provisório no menu, 26/10): resumo do Mix; teto ideal
  de produção = custo ideal × receita do ano em dois cenários (pelo orçamento:
  realizado + orçado dos meses restantes; pelo ritmo atual: realizado + média
  mensal × meses restantes); Saldo pelo ideal = teto − realizado − Provisões;
  Saldo pelo orçamento = orçado − realizado − Provisões; Pode comprar = o menor
  dos dois, e por mês restante; por tipo de custo (VJ + AT), teto distribuído
  pelo peso atual no realizado.
  Comissões Vendedores (26/10): vínculo = Feiras e Bazares, Shows, E-commerce,
  Vendas sem Vendedor (provisório — o correto são só os centros E-COMMERCE SAC e
  REVENDA CICLO - SHOWROOM / SAC além de Shows e Feiras; o vínculo ainda não
  aceita centro de receita). Acordo: diária de R$ 300 por evento (comissão +
  transporte + alimentação). Meta Cardoso: diária R$ 250 → Mercado 4,07% da
  receita total; plano de ação com regra de escala (R$ 2.500 de venda/vendedor).
  Comissões Revendas (27/10): consignação nas lojas parceiras; comissão real ≈ 30%
  da venda de Revendas (realizado menor por comissões atrasadas não lançadas).
  Mercado 6,15% da receita total (= 30% de Revendas); consolidado 30% (percentual,
  desde jan/26).
  Mercado Comissões Revendas → 25% de Revendas = 5,13% da receita total (meta
  da Ciclo; antes 30% = 6,15%).
  Consolidado Comissões Revendas → 22,65% (antes 30% → 25%): cadastro de Canais — Circo
  Voador 20%, Bafu 31,03%, Hotel Jo & Joe 30%, Showroom/SAC 5%, Longboard 20%,
  Norte 0% (operação específica); ponderada jan–set 22,65% (27/10).
  Provisão Comissões Revendas 2026 = R$ 9.000 (comissão atrasada Circo Voador abr–set;
  antes 0,00).
  Provisão Comissões Artistas Collabs 2026 = R$ 25.000 (royalties pendentes jan–set;
  antes 0,00) — Cardoso 27/10.
  Comissões Artistas Collabs (27/10): inclui casa de show (E-com Circo Voador) —
  é venda via e-commerce. Mercado = meta 15% da venda dos canais de artista =
  4,20% da receita total (praticado ≈ 20%). Consolidado R$ 6.554,78/mês (valor:
  lançado jan–set + R$ 25 mil pendentes ÷ 9).
  27/10 (Cardoso): **Eventos - Hospedagem** criado (cc 510005, Comerciais,
  variável, mesmos vínculos de 30013). 2026 movido de "Eventos - Alimentação +
  Estadia" (cc 30013, renomeado **Eventos - Alimentação**; alias de importação do
  nome antigo → 30013): jan 1.150,00 (hotel Salvador, feira Rosembaum) · abr
  1.227,33 (Hotel Erik Manaus) · mai 1.823,75 (Booking 564,00 + Gran Hotel
  1.015,75 + hotel Gilsons Natal 244,00) · jul 347,65 (Mar Hotel 139,65 + Ibis
  208,00) · ago 139,65 (Mar Hotel 2/2). Total 4.688,38. Valores antes em 30013:
  jan 5.163,01 · abr 2.037,82 · mai 4.502,24 · jul 3.410,43 · ago 624,48.
  Orçado 2026 separado: Eventos - Alimentação 25.000 → 21.000; Eventos -
  Hospedagem 4.000 (novo). Mercado: Alimentação 0,81% (R$ 50 por vendedor/evento);
  Hospedagem 0,84% (até 3% da venda do evento da viagem). Plano de ação em
  Alimentação: realizado 2026 distorcido por gastos de cartão sem identificação.
  **Rateio do Uber** (27/10, Cardoso): conta única cai em Eventos - Transporte
  Uber/Outros (cc 30016). Regra: por mês, mín(R$ 500; valor do mês) vai para
  Produção - Transporte (Combustíveis, Uber) (cc 390001, Administrativas); o resto
  fica em Eventos. Aplicado jan–out/26 (4.915 movidos; antes 30016: jan 4.251,59 ·
  fev 1.210,85 · mar 610,96 · abr 414,85 · mai 1.327,80 · jun 3.882,50 · jul
  2.346,82 · ago 3.036,24 · set 3.796,58 · out 1.824,48). Aplicar a cada importação
  até separar na origem. Mercado Eventos Uber 0,66% (R$ 40/vendedor/evento).
  Mercados Eventos: Royalties/Taxas 1,95% · Aéreo 0,84% · Custos Shows 0,56%.
  Registrado também no Tutorial Informativo (Fixos e Variáveis).
  Comerciais fechado (27/10): Bancos/Empréstimos 5,00% · Fretes e Seguros 1,60% ·
  Devoluções 0,30% (metas do Cardoso).
  Variáveis completos (27/10): Montagem Coleções 2,50% (Telas 1,10 · Designer 0,60 ·
  Foto 0,40 · Pilotagem 0,20 · Modelos 0,15 · Locação 0,05); Aluguel - Espaços em
  Lojas 1,68% (contrato 8,19% de Revendas). Soma do Mercado dos variáveis: 42,63%
  + Produção 36,78% (Mix) = 79,41% da receita.
  Mercado gravado: Impostos 8,36% (Simples; parte parcelada em 60 meses),
  Anúncios 4,05% (= 25% do E-commerce), Repasse Market Place 0,08% (= 70%).
  24/10 (Cardoso): excluído o Consolidado do Aluguel matriz (era igual à Média
  Ano). Backup do registro: cda_pa_valor_vigente id 9, cc 40, 2026/10, valor
  1.823,07, motivo "Aluguel + garagem da matriz (lojas separadas em centro
  próprio)".
- **Grupos do ecossistema e Marca comum** (27/10/2026, SQL
  `planejamento_anual_10_grupos_marca_comum.sql`, aprovado pelo Cardoso):
  - `cda_grupo` (tabela do ECOSSISTEMA, sem prefixo de módulo): tipo
    Receita/Despesa, natureza fixa/variável, nome, ordem. **Só estrutura,
    nenhum %**: valor de grupo = sempre a soma dos centros. Leitura: membros da
    equipe; gravação: admin. 13 grupos de Despesa — fixos: Pessoal, Ocupação
    (Aluguel, Condomínio, Energia, IPTU — inclui showrooms RJ/SP em prédio),
    Administrativas (inclui Tarifas bancárias, Produção - Transporte, Sem
    Categoria), Marketing fixo; variáveis: Produção, Impostos, Comissões,
    Eventos (inclui Shows Grande Porte), Financeiro, Logística e pós-venda,
    Marketing, Desenvolvimento de coleção, Ocupação em parceiros.
  - `cda_pa_centro_custo.grupo_id`: os 76 centros de despesa ligados. Trigger
    `cda_pa_valida_grupo_centro` recusa centro com natureza (própria ou
    herdada) diferente da do grupo.
  - **Mercado % (meta da Ciclo)** e **Marca comum** ficam SÓ no centro
    (`cda_pa_meta_estrutura`, chave `cc:<id>`, colunas `pct_mercado`,
    `pct_marca_comum`, `motivo_diferenca`). Ambos só o admin altera (trigger
    `cda_pa_trava_mercado`). Produção: Marca comum por tipo de custo dividida
    entre VJ e AT pelo peso realizado jan–out.
  - **Marca comum** = marca saudável do mesmo porte, **sem loja própria**
    (vende em feiras, shows, casas de show e lojas parceiras — conceito A).
    Totais aprovados: fixos 28,00% (Pessoal 16,70 · Ocupação 4,50 ·
    Administrativas 4,50 · Marketing fixo 2,30) · variáveis 70,36% (Produção
    35,00 · Impostos 8,36 · Comissões 10,00 · Eventos 4,40 · Financeiro 2,00 ·
    Logística 2,30 · Marketing 4,30 · Desenv. coleção 2,50 · Ocupação em
    parceiros 1,50) → **lucro de referência +1,64%**. Cada ajuste do Cardoso
    tem no Motivo o % proposto antes. Diferença Mercado × Marca ≥ 0,5 p.p.
    exige motivo.
  - **Regra de coerência**: chave `lucro_minimo_marca` = 0% (a referência não
    pode dar prejuízo; subir para 5% quando a Ciclo se aproximar do equilíbrio).
    ⚙ Referências mostra a soma e avisa se ficar abaixo.
  - **Totais antigos removidos** (passam a ser a soma dos centros, função
    `paMercadoSomado`): `sub:8` Marketing 7,5% (meta 3,5) · `sub:10`
    Administrativas 10% (meta 10) · `sub:11` Pessoal 18% (meta 15) ·
    `mc_empresa` 40% · `fixo_empresa` 30% · `financeira` 5% (meta 5). Hoje:
    Mercado fixos 27,05% · variáveis 79,41% → margem 20,59% → lucro da meta
    −6,46% (metas a revisar). Backup: `cda_pa_meta_estrutura_backup_20261027`
    (57 linhas; apagar após validação, ~30 dias).
- **Tela de Grupos** (27/10/2026, subetapa 1.2) em Tabelas Contábeis:
  coluna **Grupo** na Tabela Contábil (só despesas; a lista mostra só grupos
  da mesma natureza do centro; selos "sem grupo" e "⚠ natureza" + aviso no
  topo). Natureza conflitante com o grupo é recusada pelo banco e a tela pede
  para trocar o grupo antes. Card **🧩 Grupos de Despesa — Mercado × Marca
  comum**: grupos recolhíveis com Mercado Σ, Marca comum Σ e Diferença;
  centros com Mercado (🔒; Produção 🔗 = custo ideal do Mix × peso realizado
  do centro), Marca comum (input só admin) e Motivo (editável; selo "motivo
  obrigatório" quando |diferença| ≥ 0,5 p.p. sem texto); totais fixos,
  variáveis e Resultado com lucro mínimo. Admin cria, renomeia, inativa e
  exclui grupo (exclusão só sem centros). Correção junto: `paErro` exibia o
  erro e o chamador exibia de novo "undefined" — agora `paMsgErro` devolve a
  mensagem sem exibir.
- **Impostos por competência + parcelamento** (28/10/2026, Cardoso): jan–set/26
  imposto devido 8,36% × receita ≈ 85,2 mil × pago 30,8 mil (3,0%) → ≈ 54,4 mil
  foram para parcelamento (outubro também; novembro deve voltar a ser pago).
  (1) `cda_pa_valor_vigente` id 18: consolidado **8,36% da receita** em Impostos
  sobre vendas (cc 30018) desde jan/2026 → Estrutura/Comparativo/Resultado usam
  o imposto devido. (2) Centro novo **Impostos - Parcelamento** (cc 510010,
  Comerciais, variável, grupo Financeiro) para as parcelas de impostos
  parcelados (dívida), para não contar o mesmo imposto duas vezes. Pendente:
  Cardoso envia a separação das parcelas já pagas dentro de Impostos (mover mês
  a mês, como o VT); depois, Provisão Prevista do imposto 2026 não pago; e
  valor/prazo do parcelamento para o orçamento 2027.
- **Separação Impostos × Parcelamento** (28/10/2026, dados do Cardoso): em
  Impostos sobre vendas (cc 30018) ficam só as parcelas integrais (dez/25 paga
  em 21/01 6.850,35 · jan/26 paga em 20/02 9.124,45 · fev/26 paga em 20/04
  6.899,91). Movido para Impostos - Parcelamento (cc 510010): jan 321,40 · fev
  324,92 · mar 327,96 · abr 331,64 · jun 338,20 (parcelamentos parciais
  finalizados) · jul 4.763,37 (sinal do parcelamento consolidado) · ago 733,87
  (parcela 1/60; total 44.032,20). Valores antigos em 30018: jan 7.171,75 · fev
  9.449,37 · mar 327,96 · abr 7.231,55 · jun 338,20 · jul 4.763,37 · ago 733,87
  (set 741,79 aguardando confirmação). Apelido de importação "Impostos
  Parcelamento sobre Vendas" (nome do centro no Bling) → cc 510010.
- **Provisão Comissões Artistas** (28/10/2026, Cardoso): `cda_pa_provisao` id 71
  (cc 60001, 2026) de **25.000,00 → 15.559,22** = contratado pelos canais
  (53.175,85) − lançado (37.616,63). Revisar ao fechar outubro.
- **Comissões contratado × lançado** (28/10/2026, subetapa 2.2, SQL
  `planejamento_anual_12_canal_centro_comissao.sql`, aprovado pelo Cardoso):
  `canais.centro_custo_id` (centro de RECEITA onde a venda do canal é lançada;
  40/40 ligados) e `canais.comissao_centro_id` (centro de DESPESA da comissão:
  artista/e-commerce → Comissões Artistas Collabs; revenda → Comissões
  Revendas; Feiras e Bazares 20% → Eventos - Royalties/Taxas de Feiras
  (organizador da feira); Showroom/SAC 5% → Comissões Vendedores; canais sem
  comissão = nulo; 23 com destino). Trigger `cda_valida_canal_centros`.
  Novos: grupo de receita **Canais inativos** (Revenda Cybervolt, E-commerce/Shows
  Jonathan Ferr); subconta de receita **BRINDES / PERMUTAS**; centros SHOWS
  CICLO 360 GRAUS (510006), E-COMMERCE CICLO 360 GRAUS (510007), REVENDAS /
  E-COMMERCES INATIVOS (510008), BRINDES / PERMUTAS (510009). Tianastacia →
  E-commerce Multimarcas. Regras do Cardoso: venda subsidiada (Operacional
  100%) e canal com Comissão em branco = sem direito a comissão.
  **Fórmula** (glossário do Financeiro): Total Venda Bruta = (Qtde × Preço −
  Desconto) + Frete; deduções = Frete + Imposto + Operacional + Royalties
  (estes três × Venda Bruta); Base = Bruta − deduções; Comissão = Base ×
  Comissão %. % efetivo usado no Planejamento = Comissão × (1 − Imposto − Op −
  Royalties) sobre a venda líquida (o frete se anula). Na **Margem por Canal**,
  card **🤝 Comissões — contratado × lançado**: por destino (contratado,
  lançado, Provisão Prevista, diferença; Vendedores e Royalties/Taxas sem
  diferença porque misturam outros custos) e por grupo de receita → centro
  com os canais e o % efetivo. Primeira leitura (28/10): Artistas contratado
  ≈ R$ 53,2 mil × lançado 37,6 mil + provisão 25 mil; Revendas contratado
  ≈ 44,1 mil × lançado 35,4 mil + provisão 9 mil.
- **Grupos de Receita** (28/10/2026, subetapa 2.1, SQL
  `planejamento_anual_11_grupos_receita.sql`, aprovado pelo Cardoso): 10 grupos
  `tipo='Receita'` (sem natureza) por tipo de canal — Atacado / Private Label ·
  Shows de artistas · Revendas (lojas parceiras) · E-commerce · Misto -
  E-Commerce / Shows · Feiras e bazares · Venda direta Ciclo (showroom, SAC,
  Ciclo em Casa, Vendas sem Vendedor) · Vendas Subsidiadas
  (Colaboradores/Parceiros) · Market Place · Brindes / Permutas. 35 centros de
  receita ligados centro a centro (ex.: Revenda Ciclo Showroom/SAC → Venda
  direta Ciclo) e **`canais.grupo_id`** no Financeiro (40 canais ligados;
  ecossistema único). O Financeiro grava canais por upsert só com as suas
  colunas, então `grupo_id` é preservado (igual a `escopo`). Triggers:
  `cda_pa_valida_grupo_centro` (receita só em grupo Receita; despesa só em
  grupo Despesa da mesma natureza) e `cda_valida_grupo_canal` (canal só em
  grupo Receita). Telas: coluna Grupo também nas receitas; filtro Grupo lista
  receita e despesa (receita primeiro); Margem por Canal com grupo de receita
  recorta os canais para os centros do grupo (despesas proporcionais); card
  **💰 Grupos de Receita** em Tabelas Contábeis (centros, canais, realizado,
  participação; admin cria/renomeia/inativa). Participação 2026: Private
  Label 33,9% · Shows 19,6% · Revendas 17,7% · E-commerce 15,8% · Feiras 7,9%
  · Venda direta 4,6% · demais < 1%.
- **Filtro por Grupo** (27/10/2026, pedido do Cardoso): select **Grupo** em
  todos os relatórios com filtro (Tabela Contábil, Orçamento, Realizado,
  Provisão, Previsto vs. Realizado, Estrutura Fixos/Variáveis, Margem por
  Canal, Comparativo de Modelo), entre Conta e Subconta. Lista só grupos de
  despesa ativos com centros compatíveis com a tela; ao escolher, Subconta e
  Centro passam a listar só o que pertence ao grupo. Some quando Conta =
  Receitas. Estado em `paEstado.grupoId`; filtro aplicado em
  `paContasFiltradas`/`paGruposAtivos` (`paNoGrupo`) e nos filtros próprios
  da Estrutura, Margem e Comparativo. Cartões do topo continuam no total geral.
- **Comparativo de Modelo — Ciclo × Mercado** (27/10/2026, subetapa 1.3;
  Análises Estratégicas › Modelo, página `modelo`, função
  `paComparativoModelo`). Abas Despesas Fixas / Variáveis / Globais (as
  três ativas desde 27/10, subetapas 1.4 e 1.5: Globais junta variáveis e fixos
  com Total Global, Margem de contribuição e Resultado operacional nas três
  visões). Usa os mesmos números da
  Estrutura (`paEstruturaCustos(modo,{soDados:true})` devolve os dados sem
  desenhar): Realizado = base (consolidado ou média), Mercado (meta; Produção
  🔗 pelo Mix, VJ+AT por tipo), Marca comum (soma dos centros), agrupados
  pelos grupos do ecossistema. Colunas: Diferença total (Realizado − Marca,
  p.p. e R$/mês) = **Parte do modelo** (Mercado − Marca, com Motivo ⓘ) +
  **A reduzir** (Realizado − Mercado). Total Variáveis e Margem de
  contribuição nas três visões. Popup **💡 Informações importantes** (botão antes do Resultado anual; pedido do Cardoso para limpar a tela): base do período, diferença total, quanto é
  modelo e quanto é a reduzir (líquido, com excesso e folga brutos) e os 5
  maiores valores a reduzir. Filtros da Estrutura + Analítico/Sintético
  (Sintético = só grupos); busca também pelo nome do grupo. Tutorial
  Informativo (`PA_TUT.modelo`). Junto: correção do menu lateral que não
  abria (nome de função repetido, `paAlternarGrupo`).
- **Filtros da Estrutura de Custos Fixos** (24/10/2026): os mesmos da Margem
  por Canal — Ano · Conta · Subconta · Centro de Custo · Buscar ·
  Analítico/Sintético. Recortam as linhas; cartões e total da empresa fixos.
- **Filtro por Centro de Custo** (24/10/2026): depois de Subconta, na Tabela
  Contábil e na Margem por Canal (`paEstado.centroId`, opção `centro` do
  `paFiltroHTML`; lembrado ao recarregar). Margem por Canal ganhou Conta /
  Subconta / Centro / Buscar: Receitas recortam canais (centro de receita =
  canal recortado, despesas proporcionais); Despesas mostram só a despesa
  escolhida dentro de cada canal; totais da empresa fixos. Comissões
  Vendedores vinculada a Revendas, Shows, Feiras e Bazares, Shows Multimarcas
  (24/10, Cardoso: Private Label, E-commerce, Vendas sem Vendedor, Ciclo em
  Casa, Colaboradores e Market Place não pagam comissão de vendedor).
- **Estrutura de Custos com Vigente** (23/10/2026): colunas Previsto e
  Realizado (R$ · % rec.), Var. p.p. vs ano anterior (tooltip com % e R$),
  **Vigente / mês** (cadastrado ou média dos últimos 3 meses *com lançamento*),
  **Vigente % anual** (vigente × 12 ÷ receita prevista — base do Status, que
  passa a olhar para frente), **Projeção** (realizado + vigente × meses
  restantes), Ref. Mercado % (R$ no tooltip), Meta % e Meta R$, Previsto −
  Meta. Alerta **"⚠ mudou?"** quando o último mês importado foge > 20% da
  média dos 3 anteriores; clique abre o cadastro do vigente pré-preenchido.
  Vigente R$ 0 = despesa eventual (ex.: rescisão). Cadastros de 23/10:
  Agências R$ 4.600/mês e Anúncios 6,43% da receita (≈ R$ 7.000/mês) desde
  out/2026; Anúncios vinculado só ao E-commerce; meta Marketing (fixo) 3,5%.
- **Vínculos Receita × Despesa** (`cda_pa_vinculo`): seção no fim da Tabela
  Contábil. Despesa variável → canais (subcontas de receita). Subconta =
  padrão, centro = exceção (vínculos próprios substituem os da subconta);
  sem vínculo = todos os canais; % de rateio opcional (todos preenchidos e
  somando 100%) ou automático pela receita. Carga: Produção Atacado → Private
  Label; Produção Varejo → canais de varejo; Comissões Revendas → Revendas;
  Eventos (5 centros) → Shows, Feiras e Bazares, Shows Multimarcas; Shows
  Grande Porte → Shows; Market Place Repasse → Market Place.
- **Cartões do topo** (23/10/2026): sempre mostram o total geral (Receitas,
  Despesas, Resultado); os filtros Conta/Subconta valem só para a tabela
  (antes o filtro "Despesas", lembrado ao recarregar, zerava Receitas).
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

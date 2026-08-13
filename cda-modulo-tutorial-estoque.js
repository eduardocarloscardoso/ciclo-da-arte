// ════════════════════════════════════════════════════════════════════
// cda-modulo-tutorial-estoque.js
// Módulo Estoque → último submódulo: Tutorial.
// Documenta a metodologia usada nos relatórios de Estoque (Vendas por
// Tipo de Peça, Vendas por Canal, Planejamento de Compras) — em
// especial o rateio de "Diversos", que é o ponto mais não-óbvio do
// módulo e já gerou dúvidas reais do CEO (ago/2026).
//
// Mesmo padrão visual e de exportação/comentários do Tutorial do
// Comercial (cda-modulo-tutorial.js) — reaproveita as funções
// compartilhadas cdaCarregarComentariosTutorial/cdaSalvarComentarioTutorial,
// escopadas por modulo='estoque' (não mistura com os comentários do
// Tutorial do Comercial).
//
// Convenção do sistema (definida pelo CEO, ago/2026): todo módulo novo
// deve ter, como seu ÚLTIMO submódulo, um Tutorial específico como
// este — documentando as regras de negócio e fórmulas daquele módulo.
//
// Requer cda-dados-compartilhados.js carregado antes.
// Uso:
//   <div id="container-tutorial-estoque"></div>
//   <script>montarModuloTutorialEstoque('container-tutorial-estoque');</script>
// ════════════════════════════════════════════════════════════════════

var CDA_TUTORIAL_ESTOQUE_MARCADOR = 'COMENTÁRIOS DA EQUIPE';

var CDA_TUTORIAL_ESTOQUE_CONTEUDO = [
  {
    id: 'visao-geral', titulo: 'Visão Geral',
    html: '<p>O módulo Estoque existe pra responder uma pergunta de negócio concreta: <b>quanto comprar de matéria-prima por tipo de peça pro trimestre que vem</b> — inclusive o 4º trimestre, que historicamente vende bem mais que o resto do ano (Black Friday, Natal, shows e feiras de fim de ano), mas a ferramenta serve pra qualquer Q1-Q4, de qualquer ano.</p>' +
      '<p>Ele tem 3 submódulos:</p>' +
      '<table class="cda-tut-tabela"><tr><th>Submódulo</th><th>Responde</th></tr>' +
      '<tr><td><b>Vendas por Tipo de Peça</b></td><td>De tudo que a empresa vendeu num período, quanto foi de cada tipo (T-shirt, Cropped, Shorts...)?</td></tr>' +
      '<tr><td><b>Vendas por Canal</b></td><td>Dentro de uma Collab/Artista (ex: Luedji Luna), quanto cada canal dela vendeu — e o que exatamente foi vendido lá?</td></tr>' +
      '<tr><td><b>Planejamento de Compras</b></td><td>Compara o ritmo atual de vendas contra o ano anterior e projeta quanto comprar pro Quadrante (Q1-Q4) e Ano de Exercício escolhidos.</td></tr>' +
      '</table>' +
      '<p class="cda-tut-nota">O canal <b>Private Label</b> (vendas no atacado) é <b>sempre excluído</b> de todo o módulo Estoque — o objetivo é planejar estoque de varejo, não atacado.</p>'
  },
  {
    id: 'diversos', titulo: 'O que é "Diversos" e por que ele existe',
    html: '<p>Nem toda venda no histórico tem o produto detalhado peça por peça. Uma fatia das vendas (~21% do valor total da empresa) foi lançada como <b>pedido consolidado</b> — o valor do pedido inteiro registrado de uma vez, sem abrir quais peças específicas foram vendidas. Isso é comum em <b>revendas, shows e feiras</b>, onde a prestação de contas do parceiro vem fechada, não peça a peça.</p>' +
      '<p>No catálogo de produtos, esses lançamentos ficam sob dois produtos "guarda-chuva": <code>COMERCIAL - PREVISÃO DE VENDAS</code> e <code>GENÉRICO PRODUTO/SERVIÇOS PO</code>, ambos classificados com tipo de peça = <b>"Diversos"</b>.</p>' +
      '<h4>Dois fatos importantes sobre o Diversos</h4>' +
      '<p>1) O <b>tipo de peça</b> do Diversos não é conhecido (por definição — se fosse conhecido, não seria Diversos). Por isso ele precisa ser <b>ratado</b> (distribuído por estimativa) entre os tipos reais no relatório de Vendas por Tipo de Peça.</p>' +
      '<p>2) O <b>canal de venda</b> do Diversos <u>é</u> conhecido — todo registro de Diversos tem um canal real vinculado (ex: "REVENDA BAFU", "SHOWS MULTIMARCAS"). Por isso, no relatório de Vendas por Canal, o Diversos <b>não precisa ser ratado por canal</b> — só a quantidade de peças é estimada (ver próxima seção), porque o campo "quantidade" salvo nessas linhas é contagem de pedido/linha, não de peça física.</p>' +
      '<p class="cda-tut-nota">Histórico: em ago/2026, foi encontrado e corrigido um caso de canal duplicado ("CICLO BRINDES / PERMUTAS") onde 278 vendas reais estavam presas num canal sem Collab vinculada. Sempre que uma Collab aparecer com valor zerado inesperadamente num relatório, vale checar se não há uma duplicata de canal parecida.</p>'
  },
  {
    id: 'formula-participacao', titulo: '% Participação Total Vendas (rateio por Tipo de Peça)',
    html: '<p>É o percentual usado pra decidir <b>como distribuir o Diversos entre os tipos de peça</b>, no relatório Vendas por Tipo de Peça. Responde: "de tudo que a empresa vende (sem contar Diversos), que fatia é T-shirt? E Cropped? E assim por diante."</p>' +
      '<p class="cda-tut-nota">Filtros desse submódulo: <b>Período</b> (livre) e <b>Tipo de peça</b> (opcional — mostra só os tipos selecionados; não tem filtro de canal aqui, porque o % Participação sempre olha a empresa inteira — pra análise por canal, use o submódulo Vendas por Canal).</p>' +
      '<h4>Fórmula</h4>' +
      '<p><code>% Participação Total Vendas (tipo) = Valor real do tipo ÷ Valor real de TODOS os tipos identificados × 100</code></p>' +
      '<p>Exemplo real (ago/2026): T-shirt = R$ 954.097,22 ÷ R$ 2.224.175,97 = <b>42,90%</b>.</p>' +
      '<p class="cda-tut-nota">Essa mesma fórmula pode ser pensada de outro jeito, matematicamente idêntico: somar o valor real + o valor de Diversos já ratado pra cada tipo, e dividir pelo total real + Diversos de todos os tipos juntos. Dá exatamente o mesmo número — é uma propriedade do rateio proporcional (a fatia de cada tipo antes de somar o Diversos é sempre igual à fatia depois de somar). O sistema calcula pelo caminho direto (sem Diversos no denominador) por eficiência e pra evitar referência circular, mas os dois caminhos sempre batem.</p>' +
      '<h4>Por que o Diversos NUNCA entra no denominador dessa conta</h4>' +
      '<p>Se o Diversos entrasse no denominador antes do rateio, a soma dos percentuais de todos os tipos ficaria abaixo de 100% (testado: cai pra ~79%) — sobraria uma fatia de Diversos sem destino, e o rateio não fecharia. Com o Diversos fora do denominador, a soma bate exatamente em 100%, e cada real de Diversos é distribuído por inteiro entre os tipos.</p>' +
      '<h4>Onde esse % é usado</h4>' +
      '<table class="cda-tut-tabela cda-tut-tabela-campos"><tr><th>Uso</th><th>Onde aparece</th></tr>' +
      '<tr><td>Decidir quanto de Diversos cada tipo "merece"</td><td>Vendas por Tipo de Peça — coluna "Valor estim. (Diversos)"</td></tr>' +
      '<tr><td>Mostrado como referência (mesmo cálculo, empresa inteira)</td><td>Vendas por Tipo de Peça — coluna "% Participação Total Vendas"</td></tr>' +
      '</table>'
  },
  {
    id: 'qtd-estim-diversos', titulo: 'Como a "Qtd estim. (Diversos)" é calculada — passo a passo',
    html: '<p>Essa é a conta mais importante do módulo pra quem vai decidir compra de matéria-prima, e a mais fácil de calcular errado — teve 2 correções reais nessa fórmula em ago/2026 (documentadas abaixo). Aqui está o passo a passo completo, com o exemplo real do T-shirt.</p>' +
      '<h4>Passo 1 — Ratear o VALOR do Diversos pra esse tipo</h4>' +
      '<p><code>Valor estim. Diversos (tipo) = % Participação Total Vendas (tipo) × Valor total de Diversos do escopo</code></p>' +
      '<p>Exemplo: 42,90% × R$ 587.325,42 (Diversos, empresa inteira) = <b>R$ 251.942,99</b></p>' +
      '<h4>Passo 2 — Descobrir o preço médio REAL desse tipo</h4>' +
      '<p><code>Preço médio real (tipo) = Valor real do tipo ÷ Qtd real do tipo</code></p>' +
      '<p>Exemplo: R$ 954.097,22 ÷ 5.564 peças = <b>R$ 171,48/peça</b></p>' +
      '<h4>Passo 3 — Converter o valor estimado em peças, usando esse preço médio</h4>' +
      '<p><code>Qtd estim. Diversos (tipo) = Valor estim. Diversos (tipo) ÷ Preço médio real (tipo)</code></p>' +
      '<p>Exemplo: R$ 251.942,99 ÷ R$ 171,48 = <b>1.469,3 peças estimadas</b></p>' +
      '<p class="cda-tut-nota"><b>Por que dividir pelo preço, e não usar a "quantidade" salva nas linhas de Diversos?</b> Porque essa quantidade não é confiável — é contagem de pedido/linha de compra, não de peça física. Um pedido de revenda pode ter "quantidade = 1" no banco mesmo representando uma venda de 50 peças. Usar o preço médio real do tipo pra "traduzir" R$ em peças é a forma correta de estimar; usar a quantidade salva direto geraria um preço médio impossível (chegou a dar R$ 2.923/peça numa tentativa inicial errada, quando a fórmula usava a quantidade fictícia do Diversos em vez do preço médio real).</p>' +
      '<h4>Passo 4 — Somar com o real, pra chegar no total</h4>' +
      '<p><code>Qtd total (tipo) = Qtd real (tipo) + Qtd estim. Diversos (tipo)</code> → 5.564 + 1.469,3 = <b>7.033,3 peças</b></p>' +
      '<p><code>Valor total (tipo) = Valor real (tipo) + Valor estim. Diversos (tipo)</code> → R$ 954.097,22 + R$ 251.942,99 = <b>R$ 1.206.040,21</b></p>'
  },
  {
    id: 'vendas-por-canal', titulo: 'Vendas por Canal — o que muda em relação ao Tipo de Peça',
    html: '<p>Diferente do tipo de peça, o <b>canal do Diversos é dado real</b> (ver seção "O que é Diversos"). Por isso, no relatório Vendas por Canal, a lógica é mais simples: não existe rateio de canal, só de quantidade — a única estimativa é converter o valor do Diversos daquele canal em peças, usando o <b>preço médio da Collab inteira</b> (em vez do preço médio global da empresa — pra ficar estatisticamente mais estável dentro daquela Collab específica).</p>' +
      '<h4>Filtros</h4>' +
      '<table class="cda-tut-tabela cda-tut-tabela-campos"><tr><th>Filtro</th><th>Pra que serve</th></tr>' +
      '<tr><td><b>Collab/Artista</b></td><td>Obrigatório — escolhe de qual Collab (ex: Luedji Luna, Gilsons) você quer ver os canais.</td></tr>' +
      '<tr><td><b>Período</b></td><td>Livre, como nos outros submódulos.</td></tr>' +
      '<tr><td><b>Canal (opcional)</b></td><td>Drill-down num canal específico da Collab escolhida (ex: só "Shows Luedji Luna").</td></tr>' +
      '</table>' +
      '<h4>Tabela principal — por Canal</h4>' +
      '<p>Uma linha por canal da Collab escolhida: <b>Qtd real, Valor real, % da Collab</b> (esse canal ÷ soma de todos os canais da Collab — informativo, não usado em nenhum cálculo), <b>Valor Diversos (real)</b> — a soma direta do Diversos daquele canal específico (dado real, sem rateio), <b>Qtd estim. (Diversos)</b> — só essa é estimativa: <code>Valor Diversos (real) ÷ Preço médio da Collab</code>, e por fim <b>Qtd total / Valor total</b>.</p>' +
      '<h4>Tabela de baixo — Detalhamento por Tipo de Peça</h4>' +
      '<p>Escopada pela mesma Collab (e Canal, se você fez o drill-down) — mesma estrutura e fórmulas do submódulo Vendas por Tipo de Peça, só que limitada aos canais selecionados.</p>' +
      '<h4>"% Participação Total Vendas" nessa tabela de detalhamento</h4>' +
      '<p>Aqui o nome da coluna é o mesmo do outro submódulo, mas <b>a pergunta que ela responde é diferente</b>: <b>"desse tipo de peça, que fatia do total vendido pela empresa inteira veio dessa Collab/Canal?"</b></p>' +
      '<p><code>% Participação Total Vendas (canal, tipo) = Valor total do tipo NESSE canal/collab (real + Diversos) ÷ Valor total do tipo na EMPRESA INTEIRA (real + Diversos) × 100</code></p>' +
      '<p>Exemplo real: T-shirt vendido pela Luedji Luna = R$ 427.638,36 (todos os canais dela). T-shirt vendido pela empresa inteira = R$ 1.206.040,21. 427.638,36 ÷ 1.206.040,21 = <b>35,46%</b> — ou seja, mais de 1/3 de todo T-shirt vendido pela Ciclo da Arte passa pela Luedji Luna.</p>' +
      '<p class="cda-tut-nota">Essa conta é <b>por valor (R$)</b>, não por quantidade de peças — decisão confirmada com o CEO em ago/2026, depois de comparar as duas versões (por quantidade dava 33,07%, por valor dá 35,46% — a diferença existe porque o preço médio de T-shirt vendido pela Luedji é mais alto que a média da empresa).</p>'
  },
  {
    id: 'planejamento-compras', titulo: 'Planejamento de Compras — a fórmula final',
    html: '<p>É aqui que tudo se junta: usa a mesma função de rateio de Diversos (<code>cdaCalcularVendasPorTipoPeca</code>) do submódulo Vendas por Tipo de Peça, e adiciona uma camada de projeção pro trimestre que você quer comprar.</p>' +
      '<h4>Os dois grupos de filtro — completamente desacoplados por design</h4>' +
      '<table class="cda-tut-tabela"><tr><th>Filtro</th><th>Pra que serve</th></tr>' +
      '<tr><td><b>Período Estatístico Inicial/Final</b></td><td>Mede o <b>ritmo atual</b> da empresa — deve sempre ficar dentro do Ano de Exercício informado (ex: 01/01/2026 até hoje). Alimenta Qtd/Valor real, estimado, Total e Média Mensal.</td></tr>' +
      '<tr><td><b>Quadrante (Q1-Q4) + Ano de Exercício</b></td><td>Define a <b>âncora</b> da projeção — sempre o mesmo Quadrante, no ano (Ano de Exercício − 1). Não depende do Período Estatístico.</td></tr>' +
      '<tr><td><b>Canal</b></td><td>Opcional — filtra tudo (real, estimado e âncora) por um canal específico.</td></tr>' +
      '<tr><td><b>% Sugerido (simular)</b></td><td>Opcional — vazio usa a taxa calculada de cada tipo; preenchido, substitui a taxa de <b>todos</b> os tipos na projeção, de uma vez.</td></tr>' +
      '</table>' +
      '<h4>Passo 1 — Qx Ano Anterior (a âncora)</h4>' +
      '<p><code>Qx Ano Anterior = Qtd Total (real + estimada) do Quadrante escolhido, no ano (Ano de Exercício − 1)</code></p>' +
      '<p>Exemplo: Quadrante = Q4, Ano de Exercício = 2026 → busca Out-Dez/<b>2025</b>. Pro T-shirt: 547 peças reais + 96,1 estimadas de Diversos = <b>643 peças</b>.</p>' +
      '<h4>Passo 2 — % Taxa Cresc. Ano Anterior</h4>' +
      '<p>Compara o Período Estatístico contra o <b>mesmo intervalo de mês/dia, fixado no ano (Ano de Exercício − 1)</b> — não "1 ano antes do período" cru, porque isso daria errado se o período filtrado caísse num ano diferente do Ano de Exercício.</p>' +
      '<p><code>% Taxa Cresc. Ano Anterior = Qtd Total do Período Estatístico (Ano de Exercício) ÷ Qtd Total do MESMO intervalo de mês/dia (Ano de Exercício − 1) − 1</code></p>' +
      '<p>Exemplo: Período = 01/01 a 30/06/2026 (Ano de Exercício 2026) → compara contra 01/01 a 30/06/<b>2025</b>. T-shirt: 1.061,4 peças (2026) ÷ 631,8 peças (2025) − 1 = <b>68,0%</b>.</p>' +
      '<p class="cda-tut-nota">Tipo sem venda no mesmo intervalo do ano anterior → usa a Taxa de Crescimento <b>geral da empresa</b> (mesma fórmula, todos os tipos somados) — marcado "(geral)" na tela.</p>' +
      '<h4>Passo 3 — Projeção final</h4>' +
      '<p><code>Qtd projetada Qx (sugerido) = Qx Ano Anterior × (1 + %usado ÷ 100)</code>, onde <b>%usado</b> é o valor do filtro "% Sugerido (simular)" se estiver preenchido (aplicado igual pra todos os tipos), ou a "% Taxa Cresc. Ano Anterior" calculada de cada tipo, se o filtro estiver vazio.</p>' +
      '<p><code>Valor projetado Qx (sugerido) = Qtd projetada × Preço médio real do tipo no Período Estatístico</code></p>' +
      '<p>Exemplo (sem o filtro preenchido): 643 × (1 + 68,0%) = <b>1.080,5 peças</b> projetadas pro Q4/2026.</p>' +
      '<p class="cda-tut-nota">A coluna "% Taxa Cresc. Ano Anterior" sempre mostra o número real calculado, mesmo com o filtro "% Sugerido" preenchido — ela é referência histórica, nunca é sobrescrita. Sem limite de faixa — o número real sempre aparece, mesmo que pareça alto/baixo demais, porque não dá pra saber se um tipo é sazonalmente novo ou está passando por uma mudança real de patamar.</p>' +
      '<h4>Erros já cometidos e corrigidos nessa fórmula (pra não repetir)</h4>' +
      '<p>1) Uma versão inicial comparava o Período Estatístico contra "o resto do próprio ano" (jan-set vs. Q4) — foi trocada porque não usava o dado mais recente disponível.</p>' +
      '<p>2) Uma versão testou "Período Estatístico ÷ Âncora" como taxa — só dá um número coerente quando as duas janelas têm o mesmo tamanho/época por coincidência; foi descartada.</p>' +
      '<p>3) Uma versão testou "Âncora ÷ Total do ano inteiro" (peso sazonal) como se fosse taxa de crescimento — mas isso sempre gera número positivo, inflando a projeção pra cima mesmo quando as vendas estão caindo; foi descartada.</p>' +
      '<p>4) A versão final (documentada acima) foi validada comparando manualmente os números com o CEO em vários cenários reais antes de ser fixada.</p>'
  }
];

async function montarModuloTutorialEstoque(containerId) {
  var host = document.getElementById(containerId);
  if (!host) { console.error('cda-modulo-tutorial-estoque: container #' + containerId + ' não encontrado'); return; }

  host.innerHTML =
    '<style>' +
      '.cda-tut-wrap{display:flex;gap:20px;align-items:flex-start;}' +
      '.cda-tut-nav{min-width:180px;position:sticky;top:12px;}' +
      '.cda-tut-nav a{display:block;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;padding:7px 10px;color:var(--muted,#888);text-decoration:none;border-left:2px solid transparent;}' +
      '.cda-tut-nav a:hover{color:var(--ink,#1a1a1a);border-left-color:var(--ink,#1a1a1a);}' +
      '.cda-tut-conteudo{flex:1;max-width:760px;}' +
      '.cda-tut-secao{background:var(--paper,#fff);border:2px solid var(--ink,#1a1a1a);padding:20px 24px;margin-bottom:18px;}' +
      '.cda-tut-secao h2{font-size:16px;margin:0 0 12px;}' +
      '.cda-tut-secao h4{font-size:12px;text-transform:uppercase;letter-spacing:.4px;margin:16px 0 6px;}' +
      '.cda-tut-secao p{font-size:12px;line-height:1.6;margin:0 0 10px;}' +
      '.cda-tut-nota{background:var(--card,#f5f0e8);border-left:3px solid var(--rust,#c0392b);padding:8px 12px;font-size:11px !important;}' +
      '.cda-tut-tabela{width:100%;border-collapse:collapse;font-size:11px;margin:8px 0 12px;}' +
      '.cda-tut-tabela th,.cda-tut-tabela td{border:1px solid var(--border2,#ccc);padding:6px 8px;text-align:left;vertical-align:top;}' +
      '.cda-tut-tabela th{background:var(--card,#f5f0e8);text-transform:uppercase;font-size:9px;letter-spacing:.4px;}' +
      '.cda-tut-comentario{background:var(--card,#f5f0e8);border:1px solid var(--border2,#ccc);padding:10px 12px;font-size:11px;margin-bottom:8px;white-space:pre-wrap;}' +
      '.cda-tut-comentario b{display:block;font-size:9px;text-transform:uppercase;color:var(--muted,#888);margin-bottom:4px;}' +
      '.cda-tut-secao code{background:var(--card,#f5f0e8);border:1px solid var(--border2,#ccc);padding:1px 5px;border-radius:3px;font-size:10.5px;}' +
      '.cda-tut-tabela-campos td:first-child{width:55%;}' +
    '</style>' +
    '<div class="row-bt">' +
      '<div><div class="sec-t">📘 Tutorial</div><div class="sec-d">Manual de uso e regras de negócio — módulo Estoque</div></div>' +
      '<div style="display:flex;gap:7px;">' +
        '<button class="btn" id="tute-btn-exportar">⬇ Baixar em Word</button>' +
        '<input type="file" id="tute-input-importar" accept=".docx" style="display:none">' +
        '<button class="btn rust" id="tute-btn-importar">⬆ Importar Comentários</button>' +
      '</div>' +
    '</div>' +
    '<div class="cda-tut-wrap">' +
      '<div class="cda-tut-nav" id="tute-nav"></div>' +
      '<div class="cda-tut-conteudo" id="tute-conteudo"></div>' +
    '</div>';

  var nav = host.querySelector('#tute-nav');
  nav.innerHTML = CDA_TUTORIAL_ESTOQUE_CONTEUDO.map(function (s) { return '<a href="#tute-' + s.id + '">' + s.titulo + '</a>'; }).join('') +
    '<a href="#tute-comentarios">Comentários da Equipe</a>';

  var corpo = host.querySelector('#tute-conteudo');
  corpo.innerHTML = CDA_TUTORIAL_ESTOQUE_CONTEUDO.map(function (s) {
    return '<div class="cda-tut-secao" id="tute-' + s.id + '"><h2>' + s.titulo + '</h2>' + s.html + '</div>';
  }).join('') +
    '<div class="cda-tut-secao" id="tute-comentarios"><h2>💬 Comentários da Equipe</h2><div id="tute-comentarios-lista"><p class="tmu">Carregando...</p></div></div>';

  async function carregarComentarios() {
    var box = host.querySelector('#tute-comentarios-lista');
    try {
      var comentarios = await cdaCarregarComentariosTutorial('estoque');
      box.innerHTML = comentarios.length ? comentarios.map(function (c) {
        var d = new Date(c.importadoEm);
        return '<div class="cda-tut-comentario"><b>' + d.toLocaleDateString('pt-BR') + ' — ' + (c.importadoPor || 'Usuário') + (c.arquivoOrigem ? ' · ' + c.arquivoOrigem : '') + '</b>' + c.conteudo + '</div>';
      }).join('') : '<p class="tmu">Nenhum comentário importado ainda. Baixe o manual em Word, escreva abaixo da linha "' + CDA_TUTORIAL_ESTOQUE_MARCADOR + '" e importe de volta aqui.</p>';
    } catch (err) {
      console.error(err);
      box.innerHTML = '<p style="color:var(--rust,#c0392b)">Erro ao carregar comentários.</p>';
    }
  }
  carregarComentarios();

  // ── Exportar em Word ────────────────────────────────────────────────
  function gerarHtmlWord() {
    var corpoHtml = CDA_TUTORIAL_ESTOQUE_CONTEUDO.map(function (s) {
      return '<h2>' + s.titulo + '</h2>' + s.html.replace(/class="cda-tut-nota"/g, '').replace(/<table class="cda-tut-tabela[^"]*">/g, '<table border="1" cellpadding="4" cellspacing="0">').replace(/<code>/g, '<code style="background:#eee;padding:1px 4px;">');
    }).join('');
    var hoje = new Date().toLocaleDateString('pt-BR');
    return '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">' +
      '<head><meta charset="utf-8"><title>Manual do Estoque — Ciclo da Arte</title></head>' +
      '<body style="font-family:Calibri,Arial,sans-serif;font-size:11pt;">' +
      '<h1>Manual do Estoque — Ciclo da Arte</h1>' +
      '<p><i>Vendas por Tipo de Peça, Vendas por Canal e Planejamento de Compras — gerado em ' + hoje + '</i></p>' +
      corpoHtml +
      '<h1>' + CDA_TUTORIAL_ESTOQUE_MARCADOR + '</h1>' +
      '<p><i>Escreva seus comentários, dúvidas ou correções abaixo desta linha. Ao salvar e reimportar este arquivo na tela do Tutorial, tudo que estiver aqui embaixo é salvo automaticamente. Edições feitas ACIMA desta linha (no conteúdo original) não são aplicadas automaticamente — servem só de referência.</i></p>' +
      '<p>&nbsp;</p><p>&nbsp;</p>' +
      '</body></html>';
  }
  host.querySelector('#tute-btn-exportar').addEventListener('click', function () {
    var blob = new Blob(['\ufeff', gerarHtmlWord()], { type: 'application/msword' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = 'Manual_Estoque_Ciclo_da_Arte.doc';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  // ── Importar comentários ────────────────────────────────────────────
  function carregarMammothSeNecessario() {
    if (window.mammoth) return Promise.resolve();
    return new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.11.0/mammoth.browser.min.js';
      script.onload = resolve;
      script.onerror = function () { reject(new Error('Não foi possível carregar a biblioteca de leitura de Word.')); };
      document.head.appendChild(script);
    });
  }

  host.querySelector('#tute-btn-importar').addEventListener('click', function () { host.querySelector('#tute-input-importar').click(); });
  host.querySelector('#tute-input-importar').addEventListener('change', async function () {
    var file = this.files && this.files[0];
    if (!file) return;
    var btn = host.querySelector('#tute-btn-importar');
    btn.textContent = 'Lendo arquivo...'; btn.disabled = true;
    try {
      await carregarMammothSeNecessario();
      var arrayBuffer = await file.arrayBuffer();
      var resultado = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
      var textoCompleto = resultado.value || '';
      var idx = textoCompleto.indexOf(CDA_TUTORIAL_ESTOQUE_MARCADOR);
      if (idx === -1) {
        alert('Não encontrei a linha "' + CDA_TUTORIAL_ESTOQUE_MARCADOR + '" nesse arquivo — importe o .doc baixado por este Tutorial (ou mantenha essa linha ao editar).');
        return;
      }
      var apos = textoCompleto.slice(idx + CDA_TUTORIAL_ESTOQUE_MARCADOR.length);
      apos = apos.replace(/Escreva seus comentários[\s\S]*?só de referência\.\s*/, '').trim();
      if (!apos) { alert('Não encontrei nenhum comentário escrito abaixo da linha "' + CDA_TUTORIAL_ESTOQUE_MARCADOR + '".'); return; }
      await cdaSalvarComentarioTutorial({ conteudo: apos, arquivoOrigem: file.name, importadoPor: (window.cu && window.cu.name) || 'Usuário', modulo: 'estoque' });
      this.value = '';
      await carregarComentarios();
      alert('Comentário importado com sucesso!');
    } catch (err) {
      console.error(err);
      alert('Erro ao importar — ' + (err.message || err));
    } finally {
      btn.textContent = '⬆ Importar Comentários'; btn.disabled = false;
    }
  });
}

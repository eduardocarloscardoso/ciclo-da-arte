// ════════════════════════════════════════════════════════════════════
// cda-modulo-planejamento-compras.js
// Módulo Estoque → submódulo "Planejamento de Compras".
// Projeta a compra de matéria-prima por tipo de peça para qualquer
// Quadrante (Q1-Q4) e Ano de Exercício escolhidos, com base no
// histórico de vendas a VAREJO (exclui sempre o canal Private Label).
//
// Metodologia final (ago/2026, validada com o CEO) — duas coisas
// ligadas pelo mesmo Ano de Exercício, mas medindo coisas diferentes:
// 1) O "Período Estatístico" (Inicial/Final) — DEVE estar dentro do
//    Ano de Exercício informado — mede o RITMO ATUAL da empresa:
//    Qtd/Valor real, estimado (Diversos — mesmo rateio de
//    cdaCalcularVendasPorTipoPeca dos outros 2 submódulos de Estoque),
//    Qtd/Valor Total e Média Mensal (soma real + estimado, ÷ meses do
//    período). Também a "% Taxa Cresc. Ano Anterior", comparando esse
//    período contra o MESMO intervalo de mês/dia, fixado no ano (Ano
//    de Exercício − 1) — não "1 ano antes do período" cru, pra não
//    dar resultado errado se o período filtrado cair num ano diferente
//    do Ano de Exercício.
// 2) O "Quadrante" (Q1-Q4) + "Ano de Exercício" definem a ÂNCORA da
//    projeção ("Qx Ano Anterior"): sempre o mesmo quadrante, no ano
//    (Ano de Exercício − 1) — mesma base de ano da comparação acima.
// Projeção final = Âncora × (1 + % Taxa Cresc. Ano Anterior). Fallback
// (tipo sem venda no mesmo intervalo do ano anterior): usa a taxa
// geral da empresa — marcado "(geral)" na tela. Sem limite de faixa.
//
// Somente leitura — não grava nada no banco.
// Requer cda-dados-compartilhados.js carregado antes.
// ════════════════════════════════════════════════════════════════════

var CDA_CANAL_PRIVATE_LABEL_ID = '1778540708657';

async function montarModuloPlanejamentoCompras(containerId) {
  var host = document.getElementById(containerId);
  if (!host) { console.error('cda-modulo-planejamento-compras: container #' + containerId + ' não encontrado'); return; }

  host.innerHTML =
    '<style>' +
      '.cdapc-note{background:var(--card,#f5f0e8);border:2px solid var(--ink,#1a1a1a);padding:12px 14px;font-size:11.5px;color:var(--muted,#888);margin-bottom:14px;line-height:1.6;box-sizing:border-box;width:100%;overflow-wrap:break-word;word-break:break-word;white-space:normal;}' +
      '.cdapc-note b{color:var(--ink,#1a1a1a);}' +
      '.cdapc-filtros{display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;margin-bottom:14px;}' +
      '.cdapc-fg{display:flex;flex-direction:column;gap:3px;}' +
      '.cdapc-fg label{font-size:9px;text-transform:uppercase;letter-spacing:1px;color:var(--muted,#888);}' +
      '.cdapc-fg input,.cdapc-fg select{padding:7px 9px;border:2px solid var(--ink,#1a1a1a);background:var(--paper,#fff);font-family:inherit;font-size:12px;}' +
      '.cdapc-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px;}' +
      '.cdapc-kpi{background:var(--card,#f5f0e8);border:2px solid var(--ink,#1a1a1a);padding:12px;text-align:center;}' +
      '.cdapc-kpi .v{font-family:"DM Serif Display",serif;font-size:20px;line-height:1;}' +
      '.cdapc-kpi .l{font-size:9px;text-transform:uppercase;letter-spacing:1px;color:var(--muted,#888);margin-top:4px;}' +
      '@media(max-width:760px){.cdapc-kpis{grid-template-columns:1fr 1fr;}}' +
      '.cdapc-tbl-wrap{overflow-x:auto;}' +
      '.cdapc-tbl{width:100%;border-collapse:collapse;font-size:11.5px;min-width:1080px;}' +
      '.cdapc-tbl th{text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:.5px;color:var(--muted,#888);padding:8px 8px;border-bottom:2px solid var(--ink,#1a1a1a);white-space:nowrap;}' +
      '.cdapc-tbl td{padding:7px 8px;border-bottom:1px solid var(--border2,#e0dbd0);white-space:nowrap;}' +
      '.cdapc-tbl tr.total td{border-top:2px solid var(--ink,#1a1a1a);border-bottom:none;font-weight:700;background:var(--card,#f5f0e8);}' +
      '.cdapc-num{text-align:right;font-family:var(--ff-m,monospace);}' +
      '.cdapc-sim-input{width:64px;padding:4px 6px;border:1.5px solid var(--border2,#cfc8ba);font-family:var(--ff-m,monospace);font-size:11px;text-align:right;}' +
      '.cdapc-sim-input:focus{border-color:var(--ink,#1a1a1a);outline:none;}' +
      '.cdapc-pct-geral{font-size:9px;color:var(--muted,#888);font-weight:400;}' +
    '</style>' +
    '<div class="row-bt">' +
      '<div><div class="sec-t">📈 Planejamento de Compras</div><div class="sec-d">Projeção de compra de matéria-prima por tipo de peça para o quadrante (Q1-Q4) e ano de exercício escolhidos, com base no histórico de vendas a varejo</div></div>' +
      '<button class="btn" id="cdapc-btn-exp">⬇ Exportar XLSX</button>' +
    '</div>' +
    '<div class="cdapc-note" id="cdapc-nota">Carregando dados...</div>' +
    '<div class="cdapc-filtros">' +
      '<div class="cdapc-fg"><label>Período Estatístico Inicial</label><input type="date" id="cdapc-f-ini"></div>' +
      '<div class="cdapc-fg"><label>Período Estatístico Final</label><input type="date" id="cdapc-f-fim"></div>' +
      '<div class="cdapc-fg" style="min-width:110px"><label>Quadrante a simular</label><select id="cdapc-f-quad">' +
        '<option value="Q1">Q1 (Jan-Mar)</option><option value="Q2">Q2 (Abr-Jun)</option><option value="Q3">Q3 (Jul-Set)</option><option value="Q4" selected>Q4 (Out-Dez)</option>' +
      '</select></div>' +
      '<div class="cdapc-fg" style="min-width:120px"><label>Ano de Exercício</label><input type="number" id="cdapc-f-ano" step="1" style="width:100px"></div>' +
      '<div class="cdapc-fg" style="min-width:170px"><label>Canal</label><select id="cdapc-f-canal"><option value="">Todos (exceto Private Label)</option></select></div>' +
      '<div class="cdapc-fg" style="min-width:130px"><label>% Sugerido (simular)</label><input type="number" step="0.1" id="cdapc-f-pctsug" placeholder="auto"></div>' +
    '</div>' +
    '<div class="cdapc-kpis" id="cdapc-kpis"></div>' +
    '<div class="tw"><div class="th"><h3>Projeção por Tipo de Peça — 4º Trimestre (Out–Dez)</h3></div>' +
      '<div class="cdapc-tbl-wrap"><table class="cdapc-tbl">' +
        '<thead><tr>' +
          '<th>Tipo de Peça</th>' +
          '<th class="cdapc-num">Qtd vendida</th>' +
          '<th class="cdapc-num">Qtd Estimada</th>' +
          '<th class="cdapc-num">Qtd Total (Real + Estimada)</th>' +
          '<th class="cdapc-num">Valor vendido</th>' +
          '<th class="cdapc-num">Valor Estimado</th>' +
          '<th class="cdapc-num">Valor Total (Real + Estimado)</th>' +
          '<th class="cdapc-num">Média Mensal (Qtd)</th>' +
          '<th class="cdapc-num">Qx Ano Anterior</th>' +
          '<th class="cdapc-num">% Taxa Cresc. Ano Anterior</th>' +
          '<th class="cdapc-num">Qtd projetada Qx (sugerido)</th>' +
          '<th class="cdapc-num">Valor projetado Qx (sugerido)</th>' +
        '</tr></thead>' +
        '<tbody id="cdapc-tb"></tbody>' +
      '</table></div>' +
    '</div>';

  var ST = { compras: [], produtos: [], canais: [], tipos: [] };
  try {
    var res = await Promise.all([cdaCarregarCompras(), cdaCarregarProdutos(), cdaCarregarCanais(), cdaCarregarTiposProduto()]);
    ST.compras = res[0]; ST.produtos = res[1]; ST.canais = res[2]; ST.tipos = res[3];
  } catch (err) {
    console.error(err);
    host.querySelector('#cdapc-nota').textContent = 'Erro ao carregar dados do Supabase. Veja o console.';
    return;
  }

  var produtoById = {}; ST.produtos.forEach(function (p) { produtoById[String(p.id)] = p; });
  var canalById = {}; ST.canais.forEach(function (c) { canalById[String(c.id)] = c; });

  function tipoDe(compra) {
    var p = produtoById[compra.produtoId];
    return (p && p.tipo) ? p.tipo : 'Sem tipo';
  }
  function valorDe(compra) {
    if (compra.valorTotal != null) return Number(compra.valorTotal) || 0;
    if (compra.valorBruto != null) return Number(compra.valorBruto) || 0;
    return 0;
  }

  // Base de cálculo: sempre exclui Private Label, independente do filtro de canal escolhido.
  var comprasVarejo = ST.compras.filter(function (c) {
    return c.dataCompra && String(c.canalId) !== CDA_CANAL_PRIVATE_LABEL_ID;
  });

  // ── Nova metodologia de projeção, universal por Quadrante (ago/2026) ──
  // Duas coisas completamente desacopladas, por design (validado com o CEO):
  // 1) O "Período Estatístico" (dataIni/dataFim) mede o RITMO ATUAL da
  //    empresa: Qtd/Valor real, estimado (Diversos) e Média Mensal — e
  //    também a Taxa de Crescimento, comparando esse período contra o
  //    mesmo intervalo de dias um ano antes. Pode ser qualquer janela
  //    (não precisa ser um trimestre inteiro, nem estar "fechada").
  // 2) O "Quadrante" (Q1-Q4) + "Ano de Exercício" definem a ÂNCORA da
  //    projeção: sempre o mesmo quadrante, no ano (Ano de Exercício − 1)
  //    — independente de qual período estatístico foi filtrado.
  // A projeção final = Âncora (Qx do ano anterior ao exercício) ×
  // (1 + Taxa de Crescimento do Período Estatístico).
  // Fallback (tipo sem venda no mesmo intervalo do ano anterior): usa a
  // Taxa de Crescimento geral da empresa. Sem limite de faixa.
  function rangeQuadrante(ano, quad) {
    if (quad === 'Q1') return { ini: ano + '-01-01', fim: ano + '-03-31' };
    if (quad === 'Q2') return { ini: ano + '-04-01', fim: ano + '-06-30' };
    if (quad === 'Q3') return { ini: ano + '-07-01', fim: ano + '-09-30' };
    return { ini: ano + '-10-01', fim: ano + '-12-31' }; // Q4
  }
  // Reaplica o mesmo mês/dia do Período Estatístico, mas no ano informado —
  // usado pra fixar a comparação sempre em (Ano de Exercício − 1), em vez de
  // "1 ano antes do período" (que ficaria errado se o usuário filtrar um
  // período estatístico de um ano diferente do Ano de Exercício).
  function mesmoMesDiaEmAno(dataISO, anoAlvo) {
    var partes = dataISO.split('-');
    return anoAlvo + '-' + partes[1] + '-' + partes[2];
  }
  function calcularCrescimentoEAncora(dataIni, dataFim, fCanal, quadrante, anoExercicio) {
    var anoRefQuad = anoExercicio - 1; // âncora e comparação de crescimento sempre no ano anterior ao exercício
    var dataIniAnt = mesmoMesDiaEmAno(dataIni, anoRefQuad), dataFimAnt = mesmoMesDiaEmAno(dataFim, anoRefQuad);
    var rq = rangeQuadrante(anoRefQuad, quadrante);

    var resAtual = cdaCalcularVendasPorTipoPeca({ compras: ST.compras, produtoById: produtoById, dataIni: dataIni, dataFim: dataFim, canalId: fCanal || null });
    var resAnoAnt = cdaCalcularVendasPorTipoPeca({ compras: ST.compras, produtoById: produtoById, dataIni: dataIniAnt, dataFim: dataFimAnt, canalId: fCanal || null });
    var resQuadAnt = cdaCalcularVendasPorTipoPeca({ compras: ST.compras, produtoById: produtoById, dataIni: rq.ini, dataFim: rq.fim, canalId: fCanal || null });

    var qtdAtualPorTipo = {}, precoMedioAtualPorTipo = {};
    resAtual.linhas.forEach(function (l) { qtdAtualPorTipo[l.tipo] = l.qtdTotal; precoMedioAtualPorTipo[l.tipo] = l.precoMedioReal; });
    var qtdAnoAntPorTipo = {};
    resAnoAnt.linhas.forEach(function (l) { qtdAnoAntPorTipo[l.tipo] = l.qtdTotal; });
    var qtdQuadAntPorTipo = {}, precoMedioQuadAntPorTipo = {};
    resQuadAnt.linhas.forEach(function (l) { qtdQuadAntPorTipo[l.tipo] = l.qtdTotal; precoMedioQuadAntPorTipo[l.tipo] = l.precoMedioReal; });

    var taxaGeral = resAnoAnt.totais.qtdTotal > 0 ? (resAtual.totais.qtdTotal / resAnoAnt.totais.qtdTotal - 1) * 100 : 0;
    var precoMedioGeralAtual = resAtual.totais.qtdReal > 0 ? resAtual.totais.valorReal / resAtual.totais.qtdReal : 0;

    return {
      anoRefQuad: anoRefQuad, quadrante: quadrante, taxaGeral: taxaGeral,
      taxaPorTipo: function (tipo) {
        var atual = qtdAtualPorTipo[tipo] || 0, ant = qtdAnoAntPorTipo[tipo] || 0;
        return ant > 0 ? (atual / ant - 1) * 100 : null;
      },
      qtdAncora: function (tipo) { return qtdQuadAntPorTipo[tipo] || 0; },
      precoMedio: function (tipo) {
        return precoMedioAtualPorTipo[tipo] || precoMedioQuadAntPorTipo[tipo] || precoMedioGeralAtual;
      }
    };
  }

  // ── Popular filtro de canal (informativo — Private Label sempre fica de fora) ──
  var selCanal = host.querySelector('#cdapc-f-canal');
  selCanal.innerHTML += ST.canais.filter(function (c) { return String(c.id) !== CDA_CANAL_PRIVATE_LABEL_ID; })
    .slice().sort(function (a, b) { return a.nome.localeCompare(b.nome); })
    .map(function (c) { return '<option value="' + c.id + '">' + c.nome + '</option>'; }).join('');
  var selQuad = host.querySelector('#cdapc-f-quad');
  var inpAno = host.querySelector('#cdapc-f-ano');
  var inpPctSug = host.querySelector('#cdapc-f-pctsug');

  // ── Datas padrão: 1º de janeiro do ano corrente até a data mais recente disponível na base ──
  var datasDisponiveis = comprasVarejo.map(function (c) { return c.dataCompra; }).sort();
  var dataMaisRecente = datasDisponiveis.length ? datasDisponiveis[datasDisponiveis.length - 1] : new Date().toISOString().slice(0, 10);
  var anoCorrente = dataMaisRecente.slice(0, 4);
  var inpIni = host.querySelector('#cdapc-f-ini'), inpFim = host.querySelector('#cdapc-f-fim');
  inpIni.value = anoCorrente + '-01-01';
  inpFim.value = dataMaisRecente;
  inpAno.value = new Date().getFullYear(); // Ano de Exercício padrão: ano corrente de verdade (hoje), não o da base de dados

  host.querySelector('#cdapc-nota').innerHTML =
    '📌 Base de cálculo: apenas vendas a <b>varejo</b> — o canal <b>Private Label</b> (atacado) é sempre excluído. ' +
    'Último dado de venda disponível no sistema: <b>' + fmtDataBR(dataMaisRecente) + '</b>. ' +
    'O Período Estatístico mede o ritmo atual (Qtd/Valor/Média Mensal) e deve sempre estar dentro do Ano de Exercício informado. ' +
    '<b>Fórmula do "% Taxa Cresc. Ano Anterior"</b>: [Qtd Total do Período Estatístico (no Ano de Exercício) ÷ Qtd Total do MESMO intervalo de mês/dia, fixado no ano (Ano de Exercício − 1)] − 1 — nunca "1 ano antes do período" cru, sempre baseado no Ano de Exercício, pra não dar errado se o período filtrado cair num ano diferente do exercício. Tipo sem venda no mesmo intervalo do ano anterior usa a taxa geral da empresa (marcado "(geral)" na tela). ' +
    'O Quadrante + Ano de Exercício definem a âncora da projeção ("Qx Ano Anterior"): sempre o mesmo quadrante, no ano (Ano de Exercício − 1) — independente do Período Estatístico filtrado. ' +
    'O filtro <b>"% Sugerido (simular)"</b> é opcional: vazio, cada tipo usa sua própria Taxa de Crescimento calculada; preenchido, esse % substitui a taxa de <b>todos</b> os tipos na projeção (útil pra simular um cenário só). A coluna "% Taxa Cresc. Ano Anterior" sempre mostra o número real calculado, mesmo simulando.';

  function fmtDataBR(iso) { if (!iso) return '—'; var p = iso.split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }
  function fmtMoeda(v) { return 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function fmtQtd(v) { return Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 }); }
  function mesesEntre(iniISO, fimISO) {
    var ai = parseInt(iniISO.slice(0, 4), 10), mi = parseInt(iniISO.slice(5, 7), 10);
    var af = parseInt(fimISO.slice(0, 4), 10), mf = parseInt(fimISO.slice(5, 7), 10);
    var n = (af - ai) * 12 + (mf - mi) + 1;
    return n > 0 ? n : 1;
  }

  var ULTIMO_CALC = []; // guarda linhas calculadas pra exportação

  function calcularLinhas() {
    var dataIni = inpIni.value, dataFim = inpFim.value;
    var fCanal = selCanal.value;
    var quadrante = selQuad.value || 'Q4';
    var anoExercicio = parseInt(inpAno.value, 10) || new Date().getFullYear();
    if (!dataIni || !dataFim) return [];
    var nMeses = mesesEntre(dataIni, dataFim);

    var resultadoBase = cdaCalcularVendasPorTipoPeca({
      compras: ST.compras, produtoById: produtoById,
      dataIni: dataIni, dataFim: dataFim, canalId: fCanal || null
    });
    var porTipo = {}; // tipo -> {qtd, valor, qtdEstimadaDiversos, valorEstimadoDiversos}
    ST.tipos.filter(function (t) { return t !== 'Diversos'; }).forEach(function (t) {
      porTipo[t] = { qtd: 0, valor: 0, qtdEstimadaDiversos: 0, valorEstimadoDiversos: 0 };
    });
    resultadoBase.linhas.forEach(function (l) {
      porTipo[l.tipo] = {
        qtd: l.qtdReal, valor: l.valorReal,
        qtdEstimadaDiversos: l.qtdEstimadaDiversos, valorEstimadoDiversos: l.valorEstimadoDiversos
      };
    });

    var CRESC = calcularCrescimentoEAncora(dataIni, dataFim, fCanal, quadrante, anoExercicio);
    var pctSugGlobal = inpPctSug.value.trim(); // filtro "% Sugerido (simular)" — vazio = usa a taxa calculada de cada tipo
    var temPctSugGlobal = pctSugGlobal !== '';

    var linhas = Object.keys(porTipo).map(function (tipo) {
      var d = porTipo[tipo];
      // Média Mensal soma a Qtd vendida (real) + Qtd Estimada (Diversos), dividido pelos meses do período.
      var mediaMensalQtd = (d.qtd + d.qtdEstimadaDiversos) / nMeses;
      var taxaTipo = CRESC.taxaPorTipo(tipo);
      var usouGeral = taxaTipo == null;
      // "% Taxa Cresc. Ano Anterior" SEMPRE mostra o número real calculado (referência histórica),
      // mesmo quando o filtro "% Sugerido" estiver preenchido pra simular outro cenário.
      var pctSug = usouGeral ? CRESC.taxaGeral : taxaTipo;
      var qtdAncora = CRESC.qtdAncora(tipo);
      var precoMedio = CRESC.precoMedio(tipo);
      // A projeção usa o % do filtro (se preenchido, aplicado igual pra todos os tipos) ou o pctSug calculado.
      var pctUsadoNaProjecao = temPctSugGlobal ? Number(pctSugGlobal) : pctSug;
      var qtdProjSug = qtdAncora * (1 + pctUsadoNaProjecao / 100);
      var valorProjSug = qtdProjSug * precoMedio;
      return {
        tipo: tipo, qtd: d.qtd, valor: d.valor,
        qtdEstimadaDiversos: d.qtdEstimadaDiversos, valorEstimadoDiversos: d.valorEstimadoDiversos,
        qtdTotal: d.qtd + d.qtdEstimadaDiversos, valorTotal: d.valor + d.valorEstimadoDiversos,
        mediaMensalQtd: mediaMensalQtd, qtdAncora: qtdAncora, anoRefQuad: CRESC.anoRefQuad, quadrante: CRESC.quadrante,
        pctSug: pctSug, usouGeral: usouGeral, qtdProjSug: qtdProjSug, valorProjSug: valorProjSug
      };
    }).filter(function (l) { return l.qtd > 0 || l.qtdEstimadaDiversos > 0 || l.mediaMensalQtd > 0; })
      .sort(function (a, b) { return b.qtd - a.qtd; });

    return linhas;
  }

  function renderKpis(linhas) {
    var totQtdTotal = linhas.reduce(function (s, l) { return s + l.qtdTotal; }, 0);
    var totValorTotal = linhas.reduce(function (s, l) { return s + l.valorTotal; }, 0);
    var totProjSug = linhas.reduce(function (s, l) { return s + l.qtdProjSug; }, 0);
    var totValorProjSug = linhas.reduce(function (s, l) { return s + l.valorProjSug; }, 0);
    host.querySelector('#cdapc-kpis').innerHTML =
      '<div class="cdapc-kpi"><div class="v">' + fmtQtd(totQtdTotal) + '</div><div class="l">Quantidade Total (Real + Est)</div></div>' +
      '<div class="cdapc-kpi"><div class="v">' + fmtMoeda(totValorTotal) + '</div><div class="l">Valor Total (Real + Est)</div></div>' +
      '<div class="cdapc-kpi"><div class="v">' + fmtQtd(totProjSug) + '</div><div class="l">Peças projetadas p/ Qx (sugerido)</div></div>' +
      '<div class="cdapc-kpi"><div class="v">' + fmtMoeda(totValorProjSug) + '</div><div class="l">Valor projetado p/ Qx (sugerido)</div></div>';
  }

  function render() {
    var linhas = calcularLinhas();
    ULTIMO_CALC = linhas;
    renderKpis(linhas);
    var tb = host.querySelector('#cdapc-tb');
    tb.innerHTML = linhas.map(function (l) {
      return '<tr>' +
        '<td>' + l.tipo + '</td>' +
        '<td class="cdapc-num">' + fmtQtd(l.qtd) + '</td>' +
        '<td class="cdapc-num">' + fmtQtd(l.qtdEstimadaDiversos) + '</td>' +
        '<td class="cdapc-num"><b>' + fmtQtd(l.qtdTotal) + '</b></td>' +
        '<td class="cdapc-num">' + fmtMoeda(l.valor) + '</td>' +
        '<td class="cdapc-num">' + fmtMoeda(l.valorEstimadoDiversos) + '</td>' +
        '<td class="cdapc-num"><b>' + fmtMoeda(l.valorTotal) + '</b></td>' +
        '<td class="cdapc-num">' + fmtQtd(l.mediaMensalQtd) + '</td>' +
        '<td class="cdapc-num">' + fmtQtd(l.qtdAncora) + '</td>' +
        '<td class="cdapc-num">' + l.pctSug.toFixed(1) + '%' + (l.usouGeral ? ' <span class="cdapc-pct-geral">(geral)</span>' : '') + '</td>' +
        '<td class="cdapc-num"><b>' + fmtQtd(l.qtdProjSug) + '</b></td>' +
        '<td class="cdapc-num"><b>' + fmtMoeda(l.valorProjSug) + '</b></td>' +
      '</tr>';
    }).join('') || '<tr><td colspan="13" style="text-align:center;color:var(--muted);padding:20px">Nenhuma venda no período/canal selecionado.</td></tr>';

    var totQtd = linhas.reduce(function (s, l) { return s + l.qtd; }, 0);
    var totQtdEstDiv = linhas.reduce(function (s, l) { return s + l.qtdEstimadaDiversos; }, 0);
    var totQtdTotal = linhas.reduce(function (s, l) { return s + l.qtdTotal; }, 0);
    var totValor = linhas.reduce(function (s, l) { return s + l.valor; }, 0);
    var totValorEstDiv = linhas.reduce(function (s, l) { return s + l.valorEstimadoDiversos; }, 0);
    var totValorTotal = linhas.reduce(function (s, l) { return s + l.valorTotal; }, 0);
    var totMedia = linhas.reduce(function (s, l) { return s + l.mediaMensalQtd; }, 0);
    var totQ4Ant = linhas.reduce(function (s, l) { return s + l.qtdAncora; }, 0);
    var totProjSug = linhas.reduce(function (s, l) { return s + l.qtdProjSug; }, 0);
    var totValorProjSug = linhas.reduce(function (s, l) { return s + l.valorProjSug; }, 0);
    tb.innerHTML += '<tr class="total">' +
      '<td>TOTAL</td>' +
      '<td class="cdapc-num">' + fmtQtd(totQtd) + '</td>' +
      '<td class="cdapc-num">' + fmtQtd(totQtdEstDiv) + '</td>' +
      '<td class="cdapc-num">' + fmtQtd(totQtdTotal) + '</td>' +
      '<td class="cdapc-num">' + fmtMoeda(totValor) + '</td>' +
      '<td class="cdapc-num">' + fmtMoeda(totValorEstDiv) + '</td>' +
      '<td class="cdapc-num">' + fmtMoeda(totValorTotal) + '</td>' +
      '<td class="cdapc-num">' + fmtQtd(totMedia) + '</td>' +
      '<td class="cdapc-num">' + fmtQtd(totQ4Ant) + '</td>' +
      '<td class="cdapc-num">—</td>' +
      '<td class="cdapc-num">' + fmtQtd(totProjSug) + '</td>' +
      '<td class="cdapc-num">' + fmtMoeda(totValorProjSug) + '</td>' +
    '</tr>';
  }

  inpIni.addEventListener('change', render);
  inpFim.addEventListener('change', render);
  selCanal.addEventListener('change', render);
  selQuad.addEventListener('change', render);
  inpAno.addEventListener('change', render);
  inpPctSug.addEventListener('input', render);

  host.querySelector('#cdapc-btn-exp').addEventListener('click', function () {
    var linhas = ULTIMO_CALC.length ? ULTIMO_CALC : calcularLinhas();
    var dados = linhas.map(function (l) {
      return {
        tipo_peca: l.tipo, qtd_vendida: l.qtd, qtd_estimada: Number(l.qtdEstimadaDiversos.toFixed(1)),
        qtd_total_real_mais_estimada: Number(l.qtdTotal.toFixed(1)),
        valor_vendido: l.valor, valor_estimado: Number(l.valorEstimadoDiversos.toFixed(2)),
        valor_total_real_mais_estimado: Number(l.valorTotal.toFixed(2)),
        media_mensal_qtd: Number(l.mediaMensalQtd.toFixed(1)), quadrante: l.quadrante, ano_ref_quadrante: l.anoRefQuad,
        qx_ano_anterior: Number(l.qtdAncora.toFixed(1)), pct_taxa_cresc_ano_anterior: Number(l.pctSug.toFixed(1)),
        qtd_projetada_qx_sugerido: Math.round(l.qtdProjSug), valor_projetado_qx_sugerido: Number(l.valorProjSug.toFixed(2))
      };
    });
    var ws = XLSX.utils.json_to_sheet(dados);
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Planejamento Compras');
    XLSX.writeFile(wb, 'planejamento_compras_' + (selQuad.value || 'Q4') + '_' + (inpAno.value || '') + '.xlsx');
  });

  render();
}

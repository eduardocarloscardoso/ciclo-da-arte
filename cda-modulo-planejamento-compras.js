// ════════════════════════════════════════════════════════════════════
// cda-modulo-planejamento-compras.js
// Módulo Estoque → submódulo "Planejamento de Compras".
// Projeta a compra de matéria-prima por tipo de peça para o 4º
// trimestre (out-dez), com base no histórico de vendas a VAREJO
// (exclui sempre o canal Private Label — vendas no atacado não entram
// na conta de sazonalidade nem na base do período).
//
// EM REVISÃO (ago/2026): as colunas Qtd/Valor vendido e Qtd/Valor
// estimado (Diversos) já usam a função compartilhada
// cdaCalcularVendasPorTipoPeca (mesmo rateio de Diversos dos
// submódulos Vendas por Tipo de Peça e Vendas por Canal). A Média
// Mensal soma Qtd vendida + Qtd Estimada (Diversos), dividido pelos
// meses do Período Estatístico Inicial/Final.
// As colunas de % sugerido / projeção Q4 / simulação AINDA usam a
// sazonalidade antiga (só quantidade, sem rateio de Diversos) —
// ajuste pendente, próxima etapa.
//
// Sazonalidade (ainda na versão antiga): para cada tipo de peça,
// compara Q4 real (2023-2025) contra o esperado (média mensal de
// jan-set × 3) e calcula o % de variação ponderado por volume. Esse é
// o "% sugerido" — fixo, não muda com o filtro de período (é uma
// referência histórica). Quando não há dado suficiente para um tipo,
// cai no % geral da empresa (todos os tipos, mesma metodologia).
//
// O filtro de Período Estatístico Inicial/Final é livre — define a
// base de vendas usada pra calcular a média mensal atual, que depois
// é projetada para os 3 meses do Q4 usando o % sugerido (ou o %
// simulado, se o usuário preencher).
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
      '.cdapc-note{background:var(--card,#f5f0e8);border:2px solid var(--ink,#1a1a1a);padding:12px 14px;font-size:11.5px;color:var(--muted,#888);margin-bottom:14px;line-height:1.5;}' +
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
      '<div><div class="sec-t">📈 Planejamento de Compras</div><div class="sec-d">Projeção de compra de matéria-prima por tipo de peça para o 4º trimestre, com base no histórico de vendas a varejo</div></div>' +
      '<button class="btn" id="cdapc-btn-exp">⬇ Exportar XLSX</button>' +
    '</div>' +
    '<div class="cdapc-note" id="cdapc-nota">Carregando dados...</div>' +
    '<div class="cdapc-filtros">' +
      '<div class="cdapc-fg"><label>Período Estatístico Inicial</label><input type="date" id="cdapc-f-ini"></div>' +
      '<div class="cdapc-fg"><label>Período Estatístico Final</label><input type="date" id="cdapc-f-fim"></div>' +
      '<div class="cdapc-fg" style="min-width:170px"><label>Canal</label><select id="cdapc-f-canal"><option value="">Todos (exceto Private Label)</option></select></div>' +
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
          '<th class="cdapc-num">% sugerido</th>' +
          '<th class="cdapc-num">Qtd projetada Q4 (sugerido)</th>' +
          '<th class="cdapc-num">Valor projetado Q4 (sugerido)</th>' +
          '<th class="cdapc-num">% simulado</th>' +
          '<th class="cdapc-num">Qtd projetada Q4 (simulado)</th>' +
          '<th class="cdapc-num">Valor projetado Q4 (simulado)</th>' +
        '</tr></thead>' +
        '<tbody id="cdapc-tb"></tbody>' +
      '</table></div>' +
    '</div>';

  var ST = { compras: [], produtos: [], canais: [], tipos: [], simulado: {} };
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

  // ── Sazonalidade histórica por tipo (2023–2025), ponderada por volume ──
  function calcularSazonalidade() {
    var acc = {}; // tipo -> ano -> {janSet, q4}
    var somaQ4Geral = 0, somaEsperadoGeral = 0;
    comprasVarejo.forEach(function (c) {
      var ano = parseInt(c.dataCompra.slice(0, 4), 10);
      var mes = parseInt(c.dataCompra.slice(5, 7), 10);
      if (ano < 2023 || ano > 2025) return;
      var tipo = tipoDe(c);
      var qtd = Number(c.quantidade) || 0;
      if (!acc[tipo]) acc[tipo] = {};
      if (!acc[tipo][ano]) acc[tipo][ano] = { janSet: 0, q4: 0 };
      if (mes >= 1 && mes <= 9) acc[tipo][ano].janSet += qtd;
      else if (mes >= 10 && mes <= 12) acc[tipo][ano].q4 += qtd;
    });
    var pctPorTipo = {};
    Object.keys(acc).forEach(function (tipo) {
      var somaQ4 = 0, somaEsperado = 0;
      Object.keys(acc[tipo]).forEach(function (ano) {
        var d = acc[tipo][ano];
        var esperado = (d.janSet / 9) * 3;
        somaQ4 += d.q4; somaEsperado += esperado;
        somaQ4Geral += d.q4; somaEsperadoGeral += esperado;
      });
      pctPorTipo[tipo] = somaEsperado > 0 ? ((somaQ4 / somaEsperado) - 1) * 100 : null;
    });
    var pctGeral = somaEsperadoGeral > 0 ? ((somaQ4Geral / somaEsperadoGeral) - 1) * 100 : 30;
    return { porTipo: pctPorTipo, geral: pctGeral };
  }
  var SAZ = calcularSazonalidade();

  // ── Popular filtro de canal (informativo — Private Label sempre fica de fora) ──
  var selCanal = host.querySelector('#cdapc-f-canal');
  selCanal.innerHTML += ST.canais.filter(function (c) { return String(c.id) !== CDA_CANAL_PRIVATE_LABEL_ID; })
    .slice().sort(function (a, b) { return a.nome.localeCompare(b.nome); })
    .map(function (c) { return '<option value="' + c.id + '">' + c.nome + '</option>'; }).join('');

  // ── Datas padrão: 1º de janeiro do ano corrente até a data mais recente disponível na base ──
  var datasDisponiveis = comprasVarejo.map(function (c) { return c.dataCompra; }).sort();
  var dataMaisRecente = datasDisponiveis.length ? datasDisponiveis[datasDisponiveis.length - 1] : new Date().toISOString().slice(0, 10);
  var anoCorrente = dataMaisRecente.slice(0, 4);
  var inpIni = host.querySelector('#cdapc-f-ini'), inpFim = host.querySelector('#cdapc-f-fim');
  inpIni.value = anoCorrente + '-01-01';
  inpFim.value = dataMaisRecente;

  host.querySelector('#cdapc-nota').innerHTML =
    '📌 Base de cálculo: apenas vendas a <b>varejo</b> — o canal <b>Private Label</b> (atacado) é sempre excluído, tanto do período filtrado quanto da sazonalidade histórica. ' +
    'Último dado de venda disponível no sistema: <b>' + fmtDataBR(dataMaisRecente) + '</b>. ' +
    'Sazonalidade calculada sobre 2023–2025 (Q4 real vs. média mensal jan–set × 3, ponderado por volume). % geral da empresa: <b>' + SAZ.geral.toFixed(1) + '%</b>.';

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

    var linhas = Object.keys(porTipo).map(function (tipo) {
      var d = porTipo[tipo];
      // Média Mensal agora soma a Qtd vendida (real) + Qtd Estimada (Diversos), dividido pelos meses do período.
      var mediaMensalQtd = (d.qtd + d.qtdEstimadaDiversos) / nMeses;
      var mediaMensalValor = d.valor / nMeses;
      var pctSug = SAZ.porTipo.hasOwnProperty(tipo) && SAZ.porTipo[tipo] != null ? SAZ.porTipo[tipo] : SAZ.geral;
      var usouGeral = !(SAZ.porTipo.hasOwnProperty(tipo) && SAZ.porTipo[tipo] != null);
      var qtdProjSug = mediaMensalQtd * 3 * (1 + pctSug / 100);
      var valorProjSug = mediaMensalValor * 3 * (1 + pctSug / 100);
      var pctSim = ST.simulado[tipo];
      var temSim = pctSim !== undefined && pctSim !== null && pctSim !== '';
      var qtdProjSim = temSim ? mediaMensalQtd * 3 * (1 + Number(pctSim) / 100) : null;
      var valorProjSim = temSim ? mediaMensalValor * 3 * (1 + Number(pctSim) / 100) : null;
      return {
        tipo: tipo, qtd: d.qtd, valor: d.valor,
        qtdEstimadaDiversos: d.qtdEstimadaDiversos, valorEstimadoDiversos: d.valorEstimadoDiversos,
        qtdTotal: d.qtd + d.qtdEstimadaDiversos, valorTotal: d.valor + d.valorEstimadoDiversos,
        mediaMensalQtd: mediaMensalQtd,
        pctSug: pctSug, usouGeral: usouGeral, qtdProjSug: qtdProjSug, valorProjSug: valorProjSug,
        pctSim: temSim ? Number(pctSim) : null, qtdProjSim: qtdProjSim, valorProjSim: valorProjSim
      };
    }).filter(function (l) { return l.qtd > 0 || l.qtdEstimadaDiversos > 0 || l.mediaMensalQtd > 0; })
      .sort(function (a, b) { return b.qtd - a.qtd; });

    return linhas;
  }

  function renderKpis(linhas) {
    var totQtd = linhas.reduce(function (s, l) { return s + l.qtd; }, 0);
    var totValor = linhas.reduce(function (s, l) { return s + l.valor; }, 0);
    var totProjSug = linhas.reduce(function (s, l) { return s + l.qtdProjSug; }, 0);
    var totValorProjSug = linhas.reduce(function (s, l) { return s + l.valorProjSug; }, 0);
    host.querySelector('#cdapc-kpis').innerHTML =
      '<div class="cdapc-kpi"><div class="v">' + fmtQtd(totQtd) + '</div><div class="l">Peças vendidas no período</div></div>' +
      '<div class="cdapc-kpi"><div class="v">' + fmtMoeda(totValor) + '</div><div class="l">Valor vendido no período</div></div>' +
      '<div class="cdapc-kpi"><div class="v">' + fmtQtd(totProjSug) + '</div><div class="l">Peças projetadas p/ Q4 (sugerido)</div></div>' +
      '<div class="cdapc-kpi"><div class="v">' + fmtMoeda(totValorProjSug) + '</div><div class="l">Valor projetado p/ Q4 (sugerido)</div></div>';
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
        '<td class="cdapc-num">' + l.pctSug.toFixed(1) + '%' + (l.usouGeral ? ' <span class="cdapc-pct-geral">(geral)</span>' : '') + '</td>' +
        '<td class="cdapc-num"><b>' + fmtQtd(l.qtdProjSug) + '</b></td>' +
        '<td class="cdapc-num"><b>' + fmtMoeda(l.valorProjSug) + '</b></td>' +
        '<td class="cdapc-num"><input type="number" step="0.1" class="cdapc-sim-input" data-tipo="' + l.tipo.replace(/"/g, '&quot;') + '" placeholder="—" value="' + (l.pctSim != null ? l.pctSim : '') + '">%</td>' +
        '<td class="cdapc-num">' + (l.qtdProjSim != null ? fmtQtd(l.qtdProjSim) : '—') + '</td>' +
        '<td class="cdapc-num">' + (l.valorProjSim != null ? fmtMoeda(l.valorProjSim) : '—') + '</td>' +
      '</tr>';
    }).join('') || '<tr><td colspan="14" style="text-align:center;color:var(--muted);padding:20px">Nenhuma venda no período/canal selecionado.</td></tr>';

    var totQtd = linhas.reduce(function (s, l) { return s + l.qtd; }, 0);
    var totQtdEstDiv = linhas.reduce(function (s, l) { return s + l.qtdEstimadaDiversos; }, 0);
    var totQtdTotal = linhas.reduce(function (s, l) { return s + l.qtdTotal; }, 0);
    var totValor = linhas.reduce(function (s, l) { return s + l.valor; }, 0);
    var totValorEstDiv = linhas.reduce(function (s, l) { return s + l.valorEstimadoDiversos; }, 0);
    var totValorTotal = linhas.reduce(function (s, l) { return s + l.valorTotal; }, 0);
    var totMedia = linhas.reduce(function (s, l) { return s + l.mediaMensalQtd; }, 0);
    var totProjSug = linhas.reduce(function (s, l) { return s + l.qtdProjSug; }, 0);
    var totValorProjSug = linhas.reduce(function (s, l) { return s + l.valorProjSug; }, 0);
    var totProjSim = linhas.reduce(function (s, l) { return s + (l.qtdProjSim || 0); }, 0);
    var totValorProjSim = linhas.reduce(function (s, l) { return s + (l.valorProjSim || 0); }, 0);
    var temAlgumSim = linhas.some(function (l) { return l.qtdProjSim != null; });
    tb.innerHTML += '<tr class="total">' +
      '<td>TOTAL</td>' +
      '<td class="cdapc-num">' + fmtQtd(totQtd) + '</td>' +
      '<td class="cdapc-num">' + fmtQtd(totQtdEstDiv) + '</td>' +
      '<td class="cdapc-num">' + fmtQtd(totQtdTotal) + '</td>' +
      '<td class="cdapc-num">' + fmtMoeda(totValor) + '</td>' +
      '<td class="cdapc-num">' + fmtMoeda(totValorEstDiv) + '</td>' +
      '<td class="cdapc-num">' + fmtMoeda(totValorTotal) + '</td>' +
      '<td class="cdapc-num">' + fmtQtd(totMedia) + '</td>' +
      '<td class="cdapc-num">—</td>' +
      '<td class="cdapc-num">' + fmtQtd(totProjSug) + '</td>' +
      '<td class="cdapc-num">' + fmtMoeda(totValorProjSug) + '</td>' +
      '<td class="cdapc-num">—</td>' +
      '<td class="cdapc-num">' + (temAlgumSim ? fmtQtd(totProjSim) : '—') + '</td>' +
      '<td class="cdapc-num">' + (temAlgumSim ? fmtMoeda(totValorProjSim) : '—') + '</td>' +
    '</tr>';

    // Listeners dos campos de simulação (não recarrega tudo — só recalcula aquela linha)
    tb.querySelectorAll('.cdapc-sim-input').forEach(function (inp) {
      inp.addEventListener('input', function () {
        var tipo = inp.dataset.tipo;
        var v = inp.value.trim();
        ST.simulado[tipo] = v === '' ? null : v;
        render();
        // Recoloca o foco no mesmo campo após o re-render (senão perde o foco a cada tecla)
        var novo = host.querySelector('.cdapc-sim-input[data-tipo="' + tipo.replace(/"/g, '\\"') + '"]');
        if (novo) { novo.focus(); var val = novo.value; novo.value = ''; novo.value = val; }
      });
    });
  }

  inpIni.addEventListener('change', render);
  inpFim.addEventListener('change', render);
  selCanal.addEventListener('change', render);

  host.querySelector('#cdapc-btn-exp').addEventListener('click', function () {
    var linhas = ULTIMO_CALC.length ? ULTIMO_CALC : calcularLinhas();
    var dados = linhas.map(function (l) {
      return {
        tipo_peca: l.tipo, qtd_vendida: l.qtd, qtd_estimada: Number(l.qtdEstimadaDiversos.toFixed(1)),
        qtd_total_real_mais_estimada: Number(l.qtdTotal.toFixed(1)),
        valor_vendido: l.valor, valor_estimado: Number(l.valorEstimadoDiversos.toFixed(2)),
        valor_total_real_mais_estimado: Number(l.valorTotal.toFixed(2)),
        media_mensal_qtd: Number(l.mediaMensalQtd.toFixed(1)), pct_sugerido: Number(l.pctSug.toFixed(1)),
        qtd_projetada_q4_sugerido: Math.round(l.qtdProjSug), valor_projetado_q4_sugerido: Number(l.valorProjSug.toFixed(2)),
        pct_simulado: l.pctSim != null ? l.pctSim : '', qtd_projetada_q4_simulado: l.qtdProjSim != null ? Math.round(l.qtdProjSim) : '',
        valor_projetado_q4_simulado: l.valorProjSim != null ? Number(l.valorProjSim.toFixed(2)) : ''
      };
    });
    var ws = XLSX.utils.json_to_sheet(dados);
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Planejamento Compras');
    XLSX.writeFile(wb, 'planejamento_compras_q4_' + (inpIni.value || '') + '_a_' + (inpFim.value || '') + '.xlsx');
  });

  render();
}

// ════════════════════════════════════════════════════════════════════
// cda-modulo-vendas-por-canal.js
// Módulo Estoque → submódulo "Vendas por Canal".
// Mostra, para uma Collab/Artista selecionada, quanto cada canal de
// vendas dela vendeu no período — com o "Diversos" (pedidos
// consolidados sem produto detalhado) somado ao canal real dele
// (o canal É dado real nessas linhas, diferente do tipo de peça).
//
// A única estimativa que existe aqui é converter o R$ de Diversos em
// nº de peças, usando o preço médio real da Collab inteira (estável,
// mesmo espírito da "Opção A" do relatório de tipo de peça).
//
// Abaixo da tabela por canal, uma segunda tabela detalha por Tipo de
// Peça, escopada pela mesma Collab (e Canal, se drill-down) — reusa
// cdaCalcularVendasPorTipoPeca com canalIds, mesma metodologia do
// submódulo "Vendas por Tipo de Peça" (% de participação sempre
// global/empresa inteira).
//
// A coluna "% do total da empresa em R$ (nesse tipo)" responde: "desse
// tipo de peça, que fatia do valor (R$) total vendido pela empresa
// inteira veio dessa Collab/Canal?" — Qtd/Valor total (real + Diversos
// já ratado) do escopo ÷ Qtd/Valor total (real + Diversos) da empresa
// inteira nesse mesmo tipo, em R$ (validado com o CEO em ago/2026).
//
// Somente leitura — não grava nada no banco.
// Requer cda-dados-compartilhados.js carregado antes.
// ════════════════════════════════════════════════════════════════════

async function montarModuloVendasPorCanal(containerId) {
  var host = document.getElementById(containerId);
  if (!host) { console.error('cda-modulo-vendas-por-canal: container #' + containerId + ' não encontrado'); return; }

  host.innerHTML =
    '<style>' +
      '.cdavpc-note{background:var(--card,#f5f0e8);border:2px solid var(--ink,#1a1a1a);padding:12px 14px;font-size:11.5px;color:var(--muted,#888);margin-bottom:14px;line-height:1.5;}' +
      '.cdavpc-note b{color:var(--ink,#1a1a1a);}' +
      '.cdavpc-filtros{display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;margin-bottom:14px;}' +
      '.cdavpc-fg{display:flex;flex-direction:column;gap:3px;}' +
      '.cdavpc-fg label{font-size:9px;text-transform:uppercase;letter-spacing:1px;color:var(--muted,#888);}' +
      '.cdavpc-fg input,.cdavpc-fg select{padding:7px 9px;border:2px solid var(--ink,#1a1a1a);background:var(--paper,#fff);font-family:inherit;font-size:12px;}' +
      '.cdavpc-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px;}' +
      '.cdavpc-kpi{background:var(--card,#f5f0e8);border:2px solid var(--ink,#1a1a1a);padding:12px;text-align:center;}' +
      '.cdavpc-kpi .v{font-family:"DM Serif Display",serif;font-size:20px;line-height:1;}' +
      '.cdavpc-kpi .l{font-size:9px;text-transform:uppercase;letter-spacing:1px;color:var(--muted,#888);margin-top:4px;}' +
      '@media(max-width:760px){.cdavpc-kpis{grid-template-columns:1fr 1fr;}}' +
      '.cdavpc-tbl-wrap{overflow-x:auto;}' +
      '.cdavpc-tbl{width:100%;border-collapse:collapse;font-size:11.5px;min-width:900px;}' +
      '.cdavpc-tbl th{text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:.5px;color:var(--muted,#888);padding:8px;border-bottom:2px solid var(--ink,#1a1a1a);white-space:nowrap;}' +
      '.cdavpc-tbl td{padding:7px 8px;border-bottom:1px solid var(--border2,#e0dbd0);white-space:nowrap;}' +
      '.cdavpc-tbl tr.total td{border-top:2px solid var(--ink,#1a1a1a);border-bottom:none;font-weight:700;background:var(--card,#f5f0e8);}' +
      '.cdavpc-num{text-align:right;font-family:var(--ff-m,monospace);}' +
    '</style>' +
    '<div class="row-bt">' +
      '<div><div class="sec-t">🏷 Vendas por Canal</div><div class="sec-d">Quanto cada canal de venda de uma Collab/Artista vendeu no período — com o "Diversos" já somado ao canal real dele</div></div>' +
      '<button class="btn" id="cdavpc-btn-exp">⬇ Exportar XLSX</button>' +
    '</div>' +
    '<div class="cdavpc-note" id="cdavpc-nota">Carregando dados...</div>' +
    '<div class="cdavpc-filtros">' +
      '<div class="cdavpc-fg" style="min-width:220px"><label>Collab / Artista</label><select id="cdavpc-f-collab"><option value="">— Selecione —</option></select></div>' +
      '<div class="cdavpc-fg"><label>Período — Data início</label><input type="date" id="cdavpc-f-ini"></div>' +
      '<div class="cdavpc-fg"><label>Período — Data fim</label><input type="date" id="cdavpc-f-fim"></div>' +
      '<div class="cdavpc-fg" style="min-width:200px"><label>Canal (opcional)</label><select id="cdavpc-f-canal"><option value="">Todos os canais da collab</option></select></div>' +
    '</div>' +
    '<div class="cdavpc-kpis" id="cdavpc-kpis"></div>' +
    '<div class="tw"><div class="th"><h3>Vendas por Canal</h3></div>' +
      '<div class="cdavpc-tbl-wrap"><table class="cdavpc-tbl">' +
        '<thead><tr>' +
          '<th>Canal</th>' +
          '<th class="cdavpc-num">Qtd real</th>' +
          '<th class="cdavpc-num">Valor real</th>' +
          '<th class="cdavpc-num">% da Collab</th>' +
          '<th class="cdavpc-num">Valor Diversos (real)</th>' +
          '<th class="cdavpc-num">Qtd estim. (Diversos)</th>' +
          '<th class="cdavpc-num">Qtd total</th>' +
          '<th class="cdavpc-num">Valor total</th>' +
        '</tr></thead>' +
        '<tbody id="cdavpc-tb"></tbody>' +
      '</table></div>' +
    '</div>' +
    '<div class="tw" id="cdavpc-bloco-tipo" style="margin-top:16px">' +
      '<div class="th"><h3 id="cdavpc-tipo-titulo">Detalhamento por Tipo de Peça</h3></div>' +
      '<div class="cdavpc-tbl-wrap"><table class="cdavpc-tbl">' +
        '<thead><tr>' +
          '<th>Tipo de Peça</th>' +
          '<th class="cdavpc-num">Qtd real</th>' +
          '<th class="cdavpc-num">Valor real</th>' +
          '<th class="cdavpc-num">% Participação Total Vendas</th>' +
          '<th class="cdavpc-num">Qtd estim. (Diversos)</th>' +
          '<th class="cdavpc-num">Valor estim. (Diversos)</th>' +
          '<th class="cdavpc-num">Qtd total</th>' +
          '<th class="cdavpc-num">Valor total</th>' +
        '</tr></thead>' +
        '<tbody id="cdavpc-tb-tipo"></tbody>' +
      '</table></div>' +
    '</div>';

  var ST = { compras: [], produtos: [], canais: [], parceiros: [] };
  try {
    var res = await Promise.all([cdaCarregarCompras(), cdaCarregarProdutos(), cdaCarregarCanais(), cdaCarregarParceiros()]);
    ST.compras = res[0]; ST.produtos = res[1]; ST.canais = res[2]; ST.parceiros = res[3];
  } catch (err) {
    console.error(err);
    host.querySelector('#cdavpc-nota').textContent = 'Erro ao carregar dados do Supabase. Veja o console.';
    return;
  }

  var produtoById = {}; ST.produtos.forEach(function (p) { produtoById[String(p.id)] = p; });

  // Só collabs com pelo menos 1 canal de vendas real (exclui Private Label)
  var collabsComCanal = ST.parceiros.filter(function (pa) {
    return ST.canais.some(function (c) { return String(c.parceiroId) === String(pa.id) && String(c.id) !== CDA_CANAL_PRIVATE_LABEL_ID; });
  }).sort(function (a, b) { return a.nome.localeCompare(b.nome); });

  var selCollab = host.querySelector('#cdavpc-f-collab');
  selCollab.innerHTML += collabsComCanal.map(function (pa) { return '<option value="' + pa.id + '">' + pa.nome + '</option>'; }).join('');

  var datasDisponiveis = ST.compras.filter(function (c) { return c.dataCompra && String(c.canalId) !== CDA_CANAL_PRIVATE_LABEL_ID; })
    .map(function (c) { return c.dataCompra; }).sort();
  var dataMaisRecente = datasDisponiveis.length ? datasDisponiveis[datasDisponiveis.length - 1] : new Date().toISOString().slice(0, 10);
  var dataMaisAntiga = datasDisponiveis.length ? datasDisponiveis[0] : dataMaisRecente;
  var inpIni = host.querySelector('#cdavpc-f-ini'), inpFim = host.querySelector('#cdavpc-f-fim'), selCanal = host.querySelector('#cdavpc-f-canal');
  inpIni.value = dataMaisAntiga;
  inpFim.value = dataMaisRecente;

  function fmtDataBR(iso) { if (!iso) return '—'; var p = iso.split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }
  function fmtMoeda(v) { return 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function fmtQtd(v) { return Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }); }

  host.querySelector('#cdavpc-nota').innerHTML =
    '📌 O canal do Diversos é dado <b>real</b> (sabemos exatamente em qual canal aconteceu) — só a quantidade de peças é estimada, convertendo o valor pelo preço médio da Collab inteira. ' +
    'Private Label é sempre excluído. Última venda disponível: <b>' + fmtDataBR(dataMaisRecente) + '</b>.';

  function popularCanaisDaCollab() {
    var collabId = selCollab.value;
    var canaisDaCollab = ST.canais.filter(function (c) { return String(c.parceiroId) === String(collabId) && String(c.id) !== CDA_CANAL_PRIVATE_LABEL_ID; })
      .sort(function (a, b) { return a.nome.localeCompare(b.nome); });
    selCanal.innerHTML = '<option value="">Todos os canais da collab</option>' +
      canaisDaCollab.map(function (c) { return '<option value="' + c.id + '">' + c.nome + '</option>'; }).join('');
  }

  var ULTIMO_RESULTADO = null;
  var ULTIMO_RESULTADO_TIPO = null;

  function render() {
    var collabId = selCollab.value;
    var tb = host.querySelector('#cdavpc-tb');
    if (!collabId) {
      host.querySelector('#cdavpc-kpis').innerHTML = '';
      tb.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--muted);padding:20px">Selecione uma Collab/Artista para ver os canais dela.</td></tr>';
      host.querySelector('#cdavpc-tipo-titulo').textContent = 'Detalhamento por Tipo de Peça';
      host.querySelector('#cdavpc-tb-tipo').innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--muted);padding:20px">Selecione uma Collab/Artista.</td></tr>';
      ULTIMO_RESULTADO = null;
      ULTIMO_RESULTADO_TIPO = null;
      return;
    }
    var resultado = cdaCalcularVendasPorCanal({
      compras: ST.compras, produtoById: produtoById, canais: ST.canais,
      dataIni: inpIni.value, dataFim: inpFim.value, collabId: collabId, canalIdFiltro: selCanal.value || null
    });
    ULTIMO_RESULTADO = resultado;
    var linhas = resultado.linhas, totais = resultado.totais;

    host.querySelector('#cdavpc-kpis').innerHTML =
      '<div class="cdavpc-kpi"><div class="v">' + fmtQtd(totais.qtdReal) + '</div><div class="l">Peças (venda real)</div></div>' +
      '<div class="cdavpc-kpi"><div class="v">' + fmtMoeda(totais.valorReal) + '</div><div class="l">Valor (venda real)</div></div>' +
      '<div class="cdavpc-kpi"><div class="v">' + fmtMoeda(totais.valorDiversos) + '</div><div class="l">Valor Diversos (real)</div></div>' +
      '<div class="cdavpc-kpi"><div class="v">' + fmtMoeda(totais.valorTotal) + '</div><div class="l">Valor total</div></div>';

    tb.innerHTML = linhas.map(function (l) {
      return '<tr>' +
        '<td>' + l.canal + '</td>' +
        '<td class="cdavpc-num">' + fmtQtd(l.qtdReal) + '</td>' +
        '<td class="cdavpc-num">' + fmtMoeda(l.valorReal) + '</td>' +
        '<td class="cdavpc-num">' + l.pctParticipacao.toFixed(2) + '%</td>' +
        '<td class="cdavpc-num">' + fmtMoeda(l.valorDiversos) + '</td>' +
        '<td class="cdavpc-num">' + fmtQtd(l.qtdEstimadaDiversos) + '</td>' +
        '<td class="cdavpc-num"><b>' + fmtQtd(l.qtdTotal) + '</b></td>' +
        '<td class="cdavpc-num"><b>' + fmtMoeda(l.valorTotal) + '</b></td>' +
      '</tr>';
    }).join('') || '<tr><td colspan="8" style="text-align:center;color:var(--muted);padding:20px">Nenhuma venda encontrada nesse período/canal.</td></tr>';

    tb.innerHTML += '<tr class="total">' +
      '<td>TOTAL</td>' +
      '<td class="cdavpc-num">' + fmtQtd(totais.qtdReal) + '</td>' +
      '<td class="cdavpc-num">' + fmtMoeda(totais.valorReal) + '</td>' +
      '<td class="cdavpc-num">' + (linhas.length ? '100.00%' : '—') + '</td>' +
      '<td class="cdavpc-num">' + fmtMoeda(totais.valorDiversos) + '</td>' +
      '<td class="cdavpc-num">' + fmtQtd(totais.qtdEstimadaDiversos) + '</td>' +
      '<td class="cdavpc-num">' + fmtQtd(totais.qtdTotal) + '</td>' +
      '<td class="cdavpc-num">' + fmtMoeda(totais.valorTotal) + '</td>' +
    '</tr>';

    // ── Detalhamento por Tipo de Peça, escopado pela mesma Collab/Canal ──
    var canalFiltro = selCanal.value;
    var canaisEscopo = canalFiltro ? [canalFiltro] : ST.canais
      .filter(function (c) { return String(c.parceiroId) === String(collabId) && String(c.id) !== CDA_CANAL_PRIVATE_LABEL_ID; })
      .map(function (c) { return String(c.id); });
    var resultadoTipo = cdaCalcularVendasPorTipoPeca({
      compras: ST.compras, produtoById: produtoById,
      dataIni: inpIni.value, dataFim: inpFim.value, canalIds: canaisEscopo
    });
    // Totais globais (empresa inteira, sem filtro de canal) por tipo — base pra "% do total da empresa nesse tipo"
    var resultadoTipoGlobal = cdaCalcularVendasPorTipoPeca({
      compras: ST.compras, produtoById: produtoById,
      dataIni: inpIni.value, dataFim: inpFim.value
    });
    var valorTotalGlobalPorTipo = {};
    resultadoTipoGlobal.linhas.forEach(function (l) { valorTotalGlobalPorTipo[l.tipo] = l.valorTotal; });
    resultadoTipo.linhas.forEach(function (l) {
      var totalGlobal = valorTotalGlobalPorTipo[l.tipo] || 0;
      l.pctDoTotalEmpresa = totalGlobal > 0 ? (l.valorTotal / totalGlobal) * 100 : 0;
    });
    var nomeEscopo = canalFiltro ? selCanal.options[selCanal.selectedIndex].text : selCollab.options[selCollab.selectedIndex].text + ' (todos os canais)';
    host.querySelector('#cdavpc-tipo-titulo').textContent = 'Detalhamento por Tipo de Peça — ' + nomeEscopo;

    var tbTipo = host.querySelector('#cdavpc-tb-tipo');
    tbTipo.innerHTML = resultadoTipo.linhas.map(function (l) {
      return '<tr>' +
        '<td>' + l.tipo + '</td>' +
        '<td class="cdavpc-num">' + fmtQtd(l.qtdReal) + '</td>' +
        '<td class="cdavpc-num">' + fmtMoeda(l.valorReal) + '</td>' +
        '<td class="cdavpc-num">' + l.pctDoTotalEmpresa.toFixed(2) + '%</td>' +
        '<td class="cdavpc-num">' + fmtQtd(l.qtdEstimadaDiversos) + '</td>' +
        '<td class="cdavpc-num">' + fmtMoeda(l.valorEstimadoDiversos) + '</td>' +
        '<td class="cdavpc-num"><b>' + fmtQtd(l.qtdTotal) + '</b></td>' +
        '<td class="cdavpc-num"><b>' + fmtMoeda(l.valorTotal) + '</b></td>' +
      '</tr>';
    }).join('') || '<tr><td colspan="8" style="text-align:center;color:var(--muted);padding:20px">Nenhuma venda identificada nesse escopo.</td></tr>';

    var totTipo = resultadoTipo.linhas.reduce(function (acc, l) {
      acc.qtdReal += l.qtdReal; acc.valorReal += l.valorReal;
      acc.qtdEstimadaDiversos += l.qtdEstimadaDiversos; acc.valorEstimadoDiversos += l.valorEstimadoDiversos;
      acc.qtdTotal += l.qtdTotal; acc.valorTotal += l.valorTotal;
      return acc;
    }, { qtdReal: 0, valorReal: 0, qtdEstimadaDiversos: 0, valorEstimadoDiversos: 0, qtdTotal: 0, valorTotal: 0 });
    tbTipo.innerHTML += '<tr class="total">' +
      '<td>TOTAL</td>' +
      '<td class="cdavpc-num">' + fmtQtd(totTipo.qtdReal) + '</td>' +
      '<td class="cdavpc-num">' + fmtMoeda(totTipo.valorReal) + '</td>' +
      '<td class="cdavpc-num">—</td>' +
      '<td class="cdavpc-num">' + fmtQtd(totTipo.qtdEstimadaDiversos) + '</td>' +
      '<td class="cdavpc-num">' + fmtMoeda(totTipo.valorEstimadoDiversos) + '</td>' +
      '<td class="cdavpc-num">' + fmtQtd(totTipo.qtdTotal) + '</td>' +
      '<td class="cdavpc-num">' + fmtMoeda(totTipo.valorTotal) + '</td>' +
    '</tr>';

    ULTIMO_RESULTADO_TIPO = resultadoTipo;
  }

  selCollab.addEventListener('change', function () { popularCanaisDaCollab(); render(); });
  selCanal.addEventListener('change', render);
  inpIni.addEventListener('change', render);
  inpFim.addEventListener('change', render);

  host.querySelector('#cdavpc-btn-exp').addEventListener('click', function () {
    if (!ULTIMO_RESULTADO || !ULTIMO_RESULTADO.linhas.length) return;
    var dadosCanal = ULTIMO_RESULTADO.linhas.map(function (l) {
      return {
        canal: l.canal, qtd_real: Number(l.qtdReal.toFixed(1)), valor_real: Number(l.valorReal.toFixed(2)),
        pct_participacao: Number(l.pctParticipacao.toFixed(2)), valor_diversos_real: Number(l.valorDiversos.toFixed(2)),
        qtd_estimada_diversos: Number(l.qtdEstimadaDiversos.toFixed(1)),
        qtd_total: Number(l.qtdTotal.toFixed(1)), valor_total: Number(l.valorTotal.toFixed(2))
      };
    });
    var nomeCollab = selCollab.options[selCollab.selectedIndex].text;
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dadosCanal), 'Por Canal');
    if (ULTIMO_RESULTADO_TIPO && ULTIMO_RESULTADO_TIPO.linhas.length) {
      var dadosTipo = ULTIMO_RESULTADO_TIPO.linhas.map(function (l) {
        return {
          tipo_peca: l.tipo, qtd_real: Number(l.qtdReal.toFixed(1)), valor_real: Number(l.valorReal.toFixed(2)),
          pct_participacao_total_vendas: Number(l.pctDoTotalEmpresa.toFixed(2)),
          qtd_estimada_diversos: Number(l.qtdEstimadaDiversos.toFixed(1)), valor_estimado_diversos: Number(l.valorEstimadoDiversos.toFixed(2)),
          qtd_total: Number(l.qtdTotal.toFixed(1)), valor_total: Number(l.valorTotal.toFixed(2))
        };
      });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dadosTipo), 'Por Tipo de Peça');
    }
    XLSX.writeFile(wb, 'vendas_por_canal_' + nomeCollab.replace(/[^a-z0-9]/gi, '_') + '.xlsx');
  });

  render();
}

// ════════════════════════════════════════════════════════════════════
// cda-modulo-vendas-tipo-peca.js
// Módulo Estoque → submódulo "Vendas por Tipo de Peça".
// Relatório standalone: quanto foi vendido de cada tipo de peça no
// período filtrado, com o valor de "Diversos" (pedidos consolidados de
// revenda/show/feira sem detalhamento por produto) explodido
// proporcionalmente entre os tipos identificados — usando a mesma
// função de cálculo (cdaCalcularVendasPorTipoPeca) que será reutilizada
// pelo Planejamento de Compras.
//
// Metodologia (ago/2026, validada com o CEO):
// - % de participação de cada tipo sempre calculado com TODOS os
//   canais do período (não muda ao filtrar por canal — "Opção A").
// - Preço médio usado pra estimar quantidade também é sempre o global.
// - Filtro de canal só afeta as vendas reais exibidas e quanto de
//   Diversos daquele canal específico entra no rateio.
// - Private Label sempre excluído (não é venda de varejo).
//
// Somente leitura — não grava nada no banco.
// Requer cda-dados-compartilhados.js carregado antes.
// ════════════════════════════════════════════════════════════════════

async function montarModuloVendasTipoPeca(containerId) {
  var host = document.getElementById(containerId);
  if (!host) { console.error('cda-modulo-vendas-tipo-peca: container #' + containerId + ' não encontrado'); return; }

  host.innerHTML =
    '<style>' +
      '.cdavtp-note{background:var(--card,#f5f0e8);border:2px solid var(--ink,#1a1a1a);padding:12px 14px;font-size:11.5px;color:var(--muted,#888);margin-bottom:14px;line-height:1.5;}' +
      '.cdavtp-note b{color:var(--ink,#1a1a1a);}' +
      '.cdavtp-filtros{display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;margin-bottom:14px;}' +
      '.cdavtp-fg{display:flex;flex-direction:column;gap:3px;}' +
      '.cdavtp-fg label{font-size:9px;text-transform:uppercase;letter-spacing:1px;color:var(--muted,#888);}' +
      '.cdavtp-fg input,.cdavtp-fg select{padding:7px 9px;border:2px solid var(--ink,#1a1a1a);background:var(--paper,#fff);font-family:inherit;font-size:12px;}' +
      '.cdavtp-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px;}' +
      '.cdavtp-kpi{background:var(--card,#f5f0e8);border:2px solid var(--ink,#1a1a1a);padding:12px;text-align:center;}' +
      '.cdavtp-kpi .v{font-family:"DM Serif Display",serif;font-size:20px;line-height:1;}' +
      '.cdavtp-kpi .l{font-size:9px;text-transform:uppercase;letter-spacing:1px;color:var(--muted,#888);margin-top:4px;}' +
      '@media(max-width:760px){.cdavtp-kpis{grid-template-columns:1fr 1fr;}}' +
      '.cdavtp-tbl-wrap{overflow-x:auto;}' +
      '.cdavtp-tbl{width:100%;border-collapse:collapse;font-size:11.5px;min-width:920px;}' +
      '.cdavtp-tbl th{text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:.5px;color:var(--muted,#888);padding:8px;border-bottom:2px solid var(--ink,#1a1a1a);white-space:nowrap;}' +
      '.cdavtp-tbl td{padding:7px 8px;border-bottom:1px solid var(--border2,#e0dbd0);white-space:nowrap;}' +
      '.cdavtp-tbl tr.total td{border-top:2px solid var(--ink,#1a1a1a);border-bottom:none;font-weight:700;background:var(--card,#f5f0e8);}' +
      '.cdavtp-num{text-align:right;font-family:var(--ff-m,monospace);}' +
      '.cdavtp-grp-real{background:rgba(74,124,89,.06);}' +
      '.cdavtp-grp-diverso{background:rgba(201,74,43,.06);}' +
    '</style>' +
    '<div class="row-bt">' +
      '<div><div class="sec-t">🛍 Vendas por Tipo de Peça</div><div class="sec-d">Quantidade e valor vendido por tipo de peça no período, com o valor de "Diversos" (pedidos consolidados de revenda/show/feira) rateado proporcionalmente</div></div>' +
      '<button class="btn" id="cdavtp-btn-exp">⬇ Exportar XLSX</button>' +
    '</div>' +
    '<div class="cdavtp-note" id="cdavtp-nota">Carregando dados...</div>' +
    '<div class="cdavtp-filtros">' +
      '<div class="cdavtp-fg"><label>Período — Data início</label><input type="date" id="cdavtp-f-ini"></div>' +
      '<div class="cdavtp-fg"><label>Período — Data fim</label><input type="date" id="cdavtp-f-fim"></div>' +
      '<div class="cdavtp-fg" style="min-width:200px"><label>Canal</label><select id="cdavtp-f-canal"><option value="">Todos (exceto Private Label)</option></select></div>' +
    '</div>' +
    '<div class="cdavtp-kpis" id="cdavtp-kpis"></div>' +
    '<div class="tw"><div class="th"><h3>Vendas por Tipo de Peça</h3></div>' +
      '<div class="cdavtp-tbl-wrap"><table class="cdavtp-tbl">' +
        '<thead><tr>' +
          '<th>Tipo de Peça</th>' +
          '<th class="cdavtp-num">Qtd real</th>' +
          '<th class="cdavtp-num">Valor real</th>' +
          '<th class="cdavtp-num">Preço médio real</th>' +
          '<th class="cdavtp-num">% participação</th>' +
          '<th class="cdavtp-num">Qtd estim. (Diversos)</th>' +
          '<th class="cdavtp-num">Valor estim. (Diversos)</th>' +
          '<th class="cdavtp-num">Qtd total</th>' +
          '<th class="cdavtp-num">Valor total</th>' +
        '</tr></thead>' +
        '<tbody id="cdavtp-tb"></tbody>' +
      '</table></div>' +
    '</div>';

  var ST = { compras: [], produtos: [], canais: [] };
  try {
    var res = await Promise.all([cdaCarregarCompras(), cdaCarregarProdutos(), cdaCarregarCanais()]);
    ST.compras = res[0]; ST.produtos = res[1]; ST.canais = res[2];
  } catch (err) {
    console.error(err);
    host.querySelector('#cdavtp-nota').textContent = 'Erro ao carregar dados do Supabase. Veja o console.';
    return;
  }

  var produtoById = {}; ST.produtos.forEach(function (p) { produtoById[String(p.id)] = p; });

  var selCanal = host.querySelector('#cdavtp-f-canal');
  selCanal.innerHTML += ST.canais.filter(function (c) { return String(c.id) !== CDA_CANAL_PRIVATE_LABEL_ID; })
    .slice().sort(function (a, b) { return a.nome.localeCompare(b.nome); })
    .map(function (c) { return '<option value="' + c.id + '">' + c.nome + '</option>'; }).join('');

  var datasDisponiveis = ST.compras.filter(function (c) { return c.dataCompra && String(c.canalId) !== CDA_CANAL_PRIVATE_LABEL_ID; })
    .map(function (c) { return c.dataCompra; }).sort();
  var dataMaisRecente = datasDisponiveis.length ? datasDisponiveis[datasDisponiveis.length - 1] : new Date().toISOString().slice(0, 10);
  var dataMaisAntiga = datasDisponiveis.length ? datasDisponiveis[0] : dataMaisRecente;
  var inpIni = host.querySelector('#cdavtp-f-ini'), inpFim = host.querySelector('#cdavtp-f-fim');
  inpIni.value = dataMaisAntiga;
  inpFim.value = dataMaisRecente;

  function fmtDataBR(iso) { if (!iso) return '—'; var p = iso.split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }
  function fmtMoeda(v) { return 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function fmtQtd(v) { return Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }); }

  host.querySelector('#cdavtp-nota').innerHTML =
    '📌 Base: apenas vendas a <b>varejo</b> — o canal <b>Private Label</b> (atacado) é sempre excluído. ' +
    'A % de participação de cada tipo é sempre calculada com todos os canais do período (não muda ao filtrar por canal) — só as colunas "real" e o valor de Diversos rateado respeitam o filtro de canal. ' +
    'Última venda disponível no sistema: <b>' + fmtDataBR(dataMaisRecente) + '</b>.';

  var ULTIMO_RESULTADO = null;

  function render() {
    var resultado = cdaCalcularVendasPorTipoPeca({
      compras: ST.compras, produtoById: produtoById,
      dataIni: inpIni.value, dataFim: inpFim.value, canalId: selCanal.value || null
    });
    ULTIMO_RESULTADO = resultado;
    var linhas = resultado.linhas, totais = resultado.totais;

    host.querySelector('#cdavtp-kpis').innerHTML =
      '<div class="cdavtp-kpi"><div class="v">' + fmtQtd(totais.qtdReal) + '</div><div class="l">Peças (venda real)</div></div>' +
      '<div class="cdavtp-kpi"><div class="v">' + fmtMoeda(totais.valorReal) + '</div><div class="l">Valor (venda real)</div></div>' +
      '<div class="cdavtp-kpi"><div class="v">' + fmtQtd(totais.qtdEstimadaDiversos) + '</div><div class="l">Peças estimadas (Diversos)</div></div>' +
      '<div class="cdavtp-kpi"><div class="v">' + fmtMoeda(totais.valorEstimadoDiversos) + '</div><div class="l">Valor estimado (Diversos)</div></div>';

    var tb = host.querySelector('#cdavtp-tb');
    tb.innerHTML = linhas.map(function (l) {
      return '<tr>' +
        '<td>' + l.tipo + '</td>' +
        '<td class="cdavtp-num">' + fmtQtd(l.qtdReal) + '</td>' +
        '<td class="cdavtp-num">' + fmtMoeda(l.valorReal) + '</td>' +
        '<td class="cdavtp-num">' + fmtMoeda(l.precoMedioReal) + '</td>' +
        '<td class="cdavtp-num">' + l.pctParticipacao.toFixed(2) + '%</td>' +
        '<td class="cdavtp-num">' + fmtQtd(l.qtdEstimadaDiversos) + '</td>' +
        '<td class="cdavtp-num">' + fmtMoeda(l.valorEstimadoDiversos) + '</td>' +
        '<td class="cdavtp-num"><b>' + fmtQtd(l.qtdTotal) + '</b></td>' +
        '<td class="cdavtp-num"><b>' + fmtMoeda(l.valorTotal) + '</b></td>' +
      '</tr>';
    }).join('') || '<tr><td colspan="9" style="text-align:center;color:var(--muted);padding:20px">Nenhuma venda identificada no período/canal selecionado.</td></tr>';

    tb.innerHTML += '<tr class="total">' +
      '<td>TOTAL</td>' +
      '<td class="cdavtp-num">' + fmtQtd(totais.qtdReal) + '</td>' +
      '<td class="cdavtp-num">' + fmtMoeda(totais.valorReal) + '</td>' +
      '<td class="cdavtp-num">—</td>' +
      '<td class="cdavtp-num">100.00%</td>' +
      '<td class="cdavtp-num">' + fmtQtd(totais.qtdEstimadaDiversos) + '</td>' +
      '<td class="cdavtp-num">' + fmtMoeda(totais.valorEstimadoDiversos) + '</td>' +
      '<td class="cdavtp-num">' + fmtQtd(totais.qtdTotal) + '</td>' +
      '<td class="cdavtp-num">' + fmtMoeda(totais.valorTotal) + '</td>' +
    '</tr>';
  }

  inpIni.addEventListener('change', render);
  inpFim.addEventListener('change', render);
  selCanal.addEventListener('change', render);

  host.querySelector('#cdavtp-btn-exp').addEventListener('click', function () {
    if (!ULTIMO_RESULTADO) return;
    var dados = ULTIMO_RESULTADO.linhas.map(function (l) {
      return {
        tipo_peca: l.tipo,
        qtd_real: Number(l.qtdReal.toFixed(1)), valor_real: Number(l.valorReal.toFixed(2)),
        preco_medio_real: Number(l.precoMedioReal.toFixed(2)), pct_participacao: Number(l.pctParticipacao.toFixed(2)),
        qtd_estimada_diversos: Number(l.qtdEstimadaDiversos.toFixed(1)), valor_estimado_diversos: Number(l.valorEstimadoDiversos.toFixed(2)),
        qtd_total: Number(l.qtdTotal.toFixed(1)), valor_total: Number(l.valorTotal.toFixed(2))
      };
    });
    var ws = XLSX.utils.json_to_sheet(dados);
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Vendas por Tipo');
    XLSX.writeFile(wb, 'vendas_tipo_peca_' + (inpIni.value || '') + '_a_' + (inpFim.value || '') + '.xlsx');
  });

  render();
}

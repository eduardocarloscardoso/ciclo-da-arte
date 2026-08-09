// ════════════════════════════════════════════════════════════════════
// cda-modulo-painel-gerencial.js
// Painel Gerencial — visão consolidada do CRM, somente leitura.
// Não grava nada no banco; só agrega dados já existentes em
// leads_b2c, cda_historico_interacoes, cda_campanhas, equipe e
// cda_status_crm. Filtro de período aplica-se à data de CRIAÇÃO do
// lead (leads.criadoEm) — "dos leads criados nesse período, onde
// eles estão hoje".
//
// Requer cda-dados-compartilhados.js carregado antes.
// ════════════════════════════════════════════════════════════════════

async function montarModuloPainelGerencial(containerId) {
  var host = document.getElementById(containerId);
  if (!host) { console.error('cda-modulo-painel-gerencial: container #' + containerId + ' não encontrado'); return; }

  host.innerHTML =
    '<style>' +
      '.pg-kpi-strip{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:18px;}' +
      '.pg-kpi{background:var(--card,#f5f0e8);border:2px solid var(--ink,#1a1a1a);padding:14px;text-align:center;}' +
      '.pg-kpi .v{font-family:"DM Serif Display",serif;font-size:24px;line-height:1;}' +
      '.pg-kpi .l{font-size:9px;text-transform:uppercase;letter-spacing:1px;color:var(--muted,#888);margin-top:4px;}' +
      '.pg-bloco{background:var(--card,#f5f0e8);border:2px solid var(--ink,#1a1a1a);padding:16px;margin-bottom:14px;}' +
      '.pg-bloco h3{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;}' +
      '.pg-barra-row{display:flex;align-items:center;gap:8px;margin-bottom:6px;font-size:11px;}' +
      '.pg-barra-label{width:100px;flex-shrink:0;color:var(--muted,#888);}' +
      '.pg-barra-track{flex:1;background:var(--paper,#fff);border:1px solid var(--ink,#1a1a1a);height:16px;overflow:hidden;}' +
      '.pg-barra-fill{background:var(--rust,#c0392b);height:100%;}' +
      '.pg-barra-num{width:34px;text-align:right;flex-shrink:0;font-weight:700;}' +
      '.pg-linha{display:flex;justify-content:space-between;font-size:11px;padding:5px 0;border-bottom:1px solid var(--border2,#e0dbd0);}' +
      '.pg-linha:last-child{border-bottom:none;}' +
      '.pg-2col{display:grid;grid-template-columns:1fr 1fr;gap:14px;}' +
      '@media (max-width:700px){.pg-2col{grid-template-columns:1fr;}.pg-kpi-strip{grid-template-columns:1fr;}}' +
    '</style>' +
    '<div class="row-bt">' +
      '<div><div class="sec-t">📊 Painel Gerencial</div><div class="sec-d">Visão consolidada do CRM — somente leitura, não altera nenhum dado</div></div>' +
    '</div>' +
    '<div class="fb">' +
      '<select id="pg-f-periodo">' +
        '<option value="7">Últimos 7 dias</option>' +
        '<option value="30" selected>Últimos 30 dias</option>' +
        '<option value="90">Últimos 90 dias</option>' +
        '<option value="0">Todo o período</option>' +
      '</select>' +
    '</div>' +
    '<div id="pg-conteudo"><p class="tmu">Carregando...</p></div>';

  var ST = { leads: [], historico: [], campanhas: [], equipe: [], statusCrm: [] };
  try {
    var res = await Promise.all([cdaCarregarLeadsB2C(), cdaCarregarHistoricoCompleto(), cdaCarregarCampanhas(), cdaCarregarEquipe(), cdaCarregarStatusCrm()]);
    ST.leads = res[0]; ST.historico = res[1]; ST.campanhas = res[2]; ST.equipe = res[3]; ST.statusCrm = res[4];
  } catch (err) {
    console.error(err);
    var msg = (err && (err.message || err.details || err.hint)) || 'Erro desconhecido';
    host.querySelector('#pg-conteudo').innerHTML = '<p style="color:var(--rust,#c0392b)">Erro ao carregar dados do Supabase:<br><b>' + msg + '</b></p>';
    return;
  }

  var campanhaPorId = {}; ST.campanhas.forEach(function (c) { campanhaPorId[c.id] = c; });
  var equipePorId = {}; ST.equipe.forEach(function (e) { equipePorId[e.id] = e; });
  var statusCrmPorId = {}; ST.statusCrm.forEach(function (s) { statusCrmPorId[s.id] = s; });

  function diasAtras(n) {
    var d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString();
  }
  function diasParado(movidoEm) {
    if (!movidoEm) return 0;
    return Math.floor((Date.now() - new Date(movidoEm).getTime()) / 86400000);
  }

  function render() {
    var periodo = Number(host.querySelector('#pg-f-periodo').value);
    var desde = periodo > 0 ? diasAtras(periodo) : null;
    var leadsPeriodo = desde ? ST.leads.filter(function (l) { return l.criadoEm && l.criadoEm >= desde; }) : ST.leads.slice();

    // ── KPIs ──
    var totalLeads = leadsPeriodo.length;
    var compras = leadsPeriodo.filter(function (l) { return l.etapa === 'compra' || l.etapa === 'fidelizacao'; }).length;
    var conversao = totalLeads ? Math.round((compras / totalLeads) * 100) : 0;
    var paradosLongos = ST.leads.filter(function (l) { return l.etapa !== 'compra' && l.etapa !== 'fidelizacao' && diasParado(l.movidoEm) >= 14; }).length;

    // ── Funil (sobre leadsPeriodo) ──
    var funilMax = Math.max(1, totalLeads);
    var funilHtml = CDA_ETAPAS_B2C.map(function (etapa) {
      var qtd = leadsPeriodo.filter(function (l) { return l.etapa === etapa.id; }).length;
      var pct = Math.round((qtd / funilMax) * 100);
      return '<div class="pg-barra-row"><span class="pg-barra-label">' + etapa.label + '</span>' +
        '<div class="pg-barra-track"><div class="pg-barra-fill" style="width:' + pct + '%"></div></div>' +
        '<span class="pg-barra-num">' + qtd + '</span></div>';
    }).join('');

    // ── Por responsável (sobre leadsPeriodo, só quem tem lead atribuído) ──
    var porResp = {};
    leadsPeriodo.forEach(function (l) {
      if (!l.responsavelId) return;
      if (!porResp[l.responsavelId]) porResp[l.responsavelId] = { total: 0, compras: 0 };
      porResp[l.responsavelId].total++;
      if (l.etapa === 'compra' || l.etapa === 'fidelizacao') porResp[l.responsavelId].compras++;
    });
    var respIds = Object.keys(porResp).sort(function (a, b) { return porResp[b].total - porResp[a].total; });
    var respHtml = respIds.length ? respIds.map(function (id) {
      var r = porResp[id];
      var nome = equipePorId[id] ? equipePorId[id].nome : 'Responsável #' + id;
      var pct = r.total ? Math.round((r.compras / r.total) * 100) : 0;
      return '<div class="pg-linha"><span>' + nome + '</span><span>' + r.total + ' lead(s) · ' + pct + '% conversão</span></div>';
    }).join('') : '<p class="tmu" style="font-size:11px">Nenhum lead com responsável atribuído no período.</p>';

    // ── Por campanha ──
    var porCamp = {};
    leadsPeriodo.forEach(function (l) {
      if (!l.campanhaId) return;
      if (!porCamp[l.campanhaId]) porCamp[l.campanhaId] = { total: 0, compras: 0 };
      porCamp[l.campanhaId].total++;
      if (l.etapa === 'compra' || l.etapa === 'fidelizacao') porCamp[l.campanhaId].compras++;
    });
    var campIds = Object.keys(porCamp).sort(function (a, b) { return porCamp[b].total - porCamp[a].total; });
    var campHtml = campIds.length ? campIds.map(function (id) {
      var c = porCamp[id];
      var nome = campanhaPorId[id] ? campanhaPorId[id].nome : 'Campanha #' + id;
      return '<div class="pg-linha"><span>📣 ' + nome + '</span><span>' + c.total + ' lead(s) · ' + c.compras + ' venda(s)</span></div>';
    }).join('') : '<p class="tmu" style="font-size:11px">Nenhum lead vinculado a campanha no período.</p>';

    // ── Resultados atuais (o que o catálogo cda_status_crm registrou como resultado do lead) ──
    var porResultado = {};
    leadsPeriodo.forEach(function (l) {
      if (!l.resultadoId) return;
      porResultado[l.resultadoId] = (porResultado[l.resultadoId] || 0) + 1;
    });
    var resIds = Object.keys(porResultado).sort(function (a, b) { return porResultado[b] - porResultado[a]; });
    var resHtml = resIds.length ? resIds.map(function (id) {
      var s = statusCrmPorId[id];
      return '<div class="pg-linha"><span>' + (s ? s.nome : 'Resultado #' + id) + '</span><span>' + porResultado[id] + '</span></div>';
    }).join('') : '<p class="tmu" style="font-size:11px">Nenhum resultado registrado ainda no período.</p>';

    // ── Envelhecimento (estado atual, não filtra por período) ──
    var envelhecimento = CDA_ETAPAS_B2C.filter(function (e) { return e.id !== 'compra' && e.id !== 'fidelizacao'; }).map(function (etapa) {
      var doEtapa = ST.leads.filter(function (l) { return l.etapa === etapa.id; });
      var parados7 = doEtapa.filter(function (l) { return diasParado(l.movidoEm) >= 7 && diasParado(l.movidoEm) < 14; }).length;
      var parados14 = doEtapa.filter(function (l) { return diasParado(l.movidoEm) >= 14; }).length;
      return '<div class="pg-linha"><span>' + etapa.label + '</span><span>' + parados7 + ' entre 7-13d · <b style="color:var(--rust,#c0392b)">' + parados14 + ' com 14d+</b></span></div>';
    }).join('');

    host.querySelector('#pg-conteudo').innerHTML =
      '<div class="pg-kpi-strip">' +
        '<div class="pg-kpi"><div class="v">' + totalLeads + '</div><div class="l">Leads no período</div></div>' +
        '<div class="pg-kpi"><div class="v">' + conversao + '%</div><div class="l">Conversão do período</div></div>' +
        '<div class="pg-kpi"><div class="v">' + paradosLongos + '</div><div class="l">Parados 14d+ (hoje)</div></div>' +
      '</div>' +
      '<div class="pg-bloco"><h3>Funil de Conversão</h3>' + funilHtml + '</div>' +
      '<div class="pg-2col">' +
        '<div class="pg-bloco"><h3>Por Responsável</h3>' + respHtml + '</div>' +
        '<div class="pg-bloco"><h3>Por Campanha</h3>' + campHtml + '</div>' +
      '</div>' +
      '<div class="pg-2col">' +
        '<div class="pg-bloco"><h3>Resultados Registrados</h3>' + resHtml + '</div>' +
        '<div class="pg-bloco"><h3>Envelhecimento (estado atual)</h3>' + envelhecimento + '</div>' +
      '</div>';
  }

  host.querySelector('#pg-f-periodo').addEventListener('change', render);
  render();
}

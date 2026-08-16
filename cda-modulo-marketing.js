// ════════════════════════════════════════════════════════════════════
// cda-modulo-marketing.js
// Módulo Marketing — Mídia paga, orçamento e calendário editorial.
// Migrado do sistema Manus (React/tRPC/MySQL) → reescrito em vanilla JS
// no padrão cda-modulo-*.js, usando as tabelas cda_marketing_*.
//
// Submódulos: Campanhas, Integração Meta Ads, Orçamento, Analytics,
// Calendário Editorial, Simulações IA (placeholder), Tutorial (reusa
// montarModuloTutorial de cda-modulo-tutorial.js).
//
// Não confundir com cda_campanhas (campanhas de nutrição de lead do
// Comercial/Pipeline B2C) — são domínios diferentes.
// ════════════════════════════════════════════════════════════════════

var MKT_OBJETIVOS = { awareness: 'Awareness', trafego: 'Tráfego', engajamento: 'Engajamento', leads: 'Leads', vendas: 'Vendas', retargeting: 'Retargeting' };
var MKT_STATUS = { rascunho: 'Rascunho', ativa: 'Ativa', pausada: 'Pausada', concluida: 'Concluída', arquivada: 'Arquivada' };
var MKT_PLATAFORMAS = { facebook: 'Facebook', instagram: 'Instagram', ambas: 'Facebook + Instagram' };
var MKT_STATUS_BADGE = { rascunho: 'pending', ativa: 'done', pausada: 'alert', concluida: 'interno', arquivada: 'pending' };

function mktFmtMoeda(v) { v = Number(v || 0); return 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function mktFmtData(d) { if (!d) return '—'; var dt = new Date(d); if (isNaN(dt)) return '—'; return dt.toLocaleDateString('pt-BR'); }
function mktFmtNum(v) { return Number(v || 0).toLocaleString('pt-BR'); }

async function mktCarregarCanais() {
  try { return await sb.get('canais', 'select=id,nome,tipo,escopo&order=nome'); }
  catch (e) { console.error(e); return []; }
}

// ────────────────────────────────────────────────────────────────
// 1) CAMPANHAS
// ────────────────────────────────────────────────────────────────
async function montarModuloMktCampanhas(containerId, opts) {
  var editavel = !opts || opts.editavel !== false;
  var host = document.getElementById(containerId);
  if (!host) return;
  host.innerHTML = '<p class="tmu">Carregando campanhas...</p>';

  var ST = { campanhas: [], canais: [] };
  try {
    var res = await Promise.all([
      sb.get('cda_marketing_campanhas', 'select=*&order=data_inicio.desc.nullslast'),
      mktCarregarCanais()
    ]);
    ST.campanhas = res[0]; ST.canais = res[1];
  } catch (err) {
    host.innerHTML = '<p style="color:var(--rust,#c0392b)">Erro ao carregar campanhas: ' + (err.message || err) + '</p>';
    return;
  }
  var canalPorId = {}; ST.canais.forEach(function (c) { canalPorId[c.id] = c; });

  function render() {
    var fStatus = host.querySelector('#mkt-f-status') ? host.querySelector('#mkt-f-status').value : '';
    var fBusca = host.querySelector('#mkt-f-busca') ? host.querySelector('#mkt-f-busca').value.toLowerCase() : '';
    var lista = ST.campanhas.filter(function (c) {
      if (fStatus && c.status !== fStatus) return false;
      if (fBusca && c.nome.toLowerCase().indexOf(fBusca) === -1) return false;
      return true;
    });

    var linhas = lista.map(function (c) {
      var canal = canalPorId[c.canal_id];
      return '<tr>' +
        '<td>' + c.nome + (c.categoria_campanha ? '<br><span class="tmu" style="font-size:10px">' + c.categoria_campanha + '</span>' : '') + '</td>' +
        '<td>' + (canal ? canal.nome : '<span class="tmu">— sem canal —</span>') + '</td>' +
        '<td>' + (MKT_OBJETIVOS[c.objetivo] || c.objetivo) + '</td>' +
        '<td><span class="badge badge-' + (MKT_STATUS_BADGE[c.status] || 'pending') + '">' + (MKT_STATUS[c.status] || c.status) + '</span></td>' +
        '<td>' + (MKT_PLATAFORMAS[c.plataforma] || c.plataforma) + '</td>' +
        '<td>' + mktFmtMoeda(c.orcamento) + '</td>' +
        '<td>' + mktFmtData(c.data_inicio) + '</td>' +
        (editavel ? '<td><button class="btn" onclick="mktAbrirModalCampanha(\'' + containerId + '\',' + c.id + ')">Editar</button></td>' : '') +
        '</tr>';
    }).join('');

    host.querySelector('#mkt-camp-tbody').innerHTML = linhas || '<tr><td colspan="8" class="tmu">Nenhuma campanha encontrada.</td></tr>';
  }

  host.innerHTML =
    '<div class="row-bt"><div><div class="sec-t">📣 Campanhas</div><div class="sec-d">Campanhas de mídia paga (Meta Ads) — vinculadas aos Canais/Collabs existentes</div></div>' +
    (editavel ? '<button class="btn" id="mkt-btn-nova">+ Nova Campanha</button>' : '') + '</div>' +
    '<div class="fb">' +
      '<input type="text" id="mkt-f-busca" placeholder="Buscar por nome...">' +
      '<select id="mkt-f-status"><option value="">Todos os status</option>' +
        Object.keys(MKT_STATUS).map(function (k) { return '<option value="' + k + '">' + MKT_STATUS[k] + '</option>'; }).join('') +
      '</select>' +
    '</div>' +
    '<div class="tbl-wrap"><table><thead><tr><th>Campanha</th><th>Canal</th><th>Objetivo</th><th>Status</th><th>Plataforma</th><th>Orçamento</th><th>Início</th>' +
      (editavel ? '<th></th>' : '') + '</tr></thead><tbody id="mkt-camp-tbody"></tbody></table></div>';

  host.querySelector('#mkt-f-busca').addEventListener('input', render);
  host.querySelector('#mkt-f-status').addEventListener('change', render);
  if (editavel) host.querySelector('#mkt-btn-nova').addEventListener('click', function () { mktAbrirModalCampanha(containerId, null); });

  render();
  host._mktCampanhasState = ST;
  host._mktCampanhasRender = render;
  host._mktCanalPorId = canalPorId;
}

function mktAbrirModalCampanha(containerId, campanhaId) {
  var host = document.getElementById(containerId);
  var ST = host._mktCampanhasState;
  var c = campanhaId ? ST.campanhas.find(function (x) { return x.id === campanhaId; }) : null;
  var opcoesCanal = '<option value="">— sem canal —</option>' + ST.canais.map(function (ca) {
    return '<option value="' + ca.id + '"' + (c && c.canal_id === ca.id ? ' selected' : '') + '>' + ca.nome + '</option>';
  }).join('');

  openModal(
    '<div class="modal-box"><h3>' + (c ? 'Editar Campanha' : 'Nova Campanha') + '</h3>' +
    '<div style="margin-top:14px"><label>Nome</label><input type="text" id="mf-nome" value="' + (c ? c.nome.replace(/"/g, '&quot;') : '') + '" style="width:100%"></div>' +
    '<div style="margin-top:10px"><label>Canal</label><select id="mf-canal" style="width:100%">' + opcoesCanal + '</select></div>' +
    '<div style="margin-top:10px;display:flex;gap:8px">' +
      '<div style="flex:1"><label>Objetivo</label><select id="mf-objetivo" style="width:100%">' + Object.keys(MKT_OBJETIVOS).map(function (k) { return '<option value="' + k + '"' + (c && c.objetivo === k ? ' selected' : '') + '>' + MKT_OBJETIVOS[k] + '</option>'; }).join('') + '</select></div>' +
      '<div style="flex:1"><label>Status</label><select id="mf-status" style="width:100%">' + Object.keys(MKT_STATUS).map(function (k) { return '<option value="' + k + '"' + (c ? (c.status === k ? ' selected' : '') : (k === 'rascunho' ? ' selected' : '')) + '>' + MKT_STATUS[k] + '</option>'; }).join('') + '</select></div>' +
    '</div>' +
    '<div style="margin-top:10px;display:flex;gap:8px">' +
      '<div style="flex:1"><label>Plataforma</label><select id="mf-plataforma" style="width:100%">' + Object.keys(MKT_PLATAFORMAS).map(function (k) { return '<option value="' + k + '"' + (c ? (c.plataforma === k ? ' selected' : '') : (k === 'ambas' ? ' selected' : '')) + '>' + MKT_PLATAFORMAS[k] + '</option>'; }).join('') + '</select></div>' +
      '<div style="flex:1"><label>Orçamento (R$)</label><input type="number" step="0.01" id="mf-orcamento" value="' + (c ? c.orcamento || '' : '') + '" style="width:100%"></div>' +
    '</div>' +
    '<div style="margin-top:10px;display:flex;gap:8px">' +
      '<div style="flex:1"><label>Data início</label><input type="date" id="mf-inicio" value="' + (c && c.data_inicio ? c.data_inicio.substring(0, 10) : '') + '" style="width:100%"></div>' +
      '<div style="flex:1"><label>Data fim</label><input type="date" id="mf-fim" value="' + (c && c.data_fim ? c.data_fim.substring(0, 10) : '') + '" style="width:100%"></div>' +
    '</div>' +
    '<div style="margin-top:10px"><label>Categoria/tática (opcional)</label><input type="text" id="mf-categoria" value="' + (c && c.categoria_campanha ? c.categoria_campanha.replace(/"/g, '&quot;') : '') + '" style="width:100%" placeholder="ex: Remarketing, Black Friday..."></div>' +
    '<div style="margin-top:20px;display:flex;gap:10px;justify-content:flex-end">' +
      '<button class="btn" onclick="closeModal()">Cancelar</button>' +
      '<button class="btn rust" onclick="mktSalvarCampanha(\'' + containerId + '\',' + (c ? c.id : 'null') + ')">Salvar</button>' +
    '</div></div>'
  );
}

async function mktSalvarCampanha(containerId, campanhaId) {
  var host = document.getElementById(containerId);
  var body = {
    nome: document.getElementById('mf-nome').value.trim(),
    canal_id: document.getElementById('mf-canal').value || null,
    objetivo: document.getElementById('mf-objetivo').value,
    status: document.getElementById('mf-status').value,
    plataforma: document.getElementById('mf-plataforma').value,
    orcamento: document.getElementById('mf-orcamento').value || null,
    data_inicio: document.getElementById('mf-inicio').value || null,
    data_fim: document.getElementById('mf-fim').value || null,
    categoria_campanha: document.getElementById('mf-categoria').value.trim() || null,
    atualizado_em: new Date().toISOString()
  };
  if (!body.nome) { showToast('Informe o nome da campanha.', 'error'); return; }
  try {
    if (campanhaId) { await sb.patch('cda_marketing_campanhas', campanhaId, body); }
    else { body.criado_em = new Date().toISOString(); await sb.post('cda_marketing_campanhas', body); }
    closeModal();
    showToast('Campanha salva com sucesso.');
    await montarModuloMktCampanhas(containerId, { editavel: true });
  } catch (err) {
    console.error(err);
    showToast('Erro ao salvar: ' + (err.message || err), 'error');
  }
}

// ────────────────────────────────────────────────────────────────
// 2) INTEGRAÇÃO META ADS
// ────────────────────────────────────────────────────────────────
async function montarModuloMktMeta(containerId, opts) {
  var editavel = !opts || opts.editavel !== false;
  var host = document.getElementById(containerId);
  if (!host) return;
  host.innerHTML = '<p class="tmu">Carregando configuração...</p>';

  var cfg = null;
  try {
    var rows = await sb.get('cda_marketing_meta_config', 'select=*&id=eq.1');
    cfg = rows[0] || null;
  } catch (err) {
    host.innerHTML = '<p style="color:var(--rust,#c0392b)">Erro ao carregar configuração: ' + (err.message || err) + '</p>';
    return;
  }

  var statusHtml = cfg && cfg.conectado
    ? '<span class="badge badge-done">Conectado</span>'
    : '<span class="badge badge-alert">Desconectado</span>';

  host.innerHTML =
    '<div class="row-bt"><div><div class="sec-t">🔗 Integração Meta Ads</div><div class="sec-d">Conexão com a API do Meta Ads via Supabase Edge Function — token nunca fica exposto no frontend</div></div></div>' +
    '<div class="cc" style="max-width:560px">' +
      '<h3>Status da conexão ' + statusHtml + '</h3>' +
      '<div class="pg-linha"><span class="tmu">Ad Account ID</span><span>' + (cfg && cfg.ad_account_id ? cfg.ad_account_id : '—') + '</span></div>' +
      '<div class="pg-linha"><span class="tmu">Pixel ID</span><span>' + (cfg && cfg.pixel_id ? cfg.pixel_id : '—') + '</span></div>' +
      '<div class="pg-linha"><span class="tmu">Última sincronização</span><span>' + (cfg && cfg.ultima_sincronizacao ? mktFmtData(cfg.ultima_sincronizacao) : '—') + '</span></div>' +
      '<div class="pg-linha"><span class="tmu">Status técnico</span><span>' + (cfg && cfg.status_sincronizacao ? cfg.status_sincronizacao : '—') + '</span></div>' +
      (editavel ? '<button class="btn rust" style="margin-top:14px" id="mkt-btn-reconectar">Reconectar Meta Ads</button>' : '') +
    '</div>' +
    '<div class="rec-box" style="margin-top:14px"><div class="rec-title">🚧 Sincronização automática — em construção</div>' +
    '<p class="tmu">A conexão real com a API do Meta Ads (via Edge Function dedicada) ainda precisa ser implementada nesta etapa. Por enquanto, use o campo de token abaixo apenas para registrar a configuração; a sincronização de métricas continuará manual até a Edge Function estar pronta.</p></div>';

  if (editavel) {
    host.querySelector('#mkt-btn-reconectar').addEventListener('click', function () {
      openModal(
        '<div class="modal-box"><h3>Reconectar Meta Ads</h3>' +
        '<p class="tmu" style="margin-bottom:12px">Informe o Ad Account ID e o Pixel ID. O token de acesso deve ser configurado depois, diretamente na Edge Function (nunca fica salvo em texto simples nesta tela).</p>' +
        '<div><label>Ad Account ID</label><input type="text" id="mf-adaccount" value="' + (cfg && cfg.ad_account_id ? cfg.ad_account_id : '') + '" style="width:100%"></div>' +
        '<div style="margin-top:10px"><label>Pixel ID</label><input type="text" id="mf-pixel" value="' + (cfg && cfg.pixel_id ? cfg.pixel_id : '') + '" style="width:100%"></div>' +
        '<div style="margin-top:20px;display:flex;gap:10px;justify-content:flex-end">' +
          '<button class="btn" onclick="closeModal()">Cancelar</button>' +
          '<button class="btn rust" onclick="mktSalvarMetaConfig(\'' + containerId + '\')">Salvar</button>' +
        '</div></div>'
      );
    });
  }
}

async function mktSalvarMetaConfig(containerId) {
  var body = {
    ad_account_id: document.getElementById('mf-adaccount').value.trim() || null,
    pixel_id: document.getElementById('mf-pixel').value.trim() || null,
    atualizado_em: new Date().toISOString()
  };
  try {
    await sb.patch('cda_marketing_meta_config', 1, body);
    closeModal();
    showToast('Configuração atualizada.');
    await montarModuloMktMeta(containerId, { editavel: true });
  } catch (err) {
    showToast('Erro ao salvar: ' + (err.message || err), 'error');
  }
}

// ────────────────────────────────────────────────────────────────
// 3) ORÇAMENTO
// ────────────────────────────────────────────────────────────────
var MKT_MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

async function montarModuloMktOrcamento(containerId, opts) {
  var editavel = !opts || opts.editavel !== false;
  var host = document.getElementById(containerId);
  if (!host) return;
  host.innerHTML = '<p class="tmu">Carregando orçamentos...</p>';

  var ST = { orcamentos: [], investimentos: [], metricas: [] };
  try {
    var res = await Promise.all([
      sb.get('cda_marketing_orcamentos', 'select=*&order=ano.desc,mes.desc'),
      sb.get('cda_marketing_investimentos', 'select=*'),
      sb.get('cda_marketing_metricas', 'select=campanha_id,data,investimento')
    ]);
    ST.orcamentos = res[0]; ST.investimentos = res[1]; ST.metricas = res[2];
  } catch (err) {
    host.innerHTML = '<p style="color:var(--rust,#c0392b)">Erro ao carregar orçamentos: ' + (err.message || err) + '</p>';
    return;
  }

  function gastoMetaNoMes(mes, ano) {
    return ST.metricas.filter(function (m) {
      var d = new Date(m.data);
      return (d.getUTCMonth() + 1) === mes && d.getUTCFullYear() === ano;
    }).reduce(function (s, m) { return s + Number(m.investimento || 0); }, 0);
  }
  function investimentosDoOrcamento(orcId) {
    return ST.investimentos.filter(function (i) { return i.orcamento_id === orcId; }).reduce(function (s, i) { return s + Number(i.valor || 0); }, 0);
  }

  var linhas = ST.orcamentos.map(function (o) {
    var gastoMeta = gastoMetaNoMes(o.mes, o.ano);
    var outrosGastos = investimentosDoOrcamento(o.id);
    var totalGasto = gastoMeta + outrosGastos;
    var totalOrcado = Number(o.orcamento_total || 0) + Number(o.orcamento_outros || 0);
    var pct = totalOrcado > 0 ? Math.min(100, (totalGasto / totalOrcado) * 100) : 0;
    var acimaThreshold = pct >= Number(o.threshold_alerta || 80);
    return '<tr>' +
      '<td>' + MKT_MESES[o.mes - 1] + '/' + o.ano + '</td>' +
      '<td>' + mktFmtMoeda(totalOrcado) + '</td>' +
      '<td>' + mktFmtMoeda(totalGasto) + '</td>' +
      '<td style="min-width:140px">' +
        '<div class="pg-barra-track" style="height:14px"><div class="pg-barra-fill" style="width:' + pct.toFixed(0) + '%;background:' + (acimaThreshold ? 'var(--rust,#c0392b)' : 'var(--green,#3ec97a)') + '"></div></div>' +
        '<span class="tmu" style="font-size:10px">' + pct.toFixed(0) + '%</span>' +
      '</td>' +
      '<td>' + mktFmtMoeda(o.receita_realizada) + '</td>' +
      (editavel ? '<td><button class="btn" onclick="mktAbrirModalOrcamento(\'' + containerId + '\',' + o.id + ')">Editar</button></td>' : '') +
      '</tr>';
  }).join('');

  host.innerHTML =
    '<div class="row-bt"><div><div class="sec-t">💰 Orçamento Mensal</div><div class="sec-d">Controle de verba de mídia paga — independente do Financeiro</div></div>' +
    (editavel ? '<button class="btn" id="mkt-btn-novo-orc">+ Novo Orçamento</button>' : '') + '</div>' +
    '<div class="tbl-wrap"><table><thead><tr><th>Mês/Ano</th><th>Orçado</th><th>Gasto</th><th>% Usado</th><th>Receita Realizada</th>' +
      (editavel ? '<th></th>' : '') + '</tr></thead><tbody>' + (linhas || '<tr><td colspan="6" class="tmu">Nenhum orçamento cadastrado.</td></tr>') + '</tbody></table></div>';

  host._mktOrcState = ST;
  if (editavel) host.querySelector('#mkt-btn-novo-orc').addEventListener('click', function () { mktAbrirModalOrcamento(containerId, null); });
}

function mktAbrirModalOrcamento(containerId, orcId) {
  var host = document.getElementById(containerId);
  var ST = host._mktOrcState;
  var o = orcId ? ST.orcamentos.find(function (x) { return x.id === orcId; }) : null;
  var anoAtual = new Date().getFullYear();

  openModal(
    '<div class="modal-box"><h3>' + (o ? 'Editar Orçamento' : 'Novo Orçamento') + '</h3>' +
    '<div style="margin-top:14px;display:flex;gap:8px">' +
      '<div style="flex:1"><label>Mês</label><select id="of-mes" style="width:100%">' + MKT_MESES.map(function (m, i) { return '<option value="' + (i + 1) + '"' + (o ? (o.mes === i + 1 ? ' selected' : '') : '') + '>' + m + '</option>'; }).join('') + '</select></div>' +
      '<div style="flex:1"><label>Ano</label><input type="number" id="of-ano" value="' + (o ? o.ano : anoAtual) + '" style="width:100%"></div>' +
    '</div>' +
    '<div style="margin-top:10px"><label>Orçamento total (R$)</label><input type="number" step="0.01" id="of-total" value="' + (o ? o.orcamento_total : '') + '" style="width:100%"></div>' +
    '<div style="margin-top:10px"><label>Orçamento outros (R$, opcional)</label><input type="number" step="0.01" id="of-outros" value="' + (o && o.orcamento_outros ? o.orcamento_outros : '') + '" style="width:100%"></div>' +
    '<div style="margin-top:10px"><label>Receita realizada (R$)</label><input type="number" step="0.01" id="of-receita" value="' + (o ? o.receita_realizada || 0 : 0) + '" style="width:100%"></div>' +
    '<div style="margin-top:20px;display:flex;gap:10px;justify-content:flex-end">' +
      '<button class="btn" onclick="closeModal()">Cancelar</button>' +
      '<button class="btn rust" onclick="mktSalvarOrcamento(\'' + containerId + '\',' + (o ? o.id : 'null') + ')">Salvar</button>' +
    '</div></div>'
  );
}

async function mktSalvarOrcamento(containerId, orcId) {
  var body = {
    mes: Number(document.getElementById('of-mes').value),
    ano: Number(document.getElementById('of-ano').value),
    orcamento_total: document.getElementById('of-total').value || 0,
    orcamento_outros: document.getElementById('of-outros').value || null,
    receita_realizada: document.getElementById('of-receita').value || 0,
    atualizado_em: new Date().toISOString()
  };
  try {
    if (orcId) { await sb.patch('cda_marketing_orcamentos', orcId, body); }
    else { body.criado_em = new Date().toISOString(); await sb.post('cda_marketing_orcamentos', body); }
    closeModal();
    showToast('Orçamento salvo.');
    await montarModuloMktOrcamento(containerId, { editavel: true });
  } catch (err) {
    showToast('Erro ao salvar: ' + (err.message || err), 'error');
  }
}

// ────────────────────────────────────────────────────────────────
// 4) ANALYTICS / DASHBOARD (somente leitura)
// ────────────────────────────────────────────────────────────────
async function montarModuloMktAnalytics(containerId) {
  var host = document.getElementById(containerId);
  if (!host) return;
  host.innerHTML = '<p class="tmu">Carregando analytics...</p>';

  var ST = { campanhas: [], metricas: [], canais: [] };
  try {
    var res = await Promise.all([
      sb.get('cda_marketing_campanhas', 'select=id,nome,canal_id,status'),
      sb.get('cda_marketing_metricas', 'select=*'),
      mktCarregarCanais()
    ]);
    ST.campanhas = res[0]; ST.metricas = res[1]; ST.canais = res[2];
  } catch (err) {
    host.innerHTML = '<p style="color:var(--rust,#c0392b)">Erro ao carregar analytics: ' + (err.message || err) + '</p>';
    return;
  }
  var campPorId = {}; ST.campanhas.forEach(function (c) { campPorId[c.id] = c; });
  var canalPorId = {}; ST.canais.forEach(function (c) { canalPorId[c.id] = c; });

  var totalSpend = 0, totalRevenue = 0, totalConv = 0, totalImpressoes = 0, totalCliques = 0;
  ST.metricas.forEach(function (m) {
    totalSpend += Number(m.investimento || 0);
    totalRevenue += Number(m.receita || 0);
    totalConv += Number(m.conversoes || 0);
    totalImpressoes += Number(m.impressoes || 0);
    totalCliques += Number(m.cliques || 0);
  });
  var roasGeral = totalSpend > 0 ? (totalRevenue / totalSpend) : 0;
  var cacGeral = totalConv > 0 ? (totalSpend / totalConv) : 0;
  var ctrGeral = totalImpressoes > 0 ? (totalCliques / totalImpressoes) * 100 : 0;

  // Agregação por campanha
  var porCampanha = {};
  ST.metricas.forEach(function (m) {
    if (!porCampanha[m.campanha_id]) porCampanha[m.campanha_id] = { spend: 0, revenue: 0, conv: 0 };
    porCampanha[m.campanha_id].spend += Number(m.investimento || 0);
    porCampanha[m.campanha_id].revenue += Number(m.receita || 0);
    porCampanha[m.campanha_id].conv += Number(m.conversoes || 0);
  });
  var rankingCampanhas = Object.keys(porCampanha).map(function (id) {
    var c = campPorId[id];
    var agg = porCampanha[id];
    return { nome: c ? c.nome : ('#' + id), spend: agg.spend, revenue: agg.revenue, roas: agg.spend > 0 ? agg.revenue / agg.spend : 0 };
  }).sort(function (a, b) { return b.spend - a.spend; }).slice(0, 10);

  // Agregação por canal
  var porCanal = {};
  ST.metricas.forEach(function (m) {
    var camp = campPorId[m.campanha_id];
    var canalId = camp ? camp.canal_id : null;
    var key = canalId || 'sem-canal';
    if (!porCanal[key]) porCanal[key] = { spend: 0, revenue: 0 };
    porCanal[key].spend += Number(m.investimento || 0);
    porCanal[key].revenue += Number(m.receita || 0);
  });
  var rankingCanais = Object.keys(porCanal).map(function (k) {
    var nome = k === 'sem-canal' ? 'Sem canal' : (canalPorId[k] ? canalPorId[k].nome : ('#' + k));
    var agg = porCanal[k];
    return { nome: nome, spend: agg.spend, revenue: agg.revenue, roas: agg.spend > 0 ? agg.revenue / agg.spend : 0 };
  }).sort(function (a, b) { return b.spend - a.spend; });

  var maxSpendCampanha = Math.max.apply(null, rankingCampanhas.map(function (r) { return r.spend; }).concat([1]));

  host.innerHTML =
    '<div class="row-bt"><div><div class="sec-t">📊 Analytics / Dashboard</div><div class="sec-d">Consolidado de todas as campanhas — somente leitura</div></div></div>' +
    '<div class="pg-kpi-strip" style="grid-template-columns:repeat(5,1fr)">' +
      '<div class="pg-kpi"><div class="v">' + mktFmtMoeda(totalSpend) + '</div><div class="l">Investido</div></div>' +
      '<div class="pg-kpi"><div class="v">' + mktFmtMoeda(totalRevenue) + '</div><div class="l">Receita</div></div>' +
      '<div class="pg-kpi"><div class="v">' + roasGeral.toFixed(2) + 'x</div><div class="l">ROAS</div></div>' +
      '<div class="pg-kpi"><div class="v">' + mktFmtMoeda(cacGeral) + '</div><div class="l">CAC</div></div>' +
      '<div class="pg-kpi"><div class="v">' + ctrGeral.toFixed(2) + '%</div><div class="l">CTR</div></div>' +
    '</div>' +
    '<div class="pg-2col">' +
      '<div class="pg-bloco"><h3>Top 10 Campanhas por Investimento</h3>' +
        rankingCampanhas.map(function (r) {
          return '<div class="pg-barra-row"><span class="pg-barra-label" title="' + r.nome + '">' + r.nome.substring(0, 22) + '</span>' +
            '<div class="pg-barra-track"><div class="pg-barra-fill" style="width:' + ((r.spend / maxSpendCampanha) * 100).toFixed(0) + '%"></div></div>' +
            '<span class="pg-barra-num">' + r.roas.toFixed(1) + 'x</span></div>';
        }).join('') +
      '</div>' +
      '<div class="pg-bloco"><h3>Por Canal</h3>' +
        rankingCanais.map(function (r) {
          return '<div class="pg-linha"><span>' + r.nome + '</span><span>' + mktFmtMoeda(r.spend) + ' · ROAS ' + r.roas.toFixed(1) + 'x</span></div>';
        }).join('') +
      '</div>' +
    '</div>';
}

// ────────────────────────────────────────────────────────────────
// 5) CALENDÁRIO EDITORIAL
// ────────────────────────────────────────────────────────────────
var MKT_CAL_STATUS = { planejado: 'Planejado', em_producao: 'Em produção', aprovado: 'Aprovado', publicado: 'Publicado', cancelado: 'Cancelado' };
var MKT_CAL_STATUS_BADGE = { planejado: 'pending', em_producao: 'agencia', aprovado: 'interno', publicado: 'done', cancelado: 'alert' };

async function montarModuloMktCalendario(containerId, opts) {
  var editavel = !opts || opts.editavel !== false;
  var host = document.getElementById(containerId);
  if (!host) return;
  host.innerHTML = '<p class="tmu">Carregando calendário editorial...</p>';

  var ST = { itens: [], canais: [] };
  try {
    var res = await Promise.all([
      sb.get('cda_marketing_calendario', 'select=*&order=data_publicacao.asc'),
      mktCarregarCanais()
    ]);
    ST.itens = res[0]; ST.canais = res[1];
  } catch (err) {
    host.innerHTML = '<p style="color:var(--rust,#c0392b)">Erro ao carregar calendário: ' + (err.message || err) + '</p>';
    return;
  }
  var canalPorId = {}; ST.canais.forEach(function (c) { canalPorId[c.id] = c; });

  var linhas = ST.itens.map(function (i) {
    var canal = canalPorId[i.canal_id];
    return '<tr>' +
      '<td>' + mktFmtData(i.data_publicacao) + '</td>' +
      '<td>' + i.titulo + '</td>' +
      '<td>' + (canal ? canal.nome : '—') + '</td>' +
      '<td>' + (i.tipo_conteudo || '—') + '</td>' +
      '<td>' + (i.plataforma || '—') + '</td>' +
      '<td><span class="badge badge-' + (MKT_CAL_STATUS_BADGE[i.status] || 'pending') + '">' + (MKT_CAL_STATUS[i.status] || i.status) + '</span></td>' +
      '<td>' + (i.responsavel || '—') + '</td>' +
      (editavel ? '<td><button class="btn" onclick="mktAbrirModalCalendario(\'' + containerId + '\',' + i.id + ')">Editar</button></td>' : '') +
      '</tr>';
  }).join('');

  host.innerHTML =
    '<div class="row-bt"><div><div class="sec-t">📅 Calendário Editorial</div><div class="sec-d">Pauta e datas de postagem — 100% separado do módulo Calendário geral</div></div>' +
    (editavel ? '<button class="btn" id="mkt-btn-novo-cal">+ Novo Post</button>' : '') + '</div>' +
    '<div class="tbl-wrap"><table><thead><tr><th>Data</th><th>Título</th><th>Canal</th><th>Tipo</th><th>Plataforma</th><th>Status</th><th>Responsável</th>' +
      (editavel ? '<th></th>' : '') + '</tr></thead><tbody>' + (linhas || '<tr><td colspan="8" class="tmu">Nenhum post cadastrado.</td></tr>') + '</tbody></table></div>';

  host._mktCalState = ST;
  if (editavel) host.querySelector('#mkt-btn-novo-cal').addEventListener('click', function () { mktAbrirModalCalendario(containerId, null); });
}

function mktAbrirModalCalendario(containerId, itemId) {
  var host = document.getElementById(containerId);
  var ST = host._mktCalState;
  var i = itemId ? ST.itens.find(function (x) { return x.id === itemId; }) : null;
  var opcoesCanal = '<option value="">— sem canal —</option>' + ST.canais.map(function (ca) {
    return '<option value="' + ca.id + '"' + (i && i.canal_id === ca.id ? ' selected' : '') + '>' + ca.nome + '</option>';
  }).join('');

  openModal(
    '<div class="modal-box"><h3>' + (i ? 'Editar Post' : 'Novo Post') + '</h3>' +
    '<div style="margin-top:14px"><label>Título</label><input type="text" id="cf-titulo" value="' + (i ? i.titulo.replace(/"/g, '&quot;') : '') + '" style="width:100%"></div>' +
    '<div style="margin-top:10px"><label>Canal</label><select id="cf-canal" style="width:100%">' + opcoesCanal + '</select></div>' +
    '<div style="margin-top:10px;display:flex;gap:8px">' +
      '<div style="flex:1"><label>Data publicação</label><input type="date" id="cf-data" value="' + (i && i.data_publicacao ? i.data_publicacao.substring(0, 10) : '') + '" style="width:100%"></div>' +
      '<div style="flex:1"><label>Status</label><select id="cf-status" style="width:100%">' + Object.keys(MKT_CAL_STATUS).map(function (k) { return '<option value="' + k + '"' + (i ? (i.status === k ? ' selected' : '') : (k === 'planejado' ? ' selected' : '')) + '>' + MKT_CAL_STATUS[k] + '</option>'; }).join('') + '</select></div>' +
    '</div>' +
    '<div style="margin-top:10px;display:flex;gap:8px">' +
      '<div style="flex:1"><label>Tipo de conteúdo</label><input type="text" id="cf-tipo" value="' + (i && i.tipo_conteudo ? i.tipo_conteudo : '') + '" placeholder="post, story, reels..." style="width:100%"></div>' +
      '<div style="flex:1"><label>Plataforma</label><input type="text" id="cf-plataforma" value="' + (i && i.plataforma ? i.plataforma : '') + '" placeholder="instagram, tiktok..." style="width:100%"></div>' +
    '</div>' +
    '<div style="margin-top:10px"><label>Responsável</label><input type="text" id="cf-responsavel" value="' + (i && i.responsavel ? i.responsavel : '') + '" style="width:100%"></div>' +
    '<div style="margin-top:10px"><label>Legenda (opcional)</label><textarea id="cf-legenda" style="width:100%;min-height:60px">' + (i && i.legenda ? i.legenda : '') + '</textarea></div>' +
    '<div style="margin-top:20px;display:flex;gap:10px;justify-content:flex-end">' +
      '<button class="btn" onclick="closeModal()">Cancelar</button>' +
      '<button class="btn rust" onclick="mktSalvarCalendario(\'' + containerId + '\',' + (i ? i.id : 'null') + ')">Salvar</button>' +
    '</div></div>'
  );
}

async function mktSalvarCalendario(containerId, itemId) {
  var body = {
    titulo: document.getElementById('cf-titulo').value.trim(),
    canal_id: document.getElementById('cf-canal').value || null,
    data_publicacao: document.getElementById('cf-data').value || null,
    status: document.getElementById('cf-status').value,
    tipo_conteudo: document.getElementById('cf-tipo').value.trim() || null,
    plataforma: document.getElementById('cf-plataforma').value.trim() || null,
    responsavel: document.getElementById('cf-responsavel').value.trim() || null,
    legenda: document.getElementById('cf-legenda').value.trim() || null,
    atualizado_em: new Date().toISOString()
  };
  if (!body.titulo || !body.data_publicacao) { showToast('Título e data de publicação são obrigatórios.', 'error'); return; }
  try {
    if (itemId) { await sb.patch('cda_marketing_calendario', itemId, body); }
    else { body.criado_em = new Date().toISOString(); await sb.post('cda_marketing_calendario', body); }
    closeModal();
    showToast('Post salvo no calendário.');
    await montarModuloMktCalendario(containerId, { editavel: true });
  } catch (err) {
    showToast('Erro ao salvar: ' + (err.message || err), 'error');
  }
}

// ────────────────────────────────────────────────────────────────
// 6) SIMULAÇÕES IA (placeholder estrutural — sem lógica ativa)
// ────────────────────────────────────────────────────────────────
function montarModuloMktSimulacoes(containerId) {
  var host = document.getElementById(containerId);
  if (!host) return;
  host.innerHTML =
    '<div class="row-bt"><div><div class="sec-t">🤖 Simulações IA</div><div class="sec-d">Alocação de orçamento sugerida por IA entre campanhas/canais</div></div></div>' +
    '<div class="rec-box"><div class="rec-title">🚧 Em construção</div>' +
    '<p class="tmu">A tabela de dados já existe (<code>cda_marketing_simulacoes</code>), mas a lógica de sugestão por IA não foi migrada do Manus — a versão anterior não funcionava de forma confiável. Este submódulo será reconstruído do zero, usando a API da Anthropic, em uma etapa futura.</p></div>';
}

// A entrada do submódulo Tutorial usa a função já existente montarModuloTutorial(containerId,{modulo:'marketing'})
// definida em cda-modulo-tutorial.js — não precisa de código próprio aqui.

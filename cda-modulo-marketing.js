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

  var ST = { campanhas: [], canais: [], metricas: [], ultimaSinc: null };
  try {
    var res = await Promise.all([
      sb.get('cda_marketing_campanhas', 'select=*&order=data_inicio.desc.nullslast'),
      mktCarregarCanais(),
      sb.get('cda_marketing_metricas', 'select=campanha_id,data,investimento,receita'),
      sb.get('cda_marketing_meta_config', 'select=ultima_sincronizacao&id=eq.1')
    ]);
    ST.campanhas = res[0]; ST.canais = res[1]; ST.metricas = res[2];
    ST.ultimaSinc = res[3] && res[3][0] ? res[3][0].ultima_sincronizacao : null;
  } catch (err) {
    host.innerHTML = '<p style="color:var(--rust,#c0392b)">Erro ao carregar campanhas: ' + (err.message || err) + '</p>';
    return;
  }
  var canalPorId = {}; ST.canais.forEach(function (c) { canalPorId[c.id] = c; });

  function diasNoMes(ano, mes) { return new Date(ano, mes, 0).getDate(); }

  function render() {
    var fStatus = host.querySelector('#mkt-f-status') ? host.querySelector('#mkt-f-status').value : '';
    var fBusca = host.querySelector('#mkt-f-busca') ? host.querySelector('#mkt-f-busca').value.toLowerCase() : '';
    var fInicioDe = host.querySelector('#mkt-f-inicio-de') ? host.querySelector('#mkt-f-inicio-de').value : '';
    var fInicioAte = host.querySelector('#mkt-f-inicio-ate') ? host.querySelector('#mkt-f-inicio-ate').value : '';
    var fMesRef = host.querySelector('#mkt-f-mes-ref').value; // formato YYYY-MM

    var lista = ST.campanhas.filter(function (c) {
      if (fStatus && c.status !== fStatus) return false;
      if (fBusca && c.nome.toLowerCase().indexOf(fBusca) === -1) return false;
      if (fInicioDe && (!c.data_inicio || c.data_inicio.substring(0, 10) < fInicioDe)) return false;
      if (fInicioAte && (!c.data_inicio || c.data_inicio.substring(0, 10) > fInicioAte)) return false;
      return true;
    });

    var ano = fMesRef ? Number(fMesRef.split('-')[0]) : null;
    var mes = fMesRef ? Number(fMesRef.split('-')[1]) : null;
    var inicioMes = fMesRef ? fMesRef + '-01' : null;
    var fimMes = fMesRef ? fMesRef + '-' + String(diasNoMes(ano, mes)).padStart(2, '0') : null;

    // Investido no MÊS de referência (não acumulado) + acumulado ATÉ o fim do mês (para saldo vitalício)
    var investidoMes = {}, investidoAcumulado = {}, receitaMes = {};
    ST.metricas.forEach(function (m) {
      var d = m.data.substring(0, 10);
      if (!porOk(m.campanha_id, investidoMes)) investidoMes[m.campanha_id] = 0;
      if (!porOk(m.campanha_id, investidoAcumulado)) investidoAcumulado[m.campanha_id] = 0;
      if (!porOk(m.campanha_id, receitaMes)) receitaMes[m.campanha_id] = 0;
      if (fMesRef) {
        if (d >= inicioMes && d <= fimMes) { investidoMes[m.campanha_id] += Number(m.investimento || 0); receitaMes[m.campanha_id] += Number(m.receita || 0); }
        if (d <= fimMes) investidoAcumulado[m.campanha_id] += Number(m.investimento || 0);
      } else {
        investidoMes[m.campanha_id] += Number(m.investimento || 0);
        receitaMes[m.campanha_id] += Number(m.receita || 0);
        investidoAcumulado[m.campanha_id] += Number(m.investimento || 0);
      }
    });
    function porOk(id, obj) { return obj.hasOwnProperty(id); }

    // Totalizador
    var totStatusAtual = {};
    var totAtivaPeriodo = 0, totSemGastoPeriodo = 0;
    lista.forEach(function (c) {
      totStatusAtual[c.status] = (totStatusAtual[c.status] || 0) + 1;
      var inv = investidoMes[c.id] || 0;
      if (inv > 0) totAtivaPeriodo++; else totSemGastoPeriodo++;
    });
    var kpiStatusHtml = Object.keys(totStatusAtual).map(function (k) {
      return '<div class="pg-kpi"><div class="v">' + totStatusAtual[k] + '</div><div class="l">' + (MKT_STATUS[k] || k) + ' (hoje)</div></div>';
    }).join('');
    var kpiPeriodoHtml = fMesRef
      ? '<div class="pg-kpi"><div class="v">' + totAtivaPeriodo + '</div><div class="l">Com gasto em ' + fMesRef + '</div></div>' +
        '<div class="pg-kpi"><div class="v">' + totSemGastoPeriodo + '</div><div class="l">Sem gasto em ' + fMesRef + '</div></div>'
      : '';

    host.querySelector('#mkt-kpis').innerHTML =
      '<div class="pg-kpi-strip" style="grid-template-columns:repeat(' + (Object.keys(totStatusAtual).length + (fMesRef ? 2 : 0)) + ',1fr)">' +
      kpiStatusHtml + kpiPeriodoHtml + '</div>';

    var totOrcMes = 0, totInvMes = 0, totRec = 0;
    var linhas = lista.map(function (c) {
      var canal = canalPorId[c.canal_id];
      var invMes = investidoMes[c.id] || 0;
      var invAcum = investidoAcumulado[c.id] || 0;
      var rec = receitaMes[c.id] || 0;
      var roas = invMes > 0 ? (rec / invMes).toFixed(2) + 'x' : '—';
      var ativaPeriodo = fMesRef
        ? (invMes > 0 ? '<span class="badge badge-done">Sim</span>' : '<span class="badge badge-pending">Não</span>')
        : '<span class="tmu">— selecione mês —</span>';

      // Orçamento: 3 colunas conforme tipo_orcamento
      var orcDiario = '—', orcMesTotal = '—', saldo = '—', orcMesNum = null;
      if (c.tipo_orcamento === 'diario' && c.orcamento) {
        orcDiario = mktFmtMoeda(c.orcamento);
        if (fMesRef) {
          var orcMesCalc = Number(c.orcamento) * diasNoMes(ano, mes);
          orcMesNum = orcMesCalc;
          orcMesTotal = mktFmtMoeda(orcMesCalc) + '<br><span class="tmu" style="font-size:9px">diária × ' + diasNoMes(ano, mes) + ' dias</span>';
          saldo = mktFmtMoeda(orcMesCalc - invMes);
        } else {
          orcMesTotal = '<span class="tmu">selecione o mês</span>';
        }
      } else if (c.tipo_orcamento === 'total' && c.orcamento) {
        orcDiario = '<span class="tmu">— (vitalício)</span>';
        orcMesTotal = mktFmtMoeda(c.orcamento) + '<br><span class="tmu" style="font-size:9px">total da campanha</span>';
        if (fMesRef) saldo = mktFmtMoeda(Number(c.orcamento) - invAcum) + '<br><span class="tmu" style="font-size:9px">acumulado até ' + fMesRef + '</span>';
        else saldo = '<span class="tmu">selecione o mês</span>';
      } else if (c.orcamento) {
        orcMesTotal = mktFmtMoeda(c.orcamento) + '<br><span class="tmu" style="font-size:9px">tipo desconhecido</span>';
      }

      totOrcMes += orcMesNum || 0;
      totInvMes += invMes;
      totRec += rec;

      return '<tr>' +
        '<td>' + c.nome + (c.categoria_campanha ? '<br><span class="tmu" style="font-size:10px">' + c.categoria_campanha + '</span>' : '') + '</td>' +
        '<td>' + (canal ? canal.nome : '<span class="tmu">— sem canal —</span>') + '</td>' +
        '<td>' + (MKT_OBJETIVOS[c.objetivo] || c.objetivo) + '</td>' +
        '<td><span class="badge badge-' + (MKT_STATUS_BADGE[c.status] || 'pending') + '">' + (MKT_STATUS[c.status] || c.status) + '</span></td>' +
        '<td>' + ativaPeriodo + '</td>' +
        '<td>' + mktFmtData(c.data_inicio) + '</td>' +
        '<td>' + mktFmtData(c.data_fim) + '</td>' +
        '<td>' + orcDiario + '</td>' +
        '<td>' + orcMesTotal + '</td>' +
        '<td>' + saldo + '</td>' +
        '<td>' + mktFmtMoeda(invMes) + '</td>' +
        '<td>' + mktFmtMoeda(rec) + '</td>' +
        '<td>' + roas + '</td>' +
        (editavel ? '<td><button class="btn" onclick="mktAbrirModalCampanha(\'' + containerId + '\',' + c.id + ')">Editar</button></td>' : '') +
        '</tr>';
    }).join('');

    var roasTotal = totInvMes > 0 ? (totRec / totInvMes).toFixed(2) + 'x' : '—';
    var linhaTotal = lista.length ? (
      '<tr style="font-weight:700;background:var(--bg2,#f5f0e6);border-top:2px solid var(--border2,#ccc)">' +
      '<td colspan="8">TOTAL (' + lista.length + ' campanhas' + (fMesRef ? ' — ' + fMesRef : '') + ')</td>' +
      '<td>' + mktFmtMoeda(totOrcMes) + '</td>' +
      '<td>—</td>' +
      '<td>' + mktFmtMoeda(totInvMes) + '</td>' +
      '<td>' + mktFmtMoeda(totRec) + '</td>' +
      '<td>' + roasTotal + '</td>' +
      (editavel ? '<td></td>' : '') +
      '</tr>'
    ) : '';

    host.querySelector('#mkt-camp-tbody').innerHTML = (linhas || '<tr><td colspan="14" class="tmu">Nenhuma campanha encontrada.</td></tr>') + linhaTotal;
  }

  var hoje = new Date();
  var mesAtualStr = hoje.getFullYear() + '-' + String(hoje.getMonth() + 1).padStart(2, '0');

  host.innerHTML =
    '<div class="row-bt"><div><div class="sec-t">📣 Campanhas</div><div class="sec-d">Campanhas de mídia paga (Meta Ads) — vinculadas aos Canais/Collabs existentes</div></div>' +
    (editavel ? '<button class="btn" id="mkt-btn-nova">+ Nova Campanha</button>' : '') + '</div>' +
    '<p class="tmu" style="margin-bottom:10px">🕒 "Status" reflete a última sincronização com o Meta: <b>' + (ST.ultimaSinc ? mktFmtData(ST.ultimaSinc) + ' às ' + new Date(ST.ultimaSinc).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : 'nunca sincronizado') + '</b>. Para ver dados de um mês passado, NÃO filtre por status — use o mês de referência e veja a coluna "Ativa no período" (campanhas pausadas hoje podem ter gasto real em meses anteriores).</p>' +
    '<div id="mkt-kpis" style="margin-bottom:14px"></div>' +
    '<div class="fb">' +
      '<input type="text" id="mkt-f-busca" placeholder="Buscar por nome...">' +
      '<select id="mkt-f-status"><option value="">Todos os status</option>' +
        Object.keys(MKT_STATUS).map(function (k) { return '<option value="' + k + '">' + MKT_STATUS[k] + '</option>'; }).join('') +
      '</select>' +
    '</div>' +
    '<div class="fb" style="margin-top:6px">' +
      '<span class="tmu" style="align-self:center">Início da campanha:</span>' +
      '<input type="date" id="mkt-f-inicio-de" title="Início — de">' +
      '<input type="date" id="mkt-f-inicio-ate" title="Início — até">' +
      '<span class="tmu" style="align-self:center;margin-left:10px;font-weight:600">📅 Mês de referência:</span>' +
      '<input type="month" id="mkt-f-mes-ref" value="' + mesAtualStr + '">' +
      '<button class="btn" id="mkt-f-limpar-periodo">Limpar filtros</button>' +
    '</div>' +
    '<div class="tbl-wrap"><table><thead><tr><th>Campanha</th><th>Canal</th><th>Objetivo</th><th>Status (hoje)</th><th>Ativa no período</th><th>Início</th><th>Fim</th><th>Orç. Diário</th><th>Orç. do Mês/Total</th><th>Saldo</th><th>Investido no mês</th><th>Receita</th><th>ROAS</th>' +
      (editavel ? '<th></th>' : '') + '</tr></thead><tbody id="mkt-camp-tbody"></tbody></table></div>';

  ['mkt-f-busca'].forEach(function (id) { host.querySelector('#' + id).addEventListener('input', render); });
  ['mkt-f-status', 'mkt-f-inicio-de', 'mkt-f-inicio-ate', 'mkt-f-mes-ref'].forEach(function (id) {
    host.querySelector('#' + id).addEventListener('change', render);
  });
  host.querySelector('#mkt-f-limpar-periodo').addEventListener('click', function () {
    ['mkt-f-inicio-de', 'mkt-f-inicio-ate'].forEach(function (id) { host.querySelector('#' + id).value = ''; });
    host.querySelector('#mkt-f-mes-ref').value = mesAtualStr;
    render();
  });
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
      '<div style="flex:1"><label>Tipo de orçamento</label><select id="mf-tipo-orc" style="width:100%">' +
        '<option value="">— não definido —</option>' +
        '<option value="diario"' + (c && c.tipo_orcamento === 'diario' ? ' selected' : '') + '>Diário</option>' +
        '<option value="total"' + (c && c.tipo_orcamento === 'total' ? ' selected' : '') + '>Total/Vitalício</option>' +
      '</select></div>' +
    '</div>' +
    '<div style="margin-top:10px"><label id="mf-orcamento-label">Orçamento (R$)</label><input type="number" step="0.01" id="mf-orcamento" value="' + (c ? c.orcamento || '' : '') + '" style="width:100%"></div>' +
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
    tipo_orcamento: document.getElementById('mf-tipo-orc').value || null,
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
    (editavel ? '<button id="mkt-btn-sincronizar" style="width:100%;padding:16px;font-size:16px;font-weight:700;background:var(--rust,#c0392b);color:#fff;border:none;border-radius:10px;cursor:pointer;margin-bottom:16px;box-shadow:0 2px 6px rgba(0,0,0,.15)">🔄 Sincronizar agora</button>' : '') +
    '<div id="mkt-sync-resultado"></div>' +
    '<div class="cc" style="max-width:560px">' +
      '<h3>Status da conexão ' + statusHtml + '</h3>' +
      '<div class="pg-linha"><span class="tmu">Ad Account ID</span><span>' + (cfg && cfg.ad_account_id ? cfg.ad_account_id : '—') + '</span></div>' +
      '<div class="pg-linha"><span class="tmu">Pixel ID</span><span>' + (cfg && cfg.pixel_id ? cfg.pixel_id : '—') + '</span></div>' +
      '<div class="pg-linha"><span class="tmu">Última sincronização</span><span>' + (cfg && cfg.ultima_sincronizacao ? mktFmtData(cfg.ultima_sincronizacao) : '—') + '</span></div>' +
      '<div class="pg-linha"><span class="tmu">Status técnico</span><span>' + (cfg && cfg.status_sincronizacao ? cfg.status_sincronizacao : '—') + '</span></div>' +
      (editavel ? '<button class="btn" style="margin-top:14px" id="mkt-btn-reconectar">Reconectar Meta Ads</button>' : '') +
    '</div>' +
    '<div class="rec-box" style="margin-top:14px"><div class="rec-title">ℹ️ Como funciona</div>' +
    '<p class="tmu">"Sincronizar agora" atualiza status e métricas (últimos 30 dias) das campanhas que já existem no nosso sistema. Campanhas novas encontradas na conta do Meta que ainda não existem aqui NÃO são criadas automaticamente — aparecem listadas no resultado, para você revisar e decidir se quer trazer.</p></div>';

  if (editavel) {
    host.querySelector('#mkt-btn-sincronizar').addEventListener('click', function () { mktSincronizarMeta(containerId); });
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

async function mktSincronizarMeta(containerId) {
  var host = document.getElementById(containerId);
  var resDiv = host.querySelector('#mkt-sync-resultado');
  var btn = host.querySelector('#mkt-btn-sincronizar');
  btn.disabled = true; btn.textContent = '⏳ Sincronizando...'; btn.style.opacity = '0.7';
  resDiv.innerHTML = '<div style="padding:14px;border-radius:10px;background:#fff8e6;border:2px solid #e0b84e;margin-bottom:16px;font-weight:600">⏳ Consultando a API do Meta Ads — isso pode levar alguns segundos...</div>';

  try {
    var resp = await fetch(SUPABASE_URL + '/functions/v1/sync-meta-ads', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}'
    });
    var data = await resp.json();
    if (!resp.ok || data.error) throw new Error(data.error || 'Erro desconhecido');

    var novasHtml = '';
    if (data.total_novas_encontradas > 0) {
      novasHtml = '<div class="rec-box" style="margin-top:10px"><div class="rec-title">📋 ' + data.total_novas_encontradas + ' campanha(s) nova(s) encontrada(s) no Meta (não importadas)</div>' +
        '<div class="tbl-wrap"><table><thead><tr><th>Nome</th><th>Status</th></tr></thead><tbody>' +
        data.novas_encontradas.map(function (n) { return '<tr><td>' + n.nome + '</td><td>' + n.status + '</td></tr>'; }).join('') +
        '</tbody></table></div></div>';
    }

    resDiv.innerHTML =
      '<div style="padding:16px;border-radius:10px;background:#e9f9ef;border:2px solid var(--green,#3ec97a);margin-bottom:16px">' +
      '<div style="font-size:16px;font-weight:700;color:#1f7a45;margin-bottom:10px">✅ Sincronização concluída com sucesso</div>' +
      '<div class="pg-linha"><span class="tmu">Campanhas encontradas no Meta</span><span>' + data.campanhas_no_meta + '</span></div>' +
      '<div class="pg-linha"><span class="tmu">Campanhas atualizadas</span><span>' + data.campanhas_atualizadas + '</span></div>' +
      '<div class="pg-linha"><span class="tmu">Métricas gravadas</span><span>' + data.metricas_gravadas + '</span></div>' +
      '</div>' + novasHtml;
    showToast('Sincronização concluída.');
    btn.disabled = false; btn.textContent = '🔄 Sincronizar agora'; btn.style.opacity = '1';
  } catch (err) {
    console.error(err);
    resDiv.innerHTML = '<div style="padding:16px;border-radius:10px;background:#fdeaea;border:2px solid var(--rust,#c0392b);margin-bottom:16px">' +
      '<div style="font-size:16px;font-weight:700;color:#a8281a">❌ Erro na sincronização</div>' +
      '<p class="tmu" style="margin-top:6px">' + (err.message || err) + '</p></div>';
    btn.disabled = false; btn.textContent = '🔄 Sincronizar agora'; btn.style.opacity = '1';
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
// 4) ANALYTICS / DASHBOARD (somente leitura) — filtros + gráficos + tabelas
// ────────────────────────────────────────────────────────────────
function mktSvgLineChart(pontos, opts) {
  // pontos: [{label, spend, revenue}], desenha duas linhas (spend/revenue) em SVG puro.
  opts = opts || {};
  var w = opts.width || 760, h = opts.height || 220, pad = { t: 16, r: 16, b: 28, l: 64 };
  var innerW = w - pad.l - pad.r, innerH = h - pad.t - pad.b;
  if (!pontos.length) return '<p class="tmu">Sem dados no período selecionado.</p>';
  var maxV = Math.max.apply(null, pontos.map(function (p) { return Math.max(p.spend, p.revenue); }).concat([1]));
  var stepX = pontos.length > 1 ? innerW / (pontos.length - 1) : 0;
  function xy(i, v) { return [pad.l + i * stepX, pad.t + innerH - (v / maxV) * innerH]; }
  function pathFor(key) {
    return pontos.map(function (p, i) { var xy0 = xy(i, p[key]); return (i === 0 ? 'M' : 'L') + xy0[0].toFixed(1) + ',' + xy0[1].toFixed(1); }).join(' ');
  }
  var gridLines = [0, 0.25, 0.5, 0.75, 1].map(function (f) {
    var y = pad.t + innerH - f * innerH;
    return '<line x1="' + pad.l + '" y1="' + y.toFixed(1) + '" x2="' + (w - pad.r) + '" y2="' + y.toFixed(1) + '" stroke="var(--border2,#e0dbd0)" stroke-width="1"/>' +
      '<text x="' + (pad.l - 8) + '" y="' + (y + 3).toFixed(1) + '" text-anchor="end" font-size="9" fill="var(--muted,#888)">' + mktFmtMoedaCompacta(f * maxV) + '</text>';
  }).join('');
  var labels = pontos.map(function (p, i) {
    if (pontos.length > 12 && i % Math.ceil(pontos.length / 12) !== 0) return '';
    var xy0 = xy(i, 0);
    return '<text x="' + xy0[0].toFixed(1) + '" y="' + (h - 8) + '" text-anchor="middle" font-size="9" fill="var(--muted,#888)">' + p.label + '</text>';
  }).join('');
  var dots = function (key, color) {
    return pontos.map(function (p, i) { var xy0 = xy(i, p[key]); return '<circle cx="' + xy0[0].toFixed(1) + '" cy="' + xy0[1].toFixed(1) + '" r="2.5" fill="' + color + '"><title>' + p.label + ': ' + mktFmtMoeda(p[key]) + '</title></circle>'; }).join('');
  };
  return '<svg viewBox="0 0 ' + w + ' ' + h + '" style="width:100%;height:auto;max-height:260px">' +
    gridLines + labels +
    '<path d="' + pathFor('spend') + '" fill="none" stroke="#c0392b" stroke-width="2"/>' +
    '<path d="' + pathFor('revenue') + '" fill="none" stroke="#3ec97a" stroke-width="2"/>' +
    dots('spend', '#c0392b') + dots('revenue', '#3ec97a') +
    '</svg>' +
    '<div style="display:flex;gap:16px;justify-content:center;margin-top:6px;font-size:11px">' +
      '<span><span style="display:inline-block;width:10px;height:10px;background:#c0392b;border-radius:2px;margin-right:4px"></span>Investido</span>' +
      '<span><span style="display:inline-block;width:10px;height:10px;background:#3ec97a;border-radius:2px;margin-right:4px"></span>Receita</span>' +
    '</div>';
}
function mktFmtMoedaCompacta(v) {
  v = Number(v || 0);
  if (v >= 1000) return 'R$ ' + (v / 1000).toFixed(1) + 'k';
  return 'R$ ' + v.toFixed(0);
}

async function montarModuloMktAnalytics(containerId) {
  var host = document.getElementById(containerId);
  if (!host) return;
  host.innerHTML = '<p class="tmu">Carregando analytics...</p>';

  var ST = { campanhas: [], metricas: [], canais: [] };
  try {
    var res = await Promise.all([
      sb.get('cda_marketing_campanhas', 'select=id,nome,canal_id,status,objetivo,plataforma'),
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

  host.innerHTML =
    '<div class="row-bt"><div><div class="sec-t">📊 Analytics / Dashboard</div><div class="sec-d">Consolidado de campanhas de mídia paga — somente leitura</div></div></div>' +
    '<div class="fb">' +
      '<input type="date" id="an-f-de" title="Data início">' +
      '<input type="date" id="an-f-ate" title="Data fim">' +
      '<select id="an-f-canal"><option value="">Todos os canais</option>' +
        ST.canais.map(function (c) { return '<option value="' + c.id + '">' + c.nome + '</option>'; }).join('') +
      '</select>' +
      '<select id="an-f-status"><option value="">Todos os status</option>' +
        Object.keys(MKT_STATUS).map(function (k) { return '<option value="' + k + '">' + MKT_STATUS[k] + '</option>'; }).join('') +
      '</select>' +
      '<select id="an-f-objetivo"><option value="">Todos os objetivos</option>' +
        Object.keys(MKT_OBJETIVOS).map(function (k) { return '<option value="' + k + '">' + MKT_OBJETIVOS[k] + '</option>'; }).join('') +
      '</select>' +
      '<button class="btn" id="an-f-limpar">Limpar filtros</button>' +
    '</div>' +
    '<div id="an-conteudo"><p class="tmu">Aplicando filtros...</p></div>';

  function render() {
    var fDe = host.querySelector('#an-f-de').value;
    var fAte = host.querySelector('#an-f-ate').value;
    var fCanal = host.querySelector('#an-f-canal').value;
    var fStatus = host.querySelector('#an-f-status').value;
    var fObjetivo = host.querySelector('#an-f-objetivo').value;

    var campanhasFiltradas = ST.campanhas.filter(function (c) {
      if (fCanal && String(c.canal_id) !== fCanal) return false;
      if (fStatus && c.status !== fStatus) return false;
      if (fObjetivo && c.objetivo !== fObjetivo) return false;
      return true;
    });
    var idsPermitidos = {}; campanhasFiltradas.forEach(function (c) { idsPermitidos[c.id] = true; });

    var metricasFiltradas = ST.metricas.filter(function (m) {
      if (!idsPermitidos[m.campanha_id]) return false;
      var d = m.data.substring(0, 10);
      if (fDe && d < fDe) return false;
      if (fAte && d > fAte) return false;
      return true;
    });

    var totalSpend = 0, totalRevenue = 0, totalConv = 0, totalImpressoes = 0, totalCliques = 0;
    metricasFiltradas.forEach(function (m) {
      totalSpend += Number(m.investimento || 0);
      totalRevenue += Number(m.receita || 0);
      totalConv += Number(m.conversoes || 0);
      totalImpressoes += Number(m.impressoes || 0);
      totalCliques += Number(m.cliques || 0);
    });
    var roasGeral = totalSpend > 0 ? (totalRevenue / totalSpend) : 0;
    var cacGeral = totalConv > 0 ? (totalSpend / totalConv) : 0;
    var ctrGeral = totalImpressoes > 0 ? (totalCliques / totalImpressoes) * 100 : 0;

    // Evolução mensal
    var porMes = {};
    metricasFiltradas.forEach(function (m) {
      var chave = m.data.substring(0, 7); // YYYY-MM
      if (!porMes[chave]) porMes[chave] = { spend: 0, revenue: 0 };
      porMes[chave].spend += Number(m.investimento || 0);
      porMes[chave].revenue += Number(m.receita || 0);
    });
    var mesesOrdenados = Object.keys(porMes).sort();
    var pontosEvolucao = mesesOrdenados.map(function (k) {
      var partes = k.split('-');
      return { label: MKT_MESES[Number(partes[1]) - 1] + '/' + partes[0].substring(2), spend: porMes[k].spend, revenue: porMes[k].revenue };
    });

    // Ranking de campanhas (completo, não só top 10)
    var porCampanha = {};
    metricasFiltradas.forEach(function (m) {
      if (!porCampanha[m.campanha_id]) porCampanha[m.campanha_id] = { spend: 0, revenue: 0, conv: 0, impressoes: 0, cliques: 0 };
      var a = porCampanha[m.campanha_id];
      a.spend += Number(m.investimento || 0); a.revenue += Number(m.receita || 0); a.conv += Number(m.conversoes || 0);
      a.impressoes += Number(m.impressoes || 0); a.cliques += Number(m.cliques || 0);
    });
    var rankingCampanhas = Object.keys(porCampanha).map(function (id) {
      var c = campPorId[id];
      var a = porCampanha[id];
      return {
        nome: c ? c.nome : ('#' + id), status: c ? c.status : '', canal: c && canalPorId[c.canal_id] ? canalPorId[c.canal_id].nome : '—',
        spend: a.spend, revenue: a.revenue, roas: a.spend > 0 ? a.revenue / a.spend : 0,
        cac: a.conv > 0 ? a.spend / a.conv : 0, ctr: a.impressoes > 0 ? (a.cliques / a.impressoes) * 100 : 0, conv: a.conv
      };
    }).sort(function (a, b) { return b.spend - a.spend; });
    var maxSpendCampanha = Math.max.apply(null, rankingCampanhas.map(function (r) { return r.spend; }).concat([1]));

    // Comparação entre canais
    var porCanal = {};
    metricasFiltradas.forEach(function (m) {
      var camp = campPorId[m.campanha_id];
      var canalId = camp ? camp.canal_id : null;
      var key = canalId || 'sem-canal';
      if (!porCanal[key]) porCanal[key] = { spend: 0, revenue: 0, campanhas: {} };
      porCanal[key].spend += Number(m.investimento || 0);
      porCanal[key].revenue += Number(m.receita || 0);
      porCanal[key].campanhas[m.campanha_id] = true;
    });
    var rankingCanais = Object.keys(porCanal).map(function (k) {
      var nome = k === 'sem-canal' ? 'Sem canal' : (canalPorId[k] ? canalPorId[k].nome : ('#' + k));
      var agg = porCanal[k];
      return { nome: nome, spend: agg.spend, revenue: agg.revenue, roas: agg.spend > 0 ? agg.revenue / agg.spend : 0, nCampanhas: Object.keys(agg.campanhas).length };
    }).sort(function (a, b) { return b.spend - a.spend; });
    var maxSpendCanal = Math.max.apply(null, rankingCanais.map(function (r) { return r.spend; }).concat([1]));

    // ROI por objetivo
    var porObjetivo = {};
    metricasFiltradas.forEach(function (m) {
      var camp = campPorId[m.campanha_id];
      var obj = camp ? camp.objetivo : 'outro';
      if (!porObjetivo[obj]) porObjetivo[obj] = { spend: 0, revenue: 0, conv: 0 };
      porObjetivo[obj].spend += Number(m.investimento || 0);
      porObjetivo[obj].revenue += Number(m.receita || 0);
      porObjetivo[obj].conv += Number(m.conversoes || 0);
    });
    var rankingObjetivos = Object.keys(porObjetivo).map(function (k) {
      var agg = porObjetivo[k];
      return { nome: MKT_OBJETIVOS[k] || k, spend: agg.spend, revenue: agg.revenue, roas: agg.spend > 0 ? agg.revenue / agg.spend : 0, conv: agg.conv };
    }).sort(function (a, b) { return b.spend - a.spend; });
    var maxSpendObjetivo = Math.max.apply(null, rankingObjetivos.map(function (r) { return r.spend; }).concat([1]));

    var out =
      '<div class="pg-kpi-strip" style="grid-template-columns:repeat(5,1fr)">' +
        '<div class="pg-kpi"><div class="v">' + mktFmtMoeda(totalSpend) + '</div><div class="l">Investido</div></div>' +
        '<div class="pg-kpi"><div class="v">' + mktFmtMoeda(totalRevenue) + '</div><div class="l">Receita</div></div>' +
        '<div class="pg-kpi"><div class="v">' + roasGeral.toFixed(2) + 'x</div><div class="l">ROAS</div></div>' +
        '<div class="pg-kpi"><div class="v">' + mktFmtMoeda(cacGeral) + '</div><div class="l">CAC</div></div>' +
        '<div class="pg-kpi"><div class="v">' + ctrGeral.toFixed(2) + '%</div><div class="l">CTR</div></div>' +
      '</div>' +

      '<div class="pg-bloco"><h3>Evolução Mensal — Investido vs Receita</h3>' + mktSvgLineChart(pontosEvolucao) + '</div>' +

      '<div class="pg-2col">' +
        '<div class="pg-bloco"><h3>Comparação entre Canais</h3>' +
          rankingCanais.map(function (r) {
            return '<div class="pg-barra-row"><span class="pg-barra-label" title="' + r.nome + '">' + r.nome.substring(0, 22) + '</span>' +
              '<div class="pg-barra-track"><div class="pg-barra-fill" style="width:' + ((r.spend / maxSpendCanal) * 100).toFixed(0) + '%"></div></div>' +
              '<span class="pg-barra-num">' + r.roas.toFixed(1) + 'x</span></div>';
          }).join('') + (rankingCanais.length ? '' : '<p class="tmu">Sem dados.</p>') +
        '</div>' +
        '<div class="pg-bloco"><h3>ROI por Objetivo</h3>' +
          rankingObjetivos.map(function (r) {
            return '<div class="pg-barra-row"><span class="pg-barra-label" title="' + r.nome + '">' + r.nome + '</span>' +
              '<div class="pg-barra-track"><div class="pg-barra-fill" style="width:' + ((r.spend / maxSpendObjetivo) * 100).toFixed(0) + '%"></div></div>' +
              '<span class="pg-barra-num">' + r.roas.toFixed(1) + 'x</span></div>';
          }).join('') + (rankingObjetivos.length ? '' : '<p class="tmu">Sem dados.</p>') +
        '</div>' +
      '</div>' +

      '<div class="pg-bloco"><h3>Detalhamento por Canal</h3><div class="tbl-wrap"><table><thead><tr><th>Canal</th><th># Campanhas</th><th>Investido</th><th>Receita</th><th>ROAS</th></tr></thead><tbody>' +
        rankingCanais.map(function (r) { return '<tr><td>' + r.nome + '</td><td>' + r.nCampanhas + '</td><td>' + mktFmtMoeda(r.spend) + '</td><td>' + mktFmtMoeda(r.revenue) + '</td><td>' + r.roas.toFixed(2) + 'x</td></tr>'; }).join('') +
        (rankingCanais.length ? '' : '<tr><td colspan="5" class="tmu">Sem dados.</td></tr>') +
      '</tbody></table></div></div>' +

      '<div class="pg-bloco"><h3>Ranking Completo de Campanhas (' + rankingCampanhas.length + ')</h3><div class="tbl-wrap"><table><thead><tr><th>Campanha</th><th>Canal</th><th>Status</th><th>Investido</th><th>Receita</th><th>ROAS</th><th>CAC</th><th>CTR</th><th>Conversões</th></tr></thead><tbody>' +
        rankingCampanhas.map(function (r) {
          return '<tr><td>' + r.nome + '</td><td>' + r.canal + '</td><td><span class="badge badge-' + (MKT_STATUS_BADGE[r.status] || 'pending') + '">' + (MKT_STATUS[r.status] || r.status) + '</span></td>' +
            '<td>' + mktFmtMoeda(r.spend) + '</td><td>' + mktFmtMoeda(r.revenue) + '</td><td>' + r.roas.toFixed(2) + 'x</td><td>' + mktFmtMoeda(r.cac) + '</td><td>' + r.ctr.toFixed(2) + '%</td><td>' + mktFmtNum(r.conv) + '</td></tr>';
        }).join('') +
        (rankingCampanhas.length ? '' : '<tr><td colspan="9" class="tmu">Nenhuma campanha no filtro selecionado.</td></tr>') +
      '</tbody></table></div></div>';

    host.querySelector('#an-conteudo').innerHTML = out;
  }

  ['an-f-de', 'an-f-ate', 'an-f-canal', 'an-f-status', 'an-f-objetivo'].forEach(function (id) {
    host.querySelector('#' + id).addEventListener('change', render);
  });
  host.querySelector('#an-f-limpar').addEventListener('click', function () {
    host.querySelector('#an-f-de').value = '';
    host.querySelector('#an-f-ate').value = '';
    host.querySelector('#an-f-canal').value = '';
    host.querySelector('#an-f-status').value = '';
    host.querySelector('#an-f-objetivo').value = '';
    render();
  });
  render();
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
// 6) SIMULAÇÕES IA — aloca orçamento por canal via Anthropic API
// ────────────────────────────────────────────────────────────────
async function montarModuloMktSimulacoes(containerId, opts) {
  var editavel = !opts || opts.editavel !== false;
  var host = document.getElementById(containerId);
  if (!host) return;
  host.innerHTML = '<p class="tmu">Carregando simulações...</p>';

  var simulacoes = [];
  try {
    simulacoes = await sb.get('cda_marketing_simulacoes', 'select=*&order=criado_em.desc');
  } catch (err) {
    host.innerHTML = '<p style="color:var(--rust,#c0392b)">Erro ao carregar simulações: ' + (err.message || err) + '</p>';
    return;
  }

  var linhas = simulacoes.map(function (s) {
    return '<tr>' +
      '<td style="cursor:pointer" onclick="mktVerSimulacao(\'' + containerId + '\',' + s.id + ')">' + s.nome + '</td>' +
      '<td style="cursor:pointer" onclick="mktVerSimulacao(\'' + containerId + '\',' + s.id + ')">' + (s.periodo || '—') + '</td>' +
      '<td style="cursor:pointer" onclick="mktVerSimulacao(\'' + containerId + '\',' + s.id + ')">' + mktFmtMoeda(s.orcamento_total) + '</td>' +
      '<td style="cursor:pointer" onclick="mktVerSimulacao(\'' + containerId + '\',' + s.id + ')">' + (s.roas_esperado ? Number(s.roas_esperado).toFixed(2) + 'x' : '—') + '</td>' +
      '<td style="cursor:pointer" onclick="mktVerSimulacao(\'' + containerId + '\',' + s.id + ')">' + (s.receita_esperada ? mktFmtMoeda(s.receita_esperada) : '—') + '</td>' +
      '<td style="cursor:pointer" onclick="mktVerSimulacao(\'' + containerId + '\',' + s.id + ')">' + mktFmtData(s.criado_em) + '</td>' +
      (editavel ? '<td style="white-space:nowrap">' +
        '<button class="btn" onclick="event.stopPropagation();mktRefazerSimulacao(\'' + containerId + '\',' + s.id + ')">Refazer</button> ' +
        '<button class="btn" onclick="event.stopPropagation();mktConfirmarExcluirSimulacao(\'' + containerId + '\',' + s.id + ')">Excluir</button>' +
      '</td>' : '') +
      '</tr>';
  }).join('');

  host.innerHTML =
    '<div class="row-bt"><div><div class="sec-t">🤖 Simulações IA</div><div class="sec-d">Alocação de orçamento entre canais, sugerida por IA com base no histórico real de performance (últimos 3 meses + acumulado)</div></div>' +
    (editavel ? '<button class="btn" id="mkt-btn-nova-sim">+ Nova Simulação</button>' : '') + '</div>' +
    '<div class="tbl-wrap"><table><thead><tr><th>Nome</th><th>Período</th><th>Orçamento</th><th>ROAS Esperado</th><th>Receita Esperada</th><th>Criada em</th>' +
      (editavel ? '<th></th>' : '') + '</tr></thead><tbody>' +
      (linhas || '<tr><td colspan="7" class="tmu">Nenhuma simulação gerada ainda.</td></tr>') +
    '</tbody></table></div>';

  host._mktSimState = simulacoes;
  if (editavel) host.querySelector('#mkt-btn-nova-sim').addEventListener('click', function () { mktAbrirModalNovaSimulacao(containerId); });
}

function mktAbrirModalNovaSimulacao(containerId, refazerDe) {
  var s = refazerDe || null;
  openModal(
    '<div class="modal-box"><h3>' + (s ? 'Refazer Simulação' : 'Nova Simulação de Alocação') + '</h3>' +
    '<p class="tmu" style="margin-bottom:12px">A IA vai analisar o histórico real de performance por canal (últimos 3 meses + acumulado) e sugerir como distribuir o orçamento informado.' +
      (s ? ' Isso vai <b>substituir</b> a alocação e a análise atuais desta simulação — a IA roda de novo com base nos dados mais recentes.' : '') + '</p>' +
    '<div><label>Nome da simulação</label><input type="text" id="sf-nome" value="' + (s ? s.nome.replace(/"/g, '&quot;') : '') + '" placeholder="ex: Orçamento Setembro 2026" style="width:100%"></div>' +
    '<div style="margin-top:10px;display:flex;gap:8px">' +
      '<div style="flex:1"><label>Orçamento total (R$)</label><input type="number" step="0.01" id="sf-orcamento" value="' + (s ? s.orcamento_total : '') + '" style="width:100%"></div>' +
      '<div style="flex:1"><label>Período</label><input type="text" id="sf-periodo" value="' + (s && s.periodo ? s.periodo.replace(/"/g, '&quot;') : '') + '" placeholder="ex: Setembro/2026" style="width:100%"></div>' +
    '</div>' +
    '<div style="margin-top:10px"><label>Contexto adicional (opcional)</label><textarea id="sf-descricao" style="width:100%;min-height:60px" placeholder="ex: temos show da Luedji Luna dia 15, lançamento de coleção do Gilsons no fim do mês...">' + (s && s.descricao ? s.descricao : '') + '</textarea></div>' +
    '<div id="sf-status" style="margin-top:12px;font-size:12px;color:var(--muted,#888)"></div>' +
    '<div style="margin-top:20px;display:flex;gap:10px;justify-content:flex-end">' +
      '<button class="btn" onclick="closeModal()" id="sf-btn-cancelar">Cancelar</button>' +
      '<button class="btn rust" onclick="mktGerarSimulacao(\'' + containerId + '\'' + (s ? ',' + s.id : '') + ')" id="sf-btn-gerar">' + (s ? 'Refazer com IA' : 'Gerar com IA') + '</button>' +
    '</div></div>'
  );
}

function mktRefazerSimulacao(containerId, simId) {
  var host = document.getElementById(containerId);
  var s = (host._mktSimState || []).find(function (x) { return x.id === simId; });
  if (s) mktAbrirModalNovaSimulacao(containerId, s);
}

async function mktGerarSimulacao(containerId, simId) {
  var nome = document.getElementById('sf-nome').value.trim();
  var orcamento = document.getElementById('sf-orcamento').value;
  var periodo = document.getElementById('sf-periodo').value.trim();
  var descricao = document.getElementById('sf-descricao').value.trim();
  if (!nome || !orcamento) { showToast('Informe nome e orçamento.', 'error'); return; }

  var statusEl = document.getElementById('sf-status');
  var btnGerar = document.getElementById('sf-btn-gerar');
  var btnCancelar = document.getElementById('sf-btn-cancelar');
  statusEl.textContent = '⏳ Analisando histórico e consultando a IA — isso pode levar até 30 segundos...';
  btnGerar.disabled = true; btnCancelar.disabled = true;

  try {
    var payload = { nome: nome, orcamento_total: Number(orcamento), periodo: periodo, descricao: descricao };
    if (simId) payload.id = simId;
    var resp = await fetch(SUPABASE_URL + '/functions/v1/simular-marketing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    var data = await resp.json();
    if (!resp.ok || data.error) throw new Error(data.error || 'Erro desconhecido');
    closeModal();
    showToast(simId ? 'Simulação refeita com sucesso.' : 'Simulação gerada com sucesso.');
    await montarModuloMktSimulacoes(containerId, { editavel: true });
    mktVerSimulacaoObj(containerId, data.simulacao);
  } catch (err) {
    console.error(err);
    statusEl.innerHTML = '<span style="color:var(--rust,#c0392b)">Erro: ' + (err.message || err) + '</span>';
    btnGerar.disabled = false; btnCancelar.disabled = false;
  }
}

function mktConfirmarExcluirSimulacao(containerId, simId) {
  var host = document.getElementById(containerId);
  var s = (host._mktSimState || []).find(function (x) { return x.id === simId; });
  openModal(
    '<div class="modal-box" style="max-width:380px"><h3 style="color:var(--rust,#c0392b)">Excluir simulação</h3>' +
    '<p class="tmu" style="margin-top:8px">Tem certeza que deseja excluir <b>' + (s ? s.nome : 'esta simulação') + '</b>? Essa ação não pode ser desfeita.</p>' +
    '<div style="margin-top:20px;display:flex;gap:10px;justify-content:flex-end">' +
      '<button class="btn" onclick="closeModal()">Cancelar</button>' +
      '<button class="btn rust" onclick="mktExcluirSimulacao(\'' + containerId + '\',' + simId + ')">Sim, excluir</button>' +
    '</div></div>'
  );
}

async function mktExcluirSimulacao(containerId, simId) {
  try {
    await sb.del('cda_marketing_simulacoes', simId);
    closeModal();
    showToast('Simulação excluída.');
    await montarModuloMktSimulacoes(containerId, { editavel: true });
  } catch (err) {
    showToast('Erro ao excluir: ' + (err.message || err), 'error');
  }
}

function mktVerSimulacao(containerId, simId) {
  var host = document.getElementById(containerId);
  var s = (host._mktSimState || []).find(function (x) { return x.id === simId; });
  if (s) mktVerSimulacaoObj(containerId, s);
}

function mktVerSimulacaoObj(containerId, s) {
  var alocacoes = s.alocacoes || [];
  var linhasAlocacao = alocacoes.map(function (a) {
    return '<tr><td>' + a.canal + '</td><td>' + (a.percentual || 0).toFixed(1) + '%</td><td>' + mktFmtMoeda(a.valor) + '</td><td class="tmu" style="font-size:11px">' + (a.justificativa || '') + '</td></tr>';
  }).join('');

  openModal(
    '<div class="modal-box" style="width:640px">' +
    '<h3>' + s.nome + '</h3>' +
    '<p class="tmu" style="margin-bottom:4px">' + (s.periodo || '') + ' · Orçamento: ' + mktFmtMoeda(s.orcamento_total) +
      (s.roas_esperado ? ' · ROAS esperado: ' + Number(s.roas_esperado).toFixed(2) + 'x' : '') + '</p>' +
    (s.descricao ? '<p class="tmu" style="margin-bottom:12px;font-style:italic">"' + s.descricao + '"</p>' : '') +
    '<div class="tbl-wrap" style="margin-top:12px"><table><thead><tr><th>Canal</th><th>%</th><th>Valor</th><th>Justificativa</th></tr></thead><tbody>' +
      (linhasAlocacao || '<tr><td colspan="4" class="tmu">Sem alocação registrada.</td></tr>') +
    '</tbody></table></div>' +
    '<div class="cc" style="margin-top:14px;white-space:pre-wrap;font-size:13px">' + (s.sugestao_ia || 'Sem análise registrada.') + '</div>' +
    '<div style="margin-top:20px;display:flex;gap:10px;justify-content:flex-end">' +
      '<button class="btn" onclick="closeModal();mktConfirmarExcluirSimulacao(\'' + containerId + '\',' + s.id + ')">Excluir</button>' +
      '<button class="btn" onclick="closeModal();mktRefazerSimulacao(\'' + containerId + '\',' + s.id + ')">Refazer</button>' +
      '<button class="btn rust" onclick="closeModal()">Fechar</button>' +
    '</div></div>'
  );
}

// A entrada do submódulo Tutorial usa a função já existente montarModuloTutorial(containerId,{modulo:'marketing'})
// definida em cda-modulo-tutorial.js — não precisa de código próprio aqui.


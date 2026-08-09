// ════════════════════════════════════════════════════════════════════
// cda-modulo-diario-comercial.js
// Diário Comercial — feed cronológico de TODAS as interações registradas
// em cda_historico_interacoes, de todos os leads. É a "visão de funil
// inteiro" complementar ao Histórico dentro do card de cada Lead
// (que mostra só 1 lead por vez).
//
// Requer cda-dados-compartilhados.js carregado antes (usa
// cdaCarregarHistoricoCompleto, cdaCarregarLeadsB2C, cdaCarregarCampanhas,
// cdaCarregarEquipe, cdaCarregarCanais, cdaCarregarStatusCrm).
// ════════════════════════════════════════════════════════════════════

var CDA_TIPOS_INTERACAO_DIARIO = [
  { id: 'pipeline', label: 'Movimentação de Pipeline' },
  { id: 'ligacao', label: 'Ligação' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'email', label: 'E-mail' },
  { id: 'reuniao', label: 'Reunião' },
  { id: 'tarefa_criada', label: 'Tarefa Criada' },
  { id: 'outro', label: 'Outro' }
];

async function montarModuloDiarioComercial(containerId) {
  var host = document.getElementById(containerId);
  if (!host) { console.error('cda-modulo-diario-comercial: container #' + containerId + ' não encontrado'); return; }

  var ST = { historico: [], leads: [], campanhas: [], equipe: [], canais: [], statusCrm: [] };

  host.innerHTML =
    '<style>' +
      '.diario-item{background:var(--paper,#fff);border:2px solid var(--ink,#1a1a1a);padding:10px 14px;margin-bottom:8px;cursor:pointer;transition:background .12s;}' +
      '.diario-item:hover{background:var(--card,#f5f0e8);}' +
      '.diario-topo{display:flex;justify-content:space-between;align-items:baseline;gap:10px;flex-wrap:wrap;}' +
      '.diario-data{font-family:monospace;font-size:11px;color:var(--muted,#888);white-space:nowrap;}' +
      '.diario-nome{font-weight:700;font-size:13px;}' +
      '.diario-desc{font-size:12px;margin-top:4px;}' +
      '.diario-meta{font-size:10px;color:var(--muted,#888);margin-top:4px;display:flex;gap:8px;flex-wrap:wrap;}' +
    '</style>' +
    '<div class="row-bt">' +
      '<div><div class="sec-t">📔 Diário Comercial</div><div class="sec-d">Feed cronológico de todas as interações do funil — clique numa linha pra abrir o Lead</div></div>' +
    '</div>' +
    '<div class="fb">' +
      '<select id="dc-f-campanha"><option value="">Todas as campanhas</option></select>' +
      '<select id="dc-f-resp"><option value="">Todos os responsáveis</option></select>' +
      '<select id="dc-f-tipo"><option value="">Todos os tipos</option></select>' +
      '<input type="date" id="dc-f-de" title="De">' +
      '<input type="date" id="dc-f-ate" title="Até">' +
      '<span class="fc" id="dc-cnt"></span>' +
    '</div>' +
    '<div id="dc-lista"></div>';

  try {
    var res = await Promise.all([cdaCarregarHistoricoCompleto(), cdaCarregarLeadsB2C(), cdaCarregarCampanhas(), cdaCarregarEquipe(), cdaCarregarCanais(), cdaCarregarStatusCrm()]);
    ST.historico = res[0]; ST.leads = res[1]; ST.campanhas = res[2]; ST.equipe = res[3]; ST.canais = res[4]; ST.statusCrm = res[5];
  } catch (err) {
    console.error(err);
    var msg = (err && (err.message || err.details || err.hint)) || 'Erro desconhecido';
    host.querySelector('#dc-lista').innerHTML = '<p style="color:var(--rust,#c0392b);padding:20px">Erro ao carregar dados do Supabase:<br><b>' + msg + '</b></p>';
    return;
  }

  var leadPorId = {}; ST.leads.forEach(function (l) { leadPorId[l.id] = l; });
  var campanhaPorId = {}; ST.campanhas.forEach(function (c) { campanhaPorId[c.id] = c; });
  var equipePorId = {}; ST.equipe.forEach(function (e) { equipePorId[e.id] = e; });
  var canalPorId = {}; ST.canais.forEach(function (c) { canalPorId[c.id] = c; });
  var statusCrmPorId = {}; ST.statusCrm.forEach(function (s) { statusCrmPorId[s.id] = s; });

  host.querySelector('#dc-f-campanha').innerHTML = '<option value="">Todas as campanhas</option>' +
    ST.campanhas.slice().sort(function (a, b) { return a.nome.localeCompare(b.nome); })
      .map(function (c) { return '<option value="' + c.id + '">' + c.nome + '</option>'; }).join('');
  host.querySelector('#dc-f-resp').innerHTML = '<option value="">Todos os responsáveis</option>' +
    ST.equipe.map(function (e) { return '<option value="' + e.id + '">' + e.nome + '</option>'; }).join('');
  host.querySelector('#dc-f-tipo').innerHTML = '<option value="">Todos os tipos</option>' +
    CDA_TIPOS_INTERACAO_DIARIO.map(function (t) { return '<option value="' + t.id + '">' + t.label + '</option>'; }).join('');

  function fmtDataHora(iso) {
    var d = new Date(iso);
    return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  function getFiltro() {
    var fCampanha = host.querySelector('#dc-f-campanha').value;
    var fResp = host.querySelector('#dc-f-resp').value;
    var fTipo = host.querySelector('#dc-f-tipo').value;
    var fDe = host.querySelector('#dc-f-de').value;
    var fAte = host.querySelector('#dc-f-ate').value;
    return ST.historico.filter(function (h) {
      if (fCampanha && String(h.campanhaId) !== fCampanha) return false;
      if (fResp && String(h.responsavelId) !== fResp) return false;
      if (fTipo && h.tipoInteracao !== fTipo) return false;
      if (fDe && h.criadoEm < fDe) return false;
      if (fAte && h.criadoEm > (fAte + 'T23:59:59')) return false;
      return true;
    });
  }

  function render() {
    var lista = getFiltro();
    host.querySelector('#dc-cnt').textContent = lista.length.toLocaleString('pt-BR') + ' interação(ões)';
    var box = host.querySelector('#dc-lista');
    if (!lista.length) { box.innerHTML = '<p class="tmu">Nenhuma interação encontrada com esses filtros.</p>'; return; }
    box.innerHTML = lista.map(function (h) {
      var lead = leadPorId[h.leadId];
      var campanha = campanhaPorId[h.campanhaId];
      var resp = equipePorId[h.responsavelId];
      var resultado = statusCrmPorId[h.resultadoId];
      var canal = canalPorId[h.canalId];
      var tipoInfo = CDA_TIPOS_INTERACAO_DIARIO.find(function (t) { return t.id === h.tipoInteracao; });
      var descricao = h.etapaNova ? (h.etapaAnterior ? h.etapaAnterior + ' → ' + h.etapaNova : h.etapaNova) : (tipoInfo ? tipoInfo.label : 'Interação');
      return '<div class="diario-item" data-lead-id="' + (h.leadId || '') + '">' +
        '<div class="diario-topo"><span class="diario-nome">' + (lead ? lead.nome : (h.leadId ? 'Lead removido' : '—')) + '</span><span class="diario-data">' + fmtDataHora(h.criadoEm) + '</span></div>' +
        '<div class="diario-desc">' + descricao + (resultado ? ' · ' + resultado.nome : '') + '</div>' +
        (h.observacao ? '<div class="diario-desc tmu"><i>' + h.observacao + '</i></div>' : '') +
        '<div class="diario-meta">' +
          (campanha ? '<span>📣 ' + campanha.nome + '</span>' : '') +
          (canal ? '<span>🏷 ' + canal.nome + '</span>' : '') +
          (resp ? '<span>👤 ' + resp.nome + '</span>' : (h.criadoPor ? '<span>👤 ' + h.criadoPor + '</span>' : '')) +
        '</div>' +
      '</div>';
    }).join('');

    box.querySelectorAll('.diario-item').forEach(function (item) {
      item.addEventListener('click', function () {
        var leadId = item.dataset.leadId;
        if (!leadId) return;
        navigateCRM('pipelineb2c');
        var tentativas = 0;
        var esperar = setInterval(function () {
          tentativas++;
          var abrir = window._cdaAbrirLeadPipeline;
          if (typeof abrir === 'function') {
            clearInterval(esperar);
            abrir(leadId);
          } else if (tentativas > 40) {
            clearInterval(esperar);
          }
        }, 100);
      });
    });
  }

  host.querySelector('#dc-f-campanha').addEventListener('change', render);
  host.querySelector('#dc-f-resp').addEventListener('change', render);
  host.querySelector('#dc-f-tipo').addEventListener('change', render);
  host.querySelector('#dc-f-de').addEventListener('change', render);
  host.querySelector('#dc-f-ate').addEventListener('change', render);

  render();
}

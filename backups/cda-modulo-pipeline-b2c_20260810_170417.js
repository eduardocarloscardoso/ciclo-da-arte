// ════════════════════════════════════════════════════════════════════
// cda-modulo-pipeline-b2c.js
// Kanban do Pipeline B2C — exclusivo do Comercial.
//
// MODELO (redesenhado em ago/2026): 5 etapas fixas. Nenhum card muda de
// etapa só arrastando — toda movimentação abre um modal obrigatório
// pedindo o "resultado" (catálogo cda_status_crm, tipo pipeline_resultado)
// e uma observação opcional. Cada transição fica registrada em
// cda_historico_interacoes, não só o estado atual.
//
// Requer cda-dados-compartilhados.js carregado antes (usa
// cdaCarregarLeadsB2C, cdaSalvarLeadB2C, cdaExcluirLeadB2C,
// cdaCarregarCanais, cdaCarregarStatusCrm, cdaCarregarHistoricoPorLead,
// cdaSalvarHistoricoInteracao, cdaSalvarCliente).
//
// Uso:
//   <div id="container-pipeline-b2c"></div>
//   <script src="cda-dados-compartilhados.js"></script>
//   <script src="cda-modulo-pipeline-b2c.js"></script>
//   <script>montarModuloPipelineB2C('container-pipeline-b2c');</script>
// ════════════════════════════════════════════════════════════════════

var CDA_ETAPAS_B2C = [
  { id: 'novo_lead', label: 'Novo Lead' },
  { id: 'contato', label: 'Contato' },
  { id: 'engajado', label: 'Engajado' },
  { id: 'compra', label: 'Compra' },
  { id: 'fidelizacao', label: 'Fidelização' }
];
// Precisa bater exatamente com os valores de etapa_aplicavel gravados em cda_status_crm
var CDA_ETAPA_LABEL_CATALOGO = { novo_lead: 'Novo Lead', contato: 'Contato', engajado: 'Engajado', compra: 'Compra', fidelizacao: 'Fidelização' };

async function montarModuloPipelineB2C(containerId) {
  var host = document.getElementById(containerId);
  if (!host) { console.error('cda-modulo-pipeline-b2c: container #' + containerId + ' não encontrado'); return; }

  var ST = { leads: [], canais: [], statusCrm: [], clientes: [], campanhas: [], compras: [], equipe: [], tarefas: [], editId: null, dragId: null, transicao: null, clienteSelecionado: null };

  host.innerHTML =
    '<style>' +
      '.pb2c-board{display:flex;gap:12px;overflow-x:auto;padding-bottom:12px;align-items:flex-start;}' +
      '.pb2c-col{background:var(--card,#f5f0e8);border:2px solid var(--ink,#1a1a1a);min-width:250px;max-width:250px;flex-shrink:0;}' +
      '.pb2c-col-h{padding:10px 12px;border-bottom:2px solid var(--ink,#1a1a1a);}' +
      '.pb2c-col-h .t{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;}' +
      '.pb2c-col-h .s{font-size:9px;color:var(--muted,#888);margin-top:2px;}' +
      '.pb2c-col-body{padding:8px;min-height:80px;display:flex;flex-direction:column;gap:8px;}' +
      '.pb2c-col-body.dragover{background:rgba(200,74,43,.08);}' +
      '.pb2c-card{background:var(--paper,#fff);border:1px solid var(--ink,#1a1a1a);padding:9px 10px;cursor:grab;font-size:11px;}' +
      '.pb2c-card:active{cursor:grabbing;}' +
      '.pb2c-card .nm{font-weight:700;font-size:12px;margin-bottom:3px;}' +
      '.pb2c-card .rw{display:flex;justify-content:space-between;align-items:center;margin-top:4px;font-size:9px;color:var(--muted,#888);}' +
      '.pb2c-age{display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:4px;}' +
      '.pb2c-age.ok{background:#7a9;}' + '.pb2c-age.warn{background:#d9a441;}' + '.pb2c-age.hot{background:#c0392b;}' +
      '.pb2c-resultado-badge{display:inline-block;font-size:8px;font-weight:700;text-transform:uppercase;padding:2px 6px;border-radius:999px;color:#fff;margin-top:4px;}' +
      '.pb2c-hist{max-height:140px;overflow-y:auto;border:1px solid var(--ink,#1a1a1a);padding:6px 8px;font-size:10px;background:var(--card,#f5f0e8);margin-top:6px;}' +
      '.pb2c-hist-item{padding:4px 0;border-bottom:1px dashed var(--border2,#ccc);}' +
      '.pb2c-hist-item:last-child{border-bottom:none;}' +
      '.pb2c-transicao-info{background:var(--card,#f5f0e8);border:2px solid var(--ink,#1a1a1a);padding:10px;margin-bottom:12px;font-size:12px;text-align:center;}' +
      '.pb2c-busca-wrap{position:relative;}' +
      '.pb2c-busca-resultados{position:absolute;top:100%;left:0;right:0;background:var(--paper,#fff);border:2px solid var(--ink,#1a1a1a);border-top:none;max-height:180px;overflow-y:auto;z-index:20;}' +
      '.pb2c-busca-item{padding:7px 10px;font-size:11px;cursor:pointer;border-bottom:1px solid var(--border2,#eee);}' +
      '.pb2c-busca-item:hover{background:var(--card,#f5f0e8);}' +
      '.pb2c-vinculado{background:var(--card,#f5f0e8);border:2px solid var(--ink,#1a1a1a);padding:8px 10px;font-size:11px;display:flex;justify-content:space-between;align-items:center;}' +
      '.pb2c-aviso-duplicata{font-size:10px;color:var(--rust,#c0392b);margin-top:4px;cursor:pointer;text-decoration:underline;}' +
      '.camp-checks label{display:inline-flex;align-items:center;gap:4px;font-size:11px;margin-right:12px;font-weight:400;text-transform:none;letter-spacing:0;}' +
      '.pb2c-diario-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:300;}' +
      '.pb2c-diario-overlay.op{display:block;}' +
      '.pb2c-diario-panel{position:fixed;top:0;right:0;bottom:0;width:340px;max-width:92vw;background:var(--paper,#fff);border-left:2px solid var(--ink,#1a1a1a);box-shadow:-4px 0 16px rgba(0,0,0,.15);display:flex;flex-direction:column;padding:16px;overflow-y:auto;}' +
      '.pb2c-diario-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;}' +
      '.pb2c-diario-filtros{display:flex;flex-direction:column;gap:6px;margin-bottom:12px;}' +
      '.pb2c-diario-filtros input,.pb2c-diario-filtros select{font-family:Syne,sans-serif;font-size:11px;padding:6px 8px;border:2px solid var(--ink,#1a1a1a);background:var(--card,#f5f0e8);}' +
      '.pb2c-diario-item{border:1px solid var(--border2,#ccc);padding:8px 10px;margin-bottom:6px;cursor:pointer;font-size:11px;}' +
      '.pb2c-diario-item:hover{background:var(--card,#f5f0e8);}' +
      '.pb2c-diario-item .dt{display:flex;justify-content:space-between;font-weight:700;font-size:12px;}' +
      '.pb2c-diario-item .dd{color:var(--muted,#888);font-size:10px;margin-top:2px;}' +
      '@media (max-width:600px){.pb2c-diario-panel{width:100%;max-width:100%;}}' +
    '</style>' +
    '<div class="row-bt">' +
      '<div><div class="sec-t">Pipeline B2C</div><div class="sec-d">Funil de leads do consumidor final — arrastar um card abre a confirmação de transição</div></div>' +
      '<button class="btn rust" id="pb2c-btn-novo">＋ Novo Lead</button>' +
    '</div>' +
    '<div class="fb">' +
      '<select id="pb2c-f-campanha"><option value="">Todas as campanhas</option></select>' +
      '<input type="text" id="pb2c-f-cliente" placeholder="🔎 Buscar por nome do cliente...">' +
      '<select id="pb2c-f-canal"><option value="">Todos os canais</option></select>' +
      '<select id="pb2c-f-resp"><option value="">Todos os responsáveis</option></select>' +
      '<button class="btn sm" id="pb2c-btn-gerar-msg-filtro">🚀 Gerar Mensagens (filtrados)</button>' +
      '<button class="btn sm" id="pb2c-btn-diario">📔 Diário</button>' +
      '<span class="fc" id="pb2c-cnt"></span>' +
    '</div>' +
    '<div class="pb2c-board" id="pb2c-board"></div>' +

    '<div class="pb2c-diario-overlay" id="pb2c-diario-overlay">' +
      '<div class="pb2c-diario-panel">' +
        '<div class="pb2c-diario-head"><span>📔 Diário Comercial</span><button class="mo-x" id="pb2c-diario-x" style="color:var(--ink,#1a1a1a)">✕</button></div>' +
        '<div class="pb2c-diario-filtros">' +
          '<input type="text" id="pb2c-diario-f-cliente" placeholder="🔎 Buscar lead/cliente...">' +
          '<select id="pb2c-diario-f-campanha"><option value="">Todas as campanhas</option></select>' +
          '<select id="pb2c-diario-f-etapa"><option value="">Todas as etapas do funil</option></select>' +
          '<select id="pb2c-diario-f-tipo"><option value="">Todos os tipos</option></select>' +
        '</div>' +
        '<div id="pb2c-diario-lista"></div>' +
      '</div>' +
    '</div>' +

    '<div class="mo" id="pb2c-modal">' +
      '<div class="mo-box">' +
        '<div class="mo-h"><h3 id="pb2c-modal-title">Novo Lead</h3><button class="mo-x" id="pb2c-modal-x">✕</button></div>' +
        '<div class="pb2c-tabs" id="pb2c-tabs" style="display:none;background:var(--ink,#1a1a1a);padding:0 20px">' +
          '<button class="pb2c-tab-btn active" data-tab="dados" style="background:none;border:none;color:var(--cream,#faf7f2);padding:10px 14px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;cursor:pointer;border-bottom:3px solid var(--rust,#c0392b)">Dados</button>' +
          '<button class="pb2c-tab-btn" data-tab="historico" style="background:none;border:none;color:var(--cream,#faf7f2);opacity:.6;padding:10px 14px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;cursor:pointer;border-bottom:3px solid transparent">Histórico</button>' +
          '<button class="pb2c-tab-btn" data-tab="compras" style="background:none;border:none;color:var(--cream,#faf7f2);opacity:.6;padding:10px 14px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;cursor:pointer;border-bottom:3px solid transparent">Compras</button>' +
          '<button class="pb2c-tab-btn" data-tab="tarefas" style="background:none;border:none;color:var(--cream,#faf7f2);opacity:.6;padding:10px 14px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;cursor:pointer;border-bottom:3px solid transparent">Tarefas</button>' +
        '</div>' +
        '<div class="mo-b">' +
          '<div id="pb2c-tabpanel-dados"><div class="fg">' +
            '<div class="fgr pb2c-busca-wrap" style="grid-column:1/-1" id="pb2c-m-busca-wrap">' +
              '<label>Buscar cliente existente (nome, telefone ou e-mail)</label>' +
              '<input type="text" id="pb2c-m-busca" placeholder="Digite pelo menos 3 letras...">' +
              '<div class="pb2c-busca-resultados" id="pb2c-m-busca-resultados" style="display:none"></div>' +
            '</div>' +
            '<div class="fgr" style="grid-column:1/-1;display:none" id="pb2c-m-vinculado-wrap">' +
              '<div class="pb2c-vinculado"><span id="pb2c-m-vinculado-texto"></span><button class="btn sm" id="pb2c-m-trocar-cliente">Trocar</button></div>' +
            '</div>' +
            '<div class="fgr" style="grid-column:1/-1"><label>Nome *</label><input type="text" id="pb2c-m-nome"><div class="pb2c-aviso-duplicata" id="pb2c-m-aviso-duplicata" style="display:none"></div></div>' +
            '<div class="fgr"><label>Telefone</label><input type="text" id="pb2c-m-tel"></div>' +
            '<div class="fgr"><label>E-mail</label><input type="email" id="pb2c-m-email"></div>' +
            '<div class="fgr"><label>Canal</label><select id="pb2c-m-canal"><option value="">—</option></select></div>' +
            '<div class="fgr" style="grid-column:1/-1"><label>Meios de Contato <span class="tmu" style="font-weight:400">(herda da campanha por padrão, editável)</span></label><div class="camp-checks" id="pb2c-m-meios"></div></div>' +
            '<div class="fgr"><label>Etapa atual</label><div id="pb2c-m-etapa-atual" style="padding:8px 0;font-weight:700"></div></div>' +
            '<div class="fgr"><label>Valor Estimado (R$)</label><input type="number" id="pb2c-m-valor" step="0.01"></div>' +
            '<div class="fgr"><label>Responsável</label><select id="pb2c-m-resp"><option value="">—</option></select></div>' +
            '<div class="fgr" style="grid-column:1/-1"><label>Observações</label><textarea id="pb2c-m-obs" rows="2"></textarea></div>' +
            '<div class="fgr" style="grid-column:1/-1;border-top:2px solid var(--ink,#1a1a1a);padding-top:12px;margin-top:4px">' +
              '<label style="font-size:11px">💬 Mensagem Sugerida (gerada — nunca tem {variável} crua)</label>' +
              '<div class="pb2c-hist" id="pb2c-m-msg-sugerida" style="min-height:50px"></div>' +
              '<button class="btn sm" id="pb2c-m-msg-gerar" style="margin-top:5px">🔄 Gerar/Regenerar</button>' +
            '</div>' +
            '<div class="fgr" style="grid-column:1/-1">' +
              '<label>Mensagem Final do Usuário <span class="tmu" style="font-weight:400">(se preenchida, prevalece sobre a sugerida)</span></label>' +
              '<textarea id="pb2c-m-msg-final" rows="3" placeholder="Deixe em branco pra usar a mensagem sugerida acima como está"></textarea>' +
              '<button class="btn sm" id="pb2c-m-msg-copiar" style="margin-top:5px">📋 Copiar mensagem final</button>' +
            '</div>' +
          '</div></div>' +
          '<div id="pb2c-tabpanel-historico" style="display:none"><div class="pb2c-hist" id="pb2c-m-hist" style="max-height:400px"></div></div>' +
          '<div id="pb2c-tabpanel-compras" style="display:none">' +
            '<div id="pb2c-c-resumo" class="pb2c-transicao-info" style="text-align:left"></div>' +
            '<div class="pb2c-hist" id="pb2c-c-lista" style="max-height:320px"></div>' +
          '</div>' +
          '<div id="pb2c-tabpanel-tarefas" style="display:none">' +
            '<div class="pb2c-hist" id="pb2c-tf-lista" style="max-height:160px;margin-bottom:14px"></div>' +
            '<div class="fg">' +
              '<div class="fgr" style="grid-column:1/-1"><label>Descrição *</label><textarea id="pb2c-tf-desc" rows="3" placeholder="Ex: Ligar pra confirmar interesse"></textarea></div>' +
              '<div class="fgr"><label>Responsável</label><select id="pb2c-tf-resp"><option value="">—</option></select></div>' +
              '<div class="fgr"><label>Prioridade</label><select id="pb2c-tf-prioridade"><option value="baixa">Baixa</option><option value="media" selected>Média</option><option value="alta">Alta</option></select></div>' +
              '<div class="fgr"><label>Data Início</label><input type="date" id="pb2c-tf-inicio"></div>' +
              '<div class="fgr"><label>Data Fim</label><input type="date" id="pb2c-tf-prevista"></div>' +
            '</div>' +
            '<button class="btn rust" id="pb2c-tf-salvar" style="margin-top:12px">💾 Criar Tarefa</button>' +
          '</div>' +
        '</div>' +
        '<div class="mo-f">' +
          '<button class="btn" id="pb2c-m-excluir" style="margin-right:auto;background:var(--rust,#c0392b);color:#fff;display:none">🗑 Excluir</button>' +
          '<button class="btn" id="pb2c-m-mover" style="display:none">🔀 Mover de Etapa</button>' +
          '<button class="btn" id="pb2c-m-cancelar">Cancelar</button>' +
          '<button class="btn rust" id="pb2c-m-salvar">💾 Salvar</button>' +
        '</div>' +
      '</div>' +
    '</div>' +

    '<div class="mo" id="pb2c-modal-transicao">' +
      '<div class="mo-box">' +
        '<div class="mo-h"><h3>Confirmar Movimentação</h3><button class="mo-x" id="pb2c-t-x">✕</button></div>' +
        '<div class="mo-b">' +
          '<div class="pb2c-transicao-info" id="pb2c-t-info"></div>' +
          '<div class="fg">' +
            '<div class="fgr" style="grid-column:1/-1" id="pb2c-t-resultado-wrap"><label>Resultado *</label><select id="pb2c-t-resultado"><option value="">Selecione...</option></select></div>' +
            '<div class="fgr" style="grid-column:1/-1"><label>Observação</label><textarea id="pb2c-t-obs" rows="2" placeholder="Opcional — detalhe o que aconteceu"></textarea></div>' +
          '</div>' +
        '</div>' +
        '<div class="mo-f">' +
          '<button class="btn" id="pb2c-t-cancelar">Cancelar</button>' +
          '<button class="btn rust" id="pb2c-t-confirmar">✓ Confirmar Movimentação</button>' +
        '</div>' +
      '</div>' +
    '</div>';

  try {
    var res = await Promise.all([cdaCarregarLeadsB2C(), cdaCarregarCanais(), cdaCarregarStatusCrm(), cdaCarregarClientes(), cdaCarregarCampanhas(), cdaCarregarCompras(), cdaCarregarEquipe(), cdaCarregarTarefas()]);
    ST.leads = res[0]; ST.canais = res[1]; ST.statusCrm = res[2]; ST.clientes = res[3]; ST.campanhas = res[4]; ST.compras = res[5]; ST.equipe = res[6]; ST.tarefas = res[7];
  } catch (err) {
    console.error(err);
    var msg = (err && (err.message || err.details || err.hint)) || JSON.stringify(err) || 'Erro desconhecido';
    host.querySelector('#pb2c-board').innerHTML = '<p style="color:var(--rust,#c0392b);padding:20px">Erro ao carregar dados do Supabase:<br><b>' + msg + '</b></p>';
    return;
  }

  var canalById = {}; ST.canais.forEach(function (c) { canalById[String(c.id)] = c; });
  var statusCrmById = {}; ST.statusCrm.forEach(function (s) { statusCrmById[s.id] = s; });
  var campanhaPorId = {}; ST.campanhas.forEach(function (c) { campanhaPorId[c.id] = c; });
  var equipePorId = {}; ST.equipe.forEach(function (e) { equipePorId[e.id] = e; });
  var clientePorId = {}; ST.clientes.forEach(function (c) { clientePorId[String(c.id)] = c; });
  var resultadosPipeline = ST.statusCrm.filter(function (s) { return s.tipo === 'pipeline_resultado'; });
  function resultadosDaEtapa(etapaId) {
    var label = CDA_ETAPA_LABEL_CATALOGO[etapaId];
    return resultadosPipeline.filter(function (r) { return (r.etapaAplicavel || []).indexOf(label) !== -1; });
  }
  function nomeUsuarioAtual() { return (window.cu && window.cu.name) || 'Usuário'; }

  function popularFiltros() {
    host.querySelector('#pb2c-f-campanha').innerHTML = '<option value="">Todas as campanhas</option>' +
      '<option value="__sem_campanha__">Sem campanha vinculada</option>' +
      ST.campanhas.slice().sort(function (a, b) { return a.nome.localeCompare(b.nome); })
        .map(function (c) { return '<option value="' + c.id + '">' + c.nome + '</option>'; }).join('');
    host.querySelector('#pb2c-f-canal').innerHTML = '<option value="">Todos os canais</option>' +
      ST.canais.slice().sort(function (a, b) { return a.nome.localeCompare(b.nome); })
        .map(function (c) { return '<option value="' + c.id + '">' + c.nome + '</option>'; }).join('');
    host.querySelector('#pb2c-f-resp').innerHTML = '<option value="">Todos os responsáveis</option>' +
      ST.equipe.map(function (e) { return '<option value="' + e.id + '">' + e.nome + '</option>'; }).join('');
  }
  popularFiltros();
  host.querySelector('#pb2c-m-resp').innerHTML = '<option value="">—</option>' +
    ST.equipe.map(function (e) { return '<option value="' + e.id + '">' + e.nome + '</option>'; }).join('');

  function getFiltro() {
    var fCampanha = host.querySelector('#pb2c-f-campanha').value;
    var fCliente = host.querySelector('#pb2c-f-cliente').value.trim().toLowerCase();
    var fCanal = host.querySelector('#pb2c-f-canal').value;
    var fResp = host.querySelector('#pb2c-f-resp').value;
    return ST.leads.filter(function (l) {
      if (fCampanha === '__sem_campanha__' && l.campanhaId) return false;
      if (fCampanha && fCampanha !== '__sem_campanha__' && String(l.campanhaId) !== fCampanha) return false;
      if (fCliente && (l.nome || '').toLowerCase().indexOf(fCliente) === -1) return false;
      if (fCanal && String(l.canalId) !== fCanal) return false;
      if (fResp && String(l.responsavelId) !== fResp) return false;
      return true;
    });
  }

  function diasParado(movidoEm) {
    if (!movidoEm) return 0;
    var ms = Date.now() - new Date(movidoEm).getTime();
    return Math.floor(ms / 86400000);
  }
  function corIdade(dias) {
    if (dias >= 14) return 'hot';
    if (dias >= 7) return 'warn';
    return 'ok';
  }

  function render() {
    var f = getFiltro();
    var board = host.querySelector('#pb2c-board');
    board.innerHTML = CDA_ETAPAS_B2C.map(function (etapa) {
      var cards = f.filter(function (l) { return l.etapa === etapa.id; });
      var soma = cards.reduce(function (s, c) { return s + (Number(c.valorEstimado) || 0); }, 0);
      var cardsHtml = cards.map(function (l) {
        var canal = canalById[l.canalId];
        var campanha = campanhaPorId[l.campanhaId];
        var dias = diasParado(l.movidoEm);
        var cor = corIdade(dias);
        var resultado = statusCrmById[l.resultadoId];
        return '<div class="pb2c-card" draggable="true" data-id="' + l.id + '">' +
          '<div class="nm">' + (l.nome || '—') + '</div>' +
          (campanha ? '<span class="badge b-rust" style="font-size:8px">📣 ' + campanha.nome + '</span>' : '') +
          (canal ? '<span class="badge b-vio" style="font-size:8px">' + canal.nome + '</span>' : '') +
          '<div class="rw"><span><span class="pb2c-age ' + cor + '"></span>' + dias + 'd parado</span>' +
          '<span>' + (l.valorEstimado ? 'R$ ' + Number(l.valorEstimado).toLocaleString('pt-BR') : '') + '</span></div>' +
          '<div class="rw"><span>👤 ' + (equipePorId[l.responsavelId] ? equipePorId[l.responsavelId].nome : 'sem responsável') + '</span><span></span></div>' +
          (resultado ? '<span class="pb2c-resultado-badge" style="background:' + resultado.cor + '">' + resultado.nome + '</span>' : '') +
          '</div>';
      }).join('');
      return '<div class="pb2c-col">' +
        '<div class="pb2c-col-h"><div class="t">' + etapa.label + '</div>' +
        '<div class="s">' + cards.length + ' lead(s) · R$ ' + soma.toLocaleString('pt-BR') + '</div></div>' +
        '<div class="pb2c-col-body" data-etapa="' + etapa.id + '">' + cardsHtml + '</div>' +
        '</div>';
    }).join('');

    host.querySelector('#pb2c-cnt').textContent = f.length.toLocaleString('pt-BR') + ' lead(s) no funil';

    board.querySelectorAll('.pb2c-card').forEach(function (card) {
      card.addEventListener('dragstart', function (e) {
        ST.dragId = card.dataset.id;
        e.dataTransfer.effectAllowed = 'move';
      });
      card.addEventListener('click', function () { abrirModalInfo(card.dataset.id); });
    });
    board.querySelectorAll('.pb2c-col-body').forEach(function (col) {
      col.addEventListener('dragover', function (e) { e.preventDefault(); col.classList.add('dragover'); });
      col.addEventListener('dragleave', function () { col.classList.remove('dragover'); });
      col.addEventListener('drop', function (e) {
        e.preventDefault();
        col.classList.remove('dragover');
        var novaEtapa = col.dataset.etapa;
        if (ST.dragId) abrirModalTransicao(ST.dragId, novaEtapa);
        ST.dragId = null;
      });
    });
  }

  // ── Painel Diário Comercial (deslizante, dentro do Pipeline) ────────
  var ST_DIARIO = { historico: null, carregando: false };
  var diarioOverlay = host.querySelector('#pb2c-diario-overlay');
  function fmtDataHoraDiario(iso) {
    var d = new Date(iso);
    return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  function renderDiario() {
    var fCliente = host.querySelector('#pb2c-diario-f-cliente').value.trim().toLowerCase();
    var fCampanha = host.querySelector('#pb2c-diario-f-campanha').value;
    var fEtapa = host.querySelector('#pb2c-diario-f-etapa').value;
    var fTipo = host.querySelector('#pb2c-diario-f-tipo').value;
    var lista = (ST_DIARIO.historico || []).filter(function (h) {
      if (fCliente) {
        var lead = ST.leads.find(function (x) { return x.id === h.leadId; });
        if (!lead || (lead.nome || '').toLowerCase().indexOf(fCliente) === -1) return false;
      }
      if (fCampanha && String(h.campanhaId) !== fCampanha) return false;
      if (fEtapa && h.etapaNova !== fEtapa) return false;
      if (fTipo && h.tipoInteracao !== fTipo) return false;
      return true;
    });
    var box = host.querySelector('#pb2c-diario-lista');
    box.innerHTML = lista.length ? lista.map(function (h) {
      var lead = ST.leads.find(function (x) { return x.id === h.leadId; });
      var campanha = campanhaPorId[h.campanhaId];
      var descricao = h.etapaNova ? (h.etapaAnterior ? h.etapaAnterior + ' → ' + h.etapaNova : h.etapaNova) : (h.observacao || 'Interação');
      return '<div class="pb2c-diario-item" data-lead-id="' + (h.leadId || '') + '">' +
        '<div class="dt"><span>' + (lead ? lead.nome : '—') + '</span><span style="font-weight:400">' + fmtDataHoraDiario(h.criadoEm) + '</span></div>' +
        '<div class="dd">' + descricao + (campanha ? ' · ' + campanha.nome : '') + '</div>' +
      '</div>';
    }).join('') : '<p class="tmu" style="font-size:11px">Nenhuma interação encontrada.</p>';
    box.querySelectorAll('.pb2c-diario-item').forEach(function (item) {
      item.addEventListener('click', function () {
        var leadId = item.dataset.leadId;
        if (!leadId) return;
        diarioOverlay.classList.remove('op');
        abrirModalInfo(leadId);
      });
    });
  }
  async function abrirDiario() {
    diarioOverlay.classList.add('op');
    if (ST_DIARIO.historico) { renderDiario(); return; }
    if (ST_DIARIO.carregando) return;
    ST_DIARIO.carregando = true;
    host.querySelector('#pb2c-diario-lista').innerHTML = '<p class="tmu" style="font-size:11px">Carregando...</p>';
    try {
      ST_DIARIO.historico = await cdaCarregarHistoricoCompleto();
      renderDiario();
    } catch (err) {
      console.error(err);
      host.querySelector('#pb2c-diario-lista').innerHTML = '<p style="color:var(--rust,#c0392b);font-size:11px">Erro ao carregar o diário.</p>';
    }
    ST_DIARIO.carregando = false;
  }
  host.querySelector('#pb2c-diario-f-campanha').innerHTML = '<option value="">Todas as campanhas</option>' +
    ST.campanhas.slice().sort(function (a, b) { return a.nome.localeCompare(b.nome); })
      .map(function (c) { return '<option value="' + c.id + '">' + c.nome + '</option>'; }).join('');
  host.querySelector('#pb2c-diario-f-etapa').innerHTML = '<option value="">Todas as etapas do funil</option>' +
    CDA_ETAPAS_B2C.map(function (e) { return '<option value="' + e.id + '">' + e.label + '</option>'; }).join('');
  host.querySelector('#pb2c-diario-f-tipo').innerHTML = '<option value="">Todos os tipos</option>' +
    [{ id: 'pipeline', label: 'Movimentação de Pipeline' }, { id: 'ligacao', label: 'Ligação' }, { id: 'whatsapp', label: 'WhatsApp' }, { id: 'email', label: 'E-mail' }, { id: 'reuniao', label: 'Reunião' }, { id: 'tarefa_criada', label: 'Tarefa Criada' }, { id: 'outro', label: 'Outro' }]
      .map(function (t) { return '<option value="' + t.id + '">' + t.label + '</option>'; }).join('');
  host.querySelector('#pb2c-btn-diario').addEventListener('click', abrirDiario);
  host.querySelector('#pb2c-diario-x').addEventListener('click', function () { diarioOverlay.classList.remove('op'); });
  diarioOverlay.addEventListener('click', function (e) { if (e.target === diarioOverlay) diarioOverlay.classList.remove('op'); });
  host.querySelector('#pb2c-diario-f-cliente').addEventListener('input', renderDiario);
  host.querySelector('#pb2c-diario-f-campanha').addEventListener('change', renderDiario);
  host.querySelector('#pb2c-diario-f-etapa').addEventListener('change', renderDiario);
  host.querySelector('#pb2c-diario-f-tipo').addEventListener('change', renderDiario);

  var modalT = host.querySelector('#pb2c-modal-transicao');
  function abrirModalTransicao(leadId, novaEtapa) {
    var lead = ST.leads.find(function (x) { return x.id === leadId; });
    if (!lead) return;
    if (lead.etapa === novaEtapa) return;
    ST.transicao = { leadId: leadId, etapaAnterior: lead.etapa, novaEtapa: novaEtapa };
    var etapaAnteriorLabel = CDA_ETAPAS_B2C.find(function (e) { return e.id === lead.etapa; }).label;
    var novaEtapaLabel = CDA_ETAPAS_B2C.find(function (e) { return e.id === novaEtapa; }).label;
    host.querySelector('#pb2c-t-info').innerHTML = '<b>' + (lead.nome || '—') + '</b><br>' + etapaAnteriorLabel + ' → <b>' + novaEtapaLabel + '</b>';

    var opcoes = resultadosDaEtapa(novaEtapa);
    var selResultado = host.querySelector('#pb2c-t-resultado');
    var wrapResultado = host.querySelector('#pb2c-t-resultado-wrap');
    if (opcoes.length) {
      wrapResultado.style.display = '';
      selResultado.innerHTML = '<option value="">Selecione...</option>' + opcoes.map(function (o) { return '<option value="' + o.id + '">' + o.nome + '</option>'; }).join('');
      selResultado.required = true;
    } else {
      wrapResultado.style.display = 'none';
      selResultado.innerHTML = '';
    }
    host.querySelector('#pb2c-t-obs').value = '';
    modalT.classList.add('op');
  }
  function fecharModalTransicao() { modalT.classList.remove('op'); ST.transicao = null; }

  async function confirmarTransicao() {
    if (!ST.transicao) return;
    var opcoes = resultadosDaEtapa(ST.transicao.novaEtapa);
    var resultadoId = host.querySelector('#pb2c-t-resultado').value || null;
    if (opcoes.length && !resultadoId) { alert('Selecione o resultado dessa movimentação.'); return; }
    var observacao = host.querySelector('#pb2c-t-obs').value.trim();
    var lead = ST.leads.find(function (x) { return x.id === ST.transicao.leadId; });
    if (!lead) { fecharModalTransicao(); return; }

    var etapaAnterior = lead.etapa;
    var novaEtapa = ST.transicao.novaEtapa;
    lead.etapa = novaEtapa;
    lead.resultadoId = resultadoId ? Number(resultadoId) : null;
    lead.movidoEm = new Date().toISOString();

    try {
      var salvo = await cdaSalvarLeadB2C(lead);
      var idx = ST.leads.findIndex(function (x) { return x.id === salvo.id; });
      ST.leads[idx] = salvo;
      await cdaSalvarHistoricoInteracao({
        leadId: salvo.id, clienteId: salvo.clienteId, etapaNova: novaEtapa, etapaAnterior: etapaAnterior,
        resultadoId: resultadoId ? Number(resultadoId) : null, observacao: observacao, criadoPor: nomeUsuarioAtual(),
        tipoInteracao: 'pipeline', canalId: salvo.canalId, responsavelId: salvo.responsavelId, campanhaId: salvo.campanhaId
      });
      fecharModalTransicao();
      render();
      if (novaEtapa === 'compra' && etapaAnterior !== 'compra') await ofertarConversao(salvo);
    } catch (err) {
      console.error(err);
      alert('Erro ao confirmar a movimentação — veja o console.');
    }
  }

  async function ofertarConversao(lead) {
    if (lead.clienteId) return;
    if (!confirm('Lead "' + lead.nome + '" chegou em Compra!\n\nDeseja criar automaticamente um cadastro de Cliente vinculado (usando nome/telefone/e-mail deste lead)?')) return;
    try {
      var novoCliente = await cdaSalvarCliente({
        id: '', nome: lead.nome, email: lead.email || '', 'telefone-celular': lead.telefone || '',
        origemDados: 'Outros', origem: 'Pipeline B2C'
      });
      lead.clienteId = novoCliente.id;
      await cdaSalvarLeadB2C(lead);
      alert('Cliente criado e vinculado com sucesso!');
    } catch (err) {
      console.error(err);
      alert('Erro ao criar cliente — veja o console.');
    }
  }

  var modal = host.querySelector('#pb2c-modal');
  function trocarAba(tab) {
    ['dados', 'historico', 'compras', 'tarefas'].forEach(function (t) {
      var painel = host.querySelector('#pb2c-tabpanel-' + t);
      if (painel) painel.style.display = (t === tab) ? '' : 'none';
      var btn = host.querySelector('.pb2c-tab-btn[data-tab="' + t + '"]');
      if (btn) { btn.style.opacity = (t === tab) ? '1' : '.6'; btn.style.borderBottomColor = (t === tab) ? 'var(--rust,#c0392b)' : 'transparent'; }
    });
    if (tab === 'historico') carregarAbaHistorico();
    if (tab === 'compras') carregarAbaCompras();
    if (tab === 'tarefas') abrirModalTarefas(ST.editId);
  }
  async function carregarAbaHistorico() {
    if (!ST.editId) return;
    var histBox = host.querySelector('#pb2c-m-hist');
    histBox.innerHTML = '<div class="pb2c-hist-item">Carregando...</div>';
    try {
      var hist = await cdaCarregarHistoricoPorLead(ST.editId);
      histBox.innerHTML = hist.length ? hist.map(function (h) {
        var r = statusCrmById[h.resultadoId];
        var d = new Date(h.criadoEm);
        var etapaNovaInfo = CDA_ETAPAS_B2C.find(function (e) { return e.id === h.etapaNova; });
        var etapaAnteriorInfo = h.etapaAnterior ? CDA_ETAPAS_B2C.find(function (e) { return e.id === h.etapaAnterior; }) : null;
        var labelEtapa = etapaAnteriorInfo && etapaNovaInfo ? (etapaAnteriorInfo.label + ' → ' + etapaNovaInfo.label) : (etapaNovaInfo ? etapaNovaInfo.label : (h.observacao || 'Interação'));
        return '<div class="pb2c-hist-item"><b>' + d.toLocaleDateString('pt-BR') + '</b> — ' + labelEtapa +
          (r ? ' · ' + r.nome : '') + (h.observacao ? '<br><i>' + h.observacao + '</i>' : '') +
          (h.criadoPor ? '<br><span style="color:var(--muted,#888)">por ' + h.criadoPor + '</span>' : '') + '</div>';
      }).join('') : '<div class="pb2c-hist-item">Nenhuma movimentação registrada ainda.</div>';
    } catch (err) { histBox.innerHTML = '<div class="pb2c-hist-item">Erro ao carregar histórico.</div>'; }
  }
  function carregarAbaCompras() {
    var lead = ST.editId ? ST.leads.find(function (x) { return x.id === ST.editId; }) : null;
    var lista = host.querySelector('#pb2c-c-lista');
    if (!lead || !lead.clienteId) {
      host.querySelector('#pb2c-c-resumo').innerHTML = '<span class="tmu">Este lead ainda não está vinculado a um cliente cadastrado.</span>';
      lista.innerHTML = '';
      return;
    }
    abrirHistoricoCompras(lead.clienteId);
  }
  host.querySelectorAll('.pb2c-tab-btn').forEach(function (btn) {
    btn.addEventListener('click', function () { trocarAba(btn.dataset.tab); });
  });

  function buscarClientes(termo) {
    var t = termo.trim().toLowerCase();
    if (t.length < 3) return [];
    return ST.clientes.filter(function (c) {
      return (c.nome && c.nome.toLowerCase().indexOf(t) !== -1) ||
        (c.email && c.email.toLowerCase().indexOf(t) !== -1) ||
        (c['telefone-celular'] && c['telefone-celular'].indexOf(t) !== -1) ||
        (c['telefone-principal'] && c['telefone-principal'].indexOf(t) !== -1);
    }).slice(0, 8);
  }

  // Linha com dados suficientes pra desempatar homônimos: telefone + e-mail + cidade/UF
  function linhaDesempate(c) {
    var contato = [c['telefone-celular'] || c['telefone-principal'], c.email].filter(Boolean).join(' · ') || 'sem contato cadastrado';
    var local = [c.cidade, c.estado].filter(Boolean).join('/');
    return contato + (local ? '<br>' + local : '<br><span style="color:var(--rust,#c0392b)">sem cidade/UF cadastrada</span>');
  }

  function renderResultadosBusca(lista, box) {
    if (!lista.length) { box.style.display = 'none'; return; }
    box.innerHTML = lista.map(function (c) {
      return '<div class="pb2c-busca-item" data-id="' + c.id + '"><b>' + c.nome + '</b><br><span style="color:var(--muted,#888)">' + linhaDesempate(c) + '</span></div>';
    }).join('');
    box.style.display = '';
    box.querySelectorAll('.pb2c-busca-item').forEach(function (item) {
      item.addEventListener('click', function () {
        var c = ST.clientes.find(function (x) { return String(x.id) === item.dataset.id; });
        if (c) vincularCliente(c);
      });
    });
  }

  function vincularCliente(cliente) {
    ST.clienteSelecionado = cliente;
    host.querySelector('#pb2c-m-nome').value = cliente.nome || '';
    host.querySelector('#pb2c-m-tel').value = cliente['telefone-celular'] || cliente['telefone-principal'] || '';
    host.querySelector('#pb2c-m-email').value = cliente.email || '';
    host.querySelector('#pb2c-m-nome').readOnly = true;
    host.querySelector('#pb2c-m-tel').readOnly = true;
    host.querySelector('#pb2c-m-email').readOnly = true;
    host.querySelector('#pb2c-m-busca-wrap').style.display = 'none';
    host.querySelector('#pb2c-m-vinculado-wrap').style.display = '';
    host.querySelector('#pb2c-m-vinculado-texto').textContent = '🔗 Vinculado a cliente existente: ' + cliente.nome;
    host.querySelector('#pb2c-m-aviso-duplicata').style.display = 'none';
    host.querySelector('#pb2c-m-busca-resultados').style.display = 'none';
  }
  function desvincularCliente() {
    ST.clienteSelecionado = null;
    host.querySelector('#pb2c-m-nome').readOnly = false;
    host.querySelector('#pb2c-m-tel').readOnly = false;
    host.querySelector('#pb2c-m-email').readOnly = false;
    host.querySelector('#pb2c-m-nome').value = '';
    host.querySelector('#pb2c-m-tel').value = '';
    host.querySelector('#pb2c-m-email').value = '';
    host.querySelector('#pb2c-m-busca').value = '';
    host.querySelector('#pb2c-m-busca-wrap').style.display = '';
    host.querySelector('#pb2c-m-vinculado-wrap').style.display = 'none';
  }

  host.querySelector('#pb2c-m-busca').addEventListener('input', function () {
    renderResultadosBusca(buscarClientes(this.value), host.querySelector('#pb2c-m-busca-resultados'));
  });
  host.querySelector('#pb2c-m-trocar-cliente').addEventListener('click', desvincularCliente);
  host.querySelector('#pb2c-m-nome').addEventListener('blur', function () {
    if (ST.clienteSelecionado) return;
    var nome = this.value.trim();
    var aviso = host.querySelector('#pb2c-m-aviso-duplicata');
    if (!nome) { aviso.style.display = 'none'; return; }
    var bateram = ST.clientes.filter(function (c) { return c.nome && c.nome.trim().toLowerCase() === nome.toLowerCase(); });
    if (!bateram.length) { aviso.style.display = 'none'; return; }
    if (bateram.length === 1) {
      aviso.textContent = '⚠ Já existe um cliente chamado "' + bateram[0].nome + '" — clique aqui pra vincular em vez de duplicar';
      aviso.style.display = 'block';
      aviso.onclick = function () { vincularCliente(bateram[0]); };
    } else {
      aviso.textContent = '⚠ Existem ' + bateram.length + ' clientes com esse nome — confira os dados abaixo pra escolher o certo (ou nenhum, se for pessoa nova)';
      aviso.style.display = 'block';
      aviso.onclick = null;
      host.querySelector('#pb2c-m-busca-wrap').style.display = '';
      renderResultadosBusca(bateram, host.querySelector('#pb2c-m-busca-resultados'));
    }
  });

  async function abrirModalInfo(id) {
    ST.editId = id || null;
    var l = id ? ST.leads.find(function (x) { return x.id === id; }) : null;
    host.querySelector('#pb2c-modal-title').textContent = id ? 'Editar Lead' : 'Novo Lead';
    host.querySelector('#pb2c-m-nome').value = l ? (l.nome || '') : '';
    host.querySelector('#pb2c-m-tel').value = l ? (l.telefone || '') : '';
    host.querySelector('#pb2c-m-email').value = l ? (l.email || '') : '';
    host.querySelector('#pb2c-m-msg-sugerida').textContent = l && l.mensagemSugerida ? l.mensagemSugerida : 'Nenhuma mensagem gerada ainda — clica em "Gerar/Regenerar".';
    host.querySelector('#pb2c-m-msg-final').value = l ? (l.mensagemFinalUsuario || '') : '';
    var selCanal = host.querySelector('#pb2c-m-canal');
    selCanal.innerHTML = '<option value="">—</option>' + ST.canais.slice().sort(function (a, b) { return a.nome.localeCompare(b.nome); })
      .map(function (c) { return '<option value="' + c.id + '">' + c.nome + '</option>'; }).join('');
    selCanal.value = l ? (l.canalId || '') : '';
    var campanhaDoLeadMeios = l ? campanhaPorId[l.campanhaId] : null;
    host.querySelector('#pb2c-m-meios').innerHTML = CDA_CANAIS_CAMPANHA.map(function (c) {
      return '<label><input type="checkbox" class="pb2c-meio-check" value="' + c.id + '"> ' + c.label + '</label>';
    }).join('');
    var meiosAtivos = (l && l.meiosSelecionados != null) ? l.meiosSelecionados : ((campanhaDoLeadMeios && campanhaDoLeadMeios.canaisSelecionados) || []);
    host.querySelectorAll('.pb2c-meio-check').forEach(function (chk) { chk.checked = meiosAtivos.indexOf(chk.value) !== -1; });
    var etapaAtualEl = host.querySelector('#pb2c-m-etapa-atual');
    etapaAtualEl.textContent = l ? CDA_ETAPAS_B2C.find(function (e) { return e.id === l.etapa; }).label : 'Novo Lead (ao salvar)';
    host.querySelector('#pb2c-m-valor').value = l ? (l.valorEstimado != null ? l.valorEstimado : '') : '';
    var campanhaDoLead = l ? campanhaPorId[l.campanhaId] : null;
    var equipeParaSelect = (campanhaDoLead && campanhaDoLead.responsavelIds && campanhaDoLead.responsavelIds.length)
      ? ST.equipe.filter(function (e) { return campanhaDoLead.responsavelIds.indexOf(e.id) !== -1; })
      : ST.equipe;
    host.querySelector('#pb2c-m-resp').innerHTML = '<option value="">—</option>' +
      equipeParaSelect.map(function (e) { return '<option value="' + e.id + '">' + e.nome + '</option>'; }).join('');
    host.querySelector('#pb2c-m-resp').value = l ? (l.responsavelId || '') : '';
    host.querySelector('#pb2c-m-obs').value = l ? (l.obs || '') : '';
    host.querySelector('#pb2c-m-excluir').style.display = id ? 'inline-block' : 'none';
    host.querySelector('#pb2c-m-mover').style.display = id ? 'inline-block' : 'none';
    host.querySelector('#pb2c-tabs').style.display = id ? '' : 'none';

    // Busca de cliente existente só faz sentido na criação de um lead novo
    ST.clienteSelecionado = null;
    host.querySelector('#pb2c-m-nome').readOnly = false;
    host.querySelector('#pb2c-m-tel').readOnly = false;
    host.querySelector('#pb2c-m-email').readOnly = false;
    host.querySelector('#pb2c-m-busca').value = '';
    host.querySelector('#pb2c-m-busca-resultados').style.display = 'none';
    host.querySelector('#pb2c-m-aviso-duplicata').style.display = 'none';
    if (id) {
      host.querySelector('#pb2c-m-busca-wrap').style.display = 'none';
      if (l && l.clienteId) {
        var clienteVinculado = ST.clientes.find(function (c) { return String(c.id) === String(l.clienteId); });
        host.querySelector('#pb2c-m-vinculado-wrap').style.display = clienteVinculado ? '' : 'none';
        if (clienteVinculado) { host.querySelector('#pb2c-m-vinculado-texto').textContent = '🔗 Vinculado a cliente existente: ' + clienteVinculado.nome; host.querySelector('#pb2c-m-trocar-cliente').style.display = 'none'; }
      } else {
        host.querySelector('#pb2c-m-vinculado-wrap').style.display = 'none';
      }
    } else {
      host.querySelector('#pb2c-m-busca-wrap').style.display = '';
      host.querySelector('#pb2c-m-vinculado-wrap').style.display = 'none';
      host.querySelector('#pb2c-m-trocar-cliente').style.display = '';
    }

    tarefaLeadAtual = id;
    trocarAba('dados');
    modal.classList.add('op');
  }
  function fecharModal() { modal.classList.remove('op'); }

  host.querySelector('#pb2c-m-msg-gerar').addEventListener('click', async function () {
    if (!ST.editId) { alert('Salve o lead primeiro (precisa ter sido criado) antes de gerar a mensagem.'); return; }
    var lead = ST.leads.find(function (x) { return x.id === ST.editId; });
    if (!lead) return;
    var cliente = clientePorId[lead.clienteId];
    var campanha = campanhaPorId[lead.campanhaId];
    var template = (campanha && (campanha.modeloMensagemFinal || campanha.modeloMensagemSugerida)) || CDA_TEMPLATE_PADRAO;
    var dados = cdaCalcularDadosVariaveis(lead, cliente, ST.compras, canalById);
    var texto = cdaExplodirTemplate(template, dados);
    try {
      await cdaSalvarMensagensLote([{ id: lead.id, mensagemSugerida: texto }]);
      lead.mensagemSugerida = texto;
      host.querySelector('#pb2c-m-msg-sugerida').textContent = texto;
    } catch (err) {
      console.error(err);
      alert('Erro ao gerar mensagem:\n' + ((err && (err.message || err.details || err.hint)) || 'Erro desconhecido'));
    }
  });
  host.querySelector('#pb2c-m-msg-copiar').addEventListener('click', function () {
    var final = host.querySelector('#pb2c-m-msg-final').value.trim();
    var sugerida = host.querySelector('#pb2c-m-msg-sugerida').textContent;
    var texto = final || sugerida;
    if (!texto || texto.indexOf('Nenhuma mensagem') === 0) { alert('Não há mensagem pra copiar ainda.'); return; }
    navigator.clipboard.writeText(texto).then(function () { alert('Mensagem copiada!'); }).catch(function () { alert('Não foi possível copiar automaticamente — selecione e copie manualmente:\n\n' + texto); });
  });

  async function salvar() {
    var nome = host.querySelector('#pb2c-m-nome').value.trim();
    if (!nome) { alert('Informe o nome do lead.'); return; }
    var existente = ST.editId ? ST.leads.find(function (x) { return x.id === ST.editId; }) : null;
    var o = {
      id: ST.editId || '',
      nome: nome, telefone: host.querySelector('#pb2c-m-tel').value.trim(), email: host.querySelector('#pb2c-m-email').value.trim(),
      canalId: host.querySelector('#pb2c-m-canal').value || null,
      etapa: existente ? existente.etapa : 'novo_lead',
      resultadoId: existente ? existente.resultadoId : null,
      valorEstimado: parseFloat(host.querySelector('#pb2c-m-valor').value) || null,
      responsavelId: host.querySelector('#pb2c-m-resp').value ? Number(host.querySelector('#pb2c-m-resp').value) : null, obs: host.querySelector('#pb2c-m-obs').value.trim(),
      clienteId: existente ? existente.clienteId : (ST.clienteSelecionado ? String(ST.clienteSelecionado.id) : null),
      campanhaId: existente ? existente.campanhaId : null,
      motivoPerda: existente ? existente.motivoPerda : null,
      mensagemFinalUsuario: host.querySelector('#pb2c-m-msg-final').value.trim(),
      meiosSelecionados: Array.from(host.querySelectorAll('.pb2c-meio-check:checked')).map(function (c) { return c.value; }),
      movidoEm: existente ? existente.movidoEm : new Date().toISOString()
    };
    try {
      var salvo = await cdaSalvarLeadB2C(o);
      if (ST.editId) {
        var idx = ST.leads.findIndex(function (x) { return x.id === ST.editId; });
        ST.leads[idx] = salvo;
      } else {
        ST.leads.push(salvo);
        await cdaSalvarHistoricoInteracao({ leadId: salvo.id, clienteId: salvo.clienteId, etapaNova: 'novo_lead', resultadoId: null, observacao: 'Lead criado', criadoPor: nomeUsuarioAtual(), tipoInteracao: 'pipeline' });
      }
      fecharModal();
      popularFiltros();
      render();
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar — veja o console.');
    }
  }

  async function excluir() {
    if (!ST.editId) return;
    if (!confirm('Excluir este lead do funil? O histórico de interações dele também será apagado.')) return;
    try {
      await cdaExcluirLeadB2C(ST.editId);
      ST.leads = ST.leads.filter(function (x) { return x.id !== ST.editId; });
      fecharModal();
      render();
    } catch (err) {
      console.error(err);
      alert('Erro ao excluir — veja o console.');
    }
  }

  host.querySelector('#pb2c-btn-novo').addEventListener('click', function () { abrirModalInfo(null); });
  host.querySelector('#pb2c-m-cancelar').addEventListener('click', fecharModal);
  host.querySelector('#pb2c-modal-x').addEventListener('click', fecharModal);
  host.querySelector('#pb2c-m-salvar').addEventListener('click', salvar);
  host.querySelector('#pb2c-m-excluir').addEventListener('click', excluir);

  // ── Aba Compras (dentro do modal do Lead) ────────────────────────────
  function abrirHistoricoCompras(clienteId) {
    var cliente = ST.clientes.find(function (c) { return String(c.id) === String(clienteId); });
    var statusInfo = cliente ? statusCrmById[cliente.statusCrmId] : null;
    var comprasCliente = ST.compras.filter(function (cp) { return String(cp.clienteId) === String(clienteId); })
      .sort(function (a, b) { return (b.dataCompra || '').localeCompare(a.dataCompra || ''); });

    var totalGasto = comprasCliente.reduce(function (s, cp) { return s + (Number(cp.valorTotal) || 0); }, 0);
    var qtdPedidos = new Set(comprasCliente.map(function (cp) { return cp.numeroPedido; }).filter(Boolean)).size || comprasCliente.length;
    var ultimaData = comprasCliente[0] ? comprasCliente[0].dataCompra : null;
    var fmtDataBR = function (iso) { if (!iso) return '—'; var p = iso.split('-'); return p[2] + '/' + p[1] + '/' + p[0]; };

    host.querySelector('#pb2c-c-resumo').innerHTML =
      '<b>' + comprasCliente.length + '</b> item(ns) em <b>' + qtdPedidos + '</b> pedido(s) &nbsp;·&nbsp; ' +
      'Total gasto: <b>R$ ' + totalGasto.toLocaleString('pt-BR') + '</b> &nbsp;·&nbsp; Última compra: <b>' + fmtDataBR(ultimaData) + '</b>' +
      (statusInfo ? '<br>Status atual: <span class="pb2c-resultado-badge" style="background:' + statusInfo.cor + '">' + statusInfo.nome + '</span>' : '') +
      ((cliente && cliente.tagsComercial && cliente.tagsComercial.length) ? ' ' + cliente.tagsComercial.map(function (t) {
        var ts = ST.statusCrm.find(function (s) { return s.codigo === t; });
        return ts ? '<span class="pb2c-resultado-badge" style="background:' + ts.cor + '">' + ts.nome + '</span>' : '';
      }).join(' ') : '');

    var lista = host.querySelector('#pb2c-c-lista');
    lista.innerHTML = comprasCliente.length ? comprasCliente.map(function (cp) {
      var canal = canalById[cp.canalId];
      return '<div class="pb2c-hist-item"><b>' + fmtDataBR(cp.dataCompra) + '</b> — ' + (cp.produto || 'Produto') +
        ' — R$ ' + Number(cp.valorTotal || 0).toLocaleString('pt-BR') +
        (canal ? ' <span style="color:var(--muted,#888)">(' + canal.nome + ')</span>' : '') + '</div>';
    }).join('') : '<div class="pb2c-hist-item">Nenhuma compra registrada.</div>';
  }
  // ── Aba Tarefas (dentro do modal do Lead) ────────────────────────────
  host.querySelector('#pb2c-tf-resp').innerHTML = '<option value="">—</option>' +
    ST.equipe.map(function (e) { return '<option value="' + e.id + '">' + e.nome + '</option>'; }).join('');

  var tarefaLeadAtual = null;
  var PRIOR_COR_PB2C = { baixa: '#6B7280', media: '#F59E0B', alta: '#c0392b' };

  function renderTarefasDoLead() {
    var lista = ST.tarefas.filter(function (t) { return t.leadId === tarefaLeadAtual; });
    var box = host.querySelector('#pb2c-tf-lista');
    box.innerHTML = lista.length ? lista.map(function (t) {
      var resp = equipePorId[t.responsavelId];
      return '<div class="pb2c-hist-item" style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">' +
        '<div><b>' + t.descricao + '</b> ' +
        '<span class="pb2c-resultado-badge" style="background:' + PRIOR_COR_PB2C[t.prioridade || 'media'] + '">' + (t.prioridade || 'media') + '</span><br>' +
        (resp ? resp.nome + ' · ' : '') + 'status: ' + (t.status || 'pendente') + (t.dataPrevista ? ' · prevista ' + t.dataPrevista.split('-').reverse().join('/') : '') +
        '</div>' +
        '<button class="btn sm" data-excluir-tarefa-pipeline="' + t.id + '" title="Excluir tarefa" style="flex-shrink:0">🗑</button>' +
        '</div>';
    }).join('') : '<div class="pb2c-hist-item">Nenhuma tarefa registrada pra este lead ainda.</div>';
    box.querySelectorAll('[data-excluir-tarefa-pipeline]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        if (!confirm('Excluir esta tarefa?')) return;
        var tarefaId = btn.dataset.excluirTarefaPipeline;
        try {
          await cdaExcluirTarefa(tarefaId);
          ST.tarefas = ST.tarefas.filter(function (t) { return String(t.id) !== String(tarefaId); });
          renderTarefasDoLead();
        } catch (err) {
          console.error(err);
          alert('Erro ao excluir:\n' + ((err && (err.message || err.details || err.hint)) || 'Erro desconhecido'));
        }
      });
    });
    var btnSalvarTar = host.querySelector('#pb2c-tf-salvar');
    if (lista.length) {
      btnSalvarTar.disabled = true;
      btnSalvarTar.textContent = 'Tarefa já criada';
    } else {
      btnSalvarTar.disabled = false;
      btnSalvarTar.textContent = '💾 Criar Tarefa';
    }
  }
  function abrirModalTarefas(leadId) {
    tarefaLeadAtual = leadId;
    var lead = ST.leads.find(function (x) { return x.id === leadId; });
    var descricaoPreenchida = '';
    if (lead) {
      var campanha = campanhaPorId[lead.campanhaId];
      var cliente = clientePorId[lead.clienteId];
      var template = (campanha && (campanha.modeloMensagemFinal || campanha.modeloMensagemSugerida)) || 'Fazer contato com {nome}.';
      var dados = cdaCalcularDadosVariaveis(lead, cliente, ST.compras, canalById);
      descricaoPreenchida = cdaExplodirTemplate(template, dados);
    }
    host.querySelector('#pb2c-tf-desc').value = descricaoPreenchida;
    host.querySelector('#pb2c-tf-resp').value = lead && lead.responsavelId ? lead.responsavelId : '';
    host.querySelector('#pb2c-tf-prioridade').value = 'media';
    var campanhaDoLeadTar = lead ? campanhaPorId[lead.campanhaId] : null;
    host.querySelector('#pb2c-tf-inicio').value = (campanhaDoLeadTar && campanhaDoLeadTar.periodoInicio) || new Date().toISOString().slice(0, 10);
    host.querySelector('#pb2c-tf-prevista').value = (campanhaDoLeadTar && campanhaDoLeadTar.periodoFim) || '';
    renderTarefasDoLead();
  }
  host.querySelector('#pb2c-tf-salvar').addEventListener('click', async function () {
    var descricao = host.querySelector('#pb2c-tf-desc').value.trim();
    if (!descricao) { alert('Informe a descrição da tarefa.'); return; }
    var lead = ST.leads.find(function (x) { return x.id === tarefaLeadAtual; });
    try {
      var nova = await cdaSalvarTarefa({
        descricao: descricao, leadId: tarefaLeadAtual, clienteId: lead ? lead.clienteId : null, campanhaId: lead ? lead.campanhaId : null,
        responsavelId: host.querySelector('#pb2c-tf-resp').value ? Number(host.querySelector('#pb2c-tf-resp').value) : null,
        prioridade: host.querySelector('#pb2c-tf-prioridade').value, status: 'pendente',
        dataInicio: host.querySelector('#pb2c-tf-inicio').value || new Date().toISOString().slice(0, 10),
        dataPrevista: host.querySelector('#pb2c-tf-prevista').value || null,
        criadoPor: nomeUsuarioAtual()
      });
      ST.tarefas.push(nova);
      host.querySelector('#pb2c-tf-desc').value = '';
      renderTarefasDoLead();
      alert('✓ Tarefa criada com êxito!');
    } catch (err) {
      console.error(err);
      alert('Erro ao criar tarefa:\n' + ((err && (err.message || err.details || err.hint)) || 'Erro desconhecido'));
    }
  });
  host.querySelector('#pb2c-m-mover').addEventListener('click', function () {
    if (!ST.editId) return;
    var lead = ST.leads.find(function (x) { return x.id === ST.editId; });
    if (!lead) return;
    var proximaEtapa = CDA_ETAPAS_B2C[Math.min(CDA_ETAPAS_B2C.findIndex(function (e) { return e.id === lead.etapa; }) + 1, CDA_ETAPAS_B2C.length - 1)].id;
    fecharModal();
    abrirModalTransicao(lead.id, proximaEtapa);
  });
  host.querySelector('#pb2c-t-cancelar').addEventListener('click', fecharModalTransicao);
  host.querySelector('#pb2c-t-x').addEventListener('click', fecharModalTransicao);
  host.querySelector('#pb2c-t-confirmar').addEventListener('click', confirmarTransicao);
  host.querySelector('#pb2c-f-campanha').addEventListener('change', render);
  host.querySelector('#pb2c-f-cliente').addEventListener('input', render);
  host.querySelector('#pb2c-f-canal').addEventListener('change', render);
  host.querySelector('#pb2c-f-resp').addEventListener('change', render);
  host.querySelector('#pb2c-btn-gerar-msg-filtro').addEventListener('click', async function () {
    var lista = getFiltro();
    if (!lista.length) { alert('Nenhum lead corresponde aos filtros atuais.'); return; }
    if (!confirm('Gerar/atualizar a mensagem sugerida de ' + lista.length + ' lead(s) filtrado(s)?\n\nUsa o molde da campanha de cada lead (ou o padrão do sistema, se ele não tiver campanha/molde).')) return;
    var btn = this;
    var textoOriginal = btn.textContent;
    btn.textContent = 'Gerando...'; btn.disabled = true;
    try {
      var atualizacoes = lista.map(function (lead) {
        var cliente = clientePorId[lead.clienteId];
        var campanha = campanhaPorId[lead.campanhaId];
        var template = (campanha && (campanha.modeloMensagemFinal || campanha.modeloMensagemSugerida)) || CDA_TEMPLATE_PADRAO;
        var dados = cdaCalcularDadosVariaveis(lead, cliente, ST.compras, canalById);
        var texto = cdaExplodirTemplate(template, dados);
        lead.mensagemSugerida = texto;
        return { id: lead.id, mensagemSugerida: texto };
      });
      await cdaSalvarMensagensLote(atualizacoes);
      alert('Pronto! ' + atualizacoes.length + ' mensagem(ns) gerada(s)/atualizada(s).');
    } catch (err) {
      console.error(err);
      alert('Erro ao gerar mensagens:\n' + ((err && (err.message || err.details || err.hint)) || 'Erro desconhecido'));
    } finally {
      btn.textContent = textoOriginal; btn.disabled = false;
    }
  });

  render();
}

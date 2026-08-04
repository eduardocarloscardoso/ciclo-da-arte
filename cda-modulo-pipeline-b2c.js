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

  var ST = { leads: [], canais: [], statusCrm: [], clientes: [], editId: null, dragId: null, transicao: null, clienteSelecionado: null };

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
    '</style>' +
    '<div class="row-bt">' +
      '<div><div class="sec-t">Pipeline B2C</div><div class="sec-d">Funil de leads do consumidor final — arrastar um card abre a confirmação de transição</div></div>' +
      '<button class="btn rust" id="pb2c-btn-novo">＋ Novo Lead</button>' +
    '</div>' +
    '<div class="fb">' +
      '<select id="pb2c-f-canal"><option value="">Todos os canais</option></select>' +
      '<select id="pb2c-f-resp"><option value="">Todos os responsáveis</option></select>' +
      '<span class="fc" id="pb2c-cnt"></span>' +
    '</div>' +
    '<div class="pb2c-board" id="pb2c-board"></div>' +

    '<div class="mo" id="pb2c-modal">' +
      '<div class="mo-box">' +
        '<div class="mo-h"><h3 id="pb2c-modal-title">Novo Lead</h3><button class="mo-x" id="pb2c-modal-x">✕</button></div>' +
        '<div class="mo-b"><div class="fg">' +
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
          '<div class="fgr"><label>Etapa atual</label><div id="pb2c-m-etapa-atual" style="padding:8px 0;font-weight:700"></div></div>' +
          '<div class="fgr"><label>Valor Estimado (R$)</label><input type="number" id="pb2c-m-valor" step="0.01"></div>' +
          '<div class="fgr"><label>Responsável</label><input type="text" id="pb2c-m-resp"></div>' +
          '<div class="fgr" style="grid-column:1/-1"><label>Observações</label><textarea id="pb2c-m-obs" rows="2"></textarea></div>' +
          '<div class="fgr" style="grid-column:1/-1" id="pb2c-m-hist-wrap"><label>Histórico de interações</label><div class="pb2c-hist" id="pb2c-m-hist"></div></div>' +
        '</div></div>' +
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
    var res = await Promise.all([cdaCarregarLeadsB2C(), cdaCarregarCanais(), cdaCarregarStatusCrm(), cdaCarregarClientes()]);
    ST.leads = res[0]; ST.canais = res[1]; ST.statusCrm = res[2]; ST.clientes = res[3];
  } catch (err) {
    console.error(err);
    var msg = (err && (err.message || err.details || err.hint)) || JSON.stringify(err) || 'Erro desconhecido';
    host.querySelector('#pb2c-board').innerHTML = '<p style="color:var(--rust,#c0392b);padding:20px">Erro ao carregar dados do Supabase:<br><b>' + msg + '</b></p>';
    return;
  }

  var canalById = {}; ST.canais.forEach(function (c) { canalById[String(c.id)] = c; });
  var statusCrmById = {}; ST.statusCrm.forEach(function (s) { statusCrmById[s.id] = s; });
  var resultadosPipeline = ST.statusCrm.filter(function (s) { return s.tipo === 'pipeline_resultado'; });
  function resultadosDaEtapa(etapaId) {
    var label = CDA_ETAPA_LABEL_CATALOGO[etapaId];
    return resultadosPipeline.filter(function (r) { return (r.etapaAplicavel || []).indexOf(label) !== -1; });
  }
  function nomeUsuarioAtual() { return (window.cu && window.cu.name) || 'Usuário'; }

  function popularFiltros() {
    host.querySelector('#pb2c-f-canal').innerHTML = '<option value="">Todos os canais</option>' +
      ST.canais.slice().sort(function (a, b) { return a.nome.localeCompare(b.nome); })
        .map(function (c) { return '<option value="' + c.id + '">' + c.nome + '</option>'; }).join('');
    var resps = Array.from(new Set(ST.leads.map(function (l) { return l.responsavel; }).filter(Boolean))).sort();
    host.querySelector('#pb2c-f-resp').innerHTML = '<option value="">Todos os responsáveis</option>' +
      resps.map(function (r) { return '<option value="' + r + '">' + r + '</option>'; }).join('');
  }
  popularFiltros();

  function getFiltro() {
    var fCanal = host.querySelector('#pb2c-f-canal').value;
    var fResp = host.querySelector('#pb2c-f-resp').value;
    return ST.leads.filter(function (l) {
      if (fCanal && String(l.canalId) !== fCanal) return false;
      if (fResp && l.responsavel !== fResp) return false;
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
        var dias = diasParado(l.movidoEm);
        var cor = corIdade(dias);
        var resultado = statusCrmById[l.resultadoId];
        return '<div class="pb2c-card" draggable="true" data-id="' + l.id + '">' +
          '<div class="nm">' + (l.nome || '—') + '</div>' +
          (canal ? '<span class="badge b-vio" style="font-size:8px">' + canal.nome + '</span>' : '') +
          '<div class="rw"><span><span class="pb2c-age ' + cor + '"></span>' + dias + 'd parado</span>' +
          '<span>' + (l.valorEstimado ? 'R$ ' + Number(l.valorEstimado).toLocaleString('pt-BR') : '') + '</span></div>' +
          (l.responsavel ? '<div class="rw"><span>' + l.responsavel + '</span><span></span></div>' : '') +
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
        leadId: salvo.id, clienteId: salvo.clienteId, etapa: novaEtapa,
        resultadoId: resultadoId ? Number(resultadoId) : null, observacao: observacao, criadoPor: nomeUsuarioAtual()
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
    var selCanal = host.querySelector('#pb2c-m-canal');
    selCanal.innerHTML = '<option value="">—</option>' + ST.canais.slice().sort(function (a, b) { return a.nome.localeCompare(b.nome); })
      .map(function (c) { return '<option value="' + c.id + '">' + c.nome + '</option>'; }).join('');
    selCanal.value = l ? (l.canalId || '') : '';
    var etapaAtualEl = host.querySelector('#pb2c-m-etapa-atual');
    etapaAtualEl.textContent = l ? CDA_ETAPAS_B2C.find(function (e) { return e.id === l.etapa; }).label : 'Novo Lead (ao salvar)';
    host.querySelector('#pb2c-m-valor').value = l ? (l.valorEstimado != null ? l.valorEstimado : '') : '';
    host.querySelector('#pb2c-m-resp').value = l ? (l.responsavel || '') : '';
    host.querySelector('#pb2c-m-obs').value = l ? (l.obs || '') : '';
    host.querySelector('#pb2c-m-excluir').style.display = id ? 'inline-block' : 'none';
    host.querySelector('#pb2c-m-mover').style.display = id ? 'inline-block' : 'none';

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

    var histWrap = host.querySelector('#pb2c-m-hist-wrap');
    var histBox = host.querySelector('#pb2c-m-hist');
    if (id) {
      histWrap.style.display = '';
      histBox.innerHTML = '<div class="pb2c-hist-item">Carregando...</div>';
      try {
        var hist = await cdaCarregarHistoricoPorLead(id);
        histBox.innerHTML = hist.length ? hist.map(function (h) {
          var r = statusCrmById[h.resultadoId];
          var d = new Date(h.criadoEm);
          return '<div class="pb2c-hist-item"><b>' + d.toLocaleDateString('pt-BR') + '</b> — ' + CDA_ETAPAS_B2C.find(function (e) { return e.id === h.etapa; }).label +
            (r ? ' · ' + r.nome : '') + (h.observacao ? '<br><i>' + h.observacao + '</i>' : '') +
            (h.criadoPor ? '<br><span style="color:var(--muted,#888)">por ' + h.criadoPor + '</span>' : '') + '</div>';
        }).join('') : '<div class="pb2c-hist-item">Nenhuma movimentação registrada ainda.</div>';
      } catch (err) { histBox.innerHTML = '<div class="pb2c-hist-item">Erro ao carregar histórico.</div>'; }
    } else {
      histWrap.style.display = 'none';
    }
    modal.classList.add('op');
  }
  function fecharModal() { modal.classList.remove('op'); }

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
      responsavel: host.querySelector('#pb2c-m-resp').value.trim(), obs: host.querySelector('#pb2c-m-obs').value.trim(),
      clienteId: existente ? existente.clienteId : (ST.clienteSelecionado ? String(ST.clienteSelecionado.id) : null),
      motivoPerda: existente ? existente.motivoPerda : null,
      movidoEm: existente ? existente.movidoEm : new Date().toISOString()
    };
    try {
      var salvo = await cdaSalvarLeadB2C(o);
      if (ST.editId) {
        var idx = ST.leads.findIndex(function (x) { return x.id === ST.editId; });
        ST.leads[idx] = salvo;
      } else {
        ST.leads.push(salvo);
        await cdaSalvarHistoricoInteracao({ leadId: salvo.id, clienteId: salvo.clienteId, etapa: 'novo_lead', resultadoId: null, observacao: 'Lead criado', criadoPor: nomeUsuarioAtual() });
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
  host.querySelector('#pb2c-f-canal').addEventListener('change', render);
  host.querySelector('#pb2c-f-resp').addEventListener('change', render);

  render();
}

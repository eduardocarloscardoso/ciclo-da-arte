// ════════════════════════════════════════════════════════════════════
// cda-modulo-pipeline-b2c.js
// Kanban do Pipeline B2C — exclusivo do Comercial.
//
// Requer cda-dados-compartilhados.js carregado antes (usa
// cdaCarregarLeadsB2C, cdaSalvarLeadB2C, cdaExcluirLeadB2C,
// cdaCarregarCanais, cdaSalvarCliente).
//
// Uso:
//   <div id="container-pipeline-b2c"></div>
//   <script src="cda-dados-compartilhados.js"></script>
//   <script src="cda-modulo-pipeline-b2c.js"></script>
//   <script>montarModuloPipelineB2C('container-pipeline-b2c');</script>
// ════════════════════════════════════════════════════════════════════

var CDA_ETAPAS_B2C = [
  { id: 'novo_lead', label: 'Novo Lead' },
  { id: 'contato_iniciado', label: 'Contato Iniciado' },
  { id: 'engajado', label: 'Engajado' },
  { id: 'proposta_enviada', label: 'Proposta Enviada' },
  { id: 'convertido', label: 'Convertido' },
  { id: 'perdido', label: 'Perdido' }
];
var CDA_MOTIVOS_PERDA_B2C = [
  'Sem resposta / esfriou',
  'Preço',
  'Comprou em outro lugar',
  'Não era o produto certo',
  'Fora do momento (pode voltar depois)',
  'Outro'
];

async function montarModuloPipelineB2C(containerId) {
  var host = document.getElementById(containerId);
  if (!host) { console.error('cda-modulo-pipeline-b2c: container #' + containerId + ' não encontrado'); return; }

  var ST = { leads: [], canais: [], editId: null, dragId: null };

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
    '</style>' +
    '<div class="row-bt">' +
      '<div><div class="sec-t">Pipeline B2C</div><div class="sec-d">Funil de leads do consumidor final — arraste os cards entre as etapas</div></div>' +
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
          '<div class="fgr" style="grid-column:1/-1"><label>Nome *</label><input type="text" id="pb2c-m-nome"></div>' +
          '<div class="fgr"><label>Telefone</label><input type="text" id="pb2c-m-tel"></div>' +
          '<div class="fgr"><label>E-mail</label><input type="email" id="pb2c-m-email"></div>' +
          '<div class="fgr"><label>Canal</label><select id="pb2c-m-canal"><option value="">—</option></select></div>' +
          '<div class="fgr"><label>Etapa</label><select id="pb2c-m-etapa">' + CDA_ETAPAS_B2C.map(function (e) { return '<option value="' + e.id + '">' + e.label + '</option>'; }).join('') + '</select></div>' +
          '<div class="fgr"><label>Valor Estimado (R$)</label><input type="number" id="pb2c-m-valor" step="0.01"></div>' +
          '<div class="fgr"><label>Responsável</label><input type="text" id="pb2c-m-resp"></div>' +
          '<div class="fgr" id="pb2c-m-motivo-wrap" style="grid-column:1/-1;display:none"><label>Motivo da Perda</label><select id="pb2c-m-motivo"><option value="">— Selecione —</option>' + CDA_MOTIVOS_PERDA_B2C.map(function (m) { return '<option value="' + m + '">' + m + '</option>'; }).join('') + '</select></div>' +
          '<div class="fgr" style="grid-column:1/-1"><label>Observações</label><textarea id="pb2c-m-obs" rows="2"></textarea></div>' +
        '</div></div>' +
        '<div class="mo-f">' +
          '<button class="btn" id="pb2c-m-excluir" style="margin-right:auto;background:var(--rust,#c0392b);color:#fff;display:none">🗑 Excluir</button>' +
          '<button class="btn" id="pb2c-m-cancelar">Cancelar</button>' +
          '<button class="btn rust" id="pb2c-m-salvar">💾 Salvar</button>' +
        '</div>' +
      '</div>' +
    '</div>';

  try {
    var res = await Promise.all([cdaCarregarLeadsB2C(), cdaCarregarCanais()]);
    ST.leads = res[0]; ST.canais = res[1];
  } catch (err) {
    console.error(err);
    var msg = (err && (err.message || err.details || err.hint)) || JSON.stringify(err) || 'Erro desconhecido';
    host.querySelector('#pb2c-board').innerHTML = '<p style="color:var(--rust,#c0392b);padding:20px">Erro ao carregar dados do Supabase:<br><b>' + msg + '</b></p>';
    return;
  }

  var canalById = {}; ST.canais.forEach(function (c) { canalById[String(c.id)] = c; });

  function popularFiltros() {
    host.querySelector('#pb2c-f-canal').innerHTML = '<option value="">Todos os canais</option>' +
      ST.canais.slice().sort(function (a, b) { return a.nome.localeCompare(b.nome); })
        .map(function (c) { return '<option value="' + c.id + '">' + c.nome + '</option>'; }).join('');
    var resps = [...new Set(ST.leads.map(function (l) { return l.responsavel; }).filter(Boolean))].sort();
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
        return '<div class="pb2c-card" draggable="true" data-id="' + l.id + '">' +
          '<div class="nm">' + (l.nome || '—') + '</div>' +
          (canal ? '<span class="badge b-vio" style="font-size:8px">' + canal.nome + '</span>' : '') +
          '<div class="rw"><span><span class="pb2c-age ' + cor + '"></span>' + dias + 'd parado</span>' +
          '<span>' + (l.valorEstimado ? 'R$ ' + Number(l.valorEstimado).toLocaleString('pt-BR') : '') + '</span></div>' +
          (l.responsavel ? '<div class="rw"><span>' + l.responsavel + '</span><span></span></div>' : '') +
          (l.etapa === 'perdido' && l.motivoPerda ? '<div class="rw"><span class="badge b-rust" style="font-size:8px">' + l.motivoPerda + '</span></div>' : '') +
          '</div>';
      }).join('');
      return '<div class="pb2c-col">' +
        '<div class="pb2c-col-h"><div class="t">' + etapa.label + '</div>' +
        '<div class="s">' + cards.length + ' lead(s) · R$ ' + soma.toLocaleString('pt-BR') + '</div></div>' +
        '<div class="pb2c-col-body" data-etapa="' + etapa.id + '">' + cardsHtml + '</div>' +
        '</div>';
    }).join('');

    host.querySelector('#pb2c-cnt').textContent = f.length.toLocaleString('pt-BR') + ' lead(s) no funil';

    // drag & drop
    board.querySelectorAll('.pb2c-card').forEach(function (card) {
      card.addEventListener('dragstart', function (e) {
        ST.dragId = card.dataset.id;
        e.dataTransfer.effectAllowed = 'move';
      });
      card.addEventListener('click', function () { abrirModal(card.dataset.id); });
    });
    board.querySelectorAll('.pb2c-col-body').forEach(function (col) {
      col.addEventListener('dragover', function (e) { e.preventDefault(); col.classList.add('dragover'); });
      col.addEventListener('dragleave', function () { col.classList.remove('dragover'); });
      col.addEventListener('drop', function (e) {
        e.preventDefault();
        col.classList.remove('dragover');
        var novaEtapa = col.dataset.etapa;
        if (ST.dragId) moverLead(ST.dragId, novaEtapa);
        ST.dragId = null;
      });
    });
  }

  async function moverLead(id, novaEtapa) {
    var lead = ST.leads.find(function (x) { return x.id === id; });
    if (!lead || lead.etapa === novaEtapa) return;
    var etapaAnterior = lead.etapa;
    lead.etapa = novaEtapa;
    lead.movidoEm = new Date().toISOString();
    render();
    try {
      await cdaSalvarLeadB2C(lead);
      if (novaEtapa === 'convertido' && etapaAnterior !== 'convertido') {
        await ofertarConversao(lead);
      }
      if (novaEtapa === 'perdido' && etapaAnterior !== 'perdido' && !lead.motivoPerda) {
        abrirModal(lead.id);
      }
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar movimentação — veja o console.');
    }
  }

  async function ofertarConversao(lead) {
    if (lead.clienteId) return;
    if (!confirm('Lead "' + lead.nome + '" foi convertido!\n\nDeseja criar automaticamente um cadastro de Cliente vinculado (usando nome/telefone/e-mail deste lead)?')) return;
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
  function abrirModal(id) {
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
    host.querySelector('#pb2c-m-etapa').value = l ? l.etapa : 'novo_lead';
    host.querySelector('#pb2c-m-valor').value = l ? (l.valorEstimado != null ? l.valorEstimado : '') : '';
    host.querySelector('#pb2c-m-resp').value = l ? (l.responsavel || '') : '';
    host.querySelector('#pb2c-m-motivo').value = l ? (l.motivoPerda || '') : '';
    var motivoWrap = host.querySelector('#pb2c-m-motivo-wrap');
    function atualizarVisibilidadeMotivo() {
      motivoWrap.style.display = host.querySelector('#pb2c-m-etapa').value === 'perdido' ? 'block' : 'none';
    }
    atualizarVisibilidadeMotivo();
    host.querySelector('#pb2c-m-etapa').onchange = atualizarVisibilidadeMotivo;
    host.querySelector('#pb2c-m-obs').value = l ? (l.obs || '') : '';
    host.querySelector('#pb2c-m-excluir').style.display = id ? 'inline-block' : 'none';
    modal.classList.add('op');
  }
  function fecharModal() { modal.classList.remove('op'); }

  async function salvar() {
    var nome = host.querySelector('#pb2c-m-nome').value.trim();
    if (!nome) { alert('Informe o nome do lead.'); return; }
    var existente = ST.editId ? ST.leads.find(function (x) { return x.id === ST.editId; }) : null;
    var etapaNova = host.querySelector('#pb2c-m-etapa').value;
    var motivoPerda = host.querySelector('#pb2c-m-motivo').value;
    if (etapaNova === 'perdido' && !motivoPerda) {
      if (!confirm('Nenhum motivo de perda selecionado. Salvar mesmo assim?')) return;
    }
    var etapaAnterior = existente ? existente.etapa : null;
    var o = {
      id: ST.editId || '',
      nome: nome, telefone: host.querySelector('#pb2c-m-tel').value.trim(), email: host.querySelector('#pb2c-m-email').value.trim(),
      canalId: host.querySelector('#pb2c-m-canal').value || null, etapa: etapaNova,
      valorEstimado: parseFloat(host.querySelector('#pb2c-m-valor').value) || null,
      responsavel: host.querySelector('#pb2c-m-resp').value.trim(), obs: host.querySelector('#pb2c-m-obs').value.trim(),
      clienteId: existente ? existente.clienteId : null,
      motivoPerda: etapaNova === 'perdido' ? (motivoPerda || null) : null,
      movidoEm: (existente && existente.etapa !== etapaNova) ? new Date().toISOString() : (existente ? existente.movidoEm : new Date().toISOString())
    };
    try {
      var salvo = await cdaSalvarLeadB2C(o);
      if (ST.editId) {
        var idx = ST.leads.findIndex(function (x) { return x.id === ST.editId; });
        ST.leads[idx] = salvo;
      } else {
        ST.leads.push(salvo);
      }
      fecharModal();
      popularFiltros();
      render();
      if (etapaNova === 'convertido' && etapaAnterior !== 'convertido') await ofertarConversao(salvo);
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar — veja o console.');
    }
  }

  async function excluir() {
    if (!ST.editId) return;
    if (!confirm('Excluir este lead do funil?')) return;
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

  host.querySelector('#pb2c-btn-novo').addEventListener('click', function () { abrirModal(null); });
  host.querySelector('#pb2c-m-cancelar').addEventListener('click', fecharModal);
  host.querySelector('#pb2c-modal-x').addEventListener('click', fecharModal);
  host.querySelector('#pb2c-m-salvar').addEventListener('click', salvar);
  host.querySelector('#pb2c-m-excluir').addEventListener('click', excluir);
  host.querySelector('#pb2c-f-canal').addEventListener('change', render);
  host.querySelector('#pb2c-f-resp').addEventListener('change', render);

  render();
}

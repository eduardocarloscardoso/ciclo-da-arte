// ════════════════════════════════════════════════════════════════════
// cda-modulo-campanhas.js
// Campanhas — Ciclo 1 do "motor de campanha" (ver brainstorm de
// ago/2026): liga um segmento salvo (Segmentação) a uma etapa do
// Pipeline B2C, com período e meta. O botão "Adicionar público ao
// Pipeline" recalcula quem bate com o segmento HOJE e cria os leads
// (já vinculados ao cliente existente, sem duplicar).
//
// Fica de fora deste ciclo (próximos): painel de KPI/progresso da
// meta, filtro de campanha no Kanban do Pipeline.
//
// Requer cda-dados-compartilhados.js carregado antes.
// ════════════════════════════════════════════════════════════════════

var CDA_ETAPAS_CAMPANHA = [
  { id: 'novo_lead', label: 'Novo Lead' },
  { id: 'contato', label: 'Contato' },
  { id: 'engajado', label: 'Engajado' },
  { id: 'compra', label: 'Compra' },
  { id: 'fidelizacao', label: 'Fidelização' }
];
var CDA_STATUS_CAMPANHA = [
  { id: 'ativa', label: 'Ativa', cor: '#22C55E' },
  { id: 'pausada', label: 'Pausada', cor: '#F59E0B' },
  { id: 'encerrada', label: 'Encerrada', cor: '#6B7280' }
];

async function montarModuloCampanhas(containerId) {
  var host = document.getElementById(containerId);
  if (!host) { console.error('cda-modulo-campanhas: container #' + containerId + ' não encontrado'); return; }

  var ST = { campanhas: [], segmentos: [], clientes: [], compras: [], statusCrm: [], editId: null };

  host.innerHTML =
    '<style>' +
      '.camp-card{background:var(--paper,#fff);border:2px solid var(--ink,#1a1a1a);padding:14px 16px;margin-bottom:12px;}' +
      '.camp-topo{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;}' +
      '.camp-nome{font-size:14px;font-weight:700;}' +
      '.camp-badge{display:inline-block;font-size:9px;font-weight:700;text-transform:uppercase;padding:3px 9px;border-radius:999px;color:#fff;}' +
      '.camp-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin:10px 0;font-size:11px;}' +
      '.camp-grid .l{font-size:9px;text-transform:uppercase;color:var(--muted,#888);letter-spacing:.4px;}' +
      '.camp-acoes{display:flex;gap:7px;margin-top:10px;flex-wrap:wrap;}' +
    '</style>' +
    '<div class="row-bt">' +
      '<div><div class="sec-t">📣 Campanhas</div><div class="sec-d">Liga um segmento de clientes a uma etapa do Pipeline, com período e meta</div></div>' +
      '<button class="btn rust" id="camp-btn-nova">＋ Nova Campanha</button>' +
    '</div>' +
    '<div id="camp-lista"></div>' +

    '<div class="mo" id="camp-modal">' +
      '<div class="mo-box">' +
        '<div class="mo-h"><h3 id="camp-modal-title">Nova Campanha</h3><button class="mo-x" id="camp-modal-x">✕</button></div>' +
        '<div class="mo-b"><div class="fg">' +
          '<div class="fgr" style="grid-column:1/-1"><label>Nome *</label><input type="text" id="camp-m-nome" placeholder="Ex: Reativação — Em Risco Agosto"></div>' +
          '<div class="fgr" style="grid-column:1/-1"><label>Objetivo</label><input type="text" id="camp-m-objetivo" placeholder="Ex: Trazer de volta clientes que pararam de comprar"></div>' +
          '<div class="fgr" style="grid-column:1/-1"><label>Público (segmento salvo) *</label><select id="camp-m-segmento"><option value="">Selecione...</option></select><div id="camp-m-publico-alvo" style="font-size:11px;margin-top:4px;color:var(--muted,#888)"></div></div>' +
          '<div class="fgr"><label>Etapa de entrada no Pipeline</label><select id="camp-m-etapa"></select></div>' +
          '<div class="fgr"><label>Status</label><select id="camp-m-status"></select></div>' +
          '<div class="fgr"><label>Início</label><input type="date" id="camp-m-inicio"></div>' +
          '<div class="fgr"><label>Fim</label><input type="date" id="camp-m-fim"></div>' +
          '<div class="fgr"><label>Meta (descrição)</label><input type="text" id="camp-m-meta-desc" placeholder="Ex: 60 recompras no período"></div>' +
          '<div class="fgr"><label>Meta (número, opcional)</label><input type="number" id="camp-m-meta-num" placeholder="Ex: 60"></div>' +
          '<div class="fgr" style="grid-column:1/-1"><label>Responsável</label><input type="text" id="camp-m-resp"></div>' +
        '</div></div>' +
        '<div class="mo-f">' +
          '<button class="btn" id="camp-m-excluir" style="margin-right:auto;background:var(--rust,#c0392b);color:#fff;display:none">🗑 Excluir</button>' +
          '<button class="btn" id="camp-m-cancelar">Cancelar</button>' +
          '<button class="btn rust" id="camp-m-salvar">💾 Salvar</button>' +
        '</div>' +
      '</div>' +
    '</div>';

  try {
    var res = await Promise.all([cdaCarregarCampanhas(), cdaCarregarSegmentos(), cdaCarregarClientes(), cdaCarregarCompras(), cdaCarregarStatusCrm()]);
    ST.campanhas = res[0]; ST.segmentos = res[1]; ST.clientes = res[2]; ST.compras = res[3]; ST.statusCrm = res[4];
  } catch (err) {
    console.error(err);
    var msg = (err && (err.message || err.details || err.hint)) || 'Erro desconhecido';
    host.querySelector('#camp-lista').innerHTML = '<p style="color:var(--rust,#c0392b);padding:20px">Erro ao carregar dados do Supabase:<br><b>' + msg + '</b></p>';
    return;
  }

  var segmentoPorId = {}; ST.segmentos.forEach(function (s) { segmentoPorId[s.id] = s; });
  function nomeUsuarioAtual() { return (window.cu && window.cu.name) || 'Usuário'; }
  function fmtData(iso) { if (!iso) return '—'; var p = iso.split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }

  // ── Popular selects fixos do modal ──
  var selEtapa = host.querySelector('#camp-m-etapa');
  selEtapa.innerHTML = CDA_ETAPAS_CAMPANHA.map(function (e) { return '<option value="' + e.id + '">' + e.label + '</option>'; }).join('');
  var selStatus = host.querySelector('#camp-m-status');
  selStatus.innerHTML = CDA_STATUS_CAMPANHA.map(function (s) { return '<option value="' + s.id + '">' + s.label + '</option>'; }).join('');

  function render() {
    var box = host.querySelector('#camp-lista');
    if (!ST.campanhas.length) { box.innerHTML = '<p class="tmu">Nenhuma campanha criada ainda.</p>'; return; }
    box.innerHTML = ST.campanhas.map(function (c) {
      var seg = segmentoPorId[c.publicoSegmentoId];
      var qtdPublico = seg ? cdaAvaliarSegmento(ST.clientes, ST.compras, ST.statusCrm, seg.filtros || []).length : null;
      var etapa = CDA_ETAPAS_CAMPANHA.find(function (e) { return e.id === c.pipelineEtapaEntrada; });
      var statusInfo = CDA_STATUS_CAMPANHA.find(function (s) { return s.id === c.status; }) || CDA_STATUS_CAMPANHA[0];
      return '<div class="camp-card" data-id="' + c.id + '">' +
        '<div class="camp-topo"><div class="camp-nome">' + c.nome + '</div><span class="camp-badge" style="background:' + statusInfo.cor + '">' + statusInfo.label + '</span></div>' +
        (c.objetivo ? '<p class="tmu" style="margin:4px 0 0">' + c.objetivo + '</p>' : '') +
        '<div class="camp-grid">' +
          '<div><div class="l">Público-Alvo</div><b>' + (qtdPublico != null ? qtdPublico.toLocaleString('pt-BR') + ' cliente(s)' : '—') + '</b></div>' +
          '<div><div class="l">Segmento</div>' + (seg ? seg.nome : '<i>segmento não encontrado</i>') + '</div>' +
          '<div><div class="l">Etapa de entrada</div>' + (etapa ? etapa.label : '—') + '</div>' +
          '<div><div class="l">Período</div>' + fmtData(c.periodoInicio) + ' – ' + fmtData(c.periodoFim) + '</div>' +
          '<div><div class="l">Meta</div>' + (c.metaDescricao || '—') + '</div>' +
          '<div><div class="l">Responsável</div>' + (c.responsavel || '—') + '</div>' +
        '</div>' +
        '<div class="camp-acoes">' +
          '<button class="btn sm rust" data-add-publico="' + c.id + '">➕ Adicionar público ao Pipeline</button>' +
          '<button class="btn sm" data-editar="' + c.id + '">✎ Editar</button>' +
        '</div>' +
      '</div>';
    }).join('');

    box.querySelectorAll('[data-editar]').forEach(function (btn) { btn.addEventListener('click', function () { abrirModal(btn.dataset.editar); }); });
    box.querySelectorAll('[data-add-publico]').forEach(function (btn) { btn.addEventListener('click', function () { adicionarPublico(btn.dataset.addPublico, btn); }); });
  }

  async function adicionarPublico(campanhaId, btn) {
    var campanha = ST.campanhas.find(function (c) { return String(c.id) === String(campanhaId); });
    if (!campanha) return;
    var seg = segmentoPorId[campanha.publicoSegmentoId];
    if (!seg) { alert('O segmento vinculado a esta campanha não foi encontrado — pode ter sido excluído.'); return; }

    var alvo = cdaAvaliarSegmento(ST.clientes, ST.compras, ST.statusCrm, seg.filtros || []);
    if (!alvo.length) { alert('O segmento "' + seg.nome + '" não retornou nenhum cliente no momento.'); return; }

    var etapaLabel = CDA_ETAPAS_CAMPANHA.find(function (e) { return e.id === campanha.pipelineEtapaEntrada; }).label;
    if (!confirm('O segmento "' + seg.nome + '" tem ' + alvo.length + ' cliente(s) agora.\n\nAdicionar ao Pipeline B2C, na etapa "' + etapaLabel + '", vinculados à campanha "' + campanha.nome + '"?\n\n(quem já foi adicionado antes nesta campanha não duplica)')) return;

    var textoOriginal = btn.textContent;
    btn.textContent = 'Adicionando...'; btn.disabled = true;
    try {
      var resultado = await cdaAdicionarPublicoCampanha(campanha, alvo, nomeUsuarioAtual());
      alert('Pronto!\n\n' + resultado.adicionados + ' novo(s) lead(s) adicionado(s) ao Pipeline.' +
        (resultado.jaExistentes ? '\n' + resultado.jaExistentes + ' já estavam nesta campanha (não duplicados).' : ''));
    } catch (err) {
      console.error(err);
      alert('Erro ao adicionar público:\n' + ((err && (err.message || err.details || err.hint)) || 'Erro desconhecido'));
    } finally {
      btn.textContent = textoOriginal; btn.disabled = false;
    }
  }

  var modal = host.querySelector('#camp-modal');
  function popularSelectSegmentos(valorAtual) {
    var sel = host.querySelector('#camp-m-segmento');
    sel.innerHTML = '<option value="">Selecione...</option>' +
      ST.segmentos.map(function (s) { return '<option value="' + s.id + '"' + (s.id === valorAtual ? ' selected' : '') + '>' + s.nome + '</option>'; }).join('');
  }

  function atualizarPublicoAlvoNoModal() {
    var segId = host.querySelector('#camp-m-segmento').value;
    var box = host.querySelector('#camp-m-publico-alvo');
    var seg = segmentoPorId[segId];
    if (!seg) { box.textContent = ''; return; }
    var qtd = cdaAvaliarSegmento(ST.clientes, ST.compras, ST.statusCrm, seg.filtros || []).length;
    box.innerHTML = '👥 <b>Público-Alvo: ' + qtd.toLocaleString('pt-BR') + ' cliente(s)</b> — recalculado agora';
  }
  host.querySelector('#camp-m-segmento').addEventListener('change', atualizarPublicoAlvoNoModal);

  function abrirModal(id) {
    ST.editId = id || null;
    var c = id ? ST.campanhas.find(function (x) { return String(x.id) === String(id); }) : null;
    host.querySelector('#camp-modal-title').textContent = id ? 'Editar Campanha' : 'Nova Campanha';
    host.querySelector('#camp-m-nome').value = c ? c.nome : '';
    host.querySelector('#camp-m-objetivo').value = c ? (c.objetivo || '') : '';
    popularSelectSegmentos(c ? c.publicoSegmentoId : '');
    atualizarPublicoAlvoNoModal();
    selEtapa.value = c ? c.pipelineEtapaEntrada : 'novo_lead';
    selStatus.value = c ? c.status : 'ativa';
    host.querySelector('#camp-m-inicio').value = c ? (c.periodoInicio || '') : '';
    host.querySelector('#camp-m-fim').value = c ? (c.periodoFim || '') : '';
    host.querySelector('#camp-m-meta-desc').value = c ? (c.metaDescricao || '') : '';
    host.querySelector('#camp-m-meta-num').value = c ? (c.metaNumero != null ? c.metaNumero : '') : '';
    host.querySelector('#camp-m-resp').value = c ? (c.responsavel || '') : '';
    host.querySelector('#camp-m-excluir').style.display = id ? 'inline-block' : 'none';
    modal.classList.add('op');
  }
  function fecharModal() { modal.classList.remove('op'); }

  async function salvar() {
    var nome = host.querySelector('#camp-m-nome').value.trim();
    var segmentoId = host.querySelector('#camp-m-segmento').value;
    if (!nome) { alert('Informe o nome da campanha.'); return; }
    if (!segmentoId) { alert('Selecione o público (segmento salvo) da campanha.'); return; }
    var o = {
      id: ST.editId || undefined, nome: nome, objetivo: host.querySelector('#camp-m-objetivo').value.trim(),
      publicoSegmentoId: segmentoId, pipelineEtapaEntrada: selEtapa.value, status: selStatus.value,
      periodoInicio: host.querySelector('#camp-m-inicio').value || null, periodoFim: host.querySelector('#camp-m-fim').value || null,
      metaDescricao: host.querySelector('#camp-m-meta-desc').value.trim(), metaNumero: parseFloat(host.querySelector('#camp-m-meta-num').value) || null,
      responsavel: host.querySelector('#camp-m-resp').value.trim(), criadoPor: nomeUsuarioAtual()
    };
    var salvo;
    try {
      salvo = await cdaSalvarCampanha(o);
    } catch (err) {
      console.error(err);
      alert('Erro ao GRAVAR no banco (nada foi salvo):\n' + ((err && (err.message || err.details || err.hint)) || 'Erro desconhecido'));
      return;
    }
    // A partir daqui já está gravado no banco — qualquer erro abaixo é só
    // na atualização da tela, não desfaz o que já foi salvo.
    try {
      if (ST.editId) {
        var idx = ST.campanhas.findIndex(function (x) { return String(x.id) === String(ST.editId); });
        ST.campanhas[idx] = salvo;
      } else {
        ST.campanhas.unshift(salvo);
      }
      fecharModal();
      render();
    } catch (err) {
      console.error(err);
      alert('Campanha SALVA com sucesso, mas houve um erro ao atualizar a tela — recarregue a página (F5) pra ver:\n' + ((err && (err.message || err.details || err.hint)) || 'Erro desconhecido'));
    }
  }

  async function excluir() {
    if (!ST.editId) return;
    if (!confirm('Excluir esta campanha? Os leads já criados no Pipeline continuam existindo, só perdem o vínculo com a campanha.')) return;
    try {
      await cdaExcluirCampanha(ST.editId);
      ST.campanhas = ST.campanhas.filter(function (x) { return String(x.id) !== String(ST.editId); });
      fecharModal();
      render();
    } catch (err) {
      console.error(err);
      alert('Erro ao excluir:\n' + ((err && (err.message || err.details || err.hint)) || 'Erro desconhecido'));
    }
  }

  host.querySelector('#camp-btn-nova').addEventListener('click', function () { abrirModal(null); });
  host.querySelector('#camp-modal-x').addEventListener('click', fecharModal);
  host.querySelector('#camp-m-cancelar').addEventListener('click', fecharModal);
  host.querySelector('#camp-m-salvar').addEventListener('click', salvar);
  host.querySelector('#camp-m-excluir').addEventListener('click', excluir);

  render();
}

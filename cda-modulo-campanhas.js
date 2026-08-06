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
var CDA_TIPOS_BENEFICIO = [
  { id: 'nenhum', label: 'Nenhum' },
  { id: 'desconto_percentual', label: 'Desconto (%)' },
  { id: 'desconto_valor', label: 'Desconto (R$)' },
  { id: 'frete_gratis', label: 'Frete Grátis' },
  { id: 'cashback', label: 'Cashback' },
  { id: 'brinde', label: 'Brinde' }
];
var CDA_CANAIS_CAMPANHA = [
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'instagram_organico', label: 'Instagram orgânico' },
  { id: 'instagram_pago', label: 'Instagram pago' },
  { id: 'remarketing', label: 'Remarketing pago' },
  { id: 'email', label: 'E-mail' },
  { id: 'outro', label: 'Outro' }
];
// Resultados de pipeline que contam como "resposta positiva" pro KPI de taxa de resposta
var CDA_RESULTADOS_POSITIVOS = ['respondeu', 'pediu_catalogo', 'solicitou_orcamento', 'perguntou_preco', 'perguntou_frete', 'perguntou_tamanho', 'salvou_produtos', 'curtiu_colecao', 'reservou_produto', 'venda_concluida'];

async function montarModuloCampanhas(containerId) {
  var host = document.getElementById(containerId);
  if (!host) { console.error('cda-modulo-campanhas: container #' + containerId + ' não encontrado'); return; }

  var ST = { campanhas: [], segmentos: [], clientes: [], compras: [], statusCrm: [], leads: [], equipe: [], canais: [], editId: null };

  host.innerHTML =
    '<style>' +
      '.camp-card{background:var(--paper,#fff);border:2px solid var(--ink,#1a1a1a);padding:14px 16px;margin-bottom:12px;}' +
      '.camp-topo{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;}' +
      '.camp-nome{font-size:14px;font-weight:700;}' +
      '.camp-badge{display:inline-block;font-size:9px;font-weight:700;text-transform:uppercase;padding:3px 9px;border-radius:999px;color:#fff;}' +
      '.camp-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin:10px 0;font-size:11px;}' +
      '.camp-grid .l{font-size:9px;text-transform:uppercase;color:var(--muted,#888);letter-spacing:.4px;}' +
      '.camp-acoes{display:flex;gap:7px;margin-top:10px;flex-wrap:wrap;}' +
      '.camp-kpi{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:10px;margin-top:12px;padding-top:12px;border-top:1px dashed var(--border2,#ccc);}' +
      '.camp-kpi .v{font-size:18px;font-weight:700;}' +
      '.camp-kpi .l{font-size:9px;text-transform:uppercase;color:var(--muted,#888);letter-spacing:.4px;}' +
      '.camp-progresso-wrap{margin-top:10px;}' +
      '.camp-progresso-bar{background:var(--card,#f5f0e8);border:1px solid var(--ink,#1a1a1a);height:16px;position:relative;overflow:hidden;}' +
      '.camp-progresso-fill{background:var(--rust,#c0392b);height:100%;transition:width .3s ease;}' +
      '.camp-progresso-txt{font-size:10px;margin-top:3px;}' +
      '.camp-sugestao{background:#fff9e6;border-left:3px solid #F59E0B;padding:8px 10px;font-size:11px;margin-top:6px;}' +
      '.camp-checks label{display:inline-flex;align-items:center;gap:4px;font-size:11px;margin-right:12px;font-weight:400;text-transform:none;letter-spacing:0;}' +
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
          '<div class="fgr" style="grid-column:1/-1"><label>Responsável(is)</label><div class="camp-checks" id="camp-m-resp"></div></div>' +

          '<div class="fgr" style="grid-column:1/-1;border-top:2px solid var(--ink,#1a1a1a);padding-top:12px;margin-top:4px"><label style="font-size:11px">🎁 Benefício oferecido</label></div>' +
          '<div class="fgr"><label>Tipo</label><select id="camp-m-beneficio-tipo"></select></div>' +
          '<div class="fgr"><label>Valor</label><input type="number" id="camp-m-beneficio-valor" placeholder="Ex: 15 ou 50"></div>' +
          '<div class="fgr"><label>Cupom (se houver)</label><input type="text" id="camp-m-beneficio-cupom" placeholder="Ex: REATIVA15"></div>' +
          '<div class="fgr"><label>Condições</label><input type="text" id="camp-m-beneficio-condicoes" placeholder="Ex: compra mínima R$200"></div>' +

          '<div class="fgr" style="grid-column:1/-1;border-top:2px solid var(--ink,#1a1a1a);padding-top:12px;margin-top:4px"><label style="font-size:11px">🧭 Roteiro de Canais</label></div>' +
          '<div class="fgr"><label>Esse público já é conhecido (nome/contato) ou é gente anônima?</label><select id="camp-m-conhecido"><option value="">—</option><option value="conhecido">Conhecido</option><option value="anonimo">Anônimo</option></select></div>' +
          '<div class="fgr"><label>Ele já demonstrou interesse recente, ou está frio?</label><select id="camp-m-temperatura"><option value="">—</option><option value="quente">Quente</option><option value="frio">Frio</option></select></div>' +
          '<div class="fgr" style="grid-column:1/-1"><label>Canais escolhidos pra essa campanha</label><div class="camp-checks" id="camp-m-canais"></div></div>' +
          '<div class="fgr" style="grid-column:1/-1" id="camp-m-sugestao-wrap"></div>' +
          '<div class="fgr" style="grid-column:1/-1"><label>Por que essa combinação (opcional)</label><input type="text" id="camp-m-estrategia" placeholder="Ex: público conhecido, prioriza contato pessoal"></div>' +
          '<div class="fgr" style="grid-column:1/-1;border-top:2px solid var(--ink,#1a1a1a);padding-top:12px;margin-top:4px">' +
            '<label style="font-size:11px">🤖 Modelo de Mensagem — Sugestão da IA (Nível 1)</label>' +
            '<div class="pb2c-hist" id="camp-m-modelo-sugerida" style="min-height:60px;white-space:pre-wrap"></div>' +
            '<button class="btn sm" id="camp-m-gerar-ia" type="button" style="margin-top:5px">🔄 Gerar/Regenerar Modelo com IA</button>' +
          '</div>' +
          '<div class="fgr" style="grid-column:1/-1">' +
            '<label>Modelo de Mensagem — Final do Usuário <span class="tmu" style="font-weight:400">(se preenchida, prevalece sobre a sugerida)</span></label>' +
            '<textarea id="camp-m-modelo-msg" rows="4" placeholder="Ex: Oi {nome}! ... a última peça foi {ultima_peca} ..."></textarea>' +
            '<button class="btn sm" id="camp-m-copiar-ia" type="button" style="margin-top:5px">📋 Copiar sugestão da IA pra cá</button>' +
            '<div class="tmu" style="font-size:10px;margin-top:3px">Variáveis disponíveis: {nome} {cidade} {dias_parado} {ultima_peca} {ultima_collab} {valor_total_historico}</div>' +
          '</div>' +
          '<div class="fgr" style="grid-column:1/-1;border-top:2px solid var(--ink,#1a1a1a);padding-top:12px;margin-top:4px">' +
            '<label style="font-size:11px">🎯 Modelo de Tarefa (Roadmap) <span class="tmu" style="font-weight:400">— usado pra gerar as tarefas de cada lead</span></label>' +
            '<textarea id="camp-m-tarefa-msg" rows="3" placeholder="Ex: Ligar para {nome} e oferecer..."></textarea>' +
            '<div style="display:flex;gap:7px;margin-top:5px">' +
              '<button class="btn sm" id="camp-m-tarefa-gerar-ia" type="button">🔄 Gerar com IA</button>' +
              '<button class="btn sm" id="camp-m-tarefa-copiar-ia" type="button">📋 Usar Mensagem Final</button>' +
            '</div>' +
          '</div>' +
        '</div></div>' +
        '<div class="mo-f">' +
          '<button class="btn" id="camp-m-excluir" style="margin-right:auto;background:var(--rust,#c0392b);color:#fff;display:none">🗑 Excluir</button>' +
          '<button class="btn" id="camp-m-cancelar">Cancelar</button>' +
          '<button class="btn rust" id="camp-m-salvar">💾 Salvar</button>' +
        '</div>' +
      '</div>' +
    '</div>';

  try {
    var res = await Promise.all([cdaCarregarCampanhas(), cdaCarregarSegmentos(), cdaCarregarClientes(), cdaCarregarCompras(), cdaCarregarStatusCrm(), cdaCarregarLeadsB2C(), cdaCarregarEquipe(), cdaCarregarCanais()]);
    ST.campanhas = res[0]; ST.segmentos = res[1]; ST.clientes = res[2]; ST.compras = res[3]; ST.statusCrm = res[4]; ST.leads = res[5]; ST.equipe = res[6]; ST.canais = res[7];
  } catch (err) {
    console.error(err);
    var msg = (err && (err.message || err.details || err.hint)) || 'Erro desconhecido';
    host.querySelector('#camp-lista').innerHTML = '<p style="color:var(--rust,#c0392b);padding:20px">Erro ao carregar dados do Supabase:<br><b>' + msg + '</b></p>';
    return;
  }

  var segmentoPorId = {}; ST.segmentos.forEach(function (s) { segmentoPorId[s.id] = s; });
  var equipePorId = {}; ST.equipe.forEach(function (e) { equipePorId[e.id] = e; });
  var clientePorId = {}; ST.clientes.forEach(function (c) { clientePorId[String(c.id)] = c; });
  function nomeUsuarioAtual() { return (window.cu && window.cu.name) || 'Usuário'; }
  function fmtData(iso) { if (!iso) return '—'; var p = iso.split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }

  // ── Popular selects fixos do modal ──
  var selEtapa = host.querySelector('#camp-m-etapa');
  selEtapa.innerHTML = CDA_ETAPAS_CAMPANHA.map(function (e) { return '<option value="' + e.id + '">' + e.label + '</option>'; }).join('');
  var selStatus = host.querySelector('#camp-m-status');
  selStatus.innerHTML = CDA_STATUS_CAMPANHA.map(function (s) { return '<option value="' + s.id + '">' + s.label + '</option>'; }).join('');
  var selBeneficio = host.querySelector('#camp-m-beneficio-tipo');
  selBeneficio.innerHTML = CDA_TIPOS_BENEFICIO.map(function (b) { return '<option value="' + b.id + '">' + b.label + '</option>'; }).join('');
  host.querySelector('#camp-m-canais').innerHTML = CDA_CANAIS_CAMPANHA.map(function (c) {
    return '<label><input type="checkbox" class="camp-canal-check" value="' + c.id + '"> ' + c.label + '</label>';
  }).join('');
  host.querySelector('#camp-m-resp').innerHTML = ST.equipe.map(function (e) {
    return '<label><input type="checkbox" class="camp-resp-check" value="' + e.id + '"> ' + e.nome + '</label>';
  }).join('');

  function atualizarSugestaoCanal() {
    var conhecido = host.querySelector('#camp-m-conhecido').value;
    var temperatura = host.querySelector('#camp-m-temperatura').value;
    var box = host.querySelector('#camp-m-sugestao-wrap');
    if (!conhecido || !temperatura) { box.innerHTML = ''; return; }
    var texto;
    if (conhecido === 'conhecido' && temperatura === 'quente') texto = '💡 Público conhecido e quente → WhatsApp pessoal costuma converter melhor que qualquer anúncio aqui.';
    else if (conhecido === 'conhecido' && temperatura === 'frio') texto = '💡 Público conhecido mas frio → WhatsApp/DM pessoal pra reengajar; Remarketing pago não compensa pra quem você já pode simplesmente chamar.';
    else if (conhecido === 'anonimo' && temperatura === 'frio') texto = '💡 Público anônimo e frio → Remarketing pago e Instagram pago são o caminho certo aqui; WhatsApp/DM pessoal não se aplica (você não tem o contato).';
    else texto = '💡 Público anônimo mas já demonstrou interesse → aproveite janelas gratuitas (ex: 72h após clique em anúncio) antes de precisar pagar de novo.';
    box.innerHTML = '<div class="camp-sugestao">' + texto + '</div>';
  }
  host.querySelector('#camp-m-conhecido').addEventListener('change', atualizarSugestaoCanal);
  host.querySelector('#camp-m-temperatura').addEventListener('change', atualizarSugestaoCanal);

  var statusCrmPipelineById = {}; ST.statusCrm.forEach(function (s) { statusCrmPipelineById[s.id] = s; });

  function calcularKpi(campanha) {
    var leadsCampanha = ST.leads.filter(function (l) { return String(l.campanhaId) === String(campanha.id); });
    var total = leadsCampanha.length;
    if (!total) return null;
    var contatados = leadsCampanha.filter(function (l) { return l.etapa !== 'novo_lead' || l.resultadoId != null; }).length;
    var responderam = leadsCampanha.filter(function (l) {
      var r = statusCrmPipelineById[l.resultadoId];
      return r && CDA_RESULTADOS_POSITIVOS.indexOf(r.codigo) !== -1;
    }).length;
    var convertidos = leadsCampanha.filter(function (l) { return l.etapa === 'compra' || l.etapa === 'fidelizacao'; }).length;
    return {
      total: total, contatados: contatados, responderam: responderam, convertidos: convertidos,
      taxaContato: Math.round((contatados / total) * 100),
      taxaResposta: contatados ? Math.round((responderam / contatados) * 100) : 0
    };
  }

  function renderPainelKpi(campanha, kpi) {
    var progressoHtml = '<div class="l" style="border-top:1px dashed var(--border2,#ccc);padding-top:10px;margin-top:10px">📊 Indicadores da Campanha</div>';
    if (campanha.metaNumero) {
      var pct = Math.min(100, Math.round((kpi.convertidos / campanha.metaNumero) * 100));
      progressoHtml += '<div class="camp-progresso-wrap">' +
        '<div class="camp-progresso-bar"><div class="camp-progresso-fill" style="width:' + pct + '%"></div></div>' +
        '<div class="camp-progresso-txt"><b>' + kpi.convertidos + ' de ' + campanha.metaNumero + '</b> (' + pct + '%) — ' + (campanha.metaDescricao || 'meta') + '</div>' +
        '</div>';
    }
    return progressoHtml +
      '<div class="camp-kpi">' +
        '<div><div class="v">' + kpi.total + '</div><div class="l">Leads no funil</div></div>' +
        '<div><div class="v">' + kpi.taxaContato + '%</div><div class="l">Taxa de contato</div></div>' +
        '<div><div class="v">' + kpi.taxaResposta + '%</div><div class="l">Taxa de resposta</div></div>' +
        '<div><div class="v">' + kpi.convertidos + '</div><div class="l">Chegaram em Compra</div></div>' +
      '</div>';
  }

  function render() {
    var box = host.querySelector('#camp-lista');
    if (!ST.campanhas.length) { box.innerHTML = '<p class="tmu">Nenhuma campanha criada ainda.</p>'; return; }
    box.innerHTML = ST.campanhas.map(function (c) {
      var seg = segmentoPorId[c.publicoSegmentoId];
      var qtdPublico = seg ? cdaAvaliarSegmento(ST.clientes, ST.compras, ST.statusCrm, seg.filtros || []).length : null;
      var etapa = CDA_ETAPAS_CAMPANHA.find(function (e) { return e.id === c.pipelineEtapaEntrada; });
      var statusInfo = CDA_STATUS_CAMPANHA.find(function (s) { return s.id === c.status; }) || CDA_STATUS_CAMPANHA[0];
      var kpi = calcularKpi(c);
      var beneficioInfo = CDA_TIPOS_BENEFICIO.find(function (b) { return b.id === c.beneficioTipo; });
      return '<div class="camp-card" data-id="' + c.id + '">' +
        '<div class="camp-topo"><div class="camp-nome">' + c.nome + '</div><span class="camp-badge" style="background:' + statusInfo.cor + '">' + statusInfo.label + '</span></div>' +
        (c.objetivo ? '<p class="tmu" style="margin:4px 0 0">' + c.objetivo + '</p>' : '') +
        '<div class="camp-grid">' +
          '<div><div class="l">Público-Alvo</div><b>' + (qtdPublico != null ? qtdPublico.toLocaleString('pt-BR') + ' cliente(s)' : '—') + '</b></div>' +
          '<div><div class="l">Segmento</div>' + (seg ? seg.nome : '<i>segmento não encontrado</i>') + '</div>' +
          '<div><div class="l">Etapa de entrada</div>' + (etapa ? etapa.label : '—') + '</div>' +
          '<div><div class="l">Período</div>' + fmtData(c.periodoInicio) + ' – ' + fmtData(c.periodoFim) + '</div>' +
          '<div><div class="l">Meta</div>' + (c.metaDescricao || '—') + '</div>' +
          '<div><div class="l">Responsável(is)</div>' + ((c.responsavelIds || []).map(function (id) { return equipePorId[id] ? equipePorId[id].nome : null; }).filter(Boolean).join(', ') || '—') + '</div>' +
          '<div><div class="l">Benefício</div>' + (beneficioInfo && beneficioInfo.id !== 'nenhum' ? beneficioInfo.label + (c.beneficioValor ? ' — ' + c.beneficioValor : '') : '—') + '</div>' +
        '</div>' +
        (kpi ? renderPainelKpi(c, kpi) : '<p class="tmu" style="margin-top:10px">Ainda sem leads nesta campanha — clique em "Adicionar público ao Pipeline" pra começar a medir.</p>') +
        '<div class="camp-acoes">' +
          '<button class="btn sm rust" data-add-publico="' + c.id + '">➕ Adicionar público ao Pipeline</button>' +
          '<button class="btn sm" data-gerar-msg="' + c.id + '">🚀 Gerar Mensagens</button>' +
          '<button class="btn sm" data-gerar-roadmap="' + c.id + '">🗺 Gerar Roadmap de Tarefas</button>' +
          '<button class="btn sm" data-editar="' + c.id + '">✎ Editar</button>' +
        '</div>' +
      '</div>';
    }).join('');

    box.querySelectorAll('[data-editar]').forEach(function (btn) { btn.addEventListener('click', function () { abrirModal(btn.dataset.editar); }); });
    box.querySelectorAll('[data-add-publico]').forEach(function (btn) { btn.addEventListener('click', function () { adicionarPublico(btn.dataset.addPublico, btn); }); });
    box.querySelectorAll('[data-gerar-msg]').forEach(function (btn) { btn.addEventListener('click', function () { gerarMensagensCampanha(btn.dataset.gerarMsg, btn); }); });
    box.querySelectorAll('[data-gerar-roadmap]').forEach(function (btn) { btn.addEventListener('click', function () { gerarRoadmapTarefas(btn.dataset.gerarRoadmap, btn); }); });
  }

  async function gerarRoadmapTarefas(campanhaId, btn) {
    var campanha = ST.campanhas.find(function (c) { return String(c.id) === String(campanhaId); });
    if (!campanha) return;
    var leadsCampanha = ST.leads.filter(function (l) { return String(l.campanhaId) === String(campanha.id); });
    if (!leadsCampanha.length) { alert('Essa campanha ainda não tem leads no Pipeline — use "Adicionar público" primeiro.'); return; }
    if (!confirm('Gerar o Roadmap de Tarefas pra ' + leadsCampanha.length + ' lead(s) desta campanha?\n\nCada lead vira 1 tarefa (Data Início/Prevista vêm do período da campanha; Responsável vem do que já estiver escolhido em cada Lead no Pipeline). Quem já tem tarefa desta campanha não duplica.')) return;

    var canalPorId = {}; ST.canais.forEach(function (c) { canalPorId[c.id] = c; });
    var template = campanha.modeloTarefaFinal || campanha.modeloMensagemFinal || campanha.modeloMensagemSugerida || 'Fazer contato com {nome} sobre a campanha "' + campanha.nome + '".';
    var textoOriginal = btn.textContent;
    btn.textContent = 'Gerando...'; btn.disabled = true;
    try {
      var tarefas = leadsCampanha.map(function (lead) {
        var cliente = clientePorId[lead.clienteId];
        var dados = cdaCalcularDadosVariaveis(lead, cliente, ST.compras, canalPorId);
        var descricao = cdaExplodirTemplate(template, dados);
        return {
          descricao: descricao, leadId: lead.id, clienteId: lead.clienteId, campanhaId: campanha.id,
          responsavelId: lead.responsavelId || null, tipo: 'whatsapp', prioridade: 'media',
          dataInicio: campanha.periodoInicio, dataPrevista: campanha.periodoFim,
          descricaoSugerida: null,
          criadoPor: nomeUsuarioAtual()
        };
      });
      var resultado = await cdaCriarTarefasRoadmap(tarefas);
      alert('Pronto!\n\n' + resultado.criadas + ' tarefa(s) nova(s) criada(s).' + (resultado.jaExistentes ? '\n' + resultado.jaExistentes + ' já tinham tarefa desta campanha (não duplicadas).' : '') + '\n\nConfira em Tarefas & Follow-up → 🗺 Ver por Campanha.');
    } catch (err) {
      console.error(err);
      alert('Erro ao gerar roadmap:\n' + ((err && (err.message || err.details || err.hint)) || 'Erro desconhecido'));
    } finally {
      btn.textContent = textoOriginal; btn.disabled = false;
    }
  }

  async function gerarMensagensCampanha(campanhaId, btn) {
    var campanha = ST.campanhas.find(function (c) { return String(c.id) === String(campanhaId); });
    if (!campanha) return;
    var leadsCampanha = ST.leads.filter(function (l) { return String(l.campanhaId) === String(campanha.id); });
    if (!leadsCampanha.length) { alert('Essa campanha ainda não tem leads no Pipeline — use "Adicionar público" primeiro.'); return; }
    if (!confirm('Gerar/atualizar a mensagem sugerida de ' + leadsCampanha.length + ' lead(s) desta campanha, usando o molde configurado (ou o padrão do sistema)?')) return;

    var canalPorId = {}; ST.canais.forEach(function (c) { canalPorId[c.id] = c; });
    var template = campanha.modeloMensagemFinal || campanha.modeloMensagemSugerida || CDA_TEMPLATE_PADRAO;
    var textoOriginal = btn.textContent;
    btn.textContent = 'Gerando...'; btn.disabled = true;
    try {
      var atualizacoes = leadsCampanha.map(function (lead) {
        var cliente = clientePorId[lead.clienteId];
        var dados = cdaCalcularDadosVariaveis(lead, cliente, ST.compras, canalPorId);
        var texto = cdaExplodirTemplate(template, dados);
        lead.mensagemSugerida = texto; // atualiza em memória também
        return { id: lead.id, mensagemSugerida: texto };
      });
      await cdaSalvarMensagensLote(atualizacoes);
      alert('Pronto! ' + atualizacoes.length + ' mensagem(ns) gerada(s)/atualizada(s). Confira em cada lead no Pipeline B2C.');
    } catch (err) {
      console.error(err);
      alert('Erro ao gerar mensagens:\n' + ((err && (err.message || err.details || err.hint)) || 'Erro desconhecido'));
    } finally {
      btn.textContent = textoOriginal; btn.disabled = false;
    }
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
    var respAtivos = c ? (c.responsavelIds || []) : [];
    host.querySelectorAll('.camp-resp-check').forEach(function (chk) { chk.checked = respAtivos.indexOf(Number(chk.value)) !== -1; });
    selBeneficio.value = c ? c.beneficioTipo : 'nenhum';
    host.querySelector('#camp-m-beneficio-valor').value = c && c.beneficioValor != null ? c.beneficioValor : '';
    host.querySelector('#camp-m-beneficio-cupom').value = c ? (c.beneficioCupom || '') : '';
    host.querySelector('#camp-m-beneficio-condicoes').value = c ? (c.beneficioCondicoes || '') : '';
    host.querySelector('#camp-m-conhecido').value = c ? (c.publicoConhecido || '') : '';
    host.querySelector('#camp-m-temperatura').value = c ? (c.publicoTemperatura || '') : '';
    host.querySelector('#camp-m-estrategia').value = c ? (c.estrategiaCanal || '') : '';
    host.querySelector('#camp-m-modelo-msg').value = c ? (c.modeloMensagemFinal || '') : '';
    host.querySelector('#camp-m-modelo-sugerida').textContent = c && c.modeloMensagemSugerida ? c.modeloMensagemSugerida : 'Nenhuma sugestão gerada ainda — clica em "Gerar sugestão com IA".';
    host.querySelector('#camp-m-tarefa-msg').value = c ? (c.modeloTarefaFinal || '') : '';
    var canaisAtivos = c ? (c.canaisSelecionados || []) : [];
    host.querySelectorAll('.camp-canal-check').forEach(function (chk) { chk.checked = canaisAtivos.indexOf(chk.value) !== -1; });
    atualizarSugestaoCanal();
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
      responsavelIds: Array.from(host.querySelectorAll('.camp-resp-check:checked')).map(function (c) { return Number(c.value); }), criadoPor: nomeUsuarioAtual(),
      beneficioTipo: selBeneficio.value, beneficioValor: parseFloat(host.querySelector('#camp-m-beneficio-valor').value) || null,
      beneficioCupom: host.querySelector('#camp-m-beneficio-cupom').value.trim(), beneficioCondicoes: host.querySelector('#camp-m-beneficio-condicoes').value.trim(),
      publicoConhecido: host.querySelector('#camp-m-conhecido').value || null, publicoTemperatura: host.querySelector('#camp-m-temperatura').value || null,
      canaisSelecionados: Array.from(host.querySelectorAll('.camp-canal-check:checked')).map(function (c) { return c.value; }),
      estrategiaCanal: host.querySelector('#camp-m-estrategia').value.trim(),
      modeloMensagemFinal: host.querySelector('#camp-m-modelo-msg').value.trim(),
      modeloMensagemSugerida: host.querySelector('#camp-m-modelo-sugerida').textContent.indexOf('Nenhuma sugestão') === 0 ? null : host.querySelector('#camp-m-modelo-sugerida').textContent,
      modeloTarefaFinal: host.querySelector('#camp-m-tarefa-msg').value.trim()
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
  host.querySelector('#camp-m-gerar-ia').addEventListener('click', async function () {
    var btn = this;
    var textoOriginal = btn.textContent;
    btn.textContent = 'Gerando (chamando a IA)...'; btn.disabled = true;
    try {
      var campanhaTemp = {
        nome: host.querySelector('#camp-m-nome').value.trim(), objetivo: host.querySelector('#camp-m-objetivo').value.trim(),
        beneficioTipo: selBeneficio.value, beneficioValor: parseFloat(host.querySelector('#camp-m-beneficio-valor').value) || null,
        beneficioCondicoes: host.querySelector('#camp-m-beneficio-condicoes').value.trim(),
        publicoConhecido: host.querySelector('#camp-m-conhecido').value || null, publicoTemperatura: host.querySelector('#camp-m-temperatura').value || null,
        canaisSelecionados: Array.from(host.querySelectorAll('.camp-canal-check:checked')).map(function (c) { return c.value; }),
        estrategiaCanal: host.querySelector('#camp-m-estrategia').value.trim()
      };
      var texto = await cdaGerarSugestaoMensagemIA(campanhaTemp);
      host.querySelector('#camp-m-modelo-sugerida').textContent = texto;
      if (ST.editId) {
        await cdaSalvarCampoCampanha(ST.editId, 'modelo_mensagem_sugerida', texto);
        var campanhaAtual = ST.campanhas.find(function (c) { return String(c.id) === String(ST.editId); });
        if (campanhaAtual) campanhaAtual.modeloMensagemSugerida = texto;
      }
    } catch (err) {
      console.error(err);
      alert('Erro ao gerar sugestão com IA:\n' + ((err && err.message) || 'Erro desconhecido') + '\n\nConfira se a ANTHROPIC_API_KEY foi configurada nos Secrets da Edge Function no Supabase.');
    } finally {
      btn.textContent = textoOriginal; btn.disabled = false;
    }
  });
  host.querySelector('#camp-m-copiar-ia').addEventListener('click', function () {
    var sugerida = host.querySelector('#camp-m-modelo-sugerida').textContent;
    if (sugerida.indexOf('Nenhuma sugestão') === 0) { alert('Gere uma sugestão com a IA primeiro.'); return; }
    host.querySelector('#camp-m-modelo-msg').value = sugerida;
  });
  host.querySelector('#camp-m-tarefa-gerar-ia').addEventListener('click', async function () {
    var btn = this;
    var textoOriginal = btn.textContent;
    btn.textContent = 'Gerando (chamando a IA)...'; btn.disabled = true;
    try {
      var campanhaTemp = {
        nome: host.querySelector('#camp-m-nome').value.trim(), objetivo: host.querySelector('#camp-m-objetivo').value.trim(),
        beneficioTipo: selBeneficio.value, beneficioValor: parseFloat(host.querySelector('#camp-m-beneficio-valor').value) || null,
        beneficioCondicoes: host.querySelector('#camp-m-beneficio-condicoes').value.trim(),
        publicoConhecido: host.querySelector('#camp-m-conhecido').value || null, publicoTemperatura: host.querySelector('#camp-m-temperatura').value || null,
        canaisSelecionados: Array.from(host.querySelectorAll('.camp-canal-check:checked')).map(function (c) { return c.value; }),
        estrategiaCanal: host.querySelector('#camp-m-estrategia').value.trim()
      };
      var texto = await cdaGerarSugestaoMensagemIA(campanhaTemp, 'tarefa');
      host.querySelector('#camp-m-tarefa-msg').value = texto;
      if (ST.editId) {
        await cdaSalvarCampoCampanha(ST.editId, 'modelo_tarefa_final', texto);
        var campanhaAtual = ST.campanhas.find(function (c) { return String(c.id) === String(ST.editId); });
        if (campanhaAtual) campanhaAtual.modeloTarefaFinal = texto;
      }
    } catch (err) {
      console.error(err);
      alert('Erro ao gerar sugestão com IA:\n' + ((err && err.message) || 'Erro desconhecido'));
    } finally {
      btn.textContent = textoOriginal; btn.disabled = false;
    }
  });
  host.querySelector('#camp-m-tarefa-copiar-ia').addEventListener('click', function () {
    var mensagemFinal = host.querySelector('#camp-m-modelo-msg').value.trim();
    var mensagemSugerida = host.querySelector('#camp-m-modelo-sugerida').textContent;
    var fonte = mensagemFinal || (mensagemSugerida.indexOf('Nenhuma sugestão') !== 0 ? mensagemSugerida : '');
    if (!fonte) { alert('Preencha a Mensagem Final, ou gere uma sugestão de mensagem com a IA primeiro.'); return; }
    host.querySelector('#camp-m-tarefa-msg').value = fonte;
  });
  host.querySelector('#camp-m-salvar').addEventListener('click', salvar);
  host.querySelector('#camp-m-excluir').addEventListener('click', excluir);

  render();
}

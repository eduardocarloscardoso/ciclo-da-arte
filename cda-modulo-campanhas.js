// ════════════════════════════════════════════════════════════════════
// cda-modulo-campanhas.js
// Campanhas — Ciclo 1 do "motor de campanha" (ver brainstorm de
// ago/2026): liga um segmento salvo (Segmentação) a uma etapa do
// Pipeline B2C, com período e meta. O botão "Adicionar público ao
// Pipeline" recalcula quem bate com o segmento HOJE e cria os leads
// (já vinculados ao cliente existente, sem duplicar).
//
// Nov/2026 (decisão de Cardoso): a SEGMENTAÇÃO diz QUAIS filtros usar; os
// VALORES são preenchidos aqui, na campanha (cda_campanhas.filtros_valores).
// O público pode ser uma segmentação parametrizada ou um modelo comercial
// (Lead, Ativo, Em risco, VIP... — id "modelo:<codigo>"). "🧊 Congelar lista"
// grava a foto do público em cda_campanha_destinatarios; "⧉ Duplicar" copia
// a campanha para trocar só o necessário (ex.: a praça do próximo show).
//
// Requer cda-dados-compartilhados.js e cda-construtor-filtros.js carregados antes.
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

async function montarModuloCampanhas(containerId, opts) {
  opts = opts || {};
  var editavel = opts.editavel !== false;
  var host = document.getElementById(containerId);
  if (!host) { console.error('cda-modulo-campanhas: container #' + containerId + ' não encontrado'); return; }

  var ST = { mensagens: [], campanhas: [], segmentos: [], clientes: [], compras: [], statusCrm: [], leads: [], equipe: [], canais: [], hierarquia: [], listas: {}, editId: null };
  var motor = null, clientesValidos = [], cfCampanha = null;

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
      '#camp-modal .mo-box{max-width:min(900px,94vw);}' +
      '#camp-lgpd-modal .mo-box{max-width:min(900px,95vw);max-height:90dvh;display:flex;flex-direction:column;overflow:hidden;}' +
      '#camp-lgpd-modal .mo-b{overflow-y:auto;min-height:0;}' +
      '.camp-lgpd-card{border:1px solid #aaa;padding:10px;margin:7px 0;font-size:12px;}' +
      '.camp-msg-linha{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:6px 8px;border:1px solid var(--border2,#ccc);margin-bottom:5px;font-size:12px;}' +
      '#camp-preparo-modal{padding:12px;box-sizing:border-box;}' +
      '#camp-preparo-modal .mo-box{width:min(1050px,100%);max-width:1050px;max-height:calc(100vh - 24px);max-height:calc(100dvh - 24px);height:auto;display:flex;flex-direction:column;overflow:hidden;box-sizing:border-box;}' +
      '#camp-preparo-modal .mo-h,#camp-preparo-modal .mo-f{flex-shrink:0;}' +
      '#camp-preparo-modal .camp-preparo-fixo{flex-shrink:0;padding:10px 16px 8px;max-height:36vh;overflow:auto;border-bottom:1px solid var(--border2,#ccc);}' +
      '#camp-preparo-modal .mo-b{flex:1 1 auto;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:12px 16px;}' +
      '#camp-preparo-modal #camp-preparo-listagem{margin:0 0 12px;}' +
      '#camp-preparo-modal #camp-preparo-previa{display:block;width:100%;height:clamp(260px,42vh,420px);box-sizing:border-box;background:#fff;border:1px solid #aaa;}' +
      '#camp-preparo-modal .mo-f{background:var(--paper,#fff);border-top:1px solid var(--border2,#ccc);padding:10px 16px;}' +
      '@media(max-width:700px){#camp-preparo-modal{padding:5px;}#camp-preparo-modal .mo-box{max-height:calc(100dvh - 10px);}#camp-preparo-modal .camp-preparo-fixo{max-height:43vh;}#camp-preparo-modal #camp-preparo-previa{height:300px;}}' +
    '</style>' +
    '<div class="row-bt">' +
      '<div><div class="sec-t">📣 Campanhas</div><div class="sec-d">Liga um segmento de clientes a uma etapa do Pipeline, com período e meta</div></div>' +
      (editavel ? '<button class="btn rust" id="camp-btn-nova">＋ Nova Campanha</button>' : '') +
    '</div>' +
    '<div style="display:flex;gap:8px;margin:12px 0;flex-wrap:wrap;align-items:center">' +
      '<label for="camp-f-campanha" style="font-size:12px;font-weight:600">Selecionar campanha</label>' +
      '<select id="camp-f-campanha" aria-label="Filtrar campanhas" style="min-width:270px;max-width:100%;padding:7px"><option value="">Todas as campanhas</option></select>' +
      (editavel ? '<button type="button" class="btn" id="camp-btn-lgpd">⚖ Base Legal LGPD</button>' : '') +
    '</div>' +
    '<div id="camp-carregamento-aviso" role="status" style="font-size:12px;margin:6px 0;color:var(--muted,#777)"></div>' +
    '<div id="camp-lista"></div>' +
    '<div class="mo" id="camp-preparo-modal">' +
      '<div class="mo-box" style="max-width:min(1050px,96vw)">' +
        '<div class="mo-h"><h3>✉ Preparar Envio · somente conferência</h3><button type="button" class="mo-x" id="camp-preparo-fechar">✕</button></div>' +
        '<div class="camp-preparo-fixo">' +
          '<p id="camp-preparo-campanha" style="font-weight:700;margin:0 0 6px"></p>' +
          '<div class="fgr" style="margin:0 0 6px"><label for="camp-preparo-msg">Mensagem da Biblioteca</label><select id="camp-preparo-msg"></select></div>' +
          '<div id="camp-preparo-estado" role="status" style="margin:6px 0;font-size:12px"></div>' +
          '<div id="camp-preparo-resumo" style="margin:6px 0"></div>' +
        '</div>' +
        '<div class="mo-b">' +
          '<div id="camp-preparo-elegibilidade" style="margin:8px 0"></div>' +
          '<div id="camp-preparo-listagem"></div>' +
          '<div class="fgr" style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">' +
            '<button type="button" class="btn" id="camp-preparo-visualizar" disabled>👁 Visualizar Mensagem</button>' +
            '<span class="tmu" style="font-size:12px">Abre o e-mail completo em outra aba, como na Biblioteca de Mensagens.</span></div>' +
          '<p style="border:1px solid #b35a38;padding:10px;font-size:12px;background:#fff6ee;color:#6f331e">' +
            '<b>Envio indisponível nesta etapa.</b> A contagem de endereços é preliminar. ' +
            'Consentimento, descadastros e bloqueios ainda deverão ser verificados antes de qualquer disparo real.</p>' +
        '</div>' +
        '<div class="mo-f"><button type="button" class="btn" id="camp-preparo-voltar">Fechar preparação</button>' +
          '<button type="button" class="btn rust" disabled title="Aguardando homologação e regras de envio">Enviar campanha · indisponível</button></div>' +
      '</div>' +
    '</div>' +

    '<div class="mo" id="camp-lgpd-modal"><div class="mo-box">' +
      '<div class="mo-h"><h3>⚖ Bases Legais LGPD</h3><button type="button" class="mo-x" id="camp-lgpd-x">✕</button></div>' +
      '<div class="mo-b"><p style="font-size:12px">Modelos informativos editáveis. O uso do modelo não substitui avaliação jurídica.</p>' +
      '<div id="camp-lgpd-status" role="status" style="font-size:12px"></div><div id="camp-lgpd-lista"></div>' +
      '<h4 id="camp-lgpd-titulo">Nova fundamentação</h4><input type="hidden" id="camp-lgpd-id">' +
      '<input type="hidden" id="camp-lgpd-codigo">' +
      '<p style="font-size:11px;margin:4px 0 12px;color:var(--muted,#777)">O código interno é gerado automaticamente ao cadastrar uma nova base.</p>' +
      '<div class="fgr"><label>Base legal *</label><input id="camp-lgpd-nome" maxlength="160"></div>' +
      '<div class="fgr"><label>Fundamentação padrão *</label><textarea id="camp-lgpd-texto" rows="5"></textarea></div>' +
      '<div style="display:flex;gap:8px;margin:12px 0"><button type="button" class="btn rust" id="camp-lgpd-salvar">Salvar</button>' +
      '<button type="button" class="btn" id="camp-lgpd-novo">Novo / Limpar</button></div>' +
      '</div><div class="mo-f"><button type="button" class="btn" id="camp-lgpd-fechar">Fechar</button></div></div></div>' +
    '<div class="mo" id="camp-modal">' +
      '<div class="mo-box">' +
        '<div class="mo-h"><h3 id="camp-modal-title">Nova Campanha</h3><button class="mo-x" id="camp-modal-x">✕</button></div>' +
        '<div class="mo-b"><div class="fg">' +
          '<div class="fgr" style="grid-column:1/-1"><label>Nome *</label><input type="text" id="camp-m-nome" placeholder="Ex: Reativação — Em Risco Agosto"></div>' +
          '<div class="fgr" style="grid-column:1/-1"><label>Objetivo</label><input type="text" id="camp-m-objetivo" placeholder="Ex: Trazer de volta clientes que pararam de comprar"></div>' +
          '<div class="fgr" style="grid-column:1/-1;border-top:1px solid var(--border2,#ccc);padding-top:12px;margin-top:4px"><label style="font-size:11px">⚖️ Fundamentação LGPD da campanha · registro informativo</label></div>' +
          '<div class="fgr" style="grid-column:1/-1"><label for="camp-m-lgpd-base">Base legal LGPD</label><select id="camp-m-lgpd-base"><option value="">Não informada / em análise</option></select></div>' +
          '<div class="fgr" style="grid-column:1/-1"><label for="camp-m-lgpd-finalidade">Finalidade e Fundamentação LGPD</label>' +
            '<textarea id="camp-m-lgpd-finalidade" rows="3" placeholder="Descreva a finalidade, origem dos contatos, hipótese legal e justificativa para esta campanha."></textarea>' +
            '<div class="tmu" style="font-size:11px;margin-top:4px">Registro informativo para rastreabilidade. O preenchimento não substitui avaliação de necessidade, transparência e demais requisitos aplicáveis.</div></div>' +
          '<div class="fgr" style="grid-column:1/-1"><label>Público — segmentação *</label><select id="camp-m-segmento"><option value="">Selecione...</option></select></div>' +
          '<div class="fgr" style="grid-column:1/-1" id="camp-m-filtros-box" hidden><label>Filtros desta campanha <span class="tmu" style="font-weight:400">— preencha os valores (ex: qual centro de custo, qual UF)</span></label><div id="camp-m-filtros"></div>' +
            '<div id="camp-m-publico-alvo" style="font-size:12px;margin-top:6px"></div></div>' +
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
          '<div class="fgr" style="grid-column:1/-1"><label>Meios escolhidos pra essa campanha</label><div class="camp-checks" id="camp-m-canais"></div></div>' +
          '<div class="fgr" style="grid-column:1/-1" id="camp-m-sugestao-wrap"></div>' +
          '<div class="fgr" style="grid-column:1/-1"><label>Por que essa combinação (opcional)</label><input type="text" id="camp-m-estrategia" placeholder="Ex: público conhecido, prioriza contato pessoal"></div>' +
          '<div class="fgr" style="grid-column:1/-1;border-top:2px solid var(--ink,#1a1a1a);padding-top:12px;margin-top:4px"><label style="font-size:11px">📧 Mensagens de e-mail desta campanha <span class="tmu" style="font-weight:400">— guardadas na 📚 Biblioteca de Mensagens</span></label>' +
            '<div id="camp-m-mensagens" style="margin-top:6px"></div></div>' +

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
        '</div></div>' +
        '<div class="mo-f">' +
          '<button class="btn" id="camp-m-excluir" style="margin-right:auto;background:var(--rust,#c0392b);color:#fff;display:none">🗑 Excluir</button>' +
          '<button class="btn" id="camp-m-cancelar">Cancelar</button>' +
          '<button class="btn rust" id="camp-m-salvar">💾 Salvar</button>' +
        '</div>' +
      '</div>' +
    '</div>';

  // Consultas auxiliares não podem impedir o carregamento das Campanhas.
  // Cada consulta tem limite de espera e falhas são informadas sem apagar campanhas.
  var campAviso = host.querySelector('#camp-carregamento-aviso');
  campAviso.textContent = 'Carregando campanhas...';
  try {
    var carregamentos = [
      ['Campanhas', cdaCarregarCampanhas],
      ['Segmentação', cdaCarregarSegmentos],
      ['Clientes', cdaCarregarClientes],
      ['Compras', cdaCarregarCompras],
      ['Status CRM', cdaCarregarStatusCrm],
      ['Pipeline', cdaCarregarLeadsB2C],
      ['Equipe', cdaCarregarEquipe],
      ['Canais', cdaCarregarCanais],
      ['Hierarquia de receitas', cdaCarregarHierarquiaReceita],
      ['Listas congeladas', cdaCarregarResumoListas],
      ['Produtos', cdaCarregarProdutos],
      ['Mensagens', cdaCarregarMensagens]
    ];
    var resultados = await Promise.all(carregamentos.map(function (item) {
      return Promise.race([
        Promise.resolve().then(item[1]),
        new Promise(function (_, rejeitar) {
          setTimeout(function () { rejeitar(new Error('Tempo limite de carregamento')); }, 15000);
        })
      ]).then(function (dados) { return { ok: true, dados: dados }; },
        function (erro) { return { ok: false, erro: erro }; });
    }));
    if (!resultados[0].ok) throw resultados[0].erro;
    ST.campanhas = resultados[0].dados || [];
    ST.segmentos = resultados[1].ok ? (resultados[1].dados || []) : [];
    ST.clientes = resultados[2].ok ? (resultados[2].dados || []) : [];
    ST.compras = resultados[3].ok ? (resultados[3].dados || []) : [];
    ST.statusCrm = resultados[4].ok ? (resultados[4].dados || []) : [];
    ST.leads = resultados[5].ok ? (resultados[5].dados || []) : [];
    ST.equipe = resultados[6].ok ? (resultados[6].dados || []) : [];
    ST.canais = resultados[7].ok ? (resultados[7].dados || []) : [];
    ST.hierarquia = resultados[8].ok ? (resultados[8].dados || []) : [];
    ST.listas = resultados[9].ok ? (resultados[9].dados || {}) : {};
    ST.produtos = resultados[10].ok ? (resultados[10].dados || []) : [];
    ST.mensagens = resultados[11].ok ? (resultados[11].dados || []) : [];
    var falhas = carregamentos.filter(function (item, i) { return i !== 0 && !resultados[i].ok; })
      .map(function (item) { return item[0]; });
    if (falhas.length) {
      campAviso.style.color = 'var(--rust,#c0392b)';
      campAviso.textContent = 'Atenção: dados auxiliares indisponíveis (' + falhas.join(', ') +
        '). As campanhas continuam cadastradas; alguns indicadores podem estar incompletos. Recarregue a tela para tentar novamente.';
    } else {
      campAviso.textContent = '';
    }
  } catch (err) {
    console.error('Erro ao carregar Campanhas:', err);
    campAviso.style.color = 'var(--rust,#c0392b)';
    campAviso.textContent = 'Falha ao carregar campanhas. Tente recarregar a tela.';
    var msg = (err && (err.message || err.details || err.hint)) || 'Erro desconhecido';
    host.querySelector('#camp-lista').innerHTML = '<p style="color:var(--rust,#c0392b);padding:20px">Erro ao carregar dados do Supabase: <b>' + msg + '</b></p>';
    return;
  }

  // Motor único de segmentação (mesma regra da tela de Segmentação)
  motor = cdaMotorSegmento(ST.compras, { canais: ST.canais, hierarquia: ST.hierarquia });
  clientesValidos = ST.clientes.filter(function (c) { return !c.cadastroIncompleto; });
  var MODELOS = cdaModelosComerciais(ST.statusCrm);
  var segmentoPorId = {}; ST.segmentos.forEach(function (s) { segmentoPorId[s.id] = s; });
  MODELOS.forEach(function (m) { segmentoPorId[m.id] = m; });
  // Filtros (com valores) de uma campanha: os dela; campanhas antigas sem valores usam os do segmento
  function filtrosDaCampanha(c) {
    if (c.filtrosValores && c.filtrosValores.length) return c.filtrosValores;
    var seg = segmentoPorId[c.publicoSegmentoId];
    return seg ? (seg.filtros || []) : null;
  }
  function publicoDe(filtros) { return clientesValidos.filter(function (c) { return filtros.every(function (f) { return motor.passa(c, f); }); }); }
  function emailsUnicos(lista) {
    var vistos = {}, n = 0;
    lista.forEach(function (c) { if (!cdaEmailValido(c.email)) return; var e = String(c.email).trim().toLowerCase(); if (!vistos[e]) { vistos[e] = 1; n++; } });
    return n;
  }
  function escH(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]; }); }
  function fmtDataHora(iso) { if (!iso) return '—'; var d = new Date(iso); return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); }
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

  var filtroCampanha = host.querySelector('#camp-f-campanha');
  filtroCampanha.addEventListener('change', render);

  function render() {
    var box = host.querySelector('#camp-lista');
    var anterior = filtroCampanha.value;
    filtroCampanha.innerHTML = '<option value="">Todas as campanhas</option>' +
      ST.campanhas.map(function (c) { return '<option value="' + escH(c.id) + '">' + escH(c.nome) + '</option>'; }).join('');
    if (anterior && ST.campanhas.some(function (c) { return String(c.id) === anterior; })) {
      filtroCampanha.value = anterior;
    }
    if (!ST.campanhas.length) { box.innerHTML = '<p class="tmu">Nenhuma campanha criada ainda.</p>'; return; }
    var visiveis = ST.campanhas.filter(function (c) { return !filtroCampanha.value || String(c.id) === filtroCampanha.value; });
    box.innerHTML = visiveis.map(function (c) {
      var seg = segmentoPorId[c.publicoSegmentoId];
      var filtrosC = filtrosDaCampanha(c);
      var qtdPublico = filtrosC ? publicoDe(filtrosC).length : null;
      var lista = ST.listas[String(c.id)];
      var etapa = CDA_ETAPAS_CAMPANHA.find(function (e) { return e.id === c.pipelineEtapaEntrada; });
      var statusInfo = CDA_STATUS_CAMPANHA.find(function (s) { return s.id === c.status; }) || CDA_STATUS_CAMPANHA[0];
      var kpi = calcularKpi(c);
      var beneficioInfo = CDA_TIPOS_BENEFICIO.find(function (b) { return b.id === c.beneficioTipo; });
      return '<div class="camp-card" data-id="' + c.id + '">' +
        '<div class="camp-topo"><div class="camp-nome">' + c.nome + '</div><span class="camp-badge" style="background:' + statusInfo.cor + '">' + statusInfo.label + '</span></div>' +
        (c.objetivo ? '<p class="tmu" style="margin:4px 0 0">' + c.objetivo + '</p>' : '') +
        '<div class="camp-grid">' +
          '<div><div class="l">Público-Alvo</div><b>' + (qtdPublico != null ? qtdPublico.toLocaleString('pt-BR') + ' cliente(s)' : '—') + '</b></div>' +
          '<div><div class="l">Segmentação</div>' + (seg ? escH(seg.nome) + '<div class="tmu" style="font-size:10px">' + escH(seg.modelo ? seg.resumo : cdaResumoTipos(seg.filtros)) + '</div>' : '<i>segmentação não encontrada</i>') + '</div>' +
          '<div><div class="l">Lista congelada</div>' + (lista ? '<b>' + lista.total.toLocaleString('pt-BR') + '</b> cliente(s) · ' + lista.comEmail.toLocaleString('pt-BR') + ' com e-mail<div class="tmu" style="font-size:10px">em ' + fmtDataHora(lista.congeladoEm) + '</div>' : '<span class="tmu">ainda não congelada</span>') + '</div>' +
          '<div><div class="l">Etapa de entrada</div>' + (etapa ? etapa.label : '—') + '</div>' +
          '<div><div class="l">Período</div>' + fmtData(c.periodoInicio) + ' – ' + fmtData(c.periodoFim) + '</div>' +
          '<div><div class="l">Meta</div>' + (c.metaDescricao || '—') + '</div>' +
          '<div><div class="l">Responsável(is)</div>' + ((c.responsavelIds || []).map(function (id) { return equipePorId[id] ? equipePorId[id].nome : null; }).filter(Boolean).join(', ') || '—') + '</div>' +
          '<div><div class="l">Mensagens de e-mail</div>' + (function () { var n = ST.mensagens.filter(function (m) { return String(m.campanhaId) === String(c.id); }).length; return n ? '📧 <b>' + n + '</b> na Biblioteca' : '<span class="tmu">nenhuma</span>'; })() + '</div>' +
          '<div><div class="l">Benefício</div>' + (beneficioInfo && beneficioInfo.id !== 'nenhum' ? beneficioInfo.label + (c.beneficioValor ? ' — ' + c.beneficioValor : '') : '—') + '</div>' +
        '</div>' +
        (kpi ? renderPainelKpi(c, kpi) : '<p class="tmu" style="margin-top:10px">Ainda sem leads nesta campanha — clique em "Adicionar público ao Pipeline" pra começar a medir.</p>') +
        (editavel ?
        '<div class="camp-acoes">' +
          '<button class="btn sm rust" data-congelar="' + c.id + '">🧊 ' + (lista ? 'Recongelar lista' : 'Congelar lista') + '</button>' +
          '<button class="btn sm" data-preparar="' + c.id + '">✉ Preparar Envio</button>' +
          '<button class="btn sm" data-add-publico="' + c.id + '">➕ Adicionar público ao Pipeline</button>' +
          '<button class="btn sm" data-gerar-msg="' + c.id + '">🚀 Gerar Mensagens</button>' +
          '<button class="btn sm" data-gerar-roadmap="' + c.id + '">🗺 Gerar Roadmap de Tarefas</button>' +
          '<button class="btn sm" data-editar="' + c.id + '">✎ Editar</button>' +
          '<button class="btn sm" data-duplicar="' + c.id + '">⧉ Duplicar</button>' +
        '</div>' : '') +
      '</div>';
    }).join('');

    if (editavel) {
    box.querySelectorAll('[data-editar]').forEach(function (btn) { btn.addEventListener('click', function () { abrirModal(btn.dataset.editar); }); });
    box.querySelectorAll('[data-duplicar]').forEach(function (btn) { btn.addEventListener('click', function () { abrirModal(btn.dataset.duplicar, true); }); });
    box.querySelectorAll('[data-congelar]').forEach(function (btn) { btn.addEventListener('click', function () { congelarLista(btn.dataset.congelar, btn); }); });
    box.querySelectorAll('[data-preparar]').forEach(function (btn) { btn.addEventListener('click', function () { prepararEnvio(btn.dataset.preparar); }); });
    box.querySelectorAll('[data-add-publico]').forEach(function (btn) { btn.addEventListener('click', function () { adicionarPublico(btn.dataset.addPublico, btn); }); });
    box.querySelectorAll('[data-gerar-msg]').forEach(function (btn) { btn.addEventListener('click', function () { gerarMensagensCampanha(btn.dataset.gerarMsg, btn); }); });
    box.querySelectorAll('[data-gerar-roadmap]').forEach(function (btn) { btn.addEventListener('click', function () { gerarRoadmapTarefas(btn.dataset.gerarRoadmap, btn); }); });
    } // fim if (editavel)
  }

  // Preparação de e-mail: somente leitura. Não chama Edge Function de disparo.
  var modalPreparo = host.querySelector('#camp-preparo-modal');
  var preparoSelecionada = null;
  var preparoElegiveis = [];
  var preparoMensagens = [];
  var preparoCampanha = null;
  var preparoResumo = host.querySelector('#camp-preparo-resumo');
  var preparoListagem = host.querySelector('#camp-preparo-listagem');
  var preparoEstado = host.querySelector('#camp-preparo-estado');
  var preparoMsg = host.querySelector('#camp-preparo-msg');
  var preparoPagina = 0;
  var preparoClassificados = [];
  var preparoFiltro = 'todos';
  var preparoFiltroEl = host.querySelector('#camp-preparo-elegibilidade');
  function fecharPreparo() { modalPreparo.classList.remove('op'); }
  host.querySelector('#camp-preparo-fechar').addEventListener('click', fecharPreparo);
  host.querySelector('#camp-preparo-voltar').addEventListener('click', fecharPreparo);

  function apresentarPreparo() {
    if (!preparoSelecionada) return;
    var total = preparoSelecionada.total;
    preparoResumo.innerHTML = '<div class="camp-grid">' +
      '<div><div class="l">Lista congelada</div><b>' + total.toLocaleString('pt-BR') + '</b> cliente(s)</div>' +
      '<div><div class="l">E-mails válidos e únicos</div><b>' + preparoSelecionada.aptos.toLocaleString('pt-BR') + '</b> (pré-seleção)</div>' +
      '<div><div class="l">Sem e-mail / inválidos</div><b>' + preparoSelecionada.invalidos.toLocaleString('pt-BR') + '</b></div>' +
      '<div><div class="l">Duplicidades de e-mail</div><b>' + preparoSelecionada.duplicados.toLocaleString('pt-BR') + '</b></div>' +
      '<div><div class="l">Congelada em</div>' + escH(fmtDataHora(preparoSelecionada.data)) + '</div></div>' +
      '<p style="font-size:11px;color:var(--muted,#777)">Validação sintática e ausência de duplicidade não comprovam autorização de contato.</p>';

    var contagens = { apto: 0, pendente: 0, excluido: 0 };
    preparoClassificados.forEach(function (d) { contagens[d.situacao]++; });
    preparoFiltroEl.innerHTML =
      '<h4 style="font-size:15px;margin:8px 0">Elegibilidade dos Destinatários · avaliação preliminar</h4>' +
      '<div class="camp-grid" style="padding:9px 12px;border:1px solid var(--border2,#ccc);margin:0 0 8px">' +
        '<div><div class="l">Aptos comprovados</div><b>' + contagens.apto.toLocaleString('pt-BR') + '</b></div>' +
        '<div><div class="l">Pendentes de comprovação</div><b>' + contagens.pendente.toLocaleString('pt-BR') + '</b></div>' +
        '<div><div class="l">Excluídos tecnicamente</div><b>' + contagens.excluido.toLocaleString('pt-BR') + '</b></div>' +
      '</div>' +
      '<p style="font-size:11px;margin:5px 0 10px">A situação <b>Pendente</b> significa que não existe autorização verificável integrada a esta tela; não significa que o cliente recusou contato. ' +
      'Descadastros e bloqueios comerciais ainda precisam ser integrados. <b>Não enviar.</b></p>' +
      '<label for="camp-preparo-filtro" style="font-size:12px">Consultar por situação</label> ' +
      '<select id="camp-preparo-filtro" style="max-width:330px;margin:0 0 8px">' +
        '<option value="todos">Todos os registros</option>' +
        '<option value="apto">Aptos comprovados</option>' +
        '<option value="pendente">Pendentes de comprovação</option>' +
        '<option value="excluido">Excluídos tecnicamente</option>' +
      '</select>';
    var filtroEl = host.querySelector('#camp-preparo-filtro');
    filtroEl.value = preparoFiltro;
    filtroEl.addEventListener('change', function () { preparoFiltro = this.value; preparoPagina = 0; apresentarPreparo(); });

    var visiveis = preparoClassificados.filter(function (d) { return preparoFiltro === 'todos' || d.situacao === preparoFiltro; });
    var inicio = preparoPagina * 25, pagina = visiveis.slice(inicio, inicio + 25);
    var qtdPaginas = Math.max(1, Math.ceil(visiveis.length / 25));
    preparoListagem.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:8px">' +
      '<b>Destinatários · ' + visiveis.length.toLocaleString('pt-BR') + '</b>' +
      '<span>Página ' + (preparoPagina + 1) + ' de ' + qtdPaginas +
      ' <button class="btn sm" id="camp-preparo-anterior" ' + (preparoPagina === 0 ? 'disabled' : '') + '>Anterior</button>' +
      ' <button class="btn sm" id="camp-preparo-proximo" ' + (inicio + 25 >= visiveis.length ? 'disabled' : '') + '>Próxima</button></span></div>' +
      '<div style="max-height:clamp(160px,32vh,330px);overflow:auto">' +
      '<table style="width:100%;font-size:12px"><thead><tr><th>Cliente</th><th>E-mail</th><th>UF</th><th>Situação</th><th>Motivo / origem</th></tr></thead><tbody>' +
      (pagina.length ? pagina.map(function (d) {
        return '<tr><td>' + escH(d.nome) + '</td><td>' + escH(d.email) + '</td><td>' + escH(d.uf) +
          '</td><td>' + (d.situacao === 'apto' ? 'Apto' : d.situacao === 'excluido' ? 'Excluído' : 'Pendente') +
          '</td><td>' + escH(d.motivo) + '</td></tr>';
      }).join('') : '<tr><td colspan="5" style="padding:12px">Nenhum registro nesta situação.</td></tr>') +
      '</tbody></table></div>';
    host.querySelector('#camp-preparo-anterior').addEventListener('click', function () {
      if(preparoPagina > 0){ preparoPagina--; apresentarPreparo(); }
    });
    host.querySelector('#camp-preparo-proximo').addEventListener('click', function () {
      if((preparoPagina+1)*25 < visiveis.length){ preparoPagina++; apresentarPreparo(); }
    });
  }
  function atualizarVisualizarPreparo() {
    var msg = preparoMensagens.find(function (m) { return String(m.id) === preparoMsg.value; });
    var btn = host.querySelector('#camp-preparo-visualizar');
    btn.disabled = !msg;
    btn.title = msg ? 'Abrir mensagem completa em outra aba' : 'Selecione uma mensagem da Biblioteca';
  }
  preparoMsg.addEventListener('change', atualizarVisualizarPreparo);
  host.querySelector('#camp-preparo-visualizar').addEventListener('click', function () {
    var msg = preparoMensagens.find(function (m) { return String(m.id) === preparoMsg.value; });
    if (!msg || !preparoCampanha) return;
    var exemplo = preparoElegiveis[0] || { nome: 'Cliente', email: '' };
    // Reutiliza a mesma visualização já homologada na Biblioteca.
    // Este botão apenas abre a prévia; não dispara e-mails aos clientes.
    cdaMsgAbrirEmNovaAba(msg, preparoCampanha, exemplo);
  });

  async function prepararEnvio(campanhaId) {
    preparoCampanha = ST.campanhas.find(function (c) { return String(c.id) === String(campanhaId); });
    if (!preparoCampanha) return;
    preparoSelecionada = null; preparoElegiveis = []; preparoMensagens = []; preparoClassificados = []; preparoPagina = 0; preparoFiltro = 'todos';
    preparoResumo.innerHTML = ''; preparoListagem.innerHTML = ''; preparoFiltroEl.innerHTML = '';
    preparoMsg.innerHTML = '<option value="">Carregando...</option>';
    atualizarVisualizarPreparo();
    host.querySelector('#camp-preparo-campanha').textContent = preparoCampanha.nome;
    preparoEstado.textContent = 'Consultando lista congelada e mensagens...';
    modalPreparo.classList.add('op');
    try {
      var consultas = await Promise.all([cdaCarregarListaCongelada(campanhaId), cdaCarregarMensagens()]);
      if (!modalPreparo.classList.contains('op')) return;
      var congelados = consultas[0] || [], mensagens = consultas[1] || [];
      preparoMensagens = mensagens.filter(function (m) { return String(m.campanhaId) === String(campanhaId); });
      preparoMsg.innerHTML = '<option value="">Selecione a mensagem...</option>' +
        preparoMensagens.map(function (m) { return '<option value="' + escH(m.id) + '">' + escH(m.nome) + '</option>'; }).join('');
      if (preparoMensagens.length) preparoMsg.value = String(preparoMensagens[0].id);
      var vistos = Object.create(null), invalidos = 0, duplicados = 0;
      congelados.forEach(function (d) {
        var e = String(d.email || '').trim().toLowerCase();
        var item = {
          nome: d.nome || '', email: d.email || '', uf: d.uf || '',
          situacao: 'pendente', motivo: 'Autorização de contato não verificada · origem: lista congelada'
        };
        if (!cdaEmailValido(e)) {
          invalidos++;
          item.situacao = 'excluido';
          item.motivo = e ? 'Endereço de e-mail inválido · lista congelada' : 'E-mail não informado · lista congelada';
        } else if (vistos[e]) {
          duplicados++;
          item.situacao = 'excluido';
          item.motivo = 'E-mail duplicado · lista congelada';
        } else {
          vistos[e] = 1;
          preparoElegiveis.push(d);
        }
        preparoClassificados.push(item);
      });
      preparoSelecionada = {
        total: congelados.length, aptos: preparoElegiveis.length,
        invalidos: invalidos, duplicados: duplicados,
        data: congelados.length ? congelados[0].congelado_em : null
      };
      preparoEstado.textContent = congelados.length ? 'Pré-seleção concluída · elegibilidade pendente de comprovação · sem envio.' : 'Esta campanha ainda não possui lista congelada. Clique em Congelar Lista antes de preparar o envio.';
      if (!preparoMensagens.length) preparoEstado.textContent += ' Nenhuma mensagem cadastrada para esta campanha.';
      apresentarPreparo();
      atualizarVisualizarPreparo();
    } catch (err) {
      console.error('Preparar envio:', err);
      preparoEstado.textContent = 'Falha ao consultar os dados: ' + ((err && err.message) || 'erro desconhecido') + '. Nenhum envio foi realizado.';
    }
  }

  async function gerarRoadmapTarefas(campanhaId, btn) {
    var campanha = ST.campanhas.find(function (c) { return String(c.id) === String(campanhaId); });
    if (!campanha) return;
    var leadsCampanha = ST.leads.filter(function (l) { return String(l.campanhaId) === String(campanha.id); });
    if (!leadsCampanha.length) { alert('Essa campanha ainda não tem leads no Pipeline — use "Adicionar público" primeiro.'); return; }
    if (!confirm('Gerar o Roadmap de Tarefas pra ' + leadsCampanha.length + ' lead(s) desta campanha?\n\nCada lead vira 1 tarefa (Data Início/Prevista vêm do período da campanha; Responsável vem do que já estiver escolhido em cada Lead no Pipeline). Quem já tem tarefa desta campanha não duplica.')) return;

    var canalPorId = {}; ST.canais.forEach(function (c) { canalPorId[c.id] = c; });
    var template = campanha.modeloMensagemFinal || campanha.modeloMensagemSugerida || 'Fazer contato com {nome} sobre a campanha "' + campanha.nome + '".';
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

  async function congelarLista(campanhaId, btn) {
    var campanha = ST.campanhas.find(function (c) { return String(c.id) === String(campanhaId); });
    if (!campanha) return;
    var filtrosC = filtrosDaCampanha(campanha);
    if (!filtrosC || !filtrosC.length) { alert('Preencha os filtros da campanha (✎ Editar) antes de congelar a lista.'); return; }
    var alvo = publicoDe(filtrosC);
    if (!alvo.length) { alert('Com os filtros atuais o público está vazio — revise a campanha.'); return; }
    var anterior = ST.listas[String(campanha.id)];
    if (!confirm((anterior ? 'Substituir a lista congelada em ' + fmtDataHora(anterior.congeladoEm) + ' (' + anterior.total + ' clientes)?\n\n' : '') +
      'Congelar agora ' + alvo.length.toLocaleString('pt-BR') + ' cliente(s) (' + emailsUnicos(alvo).toLocaleString('pt-BR') + ' e-mail(s) único(s)) como o público da campanha "' + campanha.nome + '"?')) return;
    var textoOriginal = btn.textContent; btn.textContent = 'Congelando...'; btn.disabled = true;
    try {
      ST.listas[String(campanha.id)] = await cdaCongelarLista(campanha.id, alvo, nomeUsuarioAtual());
      render();
    } catch (err) {
      console.error(err);
      alert('Erro ao congelar a lista:\n' + ((err && (err.message || err.details || err.hint)) || 'Erro desconhecido'));
      btn.textContent = textoOriginal; btn.disabled = false;
    }
  }

  async function adicionarPublico(campanhaId, btn) {
    var campanha = ST.campanhas.find(function (c) { return String(c.id) === String(campanhaId); });
    if (!campanha) return;
    var filtrosC = filtrosDaCampanha(campanha);
    if (!filtrosC) { alert('A segmentação desta campanha não foi encontrada — edite a campanha e escolha o público.'); return; }
    // Com lista congelada, o público é exatamente o da lista; sem ela, o cálculo de agora
    var lista = ST.listas[String(campanha.id)], alvo, origem;
    if (lista) {
      var congelados = await cdaCarregarListaCongelada(campanha.id);
      var ids = {}; congelados.forEach(function (d) { ids[String(d.cliente_id)] = 1; });
      alvo = clientesValidos.filter(function (c) { return ids[String(c.id)]; });
      origem = 'A lista congelada em ' + fmtDataHora(lista.congeladoEm);
    } else {
      alvo = publicoDe(filtrosC);
      origem = 'O público calculado agora (lista ainda não congelada)';
    }
    if (!alvo.length) { alert('O público desta campanha está vazio.'); return; }

    var etapaLabel = CDA_ETAPAS_CAMPANHA.find(function (e) { return e.id === campanha.pipelineEtapaEntrada; }).label;
    if (!confirm(origem + ' tem ' + alvo.length + ' cliente(s).\n\nAdicionar ao Pipeline B2C, na etapa "' + etapaLabel + '", vinculados à campanha "' + campanha.nome + '"?\n\n(quem já foi adicionado antes nesta campanha não duplica)')) return;

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


  var lgpdModelos = [], lgpdModal = host.querySelector('#camp-lgpd-modal');
  var lgpdStatus = host.querySelector('#camp-lgpd-status'), lgpdLista = host.querySelector('#camp-lgpd-lista');
  var lgpdSel = host.querySelector('#camp-m-lgpd-base');
  function lgpdE(v){return escH(String(v == null ? '' : v));}
  function lgpdRender(){
    lgpdLista.innerHTML=lgpdModelos.map(function(x){
      return '<div class="camp-lgpd-card"><b>'+lgpdE(x.nome)+'</b> <span class="tmu">('+lgpdE(x.codigo)+', versão '+Number(x.versao||1)+(x.ativo?'':', inativa')+')</span>'+
      '<p style="white-space:pre-wrap">'+lgpdE(x.fundamentacao)+'</p>'+
      '<button class="btn sm" type="button" data-lgpd-edit="'+x.id+'">Editar</button> '+
      '<button class="btn sm" type="button" data-lgpd-toggle="'+x.id+'">'+(x.ativo?'Desativar':'Reativar')+'</button> '+
      '<button class="btn sm" type="button" data-lgpd-delete="'+x.id+'" title="Excluir definitivamente somente se nenhuma campanha utilizar esta base">Excluir</button></div>';
    }).join('')||'<p>Nenhum modelo cadastrado.</p>';
  }
  async function lgpdCarregar(){
    var v=lgpdSel.value;
    var res=await cdaClient.from('cda_lgpd_fundamentacoes').select('*').order('id');
    if(res.error)throw res.error;
    lgpdModelos=res.data||[];
    lgpdSel.innerHTML='<option value="">Não informada / em análise</option>'+lgpdModelos.filter(function(x){return x.ativo||x.codigo===v;}).map(function(x){return '<option value="'+lgpdE(x.codigo)+'">'+lgpdE(x.nome)+'</option>';}).join('');
    lgpdSel.value=v;lgpdRender();
  }
  function lgpdGerarCodigo(nome){
    var base=String(nome||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
      .replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'').slice(0,68);
    if(!/^[a-z]/.test(base))base='base_'+base;
    if(!base)base='base_legal';
    var cod=base,seq=2;
    while(lgpdModelos.some(function(x){return x.codigo===cod;})){
      cod=base.slice(0,70)+'_'+seq++;
    }
    return cod;
  }
  function lgpdLimpar(){
    host.querySelector('#camp-lgpd-titulo').textContent='Nova fundamentação';
    host.querySelector('#camp-lgpd-id').value='';
    host.querySelector('#camp-lgpd-codigo').value='';

    host.querySelector('#camp-lgpd-nome').value='';
    host.querySelector('#camp-lgpd-texto').value='';
  }
  function lgpdFechar(){lgpdModal.classList.remove('op');}
  host.querySelector('#camp-lgpd-x').addEventListener('click',lgpdFechar);
  host.querySelector('#camp-lgpd-fechar').addEventListener('click',lgpdFechar);
  host.querySelector('#camp-lgpd-novo').addEventListener('click',lgpdLimpar);
  if(editavel)host.querySelector('#camp-btn-lgpd').addEventListener('click',async function(){
    lgpdModal.classList.add('op');lgpdLimpar();lgpdStatus.textContent='Carregando...';
    try{await lgpdCarregar();lgpdStatus.textContent='';}catch(e){lgpdStatus.textContent='Falha: '+e.message;}
  });
  lgpdLista.addEventListener('click',async function(event){
    var b=event.target.closest('button');if(!b)return;
    var id=b.dataset.lgpdEdit||b.dataset.lgpdToggle||b.dataset.lgpdDelete;
    var x=lgpdModelos.find(function(v){return String(v.id)===id;});if(!x)return;
    if(b.dataset.lgpdEdit){
      host.querySelector('#camp-lgpd-titulo').textContent='Editar fundamentação';
      host.querySelector('#camp-lgpd-id').value=x.id;
      host.querySelector('#camp-lgpd-codigo').value=x.codigo;

      host.querySelector('#camp-lgpd-nome').value=x.nome;
      host.querySelector('#camp-lgpd-texto').value=x.fundamentacao;return;
    }
    if(b.dataset.lgpdDelete){
      if(!confirm('Excluir DEFINITIVAMENTE a base "'+x.nome+'"? Esta operação é irreversível e somente será permitida se não houver campanhas vinculadas.'))return;
      b.disabled=true;
      try{
        var uso=await cdaClient.from('cda_campanhas').select('id',{count:'exact',head:true}).eq('lgpd_base_legal',x.codigo);
        if(uso.error)throw uso.error;
        if(uso.count>0)throw new Error('Esta base legal está utilizada em '+uso.count+' campanha(s). Use Desativar.');
        var removido=await cdaClient.from('cda_lgpd_fundamentacoes').delete().eq('id',x.id).select('id');
        if(removido.error)throw removido.error;
        if(!removido.data||!removido.data.length)throw new Error('Exclusão não confirmada. Verifique suas permissões.');
        await lgpdCarregar();lgpdLimpar();lgpdStatus.textContent='Fundamentação excluída definitivamente.';
      }catch(e){lgpdStatus.textContent='Não foi possível excluir: '+e.message;}
      finally{b.disabled=false;}
      return;
    }
    if(!confirm((x.ativo?'Desativar ':'Reativar ')+x.nome+'? As campanhas salvas serão preservadas.'))return;
    b.disabled=true;
    try{
      var res=await cdaClient.from('cda_lgpd_fundamentacoes').update({ativo:!x.ativo,versao:Number(x.versao||1)+1,atualizado_em:new Date().toISOString()}).eq('id',x.id).select().single();
      if(res.error)throw res.error;await lgpdCarregar();lgpdStatus.textContent='Situação atualizada.';
    }catch(e){lgpdStatus.textContent='Falha: '+e.message;}finally{b.disabled=false;}
  });
  host.querySelector('#camp-lgpd-salvar').addEventListener('click',async function(){
    var id=host.querySelector('#camp-lgpd-id').value;
    var nome=host.querySelector('#camp-lgpd-nome').value.trim(),texto=host.querySelector('#camp-lgpd-texto').value.trim();
    if(!nome||!texto){lgpdStatus.textContent='Preencha o nome e a fundamentação.';return;}
    var b=this;b.disabled=true;
    try{
      var dados={nome:nome,fundamentacao:texto,atualizado_em:new Date().toISOString()};
      var res;
      if(id){
        var x=lgpdModelos.find(function(v){return String(v.id)===id;});
        dados.versao=Number(x.versao||1)+1;
        res=await cdaClient.from('cda_lgpd_fundamentacoes').update(dados).eq('id',id).select().single();
      }else{
        dados.codigo=lgpdGerarCodigo(nome);
        res=await cdaClient.from('cda_lgpd_fundamentacoes').insert(dados).select().single();
      }
      if(res.error)throw res.error;lgpdLimpar();await lgpdCarregar();lgpdStatus.textContent='Fundamentação salva.';
    }catch(e){lgpdStatus.textContent='Falha ao salvar: '+e.message;}finally{b.disabled=false;}
  });
  lgpdSel.addEventListener('change',function(){
    var x=lgpdModelos.find(function(v){return v.codigo===lgpdSel.value&&v.ativo;});
    if(x)host.querySelector('#camp-m-lgpd-finalidade').value=x.fundamentacao;
    else if(!lgpdSel.value)host.querySelector('#camp-m-lgpd-finalidade').value='';
  });
  lgpdCarregar().catch(function(e){console.warn('LGPD: modelos indisponíveis',e);});
  var modal = host.querySelector('#camp-modal');
  function popularSelectSegmentos(valorAtual) {
    var sel = host.querySelector('#camp-m-segmento');
    var parametrizadas = ST.segmentos.slice().sort(function (x, y) { return String(x.nome).localeCompare(String(y.nome)); });
    sel.innerHTML = '<option value="">Selecione...</option>' +
      '<optgroup label="Segmentações parametrizadas">' + parametrizadas.map(function (s) {
        return '<option value="' + escH(s.id) + '"' + (s.id === valorAtual ? ' selected' : '') + '>' + escH(s.nome) + ' — ' + escH(cdaResumoTipos(s.filtros)) + '</option>';
      }).join('') + '</optgroup>' +
      '<optgroup label="Modelos comerciais">' + MODELOS.map(function (m) {
        return '<option value="' + escH(m.id) + '"' + (m.id === valorAtual ? ' selected' : '') + '>' + escH(m.nome) + '</option>';
      }).join('') + '</optgroup>';
  }

  // Filtros desta campanha: só os tipos que a segmentação escolhida usa
  var ctxCF = { motor: motor, clientes: clientesValidos, hierarquia: ST.hierarquia, statusCrm: ST.statusCrm, produtos: ST.produtos || [], canais: ST.canais };
  function montarFiltrosDaCampanha(seg, valoresIniciais) {
    if (cfCampanha) { cfCampanha.destruir(); cfCampanha = null; }
    var box = host.querySelector('#camp-m-filtros-box');
    if (!seg) { box.hidden = true; host.querySelector('#camp-m-publico-alvo').innerHTML = ''; return; }
    box.hidden = false;
    var tipos = cdaTiposDaSegmentacao(seg.filtros);
    cfCampanha = cdaConstrutorFiltros(host.querySelector('#camp-m-filtros'), ctxCF, {
      tipos: tipos, rotuloAdicionar: '＋ Adicionar outro filtro desta segmentação', aoMudar: atualizarPublicoAlvoNoModal
    });
    var iniciais = valoresIniciais || (seg.modelo ? seg.filtros : tipos.map(function (t) { return { tipo: t, operador: '>', valor: '' }; }));
    cfCampanha.definir(iniciais);
    atualizarPublicoAlvoNoModal();
  }
  function atualizarPublicoAlvoNoModal() {
    var box = host.querySelector('#camp-m-publico-alvo');
    if (!cfCampanha) { box.innerHTML = ''; return; }
    var alvo = clientesValidos.filter(function (c) { return cfCampanha.passa(c); });
    box.innerHTML = '👥 <b>Público: ' + alvo.length.toLocaleString('pt-BR') + ' cliente(s)</b> · 📧 ' + emailsUnicos(alvo).toLocaleString('pt-BR') + ' e-mail(s) único(s) — recalculado agora';
  }
  host.querySelector('#camp-m-segmento').addEventListener('change', function () {
    montarFiltrosDaCampanha(segmentoPorId[host.querySelector('#camp-m-segmento').value], null);
  });


  // ── Mensagens de e-mail da campanha (Biblioteca de Mensagens · nov/2026) ──
  function renderMensagensDaCampanha() {
    var box = host.querySelector('#camp-m-mensagens');
    if (!ST.editId) { box.innerHTML = '<span class="tmu" style="font-size:11px">Salve a campanha para criar as mensagens de e-mail dela.</span>'; return; }
    var doCamp = ST.mensagens.filter(function (m) { return String(m.campanhaId) === String(ST.editId); });
    box.innerHTML = (doCamp.length ? doCamp.map(function (m) {
      return '<div class="camp-msg-linha"><div><b>' + escH(m.nome) + '</b> · ' + escH(m.assunto || 'sem assunto') +
        '<div class="tmu" style="font-size:10px">De: ' + escH(m.remetenteNome) + ' &lt;' + escH(m.remetenteEmail) + '&gt;' + (m.ultimoTesteEm ? ' · último teste ' + fmtDataHora(m.ultimoTesteEm) : ' · sem teste') + '</div></div>' +
        '<div style="display:flex;gap:5px"><button class="btn sm" type="button" data-msg-editar="' + m.id + '">✏ Editar</button>' +
        (editavel ? '<button class="btn sm rust" type="button" data-msg-teste="' + m.id + '">✉ Enviar teste</button>' : '') + '</div></div>';
    }).join('') : '<span class="tmu" style="font-size:11px">Nenhuma mensagem ainda.</span>') +
      (editavel ? '<div style="margin-top:6px"><button class="btn sm" type="button" id="camp-m-msg-nova">＋ Nova mensagem</button></div>' : '');
  }
  function aoSalvarMensagem(salva) {
    var i = ST.mensagens.findIndex(function (m) { return String(m.id) === String(salva.id); });
    if (i >= 0) ST.mensagens[i] = salva; else ST.mensagens.unshift(salva);
    renderMensagensDaCampanha(); render();
  }
  function abrirEditorMensagem(m) {
    cdaEditorMensagem.abrir({ mensagem: m, campanhaId: ST.editId, campanhas: ST.campanhas, editavel: editavel, onSalvo: aoSalvarMensagem,
      onExcluido: function (id) { ST.mensagens = ST.mensagens.filter(function (x) { return String(x.id) !== String(id); }); renderMensagensDaCampanha(); render(); } });
  }
  host.querySelector('#camp-m-mensagens').addEventListener('click', async function (ev) {
    var b = ev.target.closest('button'); if (!b) return;
    if (b.id === 'camp-m-msg-nova') { abrirEditorMensagem(null); return; }
    var m = ST.mensagens.find(function (x) { return String(x.id) === String(b.dataset.msgEditar || b.dataset.msgTeste); });
    if (!m) return;
    if (b.dataset.msgEditar) { abrirEditorMensagem(m); return; }
    var campanha = ST.campanhas.find(function (c) { return String(c.id) === String(m.campanhaId); });
    var clientes = await cdaMsgClientesDaCampanha(m.campanhaId);
    if (await cdaMsgPerguntarEEnviarTeste(m, campanha, clientes[0], b)) renderMensagensDaCampanha();
  });

  function abrirModal(id, duplicar) {
    var c = id ? ST.campanhas.find(function (x) { return String(x.id) === String(id); }) : null;
    ST.editId = id && !duplicar ? id : null;
    host.querySelector('#camp-modal-title').textContent = !id ? 'Nova Campanha' : (duplicar ? 'Duplicar Campanha' : 'Editar Campanha');
    host.querySelector('#camp-m-nome').value = c ? (duplicar ? 'Cópia de ' + c.nome : c.nome) : '';
    host.querySelector('#camp-m-objetivo').value = c ? (c.objetivo || '') : '';
    host.querySelector('#camp-m-lgpd-base').value = c ? (c.lgpdBaseLegal || '') : '';
    host.querySelector('#camp-m-lgpd-finalidade').value = c ? (c.lgpdFinalidadeFundamentacao || '') : '';
    popularSelectSegmentos(c ? c.publicoSegmentoId : '');
    montarFiltrosDaCampanha(c ? segmentoPorId[c.publicoSegmentoId] : null, c ? JSON.parse(JSON.stringify(filtrosDaCampanha(c) || [])) : null);
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
    var canaisAtivos = c ? (c.canaisSelecionados || []) : [];
    host.querySelectorAll('.camp-canal-check').forEach(function (chk) { chk.checked = canaisAtivos.indexOf(chk.value) !== -1; });
    atualizarSugestaoCanal();
    host.querySelector('#camp-m-excluir').style.display = ST.editId ? 'inline-block' : 'none';
    renderMensagensDaCampanha();
    modal.classList.add('op');
  }
  function fecharModal() { modal.classList.remove('op'); }

  async function salvar() {
    var nome = host.querySelector('#camp-m-nome').value.trim();
    var segmentoId = host.querySelector('#camp-m-segmento').value;
    if (!nome) { alert('Informe o nome da campanha.'); return; }
    if (!segmentoId) { alert('Selecione a segmentação (público) da campanha.'); return; }
    var filtrosValores = cfCampanha ? JSON.parse(JSON.stringify(cfCampanha.filtros())) : [];
    if (!filtrosValores.length) { alert('Preencha ao menos um filtro da campanha.'); return; }
    var o = {
      id: ST.editId || undefined, nome: nome, objetivo: host.querySelector('#camp-m-objetivo').value.trim(),
      lgpdBaseLegal: host.querySelector('#camp-m-lgpd-base').value,
      lgpdFinalidadeFundamentacao: host.querySelector('#camp-m-lgpd-finalidade').value.trim(),
      publicoSegmentoId: segmentoId, filtrosValores: filtrosValores,
      pipelineEtapaEntrada: selEtapa.value, status: selStatus.value,
      periodoInicio: host.querySelector('#camp-m-inicio').value || null, periodoFim: host.querySelector('#camp-m-fim').value || null,
      metaDescricao: host.querySelector('#camp-m-meta-desc').value.trim(), metaNumero: parseFloat(host.querySelector('#camp-m-meta-num').value) || null,
      responsavelIds: Array.from(host.querySelectorAll('.camp-resp-check:checked')).map(function (c) { return Number(c.value); }), criadoPor: nomeUsuarioAtual(),
      beneficioTipo: selBeneficio.value, beneficioValor: parseFloat(host.querySelector('#camp-m-beneficio-valor').value) || null,
      beneficioCupom: host.querySelector('#camp-m-beneficio-cupom').value.trim(), beneficioCondicoes: host.querySelector('#camp-m-beneficio-condicoes').value.trim(),
      publicoConhecido: host.querySelector('#camp-m-conhecido').value || null, publicoTemperatura: host.querySelector('#camp-m-temperatura').value || null,
      canaisSelecionados: Array.from(host.querySelectorAll('.camp-canal-check:checked')).map(function (c) { return c.value; }),
      estrategiaCanal: host.querySelector('#camp-m-estrategia').value.trim(),
      modeloMensagemFinal: host.querySelector('#camp-m-modelo-msg').value.trim(),
      modeloMensagemSugerida: host.querySelector('#camp-m-modelo-sugerida').textContent.indexOf('Nenhuma sugestão') === 0 ? null : host.querySelector('#camp-m-modelo-sugerida').textContent
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

  if (editavel) host.querySelector('#camp-btn-nova').addEventListener('click', function () { abrirModal(null); });
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
  host.querySelector('#camp-m-salvar').addEventListener('click', salvar);
  host.querySelector('#camp-m-excluir').addEventListener('click', excluir);

  render();
}

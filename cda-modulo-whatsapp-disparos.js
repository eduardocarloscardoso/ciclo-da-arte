// ════════════════════════════════════════════════════════════════════
// cda-modulo-whatsapp-disparos.js — Comercial › 💬 WhatsApp › 📣 Disparos de campanha
// Projeto Marketing Meta · Etapa 3 (versão enxuta, preview) · 18/11/2026
//
//  • Modelos de mensagem (templates) da Meta: criar, acompanhar aprovação
//  • Disparo por campanha (Canal Marketing = WhatsApp): preparar público, custo previsto,
//    limite diário (250 contatos/24h), envio por grupo (VIP/Gold/Premium), 1 lote por clique (padrão 25, máx. 50) com confirmação
// Edge Function: whatsapp-campanha-preview
// ════════════════════════════════════════════════════════════════════

var CDA_WA_FN_CAMPANHA = 'whatsapp-campanha-preview';

async function cdaWaCampanha(body) {
  var r = await cdaClient.functions.invoke(CDA_WA_FN_CAMPANHA, { body: body });
  if (r.error) {
    var msg = r.error.message;
    try { var b = await r.error.context.json(); msg = b.error || msg; } catch (_) {}
    throw new Error(msg);
  }
  return r.data;
}

async function montarWhatsAppDisparos(el, opts) {
  opts = opts || {};
  var editavel = opts.editavel !== false;
  var ST = { templates: [], campanhas: [], disparos: [], campanhaId: '', resumos: {} };
  var brl = function (v) { return 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  var esc = cdaWaEsc;
  var corStatus = { APPROVED: 'b-sage', PENDING: 'b-gd', REJECTED: 'b-rust', PAUSED: 'b-rust', DISABLED: 'b-rust', RASCUNHO: 'b-ink' };
  var nomeStatus = { APPROVED: 'Aprovado', PENDING: 'Em análise', REJECTED: 'Reprovado', PAUSED: 'Pausado', DISABLED: 'Desativado', RASCUNHO: 'Rascunho' };

  el.innerHTML =
    '<style>' +
      '.wd-sec{border:2px solid var(--ink);background:var(--card);margin-bottom:16px;}' +
      '.wd-h{background:var(--ink);color:var(--cream);padding:10px 14px;display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;}' +
      '.wd-h b{font-size:12px;text-transform:uppercase;letter-spacing:1px;}' +
      '.wd-b{padding:14px;}' +
      '.wd-tpl{border:1px solid var(--border);padding:10px 12px;margin-bottom:8px;background:var(--paper);}' +
      '.wd-tpl pre{white-space:pre-wrap;font-family:\'DM Sans\',sans-serif;font-size:12px;margin:6px 0 0;}' +
      '.wd-kp{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0;}' +
      '.wd-kp div{border:2px solid var(--ink);padding:6px 10px;font-size:11px;background:var(--card);}' +
      '.wd-kp b{font-family:\'DM Serif Display\',serif;font-size:17px;margin-right:4px;}' +
      '.wd-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:8px;}' +
      '.wd-row select,.wd-row input{font-family:\'Syne\',sans-serif;font-size:11px;padding:6px 8px;border:2px solid var(--ink);background:var(--card);}' +
      '.wd-barra{height:10px;background:#eee;border:1px solid var(--ink);margin:6px 0;}' +
      '.wd-barra span{display:block;height:100%;background:var(--sage);}' +
      '.wd-log{font-family:\'Space Mono\',monospace;font-size:10.5px;background:#111;color:#cfe;padding:8px;max-height:160px;overflow:auto;margin-top:8px;white-space:pre-wrap;}' +
    '</style>' +
    '<div class="wd-sec"><div class="wd-h"><b>1 · Modelos de mensagem (aprovação da Meta)</b><div style="display:flex;gap:6px">' +
      '<button class="btn sm" id="wd-tpl-atualizar" style="color:#fff;border-color:#fff">↻ Atualizar status</button>' +
      (editavel ? '<button class="btn sm rust" id="wd-tpl-novo">＋ Novo modelo</button>' : '') + '</div></div>' +
      '<div class="wd-b"><div id="wd-tpl-info" class="tmu" style="font-size:11px;margin-bottom:8px"></div><div id="wd-tpl-lista" class="tmu" style="font-size:12px">Carregando…</div></div></div>' +
    '<div class="wd-sec"><div class="wd-h"><b>2 · Disparo da campanha</b></div><div class="wd-b">' +
      '<div class="wd-row"><label style="font-size:11px;font-weight:700">Campanha (Canal Marketing WhatsApp)</label><select id="wd-camp"></select></div>' +
      '<div id="wd-disp"></div></div></div>';

  var $ = function (s) { return el.querySelector(s); };

  // ── Modelos ──
  async function carregarTemplates(silencioso) {
    var bt = $('#wd-tpl-atualizar'), info = $('#wd-tpl-info');
    var antes = {};
    ST.templates.forEach(function (t) { antes[t.nome] = t.status; });
    if (bt) { bt.disabled = true; bt.textContent = 'Consultando…'; }
    if (info) info.textContent = 'Consultando a Meta…';
    try {
      var d = await cdaWaCampanha({ acao: 'templates' });
      ST.templates = d.templates || [];
      renderTemplates();
      var mudaram = ST.templates.filter(function (t) { return antes[t.nome] && antes[t.nome] !== t.status; });
      var hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      var msg = 'Consultado às ' + hora + ' · ' + (silencioso ? ST.templates.length + ' modelo(s)' :
        (mudaram.length ? mudaram.map(function (t) { return t.nome + ': ' + (nomeStatus[t.status] || t.status); }).join(' · ') : 'nenhum modelo mudou de status'));
      if (info) info.textContent = msg;
      if (!silencioso) showToast(mudaram.length ? 'Status atualizado: ' + mudaram.length + ' modelo(s) mudaram' : 'Consultado · nenhum modelo mudou de status', mudaram.length ? 'success' : 'info');
    } catch (e) {
      $('#wd-tpl-lista').innerHTML = '<span style="color:var(--rust)">' + esc(e.message) + '</span>';
      if (info) info.textContent = 'Falha na consulta: ' + e.message;
      if (!silencioso) showToast(e.message, 'error');
    } finally {
      if (bt) { bt.disabled = false; bt.textContent = '↻ Atualizar status'; }
    }
  }
  function renderTemplates() {
    if (!ST.templates.length) { $('#wd-tpl-lista').innerHTML = 'Nenhum modelo criado ainda.'; return; }
    $('#wd-tpl-lista').innerHTML = ST.templates.map(function (t) {
      return '<div class="wd-tpl"><div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap">' +
        '<b style="font-size:12.5px">' + esc(t.nome) + '</b><span class="badge ' + (corStatus[t.status] || 'b-ink') + '">' + esc(nomeStatus[t.status] || t.status) + '</span></div>' +
        (t.cabecalho_imagem_url ? '<div class="tmu" style="font-size:11px;margin-top:4px">🖼 com imagem no cabeçalho</div>' : '') +
        '<pre>' + esc(t.corpo) + (t.rodape ? '\n— ' + esc(t.rodape) : '') + (t.botao_texto ? '\n[' + esc(t.botao_texto) + '] → ' + esc(t.botao_url || '') : '') + '</pre>' +
        (t.motivo_rejeicao ? '<div style="color:var(--rust);font-size:11px;margin-top:4px">Motivo: ' + esc(t.motivo_rejeicao) + '</div>' : '') + '</div>';
    }).join('');
    renderDisparos();
  }
  function abrirNovoModelo() {
    var mo = document.createElement('div');
    mo.className = 'mo op';
    var campOpts = ST.campanhas.map(function (c) { return '<option value="' + c.id + '"' + (String(c.id) === String(ST.campanhaId) ? ' selected' : '') + '>' + esc(c.nome) + '</option>'; }).join('');
    mo.innerHTML = '<div class="mo-box" style="max-width:640px"><div class="mo-h"><h3>Novo modelo de mensagem (Meta)</h3><button class="mo-x">✕</button></div>' +
      '<div style="padding:16px 20px" class="fg one">' +
      '<div class="fgr"><label>Nome técnico (minúsculas e _ )</label><input id="wt-nome" placeholder="black_friday_2026_aviso"></div>' +
      '<div class="fgr"><label>Imagem do cabeçalho (URL pública, opcional)</label><input id="wt-img"></div>' +
      '<div class="fgr"><label>Texto — use {{1}} onde entra o primeiro nome do cliente</label><textarea id="wt-corpo" style="min-height:120px"></textarea></div>' +
      '<div class="fg"><div class="fgr"><label>Rodapé (até 60)</label><input id="wt-rod" value="Responda SAIR para não receber mais mensagens."></div>' +
      '<div class="fgr"><label>Campanha</label><select id="wt-camp"><option value="">—</option>' + campOpts + '</select></div></div>' +
      '<div class="fg"><div class="fgr"><label>Texto do botão (até 25)</label><input id="wt-bt" value="Ver ofertas"></div>' +
      '<div class="fgr"><label>Link do botão</label><input id="wt-url" value="https://www.ciclodaarte.com.br/"></div></div>' +
      '<p class="tmu" style="font-size:11px;margin:4px 0 0">Categoria: Marketing · Idioma: Português (BR). Após criar, a Meta analisa o modelo (normalmente de minutos a algumas horas).</p>' +
      '</div><div class="mo-f"><button class="btn" data-x>Cancelar</button><button class="btn rust" id="wt-ok">Enviar para aprovação</button></div></div>';
    el.appendChild(mo);
    // sugere a imagem do flyer da mensagem de e-mail da campanha, se houver
    cdaClient.from('cda_campanha_mensagens').select('conteudo').eq('campanha_id', 6).limit(1).then(function (r) {
      var u = r.data && r.data[0] && r.data[0].conteudo && r.data[0].conteudo.imagemUrl;
      if (u && !mo.querySelector('#wt-img').value) mo.querySelector('#wt-img').value = u;
    });
    var fechar = function () { mo.remove(); };
    mo.querySelector('.mo-x').addEventListener('click', fechar);
    mo.querySelector('[data-x]').addEventListener('click', fechar);
    mo.querySelector('#wt-ok').addEventListener('click', async function () {
      var bt = this; bt.disabled = true; bt.textContent = 'Enviando…';
      try {
        await cdaWaCampanha({ acao: 'template_criar', nome: mo.querySelector('#wt-nome').value, corpo: mo.querySelector('#wt-corpo').value,
          rodape: mo.querySelector('#wt-rod').value, botao_texto: mo.querySelector('#wt-bt').value, botao_url: mo.querySelector('#wt-url').value,
          cabecalho_imagem_url: mo.querySelector('#wt-img').value.trim() || null, campanha_id: Number(mo.querySelector('#wt-camp').value) || null });
        fechar(); showToast('Modelo enviado para aprovação da Meta'); carregarTemplates(true);
      } catch (e) { showToast(e.message, 'error'); bt.disabled = false; bt.textContent = 'Enviar para aprovação'; }
    });
  }

  // ── Disparos ──
  async function carregarCampanhas() {
    var r = await cdaClient.from('cda_campanhas').select('id,nome,status,canais_selecionados').order('id', { ascending: false });
    ST.campanhas = (r.data || []).filter(function (c) { return (c.canais_selecionados || []).indexOf('whatsapp') >= 0; });
    $('#wd-camp').innerHTML = '<option value="">Selecione…</option>' + ST.campanhas.map(function (c) { return '<option value="' + c.id + '">' + esc(c.nome) + '</option>'; }).join('');
    if (!ST.campanhas.length) $('#wd-disp').innerHTML = '<p class="tmu" style="font-size:12px;margin-top:10px">Nenhuma campanha com Canal Marketing WhatsApp. Crie a campanha em Comercial › Campanhas marcando WhatsApp.</p>';
  }
  async function carregarDisparos() {
    if (!ST.campanhaId) { $('#wd-disp').innerHTML = ''; return; }
    var r = await cdaClient.from('cda_whatsapp_disparos').select('*').eq('campanha_id', ST.campanhaId).order('id', { ascending: false });
    ST.disparos = r.data || [];
    for (var i = 0; i < ST.disparos.length; i++) {
      try { ST.resumos[ST.disparos[i].id] = await cdaWaCampanha({ acao: 'resumo', disparo_id: ST.disparos[i].id }); } catch (e) { ST.resumos[ST.disparos[i].id] = { erro: e.message }; }
    }
    renderDisparos();
  }
  function renderDisparos() {
    if (!ST.campanhaId) return;
    var aprovados = ST.templates.filter(function (t) { return t.status === 'APPROVED'; });
    var html = editavel ? '<div class="wd-row" style="margin-top:12px"><b style="font-size:12px">Preparar público:</b>' +
      '<select id="wd-crit"><option value="vip_gold_premium">VIP + Gold + Premium (com celular, sem opt-out)</option>' +
      '<option value="vip_gold_premium_ativos_risco">VIP + Gold + Premium, depois Ativos / Em Risco</option></select>' +
      '<button class="btn sm vio" id="wd-preparar">Preparar fila</button></div>' : '';
    if (!ST.disparos.length) html += '<p class="tmu" style="font-size:12px;margin-top:10px">Nenhuma fila preparada para esta campanha.</p>';
    ST.disparos.forEach(function (d) {
      var r = ST.resumos[d.id] || {};
      if (r.erro) { html += '<p style="color:var(--rust)">' + esc(r.erro) + '</p>'; return; }
      var pe = r.por_estado || {}, tot = r.total || 0, env = (pe.enviada || 0), pct = tot ? Math.round((env + (pe.falha || 0)) / tot * 100) : 0;
      var sm = r.status_mensagens || {};
      html += '<div class="wd-tpl" style="margin-top:12px"><div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px"><b>' + esc(d.nome) + '</b><span class="badge b-ink">' + esc(d.situacao) + '</span></div>' +
        '<div class="tmu" style="font-size:11px">' + esc(d.publico_descricao || '') + ' · grupos: ' + Object.keys(r.grupos || {}).map(function (g) { return g + ' ' + r.grupos[g]; }).join(' · ') + '</div>' +
        '<div class="wd-kp"><div><b>' + tot + '</b>na fila</div><div><b>' + env + '</b>enviadas</div><div><b>' + (pe.pendente || 0) + '</b>pendentes</div><div><b>' + (pe.falha || 0) + '</b>falhas</div>' +
        '<div><b>' + ((sm.entregue || 0) + (sm.lida || 0)) + '</b>entregues</div><div><b>' + (sm.lida || 0) + '</b>lidas</div></div>' +
        '<div class="wd-barra"><span style="width:' + pct + '%"></span></div>' +
        '<div class="wd-kp"><div>Limite de hoje: <b>' + (r.usados_24h || 0) + '/' + (r.limite_dia || 250) + '</b> · livres: <b>' + (r.disponivel_hoje || 0) + '</b></div>' +
        '<div>Custo previsto (pendentes): <b>' + brl(r.custo_previsto) + '</b></div><div>Custo até agora (entregues): <b>' + brl(r.custo_realizado_estimado) + '</b></div></div>' +
        (editavel && (pe.pendente || 0) > 0 ? '<div class="wd-row"><select data-tpl="' + d.id + '"><option value="">Modelo aprovado…</option>' +
          aprovados.map(function (t) { return '<option value="' + t.id + '"' + (d.template_id === t.id ? ' selected' : '') + '>' + esc(t.nome) + '</option>'; }).join('') + '</select>' +
          '<select data-grupo="' + d.id + '" title="Grupo do lote">' + ['VIP', 'Gold', 'Premium'].concat(Object.keys(r.pendentes_por_grupo || {}).filter(function (g) { return ['VIP', 'Gold', 'Premium'].indexOf(g) < 0; }))
            .filter(function (g) { return (r.pendentes_por_grupo || {})[g] > 0; })
            .map(function (g) { return '<option value="' + esc(g) + '">' + esc(g) + ' · ' + r.pendentes_por_grupo[g] + ' pendentes</option>'; }).join('') + '</select>' +
          '<input type="number" min="1" max="50" value="' + Math.max(1, Math.min(25, pe.pendente || 0, r.disponivel_hoje || 0)) + '" data-qtd="' + d.id + '" style="width:70px" title="Quantidade neste lote (máx. 50)">' +
          '<button class="btn sm sage" data-enviar="' + d.id + '"' + (!(r.disponivel_hoje > 0) ? ' disabled style="opacity:.4"' : '') + '>Enviar</button>' +
          (aprovados.length ? '' : '<span class="tmu" style="font-size:11px">Aguardando modelo aprovado pela Meta.</span>') + '</div><div class="wd-log" id="wd-log-' + d.id + '" style="display:none"></div>' : '') +
        '</div>';
    });
    $('#wd-disp').innerHTML = html;
    if ($('#wd-preparar')) $('#wd-preparar').addEventListener('click', preparar);
    el.querySelectorAll('[data-enviar]').forEach(function (b) { b.addEventListener('click', function () { enviar(Number(b.dataset.enviar)); }); });
  }
  async function preparar() {
    var c = ST.campanhas.find(function (x) { return String(x.id) === String(ST.campanhaId); });
    var crit = $('#wd-crit').value;
    if (!confirm('Preparar a fila de envio da campanha "' + (c ? c.nome : '') + '"?\n\nNada é enviado agora — só a lista de destinatários é montada.')) return;
    try {
      var r = await cdaWaCampanha({ acao: 'preparar', campanha_id: Number(ST.campanhaId), criterio: crit, nome: (c ? c.nome : 'Disparo') + ' · ' + new Date().toLocaleDateString('pt-BR') });
      showToast('Fila preparada: ' + r.total + ' contatos'); carregarDisparos();
    } catch (e) { showToast(e.message, 'error'); }
  }
  async function enviar(id) {
    var tpl = Number((el.querySelector('[data-tpl="' + id + '"]') || {}).value);
    var qtd = Number((el.querySelector('[data-qtd="' + id + '"]') || {}).value) || 0;
    var grupo = (el.querySelector('[data-grupo="' + id + '"]') || {}).value || '';
    if (!tpl) { showToast('Escolha um modelo aprovado.', 'info'); return; }
    if (qtd < 1) { showToast('Informe a quantidade do lote.', 'info'); return; }
    if (qtd > 50) { showToast('Máximo de 50 mensagens por lote. Envie em mais de um clique, conferindo o resultado entre eles.', 'info'); return; }
    if (!grupo) { showToast('Escolha o grupo (VIP, Gold ou Premium).', 'info'); return; }
    var r = ST.resumos[id] || {};
    var custo = qtd * Number((ST.disparos.find(function (d) { return d.id === id; }) || {}).tarifa_unitaria || 0.3217);
    var conf = prompt('Enviar ' + qtd + ' mensagens de WhatsApp agora para o grupo ' + grupo + ' (custo estimado ' + brl(custo) + ')?\n\nDigite ENVIAR para confirmar:');
    if (conf !== 'ENVIAR') return;
    var log = $('#wd-log-' + id); log.style.display = 'block'; log.textContent = '';
    el.querySelectorAll('[data-enviar]').forEach(function (b) { b.disabled = true; });
    try {
      // Um lote por clique (máx. 50): confira entregues / falhas / SAIR antes do próximo
      log.textContent += 'Enviando lote de ' + qtd + ' (' + grupo + ')…\n';
      var d = await cdaWaCampanha({ acao: 'enviar', disparo_id: id, template_id: tpl, quantidade: qtd, grupo: grupo, confirmacao: 'ENVIAR' });
      log.textContent += '✓ ' + d.enviadas + ' enviadas, ' + d.falhas + ' falhas · livres hoje: ' + d.disponivel_hoje + '\n';
      showToast('Lote ' + grupo + ': ' + d.enviadas + ' enviadas, ' + d.falhas + ' falhas');
    } catch (e) { log.textContent += '⚠ ' + e.message + '\n'; showToast(e.message, 'error'); }
    carregarDisparos();
  }

  $('#wd-tpl-atualizar').addEventListener('click', function () { carregarTemplates(false); });
  if ($('#wd-tpl-novo')) $('#wd-tpl-novo').addEventListener('click', abrirNovoModelo);
  $('#wd-camp').addEventListener('change', function () { ST.campanhaId = this.value; carregarDisparos(); });

  await carregarCampanhas();
  await carregarTemplates(true);
}

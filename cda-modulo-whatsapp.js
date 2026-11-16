// ════════════════════════════════════════════════════════════════════
// cda-modulo-whatsapp.js — Comercial › 💬 Conversas WhatsApp
// Projeto Marketing Meta · Etapa 2 (preview) · 16/11/2026
//
// Caixa de conversas do WhatsApp (API oficial da Meta) integrada ao CRM:
//   • lista de conversas (busca, situação, não lidas, responsável)
//   • conversa com histórico, mídias, status ✓ ✓✓ e janela de 24h
//   • envio de resposta (texto) — só dentro da janela de 24h
//   • painel do contato: cliente, lead/etapa no Pipeline B2C, responsável, situação,
//     atalhos para Pipeline, Diário Comercial e Tarefas & Follow-up
//
// Banco: cda_whatsapp_numeros / _conversas / _mensagens / _supressoes
// Edge Functions: whatsapp-enviar-preview (enviar_texto, marcar_lida)
//                 whatsapp-midia-preview  (link temporário das mídias)
// Requer cda-dados-compartilhados.js (cdaClient, cdaCarregarEquipe, cdaSalvarLeadB2C,
// cdaSalvarHistoricoInteracao, cdaSalvarTarefa) e do hub: cu, showToast, navigateCRM.
// ════════════════════════════════════════════════════════════════════

var CDA_WA_FN_ENVIAR = 'whatsapp-enviar-preview';
var CDA_WA_FN_MIDIA = 'whatsapp-midia-preview';
var CDA_WA_ETAPAS = { novo_lead: 'Novo Lead', contato: 'Contato', engajado: 'Engajado', compra: 'Compra', fidelizacao: 'Fidelização' };

function cdaWaEsc(t) {
  return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
}
function cdaWaFone(k) {
  var d = String(k || '').replace(/\D/g, '');
  if (d.length === 13 && d.indexOf('55') === 0) return '+55 (' + d.substr(2, 2) + ') ' + d.substr(4, 5) + '-' + d.substr(9);
  if (d.length === 12 && d.indexOf('55') === 0) return '+55 (' + d.substr(2, 2) + ') ' + d.substr(4, 4) + '-' + d.substr(8);
  return d ? '+' + d : '—';
}
function cdaWaHora(iso) {
  if (!iso) return '';
  var d = new Date(iso), hoje = new Date();
  if (d.toDateString() === hoje.toDateString()) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
function cdaWaTexto(t) {
  // escapa, preserva quebras e transforma links em clicáveis
  return cdaWaEsc(t).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>').replace(/\n/g, '<br>');
}

async function montarModuloWhatsApp(containerId, opts) {
  opts = opts || {};
  var editavel = opts.editavel !== false;
  var host = document.getElementById(containerId);
  if (!host) { console.error('cda-modulo-whatsapp: container #' + containerId + ' não encontrado'); return; }

  var ST = { conversas: [], mensagens: [], equipe: [], supressoes: {}, numeros: [], selId: null, midias: {}, timer: null, enviando: false, mobileThread: false };

  host.innerHTML =
    '<style>' +
      '.wa-wrap{overflow:hidden;max-width:100%;display:grid;grid-template-columns:300px minmax(0,1fr) 270px;border:2px solid var(--ink);background:var(--card);height:calc(100vh - 230px);min-height:520px;}' +
      '.wa-col{display:flex;flex-direction:column;min-height:0;}' +
      '.wa-col+.wa-col{border-left:2px solid var(--ink);}' +
      '.wa-hd{padding:10px 12px;border-bottom:2px solid var(--ink);background:var(--paper);display:flex;gap:6px;flex-wrap:wrap;align-items:center;}' +
      '.wa-hd input,.wa-hd select{font-family:\'Syne\',sans-serif;font-size:11px;padding:6px 8px;border:2px solid var(--ink);background:var(--card);outline:none;}' +
      '.wa-hd input[type=text],.wa-hd input:not([type]){flex:1;min-width:120px;}.wa-hd input[type=checkbox]{width:auto;min-width:0;flex:none;}' +
      '.wa-lista{overflow-y:auto;flex:1;}' +
      '.wa-it{padding:10px 12px;border-bottom:1px solid var(--border);cursor:pointer;display:flex;gap:8px;}' +
      '.wa-it:hover{background:var(--cream);}' +
      '.wa-it.sel{background:#efe8f7;border-left:4px solid var(--violet);padding-left:8px;}' +
      '.wa-av{width:34px;height:34px;border-radius:50%;background:var(--sage);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;flex-shrink:0;}' +
      '.wa-av.ni{background:#9a9286;}' +
      '.wa-it-c{flex:1;min-width:0;}' +
      '.wa-it-t{display:flex;justify-content:space-between;gap:6px;}' +
      '.wa-it-n{font-weight:700;font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}' +
      '.wa-it-h{font-family:\'Space Mono\',monospace;font-size:9.5px;color:var(--muted);white-space:nowrap;}' +
      '.wa-it-p{font-size:11.5px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px;}' +
      '.wa-it-b{display:flex;gap:4px;margin-top:4px;align-items:center;flex-wrap:wrap;}' +
      '.wa-nl{background:var(--sage);color:#fff;border-radius:999px;font-size:10px;font-weight:700;padding:1px 7px;margin-left:auto;}' +
      '.wa-th{flex:1;overflow-y:auto;padding:16px;background:#efe9dd;}' +
      '.wa-dia{text-align:center;margin:10px 0;}' +
      '.wa-dia span{background:#fff;border:1px solid var(--border);font-size:10px;padding:3px 10px;border-radius:999px;color:var(--muted);}' +
      '.wa-b{max-width:72%;padding:8px 11px 5px;margin:4px 0;border-radius:10px;font-size:13px;line-height:1.4;box-shadow:0 1px 1px rgba(0,0,0,.08);word-wrap:break-word;}' +
      '.wa-b.in{background:#fff;margin-right:auto;border-top-left-radius:2px;}' +
      '.wa-b.out{background:#dcf3d0;margin-left:auto;border-top-right-radius:2px;}' +
      '.wa-b.falha{background:#fde8e3;}' +
      '.wa-b-m{font-size:9.5px;color:var(--muted);text-align:right;margin-top:3px;font-family:\'Space Mono\',monospace;}' +
      '.wa-b-m .lida{color:#2a8bf2;font-weight:700;}' +
      '.wa-b img{max-width:100%;max-height:260px;display:block;border-radius:6px;margin-bottom:4px;cursor:pointer;}' +
      '.wa-b audio,.wa-b video{max-width:100%;display:block;margin-bottom:4px;}' +
      '.wa-midia-bt{font-size:11px;border:1px dashed var(--ink);padding:6px 8px;background:transparent;cursor:pointer;margin-bottom:4px;}' +
      '.wa-janela{padding:7px 12px;font-size:11px;border-top:2px solid var(--ink);display:flex;gap:8px;align-items:center;}' +
      '.wa-janela.ab{background:#e3f0e8;color:var(--sage);}' +
      '.wa-janela.fe{background:#fdf3dc;color:#8a6510;}' +
      '.wa-janela.op{background:#fde8e3;color:var(--rust);}' +
      '.wa-comp{display:flex;gap:8px;padding:10px;border-top:2px solid var(--ink);background:var(--paper);}' +
      '.wa-comp textarea{flex:1;resize:none;height:62px;font-family:\'DM Sans\',sans-serif;font-size:13px;padding:8px 10px;border:2px solid var(--ink);outline:none;}' +
      '.wa-comp textarea:focus{border-color:var(--rust);}' +
      '.wa-comp textarea:disabled{background:#eee;color:#888;}' +
      '.wa-vazio{flex:1;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:13px;text-align:center;padding:30px;}' +
      '.wa-inf{overflow-y:auto;flex:1;padding:14px;}' +
      '.wa-inf h4{font-size:9px;text-transform:uppercase;letter-spacing:1px;color:var(--muted);margin:14px 0 6px;}' +
      '.wa-inf h4:first-child{margin-top:0;}' +
      '.wa-inf .v{font-size:13px;font-weight:700;}' +
      '.wa-inf .s{font-size:11px;color:var(--muted);margin-top:2px;}' +
      '.wa-inf select{width:100%;font-family:\'Syne\',sans-serif;font-size:11px;padding:6px 8px;border:2px solid var(--ink);background:var(--card);}' +
      '.wa-inf .btn{width:100%;margin-top:6px;text-align:left;}' +
      '.wa-voltar{display:none;}' +
      '.wa-kp{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px;}' +
      '.wa-kp div{border:2px solid var(--ink);background:var(--card);padding:6px 12px;font-size:11px;}' +
      '.wa-kp b{font-family:\'DM Serif Display\',serif;font-size:18px;margin-right:4px;}' +
      '@media(max-width:1100px){.wa-wrap{grid-template-columns:280px minmax(0,1fr);}.wa-col.inf{display:none;}.wa-wrap.com-inf .wa-col.inf{display:flex;position:fixed;right:0;top:0;bottom:0;width:300px;z-index:150;background:var(--card);border-left:2px solid var(--ink);}}' +
      '@media(max-width:700px){.wa-kp div{padding:4px 8px;font-size:10px;}.wa-kp b{font-size:14px;}.wa-wrap{grid-template-columns:1fr;height:calc(100vh - 170px);}.wa-wrap.thread .wa-col.lista{display:none;}.wa-wrap:not(.thread) .wa-col.conv{display:none;}.wa-col+.wa-col{border-left:none;}.wa-voltar{display:inline-block;}.wa-b{max-width:88%;}}' +
    '</style>' +
    '<div class="row-bt"><div><div class="sec-t">💬 Conversas WhatsApp</div>' +
    '<div class="sec-d">Atendimento pelo WhatsApp oficial, ligado a Clientes, Pipeline B2C, Diário e Tarefas · <span id="wa-num" class="mn"></span></div></div>' +
    '<div style="display:flex;gap:7px"><button class="btn sm" id="wa-atualizar">↻ Atualizar</button></div></div>' +
    '<div class="wa-kp" id="wa-kp"></div>' +
    '<div class="wa-wrap" id="wa-wrap">' +
      '<div class="wa-col lista">' +
        '<div class="wa-hd"><input id="wa-f-busca" placeholder="🔎 Nome ou número..."></div>' +
        '<div class="wa-hd" style="border-top:none">' +
          '<select id="wa-f-sit"><option value="ativas">Abertas e pendentes</option><option value="aberta">Abertas</option><option value="pendente">Pendentes</option><option value="encerrada">Encerradas</option><option value="">Todas</option></select>' +
          '<select id="wa-f-resp"><option value="">Todos responsáveis</option><option value="eu">Minhas</option><option value="sem">Sem responsável</option></select>' +
          '<label style="font-size:11px;display:flex;align-items:center;gap:4px"><input type="checkbox" id="wa-f-nl"> Não lidas</label>' +
        '</div>' +
        '<div class="wa-lista" id="wa-lista"></div>' +
      '</div>' +
      '<div class="wa-col conv" id="wa-conv"><div class="wa-vazio">Selecione uma conversa à esquerda.</div></div>' +
      '<div class="wa-col inf" id="wa-inf"><div class="wa-vazio" style="font-size:12px">Dados do contato aparecem aqui.</div></div>' +
    '</div>';

  var $ = function (s) { return host.querySelector(s); };

  // ── Carga de dados ─────────────────────────────────────────────────
  async function carregarConversas() {
    var r = await cdaClient.from('cda_whatsapp_conversas')
      .select('*, cliente:clientes(id,nome,email,cidade,estado), lead:leads_b2c(id,nome,etapa,responsavel_id,campanha_id), numero:cda_whatsapp_numeros(phone_number_id,funcao,numero_exibicao,nome_exibicao)')
      .order('ultima_mensagem_em', { ascending: false, nullsFirst: false }).limit(500);
    if (r.error) throw r.error;
    ST.conversas = r.data || [];
    var s = await cdaClient.from('cda_whatsapp_supressoes').select('telefone');
    ST.supressoes = {}; (s.data || []).forEach(function (x) { ST.supressoes[x.telefone] = true; });
  }
  async function carregarMensagens(convId) {
    var r = await cdaClient.from('cda_whatsapp_mensagens').select('id,direcao,tipo,texto,midia,status,erro,enviado_por,ocorrido_em')
      .eq('conversa_id', convId).order('ocorrido_em', { ascending: true }).limit(1000);
    if (r.error) throw r.error;
    ST.mensagens = r.data || [];
  }
  async function carregarBase() {
    var res = await Promise.all([
      cdaCarregarEquipe(),
      cdaClient.from('cda_whatsapp_numeros').select('phone_number_id,funcao,numero_exibicao,nome_exibicao,ativo')
    ]);
    ST.equipe = res[0] || [];
    ST.numeros = (res[1] && res[1].data) || [];
    var n = ST.numeros.filter(function (x) { return x.ativo; });
    $('#wa-num').textContent = n.length ? n.map(function (x) { return (x.funcao === 'teste' ? '🧪 número de teste' : (x.funcao === 'campanhas' ? '📣 Campanhas' : '🎧 SAC')) + (x.numero_exibicao ? ' ' + x.numero_exibicao : ''); }).join(' · ') : 'nenhum número conectado';
    $('#wa-f-resp').innerHTML = '<option value="">Todos responsáveis</option><option value="eu">Minhas</option><option value="sem">Sem responsável</option>' +
      ST.equipe.map(function (e) { return '<option value="' + e.id + '">' + cdaWaEsc(e.nome) + '</option>'; }).join('');
  }
  function nomeEquipe(id) { var e = ST.equipe.find(function (x) { return x.id === id; }); return e ? e.nome : null; }
  function convSel() { return ST.conversas.find(function (c) { return c.id === ST.selId; }) || null; }
  function nomeConv(c) { return (c.cliente && c.cliente.nome) || (c.lead && c.lead.nome) || c.contato_nome || cdaWaFone(c.contato_wa); }
  function janelaAberta(c) { return c && c.janela_expira_em && new Date(c.janela_expira_em).getTime() > Date.now(); }

  // ── Lista ──────────────────────────────────────────────────────────
  function renderKpis() {
    var ab = ST.conversas.filter(function (c) { return c.situacao !== 'encerrada'; }).length;
    var nl = ST.conversas.reduce(function (s, c) { return s + (c.nao_lidas || 0); }, 0);
    var ja = ST.conversas.filter(janelaAberta).length;
    var ni = ST.conversas.filter(function (c) { return c.identificacao === 'nao_identificado'; }).length;
    $('#wa-kp').innerHTML = '<div><b>' + ab + '</b>em atendimento</div><div><b>' + nl + '</b>não lidas</div><div><b>' + ja + '</b>janelas de 24h abertas</div><div><b>' + ni + '</b>contatos não identificados</div>';
  }
  function renderLista() {
    renderKpis();
    var q = cdaSemAcento($('#wa-f-busca').value || ''), qd = ($('#wa-f-busca').value || '').replace(/\D/g, '');
    var sit = $('#wa-f-sit').value, resp = $('#wa-f-resp').value, soNl = $('#wa-f-nl').checked;
    var lista = ST.conversas.filter(function (c) {
      if (sit === 'ativas' && c.situacao === 'encerrada') return false;
      if (sit && sit !== 'ativas' && c.situacao !== sit) return false;
      if (resp === 'eu' && !(cu && c.responsavel_id === cu.id)) return false;
      if (resp === 'sem' && c.responsavel_id) return false;
      if (resp && resp !== 'eu' && resp !== 'sem' && String(c.responsavel_id) !== resp) return false;
      if (soNl && !c.nao_lidas) return false;
      if (q && cdaSemAcento(nomeConv(c)).indexOf(q) < 0 && !(qd && String(c.contato_wa).indexOf(qd) >= 0)) return false;
      return true;
    });
    if (!lista.length) { $('#wa-lista').innerHTML = '<div class="wa-vazio" style="font-size:12px">Nenhuma conversa neste filtro.</div>'; return; }
    $('#wa-lista').innerHTML = lista.map(function (c) {
      var nome = nomeConv(c);
      var ini = nome.replace(/[^A-Za-zÀ-ú ]/g, '').trim().split(/\s+/).slice(0, 2).map(function (p) { return p[0]; }).join('').toUpperCase() || '#';
      var badge = c.identificacao === 'cliente' ? '<span class="badge b-sage">Cliente</span>' : (c.identificacao === 'lead' ? '<span class="badge b-vio">Lead</span>' : '<span class="badge b-gd">Não identificado</span>');
      var etapa = c.lead && c.lead.etapa ? '<span class="badge b-ink">' + cdaWaEsc(CDA_WA_ETAPAS[c.lead.etapa] || c.lead.etapa) + '</span>' : '';
      var sit = c.situacao === 'pendente' ? '<span class="badge b-rust">Pendente</span>' : (c.situacao === 'encerrada' ? '<span class="badge" style="background:#eee;color:#777">Encerrada</span>' : '');
      var opt = ST.supressoes[c.contato_wa] ? '<span class="badge b-rust">Opt-out</span>' : '';
      return '<div class="wa-it' + (c.id === ST.selId ? ' sel' : '') + '" data-id="' + c.id + '">' +
        '<div class="wa-av' + (c.identificacao === 'nao_identificado' ? ' ni' : '') + '">' + cdaWaEsc(ini) + '</div>' +
        '<div class="wa-it-c"><div class="wa-it-t"><div class="wa-it-n">' + cdaWaEsc(nome) + '</div><div class="wa-it-h">' + cdaWaHora(c.ultima_mensagem_em) + '</div></div>' +
        '<div class="wa-it-p">' + cdaWaEsc(c.ultima_mensagem_previa || '') + '</div>' +
        '<div class="wa-it-b">' + badge + etapa + sit + opt + (c.nao_lidas ? '<span class="wa-nl">' + c.nao_lidas + '</span>' : '') + '</div></div></div>';
    }).join('');
    host.querySelectorAll('.wa-it').forEach(function (el) { el.addEventListener('click', function () { abrirConversa(Number(el.dataset.id)); }); });
  }

  // ── Conversa ───────────────────────────────────────────────────────
  async function abrirConversa(id) {
    ST.selId = id; ST.mensagens = [];
    $('#wa-wrap').classList.add('thread');
    renderLista();
    $('#wa-conv').innerHTML = '<div class="wa-vazio">Carregando…</div>';
    try { await carregarMensagens(id); } catch (e) { $('#wa-conv').innerHTML = '<div class="wa-vazio">Erro ao carregar: ' + cdaWaEsc(e.message || e) + '</div>'; return; }
    renderConversa(true); renderInfo();
    var c = convSel();
    if (c && c.nao_lidas > 0) {
      c.nao_lidas = 0; renderLista();
      cdaClient.functions.invoke(CDA_WA_FN_ENVIAR, { body: { acao: 'marcar_lida', conversa_id: id } }).catch(function () {});
    }
  }

  function bolhaMidia(m) {
    var md = m.midia || {};
    if (!md.media_id && !md.storage_path) {
      if (md.tipo === 'location' && md.lat != null) return '<a href="https://maps.google.com/?q=' + md.lat + ',' + md.lng + '" target="_blank" rel="noopener">📍 Abrir no mapa</a><br>';
      return '';
    }
    var u = ST.midias[m.id];
    if (!u) return '<button class="wa-midia-bt" data-midia="' + m.id + '">' + ({ image: '🖼 Carregar foto', audio: '🎧 Carregar áudio', video: '🎬 Carregar vídeo', document: '📄 Abrir documento', sticker: '🌟 Carregar figurinha' }[md.tipo] || '📎 Carregar mídia') + '</button><br>';
    if (u.erro) return '<div style="font-size:11px;color:var(--rust)">⚠ ' + cdaWaEsc(u.erro) + '</div>';
    var mime = u.mime || '';
    if (mime.indexOf('image/') === 0) return '<img src="' + u.url + '" alt="" data-full="' + u.url + '">';
    if (mime.indexOf('audio/') === 0) return '<audio controls preload="none" src="' + u.url + '"></audio>';
    if (mime.indexOf('video/') === 0) return '<video controls preload="none" src="' + u.url + '"></video>';
    return '<a href="' + u.url + '" target="_blank" rel="noopener">📄 ' + cdaWaEsc(u.nome || md.nome || 'Abrir arquivo') + '</a><br>';
  }
  function statusIcone(m) {
    if (m.direcao !== 'saida') return '';
    return { pendente: '⏱', enviada: '✓', entregue: '✓✓', lida: '<span class="lida">✓✓</span>', falha: '⚠' }[m.status] || '';
  }

  function renderConversa(rolar) {
    var c = convSel();
    if (!c) { $('#wa-conv').innerHTML = '<div class="wa-vazio">Selecione uma conversa à esquerda.</div>'; return; }
    var th = $('#wa-th'), estavaNoFim = th ? (th.scrollHeight - th.scrollTop - th.clientHeight < 60) : true;
    var dias = '', html = '';
    ST.mensagens.forEach(function (m) {
      var d = new Date(m.ocorrido_em).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
      if (d !== dias) { html += '<div class="wa-dia"><span>' + d + '</span></div>'; dias = d; }
      var quem = m.direcao === 'saida' && m.enviado_por ? (nomeEquipe(m.enviado_por) || '') : '';
      var erro = m.status === 'falha' && m.erro ? '<div style="font-size:11px;color:var(--rust);margin-top:3px">⚠ Não enviada: ' + cdaWaEsc((m.erro && (m.erro.mensagem || (m.erro[0] && m.erro[0].title))) || 'erro da Meta') + '</div>' : '';
      html += '<div class="wa-b ' + (m.direcao === 'saida' ? 'out' : 'in') + (m.status === 'falha' ? ' falha' : '') + '">' +
        bolhaMidia(m) + (m.texto ? cdaWaTexto(m.texto) : '') + erro +
        '<div class="wa-b-m">' + (quem ? cdaWaEsc(quem.split(' ')[0]) + ' · ' : '') + new Date(m.ocorrido_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) + ' ' + statusIcone(m) + '</div></div>';
    });

    var optout = !!ST.supressoes[c.contato_wa], aberta = janelaAberta(c);
    var jan;
    if (optout) jan = '<div class="wa-janela op">⛔ Este contato pediu para não receber mensagens (opt-out). Envio bloqueado.</div>';
    else if (aberta) {
      var min = Math.max(0, Math.round((new Date(c.janela_expira_em).getTime() - Date.now()) / 60000));
      jan = '<div class="wa-janela ab">🟢 Janela de 24h aberta · fecha em ' + Math.floor(min / 60) + 'h' + String(min % 60).padStart(2, '0') + ' (' + cdaWaHora(c.janela_expira_em) + ') — respostas livres permitidas</div>';
    } else jan = '<div class="wa-janela fe">🟡 Janela de 24h fechada — só é possível enviar modelo aprovado pela Meta (Etapa 3 · Campanhas). Aguarde o cliente escrever.</div>';
    var podeEnviar = editavel && aberta && !optout;

    $('#wa-conv').innerHTML =
      '<div class="wa-hd" style="justify-content:space-between">' +
        '<div style="display:flex;gap:8px;align-items:center;min-width:0"><button class="btn sm wa-voltar" id="wa-voltar">←</button>' +
        '<div style="min-width:0"><div style="font-weight:700;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + cdaWaEsc(nomeConv(c)) + '</div>' +
        '<div class="mn tmu">' + cdaWaFone(c.contato_wa) + (c.contato_nome && c.cliente ? ' · WhatsApp: ' + cdaWaEsc(c.contato_nome) : '') + '</div></div></div>' +
        '<button class="btn sm" id="wa-ver-inf">ℹ Contato</button>' +
      '</div>' +
      '<div class="wa-th" id="wa-th">' + (html || '<div class="wa-vazio">Sem mensagens.</div>') + '</div>' + jan +
      '<div class="wa-comp"><textarea id="wa-txt" placeholder="' + (podeEnviar ? 'Escreva a resposta… (Ctrl+Enter envia)' : (editavel ? 'Envio indisponível nesta conversa' : 'Somente leitura')) + '"' + (podeEnviar ? '' : ' disabled') + '></textarea>' +
      '<button class="btn sage" id="wa-enviar"' + (podeEnviar ? '' : ' disabled style="opacity:.4;cursor:not-allowed"') + '>Enviar ➤</button></div>';

    var novoTh = $('#wa-th');
    if (rolar || estavaNoFim) novoTh.scrollTop = novoTh.scrollHeight;
    $('#wa-voltar').addEventListener('click', function () { $('#wa-wrap').classList.remove('thread'); });
    $('#wa-ver-inf').addEventListener('click', function () { $('#wa-wrap').classList.toggle('com-inf'); });
    host.querySelectorAll('[data-midia]').forEach(function (b) { b.addEventListener('click', function () { carregarMidia(Number(b.dataset.midia)); }); });
    host.querySelectorAll('.wa-b img[data-full]').forEach(function (im) { im.addEventListener('click', function () { window.open(im.dataset.full, '_blank'); }); });
    if (podeEnviar) {
      $('#wa-enviar').addEventListener('click', enviar);
      $('#wa-txt').addEventListener('keydown', function (e) { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); enviar(); } });
    }
    // fotos, figurinhas e áudios carregam sozinhos (as 30 mais recentes); vídeos e documentos sob demanda
    ST.mensagens.slice(-30).forEach(function (m) {
      var t = m.midia && m.midia.tipo;
      if ((t === 'image' || t === 'sticker' || t === 'audio') && !ST.midias[m.id]) carregarMidia(m.id, true);
    });
  }

  async function carregarMidia(id, silencioso) {
    if (ST.midias[id] && !ST.midias[id].erro) return;
    ST.midias[id] = { carregando: true, url: '' };
    try {
      var r = await cdaClient.functions.invoke(CDA_WA_FN_MIDIA, { body: { mensagem_id: id } });
      if (r.error) {
        var msg = r.error.message;
        try { var b = await r.error.context.json(); msg = b.error || msg; } catch (_) {}
        throw new Error(msg);
      }
      ST.midias[id] = r.data;
      var m = ST.mensagens.find(function (x) { return x.id === id; });
      if (m && m.midia && r.data && r.data.mime && m.midia.tipo === 'document') window.open(r.data.url, '_blank');
    } catch (e) {
      ST.midias[id] = { erro: String(e.message || e) };
      if (!silencioso) showToast('Mídia: ' + (e.message || e), 'error');
    }
    renderConversa(false);
  }

  async function enviar() {
    if (ST.enviando) return;
    var c = convSel(), txt = ($('#wa-txt').value || '').trim();
    if (!c || !txt) return;
    ST.enviando = true;
    var bt = $('#wa-enviar'); bt.disabled = true; bt.textContent = 'Enviando…';
    try {
      var r = await cdaClient.functions.invoke(CDA_WA_FN_ENVIAR, { body: { acao: 'enviar_texto', conversa_id: c.id, texto: txt } });
      if (r.error) {
        var msg = r.error.message;
        try { var b = await r.error.context.json(); msg = b.error || msg; } catch (_) {}
        throw new Error(msg);
      }
      $('#wa-txt').value = '';
      await carregarMensagens(c.id); await carregarConversas();
      renderLista(); renderConversa(true); renderInfo();
    } catch (e) {
      showToast('Não enviada: ' + (e.message || e), 'error');
      await carregarMensagens(c.id).catch(function () {}); renderConversa(true);
    } finally { ST.enviando = false; }
  }

  // ── Painel do contato ─────────────────────────────────────────────
  function renderInfo() {
    var c = convSel();
    if (!c) { $('#wa-inf').innerHTML = '<div class="wa-vazio" style="font-size:12px">Dados do contato aparecem aqui.</div>'; return; }
    var lead = c.lead, cli = c.cliente;
    var h = '<div class="wa-inf">' +
      '<button class="btn sm" id="wa-inf-x" style="width:auto;margin:0 0 10px;display:none">✕ Fechar</button>' +
      '<h4>Contato</h4><div class="v">' + cdaWaEsc(nomeConv(c)) + '</div><div class="s mn">' + cdaWaFone(c.contato_wa) + '</div>' +
      (c.contato_nome ? '<div class="s">Nome no WhatsApp: ' + cdaWaEsc(c.contato_nome) + '</div>' : '') +
      (ST.supressoes[c.contato_wa] ? '<div class="s" style="color:var(--rust);font-weight:700">⛔ Opt-out (não recebe mensagens)</div>' : '') +
      '<h4>Cliente</h4>' + (cli ? '<div class="v">' + cdaWaEsc(cli.nome) + '</div><div class="s">' + cdaWaEsc([cli.cidade, cli.estado].filter(Boolean).join(' / ')) + (cli.email ? '<br>' + cdaWaEsc(cli.email) : '') + '</div>' : '<div class="s">Número não encontrado no cadastro de clientes.</div>') +
      '<h4>Pipeline B2C</h4>' + (lead ? '<div class="v">' + cdaWaEsc(CDA_WA_ETAPAS[lead.etapa] || lead.etapa || '—') + '</div><div class="s">Lead: ' + cdaWaEsc(lead.nome || '') + '</div>' +
        '<button class="btn sm" id="wa-abrir-lead">📊 Abrir no Pipeline</button>' :
        '<div class="s">Sem lead no Pipeline.</div>' + (editavel ? '<button class="btn sm vio" id="wa-criar-lead">＋ Criar lead (Novo Lead)</button>' : '')) +
      '<h4>Responsável</h4><select id="wa-resp"' + (editavel ? '' : ' disabled') + '><option value="">— sem responsável —</option>' +
        ST.equipe.map(function (e) { return '<option value="' + e.id + '"' + (c.responsavel_id === e.id ? ' selected' : '') + '>' + cdaWaEsc(e.nome) + '</option>'; }).join('') + '</select>' +
      '<h4>Situação</h4><select id="wa-sit"' + (editavel ? '' : ' disabled') + '>' +
        [['aberta', 'Aberta'], ['pendente', 'Pendente (aguardando ação)'], ['encerrada', 'Encerrada']].map(function (o) { return '<option value="' + o[0] + '"' + (c.situacao === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>' +
      (editavel ? '<h4>Ações</h4><button class="btn sm" id="wa-diario">📔 Registrar no Diário Comercial</button><button class="btn sm" id="wa-tarefa">✅ Criar tarefa de follow-up</button>' : '') +
      '</div>';
    $('#wa-inf').innerHTML = h;
    if (window.matchMedia('(max-width:1100px)').matches) { var x = $('#wa-inf-x'); x.style.display = 'inline-block'; x.addEventListener('click', function () { $('#wa-wrap').classList.remove('com-inf'); }); }
    if ($('#wa-abrir-lead')) $('#wa-abrir-lead').addEventListener('click', function () { window._cdaAbrirLeadPendente = lead.id; navigateCRM('pipelineb2c'); });
    if ($('#wa-criar-lead')) $('#wa-criar-lead').addEventListener('click', criarLead);
    if ($('#wa-resp')) $('#wa-resp').addEventListener('change', function () { atualizarConversa({ responsavel_id: this.value ? Number(this.value) : null }); });
    if ($('#wa-sit')) $('#wa-sit').addEventListener('change', function () { atualizarConversa({ situacao: this.value }); });
    if ($('#wa-diario')) $('#wa-diario').addEventListener('click', registrarDiario);
    if ($('#wa-tarefa')) $('#wa-tarefa').addEventListener('click', abrirTarefa);
  }

  async function atualizarConversa(campos) {
    var c = convSel(); if (!c) return;
    campos.atualizado_em = new Date().toISOString();
    var r = await cdaClient.from('cda_whatsapp_conversas').update(campos).eq('id', c.id);
    if (r.error) { showToast('Erro ao salvar: ' + r.error.message, 'error'); return; }
    Object.assign(c, campos); renderLista(); showToast('Conversa atualizada');
  }

  async function criarLead() {
    var c = convSel(); if (!c) return;
    if (!confirm('Criar um lead em "Novo Lead" no Pipeline B2C para ' + nomeConv(c) + '?')) return;
    try {
      var lead = await cdaSalvarLeadB2C({
        nome: nomeConv(c), telefone: cdaWaFone(c.contato_wa), email: c.cliente ? c.cliente.email : null,
        clienteId: c.cliente_id || null, etapa: 'novo_lead', campanhaId: c.campanha_id || null,
        responsavelId: c.responsavel_id || (cu ? cu.id : null), obs: 'Criado a partir de conversa no WhatsApp'
      });
      var upd = { lead_id: lead.id }; if (c.identificacao === 'nao_identificado') upd.identificacao = 'lead';
      var r = await cdaClient.from('cda_whatsapp_conversas').update(upd).eq('id', c.id);
      if (r.error) throw r.error;
      await cdaSalvarHistoricoInteracao({ leadId: lead.id, clienteId: c.cliente_id || null, etapaNova: 'novo_lead', tipoInteracao: 'whatsapp', observacao: 'Lead criado a partir de conversa no WhatsApp', criadoPor: cu ? cu.name : null, responsavelId: cu ? cu.id : null, origemEvento: 'whatsapp' }).catch(function () {});
      showToast('Lead criado no Pipeline B2C');
      await carregarConversas(); renderLista(); renderInfo();
    } catch (e) { showToast('Erro ao criar lead: ' + (e.message || e), 'error'); }
  }

  async function registrarDiario() {
    var c = convSel(); if (!c) return;
    if (!c.lead_id) { showToast('Crie o lead no Pipeline antes de registrar no Diário.', 'info'); return; }
    var obs = prompt('Resumo da conversa para o Diário Comercial:', '');
    if (obs == null || !obs.trim()) return;
    try {
      await cdaSalvarHistoricoInteracao({ leadId: c.lead_id, clienteId: c.cliente_id || null, tipoInteracao: 'whatsapp', observacao: obs.trim(), criadoPor: cu ? cu.name : null, responsavelId: cu ? cu.id : null, campanhaId: c.campanha_id || null, origemEvento: 'whatsapp' });
      showToast('Registrado no Diário Comercial');
    } catch (e) { showToast('Erro ao registrar: ' + (e.message || e), 'error'); }
  }

  function abrirTarefa() {
    var c = convSel(); if (!c) return;
    var amanha = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    var mo = document.createElement('div');
    mo.className = 'mo op';
    mo.innerHTML = '<div class="mo-box"><div class="mo-h"><h3>✅ Nova tarefa de follow-up</h3><button class="mo-x">✕</button></div>' +
      '<div style="padding:18px 22px" class="fg one">' +
      '<div class="fgr"><label>Descrição</label><textarea id="wa-t-desc">Retornar contato no WhatsApp — ' + cdaWaEsc(nomeConv(c)) + '</textarea></div>' +
      '<div class="fg"><div class="fgr"><label>Data prevista</label><input type="date" id="wa-t-data" value="' + amanha + '"></div>' +
      '<div class="fgr"><label>Prioridade</label><select id="wa-t-pri"><option value="media">Média</option><option value="alta">Alta</option><option value="baixa">Baixa</option></select></div></div>' +
      '<div class="fgr"><label>Responsável</label><select id="wa-t-resp">' + ST.equipe.map(function (e) { return '<option value="' + e.id + '"' + ((c.responsavel_id || (cu && cu.id)) === e.id ? ' selected' : '') + '>' + cdaWaEsc(e.nome) + '</option>'; }).join('') + '</select></div>' +
      '</div><div class="mo-f"><button class="btn" data-x>Cancelar</button><button class="btn rust" id="wa-t-ok">Criar tarefa</button></div></div>';
    host.querySelector('.crm-embed') ? host.querySelector('.crm-embed').appendChild(mo) : host.appendChild(mo);
    var fechar = function () { mo.remove(); };
    mo.querySelector('.mo-x').addEventListener('click', fechar);
    mo.querySelector('[data-x]').addEventListener('click', fechar);
    mo.querySelector('#wa-t-ok').addEventListener('click', async function () {
      var desc = mo.querySelector('#wa-t-desc').value.trim();
      if (!desc) { showToast('Descreva a tarefa.', 'info'); return; }
      try {
        await cdaSalvarTarefa({
          descricao: desc, leadId: c.lead_id || null, clienteId: c.cliente_id || null, campanhaId: c.campanha_id || null,
          responsavelId: Number(mo.querySelector('#wa-t-resp').value) || null, tipo: 'whatsapp',
          prioridade: mo.querySelector('#wa-t-pri').value, status: 'pendente',
          dataInicio: new Date().toISOString().slice(0, 10), dataPrevista: mo.querySelector('#wa-t-data').value || null,
          criadoPor: cu ? cu.name : null
        });
        fechar(); showToast('Tarefa criada em Tarefas & Follow-up');
      } catch (e) { showToast('Erro ao criar tarefa: ' + (e.message || e), 'error'); }
    });
  }

  // ── Atualização automática (a cada 8s, só enquanto a tela estiver aberta) ──
  async function atualizar(silencioso) {
    try {
      await carregarConversas(); renderLista();
      if (ST.selId) {
        var antes = ST.mensagens.length, ultStatus = ST.mensagens.map(function (m) { return m.status; }).join();
        await carregarMensagens(ST.selId);
        if (ST.mensagens.length !== antes || ST.mensagens.map(function (m) { return m.status; }).join() !== ultStatus) {
          renderConversa(false);
          var c = convSel();
          if (c && c.nao_lidas > 0 && document.visibilityState === 'visible') {
            c.nao_lidas = 0; renderLista();
            cdaClient.functions.invoke(CDA_WA_FN_ENVIAR, { body: { acao: 'marcar_lida', conversa_id: c.id } }).catch(function () {});
          }
        }
      }
    } catch (e) { if (!silencioso) showToast('Erro ao atualizar: ' + (e.message || e), 'error'); }
  }
  function agendar() {
    clearInterval(window._cdaWaTimer);
    window._cdaWaTimer = setInterval(function () {
      if (!document.body.contains(host) || !host.querySelector('#wa-wrap')) { clearInterval(window._cdaWaTimer); return; }
      if (document.visibilityState === 'visible') atualizar(true);
    }, 8000);
  }

  ['#wa-f-busca'].forEach(function (s) { $(s).addEventListener('input', renderLista); });
  ['#wa-f-sit', '#wa-f-resp', '#wa-f-nl'].forEach(function (s) { $(s).addEventListener('change', renderLista); });
  $('#wa-atualizar').addEventListener('click', function () { atualizar(false); });

  try {
    await carregarBase();
    await carregarConversas();
  } catch (e) {
    console.error(e);
    $('#wa-lista').innerHTML = '<p style="color:var(--rust);padding:16px;font-size:12px">Erro ao carregar do Supabase:<br><b>' + cdaWaEsc(e.message || e.details || e) + '</b></p>';
    return;
  }
  renderLista();
  if (window._cdaWaAbrirConversaPendente) { var pid = window._cdaWaAbrirConversaPendente; window._cdaWaAbrirConversaPendente = null; abrirConversa(Number(pid)); }
  agendar();
}

// ════════════════════════════════════════════════════════════════════
// cda-modulo-mensagens.js — Biblioteca de Mensagens (Comercial) · nov/2026
// Como Cardápios no Financeiro: uma lista de documentos guardados, aqui
// mensagens de e-mail, cada uma ligada à sua campanha (uma campanha pode
// ter várias). Abrir · Editar · Duplicar · ✉ Enviar teste · Excluir.
//
// • cdaEditorMensagem.abrir({...}) — editor com pré-visualização, usado
//   pela Biblioteca e pelo formulário da Campanha.
// • montarModuloMensagens(containerId, {editavel}) — a tela da Biblioteca.
//
// Requer cda-dados-compartilhados.js (cdaMontarEmailMensagem,
// cdaSalvarMensagem, cdaEnviarTesteMensagem, cdaUploadImagemCampanha...).
// ════════════════════════════════════════════════════════════════════

var CDA_MSG_CAMPOS = ['imagemUrl', 'imagemAlt', 'titulo', 'saudacao', 'texto', 'cupomCodigo', 'cupomTexto', 'botaoTexto', 'botaoLink', 'infoTitulo', 'infoTexto', 'sacTitulo', 'sacTelefone', 'sacEmail', 'rodape'];
var CDA_MSG_PADRAO = {
  rodape: 'Você recebe este e-mail porque é cliente da Ciclo da Arte.\nCiclo da Arte · moda, acessórios e merchandising cultural',
  sacTitulo: 'Fale Conosco · SAC', sacTelefone: '(21) 99680-1660', sacEmail: 'contato@epcparticipacoes.com.br'
};
var CDA_MSG_RESPONDER_PADRAO = 'contato@epcparticipacoes.com.br';

function cdaMsgEsc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]; }); }
function cdaMsgDataHora(iso) { if (!iso) return '—'; var d = new Date(iso); return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); }
// Clientes da lista congelada no formato que o montador espera (para {nome}, {cidade}, {uf})
async function cdaMsgClientesDaCampanha(campanhaId) {
  if (!campanhaId) return [];
  try {
    var rows = await cdaCarregarListaCongelada(campanhaId);
    return rows.filter(function (r) { return r.email_valido; }).slice(0, 50).map(function (r) { return { nome: r.nome, cidade: r.cidade, estado: r.uf, email: r.email }; });
  } catch (e) { console.error(e); return []; }
}
var CDA_MSG_CLIENTE_EXEMPLO = { nome: 'Maria Silva', cidade: 'São Paulo', estado: 'SP' };

// Pergunta os endereços e envia o teste. Retorna a mensagem atualizada (último teste) ou null.
async function cdaMsgPerguntarEEnviarTeste(mensagem, campanha, cliente) {
  if (!mensagem || !mensagem.id) { alert('Salve a mensagem antes de enviar o teste.'); return null; }
  var padrao = (window.cu && window.cu.email) || '';
  var resp = prompt('Enviar TESTE de "' + mensagem.nome + '" para quais e-mails?\n(até 3, separados por vírgula)\n\nDe: ' + (mensagem.remetenteNome || '') + ' <' + mensagem.remetenteEmail + '>' +
    (mensagem.responderPara ? '\nRespostas vão para: ' + mensagem.responderPara : '\nSem "Responder para"'), padrao);
  if (resp == null) return null;
  var para = resp.split(/[,;\s]+/).map(function (x) { return x.trim(); }).filter(Boolean);
  if (!para.length) { alert('Informe ao menos um e-mail.'); return null; }
  if (para.length > 3) { alert('No máximo 3 endereços por teste.'); return null; }
  try {
    await cdaEnviarTesteMensagem(mensagem, campanha, cliente || CDA_MSG_CLIENTE_EXEMPLO, para);
    alert('✅ Teste enviado para: ' + para.join(', ') + '\n\nO assunto chega com "[TESTE]" na frente. Confira também a caixa de spam.');
    mensagem.ultimoTesteEm = new Date().toISOString();
    mensagem.ultimoTestePara = para.join(', ');
    return mensagem;
  } catch (err) {
    console.error(err);
    alert('❌ O teste não foi enviado:\n' + ((err && err.message) || 'Erro desconhecido'));
    return null;
  }
}

function cdaMsgAbrirEmNovaAba(mensagem, campanha, cliente) {
  var email = cdaMontarEmailMensagem(mensagem, campanha, cliente || CDA_MSG_CLIENTE_EXEMPLO, {});
  var url = URL.createObjectURL(new Blob([email.html], { type: 'text/html' }));
  window.open(url, '_blank');
  setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
}

// ── EDITOR (modal único, criado no <body> na primeira vez) ──────────
var cdaEditorMensagem = (function () {
  var el = null, ctx = null, timer = null;

  function q(sel) { return el.querySelector(sel); }
  function criar() {
    el = document.createElement('div');
    el.className = 'mo';
    el.id = 'cda-msg-modal';
    el.innerHTML =
      '<style>' +
        '#cda-msg-modal .mo-box{max-width:min(1150px,94vw);width:94vw;}' +
        '#cda-msg-modal .msg-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:14px;align-items:start;}' +
        '#cda-msg-modal .msg-campos .fgr{margin-bottom:8px;}' +
        '#cda-msg-modal .msg-campos textarea{min-height:70px;}' +
        '#cda-msg-modal .msg-sec{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin:14px 0 6px;padding-top:8px;border-top:1px dashed var(--border2,#ccc);}' +
        '#cda-msg-modal .msg-previa{position:sticky;top:0;}' +
        '#cda-msg-modal .msg-previa iframe{width:100%;height:760px;border:2px solid var(--ink,#1a1a1a);background:#f2efe9;}' +
        '#cda-msg-modal .msg-thumb{max-width:120px;max-height:150px;display:block;margin-top:4px;border:1px solid var(--ink,#1a1a1a);}' +
        '#cda-msg-modal .msg-de{display:flex;align-items:center;gap:4px;}#cda-msg-modal .msg-de input{flex:1;min-width:80px;}' +
        '@media (max-width:900px){#cda-msg-modal .msg-grid{grid-template-columns:1fr;}#cda-msg-modal .msg-previa{position:static;}}' +
      '</style>' +
      '<div class="mo-box">' +
        '<div class="mo-h"><h3 id="msg-titulo-modal">Mensagem de e-mail</h3><button class="mo-x" id="msg-x">✕</button></div>' +
        '<div class="mo-b"><div class="msg-grid">' +
          '<div class="msg-campos">' +
            '<div class="fgr"><label>Campanha *</label><select id="msg-campanha"></select></div>' +
            '<div class="fgr"><label>Nome da mensagem * <span class="tmu" style="font-weight:400">(só para identificar na biblioteca)</span></label><input type="text" id="msg-nome" placeholder="Ex: Convite com cupom · Lembrete 3 dias"></div>' +
            '<div class="msg-sec">Remetente e respostas</div>' +
            '<div class="fgr"><label>Nome do remetente (aparece como "De:")</label><input type="text" id="msg-rem-nome" class="msg-e" placeholder="Ex: Show Luedji Cine Joia SP"></div>' +
            '<div class="fgr"><label>Endereço do remetente</label><div class="msg-de"><input type="text" id="msg-rem-local" placeholder="noreply"><b>@</b><select id="msg-rem-dominio"></select></div>' +
              '<div class="tmu" style="font-size:10px;margin-top:2px">A parte antes do @ é livre (noreply, shows, novidades…); o domínio precisa ser o verificado no Resend.</div></div>' +
            '<div class="fgr"><label>Responder para <span class="tmu" style="font-weight:400">(para onde vai o "Responder" do cliente)</span></label><input type="email" id="msg-responder" placeholder="contato@epcparticipacoes.com.br"></div>' +
            '<div class="msg-sec">Caixa de entrada</div>' +
            '<div class="fgr"><label>Assunto</label><input type="text" id="msg-assunto" class="msg-e" maxlength="150"></div>' +
            '<div class="fgr"><label>Prévia (texto ao lado do assunto)</label><input type="text" id="msg-previa" class="msg-e" maxlength="200"></div>' +
            '<div class="msg-sec">Conteúdo · variáveis: {nome} {nome_completo} {cidade} {uf}</div>' +
            '<div class="fgr"><label>Imagem (flyer)</label><input type="file" id="msg-imagem-arq" accept="image/jpeg,image/png,image/gif,image/webp"><input type="text" id="msg-c-imagemUrl" class="msg-e" placeholder="…ou cole o endereço (URL) da imagem"><img id="msg-thumb" class="msg-thumb" hidden alt=""></div>' +
            '<div class="fgr"><label>Descrição da imagem (se não carregar)</label><input type="text" id="msg-c-imagemAlt" class="msg-e"></div>' +
            '<div class="fgr"><label>Título</label><input type="text" id="msg-c-titulo" class="msg-e"></div>' +
            '<div class="fgr"><label>Saudação</label><textarea id="msg-c-saudacao" class="msg-e"></textarea></div>' +
            '<div class="fgr"><label>Texto (linha em branco = novo parágrafo)</label><textarea id="msg-c-texto" class="msg-e" style="min-height:120px"></textarea></div>' +
            '<div class="fgr"><label>Cupom — código</label><input type="text" id="msg-c-cupomCodigo" class="msg-e"></div>' +
            '<div class="fgr"><label>Cupom — descrição</label><input type="text" id="msg-c-cupomTexto" class="msg-e"></div>' +
            '<div class="fgr"><label>Botão — texto</label><input type="text" id="msg-c-botaoTexto" class="msg-e"></div>' +
            '<div class="fgr"><label>Botão — link</label><input type="text" id="msg-c-botaoLink" class="msg-e" placeholder="https://..."></div>' +
            '<div class="fgr"><label>Informações — título</label><input type="text" id="msg-c-infoTitulo" class="msg-e"></div>' +
            '<div class="fgr"><label>Informações — texto</label><textarea id="msg-c-infoTexto" class="msg-e" style="min-height:110px"></textarea></div>' +
            '<div class="msg-sec">Fale Conosco · SAC (botões de e-mail e WhatsApp no e-mail)</div>' +
            '<div class="fgr"><label>Título do bloco</label><input type="text" id="msg-c-sacTitulo" class="msg-e"></div>' +
            '<div class="fgr"><label>Telefone / WhatsApp</label><input type="text" id="msg-c-sacTelefone" class="msg-e" placeholder="(21) 99680-1660"></div>' +
            '<div class="fgr"><label>E-mail de atendimento</label><input type="text" id="msg-c-sacEmail" class="msg-e" placeholder="contato@epcparticipacoes.com.br"></div>' +
            '<div class="msg-sec">Rodapé</div>' +
            '<div class="fgr"><label>Rodapé (quem envia e por quê · o link de descadastro entra sozinho)</label><textarea id="msg-c-rodape" class="msg-e"></textarea></div>' +
          '</div>' +
          '<div class="msg-previa">' +
            '<div style="display:flex;gap:6px;align-items:center;margin-bottom:6px;flex-wrap:wrap"><label style="margin:0">Pré-visualizar como</label><select id="msg-cliente" style="flex:1;min-width:160px"></select></div>' +
            '<div id="msg-cabecalho-prev" style="font-size:12px;margin-bottom:6px;line-height:1.5"></div>' +
            '<iframe id="msg-frame" title="Pré-visualização do e-mail"></iframe>' +
            '<div id="msg-ultimo-teste" class="tmu" style="font-size:10px;margin-top:4px"></div>' +
          '</div>' +
        '</div></div>' +
        '<div class="mo-f">' +
          '<button class="btn" id="msg-excluir" style="margin-right:auto;background:var(--rust,#c0392b);color:#fff;display:none">🗑 Excluir</button>' +
          '<button class="btn" id="msg-cancelar">Cancelar</button>' +
          '<button class="btn" id="msg-teste">✉ Salvar e enviar teste</button>' +
          '<button class="btn rust" id="msg-salvar">💾 Salvar</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(el);

    q('#msg-x').addEventListener('click', fechar);
    q('#msg-cancelar').addEventListener('click', fechar);
    q('#msg-salvar').addEventListener('click', function () { salvar(false); });
    q('#msg-teste').addEventListener('click', function () { salvar(true); });
    q('#msg-excluir').addEventListener('click', excluir);
    el.querySelectorAll('.msg-e').forEach(function (i) { i.addEventListener('input', atualizarPrevia); });
    ['#msg-rem-local', '#msg-rem-dominio', '#msg-responder', '#msg-cliente'].forEach(function (s) { q(s).addEventListener('input', atualizarPrevia); q(s).addEventListener('change', atualizarPrevia); });
    q('#msg-campanha').addEventListener('change', function () { carregarClientes(); atualizarPrevia(); });
    q('#msg-imagem-arq').addEventListener('change', async function () {
      var arq = this.files && this.files[0]; if (!arq) return;
      if (arq.size > 2 * 1024 * 1024) { alert('A imagem passa de 2 MB — reduza o tamanho antes de enviar (e-mails pesados tendem a cair no spam).'); this.value = ''; return; }
      var campo = q('#msg-c-imagemUrl');
      campo.value = 'Enviando imagem...';
      try { campo.value = await cdaUploadImagemCampanha(arq); }
      catch (err) { console.error(err); campo.value = ''; alert('Erro ao enviar a imagem:\n' + ((err && err.message) || 'Erro desconhecido')); }
      atualizarPrevia();
    });
  }

  function campanhaAtual() {
    var id = q('#msg-campanha').value;
    return (ctx.campanhas || []).find(function (c) { return String(c.id) === String(id); }) || null;
  }
  function clienteAtual() {
    var sel = q('#msg-cliente');
    return (sel._lista || [])[Number(sel.value)] || CDA_MSG_CLIENTE_EXEMPLO;
  }
  async function carregarClientes() {
    var sel = q('#msg-cliente');
    sel.innerHTML = '<option>Carregando...</option>';
    var lista = await cdaMsgClientesDaCampanha(q('#msg-campanha').value);
    sel._lista = lista;
    sel.innerHTML = lista.length
      ? lista.map(function (c, i) { return '<option value="' + i + '">' + cdaMsgEsc(c.nome) + ' — ' + cdaMsgEsc(c.cidade || '') + '/' + cdaMsgEsc(c.estado || '') + '</option>'; }).join('')
      : '<option value="">Cliente exemplo (congele a lista da campanha para ver clientes reais)</option>';
    atualizarPrevia();
  }
  function lerForm() {
    var c = {};
    CDA_MSG_CAMPOS.forEach(function (k) { c[k] = q('#msg-c-' + k).value.trim(); });
    if (c.imagemUrl === 'Enviando imagem...') c.imagemUrl = '';
    var local = q('#msg-rem-local').value.trim().replace(/@.*$/, '');
    return {
      id: ctx.mensagem && !ctx.duplicar ? ctx.mensagem.id : undefined,
      campanhaId: q('#msg-campanha').value || null,
      nome: q('#msg-nome').value.trim(),
      remetenteNome: q('#msg-rem-nome').value.trim(),
      remetenteEmail: local ? local + '@' + q('#msg-rem-dominio').value : '',
      responderPara: q('#msg-responder').value.trim(),
      assunto: q('#msg-assunto').value.trim(), previa: q('#msg-previa').value.trim(),
      conteudo: c, atualizadoPor: (window.cu && window.cu.name) || null
    };
  }
  function atualizarPrevia() {
    clearTimeout(timer);
    timer = setTimeout(function () {
      var m = lerForm();
      var email = cdaMontarEmailMensagem(m, campanhaAtual(), clienteAtual(), {});
      q('#msg-frame').srcdoc = email.html;
      q('#msg-cabecalho-prev').innerHTML =
        '<b>De:</b> ' + cdaMsgEsc(m.remetenteNome || '—') + ' &lt;' + cdaMsgEsc(m.remetenteEmail || '—') + '&gt;<br>' +
        '<b>Responder para:</b> ' + (m.responderPara ? cdaMsgEsc(m.responderPara) : '<span style="color:var(--rust,#c0392b)">nenhum — respostas dos clientes se perdem</span>') + '<br>' +
        '<b>Assunto:</b> ' + cdaMsgEsc(email.assunto || '—') + '<br><span class="tmu">' + cdaMsgEsc(email.previa || '') + '</span>';
      var th = q('#msg-thumb'); th.hidden = !m.conteudo.imagemUrl; if (m.conteudo.imagemUrl) th.src = m.conteudo.imagemUrl;
    }, 150);
  }

  async function salvar(enviarTeste) {
    var m = lerForm();
    if (!m.campanhaId) { alert('Escolha a campanha desta mensagem.'); return; }
    if (!m.nome) { alert('Dê um nome à mensagem.'); return; }
    if (!m.remetenteEmail) { alert('Informe o endereço do remetente (a parte antes do @).'); return; }
    if (m.responderPara && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m.responderPara)) { alert('"Responder para" não é um e-mail válido.'); return; }
    var salva;
    try { salva = await cdaSalvarMensagem(m); }
    catch (err) { console.error(err); alert('Erro ao GRAVAR a mensagem (nada foi salvo):\n' + ((err && (err.message || err.details)) || 'Erro desconhecido')); return; }
    ctx.mensagem = salva; ctx.duplicar = false;
    q('#msg-excluir').style.display = ctx.editavel ? 'inline-block' : 'none';
    q('#msg-titulo-modal').textContent = 'Editar mensagem';
    if (ctx.onSalvo) ctx.onSalvo(salva);
    if (enviarTeste) {
      var atual = await cdaMsgPerguntarEEnviarTeste(salva, campanhaAtual(), clienteAtual());
      if (atual) { mostrarUltimoTeste(atual); if (ctx.onSalvo) ctx.onSalvo(atual); }
      return; // fica aberto para ajustes depois do teste
    }
    fechar();
  }
  async function excluir() {
    if (!ctx.mensagem || !ctx.mensagem.id) return;
    if (!confirm('Excluir a mensagem "' + ctx.mensagem.nome + '"?')) return;
    try { await cdaExcluirMensagem(ctx.mensagem.id); }
    catch (err) { console.error(err); alert('Erro ao excluir:\n' + ((err && err.message) || 'Erro desconhecido')); return; }
    if (ctx.onExcluido) ctx.onExcluido(ctx.mensagem.id);
    fechar();
  }
  function mostrarUltimoTeste(m) {
    q('#msg-ultimo-teste').textContent = m && m.ultimoTesteEm ? 'Último teste: ' + cdaMsgDataHora(m.ultimoTesteEm) + ' → ' + m.ultimoTestePara : '';
  }
  function fechar() { el.classList.remove('op'); }

  // opts: {mensagem, duplicar, campanhaId, campanhas, editavel, onSalvo, onExcluido}
  function abrir(opts) {
    if (!el) criar();
    ctx = opts || {};
    var m = ctx.mensagem || null;
    var k = (m && m.conteudo) || {};
    q('#msg-titulo-modal').textContent = !m ? 'Nova mensagem' : (ctx.duplicar ? 'Duplicar mensagem' : 'Editar mensagem');
    var campanhaId = m ? m.campanhaId : ctx.campanhaId;
    q('#msg-campanha').innerHTML = '<option value="">Selecione...</option>' + (ctx.campanhas || []).map(function (c) {
      return '<option value="' + c.id + '"' + (String(c.id) === String(campanhaId) ? ' selected' : '') + '>' + cdaMsgEsc(c.nome) + '</option>';
    }).join('');
    q('#msg-nome').value = m ? (ctx.duplicar ? 'Cópia de ' + m.nome : m.nome) : '';
    q('#msg-rem-nome').value = m ? m.remetenteNome : (campanhaId ? ((ctx.campanhas || []).find(function (c) { return String(c.id) === String(campanhaId); }) || {}).nome || '' : '');
    var partes = String((m && m.remetenteEmail) || 'noreply@' + CDA_EMAIL_DOMINIOS_ENVIO[0]).split('@');
    q('#msg-rem-local').value = partes[0] || 'noreply';
    q('#msg-rem-dominio').innerHTML = CDA_EMAIL_DOMINIOS_ENVIO.map(function (d) { return '<option' + (d === partes[1] ? ' selected' : '') + '>' + d + '</option>'; }).join('');
    q('#msg-responder').value = m ? m.responderPara : CDA_MSG_RESPONDER_PADRAO;
    q('#msg-assunto').value = m ? m.assunto : '';
    q('#msg-previa').value = m ? m.previa : '';
    CDA_MSG_CAMPOS.forEach(function (campo) {
      q('#msg-c-' + campo).value = k[campo] != null && k[campo] !== '' ? k[campo] : (!m ? (CDA_MSG_PADRAO[campo] || '') : (campo === 'rodape' ? CDA_MSG_PADRAO.rodape : ''));
    });
    q('#msg-imagem-arq').value = '';
    var podeGravar = ctx.editavel !== false;
    q('#msg-salvar').style.display = podeGravar ? '' : 'none';
    q('#msg-teste').style.display = podeGravar ? '' : 'none';
    q('#msg-excluir').style.display = podeGravar && m && !ctx.duplicar ? 'inline-block' : 'none';
    mostrarUltimoTeste(ctx.duplicar ? null : m);
    el.classList.add('op');
    carregarClientes();
  }
  return { abrir: abrir };
})();

// ── TELA: BIBLIOTECA DE MENSAGENS ───────────────────────────────────
async function montarModuloMensagens(containerId, opts) {
  opts = opts || {};
  var editavel = opts.editavel !== false;
  var host = document.getElementById(containerId);
  if (!host) { console.error('cda-modulo-mensagens: container #' + containerId + ' não encontrado'); return; }
  var ST = { mensagens: [], campanhas: [] };

  host.innerHTML =
    '<div class="row-bt">' +
      '<div><div class="sec-t">📚 Biblioteca de Mensagens</div><div class="sec-d">Mensagens de e-mail guardadas, cada uma ligada à sua campanha · envio de teste antes do disparo</div></div>' +
      (editavel ? '<button class="btn rust" id="msg-btn-nova">＋ Nova mensagem</button>' : '') +
    '</div>' +
    '<div style="display:flex;gap:8px;margin:12px 0;flex-wrap:wrap"><select id="msg-f-campanha"><option value="">Todas as campanhas</option></select></div>' +
    '<div class="tw"><div class="ts"><table>' +
      '<thead><tr><th>Campanha</th><th>Mensagem</th><th>Assunto</th><th>Remetente</th><th>Responder para</th><th>Atualizada</th><th>Último teste</th><th>Ações</th></tr></thead>' +
      '<tbody id="msg-tb"><tr><td colspan="8" class="tmu">Carregando...</td></tr></tbody>' +
    '</table></div></div>';

  try {
    var res = await Promise.all([cdaCarregarMensagens(), cdaCarregarCampanhas()]);
    ST.mensagens = res[0]; ST.campanhas = res[1];
  } catch (err) {
    console.error(err);
    host.querySelector('#msg-tb').innerHTML = '<tr><td colspan="8" style="color:var(--rust,#c0392b)">Erro ao carregar: ' + cdaMsgEsc((err && err.message) || 'Erro desconhecido') + '</td></tr>';
    return;
  }
  var campanhaPorId = {}; ST.campanhas.forEach(function (c) { campanhaPorId[c.id] = c; });
  var fSel = host.querySelector('#msg-f-campanha');
  fSel.innerHTML = '<option value="">Todas as campanhas</option>' + ST.campanhas.map(function (c) { return '<option value="' + c.id + '">' + cdaMsgEsc(c.nome) + '</option>'; }).join('');

  function render() {
    var f = fSel.value;
    var lista = ST.mensagens.filter(function (m) { return !f || String(m.campanhaId) === f; })
      .sort(function (a, b) {
        var ca = (campanhaPorId[a.campanhaId] || {}).nome || '~', cb = (campanhaPorId[b.campanhaId] || {}).nome || '~';
        return ca.localeCompare(cb) || String(b.atualizadoEm).localeCompare(String(a.atualizadoEm));
      });
    var tb = host.querySelector('#msg-tb');
    if (!lista.length) { tb.innerHTML = '<tr><td colspan="8" class="tmu">Nenhuma mensagem' + (f ? ' nesta campanha' : '') + ' ainda.</td></tr>'; return; }
    tb.innerHTML = lista.map(function (m) {
      var camp = campanhaPorId[m.campanhaId];
      return '<tr>' +
        '<td>' + (camp ? '📣 ' + cdaMsgEsc(camp.nome) : '<i class="tmu">sem campanha</i>') + '</td>' +
        '<td><b>' + cdaMsgEsc(m.nome) + '</b></td>' +
        '<td>' + cdaMsgEsc(m.assunto || '—') + '</td>' +
        '<td style="font-size:11px">' + cdaMsgEsc(m.remetenteNome || '') + '<br><span class="tmu">' + cdaMsgEsc(m.remetenteEmail || '—') + '</span></td>' +
        '<td style="font-size:11px">' + (m.responderPara ? cdaMsgEsc(m.responderPara) : '<span class="tmu">—</span>') + '</td>' +
        '<td class="mn tmu" style="font-size:11px">' + cdaMsgDataHora(m.atualizadoEm) + '</td>' +
        '<td style="font-size:11px">' + (m.ultimoTesteEm ? cdaMsgDataHora(m.ultimoTesteEm) + '<br><span class="tmu">' + cdaMsgEsc(m.ultimoTestePara) + '</span>' : '<span class="badge b-gd">sem teste</span>') + '</td>' +
        '<td><div style="display:flex;gap:5px;flex-wrap:wrap">' +
          '<button class="btn sm" data-abrir="' + m.id + '" title="Abrir o e-mail em outra aba">👁 Abrir</button>' +
          '<button class="btn sm" data-editar="' + m.id + '">' + (editavel ? '✏ Editar' : '🔍 Ver') + '</button>' +
          (editavel ? '<button class="btn sm" data-duplicar="' + m.id + '">⧉ Duplicar</button>' +
            '<button class="btn sm rust" data-teste="' + m.id + '">✉ Enviar teste</button>' +
            '<button class="btn sm" data-excluir="' + m.id + '">🗑</button>' : '') +
        '</div></td></tr>';
    }).join('');
  }
  function porId(id) { return ST.mensagens.find(function (m) { return String(m.id) === String(id); }); }
  function aoSalvar(salva) {
    var i = ST.mensagens.findIndex(function (m) { return String(m.id) === String(salva.id); });
    if (i >= 0) ST.mensagens[i] = salva; else ST.mensagens.unshift(salva);
    render();
  }
  function aoExcluir(id) { ST.mensagens = ST.mensagens.filter(function (m) { return String(m.id) !== String(id); }); render(); }
  function abrirEditor(m, duplicar) {
    cdaEditorMensagem.abrir({ mensagem: m, duplicar: duplicar, campanhaId: fSel.value || null, campanhas: ST.campanhas, editavel: editavel, onSalvo: aoSalvar, onExcluido: aoExcluir });
  }

  host.querySelector('#msg-tb').addEventListener('click', async function (ev) {
    var b = ev.target.closest('button'); if (!b) return;
    if (b.dataset.abrir) { var m1 = porId(b.dataset.abrir); var c1 = await cdaMsgClientesDaCampanha(m1.campanhaId); cdaMsgAbrirEmNovaAba(m1, campanhaPorId[m1.campanhaId], c1[0]); }
    else if (b.dataset.editar) abrirEditor(porId(b.dataset.editar), false);
    else if (b.dataset.duplicar) abrirEditor(porId(b.dataset.duplicar), true);
    else if (b.dataset.teste) {
      var m2 = porId(b.dataset.teste);
      var txt = b.textContent; b.textContent = 'Enviando...'; b.disabled = true;
      var c2 = await cdaMsgClientesDaCampanha(m2.campanhaId);
      var atual = await cdaMsgPerguntarEEnviarTeste(m2, campanhaPorId[m2.campanhaId], c2[0]);
      b.textContent = txt; b.disabled = false;
      if (atual) render();
    } else if (b.dataset.excluir) {
      var m3 = porId(b.dataset.excluir);
      if (!confirm('Excluir a mensagem "' + m3.nome + '"?')) return;
      try { await cdaExcluirMensagem(m3.id); aoExcluir(m3.id); }
      catch (err) { console.error(err); alert('Erro ao excluir:\n' + ((err && err.message) || 'Erro desconhecido')); }
    }
  });
  fSel.addEventListener('change', render);
  if (editavel) host.querySelector('#msg-btn-nova').addEventListener('click', function () { abrirEditor(null, false); });
  if (opts.campanhaId) { fSel.value = String(opts.campanhaId); }
  render();
}

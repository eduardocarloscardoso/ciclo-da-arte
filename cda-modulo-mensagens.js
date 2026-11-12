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

var CDA_MSG_CAMPOS = ['imagemUrl', 'imagemAlt', 'titulo', 'saudacao', 'texto', 'cupomCodigo', 'cupomTexto', 'botaoTexto', 'botaoLink', 'botao2Texto', 'botao2Link', 'infoTitulo', 'infoTexto', 'sacTitulo', 'sacTelefone', 'sacEmail', 'rodape'];
var CDA_MSG_PADRAO = {
  rodape: 'Você recebe este e-mail porque é cliente da Ciclo da Arte.\nCiclo da Arte · moda, acessórios e merchandising cultural\nRua da Conceição, 105, 15º andar · Centro · Rio de Janeiro/RJ · CEP 20051-011',
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

// Diálogo próprio: o Cancelar encerra a seleção sem disparar nenhum e-mail.
function cdaMsgSolicitarDestinatarios(mensagem, padrao, janela) {
  return new Promise(function (resolve) {
    var doc = janela && !janela.closed ? janela.document : document;
    var overlay = doc.createElement('div');
    overlay.id = 'cda-msg-dialogo-teste';
    overlay.setAttribute('role', 'presentation');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;padding:16px';
    overlay.innerHTML =
      '<div role="dialog" aria-modal="true" aria-labelledby="cda-msg-teste-titulo" style="background:#182235;color:#f5f3ee;border:1px solid #536078;border-radius:12px;padding:24px;width:min(100%,520px);box-shadow:0 16px 45px rgba(0,0,0,.5);font-family:inherit">' +
        '<h3 id="cda-msg-teste-titulo" style="margin:0 0 12px;font-size:20px">Enviar e-mail de teste</h3>' +
        '<p style="margin:0 0 14px;line-height:1.5">Mensagem: <b id="cda-msg-teste-nome"></b></p>' +
        '<label for="cda-msg-teste-enderecos" style="display:block;margin:0 0 6px">Destinatários (até 3, separados por vírgula)</label>' +
        '<input id="cda-msg-teste-enderecos" type="text" autocomplete="off" style="box-sizing:border-box;width:100%;padding:12px;border:1px solid #8e9ab0;border-radius:6px;background:#fff;color:#111;font-size:15px">' +
        '<p id="cda-msg-teste-erro" role="alert" style="color:#ff9b9b;min-height:18px;font-size:12px;margin:6px 0 12px"></p>' +
        '<div style="font-size:12px;line-height:1.6;margin-bottom:20px;color:#d2d9e3;overflow-wrap:anywhere">De: <span id="cda-msg-teste-remetente"></span><br><span id="cda-msg-teste-resposta"></span></div>' +
        '<div style="display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap">' +
          '<button id="cda-msg-teste-cancelar" type="button" style="cursor:pointer;padding:11px 18px;border:1px solid #8e9ab0;border-radius:6px;background:#29364a;color:#fff;font-weight:600">Cancelar</button>' +
          '<button id="cda-msg-teste-confirmar" type="button" style="cursor:pointer;padding:11px 18px;border:0;border-radius:6px;background:#d94835;color:#fff;font-weight:600">Enviar teste</button>' +
        '</div>' +
      '</div>';
    doc.body.appendChild(overlay);
    var campo = overlay.querySelector('#cda-msg-teste-enderecos');
    var erro = overlay.querySelector('#cda-msg-teste-erro');
    var anterior = doc.activeElement;
    overlay.querySelector('#cda-msg-teste-nome').textContent = mensagem.nome || '';
    overlay.querySelector('#cda-msg-teste-remetente').textContent = (mensagem.remetenteNome || '') + ' <' + (mensagem.remetenteEmail || '') + '>';
    overlay.querySelector('#cda-msg-teste-resposta').textContent = mensagem.responderPara ? 'Respostas vão para: ' + mensagem.responderPara : 'Sem "Responder para"';
    campo.value = padrao || '';
    function finalizar(valor) {
      doc.removeEventListener('keydown', teclas, true);
      overlay.remove();
      if (anterior && anterior.isConnected && anterior.focus) anterior.focus();
      resolve(valor);
    }
    function cancelar() { finalizar(null); }
    function confirmar() {
      var para = campo.value.split(/[,;\s]+/).map(function (x) { return x.trim(); }).filter(Boolean);
      if (!para.length) { erro.textContent = 'Informe ao menos um e-mail.'; campo.focus(); return; }
      if (para.length > 3) { erro.textContent = 'No máximo 3 endereços por teste.'; campo.focus(); return; }
      if (para.some(function (email) { return !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); })) {
        erro.textContent = 'Confira os endereços de e-mail informados.'; campo.focus(); return;
      }
      finalizar(para);
    }
    function teclas(ev) {
      if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); cancelar(); }
      else if (ev.key === 'Enter' && doc.activeElement === campo) { ev.preventDefault(); confirmar(); }
    }
    overlay.querySelector('#cda-msg-teste-cancelar').addEventListener('click', cancelar);
    overlay.querySelector('#cda-msg-teste-confirmar').addEventListener('click', confirmar);
    overlay.addEventListener('click', function (ev) { if (ev.target === overlay) cancelar(); });
    doc.addEventListener('keydown', teclas, true);
    campo.focus();
    campo.select();
  });
}

// Pergunta os endereços e envia o teste. Retorna a mensagem atualizada (último teste) ou null.
// O botão (opcional) só muda para "Enviando..." DEPOIS da confirmação e sempre volta ao normal.
// Estado explícito do teste: envio em andamento → aceito pelo provedor ou erro.
// Mantém o diálogo aberto até o operador reconhecer o resultado.
function cdaMsgStatusEnvio(janela, destinos) {
  var doc = janela && !janela.closed ? janela.document : document;
  var overlay = doc.createElement('div');
  overlay.setAttribute('role', 'presentation');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:100001;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;padding:16px';
  overlay.innerHTML =
    '<div role="dialog" aria-modal="true" aria-labelledby="cda-msg-status-titulo" style="box-sizing:border-box;width:min(100%,510px);background:#182235;color:#f5f3ee;border:1px solid #536078;border-radius:12px;padding:25px;box-shadow:0 16px 45px rgba(0,0,0,.5);font-family:Arial,Helvetica,sans-serif">' +
      '<h3 id="cda-msg-status-titulo" style="margin:0 0 12px;font-size:20px">⏳ Enviando mensagem de teste...</h3>' +
      '<p id="cda-msg-status-detalhe" role="status" aria-live="polite" style="margin:0 0 10px;line-height:1.6;overflow-wrap:anywhere"></p>' +
      '<p id="cda-msg-status-aviso" style="margin:0 0 18px;font-size:12px;color:#d2d9e3;line-height:1.5">Não feche a tela nem clique novamente em Enviar teste enquanto o pedido estiver em andamento.</p>' +
      '<div style="text-align:right"><button id="cda-msg-status-fechar" type="button" disabled style="display:none;cursor:pointer;padding:11px 22px;background:#d94835;color:white;border:0;border-radius:6px;font-weight:700">Fechar</button></div>' +
    '</div>';
  doc.body.appendChild(overlay);
  var titulo = overlay.querySelector('#cda-msg-status-titulo');
  var detalhe = overlay.querySelector('#cda-msg-status-detalhe');
  var aviso = overlay.querySelector('#cda-msg-status-aviso');
  var fechar = overlay.querySelector('#cda-msg-status-fechar');
  detalhe.textContent = 'Solicitando envio para ' + destinos.length + ' endereço(s): ' + destinos.join(', ');
  fechar.addEventListener('click', function () { overlay.remove(); });
  return {
    concluir: function (ok, mensagem, observacao) {
      titulo.textContent = ok ? '✅ Mensagem de teste aceita pelo Resend' : '❌ Envio de teste não concluído';
      detalhe.textContent = mensagem;
      aviso.textContent = observacao;
      fechar.disabled = false;
      fechar.style.display = 'inline-block';
      fechar.focus();
    }
  };
}

async function cdaMsgPerguntarEEnviarTeste(mensagem, campanha, cliente, botao, janela) {
  if (!mensagem || !mensagem.id) { alert('Salve a mensagem antes de enviar o teste.'); return null; }
  var padrao = (window.cu && window.cu.email) || '';
  var para = await cdaMsgSolicitarDestinatarios(mensagem, padrao, janela);
  if (para === null) return null; // Cancelar: não envia, não altera a mensagem.
  var textoBotao = botao ? botao.textContent : '';
  if (botao) { botao.textContent = '⏳ Enviando...'; botao.disabled = true; }
  var status = cdaMsgStatusEnvio(janela, para);
  try {
    var limite = new Promise(function (_, rej) { setTimeout(function () { rej(new Error('Tempo de resposta excedido. O Resend pode ter aceitado parte ou todos os pedidos; confira o histórico antes de tentar novamente.')); }, 30000); });
    await Promise.race([cdaEnviarTesteMensagem(mensagem, campanha, cliente || CDA_MSG_CLIENTE_EXEMPLO, para), limite]);
    mensagem.ultimoTesteEm = new Date().toISOString();
    mensagem.ultimoTestePara = para.join(', ');
    status.concluir(true, 'Solicitação aceita para: ' + para.join(', ') + '.',
      'O aceite do Resend não confirma a entrega na caixa de entrada. Verifique o recebimento e os eventos em Comunicações da Campanha. O assunto começa com [TESTE].');
    return mensagem;
  } catch (err) {
    console.error(err);
    status.concluir(false, (err && err.message) || 'Erro desconhecido.',
      'Nenhum novo envio será feito automaticamente. Se houver resultado parcial ou dúvida de entrega, confira as tentativas no histórico antes de repetir.');
    return null;
  } finally {
    if (botao) { botao.textContent = textoBotao; botao.disabled = false; }
  }
}

// A prévia é a única superfície que recebe "Enviar teste" ao lado do WhatsApp.
// Não modifica o HTML enviado pelo Resend para clientes.
function cdaMsgAbrirEmNovaAba(mensagem, campanha, cliente, aoTestar) {
  var email = cdaMontarEmailMensagem(mensagem, campanha, cliente || CDA_MSG_CLIENTE_EXEMPLO, {});
  var url = URL.createObjectURL(new Blob([email.html], { type: 'text/html' }));
  var aba = window.open(url, '_blank');
  if (aba) {
    aba.addEventListener('load', function () {
      try {
        var doc = aba.document;
        var whats = doc.querySelector('a[href^="https://wa.me/"]');
        var contato = doc.querySelector('a[href^="mailto:"]');
        var ancora = (whats || contato);
        var tabela = ancora && ancora.closest('table[role="presentation"]');
        if (!tabela) return;
        var extra = doc.createElement('table');
        extra.setAttribute('role', 'presentation');
        extra.setAttribute('cellpadding', '0');
        extra.setAttribute('cellspacing', '0');
        extra.style.cssText = 'display:inline-table;margin:4px;';
        extra.innerHTML =
          '<tr><td style="background:#c0392b;border-radius:4px;">' +
            '<button type="button" title="Enviar somente para os endereços de teste" style="border:0;background:#c0392b;color:#ffffff;border-radius:4px;padding:11px 20px;font:700 14px Arial,Helvetica,sans-serif;cursor:pointer;">✉ Enviar teste</button>' +
          '</td></tr>';
        tabela.insertAdjacentElement('afterend', extra);
        extra.querySelector('button').addEventListener('click', async function () {
          // O diálogo dos destinatários abre no sistema, onde a sessão autenticada está ativa.
          if (window.closed) return;
          var resultado = await cdaMsgPerguntarEEnviarTeste(mensagem, campanha, cliente, this, aba);
          if (resultado && typeof aoTestar === 'function') aoTestar(resultado);
        });
      } catch (err) { console.error('Prévia: não foi possível inserir Enviar teste:', err); }
    }, { once: true });
  }
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
        '<div class="mo-h"><h3 id="msg-titulo-modal">Mensagem de e-mail</h3><button type="button" class="mo-x" id="msg-x" title="Fechar edição" aria-label="Fechar edição">✕</button></div>' +
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
            '<div class="fgr"><label>Cupom — descrição (cada linha aparece separada)</label><textarea id="msg-c-cupomTexto" class="msg-e" style="min-height:60px"></textarea></div>' +
            '<div class="fgr"><label>Botão — texto</label><input type="text" id="msg-c-botaoTexto" class="msg-e"></div>' +
            '<div class="fgr"><label>Botão — link</label><input type="text" id="msg-c-botaoLink" class="msg-e" placeholder="https://..."></div>' +
            '<div class="fgr"><label>2º botão — texto (opcional)</label><input type="text" id="msg-c-botao2Texto" class="msg-e"></div>' +
            '<div class="fgr"><label>2º botão — link (opcional)</label><input type="text" id="msg-c-botao2Link" class="msg-e" placeholder="https://..."></div>' +
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
          '<button type="button" class="btn" id="msg-cancelar">Sair da edição</button>' +
          '<button class="btn" id="msg-teste">✉ Salvar e enviar teste</button>' +
          '<button class="btn rust" id="msg-salvar">💾 Salvar</button>' +
        '</div>' +
      '</div>';
    var destino = document.querySelector('#main-content .crm-embed');
    (destino || document.body).appendChild(el);

    q('#msg-x').addEventListener('click', fechar);
    q('#msg-cancelar').addEventListener('click', fechar);
    el.addEventListener('keydown', function(ev){ if(ev.key==='Escape' && el.classList.contains('op')) { ev.preventDefault(); fechar(); } });
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
      var atual = await cdaMsgPerguntarEEnviarTeste(salva, campanhaAtual(), clienteAtual(), q('#msg-teste'));
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
  function fechar() { if (!el) return; clearTimeout(timer); el.classList.remove('op'); }

  // opts: {mensagem, duplicar, campanhaId, campanhas, editavel, onSalvo, onExcluido}
  function abrir(opts) {
    if (!el) criar();
    // O editor precisa estar dentro de .crm-embed: estilos de modal e botões
    // não se aplicam a overlays inseridos diretamente em document.body.
    var destino=document.querySelector('#main-content .crm-embed');
    if(destino && el.parentNode!==destino) destino.appendChild(el);
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
  var ST = { mensagens: [], campanhas: [], materiais: [] };

  host.innerHTML =
    '<div class="row-bt">' +
      '<div><div class="sec-t">📚 Biblioteca de Conteúdos</div><div class="sec-d">Acervo compartilhado de mensagens e materiais comerciais. Mensagens de e-mail e testes existentes são preservados.</div></div>' +
      (editavel ? '<button class="btn rust" id="msg-btn-nova">＋ Nova mensagem</button>' : '') +
    '</div>' +
    '<h3 style="font-size:15px;margin:16px 0 8px">Mensagens de e-mail · acervo existente</h3>' +
    '<div style="display:flex;gap:8px;margin:12px 0;flex-wrap:wrap"><select id="msg-f-campanha"><option value="">Todas as campanhas</option></select></div>' +
    '<div class="tw"><div class="ts"><table>' +
      '<thead><tr><th>Campanha</th><th>Mensagem</th><th>Assunto</th><th>Remetente</th><th>Responder para</th><th>Atualizada</th><th>Último teste</th><th>Ações</th></tr></thead>' +
      '<tbody id="msg-tb"><tr><td colspan="8" class="tmu">Carregando...</td></tr></tbody>' +
    '</table></div></div>' +
    '<section style="margin-top:26px;border-top:1px solid var(--border2,#ccc);padding-top:15px" aria-label="Materiais comerciais compartilhados">'+
      '<div class="row-bt"><div><h3 style="font-size:15px;margin:0 0 5px">Materiais comerciais · acervo compartilhado</h3><div class="tmu" style="font-size:11px">Cadastre referências de imagens, vídeos, ofertas, links e outros materiais. O cadastro não envia mensagens nem vincula automaticamente o material a campanhas.</div></div>'+
        (editavel?'<button class="btn rust" type="button" id="msg-mat-novo">＋ Novo material</button>':'')+
      '</div>'+
      '<div style="display:flex;gap:9px;flex-wrap:wrap;margin:12px 0"><select id="msg-mat-tipo" aria-label="Filtrar tipo de material"><option value="">Todos os tipos</option><option value="modelo">Modelos de campanha</option><option value="imagem">Imagens</option><option value="video">Vídeos</option><option value="oferta">Ofertas</option><option value="link">Links</option><option value="outro">Outros materiais</option></select>'+
      '<select id="msg-mat-categoria" aria-label="Filtrar categoria"><option value="">Todas as categorias</option><option value="campanhas_shows">Campanhas de Shows</option><option value="geral">Outros materiais</option></select>'+
      '<select id="msg-mat-situacao" aria-label="Filtrar aprovação"><option value="">Todas as situações</option><option value="rascunho">Rascunhos</option><option value="em_revisao">Em revisão</option><option value="aprovado">Aprovados</option><option value="arquivado">Arquivados</option></select>'+
      '<input type="search" id="msg-mat-busca" placeholder="Buscar por título ou descrição..." style="min-width:220px;flex:1"></div>'+
      '<div id="msg-mat-lista" aria-live="polite" style="font-size:12px">Carregando materiais...</div>'+
      '<form id="msg-mat-form" style="display:none;margin-top:14px;border:1px solid var(--border2,#ccc);padding:15px">'+
        '<h4 id="msg-mat-form-titulo" style="margin:0 0 10px">Novo material</h4>'+
        '<input type="hidden" id="msg-mat-id">'+
        '<div style="display:flex;gap:10px;flex-wrap:wrap"><label style="flex:1;min-width:150px">Tipo *<select id="msg-mat-tipo-ed" required style="width:100%"><option value="modelo">Modelo de campanha</option><option value="imagem">Imagem</option><option value="video">Vídeo</option><option value="oferta">Oferta</option><option value="link">Link</option><option value="outro">Outro</option></select></label>'+
        '<label style="flex:2;min-width:210px">Título *<input id="msg-mat-titulo" maxlength="180" required style="width:100%"></label>'+
        '<label style="flex:1;min-width:160px">Situação<select id="msg-mat-situacao-ed" style="width:100%"><option value="rascunho">Rascunho</option><option value="em_revisao">Em revisão</option><option value="aprovado">Aprovado</option><option value="arquivado">Arquivado</option></select></label></div>'+
        '<label style="display:block;margin-top:9px">Categoria<select id="msg-mat-categoria-ed" style="width:100%"><option value="campanhas_shows">Campanhas de Shows</option><option value="geral">Outros materiais</option></select></label>'+
        '<label style="display:block;margin-top:9px">URL do conteúdo (HTTPS)<input id="msg-mat-url" type="url" placeholder="https://..." style="width:100%"></label>'+
        '<label style="display:block;margin-top:9px">Descrição<textarea id="msg-mat-descricao" rows="3" style="width:100%"></textarea></label>'+
        '<label style="display:block;margin-top:9px">Direitos, créditos ou condições de uso<textarea id="msg-mat-direitos" rows="2" style="width:100%"></textarea></label>'+
        '<div style="display:flex;gap:8px;margin-top:10px"><button class="btn rust" type="submit" id="msg-mat-salvar">Salvar material</button><button class="btn" type="button" id="msg-mat-cancelar">Cancelar</button></div>'+
      '</form>'+
    '</section>';

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
    if (b.dataset.abrir) {
      var m1 = porId(b.dataset.abrir);
      // A Biblioteca pode ter ficado aberta enquanto a imagem foi salva em outra tela.
      // Reconsulta a mensagem antes de gerar a prévia, para usar a foto mais recente.
      try {
        var atualizadas = await cdaCarregarMensagens();
        var recente = atualizadas.find(function (m) { return String(m.id) === String(b.dataset.abrir); });
        if (recente) {
          m1 = recente;
          var pos = ST.mensagens.findIndex(function (m) { return String(m.id) === String(recente.id); });
          if (pos >= 0) ST.mensagens[pos] = recente;
        }
      } catch (err) {
        console.error('Não foi possível atualizar a mensagem antes de Abrir:', err);
      }
      if (!m1) return;
      var c1 = await cdaMsgClientesDaCampanha(m1.campanhaId);
      cdaMsgAbrirEmNovaAba(m1, campanhaPorId[m1.campanhaId], c1[0], render);
    }
    else if (b.dataset.editar) abrirEditor(porId(b.dataset.editar), false);
    else if (b.dataset.duplicar) abrirEditor(porId(b.dataset.duplicar), true);
    else if (b.dataset.excluir) {
      var m3 = porId(b.dataset.excluir);
      if (!confirm('Excluir a mensagem "' + m3.nome + '"?')) return;
      try { await cdaExcluirMensagem(m3.id); aoExcluir(m3.id); }
      catch (err) { console.error(err); alert('Erro ao excluir:\n' + ((err && err.message) || 'Erro desconhecido')); }
    }
  });

  // Acervo complementar: mensagens seguem em cda_campanha_mensagens, sem duplicação.
  async function carregarMateriais() {
    var box=host.querySelector('#msg-mat-lista');
    try {
      var resp=await cdaClient.from('cda_biblioteca_conteudos').select('*').order('atualizado_em',{ascending:false}).limit(1000);
      if(resp.error)throw resp.error;
      ST.materiais=resp.data||[];
      renderMateriais();
    } catch(err) {
      box.textContent='Não foi possível consultar os materiais: '+((err&&err.message)||String(err));
    }
  }
  function renderMateriais() {
    var tipo=host.querySelector('#msg-mat-tipo').value;
    var categoria=host.querySelector('#msg-mat-categoria').value;
    var situacao=host.querySelector('#msg-mat-situacao').value;
    var busca=host.querySelector('#msg-mat-busca').value.trim().toLowerCase();
    var dados=ST.materiais.filter(function(m){
      return (!tipo||m.tipo===tipo)&&(!categoria||m.categoria===categoria)&&(!situacao||m.situacao===situacao)&&
        (!busca||(m.titulo+' '+(m.descricao||'')).toLowerCase().includes(busca));
    });
    host.querySelector('#msg-mat-lista').innerHTML=dados.length?
      '<div class="tw"><div class="ts"><table style="width:100%"><thead><tr><th>Categoria</th><th>Tipo</th><th>Título</th><th>Situação</th><th>Referência</th><th>Direitos</th><th>Ações</th></tr></thead><tbody>'+
      dados.map(function(m){
        var u=String(m.url||'');
        var seguro=/^https:\/\//i.test(u);
        return '<tr><td>'+cdaMsgEsc(m.categoria==='campanhas_shows'?'Campanhas de Shows':'Geral')+'</td>'+
          '<td>'+cdaMsgEsc(({modelo:'Modelo',imagem:'Imagem',video:'Vídeo',oferta:'Oferta',link:'Link',outro:'Outro'})[m.tipo]||m.tipo)+'</td>'+
          '<td><b>'+cdaMsgEsc(m.titulo)+'</b><div class="tmu">'+cdaMsgEsc(m.descricao||'')+'</div>'+
          (m.origem_mensagem_id?'<div class="tmu">Referência à mensagem #'+Number(m.origem_mensagem_id)+' · arquivo não duplicado</div>':'')+
          (m.tipo==='modelo'&&m.estrutura_modelo&&Array.isArray(m.estrutura_modelo.campos_obrigatorios)?
          '<div class="tmu">Campos-base: '+m.estrutura_modelo.campos_obrigatorios.map(cdaMsgEsc).join(' · ')+'</div>':'')+'</td>'+
          '<td>'+cdaMsgEsc(({rascunho:'Rascunho',em_revisao:'Em revisão',aprovado:'Aprovado',arquivado:'Arquivado'})[m.situacao]||m.situacao)+'</td>'+
          '<td>'+(seguro?'<a href="'+cdaMsgEsc(u)+'" target="_blank" rel="noopener noreferrer">Abrir referência</a>':'—')+'</td>'+
          '<td>'+cdaMsgEsc(m.observacoes_direitos||'—')+'</td>'+
          '<td>'+(editavel?'<div style="display:flex;gap:5px;flex-wrap:wrap"><button class="btn sm" type="button" data-mat-editar="'+m.id+'">Editar</button>'+
          '<button class="btn sm" type="button" data-mat-duplicar="'+m.id+'">Usar como base</button></div>':'—')+'</td></tr>';
      }).join('')+'</tbody></table></div></div>':
      '<div class="tmu" style="padding:12px">Nenhum material encontrado. As mensagens de e-mail permanecem disponíveis na seção acima.</div>';
  }
  var matForm=host.querySelector('#msg-mat-form');
  var estruturaModeloCopia=null;
  function editarMaterial(m) {
    if(!editavel)return;
    estruturaModeloCopia=null;
    matForm.style.display='';
    host.querySelector('#msg-mat-form-titulo').textContent=m?'Editar material':'Novo material';
    host.querySelector('#msg-mat-id').value=m?m.id:'';
    host.querySelector('#msg-mat-tipo-ed').value=m?m.tipo:'imagem';
    host.querySelector('#msg-mat-categoria-ed').value=m?(m.categoria||'geral'):'campanhas_shows';
    host.querySelector('#msg-mat-titulo').value=m?m.titulo:'';
    host.querySelector('#msg-mat-situacao-ed').value=m?m.situacao:'rascunho';
    host.querySelector('#msg-mat-url').value=m?m.url||'':'';
    host.querySelector('#msg-mat-descricao').value=m?m.descricao||'':'';
    host.querySelector('#msg-mat-direitos').value=m?m.observacoes_direitos||'':'';
    matForm.scrollIntoView({behavior:'smooth',block:'nearest'});
  }
  host.querySelector('#msg-mat-tipo').addEventListener('change',renderMateriais);
  host.querySelector('#msg-mat-categoria').addEventListener('change',renderMateriais);
  host.querySelector('#msg-mat-situacao').addEventListener('change',renderMateriais);
  host.querySelector('#msg-mat-busca').addEventListener('input',renderMateriais);
  host.querySelector('#msg-mat-lista').addEventListener('click',function(ev){
    var b=ev.target.closest('[data-mat-editar],[data-mat-duplicar]');
    if(!b)return;
    var origem=ST.materiais.find(function(m){return String(m.id)===String(b.dataset.matEditar||b.dataset.matDuplicar);});
    if(!origem)return;
    if(b.dataset.matDuplicar){
      editarMaterial(null);
      if(origem.tipo==='modelo' && origem.estrutura_modelo){
        estruturaModeloCopia=JSON.parse(JSON.stringify(origem.estrutura_modelo));
        estruturaModeloCopia.origem_referencia={modelo_id:origem.id,nota:'Cópia de modelo, sem copiar público, cupom, imagem ou link do artista anterior'};
      }
      host.querySelector('#msg-mat-tipo-ed').value=origem.tipo;
      host.querySelector('#msg-mat-categoria-ed').value=origem.categoria||'geral';
      host.querySelector('#msg-mat-titulo').value=origem.tipo==='modelo'?'Campanhas de Shows · NOVO ARTISTA · NOVA PRAÇA · NOVO PÚBLICO':'Cópia de '+origem.titulo;
      host.querySelector('#msg-mat-descricao').value=origem.tipo==='modelo'?('Modelo baseado em '+origem.titulo+'. Preencha artista, praça, público, local, data, conteúdos e canais; nenhuma ação será enviada automaticamente.'):(origem.descricao||'');
      host.querySelector('#msg-mat-direitos').value=origem.tipo==='modelo'?'Validar materiais, direitos e ofertas da nova campanha antes de aprovar.':(origem.observacoes_direitos||'');
      host.querySelector('#msg-mat-url').value=origem.tipo==='modelo'?'':(origem.url||'');
    }else editarMaterial(origem);
  });
  host.querySelector('#msg-mat-cancelar').addEventListener('click',function(){matForm.style.display='none';});
  if(editavel) {
    host.querySelector('#msg-mat-novo').addEventListener('click',function(){editarMaterial(null);});
    matForm.addEventListener('submit',async function(ev){
      ev.preventDefault();
      var id=host.querySelector('#msg-mat-id').value;
      var url=host.querySelector('#msg-mat-url').value.trim();
      if(url&&!/^https:\/\//i.test(url)){alert('Informe uma URL HTTPS válida.');return;}
      var dado={
        tipo:host.querySelector('#msg-mat-tipo-ed').value,
        categoria:host.querySelector('#msg-mat-categoria-ed').value,
        titulo:host.querySelector('#msg-mat-titulo').value.trim(),
        situacao:host.querySelector('#msg-mat-situacao-ed').value,
        url:url||null,
        descricao:host.querySelector('#msg-mat-descricao').value.trim()||null,
        observacoes_direitos:host.querySelector('#msg-mat-direitos').value.trim()||null,
        atualizado_em:new Date().toISOString(),
        atualizado_por:(window.cu&&window.cu.name)||null
      };
      if(!id&&dado.tipo==='modelo')dado.estrutura_modelo=estruturaModeloCopia||{
        campos_obrigatorios:['ARTISTA','PRAÇA','PÚBLICO'],
        campos_complementares:['DATA_SHOW','LOCAL','OBJETIVO','MENSAGEM','FLYER','OFERTA','LINK_CTA','CANAL','REMETENTE','REPLY_TO','ELEGIBILIDADE','APROVAÇÃO']
      };
      if(!dado.titulo){alert('Informe o título.');return;}
      var btn=host.querySelector('#msg-mat-salvar');btn.disabled=true;
      try{
        var req=id?cdaClient.from('cda_biblioteca_conteudos').update(dado).eq('id',id):
          cdaClient.from('cda_biblioteca_conteudos').insert(Object.assign({criado_por:dado.atualizado_por},dado));
        var resp=await req.select().single();
        if(resp.error)throw resp.error;
        matForm.style.display='none';
        await carregarMateriais();
      }catch(err){alert('Não foi possível salvar o material: '+((err&&err.message)||String(err)));}
      finally{btn.disabled=false;}
    });
  }
  carregarMateriais();

  fSel.addEventListener('change', render);
  if (editavel) host.querySelector('#msg-btn-nova').addEventListener('click', function () { abrirEditor(null, false); });
  if (opts.campanhaId) { fSel.value = String(opts.campanhaId); }
  render();
}

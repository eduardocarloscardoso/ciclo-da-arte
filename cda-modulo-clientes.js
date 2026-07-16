// ════════════════════════════════════════════════════════════════════
// cda-modulo-clientes.js
// Interface compartilhada do Cadastro de Clientes — leitura + escrita
// nos dois módulos (Financeiro e Comercial). Inclui Importar/Exportar XLSX.
//
// Requer cda-dados-compartilhados.js carregado antes (usa
// cdaCarregarClientes, cdaSalvarCliente, cdaExcluirCliente,
// cdaCarregarCanais, cdaCarregarClienteCanais, cdaVincularClienteCanal,
// cdaDesvincularClienteCanal, CDA_TIPO_COMERCIAL_LABEL,
// CDA_ORIGEM_DADOS_OPCOES) e a biblioteca SheetJS (XLSX) carregada
// (para Importar/Exportar).
//
// Uso:
//   <div id="container-clientes"></div>
//   <script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>
//   <script src="cda-dados-compartilhados.js"></script>
//   <script src="cda-modulo-clientes.js"></script>
//   <script>montarModuloClientes('container-clientes');</script>
// ════════════════════════════════════════════════════════════════════

async function montarModuloClientes(containerId, opts) {
  opts = opts || {};
  var onSync = typeof opts.onSync === 'function' ? opts.onSync : null;
  var host = document.getElementById(containerId);
  if (!host) { console.error('cda-modulo-clientes: container #' + containerId + ' não encontrado'); return; }

  var ST = {
    clientes: [], canais: [], clienteCanais: [],
    pg: 1, pp: 50, editId: null, cTags: []
  };
  function sync() { if (onSync) onSync(ST.clientes.slice()); }

  host.innerHTML =
    '<div class="row-bt">' +
      '<div><div class="sec-t">Clientes</div><div class="sec-d">Base completa de clientes</div></div>' +
      '<div style="display:flex;gap:7px;">' +
        '<button class="btn" id="cdacli-btn-imp">⬆ Importar XLSX</button>' +
        '<button class="btn" id="cdacli-btn-exp">⬇ Exportar XLSX</button>' +
        '<button class="btn rust" id="cdacli-btn-novo">＋ Novo Cliente</button>' +
      '</div>' +
      '<input type="file" id="cdacli-file" accept=".xlsx,.xls" style="display:none">' +
    '</div>' +
    '<div class="fb">' +
      '<select id="cdacli-f-canal"><option value="">Todos os canais</option></select>' +
      '<select id="cdacli-f-uf"><option value="">Todos os estados</option></select>' +
      '<input type="text" id="cdacli-f-busca" placeholder="Buscar por nome, e-mail, CPF...">' +
      '<select id="cdacli-f-sexo"><option value="">Sexo</option><option value="F">Feminino</option><option value="M">Masculino</option></select>' +
      '<select id="cdacli-f-tipopj"><option value="">PF / PJ</option><option value="fisica">Pessoa Física</option><option value="juridica">Pessoa Jurídica</option></select>' +
      '<select id="cdacli-f-tipo">' +
        '<option value="">Tipo Comercial (todos)</option>' +
        '<option value="__vazio__">Cliente Convertido (sem tipo)</option>' +
        '<option value="lead_b2c">Lead / Cliente Final (B2C)</option>' +
        '<option value="canal_b2b">Canal / Parceiro (B2B)</option>' +
        '<option value="artista">Artista / Collab</option>' +
        '<option value="imprensa">Imprensa / Influenciador</option>' +
      '</select>' +
      '<select id="cdacli-f-origem"><option value="">Origem dos Dados (todas)</option></select>' +
      '<select id="cdacli-f-resp"><option value="">Responsável Comercial (todos)</option></select>' +
      '<span class="fc" id="cdacli-cnt"></span>' +
    '</div>' +
    '<div class="tw">' +
      '<div class="th"><h3>Cadastro de Clientes</h3></div>' +
      '<div class="ts"><table>' +
        '<thead><tr><th>Canal de Venda</th><th>Cidade / UF</th><th>Nome</th><th>Sexo</th><th>E-mail</th><th>Telefone</th><th>Tipo</th><th>Tipo Comercial</th><th></th></tr></thead>' +
        '<tbody id="cdacli-tb"></tbody>' +
      '</table></div>' +
      '<div id="cdacli-pag" style="padding:10px;text-align:right"></div>' +
    '</div>' +
    '<div class="mo" id="cdacli-modal">' +
      '<div class="mo-box">' +
        '<div class="mo-h"><h3 id="cdacli-modal-title">Novo Cliente</h3><button class="mo-x" id="cdacli-modal-x">✕</button></div>' +
        '<div class="mo-b"><div class="fg">' +
          '<div class="fgr" style="grid-column:1/-1"><label>Nome Completo *</label><input type="text" id="cdacli-m-nome"></div>' +
          '<div class="fgr"><label>E-mail</label><input type="email" id="cdacli-m-email"></div>' +
          '<div class="fgr"><label>CPF</label><input type="text" id="cdacli-m-cpf"></div>' +
          '<div class="fgr"><label>Sexo</label><select id="cdacli-m-sexo"><option value="">—</option><option value="F">Feminino</option><option value="M">Masculino</option></select></div>' +
          '<div class="fgr"><label>Nascimento</label><input type="date" id="cdacli-m-nasc"></div>' +
          '<div class="fgr"><label>Celular</label><input type="text" id="cdacli-m-cel"></div>' +
          '<div class="fgr"><label>Telefone Principal</label><input type="text" id="cdacli-m-tel-principal"></div>' +
          '<div class="fgr"><label>Telefone Comercial</label><input type="text" id="cdacli-m-tel-comercial"></div>' +
          '<hr class="fdiv"><div class="fsec">Classificação</div>' +
          '<div class="fgr"><label>Grupo</label><input type="text" id="cdacli-m-grupo" placeholder="Ex: VIP, Atacado..."></div>' +
          '<div class="fgr"><label>Tipo</label><select id="cdacli-m-tipopj"><option value="">—</option><option value="fisica">Pessoa Física</option><option value="juridica">Pessoa Jurídica</option></select></div>' +
          '<div class="fgr"><label>Ativo</label><select id="cdacli-m-ativo"><option value="sim">Sim</option><option value="nao">Não</option></select></div>' +
          '<hr class="fdiv"><div class="fsec">Dados Jurídicos <small style="font-weight:400">(Pessoa Jurídica)</small></div>' +
          '<div class="fgr"><label>RG</label><input type="text" id="cdacli-m-rg"></div>' +
          '<div class="fgr"><label>CNPJ</label><input type="text" id="cdacli-m-cnpj"></div>' +
          '<div class="fgr" style="grid-column:1/-1"><label>Razão Social</label><input type="text" id="cdacli-m-razao"></div>' +
          '<div class="fgr"><label>Inscrição Estadual</label><input type="text" id="cdacli-m-ie"></div>' +
          '<hr class="fdiv"><div class="fsec">Endereço</div>' +
          '<div class="fgr" style="grid-column:1/-1"><label>Logradouro</label><input type="text" id="cdacli-m-end"></div>' +
          '<div class="fgr"><label>Número</label><input type="text" id="cdacli-m-num"></div>' +
          '<div class="fgr"><label>Complemento</label><input type="text" id="cdacli-m-comp"></div>' +
          '<div class="fgr"><label>Referência</label><input type="text" id="cdacli-m-ref"></div>' +
          '<div class="fgr"><label>Bairro</label><input type="text" id="cdacli-m-bai"></div>' +
          '<div class="fgr"><label>Cidade</label><input type="text" id="cdacli-m-cid"></div>' +
          '<div class="fgr"><label>UF</label><input type="text" id="cdacli-m-uf" maxlength="2"></div>' +
          '<div class="fgr"><label>CEP</label><input type="text" id="cdacli-m-cep"></div>' +
          '<div class="fgr"><label>País</label><input type="text" id="cdacli-m-pais" placeholder="Brasil"></div>' +
          '<div class="fgr"><label>Situação</label><select id="cdacli-m-sit"><option value="pendente">Pendente</option><option value="aprovado">Aprovado</option></select></div>' +
          '<hr class="fdiv"><div class="fsec">🎯 Dados Comerciais</div>' +
          '<div class="fgr"><label>Tipo Comercial</label><select id="cdacli-m-tipo">' +
            '<option value="">— Cliente Convertido (LI) —</option>' +
            '<option value="lead_b2c">Lead / Cliente Final (B2C)</option>' +
            '<option value="canal_b2b">Canal / Parceiro (B2B)</option>' +
            '<option value="artista">Artista / Collab</option>' +
            '<option value="imprensa">Imprensa / Influenciador</option>' +
          '</select></div>' +
          '<div class="fgr"><label>Origem dos Dados</label><select id="cdacli-m-origem-dados"></select></div>' +
          '<div class="fgr"><label>Instagram</label><input type="text" id="cdacli-m-rede" placeholder="@usuario"></div>' +
          '<div class="fgr"><label>Origem</label><input type="text" id="cdacli-m-origem" placeholder="Ex: indicação, evento..."></div>' +
          '<div class="fgr"><label>Responsável Comercial</label><input type="text" id="cdacli-m-resp"></div>' +
          '<div class="fgr" style="grid-column:1/-1"><label>Tags (separadas por vírgula)</label><input type="text" id="cdacli-m-tags" placeholder="ex: vip, recompra"></div>' +
          '<div class="fgr" style="grid-column:1/-1"><label>Observações Comerciais</label><textarea id="cdacli-m-obs" rows="2"></textarea></div>' +
          '<hr class="fdiv"><div class="fsec">Collabs / Canais Vinculados</div>' +
          '<div style="grid-column:1/-1">' +
            '<div class="ct" id="cdacli-m-ctags"></div>' +
            '<div class="acr"><select id="cdacli-m-csel"><option value="">Selecione canal...</option></select><button class="btn sm" id="cdacli-btn-addcanal">+ Vincular</button></div>' +
          '</div>' +
        '</div></div>' +
        '<div class="mo-f"><button class="btn" id="cdacli-m-cancelar">Cancelar</button><button class="btn rust" id="cdacli-m-salvar">💾 Salvar</button></div>' +
      '</div>' +
    '</div>';

  try {
    var res = await Promise.all([cdaCarregarClientes(), cdaCarregarCanais(), cdaCarregarClienteCanais()]);
    ST.clientes = res[0]; ST.canais = res[1]; ST.clienteCanais = res[2];
    sync();
  } catch (err) {
    console.error(err);
    host.querySelector('#cdacli-tb').innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--rust,#c0392b);padding:20px">Erro ao carregar dados do Supabase. Veja o console.</td></tr>';
    return;
  }

  var canalById = {}; ST.canais.forEach(function (c) { canalById[String(c.id)] = c; });

  function popularFiltrosBase() {
    host.querySelector('#cdacli-f-canal').innerHTML = '<option value="">Todos os canais</option>' +
      ST.canais.slice().sort(function (a, b) { return a.nome.localeCompare(b.nome); })
        .map(function (c) { return '<option value="' + c.id + '">' + c.nome + '</option>'; }).join('');
    var ufs = [...new Set(ST.clientes.map(function (c) { return c.estado; }).filter(Boolean))].sort();
    host.querySelector('#cdacli-f-uf').innerHTML = '<option value="">Todos os estados</option>' +
      ufs.map(function (u) { return '<option value="' + u + '">' + u + '</option>'; }).join('');
    host.querySelector('#cdacli-f-origem').innerHTML = '<option value="">Origem dos Dados (todas)</option>' +
      CDA_ORIGEM_DADOS_OPCOES.map(function (o) { return '<option value="' + o + '">' + o + '</option>'; }).join('');
    var resps = [...new Set(ST.clientes.map(function (c) { return c.responsavelComercial; }).filter(Boolean))].sort();
    host.querySelector('#cdacli-f-resp').innerHTML = '<option value="">Responsável Comercial (todos)</option>' +
      resps.map(function (r) { return '<option value="' + r + '">' + r + '</option>'; }).join('');
  }
  popularFiltrosBase();

  function getFiltro() {
    var busca = host.querySelector('#cdacli-f-busca').value.toLowerCase();
    var fCanal = host.querySelector('#cdacli-f-canal').value;
    var fUf = host.querySelector('#cdacli-f-uf').value;
    var fSexo = host.querySelector('#cdacli-f-sexo').value;
    var fTipoPj = host.querySelector('#cdacli-f-tipopj').value;
    var fTipo = host.querySelector('#cdacli-f-tipo').value;
    var fOrigem = host.querySelector('#cdacli-f-origem').value;
    var fResp = host.querySelector('#cdacli-f-resp').value;
    return ST.clientes.filter(function (c) {
      if (fUf && c.estado !== fUf) return false;
      if (fSexo && c.sexo !== fSexo) return false;
      if (fTipoPj && c.tipo !== fTipoPj) return false;
      if (fTipo) { if (fTipo === '__vazio__') { if (c.tipoComercial) return false; } else if (c.tipoComercial !== fTipo) return false; }
      if (fOrigem && c.origemDados !== fOrigem) return false;
      if (fResp && (c.responsavelComercial || '') !== fResp) return false;
      if (fCanal) {
        var vinc = ST.clienteCanais.some(function (x) { return String(x.clienteId) === String(c.id) && String(x.canalId) === String(fCanal); });
        if (!vinc) return false;
      }
      if (busca) {
        var alvo = ((c.nome || '') + ' ' + (c.email || '') + ' ' + (c.cpf || '') + ' ' + (c.cidade || '')).toLowerCase();
        if (alvo.indexOf(busca) === -1) return false;
      }
      return true;
    });
  }

  function render() {
    var f = getFiltro();
    var st = (ST.pg - 1) * ST.pp, pg = f.slice(st, st + ST.pp);
    var tb = host.querySelector('#cdacli-tb');
    tb.innerHTML = pg.map(function (c) {
      var tel = c['telefone-celular'] || c['telefone-principal'] || '—';
      var sexo = c.sexo === 'F' ? '<span class="badge b-rust">F</span>' : c.sexo === 'M' ? '<span class="badge b-vio">M</span>' : '—';
      var tipo = c.tipo ? '<span class="badge b-ink" style="font-size:9px">' + c.tipo + '</span>' : '—';
      var meusCanais = ST.clienteCanais.filter(function (x) { return String(x.clienteId) === String(c.id); }).map(function (x) {
        var cv = canalById[String(x.canalId)];
        return cv ? cv.nome : null;
      }).filter(Boolean);
      var canalBadge = meusCanais.length ? '<span class="badge b-vio" style="font-size:9px">' + meusCanais[0] + (meusCanais.length > 1 ? ' +' + (meusCanais.length - 1) : '') + '</span>' : '<span class="tmu">—</span>';
      var tipoComBadge = c.tipoComercial ? '<span class="badge b-ink" style="font-size:9px">' + (CDA_TIPO_COMERCIAL_LABEL[c.tipoComercial] || c.tipoComercial) + '</span>' : '<span class="tmu">—</span>';
      return '<tr>' +
        '<td>' + canalBadge + '</td>' +
        '<td>' + (c.cidade || '—') + ' / ' + (c.estado || '—') + '</td>' +
        '<td><b>' + (c.nome || '—') + '</b></td>' +
        '<td>' + sexo + '</td>' +
        '<td class="tmu" style="font-size:11px">' + (c.email || '—') + '</td>' +
        '<td class="mn">' + tel + '</td>' +
        '<td>' + tipo + '</td>' +
        '<td>' + tipoComBadge + '</td>' +
        '<td><button class="btn sm" data-edit="' + c.id + '">✏</button> <button class="btn sm" data-del="' + c.id + '">🗑</button></td>' +
        '</tr>';
    }).join('') || '<tr><td colspan="9" style="text-align:center;color:var(--muted);padding:20px">Nenhum cliente encontrado com os filtros atuais.</td></tr>';

    host.querySelector('#cdacli-cnt').textContent = f.length.toLocaleString('pt-BR') + ' cliente(s) — base total: ' + ST.clientes.length.toLocaleString('pt-BR');

    var tp = Math.ceil(f.length / ST.pp);
    var pgHtml = '<span class="pi">Pág ' + ST.pg + '/' + (tp || 1) + '</span>';
    if (ST.pg > 1) pgHtml = '<button class="pb" data-pgprev="1">‹</button>' + pgHtml;
    if (ST.pg < tp) pgHtml += '<button class="pb" data-pgnext="1">›</button>';
    host.querySelector('#cdacli-pag').innerHTML = pgHtml;

    tb.querySelectorAll('[data-edit]').forEach(function (btn) { btn.addEventListener('click', function () { abrirModal(btn.dataset.edit); }); });
    tb.querySelectorAll('[data-del]').forEach(function (btn) { btn.addEventListener('click', function () { excluirCliente(btn.dataset.del); }); });
    var prevBtn = host.querySelector('[data-pgprev]'); if (prevBtn) prevBtn.addEventListener('click', function () { ST.pg--; render(); });
    var nextBtn = host.querySelector('[data-pgnext]'); if (nextBtn) nextBtn.addEventListener('click', function () { ST.pg++; render(); });
  }
  function rerenderFromStart() { ST.pg = 1; render(); }

  ['cdacli-f-canal', 'cdacli-f-uf', 'cdacli-f-sexo', 'cdacli-f-tipopj', 'cdacli-f-tipo', 'cdacli-f-origem', 'cdacli-f-resp'].forEach(function (id) {
    host.querySelector('#' + id).addEventListener('change', rerenderFromStart);
  });
  host.querySelector('#cdacli-f-busca').addEventListener('input', rerenderFromStart);

  // ── Modal (Novo/Editar) ──
  var modal = host.querySelector('#cdacli-modal');
  function rCTags() {
    var wrap = host.querySelector('#cdacli-m-ctags');
    wrap.innerHTML = ST.cTags.map(function (cid) {
      var cv = canalById[String(cid)];
      return '<span class="badge b-vio">' + (cv ? cv.nome : cid) + ' <a href="#" data-rmcanal="' + cid + '" style="color:inherit">✕</a></span>';
    }).join('') || '<span class="tmu" style="font-size:11px">Nenhum canal vinculado</span>';
    wrap.querySelectorAll('[data-rmcanal]').forEach(function (a) {
      a.addEventListener('click', function (e) { e.preventDefault(); ST.cTags = ST.cTags.filter(function (x) { return x !== a.dataset.rmcanal; }); rCTags(); });
    });
  }
  function abrirModal(id) {
    ST.editId = id || null;
    var c = id ? ST.clientes.find(function (x) { return String(x.id) === String(id); }) : null;
    host.querySelector('#cdacli-modal-title').textContent = id ? 'Editar Cliente' : 'Novo Cliente';
    var g = function (fid, val) { var el = host.querySelector('#' + fid); if (el) el.value = val || ''; };
    g('cdacli-m-nome', c && c.nome); g('cdacli-m-email', c && c.email); g('cdacli-m-cpf', c && c.cpf);
    g('cdacli-m-sexo', c && c.sexo);
    g('cdacli-m-cel', c && (c['telefone-celular'])); g('cdacli-m-tel-principal', c && c['telefone-principal']); g('cdacli-m-tel-comercial', c && c['telefone-comercial']);
    g('cdacli-m-grupo', c && c.grupo); g('cdacli-m-tipopj', c && c.tipo);
    host.querySelector('#cdacli-m-ativo').value = c ? (c.ativo || 'sim') : 'sim';
    g('cdacli-m-rg', c && c.rg); g('cdacli-m-cnpj', c && c.cnpj); g('cdacli-m-razao', c && c['razao-social']); g('cdacli-m-ie', c && c.ie);
    g('cdacli-m-end', c && c.endereco); g('cdacli-m-num', c && c.numero); g('cdacli-m-comp', c && c.complemento); g('cdacli-m-ref', c && c.referencia);
    g('cdacli-m-bai', c && c.bairro); g('cdacli-m-cid', c && c.cidade); g('cdacli-m-uf', c && c.estado); g('cdacli-m-cep', c && c.cep); g('cdacli-m-pais', c && c.pais);
    host.querySelector('#cdacli-m-sit').value = c ? (c.situacao || 'pendente') : 'pendente';
    var nascEl = host.querySelector('#cdacli-m-nasc');
    if (c && c['data-nascimento']) {
      var p = c['data-nascimento'].split('/');
      nascEl.value = p.length === 3 ? p[2] + '-' + p[1] + '-' + p[0] : '';
    } else nascEl.value = '';
    host.querySelector('#cdacli-m-tipo').value = c ? (c.tipoComercial || '') : '';
    g('cdacli-m-rede', c && c.instagram);
    var selOrigemDados = host.querySelector('#cdacli-m-origem-dados');
    selOrigemDados.innerHTML = '<option value="">—</option>' + CDA_ORIGEM_DADOS_OPCOES.map(function (o) { return '<option value="' + o + '">' + o + '</option>'; }).join('');
    selOrigemDados.value = c ? (c.origemDados || '') : '';
    g('cdacli-m-origem', c && c.origem); g('cdacli-m-resp', c && c.responsavelComercial);
    g('cdacli-m-tags', c && (c.tagsComercial || []).join(', ')); g('cdacli-m-obs', c && c.obsComercial);
    var selCanal = host.querySelector('#cdacli-m-csel');
    selCanal.innerHTML = '<option value="">Selecione canal...</option>' + ST.canais.slice().sort(function (a, b) { return a.nome.localeCompare(b.nome); })
      .map(function (cv) { return '<option value="' + cv.id + '">' + cv.nome + '</option>'; }).join('');
    ST.cTags = c ? ST.clienteCanais.filter(function (x) { return String(x.clienteId) === String(c.id); }).map(function (x) { return String(x.canalId); }) : [];
    rCTags();
    modal.classList.add('op');
  }
  function fecharModal() { modal.classList.remove('op'); }

  host.querySelector('#cdacli-btn-addcanal').addEventListener('click', function () {
    var v = host.querySelector('#cdacli-m-csel').value;
    if (v && ST.cTags.indexOf(v) === -1) { ST.cTags.push(v); rCTags(); }
  });

  async function salvarCliente() {
    var nome = host.querySelector('#cdacli-m-nome').value.trim();
    if (!nome) { alert('Informe o nome do cliente.'); return; }
    var g = function (id) { var el = host.querySelector('#' + id); return el ? el.value : ''; };
    var nascRaw = g('cdacli-m-nasc');
    var nascFmt = nascRaw ? (nascRaw.split('-').length === 3 ? nascRaw.split('-')[2] + '/' + nascRaw.split('-')[1] + '/' + nascRaw.split('-')[0] : nascRaw) : '';
    var tagsRaw = g('cdacli-m-tags').trim();
    var o = {
      id: ST.editId || '',
      nome: nome, email: g('cdacli-m-email'), cpf: g('cdacli-m-cpf'), sexo: g('cdacli-m-sexo'),
      'data-nascimento': nascFmt,
      'telefone-celular': g('cdacli-m-cel'), 'telefone-principal': g('cdacli-m-tel-principal'), 'telefone-comercial': g('cdacli-m-tel-comercial'),
      grupo: g('cdacli-m-grupo'), tipo: g('cdacli-m-tipopj'), ativo: g('cdacli-m-ativo'),
      rg: g('cdacli-m-rg'), cnpj: g('cdacli-m-cnpj'), 'razao-social': g('cdacli-m-razao'), ie: g('cdacli-m-ie'),
      endereco: g('cdacli-m-end'), numero: g('cdacli-m-num'), complemento: g('cdacli-m-comp'), referencia: g('cdacli-m-ref'),
      bairro: g('cdacli-m-bai'), cidade: g('cdacli-m-cid'), estado: g('cdacli-m-uf').toUpperCase(), cep: g('cdacli-m-cep'), pais: g('cdacli-m-pais'),
      situacao: g('cdacli-m-sit'),
      tipoComercial: g('cdacli-m-tipo'), instagram: g('cdacli-m-rede'), origem: g('cdacli-m-origem'),
      origemDados: g('cdacli-m-origem-dados'), responsavelComercial: g('cdacli-m-resp'),
      tagsComercial: tagsRaw ? tagsRaw.split(',').map(function (t) { return t.trim(); }).filter(Boolean) : [],
      obsComercial: g('cdacli-m-obs')
    };
    try {
      var salvo = await cdaSalvarCliente(o);
      if (ST.editId) {
        var idx = ST.clientes.findIndex(function (x) { return String(x.id) === String(ST.editId); });
        ST.clientes[idx] = salvo;
      } else {
        ST.clientes.push(salvo);
      }
      var antigos = ST.clienteCanais.filter(function (x) { return String(x.clienteId) === String(salvo.id); }).map(function (x) { return x.canalId; });
      var paraAdicionar = ST.cTags.filter(function (c) { return antigos.indexOf(c) === -1; });
      var paraRemover = antigos.filter(function (c) { return ST.cTags.indexOf(c) === -1; });
      for (var i = 0; i < paraAdicionar.length; i++) await cdaVincularClienteCanal(salvo.id, paraAdicionar[i]);
      for (var j = 0; j < paraRemover.length; j++) await cdaDesvincularClienteCanal(salvo.id, paraRemover[j]);
      ST.clienteCanais = ST.clienteCanais.filter(function (x) { return String(x.clienteId) !== String(salvo.id); })
        .concat(ST.cTags.map(function (cid) { return { clienteId: String(salvo.id), canalId: String(cid) }; }));
      fecharModal();
      popularFiltrosBase();
      rerenderFromStart();
      sync();
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar no Supabase — veja o console.');
    }
  }

  async function excluirCliente(id) {
    if (!confirm('Excluir este cliente? Isso remove o registro da tabela clientes (compartilhada entre os módulos).')) return;
    try {
      await cdaExcluirCliente(id);
      ST.clientes = ST.clientes.filter(function (x) { return String(x.id) !== String(id); });
      render();
      sync();
    } catch (err) {
      console.error(err);
      alert('Erro ao excluir — veja o console.');
    }
  }

  host.querySelector('#cdacli-btn-novo').addEventListener('click', function () { abrirModal(null); });
  host.querySelector('#cdacli-m-cancelar').addEventListener('click', fecharModal);
  host.querySelector('#cdacli-modal-x').addEventListener('click', fecharModal);
  host.querySelector('#cdacli-m-salvar').addEventListener('click', salvarCliente);

  // ── Importar / Exportar XLSX ──
  host.querySelector('#cdacli-btn-imp').addEventListener('click', function () { host.querySelector('#cdacli-file').click(); });
  host.querySelector('#cdacli-file').addEventListener('change', function (e) {
    var file = e.target.files[0];
    if (!file) return;
    var rd = new FileReader();
    rd.onload = async function (ev) {
      try {
        var wb = XLSX.read(ev.target.result, { type: 'array' });
        var ws = wb.Sheets[wb.SheetNames[0]];
        var rows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });
        if (!rows.length) { alert('Nenhum dado encontrado na planilha.'); return; }
        var cv = function (v) { var s = String(v || '').trim(); return (s === 'nan' || s === 'NaN' || s === '<NA>') ? '' : s.replace(/\.0$/, ''); };
        var added = 0, updated = 0, erros = 0;
        for (var i = 0; i < rows.length; i++) {
          var row = rows[i];
          var idRaw = cv(row['id'] || row['ID']);
          var existente = idRaw ? ST.clientes.find(function (x) { return String(x.id) === idRaw; }) : null;
          var o = {
            id: existente ? existente.id : (idRaw || ''),
            nome: cv(row['nome']), email: cv(row['email']), cpf: cv(row['cpf']), cnpj: cv(row['cnpj']),
            sexo: cv(row['sexo']), 'data-nascimento': cv(row['data-nascimento']),
            'telefone-celular': cv(row['telefone-celular']), 'telefone-principal': cv(row['telefone-principal']), 'telefone-comercial': cv(row['telefone-comercial']),
            grupo: cv(row['grupo']), tipo: cv(row['tipo']), ativo: cv(row['ativo']) || 'sim',
            rg: cv(row['rg']), 'razao-social': cv(row['razao-social']), ie: cv(row['ie']),
            endereco: cv(row['endereco']), numero: cv(row['numero']), complemento: cv(row['complemento']), referencia: cv(row['referencia']),
            bairro: cv(row['bairro']), cidade: cv(row['cidade']), estado: cv(row['estado']), cep: cv(row['cep']), pais: cv(row['pais']) || 'Brasil',
            situacao: cv(row['situacao']) || 'pendente'
          };
          if (!o.nome) continue;
          try {
            var salvo = await cdaSalvarCliente(o);
            if (existente) { var idx = ST.clientes.findIndex(function (x) { return String(x.id) === String(existente.id); }); ST.clientes[idx] = salvo; updated++; }
            else { ST.clientes.push(salvo); added++; }
          } catch (e2) { erros++; console.error(e2); }
        }
        host.querySelector('#cdacli-file').value = '';
        popularFiltrosBase();
        rerenderFromStart();
        sync();
        alert('Importação concluída: ' + added + ' adicionados, ' + updated + ' atualizados' + (erros ? ', ' + erros + ' com erro' : '') + '.');
      } catch (err) {
        console.error(err);
        alert('Erro ao importar: ' + err.message);
      }
    };
    rd.readAsArrayBuffer(file);
  });

  host.querySelector('#cdacli-btn-exp').addEventListener('click', function () {
    var f = getFiltro();
    var header = ['id', 'email', 'nome', 'grupo', 'ativo', 'sexo', 'data-nascimento', 'tipo', 'rg', 'cpf', 'cnpj', 'razao-social', 'ie', 'telefone-principal', 'telefone-comercial', 'telefone-celular', 'endereco', 'numero', 'complemento', 'referencia', 'bairro', 'cidade', 'estado', 'cep', 'pais', 'situacao', 'tipo_comercial', 'origem_dados', 'responsavel_comercial', 'canal_principal', 'canais_adicionais'];
    var data = f.map(function (c) {
      var meusCanais = ST.clienteCanais.filter(function (x) { return String(x.clienteId) === String(c.id); }).map(function (x) { var cv = canalById[String(x.canalId)]; return cv ? cv.nome : ''; }).filter(Boolean);
      return [String(c.id || ''), c.email, c.nome, c.grupo, c.ativo, c.sexo, c['data-nascimento'], c.tipo, c.rg, c.cpf, c.cnpj, c['razao-social'], c.ie, c['telefone-principal'], c['telefone-comercial'], c['telefone-celular'], c.endereco, c.numero, c.complemento, c.referencia, c.bairro, c.cidade, c.estado, c.cep, c.pais, c.situacao, c.tipoComercial, c.origemDados, c.responsavelComercial, meusCanais[0] || '', meusCanais.slice(1).join('; ')];
    });
    var wb = XLSX.utils.book_new();
    var ws = XLSX.utils.aoa_to_sheet([header].concat(data));
    ws['!cols'] = header.map(function () { return { wch: 18 }; });
    XLSX.utils.book_append_sheet(wb, ws, 'Clientes');
    var wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    var blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = 'clientes_cicloarte.xlsx';
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  });

  render();
}

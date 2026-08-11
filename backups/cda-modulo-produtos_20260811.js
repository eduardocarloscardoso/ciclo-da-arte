// ════════════════════════════════════════════════════════════════════
// cda-modulo-produtos.js
// Interface compartilhada do Cadastro de Produtos — leitura + escrita
// nos dois módulos (Financeiro e Comercial).
//
// Requer cda-dados-compartilhados.js carregado antes (usa
// cdaCarregarProdutos, cdaSalvarProduto, cdaCarregarCanais,
// cdaCarregarParceiros, cdaCarregarTiposProduto, cdaCarregarColecoes).
//
// Uso:
//   <div id="container-produtos"></div>
//   <script src="cda-dados-compartilhados.js"></script>
//   <script src="cda-modulo-produtos.js"></script>
//   <script>montarModuloProdutos('container-produtos', {editavel: true});</script>
// ════════════════════════════════════════════════════════════════════

async function montarModuloProdutos(containerId, opts) {
  opts = opts || {};
  var editavel = !!opts.editavel;
  var onSync = typeof opts.onSync === 'function' ? opts.onSync : null;
  var host = document.getElementById(containerId);
  if (!host) { console.error('cda-modulo-produtos: container #' + containerId + ' não encontrado'); return; }

  var ST = { produtos: [], canais: [], parceiros: [], tipos: [], colecoes: [], pg: 1, pp: 50, editId: null };
  function sync() { if (onSync) onSync(ST.produtos.slice()); }

  host.innerHTML =
    '<div class="row-bt">' +
      '<div><div class="sec-t">Produtos</div><div class="sec-d">Catálogo com tipo de peça, coleção, canal e status</div></div>' +
      (editavel ? '<div style="display:flex;gap:7px;"><button class="btn" id="cdap-btn-imp">⬆ Importar XLSX</button><button class="btn rust" id="cdap-btn-novo">＋ Novo Produto</button></div><input type="file" id="cdap-file" accept=".xlsx,.xls" style="display:none">' : '') +
    '</div>' +
    '<div class="fb">' +
      '<input type="text" id="cdap-f-nome" placeholder="Buscar produto...">' +
      '<select id="cdap-f-collab"><option value="">Todos os Collabs/Vendedores</option></select>' +
      '<select id="cdap-f-canal"><option value="">Todos os canais</option></select>' +
      '<select id="cdap-f-tipo"><option value="">Tipo de Peça</option></select>' +
      '<select id="cdap-f-colecao"><option value="">Coleção</option></select>' +
      '<select id="cdap-f-status"><option value="">Status (todos)</option><option value="Ativo">Ativo</option><option value="Indisponível">Indisponível</option><option value="Desativado">Desativado</option></select>' +
      '<span class="fc" id="cdap-cnt"></span>' +
    '</div>' +
    '<div class="tw">' +
      '<div class="th"><h3>Catálogo</h3></div>' +
      '<div class="ts"><table>' +
        '<thead><tr><th>Collab / Vendedor</th><th>Canal de Venda</th><th>Coleção</th><th>Tipo</th><th>Produto</th><th>Status</th><th>Preço Ref.</th>' + (editavel ? '<th></th>' : '') + '</tr></thead>' +
        '<tbody id="cdap-tb"></tbody>' +
      '</table></div>' +
      '<div id="cdap-pag" style="padding:10px;text-align:right"></div>' +
    '</div>' +
    (editavel ?
      '<div class="mo" id="cdap-modal">' +
        '<div class="mo-box">' +
          '<div class="mo-h"><h3 id="cdap-modal-title">Novo Produto</h3><button class="mo-x" id="cdap-modal-x">✕</button></div>' +
          '<div class="mo-b"><div class="fg">' +
            '<div class="fgr"><label>Collab / Vendedor</label><select id="cdap-m-parceiro"><option value="">— Selecione —</option></select></div>' +
            '<div class="fgr"><label>Canal de Venda</label><select id="cdap-m-canal"><option value="">— Selecione —</option></select></div>' +
            '<div class="fgr"><label>Coleção</label><select id="cdap-m-colecao"><option value="">— Selecione —</option></select></div>' +
            '<div class="fgr"><label>Tipo de Peça</label><select id="cdap-m-tipo"><option value="">— Selecione —</option></select></div>' +
            '<div class="fgr" style="grid-column:1/-1"><label>Nome do Produto *</label><input type="text" id="cdap-m-nome" placeholder="Ex: T-SHIRT TOUR DUDA"></div>' +
            '<div class="fgr"><label>Preço de Referência (R$)</label><input type="number" id="cdap-m-preco" step="0.01"></div>' +
            '<div class="fgr"><label>Status</label><select id="cdap-m-status"><option value="Ativo">Ativo</option><option value="Indisponível">Indisponível</option><option value="Desativado">Desativado</option></select></div>' +
            '<div class="fgr"><label>Cor</label><input type="text" id="cdap-m-cor" placeholder="Ex: Branco, Preto"></div>' +
            '<div class="fgr" style="grid-column:1/-1"><label>Tamanhos Disponíveis</label><input type="text" id="cdap-m-tam" placeholder="P, M, G, GG, XGG"></div>' +
          '</div></div>' +
          '<div class="mo-f"><button class="btn" id="cdap-m-cancelar">Cancelar</button><button class="btn rust" id="cdap-m-salvar">💾 Salvar</button></div>' +
        '</div>' +
      '</div>'
    : '');

  try {
    var res = await Promise.all([
      cdaCarregarProdutos(), cdaCarregarCanais(), cdaCarregarParceiros(),
      cdaCarregarTiposProduto(), cdaCarregarColecoes()
    ]);
    ST.produtos = res[0]; ST.canais = res[1]; ST.parceiros = res[2];
    ST.tipos = res[3]; ST.colecoes = res[4];
    sync();
  } catch (err) {
    console.error(err);
    host.querySelector('#cdap-tb').innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--rust,#c0392b);padding:20px">Erro ao carregar dados do Supabase. Veja o console.</td></tr>';
    return;
  }

  var canalById = {}; ST.canais.forEach(function (c) { canalById[String(c.id)] = c; });
  var parceiroById = {}; ST.parceiros.forEach(function (p) { parceiroById[String(p.id)] = p; });

  host.querySelector('#cdap-f-collab').innerHTML += ST.parceiros.slice().sort(function (a, b) { return a.nome.localeCompare(b.nome); })
    .map(function (p) { return '<option value="' + p.id + '">' + p.nome + '</option>'; }).join('');
  host.querySelector('#cdap-f-canal').innerHTML += ST.canais.slice().sort(function (a, b) { return a.nome.localeCompare(b.nome); })
    .map(function (c) { return '<option value="' + c.id + '">' + c.nome + '</option>'; }).join('');
  host.querySelector('#cdap-f-tipo').innerHTML += ST.tipos.slice().sort().map(function (t) { return '<option value="' + t + '">' + t + '</option>'; }).join('');
  host.querySelector('#cdap-f-colecao').innerHTML += ST.colecoes.slice().sort().map(function (c) { return '<option value="' + c + '">' + c + '</option>'; }).join('');

  function getFiltro() {
    var fNome = host.querySelector('#cdap-f-nome').value.toLowerCase();
    var fCollab = host.querySelector('#cdap-f-collab').value;
    var fCanal = host.querySelector('#cdap-f-canal').value;
    var fTipo = host.querySelector('#cdap-f-tipo').value;
    var fColecao = host.querySelector('#cdap-f-colecao').value;
    var fStatus = host.querySelector('#cdap-f-status').value;
    return ST.produtos.filter(function (p) {
      if (fNome && (p.nome || '').toLowerCase().indexOf(fNome) === -1) return false;
      if (fCollab && String(p.parceiroId) !== fCollab) return false;
      if (fCanal && String(p.canalId) !== fCanal) return false;
      if (fTipo && p.tipo !== fTipo) return false;
      if (fColecao && p.colecao !== fColecao) return false;
      if (fStatus && (p.status || 'Ativo') !== fStatus) return false;
      return true;
    });
  }

  function badgeStatus(s) {
    s = s || 'Ativo';
    var cor = s === 'Ativo' ? 'sage' : (s === 'Desativado' ? 'rust' : 'ink');
    return '<span class="badge b-' + cor + '" style="font-size:9px">' + s + '</span>';
  }

  function render() {
    var f = getFiltro();
    f.sort(function (a, b) { return (a.nome || '').localeCompare(b.nome || ''); });
    var st = (ST.pg - 1) * ST.pp, pg = f.slice(st, st + ST.pp);
    var tb = host.querySelector('#cdap-tb');
    tb.innerHTML = pg.map(function (p) {
      var canal = canalById[p.canalId];
      var parceiro = parceiroById[p.parceiroId];
      return '<tr>' +
        '<td>' + (parceiro ? parceiro.nome : '<span class="tmu">—</span>') + '</td>' +
        '<td>' + (canal ? '<span class="badge b-vio" style="font-size:9px">' + canal.nome + '</span>' : '<span class="tmu">—</span>') + '</td>' +
        '<td>' + (p.colecao || '—') + '</td>' +
        '<td>' + (p.tipo || '—') + '</td>' +
        '<td><b>' + (p.nome || '—') + '</b></td>' +
        '<td>' + badgeStatus(p.status) + '</td>' +
        '<td>' + (p.preco != null ? 'R$ ' + Number(p.preco).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '—') + '</td>' +
        (editavel ? '<td><button class="btn sm" data-edit="' + p.id + '">✏</button> <button class="btn sm" data-del="' + p.id + '">🗑</button></td>' : '') +
        '</tr>';
    }).join('') || '<tr><td colspan="' + (editavel ? 8 : 7) + '" style="text-align:center;color:var(--muted);padding:20px">Nenhum produto encontrado com os filtros atuais.</td></tr>';

    host.querySelector('#cdap-cnt').textContent = f.length.toLocaleString('pt-BR') + ' produto(s) — base total: ' + ST.produtos.length.toLocaleString('pt-BR');

    var tp = Math.ceil(f.length / ST.pp);
    var pgHtml = '<span class="pi">Pág ' + ST.pg + '/' + (tp || 1) + '</span>';
    if (ST.pg > 1) pgHtml = '<button class="pb" data-pgprev="1">‹</button>' + pgHtml;
    if (ST.pg < tp) pgHtml += '<button class="pb" data-pgnext="1">›</button>';
    host.querySelector('#cdap-pag').innerHTML = pgHtml;

    if (editavel) {
      tb.querySelectorAll('[data-edit]').forEach(function (btn) {
        btn.addEventListener('click', function () { abrirModal(btn.dataset.edit); });
      });
      tb.querySelectorAll('[data-del]').forEach(function (btn) {
        btn.addEventListener('click', function () { excluirProduto(btn.dataset.del); });
      });
    }
    var prevBtn = host.querySelector('[data-pgprev]');
    if (prevBtn) prevBtn.addEventListener('click', function () { ST.pg--; render(); });
    var nextBtn = host.querySelector('[data-pgnext]');
    if (nextBtn) nextBtn.addEventListener('click', function () { ST.pg++; render(); });
  }

  function rerenderFromStart() { ST.pg = 1; render(); }
  ['cdap-f-collab', 'cdap-f-canal', 'cdap-f-tipo', 'cdap-f-colecao', 'cdap-f-status'].forEach(function (id) {
    host.querySelector('#' + id).addEventListener('change', rerenderFromStart);
  });
  host.querySelector('#cdap-f-nome').addEventListener('input', rerenderFromStart);

  if (editavel) {
    var modal = host.querySelector('#cdap-modal');
    function abrirModal(id) {
      ST.editId = id || null;
      var p = id ? ST.produtos.find(function (x) { return String(x.id) === String(id); }) : null;
      host.querySelector('#cdap-modal-title').textContent = id ? 'Editar Produto' : 'Novo Produto';
      var selParc = host.querySelector('#cdap-m-parceiro');
      selParc.innerHTML = '<option value="">— Selecione —</option>' + ST.parceiros.slice().sort(function (a, b) { return a.nome.localeCompare(b.nome); })
        .map(function (x) { return '<option value="' + x.id + '">' + x.nome + '</option>'; }).join('');
      var selCanal = host.querySelector('#cdap-m-canal');
      selCanal.innerHTML = '<option value="">— Selecione —</option>' + ST.canais.slice().sort(function (a, b) { return a.nome.localeCompare(b.nome); })
        .map(function (x) { return '<option value="' + x.id + '">' + x.nome + '</option>'; }).join('');
      var selColecao = host.querySelector('#cdap-m-colecao');
      selColecao.innerHTML = '<option value="">— Selecione —</option>' + ST.colecoes.slice().sort()
        .map(function (x) { return '<option value="' + x + '">' + x + '</option>'; }).join('');
      var selTipo = host.querySelector('#cdap-m-tipo');
      selTipo.innerHTML = '<option value="">— Selecione —</option>' + ST.tipos.slice().sort()
        .map(function (x) { return '<option value="' + x + '">' + x + '</option>'; }).join('');

      selParc.value = p ? (p.parceiroId || '') : '';
      selCanal.value = p ? (p.canalId || '') : '';
      selColecao.value = p ? (p.colecao || '') : '';
      selTipo.value = p ? (p.tipo || '') : '';
      host.querySelector('#cdap-m-nome').value = p ? (p.nome || '') : '';
      host.querySelector('#cdap-m-preco').value = p ? (p.preco != null ? p.preco : '') : '';
      host.querySelector('#cdap-m-status').value = p ? (p.status || 'Ativo') : 'Ativo';
      host.querySelector('#cdap-m-cor').value = p ? (p.cor || '') : '';
      host.querySelector('#cdap-m-tam').value = p ? (p.tam || '') : '';

      // Auto-preenchimento cruzado Canal ↔ Collab/Vendedor
      function filtrarCanalPorParceiro(parceiroId) {
        var atual = selCanal.value;
        var filtrados = parceiroId ? ST.canais.filter(function (c) { return String(c.parceiroId) === String(parceiroId); }) : ST.canais;
        selCanal.innerHTML = '<option value="">— Selecione —</option>' + filtrados.slice().sort(function (a, b) { return a.nome.localeCompare(b.nome); })
          .map(function (x) { return '<option value="' + x.id + '">' + x.nome + '</option>'; }).join('');
        if (atual && filtrados.some(function (x) { return String(x.id) === String(atual); })) selCanal.value = atual;
      }
      selCanal.onchange = function () {
        var canal = canalById[selCanal.value];
        if (canal && canal.parceiroId) selParc.value = canal.parceiroId;
      };
      selParc.onchange = function () { filtrarCanalPorParceiro(selParc.value); };
      if (p && p.canalId) filtrarCanalPorParceiro(canalById[p.canalId] ? canalById[p.canalId].parceiroId : null);

      modal.classList.add('op');
    }
    function fecharModal() { modal.classList.remove('op'); }

    async function salvar() {
      var nome = host.querySelector('#cdap-m-nome').value.trim();
      if (!nome) { alert('Informe o nome do produto.'); return; }
      var o = {
        id: ST.editId || '',
        nome: nome,
        parceiroId: host.querySelector('#cdap-m-parceiro').value || null,
        canalId: host.querySelector('#cdap-m-canal').value || null,
        colecao: host.querySelector('#cdap-m-colecao').value || null,
        tipo: host.querySelector('#cdap-m-tipo').value || null,
        preco: parseFloat(host.querySelector('#cdap-m-preco').value) || null,
        status: host.querySelector('#cdap-m-status').value || 'Ativo',
        cor: host.querySelector('#cdap-m-cor').value.trim() || null,
        tam: host.querySelector('#cdap-m-tam').value.trim() || null
      };
      try {
        var salvo = await cdaSalvarProduto(o);
        if (ST.editId) {
          var idx = ST.produtos.findIndex(function (x) { return String(x.id) === String(ST.editId); });
          ST.produtos[idx] = salvo;
        } else {
          ST.produtos.push(salvo);
        }
        fecharModal();
        rerenderFromStart();
        sync();
      } catch (err) {
        console.error(err);
        alert('Erro ao salvar no Supabase — veja o console.');
      }
    }

    async function excluirProduto(id) {
      if (!confirm('Excluir este produto? Isso remove o registro do catálogo (compartilhado entre os módulos).')) return;
      try {
        await cdaExcluirProduto(id);
        ST.produtos = ST.produtos.filter(function (x) { return String(x.id) !== String(id); });
        render();
        sync();
      } catch (err) {
        console.error(err);
        alert('Erro ao excluir — veja o console.');
      }
    }

    host.querySelector('#cdap-btn-novo').addEventListener('click', function () { abrirModal(null); });
    host.querySelector('#cdap-m-cancelar').addEventListener('click', fecharModal);
    host.querySelector('#cdap-modal-x').addEventListener('click', fecharModal);
    host.querySelector('#cdap-m-salvar').addEventListener('click', salvar);

    host.querySelector('#cdap-btn-imp').addEventListener('click', function () { host.querySelector('#cdap-file').click(); });
    host.querySelector('#cdap-file').addEventListener('change', function (e) {
      var file = e.target.files[0];
      if (!file) return;
      var rd = new FileReader();
      rd.onload = async function (ev) {
        try {
          var wb = XLSX.read(ev.target.result, { type: 'array' });
          var ws = wb.Sheets[wb.SheetNames[0]];
          var rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
          var hdr = rows[0].map(function (h) { return String(h).toLowerCase().trim(); });
          var ni = hdr.findIndex(function (h) { return h.indexOf('produto') !== -1 || h.indexOf('nome') !== -1; });
          var ci = hdr.findIndex(function (h) { return h.indexOf('canal') !== -1 || h.indexOf('collab') !== -1; });
          var ti = hdr.findIndex(function (h) { return h.indexOf('tipo') !== -1; });
          var li = hdr.findIndex(function (h) { return h.indexOf('cole') !== -1; });
          var added = 0, erros = 0;
          for (var i = 1; i < rows.length; i++) {
            var row = rows[i];
            var nome = String(row[ni < 0 ? 0 : ni] || '').trim();
            if (!nome) continue;
            var nomeCanal = String(row[ci] || '').trim();
            var canalMatch = ST.canais.find(function (c) { return c.nome.toLowerCase() === nomeCanal.toLowerCase(); });
            var o = {
              id: '', nome: nome, tipo: ti >= 0 ? String(row[ti] || '') : '', colecao: li >= 0 ? String(row[li] || '') : '',
              canalId: canalMatch ? canalMatch.id : null, parceiroId: canalMatch ? canalMatch.parceiroId : null,
              status: 'Ativo'
            };
            try { var salvo = await cdaSalvarProduto(o); ST.produtos.push(salvo); added++; }
            catch (e2) { erros++; console.error(e2); }
          }
          host.querySelector('#cdap-file').value = '';
          rerenderFromStart();
          sync();
          alert(added + ' produto(s) importado(s)' + (erros ? ', ' + erros + ' com erro' : '') + '.');
        } catch (err) {
          console.error(err);
          alert('Erro ao importar: ' + err.message);
        }
      };
      rd.readAsArrayBuffer(file);
    });
  }

  render();
}

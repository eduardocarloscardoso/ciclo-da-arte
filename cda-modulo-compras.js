// ════════════════════════════════════════════════════════════════════
// cda-modulo-compras.js
// Interface compartilhada do submódulo "Histórico de Compras".
// Usado por financeiro.html (editável) e comercial.html (somente leitura).
//
// Requer que cda-dados-compartilhados.js já tenha sido carregado antes
// deste arquivo (usa cdaCarregarCompras, cdaCarregarClientes,
// cdaCarregarCanais, cdaCarregarProdutos, cdaCarregarParceiros e,
// se editavel:true, cdaSalvarCompra/cdaExcluirCompra).
//
// Uso:
//   <div id="container-compras"></div>
//   <script src="cda-dados-compartilhados.js"></script>
//   <script src="cda-modulo-compras.js"></script>
//   <script>montarModuloCompras('container-compras', {editavel: true});</script>
// ════════════════════════════════════════════════════════════════════

async function montarModuloCompras(containerId, opts) {
  opts = opts || {};
  var editavel = !!opts.editavel;
  var host = document.getElementById(containerId);
  if (!host) { console.error('cda-modulo-compras: container #' + containerId + ' não encontrado'); return; }

  // ── Estado interno do módulo (isolado, não polui o escopo global do host) ──
  var ST = {
    compras: [], clientes: [], canais: [], produtos: [], parceiros: [],
    pg: 1, pp: 50, editId: null
  };

  host.innerHTML =
    '<style>' +
      '.cdac-grid3{grid-template-columns:1fr 1fr 1fr;}' +
      '@media(max-width:700px){.cdac-grid3{grid-template-columns:1fr!important;}.cdac-grid3 [style*="span 2"]{grid-column:1/-1!important;}}' +
    '</style>' +
    '<div class="row-bt">' +
      '<div><div class="sec-t">Histórico de Compras</div><div class="sec-d">Todas as compras registradas, ligadas a Clientes, Produtos e Canais</div></div>' +
      (editavel ? '<button class="btn rust" id="cdac-btn-novo">＋ Nova Compra</button>' : '') +
    '</div>' +
    '<div class="fb">' +
      '<select id="cdac-f-canal"><option value="">Todos os canais</option></select>' +
      '<select id="cdac-f-collab"><option value="">Todos os Collabs/Artistas</option></select>' +
      '<input type="text" id="cdac-f-cliente" placeholder="Buscar cliente...">' +
      '<input type="text" id="cdac-f-produto" placeholder="Buscar produto...">' +
      '<input type="date" id="cdac-f-data-ini" title="Data início">' +
      '<input type="date" id="cdac-f-data-fim" title="Data fim">' +
      '<input type="text" id="cdac-f-pedido" placeholder="Nº Pedido">' +
      '<span class="fc" id="cdac-cnt"></span>' +
    '</div>' +
    '<div class="tw">' +
      '<div class="ts"><table>' +
        '<thead><tr><th>Data</th><th>Nº Pedido</th><th>Cliente</th><th>Canal</th><th>Collab/Artista</th><th>Produto</th><th>Qtd</th>' + (editavel ? '<th></th>' : '') + '</tr></thead>' +
        '<tbody id="cdac-tb"></tbody>' +
      '</table></div>' +
      '<div id="cdac-pag" style="padding:10px;text-align:right"></div>' +
    '</div>' +
    (editavel ?
      '<div class="mo" id="cdac-modal">' +
        '<div class="mo-box" style="max-width:820px">' +
          '<div class="mo-h"><h3 id="cdac-modal-title">Nova Compra</h3><button class="mo-x" id="cdac-modal-x">✕</button></div>' +
          '<div class="mo-b" style="padding:16px 20px"><div class="fg cdac-grid3" style="gap:10px 14px">' +
            '<div class="fgr" style="grid-column:1/-1"><label>Cliente *</label><select id="cdac-m-cliente"></select></div>' +
            '<div class="fgr"><label>Canal *</label><select id="cdac-m-canal"></select></div>' +
            '<div class="fgr" style="grid-column:span 2"><label>Produto *</label><select id="cdac-m-produto"></select></div>' +
            '<div class="fgr"><label>Quantidade</label><input type="number" id="cdac-m-qtd" value="1" min="1"></div>' +
            '<div class="fgr"><label>Valor Unitário (R$)</label><input type="number" id="cdac-m-valor-un" step="0.01"></div>' +
            '<div class="fgr"><label>Valor Total (R$)</label><input type="number" id="cdac-m-valor-tot" step="0.01"></div>' +
            '<div class="fgr"><label>Data da Compra *</label><input type="date" id="cdac-m-data"></div>' +
            '<div class="fgr" style="grid-column:span 2"><label>Nº Pedido</label><input type="text" id="cdac-m-pedido"></div>' +
            '<div class="fgr" style="grid-column:1/-1"><label>Observações</label><textarea id="cdac-m-obs" rows="1" style="min-height:32px"></textarea></div>' +
          '</div></div>' +
          '<div class="mo-f"><button class="btn" id="cdac-m-cancelar">Cancelar</button><button class="btn rust" id="cdac-m-salvar">💾 Salvar</button></div>' +
        '</div>' +
      '</div>'
    : '');

  // ── Carregamento inicial ──
  try {
    var res = await Promise.all([
      cdaCarregarCompras(), cdaCarregarClientes(), cdaCarregarCanais(),
      cdaCarregarProdutos(), cdaCarregarParceiros()
    ]);
    ST.compras = res[0]; ST.clientes = res[1]; ST.canais = res[2];
    ST.produtos = res[3]; ST.parceiros = res[4];
  } catch (err) {
    console.error(err);
    host.querySelector('#cdac-tb').innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--rust,#c0392b);padding:20px">Erro ao carregar dados do Supabase. Veja o console.</td></tr>';
    return;
  }

  var clienteById = {}; ST.clientes.forEach(function (c) { clienteById[String(c.id)] = c; });
  var canalById = {}; ST.canais.forEach(function (c) { canalById[String(c.id)] = c; });
  var produtoById = {}; ST.produtos.forEach(function (p) { produtoById[String(p.id)] = p; });
  var parceiroById = {}; ST.parceiros.forEach(function (p) { parceiroById[String(p.id)] = p; });

  // ── Popular selects de filtro ──
  host.querySelector('#cdac-f-canal').innerHTML += ST.canais
    .slice().sort(function (a, b) { return a.nome.localeCompare(b.nome); })
    .map(function (c) { return '<option value="' + c.id + '">' + c.nome + '</option>'; }).join('');
  host.querySelector('#cdac-f-collab').innerHTML += ST.parceiros
    .slice().sort(function (a, b) { return a.nome.localeCompare(b.nome); })
    .map(function (p) { return '<option value="' + p.id + '">' + p.nome + '</option>'; }).join('');

  // ── Filtro + render ──
  function getFiltro() {
    var fCanal = host.querySelector('#cdac-f-canal').value;
    var fCollab = host.querySelector('#cdac-f-collab').value;
    var fCliente = host.querySelector('#cdac-f-cliente').value.toLowerCase();
    var fProduto = host.querySelector('#cdac-f-produto').value.toLowerCase();
    var fDataIni = host.querySelector('#cdac-f-data-ini').value;
    var fDataFim = host.querySelector('#cdac-f-data-fim').value;
    var fPedido = host.querySelector('#cdac-f-pedido').value.toLowerCase();
    return ST.compras.filter(function (cp) {
      if (fCanal && String(cp.canalId) !== fCanal) return false;
      if (fCollab) {
        var canal = canalById[cp.canalId];
        if (!canal || String(canal.parceiroId) !== fCollab) return false;
      }
      if (fCliente) {
        var cli = clienteById[cp.clienteId];
        if (!cli || (cli.nome || '').toLowerCase().indexOf(fCliente) === -1) return false;
      }
      if (fProduto) {
        var prod = produtoById[cp.produtoId];
        var nomeProd = (prod ? prod.nome : cp.produto) || '';
        if (nomeProd.toLowerCase().indexOf(fProduto) === -1) return false;
      }
      if (fDataIni && cp.dataCompra < fDataIni) return false;
      if (fDataFim && cp.dataCompra > fDataFim) return false;
      if (fPedido && !(cp.numeroPedido || '').toLowerCase().includes(fPedido)) return false;
      return true;
    });
  }

  function fmtData(iso) {
    if (!iso) return '—';
    var p = iso.split('-');
    return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : iso;
  }

  function render() {
    var f = getFiltro();
    f.sort(function (a, b) { return (b.dataCompra || '').localeCompare(a.dataCompra || ''); });
    var st = (ST.pg - 1) * ST.pp, pg = f.slice(st, st + ST.pp);
    var tb = host.querySelector('#cdac-tb');
    tb.innerHTML = pg.map(function (cp) {
      var cli = clienteById[cp.clienteId];
      var canal = canalById[cp.canalId];
      var parceiro = canal ? parceiroById[canal.parceiroId] : null;
      var prod = produtoById[cp.produtoId];
      return '<tr>' +
        '<td>' + fmtData(cp.dataCompra) + '</td>' +
        '<td class="mn">' + (cp.numeroPedido || '—') + '</td>' +
        '<td>' + (cli ? cli.nome : '—') + '</td>' +
        '<td><span class="badge b-vio" style="font-size:9px">' + (canal ? canal.nome : '—') + '</span></td>' +
        '<td>' + (parceiro ? parceiro.nome : '<span class="tmu">—</span>') + '</td>' +
        '<td>' + (prod ? prod.nome : (cp.produto || '—')) + '</td>' +
        '<td>' + (cp.quantidade || 1) + '</td>' +
        (editavel ? '<td><button class="btn sm" data-edit="' + cp.id + '">✏</button> <button class="btn sm" data-del="' + cp.id + '">🗑</button></td>' : '') +
        '</tr>';
    }).join('') || '<tr><td colspan="' + (editavel ? 8 : 7) + '" style="text-align:center;color:var(--muted);padding:20px">Nenhuma compra encontrada com os filtros atuais.</td></tr>';

    host.querySelector('#cdac-cnt').textContent = f.length.toLocaleString('pt-BR') + ' compra(s) — base total: ' + ST.compras.length.toLocaleString('pt-BR');

    var tp = Math.ceil(f.length / ST.pp);
    var pgHtml = '<span class="pi">Pág ' + ST.pg + '/' + (tp || 1) + '</span>';
    if (ST.pg > 1) pgHtml = '<button class="pb" data-pgprev="1">‹</button>' + pgHtml;
    if (ST.pg < tp) pgHtml += '<button class="pb" data-pgnext="1">›</button>';
    host.querySelector('#cdac-pag').innerHTML = pgHtml;

    if (editavel) {
      tb.querySelectorAll('[data-edit]').forEach(function (btn) {
        btn.addEventListener('click', function () { abrirModal(btn.dataset.edit); });
      });
      tb.querySelectorAll('[data-del]').forEach(function (btn) {
        btn.addEventListener('click', function () { excluir(btn.dataset.del); });
      });
    }
    var prevBtn = host.querySelector('[data-pgprev]');
    if (prevBtn) prevBtn.addEventListener('click', function () { ST.pg--; render(); });
    var nextBtn = host.querySelector('[data-pgnext]');
    if (nextBtn) nextBtn.addEventListener('click', function () { ST.pg++; render(); });
  }

  function rerenderFromStart() { ST.pg = 1; render(); }

  ['cdac-f-canal', 'cdac-f-collab', 'cdac-f-data-ini', 'cdac-f-data-fim'].forEach(function (id) {
    host.querySelector('#' + id).addEventListener('change', rerenderFromStart);
  });
  ['cdac-f-cliente', 'cdac-f-produto', 'cdac-f-pedido'].forEach(function (id) {
    host.querySelector('#' + id).addEventListener('input', rerenderFromStart);
  });

  // ── CRUD (só quando editavel:true) ──
  if (editavel) {
    var modal = host.querySelector('#cdac-modal');
    function abrirModal(id) {
      ST.editId = id || null;
      var cp = id ? ST.compras.find(function (x) { return x.id === id; }) : null;
      host.querySelector('#cdac-modal-title').textContent = id ? 'Editar Compra' : 'Nova Compra';
      var selCli = host.querySelector('#cdac-m-cliente');
      selCli.innerHTML = '<option value="">Selecione...</option>' + ST.clientes
        .slice().sort(function (a, b) { return (a.nome || '').localeCompare(b.nome || ''); })
        .map(function (c) { return '<option value="' + c.id + '">' + c.nome + '</option>'; }).join('');
      var selCanal = host.querySelector('#cdac-m-canal');
      selCanal.innerHTML = '<option value="">Selecione...</option>' + ST.canais
        .slice().sort(function (a, b) { return a.nome.localeCompare(b.nome); })
        .map(function (c) { return '<option value="' + c.id + '">' + c.nome + '</option>'; }).join('');
      var selProd = host.querySelector('#cdac-m-produto');
      selProd.innerHTML = '<option value="">Selecione...</option>' + ST.produtos
        .slice().sort(function (a, b) { return a.nome.localeCompare(b.nome); })
        .map(function (p) { return '<option value="' + p.id + '">' + p.nome + '</option>'; }).join('');

      selCli.value = cp ? (cp.clienteId || '') : '';
      selCanal.value = cp ? (cp.canalId || '') : '';
      selProd.value = cp ? (cp.produtoId || '') : '';
      host.querySelector('#cdac-m-qtd').value = cp ? (cp.quantidade || 1) : 1;
      host.querySelector('#cdac-m-valor-un').value = cp ? (cp.valorUnitario || '') : '';
      host.querySelector('#cdac-m-valor-tot').value = cp ? (cp.valorTotal || '') : '';
      host.querySelector('#cdac-m-data').value = cp ? (cp.dataCompra || '') : '';
      host.querySelector('#cdac-m-pedido').value = cp ? (cp.numeroPedido || '') : '';
      host.querySelector('#cdac-m-obs').value = cp ? (cp.obs || '') : '';
      modal.classList.add('op');
    }
    function fecharModal() { modal.classList.remove('op'); }

    async function salvar() {
      var clienteId = host.querySelector('#cdac-m-cliente').value;
      var canalId = host.querySelector('#cdac-m-canal').value;
      var produtoId = host.querySelector('#cdac-m-produto').value;
      var dataCompra = host.querySelector('#cdac-m-data').value;
      if (!clienteId || !canalId || !produtoId || !dataCompra) {
        alert('Preencha Cliente, Canal, Produto e Data da Compra.');
        return;
      }
      var prod = produtoById[produtoId];
      var o = {
        id: ST.editId || '',
        clienteId: clienteId, canalId: canalId, produtoId: produtoId,
        produto: prod ? prod.nome : '',
        quantidade: parseInt(host.querySelector('#cdac-m-qtd').value, 10) || 1,
        valorUnitario: parseFloat(host.querySelector('#cdac-m-valor-un').value) || null,
        valorTotal: parseFloat(host.querySelector('#cdac-m-valor-tot').value) || null,
        dataCompra: dataCompra,
        numeroPedido: host.querySelector('#cdac-m-pedido').value.trim(),
        obs: host.querySelector('#cdac-m-obs').value.trim()
      };
      try {
        var salvo = await cdaSalvarCompra(o);
        if (ST.editId) {
          var idx = ST.compras.findIndex(function (x) { return x.id === ST.editId; });
          ST.compras[idx] = salvo;
        } else {
          ST.compras.push(salvo);
        }
        fecharModal();
        rerenderFromStart();
      } catch (err) {
        console.error(err);
        alert('Erro ao salvar no Supabase — veja o console.');
      }
    }

    async function excluir(id) {
      if (!confirm('Excluir esta compra do histórico?')) return;
      try {
        await cdaExcluirCompra(id);
        ST.compras = ST.compras.filter(function (x) { return x.id !== id; });
        render();
      } catch (err) {
        console.error(err);
        alert('Erro ao excluir — veja o console.');
      }
    }

    host.querySelector('#cdac-btn-novo').addEventListener('click', function () { abrirModal(null); });
    host.querySelector('#cdac-m-cancelar').addEventListener('click', fecharModal);
    host.querySelector('#cdac-modal-x').addEventListener('click', fecharModal);
    host.querySelector('#cdac-m-salvar').addEventListener('click', salvar);
  }

  render();
}

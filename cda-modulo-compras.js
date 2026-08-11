// ════════════════════════════════════════════════════════════════════
// cda-modulo-compras.js
// Interface compartilhada do submódulo "Histórico de Compras".
// Usado por financeiro.html (editável) e comercial.html (somente leitura).
// Inclui Exportar XLSX — disponível nos dois módulos, respeitando os
// filtros ativos na tela no momento do clique.
//
// Requer que cda-dados-compartilhados.js já tenha sido carregado antes
// deste arquivo (usa cdaCarregarCompras, cdaCarregarClientes,
// cdaCarregarCanais, cdaCarregarProdutos, cdaCarregarParceiros e,
// se editavel:true, cdaSalvarCompra/cdaExcluirCompra), e a biblioteca
// SheetJS (XLSX) carregada (para Exportar):
//   <script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>
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
      '<div style="display:flex;gap:7px;">' +
        (editavel ? '<button class="btn" id="cdac-btn-imp">⬆ Importar XLSX</button>' : '') +
        '<button class="btn" id="cdac-btn-exp">⬇ Exportar XLSX</button>' +
        (editavel ? '<button class="btn rust" id="cdac-btn-novo">＋ Nova Compra</button>' : '') +
      '</div>' +
    '</div>' +
    (editavel ? '<input type="file" id="cdac-file" accept=".xlsx,.xls" style="display:none">' : '') +
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

  // ── Exportar XLSX ──
  // Exporta o histórico de compras respeitando os filtros ativos na tela
  // (canal, collab, cliente, produto, período, nº pedido). Traz os campos
  // brutos da tabela `compras` já "achatados" com os nomes de Cliente,
  // Canal, Collab/Artista e Produto (join client-side via os mapas já
  // carregados em ST), incluindo a quebra financeira completa
  // (valor unitário, valor bruto, valor total, desconto, frete, outras
  // despesas) e situação/origem de cada compra.
  host.querySelector('#cdac-btn-exp').addEventListener('click', function () {
    var f = getFiltro();
    if (!f.length) { alert('Nenhuma compra para exportar com os filtros atuais.'); return; }
    var header = [
      'id', 'data_compra', 'numero_pedido', 'cliente_id', 'cliente_nome',
      'canal_id', 'canal_nome', 'collab_artista', 'produto_id', 'produto_nome',
      'cor', 'tam', 'codigo_bling', 'quantidade', 'valor_unitario', 'valor_bruto',
      'valor_total', 'desconto', 'frete', 'outras_despesas', 'situacao', 'origem', 'obs'
    ];
    var data = f.slice().sort(function (a, b) { return (a.dataCompra || '').localeCompare(b.dataCompra || ''); })
      .map(function (cp) {
        var cli = clienteById[cp.clienteId];
        var canal = canalById[cp.canalId];
        var parceiro = canal ? parceiroById[canal.parceiroId] : null;
        var prod = produtoById[cp.produtoId];
        return [
          cp.id, cp.dataCompra || '', cp.numeroPedido || '',
          cp.clienteId || '', cli ? cli.nome : '',
          cp.canalId || '', canal ? canal.nome : '', parceiro ? parceiro.nome : '',
          cp.produtoId || '', prod ? prod.nome : (cp.produto || ''),
          prod ? (prod.cor || '') : '', prod ? (prod.tam || '') : '', prod ? (prod.codigoBling || '') : '',
          cp.quantidade || 1, cp.valorUnitario != null ? cp.valorUnitario : '',
          cp.valorBruto != null ? cp.valorBruto : '', cp.valorTotal != null ? cp.valorTotal : '',
          cp.desconto != null ? cp.desconto : '', cp.frete != null ? cp.frete : '',
          cp.outrasDespesas != null ? cp.outrasDespesas : '', cp.situacao || '', cp.origem || '', cp.obs || ''
        ];
      });
    var wb = XLSX.utils.book_new();
    var ws = XLSX.utils.aoa_to_sheet([header].concat(data));
    ws['!cols'] = header.map(function () { return { wch: 16 }; });
    XLSX.utils.book_append_sheet(wb, ws, 'Historico Compras');
    var wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    var blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    var hoje = new Date().toISOString().slice(0, 10);
    a.href = url; a.download = 'historico_compras_cicloarte_' + hoje + '.xlsx';
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  });

  // ── CRUD (só quando editavel:true) ──
  if (editavel) {
    // ── Importar XLSX ──
    // Aceita o mesmo layout gerado pela Exportação. Casa cada linha por
    // 'id' (se vier preenchido e já existir → atualiza; senão → cria).
    // cliente_id/canal_id/produto_id são a fonte de verdade dos vínculos;
    // se vierem vazios, tenta resolver pelo nome (cliente_nome/canal_nome/
    // produto_nome) como fallback — útil para planilhas montadas à mão.
    host.querySelector('#cdac-btn-imp').addEventListener('click', function () { host.querySelector('#cdac-file').click(); });
    host.querySelector('#cdac-file').addEventListener('change', function (e) {
      var file = e.target.files[0];
      if (!file) return;
      var rd = new FileReader();
      rd.onload = async function (ev) {
        try {
          var wb = XLSX.read(ev.target.result, { type: 'array' });
          var ws = wb.Sheets[wb.SheetNames[0]];
          var rows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });
          if (!rows.length) { alert('Nenhum dado encontrado na planilha.'); return; }
          var cv = function (v) { var s = String(v == null ? '' : v).trim(); return (s === 'nan' || s === 'NaN' || s === '<NA>') ? '' : s.replace(/\.0$/, ''); };
          var num = function (v) { var s = cv(v); if (s === '') return null; var n = parseFloat(String(s).replace(',', '.')); return isNaN(n) ? null : n; };
          var clientePorNome = {}; ST.clientes.forEach(function (c) { if (c.nome) clientePorNome[c.nome.trim().toLowerCase()] = c.id; });
          var canalPorNome = {}; ST.canais.forEach(function (c) { if (c.nome) canalPorNome[c.nome.trim().toLowerCase()] = c.id; });
          var produtoPorNome = {}; ST.produtos.forEach(function (p) { if (p.nome) produtoPorNome[p.nome.trim().toLowerCase()] = p.id; });

          var added = 0, updated = 0, erros = 0, semVinculo = 0, produtosCriados = 0;
          for (var i = 0; i < rows.length; i++) {
            var row = rows[i];
            var idRaw = cv(row['id'] || row['ID']);
            var existente = idRaw ? ST.compras.find(function (x) { return String(x.id) === idRaw; }) : null;

            var clienteId = cv(row['cliente_id']) || clientePorNome[cv(row['cliente_nome']).toLowerCase()] || '';
            var canalId = cv(row['canal_id']) || canalPorNome[cv(row['canal_nome']).toLowerCase()] || '';
            var nomeProdutoRow = cv(row['produto_nome']);
            var produtoId = cv(row['produto_id']) || produtoPorNome[nomeProdutoRow.toLowerCase()] || '';

            // Produto ainda não existe no catálogo: cria automaticamente,
            // já classificando o tipo de peça pelo nome (mesma lógica usada
            // na classificação em massa do catálogo).
            if (!produtoId && nomeProdutoRow) {
              try {
                var canalObjImp = canalId ? canalById[canalId] : null;
                var tipoAuto = typeof cdaClassificarTipoPeca === 'function' ? cdaClassificarTipoPeca(nomeProdutoRow) : null;
                var novoProdObj = {
                  id: '', nome: nomeProdutoRow, tipo: tipoAuto,
                  canalId: canalId || null, parceiroId: canalObjImp ? canalObjImp.parceiroId : null,
                  status: 'Ativo'
                };
                var salvoProd = await cdaSalvarProduto(novoProdObj);
                ST.produtos.push(salvoProd);
                produtoById[salvoProd.id] = salvoProd;
                produtoPorNome[nomeProdutoRow.toLowerCase()] = salvoProd.id;
                produtoId = salvoProd.id;
                produtosCriados++;
              } catch (eProd) { console.error('Erro ao criar produto automaticamente durante import de compras:', eProd); }
            }

            var dataCompra = cv(row['data_compra']);

            if (!clienteId || !canalId || !produtoId || !dataCompra) { semVinculo++; continue; }

            var prod = produtoById[produtoId];
            var o = {
              id: existente ? existente.id : (idRaw || ''),
              clienteId: clienteId, canalId: canalId, produtoId: produtoId,
              produto: prod ? prod.nome : cv(row['produto_nome']),
              quantidade: parseInt(cv(row['quantidade']), 10) || 1,
              valorUnitario: num(row['valor_unitario']), valorBruto: num(row['valor_bruto']),
              valorTotal: num(row['valor_total']), desconto: num(row['desconto']),
              frete: num(row['frete']), outrasDespesas: num(row['outras_despesas']),
              situacao: cv(row['situacao']) || null, dataCompra: dataCompra,
              numeroPedido: cv(row['numero_pedido']), origem: cv(row['origem']) || 'manual',
              obs: cv(row['obs'])
            };
            try {
              var salvo = await cdaSalvarCompra(o);
              if (existente) { var idx = ST.compras.findIndex(function (x) { return String(x.id) === String(existente.id); }); ST.compras[idx] = salvo; updated++; }
              else { ST.compras.push(salvo); added++; }
            } catch (e2) { erros++; console.error(e2); }
          }
          host.querySelector('#cdac-file').value = '';
          rerenderFromStart();
          alert('Importação concluída: ' + added + ' adicionadas, ' + updated + ' atualizadas' +
            (produtosCriados ? ', ' + produtosCriados + ' produto(s) novo(s) criado(s) no catálogo com tipo de peça classificado automaticamente' : '') +
            (semVinculo ? ', ' + semVinculo + ' ignoradas (sem cliente/canal/produto/data)' : '') +
            (erros ? ', ' + erros + ' com erro' : '') + '.');
        } catch (err) {
          console.error(err);
          alert('Erro ao importar: ' + err.message);
        }
      };
      rd.readAsArrayBuffer(file);
    });

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

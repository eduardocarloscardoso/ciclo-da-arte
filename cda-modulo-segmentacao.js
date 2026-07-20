// ════════════════════════════════════════════════════════════════════
// cda-modulo-segmentacao.js
// Segmentação de Clientes — construtor de filtros dinâmicos combináveis
// (aniversário, recência de compra, valor gasto, canal, produto, etc.)
// + salvar segmentos + exportar XLSX.
//
// Requer cda-dados-compartilhados.js (cdaCarregarClientes, cdaCarregarCompras,
// cdaCarregarCanais, cdaCarregarProdutos, cdaCarregarSegmentos,
// cdaSalvarSegmento, cdaExcluirSegmento) e a lib SheetJS (XLSX) carregadas antes.
//
// Uso:
//   <div id="container-segmentacao"></div>
//   <script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>
//   <script src="cda-dados-compartilhados.js"></script>
//   <script src="cda-modulo-segmentacao.js"></script>
//   <script>montarModuloSegmentacao('container-segmentacao');</script>
// ════════════════════════════════════════════════════════════════════

var CDA_TIPOS_FILTRO_SEG = [
  { id: 'aniversario', label: 'Aniversário (mês)' },
  { id: 'recencia_compra', label: 'Dias desde a última compra' },
  { id: 'nunca_comprou', label: 'Nunca comprou' },
  { id: 'valor_gasto', label: 'Valor total gasto (R$)' },
  { id: 'qtd_compras', label: 'Quantidade de compras' },
  { id: 'canal', label: 'Comprou pelo menos 1x no canal' },
  { id: 'produto', label: 'Comprou o produto' },
  { id: 'cidade', label: 'Cidade' },
  { id: 'estado', label: 'Estado (UF)' },
  { id: 'tipo_comercial', label: 'Tipo Comercial' }
];

async function montarModuloSegmentacao(containerId) {
  var host = document.getElementById(containerId);
  if (!host) { console.error('cda-modulo-segmentacao: container #' + containerId + ' não encontrado'); return; }

  var ST = { clientes: [], compras: [], canais: [], produtos: [], segmentos: [], filtros: [], resultado: [] };

  host.innerHTML =
    '<style>' +
      '.seg-row{display:flex;gap:8px;align-items:center;margin-bottom:8px;flex-wrap:wrap;background:var(--card,#f5f0e8);border:1px solid var(--ink,#1a1a1a);padding:8px;}' +
      '.seg-row select,.seg-row input{font-family:\'Syne\',sans-serif;font-size:11px;padding:6px 9px;border:2px solid var(--ink,#1a1a1a);background:var(--paper,#fff);}' +
      '.seg-and{font-size:9px;text-transform:uppercase;letter-spacing:1px;color:var(--muted,#888);font-weight:700;margin:4px 0;}' +
    '</style>' +
    '<div class="row-bt">' +
      '<div><div class="sec-t">Segmentação de Clientes</div><div class="sec-d">Combine critérios para encontrar grupos específicos de clientes</div></div>' +
      '<div style="display:flex;gap:7px;">' +
        '<select id="seg-carregar"><option value="">Carregar segmento salvo...</option></select>' +
        '<button class="btn" id="seg-btn-salvar">💾 Salvar Segmento</button>' +
        '<button class="btn rust" id="seg-btn-exportar">⬇ Exportar XLSX</button>' +
      '</div>' +
    '</div>' +
    '<div id="seg-filtros"></div>' +
    '<button class="btn sm" id="seg-btn-addfiltro">＋ Adicionar Filtro</button>' +
    '<div class="tw" style="margin-top:16px">' +
      '<div class="th"><h3 id="seg-resultado-titulo">Resultado</h3></div>' +
      '<div class="ts"><table>' +
        '<thead><tr><th>Nome</th><th>Cidade/UF</th><th>Aniversário</th><th>Última Compra</th><th>Qtd Compras</th><th>Total Gasto</th><th>E-mail</th><th>Telefone</th></tr></thead>' +
        '<tbody id="seg-tb"></tbody>' +
      '</table></div>' +
    '</div>';

  try {
    var res = await Promise.all([
      cdaCarregarClientes(), cdaCarregarCompras(), cdaCarregarCanais(), cdaCarregarProdutos(), cdaCarregarSegmentos()
    ]);
    ST.clientes = res[0]; ST.compras = res[1]; ST.canais = res[2]; ST.produtos = res[3]; ST.segmentos = res[4];
  } catch (err) {
    console.error(err);
    var msg = (err && (err.message || err.details || err.hint)) || 'Erro desconhecido';
    host.querySelector('#seg-tb').innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--rust,#c0392b);padding:20px">Erro ao carregar dados do Supabase:<br><b>' + msg + '</b></td></tr>';
    return;
  }

  // ── Pré-computa agregados de compra por cliente (feito 1x, reusado em todo filtro) ──
  var agregados = {}; // clienteId -> {qtd, total, ultimaData, canais:Set, produtos:Set}
  ST.compras.forEach(function (cp) {
    if (!cp.clienteId) return;
    var a = agregados[cp.clienteId];
    if (!a) { a = { qtd: 0, total: 0, ultimaData: null, canais: new Set(), produtos: new Set() }; agregados[cp.clienteId] = a; }
    a.qtd++;
    a.total += Number(cp.valorTotal) || 0;
    if (cp.dataCompra && (!a.ultimaData || cp.dataCompra > a.ultimaData)) a.ultimaData = cp.dataCompra;
    if (cp.canalId) a.canais.add(String(cp.canalId));
    if (cp.produtoId) a.produtos.add(String(cp.produtoId));
  });
  function aggDe(clienteId) { return agregados[clienteId] || { qtd: 0, total: 0, ultimaData: null, canais: new Set(), produtos: new Set() }; }

  function popularSelects() {
    var selSeg = host.querySelector('#seg-carregar');
    selSeg.innerHTML = '<option value="">Carregar segmento salvo...</option>' +
      ST.segmentos.map(function (s) { return '<option value="' + s.id + '">' + s.nome + '</option>'; }).join('');
  }
  popularSelects();

  // ── Renderização das linhas de filtro ──
  function renderFiltros() {
    var wrap = host.querySelector('#seg-filtros');
    wrap.innerHTML = ST.filtros.map(function (f, idx) {
      return (idx > 0 ? '<div class="seg-and">E também...</div>' : '') +
        '<div class="seg-row" data-idx="' + idx + '">' +
          '<select class="seg-tipo" data-idx="' + idx + '">' +
            CDA_TIPOS_FILTRO_SEG.map(function (t) { return '<option value="' + t.id + '"' + (f.tipo === t.id ? ' selected' : '') + '>' + t.label + '</option>'; }).join('') +
          '</select>' +
          '<span class="seg-valor-area" data-idx="' + idx + '"></span>' +
          '<button class="btn sm" data-rm="' + idx + '">✕</button>' +
        '</div>';
    }).join('');

    ST.filtros.forEach(function (f, idx) {
      var area = wrap.querySelector('.seg-valor-area[data-idx="' + idx + '"]');
      area.innerHTML = campoValorHtml(f);
      var opSel = area.querySelector('.seg-op');
      if (opSel) opSel.value = f.operador || '>';
      var valInput = area.querySelector('.seg-val');
      if (valInput) valInput.value = f.valor != null ? f.valor : '';
    });

    wrap.querySelectorAll('.seg-tipo').forEach(function (el) {
      el.addEventListener('change', function () {
        var idx = Number(el.dataset.idx);
        ST.filtros[idx] = { tipo: el.value, operador: '>', valor: '' };
        renderFiltros();
      });
    });
    wrap.querySelectorAll('[data-rm]').forEach(function (el) {
      el.addEventListener('click', function () { ST.filtros.splice(Number(el.dataset.rm), 1); renderFiltros(); aplicarFiltros(); });
    });
    wrap.querySelectorAll('.seg-op,.seg-val').forEach(function (el) {
      el.addEventListener('input', function () {
        var idx = Number(el.closest('.seg-valor-area').dataset.idx);
        if (el.classList.contains('seg-op')) ST.filtros[idx].operador = el.value;
        else ST.filtros[idx].valor = el.value;
        aplicarFiltros();
      });
      el.addEventListener('change', function () {
        var idx = Number(el.closest('.seg-valor-area').dataset.idx);
        if (el.classList.contains('seg-op')) ST.filtros[idx].operador = el.value;
        else ST.filtros[idx].valor = el.value;
        aplicarFiltros();
      });
    });
  }

  function campoValorHtml(f) {
    switch (f.tipo) {
      case 'aniversario':
        return '<select class="seg-val">' + ['—','Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
          .map(function (m, i) { return '<option value="' + (i === 0 ? '' : i) + '">' + m + '</option>'; }).join('') + '</select>';
      case 'recencia_compra':
        return '<select class="seg-op"><option value=">">mais de</option><option value="<">menos de</option></select>' +
          '<input class="seg-val" type="number" placeholder="dias" style="width:80px">';
      case 'nunca_comprou':
        return '<span class="tmu" style="font-size:10px">sem critério adicional</span>';
      case 'valor_gasto':
        return '<select class="seg-op"><option value=">">maior que</option><option value="<">menor que</option></select>' +
          '<input class="seg-val" type="number" placeholder="R$" style="width:100px">';
      case 'qtd_compras':
        return '<select class="seg-op"><option value=">">maior ou igual a</option><option value="<">menor que</option></select>' +
          '<input class="seg-val" type="number" placeholder="qtd" style="width:80px">';
      case 'canal':
        return '<select class="seg-val"><option value="">Selecione...</option>' + ST.canais.slice().sort(function (a, b) { return a.nome.localeCompare(b.nome); })
          .map(function (c) { return '<option value="' + c.id + '">' + c.nome + '</option>'; }).join('') + '</select>';
      case 'produto':
        return '<select class="seg-val"><option value="">Selecione...</option>' + ST.produtos.slice().sort(function (a, b) { return a.nome.localeCompare(b.nome); })
          .map(function (p) { return '<option value="' + p.id + '">' + p.nome + '</option>'; }).join('') + '</select>';
      case 'cidade':
        return '<input class="seg-val" type="text" placeholder="Ex: Rio de Janeiro">';
      case 'estado':
        return '<input class="seg-val" type="text" placeholder="Ex: RJ" maxlength="2" style="width:60px">';
      case 'tipo_comercial':
        return '<select class="seg-val"><option value="">—</option><option value="__vazio__">Cliente Convertido (sem tipo)</option><option value="lead_b2c">Lead B2C</option><option value="canal_b2b">Canal B2B</option><option value="artista">Artista</option><option value="imprensa">Imprensa</option></select>';
      default: return '';
    }
  }

  function passaNoFiltro(cliente, f) {
    var agg = aggDe(cliente.id);
    switch (f.tipo) {
      case 'aniversario': {
        if (!f.valor) return true;
        var dn = cliente['data-nascimento'];
        if (!dn) return false;
        var partes = dn.split('/');
        if (partes.length !== 3) return false;
        return Number(partes[1]) === Number(f.valor);
      }
      case 'recencia_compra': {
        if (!f.valor) return true;
        if (!agg.ultimaData) return f.operador === '>';
        var dias = Math.floor((Date.now() - new Date(agg.ultimaData).getTime()) / 86400000);
        return f.operador === '>' ? dias > Number(f.valor) : dias < Number(f.valor);
      }
      case 'nunca_comprou':
        return agg.qtd === 0;
      case 'valor_gasto': {
        if (f.valor === '' || f.valor == null) return true;
        return f.operador === '>' ? agg.total > Number(f.valor) : agg.total < Number(f.valor);
      }
      case 'qtd_compras': {
        if (f.valor === '' || f.valor == null) return true;
        return f.operador === '>' ? agg.qtd >= Number(f.valor) : agg.qtd < Number(f.valor);
      }
      case 'canal':
        if (!f.valor) return true;
        return agg.canais.has(String(f.valor));
      case 'produto':
        if (!f.valor) return true;
        return agg.produtos.has(String(f.valor));
      case 'cidade':
        if (!f.valor) return true;
        return (cliente.cidade || '').toLowerCase().indexOf(f.valor.toLowerCase()) !== -1;
      case 'estado':
        if (!f.valor) return true;
        return (cliente.estado || '').toLowerCase() === f.valor.toLowerCase();
      case 'tipo_comercial':
        if (!f.valor) return true;
        if (f.valor === '__vazio__') return !cliente.tipoComercial;
        return cliente.tipoComercial === f.valor;
      default: return true;
    }
  }

  function aplicarFiltros() {
    var resultado = ST.filtros.length === 0 ? [] : ST.clientes.filter(function (c) {
      return ST.filtros.every(function (f) { return passaNoFiltro(c, f); });
    });
    ST.resultado = resultado;
    renderResultado();
  }

  function fmtData(iso) {
    if (!iso) return '—';
    var p = iso.split('-');
    return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : iso;
  }

  function renderResultado() {
    var tb = host.querySelector('#seg-tb');
    var lista = ST.resultado.slice(0, 200);
    tb.innerHTML = lista.map(function (c) {
      var agg = aggDe(c.id);
      return '<tr>' +
        '<td><b>' + (c.nome || '—') + '</b></td>' +
        '<td>' + (c.cidade || '—') + '/' + (c.estado || '—') + '</td>' +
        '<td>' + (c['data-nascimento'] || '—') + '</td>' +
        '<td>' + fmtData(agg.ultimaData) + '</td>' +
        '<td>' + agg.qtd + '</td>' +
        '<td>' + (agg.total ? 'R$ ' + agg.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '—') + '</td>' +
        '<td class="tmu" style="font-size:11px">' + (c.email || '—') + '</td>' +
        '<td class="mn">' + (c['telefone-celular'] || c['telefone-principal'] || '—') + '</td>' +
        '</tr>';
    }).join('') || '<tr><td colspan="8" style="text-align:center;color:var(--muted);padding:20px">' +
      (ST.filtros.length === 0 ? 'Adicione ao menos 1 filtro para ver resultados.' : 'Nenhum cliente encontrado com esses critérios.') + '</td></tr>';
    host.querySelector('#seg-resultado-titulo').textContent = 'Resultado — ' + ST.resultado.length.toLocaleString('pt-BR') + ' cliente(s) encontrado(s)' +
      (ST.resultado.length > 200 ? ' (mostrando 200 primeiros)' : '');
  }

  host.querySelector('#seg-btn-addfiltro').addEventListener('click', function () {
    ST.filtros.push({ tipo: 'aniversario', operador: '>', valor: '' });
    renderFiltros();
    aplicarFiltros();
  });

  host.querySelector('#seg-carregar').addEventListener('change', function (e) {
    var seg = ST.segmentos.find(function (s) { return s.id === e.target.value; });
    if (!seg) return;
    ST.filtros = JSON.parse(JSON.stringify(seg.filtros));
    renderFiltros();
    aplicarFiltros();
  });

  host.querySelector('#seg-btn-salvar').addEventListener('click', async function () {
    if (ST.filtros.length === 0) { alert('Adicione ao menos 1 filtro antes de salvar.'); return; }
    var nome = prompt('Nome do segmento (ex: "Aniversariantes de Julho"):');
    if (!nome) return;
    try {
      var salvo = await cdaSalvarSegmento({ nome: nome, filtros: ST.filtros });
      ST.segmentos.push(salvo);
      popularSelects();
      alert('Segmento salvo!');
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar segmento — veja o console.');
    }
  });

  host.querySelector('#seg-btn-exportar').addEventListener('click', function () {
    if (ST.resultado.length === 0) { alert('Nenhum resultado para exportar.'); return; }
    var header = ['Nome', 'E-mail', 'Telefone', 'Cidade', 'Estado', 'Aniversário', 'Última Compra', 'Qtd Compras', 'Total Gasto'];
    var data = ST.resultado.map(function (c) {
      var agg = aggDe(c.id);
      return [c.nome, c.email || '', c['telefone-celular'] || c['telefone-principal'] || '', c.cidade || '', c.estado || '',
        c['data-nascimento'] || '', fmtData(agg.ultimaData), agg.qtd, agg.total];
    });
    var wb = XLSX.utils.book_new();
    var ws = XLSX.utils.aoa_to_sheet([header].concat(data));
    ws['!cols'] = header.map(function () { return { wch: 18 }; });
    XLSX.utils.book_append_sheet(wb, ws, 'Segmento');
    var wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    var blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = 'segmento_clientes_cicloarte.xlsx';
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  });

  renderResultado();
}

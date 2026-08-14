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

// Cada filtro pertence a um GRUPO — os mesmos 8 grupos do documento de
// especificação da Segmentação. Os itens de "Datas" (último contato/
// proposta) e "CRM" (sem contato/follow-up/oportunidade) dependem do
// histórico de interações, que ainda não existe (fica pra quando o
// Pipeline B2C for redesenhado) — por isso não aparecem aqui ainda.
var CDA_TIPOS_FILTRO_SEG = [
  { id: 'status_crm', label: 'Status CRM (ciclo de vida)', grupo: 'Inteligência' },
  { id: 'tag_valor', label: 'Classificação de valor (VIP/Premium)', grupo: 'Inteligência' },

  { id: 'valor_gasto', label: 'Valor total gasto (R$)', grupo: 'Compras' },
  { id: 'ticket_medio', label: 'Ticket médio (R$)', grupo: 'Compras' },
  { id: 'qtd_compras', label: 'Quantidade de compras', grupo: 'Compras' },
  { id: 'canal', label: 'Comprou pelo menos 1x no canal', grupo: 'Compras' },

  { id: 'recencia_compra', label: 'Sem comprar há X dias', grupo: 'Frequência' },
  { id: 'nunca_comprou', label: 'Nunca comprou (nenhum produto)', grupo: 'Frequência' },
  { id: 'comprou_periodo', label: 'Comprou neste período', grupo: 'Frequência' },

  { id: 'aniversario', label: 'Aniversariantes (mês)', grupo: 'Datas' },
  { id: 'dias_cadastro', label: 'Dias desde o cadastro', grupo: 'Datas' },
  { id: 'dias_primeira_compra', label: 'Dias desde a 1ª compra', grupo: 'Datas' },

  { id: 'produto', label: 'Comprou o produto', grupo: 'Produtos' },
  { id: 'nunca_comprou_produto', label: 'Nunca comprou o produto', grupo: 'Produtos' },

  { id: 'cidade', label: 'Cidade', grupo: 'Geografia' },
  { id: 'estado', label: 'Estado (UF)', grupo: 'Geografia' },
  { id: 'regiao', label: 'Região', grupo: 'Geografia' },
  { id: 'pais', label: 'País', grupo: 'Geografia' },
  { id: 'cep', label: 'CEP (prefixo)', grupo: 'Geografia' },

  { id: 'origem', label: 'Origem do lead', grupo: 'Marketing' },

  { id: 'tipo_comercial', label: 'Tipo Comercial', grupo: 'CRM' },
  { id: 'sem_vendedor', label: 'Sem vendedor responsável', grupo: 'CRM' }
];

var CDA_UF_REGIAO = {
  AC:'Norte', AM:'Norte', AP:'Norte', PA:'Norte', RO:'Norte', RR:'Norte', TO:'Norte',
  AL:'Nordeste', BA:'Nordeste', CE:'Nordeste', MA:'Nordeste', PB:'Nordeste', PE:'Nordeste', PI:'Nordeste', RN:'Nordeste', SE:'Nordeste',
  DF:'Centro-Oeste', GO:'Centro-Oeste', MT:'Centro-Oeste', MS:'Centro-Oeste',
  ES:'Sudeste', MG:'Sudeste', RJ:'Sudeste', SP:'Sudeste',
  PR:'Sul', RS:'Sul', SC:'Sul'
};

// Nota importante: todo o universo desta tela já sai filtrado por
// canal.escopo === 'b2c' e cliente.cadastroIncompleto === false antes de
// qualquer filtro do usuário ser aplicado (ver montarModuloSegmentacao).
// Isso reflete decisão de negócio: canais de revenda/atacado (Private
// Label, Revenda Bafu etc.) e cadastros genéricos de venda em show
// (sem dado de consumidor final) não fazem parte da Segmentação B2C.

async function montarModuloSegmentacao(containerId, opts) {
  opts = opts || {};
  var editavel = opts.editavel !== false;
  var host = document.getElementById(containerId);
  if (!host) { console.error('cda-modulo-segmentacao: container #' + containerId + ' não encontrado'); return; }

  var ST = { clientes: [], compras: [], canais: [], produtos: [], segmentos: [], statusCrm: [], parametros: null, filtros: [], filtroRapido: null, resultado: [] };

  host.innerHTML =
    '<style>' +
      '.seg-row{display:flex;gap:8px;align-items:center;margin-bottom:8px;flex-wrap:wrap;background:var(--card,#f5f0e8);border:1px solid var(--ink,#1a1a1a);padding:8px;}' +
      '.seg-row select,.seg-row input{font-family:\'Syne\',sans-serif;font-size:11px;padding:6px 9px;border:2px solid var(--ink,#1a1a1a);background:var(--paper,#fff);}' +
      '.seg-and{font-size:9px;text-transform:uppercase;letter-spacing:1px;color:var(--muted,#888);font-weight:700;margin:4px 0;}' +
      '.seg-pill{display:inline-flex;align-items:center;gap:5px;font-family:\'Syne\',sans-serif;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;padding:6px 11px;border:2px solid var(--ink,#1a1a1a);background:var(--paper,#fff);cursor:pointer;border-radius:999px;}' +
      '.seg-pill .dot{width:8px;height:8px;border-radius:50%;display:inline-block;}' +
      '.seg-pill.ativa{background:var(--ink,#1a1a1a);color:#fff;}' +
      '.seg-pills-wrap{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;}' +
      '.seg-badge{display:inline-block;font-size:9px;font-weight:700;text-transform:uppercase;padding:2px 7px;border-radius:999px;color:#fff;}' +
      '.seg-nota{font-size:10px;color:var(--muted,#888);margin:6px 0 14px;}' +
      '.seg-recalc{background:var(--card,#f5f0e8);border:2px solid var(--ink,#1a1a1a);padding:12px 14px;margin-bottom:14px;display:flex;align-items:center;gap:16px;flex-wrap:wrap;}' +
      '.seg-recalc b{font-size:11px;}' +
      '.seg-recalc .seg-modo-btn{font-family:\'Syne\',sans-serif;font-size:10px;font-weight:700;text-transform:uppercase;padding:5px 10px;border:2px solid var(--ink,#1a1a1a);background:var(--paper,#fff);cursor:pointer;}' +
      '.seg-recalc .seg-modo-btn.ativa{background:var(--ink,#1a1a1a);color:#fff;}' +
      '.seg-recalc input{width:90px;font-size:11px;padding:5px 8px;border:2px solid var(--ink,#1a1a1a);}' +
    '</style>' +
    '<div class="seg-recalc" id="seg-recalc"></div>' +
    '<div class="row-bt">' +
      '<div><div class="sec-t">Segmentação de Clientes</div><div class="sec-d">Atalhos rápidos por status, ou combine critérios abaixo pra grupos específicos</div></div>' +
      '<div style="display:flex;gap:7px;">' +
        '<select id="seg-carregar"><option value="">Carregar segmento salvo...</option></select>' +
        (editavel ? '<button class="btn sm" id="seg-btn-renomear" disabled>✎ Renomear</button>' : '') +
        (editavel ? '<button class="btn sm" id="seg-btn-excluir-seg" disabled>🗑 Excluir</button>' : '') +
        (editavel ? '<button class="btn" id="seg-btn-salvar">💾 Salvar Segmento</button>' : '') +
        (editavel ? '<button class="btn rust" id="seg-btn-exportar">⬇ Exportar XLSX</button>' : '') +
      '</div>' +
    '</div>' +
    '<div class="seg-and" style="margin-top:0">Inteligência — atalhos de 1 clique</div>' +
    '<div id="seg-pills" class="seg-pills-wrap"></div>' +
    '<div id="seg-nota-exclusao" class="seg-nota"></div>' +
    '<div class="seg-and">Construtor de filtros combináveis — organizados pelos 8 grupos da Segmentação</div>' +
    '<div id="seg-filtros"></div>' +
    '<button class="btn sm" id="seg-btn-addfiltro">＋ Adicionar Filtro</button>' +
    '<div class="tw" style="margin-top:16px">' +
      '<div class="th"><h3 id="seg-resultado-titulo">Resultado</h3></div>' +
      '<div class="ts"><table>' +
        '<thead><tr><th>Nome</th><th>Status CRM</th><th>Cidade/UF</th><th>Aniversário</th><th>Última Compra</th><th>Qtd Compras</th><th>Total Gasto</th><th>E-mail</th><th>Telefone</th></tr></thead>' +
        '<tbody id="seg-tb"></tbody>' +
      '</table></div>' +
    '</div>';

  try {
    var res = await Promise.all([
      cdaCarregarClientes(), cdaCarregarCompras(), cdaCarregarCanais(), cdaCarregarProdutos(), cdaCarregarSegmentos(), cdaCarregarStatusCrm(), cdaCarregarParametrosSegmentacao()
    ]);
    var clientesBrutos = res[0]; ST.compras = res[1]; ST.canais = res[2]; ST.produtos = res[3]; ST.segmentos = res[4]; ST.statusCrm = res[5]; ST.parametros = res[6];

    // ── Exclui do universo da tela: cadastros genéricos (placeholder de show,
    // dado de teste etc.) — não representam consumidor final individual ──
    ST.clientes = clientesBrutos.filter(function (c) { return !c.cadastroIncompleto; });
    var qtdExcluidosCadastro = clientesBrutos.length - ST.clientes.length;

    // ── Escopo B2C: só canais de venda direta ao consumidor final entram
    // no cálculo de Segmentação (revenda/atacado fica de fora, vira B2B) ──
    var escopoPorCanal = {}; ST.canais.forEach(function (c) { escopoPorCanal[String(c.id)] = c.escopo; });
    var comprasTotal = ST.compras.length;
    ST.compras = ST.compras.filter(function (cp) { return cp.canalId && escopoPorCanal[String(cp.canalId)] === 'b2c'; });
    var qtdComprasExcluidas = comprasTotal - ST.compras.length;

    host.querySelector('#seg-nota-exclusao').textContent =
      (qtdExcluidosCadastro || qtdComprasExcluidas)
        ? '⚠ ' + qtdExcluidosCadastro.toLocaleString('pt-BR') + ' cadastro(s) genérico(s) e ' + qtdComprasExcluidas.toLocaleString('pt-BR') + ' compra(s) de canal B2B foram excluídos automaticamente desta análise.'
        : '';
  } catch (err) {
    console.error(err);
    var msg = (err && (err.message || err.details || err.hint)) || 'Erro desconhecido';
    host.querySelector('#seg-tb').innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--rust,#c0392b);padding:20px">Erro ao carregar dados do Supabase:<br><b>' + msg + '</b></td></tr>';
    return;
  }

  var statusCrmPorId = {}; ST.statusCrm.forEach(function (s) { statusCrmPorId[s.id] = s; });

  // ── Pré-computa agregados de compra por cliente (feito 1x, reusado em todo filtro) ──
  var agora = new Date();
  var inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
  var inicioTrimestre = new Date(agora.getFullYear(), Math.floor(agora.getMonth() / 3) * 3, 1);
  var inicioAno = new Date(agora.getFullYear(), 0, 1);

  var agregados = {}; // clienteId -> {qtd, total, primeiraData, ultimaData, canais:Set, produtos:Set, mes, trimestre, ano}
  ST.compras.forEach(function (cp) {
    if (!cp.clienteId) return;
    var a = agregados[cp.clienteId];
    if (!a) { a = { qtd: 0, total: 0, primeiraData: null, ultimaData: null, canais: new Set(), produtos: new Set(), mes: false, trimestre: false, ano: false }; agregados[cp.clienteId] = a; }
    a.qtd++;
    a.total += Number(cp.valorTotal) || 0;
    if (cp.dataCompra && (!a.ultimaData || cp.dataCompra > a.ultimaData)) a.ultimaData = cp.dataCompra;
    if (cp.dataCompra && (!a.primeiraData || cp.dataCompra < a.primeiraData)) a.primeiraData = cp.dataCompra;
    if (cp.canalId) a.canais.add(String(cp.canalId));
    if (cp.produtoId) a.produtos.add(String(cp.produtoId));
    if (cp.dataCompra) {
      var d = new Date(cp.dataCompra);
      if (d >= inicioMes) a.mes = true;
      if (d >= inicioTrimestre) a.trimestre = true;
      if (d >= inicioAno) a.ano = true;
    }
  });
  function aggDe(clienteId) { return agregados[clienteId] || { qtd: 0, total: 0, primeiraData: null, ultimaData: null, canais: new Set(), produtos: new Set(), mes: false, trimestre: false, ano: false }; }

  // ── Atalhos rápidos (pills) — status de ciclo de vida + tags de valor ──
  function renderPills() {
    var wrap = host.querySelector('#seg-pills');
    var itens = ST.statusCrm.filter(function (s) { return s.tipo === 'segmentacao'; });
    wrap.innerHTML = itens.map(function (s) {
      var ativa = ST.filtroRapido && ST.filtroRapido.codigo === s.codigo;
      return '<span class="seg-pill' + (ativa ? ' ativa' : '') + '" data-codigo="' + s.codigo + '" data-tipo-campo="' + (s.codigo === 'vip' || s.codigo === 'premium' || s.codigo === 'gold' ? 'tag' : 'status') + '" title="' + (s.acaoSugerida || '') + '">' +
        '<span class="dot" style="background:' + s.cor + '"></span>' + s.nome +
        '</span>';
    }).join('');
    wrap.querySelectorAll('.seg-pill').forEach(function (el) {
      el.addEventListener('click', function () {
        var codigo = el.dataset.codigo, campo = el.dataset.tipoCampo;
        if (ST.filtroRapido && ST.filtroRapido.codigo === codigo) ST.filtroRapido = null;
        else ST.filtroRapido = { campo: campo, codigo: codigo };
        renderPills();
        aplicarFiltros();
      });
    });
  }
  renderPills();

  // ── Recálculo de Valores (Premium/VIP) ──────────────────────────────
  function fmtBRL(v) { return 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 }); }
  function fmtDataBR(iso) { if (!iso) return '—'; var p = iso.split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }

  function renderRecalculo() {
    var box = host.querySelector('#seg-recalc');
    var p = ST.parametros;
    var editando = box.dataset.editando === '1';
    box.innerHTML =
      '<div><b>Recálculo de Valores</b><br><span style="font-size:9px;color:var(--muted,#888)">Última atualização: ' + fmtDataBR(p.atualizadoEm) + (p.atualizadoPor ? ' — ' + p.atualizadoPor : '') + '</span></div>' +
      '<div><button class="seg-modo-btn' + (p.modo === 'automatico' ? ' ativa' : '') + '" data-modo="automatico">A — Automático</button> ' +
        '<button class="seg-modo-btn' + (p.modo === 'manual' ? ' ativa' : '') + '" data-modo="manual">M — Manual</button></div>' +
      (p.modo === 'automatico'
        ? '<div style="font-size:11px">Premium: <b>' + fmtBRL(p.valorPremium) + '</b> &nbsp; Entre Premium e Vips (Gold): <b>' + fmtBRL(p.valorGold) + '</b> &nbsp; VIP: <b>' + fmtBRL(p.valorVip) + '</b><br><span style="font-size:9px;color:var(--muted,#888)">No modo Automático, Gold é a média entre Premium e VIP. Só recalcula quando você pedir — nunca sozinho por agendamento</span></div>' +
          (editavel ? '<button class="btn sm rust" id="seg-recalc-executar">▶ Executar recálculo agora</button>' : '')
        : (!editando || !editavel
            ? '<div style="font-size:11px">Premium: <b>' + fmtBRL(p.valorPremium) + '</b> &nbsp; Entre Premium e Vips (Gold): <b>' + fmtBRL(p.valorGold) + '</b> &nbsp; VIP: <b>' + fmtBRL(p.valorVip) + '</b></div>' +
              (editavel ? '<button class="btn sm" id="seg-recalc-editar">✎ Editar valores</button><button class="btn sm" id="seg-recalc-confirmar" title="Confirma que os valores continuam válidos hoje, sem mudar nada">✓ Confirmar (atualiza a data)</button>' : '')
            : '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">Premium: <input type="number" id="seg-recalc-premium" value="' + p.valorPremium + '"> ' +
              'Entre Premium e Vips (Gold): <input type="number" id="seg-recalc-gold" value="' + p.valorGold + '"> ' +
              'VIP: <input type="number" id="seg-recalc-vip" value="' + p.valorVip + '">' +
              '<button class="btn sm" id="seg-recalc-gold-sugerir" title="Preenche Gold com a média entre Premium e VIP">↺ Sugerir média</button>' +
              '<button class="btn sm rust" id="seg-recalc-salvar">💾 Salvar</button>' +
              '<button class="btn sm" id="seg-recalc-cancelar">Cancelar</button></div>'
          )
      );

    if (editavel) box.querySelectorAll('.seg-modo-btn').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        var novoModo = btn.dataset.modo;
        if (novoModo === p.modo) return;
        try {
          ST.parametros = await cdaSalvarParametrosSegmentacao({ valorPremium: p.valorPremium, valorVip: p.valorVip, valorGold: p.valorGold, modo: novoModo, atualizadoPor: (window.cu && window.cu.name) || 'Usuário' });
          box.dataset.editando = '0';
          renderRecalculo();
        } catch (err) { alert('Erro ao mudar o modo: ' + (err.message || err)); }
      });
    });
    var btnEditar = host.querySelector('#seg-recalc-editar');
    if (btnEditar) btnEditar.addEventListener('click', function () { box.dataset.editando = '1'; renderRecalculo(); });
    var btnExecutar = host.querySelector('#seg-recalc-executar');
    if (btnExecutar) btnExecutar.addEventListener('click', async function () {
      btnExecutar.textContent = 'Calculando...'; btnExecutar.disabled = true;
      try {
        await cdaExecutarRecalculoValores((window.cu && window.cu.name) || 'Usuário');
        ST.parametros = await cdaCarregarParametrosSegmentacao();
        renderRecalculo();
        alert('Recálculo concluído. A base foi reclassificada com os novos valores.');
      } catch (err) { alert('Erro ao executar: ' + (err.message || err)); btnExecutar.textContent = '▶ Executar recálculo agora'; btnExecutar.disabled = false; }
    });
    var btnCancelar = host.querySelector('#seg-recalc-cancelar');
    if (btnCancelar) btnCancelar.addEventListener('click', function () { box.dataset.editando = '0'; renderRecalculo(); });
    var btnConfirmar = host.querySelector('#seg-recalc-confirmar');
    if (btnConfirmar) btnConfirmar.addEventListener('click', async function () {
      try {
        ST.parametros = await cdaSalvarParametrosSegmentacao({ valorPremium: p.valorPremium, valorVip: p.valorVip, valorGold: p.valorGold, modo: 'manual', atualizadoPor: (window.cu && window.cu.name) || 'Usuário' });
        renderRecalculo();
      } catch (err) { alert('Erro ao confirmar: ' + (err.message || err)); }
    });
    var btnGoldSugerir = host.querySelector('#seg-recalc-gold-sugerir');
    if (btnGoldSugerir) btnGoldSugerir.addEventListener('click', function () {
      var premiumAtual = Number(host.querySelector('#seg-recalc-premium').value) || 0;
      var vipAtual = Number(host.querySelector('#seg-recalc-vip').value) || 0;
      host.querySelector('#seg-recalc-gold').value = Math.round(((premiumAtual + vipAtual) / 2) * 100) / 100;
    });
    var btnSalvar = host.querySelector('#seg-recalc-salvar');
    if (btnSalvar) btnSalvar.addEventListener('click', async function () {
      var novoPremium = Number(host.querySelector('#seg-recalc-premium').value);
      var novoVip = Number(host.querySelector('#seg-recalc-vip').value);
      var novoGold = Number(host.querySelector('#seg-recalc-gold').value);
      if (!novoPremium || !novoVip || novoVip <= novoPremium) { alert('Valores inválidos — VIP precisa ser maior que Premium.'); return; }
      if (!novoGold || novoGold <= novoPremium || novoGold >= novoVip) { alert('Gold (Entre Premium e Vips) precisa ficar entre o valor de Premium e o de VIP.'); return; }
      try {
        ST.parametros = await cdaSalvarParametrosSegmentacao({ valorPremium: novoPremium, valorVip: novoVip, valorGold: novoGold, modo: 'manual', atualizadoPor: (window.cu && window.cu.name) || 'Usuário' });
        box.dataset.editando = '0';
        renderRecalculo();
      } catch (err) { alert('Erro ao salvar: ' + (err.message || err)); }
    });
  }
  renderRecalculo();

  function popularSelects() {
    var selSeg = host.querySelector('#seg-carregar');
    selSeg.innerHTML = '<option value="">Carregar segmento salvo...</option>' +
      ST.segmentos.map(function (s) { return '<option value="' + s.id + '">' + s.nome + '</option>'; }).join('');
  }
  popularSelects();

  // ── Renderização das linhas de filtro ──
  var CDA_GRUPOS_ORDEM = ['Inteligência', 'Compras', 'Frequência', 'Datas', 'Produtos', 'Geografia', 'Marketing', 'CRM'];
  function optionsAgrupadas(valorSelecionado) {
    return CDA_GRUPOS_ORDEM.map(function (grupo) {
      var itens = CDA_TIPOS_FILTRO_SEG.filter(function (t) { return t.grupo === grupo; });
      if (!itens.length) return '';
      return '<optgroup label="' + grupo + '">' +
        itens.map(function (t) { return '<option value="' + t.id + '"' + (valorSelecionado === t.id ? ' selected' : '') + '>' + t.label + '</option>'; }).join('') +
        '</optgroup>';
    }).join('');
  }

  function renderFiltros() {
    var wrap = host.querySelector('#seg-filtros');
    wrap.innerHTML = ST.filtros.map(function (f, idx) {
      return (idx > 0 ? '<div class="seg-and">E também...</div>' : '') +
        '<div class="seg-row" data-idx="' + idx + '">' +
          '<select class="seg-tipo" data-idx="' + idx + '">' +
            optionsAgrupadas(f.tipo) +
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

  function opts(lista, valorAtual) {
    // lista = [{v, l}] -> monta <option>, marcando selected se bater com valorAtual
    return lista.map(function (o) { return '<option value="' + o.v + '"' + (String(valorAtual) === String(o.v) ? ' selected' : '') + '>' + o.l + '</option>'; }).join('');
  }
  function opInput(placeholder, largura, f) {
    return '<select class="seg-op">' +
      '<option value=">"' + (f.operador === '>' ? ' selected' : '') + '>maior/mais de</option>' +
      '<option value="<"' + (f.operador === '<' ? ' selected' : '') + '>menor/menos de</option></select>' +
      '<input class="seg-val" type="number" placeholder="' + placeholder + '" style="width:' + largura + 'px" value="' + (f.valor != null ? f.valor : '') + '">';
  }
  function campoValorHtml(f) {
    switch (f.tipo) {
      case 'status_crm':
        return '<select class="seg-val"><option value="">Selecione...</option>' +
          opts(ST.statusCrm.filter(function (s) { return s.tipo === 'segmentacao' && s.codigo !== 'vip' && s.codigo !== 'premium'; }).map(function (s) { return { v: s.id, l: s.nome }; }), f.valor) +
          '</select>';
      case 'tag_valor':
        return '<select class="seg-val"><option value="">Selecione...</option>' + opts([{ v: 'vip', l: 'VIP' }, { v: 'premium', l: 'Premium' }], f.valor) + '</select>';
      case 'aniversario':
        return '<select class="seg-val">' + opts(['—','Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
          .map(function (m, i) { return { v: (i === 0 ? '' : i), l: m }; }), f.valor) + '</select>';
      case 'recencia_compra':
        return opInput('dias', 80, f);
      case 'nunca_comprou':
        return '<span class="tmu" style="font-size:10px">sem critério adicional</span>';
      case 'valor_gasto':
        return opInput('R$', 100, f);
      case 'qtd_compras':
        return opInput('qtd', 80, f);
      case 'canal':
        return '<select class="seg-val"><option value="">Selecione...</option>' +
          opts(ST.canais.slice().sort(function (a, b) { return a.nome.localeCompare(b.nome); }).map(function (c) { return { v: c.id, l: c.nome }; }), f.valor) + '</select>';
      case 'produto':
        return '<select class="seg-val"><option value="">Selecione...</option>' +
          opts(ST.produtos.slice().sort(function (a, b) { return a.nome.localeCompare(b.nome); }).map(function (p) { return { v: p.id, l: p.nome }; }), f.valor) + '</select>';
      case 'cidade':
        return '<input class="seg-val" type="text" placeholder="Ex: Rio de Janeiro" value="' + (f.valor || '') + '">';
      case 'estado':
        return '<input class="seg-val" type="text" placeholder="Ex: RJ" maxlength="2" style="width:60px" value="' + (f.valor || '') + '">';
      case 'ticket_medio':
        return opInput('R$', 100, f);
      case 'comprou_periodo':
        return '<select class="seg-val"><option value="">Selecione...</option>' +
          opts([{ v: 'mes', l: 'Este mês' }, { v: 'trimestre', l: 'Este trimestre' }, { v: 'ano', l: 'Este ano' }], f.valor) + '</select>';
      case 'dias_cadastro':
        return opInput('dias', 80, f);
      case 'dias_primeira_compra':
        return opInput('dias', 80, f);
      case 'nunca_comprou_produto':
        return '<select class="seg-val"><option value="">Selecione...</option>' +
          opts(ST.produtos.slice().sort(function (a, b) { return a.nome.localeCompare(b.nome); }).map(function (p) { return { v: p.id, l: p.nome }; }), f.valor) + '</select>';
      case 'regiao':
        return '<select class="seg-val"><option value="">Selecione...</option>' +
          opts(['Norte','Nordeste','Centro-Oeste','Sudeste','Sul'].map(function (r) { return { v: r, l: r }; }), f.valor) + '</select>';
      case 'pais':
        return '<input class="seg-val" type="text" placeholder="Ex: Brasil" value="' + (f.valor || '') + '">';
      case 'cep':
        return '<input class="seg-val" type="text" placeholder="Ex: 22793 (prefixo)" style="width:110px" value="' + (f.valor || '') + '">';
      case 'origem':
        return '<select class="seg-val"><option value="">Selecione...</option>' +
          opts(Array.from(new Set(ST.clientes.map(function (c) { return c.origem; }).filter(Boolean))).sort().map(function (o) { return { v: o, l: o }; }), f.valor) + '</select>';
      case 'sem_vendedor':
        return '<span class="tmu" style="font-size:10px">sem critério adicional</span>';
      case 'tipo_comercial':
        return '<select class="seg-val">' + opts([{ v: '', l: '—' }, { v: '__vazio__', l: 'Cliente Convertido (sem tipo)' }, { v: 'lead_b2c', l: 'Lead B2C' }, { v: 'canal_b2b', l: 'Canal B2B' }, { v: 'artista', l: 'Artista' }, { v: 'imprensa', l: 'Imprensa' }], f.valor) + '</select>';
      default: return '';
    }
  }

  function passaNoFiltro(cliente, f) {
    var agg = aggDe(cliente.id);
    switch (f.tipo) {
      case 'status_crm':
        if (!f.valor) return true;
        return String(cliente.statusCrmId) === String(f.valor);
      case 'tag_valor':
        if (!f.valor) return true;
        return (cliente.tagsComercial || []).indexOf(f.valor) !== -1;
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
      case 'ticket_medio': {
        if (f.valor === '' || f.valor == null) return true;
        var tm = agg.qtd ? agg.total / agg.qtd : 0;
        return f.operador === '>' ? tm > Number(f.valor) : tm < Number(f.valor);
      }
      case 'comprou_periodo':
        if (!f.valor) return true;
        return !!agg[f.valor]; // agg.mes / agg.trimestre / agg.ano
      case 'dias_cadastro': {
        if (!f.valor || !cliente.criadoEm) return f.operador === '>';
        var diasC = Math.floor((Date.now() - new Date(cliente.criadoEm).getTime()) / 86400000);
        return f.operador === '>' ? diasC > Number(f.valor) : diasC < Number(f.valor);
      }
      case 'dias_primeira_compra': {
        if (!f.valor) return true;
        if (!agg.primeiraData) return f.operador === '>';
        var diasP = Math.floor((Date.now() - new Date(agg.primeiraData).getTime()) / 86400000);
        return f.operador === '>' ? diasP > Number(f.valor) : diasP < Number(f.valor);
      }
      case 'nunca_comprou_produto':
        if (!f.valor) return true;
        return !agg.produtos.has(String(f.valor));
      case 'regiao':
        if (!f.valor) return true;
        return CDA_UF_REGIAO[(cliente.estado || '').toUpperCase()] === f.valor;
      case 'pais':
        if (!f.valor) return true;
        return (cliente.pais || '').toLowerCase().indexOf(f.valor.toLowerCase()) !== -1;
      case 'cep':
        if (!f.valor) return true;
        return (cliente.cep || '').replace(/\D/g, '').indexOf(f.valor.replace(/\D/g, '')) === 0;
      case 'origem':
        if (!f.valor) return true;
        return cliente.origem === f.valor;
      case 'sem_vendedor':
        return !cliente.responsavelComercial;
      case 'tipo_comercial':
        if (!f.valor) return true;
        if (f.valor === '__vazio__') return !cliente.tipoComercial;
        return cliente.tipoComercial === f.valor;
      default: return true;
    }
  }

  function passaNoFiltroRapido(cliente) {
    if (!ST.filtroRapido) return true;
    if (ST.filtroRapido.campo === 'tag') return (cliente.tagsComercial || []).indexOf(ST.filtroRapido.codigo) !== -1;
    var s = ST.statusCrm.find(function (x) { return x.codigo === ST.filtroRapido.codigo; });
    return s && String(cliente.statusCrmId) === String(s.id);
  }

  function aplicarFiltros() {
    var temCriterio = ST.filtros.length > 0 || !!ST.filtroRapido;
    var resultado = !temCriterio ? [] : ST.clientes.filter(function (c) {
      return passaNoFiltroRapido(c) && ST.filtros.every(function (f) { return passaNoFiltro(c, f); });
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
      var st = statusCrmPorId[c.statusCrmId];
      var badges = (st ? '<span class="seg-badge" style="background:' + st.cor + '">' + st.nome + '</span>' : '—') +
        (c.tagsComercial || []).map(function (t) {
          var ts = ST.statusCrm.find(function (s) { return s.codigo === t; });
          return ts ? ' <span class="seg-badge" style="background:' + ts.cor + '">' + ts.nome + '</span>' : '';
        }).join('');
      return '<tr>' +
        '<td><b>' + (c.nome || '—') + '</b></td>' +
        '<td>' + badges + '</td>' +
        '<td>' + (c.cidade || '—') + '/' + (c.estado || '—') + '</td>' +
        '<td>' + (c['data-nascimento'] || '—') + '</td>' +
        '<td>' + fmtData(agg.ultimaData) + '</td>' +
        '<td>' + agg.qtd + '</td>' +
        '<td>' + (agg.total ? 'R$ ' + agg.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '—') + '</td>' +
        '<td class="tmu" style="font-size:11px">' + (c.email || '—') + '</td>' +
        '<td class="mn">' + (c['telefone-celular'] || c['telefone-principal'] || '—') + '</td>' +
        '</tr>';
    }).join('') || '<tr><td colspan="9" style="text-align:center;color:var(--muted);padding:20px">' +
      (ST.filtros.length === 0 && !ST.filtroRapido ? 'Clique num status acima ou adicione um filtro para ver resultados.' : 'Nenhum cliente encontrado com esses critérios.') + '</td></tr>';
    host.querySelector('#seg-resultado-titulo').textContent = 'Resultado — ' + ST.resultado.length.toLocaleString('pt-BR') + ' cliente(s) encontrado(s)' +
      (ST.resultado.length > 200 ? ' (mostrando 200 primeiros)' : '');
  }

  host.querySelector('#seg-btn-addfiltro').addEventListener('click', function () {
    ST.filtros.push({ tipo: 'status_crm', operador: '>', valor: '' });
    renderFiltros();
    aplicarFiltros();
  });

  host.querySelector('#seg-carregar').addEventListener('change', function (e) {
    var seg = ST.segmentos.find(function (s) { return s.id === e.target.value; });
    if (editavel) { host.querySelector('#seg-btn-renomear').disabled = !seg; host.querySelector('#seg-btn-excluir-seg').disabled = !seg; }
    if (!seg) return;
    ST.filtros = JSON.parse(JSON.stringify(seg.filtros));
    ST.filtroRapido = null;
    renderPills();
    renderFiltros();
    aplicarFiltros();
  });

  if (editavel) {
  host.querySelector('#seg-btn-renomear').addEventListener('click', async function () {
    var sel = host.querySelector('#seg-carregar');
    var seg = ST.segmentos.find(function (s) { return s.id === sel.value; });
    if (!seg) return;
    var novoNome = prompt('Novo nome do segmento:', seg.nome);
    if (!novoNome || novoNome === seg.nome) return;
    try {
      var atualizado = await cdaSalvarSegmento({ id: seg.id, nome: novoNome, filtros: seg.filtros });
      var idx = ST.segmentos.findIndex(function (s) { return s.id === seg.id; });
      ST.segmentos[idx] = atualizado;
      popularSelects();
      sel.value = seg.id;
      alert('Segmento renomeado!');
    } catch (err) {
      console.error(err);
      alert('Erro ao renomear — veja o console.');
    }
  });

  host.querySelector('#seg-btn-excluir-seg').addEventListener('click', async function () {
    var sel = host.querySelector('#seg-carregar');
    var seg = ST.segmentos.find(function (s) { return s.id === sel.value; });
    if (!seg) return;
    if (!confirm('Excluir o segmento "' + seg.nome + '"? Essa ação não pode ser desfeita.')) return;
    try {
      await cdaExcluirSegmento(seg.id);
      ST.segmentos = ST.segmentos.filter(function (s) { return s.id !== seg.id; });
      popularSelects();
      host.querySelector('#seg-btn-renomear').disabled = true;
      host.querySelector('#seg-btn-excluir-seg').disabled = true;
      alert('Segmento excluído.');
    } catch (err) {
      console.error(err);
      alert('Erro ao excluir — veja o console.');
    }
  });

  host.querySelector('#seg-btn-salvar').addEventListener('click', async function () {
    var filtrosParaSalvar = ST.filtros.slice();
    if (ST.filtroRapido) {
      if (ST.filtroRapido.campo === 'tag') {
        filtrosParaSalvar.push({ tipo: 'tag_valor', operador: '=', valor: ST.filtroRapido.codigo });
      } else {
        var s = ST.statusCrm.find(function (x) { return x.codigo === ST.filtroRapido.codigo; });
        if (s) filtrosParaSalvar.push({ tipo: 'status_crm', operador: '=', valor: String(s.id) });
      }
    }
    if (filtrosParaSalvar.length === 0) { alert('Clique num status acima ou adicione ao menos 1 filtro antes de salvar.'); return; }
    var nome = prompt('Nome do segmento (ex: "Em Risco 91-180d"):');
    if (!nome) return;
    try {
      var salvo = await cdaSalvarSegmento({ nome: nome, filtros: filtrosParaSalvar });
      ST.segmentos.push(salvo);
      popularSelects();
      alert('Segmento salvo!');
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar segmento — veja o console.');
    }
  });
  } // fim if (editavel)

  if (editavel) host.querySelector('#seg-btn-exportar').addEventListener('click', function () {
    if (ST.resultado.length === 0) { alert('Nenhum resultado para exportar.'); return; }
    var header = ['Nome', 'Status CRM', 'Tags', 'E-mail', 'Telefone', 'Cidade', 'Estado', 'Aniversário', 'Última Compra', 'Qtd Compras', 'Total Gasto'];
    var data = ST.resultado.map(function (c) {
      var agg = aggDe(c.id);
      var st = statusCrmPorId[c.statusCrmId];
      return [c.nome, st ? st.nome : '', (c.tagsComercial || []).join(', '), c.email || '', c['telefone-celular'] || c['telefone-principal'] || '', c.cidade || '', c.estado || '',
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

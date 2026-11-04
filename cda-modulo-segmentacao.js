// ════════════════════════════════════════════════════════════════════
// cda-modulo-segmentacao.js
// Segmentação de Clientes — construtor de filtros dinâmicos combináveis
// (aniversário, recência de compra, valor gasto, canal, produto, etc.)
// + salvar segmentos + exportar XLSX.
//
// Requer cda-dados-compartilhados.js (cdaCarregarClientes, cdaCarregarCompras,
// cdaCarregarCanais, cdaCarregarProdutos, cdaCarregarSegmentos,
// cdaSalvarSegmento, cdaExcluirSegmento, cdaCarregarHierarquiaReceita e o
// motor único cdaMotorSegmento), cda-construtor-filtros.js (componente de
// filtros, CDA_TIPOS_FILTRO_SEG) e a lib SheetJS (XLSX) carregadas antes.
// A tela tem dois blocos (nov/2026): 1 · Universo (Plano de Contas +
// Geografia) e 2 · Filtros comerciais (quem, dentro do universo). Cada bloco
// salva/carrega o seu tipo de segmento: "Universo salvo" e "Modelo comercial".
// A REGRA de cada filtro mora só em cdaMotorSegmento (dados-compartilhados);
// aqui fica apenas a interface (campos de valor, listeners, resultado).
//
// Uso:
//   <div id="container-segmentacao"></div>
//   <script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>
//   <script src="cda-dados-compartilhados.js"></script>
//   <script src="cda-modulo-segmentacao.js"></script>
//   <script>montarModuloSegmentacao('container-segmentacao');</script>
// ════════════════════════════════════════════════════════════════════

// Tipos de filtro (CDA_TIPOS_FILTRO_SEG) e a divisão Universo × Comercial
// moram em cda-construtor-filtros.js.

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

  var ST = { clientes: [], compras: [], canais: [], produtos: [], segmentos: [], statusCrm: [], parametros: null, hierarquia: [], filtroRapido: null, resultado: [] };
  var cfU = null, cfC = null; // construtores: Universo e Filtros comerciais
  var motor = null; // cdaMotorSegmento — montado após a carga

  host.innerHTML =
    '<style>' +
      '.seg-carregando{padding:40px 20px;text-align:center;font-size:13px;color:var(--muted,#888);}' +
      '.seg-lista-sec{border:2px solid var(--ink,#1a1a1a);padding:12px 14px;margin-bottom:12px;}' +
      '.seg-lista-tit{font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;}' +
      '.seg-lista-tit .tmu{text-transform:none;letter-spacing:0;font-weight:400;}' +
      '.seg-lista-item{display:flex;align-items:center;gap:12px;padding:8px 0;border-top:1px solid rgba(0,0,0,.12);flex-wrap:wrap;}' +
      '.seg-lista-item .nome{flex:1;min-width:200px;font-weight:700;font-size:12px;}' +
      '.seg-lista-item .n{font-size:11px;color:var(--muted,#888);min-width:100px;text-align:right;}' +
      '.seg-lista-item .acoes{display:flex;gap:5px;}' +
      '.seg-vazio{font-size:11px;color:var(--muted,#888);padding:8px 0;}' +
      '.seg-cad-linha{display:flex;align-items:center;gap:10px;margin-bottom:10px;flex-wrap:wrap;}' +
      '.seg-cad-linha>label{width:60px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;}' +
      '.seg-cad-linha input{flex:1;min-width:240px;max-width:520px;font-size:12px;padding:7px 10px;border:2px solid var(--ink,#1a1a1a);}' +
      '.seg-cad-rodape{display:flex;justify-content:flex-end;gap:8px;margin-top:14px;}' +
      '.seg-bloco{border:2px solid var(--ink,#1a1a1a);padding:12px 14px;margin-bottom:12px;}' +
      '.seg-bloco-cab{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px;}' +
      '.seg-bloco-cab b{font-size:13px;text-transform:uppercase;letter-spacing:.5px;}' +
      '.seg-bloco-acoes{display:flex;gap:6px;flex-wrap:wrap;}' +
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
      '.seg-uf-wrap{display:flex;gap:4px;flex-wrap:wrap;align-items:center;max-width:760px;}' +
      '.seg-uf-sel{display:inline-flex;align-items:center;gap:3px;font-family:\'Syne\',sans-serif;font-size:10px;font-weight:700;padding:4px 8px;border:2px solid var(--ink,#1a1a1a);background:var(--ink,#1a1a1a);color:#fff;}' +
      '.seg-uf-sel .n{font-style:normal;font-weight:400;opacity:.75;}' +
      '.seg-uf-sel b{cursor:pointer;margin-left:4px;}' +
      '.seg-pc-tags{flex-basis:100%;display:flex;gap:4px;flex-wrap:wrap;align-items:center;margin-top:6px;font-size:10px;}' +
      '.seg-pc-tags .rot{font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--muted,#888);margin-left:6px;}' +
      '.seg-pc-tags .rot:first-child{margin-left:0;}' +
      '.seg-uf{font-family:\'Syne\',sans-serif;font-size:10px;font-weight:700;padding:4px 7px;border:2px solid var(--ink,#1a1a1a);background:var(--paper,#fff);cursor:pointer;user-select:none;}' +
      '.seg-uf .n{font-style:normal;font-weight:400;opacity:.7;margin-left:3px;}' +
      '.seg-uf.zero{opacity:.35;}' +
      '.seg-uf.ativa{background:var(--ink,#1a1a1a);color:#fff;opacity:1;}' +
      '.seg-ms{position:relative;display:inline-block;}' +
      '.seg-ms-btn{font-family:\'Syne\',sans-serif;font-size:11px;padding:6px 9px;border:2px solid var(--ink,#1a1a1a);background:var(--paper,#fff);cursor:pointer;max-width:260px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:left;}' +
      '.seg-ms-btn.tem{background:var(--ink,#1a1a1a);color:#fff;}' +
      '.seg-ms-painel{position:absolute;z-index:50;top:100%;left:0;min-width:300px;max-height:320px;overflow:auto;background:var(--paper,#fff);border:2px solid var(--ink,#1a1a1a);box-shadow:4px 4px 0 rgba(0,0,0,.25);padding:6px 0;}' +
      '.seg-ms-acoes{display:flex;gap:10px;padding:2px 10px 6px;border-bottom:1px solid #ddd;font-size:10px;}' +
      '.seg-ms-acoes a{cursor:pointer;text-decoration:underline;}' +
      '.seg-ms-painel label{display:flex;gap:7px;align-items:center;padding:4px 10px;font-size:11px;cursor:pointer;white-space:nowrap;}' +
      '.seg-ms-painel label:hover{background:var(--card,#f5f0e8);}' +
      '.seg-ms-painel label.zero{opacity:.45;}' +
      '.seg-ms-painel label i{font-style:normal;opacity:.65;margin-left:auto;padding-left:10px;}' +
      '.seg-cid,.seg-pc-tag{display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:700;padding:4px 8px;border:2px solid var(--ink,#1a1a1a);background:var(--ink,#1a1a1a);color:#fff;}' +
      '.seg-cid b,.seg-pc-tag b{cursor:pointer;margin-left:3px;}' +
      '.seg-resumo-email{font-size:11px;padding:8px 12px;border-bottom:1px solid var(--ink,#1a1a1a);background:var(--card,#f5f0e8);}' +
    '</style>' +
    '<div id="seg-carregando" class="seg-carregando">⏳ Aguarde, carregando a Segmentação de Clientes…</div>' +
    '<div id="seg-conteudo" hidden>' +
    // ── Tela A · lista de segmentações salvas ──
    '<div id="seg-vista-lista">' +
      '<div class="row-bt">' +
        '<div><div class="sec-t">Segmentação de Clientes</div><div class="sec-d">Grupos de clientes por inteligência (Lead, Ativo, Em risco, VIP...) e filtros comerciais — o universo (Plano de Contas e Geografia) é definido em cada Campanha</div></div>' +
        '<div style="display:flex;gap:7px;"><button class="btn" id="seg-btn-valores">⚙ Valores Premium/VIP</button>' +
        (editavel ? '<button class="btn rust" id="seg-btn-nova">✚ Nova segmentação</button>' : '') + '</div>' +
      '</div>' +
      '<div class="seg-recalc" id="seg-recalc" hidden></div>' +
      '<div id="seg-nota-exclusao" class="seg-nota"></div>' +
      '<div class="seg-lista-sec"><div class="seg-lista-tit">Segmentações salvas</div><div id="seg-lista-c"></div></div>' +
    '</div>' +
    // ── Tela B · cadastro (nova, editar, duplicar) ──
    '<div id="seg-vista-cadastro" hidden>' +
      '<div class="row-bt">' +
        '<div style="display:flex;align-items:center;gap:12px"><button class="btn sm" id="seg-btn-voltar">← Voltar</button><span class="sec-t" id="seg-cad-titulo">Nova segmentação</span></div>' +
        (editavel ? '<div><button class="btn" id="seg-btn-exportar">⬇ Exportar prévia (XLSX)</button></div>' : '') +
      '</div>' +
      '<div class="seg-bloco">' +
        '<div class="seg-cad-linha"><label for="seg-cad-nome">Nome</label><input id="seg-cad-nome" type="text" maxlength="120" placeholder="Ex: E-commerce Luedji Luna · Nordeste"' + (editavel ? '' : ' disabled') + '></div>' +
        '<div class="seg-cad-linha" id="seg-cad-misto" hidden><label></label><span class="tmu" style="font-size:11px">Segmentação antiga que também guarda Plano de Contas/Geografia — esses filtros aparecem abaixo e continuam valendo</span></div>' +
      '</div>' +
      '<div class="seg-bloco" id="seg-bloco-u" hidden><div class="seg-bloco-cab"><div><b>Plano de Contas e Geografia</b> <span class="tmu">(segmentação antiga)</span></div></div><div id="seg-cf-universo"></div></div>' +
      '<div class="seg-bloco" id="seg-bloco-c"><div class="seg-bloco-cab"><div><b>Inteligência e filtros comerciais</b></div></div>' +
        '<div class="seg-and" style="margin-top:0">Inteligência — atalhos de 1 clique</div><div id="seg-pills" class="seg-pills-wrap"></div><div id="seg-cf-comercial"></div></div>' +
    '<div class="tw" style="margin-top:16px">' +
      '<div class="th"><h3 id="seg-resultado-titulo">Resultado</h3></div>' +
      '<div class="seg-resumo-email" id="seg-resumo-email" style="display:none"></div>' +
      '<div class="ts"><table>' +
        '<thead><tr><th>Nome</th><th>Status CRM</th><th>Cidade/UF</th><th>Aniversário</th><th>Última Compra</th><th>Qtd Compras</th><th>Total Gasto</th><th>E-mail</th><th>Telefone</th></tr></thead>' +
        '<tbody id="seg-tb"></tbody>' +
      '</table></div>' +
    '</div>' +
      (editavel ? '<div class="seg-cad-rodape"><button class="btn" id="seg-btn-cancelar">Cancelar</button><button class="btn rust" id="seg-btn-salvar">💾 Salvar</button></div>' : '') +
    '</div>' +
    '</div>';

  try {
    var res = await Promise.all([
      cdaCarregarClientes(), cdaCarregarCompras(), cdaCarregarCanais(), cdaCarregarProdutos(), cdaCarregarSegmentos(), cdaCarregarStatusCrm(), cdaCarregarParametrosSegmentacao(), cdaCarregarHierarquiaReceita()
    ]);
    var clientesBrutos = res[0]; ST.compras = res[1]; ST.canais = res[2]; ST.produtos = res[3]; ST.segmentos = res[4]; ST.statusCrm = res[5]; ST.parametros = res[6]; ST.hierarquia = res[7] || [];

    // ── Exclui do universo da tela: cadastros genéricos (placeholder de show,
    // dado de teste etc.) — não representam consumidor final individual ──
    ST.clientes = clientesBrutos.filter(function (c) { return !c.cadastroIncompleto; });
    var qtdExcluidosCadastro = clientesBrutos.length - ST.clientes.length;

    // ── Escopo B2C: só canais de venda direta ao consumidor final entram
    // no cálculo de Segmentação (revenda/atacado fica de fora, vira B2B) ──
    // (regra aplicada pelo motor único cdaMotorSegmento ao receber os canais)
    var comprasTotal = ST.compras.length;
    motor = cdaMotorSegmento(ST.compras, { canais: ST.canais, hierarquia: ST.hierarquia });
    ST.compras = motor.compras;
    var qtdComprasExcluidas = comprasTotal - ST.compras.length;

    host.querySelector('#seg-nota-exclusao').textContent =
      (qtdExcluidosCadastro || qtdComprasExcluidas)
        ? '⚠ ' + qtdExcluidosCadastro.toLocaleString('pt-BR') + ' cadastro(s) genérico(s) e ' + qtdComprasExcluidas.toLocaleString('pt-BR') + ' compra(s) de canal B2B foram excluídos automaticamente desta análise.'
        : '';
  } catch (err) {
    console.error(err);
    host.querySelector('#seg-carregando').hidden = true;
    host.querySelector('#seg-conteudo').hidden = false;
    var msg = (err && (err.message || err.details || err.hint)) || 'Erro desconhecido';
    host.querySelector('#seg-lista-c').innerHTML = '<div class="seg-vazio" style="color:var(--rust,#c0392b)">Erro ao carregar dados do Supabase: <b>' + msg + '</b></div>';
    return;
  }

  host.querySelector('#seg-carregando').hidden = true;
  host.querySelector('#seg-conteudo').hidden = false;
  var statusCrmPorId = {}; ST.statusCrm.forEach(function (s) { statusCrmPorId[s.id] = s; });

  // ── Agregados de compra por cliente: calculados 1x pelo motor único ──
  function aggDe(clienteId) { return motor.aggDe(clienteId); }

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
        marcarSujo();
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

  // Regra de cada filtro: motor único (cdaMotorSegmento em cda-dados-compartilhados.js)
  function passaNoFiltro(cliente, f) { return motor.passa(cliente, f); }

  function passaNoFiltroRapido(cliente) {
    if (!ST.filtroRapido) return true;
    if (ST.filtroRapido.campo === 'tag') return (cliente.tagsComercial || []).indexOf(ST.filtroRapido.codigo) !== -1;
    var s = ST.statusCrm.find(function (x) { return x.codigo === ST.filtroRapido.codigo; });
    return s && String(cliente.statusCrmId) === String(s.id);
  }

  // ── Cadastro aberto: CAD = { id, tipo: 'universo' | 'comercial' | 'misto', sujo } ──
  var CAD = null;
  function marcarSujo() { if (CAD) CAD.sujo = true; }
  function usaU() { return !!CAD && CAD.tipo !== 'comercial'; }
  function usaC() { return !!CAD && CAD.tipo !== 'universo'; }
  function filtrosU() { return cfU ? cfU.filtros() : []; }
  function filtrosC() { return cfC ? cfC.filtros() : []; }
  // Prévia do cadastro: só os blocos do tipo escolhido
  function aplicarFiltros() {
    var temCriterio = (usaU() && filtrosU().length > 0) || (usaC() && (filtrosC().length > 0 || !!ST.filtroRapido));
    ST.resultado = !temCriterio ? [] : ST.clientes.filter(function (c) {
      return (!usaU() || cfU.passa(c)) && (!usaC() || (passaNoFiltroRapido(c) && cfC.passa(c)));
    });
    renderResultado();
    if (cfU) cfU.atualizarContagens();
    if (cfC) cfC.atualizarContagens();
  }

  // ── Os dois blocos de filtro (componente cda-construtor-filtros.js) ──
  var ctxCF = { motor: motor, clientes: ST.clientes, hierarquia: ST.hierarquia, statusCrm: ST.statusCrm, produtos: ST.produtos, canais: ST.canais };
  cfU = cdaConstrutorFiltros(host.querySelector('#seg-cf-universo'), ctxCF, {
    tipos: CDA_FILTROS_UNIVERSO, rotuloAdicionar: '＋ Adicionar Plano de Contas ou Geografia',
    aoMudar: function () { marcarSujo(); aplicarFiltros(); },
    passaOutros: function (c) { return CAD && CAD.tipo === 'misto' ? passaNoFiltroRapido(c) && cfC.passa(c) : true; }
  });
  cfC = cdaConstrutorFiltros(host.querySelector('#seg-cf-comercial'), ctxCF, {
    tipos: CDA_FILTROS_COMERCIAIS, rotuloAdicionar: '＋ Adicionar filtro',
    aoMudar: function () { marcarSujo(); aplicarFiltros(); },
    passaOutros: function (c) { return passaNoFiltroRapido(c) && (CAD && CAD.tipo === 'misto' ? cfU.passa(c) : true); }
  });

  // ── Tela A · lista ──
  function escH(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]; }); }
  function tipoDe(sg) { return cdaTipoSegmento(sg.filtros); }
  function contar(sg) {
    var fs = sg.filtros || [];
    return ST.clientes.filter(function (c) { return fs.every(function (f) { return motor.passa(c, f); }); }).length;
  }
  function renderLista() {
    // Universos salvos (só Plano de Contas/Geografia) ficam na Campanha, não aqui
    ['c'].forEach(function (k) {
      var lista = ST.segmentos.filter(function (sg) { return tipoDe(sg) !== 'universo'; })
        .sort(function (a, b) { return String(a.nome).localeCompare(String(b.nome)); });
      var box = host.querySelector('#seg-lista-' + k);
      box.innerHTML = lista.length ? lista.map(function (sg) {
        return '<div class="seg-lista-item" data-id="' + escH(sg.id) + '">' +
          '<span class="nome">' + escH(sg.nome) + (tipoDe(sg) === 'misto' ? ' <span class="tmu" style="font-weight:400">(com universo)</span>' : '') + '</span>' +
          '<span class="n">' + contar(sg).toLocaleString('pt-BR') + ' cliente(s)</span>' +
          '<span class="acoes">' + (editavel
            ? '<button class="btn sm" data-acao="editar">✎ Editar</button><button class="btn sm" data-acao="duplicar">⧉ Duplicar</button><button class="btn sm" data-acao="excluir">🗑 Excluir</button>'
            : '<button class="btn sm" data-acao="editar">👁 Ver</button>') + '</span>' +
        '</div>';
      }).join('') : '<div class="seg-vazio">Nenhuma segmentação salva ainda.' + (editavel ? ' Use "✚ Nova segmentação".' : '') + '</div>';
      box.querySelectorAll('[data-acao]').forEach(function (b) {
        b.addEventListener('click', async function () {
          var sg = ST.segmentos.find(function (x) { return String(x.id) === b.closest('.seg-lista-item').dataset.id; });
          if (!sg) return;
          if (b.dataset.acao === 'editar') return abrirCadastro(sg, false);
          if (b.dataset.acao === 'duplicar') return abrirCadastro(sg, true);
          if (!confirm('Excluir a segmentação "' + sg.nome + '"? Essa ação não pode ser desfeita.')) return;
          try {
            await cdaExcluirSegmento(sg.id);
            ST.segmentos = ST.segmentos.filter(function (x) { return x.id !== sg.id; });
            renderLista();
          } catch (err) { console.error(err); alert('Erro ao excluir — veja o console.'); }
        });
      });
    });
  }

  // ── Tela B · cadastro ──
  function mostrarBlocos() {
    host.querySelector('#seg-bloco-u').hidden = !usaU();
    host.querySelector('#seg-bloco-c').hidden = !usaC();
    host.querySelector('#seg-cad-misto').hidden = CAD.tipo !== 'misto';
  }
  function abrirCadastro(sg, duplicar) {
    CAD = { id: sg && !duplicar ? sg.id : null, tipo: sg && tipoDe(sg) === 'misto' ? 'misto' : 'comercial', sujo: false };
    var fs = sg ? sg.filtros : [];
    cfU.definir(fs.filter(cdaFiltroEhUniverso));
    cfC.definir(fs.filter(function (f) { return !cdaFiltroEhUniverso(f); }));
    ST.filtroRapido = null;
    renderPills();
    host.querySelector('#seg-cad-nome').value = sg ? (duplicar ? 'Cópia de ' + sg.nome : sg.nome) : '';
    host.querySelector('#seg-cad-titulo').textContent = !sg ? 'Nova segmentação' : (duplicar ? 'Duplicar segmentação' : (editavel ? 'Editar segmentação' : 'Ver segmentação'));
    mostrarBlocos();
    host.querySelector('#seg-vista-lista').hidden = true;
    host.querySelector('#seg-vista-cadastro').hidden = false;
    aplicarFiltros();
    if (duplicar) CAD.sujo = true;
    if (host.scrollIntoView) host.scrollIntoView();
  }
  function voltarLista(semPerguntar) {
    if (!semPerguntar && CAD && CAD.sujo && editavel && !confirm('Descartar as alterações desta segmentação?')) return;
    CAD = null;
    ST.filtroRapido = null;
    host.querySelector('#seg-vista-cadastro').hidden = true;
    host.querySelector('#seg-vista-lista').hidden = false;
    renderLista();
  }
  host.querySelector('#seg-btn-voltar').addEventListener('click', function () { voltarLista(false); });
  host.querySelector('#seg-cad-nome').addEventListener('input', marcarSujo);
  host.querySelector('#seg-btn-valores').addEventListener('click', function () {
    var box = host.querySelector('#seg-recalc');
    box.hidden = !box.hidden;
  });
  if (editavel) {
    host.querySelector('#seg-btn-nova').addEventListener('click', function () { abrirCadastro(null, false); });
    host.querySelector('#seg-btn-cancelar').addEventListener('click', function () { voltarLista(false); });
    host.querySelector('#seg-btn-salvar').addEventListener('click', async function () {
      var nome = host.querySelector('#seg-cad-nome').value.trim();
      if (!nome) { alert('Dê um nome à segmentação.'); host.querySelector('#seg-cad-nome').focus(); return; }
      var filtros = [];
      if (usaU()) filtros = filtros.concat(filtrosU());
      if (usaC()) {
        filtros = filtros.concat(filtrosC());
        if (ST.filtroRapido) {
          if (ST.filtroRapido.campo === 'tag') filtros.push({ tipo: 'tag_valor', operador: '=', valor: ST.filtroRapido.codigo });
          else {
            var st = ST.statusCrm.find(function (x) { return x.codigo === ST.filtroRapido.codigo; });
            if (st) filtros.push({ tipo: 'status_crm', operador: '=', valor: String(st.id) });
          }
        }
      }
      if (!filtros.length) { alert('Clique num atalho de inteligência ou adicione ao menos um filtro.'); return; }
      var repetido = ST.segmentos.some(function (x) { return x.id !== CAD.id && String(x.nome).trim().toLowerCase() === nome.toLowerCase(); });
      if (repetido && !confirm('Já existe uma segmentação chamada "' + nome + '". Salvar mesmo assim?')) return;
      var btn = host.querySelector('#seg-btn-salvar'); btn.disabled = true;
      try {
        var salvo = await cdaSalvarSegmento(CAD.id ? { id: CAD.id, nome: nome, filtros: filtros } : { nome: nome, filtros: filtros });
        var pos = ST.segmentos.findIndex(function (x) { return x.id === salvo.id; });
        if (pos === -1) ST.segmentos.push(salvo); else ST.segmentos[pos] = salvo;
        voltarLista(true);
      } catch (err) { console.error(err); alert('Erro ao salvar — veja o console.'); }
      btn.disabled = false;
    });
  }
  renderLista();

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
      (!(usaU() && filtrosU().length) && !(usaC() && (filtrosC().length || ST.filtroRapido)) ? 'Adicione filtros acima para ver a prévia desta segmentação.' : 'Nenhum cliente encontrado com esses critérios.') + '</td></tr>';
    // Prontidão para E-mail Marketing: e-mail válido e único (repetido conta 1x)
    var vistosEmail = {}, emailsUnicos = 0, semEmail = 0, repetidos = 0;
    ST.resultado.forEach(function (c) {
      if (!cdaEmailValido(c.email)) { semEmail++; return; }
      var e = String(c.email).trim().toLowerCase();
      if (vistosEmail[e]) { repetidos++; return; }
      vistosEmail[e] = 1; emailsUnicos++;
    });
    var boxEmail = host.querySelector('#seg-resumo-email');
    boxEmail.style.display = ST.resultado.length ? '' : 'none';
    boxEmail.innerHTML = '📧 Prontos para e-mail: <b>' + emailsUnicos.toLocaleString('pt-BR') + '</b> endereço(s) único(s)' +
      (semEmail ? ' · ' + semEmail.toLocaleString('pt-BR') + ' sem e-mail ou inválido' : '') +
      (repetidos ? ' · ' + repetidos.toLocaleString('pt-BR') + ' e-mail(s) repetido(s) (contam 1x)' : '');
    host.querySelector('#seg-resultado-titulo').textContent = 'Prévia — ' + ST.resultado.length.toLocaleString('pt-BR') + ' cliente(s)' +
      (ST.resultado.length > 200 ? ' (mostrando 200 primeiros)' : '');
  }

  if (editavel) host.querySelector('#seg-btn-exportar').addEventListener('click', function () {
    if (ST.resultado.length === 0) { alert('Nenhum resultado para exportar.'); return; }
    var header = ['Nome', 'Status CRM', 'Tags', 'E-mail', 'E-mail válido', 'Telefone', 'Cidade', 'Estado', 'Aniversário', 'Última Compra', 'Qtd Compras', 'Total Gasto'];
    var data = ST.resultado.map(function (c) {
      var agg = aggDe(c.id);
      var st = statusCrmPorId[c.statusCrmId];
      return [c.nome, st ? st.nome : '', (c.tagsComercial || []).join(', '), c.email || '', cdaEmailValido(c.email) ? 'Sim' : 'Não', c['telefone-celular'] || c['telefone-principal'] || '', c.cidade || '', c.estado || '',
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

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
// Desenho (decisão de Cardoso, 04/11/2026): a SEGMENTAÇÃO guarda só QUAIS
// filtros usa (tipos) — nenhum valor. Os valores são preenchidos em cada
// CAMPANHA (cda-modulo-campanhas.js). A tela tem duas caixas:
//   1 · Segmentações parametrizadas — criadas pela equipe (nome + tipos)
//   2 · Modelos comerciais — status/classificações calculados pelo sistema
//       (Lead, Ativo, Em risco, VIP...), com contagem e prévia.
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

  var ST = { clientes: [], compras: [], canais: [], produtos: [], segmentos: [], statusCrm: [], parametros: null, hierarquia: [], resultado: [], modeloAberto: null };
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
      '.seg-tipos-grupo{margin-bottom:10px;}' +
      '.seg-tipos-grupo .g{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--muted,#888);margin-bottom:4px;}' +
      '.seg-tipos-grupo label{display:inline-flex;align-items:center;gap:5px;font-size:12px;margin:0 14px 6px 0;cursor:pointer;}' +
      '.seg-lista-item .resumo{flex:2;min-width:220px;font-size:11px;color:var(--muted,#888);}' +
      '.seg-lista-item .dot{width:9px;height:9px;border-radius:50%;display:inline-block;margin-right:6px;}' +
    '</style>' +
    '<div id="seg-carregando" class="seg-carregando">⏳ Aguarde, carregando a Segmentação de Clientes…</div>' +
    '<div id="seg-conteudo" hidden>' +
    // ── Lista: duas caixas ──
    '<div id="seg-vista-lista">' +
      '<div class="row-bt">' +
        '<div><div class="sec-t">Segmentação de Clientes</div><div class="sec-d">A segmentação diz quais filtros usar — os valores (qual artista, qual praça, quantos dias...) são preenchidos em cada Campanha</div></div>' +
        '<div style="display:flex;gap:7px;"><button class="btn" id="seg-btn-valores">⚙ Valores Premium/VIP</button>' +
        (editavel ? '<button class="btn rust" id="seg-btn-nova">✚ Nova segmentação</button>' : '') + '</div>' +
      '</div>' +
      '<div class="seg-recalc" id="seg-recalc" hidden></div>' +
      '<div id="seg-nota-exclusao" class="seg-nota"></div>' +
      '<div class="seg-lista-sec"><div class="seg-lista-tit">Segmentações parametrizadas <span class="tmu">· filtros preenchidos em cada campanha</span></div><div id="seg-lista-p"></div></div>' +
      '<div class="seg-lista-sec"><div class="seg-lista-tit">Modelos comerciais <span class="tmu">· calculados pelo sistema todo dia</span></div><div id="seg-lista-m"></div></div>' +
    '</div>' +
    // ── Cadastro de segmentação parametrizada: nome + filtros que ela usa ──
    '<div id="seg-vista-cadastro" hidden>' +
      '<div class="row-bt"><div style="display:flex;align-items:center;gap:12px"><button class="btn sm" id="seg-btn-voltar">← Voltar</button><span class="sec-t" id="seg-cad-titulo">Nova segmentação</span></div></div>' +
      '<div class="seg-bloco">' +
        '<div class="seg-cad-linha"><label for="seg-cad-nome">Nome</label><input id="seg-cad-nome" type="text" maxlength="120" placeholder="Ex: Artista · Praça · Público"' + (editavel ? '' : ' disabled') + '></div>' +
      '</div>' +
      '<div class="seg-bloco"><div class="seg-bloco-cab"><div><b>Filtros desta segmentação</b> <span class="tmu">marque os que ela usa — os valores são preenchidos em cada campanha</span></div></div>' +
        '<div id="seg-cad-tipos"></div>' +
        '<div class="seg-nota" id="seg-cad-resumo" style="margin:4px 0 0"></div>' +
      '</div>' +
      (editavel ? '<div class="seg-cad-rodape"><button class="btn" id="seg-btn-cancelar">Cancelar</button><button class="btn rust" id="seg-btn-salvar">💾 Salvar</button></div>' : '') +
    '</div>' +
    // ── Modelo comercial: só o filtro (os dados ficam nas Campanhas) ──
    '<div id="seg-vista-modelo" hidden>' +
      '<div class="row-bt"><div style="display:flex;align-items:center;gap:12px"><button class="btn sm" id="seg-btn-voltar-m">← Voltar</button><span class="sec-t" id="seg-mod-titulo"></span></div>' +
        '<div style="display:flex;gap:7px;">' + (editavel ? '<button class="btn" id="seg-btn-duplicar-m">⧉ Duplicar como parametrizada</button>' : '') + '</div></div>' +
      '<div class="seg-bloco"><div class="seg-cad-linha"><label>Filtro</label><span id="seg-mod-resumo" style="font-size:12px"></span></div><div class="seg-nota" id="seg-mod-desc" style="margin:0"></div>' +
        '<div class="seg-nota" style="margin:8px 0 0">Os clientes e os números aparecem em <b>Campanhas</b>: crie uma campanha escolhendo este modelo como público.</div></div>' +
    '</div>' +
    '</div>';

  try {
    var res = await Promise.all([
      cdaCarregarClientes(), cdaCarregarCompras(), cdaCarregarCanais(), cdaCarregarProdutos(), cdaCarregarSegmentos(), cdaCarregarStatusCrm(), cdaCarregarParametrosSegmentacao(), cdaCarregarHierarquiaReceita()
    ]);
    var clientesBrutos = res[0]; ST.compras = res[1]; ST.canais = res[2]; ST.produtos = res[3]; ST.segmentos = res[4]; ST.statusCrm = res[5]; ST.parametros = res[6]; ST.hierarquia = res[7] || [];
    // Cadastros genéricos (placeholder de show etc.) não representam consumidor final
    ST.clientes = clientesBrutos.filter(function (c) { return !c.cadastroIncompleto; });
    var qtdExcluidosCadastro = clientesBrutos.length - ST.clientes.length;
    // Escopo B2C (regra aplicada pelo motor único ao receber os canais)
    var comprasTotal = ST.compras.length;
    motor = cdaMotorSegmento(ST.compras, { canais: ST.canais, hierarquia: ST.hierarquia });
    ST.compras = motor.compras;
    var qtdComprasExcluidas = comprasTotal - ST.compras.length;
    host.querySelector('#seg-nota-exclusao').textContent = (qtdExcluidosCadastro || qtdComprasExcluidas)
      ? '⚠ ' + qtdExcluidosCadastro.toLocaleString('pt-BR') + ' cadastro(s) genérico(s) e ' + qtdComprasExcluidas.toLocaleString('pt-BR') + ' compra(s) de canal B2B ficam fora das contagens.' : '';
  } catch (err) {
    console.error(err);
    host.querySelector('#seg-carregando').hidden = true;
    host.querySelector('#seg-conteudo').hidden = false;
    var msg = (err && (err.message || err.details || err.hint)) || 'Erro desconhecido';
    host.querySelector('#seg-lista-p').innerHTML = '<div class="seg-vazio" style="color:var(--rust,#c0392b)">Erro ao carregar dados do Supabase: <b>' + msg + '</b></div>';
    return;
  }
  host.querySelector('#seg-carregando').hidden = true;
  host.querySelector('#seg-conteudo').hidden = false;
  var statusCrmPorId = {}; ST.statusCrm.forEach(function (s) { statusCrmPorId[s.id] = s; });
  function aggDe(clienteId) { return motor.aggDe(clienteId); }
  function escH(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]; }); }

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

  // ── Navegação entre as vistas ──
  function mostrar(vista) {
    ['lista', 'cadastro', 'modelo'].forEach(function (v) { host.querySelector('#seg-vista-' + v).hidden = v !== vista; });
    if (host.scrollIntoView) host.scrollIntoView();
  }

  // ── Lista ──
  var MODELOS = cdaModelosComerciais(ST.statusCrm);
  function renderLista() {
    var parametrizadas = ST.segmentos.slice().sort(function (a, b) { return String(a.nome).localeCompare(String(b.nome)); });
    host.querySelector('#seg-lista-p').innerHTML = parametrizadas.length ? parametrizadas.map(function (sg) {
      return '<div class="seg-lista-item" data-id="' + escH(sg.id) + '">' +
        '<span class="nome">' + escH(sg.nome) + '</span>' +
        '<span class="resumo">' + escH(cdaResumoTipos(sg.filtros)) + '</span>' +
        '<span class="acoes">' + (editavel
          ? '<button class="btn sm" data-acao="editar">✎ Editar</button><button class="btn sm" data-acao="duplicar">⧉ Duplicar</button><button class="btn sm" data-acao="excluir">🗑 Excluir</button>'
          : '<button class="btn sm" data-acao="editar">👁 Ver</button>') + '</span></div>';
    }).join('') : '<div class="seg-vazio">Nenhuma segmentação ainda.' + (editavel ? ' Use "✚ Nova segmentação".' : '') + '</div>';
    host.querySelector('#seg-lista-m').innerHTML = MODELOS.map(function (m) {
      return '<div class="seg-lista-item" data-modelo="' + escH(m.id) + '">' +
        '<span class="nome"><span class="dot" style="background:' + escH(m.cor) + '"></span>' + escH(m.nome) + '</span>' +
        '<span class="resumo">' + escH(m.resumo) + '</span>' +
        '<span class="acoes"><button class="btn sm" data-acao="ver">' + (editavel ? '✎ Editar' : '👁 Ver') + '</button>' +
        (editavel ? '<button class="btn sm" data-acao="duplicar">⧉ Duplicar</button>' : '') + '</span></div>';
    }).join('');
    host.querySelectorAll('#seg-lista-p [data-acao]').forEach(function (b) {
      b.addEventListener('click', async function () {
        var sg = ST.segmentos.find(function (x) { return String(x.id) === b.closest('.seg-lista-item').dataset.id; });
        if (!sg) return;
        if (b.dataset.acao === 'editar') return abrirCadastro(sg, false);
        if (b.dataset.acao === 'duplicar') return abrirCadastro(sg, true);
        if (!confirm('Excluir a segmentação "' + sg.nome + '"? Campanhas que já a usam continuam com os seus valores.')) return;
        try {
          await cdaExcluirSegmento(sg.id);
          ST.segmentos = ST.segmentos.filter(function (x) { return x.id !== sg.id; });
          renderLista();
        } catch (err) { console.error(err); alert('Erro ao excluir — veja o console.'); }
      });
    });
    host.querySelectorAll('#seg-lista-m [data-acao]').forEach(function (b) {
      b.addEventListener('click', function () {
        var m = MODELOS.find(function (x) { return x.id === b.closest('.seg-lista-item').dataset.modelo; });
        if (!m) return;
        if (b.dataset.acao === 'ver') abrirModelo(m);
        else abrirCadastro({ nome: m.nome, filtros: m.filtros.map(function (f) { return { tipo: f.tipo }; }) }, true);
      });
    });
  }

  // ── Cadastro (só os TIPOS de filtro; valores ficam na campanha) ──
  var CAD = null; // { id, original: [filtros gravados], sujo }
  var GRUPOS = ['Inteligência', 'Compras', 'Plano de Contas', 'Frequência', 'Datas', 'Produtos', 'Geografia', 'Marketing', 'CRM'];
  function tiposMarcados() { return Array.from(host.querySelectorAll('.seg-tipo-ck:checked')).map(function (c) { return c.value; }); }
  function atualizarResumoCad() {
    var t = tiposMarcados();
    host.querySelector('#seg-cad-resumo').textContent = t.length ? 'Esta segmentação usa: ' + t.map(cdaRotuloTipoFiltro).join(' · ') : 'Nenhum filtro marcado ainda.';
  }
  function abrirCadastro(sg, duplicar) {
    CAD = { id: sg && !duplicar && sg.id ? sg.id : null, original: sg && !duplicar ? (sg.filtros || []) : [], sujo: !!duplicar };
    var marcados = cdaTiposDaSegmentacao(sg ? sg.filtros : []);
    host.querySelector('#seg-cad-tipos').innerHTML = GRUPOS.map(function (g) {
      var itens = CDA_TIPOS_FILTRO_SEG.filter(function (t) { return t.grupo === g; });
      if (!itens.length) return '';
      return '<div class="seg-tipos-grupo"><div class="g">' + g + '</div>' + itens.map(function (t) {
        return '<label><input type="checkbox" class="seg-tipo-ck" value="' + t.id + '"' + (marcados.indexOf(t.id) !== -1 ? ' checked' : '') + (editavel ? '' : ' disabled') + '> ' + escH(cdaRotuloTipoFiltro(t.id)) + '</label>';
      }).join('') + '</div>';
    }).join('');
    host.querySelectorAll('.seg-tipo-ck').forEach(function (c) { c.addEventListener('change', function () { CAD.sujo = true; atualizarResumoCad(); }); });
    host.querySelector('#seg-cad-nome').value = sg ? (duplicar ? 'Cópia de ' + sg.nome : sg.nome) : '';
    host.querySelector('#seg-cad-titulo').textContent = !sg ? 'Nova segmentação' : (duplicar ? 'Duplicar segmentação' : (editavel ? 'Editar segmentação' : 'Ver segmentação'));
    atualizarResumoCad();
    mostrar('cadastro');
  }
  function voltarLista(semPerguntar) {
    if (!semPerguntar && CAD && CAD.sujo && editavel && !confirm('Descartar as alterações desta segmentação?')) return;
    CAD = null; ST.modeloAberto = null;
    mostrar('lista');
    renderLista();
  }
  host.querySelector('#seg-btn-voltar').addEventListener('click', function () { voltarLista(false); });
  host.querySelector('#seg-btn-voltar-m').addEventListener('click', function () { voltarLista(true); });
  host.querySelector('#seg-cad-nome').addEventListener('input', function () { if (CAD) CAD.sujo = true; });
  host.querySelector('#seg-btn-valores').addEventListener('click', function () { var b = host.querySelector('#seg-recalc'); b.hidden = !b.hidden; });

  // ── Modelo comercial: só o filtro (os dados ficam nas Campanhas) ──
  function abrirModelo(m) {
    ST.modeloAberto = m;
    host.querySelector('#seg-mod-titulo').textContent = m.nome;
    host.querySelector('#seg-mod-resumo').textContent = m.resumo;
    host.querySelector('#seg-mod-desc').textContent = m.descricao ? m.descricao : 'Calculado automaticamente pelo sistema todo dia.';
    mostrar('modelo');
  }

  if (editavel) {
    host.querySelector('#seg-btn-nova').addEventListener('click', function () { abrirCadastro(null, false); });
    host.querySelector('#seg-btn-cancelar').addEventListener('click', function () { voltarLista(false); });
    host.querySelector('#seg-btn-duplicar-m').addEventListener('click', function () {
      var m = ST.modeloAberto; if (!m) return;
      abrirCadastro({ nome: m.nome, filtros: m.filtros.map(function (f) { return { tipo: f.tipo }; }) }, true);
    });
    host.querySelector('#seg-btn-salvar').addEventListener('click', async function () {
      var nome = host.querySelector('#seg-cad-nome').value.trim();
      if (!nome) { alert('Dê um nome à segmentação.'); host.querySelector('#seg-cad-nome').focus(); return; }
      var tipos = tiposMarcados();
      if (!tipos.length) { alert('Marque ao menos um filtro que esta segmentação vai usar.'); return; }
      // Só os tipos. Segmentações antigas que ainda guardam valores mantêm esses
      // valores enquanto as campanhas antigas dependerem deles (conversão na publicação).
      var filtros = [];
      tipos.forEach(function (t) {
        var antigos = CAD.original.filter(function (f) { return f.tipo === t; });
        if (antigos.length) filtros = filtros.concat(antigos); else filtros.push({ tipo: t });
      });
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
}

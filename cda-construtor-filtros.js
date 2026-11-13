// ════════════════════════════════════════════════════════════════════
// cda-construtor-filtros.js
// Construtor de filtros combináveis — COMPONENTE REAPROVEITÁVEL (nov/2026).
// Extraído da Segmentação para ser usado também na Campanha (Universo +
// Filtros comerciais). A REGRA de cada filtro continua no motor único
// cdaMotorSegmento (cda-dados-compartilhados.js); aqui fica só a interface:
// linhas "E também...", campos de valor, listas com caixinhas do Plano de
// Contas, grade de UF/Região que recolhe em etiquetas, cidades múltiplas.
//
// Uso:
//   var cf = cdaConstrutorFiltros(elemento, ctx, opcoes)
//     ctx    = { motor, clientes, hierarquia, statusCrm, produtos, canais }
//     opcoes = { tipos: CDA_FILTROS_UNIVERSO | CDA_FILTROS_COMERCIAIS,
//                aoMudar: function () {},      // chamado a cada alteração
//                passaOutros: function (cliente) {}, // demais critérios da tela
//                rotuloAdicionar: '＋ Adicionar filtro' }
//   cf.filtros()  → lista atual   ·  cf.definir(lista)  → carrega
//   cf.passa(cliente) → cliente atende todas as linhas deste bloco
//   cf.atualizarContagens() → refaz as contagens de UF/Região
// ════════════════════════════════════════════════════════════════════

var CDA_TIPOS_FILTRO_SEG = [
  { id: 'status_crm', label: 'Status CRM (ciclo de vida)', grupo: 'Inteligência' },
  { id: 'tag_valor', label: 'Classificação de valor (VIP/Premium)', grupo: 'Inteligência' },

  { id: 'valor_gasto', label: 'Valor total gasto (R$)', grupo: 'Compras' },
  { id: 'ticket_medio', label: 'Ticket médio (R$)', grupo: 'Compras' },
  { id: 'qtd_compras', label: 'Quantidade de compras', grupo: 'Compras' },
  { id: 'canal', label: 'Comprou pelo menos 1x no canal', grupo: 'Compras' },

  { id: 'plano_contas', label: 'Comprou em: Conta / Grupo / Subconta / Centro de Custo', grupo: 'Plano de Contas' },

  { id: 'recencia_compra', label: 'Sem comprar há X dias', grupo: 'Frequência' },
  { id: 'nunca_comprou', label: 'Nunca comprou (nenhum produto)', grupo: 'Frequência' },
  { id: 'comprou_periodo', label: 'Comprou neste período', grupo: 'Frequência' },

  { id: 'aniversario', label: 'Aniversariantes (mês)', grupo: 'Datas' },
  { id: 'dias_cadastro', label: 'Dias desde o cadastro', grupo: 'Datas' },
  { id: 'dias_primeira_compra', label: 'Dias desde a 1ª compra', grupo: 'Datas' },

  { id: 'produto', label: 'Comprou o produto', grupo: 'Produtos' },
  { id: 'nunca_comprou_produto', label: 'Nunca comprou o produto', grupo: 'Produtos' },

  { id: 'cidade', label: 'Cidade — uma ou várias', grupo: 'Geografia' },
  { id: 'estado', label: 'Estado (UF) — um ou vários', grupo: 'Geografia' },
  { id: 'regiao', label: 'Região — uma ou várias', grupo: 'Geografia' },
  { id: 'pais', label: 'País', grupo: 'Geografia' },
  { id: 'cep', label: 'CEP (prefixo)', grupo: 'Geografia' },

  { id: 'origem', label: 'Origem do lead', grupo: 'Marketing' },

  { id: 'tipo_comercial', label: 'Tipo Comercial', grupo: 'CRM' },
  { id: 'sem_vendedor', label: 'Sem vendedor responsável', grupo: 'CRM' },
  { id: 'tem_email', label: 'Tem e-mail válido', grupo: 'CRM' }
];

// Divisão dos tipos em dois blocos: Universo (de qual negócio e de onde) e
// Filtros comerciais (quem, dentro do universo).
var CDA_FILTROS_UNIVERSO = ['plano_contas', 'estado', 'regiao', 'cidade', 'pais', 'cep'];
var CDA_FILTROS_COMERCIAIS = CDA_TIPOS_FILTRO_SEG.map(function (t) { return t.id; }).filter(function (id) { return CDA_FILTROS_UNIVERSO.indexOf(id) === -1; });
function cdaFiltroEhUniverso(f) { return CDA_FILTROS_UNIVERSO.indexOf(f && f.tipo) !== -1; }
// Tipo de um segmento salvo, deduzido do conteúdo: 'universo' | 'comercial' | 'misto'
function cdaTipoSegmento(filtros) {
  var u = 0, c = 0;
  (filtros || []).forEach(function (f) { if (cdaFiltroEhUniverso(f)) u++; else c++; });
  return u && !c ? 'universo' : (c && !u ? 'comercial' : (u && c ? 'misto' : 'comercial'));
}

// ── Segmentação = só os TIPOS de filtro (nov/2026) ──────────────────────
// Resumo legível dos tipos de uma segmentação: "Plano de Contas · Estado (UF)"
function cdaRotuloTipoFiltro(tipo) {
  var t = CDA_TIPOS_FILTRO_SEG.find(function (x) { return x.id === tipo; });
  return t ? t.label.replace(/ — um ou vários$/, '').replace(/^Comprou em: Conta \/ Grupo \/ Subconta \/ Centro de Custo$/, 'Plano de Contas') : tipo;
}
function cdaTiposDaSegmentacao(filtros) {
  var vistos = [];
  (filtros || []).forEach(function (f) { if (f && f.tipo && vistos.indexOf(f.tipo) === -1) vistos.push(f.tipo); });
  return vistos;
}
function cdaResumoTipos(filtros) {
  var tipos = cdaTiposDaSegmentacao(filtros);
  return tipos.length ? tipos.map(cdaRotuloTipoFiltro).join(' · ') : '—';
}
// Modelos comerciais = os status/classificações calculados pelo sistema todo dia.
// Ficam com id "modelo:<codigo>" (podem ser público de campanha) e já trazem o valor.
var CDA_CODIGOS_TAG_VALOR = ['vip', 'premium', 'gold'];
function cdaModelosComerciais(statusCrm) {
  return (statusCrm || []).filter(function (s) { return s.tipo === 'segmentacao'; }).map(function (s) {
    var ehTag = CDA_CODIGOS_TAG_VALOR.indexOf(s.codigo) !== -1;
    return {
      id: 'modelo:' + s.codigo, nome: s.nome, cor: s.cor, codigo: s.codigo, modelo: true, descricao: s.descricao || '',
      filtros: [ehTag ? { tipo: 'tag_valor', operador: '=', valor: s.codigo } : { tipo: 'status_crm', operador: '=', valor: String(s.id) }],
      resumo: (ehTag ? 'Classificação de valor = ' : 'Status CRM = ') + s.nome
    };
  });
}

function cdaInjetarEstilosConstrutor() {
  if (document.getElementById('cda-cf-estilos')) return;
  var st = document.createElement('style');
  st.id = 'cda-cf-estilos';
  st.textContent = [
    '.seg-row{display:flex;gap:8px;align-items:center;margin-bottom:8px;flex-wrap:wrap;background:var(--card,#f5f0e8);border:1px solid var(--ink,#1a1a1a);padding:8px;}',
    '.seg-row select,.seg-row input{font-family:\'Syne\',sans-serif;font-size:11px;padding:6px 9px;border:2px solid var(--ink,#1a1a1a);background:var(--paper,#fff);}',
    '.seg-and{font-size:9px;text-transform:uppercase;letter-spacing:1px;color:var(--muted,#888);font-weight:700;margin:4px 0;}',
    '.seg-uf-wrap{display:flex;gap:4px;flex-wrap:wrap;align-items:center;max-width:760px;}',
    '.seg-uf-sel{display:inline-flex;align-items:center;gap:3px;font-family:\'Syne\',sans-serif;font-size:10px;font-weight:700;padding:4px 8px;border:2px solid var(--ink,#1a1a1a);background:var(--ink,#1a1a1a);color:#fff;}',
    '.seg-uf-sel .n{font-style:normal;font-weight:400;opacity:.75;}',
    '.seg-uf-sel b{cursor:pointer;margin-left:4px;}',
    '.seg-pc-tags{flex-basis:100%;display:flex;gap:4px;flex-wrap:wrap;align-items:center;margin-top:6px;font-size:10px;}',
    '.seg-pc-tags .rot{font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--muted,#888);margin-left:6px;}',
    '.seg-pc-tags .rot:first-child{margin-left:0;}',
    '.seg-uf{font-family:\'Syne\',sans-serif;font-size:10px;font-weight:700;padding:4px 7px;border:2px solid var(--ink,#1a1a1a);background:var(--paper,#fff);cursor:pointer;user-select:none;}',
    '.seg-uf .n{font-style:normal;font-weight:400;opacity:.7;margin-left:3px;}',
    '.seg-uf.zero{opacity:.35;}',
    '.seg-uf.ativa{background:var(--ink,#1a1a1a);color:#fff;opacity:1;}',
    '.seg-ms{position:relative;display:inline-block;}',
    '.seg-ms-btn{font-family:\'Syne\',sans-serif;font-size:11px;padding:6px 9px;border:2px solid var(--ink,#1a1a1a);background:var(--paper,#fff);cursor:pointer;max-width:260px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:left;}',
    '.seg-ms-btn.tem{background:var(--ink,#1a1a1a);color:#fff;}',
    '.seg-ms-painel{position:absolute;z-index:50;top:100%;left:0;min-width:300px;max-height:320px;overflow:auto;background:var(--paper,#fff);border:2px solid var(--ink,#1a1a1a);box-shadow:4px 4px 0 rgba(0,0,0,.25);padding:6px 0;}',
    '.seg-ms-acoes{display:flex;gap:10px;padding:2px 10px 6px;border-bottom:1px solid #ddd;font-size:10px;}',
    '.seg-ms-acoes a{cursor:pointer;text-decoration:underline;}',
    '.seg-ms-painel label{display:flex;gap:7px;align-items:center;padding:4px 10px;font-size:11px;cursor:pointer;white-space:nowrap;}',
    '.seg-ms-painel label:hover{background:var(--card,#f5f0e8);}',
    '.seg-ms-painel label.zero{opacity:.45;}',
    '.seg-ms-painel label i{font-style:normal;opacity:.65;margin-left:auto;padding-left:10px;}',
    '.seg-cid,.seg-pc-tag{display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:700;padding:4px 8px;border:2px solid var(--ink,#1a1a1a);background:var(--ink,#1a1a1a);color:#fff;}',
    '.seg-cid b,.seg-pc-tag b{cursor:pointer;margin-left:3px;}',
  ].join('');
  document.head.appendChild(st);
}

function cdaConstrutorFiltros(el, ctx, opcoes) {
  opcoes = opcoes || {};
  cdaInjetarEstilosConstrutor();
  var S = { filtros: [], msAberto: null, geoAberto: {} };
  var cfId = 'cf' + Math.random().toString(36).slice(2); // identifica este bloco nos cliques
  var permitidos = opcoes.tipos || CDA_TIPOS_FILTRO_SEG.map(function (t) { return t.id; });
  var tiposDoBloco = CDA_TIPOS_FILTRO_SEG.filter(function (t) { return permitidos.indexOf(t.id) !== -1; });
  function notificar() { atualizarContagensUf(); if (opcoes.aoMudar) opcoes.aoMudar(); }
  function passaNoFiltro(cliente, f) { return ctx.motor.passa(cliente, f); }

  el.innerHTML = '<div class="cf-filtros"></div>' +
    '<button class="btn sm cf-btn-add" type="button">' + (opcoes.rotuloAdicionar || '＋ Adicionar filtro') + '</button>';

  var CDA_GRUPOS_ORDEM = ['Inteligência', 'Compras', 'Plano de Contas', 'Frequência', 'Datas', 'Produtos', 'Geografia', 'Marketing', 'CRM'];
  function optionsAgrupadas(valorSelecionado) {
    return CDA_GRUPOS_ORDEM.map(function (grupo) {
      var itens = tiposDoBloco.filter(function (t) { return t.grupo === grupo; });
      if (!itens.length) return '';
      return '<optgroup label="' + grupo + '">' +
        itens.map(function (t) { return '<option value="' + t.id + '"' + (valorSelecionado === t.id ? ' selected' : '') + '>' + t.label + '</option>'; }).join('') +
        '</optgroup>';
    }).join('');
  }

  function renderFiltros() {
    var wrap = el.querySelector('.cf-filtros');
    wrap.innerHTML = S.filtros.map(function (f, idx) {
      return (idx > 0 ? '<div class="seg-and">E também...</div>' : '') +
        '<div class="seg-row" data-idx="' + idx + '">' +
          '<select class="seg-tipo" data-idx="' + idx + '">' +
            optionsAgrupadas(f.tipo) +
          '</select>' +
          '<span class="seg-valor-area" data-idx="' + idx + '"></span>' +
          '<button class="btn sm" data-rm="' + idx + '">✕</button>' +
        '</div>';
    }).join('');

    S.filtros.forEach(function (f, idx) {
      var area = wrap.querySelector('.seg-valor-area[data-idx="' + idx + '"]');
      area.innerHTML = campoValorHtml(f, idx);
      var opSel = area.querySelector('.seg-op');
      if (opSel) opSel.value = f.operador || '>';
      var valInput = area.querySelector('.seg-val');
      if (valInput) valInput.value = f.valor != null ? f.valor : '';
    });
    atualizarContagensUf(); // etiquetas/grade de UF e Região já com contagem

    wrap.querySelectorAll('.seg-tipo').forEach(function (el) {
      el.addEventListener('change', function () {
        var idx = Number(el.dataset.idx);
        S.filtros[idx] = { tipo: el.value, operador: '>', valor: '' };
        S.msAberto = null;
        S.geoAberto = {};
        renderFiltros();
        notificar(); // o critério anterior desta linha deixou de valer
      });
    });
    wrap.querySelectorAll('[data-rm]').forEach(function (el) {
      el.addEventListener('click', function () { S.filtros.splice(Number(el.dataset.rm), 1); S.geoAberto = {}; S.msAberto = null; renderFiltros(); notificar(); });
    });
    // ── Plano de Contas: listas com caixinhas (várias escolhas por nível) ──
    wrap.querySelectorAll('.seg-ms-btn').forEach(function (el) {
      el.addEventListener('click', function (ev) {
        ev.stopPropagation();
        var chave = el.closest('.seg-valor-area').dataset.idx + '|' + el.closest('.seg-ms').dataset.campo;
        var abrir = S.msAberto !== chave;
        S.msAberto = abrir ? chave : null;
        wrap.querySelectorAll('.seg-ms').forEach(function (ms) {
          var painel = ms.querySelector('.seg-ms-painel');
          if (painel) painel.hidden = !(abrir && ms === el.closest('.seg-ms'));
        });
      });
    });
    function pcAplicar(idx, campo, novaLista, semAbrir) {
      var v = pcValor(S.filtros[idx]);
      v[campo] = novaLista;
      // níveis abaixo: mantém só as escolhas que ainda pertencem às de cima
      PC_CAMPOS.slice(PC_CAMPOS.indexOf(campo) + 1).forEach(function (c) {
        var validos = pcOpcoes(v, c).map(function (o) { return o.v; });
        v[c] = v[c].filter(function (id) { return validos.indexOf(id) !== -1; });
      });
      var painel = wrap.querySelector('.seg-valor-area[data-idx="' + idx + '"] .seg-ms[data-campo="' + campo + '"] .seg-ms-painel');
      var rolagem = painel ? painel.scrollTop : 0;
      S.msAberto = semAbrir ? null : idx + '|' + campo;
      renderFiltros();
      var novo = wrap.querySelector('.seg-valor-area[data-idx="' + idx + '"] .seg-ms[data-campo="' + campo + '"] .seg-ms-painel');
      if (novo) novo.scrollTop = rolagem;
      notificar();
    }
    wrap.querySelectorAll('.seg-ms-ck').forEach(function (el) {
      el.addEventListener('change', function () {
        var idx = Number(el.closest('.seg-valor-area').dataset.idx), campo = el.closest('.seg-ms').dataset.campo;
        var lista = pcValor(S.filtros[idx])[campo].slice();
        var pos = lista.indexOf(el.value);
        if (el.checked && pos === -1) lista.push(el.value);
        if (!el.checked && pos !== -1) lista.splice(pos, 1);
        pcAplicar(idx, campo, lista);
      });
    });
    wrap.querySelectorAll('.seg-ms-acoes a').forEach(function (el) {
      el.addEventListener('click', function (ev) {
        ev.stopPropagation();
        var idx = Number(el.closest('.seg-valor-area').dataset.idx), campo = el.closest('.seg-ms').dataset.campo;
        var v = pcValor(S.filtros[idx]);
        pcAplicar(idx, campo, el.dataset.acao === 'todos' ? pcOpcoes(v, campo).filter(function (o) { return o.n > 0; }).map(function (o) { return o.v; }) : []);
      });
    });
    wrap.querySelectorAll('.seg-ms-painel').forEach(function (el) { el.addEventListener('click', function (ev) { ev.stopPropagation(); }); });

    // ── Cidade: várias cidades (qualquer uma) ──
    function cidAdicionar(area) {
      var input = area.querySelector('.seg-cid-input');
      var nome = (input.value || '').trim();
      if (!nome) return;
      var idx = Number(area.dataset.idx);
      var lista = cdaListaValor(S.filtros[idx].valor);
      if (!lista.some(function (x) { return cdaSemAcento(x) === cdaSemAcento(nome); })) lista.push(nome);
      S.filtros[idx].valor = lista;
      renderFiltros();
      var novoInput = wrap.querySelector('.seg-valor-area[data-idx="' + idx + '"] .seg-cid-input');
      if (novoInput) novoInput.focus();
      notificar();
    }
    wrap.querySelectorAll('.seg-cid-add').forEach(function (el) {
      el.addEventListener('click', function () { cidAdicionar(el.closest('.seg-valor-area')); });
    });
    wrap.querySelectorAll('.seg-cid-input').forEach(function (el) {
      el.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); cidAdicionar(el.closest('.seg-valor-area')); } });
    });
    wrap.querySelectorAll('.seg-cid b').forEach(function (el) {
      el.addEventListener('click', function () {
        var idx = Number(el.closest('.seg-valor-area').dataset.idx);
        var lista = cdaListaValor(S.filtros[idx].valor);
        lista.splice(Number(el.dataset.i), 1);
        S.filtros[idx].valor = lista;
        renderFiltros();
        notificar();
      });
    });
    // ── Estado (UF) / Região: grade aberta enquanto escolhe; recolhe em etiquetas depois ──
    wrap.querySelectorAll('.seg-uf').forEach(function (el) {
      el.addEventListener('click', function () {
        var idx = Number(el.closest('.seg-valor-area').dataset.idx);
        var lista = ufLista(S.filtros[idx]).slice();
        var pos = lista.indexOf(el.dataset.uf);
        if (pos !== -1) lista.splice(pos, 1); else lista.push(el.dataset.uf);
        S.filtros[idx].valor = lista;
        S.geoAberto[idx] = true; // continua aberta até clicar fora / Concluir
        renderFiltros(); // redesenha a grade (mostra/oculta o "✓ Concluir")
        notificar();
      });
    });
    wrap.querySelectorAll('.seg-uf-limpar').forEach(function (el) {
      el.addEventListener('click', function (ev) {
        ev.stopPropagation();
        var idx = Number(el.closest('.seg-valor-area').dataset.idx);
        S.filtros[idx].valor = [];
        S.geoAberto[idx] = true;
        renderFiltros();
        notificar();
      });
    });
    wrap.querySelectorAll('.seg-geo-ok').forEach(function (el) {
      el.addEventListener('click', function (ev) {
        ev.stopPropagation();
        delete S.geoAberto[Number(el.closest('.seg-valor-area').dataset.idx)];
        renderFiltros();
      });
    });
    wrap.querySelectorAll('.seg-geo-alterar').forEach(function (el) {
      el.addEventListener('click', function (ev) {
        ev.stopPropagation();
        S.geoAberto[Number(el.closest('.seg-valor-area').dataset.idx)] = true;
        renderFiltros();
      });
    });
    wrap.querySelectorAll('.seg-uf-sel b').forEach(function (el) {
      el.addEventListener('click', function (ev) {
        ev.stopPropagation();
        var idx = Number(el.closest('.seg-valor-area').dataset.idx);
        S.filtros[idx].valor = ufLista(S.filtros[idx]).filter(function (x) { return x !== el.dataset.uf; });
        renderFiltros(); // sem nenhuma escolha a grade reabre sozinha
        notificar();
      });
    });
    // ── Plano de Contas: ✕ numa etiqueta remove só aquela escolha ──
    wrap.querySelectorAll('.seg-pc-tag b').forEach(function (el) {
      el.addEventListener('click', function (ev) {
        ev.stopPropagation();
        var idx = Number(el.closest('.seg-valor-area').dataset.idx), campo = el.dataset.campo;
        var lista = pcValor(S.filtros[idx])[campo].filter(function (id) { return id !== el.dataset.id; });
        pcAplicar(idx, campo, lista, true);
      });
    });
    wrap.querySelectorAll('.seg-op,.seg-val').forEach(function (el) {
      el.addEventListener('input', function () {
        var idx = Number(el.closest('.seg-valor-area').dataset.idx);
        if (el.classList.contains('seg-op')) S.filtros[idx].operador = el.value;
        else S.filtros[idx].valor = el.value;
        notificar();
      });
      el.addEventListener('change', function () {
        var idx = Number(el.closest('.seg-valor-area').dataset.idx);
        if (el.classList.contains('seg-op')) S.filtros[idx].operador = el.value;
        else S.filtros[idx].valor = el.value;
        notificar();
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
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]; }); }

  // ── Filtro "Estado (UF)": várias UFs, com contagem ao vivo de cada uma ──
  function ufLista(f) {
    var lista = cdaListaValor(f.valor);
    return f.tipo === 'estado' ? lista.map(function (x) { return x.trim().toUpperCase(); }) : lista;
  }
  // Estado/Região: grade completa enquanto escolhe (ou sem nada escolhido);
  // depois, só as etiquetas do que foi escolhido + "✎ Alterar".
  function campoGeoHtml(f, idx, todos, titulo) {
    var sel = ufLista(f);
    if (sel.length && !S.geoAberto[idx]) {
      return '<span class="seg-uf-wrap seg-geo" data-idx="' + idx + '">' +
        sel.map(function (v) { return '<span class="seg-uf-sel" data-uf="' + esc(v) + '">' + esc(v) + ' <i class="n">0</i><b data-uf="' + esc(v) + '" title="Remover">✕</b></span>'; }).join('') +
        '<button class="btn sm seg-geo-alterar" type="button">✎ Alterar</button>' +
        '<span class="seg-uf-semuf tmu" style="font-size:10px"></span>' +
      '</span>';
    }
    return '<span class="seg-uf-wrap seg-geo seg-geo-aberta" data-cf="' + cfId + '" data-idx="' + idx + '">' +
      todos.map(function (v) {
        return '<span class="seg-uf' + (sel.indexOf(v) !== -1 ? ' ativa' : '') + '" data-uf="' + v + '"' + (titulo ? ' title="' + titulo(v) + '"' : '') + '>' + v + '<i class="n">0</i></span>';
      }).join('') +
      '<button class="btn sm seg-uf-limpar" type="button">Limpar</button>' +
      (sel.length ? '<button class="btn sm rust seg-geo-ok" type="button">✓ Concluir</button>' : '') +
      '<span class="seg-uf-semuf tmu" style="font-size:10px"></span>' +
    '</span>';
  }
  function campoRegiaoHtml(f, idx) { return campoGeoHtml(f, idx, CDA_REGIOES, null); }
  // Cidade: várias cidades (qualquer uma); digita e tecla Enter ou "＋"
  function campoCidadeHtml(f) {
    var lista = cdaListaValor(f.valor);
    return lista.map(function (c, i) { return '<span class="seg-cid">' + esc(c) + '<b data-i="' + i + '" title="Remover">✕</b></span>'; }).join(' ') +
      ' <input class="seg-cid-input" type="text" placeholder="' + (lista.length ? 'Outra cidade...' : 'Ex: Rio de Janeiro') + '" style="width:170px">' +
      '<button class="btn sm seg-cid-add" type="button">＋</button>' +
      '<span class="tmu" style="font-size:10px"> sem acento ou com, tanto faz</span>';
  }
  function campoUfHtml(f, idx) { return campoGeoHtml(f, idx, CDA_UFS, function (uf) { return CDA_UF_REGIAO_COMPARTILHADO[uf]; }); }

  // ── Filtro "Plano de Contas": Conta → Grupo → Subconta → Centro de Custo ──
  // Cada nível aceita VÁRIAS escolhas (= qualquer uma) e é opcional (vazio = todos).
  // As opções de um nível se restringem às escolhas dos níveis de cima.
  var PC_CAMPOS = ['conta', 'grupo', 'subconta', 'centro'];
  var PC_ROTULO = { conta: 'Conta', grupo: 'Grupo', subconta: 'Subconta', centro: 'Centro de Custo' };
  function pcValor(f) {
    if (!f.valor || typeof f.valor !== 'object' || Array.isArray(f.valor)) f.valor = {};
    PC_CAMPOS.forEach(function (c) { f.valor[c] = cdaListaValor(f.valor[c]); }); // aceita formato antigo (texto único)
    return f.valor;
  }
  var idsClientesValidos = null; // clientes do universo da tela (sem cadastro genérico)
  function pcOpcoes(v, campo) {
    if (!idsClientesValidos) { idsClientesValidos = new Set(); ctx.clientes.forEach(function (c) { idsClientesValidos.add(String(c.id)); }); }
    var acima = PC_CAMPOS.slice(0, PC_CAMPOS.indexOf(campo));
    var porId = {}, lista = [];
    ctx.hierarquia.forEach(function (h) {
      if (!acima.every(function (c) { return !v[c].length || v[c].indexOf(h[c + 'Id']) !== -1; })) return;
      var id = h[campo + 'Id']; if (!id) return;
      var o = porId[id];
      if (!o) { o = porId[id] = { v: id, l: h[campo + 'Nome'] + (campo === 'centro' && !h.ativo ? ' (inativo)' : ''), clientes: new Set() }; lista.push(o); }
      var doCentro = ctx.motor.clientesPorCentro[h.centroId];
      if (doCentro) doCentro.forEach(function (cid) { if (idsClientesValidos.has(cid)) o.clientes.add(cid); });
    });
    lista.forEach(function (o) { o.n = o.clientes.size; delete o.clientes; });
    if (campo === 'grupo') lista.sort(function (a, b) { return a.l.localeCompare(b.l); });
    return lista;
  }
  function campoPlanoContasHtml(f, idx) {
    if (!ctx.hierarquia.length) return '<span class="tmu" style="font-size:10px">⚠ Estrutura do Plano de Contas indisponível — este filtro não retorna clientes. Recarregue a página; se persistir, avise o administrador.</span>';
    var v = pcValor(f);
    return PC_CAMPOS.map(function (campo) {
      var ops = pcOpcoes(v, campo);
      var sel = v[campo];
      var nomes = ops.filter(function (o) { return sel.indexOf(o.v) !== -1; }).map(function (o) { return o.l; });
      var resumo = !nomes.length ? 'todos' : (nomes.length === 1 ? nomes[0] : nomes[0] + ' +' + (nomes.length - 1));
      var aberto = S.msAberto === idx + '|' + campo;
      return '<div class="seg-ms" data-campo="' + campo + '">' +
        '<button type="button" class="seg-ms-btn' + (nomes.length ? ' tem' : '') + '" title="' + esc(nomes.join(', ') || 'todos') + '">' + PC_ROTULO[campo] + ': <b>' + esc(resumo) + '</b> ▾</button>' +
        '<div class="seg-ms-painel"' + (aberto ? '' : ' hidden') + '>' +
          '<div class="seg-ms-acoes"><a data-acao="todos">Marcar todos com clientes</a><a data-acao="limpar">Limpar</a></div>' +
          ops.map(function (o) {
            return '<label class="' + (o.n ? '' : 'zero') + '"><input type="checkbox" class="seg-ms-ck" value="' + esc(o.v) + '"' + (sel.indexOf(o.v) !== -1 ? ' checked' : '') + '>' +
              esc(o.l) + '<i>' + o.n.toLocaleString('pt-BR') + '</i></label>';
          }).join('') +
        '</div>' +
      '</div>';
    }).join('') + pcEtiquetasHtml(v);
  }
  // Linha com os nomes escolhidos em cada nível — nada fica escondido no "+1"
  function pcEtiquetasHtml(v) {
    var partes = [];
    PC_CAMPOS.forEach(function (campo) {
      if (!v[campo].length) return;
      var nomePorId = {}; pcOpcoes(v, campo).forEach(function (o) { nomePorId[o.v] = o.l; });
      partes.push('<span class="rot">' + PC_ROTULO[campo] + ':</span>' +
        v[campo].map(function (id) { return '<span class="seg-pc-tag">' + esc(nomePorId[id] || id) + '<b data-campo="' + campo + '" data-id="' + esc(id) + '" title="Remover">✕</b></span>'; }).join(''));
    });
    return partes.length ? '<div class="seg-pc-tags">' + partes.join('') + '</div>' : '';
  }

  function campoValorHtml(f, idx) {
    switch (f.tipo) {
      case 'status_crm':
        return '<select class="seg-val"><option value="">Selecione...</option>' +
          opts(ctx.statusCrm.filter(function (s) { return s.tipo === 'segmentacao' && s.codigo !== 'vip' && s.codigo !== 'premium'; }).map(function (s) { return { v: s.id, l: s.nome }; }), f.valor) +
          '</select>';
      case 'tag_valor':
        return '<select class="seg-val"><option value="">Selecione...</option>' + opts([{ v: 'vip', l: 'VIP' }, { v: 'premium', l: 'Premium' }], f.valor) + '</select>';
      case 'aniversario':
        return '<select class="seg-val">' + opts(['—','Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
          .map(function (m, i) { return { v: (i === 0 ? '' : i), l: m }; }), f.valor) + '</select>';
      case 'recencia_compra':
        return opInput('dias', 80, f);
      case 'nunca_comprou':
      case 'tem_email':
        return '<span class="tmu" style="font-size:10px">sem critério adicional</span>';
      case 'valor_gasto':
        return opInput('R$', 100, f);
      case 'qtd_compras':
        return opInput('qtd', 80, f);
      case 'canal':
        return '<select class="seg-val"><option value="">Selecione...</option>' +
          opts(ctx.canais.slice().sort(function (a, b) { return a.nome.localeCompare(b.nome); }).map(function (c) { return { v: c.id, l: c.nome }; }), f.valor) + '</select>';
      case 'produto':
        return '<select class="seg-val"><option value="">Selecione...</option>' +
          opts(ctx.produtos.slice().sort(function (a, b) { return a.nome.localeCompare(b.nome); }).map(function (p) { return { v: p.id, l: p.nome }; }), f.valor) + '</select>';
      case 'cidade':
        return campoCidadeHtml(f);
      case 'estado':
        return campoUfHtml(f, idx);
      case 'plano_contas':
        return campoPlanoContasHtml(f, idx);
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
          opts(ctx.produtos.slice().sort(function (a, b) { return a.nome.localeCompare(b.nome); }).map(function (p) { return { v: p.id, l: p.nome }; }), f.valor) + '</select>';
      case 'regiao':
        return campoRegiaoHtml(f, idx);
      case 'pais':
        return '<input class="seg-val" type="text" placeholder="Ex: Brasil" value="' + (f.valor || '') + '">';
      case 'cep':
        return '<input class="seg-val" type="text" placeholder="Ex: 22793 (prefixo)" style="width:110px" value="' + (f.valor || '') + '">';
      case 'origem':
        return '<select class="seg-val"><option value="">Selecione...</option>' +
          opts(Array.from(new Set(ctx.clientes.map(function (c) { return c.origem; }).filter(Boolean))).sort().map(function (o) { return { v: o, l: o }; }), f.valor) + '</select>';
      case 'sem_vendedor':
        return '<span class="tmu" style="font-size:10px">sem critério adicional</span>';
      case 'tipo_comercial':
        return '<select class="seg-val">' + opts([{ v: '', l: '—' }, { v: '__vazio__', l: 'Cliente Convertido (sem tipo)' }, { v: 'lead_b2c', l: 'Lead B2C' }, { v: 'canal_b2b', l: 'Canal B2B' }, { v: 'artista', l: 'Artista' }, { v: 'imprensa', l: 'Imprensa' }], f.valor) + '</select>';
      default: return '';
    }
  }

  // Para cada filtro de UF/Região: quantos clientes de cada estado/região passam
  // em TODOS os outros critérios — é o "universo" da segmentação aberto por local.
  function atualizarContagensUf() {
    var wrap = el.querySelector('.cf-filtros');
    S.filtros.forEach(function (f, idx) {
      if (f.tipo !== 'estado' && f.tipo !== 'regiao') return;
      var area = wrap.querySelector('.seg-valor-area[data-idx="' + idx + '"]');
      if (!area) return;
      var cont = {}, semUf = 0;
      ctx.clientes.forEach(function (c) {
        if (opcoes.passaOutros && !opcoes.passaOutros(c)) return;
        for (var j = 0; j < S.filtros.length; j++) { if (j !== idx && !passaNoFiltro(c, S.filtros[j])) return; }
        var uf = cdaUfDe(c);
        var chave = f.tipo === 'regiao' ? CDA_UF_REGIAO_COMPARTILHADO[uf] : (CDA_UF_REGIAO_COMPARTILHADO[uf] ? uf : null);
        if (chave) cont[chave] = (cont[chave] || 0) + 1; else semUf++;
      });
      area.querySelectorAll('.seg-uf, .seg-uf-sel').forEach(function (el) {
        var n = cont[el.dataset.uf] || 0;
        el.querySelector('.n').textContent = n.toLocaleString('pt-BR');
        el.classList.toggle('zero', n === 0 && el.classList.contains('seg-uf'));
      });
      var notaSemUf = area.querySelector('.seg-uf-semuf');
      if (notaSemUf) notaSemUf.textContent = semUf ? '· ' + semUf.toLocaleString('pt-BR') + ' sem UF válida no cadastro' : '';
    });
  }

  // Fecha a lista aberta do Plano de Contas ao clicar fora dela
  // e recolhe as grades de Estado/Região que já têm escolha
  var aoClicarFora = function (ev) {
    if (!document.body.contains(el)) return; // tela já foi trocada
    if (S.msAberto) {
      S.msAberto = null;
      el.querySelectorAll('.seg-ms-painel').forEach(function (p) { p.hidden = true; });
    }
    // clique numa caixa/campo: não reconstrói agora (fecharia a caixa que está sendo aberta)
    if (ev.target && ev.target.closest && ev.target.closest('select, input, textarea')) return;
    var dentro = ev.target && ev.target.closest ? ev.target.closest('.seg-geo-aberta') : null;
    if (dentro && dentro.dataset.cf !== cfId) dentro = null; // clique na grade de OUTRO bloco
    var idxDentro = dentro ? dentro.dataset.idx : null;
    var recolher = Object.keys(S.geoAberto).filter(function (k) {
      return k !== idxDentro && S.filtros[k] && ufLista(S.filtros[k]).length;
    });
    if (!recolher.length) return;
    recolher.forEach(function (k) { delete S.geoAberto[k]; });
    renderFiltros();
  };
  document.addEventListener('click', aoClicarFora);

  el.querySelector('.cf-btn-add').addEventListener('click', function () {
    S.filtros.push({ tipo: tiposDoBloco[0].id, operador: '>', valor: '' });
    renderFiltros();
    notificar();
  });

  renderFiltros();
  return {
    filtros: function () { return S.filtros; },
    definir: function (lista) {
      S.filtros = JSON.parse(JSON.stringify(lista || []));
      S.msAberto = null; S.geoAberto = {};
      renderFiltros();
    },
    passa: function (cliente) { return S.filtros.every(function (f) { return passaNoFiltro(cliente, f); }); },
    atualizarContagens: atualizarContagensUf,
    render: renderFiltros,
    // Desliga esta instância (ex.: a Campanha recria o construtor ao trocar de segmentação)
    destruir: function () { document.removeEventListener('click', aoClicarFora); el.innerHTML = ''; }
  };
}

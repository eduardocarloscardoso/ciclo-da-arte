// ════════════════════════════════════════════════════════════════════
// cda-modulo-tutorial.js
// Manual do usuário — Segmentação de Clientes e Pipeline B2C.
//
// Exporta em Word (.doc — HTML compatível, abre nativamente no Word,
// sem depender de biblioteca externa) com uma seção marcada pra
// comentários da equipe. Permite reimportar esse .docx editado: tudo
// que estiver escrito DEPOIS da linha de marcação é salvo como
// "Comentário da Equipe" (usa mammoth.js, carregado sob demanda, só
// pra leitura do arquivo — nada é enviado a nenhum servidor externo).
//
// Requer cda-dados-compartilhados.js carregado antes.
// Uso:
//   <div id="container-tutorial"></div>
//   <script>montarModuloTutorial('container-tutorial');</script>
// ════════════════════════════════════════════════════════════════════

var CDA_TUTORIAL_MARCADOR = 'COMENTÁRIOS DA EQUIPE';

var CDA_TUTORIAL_CONTEUDO = [
  {
    id: 'visao-geral', titulo: 'Visão Geral',
    html: '<p>O módulo Comercial organiza o relacionamento com o cliente em duas frentes que trabalham juntas:</p>' +
      '<p><b>Segmentação de Clientes</b> — classifica automaticamente, todo dia, cada cliente já convertido em um status de ciclo de vida (Lead, Ativo, Em Risco...) e uma classificação de valor (Premium/VIP). É o "retrato" atual da base.</p>' +
      '<p><b>Pipeline B2C</b> — acompanha o cliente <i>antes</i> dele virar cliente de fato: da primeira mensagem até a compra e fidelização, com histórico completo de cada contato.</p>' +
      '<p>As duas telas já excluem automaticamente da análise: compras feitas em canais de revenda/atacado (B2B) e cadastros genéricos de venda em show sem dado de consumidor final — pra não distorcer os números.</p>'
  },
  {
    id: 'segmentacao', titulo: 'Segmentação de Clientes',
    html: '<p>A tela tem três partes: <b>atalhos rápidos</b> (botões de status, 1 clique), o <b>construtor de filtros</b> (organizado em 8 grupos, combináveis) e o painel de <b>Recálculo de Valores</b>.</p>' +
      '<h4>Os 8 grupos de filtro</h4>' +
      '<p>Inteligência (status/tags abaixo) · Compras (valor gasto, ticket médio, qtd. de compras, canal) · Frequência (dias sem comprar, comprou este mês/trimestre/ano) · Datas (aniversário, cadastro, 1ª compra) · Produtos (comprou/nunca comprou um produto) · Geografia (cidade, estado, região, país, CEP) · Marketing (origem do lead) · CRM (tipo comercial, sem vendedor responsável).</p>' +
      '<p><i>Ainda não existem (dependem do histórico de interações do Pipeline): "último contato/proposta" (Datas) e "sem contato/follow-up/oportunidade aberta" (CRM).</i></p>' +
      '<h4>Tabela de Status — regra de negócio exata</h4>' +
      '<table class="cda-tut-tabela"><tr><th>Status</th><th>Tipo</th><th>Regra aplicada</th></tr>' +
      '<tr><td><b>Lead</b></td><td>Ciclo de vida</td><td>Tipo Comercial = lead_b2c e nenhuma compra B2C registrada</td></tr>' +
      '<tr><td><b>Novo Cliente</b></td><td>Ciclo de vida</td><td>1ª compra há menos de 30 dias</td></tr>' +
      '<tr><td><b>Ativo</b></td><td>Ciclo de vida</td><td>Comprou nos últimos 90 dias (e não se encaixa em Novo Cliente/Recorrente)</td></tr>' +
      '<tr><td><b>Recorrente</b></td><td>Ciclo de vida</td><td>3 ou mais pedidos distintos, dentro dos últimos 90 dias</td></tr>' +
      '<tr><td><b>Em Risco</b></td><td>Ciclo de vida</td><td>Entre 91 e 180 dias sem comprar</td></tr>' +
      '<tr><td><b>Inativo</b></td><td>Ciclo de vida</td><td>Mais de 180 dias sem comprar</td></tr>' +
      '<tr><td><b>Recuperado</b></td><td>Ciclo de vida</td><td>Estava Em Risco/Inativo e comprou de novo nos últimos 30 dias</td></tr>' +
      '<tr><td><b>Premium</b></td><td>Classificação de valor</td><td>Valor acumulado acima do limiar Premium e até o limiar VIP (ver Recálculo de Valores)</td></tr>' +
      '<tr><td><b>VIP</b></td><td>Classificação de valor</td><td>Valor acumulado acima do limiar VIP</td></tr>' +
      '<tr><td><b>Propenso à Recompra</b></td><td>Ciclo de vida</td><td>Cadastrado no catálogo, mas o cálculo automático ainda não foi implementado</td></tr>' +
      '</table>' +
      '<p class="cda-tut-nota">Ciclo de vida e classificação de valor são independentes — um cliente pode ser VIP e estar Em Risco ao mesmo tempo (é inclusive o caso mais importante de identificar).</p>' +
      '<h4>Recálculo de Valores (Premium/VIP)</h4>' +
      '<p>Painel no topo da tela com dois modos: <b>Manual</b> (você digita os valores; um botão "Confirmar" registra a data mesmo sem mudar o número) e <b>Automático</b> (o sistema calcula os percentis reais da base, mas só quando você clica em "Executar recálculo agora" — nunca sozinho por agendamento).</p>' +
      '<h4>Job noturno</h4>' +
      '<p>Todo dia às 3h, o sistema reclassifica o ciclo de vida de todos os clientes com base nos dados de compra atualizados. Ele não altera os valores de Premium/VIP — isso só muda pelo painel de Recálculo.</p>'
  },
  {
    id: 'pipeline', titulo: 'Pipeline B2C',
    html: '<h4>As 5 etapas</h4>' +
      '<p>Novo Lead → Contato → Engajado → Compra → Fidelização. Não existe mais coluna de "Perdido" ou "Proposta Enviada" — esses viraram <b>resultados</b> dentro da etapa correspondente (Contato/Engajado).</p>' +
      '<h4>Toda movimentação passa por confirmação</h4>' +
      '<p>Arrastar um card não move ele direto. Abre um modal pedindo o <b>Resultado</b> (lista muda conforme a etapa de destino — ex: em Contato aparecem "Não respondeu", "Pediu catálogo"...) e uma observação opcional. Só depois de confirmar o card muda de coluna.</p>' +
      '<p>Cada movimentação fica registrada no <b>histórico de interações</b> do lead — visível ao clicar no card (data, etapa, resultado, observação e quem fez).</p>' +
      '<h4>Chegou em "Compra"</h4>' +
      '<p>O sistema oferece criar automaticamente o cadastro de Cliente vinculado (se ainda não existir um).</p>' +
      '<h4>Buscar cliente existente ao criar um lead novo</h4>' +
      '<p>Ao clicar em "➕ Novo Lead", aparece um campo de busca por nome, telefone ou e-mail. Selecionando um resultado, o lead já nasce vinculado ao cadastro existente — evita criar um cliente duplicado quando alguém que já compra com você volta a aparecer pelo funil. Não achou? Um "Cadastrar novo" libera os campos em branco — nunca é obrigatório já existir.</p>' +
      '<p class="cda-tut-nota">Se dois ou mais clientes tiverem o mesmo nome, o sistema mostra telefone, e-mail e cidade/UF de cada um lado a lado, pra você escolher o certo com segurança.</p>'
  }
];

async function montarModuloTutorial(containerId) {
  var host = document.getElementById(containerId);
  if (!host) { console.error('cda-modulo-tutorial: container #' + containerId + ' não encontrado'); return; }

  host.innerHTML =
    '<style>' +
      '.cda-tut-wrap{display:flex;gap:20px;align-items:flex-start;}' +
      '.cda-tut-nav{min-width:180px;position:sticky;top:12px;}' +
      '.cda-tut-nav a{display:block;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;padding:7px 10px;color:var(--muted,#888);text-decoration:none;border-left:2px solid transparent;}' +
      '.cda-tut-nav a:hover{color:var(--ink,#1a1a1a);border-left-color:var(--ink,#1a1a1a);}' +
      '.cda-tut-conteudo{flex:1;max-width:760px;}' +
      '.cda-tut-secao{background:var(--paper,#fff);border:2px solid var(--ink,#1a1a1a);padding:20px 24px;margin-bottom:18px;}' +
      '.cda-tut-secao h2{font-size:16px;margin:0 0 12px;}' +
      '.cda-tut-secao h4{font-size:12px;text-transform:uppercase;letter-spacing:.4px;margin:16px 0 6px;}' +
      '.cda-tut-secao p{font-size:12px;line-height:1.6;margin:0 0 10px;}' +
      '.cda-tut-nota{background:var(--card,#f5f0e8);border-left:3px solid var(--rust,#c0392b);padding:8px 12px;font-size:11px !important;}' +
      '.cda-tut-tabela{width:100%;border-collapse:collapse;font-size:11px;margin:8px 0 12px;}' +
      '.cda-tut-tabela th,.cda-tut-tabela td{border:1px solid var(--border2,#ccc);padding:6px 8px;text-align:left;vertical-align:top;}' +
      '.cda-tut-tabela th{background:var(--card,#f5f0e8);text-transform:uppercase;font-size:9px;letter-spacing:.4px;}' +
      '.cda-tut-comentario{background:var(--card,#f5f0e8);border:1px solid var(--border2,#ccc);padding:10px 12px;font-size:11px;margin-bottom:8px;white-space:pre-wrap;}' +
      '.cda-tut-comentario b{display:block;font-size:9px;text-transform:uppercase;color:var(--muted,#888);margin-bottom:4px;}' +
    '</style>' +
    '<div class="row-bt">' +
      '<div><div class="sec-t">📘 Tutorial</div><div class="sec-d">Manual de uso e regras de negócio — Segmentação de Clientes e Pipeline B2C</div></div>' +
      '<div style="display:flex;gap:7px;">' +
        '<button class="btn" id="tut-btn-exportar">⬇ Baixar em Word</button>' +
        '<input type="file" id="tut-input-importar" accept=".docx" style="display:none">' +
        '<button class="btn rust" id="tut-btn-importar">⬆ Importar Comentários</button>' +
      '</div>' +
    '</div>' +
    '<div class="cda-tut-wrap">' +
      '<div class="cda-tut-nav" id="tut-nav"></div>' +
      '<div class="cda-tut-conteudo" id="tut-conteudo"></div>' +
    '</div>';

  var nav = host.querySelector('#tut-nav');
  nav.innerHTML = CDA_TUTORIAL_CONTEUDO.map(function (s) { return '<a href="#tut-' + s.id + '">' + s.titulo + '</a>'; }).join('') +
    '<a href="#tut-comentarios">Comentários da Equipe</a>';

  var corpo = host.querySelector('#tut-conteudo');
  corpo.innerHTML = CDA_TUTORIAL_CONTEUDO.map(function (s) {
    return '<div class="cda-tut-secao" id="tut-' + s.id + '"><h2>' + s.titulo + '</h2>' + s.html + '</div>';
  }).join('') +
    '<div class="cda-tut-secao" id="tut-comentarios"><h2>💬 Comentários da Equipe</h2><div id="tut-comentarios-lista"><p class="tmu">Carregando...</p></div></div>';

  async function carregarComentarios() {
    var box = host.querySelector('#tut-comentarios-lista');
    try {
      var comentarios = await cdaCarregarComentariosTutorial();
      box.innerHTML = comentarios.length ? comentarios.map(function (c) {
        var d = new Date(c.importadoEm);
        return '<div class="cda-tut-comentario"><b>' + d.toLocaleDateString('pt-BR') + ' — ' + (c.importadoPor || 'Usuário') + (c.arquivoOrigem ? ' · ' + c.arquivoOrigem : '') + '</b>' + c.conteudo + '</div>';
      }).join('') : '<p class="tmu">Nenhum comentário importado ainda. Baixe o manual em Word, escreva abaixo da linha "' + CDA_TUTORIAL_MARCADOR + '" e importe de volta aqui.</p>';
    } catch (err) {
      console.error(err);
      box.innerHTML = '<p style="color:var(--rust,#c0392b)">Erro ao carregar comentários.</p>';
    }
  }
  carregarComentarios();

  // ── Exportar em Word ────────────────────────────────────────────────
  // Gera um .doc no formato HTML-com-namespace-do-Word — o Word abre
  // nativamente, preserva títulos/negrito/tabelas, e não depende de
  // nenhuma biblioteca externa (zero risco de link quebrado).
  function gerarHtmlWord() {
    var corpoHtml = CDA_TUTORIAL_CONTEUDO.map(function (s) {
      return '<h2>' + s.titulo + '</h2>' + s.html.replace(/class="cda-tut-nota"/g, '').replace(/class="cda-tut-tabela"/g, 'border="1" cellpadding="4" cellspacing="0"');
    }).join('');
    var hoje = new Date().toLocaleDateString('pt-BR');
    return '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">' +
      '<head><meta charset="utf-8"><title>Manual do CRM — Ciclo da Arte</title></head>' +
      '<body style="font-family:Calibri,Arial,sans-serif;font-size:11pt;">' +
      '<h1>Manual do CRM — Ciclo da Arte</h1>' +
      '<p><i>Segmentação de Clientes e Pipeline B2C — gerado em ' + hoje + '</i></p>' +
      corpoHtml +
      '<h1>' + CDA_TUTORIAL_MARCADOR + '</h1>' +
      '<p><i>Escreva seus comentários, dúvidas ou correções abaixo desta linha. Ao salvar e reimportar este arquivo na tela do Tutorial, tudo que estiver aqui embaixo é salvo automaticamente. Edições feitas ACIMA desta linha (no conteúdo original) não são aplicadas automaticamente — servem só de referência.</i></p>' +
      '<p>&nbsp;</p><p>&nbsp;</p>' +
      '</body></html>';
  }
  host.querySelector('#tut-btn-exportar').addEventListener('click', function () {
    var blob = new Blob(['\ufeff', gerarHtmlWord()], { type: 'application/msword' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = 'Manual_CRM_Ciclo_da_Arte.doc';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  // ── Importar comentários ────────────────────────────────────────────
  function carregarMammothSeNecessario() {
    if (window.mammoth) return Promise.resolve();
    return new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.11.0/mammoth.browser.min.js';
      script.onload = resolve;
      script.onerror = function () { reject(new Error('Não foi possível carregar a biblioteca de leitura de Word.')); };
      document.head.appendChild(script);
    });
  }

  host.querySelector('#tut-btn-importar').addEventListener('click', function () { host.querySelector('#tut-input-importar').click(); });
  host.querySelector('#tut-input-importar').addEventListener('change', async function () {
    var file = this.files && this.files[0];
    if (!file) return;
    var btn = host.querySelector('#tut-btn-importar');
    btn.textContent = 'Lendo arquivo...'; btn.disabled = true;
    try {
      await carregarMammothSeNecessario();
      var arrayBuffer = await file.arrayBuffer();
      var resultado = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
      var textoCompleto = resultado.value || '';
      var idx = textoCompleto.indexOf(CDA_TUTORIAL_MARCADOR);
      if (idx === -1) {
        alert('Não encontrei a linha "' + CDA_TUTORIAL_MARCADOR + '" nesse arquivo — importe o .doc baixado por este Tutorial (ou mantenha essa linha ao editar).');
        return;
      }
      var apos = textoCompleto.slice(idx + CDA_TUTORIAL_MARCADOR.length);
      // remove a frase de instrução que fica logo abaixo do marcador no arquivo original
      apos = apos.replace(/Escreva seus comentários[\s\S]*?só de referência\.\s*/, '').trim();
      if (!apos) { alert('Não encontrei nenhum comentário escrito abaixo da linha "' + CDA_TUTORIAL_MARCADOR + '".'); return; }
      await cdaSalvarComentarioTutorial({ conteudo: apos, arquivoOrigem: file.name, importadoPor: (window.cu && window.cu.name) || 'Usuário' });
      this.value = '';
      await carregarComentarios();
      alert('Comentário importado com sucesso!');
    } catch (err) {
      console.error(err);
      alert('Erro ao importar — ' + (err.message || err));
    } finally {
      btn.textContent = '⬆ Importar Comentários'; btn.disabled = false;
    }
  });
}

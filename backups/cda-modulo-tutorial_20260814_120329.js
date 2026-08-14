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
      '<p><b>Pipeline B2C</b> — acompanha uma oportunidade/interação comercial em andamento com uma pessoa, esteja ela já cadastrada como cliente ou não. <b>Não é "antes de virar cliente"</b>: quem já compra com você também passa pelo Pipeline sempre que há uma nova interação sendo trabalhada (reengajamento, nova venda, campanha). O vínculo com um cadastro de Cliente já existente é opcional e pode existir desde a criação do lead — campo <code>leads_b2c.cliente_id</code> (veja a busca de cliente existente, mais abaixo).</p>' +
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
      '<p>Todo dia às 3h, o sistema reclassifica o ciclo de vida de todos os clientes com base nos dados de compra atualizados. Ele não altera os valores de Premium/VIP — isso só muda pelo painel de Recálculo.</p>' +
      '<h4>Campo no banco — onde cada regra mora</h4>' +
      '<table class="cda-tut-tabela cda-tut-tabela-campos"><tr><th>Regra / Informação</th><th>Campo</th></tr>' +
      '<tr><td>Status de ciclo de vida (Lead, Ativo, Em Risco...)</td><td><code>clientes.status_crm_id</code> → aponta pra <code>cda_status_crm.id</code></td></tr>' +
      '<tr><td>Classificação de valor (Premium/VIP)</td><td><code>clientes.tags_comercial</code> (texto: "vip" ou "premium")</td></tr>' +
      '<tr><td>Nome, descrição e ação sugerida de cada status</td><td>tabela <code>cda_status_crm</code> (tipo = "segmentacao")</td></tr>' +
      '<tr><td>Limiares de valor do Premium/VIP</td><td><code>cda_parametros_segmentacao.valor_premium</code> / <code>valor_vip</code></td></tr>' +
      '<tr><td>Modo do Recálculo (Automático/Manual)</td><td><code>cda_parametros_segmentacao.modo</code></td></tr>' +
      '<tr><td>Data/quem fez o último recálculo de status do cliente</td><td><code>clientes.status_crm_atualizado_em</code></td></tr>' +
      '<tr><td>Canal é considerado B2C ou B2B (entra ou não na análise)</td><td><code>canais.escopo</code></td></tr>' +
      '<tr><td>Cliente é cadastro genérico (excluído da análise individual)</td><td><code>clientes.cadastro_incompleto</code></td></tr>' +
      '</table>'
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
      '<p class="cda-tut-nota">Se dois ou mais clientes tiverem o mesmo nome, o sistema mostra telefone, e-mail e cidade/UF de cada um lado a lado, pra você escolher o certo com segurança.</p>' +
      '<h4>Filtros do Kanban</h4>' +
      '<p><b>Campanha</b> — isola só os leads de uma campanha específica (essencial quando há várias campanhas rodando ao mesmo tempo, senão tudo fica misturado na mesma coluna). <b>Buscar por nome do cliente</b> — acha rápido em qual etapa/campanha uma pessoa específica está. Canal e Responsável continuam existindo, mas dependem de campo nem sempre preenchido.</p>' +
      '<p>Cada card mostra, quando existir: badge 📣 com o nome da campanha, badge do canal, e o responsável (ou "sem responsável" — deixado assim de propósito, pra não confundir com erro).</p>' +
      '<h4>Ver Histórico de Compras (popup)</h4>' +
      '<p>Dentro do modal do lead, se ele já estiver vinculado a um cliente, aparece o botão <b>"🛒 Ver Histórico de Compras"</b> — abre um resumo (itens, pedidos, total gasto, última compra, status atual e tags) e a lista das compras. Não carrega toda hora, só quando clicado — pra não pesar a tela.</p>' +
      '<h4>Campo no banco — onde cada regra mora</h4>' +
      '<table class="cda-tut-tabela cda-tut-tabela-campos"><tr><th>Regra / Informação</th><th>Campo</th></tr>' +
      '<tr><td>Etapa atual do lead (uma das 5)</td><td><code>leads_b2c.etapa</code></td></tr>' +
      '<tr><td>Resultado atual dentro da etapa (ex: "Pediu catálogo")</td><td><code>leads_b2c.resultado_id</code> → aponta pra <code>cda_status_crm.id</code> (tipo = "pipeline_resultado")</td></tr>' +
      '<tr><td>Lead já vinculado a um cadastro de Cliente existente</td><td><code>leads_b2c.cliente_id</code> — nulo = ainda não vinculado (não significa "não é cliente")</td></tr>' +
      '<tr><td>Campanha à qual o lead pertence</td><td><code>leads_b2c.campanha_id</code> — nulo = não veio de nenhuma campanha</td></tr>' +
      '<tr><td>Data da última movimentação de etapa (usada pro "dias parado")</td><td><code>leads_b2c.movido_em</code></td></tr>' +
      '<tr><td>Histórico completo de cada transição/interação</td><td>tabela <code>cda_historico_interacoes</code></td></tr>' +
      '<tr><td>Em quais etapas cada resultado pode aparecer no modal</td><td><code>cda_status_crm.etapa_aplicavel</code></td></tr>' +
      '</table>'
  },
  {
    id: 'campanhas', titulo: 'Campanhas',
    html: '<p>Liga um <b>segmento salvo</b> (Segmentação) a uma <b>etapa do Pipeline</b>, com período, meta e benefício — é o que transforma o Pipeline de "quadro de acompanhamento" em motor de campanha, ao invés de campanhas viverem soltas fora do CRM.</p>' +
      '<h4>Fluxo de uso</h4>' +
      '<p>1) Cria/usa um segmento salvo na Segmentação (ex: "Em Risco 91-180d"). 2) Cria a campanha, escolhendo esse segmento como Público e a etapa de entrada no Pipeline. 3) Clica em "➕ Adicionar público ao Pipeline" — o sistema recalcula quem bate com o segmento <i>naquele momento</i> e cria os leads, já vinculados aos clientes existentes (sem duplicar quem já foi adicionado antes). 4) A equipe trabalha os leads no Pipeline normalmente — cada movimentação já fica automaticamente atribuída à campanha.</p>' +
      '<p class="cda-tut-nota">O público não é uma lista congelada — é sempre recalculado do segmento na hora de clicar "Adicionar público". Se a base mudar, a próxima leva de "adicionar público" reflete o estado atual, e quem já foi adicionado não duplica.</p>' +
      '<h4>Público-Alvo (contagem ao vivo)</h4>' +
      '<p>Assim que você escolhe o segmento no formulário, o sistema já mostra quantos clientes batem com ele agora — sem precisar sair da tela pra conferir na Segmentação.</p>' +
      '<h4>🎁 Benefício oferecido</h4>' +
      '<p>Tipo (Nenhum, Desconto %, Desconto R$, Frete Grátis, Cashback, Brinde) + valor + cupom + condições. É a "isca" registrada oficialmente — evita que a equipe invente condição diferente do que foi combinado.</p>' +
      '<p class="cda-tut-nota">O sistema <b>não processa a venda</b> (isso acontece no Bling/Loja Integrada, fora daqui) — não aplica desconto automaticamente nem valida cupom em tempo real. O campo é registro, não checkout. Rastrear quem de fato usou o benefício e medir o retorno líquido é uma evolução futura, que vai exigir vincular campanha também às compras.</p>' +
      '<h4>🧭 Roteiro de Canais — as 5 perguntas, como campos de verdade</h4>' +
      '<p>Público conhecido ou anônimo? Quente ou frio? Quais canais escolhidos? Quem executa (Responsável, já capturado)? Por que essa combinação? Cada pergunta é um campo do formulário, não uma caixa de texto livre — fica estruturado e consultável depois.</p>' +
      '<table class="cda-tut-tabela cda-tut-tabela-campos"><tr><th>Conhecido</th><th>Temperatura</th><th>Sugestão automática mostrada</th></tr>' +
      '<tr><td>Conhecido</td><td>Quente</td><td>WhatsApp pessoal converte melhor que qualquer anúncio</td></tr>' +
      '<tr><td>Conhecido</td><td>Frio</td><td>WhatsApp/DM pessoal pra reengajar; Remarketing não compensa pra quem você já pode chamar</td></tr>' +
      '<tr><td>Anônimo</td><td>Frio</td><td>Remarketing pago e Instagram pago são o caminho certo; WhatsApp/DM não se aplica</td></tr>' +
      '<tr><td>Anônimo</td><td>Quente</td><td>Aproveite janelas gratuitas (ex: 72h após clique em anúncio) antes de precisar pagar de novo</td></tr>' +
      '</table>' +
      '<h4>📊 Indicadores da Campanha (KPI)</h4>' +
      '<p>Calculado ao vivo a partir dos leads reais da campanha, sem precisar de planilha:</p>' +
      '<table class="cda-tut-tabela cda-tut-tabela-campos"><tr><th>Indicador</th><th>Como é calculado</th></tr>' +
      '<tr><td>Leads no funil</td><td>Total de leads com essa campanha vinculada</td></tr>' +
      '<tr><td>Taxa de Contato</td><td>Leads que já saíram de "Novo Lead" ou já têm algum resultado registrado, dividido pelo total</td></tr>' +
      '<tr><td>Taxa de Resposta</td><td>Dos contatados, quantos têm resultado "positivo" (respondeu, pediu catálogo, solicitou orçamento, perguntou preço/frete/tamanho, salvou produtos, curtiu coleção, reservou, venda concluída)</td></tr>' +
      '<tr><td>Chegaram em Compra</td><td>Leads cuja etapa atual é Compra ou Fidelização</td></tr>' +
      '<tr><td>Barra de progresso da meta</td><td>"Chegaram em Compra" dividido pela Meta (número), em %</td></tr>' +
      '</table>' +
      '<h4>Campo no banco — onde cada regra mora</h4>' +
      '<table class="cda-tut-tabela cda-tut-tabela-campos"><tr><th>Regra / Informação</th><th>Campo</th></tr>' +
      '<tr><td>Segmento que define o público</td><td><code>cda_campanhas.publico_segmento_id</code> → aponta pra <code>segmentos_salvos.id</code></td></tr>' +
      '<tr><td>Etapa do Pipeline onde o público entra</td><td><code>cda_campanhas.pipeline_etapa_entrada</code></td></tr>' +
      '<tr><td>Meta (número, usado na barra de progresso)</td><td><code>cda_campanhas.meta_numero</code></td></tr>' +
      '<tr><td>Benefício (tipo/valor/cupom/condições)</td><td><code>cda_campanhas.beneficio_tipo</code>, <code>beneficio_valor</code>, <code>beneficio_cupom</code>, <code>beneficio_condicoes</code></td></tr>' +
      '<tr><td>Roteiro de canais (as 5 perguntas)</td><td><code>cda_campanhas.publico_conhecido</code>, <code>publico_temperatura</code>, <code>canais_selecionados</code>, <code>estrategia_canal</code></td></tr>' +
      '<tr><td>Qual campanha um lead pertence</td><td><code>leads_b2c.campanha_id</code></td></tr>' +
      '</table>'
  },
  {
    id: 'canais-marketing', titulo: 'Guia de Canais de Marketing',
    html: '<p>Referência rápida pra decidir canal por campanha — nascida de um caso real trabalhado ("Em Risco 91-180d"). <b>Não é regra fixa</b>: o público muda a resposta certa, por isso o método (as 5 perguntas) importa mais que a conclusão de um caso específico.</p>' +
      '<h4>O método — rode estas perguntas pra toda campanha nova</h4>' +
      '<p>1) Esse público já é conhecido (nome/contato) ou é gente anônima? 2) Ele já demonstrou interesse recente, ou está frio? 3) Dado isso, qual canal tem melhor custo-benefício? 4) Quem executa? 5) Quais indicadores medem se funcionou?</p>' +
      '<h4>2.1 — WhatsApp</h4>' +
      '<p><b>Custo real (2026):</b> desde jul/2025 a Meta cobra por mensagem individual, não mais por conversa. No Brasil, mensagem de marketing sai a partir de ~US$ 0,06. Respostas dentro de uma janela de 24h são gratuitas — mas isso muda a partir de out/2026, quando a Meta passa a cobrar até essas respostas.</p>' +
      '<p><b>Onde a IA ajuda:</b> gerar a mensagem personalizada por cliente (histórico real, não texto genérico) e o Cowork pode preparar os rascunhos de toda a lista pra revisão humana.</p>' +
      '<p><b>Onde não ajuda:</b> disparo automatizado em massa via WhatsApp Web — viola os Termos da Meta e arrisca banimento do número. O envio continua manual, feito pelo vendedor/responsável.</p>' +
      '<h4>2.2 — Instagram</h4>' +
      '<p><b>Onde a IA ajuda:</b> roteiro de Story/DM personalizado, calendário de conteúdo, direção de arte.</p>' +
      '<p><b>Onde não ajuda:</b> DM automatizada em massa (risco de restrição da conta, regra parecida com WhatsApp) e postagem automática (exigiria integração própria com a API da Meta). Story agendado pelo Meta Business Suite (grátis, sem integração) é o caminho mais simples hoje.</p>' +
      '<p><b>Divisão de responsabilidade:</b> Claude gera texto/roteiro/calendário → vendedor manda DM manual → agência/equipe de conteúdo publica/agenda o Story.</p>' +
      '<h4>2.3 — Remarketing pago</h4>' +
      '<p>Faz sentido pra público <b>anônimo e frio</b> (ex: campanha de prospecção de novos clientes) — não pra quem você já conhece e pode simplesmente chamar (ex: "Em Risco", onde foi descartado). Claude ajuda a redigir os textos do anúncio; configurar a campanha em si (Meta Ads/Google Ads) é ação de quem gerencia mídia paga.</p>' +
      '<h4>2.4 — E-mail</h4>' +
      '<p>Baixo retorno direto isoladamente, mas custo quase zero e gera <b>dado de comportamento</b> (quem abriu/clicou) que realimenta a Segmentação. Não tem risco de banimento por automação — é o único dos 4 canais onde vale a pena construir disparo automático de verdade (ex: via Resend/SendGrid) numa fase futura.</p>'
  }
];

async function montarModuloTutorial(containerId, opts) {
  opts = opts || {};
  var moduloAtual = opts.modulo || 'comercial';
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
      '.cda-tut-secao code{background:var(--card,#f5f0e8);border:1px solid var(--border2,#ccc);padding:1px 5px;border-radius:3px;font-size:10.5px;}' +
      '.cda-tut-tabela-campos td:first-child{width:55%;}' +
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
      var comentarios = await cdaCarregarComentariosTutorial(moduloAtual);
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
      return '<h2>' + s.titulo + '</h2>' + s.html.replace(/class="cda-tut-nota"/g, '').replace(/<table class="cda-tut-tabela[^"]*">/g, '<table border="1" cellpadding="4" cellspacing="0">').replace(/<code>/g, '<code style="background:#eee;padding:1px 4px;">');
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
      await cdaSalvarComentarioTutorial({ conteudo: apos, arquivoOrigem: file.name, importadoPor: (window.cu && window.cu.name) || 'Usuário', modulo: moduloAtual });
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

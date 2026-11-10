// ════════════════════════════════════════════════════════════════════
// cda-modulo-pipeline-b2c.js
// Kanban do Pipeline B2C — exclusivo do Comercial.
//
// MODELO (redesenhado em ago/2026): 5 etapas fixas. Nenhum card muda de
// etapa só arrastando — toda movimentação abre um modal obrigatório
// pedindo o "resultado" (catálogo cda_status_crm, tipo pipeline_resultado)
// e uma observação opcional. Cada transição fica registrada em
// cda_historico_interacoes, não só o estado atual.
//
// Requer cda-dados-compartilhados.js carregado antes (usa
// cdaCarregarLeadsB2C, cdaSalvarLeadB2C, cdaExcluirLeadB2C,
// cdaCarregarCanais, cdaCarregarStatusCrm, cdaCarregarHistoricoPorLead,
// cdaSalvarHistoricoInteracao, cdaSalvarCliente).
//
// Uso:
//   <div id="container-pipeline-b2c"></div>
//   <script src="cda-dados-compartilhados.js"></script>
//   <script src="cda-modulo-pipeline-b2c.js"></script>
//   <script>montarModuloPipelineB2C('container-pipeline-b2c');</script>
// ════════════════════════════════════════════════════════════════════

var CDA_ETAPAS_B2C = [
  { id: 'novo_lead', label: 'Novo Lead' },
  { id: 'contato', label: 'Contato' },
  { id: 'engajado', label: 'Engajado' },
  { id: 'compra', label: 'Compra' },
  { id: 'fidelizacao', label: 'Fidelização' }
];
// Precisa bater exatamente com os valores de etapa_aplicavel gravados em cda_status_crm
var CDA_ETAPA_LABEL_CATALOGO = { novo_lead: 'Novo Lead', contato: 'Contato', engajado: 'Engajado', compra: 'Compra', fidelizacao: 'Fidelização' };

async function montarModuloPipelineB2C(containerId, opts) {
  opts = opts || {};
  var editavel = opts.editavel !== false;
  var host = document.getElementById(containerId);
  if (!host) { console.error('cda-modulo-pipeline-b2c: container #' + containerId + ' não encontrado'); return; }

  var ST = { leads: [], canais: [], statusCrm: [], clientes: [], campanhas: [], compras: [], equipe: [], tarefas: [], rastreioEmails: [], editId: null, dragId: null, transicao: null, clienteSelecionado: null };

  host.innerHTML =
    '<style>' +
      '.pb2c-oper-bar{display:flex;gap:9px;flex-wrap:wrap;align-items:center;justify-content:space-between;margin:12px 0;}' +
      '.pb2c-oper-table{width:100%;border-collapse:collapse;font-size:11px;}' +
      '.pb2c-oper-table th{text-align:left;font-size:10px;letter-spacing:.25px;text-transform:uppercase;background:var(--card,#f5f0e8);padding:10px 8px;white-space:nowrap;}' +
      '.pb2c-oper-table td{padding:9px 8px;border-top:1px solid var(--border2,#ddd);vertical-align:middle;}' +
      '.pb2c-oper-table tbody tr:hover{background:var(--card,#f5f0e8);}' +
      '.pb2c-oper-table button{font-size:10px;padding:6px 9px;}' +
      '.pb2c-oper-pag{display:flex;justify-content:flex-end;align-items:center;gap:10px;padding:10px 0;font-size:11px;}' +
      '.pb2c-board{display:flex;gap:12px;overflow-x:auto;padding-bottom:12px;align-items:flex-start;}' +
      '.pb2c-col{background:var(--card,#f5f0e8);border:2px solid var(--ink,#1a1a1a);min-width:250px;max-width:250px;flex-shrink:0;}' +
      '.pb2c-col-h{padding:10px 12px;border-bottom:2px solid var(--ink,#1a1a1a);}' +
      '.pb2c-col-h .t{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;}' +
      '.pb2c-col-h .s{font-size:9px;color:var(--muted,#888);margin-top:2px;}' +
      '.pb2c-col-body{padding:8px;min-height:80px;display:flex;flex-direction:column;gap:8px;}' +
      '.pb2c-col-body.dragover{background:rgba(200,74,43,.08);}' +
      '.pb2c-card{background:var(--paper,#fff);border:1px solid var(--ink,#1a1a1a);padding:9px 10px;cursor:grab;font-size:11px;}' +
      '.pb2c-card:active{cursor:grabbing;}' +
      '.pb2c-card .nm{font-weight:700;font-size:12px;margin-bottom:3px;}' +
      '.pb2c-card .rw{display:flex;justify-content:space-between;align-items:center;margin-top:4px;font-size:9px;color:var(--muted,#888);}' +
      '.pb2c-age{display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:4px;}' +
      '.pb2c-age.ok{background:#7a9;}' + '.pb2c-age.warn{background:#d9a441;}' + '.pb2c-age.hot{background:#c0392b;}' +
      '.pb2c-resultado-badge{display:inline-block;font-size:8px;font-weight:700;text-transform:uppercase;padding:2px 6px;border-radius:999px;color:#fff;margin-top:4px;}' +
      '.pb2c-hist{max-height:140px;overflow-y:auto;border:1px solid var(--ink,#1a1a1a);padding:6px 8px;font-size:10px;background:var(--card,#f5f0e8);margin-top:6px;}' +
      '.pb2c-hist-item{padding:4px 0;border-bottom:1px dashed var(--border2,#ccc);}' +
      '.pb2c-tarefa-destaque{background:rgba(212,175,55,.18);outline:2px solid #D4AF37;border-radius:4px;padding:6px !important;}' +
      '.pb2c-hist-item:last-child{border-bottom:none;}' +
      '.pb2c-transicao-info{background:var(--card,#f5f0e8);border:2px solid var(--ink,#1a1a1a);padding:10px;margin-bottom:12px;font-size:12px;text-align:center;}' +
      '.pb2c-busca-wrap{position:relative;}' +
      '.pb2c-busca-resultados{position:absolute;top:100%;left:0;right:0;background:var(--paper,#fff);border:2px solid var(--ink,#1a1a1a);border-top:none;max-height:180px;overflow-y:auto;z-index:20;}' +
      '.pb2c-busca-item{padding:7px 10px;font-size:11px;cursor:pointer;border-bottom:1px solid var(--border2,#eee);}' +
      '.pb2c-busca-item:hover{background:var(--card,#f5f0e8);}' +
      '.pb2c-vinculado{background:var(--card,#f5f0e8);border:2px solid var(--ink,#1a1a1a);padding:8px 10px;font-size:11px;display:flex;justify-content:space-between;align-items:center;}' +
      '.pb2c-aviso-duplicata{font-size:10px;color:var(--rust,#c0392b);margin-top:4px;cursor:pointer;text-decoration:underline;}' +
      '.camp-checks label{display:inline-flex;align-items:center;gap:4px;font-size:11px;margin-right:12px;font-weight:400;text-transform:none;letter-spacing:0;}' +
      '.pb2c-diario-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:300;}' +
      '.pb2c-diario-overlay.op{display:block;}' +
      '.pb2c-diario-panel{position:fixed;top:0;right:0;bottom:0;width:340px;max-width:92vw;background:var(--paper,#fff);border-left:2px solid var(--ink,#1a1a1a);box-shadow:-4px 0 16px rgba(0,0,0,.15);display:flex;flex-direction:column;padding:16px;overflow-y:auto;}' +
      '.pb2c-diario-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;}' +
      '.pb2c-diario-filtros{display:flex;flex-direction:column;gap:6px;margin-bottom:12px;}' +
      '.pb2c-diario-filtros input,.pb2c-diario-filtros select{font-family:Syne,sans-serif;font-size:11px;padding:6px 8px;border:2px solid var(--ink,#1a1a1a);background:var(--card,#f5f0e8);}' +
      '.pb2c-diario-item{border:1px solid var(--border2,#ccc);padding:8px 10px;margin-bottom:6px;cursor:pointer;font-size:11px;}' +
      '.pb2c-diario-item:hover{background:var(--card,#f5f0e8);}' +
      '.pb2c-diario-item .dt{display:flex;justify-content:space-between;font-weight:700;font-size:12px;}' +
      '.pb2c-diario-item .dd{color:var(--muted,#888);font-size:10px;margin-top:2px;}' +
      '@media (max-width:600px){.pb2c-diario-panel{width:100%;max-width:100%;}}' +
    '</style>' +
    '<div class="row-bt">' +
      '<div><div class="sec-t">Pipeline B2C</div><div class="sec-d">Funil de leads do consumidor final — arrastar um card abre a confirmação de transição</div></div>' +
      (editavel ? '<button class="btn rust" id="pb2c-btn-novo">＋ Novo Lead</button>' : '') +
    '</div>' +
    '<div class="pb2c-principal" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:16px 0 10px">' +
      '<label for="pb2c-f-campanha" style="font-weight:700;font-size:12px">Campanha</label>' +
      '<select id="pb2c-f-campanha" aria-label="Campanha do Pipeline"><option value="">Todas as campanhas</option></select>' +
      '<input type="text" id="pb2c-f-cliente" aria-label="Buscar lead" placeholder="Buscar cliente..." style="flex:1 1 210px;min-width:160px">' +
      '<span class="fc" id="pb2c-cnt" aria-live="polite"></span>' +
    '</div>' +
    '<div class="pb2c-acessos" style="display:flex;align-items:flex-start;gap:10px;flex-wrap:wrap;margin:0 0 14px">' +
      '<button type="button" class="btn sm" id="pb2c-btn-homologacao" title="Acessar cadastro e operação de homologação desta campanha">🧪 Abrir Homologação</button>' +
      '<details class="pb2c-fold" style="flex:0 1 auto;border:1px solid var(--border2,#aaa);border-radius:8px;padding:7px 10px">' +
        '<summary style="font-weight:700;font-size:12px;cursor:pointer">Filtros adicionais</summary>' +
        '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:12px">' +
          '<label for="pb2c-f-canal" style="font-size:12px">Canal</label>' +
          '<select id="pb2c-f-canal"><option value="">Todos os canais</option></select>' +
          '<label for="pb2c-f-resp" style="font-size:12px">Responsável</label>' +
          '<select id="pb2c-f-resp"><option value="">Todos os responsáveis</option></select>' +
        '</div>' +
        '<p style="margin:8px 0 0;font-size:11px;color:var(--muted,#777)">Filtros de consulta: não alteram a segmentação nem a distribuição dos leads.</p>' +
      '</details>' +
      '<details class="pb2c-fold" style="flex:0 1 auto;border:1px solid var(--border2,#aaa);border-radius:8px;padding:7px 10px">' +
        '<summary style="font-weight:700;font-size:12px;cursor:pointer">Ferramentas comerciais</summary>' +
        '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:12px">' +
          '<button type="button" class="btn sm" id="pb2c-btn-gerar-msg-filtro" title="Gerar textos sugeridos para os leads filtrados; não envia mensagens">Gerar textos (filtrados)</button>' +
          '<button type="button" class="btn sm" id="pb2c-btn-diario" title="Consultar histórico de atividades comerciais">Diário comercial</button>' +
          '<button type="button" class="btn sm" id="pb2c-btn-comunicacoes" aria-expanded="false" aria-controls="pb2c-comunicacoes" title="Consultar tentativas de e-mail e eventos Resend">Comunicações da campanha</button>' +
          '<button type="button" class="btn sm" id="pb2c-btn-export-whats">Exportar WhatsApp</button>' +
        '</div>' +
      '</details>' +
    '</div>' +
    '<section id="pb2c-comunicacoes" style="display:none;border:2px solid var(--ink,#1a1a1a);padding:14px 16px;margin:10px 0 16px;background:var(--paper,#fff)">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap"><h3 style="margin:0;font-size:16px">Comunicações da Campanha</h3><div style="display:flex;gap:6px;flex-wrap:wrap">'+
        '<button type="button" class="btn sm" id="pb2c-comunicacoes-atualizar">↻ Atualizar histórico</button>'+
        (editavel?'<button type="button" class="btn sm" id="pb2c-comunicacoes-ativar">⚙ Ativar eventos Resend</button>':'')+
      '</div></div>' +
      '<div id="pb2c-comunicacoes-ativacao-status" role="status" style="font-size:11px;margin:8px 0"></div>' +
      '<p style="font-size:11px;color:var(--muted,#777);margin:8px 0">Consulta somente leitura do histórico de testes. A seleção de campanha acima determina os resultados. Eventos de entrega e rejeição aparecerão após a ativação do webhook assinado do Resend. Aberturas ainda não são acompanhadas.</p>' +
      '<div id="pb2c-comunicacoes-conteudo" aria-live="polite" style="font-size:12px">Abra o painel para consultar o histórico.</div>' +
    '</section>' +
    '<section aria-label="Visualização operacional do Pipeline">' +
      '<div class="pb2c-oper-bar">' +
        '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">'+
          '<label for="pb2c-visualizacao" style="font-size:11px;font-weight:700">Visualização</label>'+
          '<select id="pb2c-visualizacao" aria-label="Visualização do Pipeline"><option value="tabela">Tabela operacional</option><option value="kanban">Kanban</option></select>'+
          '<select id="pb2c-oper-etapa" aria-label="Filtrar pela etapa"><option value="">Todas as etapas</option></select>'+
          '<select id="pb2c-oper-situacao" aria-label="Filtrar por situação de acompanhamento"><option value="">Qualquer acompanhamento</option><option value="sem_responsavel">Sem responsável</option><option value="com_responsavel">Com responsável</option><option value="com_tarefa">Com tarefa</option><option value="sem_tarefa">Sem tarefa</option></select>'+
        '</div>'+
        '<span id="pb2c-oper-resumo" style="font-size:11px"></span>'+
      '</div>'+
      '<div id="pb2c-oper-tabela" style="overflow-x:auto"><table class="pb2c-oper-table"><thead><tr><th>Cliente</th><th>Campanha</th><th>Etapa</th><th>Responsável</th><th>Canal</th><th>Tarefas</th><th>E-mail / Resend</th><th>Data do envio</th><th>Última movimentação</th><th>Consulta</th></tr></thead><tbody id="pb2c-oper-linhas"></tbody></table><div class="pb2c-oper-pag" id="pb2c-oper-paginacao"></div></div>'+
    '</section>' +
    '<div class="pb2c-board" id="pb2c-board" style="display:none"></div>' +

    '<div class="pb2c-diario-overlay" id="pb2c-diario-overlay">' +
      '<div class="pb2c-diario-panel">' +
        '<div class="pb2c-diario-head"><span>📔 Diário Comercial</span><button class="mo-x" id="pb2c-diario-x" style="color:var(--ink,#1a1a1a)">✕</button></div>' +
        '<div class="pb2c-diario-filtros">' +
          '<input type="text" id="pb2c-diario-f-cliente" placeholder="🔎 Buscar lead/cliente...">' +
          '<select id="pb2c-diario-f-campanha"><option value="">Todas as campanhas</option></select>' +
          '<select id="pb2c-diario-f-etapa"><option value="">Todas as etapas do funil</option></select>' +
          '<select id="pb2c-diario-f-tipo"><option value="">Todos os tipos</option></select>' +
        '</div>' +
        '<div id="pb2c-diario-lista"></div>' +
      '</div>' +
    '</div>' +

    '<div class="mo" id="pb2c-modal">' +
      '<div class="mo-box">' +
        '<div class="mo-h"><h3 id="pb2c-modal-title">Novo Lead</h3><button class="mo-x" id="pb2c-modal-x">✕</button></div>' +
        '<div class="pb2c-tabs" id="pb2c-tabs" style="display:none;background:var(--ink,#1a1a1a);padding:0 20px">' +
          '<button class="pb2c-tab-btn active" data-tab="dados" style="background:none;border:none;color:var(--cream,#faf7f2);padding:10px 14px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;cursor:pointer;border-bottom:3px solid var(--rust,#c0392b)">Dados</button>' +
          '<button class="pb2c-tab-btn" data-tab="historico" style="background:none;border:none;color:var(--cream,#faf7f2);opacity:.6;padding:10px 14px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;cursor:pointer;border-bottom:3px solid transparent">Histórico</button>' +
          '<button class="pb2c-tab-btn" data-tab="emails" style="background:none;border:none;color:var(--cream,#faf7f2);opacity:.6;padding:10px 14px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;cursor:pointer;border-bottom:3px solid transparent">E-mails / Resend</button>' +
          '<button class="pb2c-tab-btn" data-tab="compras" style="background:none;border:none;color:var(--cream,#faf7f2);opacity:.6;padding:10px 14px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;cursor:pointer;border-bottom:3px solid transparent">Compras</button>' +
          '<button class="pb2c-tab-btn" data-tab="tarefas" style="background:none;border:none;color:var(--cream,#faf7f2);opacity:.6;padding:10px 14px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;cursor:pointer;border-bottom:3px solid transparent">Tarefas</button>' +
        '</div>' +
        '<div class="mo-b">' +
          '<div id="pb2c-tabpanel-dados"><div class="fg">' +
            '<div class="fgr pb2c-busca-wrap" style="grid-column:1/-1" id="pb2c-m-busca-wrap">' +
              '<label>Buscar cliente existente (nome, telefone ou e-mail)</label>' +
              '<input type="text" id="pb2c-m-busca" placeholder="Digite pelo menos 3 letras...">' +
              '<div class="pb2c-busca-resultados" id="pb2c-m-busca-resultados" style="display:none"></div>' +
            '</div>' +
            '<div class="fgr" style="grid-column:1/-1;display:none" id="pb2c-m-vinculado-wrap">' +
              '<div class="pb2c-vinculado"><span id="pb2c-m-vinculado-texto"></span><button class="btn sm" id="pb2c-m-trocar-cliente">Trocar</button></div>' +
            '</div>' +
            '<div class="fgr" style="grid-column:1/-1;display:none" id="pb2c-m-b2b-wrap">' +
              '<div class="pb2c-vinculado" id="pb2c-m-b2b-box" style="background:#fff7e6;border:1px solid #D4AF37"></div>' +
            '</div>' +
            '<div class="fgr" style="grid-column:1/-1"><label>Nome *</label><input type="text" id="pb2c-m-nome"><div class="pb2c-aviso-duplicata" id="pb2c-m-aviso-duplicata" style="display:none"></div></div>' +
            '<div class="fgr"><label>Telefone</label><input type="text" id="pb2c-m-tel"></div>' +
            '<div class="fgr"><label>E-mail</label><input type="email" id="pb2c-m-email"></div>' +
            '<div class="fgr"><label>Canal</label><select id="pb2c-m-canal"><option value="">—</option></select></div>' +
            '<div class="fgr" style="grid-column:1/-1"><label>Meios de Contato <span class="tmu" style="font-weight:400">(herda da campanha por padrão, editável)</span></label><div class="camp-checks" id="pb2c-m-meios"></div></div>' +
            '<div class="fgr"><label>Etapa atual</label><div id="pb2c-m-etapa-atual" style="padding:8px 0;font-weight:700"></div></div>' +
            '<div class="fgr"><label>Valor Estimado (R$)</label><input type="number" id="pb2c-m-valor" step="0.01"></div>' +
            '<div class="fgr"><label>Responsável</label><select id="pb2c-m-resp"><option value="">—</option></select></div>' +
            '<div class="fgr" style="grid-column:1/-1"><label>Observações</label><textarea id="pb2c-m-obs" rows="2"></textarea></div>' +
            '<div class="fgr" style="grid-column:1/-1;border-top:2px solid var(--ink,#1a1a1a);padding-top:12px;margin-top:4px">' +
              '<label style="font-size:11px">💬 Mensagem Sugerida (gerada — nunca tem {variável} crua)</label>' +
              '<div class="pb2c-hist" id="pb2c-m-msg-sugerida" style="min-height:50px"></div>' +
              '<button class="btn sm" id="pb2c-m-msg-gerar" style="margin-top:5px">🔄 Gerar/Regenerar</button>' +
            '</div>' +
            '<div class="fgr" style="grid-column:1/-1">' +
              '<label>Mensagem Final do Usuário <span class="tmu" style="font-weight:400">(se preenchida, prevalece sobre a sugerida)</span></label>' +
              '<textarea id="pb2c-m-msg-final" rows="3" placeholder="Deixe em branco pra usar a mensagem sugerida acima como está"></textarea>' +
              '<button class="btn sm" id="pb2c-m-msg-copiar" style="margin-top:5px">📋 Copiar mensagem final</button>' +
            '</div>' +
          '</div></div>' +
          '<div id="pb2c-tabpanel-historico" style="display:none"><div class="pb2c-hist" id="pb2c-m-hist" style="max-height:400px"></div></div>' +
          '<div id="pb2c-tabpanel-emails" style="display:none"><p class="tmu" style="font-size:11px">Eventos de entrega não alteram a etapa comercial do cliente.</p><button type="button" class="btn sm" id="pb2c-emails-atualizar">↻ Atualizar e-mails</button><div id="pb2c-emails-lead-lista" style="margin-top:12px"></div></div>' +
          '<div id="pb2c-tabpanel-compras" style="display:none">' +
            '<div id="pb2c-c-resumo" class="pb2c-transicao-info" style="text-align:left"></div>' +
            '<div class="pb2c-hist" id="pb2c-c-lista" style="max-height:320px"></div>' +
          '</div>' +
          '<div id="pb2c-tabpanel-tarefas" style="display:none">' +
            '<div class="pb2c-hist" id="pb2c-tf-lista" style="max-height:160px;margin-bottom:14px"></div>' +
            '<div class="fg">' +
              '<div class="fgr" style="grid-column:1/-1"><label>Descrição *</label><textarea id="pb2c-tf-desc" rows="3" placeholder="Ex: Ligar pra confirmar interesse"></textarea></div>' +
              '<div class="fgr"><label>Responsável</label><select id="pb2c-tf-resp"><option value="">—</option></select></div>' +
              '<div class="fgr"><label>Prioridade</label><select id="pb2c-tf-prioridade"><option value="baixa">Baixa</option><option value="media" selected>Média</option><option value="alta">Alta</option></select></div>' +
              '<div class="fgr"><label>Data Início</label><input type="date" id="pb2c-tf-inicio"></div>' +
              '<div class="fgr"><label>Data Fim</label><input type="date" id="pb2c-tf-prevista"></div>' +
            '</div>' +
            (editavel ? '<button class="btn rust" id="pb2c-tf-salvar" style="margin-top:12px">💾 Criar Tarefa</button>' : '') +
            (editavel ? '<button class="btn" id="pb2c-tf-cancelar-edicao" style="margin-top:12px;display:none">Cancelar edição</button>' : '') +
          '</div>' +
        '</div>' +
        '<div class="mo-f">' +
          (editavel ? '<button class="btn" id="pb2c-m-excluir" style="margin-right:auto;background:var(--rust,#c0392b);color:#fff;display:none">🗑 Excluir</button>' : '') +
          (editavel ? '<button class="btn" id="pb2c-m-mover" style="display:none">🔀 Mover de Etapa</button>' : '') +
          '<button class="btn" id="pb2c-m-cancelar">Cancelar</button>' +
          (editavel ? '<button class="btn rust" id="pb2c-m-salvar">💾 Salvar</button>' : '') +
        '</div>' +
      '</div>' +
    '</div>' +

    '<div class="mo" id="pb2c-modal-transicao">' +
      '<div class="mo-box">' +
        '<div class="mo-h"><h3>Confirmar Movimentação</h3><button class="mo-x" id="pb2c-t-x">✕</button></div>' +
        '<div class="mo-b">' +
          '<div class="pb2c-transicao-info" id="pb2c-t-info"></div>' +
          '<div class="fg">' +
            '<div class="fgr" style="grid-column:1/-1" id="pb2c-t-resultado-wrap"><label>Resultado *</label><select id="pb2c-t-resultado"><option value="">Selecione...</option></select></div>' +
            '<div class="fgr" style="grid-column:1/-1"><label>Observação</label><textarea id="pb2c-t-obs" rows="2" placeholder="Opcional — detalhe o que aconteceu"></textarea></div>' +
          '</div>' +
        '</div>' +
        '<div class="mo-f">' +
          '<button class="btn" id="pb2c-t-cancelar">Cancelar</button>' +
          '<button class="btn rust" id="pb2c-t-confirmar">✓ Confirmar Movimentação</button>' +
        '</div>' +
      '</div>' +
    '</div>';

  try {
    var res = await Promise.all([cdaCarregarLeadsB2C(), cdaCarregarCanais(), cdaCarregarStatusCrm(), cdaCarregarClientes(), cdaCarregarCampanhas(), cdaCarregarCompras(), cdaCarregarEquipe(), cdaCarregarTarefas(), cdaCarregarProdutos()]);
    ST.leads = res[0]; ST.canais = res[1]; ST.statusCrm = res[2]; ST.clientes = res[3]; ST.campanhas = res[4]; ST.compras = res[5]; ST.equipe = res[6]; ST.tarefas = res[7]; ST.produtos = res[8];
  } catch (err) {
    console.error(err);
    var msg = (err && (err.message || err.details || err.hint)) || JSON.stringify(err) || 'Erro desconhecido';
    host.querySelector('#pb2c-board').innerHTML = '<p style="color:var(--rust,#c0392b);padding:20px">Erro ao carregar dados do Supabase:<br><b>' + msg + '</b></p>';
    return;
  }

  var canalById = {}; ST.canais.forEach(function (c) { canalById[String(c.id)] = c; });
  var statusCrmById = {}; ST.statusCrm.forEach(function (s) { statusCrmById[s.id] = s; });
  var campanhaPorId = {}; ST.campanhas.forEach(function (c) { campanhaPorId[c.id] = c; });
  var equipePorId = {}; ST.equipe.forEach(function (e) { equipePorId[e.id] = e; });
  var clientePorId = {}; ST.clientes.forEach(function (c) { clientePorId[String(c.id)] = c; });
  var produtoPorId = {}; ST.produtos.forEach(function (p) { produtoPorId[String(p.id)] = p; });
  var totalGastoPorCliente = {}; ST.compras.forEach(function (cp) {
    if (!cp.clienteId) return;
    var k = String(cp.clienteId);
    totalGastoPorCliente[k] = (totalGastoPorCliente[k] || 0) + (Number(cp.valorTotal) || 0);
  });
  function totalGastoDoLead(l) { return l && l.clienteId ? (totalGastoPorCliente[String(l.clienteId)] || 0) : 0; }
  var resultadosPipeline = ST.statusCrm.filter(function (s) { return s.tipo === 'pipeline_resultado'; });
  function resultadosDaEtapa(etapaId) {
    var label = CDA_ETAPA_LABEL_CATALOGO[etapaId];
    return resultadosPipeline.filter(function (r) { return (r.etapaAplicavel || []).indexOf(label) !== -1; });
  }
  function nomeUsuarioAtual() { return (window.cu && window.cu.name) || 'Usuário'; }

  function popularFiltros() {
    host.querySelector('#pb2c-f-campanha').innerHTML = '<option value="">Todas as campanhas</option>' +
      '<option value="__sem_campanha__">Sem campanha vinculada</option>' +
      ST.campanhas.slice().sort(function (a, b) { return a.nome.localeCompare(b.nome); })
        .map(function (c) { return '<option value="' + c.id + '">' + c.nome + '</option>'; }).join('');
    host.querySelector('#pb2c-f-canal').innerHTML = '<option value="">Todos os canais</option>' +
      ST.canais.slice().sort(function (a, b) { return a.nome.localeCompare(b.nome); })
        .map(function (c) { return '<option value="' + c.id + '">' + c.nome + '</option>'; }).join('');
    host.querySelector('#pb2c-f-resp').innerHTML = '<option value="">Todos os responsáveis</option>' +
      ST.equipe.map(function (e) { return '<option value="' + e.id + '">' + e.nome + '</option>'; }).join('');
  }
  popularFiltros();

  // Rastreio técnico por destinatário: consulta separada das etapas comerciais.
  var rastreioErro=null;
  function chaveEmail(email,campanhaId){return String(campanhaId||'')+'|'+String(email||'').trim().toLowerCase();}
  var rastreioPorCliente=Object.create(null);
  function indexarRastreio(){
    rastreioPorCliente=Object.create(null);
    ST.rastreioEmails.forEach(function(e){
      var chave=chaveEmail(e.email_destinatario,e.campanha_id);
      (rastreioPorCliente[chave]||(rastreioPorCliente[chave]=[])).push(e);
    });
    Object.keys(rastreioPorCliente).forEach(function(ch){rastreioPorCliente[ch].sort(function(a,b){return String(b.solicitado_em).localeCompare(String(a.solicitado_em));});});
  }
  async function atualizarRastreio(){
    try{
      var r=await cdaFetchAll('cda_rastreio_email_por_destinatario','tentativa_id,campanha_id,mensagem_id,email_destinatario,tipo_envio,situacao_pedido,solicitado_em,atualizado_em,resend_email_id,erro,total_eventos,evento_recente,evento_recente_em,entregue_em,devolvido_em,reclamacao_em,destinatarios_na_tentativa','tentativa_id');
      ST.rastreioEmails=r||[];rastreioErro=null;indexarRastreio();
    }catch(e){rastreioErro=(e&&e.message)||String(e);ST.rastreioEmails=[];indexarRastreio();}
  }
  function registrosEmailLead(lead){return lead?(rastreioPorCliente[chaveEmail(lead.email,lead.campanhaId)]||[]):[];}
  function situacaoEmail(e){
    if(!e)return 'Aguardando envio';
    if(e.destinatarios_na_tentativa>1&&e.total_eventos>0)return 'Evento coletivo · confirmar no Resend';
    if(e.reclamacao_em)return 'Reclamação de spam';
    if(e.devolvido_em)return 'Devolvido';
    if(e.entregue_em)return 'Entregue';
    if(e.evento_recente==='email.delivery_delayed')return 'Entrega adiada';
    return ({aceito_provedor:'Aceito pelo Resend · não entregue ainda',rejeitado_provedor:'Recusado pelo Resend',falha_tecnica:'Falha técnica',solicitado:'Solicitado'})[e.situacao_pedido]||e.situacao_pedido||'Situação não informada';
  }
  function resumoEmailLead(l){
    var todos=registrosEmailLead(l), oficiais=todos.filter(function(e){return e.tipo_envio!=='teste';});
    return oficiais[0]||todos[0]||null;
  }
  atualizarRastreio().then(function(){render();});

  // Consulta do histórico de testes por campanha, independente de quantos leads há no funil.
  // Não cria leads, não grava interações nem emite e-mails.
  var comunicacoesAberto = false;
  var comunicacoesDados = null;
  var comunicacoesCarregando = false;
  function escCom(v) { return String(v == null ? '' : v).replace(/[&<>"']/g,function(ch){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch];
  }); }
  function dataCom(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'});
  }
  async function carregarComunicacoes() {
    if (comunicacoesCarregando) return;
    comunicacoesCarregando=true;
    var out=host.querySelector('#pb2c-comunicacoes-conteudo');
    out.textContent='Consultando histórico de testes no Supabase...';
    try {
      // Fetch paralelo; a consulta usa a mesma fonte de dados do painel de Campanhas.
      var [testes,mensagens,eventos]=await Promise.all([
        cdaFetchAll('cda_email_tentativas','id,campanha_id,mensagem_id,criado_em,destinatarios,usuario_nome,situacao,resend_email_id,erro','id'),
        cdaCarregarMensagens(),
        cdaFetchAll('cda_email_eventos','id,tentativa_id,tipo,ocorrido_em,recebido_em','id')
      ]);
      comunicacoesDados={testes:testes||[],mensagens:mensagens||[],eventos:eventos||[]};
      renderComunicacoes();
    }catch(e){
      comunicacoesDados=null;
      out.textContent='Não foi possível consultar o histórico: '+((e&&e.message)||String(e));
    }finally{comunicacoesCarregando=false;}
  }
  function renderComunicacoes() {
    if (!comunicacoesAberto) return;
    var out=host.querySelector('#pb2c-comunicacoes-conteudo');
    var filtro=host.querySelector('#pb2c-f-campanha').value;
    if (!comunicacoesDados) { out.textContent='Clique em Atualizar histórico para consultar.'; return; }
    var registros=comunicacoesDados.testes.filter(function(t){
      return filtro!=='__sem_campanha__' && (!filtro || String(t.campanha_id)===filtro);
    }).sort(function(a,b){return String(b.criado_em).localeCompare(String(a.criado_em));});
    var nomes=Object.create(null);
    comunicacoesDados.mensagens.forEach(function(m){nomes[String(m.id)]=m.nome;});
    var aceitos=registros.filter(function(t){return t.situacao==='aceito_provedor';}).length;
    var falhas=registros.filter(function(t){return t.situacao==='falha_tecnica'||t.situacao==='rejeitado_provedor';}).length;
    var pendentes=registros.length-aceitos-falhas;
    var eventosPorTentativa=Object.create(null);
    (comunicacoesDados.eventos||[]).forEach(function(e){
      var k=String(e.tentativa_id);
      (eventosPorTentativa[k]||(eventosPorTentativa[k]=[])).push(e);
    });
    var entregues=registros.filter(function(t){return (eventosPorTentativa[String(t.id)]||[]).some(function(e){return e.tipo==='email.delivered';});}).length;
    var devolvidos=registros.filter(function(t){return (eventosPorTentativa[String(t.id)]||[]).some(function(e){return e.tipo==='email.bounced';});}).length;
    var reclamacoes=registros.filter(function(t){return (eventosPorTentativa[String(t.id)]||[]).some(function(e){return e.tipo==='email.complained';});}).length;
    out.innerHTML='<p style="font-size:11px;margin:8px 0"><b>Campanha:</b> '+escCom(filtro ? (filtro==='__sem_campanha__'?'Sem campanha vinculada':(campanhaPorId[filtro]||{}).nome||'Campanha #'+filtro) : 'Todas as campanhas')+'</p>'+
      '<div style="display:flex;gap:16px;flex-wrap:wrap;margin:8px 0 12px"><span><b>'+registros.length+'</b> tentativas</span><span><b>'+aceitos+'</b> aceitas pelo provedor</span><span><b>'+falhas+'</b> falhas/recusas</span><span><b>'+pendentes+'</b> sem conclusão</span><span><b>'+entregues+'</b> entregas notificadas</span><span><b>'+devolvidos+'</b> devoluções notificadas</span><span><b>'+reclamacoes+'</b> reclamações notificadas</span></div>'+
      (registros.length?'<div style="overflow-x:auto"><table style="width:100%;font-size:11px;border-collapse:collapse"><thead><tr><th>Data/hora</th><th>Campanha</th><th>Mensagem</th><th>E-mails de teste</th><th>Aceitação do pedido</th><th>Evento posterior</th><th>ID Resend</th></tr></thead><tbody>'+
      registros.map(function(t){var c=campanhaPorId[String(t.campanha_id)];return '<tr style="border-top:1px solid var(--border2,#ddd)">'+
        '<td style="padding:8px;white-space:nowrap">'+escCom(dataCom(t.criado_em))+'</td>'+
        '<td style="padding:8px">'+escCom(c?c.nome:'#'+t.campanha_id)+'</td>'+
        '<td style="padding:8px">'+escCom(nomes[String(t.mensagem_id)]||'#'+t.mensagem_id)+'</td>'+
        '<td style="padding:8px">'+escCom((t.destinatarios||[]).join(', '))+'</td>'+
        '<td style="padding:8px">'+escCom(({aceito_provedor:'Aceito pelo Resend · entrega não confirmada',rejeitado_provedor:'Recusado pelo provedor',falha_tecnica:'Falha técnica',solicitado:'Solicitado'})[t.situacao]||t.situacao)+(t.erro?'<div style="font-size:10px">'+escCom(t.erro)+'</div>':'')+'</td>'+
        '<td style="padding:8px">'+(function(){
          var ev=(eventosPorTentativa[String(t.id)]||[]).slice().sort(function(a,b){return String(b.ocorrido_em).localeCompare(String(a.ocorrido_em));});
          var labels={'email.delivered':'Entregue','email.bounced':'Devolvido / rejeitado','email.delivery_delayed':'Entrega adiada','email.complained':'Reclamação de spam'};
          return ev.length ? ev.map(function(e){return '<div>'+escCom(labels[e.tipo]||e.tipo)+' · '+escCom(dataCom(e.ocorrido_em))+'</div>';}).join('') : '<span style="color:var(--muted,#777)">Sem evento recebido</span>';
        })()+'</td>'+
        '<td style="padding:8px;overflow-wrap:anywhere">'+escCom(t.resend_email_id||'—')+'</td></tr>';}).join('')+
      '</tbody></table></div>':'<p style="color:var(--muted,#777)">Nenhum teste registrado para esta seleção.</p>')+
      '<p style="font-size:10px;color:var(--muted,#777);margin-top:12px">Eventos posteriores são registrados apenas quando recebidos de webhook assinado e associados ao teste. Zero eventos não prova ausência de entregas enquanto o webhook não estiver ativado. Histórico de compras e leads não são alterados por esta consulta.</p>';
  }
  host.querySelector('#pb2c-btn-homologacao').addEventListener('click',function(){
    var filtro=host.querySelector('#pb2c-f-campanha').value;
    window._cdaHomologacaoCampanhaId = (filtro && filtro !== '__sem_campanha__') ? filtro : '';
    navigateCRM('homologacao');
  });
  host.querySelector('#pb2c-btn-comunicacoes').addEventListener('click',function(){
    comunicacoesAberto=!comunicacoesAberto;
    host.querySelector('#pb2c-comunicacoes').style.display=comunicacoesAberto?'':'none';
    this.setAttribute('aria-expanded',comunicacoesAberto?'true':'false');
    if(comunicacoesAberto) comunicacoesDados?renderComunicacoes():carregarComunicacoes();
  });
  host.querySelector('#pb2c-comunicacoes-atualizar').addEventListener('click',carregarComunicacoes);
  if (editavel) host.querySelector('#pb2c-comunicacoes-ativar').addEventListener('click',async function(){
    if(!confirm('Configurar automaticamente no Resend os quatro eventos de entrega/rejeição e guardar o segredo de assinatura no Supabase Vault?\n\nEsta operação é restrita a administradores e NÃO envia e-mails.')) return;
    var btn=this, msg=host.querySelector('#pb2c-comunicacoes-ativacao-status');
    btn.disabled=true;btn.textContent='Configurando webhook...';
    msg.textContent='Validando administrador e conectando ao Resend...';
    try {
      var res=await cdaClient.functions.invoke('configurar-webhook-resend-preview',{body:{}});
      var data=res.data;
      if(res.error){
        if(res.error.context && typeof res.error.context.json==='function'){
          try{ data=await res.error.context.json(); }catch(e){}
        }
        throw new Error((data&&data.erro)||res.error.message||'Falha ao configurar webhook');
      }
      if(!data||!data.ok)throw new Error((data&&data.erro)||'Configuração não concluída.');
      msg.textContent='Webhook configurado no Resend e segredo protegido no Vault. ID: '+data.webhook_id+
        '. Faça um novo Enviar Teste em Campanhas e depois clique em Atualizar histórico.';
    } catch(err){
      msg.textContent='Configuração não concluída: '+((err&&err.message)||String(err));
    } finally {btn.disabled=false;btn.textContent='⚙ Ativar eventos Resend';}
  });
  host.querySelector('#pb2c-m-resp').innerHTML = '<option value="">—</option>' +
    ST.equipe.map(function (e) { return '<option value="' + e.id + '">' + e.nome + '</option>'; }).join('');

  function getFiltro() {
    var fCampanha = host.querySelector('#pb2c-f-campanha').value;
    var fCliente = host.querySelector('#pb2c-f-cliente').value.trim().toLowerCase();
    var fCanal = host.querySelector('#pb2c-f-canal').value;
    var fResp = host.querySelector('#pb2c-f-resp').value;
    return ST.leads.filter(function (l) {
      var cli = l.clienteId ? clientePorId[String(l.clienteId)] : null;
      if (cli && cli.tipoComercial === 'canal_b2b') return false; // marcado como B2B — sai do funil B2C
      if (fCampanha === '__sem_campanha__' && l.campanhaId) return false;
      if (fCampanha && fCampanha !== '__sem_campanha__' && String(l.campanhaId) !== fCampanha) return false;
      if (fCliente && (l.nome || '').toLowerCase().indexOf(fCliente) === -1) return false;
      if (fCanal && String(l.canalId) !== fCanal) return false;
      if (fResp && String(l.responsavelId) !== fResp) return false;
      return true;
    });
  }

  function formatarTelefoneWhats(tel) {
    var d = (tel || '').replace(/\D/g, '');
    if (!d) return '';
    if (d.length === 11) return '+55 (' + d.slice(0, 2) + ') ' + d.slice(2);
    if (d.length === 10) return '+55 (' + d.slice(0, 2) + ') ' + d.slice(2);
    return '+55 ' + d;
  }

  function exportarLeadsWhatsApp() {
    var fCampanhaId = host.querySelector('#pb2c-f-campanha').value;
    if (!fCampanhaId || fCampanhaId === '__sem_campanha__') {
      alert('Selecione uma campanha específica no filtro "Todas as campanhas" antes de exportar.\n\nA mensagem exportada varia por campanha, então a exportação precisa ser feita campanha por campanha.');
      return;
    }
    var campanha = campanhaPorId[fCampanhaId];
    var lista = getFiltro().filter(function (l) { return l.mensagemSugerida && l.mensagemSugerida.trim(); });
    if (!lista.length) {
      alert('Nenhum lead com mensagem sugerida gerada para os filtros atuais.\n\nGere as mensagens primeiro com o botão "🚀 Gerar Mensagens (filtrados)".');
      return;
    }
    var header = ['DESCRIÇÃO MENSAGEM WHATSAPP BUSINESS ', 'VARIAVEL CONTATO  NOME ', 'CONTATO TELEFONE WHATSAPP '];
    var linhas = lista.map(function (l) {
      return [l.mensagemSugerida, l.nome || '', formatarTelefoneWhats(l.telefone)];
    });
    var ws = XLSX.utils.aoa_to_sheet([header].concat(linhas));
    ws['!cols'] = [{ wch: 90 }, { wch: 30 }, { wch: 22 }];
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'PIPELINE RISCO');
    var wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    var blob = new Blob([wbout], { type: 'application/octet-stream' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    var nomeCampanha = (campanha ? campanha.nome : 'campanha').replace(/[^\w\-]+/g, '_');
    var dataStr = new Date().toISOString().slice(0, 10);
    a.href = url; a.download = 'Exportacao_Leads_Campanha_WhatsApp_' + nomeCampanha + '_' + dataStr + '.xlsx';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function diasParado(movidoEm) {
    if (!movidoEm) return 0;
    var ms = Date.now() - new Date(movidoEm).getTime();
    return Math.floor(ms / 86400000);
  }
  function corIdade(dias) {
    if (dias >= 14) return 'hot';
    if (dias >= 7) return 'warn';
    return 'ok';
  }

  var visaoPipeline='tabela';
  var paginaOperacional=0;
  var tamanhoPaginaOperacional=25;
  function etapaNome(id){var e=CDA_ETAPAS_B2C.find(function(x){return x.id===id;});return e?e.label:(id||'—');}
  function renderTabelaOperacional(filtrados){
    var etapa=host.querySelector('#pb2c-oper-etapa').value;
    var situacao=host.querySelector('#pb2c-oper-situacao').value;
    var tarefasAtivas=Object.create(null);
    ST.tarefas.forEach(function(t){
      if(!t.leadId||t.status==='concluida'||t.status==='cancelada')return;
      tarefasAtivas[String(t.leadId)]=(tarefasAtivas[String(t.leadId)]||0)+1;
    });
    var lista=filtrados.filter(function(l){
      if(etapa&&l.etapa!==etapa)return false;
      var n=tarefasAtivas[String(l.id)]||0;
      if(situacao==='sem_responsavel'&&l.responsavelId)return false;
      if(situacao==='com_responsavel'&&!l.responsavelId)return false;
      if(situacao==='com_tarefa'&&!n)return false;
      if(situacao==='sem_tarefa'&&n)return false;
      return true;
    }).sort(function(a,b){return String(a.nome||'').localeCompare(String(b.nome||''),'pt-BR');});
    var paginas=Math.max(1,Math.ceil(lista.length/tamanhoPaginaOperacional));
    paginaOperacional=Math.min(paginaOperacional,paginas-1);
    var inicio=paginaOperacional*tamanhoPaginaOperacional;
    var pagina=lista.slice(inicio,inicio+tamanhoPaginaOperacional);
    host.querySelector('#pb2c-oper-resumo').textContent=lista.length.toLocaleString('pt-BR')+' cliente(s) nesta consulta';
    host.querySelector('#pb2c-oper-linhas').innerHTML=pagina.map(function(l){
      var campanha=campanhaPorId[l.campanhaId],resp=equipePorId[l.responsavelId],canal=canalById[l.canalId];
      var mov=l.movidoEm?new Date(l.movidoEm):null;
      var dia=mov&&!isNaN(mov.getTime())?mov.toLocaleDateString('pt-BR'):'—';
      var ultimoEmail=resumoEmailLead(l);
      return '<tr>'+
        '<td><b>'+escCom(l.nome||'—')+'</b><div style="color:var(--muted,#777);font-size:10px">'+escCom(l.email||'Sem e-mail cadastrado')+'</div></td>'+
        '<td>'+escCom(campanha?campanha.nome:'—')+'</td>'+
        '<td>'+escCom(etapaNome(l.etapa))+'</td>'+
        '<td>'+escCom(resp?resp.nome:'Não definido')+'</td>'+
        '<td>'+escCom(canal?canal.nome:'—')+'</td>'+
        '<td>'+Number(tarefasAtivas[String(l.id)]||0)+'</td>'+ 
        '<td>'+escCom(rastreioErro?'Consulta indisponível':situacaoEmail(ultimoEmail))+(ultimoEmail&&ultimoEmail.tipo_envio==='teste'?'<div class="tmu">TESTE</div>':'')+'</td>'+ 
        '<td>'+escCom(ultimoEmail?dataCom(ultimoEmail.solicitado_em):'—')+'</td>'+
        '<td>'+escCom(dia)+'</td>'+
        '<td><button type="button" class="btn sm" data-pb2c-oper-abrir="'+escCom(l.id)+'">Abrir</button></td></tr>';
    }).join('')||'<tr><td colspan="10" style="padding:16px">Nenhum cliente encontrado para os filtros selecionados.</td></tr>';
    var pag=host.querySelector('#pb2c-oper-paginacao');
    pag.innerHTML='<span>Exibindo '+(lista.length?inicio+1:0)+'–'+Math.min(inicio+tamanhoPaginaOperacional,lista.length)+' de '+lista.length+'</span>'+
      '<button type="button" class="btn sm" id="pb2c-oper-anterior" '+(paginaOperacional===0?'disabled':'')+'>Anterior</button>'+
      '<span>Página '+(paginaOperacional+1)+' de '+paginas+'</span>'+
      '<button type="button" class="btn sm" id="pb2c-oper-proximo" '+(paginaOperacional>=paginas-1?'disabled':'')+'>Próxima</button>';
    pag.querySelector('#pb2c-oper-anterior').addEventListener('click',function(){paginaOperacional--;renderTabelaOperacional(getFiltro());});
    pag.querySelector('#pb2c-oper-proximo').addEventListener('click',function(){paginaOperacional++;renderTabelaOperacional(getFiltro());});
    host.querySelector('#pb2c-oper-linhas').querySelectorAll('[data-pb2c-oper-abrir]').forEach(function(b){
      b.addEventListener('click',function(){abrirModalInfo(b.dataset.pb2cOperAbrir);});
    });
  }
  host.querySelector('#pb2c-oper-etapa').innerHTML='<option value="">Todas as etapas</option>'+
    CDA_ETAPAS_B2C.map(function(e){return '<option value="'+e.id+'">'+e.label+'</option>';}).join('');
  host.querySelector('#pb2c-visualizacao').addEventListener('change',function(){visaoPipeline=this.value;paginaOperacional=0;render();});
  host.querySelector('#pb2c-oper-etapa').addEventListener('change',function(){paginaOperacional=0;render();});
  host.querySelector('#pb2c-oper-situacao').addEventListener('change',function(){paginaOperacional=0;render();});

  function render() {
    var f = getFiltro();
    var kanban=visaoPipeline==='kanban';
    host.querySelector('#pb2c-board').style.display=kanban?'':'none';
    host.querySelector('#pb2c-oper-tabela').style.display=kanban?'none':'';
    host.querySelector('#pb2c-oper-etapa').disabled=kanban;
    host.querySelector('#pb2c-oper-situacao').disabled=kanban;
    if(!kanban){
      renderTabelaOperacional(f);
      host.querySelector('#pb2c-cnt').textContent=f.length.toLocaleString('pt-BR')+' lead(s) no funil';
      return;
    }
    var board = host.querySelector('#pb2c-board');
    board.innerHTML = CDA_ETAPAS_B2C.map(function (etapa) {
      var cards = f.filter(function (l) { return l.etapa === etapa.id; })
        .slice().sort(function (a, b) { return totalGastoDoLead(b) - totalGastoDoLead(a); });
      var soma = cards.reduce(function (s, c) { return s + (Number(c.valorEstimado) || 0); }, 0);
      var cardsHtml = cards.map(function (l) {
        var canal = canalById[l.canalId];
        var campanha = campanhaPorId[l.campanhaId];
        var dias = diasParado(l.movidoEm);
        var cor = corIdade(dias);
        var resultado = statusCrmById[l.resultadoId];
        var totalGasto = totalGastoDoLead(l);
        return '<div class="pb2c-card"' + (editavel ? ' draggable="true"' : '') + ' data-id="' + l.id + '">' +
          '<div class="nm">' + (l.nome || '—') + '</div>' +
          (campanha ? '<span class="badge b-rust" style="font-size:8px">📣 ' + campanha.nome + '</span>' : '') +
          '<div style="font-size:9px;color:var(--muted,#888);font-weight:600">💰 ' + (totalGasto ? 'R$ ' + totalGasto.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) + ' em compras' : 'sem histórico de compras') + '</div>' +
          (canal ? '<span class="badge b-vio" style="font-size:8px">' + canal.nome + '</span>' : '') +
          '<div class="rw"><span><span class="pb2c-age ' + cor + '"></span>' + dias + 'd parado</span>' +
          '<span>' + (l.valorEstimado ? 'R$ ' + Number(l.valorEstimado).toLocaleString('pt-BR') : '') + '</span></div>' +
          '<div class="rw"><span>👤 ' + (equipePorId[l.responsavelId] ? equipePorId[l.responsavelId].nome : 'sem responsável') + '</span><span></span></div>' +
          (resultado ? '<span class="pb2c-resultado-badge" style="background:' + resultado.cor + '">' + resultado.nome + '</span>' : '') +
          '</div>';
      }).join('');
      return '<div class="pb2c-col">' +
        '<div class="pb2c-col-h"><div class="t">' + etapa.label + '</div>' +
        '<div class="s">' + cards.length + ' lead(s) · R$ ' + soma.toLocaleString('pt-BR') + '</div></div>' +
        '<div class="pb2c-col-body" data-etapa="' + etapa.id + '">' + cardsHtml + '</div>' +
        '</div>';
    }).join('');

    host.querySelector('#pb2c-cnt').textContent = f.length.toLocaleString('pt-BR') + ' lead(s) no funil';

    board.querySelectorAll('.pb2c-card').forEach(function (card) {
      if (editavel) card.addEventListener('dragstart', function (e) {
        ST.dragId = card.dataset.id;
        e.dataTransfer.effectAllowed = 'move';
      });
      card.addEventListener('click', function () { abrirModalInfo(card.dataset.id); });
    });
    if (editavel) board.querySelectorAll('.pb2c-col-body').forEach(function (col) {
      col.addEventListener('dragover', function (e) { e.preventDefault(); col.classList.add('dragover'); });
      col.addEventListener('dragleave', function () { col.classList.remove('dragover'); });
      col.addEventListener('drop', function (e) {
        e.preventDefault();
        col.classList.remove('dragover');
        var novaEtapa = col.dataset.etapa;
        if (ST.dragId) abrirModalTransicao(ST.dragId, novaEtapa);
        ST.dragId = null;
      });
    });
  }

  // ── Painel Diário Comercial (deslizante, dentro do Pipeline) ────────
  var ST_DIARIO = { historico: null, carregando: false };
  var diarioOverlay = host.querySelector('#pb2c-diario-overlay');
  function fmtDataHoraDiario(iso) {
    var d = new Date(iso);
    return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  function renderDiario() {
    var fCliente = host.querySelector('#pb2c-diario-f-cliente').value.trim().toLowerCase();
    var fCampanha = host.querySelector('#pb2c-diario-f-campanha').value;
    var fEtapa = host.querySelector('#pb2c-diario-f-etapa').value;
    var fTipo = host.querySelector('#pb2c-diario-f-tipo').value;
    var lista = (ST_DIARIO.historico || []).filter(function (h) {
      if (fCliente) {
        var lead = ST.leads.find(function (x) { return x.id === h.leadId; });
        if (!lead || (lead.nome || '').toLowerCase().indexOf(fCliente) === -1) return false;
      }
      if (fCampanha && String(h.campanhaId) !== fCampanha) return false;
      if (fEtapa && h.etapaNova !== fEtapa) return false;
      if (fTipo && h.tipoInteracao !== fTipo) return false;
      return true;
    });
    var box = host.querySelector('#pb2c-diario-lista');
    box.innerHTML = lista.length ? lista.map(function (h) {
      var lead = ST.leads.find(function (x) { return x.id === h.leadId; });
      var campanha = campanhaPorId[h.campanhaId];
      var descricao = h.etapaNova ? (h.etapaAnterior ? h.etapaAnterior + ' → ' + h.etapaNova : h.etapaNova) : (h.observacao || 'Interação');
      return '<div class="pb2c-diario-item" data-lead-id="' + (h.leadId || '') + '">' +
        '<div class="dt"><span>' + (lead ? lead.nome : '—') + '</span><span style="font-weight:400">' + fmtDataHoraDiario(h.criadoEm) + '</span></div>' +
        '<div class="dd">' + descricao + (campanha ? ' · ' + campanha.nome : '') + '</div>' +
      '</div>';
    }).join('') : '<p class="tmu" style="font-size:11px">Nenhuma interação encontrada.</p>';
    box.querySelectorAll('.pb2c-diario-item').forEach(function (item) {
      item.addEventListener('click', function () {
        var leadId = item.dataset.leadId;
        if (!leadId) return;
        diarioOverlay.classList.remove('op');
        abrirModalInfo(leadId);
      });
    });
  }
  async function abrirDiario() {
    diarioOverlay.classList.add('op');
    if (ST_DIARIO.historico) { renderDiario(); return; }
    if (ST_DIARIO.carregando) return;
    ST_DIARIO.carregando = true;
    host.querySelector('#pb2c-diario-lista').innerHTML = '<p class="tmu" style="font-size:11px">Carregando...</p>';
    try {
      ST_DIARIO.historico = await cdaCarregarHistoricoCompleto();
      renderDiario();
    } catch (err) {
      console.error(err);
      host.querySelector('#pb2c-diario-lista').innerHTML = '<p style="color:var(--rust,#c0392b);font-size:11px">Erro ao carregar o diário.</p>';
    }
    ST_DIARIO.carregando = false;
  }
  host.querySelector('#pb2c-diario-f-campanha').innerHTML = '<option value="">Todas as campanhas</option>' +
    ST.campanhas.slice().sort(function (a, b) { return a.nome.localeCompare(b.nome); })
      .map(function (c) { return '<option value="' + c.id + '">' + c.nome + '</option>'; }).join('');
  host.querySelector('#pb2c-diario-f-etapa').innerHTML = '<option value="">Todas as etapas do funil</option>' +
    CDA_ETAPAS_B2C.map(function (e) { return '<option value="' + e.id + '">' + e.label + '</option>'; }).join('');
  host.querySelector('#pb2c-diario-f-tipo').innerHTML = '<option value="">Todos os tipos</option>' +
    [{ id: 'pipeline', label: 'Movimentação de Pipeline' }, { id: 'ligacao', label: 'Ligação' }, { id: 'whatsapp', label: 'WhatsApp' }, { id: 'email', label: 'E-mail' }, { id: 'reuniao', label: 'Reunião' }, { id: 'tarefa_criada', label: 'Tarefa Criada' }, { id: 'outro', label: 'Outro' }]
      .map(function (t) { return '<option value="' + t.id + '">' + t.label + '</option>'; }).join('');
  host.querySelector('#pb2c-btn-diario').addEventListener('click', abrirDiario);
  host.querySelector('#pb2c-diario-x').addEventListener('click', function () { diarioOverlay.classList.remove('op'); });
  diarioOverlay.addEventListener('click', function (e) { if (e.target === diarioOverlay) diarioOverlay.classList.remove('op'); });
  host.querySelector('#pb2c-diario-f-cliente').addEventListener('input', renderDiario);
  host.querySelector('#pb2c-diario-f-campanha').addEventListener('change', renderDiario);
  host.querySelector('#pb2c-diario-f-etapa').addEventListener('change', renderDiario);
  host.querySelector('#pb2c-diario-f-tipo').addEventListener('change', renderDiario);

  var modalT = host.querySelector('#pb2c-modal-transicao');
  function abrirModalTransicao(leadId, novaEtapa) {
    var lead = ST.leads.find(function (x) { return x.id === leadId; });
    if (!lead) return;
    if (lead.etapa === novaEtapa) return;
    ST.transicao = { leadId: leadId, etapaAnterior: lead.etapa, novaEtapa: novaEtapa };
    var etapaAnteriorLabel = CDA_ETAPAS_B2C.find(function (e) { return e.id === lead.etapa; }).label;
    var novaEtapaLabel = CDA_ETAPAS_B2C.find(function (e) { return e.id === novaEtapa; }).label;
    host.querySelector('#pb2c-t-info').innerHTML = '<b>' + (lead.nome || '—') + '</b><br>' + etapaAnteriorLabel + ' → <b>' + novaEtapaLabel + '</b>';

    var opcoes = resultadosDaEtapa(novaEtapa);
    var selResultado = host.querySelector('#pb2c-t-resultado');
    var wrapResultado = host.querySelector('#pb2c-t-resultado-wrap');
    if (opcoes.length) {
      wrapResultado.style.display = '';
      selResultado.innerHTML = '<option value="">Selecione...</option>' + opcoes.map(function (o) { return '<option value="' + o.id + '">' + o.nome + '</option>'; }).join('');
      selResultado.required = true;
    } else {
      wrapResultado.style.display = 'none';
      selResultado.innerHTML = '';
    }
    host.querySelector('#pb2c-t-obs').value = '';
    modalT.classList.add('op');
  }
  function fecharModalTransicao() { modalT.classList.remove('op'); ST.transicao = null; }

  async function confirmarTransicao() {
    if (!ST.transicao) return;
    var opcoes = resultadosDaEtapa(ST.transicao.novaEtapa);
    var resultadoId = host.querySelector('#pb2c-t-resultado').value || null;
    if (opcoes.length && !resultadoId) { alert('Selecione o resultado dessa movimentação.'); return; }
    var observacao = host.querySelector('#pb2c-t-obs').value.trim();
    var lead = ST.leads.find(function (x) { return x.id === ST.transicao.leadId; });
    if (!lead) { fecharModalTransicao(); return; }

    var etapaAnterior = lead.etapa;
    var novaEtapa = ST.transicao.novaEtapa;
    lead.etapa = novaEtapa;
    lead.resultadoId = resultadoId ? Number(resultadoId) : null;
    lead.movidoEm = new Date().toISOString();

    try {
      var salvo = await cdaSalvarLeadB2C(lead);
      var idx = ST.leads.findIndex(function (x) { return x.id === salvo.id; });
      ST.leads[idx] = salvo;
      await cdaSalvarHistoricoInteracao({
        leadId: salvo.id, clienteId: salvo.clienteId, etapaNova: novaEtapa, etapaAnterior: etapaAnterior,
        resultadoId: resultadoId ? Number(resultadoId) : null, observacao: observacao, criadoPor: nomeUsuarioAtual(),
        tipoInteracao: 'pipeline', canalId: salvo.canalId, responsavelId: salvo.responsavelId, campanhaId: salvo.campanhaId
      });
      fecharModalTransicao();
      render();
      if (novaEtapa === 'compra' && etapaAnterior !== 'compra') await ofertarConversao(salvo);
    } catch (err) {
      console.error(err);
      alert('Erro ao confirmar a movimentação — veja o console.');
    }
  }

  async function ofertarConversao(lead) {
    if (lead.clienteId) return;
    if (!confirm('Lead "' + lead.nome + '" chegou em Compra!\n\nDeseja criar automaticamente um cadastro de Cliente vinculado (usando nome/telefone/e-mail deste lead)?')) return;
    try {
      var novoCliente = await cdaSalvarCliente({
        id: '', nome: lead.nome, email: lead.email || '', 'telefone-celular': lead.telefone || '',
        origemDados: 'Outros', origem: 'Pipeline B2C'
      });
      lead.clienteId = novoCliente.id;
      await cdaSalvarLeadB2C(lead);
      alert('Cliente criado e vinculado com sucesso!');
    } catch (err) {
      console.error(err);
      alert('Erro ao criar cliente — veja o console.');
    }
  }

  var modal = host.querySelector('#pb2c-modal');
  function trocarAba(tab) {
    ['dados', 'historico', 'emails', 'compras', 'tarefas'].forEach(function (t) {
      var painel = host.querySelector('#pb2c-tabpanel-' + t);
      if (painel) painel.style.display = (t === tab) ? '' : 'none';
      var btn = host.querySelector('.pb2c-tab-btn[data-tab="' + t + '"]');
      if (btn) { btn.style.opacity = (t === tab) ? '1' : '.6'; btn.style.borderBottomColor = (t === tab) ? 'var(--rust,#c0392b)' : 'transparent'; }
    });
    if (tab === 'historico') carregarAbaHistorico();
    if (tab === 'emails') renderEmailsLead();
    if (tab === 'compras') carregarAbaCompras();
    if (tab === 'tarefas') abrirModalTarefas(ST.editId);
  }
  function renderEmailsLead(){
    var out=host.querySelector('#pb2c-emails-lead-lista');
    var l=ST.leads.find(function(x){return x.id===ST.editId;});
    if(!l){out.textContent='Nenhum cliente selecionado.';return;}
    if(rastreioErro){out.textContent='Consulta de e-mails indisponível: '+rastreioErro;return;}
    var registros=registrosEmailLead(l);
    out.innerHTML=registros.length?'<div style="overflow:auto"><table style="width:100%;font-size:11px"><thead><tr><th>Solicitado em</th><th>Mensagem</th><th>Tipo</th><th>Situação técnica</th><th>ID Resend</th></tr></thead><tbody>'+registros.map(function(e){return '<tr><td>'+escCom(dataCom(e.solicitado_em))+'</td><td>#'+Number(e.mensagem_id)+'</td><td>'+escCom(e.tipo_envio==='teste'?'Teste':'Oficial')+'</td><td>'+escCom(situacaoEmail(e))+'</td><td>'+escCom(e.resend_email_id||'—')+'</td></tr>';}).join('')+'</tbody></table></div>':'<p class="tmu" style="padding:10px">Aguardando envio: não existe tentativa registrada para este endereço nesta campanha.</p>';
  }
  host.querySelector('#pb2c-emails-atualizar').addEventListener('click',async function(){
    var b=this;b.disabled=true;b.textContent='Atualizando...';
    try{await atualizarRastreio();renderEmailsLead();render();}finally{b.disabled=false;b.textContent='↻ Atualizar e-mails';}
  });
    async function carregarAbaHistorico() {
    if (!ST.editId) return;
    var histBox = host.querySelector('#pb2c-m-hist');
    histBox.innerHTML = '<div class="pb2c-hist-item">Carregando...</div>';
    try {
      var hist = await cdaCarregarHistoricoPorLead(ST.editId);
      histBox.innerHTML = hist.length ? hist.map(function (h) {
        var r = statusCrmById[h.resultadoId];
        var d = new Date(h.criadoEm);
        var etapaNovaInfo = CDA_ETAPAS_B2C.find(function (e) { return e.id === h.etapaNova; });
        var etapaAnteriorInfo = h.etapaAnterior ? CDA_ETAPAS_B2C.find(function (e) { return e.id === h.etapaAnterior; }) : null;
        var labelEtapa = etapaAnteriorInfo && etapaNovaInfo ? (etapaAnteriorInfo.label + ' → ' + etapaNovaInfo.label) : (etapaNovaInfo ? etapaNovaInfo.label : (h.observacao || 'Interação'));
        return '<div class="pb2c-hist-item"><b>' + d.toLocaleDateString('pt-BR') + '</b> — ' + labelEtapa +
          (r ? ' · ' + r.nome : '') + (h.observacao ? '<br><i>' + h.observacao + '</i>' : '') +
          (h.criadoPor ? '<br><span style="color:var(--muted,#888)">por ' + h.criadoPor + '</span>' : '') + '</div>';
      }).join('') : '<div class="pb2c-hist-item">Nenhuma movimentação registrada ainda.</div>';
    } catch (err) { histBox.innerHTML = '<div class="pb2c-hist-item">Erro ao carregar histórico.</div>'; }
  }
  function carregarAbaCompras() {
    var lead = ST.editId ? ST.leads.find(function (x) { return x.id === ST.editId; }) : null;
    var lista = host.querySelector('#pb2c-c-lista');
    if (!lead || !lead.clienteId) {
      host.querySelector('#pb2c-c-resumo').innerHTML = '<span class="tmu">Este lead ainda não está vinculado a um cliente cadastrado.</span>';
      lista.innerHTML = '';
      return;
    }
    abrirHistoricoCompras(lead.clienteId);
  }
  host.querySelectorAll('.pb2c-tab-btn').forEach(function (btn) {
    btn.addEventListener('click', function () { trocarAba(btn.dataset.tab); });
  });

  function buscarClientes(termo) {
    var t = termo.trim().toLowerCase();
    if (t.length < 3) return [];
    return ST.clientes.filter(function (c) {
      return (c.nome && c.nome.toLowerCase().indexOf(t) !== -1) ||
        (c.email && c.email.toLowerCase().indexOf(t) !== -1) ||
        (c['telefone-celular'] && c['telefone-celular'].indexOf(t) !== -1) ||
        (c['telefone-principal'] && c['telefone-principal'].indexOf(t) !== -1);
    }).slice(0, 8);
  }

  // Linha com dados suficientes pra desempatar homônimos: telefone + e-mail + cidade/UF
  function linhaDesempate(c) {
    var contato = [c['telefone-celular'] || c['telefone-principal'], c.email].filter(Boolean).join(' · ') || 'sem contato cadastrado';
    var local = [c.cidade, c.estado].filter(Boolean).join('/');
    return contato + (local ? '<br>' + local : '<br><span style="color:var(--rust,#c0392b)">sem cidade/UF cadastrada</span>');
  }

  function renderResultadosBusca(lista, box) {
    if (!lista.length) { box.style.display = 'none'; return; }
    box.innerHTML = lista.map(function (c) {
      return '<div class="pb2c-busca-item" data-id="' + c.id + '"><b>' + c.nome + '</b><br><span style="color:var(--muted,#888)">' + linhaDesempate(c) + '</span></div>';
    }).join('');
    box.style.display = '';
    box.querySelectorAll('.pb2c-busca-item').forEach(function (item) {
      item.addEventListener('click', function () {
        var c = ST.clientes.find(function (x) { return String(x.id) === item.dataset.id; });
        if (c) vincularCliente(c);
      });
    });
  }

  function vincularCliente(cliente) {
    ST.clienteSelecionado = cliente;
    host.querySelector('#pb2c-m-nome').value = cliente.nome || '';
    host.querySelector('#pb2c-m-tel').value = cliente['telefone-celular'] || cliente['telefone-principal'] || '';
    host.querySelector('#pb2c-m-email').value = cliente.email || '';
    host.querySelector('#pb2c-m-nome').readOnly = true;
    host.querySelector('#pb2c-m-tel').readOnly = true;
    host.querySelector('#pb2c-m-email').readOnly = true;
    host.querySelector('#pb2c-m-busca-wrap').style.display = 'none';
    host.querySelector('#pb2c-m-vinculado-wrap').style.display = '';
    host.querySelector('#pb2c-m-vinculado-texto').textContent = '🔗 Vinculado a cliente existente: ' + cliente.nome;
    host.querySelector('#pb2c-m-aviso-duplicata').style.display = 'none';
    host.querySelector('#pb2c-m-busca-resultados').style.display = 'none';
  }
  function desvincularCliente() {
    ST.clienteSelecionado = null;
    host.querySelector('#pb2c-m-nome').readOnly = false;
    host.querySelector('#pb2c-m-tel').readOnly = false;
    host.querySelector('#pb2c-m-email').readOnly = false;
    host.querySelector('#pb2c-m-nome').value = '';
    host.querySelector('#pb2c-m-tel').value = '';
    host.querySelector('#pb2c-m-email').value = '';
    host.querySelector('#pb2c-m-busca').value = '';
    host.querySelector('#pb2c-m-busca-wrap').style.display = '';
    host.querySelector('#pb2c-m-vinculado-wrap').style.display = 'none';
  }

  host.querySelector('#pb2c-m-busca').addEventListener('input', function () {
    renderResultadosBusca(buscarClientes(this.value), host.querySelector('#pb2c-m-busca-resultados'));
  });
  host.querySelector('#pb2c-m-trocar-cliente').addEventListener('click', desvincularCliente);
  host.querySelector('#pb2c-m-nome').addEventListener('blur', function () {
    if (ST.clienteSelecionado) return;
    var nome = this.value.trim();
    var aviso = host.querySelector('#pb2c-m-aviso-duplicata');
    if (!nome) { aviso.style.display = 'none'; return; }
    var bateram = ST.clientes.filter(function (c) { return c.nome && c.nome.trim().toLowerCase() === nome.toLowerCase(); });
    if (!bateram.length) { aviso.style.display = 'none'; return; }
    if (bateram.length === 1) {
      aviso.textContent = '⚠ Já existe um cliente chamado "' + bateram[0].nome + '" — clique aqui pra vincular em vez de duplicar';
      aviso.style.display = 'block';
      aviso.onclick = function () { vincularCliente(bateram[0]); };
    } else {
      aviso.textContent = '⚠ Existem ' + bateram.length + ' clientes com esse nome — confira os dados abaixo pra escolher o certo (ou nenhum, se for pessoa nova)';
      aviso.style.display = 'block';
      aviso.onclick = null;
      host.querySelector('#pb2c-m-busca-wrap').style.display = '';
      renderResultadosBusca(bateram, host.querySelector('#pb2c-m-busca-resultados'));
    }
  });

  function renderB2BBox(cliente) {
    var wrap = host.querySelector('#pb2c-m-b2b-wrap');
    var box = host.querySelector('#pb2c-m-b2b-box');
    if (!cliente) { wrap.style.display = 'none'; return; }
    wrap.style.display = '';
    var isB2B = cliente.tipoComercial === 'canal_b2b';
    if (!editavel) {
      box.innerHTML = isB2B ? '<span>🏢 Este cliente está marcado como <b>Canal B2B</b>.</span>' : '';
      if (!isB2B) wrap.style.display = 'none';
      return;
    }
    box.innerHTML = isB2B
      ? '<span>🏢 Este cliente está marcado como <b>Canal B2B</b> — por isso não aparece mais neste funil.</span><button class="btn sm" id="pb2c-m-b2b-toggle">↩ Desmarcar B2B</button>'
      : '<span>Esse lead não é B2C? </span><button class="btn sm" id="pb2c-m-b2b-toggle">🏢 Marcar como Canal B2B</button>';
    var btn = host.querySelector('#pb2c-m-b2b-toggle');
    btn.addEventListener('click', async function () {
      var novoTipo = isB2B ? 'lead_b2c' : 'canal_b2b';
      var msg = isB2B
        ? 'Desmarcar este cliente como B2B? Ele volta a aparecer no Pipeline B2C.'
        : 'Marcar este cliente como Canal B2B? Ele vai sair do Pipeline B2C imediatamente (e futuramente aparecerá no Pipeline B2B).';
      if (!confirm(msg)) return;
      try {
        var clienteAtualizado = Object.assign({}, cliente, { tipoComercial: novoTipo });
        var salvo = await cdaSalvarCliente(clienteAtualizado);
        var idx = ST.clientes.findIndex(function (c) { return String(c.id) === String(salvo.id); });
        if (idx !== -1) ST.clientes[idx] = salvo;
        clientePorId[String(salvo.id)] = salvo;
        renderB2BBox(salvo);
        if (!isB2B) { fecharModal(); render(); } // saiu do funil B2C — fecha e atualiza o board
        else { render(); }
      } catch (err) {
        console.error(err);
        alert('Erro ao atualizar tipo comercial:\n' + ((err && (err.message || err.details || err.hint)) || 'Erro desconhecido'));
      }
    });
  }
  async function abrirModalInfo(id) {
    ST.editId = id || null;
    var l = id ? ST.leads.find(function (x) { return x.id === id; }) : null;
    host.querySelector('#pb2c-modal-title').textContent = id ? 'Editar Lead' : 'Novo Lead';
    host.querySelector('#pb2c-m-nome').value = l ? (l.nome || '') : '';
    host.querySelector('#pb2c-m-tel').value = l ? (l.telefone || '') : '';
    host.querySelector('#pb2c-m-email').value = l ? (l.email || '') : '';
    host.querySelector('#pb2c-m-msg-sugerida').textContent = l && l.mensagemSugerida ? l.mensagemSugerida : 'Nenhuma mensagem gerada ainda — clica em "Gerar/Regenerar".';
    host.querySelector('#pb2c-m-msg-final').value = l ? (l.mensagemFinalUsuario || '') : '';
    var selCanal = host.querySelector('#pb2c-m-canal');
    selCanal.innerHTML = '<option value="">—</option>' + ST.canais.slice().sort(function (a, b) { return a.nome.localeCompare(b.nome); })
      .map(function (c) { return '<option value="' + c.id + '">' + c.nome + '</option>'; }).join('');
    selCanal.value = l ? (l.canalId || '') : '';
    var campanhaDoLeadMeios = l ? campanhaPorId[l.campanhaId] : null;
    host.querySelector('#pb2c-m-meios').innerHTML = CDA_CANAIS_CAMPANHA.map(function (c) {
      return '<label><input type="checkbox" class="pb2c-meio-check" value="' + c.id + '"> ' + c.label + '</label>';
    }).join('');
    var meiosAtivos = (l && l.meiosSelecionados != null) ? l.meiosSelecionados : ((campanhaDoLeadMeios && campanhaDoLeadMeios.canaisSelecionados) || []);
    host.querySelectorAll('.pb2c-meio-check').forEach(function (chk) { chk.checked = meiosAtivos.indexOf(chk.value) !== -1; });
    var etapaAtualEl = host.querySelector('#pb2c-m-etapa-atual');
    etapaAtualEl.textContent = l ? CDA_ETAPAS_B2C.find(function (e) { return e.id === l.etapa; }).label : 'Novo Lead (ao salvar)';
    host.querySelector('#pb2c-m-valor').value = l ? (l.valorEstimado != null ? l.valorEstimado : '') : '';
    var campanhaDoLead = l ? campanhaPorId[l.campanhaId] : null;
    var equipeParaSelect = (campanhaDoLead && campanhaDoLead.responsavelIds && campanhaDoLead.responsavelIds.length)
      ? ST.equipe.filter(function (e) { return campanhaDoLead.responsavelIds.indexOf(e.id) !== -1; })
      : ST.equipe;
    host.querySelector('#pb2c-m-resp').innerHTML = '<option value="">—</option>' +
      equipeParaSelect.map(function (e) { return '<option value="' + e.id + '">' + e.nome + '</option>'; }).join('');
    host.querySelector('#pb2c-m-resp').value = l ? (l.responsavelId || '') : '';
    host.querySelector('#pb2c-m-obs').value = l ? (l.obs || '') : '';
    if (editavel) {
      host.querySelector('#pb2c-m-excluir').style.display = id ? 'inline-block' : 'none';
      host.querySelector('#pb2c-m-mover').style.display = id ? 'inline-block' : 'none';
    }
    host.querySelector('#pb2c-tabs').style.display = id ? '' : 'none';

    // Busca de cliente existente só faz sentido na criação de um lead novo
    ST.clienteSelecionado = null;
    host.querySelector('#pb2c-m-nome').readOnly = false;
    host.querySelector('#pb2c-m-tel').readOnly = false;
    host.querySelector('#pb2c-m-email').readOnly = false;
    host.querySelector('#pb2c-m-busca').value = '';
    host.querySelector('#pb2c-m-busca-resultados').style.display = 'none';
    host.querySelector('#pb2c-m-aviso-duplicata').style.display = 'none';
    if (id) {
      host.querySelector('#pb2c-m-busca-wrap').style.display = 'none';
      if (l && l.clienteId) {
        var clienteVinculado = ST.clientes.find(function (c) { return String(c.id) === String(l.clienteId); });
        host.querySelector('#pb2c-m-vinculado-wrap').style.display = clienteVinculado ? '' : 'none';
        if (clienteVinculado) { host.querySelector('#pb2c-m-vinculado-texto').textContent = '🔗 Vinculado a cliente existente: ' + clienteVinculado.nome; host.querySelector('#pb2c-m-trocar-cliente').style.display = 'none'; }
        renderB2BBox(clienteVinculado);
      } else {
        host.querySelector('#pb2c-m-vinculado-wrap').style.display = 'none';
        host.querySelector('#pb2c-m-b2b-wrap').style.display = 'none';
      }
    } else {
      host.querySelector('#pb2c-m-busca-wrap').style.display = '';
      host.querySelector('#pb2c-m-vinculado-wrap').style.display = 'none';
      host.querySelector('#pb2c-m-trocar-cliente').style.display = '';
      host.querySelector('#pb2c-m-b2b-wrap').style.display = 'none';
    }

    tarefaLeadAtual = id;
    trocarAba('dados');
    modal.classList.add('op');
  }
  function fecharModal() { modal.classList.remove('op'); }

  host.querySelector('#pb2c-m-msg-gerar').addEventListener('click', async function () {
    if (!ST.editId) { alert('Salve o lead primeiro (precisa ter sido criado) antes de gerar a mensagem.'); return; }
    var lead = ST.leads.find(function (x) { return x.id === ST.editId; });
    if (!lead) return;
    var cliente = clientePorId[lead.clienteId];
    var campanha = campanhaPorId[lead.campanhaId];
    var template = campanha
      ? String(campanha.modeloMensagemFinal || campanha.modeloMensagemSugerida || '').trim()
      : CDA_TEMPLATE_PADRAO;
    if (!template) {
      alert('Esta campanha não possui modelo de mensagem configurado. Defina o modelo na campanha antes de gerar textos.');
      return;
    }
    var dados = cdaCalcularDadosVariaveis(lead, cliente, ST.compras, canalById);
    var texto = cdaExplodirTemplate(template, dados);
    try {
      await cdaSalvarMensagensLote([{ id: lead.id, mensagemSugerida: texto }]);
      lead.mensagemSugerida = texto;
      host.querySelector('#pb2c-m-msg-sugerida').textContent = texto;
    } catch (err) {
      console.error(err);
      alert('Erro ao gerar mensagem:\n' + ((err && (err.message || err.details || err.hint)) || 'Erro desconhecido'));
    }
  });
  host.querySelector('#pb2c-m-msg-copiar').addEventListener('click', function () {
    var final = host.querySelector('#pb2c-m-msg-final').value.trim();
    var sugerida = host.querySelector('#pb2c-m-msg-sugerida').textContent;
    var texto = final || sugerida;
    if (!texto || texto.indexOf('Nenhuma mensagem') === 0) { alert('Não há mensagem pra copiar ainda.'); return; }
    navigator.clipboard.writeText(texto).then(function () { alert('Mensagem copiada!'); }).catch(function () { alert('Não foi possível copiar automaticamente — selecione e copie manualmente:\n\n' + texto); });
  });

  async function salvar() {
    var nome = host.querySelector('#pb2c-m-nome').value.trim();
    if (!nome) { alert('Informe o nome do lead.'); return; }
    var existente = ST.editId ? ST.leads.find(function (x) { return x.id === ST.editId; }) : null;
    var o = {
      id: ST.editId || '',
      nome: nome, telefone: host.querySelector('#pb2c-m-tel').value.trim(), email: host.querySelector('#pb2c-m-email').value.trim(),
      canalId: host.querySelector('#pb2c-m-canal').value || null,
      etapa: existente ? existente.etapa : 'novo_lead',
      resultadoId: existente ? existente.resultadoId : null,
      valorEstimado: parseFloat(host.querySelector('#pb2c-m-valor').value) || null,
      responsavelId: host.querySelector('#pb2c-m-resp').value ? Number(host.querySelector('#pb2c-m-resp').value) : null, obs: host.querySelector('#pb2c-m-obs').value.trim(),
      clienteId: existente ? existente.clienteId : (ST.clienteSelecionado ? String(ST.clienteSelecionado.id) : null),
      campanhaId: existente ? existente.campanhaId : null,
      motivoPerda: existente ? existente.motivoPerda : null,
      mensagemFinalUsuario: host.querySelector('#pb2c-m-msg-final').value.trim(),
      meiosSelecionados: Array.from(host.querySelectorAll('.pb2c-meio-check:checked')).map(function (c) { return c.value; }),
      movidoEm: existente ? existente.movidoEm : new Date().toISOString()
    };
    try {
      var salvo = await cdaSalvarLeadB2C(o);
      if (ST.editId) {
        var idx = ST.leads.findIndex(function (x) { return x.id === ST.editId; });
        ST.leads[idx] = salvo;
      } else {
        ST.leads.push(salvo);
        await cdaSalvarHistoricoInteracao({ leadId: salvo.id, clienteId: salvo.clienteId, etapaNova: 'novo_lead', resultadoId: null, observacao: 'Lead criado', criadoPor: nomeUsuarioAtual(), tipoInteracao: 'pipeline' });
      }
      fecharModal();
      popularFiltros();
      render();
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar — veja o console.');
    }
  }

  async function excluir() {
    if (!ST.editId) return;
    if (!confirm('Excluir este lead do funil? O histórico de interações dele também será apagado.')) return;
    try {
      await cdaExcluirLeadB2C(ST.editId);
      ST.leads = ST.leads.filter(function (x) { return x.id !== ST.editId; });
      fecharModal();
      render();
    } catch (err) {
      console.error(err);
      alert('Erro ao excluir — veja o console.');
    }
  }

  if (editavel) host.querySelector('#pb2c-btn-novo').addEventListener('click', function () { abrirModalInfo(null); });
  host.querySelector('#pb2c-m-cancelar').addEventListener('click', fecharModal);
  host.querySelector('#pb2c-modal-x').addEventListener('click', fecharModal);
  if (editavel) {
    host.querySelector('#pb2c-m-salvar').addEventListener('click', salvar);
    host.querySelector('#pb2c-m-excluir').addEventListener('click', excluir);
  }

  // ── Aba Compras (dentro do modal do Lead) ────────────────────────────
  function abrirHistoricoCompras(clienteId) {
    var cliente = ST.clientes.find(function (c) { return String(c.id) === String(clienteId); });
    var statusInfo = cliente ? statusCrmById[cliente.statusCrmId] : null;
    var comprasCliente = ST.compras.filter(function (cp) { return String(cp.clienteId) === String(clienteId); })
      .sort(function (a, b) { return (b.dataCompra || '').localeCompare(a.dataCompra || ''); });

    var totalGasto = comprasCliente.reduce(function (s, cp) { return s + (Number(cp.valorTotal) || 0); }, 0);
    var qtdPedidos = new Set(comprasCliente.map(function (cp) { return cp.numeroPedido; }).filter(Boolean)).size || comprasCliente.length;
    var ultimaData = comprasCliente[0] ? comprasCliente[0].dataCompra : null;
    var fmtDataBR = function (iso) { if (!iso) return '—'; var p = iso.split('-'); return p[2] + '/' + p[1] + '/' + p[0]; };

    host.querySelector('#pb2c-c-resumo').innerHTML =
      '<b>' + comprasCliente.length + '</b> item(ns) em <b>' + qtdPedidos + '</b> pedido(s) &nbsp;·&nbsp; ' +
      'Total gasto: <b>R$ ' + totalGasto.toLocaleString('pt-BR') + '</b> &nbsp;·&nbsp; Última compra: <b>' + fmtDataBR(ultimaData) + '</b>' +
      (statusInfo ? '<br>Status atual: <span class="pb2c-resultado-badge" style="background:' + statusInfo.cor + '">' + statusInfo.nome + '</span>' : '') +
      ((cliente && cliente.tagsComercial && cliente.tagsComercial.length) ? ' ' + cliente.tagsComercial.map(function (t) {
        var ts = ST.statusCrm.find(function (s) { return s.codigo === t; });
        return ts ? '<span class="pb2c-resultado-badge" style="background:' + ts.cor + '">' + ts.nome + '</span>' : '';
      }).join(' ') : '');

    var lista = host.querySelector('#pb2c-c-lista');
    lista.innerHTML = comprasCliente.length ? comprasCliente.map(function (cp) {
      var canal = canalById[cp.canalId];
      var prod = produtoPorId[String(cp.produtoId)];
      var nomeProd = (prod ? prod.nome : cp.produto) || 'Produto não identificado';
      return '<div class="pb2c-hist-item"><b>' + fmtDataBR(cp.dataCompra) + '</b> — ' + nomeProd +
        ' — R$ ' + Number(cp.valorTotal || 0).toLocaleString('pt-BR') +
        (canal ? ' <span style="color:var(--muted,#888)">(' + canal.nome + ')</span>' : '') + '</div>';
    }).join('') : '<div class="pb2c-hist-item">Nenhuma compra registrada.</div>';
  }
  // ── Aba Tarefas (dentro do modal do Lead) ────────────────────────────
  host.querySelector('#pb2c-tf-resp').innerHTML = '<option value="">—</option>' +
    ST.equipe.map(function (e) { return '<option value="' + e.id + '">' + e.nome + '</option>'; }).join('');

  var tarefaLeadAtual = null;
  var tarefaEditandoId = null; // null = modo criação; senão, id da tarefa sendo editada
  var PRIOR_COR_PB2C = { baixa: '#6B7280', media: '#F59E0B', alta: '#c0392b' };

  function limparFormTarefa() {
    host.querySelector('#pb2c-tf-desc').value = '';
    host.querySelector('#pb2c-tf-resp').value = '';
    host.querySelector('#pb2c-tf-prioridade').value = 'media';
    host.querySelector('#pb2c-tf-inicio').value = new Date().toISOString().slice(0, 10);
    host.querySelector('#pb2c-tf-prevista').value = '';
  }

  function abrirEdicaoTarefa(t) {
    tarefaEditandoId = t.id;
    host.querySelector('#pb2c-tf-desc').value = t.descricao || '';
    host.querySelector('#pb2c-tf-resp').value = t.responsavelId || '';
    host.querySelector('#pb2c-tf-prioridade').value = t.prioridade || 'media';
    host.querySelector('#pb2c-tf-inicio').value = t.dataInicio || '';
    host.querySelector('#pb2c-tf-prevista').value = t.dataPrevista || '';
    renderTarefasDoLead();
    host.querySelector('#pb2c-tf-desc').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function renderTarefasDoLead() {
    var lista = ST.tarefas.filter(function (t) { return t.leadId === tarefaLeadAtual; });
    var box = host.querySelector('#pb2c-tf-lista');
    box.innerHTML = lista.length ? lista.map(function (t) {
      var resp = equipePorId[t.responsavelId];
      var emEdicao = String(t.id) === String(tarefaEditandoId);
      return '<div class="pb2c-hist-item' + (emEdicao ? ' pb2c-tarefa-destaque' : '') + '"' + (editavel ? ' data-abrir-tarefa-pipeline="' + t.id + '"' : '') + ' style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;' + (editavel ? 'cursor:pointer' : '') + '">' +
        '<div><b>' + t.descricao + '</b> ' +
        '<span class="pb2c-resultado-badge" style="background:' + PRIOR_COR_PB2C[t.prioridade || 'media'] + '">' + (t.prioridade || 'media') + '</span><br>' +
        (resp ? resp.nome + ' · ' : '') + 'status: ' + (t.status || 'pendente') + (t.dataPrevista ? ' · prevista ' + t.dataPrevista.split('-').reverse().join('/') : '') +
        '</div>' +
        (editavel ? '<button class="btn sm" data-excluir-tarefa-pipeline="' + t.id + '" title="Excluir tarefa" style="flex-shrink:0">🗑</button>' : '') +
        '</div>';
    }).join('') : '<div class="pb2c-hist-item">Nenhuma tarefa registrada pra este lead ainda.</div>';
    if (!editavel) return;
    box.querySelectorAll('[data-abrir-tarefa-pipeline]').forEach(function (item) {
      item.addEventListener('click', function (ev) {
        if (ev.target.closest('[data-excluir-tarefa-pipeline]')) return;
        var t = ST.tarefas.find(function (x) { return String(x.id) === item.dataset.abrirTarefaPipeline; });
        if (t) abrirEdicaoTarefa(t);
      });
    });
    box.querySelectorAll('[data-excluir-tarefa-pipeline]').forEach(function (btn) {
      btn.addEventListener('click', async function (ev) {
        ev.stopPropagation();
        if (!confirm('Excluir esta tarefa?')) return;
        var tarefaId = btn.dataset.excluirTarefaPipeline;
        try {
          await cdaExcluirTarefa(tarefaId);
          ST.tarefas = ST.tarefas.filter(function (t) { return String(t.id) !== String(tarefaId); });
          if (String(tarefaEditandoId) === String(tarefaId)) { tarefaEditandoId = null; limparFormTarefa(); }
          renderTarefasDoLead();
        } catch (err) {
          console.error(err);
          alert('Erro ao excluir:\n' + ((err && (err.message || err.details || err.hint)) || 'Erro desconhecido'));
        }
      });
    });
    var btnSalvarTar = host.querySelector('#pb2c-tf-salvar');
    var btnCancelarEd = host.querySelector('#pb2c-tf-cancelar-edicao');
    if (tarefaEditandoId) {
      btnSalvarTar.textContent = '💾 Salvar Alterações';
      btnSalvarTar.dataset.modo = 'editando';
      btnCancelarEd.style.display = '';
    } else if (lista.length) {
      btnSalvarTar.textContent = '✓ Tarefa Criada';
      btnSalvarTar.dataset.modo = 'perguntar';
      btnCancelarEd.style.display = 'none';
    } else {
      btnSalvarTar.textContent = '💾 Criar Tarefa';
      btnSalvarTar.dataset.modo = 'criar';
      btnCancelarEd.style.display = 'none';
    }
  }
  var btnCancelarEdicao = host.querySelector('#pb2c-tf-cancelar-edicao');
  if (btnCancelarEdicao) btnCancelarEdicao.addEventListener('click', function () {
    tarefaEditandoId = null;
    limparFormTarefa();
    renderTarefasDoLead();
  });
  function abrirModalTarefas(leadId) {
    tarefaLeadAtual = leadId;
    tarefaEditandoId = null;
    var lead = ST.leads.find(function (x) { return x.id === leadId; });
    var descricaoPreenchida = '';
    if (lead) {
      var campanha = campanhaPorId[lead.campanhaId];
      var cliente = clientePorId[lead.clienteId];
      var template = (campanha && (campanha.modeloMensagemFinal || campanha.modeloMensagemSugerida)) || 'Fazer contato com {nome}.';
      var dados = cdaCalcularDadosVariaveis(lead, cliente, ST.compras, canalById);
      descricaoPreenchida = cdaExplodirTemplate(template, dados);
    }
    host.querySelector('#pb2c-tf-desc').value = descricaoPreenchida;
    host.querySelector('#pb2c-tf-resp').value = lead && lead.responsavelId ? lead.responsavelId : '';
    host.querySelector('#pb2c-tf-prioridade').value = 'media';
    var campanhaDoLeadTar = lead ? campanhaPorId[lead.campanhaId] : null;
    host.querySelector('#pb2c-tf-inicio').value = (campanhaDoLeadTar && campanhaDoLeadTar.periodoInicio) || new Date().toISOString().slice(0, 10);
    host.querySelector('#pb2c-tf-prevista').value = (campanhaDoLeadTar && campanhaDoLeadTar.periodoFim) || '';
    renderTarefasDoLead();
  }
  if (editavel) host.querySelector('#pb2c-tf-salvar').addEventListener('click', async function (ev) {
    var modo = ev.currentTarget.dataset.modo;

    if (modo === 'perguntar') {
      var lista = ST.tarefas.filter(function (t) { return t.leadId === tarefaLeadAtual; });
      if (lista.length && confirm('Já existe uma tarefa criada para este lead. Quer ir para a Tarefa Existente?')) {
        abrirEdicaoTarefa(lista[0]);
      }
      return;
    }

    var descricao = host.querySelector('#pb2c-tf-desc').value.trim();
    if (!descricao) { alert('Informe a descrição da tarefa.'); return; }
    var lead = ST.leads.find(function (x) { return x.id === tarefaLeadAtual; });
    try {
      var payload = {
        descricao: descricao, leadId: tarefaLeadAtual, clienteId: lead ? lead.clienteId : null, campanhaId: lead ? lead.campanhaId : null,
        responsavelId: host.querySelector('#pb2c-tf-resp').value ? Number(host.querySelector('#pb2c-tf-resp').value) : null,
        prioridade: host.querySelector('#pb2c-tf-prioridade').value,
        dataInicio: host.querySelector('#pb2c-tf-inicio').value || new Date().toISOString().slice(0, 10),
        dataPrevista: host.querySelector('#pb2c-tf-prevista').value || null,
        criadoPor: nomeUsuarioAtual()
      };
      if (modo === 'editando') {
        var atual = ST.tarefas.find(function (t) { return String(t.id) === String(tarefaEditandoId); });
        payload.id = tarefaEditandoId;
        payload.status = atual ? atual.status : 'pendente';
        var atualizada = await cdaSalvarTarefa(payload);
        var idx = ST.tarefas.findIndex(function (t) { return String(t.id) === String(tarefaEditandoId); });
        if (idx !== -1) ST.tarefas[idx] = atualizada;
        renderTarefasDoLead();
        alert('✓ Tarefa atualizada com êxito!');
        return;
      }
      payload.status = 'pendente';
      var nova = await cdaSalvarTarefa(payload);
      ST.tarefas.push(nova);
      alert('✓ Tarefa criada com êxito!');
      abrirEdicaoTarefa(nova); // abre a própria tarefa recém-criada, já em modo edição
    } catch (err) {
      console.error(err);
      alert('Erro ao criar tarefa:\n' + ((err && (err.message || err.details || err.hint)) || 'Erro desconhecido'));
    }
  });
  if (editavel) host.querySelector('#pb2c-m-mover').addEventListener('click', function () {
    if (!ST.editId) return;
    var lead = ST.leads.find(function (x) { return x.id === ST.editId; });
    if (!lead) return;
    var proximaEtapa = CDA_ETAPAS_B2C[Math.min(CDA_ETAPAS_B2C.findIndex(function (e) { return e.id === lead.etapa; }) + 1, CDA_ETAPAS_B2C.length - 1)].id;
    fecharModal();
    abrirModalTransicao(lead.id, proximaEtapa);
  });
  host.querySelector('#pb2c-t-cancelar').addEventListener('click', fecharModalTransicao);
  host.querySelector('#pb2c-t-x').addEventListener('click', fecharModalTransicao);
  host.querySelector('#pb2c-t-confirmar').addEventListener('click', confirmarTransicao);
  host.querySelector('#pb2c-f-campanha').addEventListener('change', function(){paginaOperacional=0;render();renderComunicacoes();});
  host.querySelector('#pb2c-f-cliente').addEventListener('input', function(){paginaOperacional=0;render();});
  host.querySelector('#pb2c-f-canal').addEventListener('change', function(){paginaOperacional=0;render();});
  host.querySelector('#pb2c-f-resp').addEventListener('change', function(){paginaOperacional=0;render();});
  host.querySelector('#pb2c-btn-export-whats').addEventListener('click', exportarLeadsWhatsApp);
  host.querySelector('#pb2c-btn-gerar-msg-filtro').addEventListener('click', async function () {
    var campanhaSelecionada=host.querySelector('#pb2c-f-campanha').value;
    if(!campanhaSelecionada || campanhaSelecionada==='__sem_campanha__'){
      alert('Selecione uma campanha específica antes de gerar textos em lote. Isso evita alterações acidentais em outras campanhas.');
      return;
    }
    var lista = getFiltro();
    if (!lista.length) { alert('Nenhum lead corresponde aos filtros atuais.'); return; }
    var semModelo = lista.filter(function (lead) {
      var c = campanhaPorId[lead.campanhaId];
      return c && !String(c.modeloMensagemFinal || c.modeloMensagemSugerida || '').trim();
    });
    if (semModelo.length) {
      alert('Geração bloqueada: ' + semModelo.length + ' lead(s) pertencem a campanhas sem modelo configurado.\n\nConfigure primeiro o modelo de cada campanha; o texto genérico não será aplicado automaticamente.');
      return;
    }
    var campanhaAtual=campanhaPorId[campanhaSelecionada];
    if (!confirm('Campanha: '+(campanhaAtual?campanhaAtual.nome:campanhaSelecionada)+
      '\n\nGerar/atualizar a mensagem sugerida de '+lista.length+
      ' lead(s) filtrado(s)?\n\nEsta ação grava textos no cadastro. NÃO envia mensagens.')) return;
    var btn = this;
    var textoOriginal = btn.textContent;
    btn.textContent = 'Gerando...'; btn.disabled = true;
    try {
      var atualizacoes = lista.map(function (lead) {
        var cliente = clientePorId[lead.clienteId];
        var campanha = campanhaPorId[lead.campanhaId];
        var template = campanha
          ? String(campanha.modeloMensagemFinal || campanha.modeloMensagemSugerida || '').trim()
          : CDA_TEMPLATE_PADRAO;
        var dados = cdaCalcularDadosVariaveis(lead, cliente, ST.compras, canalById);
        var texto = cdaExplodirTemplate(template, dados);
        return { id: lead.id, mensagemSugerida: texto };
      });
      await cdaSalvarMensagensLote(atualizacoes);
      atualizacoes.forEach(function (at) {
        var lead = ST.leads.find(function (l) { return l.id === at.id; });
        if (lead) lead.mensagemSugerida = at.mensagemSugerida;
      });
      alert('Pronto! ' + atualizacoes.length + ' mensagem(ns) gerada(s)/atualizada(s).');
    } catch (err) {
      console.error(err);
      alert('Erro ao gerar mensagens:\n' + ((err && (err.message || err.details || err.hint)) || 'Erro desconhecido'));
    } finally {
      btn.textContent = textoOriginal; btn.disabled = false;
    }
  });

  render();
}

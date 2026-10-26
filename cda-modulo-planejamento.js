// ════════════════════════════════════════════════════════════════════
// cda-modulo-planejamento.js — PROJETO 6 · Planejamento Anual
// Orçamento anual de Receitas e Despesas: Ano Anterior × Ano Exercício.
// Migrado do Manus (Sistema Orçamentário Anual, commit d0d1eadc).
//
// Banco: tabelas cda_pa_* (Supabase). Acesso via `sb` (axios com o token
// da sessão — ver index.html). Permissão: projeto 'planejamento_anual' na
// tabela equipe (ou is_admin). Exclusões/limpeza: somente admin.
//
// Fase 2: Tabela Contábil · Orçamento Anual · Orçamento Realizado.
// Fase 3 (a seguir): Provisão Prevista e painéis Previsto × Realizado.
// ════════════════════════════════════════════════════════════════════

var PA_PROJETO = 'planejamento_anual';
var PA_PAGES = {
  tabela:      {icon:'🗂', label:'Tabelas Contábeis'},
  orcamento:   {icon:'🎯', label:'Orçamento Anual'},
  realizado:   {icon:'🧾', label:'Orçamento Realizado'},
  provisao:    {icon:'🔮', label:'Provisão Prevista'},
  comparativo: {icon:'📊', label:'Comparativo Mensal', grupo:'pxr'},
  trimestral:  {icon:'📅', label:'Visão Trimestral Acumulada', grupo:'pxr'},
  anual:       {icon:'📈', label:'Visão Anual Acumulada', grupo:'pxr'},
  metas:       {icon:'🏁', label:'Comparativo de Metas', grupo:'pxr'},
  mix:         {icon:'🧩', label:'Mix de Vendas e Custo Ideal', grupo:'ae', sec:'Receitas'},
  compras:     {icon:'🛒', label:'Saldo de Compras de Produção', grupo:'ae', sec:'Receitas'},
  estrutura:   {icon:'🏛', label:'Estrutura de Custos Fixos', grupo:'ae', sec:'Despesas'},
  variaveis:   {icon:'⚖️', label:'Estrutura de Custos Variáveis', grupo:'ae', sec:'Despesas'},
  margem:      {icon:'🧮', label:'Margem por Canal', grupo:'ae', sec:'Despesas'},
  tutorial:    {icon:'📘', label:'Tutorial'}
};
var PA_GRUPOS = {pxr:{icon:'📉', label:'Previsto vs. Realizado'}, ae:{icon:'🧭', label:'Análises Estratégicas'}};
var PA_MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

// Estado da tela (filtros persistem entre páginas do módulo)
var paEstado = {
  page: 'tabela',
  grupoAberto: {pxr:false, ae:false},
  ano: new Date().getFullYear(),
  mes: null,               // definido pelo último mês realizado
  tipo: '',                // '' | RECEITAS | DESPESAS
  subcontaId: '',
  sintetico: false,
  busca: '',
  centroId: ''           // filtro por centro de custo (Tabela Contábil e Margem por Canal)
};
var paCache = {hier: null};

// ─── Utilidades ──────────────────────────────────────────────────────
function paEsc(v){return String(v===null||v===undefined?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
var paFmtBRL = new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
function paBRL(v){var n=Math.round((Number(v)||0)*100)/100;if(n===0)n=0;return paFmtBRL.format(n);}
// Valor sem o símbolo (tabelas largas; o cabeçalho avisa "valores em R$")
function paValor(v){var n=Math.round((Number(v)||0)*100)/100;if(n===0)n=0;return n.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});}
// Digitação manual: "6.500" (sem vírgula, com milhar) = 6500; demais casos como paParseValor
function paParseDigitado(raw){var t=String(raw==null?'':raw).trim().replace(/R\$\s*/gi,'').replace(/\s/g,'');if(/^\d{1,3}(\.\d{3})+$/.test(t))t=t.replace(/\./g,'');return paParseValor(t);}
function paNum(v){return Math.round((Number(v)||0)*100)/100;}
// Aceita "1.234,56", "1234.56", "R$ 1.234,56", número
function paParseValor(raw){
  if(typeof raw==='number')return raw;
  var t=String(raw==null?'':raw).trim().replace(/R\$\s*/gi,'').replace(/\s/g,'');
  if(!t)return 0;
  var n=t.indexOf(',')>=0?t.replace(/\./g,'').replace(',','.'):t;
  var f=parseFloat(n);return isNaN(f)?0:f;
}
function paValorInput(v){return (Number(v)||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});}
function paPodeLer(){return typeof canAccessProject==='function'&&canAccessProject(PA_PROJETO);}
function paPodeEditar(){return paPodeLer()&&!isReadOnly();}
function paIsAdmin(){return !!(cu&&cu.is_admin);}
function paNorm(s){return String(s||'').trim().toLowerCase().replace(/\s+/g,' ').normalize('NFD').replace(/[̀-ͯ]/g,'');}

async function paRpc(fn, body){
  var r = await axios.post(SUPABASE_URL+'/rest/v1/rpc/'+fn, body||{}, {headers: sb.headers});
  return r.data;
}
async function paUpsert(tabela, conflito, linhas){
  var h = Object.assign({}, sb.headers, {'Prefer':'resolution=merge-duplicates,return=representation'});
  var r = await axios.post(SUPABASE_URL+'/rest/v1/'+tabela+'?on_conflict='+conflito, linhas, {headers: h});
  return r.data;
}
function paErro(e, padrao){
  var m = e&&e.response&&e.response.data&&(e.response.data.message||e.response.data.hint||e.response.data.details);
  if(m&&/foreign key|violates/i.test(m))m='Este item possui lançamentos vinculados e não pode ser excluído. Inative-o.';
  if(m&&/duplicate key|unique/i.test(m))m='Já existe um cadastro com esse nome.';
  showToast(m||padrao||'Não foi possível concluir a operação','error');
  console.error('[Planejamento]', e);
}

// ─── Estilos do módulo (prefixo pa-) ─────────────────────────────────
(function paEstilos(){
  if(document.getElementById('pa-estilos'))return;
  var s=document.createElement('style');s.id='pa-estilos';
  s.textContent=[
    '.pa-filtros{display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end;margin-bottom:16px}',
    '.pa-filtros label{display:flex;flex-direction:column;gap:4px;font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--muted2)}',
    '.pa-filtros select,.pa-filtros input{background:var(--navy3);border:1px solid var(--border2);color:var(--white);border-radius:8px;padding:8px 10px;font-family:var(--ff-b);font-size:13px;min-width:120px}',
    '.pa-toggle{display:inline-flex;border:1px solid var(--border2);border-radius:8px;overflow:hidden}',
    '.pa-toggle button{background:transparent;color:var(--muted2);border:0;padding:8px 12px;font-family:var(--ff-b);font-size:12px;font-weight:600;cursor:pointer}',
    '.pa-toggle button.on{background:var(--red);color:#fff}',
    '.pa-info{font-size:12px;color:var(--muted2);margin:-6px 0 14px}',
    '.pa-info b{color:var(--gold2)}',
    '.pa-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(210px,100%),1fr));gap:12px;margin-bottom:18px}',
    '.pa-kpi{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:14px 16px}',
    '.pa-kpi .t{font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}',
    '.pa-kpi .v{font-family:var(--ff-m);font-size:18px;font-weight:500;margin-top:6px}',
    '.pa-kpi .s{font-size:11px;color:var(--muted2);margin-top:2px;font-family:var(--ff-m)}',
    '#pa-root{min-width:0;max-width:100%}',
    '.pa-tbl-wrap{overflow:auto;max-height:calc(100vh - 290px);border:1px solid var(--border);border-radius:12px;width:0;min-width:100%}',
    '.pa-prev{width:0;min-width:100%}',
    '.pa-tbl{width:100%;border-collapse:separate;border-spacing:0;font-size:12.5px}',
    '.pa-tbl th{position:sticky;top:0;z-index:2;background:var(--navy2);color:var(--muted2);font-size:10px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;padding:9px 10px;text-align:right;border-bottom:1px solid var(--border2);white-space:nowrap}',
    '.pa-tbl th:first-child{text-align:left;min-width:280px}',
    '.pa-tbl td{padding:6px 10px;border-bottom:1px solid var(--border);text-align:right;font-family:var(--ff-m);font-size:12px;white-space:nowrap}',
    '.pa-tbl td:first-child{text-align:left;font-family:var(--ff-b);font-size:12.5px;white-space:normal}',
    '.pa-tbl tr.conta td{background:rgba(255,255,255,.06);font-weight:700;font-size:12.5px}',
    '.pa-tbl tr.conta.rec td:first-child{border-left:3px solid var(--green)}',
    '.pa-tbl tr.conta.desp td:first-child{border-left:3px solid var(--red)}',
    '.pa-tbl tr.sub td{background:rgba(255,255,255,.025);font-weight:600}',
    '.pa-tbl tr.sub td:first-child{padding-left:22px}',
    '.pa-tbl tr.cc td:first-child{padding-left:40px;color:var(--muted2)}',
    '.pa-tbl tr.cc.inativo td{opacity:.45}',
    '.pa-tbl tr.total td{background:var(--navy3);font-weight:700;border-top:1px solid var(--border2)}',
    '.pa-tbl tr.resultado td{background:rgba(201,148,58,.12);font-weight:700;color:var(--gold2)}',
    '.pa-tbl tr.cc:hover td{background:rgba(255,255,255,.03)}',
    '.pa-in{width:128px;background:rgba(201,148,58,.07);border:1px solid rgba(201,148,58,.35);border-radius:6px;color:var(--white);text-align:right;font-family:var(--ff-m);font-size:12px;padding:4px 22px 4px 6px;cursor:text;background-image:url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2712%27 height=%2712%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%23c9943a%27 stroke-width=%272%27%3E%3Cpath d=%27M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z%27/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 6px center}',
    '.pa-in:hover{border-color:var(--gold)}.pa-in:focus{outline:none;border-color:var(--gold2);background-color:var(--navy3)}',
    '.pa-link{color:var(--blue);text-decoration:none;border-bottom:1px dotted var(--blue);cursor:pointer}.pa-link:hover{color:var(--white)}',
    '.pa-legenda{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;color:var(--gold2);background:rgba(201,148,58,.08);border:1px solid rgba(201,148,58,.3);border-radius:6px;padding:2px 8px}',
    '.pa-in.salvando{border-color:var(--blue)}.pa-in.ok{border-color:var(--green)}.pa-in.err{border-color:var(--red)}',
    '.pa-in-txt{width:100%;min-width:200px;text-align:left;font-family:var(--ff-b);background-color:transparent;border:1px solid transparent;padding-right:24px;background-position:right 7px center}',
    '.pa-in-txt:hover,.pa-in-txt:focus{border-color:rgba(201,148,58,.6)}',
    '.pa-btn-ico{font-size:14px!important;padding:3px 6px!important}',
    '.pa-neg{color:var(--red)}.pa-pos{color:var(--green)}.pa-mut{color:var(--muted)}',
    '.pa-acoes{display:flex;gap:6px;flex-wrap:wrap;margin-left:auto}',
    '.pa-badge{display:inline-block;font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;font-family:var(--ff-b)}',
    '.pa-sel-nat{background:var(--card2);border:1px solid var(--border);border-radius:6px;font-size:11.5px;padding:3px 6px;font-family:var(--ff-b);max-width:170px}.pa-sel-nat option{color:var(--white)}',
    '.pa-orig{font-size:10px;color:var(--muted);font-family:var(--ff-b);white-space:nowrap}.pa-orig.cad{color:var(--gold2)}',
    '.pa-alerta{background:rgba(201,148,58,.15);color:var(--gold2);border:1px solid rgba(201,148,58,.4);border-radius:6px;font-size:10px;font-weight:700;padding:1px 6px;cursor:pointer;font-family:var(--ff-b);white-space:nowrap;margin-top:2px}',
    '.pa-param{display:flex;flex-wrap:wrap;align-items:center;gap:10px 18px;background:var(--card);border:1px solid var(--border);border-radius:10px;padding:10px 14px;margin:0 0 12px;font-size:12.5px}.pa-param label{display:flex;align-items:center;gap:6px;color:var(--muted2);font-size:11.5px}',
    '.pa-param-g{display:inline-flex;align-items:center;gap:8px;padding:4px 10px;border:1px solid var(--border);border-radius:8px;font-size:11.5px;color:var(--white)}',
    '.pa-cong{background:rgba(255,255,255,.025)}',
    '.pa-reguas.pa-tbl th:first-child{min-width:155px}.pa-mini.pa-tbl td,.pa-mini.pa-tbl th{padding-left:4px;padding-right:4px}.pa-mini.pa-tbl td{font-size:10.5px}.pa-reguas th.pa-c-merc{color:#8fb3ff}.pa-reguas th.pa-c-cons{color:#e8a87c}.pa-reguas td.pa-c-cons{background:rgba(232,168,124,.05)}.pa-reguas th.pa-c-orc{color:var(--white)}.pa-base{font-weight:700;text-decoration:underline dotted rgba(201,148,58,.7);text-underline-offset:3px}.pa-c-plano{text-align:left!important;white-space:normal!important;min-width:150px;max-width:220px}.pa-mini .pa-c-plano{min-width:96px;max-width:130px}.pa-reguas td.pa-c-cons{white-space:normal;max-width:150px}.pa-mini.pa-tbl td.pa-c-cons{max-width:112px}.pa-mini.pa-tbl td:first-child{min-width:140px;max-width:165px}.pa-plano{display:flex;gap:4px;align-items:flex-start;font-size:11px;color:var(--muted2);font-family:var(--ff-b)}.pa-plano-hist{max-height:320px;overflow:auto;border:1px solid var(--border);border-radius:8px}.pa-plano-item{padding:8px 10px;border-bottom:1px solid var(--border);font-size:12.5px}.pa-h3{font-family:var(--ff-h,inherit);font-size:15px;margin:18px 0 8px;color:var(--white)}.pa-barra-res{display:flex;flex-wrap:wrap;gap:8px;align-items:center;font-size:12.5px;color:var(--muted2);margin:4px 0 12px}.pa-selo{background:rgba(201,148,58,.15);color:var(--gold2);border:0;border-radius:12px;padding:3px 10px;font-size:11.5px;cursor:pointer;font-family:inherit}.pa-modal-res{width:1000px!important;max-width:96vw}.pa-res-tbl{width:100%;border-collapse:collapse}.pa-res-tbl th{font-size:10.5px;color:var(--muted2);letter-spacing:.08em;text-transform:uppercase;text-align:right;padding:6px 10px;border-bottom:1px solid var(--border)}.pa-res-tbl th:first-child{text-align:left}.pa-res-tbl th.pa-res-r{color:var(--gold2)}.pa-res-tbl th.pa-res-m{color:#8fb3ff}.pa-res-tbl th.pa-res-d{color:var(--gold2)}.pa-res-tbl td{padding:10px;border-bottom:1px solid var(--border);text-align:right;font-size:14.5px;font-variant-numeric:tabular-nums;vertical-align:top;font-family:var(--ff-m,inherit)}.pa-res-tbl td small{display:block;color:var(--muted2);font-size:11px;margin-top:2px}.pa-res-tbl td.pa-res-l{text-align:left;font-weight:700;font-size:13.5px;font-family:inherit}.pa-res-tbl td.pa-res-l small{font-weight:400;max-width:340px;line-height:1.35;white-space:normal}.pa-res-tot td{background:rgba(255,255,255,.03)}.pa-res-concl{margin-top:14px;background:rgba(201,148,58,.1);border-left:3px solid var(--gold2);border-radius:6px;padding:11px 13px;font-size:13px;line-height:1.5}.pa-ref-grid{display:grid;gap:12px}.pa-ref-grid>div{border:1px solid var(--border);border-radius:10px;padding:12px 14px;font-size:13px}.pa-ref-grid small{display:block;color:var(--muted2);font-size:11.5px;margin:3px 0 8px}.pa-reguas th.pa-c-atual{color:var(--gold2)}.pa-reguas th.pa-c-meta{color:var(--green)}.pa-reguas td.pa-c-merc{background:rgba(74,128,255,.05)}.pa-reguas td.pa-c-atual{background:rgba(201,148,58,.05)}.pa-reguas td.pa-c-meta{background:rgba(62,201,122,.05)}',
    '.pa-chip{display:inline-block;font-size:11px;padding:2px 8px;border-radius:10px;background:var(--card2);border:1px solid var(--border);margin:1px 2px;white-space:nowrap}',
    '.pa-in-pct{width:72px!important;padding-right:18px!important}.pa-estreita .pa-in-pct{width:54px!important;padding-right:4px!important;background-image:none}.pa-estreita.pa-tbl th:first-child{min-width:170px}.pa-estreita.pa-tbl th,.pa-estreita.pa-tbl td{padding-left:5px;padding-right:5px}',
    '.pa-badge.ok{background:rgba(62,201,122,.15);color:var(--green)}.pa-badge.err{background:rgba(232,51,74,.15);color:var(--red)}.pa-badge.mut{background:var(--card2);color:var(--muted2)}',
    '.pa-modal-wide{width:860px!important}',
    '.pa-prev{max-height:340px;overflow:auto;border:1px solid var(--border);border-radius:8px;margin:12px 0}',
    '.pa-btn-ico{background:none;border:0;color:var(--muted2);cursor:pointer;font-size:13px;padding:2px 5px;border-radius:5px}',
    '.pa-btn-ico:hover{color:var(--white);background:var(--card2)}',
    '.pa-compacta th{padding:7px 8px;font-size:9.5px;line-height:1.25}.pa-compacta th:first-child{min-width:230px}',
    '.pa-compacta td{padding:4px 8px;font-size:11.5px}.pa-compacta td:first-child{font-size:12px}',
    '.pa-compacta .pa-in{width:112px;font-size:11.5px;padding:3px 20px 3px 5px;background-position:right 5px center}',
    '.pa-compacta tr.sub td:first-child{padding-left:16px}.pa-compacta tr.cc td:first-child{padding-left:28px}',
    '.pa-estreita th{padding:7px 6px}.pa-estreita td{padding:4px 6px;font-size:11px}.pa-estreita th:first-child{min-width:190px}.pa-estreita td:first-child{white-space:normal;font-size:11.5px}',
    '@media (max-width:700px){.pa-tbl th:first-child{min-width:170px}.pa-in{width:96px}.pa-filtros label{flex:1 1 140px}.pa-filtros select,.pa-filtros input{min-width:0;width:100%}.pa-acoes{margin-left:0}.pa-kpi .v{font-size:15px;overflow-wrap:anywhere}.pa-info{overflow-wrap:anywhere}}'
  ].join('\n');
  document.head.appendChild(s);
})();

// ─── Sidebar e navegação ─────────────────────────────────────────────
function paRenderSidebar(nav){
  nav.innerHTML+='<div class="sb-section">Planejamento Anual</div>';
  var feitos={};
  function item(id,recuo){
    var p=PA_PAGES[id];
    return '<div class="nav-item '+(paEstado.page===id?'active':'')+'" id="nav-pa-'+id+'" onclick="navigatePlanejamento(\''+id+'\')" style="padding-left:'+recuo+'px;font-size:11.5px'+(p.fase?';opacity:.55':'')+'" title="'+(p.fase?'Em desenvolvimento — Fase '+p.fase:'')+'"><span class="nav-icon">'+p.icon+'</span>'+p.label+'</div>';
  }
  Object.keys(PA_PAGES).forEach(function(id){
    var g=PA_PAGES[id].grupo;
    if(!g){nav.innerHTML+=item(id,32);return;}
    if(feitos[g])return;feitos[g]=1;
    var dentro=PA_PAGES[paEstado.page]&&PA_PAGES[paEstado.page].grupo===g;
    var aberto=paEstado.grupoAberto[g]||dentro;
    nav.innerHTML+='<div class="nav-item'+(dentro?' active':'')+'" id="nav-pa-grupo-'+g+'" onclick="paAlternarGrupo(\''+g+'\')" style="padding-left:32px;font-size:11.5px" role="button" aria-expanded="'+aberto+'"><span class="nav-icon">'+PA_GRUPOS[g].icon+'</span>'+PA_GRUPOS[g].label+'<span style="margin-left:auto;font-size:10px;opacity:.7">'+(aberto?'▾':'▸')+'</span></div>';
    var secAtual=null;
    if(aberto)Object.keys(PA_PAGES).forEach(function(sid){if(PA_PAGES[sid].grupo!==g)return;
      var sc=PA_PAGES[sid].sec;if(sc&&sc!==secAtual){secAtual=sc;nav.innerHTML+='<div class="pa-nav-sec" style="padding:8px 0 2px 52px;font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted2);opacity:.8">'+sc+'</div>';}
      nav.innerHTML+=item(sid,48);});
  });
}
function paAlternarGrupo(g){paEstado.grupoAberto[g]=!paEstado.grupoAberto[g];renderSidebarNav();}

async function navigatePlanejamento(page){
  if(!paPodeLer()){showToast('Seu usuário não tem acesso ao Planejamento Anual.','info');return;}
  if(!PA_PAGES[page])page='tabela';
  currentProject=PA_PROJETO;paEstado.page=page;renderSidebarNav();
  var iframeWrap=document.getElementById('financeiro-iframe-wrap');if(iframeWrap)iframeWrap.style.display='none';
  var p=PA_PAGES[page];
  document.getElementById('page-title').textContent='Planejamento Anual · '+p.label;
  var el=document.getElementById('main-content');
  var banner=isReadOnly()?'<div class="readonly-banner">👁 Modo somente leitura — você pode consultar, mas não alterar.</div>':'';
  el.innerHTML=banner+'<div class="ph"><h1>'+p.icon+' '+p.label+'</h1><p>Planejamento Anual · Receitas e Despesas</p></div><div id="pa-root"><div class="card">Carregando…</div></div>';
  if(p.fase){
    document.getElementById('pa-root').innerHTML='<div class="rec-box"><div class="rec-title">🚧 Em desenvolvimento — Fase '+p.fase+'</div><p>Este painel está sendo migrado do Manus. Enquanto isso, use o sistema antigo para esta consulta.</p></div>';
    return;
  }
  try{
    if(page==='tabela')await paTabelaContabil();
    else if(page==='orcamento')await paOrcamentoAnual();
    else if(page==='realizado')await paOrcamentoRealizado();
    else if(page==='provisao')await paProvisaoPrevista();
    else if(page==='comparativo')await paComparativoMensal();
    else if(page==='trimestral')await paVisaoTrimestral();
    else if(page==='anual')await paVisaoAnual();
    else if(page==='metas')await paComparativoMetas();
    else if(page==='estrutura')await paEstruturaCustos('fixa');
    else if(page==='variaveis')await paEstruturaCustos('variavel');
    else if(page==='mix')await paMixVendas();
    else if(page==='compras')await paSaldoCompras();
    else if(page==='margem')await paMargemCanal();
    else if(page==='tutorial')paTutorial();
  }catch(e){
    document.getElementById('pa-root').innerHTML='<div class="card">Não foi possível carregar os dados. Atualize a página e tente novamente.</div>';
    paErro(e,'Falha ao carregar o Planejamento Anual');
  }
}

// ─── Carga de dados ──────────────────────────────────────────────────
async function paCarregarHierarquia(forcar){
  if(paCache.hier&&!forcar)return paCache.hier;
  var r=await Promise.all([
    sb.get('cda_pa_conta','order=ordem,id'),
    sb.get('cda_pa_subconta','order=ordem,id'),
    sb.get('cda_pa_centro_custo','order=ordem,id')
  ]);
  var contas=r[0],subs=r[1],ccs=r[2];
  contas.forEach(function(c){c.subcontas=subs.filter(function(s){return s.conta_id===c.id;});
    c.subcontas.forEach(function(s){s.conta=c;s.centros=ccs.filter(function(x){return x.subconta_id===s.id;});s.centros.forEach(function(x){x.subconta=s;x.conta=c;});});});
  paCache.hier={contas:contas,subcontas:subs,centros:ccs};
  return paCache.hier;
}
// Realizado anual por centro (mensal 1–12 ou legado) — view cda_pa_v_realizado_anual
async function paRealizadoAnualMapa(ano){
  var rows=await sb.get('cda_pa_v_realizado_anual','ano=eq.'+ano);
  var m={};rows.forEach(function(x){m[x.centro_custo_id]=Number(x.valor_realizado)||0;});
  // _mensal = o ano tem lançamentos mês a mês (então o total vem do Orçamento Realizado e não é editável aqui)
  Object.defineProperty(m,'_mensal',{value:rows.some(function(x){return x.fonte==='mensal';}),enumerable:false});
  return m;
}
async function paAnosDisponiveis(){
  var r=await Promise.all([sb.get('cda_pa_orcamento_previsto','select=ano'),sb.get('cda_pa_realizado_mensal','select=ano')]);
  var s={};r[0].concat(r[1]).forEach(function(x){s[x.ano]=1;});
  var hoje=new Date().getFullYear();s[hoje]=1;s[hoje+1]=1;
  return Object.keys(s).map(Number).sort();
}
async function paUltimoMes(ano){
  try{return Number(await paRpc('cda_pa_ultimo_mes_realizado',{p_ano:ano}))||0;}catch(e){return 0;}
}

// ─── Filtros comuns ──────────────────────────────────────────────────
function paFiltroHTML(h, opts){
  opts=opts||{};
  var subs=h.subcontas.filter(function(s){var c=h.contas.find(function(x){return x.id===s.conta_id;});
    if(opts.centroNat&&!(s.centros||[]).some(function(x){return opts.centroNat(x.natureza||s.natureza||'fixa',c&&c.tipo);}))return false;
    return !paEstado.tipo||(c&&c.tipo===paEstado.tipo);});
  // Filtro herdado de outra tela que não existe nesta lista (ex.: centro fixo ao abrir os Variáveis) → limpa, para não esconder tudo
  if(paEstado.subcontaId&&!subs.some(function(s){return String(s.id)===String(paEstado.subcontaId);})){paEstado.subcontaId='';paEstado.centroId='';}
  var html='<div class="pa-filtros">';
  if(opts.anos)html+='<label>Ano<select onchange="paEstado.ano=+this.value;navigatePlanejamento(paEstado.page)">'+opts.anos.map(function(a){return '<option '+(a===paEstado.ano?'selected':'')+'>'+a+'</option>';}).join('')+'</select></label>';
  if(opts.mes)html+='<label>Mês<select onchange="paEstado.mes=+this.value;navigatePlanejamento(paEstado.page)">'+PA_MESES.map(function(n,i){return '<option value="'+(i+1)+'" '+(i+1===paEstado.mes?'selected':'')+'>'+n+'</option>';}).join('')+'</select></label>';
  html+='<label>Conta<select onchange="paEstado.tipo=this.value;paEstado.subcontaId=\'\';paEstado.centroId=\'\';navigatePlanejamento(paEstado.page)"><option value="">Todas</option><option value="RECEITAS" '+(paEstado.tipo==='RECEITAS'?'selected':'')+'>Receitas</option><option value="DESPESAS" '+(paEstado.tipo==='DESPESAS'?'selected':'')+'>Despesas</option></select></label>';
  html+='<label>Subconta<select onchange="paEstado.subcontaId=this.value;paEstado.centroId=\'\';navigatePlanejamento(paEstado.page)"><option value="">Todas</option>'+subs.map(function(s){return '<option value="'+s.id+'" '+(String(s.id)===String(paEstado.subcontaId)?'selected':'')+'>'+paEsc(s.nome)+'</option>';}).join('')+'</select></label>';
  if(opts.centro){
    var ccs=[];subs.forEach(function(s){if(paEstado.subcontaId&&String(s.id)!==String(paEstado.subcontaId))return;var ct=h.contas.find(function(c){return c.id===s.conta_id;})||{};(s.centros||[]).forEach(function(x){if(opts.centroNat&&!opts.centroNat(x.natureza||s.natureza||'fixa',ct.tipo))return;ccs.push({id:x.id,nome:(paEstado.subcontaId?'':s.nome+' › ')+x.nome});});});
    if(paEstado.centroId&&!ccs.some(function(x){return String(x.id)===String(paEstado.centroId);}))paEstado.centroId='';
    html+='<label>Centro de Custo<select onchange="paEstado.centroId=this.value;navigatePlanejamento(paEstado.page)" style="max-width:280px"><option value="">Todos</option>'+ccs.map(function(x){return '<option value="'+x.id+'" '+(String(x.id)===String(paEstado.centroId)?'selected':'')+'>'+paEsc(x.nome)+'</option>';}).join('')+'</select></label>';
  }
  if(opts.busca)html+='<label>Buscar<input type="search" placeholder="Nome…" value="'+paEsc(paEstado.busca)+'" onchange="paEstado.busca=this.value;navigatePlanejamento(paEstado.page)"></label>';
  html+='<div class="pa-toggle" role="group" aria-label="Modo de exibição"><button class="'+(!paEstado.sintetico?'on':'')+'" onclick="paEstado.sintetico=false;navigatePlanejamento(paEstado.page)">Analítico</button><button class="'+(paEstado.sintetico?'on':'')+'" onclick="paEstado.sintetico=true;navigatePlanejamento(paEstado.page)">Sintético</button></div>';
  if(opts.acoes)html+='<div class="pa-acoes">'+opts.acoes+'</div>';
  return html+'</div>';
}
function paContasFiltradas(h){
  return h.contas.filter(function(c){return !paEstado.tipo||c.tipo===paEstado.tipo;}).map(function(c){
    var subs=c.subcontas.filter(function(s){return !paEstado.subcontaId||String(s.id)===String(paEstado.subcontaId);});
    return {conta:c,subcontas:subs};
  }).filter(function(x){return x.subcontas.length;});
}
// Cartões (KPIs) sempre mostram o total geral; Conta/Subconta filtram só a tabela (23/10/2026)
function paGruposCartoes(h){
  var t=paEstado.tipo,sc=paEstado.subcontaId;paEstado.tipo='';paEstado.subcontaId='';
  try{return paGruposAtivos(h);}finally{paEstado.tipo=t;paEstado.subcontaId=sc;}
}
function paSoma(lista, f){return lista.reduce(function(a,x){return a+(Number(f(x))||0);},0);}

// ════════════════════════════════════════════════════════════════════
// 1) ORÇAMENTO ANUAL — Realizado (Ano Ant.) | Previsto (Exercício) |
//    Previsto (Mês) | Realizado (Exercício) | Saldo Mensal a Realizar
// ════════════════════════════════════════════════════════════════════
async function paOrcamentoAnual(){
  var ano=paEstado.ano;
  var r=await Promise.all([paCarregarHierarquia(),paAnosDisponiveis(),sb.get('cda_pa_orcamento_previsto','ano=eq.'+ano),paRealizadoAnualMapa(ano),paRealizadoAnualMapa(ano-1),paUltimoMes(ano),sb.get('cda_pa_provisao','ano=eq.'+ano)]);
  var h=r[0],anos=r[1],prevRows=r[2],realEx=r[3],realAnt=r[4],ultimo=r[5];
  var prov={};r[6].forEach(function(x){prov[x.centro_custo_id]=Number(x.valor_provisao)||0;});
  if(anos.indexOf(ano)<0){anos.push(ano);anos.sort();}
  var prev={};prevRows.forEach(function(x){prev[x.centro_custo_id]=Number(x.valor_previsto)||0;});
  var restantes=Math.max(12-ultimo,0);
  function linha(cc){
    var p=prev[cc.id]||0,re=realEx[cc.id]||0,pv=prov[cc.id]||0;
    return {ant:realAnt[cc.id]||0,prev:p,mes:p/12,real:re,saldoSem:p-re,saldoCom:p-re-pv,temProv:pv!==0};
  }
  var grupos=paContasFiltradas(h);
  var root=document.getElementById('pa-root');if(!root)return;
  var podeEd=paPodeEditar(),antEditavel=podeEd&&!realAnt._mensal;
  paEstado._anoAntMensal=!!realAnt._mensal;
  var acoes=podeEd?'<button class="btn btn-primary btn-sm" onclick="paAbrirImportacaoAnual()">⬆ Importar Excel</button>':'';
  var html=paFiltroHTML(h,{anos:anos,acoes:acoes});
  html+='<div class="pa-info">Último mês realizado em '+ano+': <b>'+(ultimo?PA_MESES[ultimo-1]:'nenhum')+'</b> · Saldo sem provisão = Previsto − Realizado · Saldo com provisão = Previsto − (Realizado + Provisão), preenchido só onde há provisão'+
    (podeEd?' · <span class="pa-legenda">✏️ campos com borda dourada são editáveis — digite e tecle Enter</span>':'')+
    (podeEd&&realAnt._mensal?' · Realizado '+(ano-1)+' vem dos lançamentos mensais (edite no Orçamento Realizado)':'')+
    ' · Realizado '+ano+' = soma dos meses (clique para abrir)</div>';

  // Totais gerais para KPIs
  var tot={RECEITAS:{ant:0,prev:0,mes:0,real:0,saldoSem:0,saldoCom:0},DESPESAS:{ant:0,prev:0,mes:0,real:0,saldoSem:0,saldoCom:0}};
  h.contas.forEach(function(c){c.subcontas.forEach(function(s){s.centros.forEach(function(cc){var l=linha(cc);['ant','prev','mes','real','saldoSem','saldoCom'].forEach(function(k){tot[c.tipo][k]+=l[k];});if(l.temProv)tot[c.tipo].temProv=true;});});});
  var resPrev=tot.RECEITAS.prev-tot.DESPESAS.prev,resReal=tot.RECEITAS.real-tot.DESPESAS.real;
  html+='<div class="pa-kpis">'+
    paKpi('Receitas '+ano,'Previsto '+paBRL(tot.RECEITAS.prev),'Realizado '+paBRL(tot.RECEITAS.real),'var(--green)')+
    paKpi('Despesas '+ano,'Previsto '+paBRL(tot.DESPESAS.prev),'Realizado '+paBRL(tot.DESPESAS.real),'var(--red)')+
    paKpi('Resultado (Receita − Despesa)','Previsto '+paBRL(resPrev),'Realizado '+paBRL(resReal),resReal>=0?'var(--blue)':'var(--red)')+
    paKpi('Realizado '+(ano-1),'Receitas '+paBRL(tot.RECEITAS.ant),'Despesas '+paBRL(tot.DESPESAS.ant),'var(--gold2)')+
  '</div>';

  html+='<div class="pa-tbl-wrap"><table class="pa-tbl pa-compacta"><thead><tr><th>Conta / Subconta / Centro de Custo</th><th>Realizado<br>'+(ano-1)+'</th><th>Previsto<br>'+ano+'</th><th>Previsto<br>Mês</th><th>Realizado<br>'+ano+'</th><th title="Previsto − Realizado">Saldo Total<br>sem Provisão</th><th title="Previsto − (Realizado + Provisão Prevista)" style="color:var(--purple)">Saldo Total<br>com Provisão</th></tr></thead><tbody>';
  var tipoAtual='';
  function corS(v){return tipoAtual?paCorSaldo(v,tipoAtual):'inherit';}
  function cels(t,campoPrev,campoAnt,campoReal){return '<td>'+(campoAnt||paBRL(t.ant))+'</td><td>'+(campoPrev||paBRL(t.prev))+'</td><td>'+paBRL(t.mes)+'</td><td>'+(campoReal||paBRL(t.real))+'</td><td style="color:'+corS(t.saldoSem)+'">'+paBRL(t.saldoSem)+'</td>'+(t.temProv?'<td style="color:'+corS(t.saldoCom)+';font-weight:600">'+paBRL(t.saldoCom)+'</td>':'<td></td>');}
  function somaCentros(lista){var t={ant:0,prev:0,mes:0,real:0,saldoSem:0,saldoCom:0},tp=false;lista.forEach(function(cc){var l=linha(cc);for(var k in t)t[k]+=l[k];if(l.temProv)tp=true;});t.temProv=tp;return t;}
  grupos.forEach(function(g){
    var c=g.conta,todosCC=[];g.subcontas.forEach(function(s){todosCC=todosCC.concat(s.centros);});
    tipoAtual=c.tipo;
    html+='<tr class="conta '+(c.tipo==='RECEITAS'?'rec':'desp')+'"><td>'+paEsc(c.nome)+'</td>'+cels(somaCentros(todosCC))+'</tr>';
    g.subcontas.forEach(function(s){
      html+='<tr class="sub"><td>'+paEsc(s.nome)+'</td>'+cels(somaCentros(s.centros))+'</tr>';
      if(paEstado.sintetico)return;
      s.centros.forEach(function(cc){
        var l=linha(cc);
        var campo=podeEd?'<input class="pa-in" inputmode="decimal" title="Editar previsto '+ano+'" aria-label="Previsto '+paEsc(cc.nome)+'" value="'+paValorInput(l.prev)+'" data-orig="'+l.prev+'" onfocus="this.select()" onkeydown="if(event.key===\'Enter\')this.blur()" onchange="paSalvarPrevisto(this,'+cc.id+','+ano+')">':null;
        var campoAnt=antEditavel?'<input class="pa-in" inputmode="decimal" title="Editar realizado '+(ano-1)+'" aria-label="Realizado ano anterior '+paEsc(cc.nome)+'" value="'+paValorInput(l.ant)+'" data-orig="'+l.ant+'" onfocus="this.select()" onkeydown="if(event.key===\'Enter\')this.blur()" onchange="paSalvarAnoAnterior(this,'+cc.id+','+(ano-1)+')">':null;
        var campoReal='<a class="pa-link" title="Abrir lançamentos mensais de '+ano+'" onclick="paEstado.mes=null;navigatePlanejamento(\'realizado\');return false;" href="#">'+paBRL(l.real)+'</a>';
        html+='<tr class="cc'+(cc.ativo?'':' inativo')+'"><td>'+paEsc(cc.nome)+(cc.ativo?'':' <span class="pa-badge mut">inativo</span>')+'</td>'+cels(l,campo,campoAnt,campoReal)+'</tr>';
      });
    });
  });
  if(!paEstado.subcontaId&&!paEstado.tipo){
    tipoAtual='RECEITAS';html+='<tr class="total"><td>Total Receitas</td>'+cels(tot.RECEITAS)+'</tr>';
    tipoAtual='DESPESAS';html+='<tr class="total"><td>Total Despesas</td>'+cels(tot.DESPESAS)+'</tr>';
    tipoAtual='';var res={};['ant','prev','mes','real','saldoSem','saldoCom'].forEach(function(k){res[k]=tot.RECEITAS[k]-tot.DESPESAS[k];});res.temProv=!!(tot.RECEITAS.temProv||tot.DESPESAS.temProv);
    html+='<tr class="resultado"><td>Resultado Líquido (Receitas − Despesas)</td>'+cels(res)+'</tr>';
  }
  html+='</tbody></table></div>';
  root.innerHTML=html;
}
function paKpiValores(txt){return paEsc(txt).replace(/-?R\$[\s\u00a0]?[\d.,]+/g,function(m){return '<span style="white-space:nowrap">'+m+'</span>';});}
function paKpi(t,v,s,cor){return '<div class="pa-kpi" style="border-top:3px solid '+cor+'"><div class="t">'+paEsc(t)+'</div><div class="v">'+paKpiValores(v)+'</div><div class="s">'+paKpiValores(s)+'</div></div>';}

async function paSalvarAnoAnterior(inp, ccId, anoAnt){
  if(!paPodeEditar())return;
  var v=paNum(paParseValor(inp.value));
  if(v===paNum(inp.dataset.orig)){inp.value=paValorInput(v);return;}
  inp.className='pa-in salvando';
  try{
    await paUpsert('cda_pa_realizado_anual_legado','ano,centro_custo_id',[{ano:anoAnt,centro_custo_id:ccId,valor_realizado:v}]);
    inp.dataset.orig=v;inp.className='pa-in ok';
    setTimeout(function(){navigatePlanejamento('orcamento');},350);
  }catch(e){inp.className='pa-in err';paErro(e,'Não foi possível salvar o realizado do ano anterior');}
}

// ─── Importação anual (layout do Manus): A Tipo | B Subconta | C Centro | D Realizado ano anterior | E Previsto
var paImpAnual=null;
function paAbrirImportacaoAnual(){
  if(!paPodeEditar())return;
  paImpAnual=null;
  var ano=paEstado.ano,antMensal=!!paEstado._anoAntMensal;
  openModal('<div class="modal-box pa-modal-wide"><div class="modal-title">⬆ Importar Orçamento Anual (Excel)</div>'+
    '<p class="pa-info" style="margin:6px 0 14px">Layout (linha 1 = cabeçalho): <b>A</b> Tipo · <b>B</b> Subconta · <b>C</b> Centro de Custo · <b>D</b> Realizado '+(ano-1)+' · <b>E</b> Previsto '+ano+'. Os centros são localizados pelo nome (ou pelos apelidos da Tabela Contábil). Linhas não encontradas são listadas e <b>não</b> são gravadas.</p>'+
    '<div class="pa-filtros"><label>Exercício<input value="'+ano+'" disabled style="width:90px"></label><label>Arquivo<input type="file" id="pa-ia-arq" accept=".xls,.xlsx"></label></div>'+
    '<div style="display:flex;gap:18px;flex-wrap:wrap;font-size:13px;margin-bottom:6px">'+
      '<label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="pa-ia-prev" checked> Gravar Previsto '+ano+' (coluna E)</label>'+
      '<label style="display:flex;gap:6px;align-items:center'+(antMensal?';opacity:.5':'')+'"><input type="checkbox" id="pa-ia-ant" '+(antMensal?'disabled':'checked')+'> Gravar Realizado '+(ano-1)+' (coluna D)'+(antMensal?' — '+(ano-1)+' já tem lançamentos mensais':'')+'</label></div>'+
    '<div id="pa-ia-res" aria-live="polite"></div>'+
    '<div class="modal-actions" style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px"><button class="btn btn-ghost" onclick="closeModal()">Fechar</button><button class="btn btn-ghost" onclick="paImpAnualPrevia()">🔍 Pré-visualizar</button><button class="btn btn-primary" id="pa-ia-ok" disabled onclick="paImpAnualConfirmar()">Gravar</button></div></div>');
}
async function paImpAnualPrevia(){
  var arq=document.getElementById('pa-ia-arq').files[0],res=document.getElementById('pa-ia-res');
  document.getElementById('pa-ia-ok').disabled=true;
  if(!arq){showToast('Escolha o arquivo Excel','info');return;}
  res.innerHTML='<div class="card">Lendo planilha…</div>';
  try{
    var r=await Promise.all([paCarregarHierarquia(),sb.get('cda_pa_alias_importacao','select=alias,centro_custo_id')]);
    var h=r[0],alias={};r[1].forEach(function(a){alias[paNorm(a.alias)]=a.centro_custo_id;});
    var porNome={};h.centros.forEach(function(c){var k=paNorm(c.nome);if(!porNome[k])porNome[k]=c;});
    var buf=await arq.arrayBuffer(),wb=XLSX.read(new Uint8Array(buf),{type:'array'});
    var raw=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,defval:''});
    var linhas=[];
    for(var i=1;i<raw.length;i++){
      var row=raw[i]||[],nome=String(row[2]==null?'':row[2]).trim();
      if(!nome||['total','totais'].indexOf(paNorm(nome))>=0)continue;
      var tipoPl=paNorm(row[0]),cc=alias[paNorm(nome)]?h.centros.find(function(c){return c.id===alias[paNorm(nome)];}):porNome[paNorm(nome)];
      var st='ok';
      if(!cc)st='nao_encontrado';
      else if(tipoPl&&((tipoPl.indexOf('receita')>=0&&cc.conta.tipo!=='RECEITAS')||(tipoPl.indexOf('despesa')>=0&&cc.conta.tipo!=='DESPESAS')))st='tipo_diferente';
      linhas.push({linha:i+1,tipo:String(row[0]||''),sub:String(row[1]||''),nome:nome,ant:paNum(paParseValor(row[3])),prev:paNum(paParseValor(row[4])),cc:cc,status:st});
    }
    // centros repetidos: soma
    var ok=linhas.filter(function(l){return l.status==='ok';}),ruins=linhas.filter(function(l){return l.status!=='ok';});
    var agreg={};ok.forEach(function(l){var a=agreg[l.cc.id]||(agreg[l.cc.id]={cc:l.cc,ant:0,prev:0});a.ant+=l.ant;a.prev+=l.prev;});
    paImpAnual={ano:paEstado.ano,itens:Object.keys(agreg).map(function(k){return agreg[k];})};
    var sPrev=paImpAnual.itens.reduce(function(a,x){return a+x.prev;},0),sAnt=paImpAnual.itens.reduce(function(a,x){return a+x.ant;},0);
    var badge=function(st){return st==='ok'?'<span class="pa-badge ok">ok</span>':st==='tipo_diferente'?'<span class="pa-badge err">tipo diferente</span>':'<span class="pa-badge err">não encontrado</span>';};
    res.innerHTML='<div style="display:flex;gap:16px;flex-wrap:wrap;font-size:12.5px;margin:6px 0"><span>Linhas: <b>'+linhas.length+'</b></span><span>Centros a gravar: <b>'+paImpAnual.itens.length+'</b></span><span>Previsto: <b>'+paBRL(sPrev)+'</b></span><span>Realizado '+(paEstado.ano-1)+': <b>'+paBRL(sAnt)+'</b></span>'+(ruins.length?'<span class="pa-neg">Ignoradas: <b>'+ruins.length+'</b></span>':'')+'</div>'+
      (ruins.length?'<div class="pa-neg" style="font-size:12.5px;margin:4px 0 8px">Não serão gravadas: '+ruins.map(function(l){return paEsc(l.nome);}).join(' · ')+'<br><span class="pa-mut">Cadastre o centro ou crie um apelido na Tabela Contábil, se quiser incluí-las.</span></div>':'')+
      '<div class="pa-prev"><table class="pa-tbl"><thead><tr><th>Linha</th><th style="text-align:left">Centro na planilha</th><th>Realizado '+(paEstado.ano-1)+'</th><th>Previsto '+paEstado.ano+'</th><th>Status</th></tr></thead><tbody>'+
      linhas.map(function(l){return '<tr><td>'+l.linha+'</td><td style="text-align:left;font-family:var(--ff-b)">'+paEsc(l.nome)+'</td><td>'+paBRL(l.ant)+'</td><td>'+paBRL(l.prev)+'</td><td>'+badge(l.status)+'</td></tr>';}).join('')+'</tbody></table></div>';
    document.getElementById('pa-ia-ok').disabled=!paImpAnual.itens.length;
  }catch(e){res.innerHTML='<div class="card">Não foi possível ler a planilha.</div>';paErro(e,'Falha na pré-visualização');}
}
async function paImpAnualConfirmar(){
  if(!paImpAnual||!paPodeEditar())return;
  var gPrev=document.getElementById('pa-ia-prev').checked,gAnt=document.getElementById('pa-ia-ant').checked&&!paEstado._anoAntMensal;
  if(!gPrev&&!gAnt){showToast('Marque o que deseja gravar','info');return;}
  var btn=document.getElementById('pa-ia-ok');btn.disabled=true;btn.textContent='Gravando…';
  try{
    if(gPrev)await paUpsert('cda_pa_orcamento_previsto','ano,centro_custo_id',paImpAnual.itens.map(function(x){return {ano:paImpAnual.ano,centro_custo_id:x.cc.id,valor_previsto:paNum(x.prev)};}));
    if(gAnt)await paUpsert('cda_pa_realizado_anual_legado','ano,centro_custo_id',paImpAnual.itens.map(function(x){return {ano:paImpAnual.ano-1,centro_custo_id:x.cc.id,valor_realizado:paNum(x.ant)};}));
    closeModal();showToast('Importação concluída — '+paImpAnual.itens.length+' centros'+(gPrev?' · Previsto '+paImpAnual.ano:'')+(gAnt?' · Realizado '+(paImpAnual.ano-1):''),'success');
    navigatePlanejamento('orcamento');
  }catch(e){btn.disabled=false;btn.textContent='Gravar';paErro(e,'Falha ao gravar a importação');}
}

async function paSalvarPrevisto(inp, ccId, ano){
  if(!paPodeEditar())return;
  var v=paNum(paParseValor(inp.value));
  if(v===paNum(inp.dataset.orig)){inp.value=paValorInput(v);return;}
  inp.className='pa-in salvando';
  try{
    await paUpsert('cda_pa_orcamento_previsto','ano,centro_custo_id',[{ano:ano,centro_custo_id:ccId,valor_previsto:v}]);
    inp.dataset.orig=v;inp.className='pa-in ok';
    setTimeout(function(){navigatePlanejamento('orcamento');},350);
  }catch(e){inp.className='pa-in err';paErro(e,'Não foi possível salvar o previsto');}
}

// ════════════════════════════════════════════════════════════════════
// 2) ORÇAMENTO REALIZADO — lançamento mensal + importação Excel
// ════════════════════════════════════════════════════════════════════
async function paOrcamentoRealizado(){
  var ano=paEstado.ano;
  var r0=await Promise.all([paCarregarHierarquia(),paAnosDisponiveis(),paUltimoMes(ano)]);
  var h=r0[0],anos=r0[1],ultimo=r0[2];
  if(anos.indexOf(ano)<0){anos.push(ano);anos.sort();}
  if(!paEstado.mes)paEstado.mes=Math.min(Math.max(ultimo,1),12);
  var mes=paEstado.mes;
  var rows=await sb.get('cda_pa_realizado_mensal','ano=eq.'+ano+'&mes=eq.'+mes);
  var val={},orig={};rows.forEach(function(x){val[x.centro_custo_id]=Number(x.valor_realizado)||0;orig[x.centro_custo_id]=x.origem;});
  var podeEd=paPodeEditar();
  var acoes=(podeEd?'<button class="btn btn-primary btn-sm" onclick="paAbrirImportacao()">⬆ Importar Excel</button>':'')+(paIsAdmin()?'<button class="btn btn-danger btn-sm" onclick="paAbrirLimpeza()">🗑 Limpar Período</button>':'');
  var html=paFiltroHTML(h,{anos:anos,mes:true,acoes:acoes});
  var totMes={RECEITAS:0,DESPESAS:0};
  h.centros.forEach(function(cc){var c=h.contas.find(function(x){return x.id===cc.subconta.conta_id;});if(c)totMes[c.tipo]+=val[cc.id]||0;});
  html+='<div class="pa-info">Último mês realizado em '+ano+': <b>'+(ultimo?PA_MESES[ultimo-1]:'nenhum')+'</b> · Exibindo: <b>'+PA_MESES[mes-1]+'/'+ano+'</b> · '+rows.length+' lançamentos'+(podeEd?' · Edite um valor e tecle Enter para salvar':'')+'</div>';
  html+='<div class="pa-kpis">'+paKpi('Receitas — '+PA_MESES[mes-1],paBRL(totMes.RECEITAS),'','var(--green)')+paKpi('Despesas — '+PA_MESES[mes-1],paBRL(totMes.DESPESAS),'','var(--red)')+paKpi('Resultado do mês',paBRL(totMes.RECEITAS-totMes.DESPESAS),'',(totMes.RECEITAS-totMes.DESPESAS)>=0?'var(--blue)':'var(--red)')+'</div>';
  html+='<div class="pa-tbl-wrap"><table class="pa-tbl"><thead><tr><th>Conta / Subconta / Centro de Custo</th><th>Realizado — '+PA_MESES[mes-1]+'/'+ano+'</th><th>Origem</th></tr></thead><tbody>';
  paContasFiltradas(h).forEach(function(g){
    var c=g.conta,todos=[];g.subcontas.forEach(function(s){todos=todos.concat(s.centros);});
    html+='<tr class="conta '+(c.tipo==='RECEITAS'?'rec':'desp')+'"><td>'+paEsc(c.nome)+'</td><td>'+paBRL(paSoma(todos,function(x){return val[x.id];}))+'</td><td></td></tr>';
    g.subcontas.forEach(function(s){
      html+='<tr class="sub"><td>'+paEsc(s.nome)+'</td><td>'+paBRL(paSoma(s.centros,function(x){return val[x.id];}))+'</td><td></td></tr>';
      if(paEstado.sintetico)return;
      s.centros.forEach(function(cc){
        var v=val[cc.id]||0;
        var cel=podeEd?'<input class="pa-in" inputmode="decimal" aria-label="Realizado '+paEsc(cc.nome)+'" value="'+paValorInput(v)+'" data-orig="'+v+'" onfocus="this.select()" onkeydown="if(event.key===\'Enter\')this.blur()" onchange="paSalvarRealizado(this,'+cc.id+','+ano+','+mes+')">':paBRL(v);
        var o=orig[cc.id];
        html+='<tr class="cc'+(cc.ativo?'':' inativo')+'"><td>'+paEsc(cc.nome)+'</td><td>'+cel+'</td><td style="font-family:var(--ff-b)">'+(o?'<span class="pa-badge mut">'+({excel:'Excel',manual:'Manual',migracao_manus:'Manus',bling:'Bling'}[o]||o)+'</span>':'')+'</td></tr>';
      });
    });
  });
  html+='</tbody></table></div>';
  document.getElementById('pa-root').innerHTML=html;
}

async function paSalvarRealizado(inp, ccId, ano, mes){
  if(!paPodeEditar())return;
  var v=paNum(paParseValor(inp.value));
  if(v===paNum(inp.dataset.orig)){inp.value=paValorInput(v);return;}
  inp.className='pa-in salvando';
  try{
    await paUpsert('cda_pa_realizado_mensal','ano,mes,centro_custo_id',[{ano:ano,mes:mes,centro_custo_id:ccId,valor_realizado:v,origem:'manual'}]);
    inp.dataset.orig=v;inp.className='pa-in ok';
    setTimeout(function(){navigatePlanejamento('realizado');},350);
  }catch(e){inp.className='pa-in err';paErro(e,'Não foi possível salvar o realizado');}
}

// ─── Importação Excel (regras do Manus, processadas no banco) ───────
var paImport=null;
function paAbrirImportacao(){
  if(!paPodeEditar())return;
  paImport=null;
  var mesOpts=PA_MESES.map(function(n,i){return '<option value="'+(i+1)+'" '+(i+1===paEstado.mes?'selected':'')+'>'+n+'</option>';}).join('');
  openModal('<div class="modal-box pa-modal-wide"><div class="modal-title">⬆ Importar Realizado do Mês (Excel)</div>'+
    '<p class="pa-info" style="margin:6px 0 14px">Cada aba <b>substitui o mês inteiro</b> da sua conta (Receitas ou Despesas) e é importada separadamente. Abas com "Receita" ou "Despesa" no nome são reconhecidas automaticamente. Formatos aceitos: <b>Centro de Custo | Valor</b> ou <b>Vendedor … Total Venda</b>. Se algum centro não for encontrado, <b>nada é gravado</b>.</p>'+
    '<div class="pa-filtros"><label>Ano<input type="number" id="pa-imp-ano" value="'+paEstado.ano+'" style="width:100px"></label><label>Mês<select id="pa-imp-mes">'+mesOpts+'</select></label>'+
    '<label>Tipo (se a aba não indicar)<select id="pa-imp-tipo"><option value="">Pela aba</option><option value="RECEITAS">Receitas</option><option value="DESPESAS">Despesas</option></select></label>'+
    '<label>Arquivo<input type="file" id="pa-imp-arq" accept=".xls,.xlsx"></label></div>'+
    '<div id="pa-imp-res" aria-live="polite"></div>'+
    '<div class="modal-actions" style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px"><button class="btn btn-ghost" onclick="closeModal();if(paImport&&paImport.blocos.some(function(x){return x.importado;}))navigatePlanejamento(\'realizado\')">Fechar</button><button class="btn btn-primary" onclick="paImportarPrevia()">🔍 Pré-visualizar</button></div></div>');
}
function paLerPlanilha(arquivo, tipoForcado){
  return new Promise(function(resolve,reject){
    var fr=new FileReader();
    fr.onload=function(ev){
      try{
        var wb=XLSX.read(new Uint8Array(ev.target.result),{type:'array'});
        var blocos={};
        wb.SheetNames.forEach(function(nome){
          var up=nome.trim().toUpperCase(),tipo=null;
          if(up.indexOf('RECEITA')>=0)tipo='RECEITAS';else if(up.indexOf('DESPESA')>=0)tipo='DESPESAS';
          else if(tipoForcado&&wb.SheetNames.length===1)tipo=tipoForcado;
          if(!tipo)return;
          if(tipoForcado&&tipo!==tipoForcado)return;
          var raw=XLSX.utils.sheet_to_json(wb.Sheets[nome],{header:1,defval:''});
          var cab=(raw[0]||[]).map(function(c){return paNorm(c);});
          var iv=cab.indexOf('vendedor'),it=cab.indexOf('total venda');if(it<0)it=cab.indexOf('total vendas');
          var vend=iv>=0&&it>=0,ic=vend?iv:0,ival=vend?it:1;
          var linhas=[];
          for(var i=1;i<raw.length;i++){var row=raw[i]||[];var n=String(row[ic]==null?'':row[ic]).trim();if(!n)continue;linhas.push({nome:n,valor:paParseValor(row[ival])});}
          if(!blocos[tipo])blocos[tipo]={tipo:tipo,abas:[],linhas:[],vendedor:vend};
          blocos[tipo].abas.push(nome);blocos[tipo].linhas=blocos[tipo].linhas.concat(linhas);blocos[tipo].vendedor=blocos[tipo].vendedor||vend;
        });
        resolve(Object.keys(blocos).map(function(k){return blocos[k];}));
      }catch(e){reject(e);}
    };
    fr.onerror=reject;fr.readAsArrayBuffer(arquivo);
  });
}
async function paImportarPrevia(){
  var arq=document.getElementById('pa-imp-arq').files[0];
  var res=document.getElementById('pa-imp-res');
  if(!arq){showToast('Escolha o arquivo Excel','info');return;}
  var ano=+document.getElementById('pa-imp-ano').value,mes=+document.getElementById('pa-imp-mes').value,tipoF=document.getElementById('pa-imp-tipo').value;
  res.innerHTML='<div class="card">Lendo planilha…</div>';
  try{
    var blocos=await paLerPlanilha(arq,tipoF);
    if(!blocos.length){res.innerHTML='<div class="card">Nenhuma aba de <b>Receita</b> ou <b>Despesa</b> encontrada. Renomeie a aba ou escolha o tipo.</div>';return;}
    var resumo=[],corpo='';
    for(var i=0;i<blocos.length;i++){
      var b=blocos[i],nomeT=b.tipo==='RECEITAS'?'Receitas':'Despesas';
      var r=await paRpc('cda_pa_importar_mes',{p_ano:ano,p_mes:mes,p_tipo:b.tipo,p_linhas:b.linhas,p_layout_vendedor:b.vendedor,p_simular:true});
      b.resultado=r;
      var ne=r.nao_encontrados||[],ot=r.de_outro_tipo||[];
      b.ok=!ne.length&&!ot.length;
      var motivo=[];if(ne.length)motivo.push(ne.length+' centro(s) não encontrado(s)');if(ot.length)motivo.push(ot.length+' centro(s) de '+(b.tipo==='RECEITAS'?'Despesas':'Receitas')+' nesta aba');
      resumo.push(b.ok?'<div class="pa-pos">✓ <b>'+nomeT+'</b> pronta para importar — '+paBRL(r.total_valor)+'</div>':'<div class="pa-neg">⛔ <b>'+nomeT+'</b> bloqueada: '+motivo.join(' e ')+'. Veja abaixo.</div>');
      var outros={};ot.forEach(function(n){outros[n]=1;});
      corpo+='<div class="card" style="margin-top:10px;'+(b.ok?'':'border-color:rgba(232,51,74,.45)')+'"><div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><div class="card-title" style="margin:0">'+(b.tipo==='RECEITAS'?'🟢 Receitas':'🔴 Despesas')+' — aba(s): '+paEsc(b.abas.join(', '))+(b.vendedor?' · layout Vendedor':'')+'</div>'+
        '<button class="btn btn-primary btn-sm" style="margin-left:auto" id="pa-imp-btn-'+i+'" '+(b.ok?'':'disabled title="Corrija os itens em vermelho e pré-visualize de novo"')+' onclick="paImportarConfirmar('+i+')">⬆ Importar '+nomeT+' ('+PA_MESES[mes-1]+')</button></div>'+
        '<div style="display:flex;gap:16px;flex-wrap:wrap;font-size:12.5px;margin:8px 0 6px"><span>Linhas: <b>'+r.linhas+'</b></span><span>Subtotais ignorados: <b>'+r.subtotais_ignorados+'</b></span><span>Total a gravar: <b>'+paBRL(r.total_valor)+'</b></span></div>'+
        (ne.length?'<div class="pa-neg" style="font-size:12.5px;margin:6px 0">❌ Centros não encontrados ('+ne.length+'): '+ne.map(paEsc).join(' · ')+'<br><span class="pa-mut">Cadastre-os na Tabela Contábil ou crie um apelido, e pré-visualize de novo.</span></div>':'')+
        (ot.length?'<div class="pa-neg" style="font-size:12.5px;margin:6px 0">❌ Centros de '+(b.tipo==='RECEITAS'?'Despesas':'Receitas')+' nesta aba de '+nomeT+': '+ot.map(paEsc).join(' · ')+'<br><span class="pa-mut">Mova a linha para a aba certa ou corrija o nome/apelido.</span></div>':'')+
        '<div class="pa-prev"><table class="pa-tbl"><thead><tr><th>Linha</th><th style="text-align:left">Nome na planilha</th><th>Valor</th><th>Status</th></tr></thead><tbody>'+
        (r.previa||[]).map(function(p){var st=p.status==='subtotal'?'<span class="pa-badge mut">subtotal</span>':p.status!=='ok'?'<span class="pa-badge err">não encontrado</span>':outros[p.nome]?'<span class="pa-badge err">outro tipo</span>':'<span class="pa-badge ok">ok</span>';
          return '<tr><td>'+p.linha+'</td><td style="text-align:left;font-family:var(--ff-b)">'+paEsc(p.nome)+'</td><td>'+paBRL(p.valor)+'</td><td>'+st+'</td></tr>';}).join('')+
        '</tbody></table></div></div>';
    }
    paImport={ano:ano,mes:mes,blocos:blocos};
    res.innerHTML='<div class="card" style="font-size:13px;line-height:1.7">'+resumo.join('')+'<div class="pa-mut" style="font-size:12px;margin-top:4px">Cada aba é importada separadamente e substitui '+PA_MESES[mes-1]+'/'+ano+' somente daquela conta.</div></div>'+corpo;
  }catch(e){res.innerHTML='<div class="card">Não foi possível ler/validar a planilha.</div>';paErro(e,'Falha na pré-visualização');}
}
async function paImportarConfirmar(i){
  if(!paImport||!paPodeEditar())return;
  var b=paImport.blocos[i];if(!b||!b.ok)return;
  var nomeT=b.tipo==='RECEITAS'?'Receitas':'Despesas';
  var btn=document.getElementById('pa-imp-btn-'+i);btn.disabled=true;btn.textContent='Importando…';
  try{
    var r=await paRpc('cda_pa_importar_mes',{p_ano:paImport.ano,p_mes:paImport.mes,p_tipo:b.tipo,p_linhas:b.linhas,p_layout_vendedor:b.vendedor,p_simular:false});
    if(!r.gravado)throw new Error('Validação falhou em '+nomeT+' — pré-visualize de novo');
    b.importado=true;btn.textContent='✓ '+nomeT+' importada';btn.className='btn btn-ghost btn-sm';
    showToast(nomeT+' de '+PA_MESES[paImport.mes-1]+'/'+paImport.ano+': '+r.gravados+' centros gravados ('+r.removidos+' lançamentos anteriores substituídos)','success');
    paEstado.ano=paImport.ano;paEstado.mes=paImport.mes;
    var pend=paImport.blocos.filter(function(x){return x.ok&&!x.importado;}).length;
    if(!pend){setTimeout(function(){closeModal();navigatePlanejamento('realizado');},900);}
  }catch(e){btn.disabled=false;btn.textContent='⬆ Importar '+nomeT;paErro(e,'Falha na importação de '+nomeT);}
}

// ─── Limpeza de período (somente admin) ─────────────────────────────
function paAbrirLimpeza(){
  if(!paIsAdmin())return;
  var h=paCache.hier;
  openModal('<div class="modal-box"><div class="modal-title">🗑 Limpar Período</div><p class="pa-info" style="margin:6px 0 14px">Remove os lançamentos realizados do mês escolhido. Esta ação não pode ser desfeita.</p>'+
    '<div class="form-group"><label class="form-label">Período</label><div style="display:flex;gap:8px"><input class="form-input" type="number" id="pa-lp-ano" value="'+paEstado.ano+'"><select class="form-input" id="pa-lp-mes">'+PA_MESES.map(function(n,i){return '<option value="'+(i+1)+'" '+(i+1===paEstado.mes?'selected':'')+'>'+n+'</option>';}).join('')+'</select></div></div>'+
    '<div class="form-group"><label class="form-label">Abrangência</label><select class="form-input" id="pa-lp-conta" onchange="paLimpezaSubs()"><option value="">Todo o período (Receitas e Despesas)</option>'+h.contas.map(function(c){return '<option value="'+c.id+'">Somente '+paEsc(c.nome)+'</option>';}).join('')+'</select></div>'+
    '<div class="form-group"><label class="form-label">Subconta (opcional)</label><select class="form-input" id="pa-lp-sub" disabled><option value="">Todas</option></select></div>'+
    '<div class="form-group"><label class="form-label">Digite LIMPAR para confirmar</label><input class="form-input" id="pa-lp-conf" autocomplete="off"></div>'+
    '<div class="modal-actions" style="display:flex;gap:8px;justify-content:flex-end"><button class="btn btn-ghost" onclick="closeModal()">Cancelar</button><button class="btn btn-danger" onclick="paLimparConfirmar()">Limpar</button></div></div>');
}
function paLimpezaSubs(){
  var cid=document.getElementById('pa-lp-conta').value,sel=document.getElementById('pa-lp-sub');
  sel.disabled=!cid;
  sel.innerHTML='<option value="">Todas</option>'+(cid?paCache.hier.subcontas.filter(function(s){return String(s.conta_id)===cid;}).map(function(s){return '<option value="'+s.id+'">'+paEsc(s.nome)+'</option>';}).join(''):'');
}
async function paLimparConfirmar(){
  if(!paIsAdmin())return;
  if(document.getElementById('pa-lp-conf').value.trim().toUpperCase()!=='LIMPAR'){showToast('Digite LIMPAR para confirmar','info');return;}
  var ano=+document.getElementById('pa-lp-ano').value,mes=+document.getElementById('pa-lp-mes').value;
  var c=document.getElementById('pa-lp-conta').value,s=document.getElementById('pa-lp-sub').value;
  try{
    var n=await paRpc('cda_pa_limpar_periodo',{p_ano:ano,p_mes:mes,p_conta_id:c?+c:null,p_subconta_id:s?+s:null});
    closeModal();showToast(n+' lançamento(s) removido(s) de '+PA_MESES[mes-1]+'/'+ano,'success');
    paEstado.ano=ano;paEstado.mes=mes;navigatePlanejamento('realizado');
  }catch(e){paErro(e,'Não foi possível limpar o período');}
}

// ════════════════════════════════════════════════════════════════════
// 3) TABELA CONTÁBIL — Conta → Subconta → Centro de Custo + apelidos
// ════════════════════════════════════════════════════════════════════
async function paTabelaContabil(){
  var h=await paCarregarHierarquia(true);
  var extra=await Promise.all([sb.get('cda_pa_alias_importacao','order=alias'),sb.get('cda_pa_valor_vigente','order=ano_inicio.desc,mes_inicio.desc'),sb.get('cda_pa_vinculo','order=id')]);
  var aliases=extra[0];paCache.vigentes=extra[1];paCache.vinculos=extra[2];
  var podeEd=paPodeEditar(),adm=paIsAdmin();
  var acoes=podeEd?'<button class="btn btn-primary btn-sm" onclick="paFormCadastro()">＋ Novo cadastro</button>':'';
  var html=paFiltroHTML(h,{busca:true,centro:true,acoes:acoes});
  html+='<div id="pa-form"></div>';
  var b=paNorm(paEstado.busca);
  var tot=h.centros.length,ativos=h.centros.filter(function(x){return x.ativo;}).length;
  html+='<div class="pa-info">'+h.contas.length+' contas · '+h.subcontas.length+' subcontas · '+tot+' centros de custo ('+ativos+' ativos)'+(podeEd?' · <b>✏️ Clique no nome</b> para renomear · <b>⏸</b> inativa / <b>▶</b> reativa · <b>🗑</b> exclui (só sem lançamentos) · <b>＋ Novo cadastro</b> inclui conta, subconta ou centro':'')+'</div>';
  html+='<div class="pa-tbl-wrap"><table class="pa-tbl"><thead><tr><th>Conta / Subconta / Centro de Custo</th><th style="text-align:center" title="Despesas: variável (acompanha a venda), fixa (estrutura) ou financeira (bancos, juros, empréstimos). O centro de custo herda da subconta, salvo exceção.">Natureza</th><th style="text-align:center" title="Valor que vale hoje (reprevisão): R$/mês para despesas fixas e financeiras e receitas recorrentes; % sobre a receita vinculada para despesas variáveis. Em branco = o sistema usa a média dos últimos 3 meses.">Vigente</th><th style="text-align:center">Situação</th><th style="text-align:center">Ações</th></tr></thead><tbody>';
  paContasFiltradas(h).forEach(function(g){
    var c=g.conta;
    if(paEstado.centroId&&!g.subcontas.some(function(s){return s.centros.some(function(x){return String(x.id)===String(paEstado.centroId);});}))return;
    html+='<tr class="conta '+(c.tipo==='RECEITAS'?'rec':'desp')+'"><td>'+paEsc(c.nome)+' <span class="pa-badge mut">'+c.tipo+'</span></td><td></td><td></td><td></td><td></td></tr>';
    g.subcontas.forEach(function(s){
      var centros=s.centros.filter(function(x){return (!b||paNorm(x.nome).indexOf(b)>=0||paNorm(s.nome).indexOf(b)>=0)&&(!paEstado.centroId||String(x.id)===String(paEstado.centroId));});
      if(b&&!centros.length&&paNorm(s.nome).indexOf(b)<0)return;
      if(paEstado.centroId&&!centros.length)return;
      html+='<tr class="sub"><td>'+(podeEd?'<input class="pa-in pa-in-txt" value="'+paEsc(s.nome)+'" data-orig="'+paEsc(s.nome)+'" aria-label="Nome da subconta" onkeydown="if(event.key===\'Enter\')this.blur()" onchange="paRenomear(this,\'cda_pa_subconta\','+s.id+')">':paEsc(s.nome))+'</td>'+
        '<td style="text-align:center">'+(c.tipo==='DESPESAS'?paCampoNatureza('cda_pa_subconta',s.id,s.natureza,null,podeEd):'')+'</td><td></td>'+
        '<td style="text-align:center">'+paBadgeAtivo(s.ativo)+'</td><td style="text-align:center">'+paAcoesLinha('cda_pa_subconta',s.id,s.ativo,podeEd,adm)+'</td></tr>';
      if(paEstado.sintetico)return;
      centros.forEach(function(x){
        html+='<tr class="cc'+(x.ativo?'':' inativo')+'"><td>'+(podeEd?'<input class="pa-in pa-in-txt" value="'+paEsc(x.nome)+'" data-orig="'+paEsc(x.nome)+'" aria-label="Nome do centro de custo" onkeydown="if(event.key===\'Enter\')this.blur()" onchange="paRenomear(this,\'cda_pa_centro_custo\','+x.id+')">':paEsc(x.nome))+'</td>'+
          '<td style="text-align:center">'+(c.tipo==='DESPESAS'?paCampoNatureza('cda_pa_centro_custo',x.id,x.natureza,s.natureza,podeEd):'')+'</td>'+
          '<td style="text-align:center">'+paCampoVigente(x,c.tipo,podeEd)+'</td>'+
          '<td style="text-align:center">'+paBadgeAtivo(x.ativo)+'</td><td style="text-align:center">'+paAcoesLinha('cda_pa_centro_custo',x.id,x.ativo,podeEd,adm)+'</td></tr>';
      });
    });
  });
  html+='</tbody></table></div>';

  html+=paSecaoVinculos(h,podeEd);
  // Apelidos de importação
  html+='<div class="card" style="margin-top:18px"><div class="card-title">🔁 Apelidos de importação</div><p class="pa-info" style="margin:4px 0 10px">Quando a planilha usa um nome diferente do cadastro, o apelido indica a qual centro de custo o valor pertence. O apelido tem prioridade sobre o nome.</p>';
  if(podeEd)html+='<div class="pa-filtros"><label>Nome na planilha<input id="pa-al-nome" placeholder="Ex.: REVENDA - SHOWROOM / SAC" style="min-width:260px"></label><label>Centro de custo<select id="pa-al-cc">'+h.centros.map(function(x){return '<option value="'+x.id+'">'+paEsc(x.subconta.nome+' › '+x.nome)+'</option>';}).join('')+'</select></label><button class="btn btn-primary btn-sm" onclick="paSalvarAlias()">＋ Adicionar</button></div>';
  html+='<div class="tbl-wrap"><table class="pa-tbl"><thead><tr><th>Nome na planilha</th><th style="text-align:left">Lança em</th><th style="text-align:center">Ações</th></tr></thead><tbody>'+
    (aliases.length?aliases.map(function(a){var cc=h.centros.find(function(x){return x.id===a.centro_custo_id;});return '<tr class="cc"><td>'+paEsc(a.alias)+'</td><td style="text-align:left;font-family:var(--ff-b)">'+paEsc(cc?cc.subconta.nome+' › '+cc.nome:'—')+'</td><td style="text-align:center">'+(podeEd?'<button class="pa-btn-ico" title="Remover apelido" onclick="paRemoverAlias('+a.id+')">🗑</button>':'—')+'</td></tr>';}).join(''):'<tr><td colspan="3" class="pa-mut">Nenhum apelido cadastrado.</td></tr>')+
    '</tbody></table></div></div>';
  document.getElementById('pa-root').innerHTML=html;
}
// ─── Natureza das despesas (variável / fixa / financeira) ───────────
var PA_NATUREZAS={variavel:'Variável',fixa:'Fixa',financeira:'Financeira'};
function paNaturezaCentro(cc){return cc.natureza||(cc.subconta&&cc.subconta.natureza)||'fixa';}
function paCampoNatureza(tabela,id,valor,herdada,podeEd){
  var cor={variavel:'var(--blue)',fixa:'var(--gold2)',financeira:'var(--purple)'};
  var efetiva=valor||herdada||'';
  if(!podeEd)return efetiva?'<span style="color:'+cor[efetiva]+';font-size:11.5px">'+PA_NATUREZAS[efetiva]+(valor||!herdada?'':' (herda)')+'</span>':'—';
  var ops=(herdada!==null?'<option value="">↳ herda: '+(PA_NATUREZAS[herdada]||'—')+'</option>':(valor?'':'<option value="">—</option>'))+
    Object.keys(PA_NATUREZAS).map(function(k){return '<option value="'+k+'" '+(k===valor?'selected':'')+'>'+PA_NATUREZAS[k]+(herdada!==null?' (exceção)':'')+'</option>';}).join('');
  return '<select class="pa-sel-nat" aria-label="Natureza" style="color:'+(cor[efetiva]||'inherit')+'" onchange="paSalvarNatureza(this,\''+tabela+'\','+id+')">'+ops+'</select>';
}
async function paSalvarNatureza(sel,tabela,id){
  if(!paPodeEditar())return;
  try{await sb.patch(tabela,id,{natureza:sel.value||null});paCache.hier=null;showToast('Natureza atualizada','success');navigatePlanejamento('tabela');}
  catch(e){showToast(paErro(e,'Não foi possível salvar a natureza.'),'error');}
}
// ─── Valor vigente (reprevisão) ─────────────────────────────────────
function paTipoVigente(cc,tipoConta){return tipoConta==='DESPESAS'&&paNaturezaCentro(cc)==='variavel'?'percentual':'valor';}
function paFmtVigente(v){var n=Number(v.valor);return v.tipo==='percentual'?n.toLocaleString('pt-BR',{maximumFractionDigits:2})+'% da receita':paBRL(n)+'/mês';}
function paMesAno(a,m){return PA_MESES_AB[m-1].toLowerCase()+'/'+String(a).slice(2);}
function paVigentesDoCentro(id){return (paCache.vigentes||[]).filter(function(v){return String(v.centro_custo_id)===String(id);});}
function paVigenteAtual(id,ano,mes){
  var hoje=new Date();ano=ano||hoje.getFullYear();mes=mes||hoje.getMonth()+1;
  return paVigentesDoCentro(id).find(function(v){return v.ano_inicio<ano||(v.ano_inicio===ano&&v.mes_inicio<=mes);})||null;
}
function paCampoVigente(cc,tipoConta,podeEd){
  var lista=paVigentesDoCentro(cc.id),atual=paVigenteAtual(cc.id),futuro=lista.length&&lista[0]!==atual?lista[0]:null;
  var txt=atual?'<span style="font-size:11.5px;white-space:nowrap">'+paFmtVigente(atual)+'</span><span style="display:block;font-size:10.5px;color:var(--muted)">desde '+paMesAno(atual.ano_inicio,atual.mes_inicio)+'</span>':'';
  if(futuro)txt+='<span style="display:block;font-size:10.5px;color:var(--gold2)">'+paMesAno(futuro.ano_inicio,futuro.mes_inicio)+': '+paFmtVigente(futuro)+'</span>';
  if(!txt)txt='<span class="pa-mut" style="font-size:11px">média 3 meses</span>';
  var botao='<button class="pa-btn-ico" title="'+(podeEd?'Cadastrar / ver histórico':'Ver histórico')+'" aria-label="Valor vigente de '+paEsc(cc.nome)+'" onclick="paAbrirVigente('+cc.id+',\''+tipoConta+'\')">'+(lista.length?'🕘':(podeEd?'＋':''))+'</button>';
  return '<div style="display:flex;align-items:center;justify-content:center;gap:6px"><div style="text-align:right">'+txt+'</div>'+(lista.length||podeEd?botao:'')+'</div>';
}
function paConfirmarMudanca(ccId,valor,mes,ano){
  paAbrirVigente(ccId,'DESPESAS');
  var f=function(id,v){var e=document.getElementById(id);if(e)e.value=v;};
  f('pa-vg-mes',mes);f('pa-vg-ano',ano);
  var tipoInput=document.getElementById('pa-vg-valor');if(tipoInput&&!/%/.test(tipoInput.parentNode.textContent))tipoInput.value=Number(valor).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  f('pa-vg-motivo','Mudança detectada em '+PA_MESES_AB[mes-1].toLowerCase()+'/'+String(ano).slice(2));
}
function paAbrirVigente(ccId,tipoConta){
  var h=paCache.hier,cc=h.centros.find(function(x){return String(x.id)===String(ccId);});if(!cc)return;
  var tipo=paTipoVigente(cc,tipoConta),podeEd=paPodeEditar(),lista=paVigentesDoCentro(ccId),atual=paVigenteAtual(ccId),hoje=new Date();
  var expl=tipo==='percentual'?'Despesa <b>variável</b>: informe o <b>% sobre a receita</b> do(s) canal(is) vinculado(s) (ex.: royalty de 10%, comissão de 15%).':
    (tipoConta==='RECEITAS'?'Receita: use só para <b>contratos recorrentes</b> — informe o <b>R$ esperado por mês</b>.':'Despesa <b>'+(PA_NATUREZAS[paNaturezaCentro(cc)]||'fixa').toLowerCase()+'</b>: informe o <b>valor mensal em R$</b> que vale a partir do mês indicado (ex.: contrato renegociado). Para despesa <b>eventual</b> (ex.: rescisão), cadastre <b>0</b> — assim ela não entra na projeção.');
  var hist=lista.length?'<div class="tbl-wrap"><table class="pa-tbl"><thead><tr><th style="text-align:left">A partir de</th><th>Valor</th><th style="text-align:left">Motivo</th><th style="text-align:left">Registro</th>'+(podeEd?'<th></th>':'')+'</tr></thead><tbody>'+
    lista.map(function(v){var st=v===atual?'<span class="pa-badge ok">vigente</span>':((v.ano_inicio>hoje.getFullYear()||(v.ano_inicio===hoje.getFullYear()&&v.mes_inicio>hoje.getMonth()+1))?'<span class="pa-badge pa-st-warn">futuro</span>':'<span class="pa-badge mut">substituído</span>');
      return '<tr class="cc"><td style="text-align:left">'+paMesAno(v.ano_inicio,v.mes_inicio)+' '+st+'</td><td>'+paFmtVigente(v)+'</td><td style="text-align:left;font-family:var(--ff-b);white-space:normal">'+paEsc(v.motivo||'—')+'</td><td style="text-align:left;font-family:var(--ff-b);font-size:11px;color:var(--muted2)">'+paEsc((v.criado_por||'').split('@')[0])+' · '+new Date(v.criado_em).toLocaleDateString('pt-BR')+'</td>'+
        (podeEd?'<td><button class="pa-btn-ico" title="Excluir este registro" onclick="paExcluirVigente('+v.id+','+ccId+',\''+tipoConta+'\')">🗑</button></td>':'')+'</tr>';}).join('')+'</tbody></table></div>':'<p class="pa-mut" style="font-size:12.5px">Nenhum valor cadastrado — o sistema usa a média dos últimos 3 meses.</p>';
  var form=podeEd?'<div class="card-title" style="margin-top:14px;font-size:13px">Novo valor</div><div class="pa-filtros">'+
    '<label>A partir de<select id="pa-vg-mes">'+PA_MESES.map(function(n,i){return '<option value="'+(i+1)+'" '+(i===hoje.getMonth()?'selected':'')+'>'+n+'</option>';}).join('')+'</select></label>'+
    '<label>Ano<input id="pa-vg-ano" inputmode="numeric" value="'+hoje.getFullYear()+'" style="width:80px"></label>'+
    '<label>'+(tipo==='percentual'?'% da receita':'R$ por mês')+'<input id="pa-vg-valor" inputmode="decimal" placeholder="'+(tipo==='percentual'?'10,0':'6.500,00')+'" style="width:120px"></label>'+
    '<label style="flex:1 1 220px">Motivo<input id="pa-vg-motivo" placeholder="Ex.: negociação interna" maxlength="200"></label></div>'+
    '<div id="pa-vg-erro" class="pa-info" style="color:var(--red);min-height:16px" aria-live="polite"></div>':'';
  openModal('<div class="modal-box pa-modal-wide"><div class="modal-title">🕘 Valor vigente — '+paEsc(cc.nome)+'</div>'+
    '<p class="pa-info" style="margin:6px 0 12px">'+expl+' O <b>Orçado</b> não é alterado: o vigente alimenta projeções, status e a base do ano seguinte. Ao cadastrar um novo valor, o anterior fica no histórico.</p>'+hist+form+
    '<div class="modal-actions" style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px"><button class="btn btn-ghost" onclick="closeModal()">Fechar</button>'+(podeEd?'<button class="btn btn-primary" onclick="paSalvarVigente('+ccId+',\''+tipo+'\',\''+tipoConta+'\')">Salvar</button>':'')+'</div></div>');
}
async function paSalvarVigente(ccId,tipo,tipoConta){
  var err=document.getElementById('pa-vg-erro');err.textContent='';
  var mes=+document.getElementById('pa-vg-mes').value,ano=+document.getElementById('pa-vg-ano').value,valor=paParseDigitado(document.getElementById('pa-vg-valor').value),motivo=document.getElementById('pa-vg-motivo').value.trim();
  if(!(ano>=2000&&ano<=2100)){err.textContent='Informe um ano válido.';return;}
  if(document.getElementById('pa-vg-valor').value.trim()===''||!(valor>=0)){err.textContent='Informe o valor (use 0 para despesa eventual, não recorrente).';return;}
  if(tipo==='percentual'&&valor>100){err.textContent='O percentual deve ficar entre 0 e 100.';return;}
  if(!motivo){err.textContent='Informe o motivo (ex.: negociação interna).';return;}
  try{
    await paUpsert('cda_pa_valor_vigente','centro_custo_id,ano_inicio,mes_inicio',[{centro_custo_id:ccId,ano_inicio:ano,mes_inicio:mes,tipo:tipo,valor:valor,motivo:motivo,criado_por:(window.cu&&cu.email)||null,criado_em:new Date().toISOString()}]);
    paCache.vigentes=await sb.get('cda_pa_valor_vigente','order=ano_inicio.desc,mes_inicio.desc');
    showToast('Valor vigente salvo','success');paAbrirVigente(ccId,tipoConta);paAtualizarCelulaVigente();
  }catch(e){err.textContent=paErro(e,'Não foi possível salvar.');}
}
async function paExcluirVigente(id,ccId,tipoConta){
  if(!confirm('Excluir este registro do histórico?'))return;
  try{await sb.del('cda_pa_valor_vigente',id);paCache.vigentes=await sb.get('cda_pa_valor_vigente','order=ano_inicio.desc,mes_inicio.desc');showToast('Registro excluído','success');paAbrirVigente(ccId,tipoConta);paAtualizarCelulaVigente();}
  catch(e){showToast(paErro(e,'Não foi possível excluir.'),'error');}
}
function paAtualizarCelulaVigente(){var y=window.scrollY,fn=paEstado.page==='tabela'?paTabelaContabil:(paEstado.page==='estrutura'?function(){return paEstruturaCustos('fixa');}:(paEstado.page==='variaveis'?function(){return paEstruturaCustos('variavel');}:null));if(fn)fn().then(function(){window.scrollTo(0,y);});}

// ─── Vínculos Receita × Despesa (despesas variáveis → canais de receita) ──
function paCanaisReceita(h){var c=h.contas.find(function(x){return x.tipo==='RECEITAS';});return c?c.subcontas.filter(function(s){return s.ativo;}):[];}
function paVinculosDe(campo,id){return (paCache.vinculos||[]).filter(function(v){return String(v[campo])===String(id);});}
function paTextoVinculos(h,lista){
  if(!lista.length)return '<span class="pa-mut">Todos os canais (rateio automático)</span>';
  var manual=lista.some(function(v){return v.pct_rateio!==null;});
  return lista.map(function(v){var s=h.subcontas.find(function(x){return String(x.id)===String(v.receita_subconta_id);});return '<span class="pa-chip">'+paEsc(s?s.nome:'?')+(manual&&v.pct_rateio!==null?' · '+String(v.pct_rateio).replace('.',',')+'%':'')+'</span>';}).join(' ')+
    (manual?'':' <span class="pa-mut" style="font-size:11px">(rateio automático pela receita)</span>');
}
function paSecaoVinculos(h,podeEd){
  var desp=h.contas.find(function(x){return x.tipo==='DESPESAS';});if(!desp)return '';
  var linhas='';
  desp.subcontas.filter(function(s){return s.ativo;}).forEach(function(s){
    var centrosVar=s.centros.filter(function(cc){return cc.ativo&&paNaturezaCentro(cc)==='variavel';});
    if(s.natureza!=='variavel'&&!centrosVar.length)return;
    var vs=paVinculosDe('despesa_subconta_id',s.id);
    linhas+='<tr class="sub"><td>'+paEsc(s.nome)+(s.natureza!=='variavel'?' <span class="pa-mut" style="font-size:11px">(só os centros variáveis)</span>':'')+'</td><td style="text-align:left;font-family:var(--ff-b);white-space:normal">'+paTextoVinculos(h,vs)+'</td><td style="text-align:center">'+(podeEd?'<button class="pa-btn-ico" title="Editar vínculo da subconta" onclick="paAbrirVinculo(\'sub\','+s.id+')">✏️</button>':'')+'</td></tr>';
    if(paEstado.sintetico)return;
    centrosVar.forEach(function(cc){
      var vc=paVinculosDe('despesa_centro_id',cc.id);
      linhas+='<tr class="cc"><td>'+paEsc(cc.nome)+'</td><td style="text-align:left;font-family:var(--ff-b);white-space:normal">'+(vc.length?paTextoVinculos(h,vc)+' <span class="pa-badge pa-st-warn">exceção</span>':'<span class="pa-mut" style="font-size:11.5px">↳ herda da subconta</span>')+'</td><td style="text-align:center">'+(podeEd?'<button class="pa-btn-ico" title="Editar vínculo do centro" onclick="paAbrirVinculo(\'cc\','+cc.id+')">✏️</button>':'')+'</td></tr>';
    });
  });
  return '<div class="card" style="margin-top:18px"><div class="card-title">🔗 Vínculos Receita × Despesa</div><p class="pa-info" style="margin:4px 0 10px">Liga cada <b>despesa variável</b> ao(s) <b>canal(is) de receita</b> que ela gera — base da futura análise de Margem por Canal. A subconta define o padrão; um centro de custo pode ter vínculo próprio (exceção). Sem vínculo = todos os canais. O rateio entre canais é automático (proporcional à receita de cada um), salvo se você informar os percentuais.</p>'+
    '<div class="tbl-wrap"><table class="pa-tbl"><thead><tr><th>Despesa variável</th><th style="text-align:left">Canais de receita vinculados</th><th style="text-align:center">Ações</th></tr></thead><tbody>'+(linhas||'<tr><td colspan="3" class="pa-mut">Nenhuma despesa variável cadastrada (defina a Natureza acima).</td></tr>')+'</tbody></table></div></div>';
}
function paAbrirVinculo(nivel,id){
  var h=paCache.hier,campo=nivel==='sub'?'despesa_subconta_id':'despesa_centro_id';
  var obj=nivel==='sub'?h.subcontas.find(function(x){return String(x.id)===String(id);}):h.centros.find(function(x){return String(x.id)===String(id);});if(!obj)return;
  var atuais=paVinculosDe(campo,id),mapa={};atuais.forEach(function(v){mapa[v.receita_subconta_id]=v;});
  var herda=nivel==='cc'?paVinculosDe('despesa_subconta_id',obj.subconta_id):null;
  var canais=paCanaisReceita(h);
  openModal('<div class="modal-box pa-modal-wide"><div class="modal-title">🔗 Vínculo — '+paEsc(obj.nome)+'</div>'+
    '<p class="pa-info" style="margin:6px 0 12px">Marque os canais de receita que esta despesa gera. Deixe os percentuais em branco para rateio automático (proporcional à receita de cada canal), ou preencha todos somando 100%.'+(nivel==='cc'?' Sem nenhum canal marcado, o centro <b>herda da subconta</b> ('+(herda.length?herda.length+' canal(is)':'todos os canais')+').':' Sem nenhum canal marcado = <b>todos os canais</b>.')+'</p>'+
    '<div class="tbl-wrap"><table class="pa-tbl"><thead><tr><th>Canal de receita</th><th style="text-align:center">Vincular</th><th>% rateio (opcional)</th></tr></thead><tbody>'+
    canais.map(function(c){var v=mapa[c.id];return '<tr class="cc"><td>'+paEsc(c.nome)+'</td><td style="text-align:center"><input type="checkbox" class="pa-vc-chk" data-id="'+c.id+'" '+(v?'checked':'')+' aria-label="Vincular '+paEsc(c.nome)+'"></td><td><input class="pa-in pa-in-pct pa-vc-pct" data-id="'+c.id+'" inputmode="decimal" value="'+(v&&v.pct_rateio!==null?String(v.pct_rateio).replace('.',','):'')+'" aria-label="% rateio '+paEsc(c.nome)+'"></td></tr>';}).join('')+
    '</tbody></table></div><div id="pa-vc-erro" class="pa-info" style="color:var(--red);min-height:16px" aria-live="polite"></div>'+
    '<div class="modal-actions" style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px"><button class="btn btn-ghost" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" onclick="paSalvarVinculo(\''+nivel+'\','+id+')">Salvar</button></div></div>');
}
async function paSalvarVinculo(nivel,id){
  var campo=nivel==='sub'?'despesa_subconta_id':'despesa_centro_id',err=document.getElementById('pa-vc-erro');err.textContent='';
  var marcados=[].slice.call(document.querySelectorAll('.pa-vc-chk')).filter(function(c){return c.checked;}).map(function(c){
    var t=document.querySelector('.pa-vc-pct[data-id="'+c.dataset.id+'"]').value.trim();return {id:+c.dataset.id,pct:t===''?null:paParseDigitado(t)};});
  var comPct=marcados.filter(function(m){return m.pct!==null;});
  if(comPct.length&&comPct.length!==marcados.length){err.textContent='Preencha o % de todos os canais marcados, ou deixe todos em branco (rateio automático).';return;}
  if(comPct.length){var soma=comPct.reduce(function(a,m){return a+m.pct;},0);if(comPct.some(function(m){return !(m.pct>0);})||Math.abs(soma-100)>0.01){err.textContent='Os percentuais devem ser maiores que zero e somar 100% (hoje: '+soma.toLocaleString('pt-BR')+'%).';return;}}
  try{
    var antigos=paVinculosDe(campo,id);
    for(var i=0;i<antigos.length;i++)await sb.del('cda_pa_vinculo',antigos[i].id);
    if(marcados.length)await sb.post('cda_pa_vinculo',marcados.map(function(m){var o={receita_subconta_id:m.id,pct_rateio:m.pct,criado_por:(window.cu&&cu.email)||null};o[campo]=id;return o;}));
    paCache.vinculos=await sb.get('cda_pa_vinculo','order=id');
    closeModal();showToast('Vínculo salvo','success');paAtualizarCelulaVigente();
  }catch(e){err.textContent=paErro(e,'Não foi possível salvar o vínculo.');}
}

function paBadgeAtivo(a){return a?'<span class="pa-badge ok">ativo</span>':'<span class="pa-badge mut">inativo</span>';}
function paAcoesLinha(tabela,id,ativo,podeEd,adm){
  if(!podeEd)return '—';
  return '<button class="pa-btn-ico" title="'+(ativo?'Inativar':'Reativar')+'" onclick="paAlternarAtivo(\''+tabela+'\','+id+','+(!ativo)+')">'+(ativo?'⏸':'▶')+'</button>'+
    (adm?'<button class="pa-btn-ico" title="Excluir (somente se não houver lançamentos)" onclick="paExcluir(\''+tabela+'\','+id+')">🗑</button>':'');
}
async function paRenomear(inp,tabela,id){
  if(!paPodeEditar())return;
  var n=inp.value.trim();
  if(!n){inp.value=inp.dataset.orig;showToast('O nome não pode ficar vazio','info');return;}
  if(n===inp.dataset.orig)return;
  inp.className='pa-in pa-in-txt salvando';
  try{await sb.patch(tabela,id,{nome:n});inp.dataset.orig=n;inp.className='pa-in pa-in-txt ok';paCache.hier=null;showToast('Nome atualizado','success');}
  catch(e){inp.className='pa-in pa-in-txt err';inp.value=inp.dataset.orig;paErro(e,'Não foi possível renomear');}
}
async function paAlternarAtivo(tabela,id,novo){
  if(!paPodeEditar())return;
  try{await sb.patch(tabela,id,{ativo:novo});paCache.hier=null;showToast(novo?'Reativado':'Inativado','success');navigatePlanejamento('tabela');}
  catch(e){paErro(e,'Não foi possível alterar a situação');}
}
async function paExcluir(tabela,id){
  if(!paIsAdmin())return;
  if(!confirm('Excluir definitivamente? Só é possível se não houver valores lançados. Caso contrário, use Inativar.'))return;
  try{await sb.del(tabela,id);paCache.hier=null;showToast('Excluído','success');navigatePlanejamento('tabela');}
  catch(e){paErro(e,'Não foi possível excluir');}
}
function paFormCadastro(){
  if(!paPodeEditar())return;
  var h=paCache.hier;
  var el=document.getElementById('pa-form');
  el.innerHTML='<div class="card" style="margin-bottom:16px"><div class="card-title">＋ Novo cadastro</div>'+
    '<div class="pa-filtros"><label>Nível<select id="pa-nv" onchange="paFormNivel()"><option value="centro">Centro de Custo</option><option value="subconta">Subconta</option><option value="conta">Conta Contábil</option></select></label>'+
    '<label id="pa-nv-conta-l">Conta<select id="pa-nv-conta" onchange="paFormNivel()">'+h.contas.map(function(c){return '<option value="'+c.id+'">'+paEsc(c.nome)+'</option>';}).join('')+'</select></label>'+
    '<label id="pa-nv-sub-l">Subconta<select id="pa-nv-sub"></select></label>'+
    '<label id="pa-nv-tipo-l" style="display:none">Tipo<select id="pa-nv-tipo"><option>RECEITAS</option><option>DESPESAS</option></select></label>'+
    '<label>Nome<input id="pa-nv-nome" maxlength="160" style="min-width:260px"></label>'+
    '<button class="btn btn-primary btn-sm" onclick="paSalvarCadastro()">Salvar</button><button class="btn btn-ghost btn-sm" onclick="document.getElementById(\'pa-form\').innerHTML=\'\'">Cancelar</button></div>'+
    '<p class="pa-info" style="margin:0">Novos centros de custo já aparecem no Orçamento Anual e no Realizado com valor zero.</p></div>';
  paFormNivel();
}
function paFormNivel(){
  var nv=document.getElementById('pa-nv').value,h=paCache.hier;
  document.getElementById('pa-nv-conta-l').style.display=nv==='conta'?'none':'';
  document.getElementById('pa-nv-sub-l').style.display=nv==='centro'?'':'none';
  document.getElementById('pa-nv-tipo-l').style.display=nv==='conta'?'':'none';
  var cid=document.getElementById('pa-nv-conta').value;
  document.getElementById('pa-nv-sub').innerHTML=h.subcontas.filter(function(s){return String(s.conta_id)===cid;}).map(function(s){return '<option value="'+s.id+'">'+paEsc(s.nome)+'</option>';}).join('');
}
async function paSalvarCadastro(){
  if(!paPodeEditar())return;
  var nv=document.getElementById('pa-nv').value,nome=document.getElementById('pa-nv-nome').value.trim();
  if(!nome){showToast('Informe o nome','info');return;}
  try{
    if(nv==='conta')await sb.post('cda_pa_conta',{nome:nome,tipo:document.getElementById('pa-nv-tipo').value,ordem:paCache.hier.contas.length+1});
    else if(nv==='subconta')await sb.post('cda_pa_subconta',{nome:nome,conta_id:+document.getElementById('pa-nv-conta').value,ordem:paCache.hier.subcontas.length+1});
    else{var sid=document.getElementById('pa-nv-sub').value;if(!sid){showToast('Escolha a subconta','info');return;}
      await sb.post('cda_pa_centro_custo',{nome:nome,subconta_id:+sid,ordem:paCache.hier.centros.length+1});}
    paCache.hier=null;showToast('Cadastro incluído','success');navigatePlanejamento('tabela');
  }catch(e){paErro(e,'Não foi possível incluir o cadastro');}
}
async function paSalvarAlias(){
  if(!paPodeEditar())return;
  var n=document.getElementById('pa-al-nome').value.trim(),cc=+document.getElementById('pa-al-cc').value;
  if(!n){showToast('Informe o nome usado na planilha','info');return;}
  try{await sb.post('cda_pa_alias_importacao',{alias:n,centro_custo_id:cc});showToast('Apelido incluído','success');navigatePlanejamento('tabela');}
  catch(e){paErro(e,'Não foi possível incluir o apelido');}
}
async function paRemoverAlias(id){
  if(!paPodeEditar())return;
  if(!confirm('Remover este apelido?'))return;
  try{await sb.del('cda_pa_alias_importacao',id);showToast('Apelido removido','success');navigatePlanejamento('tabela');}
  catch(e){paErro(e,'Não foi possível remover o apelido');}
}

// ════════════════════════════════════════════════════════════════════
// FASE 3 — Provisão Prevista e painéis Previsto vs. Realizado
// Regras do Manus (db.ts / páginas), com as decisões de out/2026:
//  • meses restantes = 12 − último mês realizado (não o calendário);
//  • painéis consideram apenas cadastros ATIVOS (como no Manus);
//  • Provisão "Auto" = Previsto − Realizado (zera o saldo).
// ════════════════════════════════════════════════════════════════════
var PA_MESES_AB = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

// Carga única do ano: previsto, realizado mês a mês, provisão e último mês
async function paDadosAno(ano){
  var r=await Promise.all([
    paCarregarHierarquia(),
    sb.get('cda_pa_orcamento_previsto','ano=eq.'+ano),
    sb.get('cda_pa_realizado_mensal','ano=eq.'+ano+'&select=mes,centro_custo_id,valor_realizado'),
    sb.get('cda_pa_provisao','ano=eq.'+ano),
    paUltimoMes(ano),
    paAnosDisponiveis()
  ]);
  var d={h:r[0],prev:{},mes:{},prov:{},ultimo:r[4],anos:r[5],maxMes:0,mesesComValor:{}};
  r[1].forEach(function(x){d.prev[x.centro_custo_id]=Number(x.valor_previsto)||0;});
  r[2].forEach(function(x){
    var c=x.centro_custo_id,m=x.mes,v=Number(x.valor_realizado)||0;
    if(!d.mes[c])d.mes[c]={};d.mes[c][m]=(d.mes[c][m]||0)+v;
    if(m>d.maxMes)d.maxMes=m;
    if(v!==0){if(!d.mesesComValor[c])d.mesesComValor[c]={};d.mesesComValor[c][m]=1;}
  });
  r[3].forEach(function(x){d.prov[x.centro_custo_id]=Number(x.valor_provisao)||0;});
  if(d.anos.indexOf(ano)<0){d.anos.push(ano);d.anos.sort();}
  d.restantes=Math.max(12-d.ultimo,0);
  return d;
}
function paRealAte(d,cc,ate){var t=0,m=d.mes[cc]||{};for(var i=1;i<=ate;i++)t+=m[i]||0;return t;}
function paSaldoMensal(d,saldo){return d.restantes>0?saldo/d.restantes:saldo;}
// Grupos apenas com cadastros ativos
function paGruposAtivos(h){
  return paContasFiltradas(h).filter(function(g){return g.conta.ativo;}).map(function(g){
    return {conta:g.conta,subcontas:g.subcontas.filter(function(s){return s.ativo;}).map(function(s){
      return {sub:s,centros:s.centros.filter(function(c){return c.ativo;})};
    }).filter(function(x){return x.centros.length;})};
  }).filter(function(g){return g.subcontas.length;});
}
function paSomaLinhas(linhas,campos){var t={};campos.forEach(function(k){t[k]=0;});linhas.forEach(function(l){campos.forEach(function(k){t[k]+=Number(l[k])||0;});});return t;}
function paCorProvisao(v){return v<0?'var(--red)':'var(--purple)';}
// Saldo: Receita falta realizar (>0) = vermelho; Despesa estourada (<0) = vermelho
function paCorSaldo(saldo,tipo){if(tipo==='RECEITAS')return saldo>0?'var(--red)':'var(--green)';return saldo>=0?'var(--green)':'var(--red)';}
function paCelula(v,cor,peso){return '<td style="'+(cor?'color:'+cor+';':'')+(peso?'font-weight:'+peso+';':'')+'">'+v+'</td>';}
function paInfoUltimo(d,ano,extra){return '<div class="pa-info">Último mês realizado em '+ano+': <b>'+(d.ultimo?PA_MESES[d.ultimo-1]:'nenhum')+'</b> · Meses restantes: <b>'+d.restantes+'</b>'+(extra?' · '+extra:'')+'</div>';}
function paBadgeStatus(st){
  var c={'OK':'ok','Dentro':'ok','Atenção':'warn','Crítico':'err','Fora de controle':'err','Acima':'err','Intervenção':'int','Sem Dados':'mut','—':'mut'}[st]||'mut';
  return '<span class="pa-badge pa-st-'+c+'">'+st+'</span>';
}
(function(){var s=document.getElementById('pa-estilos');if(s)s.textContent+='\n.pa-badge.pa-st-ok{background:rgba(62,201,122,.15);color:var(--green)}.pa-badge.pa-st-warn{background:rgba(201,148,58,.18);color:var(--gold2)}.pa-badge.pa-st-err{background:rgba(232,51,74,.15);color:var(--red)}.pa-badge.pa-st-int{background:#4c0519;color:#fecdd3;border:1px solid #be123c}.pa-badge.pa-st-mut{background:var(--card2);color:var(--muted2)}\n.pa-bar{display:inline-block;width:70px;height:6px;border-radius:3px;background:var(--card2);vertical-align:middle;margin-left:8px;overflow:hidden}.pa-bar i{display:block;height:100%;border-radius:3px}\n.pa-btn-auto{background:rgba(155,114,207,.15);color:var(--purple);border:1px solid rgba(155,114,207,.35);border-radius:6px;font-size:10.5px;font-weight:700;padding:3px 8px;cursor:pointer;font-family:var(--ff-b);white-space:nowrap}.pa-btn-auto:hover{background:rgba(155,114,207,.28)}\n.pa-in.prov{color:var(--purple)}.pa-in.prov.neg{color:var(--red)}\n.pa-tut h3{font-family:var(--ff-d);font-size:16px;margin:18px 0 6px}.pa-tut p,.pa-tut li{font-size:13px;color:var(--muted2);line-height:1.6}.pa-tut ul{padding-left:20px}.pa-tut b{color:var(--white)}.pa-tut code{font-family:var(--ff-m);font-size:12px;background:var(--card2);padding:1px 6px;border-radius:4px;color:var(--gold2)}';})();

// Bloco de KPIs comum (Receitas, Despesas, Resultado)
function paKpisPrevReal(tot,rotReal){
  var res={prev:tot.RECEITAS.prev-tot.DESPESAS.prev,real:tot.RECEITAS.real-tot.DESPESAS.real};
  return '<div class="pa-kpis">'+
    paKpi('Total Receitas','Previsto '+paBRL(tot.RECEITAS.prev),(rotReal||'Realizado')+' '+paBRL(tot.RECEITAS.real),'var(--green)')+
    paKpi('Total Despesas','Previsto '+paBRL(tot.DESPESAS.prev),(rotReal||'Realizado')+' '+paBRL(tot.DESPESAS.real),'var(--red)')+
    paKpi('Resultado (Receita − Despesa)','Previsto '+paBRL(res.prev),(rotReal||'Realizado')+' '+paBRL(res.real),res.real>=0?'var(--blue)':'var(--red)')+
  '</div>';
}

// Renderizador genérico de tabela hierárquica (conta/subconta/centro)
// cfg: {cols:[{t,title?}], linha(cc,tipo)->obj, celulas(obj,tipo,nivel)->html, campos:[...] para somar, extraSub?, extraConta?}
function paTabelaHier(d,cfg){
  var html='<div class="pa-tbl-wrap"><table class="pa-tbl'+(cfg.classe?' '+cfg.classe:'')+'"><thead><tr><th>Conta / Subconta / Centro de Custo</th>'+cfg.cols.map(function(c){return '<th'+(c.title?' title="'+paEsc(c.title)+'"':'')+(c.cor?' style="color:'+c.cor+'"':'')+'>'+c.t+'</th>';}).join('')+'</tr></thead><tbody>';
  var totTipo={};
  paGruposAtivos(d.h).forEach(function(g){
    var c=g.conta,linhasConta=[];
    var blocoSubs='';
    g.subcontas.forEach(function(gs){
      var linhas=gs.centros.map(function(cc){var o=cfg.linha(cc,c.tipo);o._cc=cc;return o;});
      linhasConta=linhasConta.concat(linhas);
      var ts=cfg.agregar?cfg.agregar(linhas,c.tipo):paSomaLinhas(linhas,cfg.campos);
      blocoSubs+='<tr class="sub"><td>'+paEsc(gs.sub.nome)+(cfg.extraSub?cfg.extraSub(gs,linhas):'')+'</td>'+cfg.celulas(ts,c.tipo,'sub')+'</tr>';
      if(!paEstado.sintetico&&(!cfg.filtroLinha||true))linhas.forEach(function(l){if(cfg.filtroLinha&&!cfg.filtroLinha(l,c.tipo))return;blocoSubs+='<tr class="cc"><td>'+paEsc(l._cc.nome)+'</td>'+cfg.celulas(l,c.tipo,'cc')+'</tr>';});
    });
    var tc=cfg.agregar?cfg.agregar(linhasConta,c.tipo):paSomaLinhas(linhasConta,cfg.campos);
    totTipo[c.tipo]=(totTipo[c.tipo]||[]).concat(linhasConta);
    html+='<tr class="conta '+(c.tipo==='RECEITAS'?'rec':'desp')+'"><td>'+paEsc(c.nome)+(cfg.extraConta?cfg.extraConta(g,linhasConta):'')+'</td>'+cfg.celulas(tc,c.tipo,'conta')+'</tr>'+blocoSubs;
  });
  if(!paEstado.tipo&&!paEstado.subcontaId&&cfg.resultado){
    var r=cfg.resultado(totTipo.RECEITAS||[],totTipo.DESPESAS||[]);if(r)html+=r;
  }
  return html+'</tbody></table></div>';
}

// ─── 4) PROVISÃO PREVISTA ────────────────────────────────────────────
async function paProvisaoPrevista(){
  var ano=paEstado.ano,d=await paDadosAno(ano),podeEd=paPodeEditar();
  var html=paFiltroHTML(d.h,{anos:d.anos});
  html+=paInfoUltimo(d,ano,'Saldo Total = Previsto − (Realizado + Provisão)'+(podeEd?' · <b>Auto</b> grava Provisão = Previsto − Realizado':''));
  function linha(cc){var p=d.prev[cc.id]||0,re=paRealAte(d,cc.id,12),pv=d.prov[cc.id]||0,sal=p-re-pv;return {prev:p,real:re,saldo:sal,saldoMes:paSaldoMensal(d,sal),prov:pv,auto:p-re};}
  var tot={RECEITAS:{prev:0,real:0},DESPESAS:{prev:0,real:0}},totProv={RECEITAS:0,DESPESAS:0};
  paGruposCartoes(d.h).forEach(function(g){g.subcontas.forEach(function(s){s.centros.forEach(function(cc){var l=linha(cc);tot[g.conta.tipo].prev+=l.prev;tot[g.conta.tipo].real+=l.real;totProv[g.conta.tipo]+=l.prov;});});});
  html+='<div class="pa-kpis">'+paKpi('Provisão Receitas',paBRL(totProv.RECEITAS),'','var(--purple)')+paKpi('Provisão Despesas',paBRL(totProv.DESPESAS),'','var(--purple)')+paKpi('Realizado + Provisão (Resultado)',paBRL((tot.RECEITAS.real+totProv.RECEITAS)-(tot.DESPESAS.real+totProv.DESPESAS)),'','var(--blue)')+'</div>';
  html+=paTabelaHier(d,{
    cols:[{t:'Previsto Anual'},{t:'Total Realizado'},{t:'Saldo Total a Realizar'},{t:'Saldo Mensal a Realizar',title:'Saldo Total ÷ '+d.restantes+' meses'},{t:'Provisão Prevista',cor:'var(--purple)'},{t:''}],
    campos:['prev','real','saldo','saldoMes','prov','auto'],
    linha:linha,
    celulas:function(l,tipo,nivel){
      var provCel;
      if(nivel==='cc'&&podeEd)provCel='<td><input class="pa-in prov'+(l.prov<0?' neg':'')+'" inputmode="decimal" aria-label="Provisão '+paEsc(l._cc.nome)+'" value="'+paValorInput(l.prov)+'" data-orig="'+l.prov+'" onfocus="this.select()" onkeydown="if(event.key===\'Enter\')this.blur()" onchange="paSalvarProvisao(this,'+l._cc.id+')"></td>';
      else provCel=paCelula(l.prov!==0?paBRL(l.prov):'—',paCorProvisao(l.prov),600);
      var auto=nivel==='cc'&&podeEd?'<td><button class="pa-btn-auto" title="Provisão = '+paEsc(paBRL(l.auto))+'" onclick="paProvisaoAuto(['+l._cc.id+'])">⚡ Auto</button></td>':'<td></td>';
      return paCelula(paBRL(l.prev))+paCelula(paBRL(l.real))+paCelula(paBRL(l.saldo),paCorSaldo(l.saldo,tipo),600)+paCelula(paBRL(l.saldoMes),'var(--muted2)')+provCel+auto;
    },
    extraSub:podeEd?function(gs){return ' <button class="pa-btn-auto" style="margin-left:8px" onclick="paProvisaoAuto(['+gs.centros.map(function(c){return c.id;}).join(',')+'],\'esta subconta\')">⚡ Auto Sub</button>';}:null,
    extraConta:podeEd?function(g){var ids=[];g.subcontas.forEach(function(s){s.centros.forEach(function(c){ids.push(c.id);});});return ' <button class="pa-btn-auto" style="margin-left:8px" onclick="paProvisaoAuto(['+ids.join(',')+'],\'toda a conta '+(g.conta.tipo==='RECEITAS'?'Receitas':'Despesas')+'\')">⚡ Auto Conta</button>';}:null
  });
  paEstado._dadosProv=d;
  document.getElementById('pa-root').innerHTML=html;
}
async function paSalvarProvisao(inp,ccId){
  if(!paPodeEditar())return;
  var v=paNum(paParseValor(inp.value));
  if(v===paNum(inp.dataset.orig)){inp.value=paValorInput(v);return;}
  inp.classList.add('salvando');
  try{await paUpsert('cda_pa_provisao','ano,centro_custo_id',[{ano:paEstado.ano,centro_custo_id:ccId,valor_provisao:v}]);showToast('Provisão salva','success');setTimeout(function(){navigatePlanejamento('provisao');},300);}
  catch(e){inp.classList.remove('salvando');inp.classList.add('err');paErro(e,'Não foi possível salvar a provisão');}
}
async function paProvisaoAuto(ids,escopo){
  if(!paPodeEditar())return;
  var d=paEstado._dadosProv;if(!d)return;
  if(escopo&&!confirm('Aplicar Provisão Automática (Previsto − Realizado) em '+escopo+' ('+ids.length+' centros)? Os valores manuais atuais serão substituídos.'))return;
  var linhas=ids.map(function(id){return {ano:paEstado.ano,centro_custo_id:id,valor_provisao:paNum((d.prev[id]||0)-paRealAte(d,id,12))};});
  try{await paUpsert('cda_pa_provisao','ano,centro_custo_id',linhas);showToast('Provisão automática aplicada em '+ids.length+' centro(s)','success');navigatePlanejamento('provisao');}
  catch(e){paErro(e,'Não foi possível aplicar a provisão automática');}
}

// ─── 5) COMPARATIVO MENSAL ───────────────────────────────────────────
// Status do mês: Despesa acima do previsto / Receita abaixo → >10% Atenção, >30% Crítico
function paStatusMensal(varPct,varRS,tipo){
  if(varPct===null){if(!varRS)return '—';return tipo==='DESPESAS'?'Crítico':'OK';}
  if(tipo==='DESPESAS'){if(varPct>30)return 'Crítico';if(varPct>10)return 'Atenção';return 'OK';}
  if(varPct<-30)return 'Crítico';if(varPct<-10)return 'Atenção';return 'OK';
}
function paCorVar(v,tipo){if(!v)return 'var(--muted)';return (tipo==='DESPESAS'?v>0:v<0)?'var(--red)':'var(--green)';}
function paPct(v){return v===null||!isFinite(v)?'—':(v>0?'+':'')+v.toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})+'%';}
async function paComparativoMensal(){
  var ano=paEstado.ano,d=await paDadosAno(ano);
  if(paEstado.mesComp===undefined)paEstado.mesComp=d.ultimo||1;
  var mes=paEstado.mesComp,total=mes===0,futuro=!total&&mes>d.maxMes;
  var mesesReal=d.ultimo||0;
  var sel='<label>Mês<select onchange="paEstado.mesComp=+this.value;navigatePlanejamento(\'comparativo\')"><option value="0" '+(total?'selected':'')+'>Total Meses (jan–'+(mesesReal?PA_MESES_AB[mesesReal-1].toLowerCase():'—')+')</option>'+PA_MESES.map(function(n,i){return '<option value="'+(i+1)+'" '+(i+1===mes?'selected':'')+'>'+n+'</option>';}).join('')+'</select></label>';
  var mesRef=mesesReal,restRef=d.restantes; // sempre o último Orçamento Realizado lançado (mesmo parcial)
  var html=paFiltroHTML(d.h,{anos:d.anos,acoes:'<button class="btn btn-ghost btn-sm" onclick="paTutorialInformativo(\''+'comparativo'+'\')">ℹ️ Tutorial Informativo</button>'}).replace('<label>Conta',sel+'<label>Conta');
  html+=paInfoUltimo(d,ano,(total?'Previsto acumulado = Previsto Mês × '+mesesReal+' meses realizados':'Variação = Realizado do mês − Previsto Mês'+(futuro?' · <b>mês sem lançamentos</b>':''))+' · Total Realizado e Saldo Mensal usam o último mês realizado (<b>'+(mesRef?PA_MESES[mesRef-1]:'—')+'</b>): Saldo Mensal = (Previsto Ano − Total Realizado) ÷ <b>'+restRef+'</b> meses');
  function linha(cc){
    var p=d.prev[cc.id]||0,pm,rm,acum;
    if(total){pm=p/12*mesesReal;rm=paRealAte(d,cc.id,12);acum=rm;}
    else{pm=futuro?0:p/12;rm=futuro?0:((d.mes[cc.id]||{})[mes]||0);acum=paRealAte(d,cc.id,Math.min(mes,d.maxMes));}
    var pv=d.prov[cc.id]||0,totReal=paRealAte(d,cc.id,12)+pv,vr=rm-pm,sal=p-totReal;
    return {prev:p,pm:pm,rm:rm,vr:vr,prov:pv,totReal:totReal,saldoMes:restRef>0?sal/restRef:sal};
  }
  var tot={RECEITAS:{prev:0,real:0},DESPESAS:{prev:0,real:0}};
  paGruposCartoes(d.h).forEach(function(g){g.subcontas.forEach(function(s){s.centros.forEach(function(cc){var l=linha(cc);tot[g.conta.tipo].prev+=l.pm;tot[g.conta.tipo].real+=l.rm;});});});
  html+=paKpisPrevReal(tot).replace(/Previsto R\$/g,(total?'Prev. acumulado':'Previsto mês')+' R$');
  html+=paTabelaHier(d,{
    cols:[{t:'Previsto Ano'},{t:total?'Total Prev. Meses':'Previsto Mês'},{t:'Realizado'},{t:'Variação R$'},{t:'Var %'},{t:'Status'},{t:'Provisão Prev.',cor:'var(--purple)'},{t:'Total Realizado',title:'Realizado acumulado até '+(mesRef?PA_MESES[mesRef-1]:'—')+' + Provisão Prevista'},{t:'Saldo Mensal Anual<br>pendente a Real.',title:'(Previsto Ano − Total Realizado) ÷ '+restRef+' meses restantes'}],
    campos:['prev','pm','rm','vr','prov','totReal','saldoMes'],linha:linha,
    celulas:function(l,tipo,nivel){
      var pct=l.pm!==0?(l.vr/l.pm)*100:null,cor=paCorVar(l.vr,tipo);
      return paCelula(paBRL(l.prev))+paCelula(paBRL(l.pm),'var(--muted2)')+paCelula(paBRL(l.rm))+paCelula(l.vr?(l.vr>0?'+':'')+paBRL(l.vr):'—',cor,500)+paCelula(paPct(pct),cor,500)+
        '<td style="text-align:center">'+paBadgeStatus(paStatusMensal(pct,l.vr,tipo))+'</td>'+paCelula(l.prov!==0?paBRL(l.prov):'—',paCorProvisao(l.prov),500)+paCelula(paBRL(l.totReal),'',600)+paCelula(paBRL(l.saldoMes),'var(--muted2)');
    }
  });
  html+='<p class="pa-info" style="margin-top:10px">Status: <b>OK</b> dentro de 10% · <b>Atenção</b> desvio desfavorável de 10% a 30% · <b>Crítico</b> acima de 30%. Receita abaixo do previsto e despesa acima do previsto são desfavoráveis.</p>';
  document.getElementById('pa-root').innerHTML=html;
}

// ─── 6) VISÃO TRIMESTRAL ACUMULADA ───────────────────────────────────
async function paVisaoTrimestral(){
  var ano=paEstado.ano,d=await paDadosAno(ano);
  if(!paEstado.trim)paEstado.trim=Math.min(4,Math.max(1,Math.ceil((d.ultimo||1)/3)));
  var t=paEstado.trim,meses=[t*3-2,t*3-1,t*3],fimTri=t*3,rot='até o '+t+'ºT';
  // meses com Orçamento Realizado até o fim do trimestre (ex.: 4ºT com último mês = Outubro → 10)
  var divMedia=Math.min(fimTri,d.ultimo||0);
  var seg='<div class="pa-toggle" role="group" aria-label="Trimestre">'+[1,2,3,4].map(function(i){return '<button class="'+(i===t?'on':'')+'" onclick="paEstado.trim='+i+';navigatePlanejamento(\'trimestral\')">'+i+'ºT</button>';}).join('')+'</div>';
  var html=paFiltroHTML(d.h,{anos:d.anos,acoes:seg+'<button class="btn btn-ghost btn-sm" onclick="paTutorialInformativo(\'trimestral\')">ℹ️ Tutorial Informativo</button>'});
  html+=paInfoUltimo(d,ano,'Tabela em R$ · Exibindo <b>'+PA_MESES[meses[0]-1]+' a '+PA_MESES[meses[2]-1]+'</b> · Média Mensal Realizada = Total Real. '+rot+' ÷ <b>'+divMedia+'</b> '+(divMedia===1?'mês':'meses')+' com Orçamento Realizado');
  function linha(cc){
    var p=d.prev[cc.id]||0,mm=d.mes[cc.id]||{},m1=mm[meses[0]]||0,m2=mm[meses[1]]||0,m3=mm[meses[2]]||0,acum=paRealAte(d,cc.id,fimTri);
    return {prev:p,pm:p/12,prevAte:p/12*fimTri,m1:m1,m2:m2,m3:m3,prevTri:p/12*3,tri:m1+m2+m3,acum:acum,media:divMedia>0?acum/divMedia:0};
  }
  var tot={RECEITAS:{prev:0,real:0},DESPESAS:{prev:0,real:0}};
  paGruposCartoes(d.h).forEach(function(g){g.subcontas.forEach(function(s){s.centros.forEach(function(cc){var l=linha(cc);tot[g.conta.tipo].prev+=l.prevAte;tot[g.conta.tipo].real+=l.acum;});});});
  var res={prev:tot.RECEITAS.prev-tot.DESPESAS.prev,real:tot.RECEITAS.real-tot.DESPESAS.real};
  html+='<div class="pa-kpis">'+
    paKpi('Total Receitas '+rot,'Previsto '+paBRL(tot.RECEITAS.prev),'Realizado '+paBRL(tot.RECEITAS.real),'var(--green)')+
    paKpi('Total Despesas '+rot,'Previsto '+paBRL(tot.DESPESAS.prev),'Realizado '+paBRL(tot.DESPESAS.real),'var(--red)')+
    paKpi('Resultado (Receita − Despesa) '+rot,'Previsto '+paBRL(res.prev),'Realizado '+paBRL(res.real),res.real>=0?'var(--blue)':'var(--red)')+
  '</div>';
  html+=paTabelaHier(d,{
    classe:'pa-compacta pa-estreita',
    cols:[{t:'Prev.<br>Ano'},{t:'Prev.<br>Mês'}].concat(meses.map(function(m){return {t:PA_MESES_AB[m-1]};})).concat([
      {t:'Prev.<br>Tri',title:'Previsto do trimestre = Prev. Mês × 3 — compare com o Total Trimestral'},
      {t:'Total<br>Trimestral',title:'Soma dos 3 meses exibidos'},
      {t:'Total Real.<br>'+rot,title:'Realizado de janeiro até o fim do '+t+'º trimestre'},
      {t:'Média Mensal<br>Realizada Acum.',title:'Total Real. '+rot+' ÷ '+divMedia+' meses com Orçamento Realizado — compare com o Prev. Mês'}]),
    campos:['prev','pm','prevAte','m1','m2','m3','prevTri','tri','acum','media'],linha:linha,
    celulas:function(l,tipo){
      var ruim=divMedia>0&&l.pm!==0&&(tipo==='RECEITAS'?l.media<l.pm:l.media>l.pm);
      var corMedia=divMedia===0||!l.media?'var(--muted)':(ruim?'var(--red)':'var(--green)');
      // Total Trimestral vs Prev. Tri: só colore quando o trimestre já tem Orçamento Realizado
      var corTri=(d.ultimo||0)<meses[0]||(l.prevTri===0&&!l.tri)?'':((tipo==='RECEITAS'?l.tri<l.prevTri:l.tri>l.prevTri)?'var(--red)':'var(--green)');
      return paCelula(paValor(l.prev))+paCelula(paValor(l.pm),'var(--muted2)')+[l.m1,l.m2,l.m3].map(function(v){return paCelula(v?paValor(v):'—',v?'':'var(--muted)');}).join('')+
        paCelula(paValor(l.prevTri),'var(--muted2)')+paCelula(paValor(l.tri),corTri,600)+paCelula(paValor(l.acum),'',600)+paCelula(divMedia>0?paValor(l.media):'—',corMedia,600);
    }
  });
  document.getElementById('pa-root').innerHTML=html;
}

// ─── 7) VISÃO ANUAL ACUMULADA ────────────────────────────────────────
async function paVisaoAnual(){
  var ano=paEstado.ano,d=await paDadosAno(ano);
  var html=paFiltroHTML(d.h,{anos:d.anos,acoes:'<button class="btn btn-ghost btn-sm" onclick="paTutorialInformativo(\''+'anual'+'\')">ℹ️ Tutorial Informativo</button>'});
  html+=paInfoUltimo(d,ano,'Tabela em R$ · Total Real. com Prov. = Total Real. + Provisão Prev. · % Executado = Total Real. ÷ Prev. Anual');
  function linha(cc){var p=d.prev[cc.id]||0,re=paRealAte(d,cc.id,12),pv=d.prov[cc.id]||0,sal=p-re-pv;return {prev:p,real:re,prov:pv,realProv:re+pv,saldo:sal,saldoMes:paSaldoMensal(d,sal)};}
  var tot={RECEITAS:{prev:0,real:0},DESPESAS:{prev:0,real:0}};
  paGruposCartoes(d.h).forEach(function(g){g.subcontas.forEach(function(s){s.centros.forEach(function(cc){var l=linha(cc);tot[g.conta.tipo].prev+=l.prev;tot[g.conta.tipo].real+=l.real;});});});
  html+=paKpisPrevReal(tot);
  html+=paTabelaHier(d,{
    classe:'pa-compacta pa-estreita',
    cols:[{t:'Prev.<br>Anual'},{t:'Total<br>Real.'},{t:'Provisão<br>Prev.',cor:'var(--purple)'},{t:'Total Real.<br>com Prov.',title:'Total Real. + Provisão Prev.'},{t:'% Exec.',title:'Total Real. ÷ Prev. Anual (sem provisão)'},{t:'Saldo Total<br>a Real.',title:'Prev. Anual − Total Real. com Prov.'},{t:'Saldo Mensal Anual<br>pendente a Real.',title:'Saldo Total ÷ '+d.restantes+' meses'}],
    campos:['prev','real','prov','realProv','saldo','saldoMes'],linha:linha,
    celulas:function(l,tipo){
      var pct=l.prev!==0?l.real/l.prev*100:null,w=pct===null?0:Math.min(100,Math.max(0,pct));
      var corBar=pct===null?'var(--muted)':(tipo==='RECEITAS'?(pct>=100?'var(--green)':'var(--gold)'):(pct>100?'var(--red)':'var(--green)'));
      return paCelula(paValor(l.prev))+paCelula(paValor(l.real),'',600)+paCelula(l.prov!==0?paValor(l.prov):'—',paCorProvisao(l.prov),500)+paCelula(paValor(l.realProv),'',600)+
        '<td>'+(pct===null?'—':pct.toLocaleString('pt-BR',{maximumFractionDigits:1})+'%')+'<span class="pa-bar"><i style="width:'+w+'%;background:'+corBar+'"></i></span></td>'+
        paCelula(paValor(l.saldo),paCorSaldo(l.saldo,tipo),600)+paCelula(paValor(l.saldoMes),'var(--muted2)');
    }
  });
  document.getElementById('pa-root').innerHTML=html;
}

// ─── 8) COMPARATIVO DE METAS ─────────────────────────────────────────
function paStatusMetas(desvio,tipo){
  if(desvio===null)return 'Sem Dados';
  var ruim=tipo==='RECEITAS'?desvio<0:desvio>0;
  if(!ruim)return 'OK';
  var a=Math.abs(desvio);if(a===0)return 'Sem Dados';if(a<=10)return 'Atenção';if(a<=20)return 'Crítico';return 'Intervenção';
}
async function paComparativoMetas(){
  var ano=paEstado.ano,d=await paDadosAno(ano);
  if(!paEstado.statusMeta)paEstado.statusMeta='Todos';
  var sel='<label>Status<select onchange="paEstado.statusMeta=this.value;navigatePlanejamento(\'metas\')">'+['Todos','OK','Sem Dados','Atenção','Crítico','Intervenção'].map(function(s){return '<option '+(s===paEstado.statusMeta?'selected':'')+'>'+s+'</option>';}).join('')+'</select></label>';
  var html=paFiltroHTML(d.h,{anos:d.anos,acoes:'<button class="btn btn-ghost btn-sm" onclick="paTutorialInformativo(\''+'metas'+'\')">ℹ️ Tutorial Informativo</button>'}).replace('<div class="pa-toggle"',sel+'<div class="pa-toggle"');
  var mPass=d.ultimo||0,mRest=d.restantes;
  html+=paInfoUltimo(d,ano,'% Desvio = (Realizado − Previsto Mês × <b>'+mPass+'</b>) ÷ previsto acumulado · Proj. Mensal = Saldo ÷ <b>'+mRest+'</b> meses restantes');
  function linha(cc){
    var p=d.prev[cc.id]||0,pm=p/12,re=paRealAte(d,cc.id,12),pv=d.prov[cc.id]||0,sal=p-re-pv;
    var com=mPass,sem=mRest,pa=pm*com; // regra única: meses até o último Orçamento Realizado (todos os centros)
    var proj=sem>0?sal/sem:0;
    return {prev:p,pm:pm,real:re,prov:pv,saldo:sal,prevAcum:pa,com:com,projMes:proj,projAno:re+proj*sem};
  }
  function agregar(linhas,tipo){
    var t=paSomaLinhas(linhas,['prev','pm','real','prov','saldo','projMes','projAno']);
    t.com=mPass;t.prevAcum=t.pm*t.com;return t;
  }
  var filtro=paEstado.statusMeta;
  function passa(l,tipo){var dv=l.prevAcum!==0?(l.real-l.prevAcum)/l.prevAcum*100:null;return filtro==='Todos'||paStatusMetas(dv,tipo)===filtro;}
  var totT={RECEITAS:{prev:0,real:0,proj:0},DESPESAS:{prev:0,real:0,proj:0}};
  paGruposCartoes(d.h).forEach(function(g){g.subcontas.forEach(function(s){s.centros.forEach(function(cc){var l=linha(cc);totT[g.conta.tipo].prev+=l.prev;totT[g.conta.tipo].real+=l.real;totT[g.conta.tipo].proj+=l.projAno;});});});
  html+='<div class="pa-kpis">'+
    paKpi('Total Receitas','Previsto '+paBRL(totT.RECEITAS.prev),'Realizado '+paBRL(totT.RECEITAS.real)+' · Projeção '+paBRL(totT.RECEITAS.proj),'var(--green)')+
    paKpi('Total Despesas','Previsto '+paBRL(totT.DESPESAS.prev),'Realizado '+paBRL(totT.DESPESAS.real)+' · Projeção '+paBRL(totT.DESPESAS.proj),'var(--red)')+
    paKpi('Resultado Líquido','Previsto '+paBRL(totT.RECEITAS.prev-totT.DESPESAS.prev),'Realizado '+paBRL(totT.RECEITAS.real-totT.DESPESAS.real)+' · Projeção '+paBRL(totT.RECEITAS.proj-totT.DESPESAS.proj),'var(--blue)')+'</div>';
  // Com filtro de status, subcontas/contas somam só os centros que passam
  var dFiltrado=d;
  if(filtro!=='Todos'){
    dFiltrado=Object.assign({},d,{h:Object.assign({},d.h,{contas:d.h.contas.map(function(c){
      return Object.assign({},c,{subcontas:c.subcontas.map(function(s){return Object.assign({},s,{centros:s.centros.filter(function(cc){return passa(linha(cc),c.tipo);})});})});
    })})});
  }
  html+=paTabelaHier(dFiltrado,{
    cols:[{t:'Prev. Ano'},{t:'Prev. Mês'},{t:'Real. Acum.'},{t:'Provisão Prev.',cor:'var(--purple)'},{t:'Saldo a Real.'},{t:'% Exec.',title:'(Realizado + Provisão) ÷ Previsto'},{t:'% Desvio'},{t:'Status'},{t:'Proj. Mensal'},{t:'Proj. Anual'}],
    linha:linha,agregar:agregar,
    celulas:function(l,tipo){
      var exe=l.prev!==0?(l.real+l.prov)/l.prev*100:null,dv=l.prevAcum!==0?(l.real-l.prevAcum)/l.prevAcum*100:null;
      var ruim=dv===null||dv===0?null:(tipo==='RECEITAS'?dv<0:dv>0);
      var cor=ruim===null?'var(--muted2)':(ruim?'var(--red)':'var(--green)');
      return paCelula(paBRL(l.prev))+paCelula(paBRL(l.pm),'var(--muted2)')+paCelula(paBRL(l.real),'',600)+paCelula(l.prov!==0?paBRL(l.prov):'—',paCorProvisao(l.prov),500)+
        paCelula(paBRL(l.saldo),cor,600)+paCelula(exe===null?'—':exe.toLocaleString('pt-BR',{maximumFractionDigits:1})+'%')+paCelula(paPct(dv),cor,600)+
        '<td style="text-align:center">'+paBadgeStatus(paStatusMetas(dv,tipo))+'</td>'+paCelula(paBRL(l.projMes),'var(--muted2)')+paCelula(paBRL(l.projAno));
    }
  });
  html+='<p class="pa-info" style="margin-top:10px">Status: desvio favorável = <b>OK</b> · desfavorável até 10% = <b>Atenção</b> · 10% a 20% = <b>Crítico</b> · acima de 20% = <b>Intervenção</b> · sem previsto acumulado = <b>Sem Dados</b>.</p>';
  document.getElementById('pa-root').innerHTML=html;
}

// ─── 10) ANÁLISES ESTRATÉGICAS · ESTRUTURA DE CUSTOS FIXOS ───────────
// Fixos e financeiros medidos contra a RECEITA TOTAL (não por canal): % sobre a
// Receita Prevista (planejamento) e sobre a Receita Realizada (acompanhamento),
// com referência de mercado e meta interna editáveis (cda_pa_meta_estrutura).
async function paMetasEstrutura(ano){
  var rows=await sb.get('cda_pa_meta_estrutura','ano=lte.'+ano+'&order=ano.desc');
  var m={},anoBase=null;
  rows.forEach(function(r){if(anoBase===null)anoBase=r.ano;if(r.ano===anoBase)m[r.chave]={mercado:r.pct_mercado===null?null:Number(r.pct_mercado),meta:r.pct_meta===null?null:Number(r.pct_meta),valor:r.valor_mensal===null||r.valor_mensal===undefined?null:Number(r.valor_mensal),fonte:r.fonte||null};});
  return {m:m,anoBase:anoBase};
}
async function paSalvarMetaEstrutura(inp,chave,campo){
  if(!paPodeEditar())return;
  var bruto=String(inp.value).trim(),n=bruto===''?null:paParseDigitado(bruto);
  if(campo==='valor'){if(n!==null&&!(n>=0)){showToast('Informe um valor em R$ maior ou igual a zero.','error');return;}}
  else if(n!==null&&(!isFinite(n)||n<0||n>100)){showToast('Informe um percentual entre 0 e 100.','error');return;}
  var atual=(paCache.metasEstr&&paCache.metasEstr[chave])||{};
  var valor=atual.valor===undefined?null:atual.valor;
  if(campo==='valor')valor=n;
  if(campo==='metapct'){if(!(paCache.recMesEstr>0)){showToast('Sem receita base para converter o %.','error');return;}valor=n===null?null:Math.round(n/100*paCache.recMesEstr*100)/100;}
  var linha={ano:paEstado.ano,chave:chave,pct_mercado:campo==='mercado'?n:(atual.mercado===undefined?null:atual.mercado),pct_meta:campo==='meta'?n:(atual.meta===undefined?null:atual.meta),valor_mensal:valor,fonte:atual.fonte||null,atualizado_por:(window.cu&&cu.email)||null,atualizado_em:new Date().toISOString()};
  try{await paUpsert('cda_pa_meta_estrutura','ano,chave',[linha]);showToast('Meta salva','success');navigatePlanejamento(paEstado.page);}
  catch(e){showToast(paErro(e,'Não foi possível salvar a meta.'),'error');}
}
// ─── Resultado anual (painel) e Referências da empresa — comuns à Estrutura e à Margem por Canal ─────
async function paCalcResultado(ano){
  var r=await Promise.all([paDadosAno(ano),paMetasEstrutura(ano),sb.get('cda_pa_valor_vigente','order=ano_inicio.desc,mes_inicio.desc')]);
  var d=r[0],metas=r[1].m;paCache.vigentes=r[2];paCache.metasEstr=metas;
  var hojeD=new Date(),refMes=ano<hojeD.getFullYear()?12:(ano>hojeD.getFullYear()?1:hojeD.getMonth()+1),ult=d.ultimo||0;
  var R={ano:ano,ult:ult,periodo:ult?'jan–'+PA_MESES_AB[ult-1].toLowerCase():'—',rec:{prev:0,real:0,ultMes:0},vari:{prev:0,real:0},fix:{prev:0,real:0,base:0,merc:0,temMerc:false},ocup:0,nAlertas:0,metas:metas};
  paGruposCartoes(d.h).forEach(function(g){g.subcontas.forEach(function(gs){gs.centros.forEach(function(cc){
    var p=d.prev[cc.id]||0,re=paRealAte(d,cc.id,ult),mm=d.mes[cc.id]||{};
    if(g.conta.tipo==='RECEITAS'){R.rec.prev+=p;R.rec.real+=re;R.rec.ultMes+=mm[ult]||0;return;}
    if(paNaturezaCentro(cc)==='variavel'){R.vari.prev+=p;R.vari.real+=re;return;}
    if(/^Predial - (Aluguel|Condom|IPTU|Energia)/i.test(cc.nome))R.ocup+=re;
    var vg=paVigenteAtual(cc.id,ano,refMes),cons=vg&&vg.tipo==='valor'?Number(vg.valor):null,mt=metas['cc:'+cc.id]||{};
    var ultimo=mm[ult]||0,ant3=0;for(var j=Math.max(1,ult-3);j<=ult-1;j++)ant3+=mm[j]||0;ant3=ult>1?ant3/Math.min(3,ult-1):0;
    if(ultimo>0&&ant3>0&&Math.abs(ultimo/ant3-1)>0.2&&!(vg&&vg.ano_inicio===ano&&vg.mes_inicio===ult))R.nAlertas++;
    R.fix.prev+=p;R.fix.real+=re;R.fix.base+=cons!==null?cons:(ult?re/ult:0);
    if(mt.mercado!==null&&mt.mercado!==undefined&&!isNaN(mt.mercado)){R.fix.merc+=Number(mt.mercado);R.fix.temMerc=true;}
  });});});
  var recAberto=(metas.receita_mes_aberto||{}).valor;
  R.recAberto=recAberto;R.simula=recAberto!==null&&recAberto!==undefined&&ult>0&&R.rec.ultMes===0;
  R.recBase=R.rec.real+(R.simula?Number(recAberto):0);R.recMes=ult?R.recBase/ult:0;
  R.mcMerc=(metas.mc_empresa||{}).mercado;R.mcMeta=(metas.mc_empresa||{}).meta;
  R.fxMerc=R.fix.temMerc?R.fix.merc:(metas.fixo_empresa||{}).mercado;R.fxAlvo=(metas.fixo_empresa||{}).mercado;R.fxMeta=(metas.fixo_empresa||{}).meta;
  paCache.recMesEstr=R.recMes;
  return R;
}
function paBarraResultado(R,selos){
  var simul=R.simula?' ('+PA_MESES_AB[R.ult-1].toLowerCase()+' hipotético '+paBRL(Number(R.recAberto))+')':'';
  return '<div class="pa-barra-res"><span>Base: <b>'+R.periodo+'</b> · Receita base <b>'+paBRL(R.recMes)+'/mês</b>'+simul+(selos||'')+'</span></div>';
}
async function paAbrirResultado(){
  var R=await paCalcResultado(paEstado.ano);
  function fp(v){return v===null||v===undefined||!isFinite(v)?'—':v.toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})+'%';}
  function tem(v){return v!==null&&v!==undefined&&!isNaN(v);}
  var m=R.recMes,ult=R.ult;
  var real={rec:m,vari:ult?R.vari.real/ult:0};real.mc=real.rec-real.vari;real.fix=R.fix.base;real.luc=real.mc-real.fix;
  var orc={rec:R.rec.prev/12,vari:R.vari.prev/12,fix:R.fix.prev/12};orc.mc=orc.rec-orc.vari;orc.luc=orc.mc-orc.fix;
  var merc=tem(R.mcMerc)&&tem(R.fxMerc)?{rec:m,vari:(100-R.mcMerc)/100*m,mc:R.mcMerc/100*m,fix:R.fxMerc/100*m}:null;if(merc)merc.luc=merc.mc-merc.fix;
  function cel(v,base,cor){if(v===null||v===undefined)return '<td>—</td>';var p=base?v/base*100:null;
    return '<td'+(cor?' style="color:'+cor+'"':'')+'>'+paValor(v)+'<small>'+fp(p)+'</small></td>';}
  // Resultado (margem, lucro): Realizado vermelho abaixo do mercado / verde no nível ou acima; Mercado em verde; Orçado vermelho se negativo
  // Diferença Mercado × Realizado = meta a perseguir (custos: reduzir; margem e lucro: aumentar)
  function dif(k,custo){
    if(!merc)return '<td>—</td>';
    if(k==='rec')return '<td></td>';
    var d=merc[k]-real[k],pp=m?d/m*100:0;
    if(Math.abs(d)<0.005)return '<td style="color:var(--green)">no mercado<small>&nbsp;</small></td>';
    var bom=custo?d>0:d<0; // já melhor que o mercado
    if(bom)return '<td style="color:var(--green)">dentro<small>'+paValor(Math.abs(d))+' de folga</small></td>';
    return '<td style="color:var(--gold2)"><b>'+(custo?'↓ reduzir ':'↑ aumentar ')+paValor(Math.abs(d))+'</b><small>'+(pp>0?'+':'−')+Math.abs(pp).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})+' p.p.</small></td>';
  }
  function linha(rot,exp,k,res){
    var cR=res&&merc?(real[k]/(real.rec||1)<merc[k]/(m||1)-0.0005?'var(--red)':'var(--green)'):(res&&real[k]<0?'var(--red)':'');
    return '<tr'+(res?' class="pa-res-tot"':'')+'><td class="pa-res-l">'+rot+'<small>'+exp+'</small></td>'+cel(orc[k],orc.rec,res&&orc[k]<0?'var(--red)':'')+cel(real[k],real.rec,cR)+(k==='rec'?'<td></td>':(merc?cel(merc[k],m,res?'var(--green)':''):'<td>—</td>'))+dif(k,k==='vari'||k==='fix')+'</tr>';}
  var html='<div class="modal-box pa-modal-res"><div class="modal-title">📊 Resultado anual '+R.ano+'</div>'+
    '<p class="pa-info" style="margin:4px 0 14px">Valores por mês, em R$ e em % da receita. O Mercado (ideal) usa a mesma receita base do Realizado — mostra como a mesma venda deveria se distribuir. Diferença = meta a perseguir. Realizado = '+R.periodo+(R.simula?' com '+PA_MESES_AB[ult-1].toLowerCase()+' hipotético de '+paBRL(Number(R.recAberto))+' (despesas do mês podem estar parciais)':'')+'; custos fixos pelo valor consolidado quando cadastrado, senão pela média.</p>'+
    '<table class="pa-res-tbl"><thead><tr><th>Linha do resultado</th><th>Orçado '+R.ano+'</th><th class="pa-res-r">Realizado</th><th class="pa-res-m">Mercado (ideal)</th><th class="pa-res-d">Diferença<br>Mercado × Realizado</th></tr></thead><tbody>'+
    linha('Receita base','Tudo o que entrou de vendas, em média por mês.','rec')+
    linha('(−) Custos variáveis','Gastos que sobem e descem com a venda: produção, comissões, eventos, anúncios, empréstimos.','vari')+
    linha('(=) Margem de contribuição','O que sobra de cada R$ 100 vendidos para pagar os custos fixos e dar lucro.','mc',true)+
    linha('(−) Custos fixos','Gastos que existem mesmo sem vender: pessoal, aluguel, condomínio, agência…','fix')+
    linha('(=) Lucro operacional','Margem − fixos. Negativo = a operação consome caixa.','luc',true)+
    '</tbody></table>';
  if(merc&&m){
    var pReal=real.luc/m*100,pMerc=merc.luc/m*100,gap=pMerc-pReal,gMc=R.mcMerc-real.mc/m*100,gFx=real.fix/m*100-R.fxMerc;
    html+='<div class="pa-res-concl">'+(gap>0.05?'<b>Para chegar ao lucro de mercado faltam '+fp(gap).replace('%',' p.p.')+' (≈ '+paBRL(merc.luc-real.luc)+'/mês):</b> '+fp(gMc).replace('%',' p.p.')+' vêm da margem e '+fp(gFx).replace('%',' p.p.')+' dos custos fixos.'+(gMc>gFx?' O maior ganho está em reduzir custos variáveis ou subir preço — veja a Margem por Canal.':' O maior ganho está nos custos fixos — veja a Estrutura de Custos Fixos.'):'<b>O lucro realizado está no nível de mercado ou acima.</b>')+'</div>';
  }
  var mcP=m?real.mc/m:0;
  html+='<p class="pa-info" style="margin-top:10px">'+(mcP>0?'Ponto de equilíbrio com a margem atual ('+fp(mcP*100)+'): receita de ≈ <b>'+paBRL(real.fix/mcP)+'/mês</b> para cobrir '+paBRL(real.fix)+' de custos fixos.':'Margem atual negativa: não há ponto de equilíbrio.')+
    (R.ocup?' · Ocupação (aluguel + condomínio + IPTU + energia): <b>'+fp(R.ocup/R.recBase*100)+'</b> da receita — mercado 6% a 10%.':'')+
    (tem(R.fxAlvo)&&R.fix.temMerc?' · Mercado dos fixos somado dos centros: '+fp(R.fix.merc)+' (alvo '+fp(R.fxAlvo)+').':'')+'</p>'+
    '<div class="modal-actions" style="display:flex;justify-content:flex-end;margin-top:12px"><button class="btn btn-ghost" onclick="closeModal()">Fechar</button></div></div>';
  openModal(html);
}
async function paAbrirReferencias(){
  var R=await paCalcResultado(paEstado.ano),M=R.metas,podeEd=paPodeEditar(),adm=paIsAdmin();
  function tem(v){return v!==null&&v!==undefined&&!isNaN(v);}
  function campo(chave,c,v,rot){
    var trav=c==='mercado'&&!adm;
    if(!podeEd||trav)return '<b>'+(tem(v)?String(v).replace('.',',')+'%':'—')+(trav?' 🔒':'')+'</b>';
    return '<input class="pa-in pa-in-pct" inputmode="decimal" aria-label="'+rot+'" value="'+(tem(v)?String(v).replace('.',','):'')+'" onkeydown="if(event.key===\'Enter\')this.blur()" onchange="paSalvarMetaEstrutura(this,\''+chave+'\',\''+c+'\')"> %';
  }
  var mc=M.mc_empresa||{},fx=M.fixo_empresa||{},ra=R.recAberto;
  openModal('<div class="modal-box pa-modal-wide"><div class="modal-title">⚙ Referências da empresa — '+R.ano+'</div>'+
    '<p class="pa-info" style="margin:4px 0 14px">Parâmetros usados na Estrutura de Custos Fixos, na Margem por Canal e no Resultado anual. Mercado % só o administrador altera (🔒).</p>'+
    '<div class="pa-ref-grid">'+
    '<div><b>Receita do mês em aberto (simulação)</b><small>Usada quando o último mês ainda não tem receita lançada.</small>R$ '+(podeEd?'<input class="pa-in" style="width:120px" inputmode="decimal" aria-label="Receita do mês em aberto" value="'+(tem(ra)?paValor(ra):'')+'" onkeydown="if(event.key===\'Enter\')this.blur()" onchange="paSalvarMetaEstrutura(this,\'receita_mes_aberto\',\'valor\')">':'<b>'+(tem(ra)?paValor(ra):'—')+'</b>')+'</div>'+
    '<div><b>Margem de contribuição</b><small>Referência de mercado para moda/merch: 35% a 45%.</small>Mercado '+campo('mc_empresa','mercado',mc.mercado,'Margem de contribuição — referência de mercado')+' · Meta '+campo('mc_empresa','meta',mc.meta,'Margem de contribuição — meta interna')+'</div>'+
    '<div><b>Custo ideal do produto (Mix de Vendas)</b><small>Meta da Ciclo: venda direta 30% do preço (padrão do setor ≈ 25%, markup 4×); atacado/B2B 50% do preço de atacado (markup 2×).</small>Venda direta '+campo('custo_ideal_direta','mercado',(M.custo_ideal_direta||{}).mercado,'Custo ideal venda direta — referência de mercado')+' · Atacado/B2B '+campo('custo_ideal_atacado','mercado',(M.custo_ideal_atacado||{}).mercado,'Custo ideal atacado — referência de mercado')+'</div>'+
    '<div><b>Alvo de custos fixos</b><small>Mercado somado dos centros hoje: '+(R.fix.temMerc?String(Math.round(R.fix.merc*100)/100).replace('.',',')+'%':'—')+'.</small>Mercado '+campo('fixo_empresa','mercado',fx.mercado,'Custos fixos — referência de mercado')+' · Meta '+campo('fixo_empresa','meta',fx.meta,'Custos fixos — meta interna')+'</div>'+
    '</div><div class="modal-actions" style="display:flex;justify-content:flex-end;margin-top:14px"><button class="btn btn-ghost" onclick="closeModal()">Fechar</button></div></div>');
}

// ─── Mix de Vendas e Custo Ideal (Análises Estratégicas › Receitas) ─────
// Produção = subcontas "Produção Varejo" / "Produção Atacado" (custo do produto)
function paNumOu(v,padrao){return v===null||v===undefined||v===''||isNaN(v)?padrao:Number(v);}
function paEhProducao(s){return /^Produção (Varejo|Atacado)/i.test((s&&s.nome)||'');}
// Custo ideal do produto pelo mix: venda direta × custo_ideal_direta + atacado × custo_ideal_atacado
function paCalcMix(d,metas){
  var ult=d.ultimo||0,recMesTot={},canais=[],prod={prev:0,real:0,porMes:{}};
  paGruposCartoes(d.h).forEach(function(g){g.subcontas.forEach(function(gs){var s=gs.sub;
    if(g.conta.tipo==='RECEITAS'){
      var c={id:s.id,nome:s.nome,tipo:s.tipo_venda==='atacado'?'atacado':'direta',prev:0,mes:{}};
      gs.centros.forEach(function(cc){c.prev+=d.prev[cc.id]||0;var mm=d.mes[cc.id]||{};for(var m=1;m<=12;m++){if(mm[m]){c.mes[m]=(c.mes[m]||0)+mm[m];recMesTot[m]=(recMesTot[m]||0)+mm[m];}}});
      canais.push(c);
    }else if(paEhProducao(s)){
      gs.centros.forEach(function(cc){prod.prev+=d.prev[cc.id]||0;var mm=d.mes[cc.id]||{};for(var m=1;m<=12;m++)if(mm[m])prod.porMes[m]=(prod.porMes[m]||0)+mm[m];});
    }
  });});
  // Período = meses com receita fechada (até o último mês lançado)
  var ultRec=0;for(var m=1;m<=ult;m++)if((recMesTot[m]||0)>0)ultRec=m;
  var R={ult:ult,ultRec:ultRec,periodo:ultRec?'jan–'+PA_MESES_AB[ultRec-1].toLowerCase():'—',canais:canais,
    cd:paNumOu((metas.custo_ideal_direta||{}).mercado,25),ca:paNumOu((metas.custo_ideal_atacado||{}).mercado,50)};
  var T={prev:0,real:0},G={direta:{prev:0,real:0},atacado:{prev:0,real:0}};
  canais.forEach(function(c){c.real=0;for(var m=1;m<=ultRec;m++)c.real+=c.mes[m]||0;c.orcPer=c.prev*ultRec/12;T.prev+=c.prev;T.real+=c.real;G[c.tipo].prev+=c.prev;G[c.tipo].real+=c.real;});
  T.orcPer=T.prev*ultRec/12;G.direta.orcPer=G.direta.prev*ultRec/12;G.atacado.orcPer=G.atacado.prev*ultRec/12;
  R.T=T;R.G=G;
  // Participações (orçado e realizado) e custo ideal ponderado
  R.partOrc={direta:T.prev?G.direta.prev/T.prev*100:0,atacado:T.prev?G.atacado.prev/T.prev*100:0};
  R.partReal={direta:T.real?G.direta.real/T.real*100:0,atacado:T.real?G.atacado.real/T.real*100:0};
  R.idealOrc=R.partOrc.direta*R.cd/100+R.partOrc.atacado*R.ca/100;
  R.idealReal=R.partReal.direta*R.cd/100+R.partReal.atacado*R.ca/100;
  prod.real=0;for(var k=1;k<=ultRec;k++)prod.real+=prod.porMes[k]||0;prod.orcPer=prod.prev*ultRec/12;
  R.prod=prod;R.prodPctOrc=T.orcPer?prod.orcPer/T.orcPer*100:null;R.prodPctReal=T.real?prod.real/T.real*100:null;
  return R;
}
async function paMixVendas(){
  var ano=paEstado.ano;
  var r=await Promise.all([paDadosAno(ano),paMetasEstrutura(ano)]);
  var d=r[0],metas=r[1].m,podeEd=paPodeEditar(),adm=paIsAdmin();paCache.metasEstr=metas;
  var M=paCalcMix(d,metas),T=M.T,ult=M.ultRec,rest=Math.max(12-ult,0);
  function fp(v){return v===null||v===undefined||!isFinite(v)?'—':v.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})+'%';}
  function fpp(v){if(Math.abs(v)<0.005)v=0;return (v>0?'+':v<0?'−':'')+Math.abs(v).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})+' p.p.';}
  function saldo(v){return '<td style="color:'+(v>=0?'var(--green)':'var(--red)')+';font-weight:600">'+(v>0?'+':v<0?'−':'')+paValor(Math.abs(v))+'</td>';}
  function meta(c){if(!rest)return '<td class="pa-mut">—</td>';var f=c.prev-c.real;return f<=0.005?'<td style="color:var(--green)">atingido</td>':'<td style="font-weight:600">'+paValor(f/rest)+'</td>';}
  function selTipo(c){
    if(!adm)return c.tipo==='atacado'?'Atacado/B2B':'Direta';
    return '<select class="pa-in" style="width:auto;min-width:0;padding:2px 4px" aria-label="Tipo de venda de '+paEsc(c.nome)+'" onchange="paSalvarTipoVenda('+c.id+',this.value)"><option value="direta"'+(c.tipo==='direta'?' selected':'')+'>Direta</option><option value="atacado"'+(c.tipo==='atacado'?' selected':'')+'>Atacado/B2B</option></select>';
  }
  function linha(c,cls,nome,tipoHtml){
    var om=c.prev/12,rm=ult?c.real/ult:0,po=T.orcPer?c.orcPer/T.orcPer*100:null,pr=T.real?c.real/T.real*100:null;
    var corP=cls==='conta rec'||po===null||pr===null||Math.abs(pr-po)<0.005?'':(pr>po?'var(--green)':'var(--red)');
    return '<tr class="'+cls+'"><td>'+nome+'</td><td>'+tipoHtml+'</td>'+
      '<td>'+paValor(c.orcPer)+'</td><td class="pa-mut">'+fp(T.orcPer?c.orcPer/T.orcPer*100:null)+'</td>'+
      '<td class="pa-c-atual">'+paValor(c.real)+'</td><td class="pa-c-atual'+(corP?'':' pa-mut')+'"'+(corP?' style="color:'+corP+';font-weight:600" title="Participação realizada '+(pr>po?'maior':'menor')+' que a orçada ('+fp(po)+')"':'')+'>'+fp(pr)+'</td>'+
      '<td>'+paValor(om)+'</td><td class="pa-c-atual">'+paValor(rm)+'</td>'+saldo(rm-om)+meta(c)+'</tr>';
  }
  var acoes='<button class="btn btn-ghost btn-sm" onclick="paAbrirResultado()">📊 Resultado anual</button>'+(podeEd?'<button class="btn btn-ghost btn-sm" onclick="paAbrirReferencias()">⚙ Referências</button>':'')+
    '<button class="btn btn-ghost btn-sm" onclick="paTutorialInformativo(\'mix\')">ℹ️ Tutorial Informativo</button>';
  var html='<div class="pa-filtros"><label>Ano<select onchange="paEstado.ano=+this.value;navigatePlanejamento(paEstado.page)">'+d.anos.map(function(a){return '<option '+(a===paEstado.ano?'selected':'')+'>'+a+'</option>';}).join('')+'</select></label><div class="pa-acoes">'+acoes+'</div></div>';
  html+='<div class="pa-barra-res"><span>Período: <b>'+M.periodo+'</b> ('+ult+' '+(ult===1?'mês':'meses')+' com receita fechada) · Orçado do período = orçamento anual × '+ult+'/12 · Restam <b>'+rest+'</b> '+(rest===1?'mês':'meses')+' no exercício</span></div>';
  html+='<h3 class="pa-h3">1. Mix de vendas por canal</h3>';
  html+='<div class="pa-tbl-wrap"><table class="pa-tbl pa-compacta pa-estreita pa-reguas"><thead><tr><th>Canal</th><th style="text-align:left">Tipo</th>'+
    '<th title="Orçamento anual × meses do período ÷ 12">Orçado<br>'+M.periodo+'</th><th>Part.</th><th class="pa-c-atual">Realizado<br>'+M.periodo+'</th><th class="pa-c-atual">Part.</th>'+
    '<th title="Orçamento anual ÷ 12">Orçado Mês</th><th class="pa-c-atual" title="Realizado do período ÷ meses">Realizado Mês</th><th title="Realizado Mês − Orçado Mês">Saldo Mês<br>(Real − Orç)</th>'+
    '<th title="(Orçamento anual − Realizado do período) ÷ meses restantes: quanto vender por mês para fechar o orçamento do ano">Meta Mês até<br>Fim Exerc.</th></tr></thead><tbody>';
  ['direta','atacado'].forEach(function(tp){
    var cs=M.canais.filter(function(c){return c.tipo===tp&&(c.prev||c.real);}).sort(function(a,b){return b.real-a.real;});
    cs.forEach(function(c){html+=linha(c,'cc',paEsc(c.nome),selTipo(c));});
    html+=linha(M.G[tp],'sub','Subtotal '+(tp==='direta'?'Venda direta':'Atacado / B2B'),'');
  });
  html+=linha(T,'conta rec','TOTAL RECEITA','');
  html+='</tbody></table></div>';
  // Bloco 2: alvo ideal da Produção
  var P=M.prod,difOrc=M.prodPctOrc-M.idealOrc,difReal=M.prodPctReal-M.idealReal,excesso=P.real-M.idealReal/100*T.real;
  html+='<h3 class="pa-h3">2. Custo ideal da Produção pelo mix</h3>';
  html+='<div class="pa-tbl-wrap" style="max-width:900px"><table class="pa-tbl pa-compacta"><thead><tr><th>Referência (meta da Ciclo)</th><th>Custo ideal</th><th title="Se o mix de vendas saísse como orçado: qual seria o custo ideal do produto, comparado ao custo de produção que foi orçado. Mostra se o orçamento já nasceu acima do ideal.">No orçamento<br><span style="font-weight:400;text-transform:none">o que planejamos</span></th><th class="pa-c-atual" title="Com o mix de vendas que de fato aconteceu: qual seria o custo ideal do produto, comparado ao custo de produção realizado. Mostra onde estamos hoje.">No realizado<br><span style="font-weight:400;text-transform:none">o que aconteceu</span></th></tr></thead><tbody>'+
    '<tr class="cc"><td>Venda direta × custo ideal</td><td>'+fp(M.cd)+' do preço'+(adm?'':' 🔒')+'</td><td>'+fp(M.partOrc.direta)+' × '+fp(M.cd)+' = <b>'+fp(M.partOrc.direta*M.cd/100)+'</b></td><td class="pa-c-atual">'+fp(M.partReal.direta)+' × '+fp(M.cd)+' = <b>'+fp(M.partReal.direta*M.cd/100)+'</b></td></tr>'+
    '<tr class="cc"><td>Atacado / B2B × custo ideal</td><td>'+fp(M.ca)+' do preço'+(adm?'':' 🔒')+'</td><td>'+fp(M.partOrc.atacado)+' × '+fp(M.ca)+' = <b>'+fp(M.partOrc.atacado*M.ca/100)+'</b></td><td class="pa-c-atual">'+fp(M.partReal.atacado)+' × '+fp(M.ca)+' = <b>'+fp(M.partReal.atacado*M.ca/100)+'</b></td></tr>'+
    '<tr class="sub"><td>Produção ideal (custo do produto ÷ receita)</td><td></td><td><b>'+fp(M.idealOrc)+'</b></td><td class="pa-c-atual"><b>'+fp(M.idealReal)+'</b></td></tr>'+
    '<tr class="cc"><td>Custo de produção (Varejo + Atacado) no período</td><td></td><td>'+paValor(P.orcPer)+'</td><td class="pa-c-atual">'+paValor(P.real)+'</td></tr>'+
    '<tr class="cc"><td>÷ Receita do período</td><td></td><td>'+fp(M.prodPctOrc)+'</td><td class="pa-c-atual">'+fp(M.prodPctReal)+'</td></tr>'+
    '<tr class="conta '+(difReal>0?'desp':'rec')+'"><td>'+(difReal>0?'Acima do ideal':'Dentro do ideal')+'</td><td></td><td>'+fpp(difOrc)+'</td><td>'+fpp(difReal)+(ult?'<br><span class="pa-orig">'+(excesso>0?'≈ reduzir ':'folga ')+paBRL(Math.abs(excesso)/ult)+'/mês</span>':'')+'</td></tr>'+
    '</tbody></table></div>';
  html+='<p class="pa-info" style="margin-top:10px">Tipo do canal: <b>Direta</b> = consumidor final (inclui Revendas, comissionadas como vendedores e artistas) · <b>Atacado/B2B</b> = Private Label. '+(adm?'Altere o tipo na coluna Tipo; os % de custo ideal ficam em ⚙ Referências.':'Tipo e % de custo ideal: só o administrador altera.')+' O custo ideal da Produção também é o Mercado da Produção na Estrutura de Custos Variáveis. Período só com meses de receita fechada (a receita hipotética do mês em aberto não entra, porque não se divide por canal).</p>';
  document.getElementById('pa-root').innerHTML=html;
}
async function paSalvarTipoVenda(id,tipo){
  try{await sb.patch('cda_pa_subconta',id,{tipo_venda:tipo});await paCarregarHierarquia(true);showToast('Tipo de venda atualizado','success');navigatePlanejamento(paEstado.page);}
  catch(e){showToast(paErro(e,'Não foi possível salvar o tipo de venda.'),'error');}
}

// ─── Saldo de Compras de Produção (Análises Estratégicas › Despesas) ─────
// Quanto ainda comprar de Produção (Varejo + Atacado) até o fim do exercício, sem estourar
// o orçamento nem o custo ideal do Mix, descontando as Provisões já comprometidas.
async function paSaldoCompras(){
  var ano=paEstado.ano;
  var r=await Promise.all([paDadosAno(ano),paMetasEstrutura(ano)]);
  var d=r[0],metas=r[1].m,podeEd=paPodeEditar();paCache.metasEstr=metas;
  var M=paCalcMix(d,metas),T=M.T,ultRec=M.ultRec,ultDesp=d.ultimo||0,restRec=Math.max(12-ultRec,0),restCompra=Math.max(12-ultDesp,0);
  function fp(v){return v===null||v===undefined||!isFinite(v)?'—':v.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})+'%';}
  function fpp(v){if(Math.abs(v)<0.005)v=0;return (v>0?'+':v<0?'−':'')+Math.abs(v).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})+' p.p.';}
  var perDesp=ultDesp?'jan–'+PA_MESES_AB[ultDesp-1].toLowerCase():'—';
  // Produção por tipo de custo (VJ + AT somados)
  var tipos={},ordemT=[],Tot={prev:0,real:0,prov:0};
  paGruposCartoes(d.h).forEach(function(g){g.subcontas.forEach(function(gs){if(!paEhProducao(gs.sub))return;gs.centros.forEach(function(cc){
    var nomeT=cc.nome.replace(/^(VJ|AT)\s*-\s*/i,''),k=paNorm(nomeT),p=d.prev[cc.id]||0,re=paRealAte(d,cc.id,12),pv=d.prov[cc.id]||0;
    if(!tipos[k]){tipos[k]={nome:nomeT,prev:0,real:0,prov:0,orig:[]};ordemT.push(k);}
    var t=tipos[k];t.prev+=p;t.real+=re;t.prov+=pv;var o=/^AT/i.test(cc.nome)?'AT':(/^VJ/i.test(cc.nome)?'VJ':'');if(o&&(p||re||pv)&&t.orig.indexOf(o)<0)t.orig.push(o);
    Tot.prev+=p;Tot.real+=re;Tot.prov+=pv;
  });});});
  // Receita do ano em dois cenários e teto ideal de produção
  var recOrc=T.real+T.prev*restRec/12,recRitmo=T.real+(ultRec?T.real/ultRec:0)*restRec;
  var tetoOrc=M.idealReal/100*recOrc,tetoRitmo=M.idealReal/100*recRitmo;
  function calc(o,peso){
    o.saldoOrc=o.prev-o.real-o.prov;
    o.saldoIdO=tetoOrc*peso-o.real-o.prov;o.saldoIdR=tetoRitmo*peso-o.real-o.prov;
    o.podeO=Math.min(o.saldoOrc,o.saldoIdO);o.podeR=Math.min(o.saldoOrc,o.saldoIdR);return o;
  }
  calc(Tot,1);
  ordemT.forEach(function(k){var t=tipos[k];calc(t,Tot.real?t.real/Tot.real:0);});
  function cel(v,forte){return '<td style="color:'+(v<-0.005?'var(--red)':'')+';'+(forte?'font-weight:700':'')+'">'+(v<-0.005?'−'+paValor(-v):paValor(v))+'</td>';}
  function pode(v,cls){
    if(v<=0.005)return '<td class="'+cls+'" style="color:var(--red);font-weight:700">já excedido<br><span class="pa-orig">'+paValor(Math.abs(v))+'</span></td>';
    return '<td class="'+cls+'" style="font-weight:700;color:var(--green)">'+paValor(v)+(restCompra?'<br><span class="pa-orig">'+paValor(v/restCompra)+'/mês</span>':'')+'</td>';
  }
  var acoes='<button class="btn btn-ghost btn-sm" onclick="navigatePlanejamento(\'mix\')">🧩 Mix de Vendas</button><button class="btn btn-ghost btn-sm" onclick="navigatePlanejamento(\'provisao\')">🔮 Provisões</button>'+
    '<button class="btn btn-ghost btn-sm" onclick="paTutorialInformativo(\'compras\')">ℹ️ Tutorial Informativo</button>';
  var html='<div class="pa-filtros"><label>Ano<select onchange="paEstado.ano=+this.value;navigatePlanejamento(paEstado.page)">'+d.anos.map(function(a){return '<option '+(a===paEstado.ano?'selected':'')+'>'+a+'</option>';}).join('')+'</select></label><div class="pa-acoes">'+acoes+'</div></div>';
  html+='<div class="pa-barra-res"><span>Receita fechada: <b>'+M.periodo+'</b> · Produção lançada: <b>'+perDesp+'</b> · Restam <b>'+restCompra+'</b> '+(restCompra===1?'mês':'meses')+' para comprar · Custo ideal pelo mix: <b>'+fp(M.idealReal)+'</b> da receita</span></div>';
  // Bloco 1 — resumo (do Mix)
  var P=M.prod,difO=M.prodPctOrc-M.idealOrc,difR=M.prodPctReal-M.idealReal,exc=P.real-M.idealReal/100*T.real;
  html+='<h3 class="pa-h3">1. Resumo — custo de produção × receita ('+M.periodo+')</h3>';
  html+='<div class="pa-tbl-wrap" style="max-width:760px"><table class="pa-tbl pa-compacta"><thead><tr><th></th><th>Orçado</th><th class="pa-c-atual">Realizado</th></tr></thead><tbody>'+
    '<tr class="cc"><td>Custo de produção (Varejo + Atacado)</td><td>'+paValor(P.orcPer)+'</td><td class="pa-c-atual">'+paValor(P.real)+'</td></tr>'+
    '<tr class="cc"><td>÷ Receita do período</td><td>'+fp(M.prodPctOrc)+'</td><td class="pa-c-atual">'+fp(M.prodPctReal)+'</td></tr>'+
    '<tr class="cc"><td>Custo ideal pelo mix</td><td>'+fp(M.idealOrc)+'</td><td class="pa-c-atual">'+fp(M.idealReal)+'</td></tr>'+
    '<tr class="conta '+(difR>0.005?'desp':'rec')+'"><td>'+(difR>0.005?'Acima do ideal':'Dentro do ideal')+'</td><td>'+fpp(difO)+'</td><td>'+fpp(difR)+(ultRec?'<br><span class="pa-orig">'+(exc>0?'≈ reduzir ':'folga ')+paBRL(Math.abs(exc)/ultRec)+'/mês</span>':'')+'</td></tr>'+
    '</tbody></table></div>';
  // Bloco 2 — receita do ano e teto ideal
  html+='<h3 class="pa-h3">2. Teto ideal de produção no ano — dois cenários de receita</h3>';
  html+='<div class="pa-tbl-wrap" style="max-width:900px"><table class="pa-tbl pa-compacta"><thead><tr><th></th><th title="Supõe que out–dez vão bater o orçado">Pelo orçamento<br><span style="font-weight:400;text-transform:none">otimista</span></th><th title="Supõe que out–dez seguem a média mensal realizada">Pelo ritmo atual<br><span style="font-weight:400;text-transform:none">conservador</span></th></tr></thead><tbody>'+
    '<tr class="cc"><td>Receita realizada '+M.periodo+'</td><td>'+paValor(T.real)+'</td><td>'+paValor(T.real)+'</td></tr>'+
    '<tr class="cc"><td>Receita estimada dos '+restRec+' meses restantes</td><td>'+paValor(recOrc-T.real)+'<br><span class="pa-orig">orçado '+paValor(T.prev/12)+'/mês</span></td><td>'+paValor(recRitmo-T.real)+'<br><span class="pa-orig">média '+paValor(ultRec?T.real/ultRec:0)+'/mês</span></td></tr>'+
    '<tr class="sub"><td>Receita do ano</td><td>'+paValor(recOrc)+'</td><td>'+paValor(recRitmo)+'</td></tr>'+
    '<tr class="cc"><td>× Custo ideal pelo mix ('+fp(M.idealReal)+') = Teto ideal de produção</td><td>'+paValor(tetoOrc)+'</td><td>'+paValor(tetoRitmo)+'</td></tr>'+
    '<tr class="cc"><td>(−) Produção realizada '+perDesp+'</td><td>'+paValor(Tot.real)+'</td><td>'+paValor(Tot.real)+'</td></tr>'+
    '<tr class="cc"><td>(−) Provisões já comprometidas</td><td>'+paValor(Tot.prov)+'</td><td>'+paValor(Tot.prov)+'</td></tr>'+
    '<tr class="conta '+(Tot.saldoIdR>0?'rec':'desp')+'"><td>= Saldo pelo ideal</td>'+cel(Tot.saldoIdO,true)+cel(Tot.saldoIdR,true)+'</tr>'+
    '<tr class="cc"><td>Saldo pelo orçamento (Orçado '+paValor(Tot.prev)+' − Realizado − Provisões)</td>'+cel(Tot.saldoOrc)+cel(Tot.saldoOrc)+'</tr>'+
    '<tr class="conta rec"><td>PODE COMPRAR ATÉ O FIM DO EXERCÍCIO<br><span class="pa-orig" style="font-weight:400">o menor entre saldo pelo ideal e pelo orçamento</span></td>'+pode(Tot.podeO,'')+pode(Tot.podeR,'')+'</tr>'+
    '</tbody></table></div>';
  // Bloco 3 — por tipo de custo
  html+='<h3 class="pa-h3">3. Por tipo de custo (Varejo + Atacado)</h3>';
  html+='<div class="pa-tbl-wrap"><table class="pa-tbl pa-compacta pa-estreita pa-reguas"><thead><tr><th>Tipo de custo</th><th>Orçado ano</th><th class="pa-c-atual">Realizado<br>'+perDesp+'</th><th title="Provisão Prevista: valores já comprometidos e ainda não lançados">Provisões</th>'+
    '<th title="Orçado − Realizado − Provisões">Saldo pelo<br>orçamento</th><th class="pa-c-merc" title="Teto ideal (cenário orçamento) × peso do tipo − Realizado − Provisões">Saldo ideal<br>(orçamento)</th><th class="pa-c-merc" title="Teto ideal (cenário ritmo atual) × peso do tipo − Realizado − Provisões">Saldo ideal<br>(ritmo atual)</th>'+
    '<th title="Menor entre saldo pelo orçamento e saldo ideal (orçamento)">Pode comprar<br>(otimista)</th><th title="Menor entre saldo pelo orçamento e saldo ideal (ritmo atual)">Pode comprar<br>(conservador)</th></tr></thead><tbody>';
  ordemT.filter(function(k){var t=tipos[k];return t.prev||t.real||t.prov;}).sort(function(a,b){return tipos[b].real-tipos[a].real;}).forEach(function(k){var t=tipos[k];
    html+='<tr class="cc"><td>'+paEsc(t.nome)+(t.orig.length?' <span class="pa-orig">('+t.orig.join(' + ')+')</span>':'')+'</td><td>'+paValor(t.prev)+'</td><td class="pa-c-atual">'+paValor(t.real)+'</td><td>'+(t.prov?paValor(t.prov):'—')+'</td>'+
      cel(t.saldoOrc)+cel(t.saldoIdO)+cel(t.saldoIdR)+pode(t.podeO,'')+pode(t.podeR,'')+'</tr>';});
  html+='<tr class="conta desp"><td>TOTAL PRODUÇÃO</td><td>'+paValor(Tot.prev)+'</td><td>'+paValor(Tot.real)+'</td><td>'+paValor(Tot.prov)+'</td>'+cel(Tot.saldoOrc,true)+cel(Tot.saldoIdO,true)+cel(Tot.saldoIdR,true)+pode(Tot.podeO,'')+pode(Tot.podeR,'')+'</tr>';
  html+='</tbody></table></div>';
  html+='<p class="pa-info" style="margin-top:10px">O teto ideal de cada tipo de custo é o teto total distribuído pelo peso atual desse custo no realizado. <b>Pode comprar</b> = o menor entre o saldo pelo orçamento e o saldo pelo ideal; abaixo, o valor por mês nos '+restCompra+' meses restantes. Provisões vêm da tela <a class="pa-link" onclick="navigatePlanejamento(\'provisao\')">Provisão Prevista</a> — mantenha-as atualizadas com o que já foi encomendado.</p>';
  document.getElementById('pa-root').innerHTML=html;
}

async function paEstruturaCustos(modo){
  modo=modo==='variavel'?'variavel':'fixa';var VAR=modo==='variavel',pg=VAR?'variaveis':'estrutura';
  var ano=paEstado.ano;
  var r=await Promise.all([paDadosAno(ano),paMetasEstrutura(ano),paRealizadoAnualMapa(ano-1),sb.get('cda_pa_valor_vigente','order=ano_inicio.desc,mes_inicio.desc'),sb.get('cda_pa_plano_acao','ano=eq.'+ano+'&order=criado_em.desc'),sb.get('cda_pa_vinculo','select=*')]);
  var d=r[0],metas=r[1].m,anoBaseMeta=r[1].anoBase,ant=r[2],podeEd=paPodeEditar(),podeMerc=podeEd&&paIsAdmin();
  paCache.vinculos=r[5];
  // Variáveis: mix de vendas (custo ideal da Produção) e receita mensal por canal (para converter consolidados em % de canal)
  var MIX=VAR?paCalcMix(d,metas):null,chanMes={};
  if(MIX)MIX.canais.forEach(function(c){chanMes[String(c.id)]=MIX.ultRec?c.real/MIX.ultRec:0;});
  function recCanaisDe(cc){
    var lv=paVinculosDe('despesa_centro_id',cc.id);if(!lv.length)lv=paVinculosDe('despesa_subconta_id',cc.subconta_id);
    if(!lv.length)return Object.keys(chanMes).reduce(function(a,k){return a+chanMes[k];},0);
    return lv.reduce(function(a,v){return a+(chanMes[String(v.receita_subconta_id)]||0);},0);
  }
  paCache.vigentes=r[3];paCache.metasEstr=metas;paCache.planos=r[4];
  var hojeD=new Date(),refMes=ano<hojeD.getFullYear()?12:(ano>hojeD.getFullYear()?1:hojeD.getMonth()+1);
  var ult=d.ultimo||0,periodo=ult?'jan–'+PA_MESES_AB[ult-1].toLowerCase():'—';
  var restantes=Math.max(12-ult,0),nAlertas=0;
  var soFora=!!paEstado.soFora;
  var acoes='<div class="pa-toggle" role="group" aria-label="Exibição"><button class="'+(soFora?'':'on')+'" onclick="paEstado.soFora=false;navigatePlanejamento(\''+pg+'\')">Todos</button><button class="'+(soFora?'on':'')+'" onclick="paEstado.soFora=true;navigatePlanejamento(\''+pg+'\')">Só acima do mercado</button></div>'+
    '<button class="btn btn-ghost btn-sm" onclick="paAbrirResultado()">📊 Resultado anual</button>'+(podeEd?'<button class="btn btn-ghost btn-sm" onclick="paAbrirReferencias()">⚙ Referências</button>':'')+
    '<button class="btn btn-ghost btn-sm" onclick="paEstado.verEstat=!paEstado.verEstat;navigatePlanejamento(\''+pg+'\')">'+(paEstado.verEstat?'📊 Ocultar estatísticas':'📊 Mostrar estatísticas')+'</button>'+
    '<button class="btn btn-ghost btn-sm" onclick="paTutorialInformativo(\''+pg+'\')">ℹ️ Tutorial Informativo</button>';
  var html=paFiltroHTML(d.h,{anos:d.anos,busca:true,centro:true,centroNat:function(n,t){return t==='DESPESAS'&&(VAR?n==='variavel':n!=='variavel');},acoes:acoes});
  var fSub=paEstado.subcontaId?String(paEstado.subcontaId):'',fCc=paEstado.centroId?String(paEstado.centroId):'',fBusca=paNorm(paEstado.busca||'');
  var filtrando=!!(fSub||fCc||fBusca||paEstado.tipo);
  function pct(v,base){return base?v/base*100:null;}
  function fp(v){return v===null||v===undefined||!isFinite(v)?'—':v.toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})+'%';}
  function fp2(v){return v===null||v===undefined||!isFinite(v)?'—':v.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})+'%';}
  function fpp(v){return v===null||!isFinite(v)?'—':(v>0?'+':'')+v.toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1});}
  function tem(v){return v!==null&&v!==undefined&&!(typeof v==='number'&&isNaN(v));}
  // Receita, variáveis e linhas de fixos/financeiros (sempre total geral)
  var rec={prev:0,real:0,ant:0,ultMes:0},vari={prev:0,real:0},linhas={},ordem=[],ocup={real:0};
  paGruposCartoes(d.h).forEach(function(g){g.subcontas.forEach(function(gs){var s=gs.sub;gs.centros.forEach(function(cc){
    var p=d.prev[cc.id]||0,re=paRealAte(d,cc.id,ult),an=ant[cc.id]||0,mm=d.mes[cc.id]||{};
    if(g.conta.tipo==='RECEITAS'){rec.prev+=p;rec.real+=re;rec.ant+=an;rec.ultMes+=mm[ult]||0;return;}
    var nat=paNaturezaCentro(cc);
    if(nat==='variavel'){vari.prev+=p;vari.real+=re;}
    if(VAR!==(nat==='variavel'))return;
    if(!VAR&&/^Predial - (Aluguel|Condom|IPTU|Energia)/i.test(cc.nome))ocup.real+=re;
    var prodG=VAR&&paEhProducao(s);
    var chave=prodG?'producao':(nat==='financeira'?'financeira':'sub:'+s.id);
    if(!linhas[chave]){linhas[chave]={chave:chave,nome:prodG?'Produção (Varejo + Atacado)':(nat==='financeira'?'Financeiras (bancos, juros, empréstimos)':s.nome),prev:0,real:0,ant:0,centros:[]};ordem.push(chave);}
    // Consolidado = valor mensal cadastrado (vigente da Tabela Contábil); em % do canal → convertido em R$ pela receita média dos canais vinculados
    var vg=paVigenteAtual(cc.id,ano,refMes),cons=vg&&vg.tipo==='valor'?Number(vg.valor):null,consPctCanal=null;
    if(VAR&&vg&&vg.tipo==='percentual'){consPctCanal=Number(vg.valor);cons=consPctCanal/100*recCanaisDe(cc);}
    var alerta=null;
    if(!VAR){var ultimo=mm[ult]||0,ant3=0;for(var j=Math.max(1,ult-3);j<=ult-1;j++)ant3+=mm[j]||0;ant3=ult>1?ant3/Math.min(3,ult-1):0;
      alerta=ultimo>0&&ant3>0&&Math.abs(ultimo/ant3-1)>0.2&&!(vg&&vg.ano_inicio===ano&&vg.mes_inicio===ult)?{ultimo:ultimo,media:ant3}:null;}
    if(alerta)nAlertas++;
    var L=linhas[chave];L.prev+=p;L.real+=re;L.ant+=an;
    if(prodG){ // Produção: VJ e AT somados por tipo de custo (tecidos, fábricas, facção…)
      var nomeT=cc.nome.replace(/^(VJ|AT)\s*-\s*/i,''),kT='prod:'+paNorm(nomeT),ex=L.centros.find(function(x){return x.chave===kT;});
      var orig=/^AT/i.test(cc.nome)?'AT':(/^VJ/i.test(cc.nome)?'VJ':'');
      var temValor=p||re||an;
      if(ex){ex.prev+=p;ex.real+=re;ex.ant+=an;ex.ids.push(cc.id);if(orig&&temValor&&ex.origens.indexOf(orig)<0)ex.origens.push(orig);}
      else L.centros.push({id:cc.id,ids:[cc.id],origens:orig&&temValor?[orig]:[],nomeBase:nomeT,subId:s.id,chave:kT,tipoProd:true,prev:p,real:re,ant:an,cons:null,vg:null,alerta:null});
      return;
    }
    L.centros.push({id:cc.id,subId:s.id,chave:'cc:'+cc.id,nome:(nat==='financeira'?s.nome+' › ':'')+cc.nome,prev:p,real:re,ant:an,cons:cons,vg:vg,consPctCanal:consPctCanal,alerta:alerta});
  });});});
  ordem.sort(function(a,b){return a==='financeira'?1:b==='financeira'?-1:linhas[b].prev-linhas[a].prev;});
  var prodRealTot=0;
  if(linhas.producao)linhas.producao.centros.forEach(function(c){c.nome=c.nomeBase+(c.origens.length>1?' (VJ + AT)':(c.origens.length?' ('+c.origens[0]+')':''));prodRealTot+=c.real;});
  // Receita base do período: realizada + receita hipotética do mês em aberto (quando o último mês ainda não tem receita)
  var recAberto=(metas.receita_mes_aberto||{}).valor,simula=tem(recAberto)&&ult>0&&rec.ultMes===0;
  var recBase=rec.real+(simula?Number(recAberto):0),recMes=ult?recBase/ult:0;
  paCache.recMesEstr=recMes;
  var temAnt=rec.ant>0;
  var planosPor={};(paCache.planos||[]).forEach(function(p){var k=String(p.centro_custo_id);(planosPor[k]=planosPor[k]||[]).push(p);});
  // Base de comparação = Consolidado (se preenchido) ou Realizado Mês (média). Status e redução: base × Mercado.
  function statusDe(base,merc){if(merc===null)return base>0.005?'Sem Dados':'—';var mR=merc/100*recMes;return base<=mR+0.005?'Dentro':(mR>0&&base<=mR*1.10?'Atenção':'Acima');}
  function avaliaCentro(c){
    var mt=metas[c.chave]||{};
    if(c.tipoProd&&MIX){ // Mercado da Produção = custo ideal do Mix de Vendas, distribuído pelo peso atual de cada tipo de custo
      mt={mercado:prodRealTot?MIX.idealReal*c.real/prodRealTot:null,fonte:'Custo ideal do Mix de Vendas: '+String(Math.round(MIX.idealReal*100)/100).replace('.',',')+'% da receita (venda direta × '+MIX.cd+'% + atacado × '+MIX.ca+'%), distribuído pelo peso atual deste custo'};c.mercAuto=true;}
    c.orc=c.prev/12;c.orcP=pct(c.orc,recMes);
    c.pr=pct(c.real,recBase);c.pp=pct(c.prev,rec.prev);c.pa=temAnt?pct(c.ant,rec.ant):null;c.var=c.pr!==null&&c.pa!==null&&(c.ant||c.real)?c.pr-c.pa:null;
    c.media=ult?c.real/ult:0;c.mediaP=pct(c.media,recMes);
    c.consP=c.cons!==null?pct(c.cons,recMes):null;
    c.base=c.cons!==null?c.cons:c.media;c.baseP=pct(c.base,recMes);
    c.merc=tem(mt.mercado)?mt.mercado:null;c.fonte=mt.fonte||'';c.mercRS=c.merc!==null?c.merc/100*recMes:null;
    c.red=c.mercRS!==null?c.base-c.mercRS:null;
    c.proj=c.real+c.base*restantes;
    c.st=statusDe(c.base,c.merc);
    c.planos=planosPor[String(c.id)]||[];
    return c;
  }
  // Subconta / grupo: soma dos centros (congelado)
  function avaliaGrupo(L,legado){
    var cs=L.centros.map(avaliaCentro),soma=function(f){return cs.reduce(function(a,c){return a+(c[f]||0);},0);};
    var temMerc=cs.some(function(c){return c.merc!==null;});
    L.orc=L.prev/12;L.orcP=pct(L.orc,recMes);
    L.pr=pct(L.real,recBase);L.pp=pct(L.prev,rec.prev);L.pa=temAnt?pct(L.ant,rec.ant):null;L.var=L.pr!==null&&L.pa!==null&&(L.ant||L.real)?L.pr-L.pa:null;
    L.media=soma('media');L.mediaP=pct(L.media,recMes);
    L.temCons=cs.some(function(c){return c.cons!==null;});L.cons=L.temCons?soma('cons'):null;L.consP=L.cons!==null?pct(L.cons,recMes):null;
    L.base=soma('base');L.baseP=pct(L.base,recMes);
    L.merc=temMerc?soma('merc'):(legado&&tem(legado.mercado)?legado.mercado:null);L.mercProv=!temMerc&&L.merc!==null;
    L.mercRS=L.merc!==null?L.merc/100*recMes:null;L.red=L.mercRS!==null?L.base-L.mercRS:null;L.proj=L.real+L.base*restantes;
    L.st=statusDe(L.base,L.merc);L.cs=cs;
    // Mercado parcial: algum centro com valor ainda sem Mercado → soma não é comparável (sem redução/status no grupo)
    L.parcial=temMerc&&cs.some(function(c){return c.merc===null&&(c.base>0.005||c.prev>0.005);});
    if(L.parcial){L.red=null;L.st='Sem Dados';}
    return L;
  }
  var T={prev:0,real:0,ant:0,media:0,cons:0,temCons:false,base:0,merc:0,temMerc:false,mercProv:false};
  ordem.forEach(function(k){var L=avaliaGrupo(linhas[k],VAR?null:metas[k]);T.prev+=L.prev;T.real+=L.real;T.ant+=L.ant;T.media+=L.media;T.base+=L.base;
    if(L.cons!==null){T.cons+=L.cons;T.temCons=true;}
    if(L.merc!==null){T.merc+=L.merc;T.temMerc=true;if(L.mercProv)T.mercProv=true;}
    if(L.parcial||(L.merc===null&&(L.base>0.005||L.prev>0.005)))T.parcial=true;});
  T.orc=T.prev/12;T.orcP=pct(T.orc,recMes);T.pr=pct(T.real,recBase);T.pp=pct(T.prev,rec.prev);T.pa=temAnt?pct(T.ant,rec.ant):null;T.var=T.pr!==null&&T.pa!==null?T.pr-T.pa:null;
  T.mediaP=pct(T.media,recMes);T.cons=T.temCons?T.cons:null;T.consP=T.cons!==null?pct(T.cons,recMes):null;T.baseP=pct(T.base,recMes);
  T.merc=T.temMerc?T.merc:null;T.mercRS=T.merc!==null?T.merc/100*recMes:null;T.red=T.mercRS!==null?T.base-T.mercRS:null;T.proj=T.real+T.base*restantes;T.st=statusDe(T.base,T.merc);
  if(T.parcial&&T.temMerc){T.red=null;T.st='Sem Dados';}
  // Réguas da empresa
  var mcR=metas.mc_empresa||{},fxR=metas.fixo_empresa||{};
  var mcPrev=rec.prev?100-vari.prev/rec.prev*100:null,mcReal=rec.real?100-vari.real/rec.real*100:null;
  var fixReal=pct(T.real,recBase),mcRegua=tem(mcR.meta)?mcR.meta:mcR.mercado;
  var fxAlvo=tem(fxR.meta)?fxR.meta:fxR.mercado;
  var stFx=!tem(fxAlvo)||T.baseP===null?'Sem Dados':(T.baseP<=fxAlvo?'Dentro':(T.baseP<=fxAlvo+2?'Atenção':'Acima'));
  var stMc=!tem(mcRegua)||mcReal===null?'Sem Dados':(mcReal>=mcRegua?'Dentro':(mcReal>=mcRegua-5?'Atenção':'Acima'));
  function corDe(st){return st==='Dentro'?'var(--green)':st==='Atenção'?'var(--gold2)':st==='Acima'?'var(--red)':'var(--blue)';}
  var lucroHoje=mcReal!==null&&fixReal!==null?mcReal-fixReal:null;
  var lucroMerc=tem(mcR.mercado)&&T.merc!==null?mcR.mercado-T.merc:null;
  var lucroOrc=mcPrev!==null&&T.orcP!==null?mcPrev-pct(T.prev,rec.prev):null;
  var selos=(nAlertas?' <button class="pa-selo" title="Valores do último mês que mudaram mais de 20% contra a média dos 3 meses anteriores — confirme o consolidado na linha (⚠ mudou?)" onclick="paEstado.soFora=false;showToast(\'Procure as linhas com ⚠ mudou? na coluna Consolidado\',\'info\')">⚠ '+nAlertas+' mudança'+(nAlertas>1?'s':'')+'</button>':'')+(T.mercProv?' <span class="pa-selo" title="Linhas com provisório ainda usam a referência antiga da subconta">provisório</span>':'');
  html+=paBarraResultado({periodo:periodo,recMes:recMes,simula:simula,recAberto:recAberto,ult:ult},selos);
  function corSt(st){return st==='Acima'?'var(--red)':st==='Atenção'?'var(--gold2)':st==='Dentro'?'var(--green)':'';}
  function inpMerc(c){
    return '<input class="pa-in pa-in-pct" style="width:46px!important;margin-top:2px" inputmode="decimal" aria-label="Mercado % '+paEsc(c.nome)+'" value="'+(c.merc===null?'':String(Math.round(c.merc*100)/100).replace('.',','))+'" onkeydown="if(event.key===\'Enter\')this.blur()" onchange="paSalvarMetaEstrutura(this,\''+c.chave+'\',\'mercado\')">';
  }
  var verEstat=!!paEstado.verEstat,nCol=verEstat?10:8;
  function celulas(o,tipo){
    var centro=tipo==='cc',forte=centro?'':'font-weight:600;',cong=centro?'':' pa-cong';
    var cOrc=paValor(o.orc)+'<br><span class="pa-orig">'+fp2(o.orcP)+'</span>';
    var cMerc=(o.mercRS!==null?paValor(o.mercRS):'—')+'<br>'+
      (centro&&podeMerc&&!o.mercAuto?inpMerc(o)+'<span class="pa-orig">%</span>'+(o.fonte?'<span class="pa-orig" title="'+paEsc(o.fonte)+'"> ⓘ</span>':''):'<span class="pa-orig"'+(centro?' title="'+(o.mercAuto?'Calculado pelo Mix de Vendas e Custo Ideal.':'Mercado congelado — só o administrador altera.')+(o.fonte?' Fonte: '+paEsc(o.fonte):'')+'"':'')+'>'+fp2(o.merc)+(o.mercProv?' prov.':'')+(!centro&&(o.parcial||(tipo==='total'&&T.parcial&&T.temMerc))?' <span title="Mercado parcial: há centros com valor e ainda sem Mercado — a soma não é comparável">parcial</span>':'')+(centro&&o.merc!==null?(o.mercAuto?' 🔗':' 🔒'):'')+'</span>');
    var usaMedia=o.cons===null||(!centro&&o.cons!==null&&Math.abs(o.cons-o.base)>0.005);
    var cMedia='<span'+(centro&&o.cons===null?' class="pa-base"':'')+'>'+paValor(o.media)+'</span><br><span class="pa-orig">'+fp2(o.mediaP)+'</span>';
    var alerta=centro&&o.alerta?'<br><button class="pa-alerta" title="Último mês ('+PA_MESES_AB[ult-1]+') R$ '+paValor(o.alerta.ultimo)+' × média anterior R$ '+paValor(o.alerta.media)+'. Clique para registrar como valor consolidado." onclick="paConfirmarMudanca('+o.id+','+Math.round(o.alerta.ultimo*100)/100+','+ult+','+ano+')">⚠ mudou?</button>':'';
    var cCons;
    if(centro){
      cCons=(o.cons!==null?'<span class="pa-base">'+paValor(o.cons)+'</span><br><span class="pa-orig">'+fp2(o.consP)+' · desde '+paMesAno(o.vg.ano_inicio,o.vg.mes_inicio)+(o.consPctCanal!==null&&o.consPctCanal!==undefined?' · '+fp2(o.consPctCanal)+' do canal':'')+'</span>':'<span class="pa-mut">—</span>')+
        '<button class="pa-btn-ico" title="'+(podeEd?'Cadastrar / ver histórico do consolidado':'Ver histórico')+'" aria-label="Consolidado de '+paEsc(o.nome)+'" onclick="paAbrirVigente('+o.id+',\'DESPESAS\')">'+(o.cons!==null?'🕘':(podeEd?'＋':'🕘'))+'</button>'+alerta;
    }else cCons=o.cons!==null?'<span title="Soma das bases dos centros: consolidado onde cadastrado, Realizado Mês nos demais">'+paValor(o.base)+'<br><span class="pa-orig">'+fp2(o.baseP)+' · base</span></span>':'<span class="pa-mut">—</span>';
    var tipRed=' title="Base usada: '+(o.cons!==null&&centro?'Consolidado':(centro?'Realizado Mês (média)':'soma das bases dos centros'))+' '+paBRL(o.base)+'/mês · Projeção '+ano+': '+paBRL(o.proj)+'"';
    var cRed=o.red===null?'—':(o.red<=0.005?'<span style="color:var(--green)">dentro</span><br><span class="pa-orig">'+paValor(o.red)+'</span>':'<b style="color:var(--red)">'+paValor(o.red)+'</b><br><span class="pa-orig">'+fpp(pct(o.red,recMes))+' p.p.</span>');
    var cPlano='';
    if(centro){var ult1=o.planos[0];
      cPlano='<div class="pa-plano">'+(ult1?'<span title="'+paEsc(ult1.texto)+'">'+paEsc(ult1.texto.length>70?ult1.texto.slice(0,70)+'…':ult1.texto)+'</span>':'')+
        '<button class="pa-btn-ico" title="Plano de ação — histórico'+(o.planos.length?' ('+o.planos.length+')':'')+'" aria-label="Plano de ação de '+paEsc(o.nome)+'" onclick="paAbrirPlano('+o.id+')">'+(o.planos.length?'📝'+(o.planos.length>1?'<sup>'+o.planos.length+'</sup>':''):(podeEd?'＋':''))+'</button></div>';}
    var estat=verEstat?('<td style="'+forte+'">'+paValor(o.prev)+'<br><span class="pa-orig">'+fp(o.pp)+'</span></td>'+
      '<td title="% em '+(ano-1)+': '+fp(o.pa)+' · Var. '+fpp(o.var)+' p.p." style="'+forte+'">'+paValor(o.real)+'<br><span class="pa-orig">'+fp(o.pr)+'</span></td>'):'';
    return '<td class="pa-c-orc'+cong+'" style="'+forte+'">'+cOrc+'</td>'+estat+
      '<td class="pa-c-atual'+cong+'" style="'+forte+'">'+cMedia+'</td>'+
      '<td class="pa-c-cons'+cong+'" style="'+forte+'">'+cCons+'</td>'+
      '<td class="pa-c-merc'+cong+'">'+cMerc+'</td>'+
      '<td'+tipRed+' style="'+forte+'">'+cRed+'</td>'+
      '<td style="text-align:center">'+paBadgeStatus(o.st)+'</td>'+
      '<td class="pa-c-plano">'+cPlano+'</td>';
  }
  html+='<div class="pa-tbl-wrap"><table class="pa-tbl pa-compacta pa-estreita pa-reguas'+(verEstat?' pa-mini':'')+'"><thead><tr><th>'+(VAR?'Custo variável':'Custo fixo')+'</th>'+
    '<th class="pa-c-orc" title="Previsto do exercício (Orçamento Anual) ÷ 12, e % da receita base mensal">Orçado Mês<br>Ano Exerc. / 12</th>'+
    (verEstat?'<th title="Previsto no ano e % sobre a Receita Prevista">Previsto '+ano+'<br>R$ · % rec.</th><th title="Realizado no período e % sobre a Receita base. Passe o mouse para ver a variação contra '+(ano-1)+'.">Realizado '+periodo+'<br>R$ · % rec.</th>':'')+
    '<th class="pa-c-atual" title="Realizado de jan até o último mês ÷ nº de meses ('+(ult||0)+') — e % da receita base mensal">Realizado Mês<br>Média '+periodo+'</th>'+
    '<th class="pa-c-cons" title="Valor mensal consolidado que vale hoje, cadastrado (com data e motivo). Quando preenchido, prevalece sobre o Realizado Mês na comparação com o mercado.">Realizado Mensal<br>Consolidado</th>'+
    '<th class="pa-c-merc" title="Quanto o mercado gasta: % da receita (editável no centro; subconta e total = soma) e o equivalente em R$/mês">Mercado (ideal)<br>R$/mês · %</th>'+
    '<th title="Base − Mercado (base = Consolidado, se preenchido; senão, Realizado Mês): quanto reduzir por mês para chegar ao mercado">Meta mensal<br>de redução</th><th style="text-align:center">Status</th>'+
    '<th class="pa-c-plano" style="text-align:left" title="Histórico em texto livre: ações, metas intermediárias, decisões">Plano de ação</th></tr></thead><tbody>';
  var mostrou=0;
  ordem.forEach(function(k){
    var L=linhas[k],vis=soFora?L.cs.filter(function(c){return c.st==='Acima'||c.st==='Atenção';}):L.cs.filter(function(c){return c.prev||c.real||c.ant||c.vg||c.merc!==null||c.planos.length;});
    if(paEstado.tipo==='RECEITAS')return;
    if(fSub||fCc||fBusca){
      var nomeOk=fBusca&&paNorm(L.nome).indexOf(fBusca)>=0;
      vis=vis.filter(function(c){return (!fSub||String(c.subId)===fSub)&&(!fCc||String(c.id)===fCc)&&(!fBusca||nomeOk||paNorm(c.nome).indexOf(fBusca)>=0);});
      if(!vis.length&&!(nomeOk&&!fSub&&!fCc))return;
    }
    if(soFora&&L.st!=='Acima'&&L.st!=='Atenção'&&!vis.length)return;
    if(!vis.length&&!L.prev&&!L.real&&!L.ant&&!L.base)return; // subconta sem valores (ex.: SEM CATEGORIA zerada)
    mostrou++;
    // Financeiras reúne centros de várias subcontas: com filtro, a linha soma só os centros da seleção
    if(k==='financeira'&&(fSub||fCc||fBusca)){
      var Lf={chave:k,nome:L.nome+' — da seleção',prev:0,real:0,ant:0,centros:vis};
      vis.forEach(function(c){Lf.prev+=c.prev;Lf.real+=c.real;Lf.ant+=c.ant;});
      L=avaliaGrupo(Lf,null); // sem a referência provisória do grupo inteiro (5% valeria para todas as financeiras, não só a seleção)
    }
    html+='<tr class="sub"><td>'+paEsc(L.nome)+'</td>'+celulas(L,'sub')+'</tr>';
    if(!paEstado.sintetico)vis.sort(function(a,b){return b.base-a.base;}).forEach(function(c){html+='<tr class="cc"><td>'+paEsc(c.nome)+'</td>'+celulas(c,'cc')+'</tr>';});
  });
  if(!mostrou)html+='<tr><td colspan="'+nCol+'" class="pa-mut" style="text-align:center">'+(paEstado.tipo==='RECEITAS'?'Esta tela mostra custos '+(VAR?'variáveis':'fixos')+' — escolha Conta: Despesas ou Todas.':(filtrando?'Nenhum custo '+(VAR?'variável':'fixo')+' para o filtro escolhido.':'Nenhum custo acima do mercado.'))+'</td></tr>';
  if(filtrando)html+='<tr><td colspan="'+nCol+'" class="pa-info" style="text-align:left;white-space:normal">Filtro ativo — a subconta mostra a soma de todos os seus centros; o total da empresa abaixo não muda com o filtro.</td></tr>';
  html+='<tr class="conta desp"><td>'+(VAR?'TOTAL VARIÁVEIS':'TOTAL FIXOS')+'</td>'+celulas(T,'total')+'</tr>';
  html+='</tbody></table></div>';
  html+='<p class="pa-info" style="margin-top:10px">Tabela em R$/mês. <b>Base de comparação</b> = Realizado Mensal Consolidado (quando cadastrado — valor em destaque) ou, sem cadastro, Realizado Mês (média). <b>Meta mensal de redução</b> = Base − Mercado. Status: <b>Dentro</b> do mercado · <b>Atenção</b> até 10% acima · <b>Acima</b>. Mercado % congelado: só o administrador altera (no centro de custo); subcontas e total somam.'+(VAR?' <b>Produção</b>: Varejo e Atacado somados por tipo de custo; Mercado 🔗 calculado pelo <a class="pa-link" onclick="navigatePlanejamento(\'mix\')">Mix de Vendas e Custo Ideal</a>. Consolidados em % de canal convertidos em R$ pela receita média dos canais vinculados.':'')+' Natureza das despesas na <a class="pa-link" onclick="navigatePlanejamento(\'tabela\')">Tabela Contábil</a>.</p>';
  document.getElementById('pa-root').innerHTML=html;
}

// ─── Plano de ação: histórico em texto livre por centro de custo ─────
function paAbrirPlano(ccId){
  var h=paCache.hier,cc=h.centros.find(function(x){return String(x.id)===String(ccId);});if(!cc)return;
  var podeEd=paPodeEditar(),adm=paIsAdmin();
  var lista=(paCache.planos||[]).filter(function(p){return String(p.centro_custo_id)===String(ccId);});
  var hist=lista.length?'<div class="pa-plano-hist">'+lista.map(function(p){
    return '<div class="pa-plano-item"><div class="pa-orig">'+new Date(p.criado_em).toLocaleDateString('pt-BR')+' · '+paEsc((p.criado_por||'').split('@')[0])+(adm?' <button class="pa-btn-ico" title="Excluir anotação (administrador)" onclick="paExcluirPlano('+p.id+','+ccId+')">🗑</button>':'')+'</div><div>'+paEsc(p.texto)+'</div></div>';}).join('')+'</div>':'<p class="pa-mut" style="font-size:12.5px">Nenhuma anotação ainda.</p>';
  openModal('<div class="modal-box pa-modal-wide"><div class="modal-title">📝 Plano de ação — '+paEsc(cc.nome)+'</div>'+
    '<p class="pa-info" style="margin:6px 0 12px">Histórico em texto livre: metas intermediárias, ações e decisões. Cada anotação fica registrada com data e autor; uma nova anotação não apaga as anteriores.</p>'+hist+
    (podeEd?'<label style="display:block;margin-top:12px;font-size:12px;color:var(--muted2)">Nova anotação<textarea id="pa-pl-txt" rows="3" maxlength="1000" style="width:100%;margin-top:4px" placeholder="Ex.: Meta intermediária R$ 1.800/mês até mar/27 — renegociar na renovação do contrato"></textarea></label><div id="pa-pl-erro" class="pa-info" style="color:var(--red);min-height:16px" aria-live="polite"></div>':'')+
    '<div class="modal-actions" style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px"><button class="btn btn-ghost" onclick="closeModal()">Fechar</button>'+(podeEd?'<button class="btn btn-primary" onclick="paSalvarPlano('+ccId+')">Registrar</button>':'')+'</div></div>');
}
async function paSalvarPlano(ccId){
  var t=document.getElementById('pa-pl-txt').value.trim(),err=document.getElementById('pa-pl-erro');err.textContent='';
  if(!t){err.textContent='Escreva a anotação.';return;}
  try{await sb.post('cda_pa_plano_acao',[{ano:paEstado.ano,centro_custo_id:ccId,texto:t,criado_por:(window.cu&&cu.email)||null}]);
    paCache.planos=await sb.get('cda_pa_plano_acao','ano=eq.'+paEstado.ano+'&order=criado_em.desc');showToast('Anotação registrada','success');paAbrirPlano(ccId);paAtualizarCelulaVigente();}
  catch(e){err.textContent=paErro(e,'Não foi possível registrar.');}
}
async function paExcluirPlano(id,ccId){
  if(!confirm('Excluir esta anotação do histórico?'))return;
  try{await sb.del('cda_pa_plano_acao',id);paCache.planos=await sb.get('cda_pa_plano_acao','ano=eq.'+paEstado.ano+'&order=criado_em.desc');showToast('Anotação excluída','success');paAbrirPlano(ccId);paAtualizarCelulaVigente();}
  catch(e){showToast(paErro(e,'Não foi possível excluir.'),'error');}
}

// ─── 11) ANÁLISES ESTRATÉGICAS · MARGEM POR CANAL ────────────────────
// Cada despesa VARIÁVEL é rateada entre os canais de receita a que está
// vinculada (Tabela Contábil › Vínculos): centro com vínculo próprio > vínculo
// da subconta > todos os canais. Rateio pelos % informados ou, sem %,
// proporcional à receita de cada canal no mesmo período (previsto ou realizado).
async function paMargemCanal(){
  var ano=paEstado.ano;
  var r=await Promise.all([paDadosAno(ano),paMetasEstrutura(ano),sb.get('cda_pa_vinculo','order=id')]);
  var d=r[0],metas=r[1].m,podeEd=paPodeEditar();paCache.metasEstr=metas;paCache.vinculos=r[2];
  var ult=d.ultimo||0,periodo=ult?'jan–'+PA_MESES_AB[ult-1].toLowerCase():'—';
  var html=paFiltroHTML(d.h,{anos:d.anos,busca:true,centro:true,centroNat:function(n,t){return t==='RECEITAS'||n==='variavel';},acoes:'<button class="btn btn-ghost btn-sm" onclick="paAbrirResultado()">📊 Resultado anual</button>'+(paPodeEditar()?'<button class="btn btn-ghost btn-sm" onclick="paAbrirReferencias()">⚙ Referências</button>':'')+'<button class="btn btn-ghost btn-sm" onclick="paTutorialInformativo(\'margem\')">ℹ️ Tutorial Informativo</button>'});
  function pct(v,b){return b?v/b*100:null;}
  // Filtros: Receitas (canal / centro de receita) recortam os canais; Despesas (subconta / centro) recortam as despesas dentro de cada canal
  var fSub=paEstado.subcontaId?d.h.subcontas.find(function(x){return String(x.id)===String(paEstado.subcontaId);}):null;
  var fCc=paEstado.centroId?d.h.centros.find(function(x){return String(x.id)===String(paEstado.centroId);}):null;
  var fTipoSub=fSub?(fSub.conta||d.h.contas.find(function(c){return String(c.id)===String(fSub.conta_id);})||{}).tipo:null;
  var fTipoCc=fCc?(fCc.conta||{}).tipo:null;
  var fTipo=fTipoCc||fTipoSub||paEstado.tipo||'';
  var busca=paNorm(paEstado.busca||'');
  var filtrando=!!(fSub||fCc||busca||paEstado.tipo);
  function fp(v){return v===null||v===undefined||!isFinite(v)?'—':v.toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})+'%';}
  function fpp(v){return v===null||!isFinite(v)?'—':(v>0?'+':'')+v.toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1});}
  // Canais (subcontas de receita ativas) e despesas, sempre sem filtro de conta
  var canais=[],porId={},variaveis=[],fixos={prev:0,real:0};
  paGruposCartoes(d.h).forEach(function(g){g.subcontas.forEach(function(gs){var s=gs.sub;
    if(g.conta.tipo==='RECEITAS'){var c={id:s.id,nome:s.nome,prev:0,real:0,itens:{},varPrev:0,varReal:0,centros:{}};gs.centros.forEach(function(cc){var p0=d.prev[cc.id]||0,r0=paRealAte(d,cc.id,ult);c.prev+=p0;c.real+=r0;c.centros[String(cc.id)]={nome:cc.nome,prev:p0,real:r0};});canais.push(c);porId[String(s.id)]=c;return;}
    gs.centros.forEach(function(cc){var p=d.prev[cc.id]||0,re=paRealAte(d,cc.id,ult);
      if(paNaturezaCentro(cc)==='variavel')variaveis.push({cc:cc,sub:s,prev:p,real:re});else{fixos.prev+=p;fixos.real+=re;}});
  });});
  function alvos(cc){
    var vs=paVinculosDe('despesa_centro_id',cc.id);if(!vs.length)vs=paVinculosDe('despesa_subconta_id',cc.subconta_id);
    vs=vs.filter(function(v){return porId[String(v.receita_subconta_id)];});
    return vs.length?vs:canais.map(function(c){return {receita_subconta_id:c.id,pct_rateio:null};});
  }
  function pesos(vs,campo){
    var manual=vs.every(function(v){return v.pct_rateio!==null&&v.pct_rateio!==undefined;});
    if(manual)return vs.map(function(v){return Number(v.pct_rateio)/100;});
    var base=vs.map(function(v){return Math.max(porId[String(v.receita_subconta_id)][campo],0);}),t=base.reduce(function(a,b){return a+b;},0);
    return t>0?base.map(function(b){return b/t;}):vs.map(function(){return 1/vs.length;});
  }
  variaveis.forEach(function(x){
    var vs=alvos(x.cc),wp=pesos(vs,'prev'),wr=pesos(vs,'real');
    vs.forEach(function(v,i){var c=porId[String(v.receita_subconta_id)],k=String(x.cc.id);
      if(!c.itens[k])c.itens[k]={nome:x.sub.nome+' › '+x.cc.nome,subId:x.sub.id,ccId:x.cc.id,prev:0,real:0};
      c.itens[k].prev+=x.prev*wp[i];c.itens[k].real+=x.real*wr[i];c.varPrev+=x.prev*wp[i];c.varReal+=x.real*wr[i];});
  });
  var tot={prev:0,real:0,varPrev:0,varReal:0};
  canais.forEach(function(c){c.mcPrev=c.prev-c.varPrev;c.mcReal=c.real-c.varReal;c.mpPrev=pct(c.mcPrev,c.prev);c.mpReal=pct(c.mcReal,c.real);
    tot.prev+=c.prev;tot.real+=c.real;tot.varPrev+=c.varPrev;tot.varReal+=c.varReal;});
  tot.mcPrev=tot.prev-tot.varPrev;tot.mcReal=tot.real-tot.varReal;
  canais.sort(function(a,b){return b.mcReal-a.mcReal;});
  function status(c,meta){
    if(!c.real&&!c.varReal)return 'Sem Dados';
    if(meta===null||meta===undefined)return c.mcReal<0?'Fora de controle':'Sem Dados';
    if(c.mpReal===null)return c.mcReal<0?'Fora de controle':'Sem Dados';
    return c.mpReal>=meta?'OK':(c.mpReal>=meta-5?'Atenção':'Fora de controle');
  }
  // Régua da empresa: margem de contribuição de referência (mercado) e meta interna — editáveis (chave 'mc_empresa')
  var mcRef=metas.mc_empresa||{},mcEmp=pct(tot.mcReal,tot.real),regua=mcRef.meta!==null&&mcRef.meta!==undefined?mcRef.meta:mcRef.mercado;
  var stEmp=regua===null||regua===undefined||mcEmp===null?'Sem Dados':(mcEmp>=regua?'OK':(mcEmp>=regua-5?'Atenção':'Fora de controle'));
  var corEmp=stEmp==='OK'?'var(--green)':stEmp==='Atenção'?'var(--gold2)':stEmp==='Fora de controle'?'var(--red)':'var(--blue)';
  html+=paInfoUltimo(d,ano,'Realizado = '+periodo+' · Despesas variáveis rateadas pelos <a class="pa-link" onclick="navigatePlanejamento(\'tabela\')">vínculos da Tabela Contábil</a> (sem vínculo = todos os canais; sem % = proporcional à receita)');
  // Cartões: a conta da margem, Realizado × Ideal de mercado (e × Meta interna)
  var mMerc=mcRef.mercado,mMeta=mcRef.meta,temMerc=mMerc!==null&&mMerc!==undefined,temMeta=mMeta!==null&&mMeta!==undefined;
  var prevPer=ult?tot.prev*ult/12:0,vPct=pct(tot.varReal,tot.real),resReal=tot.mcReal-fixos.real;
  function linhaIdeal(rot,valPct,base,extra){return rot+' '+fp(valPct)+' = '+paBRL(valPct/100*base)+(extra||'');}
  var sub1='Prevista no período (Prev. ano × '+ult+'/12) '+paBRL(prevPer)+(prevPer?' · '+fp(pct(tot.real,prevPer))+' atingido':'');
  var sub2=(temMerc?linhaIdeal('Ideal mercado',100-mMerc,tot.real,' · excesso '+paBRL(tot.varReal-(100-mMerc)/100*tot.real)):'Ideal mercado: defina a referência abaixo')+(temMeta?' · Meta '+fp(100-mMeta):'');
  var sub3=(temMerc?linhaIdeal('Ideal mercado',mMerc,tot.real,' · falta '+paBRL(mMerc/100*tot.real-tot.mcReal)):'Ideal mercado: defina a referência abaixo')+(temMeta?' · '+linhaIdeal('Meta',mMeta,tot.real):'');
  var resIdeal=temMerc?mMerc/100*tot.real-fixos.real:null;
  var sub4=(resIdeal!==null?'Com a margem ideal ('+fp(mMerc)+'): '+paBRL(resIdeal):'')+' · Fixos e financeiros '+paBRL(fixos.real);
  function campoPctEmp(campo,v){
    if(!podeEd||(campo==='mercado'&&!paIsAdmin()))return ' <b title="'+(campo==='mercado'?'Mercado congelado — só o administrador altera':'')+'">'+fp(v)+(campo==='mercado'?' 🔒':'')+'</b>';
    return '<input class="pa-in pa-in-pct" inputmode="decimal" aria-label="Margem de contribuição empresa — '+(campo==='meta'?'meta interna':'referência de mercado')+'" value="'+(v===null||v===undefined?'':String(v).replace('.',','))+'" onkeydown="if(event.key===\'Enter\')this.blur()" onchange="paSalvarMetaEstrutura(this,\'mc_empresa\',\''+campo+'\')">';
  }
  function campoMeta(chave,v){
    if(!podeEd)return fp(v);
    return '<input class="pa-in pa-in-pct" inputmode="decimal" aria-label="Meta de margem '+chave+'" value="'+(v===null||v===undefined?'':String(v).replace('.',','))+'" onkeydown="if(event.key===\'Enter\')this.blur()" onchange="paSalvarMetaEstrutura(this,\''+chave+'\',\'meta\')">';
  }
  html+='<div class="pa-tbl-wrap"><table class="pa-tbl pa-compacta pa-estreita"><thead><tr><th>Canal de receita / despesa variável</th>'+
    '<th>Receita<br>prevista</th><th title="Margem prevista ÷ receita prevista">Margem<br>prev. %</th>'+
    '<th>Receita<br>'+periodo+'</th><th>Custos<br>variáveis</th><th>Margem<br>R$</th><th title="Margem realizada ÷ receita realizada">Margem<br>real. %</th><th title="Margem real. % − Margem prev. %">Var.<br>p.p.</th>'+
    '<th title="Participação do canal na margem total realizada">Part. na<br>margem</th><th title="Margem mínima desejada para o canal (%)">Meta<br>margem %</th><th style="text-align:center">Status</th></tr></thead><tbody>';
  var visiveis=canais.filter(function(c){
    if(fTipo==='RECEITAS'&&fSub&&String(c.id)!==String(fSub.id))return false;
    if(fTipo==='RECEITAS'&&fCc&&!c.centros[String(fCc.id)])return false;
    return true;
  }).map(function(c){
    // Centro de receita: recorta o canal para o centro, despesas proporcionais à receita do centro
    if(fTipo==='RECEITAS'&&fCc){var ce=c.centros[String(fCc.id)],kp=c.prev?ce.prev/c.prev:0,kr=c.real?ce.real/c.real:0,n={id:c.id,nome:c.nome+' › '+ce.nome,prev:ce.prev,real:ce.real,itens:{},varPrev:c.varPrev*kp,varReal:c.varReal*kr};
      Object.keys(c.itens).forEach(function(k){var i=c.itens[k];n.itens[k]={nome:i.nome,subId:i.subId,ccId:i.ccId,prev:i.prev*kp,real:i.real*kr};});
      n.mcPrev=n.prev-n.varPrev;n.mcReal=n.real-n.varReal;n.mpPrev=pct(n.mcPrev,n.prev);n.mpReal=pct(n.mcReal,n.real);n.proporcional=true;return n;}
    return c;
  });
  function itemPassa(i){
    if(fTipo==='DESPESAS'&&fCc&&String(i.ccId)!==String(fCc.id))return false;
    if(fTipo==='DESPESAS'&&fSub&&String(i.subId)!==String(fSub.id))return false;
    return true;
  }
  var mostrou=0;
  visiveis.forEach(function(c){
    var itens=Object.keys(c.itens).map(function(k){return c.itens[k];}).filter(itemPassa);
    if(fTipo==='DESPESAS'&&(fSub||fCc)&&!itens.some(function(i){return Math.abs(i.real)>=0.005||Math.abs(i.prev)>=0.005;}))return;
    if(busca){var nomeOk=paNorm(c.nome).indexOf(busca)>=0;itens=nomeOk?itens:itens.filter(function(i){return paNorm(i.nome).indexOf(busca)>=0;});if(!nomeOk&&!itens.length)return;}
    mostrou++;
    var mt=(metas['canal:'+c.id]||{}).meta,st=status(c,mt),cor=st==='Fora de controle'?'var(--red)':st==='Atenção'?'var(--gold2)':st==='OK'?'var(--green)':'';
    html+='<tr class="sub"><td>'+paEsc(c.nome)+'</td>'+paCelula(paValor(c.prev))+paCelula(fp(c.mpPrev),'var(--muted2)')+paCelula(paValor(c.real),'',600)+paCelula(paValor(c.varReal))+
      paCelula(paValor(c.mcReal),c.mcReal<0?'var(--red)':'',600)+paCelula(fp(c.mpReal),cor,600)+paCelula(fpp(c.mpReal!==null&&c.mpPrev!==null?c.mpReal-c.mpPrev:null),(c.mpReal||0)<(c.mpPrev||0)?'var(--red)':'var(--green)')+
      paCelula(fp(pct(c.mcReal,tot.mcReal)),'var(--muted2)')+'<td>'+campoMeta('canal:'+c.id,mt)+'</td><td style="text-align:center">'+paBadgeStatus(st)+'</td></tr>';
    if(paEstado.sintetico)return;
    itens.filter(function(i){return Math.abs(i.real)>=0.005||Math.abs(i.prev)>=0.005;}).sort(function(a,b){return b.real-a.real;}).forEach(function(i){
      html+='<tr class="cc"><td>(−) '+paEsc(i.nome)+'</td>'+paCelula(paValor(i.prev),'var(--muted2)')+paCelula(fp(pct(i.prev,c.prev)),'var(--muted2)')+'<td></td>'+paCelula(paValor(i.real))+'<td></td>'+paCelula(fp(pct(i.real,c.real)),'var(--muted2)')+'<td></td><td></td><td></td><td></td></tr>';
    });
  });
  if(!mostrou)html+='<tr><td colspan="11" class="pa-mut" style="text-align:center">Nenhum canal para o filtro escolhido.</td></tr>';
  var res={prev:tot.mcPrev-fixos.prev,real:tot.mcReal-fixos.real};
  if(filtrando)html+='<tr><td colspan="11" class="pa-info" style="text-align:left;white-space:normal">Filtro ativo'+(fTipo==='DESPESAS'&&(fSub||fCc)?' — dentro de cada canal aparecem só as despesas de <b>'+paEsc(fCc?fCc.nome:fSub.nome)+'</b>; a margem do canal continua considerando todas as despesas variáveis':'')+(fTipo==='RECEITAS'&&fCc?' — centro de receita: despesas do canal rateadas <b>proporcionalmente à receita do centro</b>':'')+'. Os totais da empresa abaixo não mudam com o filtro.</td></tr>';
  html+='<tr class="conta rec"><td>= MARGEM DE CONTRIBUIÇÃO TOTAL (EMPRESA)</td>'+paCelula(paValor(tot.prev))+paCelula(fp(pct(tot.mcPrev,tot.prev)))+paCelula(paValor(tot.real))+paCelula(paValor(tot.varReal))+paCelula(paValor(tot.mcReal),'',600)+paCelula(fp(pct(tot.mcReal,tot.real)),'',600)+paCelula(fpp(pct(tot.mcReal,tot.real)-pct(tot.mcPrev,tot.prev)))+paCelula('100%')+paCelula(fp(regua),'',600)+'<td style="text-align:center">'+paBadgeStatus(stEmp)+'</td></tr>';
  html+='<tr class="conta desp"><td>(−) CUSTOS FIXOS</td>'+paCelula(paValor(fixos.prev))+paCelula(fp(pct(fixos.prev,tot.prev)))+'<td></td>'+paCelula(paValor(fixos.real))+'<td></td>'+paCelula(fp(pct(fixos.real,tot.real)))+'<td></td><td></td><td></td><td></td></tr>';
  html+='<tr class="conta '+(res.real>=0?'rec':'desp')+'"><td>= RESULTADO</td>'+paCelula(paValor(res.prev),res.prev<0?'var(--red)':'var(--green)')+paCelula(fp(pct(res.prev,tot.prev)))+'<td></td><td></td>'+paCelula(paValor(res.real),res.real<0?'var(--red)':'var(--green)',600)+paCelula(fp(pct(res.real,tot.real)),res.real<0?'var(--red)':'var(--green)',600)+'<td></td><td></td><td></td><td></td></tr>';
  html+='</tbody></table></div>';
  html+='<p class="pa-info" style="margin-top:10px">Tabela em R$. Margem do canal = Receita do canal − despesas variáveis rateadas para ele. Status: com meta de margem — atingida = <b>OK</b> · até 5 p.p. abaixo = <b>Atenção</b> · mais de 5 p.p. abaixo = <b>Fora de controle</b>; sem meta, só acusa margem negativa. Canais ordenados pela margem em R$. Os custos fixos não são rateados entre canais (veja a <a class="pa-link" onclick="navigatePlanejamento(\'estrutura\')">Estrutura de Custos Fixos</a>).</p>';
  document.getElementById('pa-root').innerHTML=html;
}

// ─── 9) TUTORIAL ─────────────────────────────────────────────────────
function paTutorial(){
  document.getElementById('pa-root').innerHTML='<div class="card pa-tut" style="max-width:900px">'+
  '<p>O <b>Planejamento Anual</b> organiza o orçamento de <b>Receitas e Despesas</b> da Ciclo da Arte em três níveis: <b>Conta</b> (Receitas/Despesas) → <b>Subconta</b> → <b>Centro de Custo</b>. Os valores do <b>Ano Anterior</b> servem de base; o <b>Ano Exercício</b> é planejado (previsto) e acompanhado mês a mês (realizado).</p>'+
  '<h3>1. Rotina mensal recomendada</h3><ul><li>Feche o mês e gere a planilha de Receitas e de Despesas (uma aba para cada, com "Receita" ou "Despesa" no nome da aba).</li><li>Em <b>Orçamento Realizado</b>, clique em <b>⬆ Importar Excel</b>, escolha o mês e clique em <b>Pré-visualizar</b>.</li><li>Se aparecer <b>centro não encontrado</b>, nada é gravado: cadastre o centro na <b>Tabela Contábil</b> ou crie um <b>apelido</b> e pré-visualize de novo.</li><li>Confirme. A planilha <b>substitui o mês inteiro</b> daquela conta — reimportar é seguro.</li><li>Revise a <b>Provisão Prevista</b> e consulte os painéis de <b>Previsto vs. Realizado</b>.</li></ul>'+
  '<h3>2. Telas</h3><ul>'+
  '<li><b>Tabelas Contábeis</b> — cadastro da hierarquia. Renomeie direto na linha; use <b>Inativar</b> em vez de excluir quando já houver valores. Apelidos de importação ficam no fim da página. Nas despesas, a coluna <b>Natureza</b> define se o custo é variável, fixo ou financeiro (a subconta dá o padrão; o centro pode ter exceção). A coluna <b>Vigente</b> guarda o valor que vale hoje, com data e motivo (R$/mês para fixas e financeiras; % da receita para variáveis) — o Orçado não muda. No fim da página, <b>Vínculos Receita × Despesa</b> liga cada despesa variável aos canais de receita.</li>'+
  '<li><b>Análises Estratégicas › Margem por Canal</b> — margem de contribuição de cada canal de receita, com as despesas variáveis rateadas pelos vínculos da Tabela Contábil, meta de margem por canal e o resultado (margens − fixos).</li>'+
  '<li><b>Análises Estratégicas › Estrutura de Custos Fixos</b> — fixos e financeiros como % da receita total (prevista e realizada), com referência de mercado, meta interna editável, status e o teste de fechamento das metas.</li>'+
  '<li><b>Orçamento Anual</b> — Realizado do ano anterior, <b>Previsto</b> do exercício (editável), Previsto do mês, Realizado acumulado e Saldo Mensal a Realizar.</li>'+
  '<li><b>Orçamento Realizado</b> — valores de cada mês por centro; edição manual, importação Excel e <b>Limpar Período</b> (somente administradores).</li>'+
  '<li><b>Provisão Prevista</b> — quanto ainda se espera realizar até o fim do ano. Digite o valor ou use <b>⚡ Auto</b> (Provisão = Previsto − Realizado) por centro, subconta ou conta. Pode ser negativa (roxo = positiva, vermelho = negativa).</li>'+
  '<li><b>Comparativo Mensal</b> — previsto × realizado de um mês ou do total de meses, com variação e status.</li>'+
  '<li><b>Visão Trimestral Acumulada</b> — os três meses do trimestre lado a lado, com totais do ano.</li>'+
  '<li><b>Visão Anual Acumulada</b> — previsto anual, total realizado e % executado.</li>'+
  '<li><b>Comparativo de Metas</b> — desvio contra o previsto acumulado, status e projeções; filtre por status para focar no que precisa de ação.</li></ul>'+
  '<h3>3. Fórmulas</h3><ul><li><code>Previsto Mês = Previsto Anual ÷ 12</code></li><li><code>Saldo Total a Realizar = Previsto − (Realizado + Provisão)</code></li><li><code>Meses restantes = 12 − último mês realizado</code></li><li><code>Saldo Mensal a Realizar = Saldo Total ÷ meses restantes</code></li><li><code>% Desvio (Metas) = (Realizado − Previsto Mês × meses com lançamento) ÷ previsto acumulado</code></li><li><code>Projeção Anual = Realizado + Saldo ÷ meses sem lançamento × meses sem lançamento</code></li></ul>'+
  '<h3>4. Cores e status</h3><ul><li><b>Receitas</b>: realizar abaixo do previsto é desfavorável (vermelho). <b>Despesas</b>: gastar acima do previsto é desfavorável (vermelho).</li><li>Comparativo Mensal: <b>OK</b> até 10% · <b>Atenção</b> 10–30% · <b>Crítico</b> acima de 30%.</li><li>Comparativo de Metas: <b>OK</b> favorável · <b>Atenção</b> até 10% · <b>Crítico</b> 10–20% · <b>Intervenção</b> acima de 20%.</li></ul>'+
  '<h3>5. Filtros</h3><p>Todas as telas têm <b>Ano</b>, <b>Conta</b>, <b>Subconta</b> e o modo <b>Analítico/Sintético</b> (Sintético mostra só os totais por subconta). Os painéis consideram apenas cadastros <b>ativos</b>.</p>'+
  '<h3>6. Acesso</h3><p>Liberado em <b>Credenciamento</b> marcando o projeto <b>Planejamento Anual</b>. Usuários "somente leitura" consultam sem editar. Exclusões e limpeza de período são exclusivas de administradores.</p></div>';
}

// ─── Tutorial Informativo (popup) dos painéis Previsto vs. Realizado ──
var PA_TUT_COMUM=[
 ['Ano','Exercício analisado. Os valores previstos e realizados são sempre deste ano.'],
 ['Conta / Subconta','Filtram a tabela por Receitas/Despesas e por subconta. Os cartões do topo sempre mostram o total geral (Receitas, Despesas e Resultado), mesmo com filtro.'],
 ['Analítico / Sintético','Analítico mostra cada centro de custo; Sintético mostra só os totais por subconta e conta.'],
 ['Cores','Receitas: abaixo do previsto é desfavorável (vermelho). Despesas: acima do previsto é desfavorável (vermelho). Provisão: roxo se positiva, vermelho se negativa.'],
 ['Cadastros considerados','Somente contas, subcontas e centros de custo ATIVOS na Tabela Contábil.']
];
var PA_TUT={
 comparativo:{t:'Comparativo Mensal',d:'Compara, centro a centro, o previsto e o realizado de um mês (ou do total de meses já realizados) e mostra quanto falta realizar por mês até o fim do ano.',c:[
  ['Mês','Mês analisado nas colunas Previsto Mês, Realizado, Variação e Status. "Total Meses" soma de janeiro até o último mês com lançamentos.'],
  ['Previsto Ano','Valor previsto para o ano inteiro no Orçamento Anual.'],
  ['Previsto Mês / Total Prev. Meses','Previsto Ano ÷ 12. Em "Total Meses": (Previsto Ano ÷ 12) × meses já realizados.','Previsto Ano ÷ 12'],
  ['Realizado','Valor lançado no mês escolhido. Em "Total Meses": soma de todos os meses realizados.'],
  ['Variação R$','Diferença entre o realizado e o previsto do período.','Realizado − Previsto Mês'],
  ['Var %','Variação em percentual do previsto do período.','(Realizado − Previsto Mês) ÷ Previsto Mês × 100'],
  ['Status','Situação do desvio desfavorável: OK até 10% · Atenção de 10% a 30% · Crítico acima de 30%.'],
  ['Provisão Prev.','Valor ainda esperado até o fim do ano, lançado na tela Provisão Prevista.'],
  ['Total Realizado','Tudo o que já foi realizado no ano até o último Orçamento Realizado lançado (mesmo parcial), somado ao que está provisionado. Não muda com o mês filtrado.','Realizado acumulado (jan até o último mês realizado) + Provisão Prevista'],
  ['Saldo Mensal Anual pendente a Real.','Quanto precisa ser realizado por mês, nos meses que faltam após o último Orçamento Realizado lançado, para atingir o previsto do ano. Não muda com o mês filtrado.','(Previsto Ano − Total Realizado) ÷ (12 − último mês realizado)']]},
 trimestral:{t:'Visão Trimestral Acumulada',d:'Mostra os três meses do trimestre lado a lado e o acumulado do ano até o fim do trimestre, com a média mensal realizada para comparar com o previsto mensal.',c:[
  ['1ºT a 4ºT','Escolhe o trimestre (1ºT = jan–mar … 4ºT = out–dez). Abre no trimestre do último mês realizado.'],
  ['Cartões "até o nºT"','Previsto e Realizado acumulados de janeiro até o fim do trimestre escolhido, por Receitas e Despesas, e o Resultado (Receitas − Despesas).','Previsto = Prev. Mês × meses até o fim do trimestre · Realizado = soma de jan até o fim do trimestre'],
  ['Prev. Ano','Valor previsto para o ano inteiro.'],
  ['Prev. Mês','Previsto Ano dividido por 12.','Previsto Ano ÷ 12'],
  ['Meses do trimestre','Realizado lançado em cada mês do trimestre escolhido.'],
  ['Prev. Tri','Previsto para os três meses do trimestre — para comparar com o Total Trimestral.','Prev. Mês × 3'],
  ['Total Trimestral','Soma dos três meses exibidos. Verde = dentro do Prev. Tri; vermelho = Receitas abaixo ou Despesas acima (só colore quando o trimestre já tem Orçamento Realizado).','Mês 1 + Mês 2 + Mês 3'],
  ['Total Real. até o nºT','Tudo o que foi realizado de janeiro até o fim do trimestre (mesmo valor do cartão).','Soma de jan até o último mês do trimestre'],
  ['Média Mensal Realizada Acum.','Média mensal do que foi realizado até o trimestre, para comparar com o Prev. Mês. Divide só pelos meses que já têm Orçamento Realizado (ex.: 4ºT com outubro lançado → 10 meses). Verde = dentro do previsto; vermelho = Receitas abaixo ou Despesas acima do Prev. Mês.','Total Real. até o nºT ÷ meses com Orçamento Realizado até o trimestre']]},
 anual:{t:'Visão Anual Acumulada',d:'Resumo do ano: quanto do previsto já foi executado e quanto falta.',c:[
  ['Prev. Anual','Valor previsto para o ano inteiro.'],
  ['Total Real.','Soma de todos os meses realizados no ano.'],
  ['Provisão Prev.','Valor ainda esperado até o fim do ano.'],
  ['Total Real. com Prov.','O que já foi realizado mais o que ainda está provisionado — é o valor que o Saldo Total desconta do previsto.','Total Real. + Provisão Prev.'],
  ['% Exec.','Quanto do previsto já foi realizado. A barra mostra o progresso (verde = meta atingida em Receitas ou dentro do previsto em Despesas).','Total Real. ÷ Previsto Anual × 100 (não inclui a provisão)'],
  ['Saldo Total a Real.','Quanto ainda falta para atingir o previsto.','Previsto Anual − Total Real. com Prov.'],
  ['Saldo Mensal Anual pendente a Real.','Saldo total distribuído pelos meses que faltam.','Saldo Total ÷ (12 − último mês realizado)']]},
 margem:{t:'Margem por Canal',d:'Mostra quanto cada canal de receita deixa de margem de contribuição depois das despesas variáveis que ele gera. A soma das margens paga os custos fixos; o que sobra é o resultado.',c:[
  ['Filtros','Conta / Subconta / Centro de Custo / Buscar. Em Receitas, recortam os canais (um centro de receita mostra o canal recortado para aquele centro, com as despesas proporcionais à receita dele). Em Despesas, mostram dentro de cada canal só a despesa escolhida — útil para ver como uma despesa se distribui entre os canais; a margem do canal continua com todas as despesas. Os totais da empresa não mudam com filtro.'],
  ['Rateio','Cada despesa variável vai para os canais vinculados na Tabela Contábil (vínculo do centro de custo; se não houver, o da subconta; se não houver, todos os canais). Entre os canais, divide pelos % informados ou, sem %, proporcionalmente à receita de cada canal no período.'],
  ['Receita prevista / Margem prev. %','Receita prevista do canal e a margem prevista em % (receita − variáveis previstas rateadas).','(Receita prevista − Variáveis previstas) ÷ Receita prevista'],
  ['Receita / Custos variáveis / Margem R$','Valores realizados de janeiro até o último mês lançado.','Margem = Receita − Custos variáveis rateados'],
  ['Margem real. % / Var. p.p.','Margem realizada em % da receita do canal e a diferença para a prevista.','Margem ÷ Receita do canal × 100'],
  ['Part. na margem','Quanto o canal representa da margem total da empresa.','Margem do canal ÷ Margem total'],
  ['Resultado anual (📊)','Painel com o resultado em cascata, por mês: Receita base → Custos variáveis → Margem de contribuição → Custos fixos → Lucro, comparando Realizado, Mercado (ideal) e Orçado, com a explicação de cada linha, o quanto falta para o lucro de mercado e o ponto de equilíbrio.','Lucro = Receita − Variáveis − Fixos'],
  ['Referências (⚙)','Receita do mês em aberto (simulação), Margem de contribuição (mercado/meta) e Alvo de custos fixos (mercado/meta). Mercado % só o administrador altera (🔒).'],
  ['Meta margem %','Margem mínima que você quer para o canal (editável).'],
  ['Status','Com meta: OK atingida · Atenção até 5 p.p. abaixo · Fora de controle mais de 5 p.p. abaixo. Sem meta: só acusa margem negativa.'],
  ['Resultado','Margem total − custos fixos e financeiros (os fixos não são rateados entre canais).','Σ Margens − Fixos']]},
 mix:{t:'Mix de Vendas e Custo Ideal',d:'Mostra de onde vem a venda (canais de venda direta e de atacado/B2B), o orçado e o realizado de cada canal no período, quanto falta por mês para fechar o orçamento do ano e qual deveria ser o custo do produto (Produção) para esse mix, pelo padrão do setor.',c:[
  ['Período','Meses com receita fechada (de janeiro até o último mês com receita lançada). A receita hipotética do mês em aberto não entra, porque não se divide por canal.'],
  ['Tipo','Direta = venda ao consumidor final (inclui Revendas, comissionadas como vendedores e artistas). Atacado/B2B = Private Label. Só o administrador altera.'],
  ['Orçado / Realizado do período e Part.','Orçado do período = orçamento anual × meses ÷ 12. Part. = participação do canal na receita do período.','Part. = Receita do canal ÷ Receita total'],
  ['Orçado Mês / Realizado Mês','Orçamento anual ÷ 12 e realizado do período ÷ nº de meses.'],
  ['Saldo Mês','Quanto o canal vende acima (verde) ou abaixo (vermelho) do orçado, em média por mês.','Realizado Mês − Orçado Mês'],
  ['Meta Mês até Fim Exerc.','Quanto o canal precisa vender por mês, nos meses que faltam, para fechar o orçamento do ano.','(Orçamento anual − Realizado do período) ÷ meses restantes'],
  ['Custo ideal da Produção','Meta da Ciclo: venda direta 30% do preço (padrão do setor ≈ 25%, "keystone"); atacado 50% do preço de atacado. Ajustável em ⚙ Referências (admin). Ponderado pelo mix, dá o % ideal do custo do produto sobre a receita — que vira o Mercado da Produção na Estrutura de Custos Variáveis.','Part. direta × 30% + Part. atacado × 50%'],
  ['No orçamento × No realizado','No orçamento: com o mix de vendas planejado, qual seria o custo ideal do produto, comparado ao custo de produção orçado (o orçamento já nasceu acima do ideal?). No realizado: com o mix que de fato aconteceu, comparado ao custo de produção gasto (onde estamos hoje).'],
  ['Acima / Dentro do ideal','Custo de produção (Varejo + Atacado) do período ÷ receita, comparado com o ideal. Em R$/mês: quanto reduzir o custo do produto (ou subir preço) para chegar ao padrão.']]},
 variaveis:{t:'Estrutura de Custos Variáveis',d:'Mesmo layout e cálculos da Estrutura de Custos Fixos, para as despesas de natureza variável, sobre a receita total: orçado, realizado médio, consolidado, mercado (ideal), meta mensal de redução, status e plano de ação.',c:[
  ['Base','Receita base mensal da empresa (a mesma dos fixos e do Resultado anual). Todos os % são sobre ela.'],
  ['Produção (Varejo + Atacado)','Os centros VJ e AT são somados por tipo de custo (tecidos, fábricas, facção, silk…), porque o custo é o mesmo para varejo e atacado. O cadastro na Tabela Contábil continua separado.'],
  ['Mercado da Produção 🔗','Calculado pelo Mix de Vendas e Custo Ideal (venda direta × 30% + atacado × 50%) e distribuído pelo peso atual de cada tipo de custo. Não se digita.'],
  ['Consolidado em % de canal','Quando o consolidado é um % do canal (ex.: Anúncios = 40,85% do E-commerce), a tela converte em R$ pela receita média dos canais vinculados e mostra o % original.'],
  ['Mercado (ideal)','% da receita total por centro (admin). Para custos de um canal, converta: % do canal × participação do canal (ex.: 25% do E-commerce × 16,2% = 4,05%).'],
  ['Meta mensal de redução / Status / Plano de ação','Iguais aos dos custos fixos.','Base − Mercado']]},
 compras:{t:'Saldo de Compras de Produção',d:'Quanto ainda se pode comprar de Produção (Varejo + Atacado) até o fim do exercício sem estourar o orçamento nem o custo ideal do Mix de Vendas, descontando as Provisões já comprometidas.',c:[
  ['1. Resumo','Custo de produção orçado e realizado no período de receita fechada, ÷ receita, comparado ao custo ideal pelo mix (o mesmo bloco do Mix de Vendas).'],
  ['2. Dois cenários de receita','Pelo orçamento (otimista): out–dez batem o orçado. Pelo ritmo atual (conservador): out–dez seguem a média mensal realizada. Receita do ano × custo ideal = teto ideal de produção.','Teto = Receita do ano × Custo ideal %'],
  ['Saldo pelo ideal','Quanto ainda cabe dentro do teto ideal.','Teto ideal − Produção realizada − Provisões'],
  ['Saldo pelo orçamento','Quanto ainda cabe dentro do orçado.','Orçado ano − Realizado − Provisões'],
  ['Pode comprar','O menor dos dois saldos (mais seguro), e quanto isso dá por mês nos meses restantes. Negativo = já excedido: não há mais o que comprar desse item no ano.','mín(Saldo orçamento, Saldo ideal)'],
  ['3. Por tipo de custo','Tecidos, Fábricas, Silk, Facção… com VJ e AT somados. O teto ideal de cada tipo é o teto total distribuído pelo peso atual desse custo no realizado.'],
  ['Provisões','Vêm da tela Provisão Prevista: o que já foi encomendado e ainda não foi lançado. Mantenha atualizado para o saldo ser real.']]},
 estrutura:{t:'Estrutura de Custos Fixos',d:'Estrutura anual dos custos fixos e financeiros contra a receita: o orçado, a referência de mercado (ideal), o realizado médio do ano e o valor mensal consolidado, com a redução mensal necessária para chegar ao mercado e o plano de ação de cada centro.',c:[
  ['Filtros','Ano · Conta · Subconta · Centro de Custo · Buscar · Analítico/Sintético (os mesmos da Margem por Canal). Recortam as linhas; o total da empresa e o Resultado anual não mudam.'],
  ['Receita base','Receita realizada no período. Se o último mês ainda não tem receita lançada, soma a "Receita do mês em aberto (simulação)". Receita base ÷ meses = receita base mensal, usada para todos os % da tabela.','Receita realizada + receita hipotética do mês em aberto'],
  ['Orçado Mês','Previsto do exercício (Orçamento Anual) dividido por 12.','Ano Exerc. ÷ 12'],
  ['Mercado (ideal)','Referência de mercado em % da receita, digitada no centro de custo (ⓘ mostra a fonte). Subconta e total mostram a soma, congelada.','Mercado % × receita base mensal'],
  ['Realizado Mês — Média jan–último mês','O que de fato se gastou, em média, por mês no ano. O rótulo acompanha o fechamento: jan–out ÷ 10, jan–nov ÷ 11, jan–dez ÷ 12.','Realizado jan–último mês ÷ nº de meses'],
  ['Realizado Mensal Consolidado','Valor mensal que vale hoje, cadastrado (＋/🕘) com data e motivo — ex.: contrato renegociado. Quando preenchido, prevalece sobre o Realizado Mês (valor sublinhado = base usada). Despesa eventual: cadastre 0.'],
  ['Meta mensal de redução','Quanto reduzir por mês para chegar ao mercado. "dentro" quando a base já está abaixo do mercado. Passe o mouse para ver a base usada e a projeção do ano.','Base − Mercado R$/mês'],
  ['Plano de ação','Histórico em texto livre por centro (📝): metas intermediárias, ações, decisões. Cada anotação guarda data e autor; exclusão só pelo administrador.'],
  ['Status','Base × Mercado: Dentro · Atenção até 10% acima · Acima. "Só acima do mercado" filtra a tabela.'],
  ['Estatísticas','O botão "Mostrar estatísticas" exibe Previsto anual e Realizado do período (com a variação contra o ano anterior).'],
  ['Resultado anual (📊)','Painel com o resultado em cascata, por mês: Receita base → Custos variáveis → Margem de contribuição → Custos fixos → Lucro, comparando Realizado, Mercado (ideal) e Orçado, com a explicação de cada linha, o quanto falta para o lucro de mercado e o ponto de equilíbrio.','Lucro = Receita − Variáveis − Fixos'],
  ['Referências (⚙)','Receita do mês em aberto (simulação), Margem de contribuição (mercado/meta) e Alvo de custos fixos (mercado/meta). Mercado % só o administrador altera (🔒).']]},
 metas:{t:'Comparativo de Metas',d:'Mede o desvio contra o previsto proporcional aos meses já passados e projeta o fechamento do ano. Sempre parte do último Orçamento Realizado lançado, mesmo parcial (ex.: outubro → 10 meses passados, 2 restantes), igual para todos os centros de custo.',c:[
  ['Status (filtro)','Mostra apenas os centros com o status escolhido.'],
  ['Prev. Ano','Valor previsto para o ano inteiro.'],
  ['Prev. Mês','Previsto Ano dividido por 12.','Previsto Ano ÷ 12'],
  ['Real. Acum.','Soma de todos os meses realizados no ano.'],
  ['Provisão Prev.','Valor ainda esperado até o fim do ano.'],
  ['Saldo a Real.','Quanto ainda falta para atingir o previsto.','Previsto Ano − (Realizado Acum. + Provisão)'],
  ['% Exec.','Quanto do previsto já está realizado ou provisionado.','(Realizado Acum. + Provisão) ÷ Previsto Ano × 100'],
  ['% Desvio','Desvio do realizado contra o previsto proporcional aos meses já passados.','(Realizado Acum. − Prev. Mês × meses até o último realizado) ÷ (Prev. Mês × meses até o último realizado) × 100'],
  ['Status','Desvio favorável = OK · desfavorável até 10% = Atenção · 10% a 20% = Crítico · acima de 20% = Intervenção · sem previsto acumulado = Sem Dados.'],
  ['Proj. Mensal','Quanto realizar por mês nos meses que faltam no ano.','Saldo a Real. ÷ meses restantes (12 − último mês realizado)'],
  ['Proj. Anual','Fechamento esperado do ano se a projeção mensal for cumprida.','Realizado Acum. + Proj. Mensal × meses restantes']]}
};
function paTutorialInformativo(chave){
  var t=PA_TUT[chave];if(!t)return;
  function lista(itens){return '<table class="pa-tbl" style="margin-top:6px"><thead><tr><th style="text-align:left;min-width:150px">Campo</th><th style="text-align:left">Para que serve</th><th style="text-align:left">Fórmula</th></tr></thead><tbody>'+
    itens.map(function(i){return '<tr><td style="font-weight:600">'+paEsc(i[0])+'</td><td style="text-align:left;white-space:normal;font-family:var(--ff-b);font-size:12.5px;color:var(--muted2)">'+paEsc(i[1])+'</td><td style="text-align:left;white-space:normal;font-size:11.5px;color:var(--gold2)">'+(i[2]?paEsc(i[2]):'—')+'</td></tr>';}).join('')+'</tbody></table>';}
  openModal('<div class="modal-box pa-modal-wide"><div class="modal-title">ℹ️ Tutorial Informativo — '+paEsc(t.t)+'</div><p class="pa-info" style="margin:6px 0 10px">'+paEsc(t.d)+'</p>'+
    '<div class="card-title" style="margin-top:6px">Colunas</div><div class="tbl-wrap">'+lista(t.c)+'</div>'+
    '<div class="card-title" style="margin-top:16px">Filtros e convenções</div><div class="tbl-wrap">'+lista(PA_TUT_COMUM)+'</div>'+
    '<div class="modal-actions" style="display:flex;justify-content:flex-end;margin-top:14px"><button class="btn btn-primary" onclick="closeModal()">Entendi</button></div></div>');
}

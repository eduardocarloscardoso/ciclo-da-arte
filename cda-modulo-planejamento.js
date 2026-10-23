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
  estrutura:   {icon:'🏛', label:'Estrutura de Custos Fixos', grupo:'ae'},
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
  busca: ''
};
var paCache = {hier: null};

// ─── Utilidades ──────────────────────────────────────────────────────
function paEsc(v){return String(v===null||v===undefined?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
var paFmtBRL = new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
function paBRL(v){var n=Math.round((Number(v)||0)*100)/100;if(n===0)n=0;return paFmtBRL.format(n);}
// Valor sem o símbolo (tabelas largas; o cabeçalho avisa "valores em R$")
function paValor(v){var n=Math.round((Number(v)||0)*100)/100;if(n===0)n=0;return n.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});}
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
    '.pa-in-txt{width:100%;min-width:200px;text-align:left;font-family:var(--ff-b);background-color:transparent;border-color:transparent;background-image:none;padding-right:6px}',
    '.pa-in-txt:hover{border-color:var(--border2)}',
    '.pa-neg{color:var(--red)}.pa-pos{color:var(--green)}.pa-mut{color:var(--muted)}',
    '.pa-acoes{display:flex;gap:6px;flex-wrap:wrap;margin-left:auto}',
    '.pa-badge{display:inline-block;font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;font-family:var(--ff-b)}',
    '.pa-sel-nat{background:var(--card2);border:1px solid var(--border);border-radius:6px;font-size:11.5px;padding:3px 6px;font-family:var(--ff-b);max-width:170px}.pa-sel-nat option{color:var(--white)}',
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
    if(aberto)Object.keys(PA_PAGES).forEach(function(sid){if(PA_PAGES[sid].grupo===g)nav.innerHTML+=item(sid,48);});
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
    else if(page==='estrutura')await paEstruturaCustos();
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
  var subs=h.subcontas.filter(function(s){var c=h.contas.find(function(x){return x.id===s.conta_id;});return !paEstado.tipo||(c&&c.tipo===paEstado.tipo);});
  var html='<div class="pa-filtros">';
  if(opts.anos)html+='<label>Ano<select onchange="paEstado.ano=+this.value;navigatePlanejamento(paEstado.page)">'+opts.anos.map(function(a){return '<option '+(a===paEstado.ano?'selected':'')+'>'+a+'</option>';}).join('')+'</select></label>';
  if(opts.mes)html+='<label>Mês<select onchange="paEstado.mes=+this.value;navigatePlanejamento(paEstado.page)">'+PA_MESES.map(function(n,i){return '<option value="'+(i+1)+'" '+(i+1===paEstado.mes?'selected':'')+'>'+n+'</option>';}).join('')+'</select></label>';
  html+='<label>Conta<select onchange="paEstado.tipo=this.value;paEstado.subcontaId=\'\';navigatePlanejamento(paEstado.page)"><option value="">Todas</option><option value="RECEITAS" '+(paEstado.tipo==='RECEITAS'?'selected':'')+'>Receitas</option><option value="DESPESAS" '+(paEstado.tipo==='DESPESAS'?'selected':'')+'>Despesas</option></select></label>';
  html+='<label>Subconta<select onchange="paEstado.subcontaId=this.value;navigatePlanejamento(paEstado.page)"><option value="">Todas</option>'+subs.map(function(s){return '<option value="'+s.id+'" '+(String(s.id)===String(paEstado.subcontaId)?'selected':'')+'>'+paEsc(s.nome)+'</option>';}).join('')+'</select></label>';
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
  var aliases=await sb.get('cda_pa_alias_importacao','order=alias');
  var podeEd=paPodeEditar(),adm=paIsAdmin();
  var acoes=podeEd?'<button class="btn btn-primary btn-sm" onclick="paFormCadastro()">＋ Novo cadastro</button>':'';
  var html=paFiltroHTML(h,{busca:true,acoes:acoes});
  html+='<div id="pa-form"></div>';
  var b=paNorm(paEstado.busca);
  var tot=h.centros.length,ativos=h.centros.filter(function(x){return x.ativo;}).length;
  html+='<div class="pa-info">'+h.contas.length+' contas · '+h.subcontas.length+' subcontas · '+tot+' centros de custo ('+ativos+' ativos)'+(podeEd?' · Edite o nome direto na linha':'')+'</div>';
  html+='<div class="pa-tbl-wrap"><table class="pa-tbl"><thead><tr><th>Conta / Subconta / Centro de Custo</th><th style="text-align:center" title="Despesas: variável (acompanha a venda), fixa (estrutura) ou financeira (bancos, juros, empréstimos). O centro de custo herda da subconta, salvo exceção.">Natureza</th><th style="text-align:center">Situação</th><th style="text-align:center">Ações</th></tr></thead><tbody>';
  paContasFiltradas(h).forEach(function(g){
    var c=g.conta;
    html+='<tr class="conta '+(c.tipo==='RECEITAS'?'rec':'desp')+'"><td>'+paEsc(c.nome)+' <span class="pa-badge mut">'+c.tipo+'</span></td><td></td><td></td><td></td></tr>';
    g.subcontas.forEach(function(s){
      var centros=s.centros.filter(function(x){return !b||paNorm(x.nome).indexOf(b)>=0||paNorm(s.nome).indexOf(b)>=0;});
      if(b&&!centros.length&&paNorm(s.nome).indexOf(b)<0)return;
      html+='<tr class="sub"><td>'+(podeEd?'<input class="pa-in pa-in-txt" value="'+paEsc(s.nome)+'" data-orig="'+paEsc(s.nome)+'" aria-label="Nome da subconta" onkeydown="if(event.key===\'Enter\')this.blur()" onchange="paRenomear(this,\'cda_pa_subconta\','+s.id+')">':paEsc(s.nome))+'</td>'+
        '<td style="text-align:center">'+(c.tipo==='DESPESAS'?paCampoNatureza('cda_pa_subconta',s.id,s.natureza,null,podeEd):'')+'</td>'+
        '<td style="text-align:center">'+paBadgeAtivo(s.ativo)+'</td><td style="text-align:center">'+paAcoesLinha('cda_pa_subconta',s.id,s.ativo,podeEd,adm)+'</td></tr>';
      if(paEstado.sintetico)return;
      centros.forEach(function(x){
        html+='<tr class="cc'+(x.ativo?'':' inativo')+'"><td>'+(podeEd?'<input class="pa-in pa-in-txt" value="'+paEsc(x.nome)+'" data-orig="'+paEsc(x.nome)+'" aria-label="Nome do centro de custo" onkeydown="if(event.key===\'Enter\')this.blur()" onchange="paRenomear(this,\'cda_pa_centro_custo\','+x.id+')">':paEsc(x.nome))+'</td>'+
          '<td style="text-align:center">'+(c.tipo==='DESPESAS'?paCampoNatureza('cda_pa_centro_custo',x.id,x.natureza,s.natureza,podeEd):'')+'</td>'+
          '<td style="text-align:center">'+paBadgeAtivo(x.ativo)+'</td><td style="text-align:center">'+paAcoesLinha('cda_pa_centro_custo',x.id,x.ativo,podeEd,adm)+'</td></tr>';
      });
    });
  });
  html+='</tbody></table></div>';

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
  var c={'OK':'ok','Atenção':'warn','Crítico':'err','Fora de controle':'err','Intervenção':'int','Sem Dados':'mut','—':'mut'}[st]||'mut';
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
  rows.forEach(function(r){if(anoBase===null)anoBase=r.ano;if(r.ano===anoBase)m[r.chave]={mercado:r.pct_mercado===null?null:Number(r.pct_mercado),meta:r.pct_meta===null?null:Number(r.pct_meta)};});
  return {m:m,anoBase:anoBase};
}
async function paSalvarMetaEstrutura(inp,chave,campo){
  if(!paPodeEditar())return;
  var v=String(inp.value).trim().replace(',','.'),n=v===''?null:Number(v);
  if(n!==null&&(!isFinite(n)||n<0||n>100)){showToast('Informe um percentual entre 0 e 100.','error');return;}
  var atual=(paCache.metasEstr&&paCache.metasEstr[chave])||{};
  var linha={ano:paEstado.ano,chave:chave,pct_mercado:campo==='mercado'?n:(atual.mercado===undefined?null:atual.mercado),pct_meta:campo==='meta'?n:(atual.meta===undefined?null:atual.meta),atualizado_por:(window.cu&&cu.email)||null,atualizado_em:new Date().toISOString()};
  try{await paUpsert('cda_pa_meta_estrutura','ano,chave',[linha]);showToast('Meta salva','success');navigatePlanejamento('estrutura');}
  catch(e){showToast(paErro(e,'Não foi possível salvar a meta.'),'error');}
}
async function paEstruturaCustos(){
  var ano=paEstado.ano;
  var r=await Promise.all([paDadosAno(ano),paMetasEstrutura(ano),paRealizadoAnualMapa(ano-1)]);
  var d=r[0],metas=r[1].m,anoBaseMeta=r[1].anoBase,ant=r[2],podeEd=paPodeEditar();
  paCache.metasEstr=metas;
  var ult=d.ultimo||0,periodo=ult?'jan–'+PA_MESES_AB[ult-1].toLowerCase():'—';
  var lucroAlvo=paEstado.lucroAlvo===undefined?5:paEstado.lucroAlvo,soFora=!!paEstado.soFora;
  var acoes='<div class="pa-toggle" role="group" aria-label="Exibição"><button class="'+(soFora?'':'on')+'" onclick="paEstado.soFora=false;navigatePlanejamento(\'estrutura\')">Todos</button><button class="'+(soFora?'on':'')+'" onclick="paEstado.soFora=true;navigatePlanejamento(\'estrutura\')">Só fora de controle</button></div>'+
    '<button class="btn btn-ghost btn-sm" onclick="paTutorialInformativo(\'estrutura\')">ℹ️ Tutorial Informativo</button>';
  var html=paFiltroHTML({contas:[],subcontas:[]},{anos:d.anos,acoes:acoes});
  html=html.replace(/<label>Conta<select[\s\S]*?<\/select><\/label>/,'').replace(/<label>Subconta<select[\s\S]*?<\/select><\/label>/,'');
  // Receita total, variáveis e linhas de fixos/financeiros (sempre total geral, sem filtro de conta)
  var rec={prev:0,real:0,ant:0},vari={prev:0,real:0},linhas={},ordem=[],ocup={real:0};
  paGruposCartoes(d.h).forEach(function(g){g.subcontas.forEach(function(gs){var s=gs.sub;gs.centros.forEach(function(cc){
    var p=d.prev[cc.id]||0,re=paRealAte(d,cc.id,ult),an=ant[cc.id]||0;
    if(g.conta.tipo==='RECEITAS'){rec.prev+=p;rec.real+=re;rec.ant+=an;return;}
    var nat=paNaturezaCentro(cc);
    if(nat==='variavel'){vari.prev+=p;vari.real+=re;return;}
    if(/^Predial - (Aluguel|Condom|IPTU|Energia)/i.test(cc.nome))ocup.real+=re;
    var chave=nat==='financeira'?'financeira':'sub:'+s.id;
    if(!linhas[chave]){linhas[chave]={chave:chave,nome:nat==='financeira'?'Financeiras (bancos, juros, empréstimos)':s.nome,prev:0,real:0,ant:0,centros:[]};ordem.push(chave);}
    var L=linhas[chave];L.prev+=p;L.real+=re;L.ant+=an;
    if(p||re||an)L.centros.push({chave:'cc:'+cc.id,nome:(nat==='financeira'?s.nome+' › ':'')+cc.nome,prev:p,real:re,ant:an});
  });});});
  ordem.sort(function(a,b){return a==='financeira'?1:b==='financeira'?-1:linhas[b].prev-linhas[a].prev;});
  function pct(v,base){return base?v/base*100:null;}
  function fp(v){return v===null||v===undefined||!isFinite(v)?'—':v.toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})+'%';}
  function fpp(v){return v===null||!isFinite(v)?'—':(v>0?'+':'')+v.toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1});}
  function tem(v){return v!==null&&v!==undefined;}
  var tot={prev:0,real:0,ant:0,mercado:0,meta:0,temMercado:false,temMeta:false};
  ordem.forEach(function(k){var L=linhas[k],mt=metas[k]||{};tot.prev+=L.prev;tot.real+=L.real;tot.ant+=L.ant;
    if(tem(mt.mercado)){tot.mercado+=mt.mercado;tot.temMercado=true;}
    if(tem(mt.meta)){tot.meta+=mt.meta;tot.temMeta=true;}});
  var mcPrev=rec.prev?100-vari.prev/rec.prev*100:null,mcReal=rec.real?100-vari.real/rec.real*100:null;
  var fixPrev=pct(tot.prev,rec.prev),fixReal=pct(tot.real,rec.real);
  var mcBase=mcReal!==null?mcReal:mcPrev,teto=mcBase===null?null:mcBase-lucroAlvo,resMeta=mcBase===null||!tot.temMeta?null:mcBase-tot.meta;
  var temAnt=rec.ant>0;
  // Avaliação de uma linha: meta (se houver) manda; senão, crescimento sobre o próprio histórico (ano anterior)
  function avalia(o,mt){
    o.pp=pct(o.prev,rec.prev);o.pr=pct(o.real,rec.real);o.pa=temAnt?pct(o.ant,rec.ant):null;
    o.var=o.pr!==null&&o.pa!==null&&(o.ant||o.real)?o.pr-o.pa:null;
    o.ritmo=ult?o.real/ult*12:null;o.varRS=o.ant&&o.ritmo!==null?(o.ritmo/o.ant-1)*100:null;
    o.mercRS=tem(mt.mercado)?mt.mercado/100*rec.prev:null;o.metaRS=tem(mt.meta)?mt.meta/100*rec.prev:null;
    o.exc=o.metaRS!==null?o.prev-o.metaRS:null;
    if(o.pr===null||(!o.real&&!o.prev))o.st='Sem Dados';
    else if(tem(mt.meta))o.st=o.pr<=mt.meta?'OK':(o.pr<=mt.meta+2?'Atenção':'Fora de controle');
    else if(o.var!==null)o.st=o.var>1?'Fora de controle':(o.var>0.5?'Atenção':'OK');
    else o.st='Sem Dados';
    return o;
  }
  html+=paInfoUltimo(d,ano,'Realizado = '+periodo+' · % sobre a <b>receita total</b> · R$ de Mercado e Meta = % × Receita Prevista ('+paBRL(rec.prev)+')'+(anoBaseMeta&&anoBaseMeta!==ano?' · Metas herdadas de '+anoBaseMeta+' (ao editar, gravam para '+ano+')':''));
  html+='<div class="pa-kpis">'+
    paKpi('Receita total','Prevista '+paBRL(rec.prev),'Realizada ('+periodo+') '+paBRL(rec.real),'var(--green)')+
    paKpi('Margem de contribuição','Prevista '+fp(mcPrev)+' · Realizada '+fp(mcReal),'Receita − custos variáveis ('+fp(pct(vari.real,rec.real))+' realizado)','var(--blue)')+
    paKpi('Fixos + financeiros','Previsto '+fp(fixPrev)+' · Realizado '+fp(fixReal),'Meta '+(tot.temMeta?fp(tot.meta)+' = '+paBRL(tot.meta/100*rec.prev):'—')+' · Mercado '+(tot.temMercado?fp(tot.mercado):'—'),fixReal!==null&&tot.temMeta&&fixReal>tot.meta?'var(--red)':'var(--gold2)')+
    paKpi('Fechamento das metas','Resultado na meta '+fp(resMeta),'Teto de fixos p/ lucro de '+lucroAlvo+'%: '+fp(teto)+(teto!==null?' = '+paBRL(teto/100*rec.prev):''),resMeta!==null&&resMeta>=lucroAlvo?'var(--green)':'var(--red)')+
  '</div>';
  html+='<div class="pa-info">Fechamento = Margem de contribuição realizada ('+fp(mcBase)+') − soma das metas internas ('+(tot.temMeta?fp(tot.meta):'—')+'). Lucro desejado: '+
    '<select aria-label="Lucro desejado" onchange="paEstado.lucroAlvo=+this.value;navigatePlanejamento(\'estrutura\')">'+[0,5,8,10,15].map(function(x){return '<option value="'+x+'" '+(x===lucroAlvo?'selected':'')+'>'+x+'%</option>';}).join('')+'</select>'+
    ' · Ocupação (aluguel + condomínio + IPTU + energia): <b>'+fp(pct(ocup.real,rec.real))+'</b> da receita realizada — mercado (moda, loja de rua) 6% a 10%</div>';
  function campoPct(chave,campo,v){
    if(!podeEd)return fp(v);
    return '<input class="pa-in pa-in-pct" inputmode="decimal" aria-label="'+(campo==='meta'?'Meta interna':'Referência de mercado')+' '+chave+'" value="'+(tem(v)?String(v).replace('.',','):'')+'" onkeydown="if(event.key===\'Enter\')this.blur()" onchange="paSalvarMetaEstrutura(this,\''+chave+'\',\''+campo+'\')">';
  }
  function corSt(st){return st==='Fora de controle'?'var(--red)':st==='Atenção'?'var(--gold2)':st==='OK'?'var(--green)':'';}
  function celulas(o,mt,chave,forte){
    var tipVar=o.varRS===null?'':' title="Ritmo anual '+ano+': '+paBRL(o.ritmo)+' · '+(ano-1)+': '+paBRL(o.ant)+' ('+(o.varRS>0?'+':'')+Math.round(o.varRS)+'% em R$)"';
    return paCelula(paValor(o.prev))+paCelula(fp(o.pp),'var(--muted2)')+paCelula(paValor(o.real),'',forte?600:'')+paCelula(fp(o.pr),corSt(o.st),forte?600:'')+
      paCelula(fp(o.pa),'var(--muted2)')+'<td'+tipVar+' style="color:'+(o.var===null?'':o.var>0.5?'var(--red)':o.var<-0.5?'var(--green)':'var(--muted2)')+'">'+fpp(o.var)+'</td>'+
      '<td>'+campoPct(chave,'mercado',mt.mercado)+'</td>'+paCelula(o.mercRS===null?'—':paValor(o.mercRS),'var(--muted2)')+
      '<td>'+campoPct(chave,'meta',mt.meta)+'</td>'+paCelula(o.metaRS===null?'—':paValor(o.metaRS),'',forte?600:'')+
      paCelula(o.exc===null?'—':paValor(o.exc),o.exc===null?'':(o.exc>0?'var(--red)':'var(--green)'),600)+
      '<td style="text-align:center">'+paBadgeStatus(o.st)+'</td>';
  }
  html+='<div class="pa-tbl-wrap"><table class="pa-tbl pa-compacta pa-estreita"><thead><tr><th>Custo fixo / financeiro</th>'+
    '<th>Previsto<br>'+ano+'</th><th title="Previsto ÷ Receita Prevista">%<br>Rec. Prev.</th><th>Realizado<br>'+periodo+'</th><th title="Realizado ÷ Receita Realizada no mesmo período">%<br>Rec. Real.</th>'+
    '<th title="% da receita total em '+(ano-1)+' (histórico próprio)">%<br>'+(ano-1)+'</th><th title="% realizado '+ano+' − % '+(ano-1)+', em pontos percentuais. Passe o mouse para ver a variação em R$ (ritmo anual).">Var.<br>p.p.</th>'+
    '<th>Ref.<br>Mercado %</th><th title="Ref. Mercado % × Receita Prevista">Mercado<br>R$</th><th>Meta<br>Interna %</th><th title="Meta Interna % × Receita Prevista">Meta<br>R$</th>'+
    '<th title="Previsto − Meta R$: positivo = orçado acima da meta (quanto cortar do orçamento)">Previsto<br>− Meta</th><th style="text-align:center">Status</th></tr></thead><tbody>';
  var mostrou=0;
  ordem.forEach(function(k){
    var L=avalia(linhas[k],metas[k]||{});
    var centros=L.centros.map(function(c){return avalia(c,metas[c.chave]||{});}).sort(function(a,b){return b.real-a.real;});
    var visiveis=soFora?centros.filter(function(c){return c.st==='Fora de controle';}):centros;
    if(soFora&&L.st!=='Fora de controle'&&!visiveis.length)return;
    mostrou++;
    html+='<tr class="sub"><td>'+paEsc(L.nome)+'</td>'+celulas(L,metas[k]||{},k,true)+'</tr>';
    if(!paEstado.sintetico)visiveis.forEach(function(c){html+='<tr class="cc"><td>'+paEsc(c.nome)+'</td>'+celulas(c,metas[c.chave]||{},c.chave,false)+'</tr>';});
  });
  if(!mostrou)html+='<tr><td colspan="13" class="pa-mut" style="text-align:center">Nenhum custo fora de controle.</td></tr>';
  var T=avalia({prev:tot.prev,real:tot.real,ant:tot.ant},{mercado:tot.temMercado?tot.mercado:null,meta:tot.temMeta?tot.meta:null});
  html+='<tr class="conta desp"><td>TOTAL FIXOS + FINANCEIROS</td>'+paCelula(paValor(T.prev))+paCelula(fp(T.pp))+paCelula(paValor(T.real))+paCelula(fp(T.pr),corSt(T.st),600)+paCelula(fp(T.pa))+paCelula(fpp(T.var))+
    paCelula(tot.temMercado?fp(tot.mercado):'—')+paCelula(T.mercRS===null?'—':paValor(T.mercRS))+paCelula(tot.temMeta?fp(tot.meta):'—','',600)+paCelula(T.metaRS===null?'—':paValor(T.metaRS),'',600)+
    paCelula(T.exc===null?'—':paValor(T.exc),T.exc===null?'':(T.exc>0?'var(--red)':'var(--green)'),600)+'<td style="text-align:center">'+paBadgeStatus(T.st)+'</td></tr>';
  html+='</tbody></table></div>';
  html+='<p class="pa-info" style="margin-top:10px">Tabela em R$. A natureza de cada despesa (variável, fixa ou financeira) é definida na <a class="pa-link" onclick="navigatePlanejamento(\'tabela\')">Tabela Contábil</a>. Status: com meta interna — dentro = <b>OK</b> · até 2 p.p. acima = <b>Atenção</b> · mais de 2 p.p. acima = <b>Fora de controle</b>; sem meta — compara com o próprio '+(ano-1)+': subiu mais de 0,5 p.p. = <b>Atenção</b> · mais de 1 p.p. = <b>Fora de controle</b>. Linhas de subconta usam a meta da subconta; centros de custo podem ter meta própria.</p>';
  document.getElementById('pa-root').innerHTML=html;
}

// ─── 9) TUTORIAL ─────────────────────────────────────────────────────
function paTutorial(){
  document.getElementById('pa-root').innerHTML='<div class="card pa-tut" style="max-width:900px">'+
  '<p>O <b>Planejamento Anual</b> organiza o orçamento de <b>Receitas e Despesas</b> da Ciclo da Arte em três níveis: <b>Conta</b> (Receitas/Despesas) → <b>Subconta</b> → <b>Centro de Custo</b>. Os valores do <b>Ano Anterior</b> servem de base; o <b>Ano Exercício</b> é planejado (previsto) e acompanhado mês a mês (realizado).</p>'+
  '<h3>1. Rotina mensal recomendada</h3><ul><li>Feche o mês e gere a planilha de Receitas e de Despesas (uma aba para cada, com "Receita" ou "Despesa" no nome da aba).</li><li>Em <b>Orçamento Realizado</b>, clique em <b>⬆ Importar Excel</b>, escolha o mês e clique em <b>Pré-visualizar</b>.</li><li>Se aparecer <b>centro não encontrado</b>, nada é gravado: cadastre o centro na <b>Tabela Contábil</b> ou crie um <b>apelido</b> e pré-visualize de novo.</li><li>Confirme. A planilha <b>substitui o mês inteiro</b> daquela conta — reimportar é seguro.</li><li>Revise a <b>Provisão Prevista</b> e consulte os painéis de <b>Previsto vs. Realizado</b>.</li></ul>'+
  '<h3>2. Telas</h3><ul>'+
  '<li><b>Tabelas Contábeis</b> — cadastro da hierarquia. Renomeie direto na linha; use <b>Inativar</b> em vez de excluir quando já houver valores. Apelidos de importação ficam no fim da página. Nas despesas, a coluna <b>Natureza</b> define se o custo é variável, fixo ou financeiro (a subconta dá o padrão; o centro pode ter exceção).</li>'+
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
 estrutura:{t:'Estrutura de Custos Fixos',d:'Mede os custos fixos e financeiros contra a receita TOTAL da empresa (não por canal), compara com a referência de mercado e com a meta interna, e testa se as metas fecham a conta.',c:[
  ['Natureza','Cada despesa é variável (acompanha a venda), fixa (estrutura) ou financeira (bancos, juros, empréstimos). Definida na Tabela Contábil: a subconta dá o padrão e o centro de custo pode ter exceção. Só fixas e financeiras aparecem aqui.'],
  ['Previsto / % Receita Prevista','Valor previsto no ano e quanto representa da receita prevista — para planejar.','Previsto da linha ÷ Receita Prevista total × 100'],
  ['Realizado / % Receita Realizada','Valor realizado até o último mês lançado e quanto representa da receita realizada no mesmo período — para acompanhar. Se a receita não vem, o % sobe mesmo com o gasto em R$ dentro do previsto.','Realizado da linha ÷ Receita Realizada total × 100'],
  ['Ref. Mercado % / Meta Interna %','Percentuais editáveis (clique e digite) na subconta e, se quiser, em cada centro de custo. Valem para o ano exibido; um ano sem metas usa as do ano anterior até você editar. Referência de mercado costuma existir só por grupo (folha, ocupação) — nos centros, use principalmente a meta interna.'],
  ['% Ano anterior / Var. p.p.','Quanto a linha pesava na receita total do ano anterior (histórico próprio) e quanto subiu ou caiu, em pontos percentuais. Passe o mouse em Var. p.p. para ver a variação em R$ no ritmo anual — separa o que cresceu de verdade do que só pesou mais porque a receita caiu.','% Rec. Real. − % ano anterior'],
  ['Mercado R$ / Meta R$','Os percentuais convertidos em reais sobre a receita prevista do ano.','% × Receita Prevista'],
  ['Previsto − Meta','Quanto o orçamento da linha está acima (vermelho, quanto cortar) ou abaixo (verde) da meta interna.','Previsto − Meta R$'],
  ['Status','Com meta interna: OK dentro · Atenção até 2 p.p. acima · Fora de controle mais de 2 p.p. acima. Sem meta: compara com o próprio ano anterior — Atenção se subiu mais de 0,5 p.p., Fora de controle se subiu mais de 1 p.p. O botão "Só fora de controle" filtra a tabela.'],
  ['Margem de contribuição','O que sobra da receita depois dos custos variáveis — é o que paga a estrutura.','100% − Custos variáveis ÷ Receita × 100'],
  ['Fechamento das metas','Mostra o resultado (% da receita) se todas as metas internas forem cumpridas. Negativo = mesmo cumprindo as metas, a empresa ainda dá prejuízo.','Margem de contribuição realizada − soma das metas internas'],
  ['Teto de fixos','Quanto os fixos + financeiros podem somar para atingir o lucro desejado (escolha o % na linha de informação).','Margem de contribuição − lucro desejado']]},
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

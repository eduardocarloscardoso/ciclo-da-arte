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
  provisao:    {icon:'🔮', label:'Provisão Prevista', fase:3},
  comparativo: {icon:'📊', label:'Comparativo Mensal', fase:3, grupo:'pxr'},
  trimestral:  {icon:'📅', label:'Visão Trimestral Acumulada', fase:3, grupo:'pxr'},
  anual:       {icon:'📈', label:'Visão Anual Acumulada', fase:3, grupo:'pxr'},
  metas:       {icon:'🏁', label:'Comparativo de Metas', fase:3, grupo:'pxr'},
  tutorial:    {icon:'📘', label:'Tutorial', fase:3}
};
var PA_GRUPOS = {pxr:{icon:'📉', label:'Previsto vs. Realizado'}};
var PA_MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

// Estado da tela (filtros persistem entre páginas do módulo)
var paEstado = {
  page: 'tabela',
  grupoAberto: {pxr:false},
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
function paBRL(v){return paFmtBRL.format(Number(v)||0);}
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
    '.pa-in{width:120px;background:transparent;border:1px solid transparent;border-radius:6px;color:var(--white);text-align:right;font-family:var(--ff-m);font-size:12px;padding:4px 6px}',
    '.pa-in:hover{border-color:var(--border2)}.pa-in:focus{outline:none;border-color:var(--gold);background:var(--navy3)}',
    '.pa-in.salvando{border-color:var(--blue)}.pa-in.ok{border-color:var(--green)}.pa-in.err{border-color:var(--red)}',
    '.pa-in-txt{width:100%;min-width:200px;text-align:left;font-family:var(--ff-b)}',
    '.pa-neg{color:var(--red)}.pa-pos{color:var(--green)}.pa-mut{color:var(--muted)}',
    '.pa-acoes{display:flex;gap:6px;flex-wrap:wrap;margin-left:auto}',
    '.pa-badge{display:inline-block;font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;font-family:var(--ff-b)}',
    '.pa-badge.ok{background:rgba(62,201,122,.15);color:var(--green)}.pa-badge.err{background:rgba(232,51,74,.15);color:var(--red)}.pa-badge.mut{background:var(--card2);color:var(--muted2)}',
    '.pa-modal-wide{width:860px!important}',
    '.pa-prev{max-height:340px;overflow:auto;border:1px solid var(--border);border-radius:8px;margin:12px 0}',
    '.pa-btn-ico{background:none;border:0;color:var(--muted2);cursor:pointer;font-size:13px;padding:2px 5px;border-radius:5px}',
    '.pa-btn-ico:hover{color:var(--white);background:var(--card2)}',
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
  var m={};rows.forEach(function(x){m[x.centro_custo_id]=Number(x.valor_realizado)||0;});return m;
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
function paSoma(lista, f){return lista.reduce(function(a,x){return a+(Number(f(x))||0);},0);}

// ════════════════════════════════════════════════════════════════════
// 1) ORÇAMENTO ANUAL — Realizado (Ano Ant.) | Previsto (Exercício) |
//    Previsto (Mês) | Realizado (Exercício) | Saldo Mensal a Realizar
// ════════════════════════════════════════════════════════════════════
async function paOrcamentoAnual(){
  var ano=paEstado.ano;
  var r=await Promise.all([paCarregarHierarquia(),paAnosDisponiveis(),sb.get('cda_pa_orcamento_previsto','ano=eq.'+ano),paRealizadoAnualMapa(ano),paRealizadoAnualMapa(ano-1),paUltimoMes(ano)]);
  var h=r[0],anos=r[1],prevRows=r[2],realEx=r[3],realAnt=r[4],ultimo=r[5];
  if(anos.indexOf(ano)<0){anos.push(ano);anos.sort();}
  var prev={};prevRows.forEach(function(x){prev[x.centro_custo_id]=Number(x.valor_previsto)||0;});
  var restantes=Math.max(12-ultimo,0);
  function linha(cc){
    var p=prev[cc.id]||0,re=realEx[cc.id]||0;
    return {ant:realAnt[cc.id]||0,prev:p,mes:p/12,real:re,saldoMes:restantes>0?(p-re)/restantes:(p-re)};
  }
  var grupos=paContasFiltradas(h);
  var root=document.getElementById('pa-root');if(!root)return;
  var podeEd=paPodeEditar();
  var html=paFiltroHTML(h,{anos:anos});
  html+='<div class="pa-info">Último mês realizado em '+ano+': <b>'+(ultimo?PA_MESES[ultimo-1]:'nenhum')+'</b> · Meses restantes: <b>'+restantes+'</b> · Saldo Mensal = (Previsto − Realizado) ÷ meses restantes'+(podeEd?' · Clique em um valor previsto para editar':'')+'</div>';

  // Totais gerais para KPIs
  var tot={RECEITAS:{ant:0,prev:0,mes:0,real:0,saldoMes:0},DESPESAS:{ant:0,prev:0,mes:0,real:0,saldoMes:0}};
  h.contas.forEach(function(c){c.subcontas.forEach(function(s){s.centros.forEach(function(cc){var l=linha(cc);['ant','prev','mes','real','saldoMes'].forEach(function(k){tot[c.tipo][k]+=l[k];});});});});
  var resPrev=tot.RECEITAS.prev-tot.DESPESAS.prev,resReal=tot.RECEITAS.real-tot.DESPESAS.real;
  html+='<div class="pa-kpis">'+
    paKpi('Receitas '+ano,'Previsto '+paBRL(tot.RECEITAS.prev),'Realizado '+paBRL(tot.RECEITAS.real),'var(--green)')+
    paKpi('Despesas '+ano,'Previsto '+paBRL(tot.DESPESAS.prev),'Realizado '+paBRL(tot.DESPESAS.real),'var(--red)')+
    paKpi('Resultado (Receita − Despesa)','Previsto '+paBRL(resPrev),'Realizado '+paBRL(resReal),resReal>=0?'var(--blue)':'var(--red)')+
    paKpi('Realizado '+(ano-1),'Receitas '+paBRL(tot.RECEITAS.ant),'Despesas '+paBRL(tot.DESPESAS.ant),'var(--gold2)')+
  '</div>';

  html+='<div class="pa-tbl-wrap"><table class="pa-tbl"><thead><tr><th>Conta / Subconta / Centro de Custo</th><th>Realizado ('+(ano-1)+')</th><th>Previsto ('+ano+')</th><th>Previsto (Mês)</th><th>Realizado ('+ano+')</th><th title="(Previsto − Realizado) ÷ meses restantes">Saldo Mensal a Realizar</th></tr></thead><tbody>';
  function cels(t,campoPrev){return '<td>'+paBRL(t.ant)+'</td><td>'+(campoPrev||paBRL(t.prev))+'</td><td>'+paBRL(t.mes)+'</td><td>'+paBRL(t.real)+'</td><td class="'+(t.saldoMes<0?'pa-neg':'')+'">'+paBRL(t.saldoMes)+'</td>';}
  function somaCentros(lista){var t={ant:0,prev:0,mes:0,real:0,saldoMes:0};lista.forEach(function(cc){var l=linha(cc);for(var k in t)t[k]+=l[k];});return t;}
  grupos.forEach(function(g){
    var c=g.conta,todosCC=[];g.subcontas.forEach(function(s){todosCC=todosCC.concat(s.centros);});
    html+='<tr class="conta '+(c.tipo==='RECEITAS'?'rec':'desp')+'"><td>'+paEsc(c.nome)+'</td>'+cels(somaCentros(todosCC))+'</tr>';
    g.subcontas.forEach(function(s){
      html+='<tr class="sub"><td>'+paEsc(s.nome)+'</td>'+cels(somaCentros(s.centros))+'</tr>';
      if(paEstado.sintetico)return;
      s.centros.forEach(function(cc){
        var l=linha(cc);
        var campo=podeEd?'<input class="pa-in" inputmode="decimal" aria-label="Previsto '+paEsc(cc.nome)+'" value="'+paValorInput(l.prev)+'" data-orig="'+l.prev+'" onfocus="this.select()" onkeydown="if(event.key===\'Enter\')this.blur()" onchange="paSalvarPrevisto(this,'+cc.id+','+ano+')">':null;
        html+='<tr class="cc'+(cc.ativo?'':' inativo')+'"><td>'+paEsc(cc.nome)+(cc.ativo?'':' <span class="pa-badge mut">inativo</span>')+'</td>'+cels(l,campo)+'</tr>';
      });
    });
  });
  if(!paEstado.subcontaId&&!paEstado.tipo){
    html+='<tr class="total"><td>Total Receitas</td>'+cels(tot.RECEITAS)+'</tr><tr class="total"><td>Total Despesas</td>'+cels(tot.DESPESAS)+'</tr>';
    var res={};for(var k in tot.RECEITAS)res[k]=tot.RECEITAS[k]-tot.DESPESAS[k];
    html+='<tr class="resultado"><td>Resultado Líquido (Receitas − Despesas)</td>'+cels(res)+'</tr>';
  }
  html+='</tbody></table></div>';
  root.innerHTML=html;
}
function paKpiValores(txt){return paEsc(txt).replace(/-?R\$[\s\u00a0]?[\d.,]+/g,function(m){return '<span style="white-space:nowrap">'+m+'</span>';});}
function paKpi(t,v,s,cor){return '<div class="pa-kpi" style="border-top:3px solid '+cor+'"><div class="t">'+paEsc(t)+'</div><div class="v">'+paKpiValores(v)+'</div><div class="s">'+paKpiValores(s)+'</div></div>';}

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
    '<p class="pa-info" style="margin:6px 0 14px">A planilha <b>substitui o mês inteiro</b> da conta (Receitas ou Despesas). Abas com "Receita" ou "Despesa" no nome são reconhecidas automaticamente. Formatos aceitos: <b>Centro de Custo | Valor</b> ou <b>Vendedor … Total Venda</b>. Se algum centro não for encontrado, <b>nada é gravado</b>.</p>'+
    '<div class="pa-filtros"><label>Ano<input type="number" id="pa-imp-ano" value="'+paEstado.ano+'" style="width:100px"></label><label>Mês<select id="pa-imp-mes">'+mesOpts+'</select></label>'+
    '<label>Tipo (se a aba não indicar)<select id="pa-imp-tipo"><option value="">Pela aba</option><option value="RECEITAS">Receitas</option><option value="DESPESAS">Despesas</option></select></label>'+
    '<label>Arquivo<input type="file" id="pa-imp-arq" accept=".xls,.xlsx"></label></div>'+
    '<div id="pa-imp-res" aria-live="polite"></div>'+
    '<div class="modal-actions" style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px"><button class="btn btn-ghost" onclick="closeModal()">Fechar</button><button class="btn btn-ghost" onclick="paImportarPrevia()">🔍 Pré-visualizar</button><button class="btn btn-primary" id="pa-imp-ok" disabled onclick="paImportarConfirmar()">Importar / Substituir mês</button></div></div>');
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
  var res=document.getElementById('pa-imp-res');document.getElementById('pa-imp-ok').disabled=true;
  if(!arq){showToast('Escolha o arquivo Excel','info');return;}
  var ano=+document.getElementById('pa-imp-ano').value,mes=+document.getElementById('pa-imp-mes').value,tipoF=document.getElementById('pa-imp-tipo').value;
  res.innerHTML='<div class="card">Lendo planilha…</div>';
  try{
    var blocos=await paLerPlanilha(arq,tipoF);
    if(!blocos.length){res.innerHTML='<div class="card">Nenhuma aba de <b>Receita</b> ou <b>Despesa</b> encontrada. Renomeie a aba ou escolha o tipo.</div>';return;}
    var html='',ok=true;
    for(var i=0;i<blocos.length;i++){
      var b=blocos[i];
      var r=await paRpc('cda_pa_importar_mes',{p_ano:ano,p_mes:mes,p_tipo:b.tipo,p_linhas:b.linhas,p_layout_vendedor:b.vendedor,p_simular:true});
      b.resultado=r;
      var ne=r.nao_encontrados||[],ot=r.de_outro_tipo||[];
      if(ne.length||ot.length)ok=false;
      html+='<div class="card" style="margin-top:10px"><div class="card-title">'+(b.tipo==='RECEITAS'?'🟢 Receitas':'🔴 Despesas')+' — aba(s): '+paEsc(b.abas.join(', '))+(b.vendedor?' · layout Vendedor':'')+'</div>'+
        '<div style="display:flex;gap:16px;flex-wrap:wrap;font-size:12.5px;margin-bottom:6px"><span>Linhas: <b>'+r.linhas+'</b></span><span>Subtotais ignorados: <b>'+r.subtotais_ignorados+'</b></span><span>Total a gravar: <b>'+paBRL(r.total_valor)+'</b></span></div>'+
        (ne.length?'<div class="pa-neg" style="font-size:12.5px;margin:6px 0">❌ Centros não encontrados ('+ne.length+'): '+ne.map(paEsc).join(' · ')+'<br><span class="pa-mut">Cadastre-os na Tabela Contábil ou crie um apelido, e pré-visualize de novo.</span></div>':'')+
        (ot.length?'<div class="pa-neg" style="font-size:12.5px;margin:6px 0">❌ Centros de outro tipo nesta aba: '+ot.map(paEsc).join(' · ')+'</div>':'')+
        '<div class="pa-prev"><table class="pa-tbl"><thead><tr><th>Linha</th><th style="text-align:left">Nome na planilha</th><th>Valor</th><th>Status</th></tr></thead><tbody>'+
        (r.previa||[]).map(function(p){var st=p.status==='ok'?'<span class="pa-badge ok">ok</span>':p.status==='subtotal'?'<span class="pa-badge mut">subtotal</span>':'<span class="pa-badge err">não encontrado</span>';
          return '<tr><td>'+p.linha+'</td><td style="text-align:left;font-family:var(--ff-b)">'+paEsc(p.nome)+'</td><td>'+paBRL(p.valor)+'</td><td>'+st+'</td></tr>';}).join('')+
        '</tbody></table></div></div>';
    }
    paImport={ano:ano,mes:mes,blocos:blocos};
    res.innerHTML=html+(ok?'<p class="pa-pos" style="margin-top:10px;font-size:13px">✓ Tudo pronto. Ao confirmar, '+PA_MESES[mes-1]+'/'+ano+' de '+blocos.map(function(b){return b.tipo==='RECEITAS'?'Receitas':'Despesas';}).join(' e ')+' será substituído.</p>':'');
    document.getElementById('pa-imp-ok').disabled=!ok;
  }catch(e){res.innerHTML='<div class="card">Não foi possível ler/validar a planilha.</div>';paErro(e,'Falha na pré-visualização');}
}
async function paImportarConfirmar(){
  if(!paImport||!paPodeEditar())return;
  var btn=document.getElementById('pa-imp-ok');btn.disabled=true;btn.textContent='Importando…';
  var msgs=[];
  try{
    for(var i=0;i<paImport.blocos.length;i++){
      var b=paImport.blocos[i];
      var r=await paRpc('cda_pa_importar_mes',{p_ano:paImport.ano,p_mes:paImport.mes,p_tipo:b.tipo,p_linhas:b.linhas,p_layout_vendedor:b.vendedor,p_simular:false});
      if(!r.gravado)throw new Error('Validação falhou em '+b.tipo);
      msgs.push((b.tipo==='RECEITAS'?'Receitas':'Despesas')+': '+r.gravados+' centros gravados ('+r.removidos+' substituídos)');
    }
    closeModal();showToast('Importação concluída — '+msgs.join(' · '),'success');
    paEstado.ano=paImport.ano;paEstado.mes=paImport.mes;navigatePlanejamento('realizado');
  }catch(e){btn.disabled=false;btn.textContent='Importar / Substituir mês';paErro(e,'Falha na importação'+(msgs.length?' (já gravado: '+msgs.join('; ')+')':''));}
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
  html+='<div class="pa-tbl-wrap"><table class="pa-tbl"><thead><tr><th>Conta / Subconta / Centro de Custo</th><th style="text-align:center">Situação</th><th style="text-align:center">Ações</th></tr></thead><tbody>';
  paContasFiltradas(h).forEach(function(g){
    var c=g.conta;
    html+='<tr class="conta '+(c.tipo==='RECEITAS'?'rec':'desp')+'"><td>'+paEsc(c.nome)+' <span class="pa-badge mut">'+c.tipo+'</span></td><td></td><td></td></tr>';
    g.subcontas.forEach(function(s){
      var centros=s.centros.filter(function(x){return !b||paNorm(x.nome).indexOf(b)>=0||paNorm(s.nome).indexOf(b)>=0;});
      if(b&&!centros.length&&paNorm(s.nome).indexOf(b)<0)return;
      html+='<tr class="sub"><td>'+(podeEd?'<input class="pa-in pa-in-txt" value="'+paEsc(s.nome)+'" data-orig="'+paEsc(s.nome)+'" aria-label="Nome da subconta" onkeydown="if(event.key===\'Enter\')this.blur()" onchange="paRenomear(this,\'cda_pa_subconta\','+s.id+')">':paEsc(s.nome))+'</td>'+
        '<td style="text-align:center">'+paBadgeAtivo(s.ativo)+'</td><td style="text-align:center">'+paAcoesLinha('cda_pa_subconta',s.id,s.ativo,podeEd,adm)+'</td></tr>';
      if(paEstado.sintetico)return;
      centros.forEach(function(x){
        html+='<tr class="cc'+(x.ativo?'':' inativo')+'"><td>'+(podeEd?'<input class="pa-in pa-in-txt" value="'+paEsc(x.nome)+'" data-orig="'+paEsc(x.nome)+'" aria-label="Nome do centro de custo" onkeydown="if(event.key===\'Enter\')this.blur()" onchange="paRenomear(this,\'cda_pa_centro_custo\','+x.id+')">':paEsc(x.nome))+'</td>'+
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

// ════════════════════════════════════════════════════════════════════
// Módulo Calendário — Calendário Comercial (eventos e ações)
// Projeto "Calendário" da barra lateral. Fatia 1 (30/10/2026): cadastro de
// eventos, lista com filtros, importação da planilha Excel e Tutorial.
// Fatias seguintes: motor de projeção (2), Simulações no Planejamento (3),
// visão mensal e realizado automático (4).
// 31/10/2026: Campanhas (nível macro que agrupa eventos, ex.: Black Friday / Natal 2026) e
// Segmento Varejo/Atacado herdado do grupo do canal (cda_grupo.segmento).
// Usa os estilos pa-* do Planejamento Anual (injetados por cda-modulo-planejamento.js).
// ════════════════════════════════════════════════════════════════════
var CAL_PROJETO = 'calendario';
var CAL_PAGES = { eventos: { icon: '📅', label: 'Calendário Comercial' } };
var CAL_MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
var CAL_CRITERIOS = ['Unidades','Pedidos','A definir'];
var CAL_STATUS = ['Planejado','A confirmar','A definir','Confirmado','Realizado','Cancelado'];
var CAL_CAMP_STATUS = ['Planejada','Em andamento','Encerrada','Cancelada'];
var CAL_SEGMENTOS = { varejo: 'Varejo', atacado: 'Atacado' };
var calEstado = { page: 'eventos', ano: new Date().getFullYear(), mes: '', vinculo: '', status: '', campanha: '', segmento: '' };
var calCache = { eventos: [], grupos: [], centros: [], campanhas: [], centroGrupo: {} };
var calImport = null;
var calPrev = null; // previsão do evento aberto no cadastro (31/10/2026)
var CAL_OBRIGA_PREV = ['Planejado','A confirmar','Confirmado'];
(function calEstilos(){
  if(document.getElementById('cal-estilos'))return;
  var st=document.createElement('style');st.id='cal-estilos';
  st.textContent='.pa-lbl-bloco{display:flex;flex-direction:column;gap:4px;font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin-top:10px}'+
    '.cal-tbl th:first-child,.cal-tbl td:first-child{min-width:0!important;padding-left:10px!important;white-space:nowrap}.cal-tbl td{font-family:var(--ff-b)}.cal-tbl td:last-child{font-family:var(--ff-m)}.cal-tbl tbody tr:hover td{background:var(--card2)}'+
    '.cal-seg{display:inline-block;padding:1px 7px;border-radius:9px;font:700 10px var(--ff-m);letter-spacing:.06em}.cal-seg.vj{background:rgba(80,160,255,.14);color:var(--blue)}.cal-seg.at{background:rgba(200,160,60,.16);color:var(--gold2)}'+
    '.cal-camp-tag{display:block;font:400 10.5px var(--ff-b);color:var(--muted2);margin-top:2px}'+
    '.cal-prev{margin-top:14px;display:flex;align-items:center;gap:16px;flex-wrap:wrap;padding:14px 16px;border-radius:12px;border:1px solid rgba(201,148,58,.55);background:linear-gradient(135deg,rgba(201,148,58,.14),rgba(74,158,255,.06))}'+
    '.cal-prev .t{font:700 10px var(--ff-b);letter-spacing:.12em;text-transform:uppercase;color:var(--gold)}.cal-prev .v{font:700 24px var(--ff-m);color:var(--white);margin-top:2px}.cal-prev .d{font-size:12px;color:var(--muted2);margin-top:2px}'+
    '.cal-prev.pend{border-color:rgba(232,51,74,.7);background:linear-gradient(135deg,rgba(232,51,74,.14),rgba(201,148,58,.06))}'+
    '.cal-pst{display:inline-block;padding:2px 9px;border-radius:9px;font:700 10.5px var(--ff-b)}.cal-pst.ok{background:rgba(62,201,122,.15);color:var(--green)}.cal-pst.sug{background:rgba(240,192,96,.16);color:var(--gold2)}.cal-pst.pen{background:rgba(232,51,74,.16);color:#ff8a98}.cal-pst.inf{background:var(--card2);color:var(--muted2)}'+
    '.cal-btn-prev{background:var(--gold);color:#111;border:0;border-radius:10px;padding:11px 18px;font:700 13px var(--ff-b);cursor:pointer;margin-left:auto}.cal-btn-prev:hover{filter:brightness(1.1)}'+
    '.cal-ov{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:1100;display:flex;justify-content:flex-end}'+
    '.cal-tot{font:700 22px var(--ff-m);color:var(--gold2)}.cal-tbl-hist td,.cal-tbl-hist th{white-space:nowrap;padding-left:6px!important;padding-right:6px!important;font-size:11.5px}.cal-tbl-hist th:first-child,.cal-tbl-hist td:first-child{min-width:0!important}.cal-tbl-hist tr.cons td{color:var(--muted)}.cal-tbl-hist tr.ref td{background:rgba(201,148,58,.10)}'+
    '.pa-lbl-bloco textarea{background:var(--navy2);color:var(--white);border:1px solid var(--border2);border-radius:8px;padding:8px 10px;font:13px var(--ff-b);text-transform:none;letter-spacing:0;resize:vertical}';
  document.head.appendChild(st);
})();

function calEsc(v){return String(v===null||v===undefined?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function calNorm(s){return String(s||'').trim().toLowerCase().replace(/\s+/g,' ').normalize('NFD').replace(/[̀-ͯ]/g,'');}
function calBRL(v){return (Number(v)||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});}
function calNum(raw){
  if(raw===null||raw===undefined||raw==='')return null;
  if(typeof raw==='number')return raw;
  var t=String(raw).trim().replace(/R\$\s*/gi,'').replace(/\s/g,'');if(!t)return null;
  var n=t.indexOf(',')>=0?t.replace(/\./g,'').replace(',','.'):t;n=parseFloat(n);return isNaN(n)?null:n;
}
function calPodeLer(){return typeof canAccessProject==='function'&&canAccessProject(CAL_PROJETO);}
function calPodeEditar(){return calPodeLer()&&!isReadOnly()&&(typeof podeEscreverSubmodulo!=='function'||podeEscreverSubmodulo(CAL_PROJETO,'eventos'));}
function calErro(e,padrao){
  var m=e&&e.response&&e.response.data&&(e.response.data.message||e.response.data.hint||e.response.data.details);
  console.error('[Calendário]',e);showToast(m||padrao,'error');
}
function calDataBR(d){if(!d)return '';var p=String(d).slice(0,10).split('-');return p[2]+'/'+p[1];}
function calDataBRAno(d){if(!d)return '';var p=String(d).slice(0,10).split('-');return p[2]+'/'+p[1]+'/'+p[0];}
function calIsoData(v){
  if(!v)return null;
  if(v instanceof Date&&!isNaN(v))return v.getFullYear()+'-'+String(v.getMonth()+1).padStart(2,'0')+'-'+String(v.getDate()).padStart(2,'0');
  var s=String(v).trim(),m;
  if((m=s.match(/^(\d{4})-(\d{2})-(\d{2})/)))return m[1]+'-'+m[2]+'-'+m[3];
  if((m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)))return m[3]+'-'+String(m[2]).padStart(2,'0')+'-'+String(m[1]).padStart(2,'0');
  return null;
}

// ─── Sidebar e navegação ─────────────────────────────────────────────
function calRenderSidebar(nav){
  nav.innerHTML+='<div class="sb-section">Calendário</div>';
  Object.keys(CAL_PAGES).forEach(function(id){var p=CAL_PAGES[id];
    nav.innerHTML+='<div class="nav-item '+(calEstado.page===id?'active':'')+'" id="nav-cal-'+id+'" onclick="navigateCalendario(\''+id+'\')" style="padding-left:32px;font-size:11.5px"><span class="nav-icon">'+p.icon+'</span>'+p.label+'</div>';});
}
async function navigateCalendario(page){
  if(!calPodeLer()){showToast('Seu usuário não tem acesso ao Calendário.','info');return;}
  if(!CAL_PAGES[page])page='eventos';
  currentProject=CAL_PROJETO;calEstado.page=page;renderSidebarNav();
  var iframeWrap=document.getElementById('financeiro-iframe-wrap');if(iframeWrap)iframeWrap.style.display='none';
  var p=CAL_PAGES[page];
  document.getElementById('page-title').textContent='Calendário · '+p.label;
  var banner=isReadOnly()?'<div class="readonly-banner">👁 Modo somente leitura — você pode consultar, mas não alterar.</div>':'';
  document.getElementById('main-content').innerHTML=banner+'<div class="ph"><h1>'+p.icon+' '+p.label+'</h1><p>Calendário · Eventos e ações comerciais</p></div><div id="cal-root"><div class="card">Carregando…</div></div>';
  try{await calCarregar();if(document.getElementById('cal-root'))calRenderEventos();}
  catch(e){var r0=document.getElementById('cal-root');if(!r0)return;r0.innerHTML='<div class="card">Não foi possível carregar o calendário. Atualize a página e tente novamente.</div>';calErro(e,'Falha ao carregar o Calendário');}
}

// ─── Dados ───────────────────────────────────────────────────────────
async function calCarregar(){
  var r=await Promise.all([
    sb.get('cda_cal_evento','order=inicio.asc.nullslast,id.asc'),
    sb.get('cda_grupo','tipo=eq.Receita&order=ordem,nome'),
    sb.get('cda_pa_v_hierarquia','tipo=eq.RECEITAS&ativo=eq.true&order=subconta_ordem,centro_ordem'),
    sb.get('cda_cal_campanha','order=inicio.desc,id.desc'),
    sb.get('cda_pa_centro_custo','select=id,grupo_id')
  ]);
  calCache.eventos=r[0]||[];calCache.gruposTodos=r[1]||[];calCache.grupos=calCache.gruposTodos.filter(function(g){return g.ativo!==false;});
  calCache.centros=(r[2]||[]).map(function(h){return {id:h.centro_custo_id,nome:h.centro_nome,sub:h.subconta_nome};});
  calCache.campanhas=r[3]||[];
  calCache.centroGrupo={};(r[4]||[]).forEach(function(c){if(c.grupo_id)calCache.centroGrupo[String(c.id)]=c.grupo_id;});
}
// Segmento (Varejo / Atacado): vem do grupo — do próprio evento (▦) ou do grupo do centro (canal).
function calGrupoDoEvento(ev){
  var gid=ev.grupo_id||(ev.centro_custo_id?calCache.centroGrupo[String(ev.centro_custo_id)]:null);if(!gid)return null;
  return (calCache.gruposTodos||calCache.grupos).find(function(g){return String(g.id)===String(gid);})||null;
}
function calSegmento(ev){var g=calGrupoDoEvento(ev);if(!g)return '';return g.segmento||'varejo';}
function calSegHTML(ev){
  var g=calGrupoDoEvento(ev);if(!g)return '<span class="pa-mut">—</span>';
  var s=g.segmento||'varejo';
  return '<span class="cal-seg '+(s==='atacado'?'at':'vj')+'" title="Grupo: '+calEsc(g.nome)+(g.segmento?'':' (sem segmento no grupo — tratado como Varejo)')+'">'+(s==='atacado'?'AT':'VJ')+(g.segmento?'':'?')+'</span>';
}
function calCampanha(id){return id?calCache.campanhas.find(function(c){return String(c.id)===String(id);})||null:null;}
// Campanha cujo período contém a data (ou o mês, para eventos sem data)
function calCampanhaPorData(iso,ano,mes){
  return calCache.campanhas.find(function(c){
    if(c.status==='Cancelada')return false;
    if(iso)return iso>=String(c.inicio).slice(0,10)&&iso<=String(c.fim).slice(0,10);
    if(ano&&mes){var ini=ano+'-'+String(mes).padStart(2,'0');return ini>=String(c.inicio).slice(0,7)&&ini<=String(c.fim).slice(0,7);}
    return false;
  })||null;
}
function calOpcoesCampanha(sel){
  return '<option value="">— sem campanha —</option>'+calCache.campanhas.map(function(c){return '<option value="'+c.id+'"'+(String(c.id)===String(sel||'')?' selected':'')+'>🏷 '+calEsc(c.nome)+(c.status==='Encerrada'||c.status==='Cancelada'?' ('+c.status.toLowerCase()+')':'')+'</option>';}).join('');
}
function calVinculoValor(ev){return ev.centro_custo_id?'c:'+ev.centro_custo_id:(ev.grupo_id?'g:'+ev.grupo_id:'');}
function calVinculoHTML(ev){
  if(ev.centro_custo_id){var c=calCache.centros.find(function(x){return String(x.id)===String(ev.centro_custo_id);});return calEsc(c?c.nome:'#'+ev.centro_custo_id);}
  if(ev.grupo_id){var g=calCache.grupos.find(function(x){return String(x.id)===String(ev.grupo_id);});var n=g?g.nome:'#'+ev.grupo_id;
    return '<span title="Grupo: todos os canais de '+calEsc(n)+'">▦ '+calEsc(n)+'</span>';}
  return '<span class="pa-mut">a definir</span>';
}
function calOpcoesVinculo(sel){
  var h='<option value="">— a definir —</option><optgroup label="Grupos (todos os canais do grupo)">'+
    calCache.grupos.map(function(g){var v='g:'+g.id;return '<option value="'+v+'"'+(v===sel?' selected':'')+'>▦ '+calEsc(g.nome)+'</option>';}).join('')+'</optgroup>';
  var subs={};calCache.centros.forEach(function(c){(subs[c.sub]=subs[c.sub]||[]).push(c);});
  Object.keys(subs).forEach(function(s){
    h+='<optgroup label="'+calEsc(s)+'">'+subs[s].map(function(c){var v='c:'+c.id;return '<option value="'+v+'"'+(v===sel?' selected':'')+'>'+calEsc(c.nome)+'</option>';}).join('')+'</optgroup>';
  });
  return h;
}

// ─── Lista de eventos ────────────────────────────────────────────────
function calFiltrados(){
  return calCache.eventos.filter(function(e){
    if(calEstado.campanha==='nenhuma'){if(e.campanha_id)return false;}
    else if(calEstado.campanha){if(String(e.campanha_id)!==String(calEstado.campanha))return false;}
    if(!calEstado.campanha||calEstado.campanha==='nenhuma'){if(+e.ano!==+calEstado.ano)return false;}
    if(calEstado.segmento&&calSegmento(e)!==calEstado.segmento)return false;
    if(calEstado.mes==='nd'&&e.inicio)return false;
    if(calEstado.mes&&calEstado.mes!=='nd'&&+e.mes!==+calEstado.mes)return false;
    if(calEstado.vinculo&&calVinculoValor(e)!==calEstado.vinculo)return false;
    if(calEstado.status&&e.status!==calEstado.status)return false;
    return true;
  });
}
function calBadgeStatus(s){
  var cor={'Planejado':'ok','Confirmado':'ok','Realizado':'ok','A confirmar':'warn','A definir':'warn','Cancelado':'err'}[s]||'mut';
  return '<span class="pa-badge '+(cor==='warn'?'pa-st-warn':cor==='ok'?'pa-st-ok':cor)+'">'+calEsc(s)+'</span>';
}
function calRenderEventos(){
  var ed=calPodeEditar(),anos={};
  calCache.eventos.forEach(function(e){anos[e.ano]=1;});anos[calEstado.ano]=1;anos[new Date().getFullYear()]=1;
  var lista=calFiltrados();
  var usados={};calCache.eventos.filter(function(e){return calEstado.campanha&&calEstado.campanha!=='nenhuma'?String(e.campanha_id)===String(calEstado.campanha):+e.ano===+calEstado.ano;}).forEach(function(e){var v=calVinculoValor(e);if(v)usados[v]=calVinculoHTML(e).replace(/<[^>]+>/g,'');});
  var sel=function(id,label,opts,val,onch){return '<label>'+label+'<select id="'+id+'" onchange="'+onch+'">'+opts.map(function(o){return '<option value="'+calEsc(o[0])+'"'+(String(o[0])===String(val)?' selected':'')+'>'+calEsc(o[1])+'</option>';}).join('')+'</select></label>';};
  var campSel=calCampanha(calEstado.campanha);
  var h='<div class="pa-filtros">'+
    sel('cal-f-camp','Campanha',[['','Todas'],['nenhuma','Sem campanha']].concat(calCache.campanhas.map(function(c){return [c.id,'🏷 '+c.nome];})),calEstado.campanha,'calEstado.campanha=this.value;calRenderEventos()')+
    (campSel?'':sel('cal-f-ano','Ano',Object.keys(anos).sort().map(function(a){return [a,a];}),calEstado.ano,'calEstado.ano=+this.value;calRenderEventos()'))+
    sel('cal-f-mes','Mês',[['','Todos'],['nd','Sem data (a definir)']].concat(CAL_MESES.map(function(m,i){return [i+1,m];})),calEstado.mes,'calEstado.mes=this.value;calRenderEventos()')+
    sel('cal-f-vinc','Canal / Grupo',[['','Todos']].concat(Object.keys(usados).sort(function(a,b){return usados[a].localeCompare(usados[b]);}).map(function(v){return [v,usados[v]];})),calEstado.vinculo,'calEstado.vinculo=this.value;calRenderEventos()')+
    sel('cal-f-seg','Segmento',[['','Todos'],['varejo','Varejo'],['atacado','Atacado']],calEstado.segmento,'calEstado.segmento=this.value;calRenderEventos()')+
    sel('cal-f-st','Status',[['','Todos']].concat(CAL_STATUS.map(function(s){return [s,s];})),calEstado.status,'calEstado.status=this.value;calRenderEventos()')+
    '<div class="pa-acoes" style="margin-left:auto;display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end">'+
      (ed?'<button class="btn btn-primary btn-sm" onclick="calAbrirEvento(null)">+ Novo evento</button><button class="btn btn-ghost btn-sm" onclick="calAbrirImportacao()">⬆ Importar Excel</button>':'')+
      '<button class="btn btn-ghost btn-sm" onclick="calAbrirCampanhas()">🏷 Campanhas</button>'+
      '<button class="btn btn-ghost btn-sm" onclick="calTutorial()">ℹ️ Tutorial Informativo</button></div></div>';
  var pend=lista.filter(function(e){return e.status==='A confirmar'||e.status==='A definir';}).length;
  var proj=lista.reduce(function(s,e){return s+(Number(e.projecao)||0);},0),real=lista.reduce(function(s,e){return s+(Number(e.realizado)||0);},0);
  var temProj=lista.some(function(e){return e.projecao!==null&&e.projecao!==undefined;}),temReal=lista.some(function(e){return e.realizado!==null&&e.realizado!==undefined;});
  var projSeg={varejo:0,atacado:0};lista.forEach(function(e){var s=calSegmento(e);if(s&&e.projecao!==null&&e.projecao!==undefined)projSeg[s]+=Number(e.projecao)||0;});
  if(campSel)h+='<div class="pa-info" style="margin:4px 0 10px">🏷 <b>'+calEsc(campSel.nome)+'</b> · '+calDataBRAno(campSel.inicio)+' a '+calDataBRAno(campSel.fim)+' · '+calEsc(campSel.status)+(campSel.objetivo?' — '+calEsc(campSel.objetivo):'')+'</div>';
  var semSeg=(calCache.grupos||[]).filter(function(g){return !g.segmento;});
  if(semSeg.length)h+='<p class="pa-info" style="margin:4px 0 10px;color:var(--gold2)">⚠ Grupo(s) de receita sem Segmento: '+semSeg.map(function(g){return calEsc(g.nome);}).join(', ')+' — tratados como Varejo. Defina em Planejamento › Tabela de Grupos (Grupos de Receita).</p>';
  h+='<div class="pa-kpis pa-kpis-mini">'+
    paKpi('Eventos',String(lista.length),'','var(--gold)')+
    paKpi('A confirmar / A definir',String(pend),'','var(--gold)')+
    paKpi('Previsões a revisar',String(lista.filter(calPrevARevisar).length),'sugeridas ou pendentes','var(--red)')+
    paKpi('Projeção',temProj?calBRL(proj):'—','','var(--blue)')+
    paKpi('Projeção Varejo',temProj?calBRL(projSeg.varejo):'—','','var(--blue)')+
    paKpi('Projeção Atacado',temProj?calBRL(projSeg.atacado):'—','','var(--gold2)')+
    paKpi('Realizado',temReal?calBRL(real):'— (fatia 4)','','var(--green)')+'</div>';
  if(!lista.length){
    h+='<div class="card">Nenhum evento '+(calCache.eventos.length?'com estes filtros.':'cadastrado ainda. Use <b>⬆ Importar Excel</b> para carregar a planilha do calendário ou <b>+ Novo evento</b>.')+'</div>';
  }else{
    h+='<div class="pa-tbl-wrap"><table class="pa-tbl pa-compacta cal-tbl"><thead><tr><th style="text-align:left">Início</th><th style="text-align:left">Fim</th><th style="text-align:left">Evento / oportunidade</th><th style="text-align:left">Collab / marca</th><th style="text-align:left">Canal / Grupo</th><th title="Varejo (VJ) ou Atacado (AT) — vem do grupo do canal">Seg.</th><th style="text-align:left">Critério</th><th style="text-align:left">Ação IA projetada</th><th>Status</th><th>Projeção</th></tr></thead><tbody>'+
      lista.map(function(e){
        var ini=e.inicio?calDataBR(e.inicio):(e.mes?CAL_MESES[e.mes-1].slice(0,3).toLowerCase():'a definir');
        return '<tr'+(ed?' style="cursor:pointer" onclick="calAbrirEvento('+e.id+')" title="Clique para editar"':'')+'><td style="text-align:left">'+ini+'</td><td style="text-align:left">'+calDataBR(e.fim)+'</td>'+
          '<td style="text-align:left;font-weight:600;white-space:normal">'+calEsc(e.evento)+(!campSel&&calCampanha(e.campanha_id)?'<span class="cal-camp-tag">🏷 '+calEsc(calCampanha(e.campanha_id).nome)+'</span>':'')+'</td><td style="text-align:left;white-space:normal">'+calEsc(e.collab)+'</td>'+
          '<td style="text-align:left;white-space:normal">'+calVinculoHTML(e)+'</td><td style="text-align:center">'+calSegHTML(e)+'</td><td style="text-align:left">'+calEsc(e.criterio)+'</td>'+
          '<td style="text-align:left;white-space:normal;max-width:340px;color:var(--gold2);font-family:var(--ff-b);font-size:11.5px">'+calEsc(e.acao_ia)+'</td>'+
          '<td style="text-align:center">'+calBadgeStatus(e.status)+'</td><td'+(e.memoria_projecao?' title="'+calEsc(e.memoria_projecao)+'" style="cursor:help;text-decoration:underline dotted"':'')+'>'+(e.projecao!==null&&e.projecao!==undefined?calBRL(e.projecao):'—')+calPrevSelo(e,true)+'</td></tr>';
      }).join('')+'</tbody></table></div>';
  }
  var root=document.getElementById('cal-root');if(root)root.innerHTML=h;
}

// ─── Cadastro / edição ───────────────────────────────────────────────
function calAbrirEvento(id){
  if(!calPodeEditar())return;
  var campPadrao=calEstado.campanha&&calEstado.campanha!=='nenhuma'?calEstado.campanha:'';
  var e=id?calCache.eventos.find(function(x){return String(x.id)===String(id);}):{ano:calEstado.ano,criterio:'Unidades',status:'Planejado',campanha_id:campPadrao};
  if(!e)return;
  calPrev={id:id||null,crit:e.criterio||'Unidades',qtd:e.qtd_prevista,ticket:e.ticket_medio,publico:e.publico_previsto,projecao:e.projecao,status:e.projecao_status||'pendente',memoria:e.memoria_projecao||null,por:e.projecao_por||null,em:e.projecao_em||null};
  var opt=function(lst,v){return lst.map(function(o){return '<option'+(o===v?' selected':'')+'>'+calEsc(o)+'</option>';}).join('');};
  var inp=function(id,lab,val,tipo,extra){return '<label>'+lab+'<input id="'+id+'" type="'+(tipo||'text')+'" value="'+calEsc(val===null||val===undefined?'':val)+'"'+(extra||'')+'></label>';};
  openModal('<div class="modal-box pa-modal-wide" onclick="event.stopPropagation()"><div class="modal-title">'+(id?'✏️ Editar evento':'+ Novo evento')+'</div>'+
    '<div class="pa-filtros" style="flex-wrap:wrap">'+
      inp('cal-e-ini','Início',e.inicio?String(e.inicio).slice(0,10):'','date')+inp('cal-e-fim','Fim',e.fim?String(e.fim).slice(0,10):'','date')+
      '<label>Mês (sem data)<select id="cal-e-mes"><option value="">—</option>'+CAL_MESES.map(function(m,i){return '<option value="'+(i+1)+'"'+(+e.mes===i+1?' selected':'')+'>'+m+'</option>';}).join('')+'</select></label>'+
      inp('cal-e-ano','Ano',e.ano||calEstado.ano,'number',' style="width:90px"')+
    '</div><div class="pa-filtros" style="flex-wrap:wrap">'+
      '<label style="flex:2 1 260px">Evento / oportunidade *<input id="cal-e-ev" value="'+calEsc(e.evento)+'"></label>'+inp('cal-e-col','Collab / marca',e.collab)+
      '<label style="flex:1 1 220px">Campanha<select id="cal-e-camp">'+calOpcoesCampanha(e.campanha_id)+'</select></label>'+
    '</div><div class="pa-filtros" style="flex-wrap:wrap">'+
      '<label style="flex:2 1 260px">Canal / Grupo<select id="cal-e-vinc">'+calOpcoesVinculo(calVinculoValor(e))+'</select></label>'+
      '<label>Critério<select id="cal-e-crit" onchange="var b=document.getElementById(\'cal-e-prev\');if(b)b.innerHTML=calPrevBloco();">'+opt(CAL_CRITERIOS,e.criterio)+'</select></label>'+
      '<label>Status<select id="cal-e-st">'+opt(CAL_STATUS,e.status)+'</select></label>'+
    '</div><div class="pa-filtros" style="flex-wrap:wrap">'+
      '<label style="flex:1 1 220px">Local<input id="cal-e-loc" value="'+calEsc(e.local)+'"></label>'+
    '</div>'+
    '<label class="pa-lbl-bloco">Ação IA projetada<textarea id="cal-e-acao" rows="2">'+calEsc(e.acao_ia)+'</textarea></label>'+
    '<label class="pa-lbl-bloco">Observações<textarea id="cal-e-obs" rows="2">'+calEsc(e.observacoes)+'</textarea></label>'+
    '<div id="cal-e-prev">'+calPrevBloco()+'</div>'+
    '<div class="modal-actions" style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">'+
      (id?'<button class="btn btn-danger btn-sm" style="margin-right:auto" onclick="calExcluirEvento('+id+')">🗑 Excluir</button>':'')+
      '<button class="btn btn-ghost" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" onclick="calSalvarEvento('+(id||'null')+')">Salvar</button></div></div>');
}
async function calSalvarEvento(id){
  if(!calPodeEditar())return;
  var g=function(x){return document.getElementById(x).value;};
  var ev=g('cal-e-ev').trim();if(!ev){showToast('Informe o nome do evento.','error');return;}
  var ini=g('cal-e-ini')||null,fim=g('cal-e-fim')||null;
  if(ini&&fim&&fim<ini){showToast('A data de fim é anterior ao início.','error');return;}
  var v=g('cal-e-vinc'),b={
    evento:ev,collab:g('cal-e-col').trim()||null,inicio:ini,fim:fim,
    ano:+g('cal-e-ano')||calEstado.ano,mes:ini?null:(+g('cal-e-mes')||null),
    centro_custo_id:v.indexOf('c:')===0?+v.slice(2):null,grupo_id:v.indexOf('g:')===0?+v.slice(2):null,
    criterio:g('cal-e-crit'),status:g('cal-e-st'),local:g('cal-e-loc').trim()||null,
    acao_ia:g('cal-e-acao').trim()||null,observacoes:g('cal-e-obs').trim()||null,
    campanha_id:+g('cal-e-camp')||null
  };
  var P=calPrev||{};
  if(CAL_OBRIGA_PREV.indexOf(b.status)>=0&&P.status!=='so_informar'&&!(Number(P.qtd)>0&&Number(P.ticket)>0)){
    showToast('Preencha a previsão do evento em "📈 Abrir projeção do evento" (quantidade e ticket) — obrigatória para o status '+b.status+'.','error');
    var bl=document.getElementById('cal-e-prev');if(bl)bl.scrollIntoView({behavior:'smooth',block:'center'});return;}
  Object.assign(b,{qtd_prevista:P.qtd===undefined?null:P.qtd,ticket_medio:P.ticket===undefined?null:P.ticket,publico_previsto:P.publico===undefined?null:P.publico,
    projecao:P.projecao===undefined?null:P.projecao,projecao_status:P.status||'pendente',memoria_projecao:P.memoria||null,projecao_por:P.por||null,projecao_em:P.em||null});
  if(!b.campanha_id){var sug=calCampanhaPorData(ini,b.ano,b.mes);
    if(sug&&sug.status!=='Encerrada'&&confirm('Este evento cai no período da campanha "'+sug.nome+'". Ligar o evento a ela?'))b.campanha_id=sug.id;}
  try{
    if(id)await sb.patch('cda_cal_evento',id,b);
    else{b.criado_por=(cu&&(cu.email||cu.name))||null;await sb.post('cda_cal_evento',b);}
    closeModal();showToast('Evento salvo','success');await calCarregar();calRenderEventos();
  }catch(e){calErro(e,'Não foi possível salvar o evento');}
}
async function calExcluirEvento(id){
  if(!calPodeEditar())return;
  var e=calCache.eventos.find(function(x){return String(x.id)===String(id);});
  if(!confirm('Excluir o evento "'+(e?e.evento:'')+'"?'))return;
  try{await sb.del('cda_cal_evento',id);closeModal();showToast('Evento excluído','success');await calCarregar();calRenderEventos();}
  catch(err){calErro(err,'Não foi possível excluir o evento');}
}

// ─── Importação da planilha (aba "Calendário …") ─────────────────────
// Bloco 1 (linha de cabeçalho com "Evento"): A Início · B Fim · C Mês · D Evento / oportunidade ·
//   E Coleção / marca · F Canal · G Critério · J Ação IA projetada · O Status · P Observações.
// Bloco 2 ("MARCOS E PRAZOS", cabeçalho "Prazo"): A Prazo · B Projeto · D Marco / decisão · J Ação.
//   Os marcos entram no mês informado no próprio calendário (padrão: Novembro) e podem ser unidos a
//   um evento do bloco 1 da mesma collab (ex.: Emerson Dialab).
function calAbrirImportacao(){
  if(!calPodeEditar())return;
  calImport=null;
  openModal('<div class="modal-box pa-modal-wide" onclick="event.stopPropagation()"><div class="modal-title">⬆ Importar calendário (Excel)</div>'+
    '<p class="pa-info" style="margin:6px 0 12px">Aba com "Calendário" no nome. Usa as colunas <b>D Evento / oportunidade</b> e <b>J Ação IA projetada</b>, além de datas, collab, canal, critério, status e observações, e o bloco <b>Marcos e prazos</b>. Antes de gravar, confira e ajuste o <b>Canal / Grupo</b> de cada linha.</p>'+
    '<div class="pa-filtros"><label>Arquivo<input type="file" id="cal-imp-arq" accept=".xls,.xlsx"></label>'+
    '<label>Ano<input id="cal-imp-ano" type="number" value="'+calEstado.ano+'" style="width:90px"></label>'+
    '<label>Mês dos marcos sem data<select id="cal-imp-mesmarco">'+CAL_MESES.map(function(m,i){return '<option value="'+(i+1)+'"'+(i===10?' selected':'')+'>'+m+'</option>';}).join('')+'</select></label>'+
    '<label>A partir do mês<select id="cal-imp-desde">'+CAL_MESES.map(function(m,i){return '<option value="'+(i+1)+'"'+(i===10?' selected':'')+'>'+m+'</option>';}).join('')+'</select></label>'+
    '<label>Campanha dos eventos<select id="cal-imp-camp">'+calOpcoesCampanha(calEstado.campanha&&calEstado.campanha!=='nenhuma'?calEstado.campanha:'')+'</select></label></div>'+
    '<div id="cal-imp-res" aria-live="polite"></div>'+
    '<div class="modal-actions" style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px"><button class="btn btn-ghost" onclick="closeModal()">Fechar</button><button class="btn btn-ghost" onclick="calImportarPrevia()">🔍 Pré-visualizar</button><button class="btn btn-primary" id="cal-imp-ok" disabled onclick="calImportarConfirmar()">⬆ Importar</button></div></div>');
}
function calSugerirVinculo(canal,collab,texto){
  var n=calNorm(canal),c=calNorm(collab),t=calNorm(texto);
  var grupo=function(nome){var g=calCache.grupos.find(function(x){return calNorm(x.nome)===calNorm(nome);});return g?'g:'+g.id:'';};
  var centro=function(nome){var x=calCache.centros.find(function(y){return calNorm(y.nome)===calNorm(nome);});return x?'c:'+x.id:'';};
  if(/revendas futura 1/.test(t))return centro('REVENDA FUTURA 1');
  if(/private label/.test(n)||/marco pl/.test(n)||/canal private label/.test(t))return centro('PRIVATE LABEL');
  if(/^shows?$/.test(n))return centro('SHOWS '+String(collab||'').toUpperCase())||'';
  if(/feira|festiva/.test(n))return centro('FEIRAS E BAZARES');
  if(/e-?commerce|campanha|lancamento/.test(n))return grupo('E-commerce');
  return '';
}
function calExtrairQtdTicket(txt){
  var t=String(txt||''),q=null,tk=null,m;
  var pecas=t.match(/(\d+)\s*(?:pe[cç]as|corta-?ventos|t-?shirts|camisetas)/gi);
  if(pecas)q=pecas.reduce(function(s,x){return s+parseInt(x,10);},0);
  if((m=t.match(/ticket\s*m[eé]dio\s*(?:de\s*)?(?:R\$\s*)?([\d.]+,\d{2}|\d+)/i))||(m=t.match(/a\s*(?:R\$\s*)?([\d.]+,\d{2})\s*como\s*ticket/i)))tk=calNum(m[1]);
  return {qtd:q,ticket:tk};
}
async function calImportarPrevia(){
  var arq=document.getElementById('cal-imp-arq').files[0],res=document.getElementById('cal-imp-res');
  if(!arq){showToast('Escolha o arquivo.','error');return;}
  var ano=+document.getElementById('cal-imp-ano').value||calEstado.ano,mesMarco=+document.getElementById('cal-imp-mesmarco').value,desde=+document.getElementById('cal-imp-desde').value;
  try{
    var wb=XLSX.read(await arq.arrayBuffer(),{type:'array',cellDates:true});
    var nome=wb.SheetNames.find(function(n){return /calend/i.test(n);});
    if(!nome){res.innerHTML='<div class="card pa-neg">Não encontrei uma aba com "Calendário" no nome.</div>';return;}
    var rows=XLSX.utils.sheet_to_json(wb.Sheets[nome],{header:1,defval:'',raw:true});
    var hdr=rows.findIndex(function(r){return /evento/i.test(String(r[3]||''))&&/in[ií]cio/i.test(String(r[0]||''));});
    if(hdr<0){res.innerHTML='<div class="card pa-neg">Não encontrei o cabeçalho (Início … Evento / oportunidade).</div>';return;}
    var itens=[],i,r;
    for(i=hdr+1;i<rows.length;i++){r=rows[i];
      if(/marcos/i.test(String(r[0]||'')))break;
      if(!String(r[3]||'').trim())continue;
      var ini=calIsoData(r[0]),fim=calIsoData(r[1]),mes=ini?+ini.slice(5,7):(+r[2]||null);
      if(mes&&mes<desde)continue;
      var crit=String(r[6]||'').trim();crit=/di[aá]ria|unidade/i.test(crit)?'Unidades':/pedido/i.test(crit)?'Pedidos':'A definir';
      var acao=String(r[9]||'').trim(),qt=calExtrairQtdTicket(acao);
      itens.push({linha:i+1,inicio:ini,fim:fim,mes:mes,evento:String(r[3]).trim(),collab:String(r[4]||'').trim()||null,canalPlanilha:String(r[5]||'').trim(),criterio:crit,
        acao_ia:acao||null,status:CAL_STATUS.indexOf(String(r[14]||'').trim())>=0?String(r[14]).trim():'Planejado',observacoes:String(r[15]||'').trim()||null,
        qtd_prevista:qt.qtd,ticket_medio:qt.ticket,vinculo:calSugerirVinculo(r[5],r[4],acao),marco:false});
    }
    var hm=rows.findIndex(function(rr,ix){return ix>hdr&&/^prazo$/i.test(String(rr[0]||'').trim());});
    if(hm>=0)for(i=hm+1;i<rows.length;i++){r=rows[i];var proj=String(r[1]||'').trim();if(!proj)continue;
      var acaoM=String(r[9]||'').trim(),qm=calExtrairQtdTicket(acaoM),dataM=calIsoData(r[0]);
      var alvo=itens.find(function(x){return !x.marco&&calNorm(x.collab)===calNorm(proj.split('—')[0]);});
      if(alvo){ // mesmo projeto já está no calendário: une num único evento
        alvo.acao_ia=acaoM||alvo.acao_ia;if(qm.qtd)alvo.qtd_prevista=qm.qtd;if(qm.ticket)alvo.ticket_medio=qm.ticket;
        if(qm.qtd)alvo.criterio='Unidades';alvo.observacoes=[alvo.observacoes,String(r[3]||'').trim()].filter(Boolean).join(' · ');alvo.unido='linha '+(i+1);continue;}
      itens.push({linha:i+1,inicio:dataM,fim:null,mes:dataM?+dataM.slice(5,7):mesMarco,evento:proj,collab:proj.split('—')[0].trim(),canalPlanilha:'Marco',
        criterio:qm.qtd?'Unidades':'A definir',acao_ia:acaoM||'A definir',status:'A definir',observacoes:[String(r[0]||'').trim()&&!dataM?'Prazo: '+String(r[0]).trim():'',String(r[3]||'').trim()].filter(Boolean).join(' · ')||null,
        qtd_prevista:qm.qtd,ticket_medio:qm.ticket,vinculo:calSugerirVinculo('',proj,acaoM),marco:true});
    }
    var jaExcel=calCache.eventos.filter(function(e){return +e.ano===ano&&e.origem==='excel'&&(!e.mes||e.mes>=desde);}).length;
    calImport={ano:ano,desde:desde,itens:itens,substituir:jaExcel,campanha_id:+document.getElementById('cal-imp-camp').value||null};
    res.innerHTML='<div class="card" style="font-size:13px;line-height:1.7"><b>'+itens.length+'</b> evento(s) lidos da aba "'+calEsc(nome)+'" a partir de '+CAL_MESES[desde-1]+'/'+ano+'.'+
      (jaExcel?' <span class="pa-neg">Os '+jaExcel+' evento(s) importados antes (origem Excel, a partir deste mês) serão substituídos — inclusive as projeções já calculadas.</span> Eventos digitados na tela são mantidos.':'')+'</div>'+
      '<div class="pa-prev"><table class="pa-tbl pa-compacta"><thead><tr><th>Linha</th><th style="text-align:left">Início</th><th style="text-align:left">Evento</th><th style="text-align:left">Collab</th><th style="text-align:left">Canal (planilha)</th><th style="text-align:left">Canal / Grupo no sistema</th><th>Critério</th><th>Qtd × Ticket</th></tr></thead><tbody>'+
      itens.map(function(x,k){return '<tr><td>'+x.linha+(x.unido?'<br><span class="pa-mut" style="font-size:10px">+ '+x.unido+'</span>':'')+'</td><td style="text-align:left">'+(x.inicio?calDataBR(x.inicio):CAL_MESES[(x.mes||1)-1].slice(0,3).toLowerCase())+'</td><td style="text-align:left;white-space:normal">'+calEsc(x.evento)+'</td><td style="text-align:left">'+calEsc(x.collab)+'</td><td style="text-align:left">'+calEsc(x.canalPlanilha)+'</td>'+
        '<td style="text-align:left"><select onchange="calImport.itens['+k+'].vinculo=this.value" style="max-width:240px">'+calOpcoesVinculo(x.vinculo)+'</select></td><td>'+x.criterio+'</td><td>'+(x.qtd_prevista?x.qtd_prevista+' × '+(x.ticket_medio?calBRL(x.ticket_medio):'—'):'—')+'</td></tr>';}).join('')+
      '</tbody></table></div>';
    document.getElementById('cal-imp-ok').disabled=!itens.length;
  }catch(e){res.innerHTML='<div class="card">Não foi possível ler a planilha.</div>';calErro(e,'Falha na leitura da planilha');}
}
async function calImportarConfirmar(){
  if(!calImport||!calPodeEditar())return;
  var btn=document.getElementById('cal-imp-ok');btn.disabled=true;btn.textContent='Importando…';
  try{
    var velhos=calCache.eventos.filter(function(e){return +e.ano===calImport.ano&&e.origem==='excel'&&(!e.mes||e.mes>=calImport.desde);});
    var linhas=calImport.itens.map(function(x){return {ano:calImport.ano,mes:x.inicio?null:x.mes,inicio:x.inicio,fim:x.fim,evento:x.evento,collab:x.collab,
      centro_custo_id:x.vinculo.indexOf('c:')===0?+x.vinculo.slice(2):null,grupo_id:x.vinculo.indexOf('g:')===0?+x.vinculo.slice(2):null,
      criterio:x.criterio,status:x.status,acao_ia:x.acao_ia,observacoes:x.observacoes,qtd_prevista:x.qtd_prevista,ticket_medio:x.ticket_medio,
      campanha_id:calImport.campanha_id,origem:'excel',criado_por:(cu&&(cu.email||cu.name))||null};});
    await sb.post('cda_cal_evento',linhas);
    for(var i=0;i<velhos.length;i++)await sb.del('cda_cal_evento',velhos[i].id);
    closeModal();showToast(linhas.length+' evento(s) importado(s)','success');
    calEstado.ano=calImport.ano;calEstado.mes='';await calCarregar();calRenderEventos();
  }catch(e){btn.disabled=false;btn.textContent='⬆ Importar';calErro(e,'Não foi possível importar');}
}

// ─── Projeção do evento (previsão informada pelo usuário) — 31/10/2026 ─────────
// Total Venda Previsto = quantidade × ticket. Critério Unidades: peças × ticket por peça;
// Pedidos (e-commerce): pedidos × ticket por pedido. Base histórica do canal (ou dos canais do grupo):
// Prestação de Contas quando existe, senão Histórico de Compras; meses com nota consolidada
// (ticket > R$ 1.000 por peça) não entram na conta de peças e ticket.
var CAL_TICKET_MAX = 1000;
function calPrevARevisar(e){return CAL_OBRIGA_PREV.indexOf(e.status)>=0&&(e.projecao_status==='sugerido'||(e.projecao_status!=='so_informar'&&!(Number(e.qtd_prevista)>0&&Number(e.ticket_medio)>0)));}
function calPrevSelo(e,curto){
  var st=e.projecao_status||'pendente';
  if(st==='sugerido')return ' <span class="cal-pst sug" title="Quantidade e ticket sugeridos pelo histórico — abra o evento e confirme">'+(curto?'revisar':'⚠ sugerido — revisar')+'</span>';
  if(st==='so_informar')return curto?'':' <span class="cal-pst inf">só informar</span>';
  if(CAL_OBRIGA_PREV.indexOf(e.status)>=0&&!(Number(e.qtd_prevista)>0&&Number(e.ticket_medio)>0))return ' <span class="cal-pst pen" title="Falta a previsão (quantidade e ticket)">'+(curto?'pendente':'⚠ previsão pendente')+'</span>';
  return curto?'':' <span class="cal-pst ok">✓ revisada</span>';
}
function calCritAtual(){var el=document.getElementById('cal-e-crit');return el?el.value:((calPrev&&calPrev.crit)||'Unidades');}
function calPrevUnid(crit,plural){return crit==='Pedidos'?(plural?'pedidos':'pedido'):(plural?'peças':'peça');}
function calPrevBloco(){
  var P=calPrev||{},crit=calCritAtual(),st=P.status||'pendente';
  var falta=st!=='so_informar'&&!(Number(P.qtd)>0&&Number(P.ticket)>0);
  var det=st==='so_informar'?'Só informar — sem venda prevista':(Number(P.qtd)>0&&Number(P.ticket)>0?P.qtd+' '+calPrevUnid(crit,true)+' × '+calBRL(P.ticket)+(P.publico?' · público previsto '+Number(P.publico).toLocaleString('pt-BR'):''):'Informe a quantidade e o ticket');
  var selo=st==='sugerido'?'<span class="cal-pst sug">⚠ sugerido pelo histórico — revisar</span>':st==='so_informar'?'<span class="cal-pst inf">só informar</span>':falta?'<span class="cal-pst pen">⚠ previsão pendente</span>':'<span class="cal-pst ok">✓ revisada'+(P.por?' por '+calEsc(String(P.por).split('@')[0]):'')+(P.em?' em '+calDataBRAno(P.em):'')+'</span>';
  return '<div class="cal-prev'+(falta||st==='sugerido'?' pend':'')+'"><div><div class="t">📈 Projeção do evento</div><div class="v">'+(P.projecao!==null&&P.projecao!==undefined&&st!=='so_informar'?calBRL(P.projecao):'—')+'</div><div class="d">'+calEsc(det)+'</div><div style="margin-top:6px">'+selo+'</div></div>'+
    '<button type="button" class="cal-btn-prev" onclick="calAbrirProjecao()">📈 Abrir projeção do evento</button></div>';
}
function calPainel(html){calFecharPainel();var d=document.createElement('div');d.className='cal-ov';d.id='cal-ov';d.onclick=function(e){if(e.target===d)calFecharPainel();};d.innerHTML='<div class="can-dr" role="dialog" aria-modal="true" style="width:min(940px,97vw)">'+html+'</div>';document.body.appendChild(d);document.addEventListener('keydown',calEscPainel);}
function calEscPainel(e){if(e.key==='Escape')calFecharPainel();}
function calFecharPainel(){var d=document.getElementById('cal-ov');if(d)d.remove();document.removeEventListener('keydown',calEscPainel);}
async function calCanaisDoVinculo(v){
  if(!calCache.canaisTodos)calCache.canaisTodos=await sb.get('canais','select=id,nome,grupo_id,centro_custo_id&order=nome')||[];
  if(v.indexOf('c:')===0)return calCache.canaisTodos.filter(function(c){return String(c.centro_custo_id)===v.slice(2);});
  if(v.indexOf('g:')===0)return calCache.canaisTodos.filter(function(c){return String(c.grupo_id)===v.slice(2);});
  return [];
}
// Base histórica: por mês, somando os canais (Prestação quando o canal tem prestação no mês, senão Histórico)
async function calBaseHistorica(canais){
  var ids=canais.map(function(c){return c.id;});if(!ids.length)return {meses:[]};
  var f='canal_id=in.('+ids.join(',')+')&ano_mes=gte.2025-01';
  var r=await Promise.all([sb.get('cda_canal_eventos_mes',f),sb.get('cda_v_prestacao_canal_mes',f),sb.get('cda_v_vendas_canal_mes',f)]);
  var M={},k=function(am){return M[am]=M[am]||{am:am,eventos:0,publico:null,locais:[],pecas:0,valor:0,pedidos:0,fontes:{},pecasHist:0,valorHist:0};};
  var pr={};(r[1]||[]).forEach(function(x){pr[x.canal_id+'|'+x.ano_mes]=x;});
  (r[0]||[]).forEach(function(x){var m=k(x.ano_mes);m.eventos+=x.qtd_eventos||0;if(x.publico!==null&&x.publico!==undefined)m.publico=(m.publico||0)+x.publico;if(x.observacao)m.locais.push(x.observacao);});
  (r[2]||[]).forEach(function(x){var m=k(x.ano_mes),p=pr[x.canal_id+'|'+x.ano_mes];m.pedidos+=+x.pedidos||0;m.pecasHist+=+x.pecas||0;m.valorHist+=+x.valor||0;
    if(p){m.pecas+=+p.pecas||0;m.valor+=+p.valor||0;m.fontes.P=1;delete pr[x.canal_id+'|'+x.ano_mes];}else{m.pecas+=+x.pecas||0;m.valor+=+x.valor||0;m.fontes.H=1;}});
  Object.keys(pr).forEach(function(key){var p=pr[key],m=k(p.ano_mes);m.pecas+=+p.pecas||0;m.valor+=+p.valor||0;m.fontes.P=1;});
  var meses=Object.keys(M).sort().reverse().map(function(am){var m=M[am];m.cons=m.pecas<=0||m.valor/m.pecas>CAL_TICKET_MAX;return m;});
  return {meses:meses};
}
async function calAbrirProjecao(){
  if(!calPrev)return;
  var v=(document.getElementById('cal-e-vinc')||{}).value||'',crit=calCritAtual();
  var nomeV=v?(document.getElementById('cal-e-vinc').selectedOptions[0]||{}).textContent:'';
  calPainel('<div class="can-dr-h"><div style="flex:1"><h3>📈 Projeção do evento</h3><div class="sub">'+calEsc((document.getElementById('cal-e-ev')||{}).value||'Evento')+(nomeV?' · '+calEsc(nomeV):'')+'</div></div><button class="can-btn" onclick="calFecharPainel()" aria-label="Fechar">✕</button></div><div class="can-dr-b" id="cal-pv-b">Carregando a base histórica…</div><div class="can-dr-f" id="cal-pv-f"></div>');
  var B={meses:[]},canais=[];
  try{canais=v?await calCanaisDoVinculo(v):[];B=await calBaseHistorica(canais);}catch(e){calErro(e,'Não foi possível carregar a base histórica');}
  calPrevRender(B,canais,crit);
}
function calPrevResumo(B,crit){
  var ev=B.meses.filter(function(m){return m.eventos>0;}),R={modo:'eventos',eventos:0,valor:0,pecasV:0,valorV:0,publico:0,pecasPub:0,temPub:false};
  if(crit!=='Pedidos'&&ev.length){
    ev.forEach(function(m){R.eventos+=m.eventos;R.valor+=m.valor;if(!m.cons){R.pecasV+=m.pecas;R.valorV+=m.valor;}if(m.publico){R.publico+=m.publico;R.temPub=true;if(!m.cons)R.pecasPub+=m.pecas;}});
    R.porEvento=R.eventos?R.valor/R.eventos:null;R.ticket=R.pecasV?R.valorV/R.pecasV:null;
    R.qtdSug=R.porEvento&&R.ticket?Math.round(R.porEvento/R.ticket):null;R.conv=R.temPub&&R.publico?R.pecasPub/R.publico:null;
    return R;
  }
  // Sem eventos (ou e-commerce): mês de referência = mesmo mês do ano anterior ao evento
  R.modo='mensal';
  var am=calMesEvento(),ref=am?(+am.slice(0,4)-1)+am.slice(4):null,mr=ref?B.meses.find(function(m){return m.am===ref;}):null;
  var ult=B.meses.slice(0,12);
  if(crit==='Pedidos'){
    var base=mr&&mr.pedidos?mr:null;
    if(base){R.qtdSug=base.pedidos;R.ticket=base.valorHist/base.pedidos;R.refTxt='mesmo mês de '+(+am.slice(0,4)-1)+' ('+calMesCurto(ref)+')';}
    else{var pd=ult.reduce(function(s,m){return s+m.pedidos;},0),vl=ult.reduce(function(s,m){return s+m.valorHist;},0);R.qtdSug=ult.length?Math.round(pd/ult.length):null;R.ticket=pd?vl/pd:null;R.refTxt='média mensal dos últimos '+ult.length+' meses';}
  }else{
    var ok=mr&&!mr.cons?mr:null;
    if(ok){R.qtdSug=ok.pecas;R.ticket=ok.valor/ok.pecas;R.refTxt='mesmo mês de '+(+am.slice(0,4)-1)+' ('+calMesCurto(ref)+')';}
    else{var vv=ult.filter(function(m){return !m.cons;}),pc=vv.reduce(function(s,m){return s+m.pecas;},0),va=vv.reduce(function(s,m){return s+m.valor;},0);R.qtdSug=vv.length?Math.round(pc/vv.length):null;R.ticket=pc?va/pc:null;R.refTxt='média mensal dos últimos '+vv.length+' meses válidos';}
  }
  R.ref=ref;return R;
}
function calMesEvento(){var ini=(document.getElementById('cal-e-ini')||{}).value,mes=(document.getElementById('cal-e-mes')||{}).value,ano=(document.getElementById('cal-e-ano')||{}).value;if(ini)return ini.slice(0,7);if(mes&&ano)return ano+'-'+String(mes).padStart(2,'0');return null;}
function calMesCurto(am){if(!am)return '';var p=am.split('-');return CAL_MESES[+p[1]-1].slice(0,3).toLowerCase()+'/'+p[0];}
function calPrevRender(B,canais,crit){
  var P=calPrev,R=calPrevResumo(B,crit),un=calPrevUnid(crit,true),h='';
  calPrev._R=R;
  var bx=function(t,v){return '<div><span>'+t+'</span><b>'+v+'</b></div>';};
  h+='<fieldset class="can-fs"><legend>Base histórica'+(canais.length?' — '+canais.length+' canal(is): '+calEsc(canais.slice(0,3).map(function(c){return c.nome;}).join(', '))+(canais.length>3?'…':''):'')+'</legend>';
  if(!canais.length)h+='<p class="pa-mut" style="font-size:12px">Escolha o Canal / Grupo do evento para ver a base histórica.</p>';
  else if(R.modo==='eventos'){
    h+='<div class="can-res">'+bx('Eventos',R.eventos)+bx('Vendas nos eventos',calBRL(R.valor))+bx('R$ por evento',R.porEvento?calBRL(R.porEvento):'—')+bx('Peças válidas',R.pecasV.toLocaleString('pt-BR'))+bx('Ticket por peça',R.ticket?calBRL(R.ticket):'—')+bx('Peças por evento',R.qtdSug!==null?R.qtdSug:'—')+bx('Público',R.temPub?R.publico.toLocaleString('pt-BR'):'—')+bx('Conversão (peças ÷ público)',R.conv?R.conv.toLocaleString('pt-BR',{maximumFractionDigits:3}):'—')+'</div>';
    h+='<div class="pa-tbl-wrap"><table class="pa-tbl pa-compacta cal-tbl-hist"><thead><tr><th style="text-align:left">Mês</th><th style="text-align:left">Locais</th><th>Eventos</th><th>Público</th><th>Fonte</th><th>Peças</th><th>Vendas</th><th>Ticket/peça</th><th>R$/evento</th></tr></thead><tbody>'+
      B.meses.filter(function(m){return m.eventos>0;}).map(function(m){return '<tr class="'+(m.cons?'cons':'')+'"'+(m.cons?' title="Nota consolidada (ticket acima de R$ 1.000/peça): peças e ticket deste mês não entram na conta"':'')+'><td style="text-align:left;font-weight:600">'+calMesCurto(m.am)+'</td><td style="text-align:left;white-space:normal;min-width:190px;max-width:240px;font-size:10.5px;line-height:1.25">'+calEsc(m.locais.join(' ; '))+'</td><td>'+m.eventos+'</td><td>'+(m.publico?m.publico.toLocaleString('pt-BR'):'—')+'</td><td>'+(m.fontes.P?'Prestação':'Histórico')+'</td><td>'+m.pecas.toLocaleString('pt-BR')+(m.cons?' ⚠':'')+'</td><td>'+calBRL(m.valor)+'</td><td>'+(m.pecas&&!m.cons?calBRL(m.valor/m.pecas):'—')+'</td><td>'+calBRL(m.valor/m.eventos)+'</td></tr>';}).join('')+'</tbody></table></div>'+
      '<p class="pa-info" style="font-size:11.5px;margin-top:6px">Fonte: Prestação de Contas quando existe no mês, senão Histórico de Compras (desde jan/2025). ⚠ = nota consolidada (ticket acima de R$ 1.000 por peça): o valor conta no R$ por evento, mas peças e ticket desse mês ficam de fora. Público: Canais de Venda › 📅 Eventos.</p>';
  }else{
    var lst=B.meses.slice(0,14);
    h+='<div class="can-res">'+bx('Referência',calEsc(R.refTxt||'—'))+bx(crit==='Pedidos'?'Pedidos':'Peças',R.qtdSug!==null&&R.qtdSug!==undefined?R.qtdSug.toLocaleString('pt-BR'):'—')+bx('Ticket por '+calPrevUnid(crit),R.ticket?calBRL(R.ticket):'—')+'</div>';
    h+='<div class="pa-tbl-wrap"><table class="pa-tbl pa-compacta cal-tbl-hist"><thead><tr><th style="text-align:left">Mês</th><th>Pedidos</th><th>Peças</th><th>Vendas</th><th>Ticket/pedido</th><th>Ticket/peça</th></tr></thead><tbody>'+
      lst.map(function(m){var vh=crit==='Pedidos'?m.valorHist:m.valor,pc=crit==='Pedidos'?m.pecasHist:m.pecas;return '<tr class="'+(m.am===R.ref?'ref':'')+(m.cons&&crit!=='Pedidos'?' cons':'')+'"><td style="text-align:left;font-weight:600">'+calMesCurto(m.am)+(m.am===R.ref?' ◂ referência':'')+'</td><td>'+m.pedidos.toLocaleString('pt-BR')+'</td><td>'+pc.toLocaleString('pt-BR')+'</td><td>'+calBRL(vh)+'</td><td>'+(m.pedidos?calBRL(m.valorHist/m.pedidos):'—')+'</td><td>'+(pc&&vh/pc<=CAL_TICKET_MAX?calBRL(vh/pc):'—')+'</td></tr>';}).join('')+'</tbody></table></div>';
  }
  h+='</fieldset>';
  var so=P.status==='so_informar';
  h+='<fieldset class="can-fs"><legend>Previsão do evento</legend><div class="can-fg" style="grid-template-columns:repeat(4,minmax(0,1fr))">'+
    '<label>Qtd. público previsto<input id="cal-pv-pub" type="number" min="0" step="1" value="'+(P.publico!==null&&P.publico!==undefined?P.publico:'')+'"'+(so?' disabled':'')+'></label>'+
    '<label>Qtd. prevista ('+un+') *<input id="cal-pv-qtd" type="number" min="0" step="1" value="'+(P.qtd!==null&&P.qtd!==undefined?P.qtd:'')+'" oninput="calPrevTotal()"'+(so?' disabled':'')+'></label>'+
    '<label>Ticket médio por '+calPrevUnid(crit)+' (R$) *<input id="cal-pv-tkt" inputmode="decimal" value="'+(P.ticket!==null&&P.ticket!==undefined?String(Math.round(P.ticket*100)/100).replace('.',','):'')+'" oninput="calPrevTotal()"'+(so?' disabled':'')+'></label>'+
    '<label>Total Venda Previsto (R$)<div class="cal-tot" id="cal-pv-tot">—</div></label></div>'+
    '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">'+
      (R.qtdSug&&R.ticket?'<button type="button" class="can-btn" onclick="calPrevUsarSugestao()">↺ Usar sugestão do histórico ('+R.qtdSug+' '+un+' × '+calBRL(R.ticket)+')</button>':'')+
      (R.conv?'<button type="button" class="can-btn" onclick="calPrevPeloPublico()">👥 Sugerir peças pelo público (conversão '+R.conv.toLocaleString('pt-BR',{maximumFractionDigits:3})+')</button>':'')+
    '</div>'+
    '<label style="display:flex;flex-direction:row;align-items:center;gap:8px;margin-top:12px;font-size:12.5px"><input type="checkbox" id="cal-pv-so"'+(so?' checked':'')+' onchange="calPrevSoInformar(this.checked)"> Só informar — evento sem venda prevista (custo ou ação já previstos em outro lugar)</label>'+
    '<p class="pa-info" style="font-size:11.5px;margin-top:8px">Obrigatória para os status Planejado, A confirmar e Confirmado. Ao salvar, a previsão fica marcada como revisada, com o seu nome e a data.</p></fieldset>';
  if(P.memoria)h+='<p class="pa-info" style="font-size:11.5px;color:var(--muted2)"><b>Memória atual:</b> '+calEsc(P.memoria)+'</p>';
  document.getElementById('cal-pv-b').innerHTML=h;
  document.getElementById('cal-pv-f').innerHTML='<button class="can-btn" onclick="calFecharPainel()">Cancelar</button><button class="can-btn pri" id="cal-pv-ok" onclick="calPrevSalvar()">'+(P.id?'Salvar previsão':'Aplicar ao evento')+'</button>';
  calPrevTotal();
}
function calPrevTotal(){var q=calNum((document.getElementById('cal-pv-qtd')||{}).value),t=calNum((document.getElementById('cal-pv-tkt')||{}).value),el=document.getElementById('cal-pv-tot');if(!el)return;el.textContent=q>0&&t>0?calBRL(Math.round(q*t*100)/100):'—';}
function calPrevUsarSugestao(){var R=calPrev._R||{};if(!R.qtdSug||!R.ticket)return;document.getElementById('cal-pv-qtd').value=R.qtdSug;document.getElementById('cal-pv-tkt').value=String(Math.round(R.ticket*100)/100).replace('.',',');calPrevTotal();}
function calPrevPeloPublico(){var R=calPrev._R||{},pub=calNum(document.getElementById('cal-pv-pub').value);if(!pub){showToast('Informe o público previsto.','info');return;}document.getElementById('cal-pv-qtd').value=Math.round(pub*R.conv);if(!calNum(document.getElementById('cal-pv-tkt').value)&&R.ticket)document.getElementById('cal-pv-tkt').value=String(Math.round(R.ticket*100)/100).replace('.',',');calPrevTotal();}
function calPrevSoInformar(on){['cal-pv-pub','cal-pv-qtd','cal-pv-tkt'].forEach(function(i){document.getElementById(i).disabled=on;});}
async function calPrevSalvar(){
  var crit=calCritAtual(),un=calPrevUnid(crit,true),so=document.getElementById('cal-pv-so').checked,quem=(window.cu&&(cu.email||cu.name))||null,agora=new Date().toISOString();
  var N;
  if(so)N={qtd:null,ticket:null,publico:null,projecao:null,status:'so_informar',memoria:'Só informar — sem venda prevista (definido por '+(quem||'usuário')+' em '+calDataBRAno(agora)+')',por:quem,em:agora};
  else{
    var q=calNum(document.getElementById('cal-pv-qtd').value),t=calNum(document.getElementById('cal-pv-tkt').value),pb=calNum(document.getElementById('cal-pv-pub').value);
    if(!(q>0)||!(t>0)){showToast('Informe a quantidade prevista e o ticket médio.','error');return;}
    q=Math.round(q);t=Math.round(t*100)/100;var tot=Math.round(q*t*100)/100,R=calPrev._R||{};
    var ref=R.modo==='eventos'&&R.porEvento?' Referência: '+R.eventos+' eventos, '+calBRL(R.porEvento)+'/evento, ticket '+(R.ticket?calBRL(R.ticket):'—')+'/peça.':(R.refTxt?' Referência: '+R.refTxt+(R.qtdSug?' — '+R.qtdSug+' '+un+' × '+(R.ticket?calBRL(R.ticket):'—'):'')+'.':'');
    N={qtd:q,ticket:t,publico:pb!==null&&pb!==undefined?Math.round(pb):null,projecao:tot,status:'revisado',memoria:'Informado por '+(quem||'usuário')+' em '+calDataBRAno(agora)+': '+q+' '+un+' × '+calBRL(t)+' = '+calBRL(tot)+(pb?' · público previsto '+Math.round(pb).toLocaleString('pt-BR'):'')+'.'+ref,por:quem,em:agora};
  }
  var btn=document.getElementById('cal-pv-ok');btn.disabled=true;
  try{
    if(calPrev.id){
      await sb.patch('cda_cal_evento',calPrev.id,{qtd_prevista:N.qtd,ticket_medio:N.ticket,publico_previsto:N.publico,projecao:N.projecao,projecao_status:N.status,memoria_projecao:N.memoria,projecao_por:N.por,projecao_em:N.em,criterio:crit});
      showToast('Previsão salva','success');
    }else showToast('Previsão aplicada — clique em Salvar para gravar o evento.','info');
    Object.assign(calPrev,N);
    var bl=document.getElementById('cal-e-prev');if(bl)bl.innerHTML=calPrevBloco();
    calFecharPainel();
    if(calPrev.id){var ev=calCache.eventos.find(function(x){return String(x.id)===String(calPrev.id);});if(ev)Object.assign(ev,{qtd_prevista:N.qtd,ticket_medio:N.ticket,publico_previsto:N.publico,projecao:N.projecao,projecao_status:N.status,memoria_projecao:N.memoria,projecao_por:N.por,projecao_em:N.em,criterio:crit});calRenderEventos();}
  }catch(e){btn.disabled=false;calErro(e,'Não foi possível salvar a previsão');}
}

// ─── Campanhas (nível macro) ─────────────────────────────────────────
function calAbrirCampanhas(){
  var ed=calPodeEditar();
  var tot=function(c){var ev=calCache.eventos.filter(function(e){return String(e.campanha_id)===String(c.id);});
    var p={t:0,v:0,a:0};ev.forEach(function(e){var x=Number(e.projecao)||0,sg=calSegmento(e);p.t+=x;if(sg==='atacado')p.a+=x;else if(sg)p.v+=x;});return {n:ev.length,p:p};};
  var linhas=calCache.campanhas.map(function(c){var t=tot(c);
    return '<tr'+(ed?' style="cursor:pointer" onclick="calAbrirCampanha('+c.id+')" title="Clique para editar"':'')+'><td style="text-align:left;font-weight:600">🏷 '+calEsc(c.nome)+'</td><td style="text-align:left">'+calDataBRAno(c.inicio)+' a '+calDataBRAno(c.fim)+'</td><td>'+calBadgeStatus(c.status==='Encerrada'?'Realizado':c.status==='Cancelada'?'Cancelado':c.status==='Em andamento'?'Confirmado':'Planejado').replace(/>[^<]+</,'>'+calEsc(c.status)+'<')+'</td><td>'+t.n+'</td><td>'+calBRL(t.p.v)+'</td><td>'+calBRL(t.p.a)+'</td><td><b>'+calBRL(t.p.t)+'</b></td>'+
      '<td style="text-align:center" onclick="event.stopPropagation()"><button class="btn btn-ghost btn-sm" onclick="closeModal();calEstado.campanha=\''+c.id+'\';calRenderEventos()">Ver eventos</button></td></tr>';}).join('');
  openModal('<div class="modal-box pa-modal-wide" style="max-width:1080px;width:96vw" onclick="event.stopPropagation()"><div class="modal-title">🏷 Campanhas</div>'+
    '<p class="pa-info" style="margin:6px 0 12px">A campanha agrupa os eventos de um período com o mesmo objetivo (ex.: Black Friday / Natal). As Simulações do Planejamento e os cenários salvos são feitos por campanha.</p>'+
    (linhas?'<div class="pa-tbl-wrap"><table class="pa-tbl pa-compacta cal-tbl"><thead><tr><th style="text-align:left">Campanha</th><th style="text-align:left">Período</th><th>Status</th><th>Eventos</th><th>Projeção Varejo</th><th>Projeção Atacado</th><th>Projeção total</th><th></th></tr></thead><tbody>'+linhas+'</tbody></table></div>':'<div class="card">Nenhuma campanha cadastrada.</div>')+
    '<div class="modal-actions" style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">'+(ed?'<button class="btn btn-primary" style="margin-right:auto" onclick="calAbrirCampanha(null)">+ Nova campanha</button>':'')+'<button class="btn btn-ghost" onclick="closeModal()">Fechar</button></div></div>');
}
function calAbrirCampanha(id){
  if(!calPodeEditar())return;
  var c=id?calCampanha(id):{status:'Planejada'};if(!c)return;
  var semCamp=function(){return calCache.eventos.filter(function(e){return !e.campanha_id;}).length;};
  openModal('<div class="modal-box pa-modal-wide" onclick="event.stopPropagation()"><div class="modal-title">'+(id?'✏️ Editar campanha':'+ Nova campanha')+'</div>'+
    '<div class="pa-filtros" style="flex-wrap:wrap"><label style="flex:2 1 260px">Nome *<input id="cal-c-nome" maxlength="120" value="'+calEsc(c.nome||'')+'" placeholder="Ex.: Carnaval 2027"></label>'+
      '<label>Início *<input id="cal-c-ini" type="date" value="'+calEsc(c.inicio?String(c.inicio).slice(0,10):'')+'"></label>'+
      '<label>Fim *<input id="cal-c-fim" type="date" value="'+calEsc(c.fim?String(c.fim).slice(0,10):'')+'"></label>'+
      '<label>Status<select id="cal-c-st">'+CAL_CAMP_STATUS.map(function(x){return '<option'+(x===c.status?' selected':'')+'>'+x+'</option>';}).join('')+'</select></label></div>'+
    '<label class="pa-lbl-bloco">Objetivo<textarea id="cal-c-obj" rows="2">'+calEsc(c.objetivo||'')+'</textarea></label>'+
    '<label class="pa-lbl-bloco">Observações<textarea id="cal-c-obs" rows="2">'+calEsc(c.observacoes||'')+'</textarea></label>'+
    (semCamp()?'<label style="display:flex;gap:8px;align-items:center;margin-top:10px;font-size:12.5px"><input type="checkbox" id="cal-c-ligar"> Ligar a esta campanha os eventos <b>sem campanha</b> que caem no período</label>':'')+
    '<div class="modal-actions" style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">'+
      (id?'<button class="btn btn-danger btn-sm" style="margin-right:auto" onclick="calExcluirCampanha('+id+')">🗑 Excluir</button>':'')+
      '<button class="btn btn-ghost" onclick="calAbrirCampanhas()">Voltar</button><button class="btn btn-primary" onclick="calSalvarCampanha('+(id||'null')+')">Salvar</button></div></div>');
}
async function calSalvarCampanha(id){
  if(!calPodeEditar())return;
  var g=function(x){var el=document.getElementById(x);return el?el.value:'';};
  var b={nome:g('cal-c-nome').trim(),inicio:g('cal-c-ini')||null,fim:g('cal-c-fim')||null,status:g('cal-c-st'),objetivo:g('cal-c-obj').trim()||null,observacoes:g('cal-c-obs').trim()||null};
  if(!b.nome||!b.inicio||!b.fim){showToast('Informe nome, início e fim da campanha.','error');return;}
  if(b.fim<b.inicio){showToast('A data de fim é anterior ao início.','error');return;}
  if(calCache.campanhas.some(function(c){return calNorm(c.nome)===calNorm(b.nome)&&String(c.id)!==String(id);})){showToast('Já existe uma campanha com este nome.','error');return;}
  var ligar=document.getElementById('cal-c-ligar')&&document.getElementById('cal-c-ligar').checked;
  try{
    var cid=id;
    if(id)await sb.patch('cda_cal_campanha',id,b);
    else{b.criado_por=(cu&&(cu.email||cu.name))||null;var r=await sb.post('cda_cal_campanha',b);cid=r&&r[0]&&r[0].id;}
    var n=0;
    if(ligar&&cid){
      var ini=b.inicio,fim=b.fim;
      var alvo=calCache.eventos.filter(function(e){if(e.campanha_id)return false;
        if(e.inicio){var d=String(e.inicio).slice(0,10);return d>=ini&&d<=fim;}
        if(e.ano&&e.mes){var m=e.ano+'-'+String(e.mes).padStart(2,'0');return m>=ini.slice(0,7)&&m<=fim.slice(0,7);}return false;});
      for(var i=0;i<alvo.length;i++){await sb.patch('cda_cal_evento',alvo[i].id,{campanha_id:cid});n++;}
    }
    showToast('Campanha salva'+(n?' · '+n+' evento(s) ligados':''),'success');
    await calCarregar();calRenderEventos();calAbrirCampanhas();
  }catch(e){calErro(e,'Não foi possível salvar a campanha');}
}
async function calExcluirCampanha(id){
  if(!calPodeEditar())return;
  var c=calCampanha(id),n=calCache.eventos.filter(function(e){return String(e.campanha_id)===String(id);}).length;
  if(!confirm('Excluir a campanha "'+(c?c.nome:'')+'"?'+(n?' Os '+n+' evento(s) ligados a ela continuam no calendário, sem campanha.':'')))return;
  try{await sb.del('cda_cal_campanha',id);if(String(calEstado.campanha)===String(id))calEstado.campanha='';showToast('Campanha excluída','success');await calCarregar();calRenderEventos();calAbrirCampanhas();}
  catch(e){calErro(e,'Não foi possível excluir a campanha');}
}

// ─── Tutorial ────────────────────────────────────────────────────────
function calTutorial(){
  var linhas=[
    ['Calendário Comercial','Agenda única de eventos e ações comerciais da Ciclo da Arte: shows, feiras, lançamentos, campanhas (Black Friday, Natal), base do e-commerce, projetos de private label e marcos. É a fonte para as projeções de receita e de compras (Simulações do Planejamento Anual).'],
    ['Campanha (🏷)','Nível acima dos eventos: agrupa os eventos de um período com o mesmo objetivo (ex.: Black Friday / Natal 2026, de 01/11 a 31/12/2026; no futuro Carnaval 2027, Dia das Mães 2027). Botão 🏷 Campanhas: cadastro (nome, período, status, objetivo), totais de projeção por campanha (Varejo, Atacado e total) e Ver eventos. Ao criar uma campanha, você pode ligar a ela os eventos sem campanha do período. Cada evento escolhe a campanha no seu cadastro; um evento novo no período de uma campanha recebe a sugestão de ligar-se a ela. Na importação do Excel, escolha a campanha dos eventos. As Simulações do Planejamento e os cenários salvos são feitos por campanha.'],
    ['Segmento (VJ / AT)','Varejo ou Atacado. Não é digitado no evento: vem do grupo do canal (Planejamento › Tabela de Grupos › Grupos de Receita › coluna Segmento). Regra: tudo é Varejo, menos Atacado / Private Label. Grupo sem segmento aparece com "?" e é tratado como Varejo. Os cartões mostram a projeção de Varejo e de Atacado dos eventos filtrados.'],
    ['Canal / Grupo','Cada evento se liga a um canal (centro de receita do Planejamento, ex.: SHOWS LUEDJI LUNA, REVENDA FUTURA 1) ou a um grupo (▦, ex.: E-commerce = todos os canais de e-commerce). Use grupo quando a venda se espalha pelos canais do grupo (base, Black Friday, lançamentos de collabs no e-commerce).'],
    ['Critério','Unidades = peças × ticket (shows, feiras, lançamentos, private label) · Pedidos = pedidos do e-commerce · A definir = ainda sem base de projeção.'],
    ['Ação IA projetada','Instrução de como projetar o evento (coluna J da planilha). Na fatia 2 vira o método de projeção: média por show da collab em 2026 · média por feira/evento em 2026 · mesmo período de 2025 × crescimento (e-commerce, Black Friday 20–30/11, Cyber Monday, Natal 01–24/12) · todas as vendas da collab · manual (peças × ticket) · só informar (custo já na Provisão Prevista) · a definir.'],
    ['📈 Projeção do evento','Bloco em destaque no cadastro do evento. O botão abre a base histórica do canal (ou dos canais do grupo): eventos, locais, público, peças, vendas, ticket e R$ por evento mês a mês — Prestação de Contas quando existe, senão Histórico de Compras; notas consolidadas (ticket acima de R$ 1.000 por peça) ficam fora da conta de peças e ticket. E-commerce (critério Pedidos): pedidos e ticket por pedido, com o mesmo mês do ano anterior como referência. Abaixo, a previsão: público previsto, quantidade (peças ou pedidos), ticket e o Total Venda Previsto (quantidade × ticket, automático). "Usar sugestão do histórico" e "Sugerir peças pelo público" (conversão peças ÷ público) preenchem os campos.'],
    ['Previsão obrigatória','Eventos Planejado, A confirmar e Confirmado só são salvos com quantidade e ticket, exceto quando marcados "Só informar". Selos: ✓ revisada (com quem e quando) · ⚠ sugerido — revisar (preenchido pelo histórico em 31/10/2026, falta a confirmação) · ⚠ previsão pendente. O cartão "Previsões a revisar" conta os sugeridos e pendentes.'],
    ['Status','Planejado · A confirmar · A definir · Confirmado · Realizado · Cancelado.'],
    ['⬆ Importar Excel','Lê a aba "Calendário …" da planilha comercial (colunas D e J, datas, collab, canal, critério, status e observações) e o bloco "Marcos e prazos" — marcos sem data entram no mês escolhido (padrão Novembro) e, se a collab já tiver evento no calendário, são unidos a ele. Antes de gravar, confira o Canal / Grupo de cada linha. Reimportar substitui só os eventos que vieram de Excel; os digitados na tela ficam.'],
    ['Editar / excluir','Clique na linha do evento.'],
    ['Projeção (fatia 2)','Valor esperado de cada evento (= Total Venda Previsto). Desde 31/10/2026 é informado pelo usuário em 📈 Projeção do evento; os 20 eventos que já tinham projeção receberam quantidade e ticket sugeridos pelo histórico, mantendo o valor aprovado, e aparecem como "revisar". Passe o mouse sobre o valor para ver a memória de cálculo. Shows e feiras: média por evento de 2025–2026 (valor vendido no mês ÷ nº de eventos de Financeiro › Canais de Venda › 📅 Eventos por mês; valor da Prestação de Contas quando existe, senão Histórico de Compras). E-commerce: nov/dez 2025 × desempenho 2026 sobre 2025 (jan–ago); Black Friday (20–30/11), Cyber Monday (01/12) e Natal (02–24/12) só com o que vendeu acima da média diária normal. Manuais: peças × ticket.'],
    ['Próximas etapas','Fatia 2: projeção automática por evento com as estatísticas de vendas (Histórico de Compras e Prestação de Contas). Fatia 3: Planejamento Anual › Simulações › Simulação Compras Black Friday / Natal (receita projetada → compras VJ/AT pela meta 25%/50% e pela proporção real de 2026, menos provisões). Fatia 4: visão mensal e realizado automático por evento.']
  ];
  openModal('<div class="modal-box pa-modal-wide" onclick="event.stopPropagation()"><div class="modal-title">ℹ️ Tutorial Informativo — Calendário Comercial</div>'+
    '<table class="pa-tbl" style="margin-top:8px"><thead><tr><th style="text-align:left;min-width:150px">Campo</th><th style="text-align:left">Para que serve</th></tr></thead><tbody>'+
    linhas.map(function(l){return '<tr><td style="font-weight:600;text-align:left">'+calEsc(l[0])+'</td><td style="text-align:left;white-space:normal;font-family:var(--ff-b);font-size:12.5px;color:var(--muted2)">'+calEsc(l[1])+'</td></tr>';}).join('')+
    '</tbody></table><div class="modal-actions" style="display:flex;justify-content:flex-end;margin-top:14px"><button class="btn btn-primary" onclick="closeModal()">Fechar</button></div></div>');
}

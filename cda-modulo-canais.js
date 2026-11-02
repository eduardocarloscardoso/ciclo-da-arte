// ════════════════════════════════════════════════════════════════════
// Financeiro › Canais de Venda — tela única do ecossistema (31/10/2026)
// Substitui a tela antiga (montarCanaisVenda no index.html) e a cópia escondida do financeiro.html.
// Estilo escuro (padrão do Planejamento e Calendário). Grupo e Segmento (Tabela de Grupos),
// eventos e público por mês (cda_canal_eventos_mes) e vendas do Histórico de Compras por período
// (view cda_v_vendas_canal_mes). Tabela única: public.canais.
// ════════════════════════════════════════════════════════════════════
// canais.tipo (Artista, Casa de Shows…) deixou de ser exibido em 31/10/2026: o Grupo cumpre o papel; o dado fica no banco.
var CAN_MESES_AB = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
var canEstado = {canal:'', segmento:'', grupo:'', collab:'', periodo:'ano', de:'', ate:'', modo:'cards', fechados:{}, ordem:'valor', desc:true, colModo:'cards', colOrdem:'valor', colDesc:true};
var canCache = null;

(function canEstilos(){
  if(document.getElementById('can-estilos'))return;
  var st=document.createElement('style');st.id='can-estilos';
  st.textContent=[
    '.can-sec{margin:18px 0 10px;display:flex;align-items:center;gap:10px;cursor:pointer;user-select:none;padding:8px 12px;background:var(--card);border:1px solid var(--border);border-radius:10px}',
    '.can-sec:hover{background:var(--card2)}.can-sec .n{font:600 14px var(--ff-b)}.can-sec .m{font-size:11.5px;color:var(--muted2)}.can-sec .tot{margin-left:auto;font:600 12px var(--ff-m);color:var(--gold2)}',
    '.can-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(285px,1fr));gap:12px}',
    '.can-card{background:var(--navy2);border:1px solid var(--border2);border-radius:12px;padding:14px 14px 10px;display:flex;flex-direction:column;gap:8px;transition:border-color .15s,transform .15s}',
    '.can-card:hover{border-color:rgba(201,148,58,.45);transform:translateY(-1px)}',
    '.can-card .nm{font:600 14px var(--ff-b);line-height:1.25}.can-card .sub{font-size:11px;color:var(--muted2);margin-top:2px}',
    '.can-chips{display:flex;flex-wrap:wrap;gap:5px}.can-chip{font:600 10px var(--ff-b);padding:2px 8px;border-radius:9px;background:var(--card2);color:var(--muted2);border:1px solid var(--border)}',
    '.can-chip.vj{background:rgba(74,158,255,.14);color:var(--blue);border-color:transparent}.can-chip.at{background:rgba(201,148,58,.16);color:var(--gold2);border-color:transparent}.can-chip.warn{color:var(--gold2)}',
    '.can-st{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;background:var(--card);border-radius:8px;padding:8px}',
    '.can-st div{display:flex;flex-direction:column}.can-st b{font:600 12.5px var(--ff-m);white-space:nowrap}.can-st span{font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}',
    '.can-act{display:flex;gap:6px;justify-content:flex-end;margin-top:2px}',
    '.can-btn{background:transparent;border:1px solid var(--border2);color:var(--white);border-radius:8px;padding:5px 10px;font:600 11.5px var(--ff-b);cursor:pointer}.can-btn:hover{background:var(--card2)}',
    '.can-btn.pri{background:var(--red);border-color:var(--red)}.can-btn.pri:hover{background:var(--red2)}.can-btn.dan{color:#ff8a98;border-color:rgba(232,51,74,.5)}',
    '.can-seg{display:inline-flex;border:1px solid var(--border2);border-radius:8px;overflow:hidden}.can-seg button{background:transparent;border:0;color:var(--muted2);padding:7px 12px;font:600 11.5px var(--ff-b);cursor:pointer}.can-seg button.on{background:var(--card2);color:var(--white)}',
    '.can-ov{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:900;display:flex;justify-content:flex-end}',
    '.can-dr{width:min(760px,96vw);height:100%;background:var(--navy2);border-left:1px solid var(--border2);display:flex;flex-direction:column;box-shadow:-12px 0 40px rgba(0,0,0,.4);animation:canIn .18s ease-out}',
    '@keyframes canIn{from{transform:translateX(40px);opacity:.4}to{transform:none;opacity:1}}',
    '.can-dr-h{padding:18px 22px 12px;border-bottom:1px solid var(--border);display:flex;align-items:flex-start;gap:10px}.can-dr-h h3{font:700 19px var(--ff-d)}.can-dr-h .sub{font-size:12px;color:var(--muted2);margin-top:3px}',
    '.can-dr-b{padding:16px 22px;overflow:auto;flex:1}.can-dr-f{padding:12px 22px;border-top:1px solid var(--border);display:flex;gap:8px;justify-content:flex-end}',
    '.can-fs{border:1px solid var(--border);border-radius:10px;padding:12px 14px;margin-bottom:12px}.can-fs legend{padding:0 6px;font:700 10px var(--ff-b);letter-spacing:.12em;text-transform:uppercase;color:var(--gold)}',
    '.can-fg{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.can-fg .w{grid-column:1/-1}.can-fg input,.can-fg select,.can-fg textarea{min-width:0;width:100%}',
    '.can-fg label,.can-lbl{display:flex;flex-direction:column;gap:4px;font:700 10px var(--ff-b);letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}',
    '.can-fg input,.can-fg select,.can-fg textarea,.can-in{background:var(--navy);color:var(--white);border:1px solid var(--border2);border-radius:8px;padding:8px 10px;font:13px var(--ff-b);text-transform:none;letter-spacing:0}',
    '.can-in{padding:5px 7px;font-size:12px}.can-ro{font:13px var(--ff-b);color:var(--muted2);padding:8px 0;text-transform:none;letter-spacing:0}',
    '.can-tbl td,.can-tbl th{white-space:nowrap}.can-tbl th.ord{cursor:pointer}.can-tbl th.ord:hover{color:var(--white)}',
    '.can-res{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px;margin-bottom:14px}',
    '.can-res div{background:var(--card);border:1px solid var(--border);border-radius:8px;padding:8px 10px}.can-res span{display:block;font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}.can-res b{font:600 13px var(--ff-m)}'
  ].join('');
  document.head.appendChild(st);
})();

function canEsc(v){return String(v===null||v===undefined?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function canNorm(s){return String(s||'').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');}
function canBRL(v){return (Number(v)||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0});}
function canBRL2(v){return (Number(v)||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});}
function canInt(v){return (Number(v)||0).toLocaleString('pt-BR');}
function canMes(am){if(!am)return '';var p=am.split('-');return CAN_MESES_AB[+p[1]-1]+'/'+p[0];}
function canPodeEditar(){return !(typeof isReadOnly==='function'&&isReadOnly());}
function canErro(e,padrao){var m=e&&e.response&&e.response.data&&(e.response.data.message||e.response.data.details);console.error('[Canais]',e);showToast(m||padrao,'error');}
function canAmAtual(){var d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');}
function canAmSoma(am,n){var p=am.split('-'),d=new Date(+p[0],+p[1]-1+n,1);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');}
function canPeriodo(){
  var at=canAmAtual();
  if(canEstado.periodo==='ano')return {de:at.slice(0,4)+'-01',ate:at,rot:'jan–'+CAN_MESES_AB[+at.slice(5,7)-1]+'/'+at.slice(0,4)};
  if(canEstado.periodo==='12m'){var de=canAmSoma(at,-11);return {de:de,ate:at,rot:'últimos 12 meses ('+canMes(de)+'–'+canMes(at)+')'};}
  if(canEstado.periodo==='tudo')return {de:'2000-01',ate:'2999-12',rot:'todo o histórico'};
  var d=canEstado.de||canAmSoma(at,-11),a=canEstado.ate||at;if(a<d){var t=d;d=a;a=t;}
  return {de:d,ate:a,rot:canMes(d)+' a '+canMes(a)};
}
// Canal com eventos (shows / feiras): grupo ou nome, ou já tem meses registrados
function canTemEventos(c){
  if(c.exige_eventos)return true;
  var g=canGrupo(c);
  return /show|feira|evento|bazar/i.test(g?g.nome:'')||/^shows?\b|feira|evento|bazar/i.test(c.nome||'')||canCache.evMes.some(function(r){return String(r.canal_id)===String(c.id);});
}
function canGrupo(c){return c.grupo_id?canCache.grupos.find(function(g){return String(g.id)===String(c.grupo_id);})||null:null;}
function canSegmento(c){var g=canGrupo(c);return g?(g.segmento||'varejo'):'';}
function canSegChip(c){var g=canGrupo(c);if(!g)return '<span class="can-chip warn" title="Sem grupo: defina em ✏ Editar">sem grupo</span>';var s=g.segmento||'varejo';return '<span class="can-chip '+(s==='atacado'?'at':'vj')+'" title="Segmento do grupo'+(g.segmento?'':' (não definido — tratado como Varejo)')+'">'+(s==='atacado'?'Atacado':'Varejo')+(g.segmento?'':'?')+'</span>';}

// ─── Entrada (Financeiro › Canais de Venda) ──────────────────────────
async function navigateCanais(){
  var el=document.getElementById('main-content');
  var banner=(typeof isReadOnly==='function'&&isReadOnly())?'<div class="readonly-banner">👁 Modo somente leitura — você pode consultar, mas não alterar.</div>':'';
  el.innerHTML=banner+'<div class="ph"><h1>🏷 Canais de Venda</h1><p>Financeiro · Artistas, casas de shows, revendas, feiras e e-commerces</p></div><div id="can-root"><div class="card">Carregando…</div></div>';
  try{await canCarregar();canRender();}
  catch(e){var r0=document.getElementById('can-root');if(!r0)return;r0.innerHTML='<div class="card">Não foi possível carregar os canais. Atualize a página e tente novamente.</div>';canErro(e,'Falha ao carregar os Canais de Venda');}
}
async function canCarregar(){
  var r=await Promise.all([
    sb.get('canais','order=nome'),
    sb.get('parceiros','select=id,nome,obs&order=nome'),
    sb.get('cda_grupo','order=tipo,ordem,nome'),
    sb.get('cda_canal_eventos_mes','order=ano_mes.desc'),
    sb.get('cda_pa_v_hierarquia','tipo=eq.RECEITAS&select=centro_custo_id,centro_nome,subconta_nome')
  ]);
  canCache={canais:r[0]||[],parceiros:r[1]||[],gruposTodos:r[2]||[],evMes:r[3]||[],centros:r[4]||[],vendas:null,vendasChave:''};
  canCache.grupos=canCache.gruposTodos.filter(function(g){return g.tipo==='Receita';});
  await canCarregarVendas();
}
async function canCarregarVendas(){
  var P=canPeriodo(),k=P.de+'|'+P.ate;if(canCache.vendasChave===k)return;
  var rows=[],off=0,lote;
  do{lote=await sb.get('cda_v_vendas_canal_mes','select=canal_id,ano_mes,pedidos,pecas,valor&ano_mes=gte.'+P.de+'&ano_mes=lte.'+P.ate+'&order=canal_id,ano_mes&limit=1000&offset='+off)||[];rows=rows.concat(lote);off+=1000;}while(lote.length===1000);
  canCache.vendas=rows;canCache.vendasChave=k;
}
// Números do canal no período
function canNumeros(c){
  var P=canPeriodo(),n={eventos:0,publico:null,pedidos:0,pecas:0,valor:0};
  canCache.evMes.forEach(function(r){if(String(r.canal_id)!==String(c.id)||r.ano_mes<P.de||r.ano_mes>P.ate)return;n.eventos+=r.qtd_eventos||0;if(r.publico!==null&&r.publico!==undefined)n.publico=(n.publico||0)+r.publico;});
  canCache.vendas.forEach(function(v){if(String(v.canal_id)!==String(c.id))return;n.pedidos+=+v.pedidos||0;n.pecas+=+v.pecas||0;n.valor+=+v.valor||0;});
  n.ticket=n.pecas?n.valor/n.pecas:null;return n;
}
function canFiltrados(){
  return canCache.canais.filter(function(c){
    if(canEstado.canal&&String(c.id)!==String(canEstado.canal))return false;
    if(canEstado.segmento&&canSegmento(c)!==canEstado.segmento)return false;
    if(canEstado.grupo==='sem'){if(c.grupo_id)return false;}else if(canEstado.grupo&&String(c.grupo_id)!==String(canEstado.grupo))return false;
    if(canEstado.collab&&String(c.parceiro_id)!==String(canEstado.collab))return false;
    return true;
  });
}

// ─── Render ──────────────────────────────────────────────────────────
function canRender(){
  if(!document.getElementById('can-root')||!canCache)return;
  var ed=canPodeEditar(),P=canPeriodo(),lista=canFiltrados(),N={};
  lista.forEach(function(c){N[c.id]=canNumeros(c);});
  var h='<div class="pa-filtros">'+canFiltrosHTML('canRender')+
    '<div class="pa-acoes" style="align-items:flex-end"><div class="can-seg" role="group" aria-label="Modo de exibição"><button class="'+(canEstado.modo==='cards'?'on':'')+'" onclick="canEstado.modo=\'cards\';canRender()">▦ Cartões</button><button class="'+(canEstado.modo==='lista'?'on':'')+'" onclick="canEstado.modo=\'lista\';canRender()">☰ Lista</button></div>'+
    (ed?'<button class="can-btn pri" onclick="canAbrirCanal(null)">+ Novo canal</button>':'')+
    '<button class="can-btn" onclick="canTutorial()">ℹ️ Tutorial</button></div></div>';
  var T={vj:0,at:0,eventos:0,publico:0,temPub:false,valor:0,pecas:0};
  lista.forEach(function(c){var s=canSegmento(c),n=N[c.id];if(s==='atacado')T.at++;else T.vj++;T.eventos+=n.eventos;if(n.publico!==null){T.publico+=n.publico;T.temPub=true;}T.valor+=n.valor;T.pecas+=n.pecas;});
  h+='<div class="pa-kpis pa-kpis-mini">'+
    paKpi('Canais',String(lista.length),'','var(--gold)')+
    paKpi('Varejo · Atacado',T.vj+' · '+T.at,'','var(--blue)')+
    paKpi('Eventos no período',canInt(T.eventos),'','var(--purple)')+
    paKpi('Público no período',T.temPub?canInt(T.publico):'—','','var(--teal)')+
    paKpi('Vendas no período',canBRL(T.valor),canInt(T.pecas)+' peças','var(--green)')+'</div>';
  h+='<div class="pa-info" style="margin:-2px 0 6px;font-size:12px;color:var(--muted2)">Período: <b>'+canEsc(P.rot)+'</b> · vendas do Histórico de Compras · ticket = valor ÷ peças</div>';
  if(!lista.length)h+='<div class="card">Nenhum canal com estes filtros.</div>';
  else if(canEstado.modo==='lista')h+=canLista(lista,N);
  else h+=canCartoes(lista,N);
  var root=document.getElementById('can-root');if(root)root.innerHTML=h; // usuário pode ter trocado de tela durante a carga
}
// Filtros comuns a Canais de Venda e Collabs / Vendedores: Segmento · Grupo · Collab · Canal · Período
function canSel(id,lab,opts,val,onch){return '<label>'+lab+'<select id="'+id+'" onchange="'+onch+'">'+opts.map(function(o){return '<option value="'+canEsc(o[0])+'"'+(String(o[0])===String(val)?' selected':'')+'>'+canEsc(o[1])+'</option>';}).join('')+'</select></label>';}
function canFiltrosHTML(fn){
  var gruposUsados=canCache.grupos.filter(function(g){return canCache.canais.some(function(c){return String(c.grupo_id)===String(g.id);});});
  var canalSel=canEstado.canal?canCache.canais.find(function(c){return String(c.id)===String(canEstado.canal);}):null;
  var P=canPeriodo();
  return canSel('can-f-seg','Segmento',[['','Todos'],['varejo','Varejo'],['atacado','Atacado']],canEstado.segmento,'canEstado.segmento=this.value;'+fn+'()')+
    canSel('can-f-grupo','Grupo',[['','Todos'],['sem','Sem grupo']].concat(gruposUsados.map(function(g){return [g.id,g.nome];})),canEstado.grupo,'canEstado.grupo=this.value;'+fn+'()')+
    canSel('can-f-collab','Collab',[['','Todos']].concat(canCache.parceiros.map(function(p){return [p.id,p.nome];})),canEstado.collab,'canEstado.collab=this.value;'+fn+'()')+
    '<label>Canal<input id="can-f-canal" list="can-l-canais" placeholder="Todos — digite para escolher" value="'+canEsc(canalSel?canalSel.nome:'')+'" onchange="canEscolherCanal(this.value,\''+fn+'\')" style="min-width:230px"><datalist id="can-l-canais">'+canCache.canais.slice().sort(function(a,b){return String(a.nome).localeCompare(b.nome);}).map(function(c){return '<option value="'+canEsc(c.nome)+'">';}).join('')+'</datalist></label>'+
    canSel('can-f-per','Período',[['ano','Ano atual'],['12m','Últimos 12 meses'],['tudo','Todo o histórico'],['custom','Personalizado']],canEstado.periodo,'canTrocarPeriodo(this.value,\''+fn+'\')')+
    (canEstado.periodo==='custom'?'<label>De<input type="month" value="'+canEsc(canEstado.de||P.de)+'" onchange="canEstado.de=this.value;canTrocarPeriodo(\'custom\',\''+fn+'\')"></label><label>Até<input type="month" value="'+canEsc(canEstado.ate||P.ate)+'" onchange="canEstado.ate=this.value;canTrocarPeriodo(\'custom\',\''+fn+'\')"></label>':'');
}
function canEscolherCanal(nome,fn){
  var t=canNorm(nome);
  if(!t)canEstado.canal='';
  else{var c=canCache.canais.find(function(x){return canNorm(x.nome)===t;})||canCache.canais.find(function(x){return canNorm(x.nome).indexOf(t)>=0;});
    if(!c)showToast('Canal não encontrado: escolha um nome da lista.','info');canEstado.canal=c?String(c.id):'';}
  window[fn]();
}
async function canTrocarPeriodo(v,fn){
  canEstado.periodo=v;
  try{await canCarregarVendas();}catch(e){canErro(e,'Não foi possível carregar as vendas do período');}
  window[fn||'canRender']();
}
function canCartoes(lista,N){
  var sec={},ordem=[];
  lista.forEach(function(c){var g=canGrupo(c),k=g?String(g.id):'sem';if(!sec[k]){sec[k]={g:g,cs:[],valor:0};ordem.push(k);}sec[k].cs.push(c);sec[k].valor+=N[c.id].valor;});
  ordem.sort(function(a,b){var ga=sec[a].g,gb=sec[b].g;if(!ga)return 1;if(!gb)return -1;return ((ga.segmento==='atacado')-(gb.segmento==='atacado'))||sec[b].valor-sec[a].valor;});
  return ordem.map(function(k){
    var s=sec[k],g=s.g,fech=!!canEstado.fechados[k];
    s.cs.sort(function(a,b){return N[b.id].valor-N[a.id].valor||String(a.nome).localeCompare(b.nome);});
    var seg=g?'<span class="can-chip '+((g.segmento||'varejo')==='atacado'?'at':'vj')+'">'+((g.segmento||'varejo')==='atacado'?'Atacado':'Varejo')+'</span>':'';
    return '<div class="can-sec" role="button" aria-expanded="'+!fech+'" onclick="canEstado.fechados[\''+k+'\']=!canEstado.fechados[\''+k+'\'];canRender()"><span>'+(fech?'▸':'▾')+'</span><span class="n">'+(g?'▦ '+canEsc(g.nome):'Sem grupo')+'</span>'+seg+'<span class="m">'+s.cs.length+' cana'+(s.cs.length===1?'l':'is')+'</span><span class="tot">'+canBRL(s.valor)+'</span></div>'+
      (fech?'':'<div class="can-grid">'+s.cs.map(function(c){return canCard(c,N[c.id]);}).join('')+'</div>');
  }).join('');
}
function canCard(c,n){
  var parc=canCache.parceiros.find(function(p){return String(p.id)===String(c.parceiro_id);});
  var ev=canTemEventos(c);
  return '<div class="can-card"><div><div class="nm">'+canEsc(c.nome)+'</div><div class="sub">'+(parc?canEsc(parc.nome):'<span class="pa-mut">sem collab</span>')+'</div></div>'+
    '<div class="can-chips">'+canSegChip(c)+(c.comissao!==null&&c.comissao!==undefined?'<span class="can-chip" title="Comissão">'+String(c.comissao).replace('.',',')+'% comissão</span>':'')+(c.escopo==='b2b'?'<span class="can-chip" title="Fora do universo B2C">B2B</span>':'')+'</div>'+
    '<div class="can-st"><div><b>'+canBRL(n.valor)+'</b><span>vendas</span></div><div><b>'+canInt(n.pecas)+'</b><span>peças</span></div><div><b>'+(n.ticket===null?'—':canBRL2(n.ticket))+'</b><span>ticket</span></div>'+
      (ev?'<div><b>'+canInt(n.eventos)+'</b><span>eventos</span></div><div><b>'+(n.publico===null?'—':canInt(n.publico))+'</b><span>público</span></div><div><b>'+(n.eventos?canBRL(n.valor/n.eventos):'—')+'</b><span>R$ / evento</span></div>':'')+'</div>'+
    '<div class="can-act">'+(ev?'<button class="can-btn" onclick="canAbrirEventos('+c.id+')" title="Eventos, público e vendas mês a mês">📅 Eventos</button>':'')+'<button class="can-btn" onclick="canAbrirCanal('+c.id+')">✏ Editar</button></div></div>';
}
function canLista(lista,N){
  var cols=[['nome','Canal','l'],['grupo','Grupo','l'],['seg','Seg.','c'],['collab','Collab','l'],['comissao','Comissão','r'],['eventos','Eventos','r'],['publico','Público','r'],['pedidos','Pedidos','r'],['pecas','Peças','r'],['valor','Vendas','r'],['ticket','Ticket','r'],['porEv','R$ / evento','r']];
  var val=function(c,k){var n=N[c.id],g=canGrupo(c);switch(k){case 'nome':return canNorm(c.nome);case 'grupo':return canNorm(g?g.nome:'~');case 'seg':return canSegmento(c);case 'collab':var pp=canCache.parceiros.find(function(p){return String(p.id)===String(c.parceiro_id);});return canNorm(pp?pp.nome:'~');case 'comissao':return +c.comissao||0;case 'porEv':return n.eventos?n.valor/n.eventos:-1;case 'publico':return n.publico===null?-1:n.publico;case 'ticket':return n.ticket===null?-1:n.ticket;default:return n[k]||0;}};
  var o=canEstado.ordem,d=canEstado.desc?-1:1;
  lista=lista.slice().sort(function(a,b){var x=val(a,o),y=val(b,o);return (x<y?-1:x>y?1:0)*d;});
  return '<div class="pa-tbl-wrap"><table class="pa-tbl pa-compacta can-tbl"><thead><tr>'+cols.map(function(c){return '<th class="ord" style="text-align:'+(c[2]==='l'?'left':c[2]==='c'?'center':'right')+'" onclick="canOrdenar(\''+c[0]+'\')">'+c[1]+(o===c[0]?(canEstado.desc?' ▾':' ▴'):'')+'</th>';}).join('')+'<th></th></tr></thead><tbody>'+
    lista.map(function(c){var n=N[c.id],g=canGrupo(c),ev=canTemEventos(c),s=canSegmento(c);
      return '<tr><td style="text-align:left;font-weight:600">'+canEsc(c.nome)+'</td><td style="text-align:left">'+(g?canEsc(g.nome):'<span class="pa-mut">—</span>')+'</td><td style="text-align:center">'+(s?'<span class="can-chip '+(s==='atacado'?'at':'vj')+'">'+(s==='atacado'?'AT':'VJ')+'</span>':'—')+'</td><td style="text-align:left">'+canEsc((canCache.parceiros.find(function(p){return String(p.id)===String(c.parceiro_id);})||{}).nome||'—')+'</td>'+
        '<td>'+(c.comissao!==null&&c.comissao!==undefined?String(c.comissao).replace('.',',')+'%':'—')+'</td><td>'+(ev?canInt(n.eventos):'—')+'</td><td>'+(n.publico===null?'—':canInt(n.publico))+'</td><td>'+canInt(n.pedidos)+'</td><td>'+canInt(n.pecas)+'</td><td><b>'+canBRL2(n.valor)+'</b></td><td>'+(n.ticket===null?'—':canBRL2(n.ticket))+'</td><td>'+(ev&&n.eventos?canBRL2(n.valor/n.eventos):'—')+'</td>'+
        '<td style="text-align:right">'+(ev?'<button class="can-btn" title="Eventos" onclick="canAbrirEventos('+c.id+')">📅</button> ':'')+'<button class="can-btn" title="Editar" onclick="canAbrirCanal('+c.id+')">✏</button></td></tr>';}).join('')+
    '</tbody></table></div>';
}
function canOrdenar(k){if(canEstado.ordem===k)canEstado.desc=!canEstado.desc;else{canEstado.ordem=k;canEstado.desc=['nome','grupo','seg','collab'].indexOf(k)<0;}canRender();}

// ─── Painel lateral ──────────────────────────────────────────────────
function canPainel(html){canFecharPainel();var d=document.createElement('div');d.className='can-ov';d.id='can-ov';d.onclick=function(e){if(e.target===d)canFecharPainel();};d.innerHTML='<div class="can-dr" role="dialog" aria-modal="true">'+html+'</div>';document.body.appendChild(d);document.addEventListener('keydown',canEsc_);}
function canEsc_(e){if(e.key==='Escape')canFecharPainel();}
function canFecharPainel(){var d=document.getElementById('can-ov');if(d)d.remove();document.removeEventListener('keydown',canEsc_);}

// Cadastro do canal
function canAbrirCanal(id){
  var ed=canPodeEditar(),c=id?canCache.canais.find(function(x){return String(x.id)===String(id);}):{};if(!c)return;
  var dis=ed?'':' disabled',v=function(x){return x===null||x===undefined?'':canEsc(x);};
  var grupos=canCache.grupos.filter(function(g){return g.ativo!==false||String(g.id)===String(c.grupo_id);});
  var cc=c.centro_custo_id?canCache.centros.find(function(x){return String(x.centro_custo_id)===String(c.centro_custo_id);}):null;
  var g=canGrupo(c);
  canPainel('<div class="can-dr-h"><div style="flex:1"><h3>'+(id?'✏ '+canEsc(c.nome):'+ Novo canal de venda')+'</h3><div class="sub">'+(id?canEsc((canCache.parceiros.find(function(p){return String(p.id)===String(c.parceiro_id);})||{}).nome||'sem collab'):'Cadastro do canal')+'</div></div><button class="can-btn" onclick="canFecharPainel()" aria-label="Fechar">✕</button></div>'+
    '<div class="can-dr-b">'+
    '<fieldset class="can-fs"><legend>Identificação</legend><div class="can-fg">'+
      '<label class="w">Nome do canal *<input id="can-e-nome" value="'+v(c.nome)+'"'+dis+'></label>'+
      '<label class="w">Collab / vendedor<select id="can-e-parc"'+dis+'><option value="">— nenhum —</option>'+canCache.parceiros.map(function(p){return '<option value="'+p.id+'"'+(String(p.id)===String(c.parceiro_id)?' selected':'')+'>'+canEsc(p.nome)+'</option>';}).join('')+'</select></label>'+
      '<label>Grupo<select id="can-e-grupo" onchange="canMostrarSeg(this.value)"'+dis+'><option value="">— sem grupo —</option>'+grupos.map(function(x){return '<option value="'+x.id+'"'+(String(x.id)===String(c.grupo_id)?' selected':'')+'>'+canEsc(x.nome)+'</option>';}).join('')+'</select></label>'+
      '<label>Segmento<div class="can-ro" id="can-e-seg">'+canSegTexto(g)+'</div></label>'+
      '<label class="w" style="flex-direction:row;align-items:center;gap:8px;text-transform:none;letter-spacing:0;font-size:12.5px"><input type="checkbox" style="width:auto" id="can-e-exev"'+(c.id?(c.exige_eventos?' checked':''):'')+dis+'> Exige registro de eventos (nº de eventos, locais e público na Prestação de Contas de cada mês)</label>'+
      '<label class="w">Centro de receita (Planejamento)<div class="can-ro">'+(cc?canEsc(cc.centro_nome)+' <span class="pa-mut">· '+canEsc(cc.subconta_nome)+'</span>':'— não ligado —')+'</div></label>'+
    '</div></fieldset>'+
    '<fieldset class="can-fs"><legend>Condições</legend><div class="can-fg" style="grid-template-columns:repeat(4,minmax(0,1fr))">'+
      '<label title="Vazio = padrão do sistema">Comissão %<input id="can-e-com" placeholder="padrão" type="number" step="0.01" value="'+v(c.comissao)+'"'+dis+'></label>'+
      '<label title="Sobre total da venda + frete">Imposto %<input id="can-e-imp" type="number" step="0.01" value="'+v(c.pct_imp)+'"'+dis+'></label>'+
      '<label title="Desconto operacional (shows / loja itinerante)">Desc. operac. %<input id="can-e-op" type="number" step="0.01" value="'+v(c.pct_op)+'"'+dis+'></label>'+
      '<label title="Desconto das casas de shows">Desc. casas show %<input id="can-e-cs" type="number" step="0.01" value="'+v(c.pct_cs)+'"'+dis+'></label>'+
      '<label class="w" style="flex-direction:row;align-items:center;gap:8px;text-transform:none;letter-spacing:0;font-size:12.5px"><input type="checkbox" style="width:auto" id="can-e-frete"'+(c.sem_frete?' checked':'')+dis+'> Desconsiderar o frete no cálculo e na exibição da Prestação de Contas</label>'+
    '</div></fieldset>'+
    '<fieldset class="can-fs"><legend>Contato e observações</legend><div class="can-fg">'+
      '<label class="w">E-mail<input id="can-e-email" type="email" value="'+v(c.email)+'"'+dis+'></label>'+
      '<label class="w">Observações<textarea id="can-e-obs" rows="3"'+dis+'>'+v(c.obs)+'</textarea></label>'+
    '</div></fieldset></div>'+
    '<div class="can-dr-f">'+(id&&ed?'<button class="can-btn dan" style="margin-right:auto" onclick="canExcluirCanal('+id+')">🗑 Excluir canal</button>':'')+
      '<button class="can-btn" onclick="canFecharPainel()">'+(ed?'Cancelar':'Fechar')+'</button>'+(ed?'<button class="can-btn pri" id="can-e-ok" onclick="canSalvarCanal('+(id||'null')+')">Salvar</button>':'')+'</div>');
  var n=document.getElementById('can-e-nome');if(n&&ed)n.focus();
}
function canSegTexto(g){if(!g)return '— escolha o grupo —';var s=g.segmento||'varejo';return '<span class="can-chip '+(s==='atacado'?'at':'vj')+'">'+(s==='atacado'?'Atacado':'Varejo')+'</span> <span class="pa-mut" style="font-size:11px">vem do grupo'+(g.segmento?'':' (não definido — tratado como Varejo)')+'</span>';}
function canMostrarSeg(gid){var g=gid?canCache.grupos.find(function(x){return String(x.id)===String(gid);}):null;document.getElementById('can-e-seg').innerHTML=canSegTexto(g);}
async function canSalvarCanal(id){
  if(!canPodeEditar())return;
  var gv=function(x){return document.getElementById(x).value;},num=function(x){var n=parseFloat(gv(x));return isNaN(n)?null:n;};
  var nome=gv('can-e-nome').trim();if(!nome){showToast('Informe o nome do canal.','error');return;}
  if(canCache.canais.some(function(c){return canNorm(c.nome)===canNorm(nome)&&String(c.id)!==String(id);})){showToast('Já existe um canal com este nome.','error');return;}
  var b={nome:nome,parceiro_id:gv('can-e-parc')?+gv('can-e-parc'):null,grupo_id:gv('can-e-grupo')?+gv('can-e-grupo'):null,
    comissao:num('can-e-com'),pct_imp:num('can-e-imp'),pct_op:num('can-e-op'),pct_cs:num('can-e-cs'),sem_frete:document.getElementById('can-e-frete').checked,
    email:gv('can-e-email').trim()||null,obs:gv('can-e-obs').trim()||null,exige_eventos:document.getElementById('can-e-exev').checked};
  var btn=document.getElementById('can-e-ok');btn.disabled=true;btn.textContent='Salvando…';
  try{
    if(id)await sb.patch('canais',id,b);
    else{b.id=typeof cdaUid==='function'?cdaUid():Date.now();await sb.post('canais',b);}
    canFecharPainel();showToast('Canal salvo','success');
    canCache.canais=await sb.get('canais','order=nome');canRender();
  }catch(e){btn.disabled=false;btn.textContent='Salvar';canErro(e,'Não foi possível salvar o canal');}
}
async function canExcluirCanal(id){
  var c=canCache.canais.find(function(x){return String(x.id)===String(id);});if(!c)return;
  var vendas=0,prest=0;
  try{var r=await sb.get('compras','select=id&canal_id=eq.'+id+'&limit=1');vendas=(r||[]).length;}catch(e){vendas=1;}
  // Prestações: canal principal (canal_id) ou seções de prestações multi-canal (dados.secoes)
  try{var ps=await sb.get('prestacoes','select=id,canal_id,dados');prest=(ps||[]).filter(function(p){var d=p.dados||{};return String(p.canal_id)===String(id)||String(d.collab_id)===String(id)||(d.secoes||[]).some(function(s){return String(s.canal_id)===String(id)||s.canal===c.nome;});}).length;}catch(e){prest=1;}
  if(prest){alert('O canal "'+c.nome+'" tem prestação(ões) de contas ligadas e não pode ser excluído.');return;}
  if(vendas){alert('O canal "'+c.nome+'" tem pedidos no Histórico de Compras e não pode ser excluído. Use as Observações para marcá-lo como inativo ou mova-o para o grupo "Canais inativos".');return;}
  if(!confirm('Excluir o canal "'+c.nome+'"?\nEsta ação não pode ser desfeita.'))return;
  try{await sb.del('canais',id);canFecharPainel();showToast('Canal excluído','success');canCache.canais=canCache.canais.filter(function(x){return String(x.id)!==String(id);});canRender();}
  catch(e){alert('Não foi possível excluir. Pode haver prestações ou outros registros ligados a este canal.');console.error(e);}
}

// Eventos do canal: eventos, locais e público por mês (editável) + vendas do mês (Histórico)
async function canAbrirEventos(id){
  var c=canCache.canais.find(function(x){return String(x.id)===String(id);});if(!c)return;
  canPainel('<div class="can-dr-h"><div style="flex:1"><h3>📅 '+canEsc(c.nome)+'</h3><div class="sub">Eventos, público e vendas mês a mês</div></div><button class="can-btn" onclick="canFecharPainel()" aria-label="Fechar">✕</button></div><div class="can-dr-b" id="can-ev-b">Carregando…</div>');
  try{
    var r=await Promise.all([sb.get('cda_canal_eventos_mes','canal_id=eq.'+id+'&order=ano_mes.desc'),sb.get('cda_v_vendas_canal_mes','canal_id=eq.'+id+'&order=ano_mes.desc')]);
    if(document.getElementById('can-ev-b'))canRenderEventos(c,r[0]||[],r[1]||[]);
  }catch(e){var b0=document.getElementById('can-ev-b');if(b0)b0.innerHTML='<div class="card">Não foi possível carregar os eventos.</div>';canErro(e,'Falha ao carregar os eventos');}
}
function canRenderEventos(c,ev,vd){
  var ed=false,meses={},V={}; // só consulta: eventos são lançados na Prestação de Contas (01/11/2026)
  vd.forEach(function(x){V[x.ano_mes]=x;});
  ev.forEach(function(x){meses[x.ano_mes]=1;});
  var lista=Object.keys(meses).sort().reverse();
  // Resumo: só meses com evento registrado (base da média por evento)
  var R={eventos:0,publico:0,temPub:false,valor:0,pecas:0,pedidos:0,pecasPub:0};
  ev.forEach(function(x){var v=V[x.ano_mes]||{};R.eventos+=x.qtd_eventos||0;R.valor+=+v.valor||0;R.pecas+=+v.pecas||0;R.pedidos+=+v.pedidos||0;if(x.publico!==null&&x.publico!==undefined){R.publico+=x.publico;R.temPub=true;R.pecasPub+=+v.pecas||0;}});
  var h='<div class="can-res">'+
    '<div><span>Eventos</span><b>'+canInt(R.eventos)+'</b></div>'+
    '<div><span>Vendas nos meses com evento</span><b>'+canBRL(R.valor)+'</b></div>'+
    '<div><span>Peças</span><b>'+canInt(R.pecas)+'</b></div>'+
    '<div><span>Ticket (R$/peça)</span><b>'+(R.pecas?canBRL2(R.valor/R.pecas):'—')+'</b></div>'+
    '<div><span>R$ por evento</span><b>'+(R.eventos?canBRL(R.valor/R.eventos):'—')+'</b></div>'+
    '<div><span>Peças por evento</span><b>'+(R.eventos?(R.pecas/R.eventos).toLocaleString('pt-BR',{maximumFractionDigits:1}):'—')+'</b></div>'+
    '<div><span>Público</span><b>'+(R.temPub?canInt(R.publico):'—')+'</b></div>'+
    '<div><span>Conversão (peças ÷ público)</span><b>'+(R.temPub&&R.publico?(R.pecasPub/R.publico).toLocaleString('pt-BR',{maximumFractionDigits:3}):'—')+'</b></div></div>';
  h+='<p class="pa-info" style="margin:0 0 10px;font-size:12px">Vendas, peças e ticket vêm do Histórico de Compras do canal no mês. Eventos, locais e público são lançados e concluídos na <b>Prestação de Contas</b> do mês (Financeiro › Prestação de Contas › Resumo por Canal de Venda › 📅 Eventos do mês) — aqui é só consulta. A conversão usa só os meses com público informado.</p>';
  h+='<div class="pa-tbl-wrap"><table class="pa-tbl pa-compacta can-tbl"><thead><tr><th style="text-align:left">Mês</th><th>Eventos</th><th style="text-align:left">Locais</th><th>Público</th><th>Pedidos</th><th>Peças</th><th>Vendas</th><th>Ticket</th><th>R$ / evento</th><th>Situação</th></tr></thead><tbody>';
  if(!lista.length)h+='<tr><td colspan="10" style="text-align:left" class="pa-mut">Nenhum mês registrado ainda.</td></tr>';
  lista.forEach(function(am){
    var x=ev.find(function(r){return r.ano_mes===am;})||{},v=V[am]||{},q=x.qtd_eventos||0,val=+v.valor||0,pc=+v.pecas||0;
    var inp=function(campo,valor,w,tipo){return ed?'<input class="can-in" '+(tipo==='n'?'type="number" min="0" step="1" style="width:'+w+'px;text-align:right"':'style="width:'+w+'px"')+' value="'+canEsc(valor===null||valor===undefined?'':valor)+'" onchange="canSalvarMes('+c.id+',\''+am+'\',\''+campo+'\',this.value)">':canEsc(valor===null||valor===undefined?'—':valor);};
    h+='<tr><td style="text-align:left;font-weight:600">'+canMes(am)+'</td><td>'+inp('qtd_eventos',x.qtd_eventos,56,'n')+'</td><td style="text-align:left">'+inp('observacao',x.observacao,230)+'</td><td>'+inp('publico',x.publico,76,'n')+'</td>'+
      '<td>'+canInt(v.pedidos)+'</td><td>'+canInt(pc)+'</td><td>'+canBRL2(val)+'</td><td>'+(pc?canBRL2(val/pc):'—')+'</td><td>'+(q?canBRL(val/q):'—')+'</td>'+
      '<td>'+(x.concluido?'<span class="can-chip vj" title="'+canEsc('Concluído por '+(x.concluido_por||'—')+(x.concluido_em?' em '+new Date(x.concluido_em).toLocaleDateString('pt-BR'):''))+'" style="background:rgba(62,201,122,.15);color:var(--green)">✓ concluído</span>':'<span class="can-chip warn">pendente</span>')+'</td></tr>';
  });
  h+='</tbody></table></div>';
  var semEv=vd.filter(function(x){return !meses[x.ano_mes];}).length;
  if(semEv)h+='<p class="pa-info" style="margin-top:8px;font-size:11.5px;color:var(--muted2)">'+semEv+' mês(es) com vendas sem evento registrado não aparecem na lista (ex.: vendas no e-commerce do artista fora de shows).</p>';
  document.getElementById('can-ev-b').innerHTML=h;
}
// Edição de eventos saiu desta tela (01/11/2026): lançamento e correção só na Prestação de Contas.
async function canAtualizarEventos(canalId){
  var c=canCache.canais.find(function(x){return String(x.id)===String(canalId);});
  var r=await Promise.all([sb.get('cda_canal_eventos_mes','canal_id=eq.'+canalId+'&order=ano_mes.desc'),sb.get('cda_v_vendas_canal_mes','canal_id=eq.'+canalId+'&order=ano_mes.desc'),sb.get('cda_canal_eventos_mes','order=ano_mes.desc')]);
  canCache.evMes=r[2]||[];canRenderEventos(c,r[0]||[],r[1]||[]);canRender();
}

// ─── Tutorial ────────────────────────────────────────────────────────
function canTutorial(){
  var l=[
    ['Para que serve','Cadastro único dos canais de venda do ecossistema (tabela canais): quem vende, em que condições (comissão, impostos, op., CS, frete), a que grupo e segmento pertence, e o desempenho no período. É usado pela Prestação de Contas, Histórico de Compras, Clientes, Segmentação, Comercial, Planejamento e Calendário.'],
    ['Grupo e Segmento','O grupo vem de Planejamento › Estrutura › Grupos e Segmentos (Shows de artistas, Feiras e bazares, E-commerce…). O Segmento (Varejo / Atacado) é do grupo — não se digita no canal. Canal sem grupo aparece na seção "Sem grupo".'],
    ['Filtros','Segmento · Grupo · Collab · Canal (digite e escolha na lista) · Período — os mesmos de Collabs / Vendedores, e compartilhados entre as duas telas.'],
    ['Período','Ano atual, últimos 12 meses, todo o histórico ou personalizado (de/até). Vale para os cartões do topo e os números de cada canal.'],
    ['Vendas · Peças · Ticket','Do Histórico de Compras do canal no período. Ticket = valor ÷ peças (preço médio por peça).'],
    ['Eventos · Público · R$ por evento','Dos registros mês a mês do botão 📅 Eventos (shows, feiras e eventos). R$ por evento = vendas do período ÷ nº de eventos.'],
    ['📅 Eventos','Consulta mês a mês: nº de eventos, locais e público realizado (lançados e concluídos na Prestação de Contas do mês, nos canais com "Exige registro de eventos"), com pedidos, peças, vendas e ticket do Histórico. O resumo traz médias por evento e a conversão (peças ÷ público). É a base da projeção dos eventos no Calendário Comercial.'],
    ['▦ Cartões / ☰ Lista','Cartões agrupados por grupo (clique no título para recolher). A lista ordena por qualquer coluna (clique no cabeçalho).'],
    ['✏ Editar / Excluir','Edição no painel lateral. Excluir fica dentro da edição e só é possível para canal sem pedidos no Histórico de Compras.']
  ];
  openModal('<div class="modal-box pa-modal-wide" onclick="event.stopPropagation()"><div class="modal-title">ℹ️ Tutorial — Canais de Venda</div><table class="pa-tbl" style="margin-top:8px"><tbody>'+
    l.map(function(x){return '<tr><td style="font-weight:600;text-align:left;min-width:150px;vertical-align:top">'+canEsc(x[0])+'</td><td style="text-align:left;white-space:normal;font-family:var(--ff-b);font-size:12.5px;color:var(--muted2)">'+canEsc(x[1])+'</td></tr>';}).join('')+
    '</tbody></table><div class="modal-actions" style="display:flex;justify-content:flex-end;margin-top:14px"><button class="btn btn-primary" onclick="closeModal()">Fechar</button></div></div>');
}

// ════════════════════════════════════════════════════════════════════
// Financeiro › Collabs / Vendedores (31/10/2026) — mesmo padrão de Canais de Venda.
// Desempenho de cada collab = soma dos canais dele (tabela parceiros; canais.parceiro_id).
// ════════════════════════════════════════════════════════════════════
async function navigateCollabs(){
  var el=document.getElementById('main-content');
  var banner=(typeof isReadOnly==='function'&&isReadOnly())?'<div class="readonly-banner">👁 Modo somente leitura — você pode consultar, mas não alterar.</div>':'';
  el.innerHTML=banner+'<div class="ph"><h1>🤝 Collabs / Vendedores</h1><p>Financeiro · Artistas e parceiros e o desempenho dos canais de cada um</p></div><div id="col-root"><div class="card">Carregando…</div></div>';
  try{await canCarregar();colRender();}
  catch(e){var r0=document.getElementById('col-root');if(!r0)return;r0.innerHTML='<div class="card">Não foi possível carregar os collabs. Atualize a página e tente novamente.</div>';canErro(e,'Falha ao carregar Collabs / Vendedores');}
}
function colFiltroAtivo(){return !!(canEstado.segmento||canEstado.grupo||canEstado.canal);}
// Collabs com os canais (filtrados) de cada um e a soma dos números no período
function colDados(){
  var canais=canFiltrados(),porP={};
  canais.forEach(function(c){var k=c.parceiro_id?String(c.parceiro_id):'';if(!k)return;(porP[k]=porP[k]||[]).push(c);});
  return canCache.parceiros.filter(function(p){
    if(canEstado.collab&&String(p.id)!==String(canEstado.collab))return false;
    return porP[String(p.id)]||!colFiltroAtivo();
  }).map(function(p){
    var cs=(porP[String(p.id)]||[]).map(function(c){return {c:c,n:canNumeros(c),ev:canTemEventos(c)};}),t={eventos:0,publico:null,pedidos:0,pecas:0,valor:0,temEv:false};
    cs.forEach(function(x){t.eventos+=x.n.eventos;t.pedidos+=x.n.pedidos;t.pecas+=x.n.pecas;t.valor+=x.n.valor;if(x.ev)t.temEv=true;if(x.n.publico!==null)t.publico=(t.publico||0)+x.n.publico;});
    t.ticket=t.pecas?t.valor/t.pecas:null;
    cs.sort(function(a,b){return b.n.valor-a.n.valor;});
    return {p:p,cs:cs,t:t,totalCanais:canCache.canais.filter(function(c){return String(c.parceiro_id)===String(p.id);}).length};
  });
}
function colRender(){
  if(!document.getElementById('col-root')||!canCache)return;
  var ed=canPodeEditar(),P=canPeriodo(),D=colDados();
  var h='<div class="pa-filtros">'+canFiltrosHTML('colRender')+
    '<div class="pa-acoes" style="align-items:flex-end"><div class="can-seg" role="group" aria-label="Modo de exibição"><button class="'+(canEstado.colModo==='cards'?'on':'')+'" onclick="canEstado.colModo=\'cards\';colRender()">▦ Cartões</button><button class="'+(canEstado.colModo==='lista'?'on':'')+'" onclick="canEstado.colModo=\'lista\';colRender()">☰ Lista</button></div>'+
    (ed?'<button class="can-btn pri" onclick="colAbrir(null)">+ Novo collab</button>':'')+
    '<button class="can-btn" onclick="colTutorial()">ℹ️ Tutorial</button></div></div>';
  var T={canais:0,eventos:0,publico:0,temPub:false,valor:0,pecas:0};
  D.forEach(function(x){T.canais+=x.cs.length;T.eventos+=x.t.eventos;if(x.t.publico!==null){T.publico+=x.t.publico;T.temPub=true;}T.valor+=x.t.valor;T.pecas+=x.t.pecas;});
  h+='<div class="pa-kpis pa-kpis-mini">'+
    paKpi('Collabs / vendedores',String(D.length),'','var(--gold)')+
    paKpi('Canais',String(T.canais),'','var(--blue)')+
    paKpi('Eventos no período',canInt(T.eventos),'','var(--purple)')+
    paKpi('Público no período',T.temPub?canInt(T.publico):'—','','var(--teal)')+
    paKpi('Vendas no período',canBRL(T.valor),canInt(T.pecas)+' peças','var(--green)')+'</div>';
  var semP=canFiltrados().filter(function(c){return !c.parceiro_id;});
  h+='<div class="pa-info" style="margin:-2px 0 6px;font-size:12px;color:var(--muted2)">Período: <b>'+canEsc(P.rot)+'</b> · soma dos canais de cada collab · vendas do Histórico de Compras'+(semP.length?' · <span title="'+canEsc(semP.map(function(c){return c.nome;}).join(', '))+'" style="cursor:help;text-decoration:underline dotted">'+semP.length+' canal(is) sem collab não entram</span>':'')+'</div>';
  if(!D.length)h+='<div class="card">Nenhum collab com estes filtros.</div>';
  else if(canEstado.colModo==='lista')h+=colLista(D);
  else{D.sort(function(a,b){return b.t.valor-a.t.valor||String(a.p.nome).localeCompare(b.p.nome);});h+='<div class="can-grid" style="margin-top:12px">'+D.map(colCard).join('')+'</div>';}
  var root=document.getElementById('col-root');if(root)root.innerHTML=h;
}
function colCard(x){
  var t=x.t,chips=x.cs.slice(0,4).map(function(y){return '<span class="can-chip" title="'+canEsc(y.c.nome)+'">'+canEsc(colNomeCurto(y.c.nome,x.p.nome))+' · '+canBRL(y.n.valor)+'</span>';}).join('')+(x.cs.length>4?'<span class="can-chip">+'+(x.cs.length-4)+'</span>':'');
  return '<div class="can-card"><div><div class="nm">'+canEsc(x.p.nome)+'</div><div class="sub">'+x.cs.length+(colFiltroAtivo()&&x.cs.length!==x.totalCanais?' de '+x.totalCanais:'')+' cana'+((colFiltroAtivo()&&x.cs.length!==x.totalCanais?x.totalCanais:x.cs.length)===1?'l':'is')+'</div></div>'+
    (chips?'<div class="can-chips">'+chips+'</div>':'<div class="can-chips"><span class="can-chip warn">sem canal ligado</span></div>')+
    '<div class="can-st"><div><b>'+canBRL(t.valor)+'</b><span>vendas</span></div><div><b>'+canInt(t.pecas)+'</b><span>peças</span></div><div><b>'+(t.ticket===null?'—':canBRL2(t.ticket))+'</b><span>ticket</span></div>'+
      (t.temEv?'<div><b>'+canInt(t.eventos)+'</b><span>eventos</span></div><div><b>'+(t.publico===null?'—':canInt(t.publico))+'</b><span>público</span></div><div><b>'+(t.eventos?canBRL(colValorEventos(x)/t.eventos):'—')+'</b><span>R$ / evento</span></div>':'')+'</div>'+
    '<div class="can-act"><button class="can-btn" onclick="colAbrir(\''+x.p.id+'\')">✏ Editar</button></div></div>';
}
// R$ por evento só com as vendas dos canais de shows/feiras (não mistura e-commerce)
function colValorEventos(x){return x.cs.filter(function(y){return y.ev;}).reduce(function(s,y){return s+y.n.valor;},0);}
function colNomeCurto(nomeCanal,nomeCollab){var n=String(nomeCanal||''),k=String(nomeCollab||'').trim();if(k){var re=new RegExp('\\s*[-–]?\\s*'+k.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\s*$','i');var r=n.replace(re,'').trim();if(r&&r.length<n.length)return r;}return n.length>26?n.slice(0,25)+'…':n;}
function colLista(D){
  var cols=[['nome','Collab / vendedor','l'],['canais','Canais','r'],['eventos','Eventos','r'],['publico','Público','r'],['pedidos','Pedidos','r'],['pecas','Peças','r'],['valor','Vendas','r'],['ticket','Ticket','r'],['porEv','R$ / evento','r']];
  var val=function(x,k){var t=x.t;switch(k){case 'nome':return canNorm(x.p.nome);case 'canais':return x.cs.length;case 'publico':return t.publico===null?-1:t.publico;case 'ticket':return t.ticket===null?-1:t.ticket;case 'porEv':return t.eventos?colValorEventos(x)/t.eventos:-1;default:return t[k]||0;}};
  var o=canEstado.colOrdem,d=canEstado.colDesc?-1:1;
  D=D.slice().sort(function(a,b){var p=val(a,o),q=val(b,o);return (p<q?-1:p>q?1:0)*d;});
  return '<div class="pa-tbl-wrap" style="margin-top:12px"><table class="pa-tbl pa-compacta can-tbl"><thead><tr>'+cols.map(function(c){return '<th class="ord" style="text-align:'+(c[2]==='l'?'left':'right')+'" onclick="colOrdenar(\''+c[0]+'\')">'+c[1]+(o===c[0]?(canEstado.colDesc?' ▾':' ▴'):'')+'</th>';}).join('')+'<th style="text-align:left">Canais (vendas no período)</th><th></th></tr></thead><tbody>'+
    D.map(function(x){var t=x.t;
      return '<tr><td style="text-align:left;font-weight:600">'+canEsc(x.p.nome)+'</td><td>'+x.cs.length+'</td><td>'+(t.temEv?canInt(t.eventos):'—')+'</td><td>'+(t.publico===null?'—':canInt(t.publico))+'</td><td>'+canInt(t.pedidos)+'</td><td>'+canInt(t.pecas)+'</td><td><b>'+canBRL2(t.valor)+'</b></td><td>'+(t.ticket===null?'—':canBRL2(t.ticket))+'</td><td>'+(t.eventos?canBRL2(colValorEventos(x)/t.eventos):'—')+'</td>'+
        '<td style="text-align:left;white-space:normal;font-size:11px;color:var(--muted2);min-width:260px">'+x.cs.map(function(y){return canEsc(colNomeCurto(y.c.nome,x.p.nome))+' '+canBRL(y.n.valor);}).join(' · ')+'</td>'+
        '<td style="text-align:right"><button class="can-btn" title="Editar" onclick="colAbrir(\''+x.p.id+'\')">✏</button></td></tr>';}).join('')+
    '</tbody></table></div>';
}
function colOrdenar(k){if(canEstado.colOrdem===k)canEstado.colDesc=!canEstado.colDesc;else{canEstado.colOrdem=k;canEstado.colDesc=k!=='nome';}colRender();}

// Cadastro do collab (nome e observações) + canais ligados
function colAbrir(id){
  var ed=canPodeEditar(),p=id?canCache.parceiros.find(function(x){return String(x.id)===String(id);}):{};if(!p)return;
  var dis=ed?'':' disabled',P=canPeriodo();
  var cs=id?canCache.canais.filter(function(c){return String(c.parceiro_id)===String(id);}).map(function(c){return {c:c,n:canNumeros(c),g:canGrupo(c)};}).sort(function(a,b){return b.n.valor-a.n.valor;}):[];
  canPainel('<div class="can-dr-h"><div style="flex:1"><h3>'+(id?'✏ '+canEsc(p.nome):'+ Novo collab / vendedor')+'</h3><div class="sub">'+(id?cs.length+' canal(is) ligado(s)':'Cadastro do collab')+'</div></div><button class="can-btn" onclick="canFecharPainel()" aria-label="Fechar">✕</button></div>'+
    '<div class="can-dr-b"><fieldset class="can-fs"><legend>Identificação</legend><div class="can-fg">'+
      '<label class="w">Nome *<input id="col-e-nome" value="'+canEsc(p.nome||'')+'"'+dis+' placeholder="Ex.: Duda Beat"></label>'+
      '<label class="w">Observações<textarea id="col-e-obs" rows="3"'+dis+'>'+canEsc(p.obs||'')+'</textarea></label></div></fieldset>'+
    (id?'<fieldset class="can-fs"><legend>Canais ligados — '+canEsc(P.rot)+'</legend>'+
      (cs.length?'<div class="pa-tbl-wrap"><table class="pa-tbl pa-compacta can-tbl"><thead><tr><th style="text-align:left">Canal</th><th style="text-align:left">Grupo</th><th>Vendas</th><th>Peças</th><th>Ticket</th><th>Eventos</th><th></th></tr></thead><tbody>'+
        cs.map(function(y){return '<tr><td style="text-align:left;font-weight:600;white-space:normal;min-width:150px">'+canEsc(y.c.nome)+'</td><td style="text-align:left;white-space:normal;font-size:11px;color:var(--muted2)">'+(y.g?canEsc(y.g.nome):'—')+'</td><td>'+canBRL2(y.n.valor)+'</td><td>'+canInt(y.n.pecas)+'</td><td>'+(y.n.ticket===null?'—':canBRL2(y.n.ticket))+'</td><td>'+(canTemEventos(y.c)?canInt(y.n.eventos):'—')+'</td><td><button class="can-btn" onclick="colIrCanal('+y.c.id+')" title="Abrir em Canais de Venda">Abrir ↗</button></td></tr>';}).join('')+
        '</tbody></table></div>':'<p class="pa-mut" style="font-size:12px">Nenhum canal ligado. Ligue em Canais de Venda › ✏ Editar › Collab / vendedor.</p>')+'</fieldset>':'')+
    '</div><div class="can-dr-f">'+(id&&ed?'<button class="can-btn dan" style="margin-right:auto" onclick="colExcluir(\''+id+'\')">🗑 Excluir collab</button>':'')+
      '<button class="can-btn" onclick="canFecharPainel()">'+(ed?'Cancelar':'Fechar')+'</button>'+(ed?'<button class="can-btn pri" id="col-e-ok" onclick="colSalvar('+(id?'\''+id+'\'':'null')+')">Salvar</button>':'')+'</div>');
  var n=document.getElementById('col-e-nome');if(n&&ed)n.focus();
}
async function colIrCanal(id){
  canFecharPainel();
  if(typeof navigateCRM==='function'){await navigateCRM('canais');var t=0;while(!document.querySelector('.can-card, .can-tbl')&&t<40){await new Promise(function(r){setTimeout(r,150);});t++;}}
  canAbrirCanal(id);
}
async function colSalvar(id){
  if(!canPodeEditar())return;
  var nome=document.getElementById('col-e-nome').value.trim(),obs=document.getElementById('col-e-obs').value.trim()||null;
  if(!nome){showToast('Informe o nome.','error');return;}
  if(canCache.parceiros.some(function(p){return canNorm(p.nome)===canNorm(nome)&&String(p.id)!==String(id);})){showToast('Já existe um collab com este nome.','error');return;}
  var btn=document.getElementById('col-e-ok');btn.disabled=true;btn.textContent='Salvando…';
  try{
    if(id)await sb.patch('parceiros',id,{nome:nome,obs:obs});
    else await sb.post('parceiros',{id:typeof cdaUid==='function'?cdaUid():Date.now(),nome:nome,obs:obs});
    canFecharPainel();showToast('Collab salvo','success');
    canCache.parceiros=await sb.get('parceiros','select=id,nome,obs&order=nome');colRender();
  }catch(e){btn.disabled=false;btn.textContent='Salvar';canErro(e,'Não foi possível salvar o collab');}
}
async function colExcluir(id){
  var p=canCache.parceiros.find(function(x){return String(x.id)===String(id);});if(!p)return;
  var n=canCache.canais.filter(function(c){return String(c.parceiro_id)===String(id);}).length;
  if(n){alert('Não é possível excluir: "'+p.nome+'" tem '+n+' canal(is) de venda ligado(s).');return;}
  if(!confirm('Excluir o collab / vendedor "'+p.nome+'"?\nEsta ação não pode ser desfeita.'))return;
  try{await sb.del('parceiros',id);canFecharPainel();showToast('Collab excluído','success');canCache.parceiros=canCache.parceiros.filter(function(x){return String(x.id)!==String(id);});colRender();}
  catch(e){alert('Não foi possível excluir. Pode haver registros ligados a este collab.');console.error(e);}
}
function colTutorial(){
  var l=[
    ['Para que serve','Cadastro dos artistas e parceiros (collabs / vendedores) e o desempenho de cada um somando todos os canais ligados a ele (shows, e-commerce, venda subsidiada…). Os canais se ligam ao collab em Canais de Venda › ✏ Editar › Collab / vendedor.'],
    ['Filtros','Os mesmos de Canais de Venda (Segmento · Grupo · Collab · Canal · Período) e compartilhados com aquela tela. Com Segmento, Grupo ou Canal escolhido, cada collab soma só os canais que atendem ao filtro (o cartão mostra "x de y canais").'],
    ['Vendas · Peças · Ticket','Do Histórico de Compras dos canais do collab no período. Ticket = valor ÷ peças.'],
    ['Eventos · Público · R$ por evento','Dos registros mês a mês (📅 Eventos) dos canais de shows e feiras do collab. R$ por evento usa só as vendas desses canais, sem misturar o e-commerce.'],
    ['Etiquetas de canais','Os canais do collab com as vendas de cada um no período (até 4 no cartão; todos na lista e na edição).'],
    ['✏ Editar','Nome, observações e a tabela dos canais ligados, com atalho "Abrir ↗" para o canal em Canais de Venda. Excluir só é possível sem canal ligado.']
  ];
  openModal('<div class="modal-box pa-modal-wide" onclick="event.stopPropagation()"><div class="modal-title">ℹ️ Tutorial — Collabs / Vendedores</div><table class="pa-tbl" style="margin-top:8px"><tbody>'+
    l.map(function(x){return '<tr><td style="font-weight:600;text-align:left;min-width:150px;vertical-align:top">'+canEsc(x[0])+'</td><td style="text-align:left;white-space:normal;font-family:var(--ff-b);font-size:12.5px;color:var(--muted2)">'+canEsc(x[1])+'</td></tr>';}).join('')+
    '</tbody></table><div class="modal-actions" style="display:flex;justify-content:flex-end;margin-top:14px"><button class="btn btn-primary" onclick="closeModal()">Fechar</button></div></div>');
}

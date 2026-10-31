// ════════════════════════════════════════════════════════════════════
// Planejamento Anual › 🧪 Simulações — 31/10/2026
// Simulação de Compras por Campanha: receita da campanha (projeção do Calendário Comercial ou meta
// digitada por grupo / por segmento) → compras de Produção Varejo e Atacado pela meta de custo
// (custo ideal do Mix de Vendas, em ⚙ Referências) e pela proporção real do ano, menos as
// provisões já comprometidas, comparadas com o saldo do orçamento. Cenários salvos por campanha.
// Segmento Varejo/Atacado vem do grupo (cda_grupo.segmento). Depende de cda-modulo-planejamento.js.
// ════════════════════════════════════════════════════════════════════
PA_PAGES.simcampanha = {icon:'🛍', label:'Simulação de Compras por Campanha', grupo:'sim'};
PA_GRUPOS.sim = {icon:'🧪', label:'Simulações'};
paEstado.grupoAberto.sim = false;
// a página Tutorial continua por último no menu
(function(){var t=PA_PAGES.tutorial;delete PA_PAGES.tutorial;PA_PAGES.tutorial=t;})();

var paSim = {campanhaId:'', cenarioId:'', metas:null, alterado:false, abertos:{}, dados:null};
var PA_SIM_SEG = {varejo:'Varejo', atacado:'Atacado'};

(function paSimEstilos(){
  if(document.getElementById('pa-sim-estilos'))return;
  var st=document.createElement('style');st.id='pa-sim-estilos';
  st.textContent='.pa-sim-in{width:105px;text-align:right}.pa-sim-tbl td,.pa-sim-tbl th{white-space:nowrap;padding-left:7px!important;padding-right:7px!important}.pa-sim-tbl th:first-child,.pa-sim-tbl td:first-child{min-width:0!important}'+
    '.pa-sim-ok{color:var(--green);font-weight:700}.pa-sim-neg{color:var(--red);font-weight:700}.pa-sim-alt{color:var(--gold2);font-weight:700}'+
    '.pa-sim-seg{display:inline-block;padding:1px 7px;border-radius:9px;font:700 10px var(--ff-m);letter-spacing:.06em}.pa-sim-seg.vj{background:rgba(80,160,255,.14);color:var(--blue)}.pa-sim-seg.at{background:rgba(200,160,60,.16);color:var(--gold2)}';
  document.head.appendChild(st);
})();

function paSimSegHTML(s){return '<span class="pa-sim-seg '+(s==='atacado'?'at':'vj')+'">'+(s==='atacado'?'AT':'VJ')+'</span>';}
function paSimPct(v){return v===null||v===undefined||!isFinite(v)?'—':v.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})+'%';}
function paSimDataBR(d){if(!d)return '';var p=String(d).slice(0,10).split('-');return p[2]+'/'+p[1]+'/'+p[0];}

// ─── Carga ───────────────────────────────────────────────────────────
async function paSimCarregar(){
  var r=await Promise.all([
    sb.get('cda_cal_campanha','order=inicio.desc,id.desc'),
    sb.get('cda_grupo','tipo=eq.Receita&order=ordem,nome'),
    paCarregarHierarquia(true)
  ]);
  var camps=r[0]||[],grupos=r[1]||[],h=r[2];
  if(!paSim.campanhaId||!camps.some(function(c){return String(c.id)===String(paSim.campanhaId);})){
    var ativa=camps.find(function(c){return c.status==='Planejada'||c.status==='Em andamento';})||camps[0];
    paSim.campanhaId=ativa?String(ativa.id):'';paSim.cenarioId='';paSim.metas=null;
  }
  var camp=camps.find(function(c){return String(c.id)===String(paSim.campanhaId);})||null;
  if(!camp)return {camps:camps,camp:null};
  var ano=+String(camp.inicio).slice(0,4);
  var r2=await Promise.all([
    sb.get('cda_cal_evento','campanha_id=eq.'+camp.id+'&order=inicio.asc.nullslast,id.asc'),
    sb.get('cda_pa_sim_cenario','campanha_id=eq.'+camp.id+'&order=nome'),
    paDadosAno(ano),
    paMetasEstrutura(ano)
  ]);
  var d=r2[2],metas=paMercadoSomado(d,r2[3].m),M=paCalcMix(d,metas);
  return {camps:camps,camp:camp,ano:ano,grupos:grupos,h:h,eventos:r2[0]||[],cenarios:r2[1]||[],d:d,M:M};
}

// ─── Cálculo ─────────────────────────────────────────────────────────
// Base fixa da campanha: grupos/canais com a projeção do Calendário, % de custo e posição de Produção.
function paSimBase(D){
  var grupoDe={},centroDe={};
  D.grupos.forEach(function(g){grupoDe[String(g.id)]=g;});
  D.h.centros.forEach(function(cc){centroDe[String(cc.id)]=cc;});
  var G={},ordem=[],semCanal=[];
  D.eventos.forEach(function(e){
    var cc=e.centro_custo_id?centroDe[String(e.centro_custo_id)]:null;
    var gid=e.grupo_id||(cc&&cc.grupo_id);
    if(!gid){semCanal.push(e);return;}
    var g=grupoDe[String(gid)]||{id:gid,nome:'Grupo #'+gid};
    var k=String(gid);
    if(!G[k]){G[k]={id:k,nome:g.nome,seg:g.segmento||'varejo',semSeg:!g.segmento,proj:0,eventos:0,canais:{},ordemC:[]};ordem.push(k);}
    var gg=G[k],ck=cc?'c:'+cc.id:'g:'+k,cn=cc?cc.nome:'▦ '+g.nome+' (todos os canais)';
    if(!gg.canais[ck]){gg.canais[ck]={id:ck,nome:cn,proj:0,eventos:0,lista:[]};gg.ordemC.push(ck);}
    var v=Number(e.projecao)||0;gg.proj+=v;gg.eventos++;gg.canais[ck].proj+=v;gg.canais[ck].eventos++;gg.canais[ck].lista.push(e.evento);
  });
  ordem.sort(function(a,b){return (G[a].seg===G[b].seg?0:(G[a].seg==='varejo'?-1:1))||G[b].proj-G[a].proj;});
  // % de custo: meta (custo ideal do Mix) e proporção real do ano (produção ÷ receita do segmento, meses de receita fechada)
  var M=D.M,d=D.d,ult=M.ultRec||0,rec={varejo:0,atacado:0},prod={varejo:{prev:0,real:0,realPer:0,prov:0},atacado:{prev:0,real:0,realPer:0,prov:0}},mont={prev:0,real:0,prov:0,tem:false};
  D.h.centros.forEach(function(cc){
    if(!cc.conta||!cc.subconta)return;
    if(cc.conta.tipo==='RECEITAS'){var g=grupoDe[String(cc.grupo_id)],s=(g&&g.segmento)||'varejo';rec[s]+=paRealAte(d,cc.id,ult);return;}
    var nm=cc.subconta.nome||'',s2=/^Produção Varejo/i.test(nm)?'varejo':(/^Produção Atacado/i.test(nm)?'atacado':null);
    if(s2){var p=prod[s2];p.prev+=d.prev[cc.id]||0;p.real+=paRealAte(d,cc.id,12);p.realPer+=paRealAte(d,cc.id,ult);p.prov+=d.prov[cc.id]||0;return;}
    if(/^Montagem Cole/i.test(nm)){mont.tem=true;mont.prev+=d.prev[cc.id]||0;mont.real+=paRealAte(d,cc.id,12);mont.prov+=d.prov[cc.id]||0;}
  });
  var pct={meta:{varejo:M.cd,atacado:M.ca},real:{varejo:rec.varejo?prod.varejo.realPer/rec.varejo*100:null,atacado:rec.atacado?prod.atacado.realPer/rec.atacado*100:null}};
  ['varejo','atacado'].forEach(function(s){var p=prod[s];p.saldo=p.prev-p.real-p.prov;});
  mont.saldo=mont.prev-mont.real-mont.prov;
  return {G:G,ordem:ordem,semCanal:semCanal,pct:pct,rec:rec,prod:prod,mont:mont,ult:ult,ultDesp:d.ultimo||0};
}
function paSimMetasPadrao(B){var m={};B.ordem.forEach(function(k){m[k]=Math.round(B.G[k].proj*100)/100;});return m;}
function paSimMetasDe(B,cen){
  var m=paSimMetasPadrao(B),g=(cen&&cen.metas&&cen.metas.grupos)||{};
  Object.keys(g).forEach(function(k){if(k in m&&g[k]!==null&&g[k]!==undefined&&!isNaN(g[k]))m[k]=Number(g[k]);});
  return m;
}
// Resultado de um conjunto de metas: por segmento, grupo e canal
function paSimCalc(B,metas){
  var S={varejo:{proj:0,meta:0},atacado:{proj:0,meta:0}},linhas=[];
  B.ordem.forEach(function(k){
    var g=B.G[k],mt=Number(metas[k])||0,s=g.seg;S[s].proj+=g.proj;S[s].meta+=mt;
    var canais=g.ordemC.map(function(ck){var c=g.canais[ck],part=g.proj?c.proj/g.proj:1/g.ordemC.length,m=mt*part;
      return {id:ck,nome:c.nome,eventos:c.eventos,lista:c.lista,proj:c.proj,meta:m,cMeta:m*B.pct.meta[s]/100,cReal:B.pct.real[s]===null?null:m*B.pct.real[s]/100};});
    linhas.push({id:k,nome:g.nome,seg:s,semSeg:g.semSeg,eventos:g.eventos,proj:g.proj,meta:mt,cMeta:mt*B.pct.meta[s]/100,cReal:B.pct.real[s]===null?null:mt*B.pct.real[s]/100,canais:canais});
  });
  ['varejo','atacado'].forEach(function(s){var x=S[s],p=B.prod[s];
    x.cMeta=x.meta*B.pct.meta[s]/100;x.cReal=B.pct.real[s]===null?null:x.meta*B.pct.real[s]/100;
    x.prov=p.prov;x.saldo=p.saldo;x.pendMeta=x.cMeta-p.prov;x.pendReal=x.cReal===null?null:x.cReal-p.prov;});
  return {S:S,linhas:linhas};
}

// ─── Tela ────────────────────────────────────────────────────────────
async function paSimCampanha(){
  var D=await paSimCarregar();paSim.dados=D;
  var root=document.getElementById('pa-root');
  if(!D.camp){root.innerHTML='<div class="card">Nenhuma campanha cadastrada. Crie a campanha em <b>Calendário › 🏷 Campanhas</b> e ligue os eventos a ela.</div>';return;}
  var B=paSimBase(D);D.B=B;
  var cen=paSim.cenarioId?D.cenarios.find(function(c){return String(c.id)===String(paSim.cenarioId);}):null;
  if(paSim.cenarioId&&!cen){paSim.cenarioId='';paSim.metas=null;}
  if(!paSim.metas)paSim.metas=paSimMetasDe(B,cen),paSim.alterado=false;
  paSimRender();
}
function paSimRender(){
  var D=paSim.dados,B=D.B,R=paSimCalc(B,paSim.metas),ed=paPodeEditar(),S=R.S;
  var cen=paSim.cenarioId?D.cenarios.find(function(c){return String(c.id)===String(paSim.cenarioId);}):null;
  var perRec=B.ult?'jan–'+PA_MESES_AB[B.ult-1].toLowerCase():'—',perDesp=B.ultDesp?'jan–'+PA_MESES_AB[B.ultDesp-1].toLowerCase():'—';
  var sel='<label>Campanha<select id="pa-sim-camp" onchange="paSimTrocarCampanha(this.value)">'+D.camps.map(function(c){return '<option value="'+c.id+'"'+(String(c.id)===String(paSim.campanhaId)?' selected':'')+'>🏷 '+paEsc(c.nome)+'</option>';}).join('')+'</select></label>'+
    '<label>Cenário<select id="pa-sim-cen" onchange="paSimTrocarCenario(this.value)"><option value="">Calendário (projeção)</option>'+D.cenarios.map(function(c){return '<option value="'+c.id+'"'+(String(c.id)===String(paSim.cenarioId)?' selected':'')+'>💾 '+paEsc(c.nome)+'</option>';}).join('')+'</select></label>';
  var acoes=(ed?'<button class="btn btn-primary btn-sm" onclick="paSimSalvarCenario()">💾 Salvar cenário</button>'+(cen?'<button class="btn btn-ghost btn-sm" onclick="paSimExcluirCenario()">🗑 Excluir cenário</button>':''):'')+
    '<button class="btn btn-ghost btn-sm" onclick="paSimRestaurar()" title="Volta as metas para a projeção do Calendário">↺ Projeção do Calendário</button>'+
    '<button class="btn btn-ghost btn-sm" onclick="paTutorialInformativo(\'simcampanha\')">ℹ️ Tutorial Informativo</button>';
  var h='<div class="pa-filtros">'+sel+'<div class="pa-acoes">'+acoes+'</div></div>';
  h+='<div class="pa-barra-res"><span>🏷 <b>'+paEsc(D.camp.nome)+'</b> · '+paSimDataBR(D.camp.inicio)+' a '+paSimDataBR(D.camp.fim)+' · Orçamento '+D.ano+
    ' · Custo meta: Varejo <b>'+paSimPct(B.pct.meta.varejo)+'</b> · Atacado <b>'+paSimPct(B.pct.meta.atacado)+'</b>'+
    ' · Proporção real '+perRec+': Varejo <b>'+paSimPct(B.pct.real.varejo)+'</b> · Atacado <b>'+paSimPct(B.pct.real.atacado)+'</b>'+
    ' · Produção lançada '+perDesp+'</span></div>';
  if(paSim.alterado)h+='<p class="pa-info" style="margin:4px 0 8px;color:var(--gold2)"><b>✎ Metas alteradas e ainda não salvas'+(cen?' no cenário "'+paEsc(cen.nome)+'"':'')+'.</b></p>';
  // Bloco 1 — Varejo / Atacado
  function sit(pend,saldo){
    if(pend===null)return '<td class="pa-mut">—</td>';
    if(pend<=0.005)return '<td class="pa-sim-ok" title="A provisão já cobre a compra necessária">provisão cobre<br><span class="pa-orig">sobra '+paValor(-pend)+' de provisão</span></td>';
    var f=saldo-pend;
    return f>=-0.005?'<td class="pa-sim-ok">cabe<br><span class="pa-orig">sobram '+paValor(f)+'</span></td>':'<td class="pa-sim-neg">excede<br><span class="pa-orig">faltam '+paValor(-f)+'</span></td>';
  }
  function pend(v){return v===null?'<td class="pa-mut">—</td>':'<td style="font-weight:700">'+(v<0?'0,00':paValor(v))+'</td>';}
  function lin1(s){var x=S[s];
    var inp=ed?'<input class="pa-in pa-sim-in" inputmode="decimal" aria-label="Meta de receita '+PA_SIM_SEG[s]+'" value="'+paValor(x.meta)+'" onkeydown="if(event.key===\'Enter\')this.blur()" onchange="paSimSetSegmento(\''+s+'\',this.value)">':'<b>'+paValor(x.meta)+'</b>';
    return '<tr class="sub"><td>'+paSimSegHTML(s)+' '+PA_SIM_SEG[s]+'</td><td>'+paValor(x.proj)+'</td><td>'+inp+'</td>'+
      '<td>'+paValor(x.cMeta)+'</td><td>'+(x.cReal===null?'—':paValor(x.cReal))+'</td><td>'+paValor(x.prov)+'</td>'+pend(x.pendMeta)+pend(x.pendReal)+
      '<td style="'+(x.saldo<0?'color:var(--red)':'')+'">'+paValor(x.saldo)+'</td>'+sit(x.pendMeta,x.saldo)+sit(x.pendReal,x.saldo)+'</tr>';}
  var T={proj:S.varejo.proj+S.atacado.proj,meta:S.varejo.meta+S.atacado.meta,cMeta:S.varejo.cMeta+S.atacado.cMeta,cReal:(S.varejo.cReal||0)+(S.atacado.cReal||0),prov:S.varejo.prov+S.atacado.prov,saldo:S.varejo.saldo+S.atacado.saldo,
    pendMeta:Math.max(S.varejo.pendMeta,0)+Math.max(S.atacado.pendMeta,0),pendReal:Math.max(S.varejo.pendReal||0,0)+Math.max(S.atacado.pendReal||0,0)};
  h+='<h3 class="pa-h3">1. Varejo e Atacado — compras de Produção</h3>';
  h+='<div class="pa-tbl-wrap"><table class="pa-tbl pa-compacta pa-sim-tbl pa-sim-b1"><thead><tr><th>Segmento</th><th title="Soma da projeção dos eventos da campanha (Calendário)">Receita<br>Calendário</th><th title="Digite o total para distribuir pelos grupos na proporção da projeção, ou digite por grupo no bloco 2">Meta de<br>receita</th>'+
    '<th title="Meta de receita × custo ideal (⚙ Referências do Mix de Vendas: venda direta para Varejo, atacado para Atacado)">Compra pela<br>meta de custo</th><th title="Meta de receita × proporção real de custo do ano">Compra pela<br>proporção real</th>'+
    '<th title="Provisão Prevista de Produção do segmento: compras já comprometidas">Provisão</th><th title="Compra pela meta − Provisão">Pendente<br>(meta)</th><th title="Compra pela proporção real − Provisão">Pendente<br>(real)</th>'+
    '<th title="Orçado do ano − Realizado − Provisões (Produção do segmento)">Saldo do<br>orçamento</th><th>Situação<br>(meta)</th><th>Situação<br>(real)</th></tr></thead><tbody>'+
    lin1('varejo')+lin1('atacado')+
    '<tr class="conta rec"><td>TOTAL</td><td>'+paValor(T.proj)+'</td><td>'+paValor(T.meta)+'</td><td>'+paValor(T.cMeta)+'</td><td>'+paValor(T.cReal)+'</td><td>'+paValor(T.prov)+'</td><td>'+paValor(T.pendMeta)+'</td><td>'+paValor(T.pendReal)+'</td><td>'+paValor(T.saldo)+'</td><td></td><td></td></tr>'+
    '</tbody></table></div>';
  var notas=[];
  if(B.mont.tem)notas.push('Montagem Coleções (informativo, fora da conta acima): provisão <b>'+paBRL(B.mont.prov)+'</b> · saldo do orçamento <b>'+paBRL(B.mont.saldo)+'</b>.');
  if(B.semCanal.length)notas.push(B.semCanal.length+' evento(s) da campanha sem canal / grupo não entram: '+B.semCanal.map(function(e){return paEsc(e.evento);}).join(', ')+'.');
  var semSeg=B.ordem.filter(function(k){return B.G[k].semSeg;});
  if(semSeg.length)notas.push('<span style="color:var(--gold2)">Grupo(s) sem Segmento, tratados como Varejo: '+semSeg.map(function(k){return paEsc(B.G[k].nome);}).join(', ')+' (defina em Tabela de Grupos).</span>');
  if(notas.length)h+='<p class="pa-info" style="margin-top:8px">'+notas.join('<br>')+'</p>';
  // Bloco 2 — por grupo e canal
  h+='<h3 class="pa-h3">2. Por grupo e canal</h3>';
  h+='<div class="pa-tbl-wrap"><table class="pa-tbl pa-compacta pa-sim-tbl"><thead><tr><th>Grupo / canal</th><th>Seg.</th><th>Eventos</th><th>Receita<br>Calendário</th><th title="Digite a meta do grupo; os canais recebem a meta na proporção da projeção">Meta de<br>receita</th><th title="Meta − Calendário">Diferença</th><th>Compra pela<br>meta de custo</th><th>Compra pela<br>proporção real</th></tr></thead><tbody>';
  R.linhas.forEach(function(l){
    var ab=!!paSim.abertos[l.id],dif=l.meta-l.proj;
    var inp=ed?'<input class="pa-in pa-sim-in" inputmode="decimal" aria-label="Meta de receita '+paEsc(l.nome)+'" value="'+paValor(l.meta)+'" onclick="event.stopPropagation()" onkeydown="if(event.key===\'Enter\')this.blur()" onchange="paSimSetGrupo(\''+l.id+'\',this.value)">':'<b>'+paValor(l.meta)+'</b>';
    h+='<tr class="sub" style="cursor:pointer" onclick="paSimAlternar(\''+l.id+'\')"><td>'+(ab?'▾ ':'▸ ')+paEsc(l.nome)+'</td><td style="text-align:center">'+paSimSegHTML(l.seg)+'</td><td>'+l.eventos+'</td><td>'+paValor(l.proj)+'</td><td>'+inp+'</td>'+
      '<td class="'+(Math.abs(dif)<0.005?'pa-mut':'pa-sim-alt')+'">'+(Math.abs(dif)<0.005?'—':(dif>0?'+':'−')+paValor(Math.abs(dif)))+'</td><td>'+paValor(l.cMeta)+'</td><td>'+(l.cReal===null?'—':paValor(l.cReal))+'</td></tr>';
    if(ab)l.canais.forEach(function(c){
      h+='<tr class="cc"><td style="padding-left:28px" title="'+paEsc(c.lista.join(' · '))+'">'+paEsc(c.nome)+'</td><td></td><td>'+c.eventos+'</td><td>'+paValor(c.proj)+'</td><td>'+paValor(c.meta)+'</td><td></td><td>'+paValor(c.cMeta)+'</td><td>'+(c.cReal===null?'—':paValor(c.cReal))+'</td></tr>';
    });
  });
  h+='<tr class="conta rec"><td>TOTAL</td><td></td><td>'+R.linhas.reduce(function(a,l){return a+l.eventos;},0)+'</td><td>'+paValor(T.proj)+'</td><td>'+paValor(T.meta)+'</td><td>'+(Math.abs(T.meta-T.proj)<0.005?'—':(T.meta>T.proj?'+':'−')+paValor(Math.abs(T.meta-T.proj)))+'</td><td>'+paValor(T.cMeta)+'</td><td>'+paValor(T.cReal)+'</td></tr></tbody></table></div>';
  h+='<p class="pa-info" style="margin-top:8px">Clique no grupo para abrir os canais. A meta do canal é a do grupo distribuída pela projeção do Calendário. A proporção real de custo existe só por segmento (as compras não são separadas por grupo), então todos os grupos de varejo usam o mesmo % real.</p>';
  // Bloco 3 — comparação de cenários
  var cenarios=[{id:'',nome:'Calendário (projeção)',metas:paSimMetasPadrao(B)}].concat(D.cenarios.map(function(c){return {id:String(c.id),nome:c.nome,metas:paSimMetasDe(B,c),obs:c.observacoes,em:c.atualizado_em};}));
  h+='<h3 class="pa-h3">3. Comparação de cenários</h3>';
  h+='<div class="pa-tbl-wrap"><table class="pa-tbl pa-compacta pa-sim-tbl"><thead><tr><th>Cenário</th><th>Receita<br>Varejo</th><th>Receita<br>Atacado</th><th>Receita<br>total</th><th>Pendente VJ<br>(meta · real)</th><th>Pendente AT<br>(meta · real)</th><th>Situação<br>Varejo (real)</th><th>Situação<br>Atacado (real)</th></tr></thead><tbody>'+
    cenarios.map(function(c){var x=paSimCalc(B,c.metas).S,atual=String(c.id)===String(paSim.cenarioId);
      var st=function(s){var p=x[s].pendReal;if(p===null)return '—';if(p<=0.005)return '<span class="pa-sim-ok">provisão cobre</span>';var f=x[s].saldo-p;return f>=-0.005?'<span class="pa-sim-ok">cabe</span>':'<span class="pa-sim-neg">excede '+paValor(-f)+'</span>';};
      var pp=function(v){return v===null?'—':paValor(Math.max(v,0));};
      return '<tr class="cc" style="cursor:pointer'+(atual?';background:var(--card2)':'')+'" onclick="paSimTrocarCenario(\''+c.id+'\')" title="'+paEsc(c.obs||'Clique para abrir')+'"><td style="font-weight:'+(atual?700:400)+'">'+(c.id?'💾 ':'📅 ')+paEsc(c.nome)+(atual?' ◂':'')+'</td><td>'+paValor(x.varejo.meta)+'</td><td>'+paValor(x.atacado.meta)+'</td><td><b>'+paValor(x.varejo.meta+x.atacado.meta)+'</b></td>'+
        '<td>'+pp(x.varejo.pendMeta)+' · '+pp(x.varejo.pendReal)+'</td><td>'+pp(x.atacado.pendMeta)+' · '+pp(x.atacado.pendReal)+'</td><td>'+st('varejo')+'</td><td>'+st('atacado')+'</td></tr>';}).join('')+
    '</tbody></table></div>';
  document.getElementById('pa-root').innerHTML=h;
}

// ─── Ações ───────────────────────────────────────────────────────────
function paSimConfirmaDescartar(){return !paSim.alterado||confirm('As metas alteradas ainda não foram salvas. Descartar as alterações?');}
async function paSimTrocarCampanha(id){if(!paSimConfirmaDescartar()){paSimRender();return;}paSim.campanhaId=String(id);paSim.cenarioId='';paSim.metas=null;paSim.abertos={};await paSimCampanha();}
function paSimTrocarCenario(id){
  if(String(id)===String(paSim.cenarioId)&&!paSim.alterado)return;
  if(!paSimConfirmaDescartar()){paSimRender();return;}
  var D=paSim.dados,cen=id?D.cenarios.find(function(c){return String(c.id)===String(id);}):null;
  paSim.cenarioId=cen?String(cen.id):'';paSim.metas=paSimMetasDe(D.B,cen);paSim.alterado=false;paSimRender();
}
function paSimRestaurar(){paSim.metas=paSimMetasPadrao(paSim.dados.B);paSim.alterado=true;paSimRender();}
function paSimAlternar(id){paSim.abertos[id]=!paSim.abertos[id];paSimRender();}
function paSimLerValor(raw){var t=String(raw==null?'':raw).trim();if(t==='')return 0;var n=paParseDigitado(t);return n===null||!isFinite(n)||n<0?null:Math.round(n*100)/100;}
function paSimSetGrupo(id,raw){
  var v=paSimLerValor(raw);if(v===null){showToast('Informe um valor válido (ex.: 25.000,00).','error');paSimRender();return;}
  paSim.metas[id]=v;paSim.alterado=true;paSimRender();
}
// Total do segmento: distribui pelos grupos do segmento na proporção da projeção do Calendário
function paSimSetSegmento(seg,raw){
  var v=paSimLerValor(raw);if(v===null){showToast('Informe um valor válido (ex.: 200.000,00).','error');paSimRender();return;}
  var B=paSim.dados.B,ks=B.ordem.filter(function(k){return B.G[k].seg===seg;});
  if(!ks.length){showToast('A campanha não tem eventos de '+PA_SIM_SEG[seg]+'.','info');paSimRender();return;}
  var base=ks.reduce(function(a,k){return a+B.G[k].proj;},0),soma=0,maior=ks[0];
  ks.forEach(function(k){var x=base?Math.round(v*B.G[k].proj/base*100)/100:Math.round(v/ks.length*100)/100;paSim.metas[k]=x;soma+=x;if(B.G[k].proj>B.G[maior].proj)maior=k;});
  paSim.metas[maior]=Math.round((paSim.metas[maior]+v-soma)*100)/100;
  paSim.alterado=true;paSimRender();
}
async function paSimSalvarCenario(){
  if(!paPodeEditar())return;
  var D=paSim.dados,cen=paSim.cenarioId?D.cenarios.find(function(c){return String(c.id)===String(paSim.cenarioId);}):null;
  openModal('<div class="modal-box" onclick="event.stopPropagation()"><div class="modal-title">💾 Salvar cenário</div>'+
    '<p class="pa-info" style="margin:4px 0 10px">Guarda as metas de receita por grupo desta campanha. Compras, provisões e saldos são sempre recalculados com os dados do dia.</p>'+
    '<div class="pa-filtros" style="flex-direction:column;align-items:stretch"><label>Nome *<input id="pa-sim-nome" maxlength="80" value="'+paEsc(cen?cen.nome:'')+'" placeholder="Ex.: Meta Cardoso"></label>'+
    '<label>Observações<input id="pa-sim-obs" maxlength="300" value="'+paEsc(cen&&cen.observacoes||'')+'"></label></div>'+
    (cen?'<p class="pa-info" style="margin-top:6px">Com o mesmo nome, atualiza o cenário "'+paEsc(cen.nome)+'"; com outro nome, cria um cenário novo.</p>':'')+
    '<div class="modal-actions" style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px"><button class="btn btn-ghost" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" id="pa-sim-ok" onclick="paSimConfirmarSalvar()">Salvar</button></div></div>');
}
async function paSimConfirmarSalvar(){
  var D=paSim.dados,nome=document.getElementById('pa-sim-nome').value.trim(),obs=document.getElementById('pa-sim-obs').value.trim()||null;
  if(!nome){showToast('Informe o nome do cenário.','error');return;}
  if(paNorm(nome)===paNorm('Calendário (projeção)')){showToast('Escolha outro nome: este é o cenário base.','error');return;}
  var ex=D.cenarios.find(function(c){return paNorm(c.nome)===paNorm(nome);});
  if(ex&&String(ex.id)!==String(paSim.cenarioId)&&!confirm('Já existe o cenário "'+ex.nome+'". Substituir as metas dele?'))return;
  var b={metas:{grupos:paSim.metas},observacoes:obs,nome:nome};
  var btn=document.getElementById('pa-sim-ok');btn.disabled=true;
  try{
    var id;
    if(ex){await sb.patch('cda_pa_sim_cenario',ex.id,b);id=ex.id;}
    else{b.campanha_id=+paSim.campanhaId;b.criado_por=(window.cu&&cu.email)||null;var r=await sb.post('cda_pa_sim_cenario',b);id=r&&r[0]&&r[0].id;}
    closeModal();showToast('Cenário salvo','success');
    paSim.cenarioId=id?String(id):'';paSim.alterado=false;
    var metas=paSim.metas;await paSimCampanha();paSim.metas=metas;paSimRender();
  }catch(e){btn.disabled=false;showToast(paMsgErro(e,'Não foi possível salvar o cenário.'),'error');}
}
async function paSimExcluirCenario(){
  var D=paSim.dados,cen=D.cenarios.find(function(c){return String(c.id)===String(paSim.cenarioId);});if(!cen)return;
  if(!confirm('Excluir o cenário "'+cen.nome+'"?'))return;
  try{await sb.del('cda_pa_sim_cenario',cen.id);showToast('Cenário excluído','success');paSim.cenarioId='';paSim.metas=null;paSim.alterado=false;await paSimCampanha();}
  catch(e){showToast(paMsgErro(e,'Não foi possível excluir o cenário.'),'error');}
}

// ─── Tutorial ────────────────────────────────────────────────────────
PA_TUT.simcampanha={t:'Simulação de Compras por Campanha',d:'Quanto comprar de Produção Varejo e Atacado para atender a receita de uma campanha do Calendário Comercial (ex.: Black Friday / Natal 2026), descontando as provisões já comprometidas e comparando com o saldo do orçamento. Você pode usar a projeção do Calendário ou digitar metas de receita e salvar cenários.',c:[
  ['Campanha','Escolhida no topo. Os eventos e as projeções vêm do Calendário Comercial (🏷 Campanhas). O orçamento usado é o do ano em que a campanha começa.'],
  ['Segmento (VJ / AT)','Vem do grupo de cada canal (Planejamento › Tabela de Grupos › coluna Segmento). Regra: tudo é Varejo, menos Atacado / Private Label.'],
  ['Receita Calendário','Soma da projeção dos eventos da campanha. Eventos sem canal ou "a definir" sem projeção não entram (aparecem no aviso abaixo do bloco 1).'],
  ['Meta de receita','Começa igual à projeção do Calendário. Digite por grupo (bloco 2) ou o total de Varejo e de Atacado (bloco 1): o total é distribuído pelos grupos na proporção da projeção. A meta do canal é a do grupo distribuída do mesmo jeito.'],
  ['Compra pela meta de custo','Meta de receita × custo ideal do produto definido em Mix de Vendas › ⚙ Referências (venda direta para o Varejo; atacado/B2B para o Atacado). Os % em uso aparecem na barra do topo.','Meta × custo ideal (VJ: venda direta · AT: atacado)'],
  ['Compra pela proporção real','Meta de receita × quanto a Produção custou de fato sobre a receita do segmento no ano (meses de receita fechada). Só existe por segmento: todos os grupos de varejo usam o mesmo %.','Meta × (Produção realizada ÷ Receita realizada do segmento)'],
  ['Provisão','Provisão Prevista de Produção Varejo ou Atacado: compras já encomendadas e ainda não lançadas.'],
  ['Pendente','O que ainda falta comprar para a campanha. Zero quando a provisão já cobre.','Compra − Provisão'],
  ['Saldo do orçamento','Quanto ainda cabe no orçamento de Produção do segmento no ano.','Orçado do ano − Realizado − Provisão'],
  ['Situação','Cabe (sobram R$ x) quando o Pendente é menor que o Saldo; Excede (faltam R$ x) quando passa; Provisão cobre quando não há o que comprar.','Saldo − Pendente'],
  ['Montagem Coleções','Mostrada só como informação (provisão e saldo); não entra no cálculo de compras de Produção.'],
  ['Cenários','💾 Salvar cenário guarda as metas por grupo com um nome (ex.: Meta Cardoso, Otimista). O cenário base "Calendário (projeção)" é sempre a projeção atual. Compras, provisões e saldos são recalculados com os dados do dia ao abrir. O bloco 3 compara todos os cenários da campanha; clique numa linha para abri-la. ↺ volta as metas para a projeção.']]};

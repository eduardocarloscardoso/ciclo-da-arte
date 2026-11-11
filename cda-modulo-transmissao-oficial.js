// Operação universal de transmissões oficiais — fase B1: somente planejamento/leitura.
// Nenhum botão, função ou endpoint de envio/autorizar é invocado por este módulo.
async function montarTransmissaoOficial(containerId) {
  const root=document.getElementById(containerId);
  if(!root)return;
  const esc=x=>String(x??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  let campanhas=[],mensagens=[],destinatarios=[],supressoes=new Set(),campanha=null,mensagem=null;
  const html=String.raw;
  root.innerHTML='<style>'+
    '#'+containerId+' .to-card{border:1px solid #cbd5e1;border-radius:12px;padding:16px;background:var(--card-bg,#fff);margin-bottom:15px}'+
    '#'+containerId+' .to-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(175px,1fr));gap:12px}'+
    '#'+containerId+' .to-number{font-size:25px;font-weight:750;line-height:1.25}'+
    '#'+containerId+' select,#'+containerId+' input{padding:10px;border:1px solid #94a3b8;border-radius:7px;background:white;color:#111;max-width:100%}'+
    '#'+containerId+' .to-label{display:grid;gap:6px;font-weight:650}'+
    '#'+containerId+' .to-muted{color:var(--text-muted,#64748b);font-size:13px}'+
    '#'+containerId+' .to-table{width:100%;border-collapse:collapse}'+
    '#'+containerId+' .to-table th,#'+containerId+' .to-table td{text-align:left;border-bottom:1px solid #e2e8f0;padding:9px}'+
    '</style>'+
    '<div class="to-card"><h2 style="margin:0 0 8px">Transmissões oficiais · planejamento universal</h2>'+
      '<p class="to-muted">Aplicável a qualquer campanha com lista congelada. Nesta fase, somente conferência, dimensionamento e simulação matemática: <strong>envio oficial bloqueado</strong>.</p>'+
      '<div class="to-grid">'+
        '<label class="to-label">Campanha<select id="to-campanha"><option>Carregando...</option></select></label>'+
        '<label class="to-label">Mensagem<select id="to-mensagem"><option>Selecione a campanha</option></select></label>'+
        '<label class="to-label">Destinatários por lote<input id="to-tamanho" type="number" value="20" min="1" max="1000" step="1"></label>'+
      '</div></div>'+
    '<p id="to-aviso" role="status" aria-live="polite" class="to-muted">Carregando dados para conferência...</p>'+
    '<div id="to-painel" hidden>'+
      '<div class="to-grid" id="to-contadores"></div>'+
      '<section class="to-card"><h3 style="margin:0 0 10px">Conferências prévias</h3><div id="to-validacoes"></div></section>'+
      '<section class="to-card"><h3 style="margin:0 0 10px">Plano proposto de lotes — sem criação nem envio</h3>'+
        '<div id="to-lotes"></div></section>'+
      '<section class="to-card"><h3 style="margin:0 0 10px">Governança e liberação</h3>'+
        '<p>Para qualquer campanha futura, o fluxo oficial será: selecionar campanha e mensagem → congelar destinatários elegíveis → validar bases legais, preferências e supressões → preparar lotes → revisar e autorizar individualmente → transmitir sob limites → conciliar eventos → arquivar.</p>'+
        '<p class="to-muted">Somente a etapa de planejamento está ativa. A futura preparação persistente, a autorização oficial e o executor não estão disponíveis nesta versão. A homologação Resend é independente.</p>'+
        '<button type="button" class="btn" disabled title="A transmissão oficial continua bloqueada">Transmitir lote oficial — bloqueado</button>'+
      '</section></div>';
  const $=id=>root.querySelector('#'+id);
  const norm=x=>String(x||'').trim().toLowerCase();
  async function obterDados(q){
    const x=await q;if(x.error)throw x.error;return x.data||[];
  }
  async function carregarDestinatarios(id) {
    const total=[],size=500;
    for(let inicio=0;inicio<100000;inicio+=size){
      const r=await cdaClient.from('cda_campanha_destinatarios')
        .select('id,cliente_id,email,email_valido,congelado_em').eq('campanha_id',id)
        .order('id').range(inicio,inicio+size-1);
      if(r.error)throw r.error;
      total.push(...(r.data||[]));
      if((r.data||[]).length<size)break;
    }
    if(total.length>=100000)throw new Error('Seleção excede o limite de conferência. Nenhuma ação será preparada.');
    return total;
  }
  function apresentar(){
    if(!campanha)return;
    const ids=new Set(),validos=[],repetidos=[],invalidos=[],suprimidos=[];
    for(const d of destinatarios){
      const e=norm(d.email);
      if(!d.email_valido||!e||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)){invalidos.push(d);continue;}
      if(ids.has(e)){repetidos.push(d);continue;}
      ids.add(e);
      if(supressoes.has(e)){suprimidos.push(d);continue;}
      validos.push(d);
    }
    const tamanho=Math.max(1,Math.min(1000,Number($('to-tamanho').value)||20));
    const n=Math.ceil(validos.length/tamanho);
    $('to-contadores').innerHTML=[
      ['Base congelada',destinatarios.length],
      ['Formato válido e único',validos.length+suprimidos.length],
      ['Inválidos',invalidos.length],
      ['Duplicidades',repetidos.length],
      ['Supressões conhecidas',suprimidos.length],
      ['Planejados após exclusões',validos.length]
    ].map(([k,v])=>'<div class="to-card"><div class="to-muted">'+esc(k)+'</div><div class="to-number">'+esc(v)+'</div></div>').join('');
    const baseLegal=String(campanha.lgpd_base_legal||'').trim();
    const finalidade=String(campanha.lgpd_finalidade_fundamentacao||'').trim();
    const temMensagem=!!mensagem && Number(mensagem.campanha_id)===Number(campanha.id);
    const checks=[
      ['Campanha e mensagem vinculadas',temMensagem,
        temMensagem?'Mensagem associada à campanha selecionada.':'Selecione uma mensagem da campanha.'],
      ['Lista congelada presente',destinatarios.length>0,
        destinatarios.length?'Lista congelada localizada: '+destinatarios.length+' registro(s).':'É necessário congelar a lista na campanha.'],
      ['Base legal e finalidade registradas',!!baseLegal&&!!finalidade,
        !!baseLegal&&!!finalidade?'Fundamentação e finalidade cadastradas na campanha; revisão de conformidade permanece necessária.':'Fundamentação ou finalidade incompleta.'],
      ['Endereços inválidos ou repetidos identificados',true,
        invalidos.length+' inválido(s) e '+repetidos.length+' duplicado(s) identificados e excluídos apenas desta simulação.'],
      ['Supressões conhecidas conferidas',true,
        suprimidos.length+' endereço(s) presente(s) na tabela de supressões. Consulta não substitui análise de pedidos de oposição.'],
      ['Oposição, descadastro e conformidade',false,'Exige verificação operacional e jurídica específica antes da autorização'],
      ['Executor oficial, limites e domínio remetente',false,'Não configurado; envio desabilitado nesta fase']
    ];
    $('to-validacoes').innerHTML=checks.map(([nome,ok,obs])=>
      '<div style="border-bottom:1px solid #e2e8f0;padding:9px 0"><b style="color:'+
      (ok?'#166534':'#9a3412')+'">'+(ok?'✓ ':'○ ')+esc(nome)+'</b><div class="to-muted">'+esc(obs)+'</div></div>').join('')+
      '<p class="to-muted">Aptidão técnica não significa autorização para envio. Base legal cadastrada: '+esc(baseLegal||'não informada')+'.</p>';
    const linhas=[];
    for(let j=0;j<n;j++)linhas.push('<tr><td>#'+(j+1)+'</td><td>'+(j*tamanho+1)+'–'+Math.min((j+1)*tamanho,validos.length)+'</td><td>'+Math.min(tamanho,validos.length-j*tamanho)+'</td><td>Proposto · não criado</td></tr>');
    $('to-lotes').innerHTML='<p>'+esc(validos.length)+' destinatários preliminarmente selecionados em <b>'+n+
      ' lote(s)</b> de até '+tamanho+'.</p>'+
      (n?'<div style="max-height:310px;overflow:auto"><table class="to-table"><thead><tr><th>Lote</th><th>Posições</th><th>Quantidade</th><th>Estado</th></tr></thead><tbody>'+linhas.join('')+'</tbody></table></div>':
       '<p>Nenhum destinatário disponível.</p>')+
      '<p class="to-muted">Simulação local de quantidades, não é congelamento, fila, autorização, agendamento ou envio.</p>';
    $('to-painel').hidden=false;
    $('to-aviso').textContent='Conferência de leitura concluída. Nenhuma mensagem enviada, nenhum lote oficial criado.';
  }
  async function carregarCampanha(){
    const id=Number($('to-campanha').value);
    campanha=campanhas.find(c=>Number(c.id)===id)||null;
    mensagem=null;destinatarios=[];$('to-painel').hidden=true;
    if(!campanha)return;
    $('to-aviso').textContent='Consultando lista congelada, mensagens e supressões...';
    try{
      const [msgs,dests,subs]=await Promise.all([
        obterDados(cdaClient.from('cda_campanha_mensagens').select('id,nome,assunto,campanha_id,remetente_email').eq('campanha_id',id).order('nome')),
        carregarDestinatarios(id),
        obterDados(cdaClient.from('cda_email_supressoes').select('email'))
      ]);
      // Ignora respostas atrasadas ao trocar de campanha.
      if(Number($('to-campanha').value)!==id)return;
      mensagens=msgs;destinatarios=dests;
      supressoes=new Set(subs.map(x=>norm(x.email)).filter(Boolean));
      $('to-mensagem').innerHTML='<option value="">Selecione a mensagem</option>'+
        msgs.map(m=>'<option value="'+esc(m.id)+'">'+esc(m.nome)+' · '+esc(m.assunto||'Sem assunto')+'</option>').join('');
      if(msgs.length===1)$('to-mensagem').value=String(msgs[0].id);
      mensagem=msgs.find(m=>String(m.id)===$('to-mensagem').value)||null;
      apresentar();
    }catch(e){$('to-aviso').textContent='Não foi possível conferir a campanha: '+(e.message||e)+'. Nenhum envio liberado.';}
  }
  $('to-campanha').addEventListener('change',carregarCampanha);
  $('to-mensagem').addEventListener('change',()=>{mensagem=mensagens.find(m=>String(m.id)===$('to-mensagem').value)||null;apresentar();});
  $('to-tamanho').addEventListener('change',apresentar);
  try{
    campanhas=await obterDados(cdaClient.from('cda_campanhas').select('id,nome,status,lgpd_base_legal,lgpd_finalidade_fundamentacao').order('nome'));
    $('to-campanha').innerHTML='<option value="">Selecione uma campanha</option>'+
      campanhas.map(c=>'<option value="'+esc(c.id)+'">'+esc(c.nome)+' · '+esc(c.status||'sem status')+'</option>').join('');
    const selecionadaPeloPipeline=String(window._cdaTransmissaoCampanhaId||'');
    window._cdaTransmissaoCampanhaId='';
    if(campanhas.some(c=>String(c.id)===selecionadaPeloPipeline))
      $('to-campanha').value=selecionadaPeloPipeline;
    else if(campanhas.some(c=>Number(c.id)===4))$('to-campanha').value='4';
    else if(campanhas.length)$('to-campanha').value=String(campanhas[0].id);
    await carregarCampanha();
  }catch(e){$('to-aviso').textContent='Falha na consulta: '+(e.message||e);}
}

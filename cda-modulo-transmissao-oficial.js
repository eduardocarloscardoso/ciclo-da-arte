// Operação universal de transmissões oficiais — fase B1: somente planejamento/leitura.
// Nenhum botão, função ou endpoint de envio/autorizar é invocado por este módulo.
async function montarTransmissaoOficial(containerId) {
  const root=document.getElementById(containerId);
  if(!root)return;
  const esc=x=>String(x??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  let campanhas=[],mensagens=[],destinatarios=[],supressoes=new Set(),campanha=null,mensagem=null;
  let transmissoesSalvas=[],congelando=false,consultaCarregada=false;
  let revisoesAtuais=[],revisoesTransmissaoId=0,revisaoOcupada=false;
  let confirmacaoRevisao=null;
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
      '<section class="to-card"><h3 style="margin:0 0 10px">B2 · Congelamento oficial auditável</h3>'+ 
        '<p class="to-muted">Cria registros persistentes, snapshots da mensagem e lotes com envio bloqueado. Não transmite e não autoriza mensagens.</p>'+ 
        '<div id="to-salvas"></div>'+ 
        '<button type="button" class="btn" id="to-congelar" disabled>Congelar lista e preparar lotes (sem envio)</button>'+ 
        '<p id="to-congelar-status" role="status" class="to-muted"></p></section>'+ 
      '<section class="to-card" id="to-revisao-secao" hidden><h3 style="margin:0 0 10px">B3 · Revisão administrativa dos lotes</h3>'+
        '<p class="to-muted">A conferência administrativa não é autorização de transmissão. Cada lote preserva seus destinatários congelados, assinatura digital e registro de auditoria.</p>'+
        '<div id="to-revisao-resumo"></div>'+
        '<div class="to-grid"><label class="to-label">Lote congelado<select id="to-revisao-lote"></select></label></div>'+
        '<div id="to-revisao-detalhe" style="margin:12px 0"></div>'+
        '<div style="display:flex;flex-wrap:wrap;gap:8px">'+
          '<button type="button" class="btn" id="to-revisar-lote" disabled>Registrar revisão (sem envio)</button>'+
          '<button type="button" class="btn" id="to-revogar-revisao" disabled>Revogar revisão</button>'+
          '<button type="button" class="btn" id="to-atualizar-revisoes">Atualizar situação</button>'+
        '</div>'+
        '<div id="to-confirmacao-revisao" hidden style="padding:14px;border:1px solid #cbd5e1;border-radius:8px;margin:12px 0">'+
          '<p id="to-confirmacao-texto" style="margin:0 0 10px"></p>'+
          '<label class="to-label" for="to-confirmacao-input">Digite a frase solicitada para confirmar'+
            '<input type="text" id="to-confirmacao-input" autocomplete="off" spellcheck="false" placeholder="Digite a frase exata"></label>'+
          '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">'+
            '<button type="button" class="btn" id="to-confirmacao-aplicar" disabled>Confirmar revisão administrativa</button>'+
            '<button type="button" class="btn" id="to-confirmacao-cancelar">Cancelar</button>'+
          '</div></div>'+
        '<p class="to-muted" role="status" id="to-revisao-status"></p>'+
      '</section>'+
      '<section class="to-card"><h3 style="margin:0 0 10px">Governança e liberação</h3>'+
        '<p>A preparação persistente dos lotes está concluída na B2. A B3 permite registrar revisões administrativas individuais, sem autorizar ou transmitir mensagens. A autorização operacional, o controle de limites e o executor oficial serão tratados em etapa posterior.</p>'+
        '<p class="to-muted">Fundamentação LGPD registrada na campanha. Preferências, oposição e descadastramento permanecem como controles de acompanhamento e conformidade, sem impedir o desenvolvimento das revisões B3. Antes de qualquer envio real, esses controles deverão ser atendidos conforme aplicável.</p>'+
        '<button type="button" class="btn" disabled title="Não existe executor oficial nesta versão">Transmitir lote oficial — bloqueado</button>'+
      '</section></div>';
  const $=id=>root.querySelector('#'+id);
  const norm=x=>String(x||'').trim().toLowerCase();
  async function obterDados(q){
    const x=await q;if(x.error)throw x.error;return x.data||[];
  }
  async function consultarCongelamentos(id){
    consultaCarregada=false;
    const r=await cdaClient.rpc('cda_consultar_transmissoes_b2',{p_campanha_id:id});
    if(r.error)throw r.error;
    transmissoesSalvas=Array.isArray(r.data)?r.data:[];
    consultaCarregada=true;
  }
  function mostrarCongelamentos(){
    const host=$('to-salvas');
    if(!host)return;
    const existentes=transmissoesSalvas.filter(t=>Number(t.mensagem_id)===Number(mensagem?.id));
    host.innerHTML=existentes.length?
      '<div style="margin:10px 0">'+existentes.map(t=>
        '<div style="padding:11px;border:1px solid #cbd5e1;border-radius:8px;margin:7px 0">'+
        '<b>Transmissão #'+esc(t.id)+'</b> · '+esc(t.situacao)+
        ' · '+esc(t.total_previsto)+' destinatários · '+esc(t.lotes)+' lotes'+
        '<div class="to-muted">Conteúdo SHA-256: '+esc(t.conteudo_sha256)+
        '</div><div class="to-muted">Envio bloqueado · conformidade LGPD pendente'+
        '</div></div>').join('')+'</div>':
      '<p class="to-muted">Nenhuma transmissão persistida para esta mensagem.</p>';
    const jaCongelado=existentes.some(t=>t.situacao==='congelada');
    const permitidos=!!window.cu&&window.cu.is_admin===true&&!congelando&&consultaCarregada&&
      !!mensagem&&destinatarios.length>0&&!jaCongelado&&
      !!String(campanha?.lgpd_base_legal||'').trim()&&
      !!String(campanha?.lgpd_finalidade_fundamentacao||'').trim();
    $('to-congelar').disabled=!permitidos;
    $('to-congelar').title=jaCongelado?'Esta mensagem já tem uma transmissão congelada.':
      !window.cu?.is_admin?'Somente administrador pode congelar.':
      'Registra a lista e os lotes no banco, sem qualquer envio.';
    if(!jaCongelado){revisoesAtuais=[];revisoesTransmissaoId=0;}
    renderRevisoes();
  }
  function transmissaoCongelada(){
    return transmissoesSalvas.find(t=>Number(t.mensagem_id)===Number(mensagem?.id)&&t.situacao==='congelada')||null;
  }
  async function carregarRevisoes(preservarLote=true){
    const t=transmissaoCongelada();
    if(!t){revisoesAtuais=[];revisoesTransmissaoId=0;renderRevisoes();return;}
    const anterior=preservarLote?$('to-revisao-lote').value:'';
    const r=await cdaClient.rpc('cda_consultar_revisoes_lotes_b3',{p_transmissao_id:Number(t.id)});
    if(r.error)throw r.error;
    if(Number(transmissaoCongelada()?.id)!==Number(t.id))return;
    revisoesAtuais=Array.isArray(r.data)?r.data:[];
    revisoesTransmissaoId=Number(t.id);
    renderRevisoes(anterior);
  }
  function renderRevisoes(selecionado){
    const t=transmissaoCongelada(),sec=$('to-revisao-secao');
    sec.hidden=!t;
    if(!t)return;
    if(revisoesTransmissaoId!==Number(t.id)){
      $('to-revisao-resumo').textContent='Buscando situação dos lotes...';
      $('to-revisar-lote').disabled=true;
      $('to-revogar-revisao').disabled=true;
      return;
    }
    const total=revisoesAtuais.length;
    const aprovados=revisoesAtuais.filter(x=>x.revisao_status==='revisado'&&
      x.revisao_fingerprint===x.fingerprint_atual).length;
    const inconsistentes=revisoesAtuais.filter(x=>x.revisao_status==='revisado'&&
      x.revisao_fingerprint!==x.fingerprint_atual).length;
    $('to-revisao-resumo').innerHTML='<p><b>Transmissão #'+esc(t.id)+
      '</b> · '+aprovados+'/'+total+' lotes revisados · '+
      (total-aprovados)+' aguardando/revogados'+
      (inconsistentes?' · <b>ALERTA: '+inconsistentes+' assinatura(s) divergente(s)</b>':'')+
      ' · <b>envio bloqueado</b></p>';
    const sel=$('to-revisao-lote');
    sel.innerHTML=revisoesAtuais.map(x=>'<option value="'+esc(x.lote_id)+'">Lote #'+
      esc(x.numero)+' · '+esc(x.total)+' destinatários · '+
      esc(x.revisao_status)+'</option>').join('');
    if(revisoesAtuais.some(x=>String(x.lote_id)===String(selecionado)))sel.value=String(selecionado);
    if(!sel.value&&revisoesAtuais.length)sel.value=String(revisoesAtuais[0].lote_id);
    mostrarRevisaoSelecionada();
  }
  function mostrarRevisaoSelecionada(){
    const id=Number($('to-revisao-lote').value);
    const x=revisoesAtuais.find(y=>Number(y.lote_id)===id);
    if(!x){$('to-revisao-detalhe').textContent='Nenhum lote encontrado.';return;}
    const integro=!x.revisao_fingerprint||x.revisao_fingerprint===x.fingerprint_atual;
    $('to-revisao-detalhe').innerHTML='<p><b>Lote #'+esc(x.numero)+'</b> · '+
      esc(x.total)+' destinatários congelados · Status da revisão: <b>'+
      esc(x.revisao_status)+'</b></p>'+
      '<p class="to-muted" style="overflow-wrap:anywhere">Impressão digital SHA-256: '+
      esc(x.fingerprint_atual||'Indisponível')+'</p>'+
      (!integro?'<p style="color:#b91c1c">Assinatura divergente: revisão anterior não pode ser considerada válida.</p>':'')+
      '<p class="to-muted">Verificação administrativa separada da autorização e da transmissão. Nenhum envio será iniciado.</p>';
    const admin=window.cu?.is_admin===true;
    $('to-revisar-lote').disabled=!admin||revisaoOcupada||
      x.revisao_status==='revisado'||!x.fingerprint_atual||x.habilitado!==false;
    $('to-revogar-revisao').disabled=!admin||revisaoOcupada||
      x.revisao_status!=='revisado';
  }
  function limparConfirmacaoRevisao(mensagem){
    confirmacaoRevisao=null;
    $('to-confirmacao-revisao').hidden=true;
    $('to-confirmacao-input').value='';
    $('to-confirmacao-aplicar').disabled=true;
    if(mensagem)$('to-revisao-status').textContent=mensagem;
  }
  function registrarRevisao(acao){
    if(revisaoOcupada){
      $('to-revisao-status').textContent='Já existe uma revisão em andamento.';return;
    }
    const id=Number($('to-revisao-lote').value);
    const x=revisoesAtuais.find(y=>Number(y.lote_id)===id);
    if(!x){
      $('to-revisao-status').textContent='Lote indisponível. Atualize a situação.';return;
    }
    if(window.cu?.is_admin!==true){
      $('to-revisao-status').textContent='Somente administrador pode registrar uma revisão.';return;
    }
    const botao=acao==='revisar'?'to-revisar-lote':'to-revogar-revisao';
    if($(botao).disabled){
      $('to-revisao-status').textContent='A revisão solicitada não está disponível para este lote.';return;
    }
    const chave=acao==='revisar'?'REVISAR LOTE '+x.numero:'REVOGAR REVISÃO '+x.numero;
    confirmacaoRevisao={id,numero:x.numero,acao,chave};
    $('to-confirmacao-texto').innerHTML='<b>'+(acao==='revisar'?'Registrar revisão':'Revogar revisão')+
      ' do lote #'+esc(x.numero)+'</b> ('+esc(x.total)+' destinatários).<p class="to-muted">Esta ação registra apenas a revisão administrativa e NÃO envia e-mails. Para prosseguir, digite exatamente <b>'+esc(chave)+'</b>.</p>';
    $('to-confirmacao-input').value='';
    $('to-confirmacao-aplicar').disabled=true;
    $('to-confirmacao-aplicar').textContent=acao==='revisar'?'Confirmar revisão (sem envio)':'Confirmar revogação (sem envio)';
    $('to-confirmacao-revisao').hidden=false;
    $('to-revisao-status').textContent='Aguardando confirmação textual do lote #'+x.numero+'.';
    $('to-confirmacao-input').focus();
  }
  async function confirmarRevisao(){
    const dados=confirmacaoRevisao;
    if(!dados||revisaoOcupada)return;
    if($('to-confirmacao-input').value!==dados.chave){
      $('to-revisao-status').textContent='Frase incorreta. Digite exatamente '+dados.chave+'.';return;
    }
    if(Number($('to-revisao-lote').value)!==dados.id){
      limparConfirmacaoRevisao('Seleção de lote mudou. Inicie novamente a revisão.');return;
    }
    revisaoOcupada=true;
    $('to-confirmacao-aplicar').disabled=true;
    $('to-confirmacao-input').disabled=true;
    $('to-confirmacao-cancelar').disabled=true;
    $('to-revisao-status').textContent='Registrando revisão no Supabase (sem envio)...';
    try{
      const r=await cdaClient.rpc('cda_revisar_lote_oficial_b3',{
        p_lote_id:dados.id,p_acao:dados.acao,
        p_observacao:'Revisão administrativa B3 confirmada na tela'
      });
      if(r.error)throw r.error;
      limparConfirmacaoRevisao('Lote #'+dados.numero+' atualizado: '+r.data.status+
        '. Revisão auditada. Envio NÃO autorizado.');
    }catch(e){
      limparConfirmacaoRevisao('Não foi possível confirmar a revisão: '+
        (e.message||e)+'. Consulte o histórico antes de repetir a operação.');
    }finally{
      revisaoOcupada=false;
      $('to-confirmacao-input').disabled=false;
      $('to-confirmacao-cancelar').disabled=false;
      try{await carregarRevisoes(true);}catch(e){
        $('to-revisao-status').textContent+=' Falha ao atualizar histórico: '+(e.message||e);
        mostrarRevisaoSelecionada();
      }
    }
  }
  async function congelarLista(){
    if(congelando||$('to-congelar').disabled||!mensagem||!campanha)return;
    const id=Number(campanha.id),m=Number(mensagem.id);
    const tamanho=Number($('to-tamanho').value);
    if(!Number.isSafeInteger(tamanho)||tamanho<1||tamanho>1000){
      $('to-congelar-status').textContent='Informe quantidade inteira entre 1 e 1000.';return;
    }
    const confirme='CONGELAR LISTA';
    const digitado=prompt('CONGELAMENTO REAL DE DESTINATÁRIOS (SEM ENVIO)\n\n'+
      'Campanha: '+campanha.nome+'\nMensagem: '+mensagem.nome+
      '\nTamanho máximo por lote: '+tamanho+
      '\n\nEsta operação grava a lista e os lotes de forma auditável. NÃO envia e-mails.'+
      '\n\nDigite '+confirme+' para confirmar:');
    if(digitado!==confirme)return;
    congelando=true;$('to-congelar').disabled=true;
    $('to-congelar-status').textContent='Congelando registros no banco (sem envio)...';
    try{
      const r=await cdaClient.rpc('cda_congelar_transmissao_oficial_b2',{
        p_campanha_id:id,p_mensagem_id:m,p_tamanho_lote:tamanho
      });
      if(r.error)throw r.error;
      $('to-congelar-status').textContent='Transmissão #'+r.data.transmissao_id+
        ': '+r.data.incluidos+' destinatários em '+r.data.lotes+
        ' lotes; '+r.data.excluidos+' exclusões. Envios continuam bloqueados.';
      await consultarCongelamentos(id);
      await carregarRevisoes(false);
    }catch(e){
      $('to-congelar-status').textContent='Congelamento não confirmado: '+
        (e.message||e)+'. Confira o histórico antes de tentar novamente.';
      // Busca de leitura para evitar repetição por resultado ambíguo.
      try{await consultarCongelamentos(id);}catch{consultaCarregada=false;}
    }finally{
      congelando=false;mostrarCongelamentos();
    }
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
    mostrarCongelamentos();
    $('to-aviso').textContent='Conferência de leitura concluída. Nenhuma mensagem enviada; congelamentos existentes podem ser consultados abaixo.';
  }
  async function carregarCampanha(){
    limparConfirmacaoRevisao();
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
      try{await consultarCongelamentos(id);}catch(e){
        transmissoesSalvas=[];consultaCarregada=false;
        $('to-congelar-status').textContent='Histórico indisponível: '+(e.message||e)+'. Congelamento bloqueado.';
      }
      apresentar();
      try{await carregarRevisoes(false);}catch(e){
        $('to-revisao-status').textContent='Consulta de revisões indisponível: '+(e.message||e);
      }
    }catch(e){$('to-aviso').textContent='Não foi possível conferir a campanha: '+(e.message||e)+'. Nenhum envio liberado.';}
  }
  $('to-campanha').addEventListener('change',carregarCampanha);
  $('to-congelar').addEventListener('click',congelarLista);
  $('to-revisao-lote').addEventListener('change',()=>{
    limparConfirmacaoRevisao('Lote selecionado atualizado.');
    mostrarRevisaoSelecionada();
  });
  $('to-revisar-lote').addEventListener('click',()=>registrarRevisao('revisar'));
  $('to-revogar-revisao').addEventListener('click',()=>registrarRevisao('revogar'));
  $('to-confirmacao-input').addEventListener('input',()=>{
    $('to-confirmacao-aplicar').disabled=!confirmacaoRevisao||
      $('to-confirmacao-input').value!==confirmacaoRevisao.chave;
  });
  $('to-confirmacao-aplicar').addEventListener('click',confirmarRevisao);
  $('to-confirmacao-cancelar').addEventListener('click',()=>{
    if(!revisaoOcupada)limparConfirmacaoRevisao('Revisão cancelada; nenhum registro efetuado.');
  });
  $('to-atualizar-revisoes').addEventListener('click',async()=>{
    $('to-revisao-status').textContent='Atualizando situação dos lotes...';
    try{await carregarRevisoes(true);$('to-revisao-status').textContent='Consulta atualizada; sem envio.';}
    catch(e){$('to-revisao-status').textContent='Falha: '+(e.message||e);}
  });
  $('to-mensagem').addEventListener('change',async()=>{
    limparConfirmacaoRevisao('Mensagem alterada; nenhuma revisão confirmada.');
    mensagem=mensagens.find(m=>String(m.id)===$('to-mensagem').value)||null;
    revisoesAtuais=[];revisoesTransmissaoId=0;apresentar();
    try{await carregarRevisoes(false);}catch(e){$('to-revisao-status').textContent='Falha ao consultar revisões: '+(e.message||e);}
  });
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

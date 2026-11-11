// Etapa 3 · Enviar e acompanhar (Transmissão Oficial, nov/2026).
// Toda decisão de segurança fica no servidor (cda-executor-transmissao-oficial):
// autorização pessoal por lote (60 min, presa à fingerprint), limites globais,
// supressão/descadastro, um e-mail por chamada e nenhum reenvio automático.
function montarEnvioTransmissaoOficial(host,ctx){
  const FN='cda-executor-transmissao-oficial';
  const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const card=document.createElement('section');
  card.className='to-card';card.id='to-envio';
  card.innerHTML='<h3 style="margin:0 0 6px">Enviar e acompanhar</h3>'+
    '<p class="to-muted" data-e="resumo" style="margin:0 0 12px">Carregando…</p>'+
    '<div data-e="lgpd" hidden style="border:1px solid #fdba74;background:#fff7ed;border-radius:8px;padding:12px;margin-bottom:12px">'+
      '<b>Confirmação da base legal (uma vez por transmissão)</b>'+
      '<p data-e="lgpd-texto" style="margin:6px 0;font-size:13px"></p>'+
      '<p style="margin:6px 0;font-size:13px">Cada e-mail terá link de descadastro e o cabeçalho de descadastro em um clique. Endereços descadastrados, devolvidos ou com reclamação não recebem novos envios.</p>'+
      '<label style="font-size:13px">Digite <b>CONFIRMO A BASE LEGAL</b> <input data-e="lgpd-input" style="margin-left:6px;padding:6px;width:220px"></label> '+
      '<button type="button" class="btn sm" data-e="lgpd-btn">Confirmar</button></div>'+
    '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">'+
      '<label style="font-size:13px">Lote <select data-e="lote" style="padding:6px;min-width:280px"></select></label>'+
      '<button type="button" class="btn sm" data-e="previa">Ver prévia do e-mail</button>'+
      '<button type="button" class="btn sm" data-e="atualizar">Atualizar</button></div>'+
    '<div data-e="lote-info" style="margin:12px 0;font-size:14px"></div>'+
    '<div data-e="autorizar-box" hidden style="border:1px solid #cbd5e1;border-radius:8px;padding:12px;margin-bottom:12px">'+
      '<p style="margin:0 0 6px;font-size:13px">Autorização válida por 60 minutos, só para este lote e só para você. Autorizar não envia nada.</p>'+
      '<label style="font-size:13px">Digite <b data-e="frase"></b> <input data-e="autorizar-input" style="margin-left:6px;padding:6px;width:200px"></label> '+
      '<button type="button" class="btn sm" data-e="autorizar">Autorizar lote</button></div>'+
    '<div style="display:flex;gap:8px;flex-wrap:wrap">'+
      '<button type="button" class="btn" data-e="iniciar" disabled>Iniciar envio do lote</button>'+
      '<button type="button" class="btn" data-e="pausar" disabled>Pausar</button></div>'+
    '<p data-e="progresso" aria-live="polite" style="margin:12px 0 0;font-weight:600"></p>'+
    '<details style="margin-top:10px"><summary style="cursor:pointer;font-size:13px">Destinatários deste lote</summary><div data-e="lista" style="font-size:12px;max-height:280px;overflow:auto"></div></details>'+
    '<div data-e="modal" hidden style="position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;display:flex;align-items:center;justify-content:center">'+
      '<div style="background:#fff;width:min(680px,94vw);height:88vh;border-radius:8px;display:flex;flex-direction:column">'+
      '<div style="padding:10px 14px;display:flex;justify-content:space-between;gap:8px;font-size:13px"><span data-e="modal-cab"></span><button type="button" class="btn sm" data-e="fechar">Fechar</button></div>'+
      '<iframe data-e="modal-frame" sandbox="" style="flex:1;border:0;border-top:1px solid #e5e7eb"></iframe></div></div>';
  host.appendChild(card);
  const $=k=>card.querySelector('[data-e="'+k+'"]');
  let painel=null,status=null,rodando=false,pararPedido=false,transmissaoAtual=0;
  const chamar=async(body)=>{
    const r=await cdaClient.functions.invoke(FN,{body});
    let d=r.data;
    if(!d&&r.error?.context?.json){try{d=await r.error.context.json();}catch(e){}}
    if(!d)throw new Error(r.error?.message||'Falha de comunicação');
    if(d.ok===false&&d.erro)throw new Error(d.erro);
    return d;
  };
  const NOMES={aceita:'aceitos pelo Resend',entregue:'entregues',devolvida:'devolvidos',reclamacao:'reclamações',
    atrasado:'atrasados',falha:'falhas',indeterminada:'indeterminados',suprimido:'descadastrados/suprimidos',solicitada:'em processamento'};
  const resumoEstados=o=>Object.entries(o||{}).map(([k,v])=>v+' '+(NOMES[k]||k)).join(' · ')||'nenhum envio ainda';

  async function carregarPainel(){
    const t=ctx.transmissao();
    if(!t){card.hidden=true;return;}
    card.hidden=false;transmissaoAtual=Number(t.id);
    try{
      const d=await chamar({acao:'painel',transmissao_id:transmissaoAtual});
      painel=d.painel;
      const lim=painel.limites||{};
      $('resumo').textContent='Transmissão #'+painel.transmissao_id+' · '+resumoEstados(painel.por_estado)+
        ' · hoje: '+painel.enviados_hoje+' de '+(lim.dia||300)+' (limite '+(lim.minuto||10)+'/min, '+(lim.hora||120)+'/h).';
      $('lgpd').hidden=!(painel.lgpd_pendente&&d.admin);
      $('lgpd-texto').textContent='Base legal: '+(painel.base_legal||'—')+'. Finalidade: '+(painel.finalidade||'—');
      const sel=$('lote'),atual=sel.value;
      sel.innerHTML=(painel.lotes||[]).map(l=>'<option value="'+l.lote_id+'">Lote '+l.numero+' · '+l.processados+'/'+l.total+
        ' processados'+(l.preaprovado?'':' · sem pré-aprovação')+(l.autorizado_ate?' · autorizado':'')+'</option>').join('');
      const primeiroAberto=(painel.lotes||[]).find(l=>l.processados<l.total);
      sel.value=atual&&sel.querySelector('option[value="'+atual+'"]')?atual:String(primeiroAberto?.lote_id||painel.lotes?.[0]?.lote_id||'');
      await carregarLote();
    }catch(e){$('resumo').textContent='Não foi possível consultar: '+e.message;}
  }
  async function carregarLote(){
    const id=Number($('lote').value);if(!id)return;
    try{
      const d=await chamar({acao:'status',lote_id:id});status=d;
      const s=d.status,a=s.autorizacao;
      const valida=!!(a&&a.valida);
      const bloqueios=[];
      if(s.lgpd_pendente)bloqueios.push('base legal não confirmada');
      if(!s.preaprovado)bloqueios.push('lote sem pré-aprovação (Controles administrativos)');
      if(!s.snapshot_integro)bloqueios.push('conteúdo congelado divergente');
      if(!d.provedor_configurado)bloqueios.push('Resend não configurado');
      $('lote-info').innerHTML='<b>Lote '+s.numero+'</b> · '+s.total+' destinatários · '+s.pendentes+' a enviar · '+esc(resumoEstados(s.por_estado))+
        '<br>'+(valida?'<span style="color:#166534">Autorizado até '+new Date(a.expira_em).toLocaleTimeString('pt-BR')+'</span>':
          (bloqueios.length?'<span style="color:#9a3412">Bloqueado: '+esc(bloqueios.join('; '))+'</span>':'Ainda não autorizado.'));
      $('frase').textContent=d.confirmacao_exigida;
      $('autorizar-box').hidden=!d.admin||valida||bloqueios.length>0||s.pendentes===0;
      $('iniciar').disabled=rodando||!valida||s.pendentes===0;
      $('pausar').disabled=!(rodando||valida);
      $('lista').innerHTML=(d.envios||[]).length?'<table style="width:100%;border-collapse:collapse">'+d.envios.map(e=>'<tr><td style="padding:3px 6px;border-bottom:1px solid #eee">'+esc(e.email)+
        '</td><td style="padding:3px 6px;border-bottom:1px solid #eee">'+esc(NOMES[e.estado]||e.estado)+'</td><td style="padding:3px 6px;border-bottom:1px solid #eee;color:#9a3412">'+esc(e.erro||'')+'</td></tr>').join('')+'</table>':'<p>Nenhum envio neste lote.</p>';
    }catch(e){$('lote-info').textContent='Falha ao consultar o lote: '+e.message;}
  }
  $('lote').addEventListener('change',carregarLote);
  $('atualizar').addEventListener('click',carregarPainel);
  $('fechar').addEventListener('click',()=>{$('modal').hidden=true;});
  $('previa').addEventListener('click',async()=>{
    try{
      const d=await chamar({acao:'previa',lote_id:Number($('lote').value)});
      $('modal-cab').innerHTML='<b>De:</b> '+esc(d.de)+' · <b>Para:</b> '+esc(d.para)+'<br><b>Assunto:</b> '+esc(d.assunto)+' · <b>Responder para:</b> '+esc(d.responder_para||'—')+'<br><i>Prévia renderizada no servidor. Nada foi enviado.</i>';
      $('modal-frame').srcdoc=d.html;$('modal').hidden=false;
    }catch(e){alert('Prévia indisponível: '+e.message);}
  });
  $('lgpd-btn').addEventListener('click',async()=>{
    if($('lgpd-input').value.trim()!=='CONFIRMO A BASE LEGAL'){alert('Digite exatamente: CONFIRMO A BASE LEGAL');return;}
    try{await chamar({acao:'confirmar_lgpd',transmissao_id:transmissaoAtual,confirmacao:'CONFIRMO A BASE LEGAL'});await carregarPainel();}
    catch(e){alert('Não confirmado: '+e.message);}
  });
  $('autorizar').addEventListener('click',async()=>{
    const frase=status?.confirmacao_exigida;
    if($('autorizar-input').value.trim()!==frase){alert('Digite exatamente: '+frase);return;}
    try{
      await chamar({acao:'autorizar',lote_id:Number($('lote').value),confirmacao:frase,fingerprint_sha256:status.status.fingerprint_sha256});
      $('autorizar-input').value='';await carregarPainel();
    }catch(e){alert('Autorização não registrada: '+e.message);}
  });
  $('pausar').addEventListener('click',async()=>{
    pararPedido=true;
    try{await chamar({acao:'pausar',lote_id:Number($('lote').value)});}catch(e){}
    $('progresso').textContent='Pausado. A autorização foi revogada; para retomar, autorize o lote novamente.';
    await carregarPainel();
  });
  const esperar=ms=>new Promise(r=>setTimeout(r,ms));
  $('iniciar').addEventListener('click',async()=>{
    const id=Number($('lote').value),s=status?.status;
    if(!s||!confirm('ENVIO REAL: enviar o lote '+s.numero+' ('+s.pendentes+' destinatários) pelo Resend, respeitando '+
      ((painel?.limites?.minuto)||10)+' e-mails por minuto?\n\nVocê pode pausar a qualquer momento.'))return;
    rodando=true;pararPedido=false;$('iniciar').disabled=true;$('pausar').disabled=false;
    let enviados=0;
    try{
      while(!pararPedido){
        const r=await chamar({acao:'enviar_proximo',lote_id:id});
        if(r.enviado){enviados++;$('progresso').textContent='Enviando lote '+s.numero+': '+enviados+' aceitos nesta sessão · último: '+r.email;await esperar(6500);continue;}
        if(r.estado){ // falha ou indeterminado: parar para revisão
          $('progresso').textContent='Envio interrompido: resultado "'+r.estado+'" para '+(r.email||'um destinatário')+'. Revise antes de continuar; não há reenvio automático.';break;}
        if(r.motivo==='SUPRIMIDO'){continue;}
        if(r.motivo==='LIMITE_MINUTO'){$('progresso').textContent='Aguardando o limite por minuto…';await esperar((r.aguardar_segundos||15)*1000);continue;}
        if(r.motivo==='LOTE_CONCLUIDO'){$('progresso').textContent='Lote '+s.numero+' concluído: '+enviados+' aceitos nesta sessão. Acompanhe entregas em Atualizar.';break;}
        const msgs={SEM_AUTORIZACAO:'autorização ausente, expirada ou revogada',LIMITE_HORA:'limite por hora atingido; retome mais tarde',LIMITE_DIA:'limite diário atingido; retome amanhã'};
        $('progresso').textContent='Envio parado: '+(msgs[r.motivo]||r.motivo)+'. '+enviados+' aceitos nesta sessão.';break;
      }
    }catch(e){$('progresso').textContent='Envio interrompido: '+e.message+'. '+enviados+' aceitos nesta sessão. Nenhum reenvio automático.';}
    finally{rodando=false;await carregarPainel();}
  });
  return {refresh:carregarPainel};
}

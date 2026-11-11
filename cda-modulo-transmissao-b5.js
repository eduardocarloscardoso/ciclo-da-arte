// B5: Fila simulada sem envio. Nenhum endpoint de envio é chamado aqui.
function montarSimuladorB5(root, contexto) {
  const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const box=document.createElement('section');
  box.className='to-card';
  box.hidden=true;
  box.innerHTML='<h3 style="margin:0 0 10px">B5 · Simulador de execução oficial (sem envio)</h3>'+
    '<p class="to-muted">Agendamento simulado por minuto, hora e dia, com idempotência e auditoria. Não existe execução pelo Resend nesta etapa.</p>'+
    '<p data-b5="resumo"></p><p class="to-muted" data-b5="detalhe"></p>'+
    '<div style="display:flex;gap:8px;flex-wrap:wrap">'+
    '<button type="button" class="btn" data-b5="simular" disabled>Simular fila do lote selecionado (sem envio)</button>'+
    '<button type="button" class="btn" data-b5="atualizar">Atualizar simulações</button></div>'+
    '<div data-b5="confirmacao" hidden style="margin-top:12px;padding:12px;border:1px solid #cbd5e1;border-radius:8px">'+
    '<p data-b5="instrucao"></p>'+
    '<label class="to-label">Frase de confirmação<input data-b5="frase" type="text" autocomplete="off" spellcheck="false"></label>'+
    '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">'+
    '<button type="button" class="btn" data-b5="confirmar" disabled>Registrar simulação (sem envio)</button>'+
    '<button type="button" class="btn" data-b5="cancelar">Cancelar</button></div></div>'+
    '<p data-b5="status" class="to-muted" role="status" aria-live="polite"></p>';
  const governanca=[...root.querySelectorAll('h3')].find(x=>x.textContent.trim()==='Governança e liberação')?.closest('.to-card');
  if(governanca)governanca.before(box);else root.appendChild(box);
  const $=k=>box.querySelector('[data-b5="'+k+'"]');
  let simulacoes=[],transmissaoId=0,ocupado=false,confirmacao=null;
  function limpar(msg){
    confirmacao=null;$('confirmacao').hidden=true;$('frase').value='';
    $('confirmar').disabled=true;
    if(msg)$('status').textContent=msg;
  }
  function render(){
    const t=contexto.transmissao();
    box.hidden=!t;
    if(!t)return;
    const atual=Number(t.id),carregado=transmissaoId===atual;
    const lote=contexto.lote(),b4=contexto.controles();
    const pre=lote&&(b4?.preaprovacoes||[]).find(x=>Number(x.lote_id)===Number(lote.lote_id));
    const sim=lote&&simulacoes.find(x=>Number(x.lote_id)===Number(lote.lote_id));
    const valido=!!lote&&lote.revisao_status==='revisado'&&
      lote.revisao_fingerprint===lote.fingerprint_atual&&
      pre?.status==='preaprovado'&&pre.fingerprint_sha256===lote.fingerprint_atual;
    $('resumo').textContent=carregado?
      'Transmissão #'+atual+' · '+simulacoes.length+' lote(s) simulados · 0 mensagens enviadas':
      'Consultando simulações...';
    if(!lote)$('detalhe').textContent='Selecione um lote na seção B3.';
    else if(sim)$('detalhe').innerHTML='<b>Lote #'+esc(lote.numero)+
      ' · Simulação #'+esc(sim.simulacao_id)+'</b> · '+esc(sim.itens)+' posições · '+
      esc(new Date(sim.inicio_previsto).toLocaleString('pt-BR'))+' até '+
      esc(new Date(sim.termino_previsto).toLocaleString('pt-BR'))+'.';
    else $('detalhe').textContent='Lote #'+lote.numero+' · '+lote.total+
      ' destinatários · '+(valido?'Pronto para simular.':'Aguardando revisão e pré-aprovação íntegras.');
    $('simular').disabled=!carregado||!valido||!!sim||!b4?.controles||
      ocupado||window.cu?.is_admin!==true;
  }
  async function refresh(){
    const t=contexto.transmissao();
    if(!t){transmissaoId=0;simulacoes=[];render();return;}
    const id=Number(t.id);
    const r=await cdaClient.rpc('cda_consultar_simulacoes_b5',{p_transmissao_id:id});
    if(r.error)throw r.error;
    if(Number(contexto.transmissao()?.id)!==id)return;
    transmissaoId=id;simulacoes=Array.isArray(r.data)?r.data:[];
    render();
  }
  $('simular').addEventListener('click',()=>{
    const t=contexto.transmissao(),l=contexto.lote();
    if(!t||!l||$('simular').disabled)return;
    const frase='SIMULAR LOTE '+l.numero;
    confirmacao={transmissao:Number(t.id),lote:Number(l.lote_id),numero:l.numero,frase};
    $('instrucao').innerHTML='Criar somente a fila simulada do lote <b>#'+esc(l.numero)+
      '</b> ('+esc(l.total)+' destinatários). Nenhum e-mail será enviado. Digite <b>'+esc(frase)+'</b>.';
    $('frase').value='';$('confirmar').disabled=true;$('confirmacao').hidden=false;
    $('status').textContent='Aguardando confirmação da simulação.';$('frase').focus();
  });
  $('frase').addEventListener('input',()=>{
    $('confirmar').disabled=!confirmacao||$('frase').value!==confirmacao.frase;
  });
  $('cancelar').addEventListener('click',()=>{if(!ocupado)limpar('Simulação cancelada.');});
  $('confirmar').addEventListener('click',async()=>{
    const q=confirmacao;
    if(!q||ocupado||$('frase').value!==q.frase)return;
    if(Number(contexto.transmissao()?.id)!==q.transmissao||
      Number(contexto.lote()?.lote_id)!==q.lote){
      limpar('Seleção alterada. Reinicie a simulação.');return;
    }
    ocupado=true;$('confirmar').disabled=true;$('cancelar').disabled=true;
    $('status').textContent='Registrando a simulação no Supabase, sem envio...';
    try{
      const r=await cdaClient.rpc('cda_simular_execucao_lote_b5',{p_lote_id:q.lote});
      if(r.error)throw r.error;
      limpar('Simulação #'+r.data.simulacao_id+' criada: '+r.data.quantidade+
        ' itens. Nenhum e-mail enviado.');
    }catch(e){
      limpar('Resultado não confirmado: '+(e.message||e)+'. Atualize antes de repetir.');
    }finally{
      ocupado=false;$('cancelar').disabled=false;
      try{await refresh();}catch(e){$('status').textContent+=' Falha na consulta: '+(e.message||e);}
      render();
    }
  });
  $('atualizar').addEventListener('click',async()=>{
    try{await refresh();$('status').textContent='Simulações atualizadas, sem envio.';}
    catch(e){$('status').textContent='Erro: '+(e.message||e);}
  });
  return {refresh,render,clear:()=>{limpar();transmissaoId=0;simulacoes=[];render();}};
}

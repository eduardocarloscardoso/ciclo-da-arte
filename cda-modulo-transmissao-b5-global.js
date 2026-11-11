// B5.2 — reserva global simulada para múltiplas campanhas. Sem envio.
function montarFilaGlobalB5(root,contexto) {
  const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const div=document.createElement('section');
  div.className='to-card';div.hidden=true;
  div.innerHTML='<h3 style="margin:0 0 10px">B5.2 · Capacidade global entre campanhas (simulação)</h3>'+
    '<p class="to-muted">Reserva horários fictícios considerando todos os lotes já simulados, independentemente da campanha. Não cria autorização nem envia e-mails.</p>'+
    '<p data-g="resumo"></p><p data-g="detalhe" class="to-muted"></p>'+
    '<div style="display:flex;gap:8px;flex-wrap:wrap">'+
      '<button class="btn" type="button" data-g="preparar" disabled>Preparar reserva global simulada (sem envio)</button>'+
      '<button class="btn" type="button" data-g="atualizar">Atualizar reservas</button>'+
    '</div>'+
    '<div data-g="confirmacao" hidden style="padding:12px;border:1px solid #cbd5e1;border-radius:8px;margin-top:10px">'+
      '<p data-g="texto"></p>'+
      '<label class="to-label">Digite a frase solicitada<input data-g="frase" type="text" autocomplete="off"></label>'+
      '<div style="display:flex;gap:8px;margin-top:10px">'+
        '<button class="btn" type="button" data-g="confirmar" disabled>Confirmar reserva sem envio</button>'+
        '<button class="btn" type="button" data-g="cancelar">Cancelar</button>'+
      '</div>'+
    '</div>'+
    '<p class="to-muted" data-g="status" role="status" aria-live="polite"></p>';
  const target=[...root.querySelectorAll('h3')].find(x=>x.textContent.includes('Simulador de execução oficial'))?.closest('.to-card');
  if(target)target.after(div);else root.appendChild(div);
  const $=k=>div.querySelector('[data-g="'+k+'"]');
  let lista=[],id=0,ocupado=false,confirmacao=null;
  function limpar(msg) {
    confirmacao=null;$('frase').value='';$('confirmacao').hidden=true;
    $('confirmar').disabled=true;
    if(msg)$('status').textContent=msg;
  }
  function render() {
    const t=contexto.transmissao(),l=contexto.lote();
    div.hidden=!t;if(!t)return;
    const pronta=id===Number(t.id);
    const existente=l&&lista.find(x=>Number(x.lote_id)===Number(l.lote_id));
    const temSimulacao=l&&contexto.temSimulacao(l.lote_id);
    $('resumo').textContent=pronta?'Transmissão #'+t.id+' · '+lista.length+
      ' lote(s) com reserva global simulada · zero envios':'Consultando reservas globais...';
    $('detalhe').textContent=!l?'Selecione um lote em B3.':
      existente?'Lote #'+l.numero+' · '+existente.quantidade+
        ' posições globais · '+new Date(existente.inicio).toLocaleString('pt-BR')+
        ' a '+new Date(existente.fim).toLocaleString('pt-BR')+'.':
      'Lote #'+l.numero+' · '+(temSimulacao?
        'Pronto para reserva simulada global.':'Simule o lote na B5 antes de preparar a reserva global.');
    $('preparar').disabled=!pronta||!l||!temSimulacao||!!existente||
      ocupado||window.cu?.is_admin!==true;
  }
  async function refresh() {
    const t=contexto.transmissao();
    if(!t){lista=[];id=0;render();return;}
    const alvo=Number(t.id);
    const r=await cdaClient.rpc('cda_consultar_reservas_globais_b5',{p_transmissao_id:alvo});
    if(r.error)throw r.error;
    if(Number(contexto.transmissao()?.id)!==alvo)return;
    lista=Array.isArray(r.data)?r.data:[];
    id=alvo;render();
  }
  $('preparar').addEventListener('click',()=>{
    const t=contexto.transmissao(),l=contexto.lote();
    if(!t||!l||$('preparar').disabled)return;
    const frase='RESERVAR SIMULACAO LOTE '+l.numero;
    confirmacao={tid:Number(t.id),lid:Number(l.lote_id),numero:l.numero,frase};
    $('texto').innerHTML='<b>Reserva global simulada para lote #'+esc(l.numero)+
      '</b> ('+esc(l.total)+' destinatários). Não é autorização ou envio. Digite <b>'+esc(frase)+'</b>.';
    $('frase').value='';$('confirmar').disabled=true;
    $('confirmacao').hidden=false;$('status').textContent='Aguardando confirmação.';
    $('frase').focus();
  });
  $('frase').addEventListener('input',()=>{
    $('confirmar').disabled=!confirmacao||$('frase').value!==confirmacao.frase;
  });
  $('cancelar').addEventListener('click',()=>{if(!ocupado)limpar('Reserva cancelada.');});
  $('confirmar').addEventListener('click',async()=>{
    const q=confirmacao;
    if(!q||ocupado||$('frase').value!==q.frase)return;
    if(Number(contexto.transmissao()?.id)!==q.tid||
        Number(contexto.lote()?.lote_id)!==q.lid){
      limpar('Seleção alterada; reinicie a confirmação.');return;
    }
    ocupado=true;$('confirmar').disabled=true;$('cancelar').disabled=true;
    $('status').textContent='Reservando slots simulados no banco...';
    try{
      const r=await cdaClient.rpc('cda_preparar_reserva_global_simulada_b5',{p_lote_id:q.lid});
      if(r.error)throw r.error;
      limpar('Reserva global simulada concluída: '+r.data.reservados+
        ' posições. Envio bloqueado.');
    }catch(e){limpar('Reserva não confirmada: '+(e.message||e)+
      '. Atualize o histórico antes de repetir.');}
    finally{
      ocupado=false;$('cancelar').disabled=false;
      try{await refresh();}catch(e){$('status').textContent+=' Erro ao atualizar: '+(e.message||e);}
      render();
    }
  });
  $('atualizar').addEventListener('click',async()=>{
    try{await refresh();$('status').textContent='Consulta de reservas atualizada.';}
    catch(e){$('status').textContent='Erro: '+(e.message||e);}
  });
  return {refresh,render,clear:()=>{limpar();lista=[];id=0;render();}};
}

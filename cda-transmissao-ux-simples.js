// Interface de operação: três momentos. B2-B5 permanecem acessíveis nos detalhes.
function montarUXTransmissaoSimplificada(root,ctx){
  const panel=root.querySelector('#to-painel');
  if(!panel)return {refresh(){}};
  const style=document.createElement('style');
  style.textContent='.to-etapa{display:inline-flex;padding:8px 12px;border:1px solid #cbd5e1;border-radius:22px;font-size:13px}.to-etapa.feita{color:#166534;border-color:#86efac}.to-etapa.atual{background:#1b283d;border-color:#1b283d;color:white}'+
   '#to-ux-tecnico section.to-card{margin-top:12px}#to-salvas .to-muted{display:none}'+
   '.to-etapa.aguardando{color:#64748b;border-style:dashed}'+
   '[data-to-ux] [hidden]{display:none!important}'+
   '[data-to-ux] .to-label{min-width:0}[data-to-ux] .to-label select,[data-to-ux] .to-label input{width:100%;min-width:0;max-width:100%;box-sizing:border-box;text-overflow:ellipsis}';
  root.setAttribute('data-to-ux','');
  root.appendChild(style);
  const cabecalho=[...root.querySelectorAll('h2')].find(x=>x.textContent.includes('Transmissões oficiais'));
  if(cabecalho)cabecalho.textContent='Transmissão Oficial';
  const apresentacao=cabecalho?.parentElement?.querySelector('p.to-muted');
  if(apresentacao)apresentacao.textContent='Selecione a campanha e acompanhe a preparação e o envio das mensagens.';
  const aviso=root.querySelector('#to-aviso');
  const tamanho=root.querySelector('#to-tamanho');
  const tamanhoLabel=tamanho?.closest('label');
  const botaoCongelar=root.querySelector('#to-congelar');
  if(botaoCongelar)botaoCongelar.textContent='Preparar destinatários e lotes (sem envio)';
  const overview=document.createElement('section');
  overview.className='to-card';
  overview.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">'+
   '<h3 style="margin:0">Resumo da transmissão</h3><span data-ux="selo" style="font-size:13px;color:#9a3412;font-weight:650">Envio ainda indisponível</span></div>'+
   '<p data-ux="resumo" style="margin:12px 0"></p><div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">'+
   '<span class="to-etapa feita">1 · Selecionar</span><span class="to-etapa" data-ux="preparar">2 · Preparar</span>'+
   '<span class="to-etapa" data-ux="enviar">3 · Enviar e acompanhar</span></div>'+
   '<p class="to-muted" data-ux="orientacao"></p>'+
   '<button type="button" class="btn" data-ux="abrir" aria-controls="to-ux-tecnico" aria-expanded="false">Mostrar controles administrativos</button>';
  panel.prepend(overview);
  const details=document.createElement('section');
  details.className='to-card';details.id='to-ux-tecnico';
  details.style.display='none';
  details.setAttribute('aria-label','Controles administrativos e histórico');
  details.innerHTML='<p style="margin:0 0 10px;font-weight:650">Controles administrativos e histórico</p>'+
   '<p class="to-muted" style="margin-top:8px">Revisões, parâmetros, simulações e auditoria. Essas operações não habilitam o envio.</p>';
  const preparation=panel.querySelector('#to-congelar')?.closest('section.to-card');
  const cards=[...panel.querySelectorAll('section.to-card')].filter(x=>x!==overview&&x!==preparation);
  const counters=panel.querySelector('#to-contadores');
  if(counters)details.appendChild(counters);
  for(const card of cards)details.appendChild(card);
  panel.appendChild(details);
  if(preparation){
    preparation.querySelector('h3').textContent='Preparar destinatários e lotes';
    preparation.querySelector('p.to-muted')?.remove();
    panel.insertBefore(preparation,details);
  }
  // Etapa 3: executor oficial (cda-transmissao-envio.js), acima dos controles recolhidos.
  const envioHost=document.createElement('div');
  panel.insertBefore(envioHost,details);
  const envio=typeof montarEnvioTransmissaoOficial==='function'?montarEnvioTransmissaoOficial(envioHost,ctx):null;
  let envioTransmissao=null;
  const $=x=>overview.querySelector('[data-ux="'+x+'"]');
  $('abrir').addEventListener('click',()=>{
    const abrir=details.style.display==='none';
    details.style.display=abrir?'block':'none';
    $('abrir').textContent=abrir?'Ocultar controles administrativos':'Mostrar controles administrativos';
    $('abrir').setAttribute('aria-expanded',String(abrir));
    if(abrir)details.scrollIntoView({behavior:'smooth',block:'start'});
  });
  function refresh(){
    const t=ctx.transmissao(),d=ctx.destinatarios(),r=ctx.revisoes(),b4=ctx.controles();
    const listo=!!t,rev=r.filter(x=>x.revisao_status==='revisado'&&x.revisao_fingerprint===x.fingerprint_atual).length;
    const prev=(b4?.preaprovacoes||[]).filter(x=>x.status==='preaprovado').length;
    $('preparar').className='to-etapa '+(listo?'feita':'atual');
    // Etapa 3 ativa quando a preparação está concluída e o executor oficial está carregado.
    const executor=!!envio;
    $('enviar').className='to-etapa'+(listo?(executor?' atual':' aguardando'):'');
    $('enviar').textContent=listo&&!executor?'3 · Enviar e acompanhar (aguardando executor)':'3 · Enviar e acompanhar';
    $('selo').textContent=listo&&executor?'Envio exige autorização por lote':'Envio ainda indisponível';
    $('resumo').textContent=listo?'Transmissão #'+t.id+' · '+t.total_previsto+' destinatários · '+t.lotes+
      ' lotes preparados · '+rev+(rev===1?' revisado':' revisados')+' · '+prev+(prev===1?' pré-aprovado.':' pré-aprovados.'):
      d.length+' registros na lista da campanha. Nenhum lote oficial preparado para esta mensagem.';
    $('orientacao').textContent=listo?(executor?'Preparação concluída. Em Enviar e acompanhar: confira a prévia, autorize um lote e inicie o envio.':'Preparação concluída. A transmissão permanece bloqueada até a liberação do executor oficial.'):
      'Defina o tamanho do lote e use Preparar os lotes abaixo. Nenhuma mensagem será enviada.';
    if(tamanho){tamanho.disabled=listo;tamanho.title=listo?'Lotes já preparados.':'Quantidade por lote';}
    if(tamanhoLabel)tamanhoLabel.hidden=listo;
    if(preparation)preparation.hidden=listo||!d.length;
    if(aviso)aviso.hidden=listo||!aviso.textContent||aviso.textContent.startsWith('Conferência de leitura concluída');
    if(envio){const id=t?Number(t.id):null;if(id!==envioTransmissao){envioTransmissao=id;envio.refresh();}}
  }
  return {refresh};
}

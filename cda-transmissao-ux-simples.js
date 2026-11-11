// Interface de operação: três momentos. B2-B5 permanecem acessíveis nos detalhes.
function montarUXTransmissaoSimplificada(root,ctx){
  const panel=root.querySelector('#to-painel');
  if(!panel)return {refresh(){}};
  const style=document.createElement('style');
  style.textContent='.to-etapa{display:inline-flex;padding:8px 12px;border:1px solid #cbd5e1;border-radius:22px;font-size:13px}.to-etapa.feita{color:#166534;border-color:#86efac}.to-etapa.atual{background:#1b283d;border-color:#1b283d;color:white}'+
   '#to-ux-tecnico[open]>section.to-card{margin-top:12px}#to-salvas .to-muted{display:none}';
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
   '<h3 style="margin:0">Resumo da transmissão</h3><span style="font-size:13px;color:#9a3412;font-weight:650">Envio ainda indisponível</span></div>'+
   '<p data-ux="resumo" style="margin:12px 0"></p><div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">'+
   '<span class="to-etapa feita">1 · Selecionar</span><span class="to-etapa" data-ux="preparar">2 · Preparar</span>'+
   '<span class="to-etapa" data-ux="enviar">3 · Enviar e acompanhar</span></div>'+
   '<p class="to-muted" data-ux="orientacao"></p>'+
   '<button type="button" class="btn" data-ux="abrir">Controles administrativos e histórico</button>'+ 
   '<p class="to-muted" style="margin:10px 0 0">O envio oficial será disponibilizado após a homologação do executor e autorização de cada lote.</p>';
  panel.prepend(overview);
  const details=document.createElement('details');
  details.className='to-card';details.id='to-ux-tecnico';
  details.innerHTML='<summary style="cursor:pointer;font-weight:650">Controles administrativos, simulações e auditoria</summary>'+
   '<p class="to-muted" style="margin-top:10px">Funções avançadas disponíveis para administradores; não autorizam envio.</p>';
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
  const $=x=>overview.querySelector('[data-ux="'+x+'"]');
  $('abrir').addEventListener('click',()=>{details.open=true;details.scrollIntoView({behavior:'smooth',block:'start'});});
  function refresh(){
    const t=ctx.transmissao(),d=ctx.destinatarios(),r=ctx.revisoes(),b4=ctx.controles();
    const listo=!!t,rev=r.filter(x=>x.revisao_status==='revisado'&&x.revisao_fingerprint===x.fingerprint_atual).length;
    const prev=(b4?.preaprovacoes||[]).filter(x=>x.status==='preaprovado').length;
    $('preparar').className='to-etapa '+(listo?'feita':'atual');
    $('enviar').className='to-etapa '+(listo?'atual':'');
    $('resumo').textContent=listo?'Transmissão #'+t.id+' · '+t.total_previsto+' destinatários · '+t.lotes+
      ' lotes preparados · '+rev+' revisados · '+prev+' pré-aprovados.':
      d.length+' registros na lista da campanha. Nenhum lote oficial preparado para esta mensagem.';
    $('orientacao').textContent=listo?'Preparação concluída. Nenhuma ação adicional necessária nesta fase.':
      'Defina o tamanho do lote e use Preparar os lotes abaixo. Nenhuma mensagem será enviada.';
    if(tamanho){tamanho.disabled=listo;tamanho.title=listo?'Lotes já preparados.':'Quantidade por lote';}
    if(tamanhoLabel)tamanhoLabel.hidden=listo;
    if(preparation)preparation.hidden=listo||!d.length;
    if(aviso)aviso.hidden=listo||!aviso.textContent||aviso.textContent.startsWith('Conferência de leitura concluída');
  }
  return {refresh};
}

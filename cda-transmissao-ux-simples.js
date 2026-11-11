// Interface de operação: três momentos. B2-B5 permanecem acessíveis nos detalhes.
function montarUXTransmissaoSimplificada(root,ctx){
  const panel=root.querySelector('#to-painel');
  if(!panel)return {refresh(){}};
  const style=document.createElement('style');
  style.textContent='.to-etapa{display:inline-flex;padding:8px 12px;border:1px solid #cbd5e1;border-radius:22px;font-size:13px}.to-etapa.feita{color:#166534;border-color:#86efac}.to-etapa.atual{background:#1b283d;border-color:#1b283d;color:white}'+
   '#to-ux-tecnico[open]>section.to-card{margin-top:12px}#to-salvas .to-muted{display:none}';
  root.appendChild(style);
  const overview=document.createElement('section');
  overview.className='to-card';
  overview.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">'+
   '<h3 style="margin:0">Operação da campanha</h3><span style="font-size:13px;color:#9a3412;font-weight:650">Envio oficial bloqueado</span></div>'+
   '<p data-ux="resumo" style="margin:12px 0"></p><div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">'+
   '<span class="to-etapa feita">1 · Selecionar</span><span class="to-etapa" data-ux="preparar">2 · Preparar</span>'+
   '<span class="to-etapa" data-ux="enviar">3 · Enviar e acompanhar</span></div>'+
   '<p class="to-muted" data-ux="orientacao"></p>'+
   '<button type="button" class="btn" data-ux="abrir">Controles administrativos e histórico</button> '+
   '<button type="button" class="btn" disabled title="Executor oficial ainda não disponível">Enviar mensagens — indisponível</button>';
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
    preparation.querySelector('h3').textContent='Preparação dos lotes';
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
      ' lotes preparados · '+rev+' revisado(s) · '+prev+' pré-aprovado(s).':
      d.length+' registros na lista da campanha. Nenhum lote oficial preparado para esta mensagem.';
    $('orientacao').textContent=listo?'A lista já está preparada. O envio real continuará indisponível até sua implementação e autorização específica. Não há necessidade de refazer simulações.':
      'Defina o tamanho do lote e use Preparar os lotes abaixo. Nenhuma mensagem será enviada.';
    const size=root.querySelector('#to-tamanho');
    if(size){size.disabled=listo;size.title=listo?'Lotes já congelados.':'Quantidade por lote';}
    if(preparation)preparation.hidden=!listo&&!d.length;
  }
  return {refresh};
}

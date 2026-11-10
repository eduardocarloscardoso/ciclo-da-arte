// Ciclo da Arte — lote de homologação, preparação/auditoria apenas.
// PROIBIDO enviar e-mails nesta função. Não importa Resend e não chama funções de envio.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,apikey,x-client-info,content-type","Access-Control-Allow-Methods":"POST,OPTIONS"};
const response=(obj:unknown,status=200)=>new Response(JSON.stringify(obj),{status,headers:{...cors,"Content-Type":"application/json"}});
Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(req.method!=="POST")return response({ok:false,erro:"Método não permitido."},405);
  const url=Deno.env.get("SUPABASE_URL")||"";
  const anon=Deno.env.get("SUPABASE_ANON_KEY")||"";
  const sk=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
  const bearer=req.headers.get("Authorization")||"";
  if(!url||!anon||!sk||!/^Bearer .+$/i.test(bearer))return response({ok:false,erro:"Autenticação indisponível."},401);
  // Validar identidade real na Auth, não confiar em nome ou UID enviado no JSON.
  const usuarioResp=await fetch(url+"/auth/v1/user",{headers:{apikey:anon,Authorization:bearer}}).catch(()=>null);
  if(!usuarioResp?.ok)return response({ok:false,erro:"Sessão inválida."},401);
  const usuario=await usuarioResp.json().catch(()=>null);
  if(!usuario?.id)return response({ok:false,erro:"Usuário não identificado."},401);
  const membro=await fetch(url+"/rest/v1/rpc/cda_e_membro_equipe",{method:"POST",headers:{apikey:anon,Authorization:bearer,"Content-Type":"application/json"},body:"{}"}).catch(()=>null);
  if(!membro?.ok||(await membro.json().catch(()=>false))!==true)return response({ok:false,erro:"Acesso restrito à equipe autorizada."},403);
  let body:Record<string,unknown>;
  try {body=await req.json();}catch{return response({ok:false,erro:"Dados inválidos."},400);}
  const campanha=Number(body.campanha_id),mensagem=Number(body.mensagem_id);
  const acao=String(body.acao||"status");
  if(!["status","preparar","interromper","retomar","validar","simular"].includes(acao))return response({ok:false,erro:"Operação não permitida."},400);
  if(!Number.isSafeInteger(campanha)||campanha<1||!Number.isSafeInteger(mensagem)||mensagem<1)
    return response({ok:false,erro:"Campanha e mensagem obrigatórias."},400);
  const h={apikey:sk,Authorization:"Bearer "+sk};
  // Escopo imutável: apenas modo homologação. Nenhum endpoint de disparo é exposto.
  const msg=await fetch(url+"/rest/v1/cda_campanha_mensagens?id=eq."+mensagem+"&campanha_id=eq."+campanha+"&select=id",{headers:h}).catch(()=>null);
  if(!msg?.ok)return response({ok:false,erro:"Falha ao validar mensagem."},503);
  if(!(await msg.json()).length)return response({ok:false,erro:"Mensagem não pertence à campanha."},404);
  let lote:null|Record<string,unknown>=null;
  if(acao==="preparar"){
    const r=await fetch(url+"/rest/v1/rpc/cda_preparar_lote_homologacao",{
      method:"POST",headers:{...h,"Content-Type":"application/json"},
      body:JSON.stringify({p_campanha_id:campanha,p_mensagem_id:mensagem,p_usuario:usuario.id})
    }).catch(()=>null);
    if(!r?.ok)return response({ok:false,erro:"Não foi possível preparar o lote. Nenhum envio realizado."},503);
  }
  const consulta=()=>fetch(url+"/rest/v1/cda_envio_lotes?campanha_id=eq."+campanha+"&mensagem_id=eq."+mensagem+"&modo=eq.homologacao&select=id,campanha_id,mensagem_id,situacao,criado_em,atualizado_em&limit=1",{headers:h});
  let r=await consulta().catch(()=>null);
  if(!r?.ok)return response({ok:false,erro:"Não foi possível consultar o lote."},503);
  lote=(await r.json())[0]||null;
  if(acao==="interromper" || acao==="retomar"){
    if(!lote)return response({ok:false,erro:"Lote ainda não preparado."},404);
    const ctl=await fetch(url+"/rest/v1/rpc/cda_controlar_lote_sem_envio",{
      method:"POST",headers:{...h,"Content-Type":"application/json"},
      body:JSON.stringify({p_lote_id:lote.id,p_acao:acao,p_usuario:usuario.id})
    }).catch(()=>null);
    if(!ctl?.ok)return response({ok:false,erro:"Não foi possível atualizar o controle do lote."},503);
    // Interromper revoga inclusive eventual aprovação ainda ativa.
    // Retomar não pode reutilizar permissão anterior.
    if(acao==="interromper"){
      const rev=await fetch(url+"/rest/v1/rpc/cda_revogar_lote_homologacao",{
        method:"POST",headers:{...h,"Content-Type":"application/json"},
        body:JSON.stringify({p_lote_id:lote.id})
      }).catch(()=>null);
      if(!rev?.ok)return response({ok:false,erro:"Lote interrompido, revogação requer revisão."},503);
    }
    r=await consulta().catch(()=>null);
    if(!r?.ok)return response({ok:false,erro:"Controle registrado, falha ao recarregar lote."},503);
    lote=(await r.json())[0]||null;
  }
  // Só pré-voo SQL. Esta função não possui caminho de envio ao Resend.
  let simulacao:null|Record<string,unknown>=null;
  if(acao==="simular" || acao==="status" || acao==="validar"){
    if(!lote)return response({ok:false,erro:"Prepare o lote antes da simulação."},404);
    const sim=await fetch(url+"/rest/v1/rpc/cda_simular_execucao_lote",{
      method:"POST",headers:{...h,"Content-Type":"application/json"},
      body:JSON.stringify({p_lote_id:lote.id})
    }).catch(()=>null);
    if(!sim?.ok)return response({ok:false,erro:"Não foi possível executar pré-voo sem envio."},503);
    simulacao=await sim.json().catch(()=>null);
    if(!simulacao)return response({ok:false,erro:"Resultado de simulação inválido."},503);
  }
  // Diagnóstico da trava física: consulta somente leitura.
  // Nunca expor nesta Edge Function um caminho para reivindicar itens ou enviar e-mails.
  let executor:null|Record<string,unknown>=null;
  if(lote){
    const diag=await fetch(url+"/rest/v1/rpc/cda_diagnosticar_executor_lote",{
      method:"POST",headers:{...h,"Content-Type":"application/json"},
      body:JSON.stringify({p_lote_id:lote.id})
    }).catch(()=>null);
    if(!diag?.ok)return response({ok:false,erro:"Diagnóstico de segurança indisponível. Envio permanece bloqueado."},503);
    executor=await diag.json().catch(()=>null);
    if(!executor||executor.trava_ativa!==true||executor.pode_enviar!==false)
      return response({ok:false,erro:"Estado da trava inesperado. Operação bloqueada."},503);
  }
  if(!lote)return response({ok:true,lote:null,itens:[],envio_habilitado:false});
  const itensResp=await fetch(url+"/rest/v1/cda_envio_lote_itens?lote_id=eq."+lote.id+"&select=id,nome,email,situacao,criado_em,atualizado_em,tentativa_id,resend_email_id,inicio_processamento_em,fim_processamento_em,aceito_em,entregue_em,ultimo_evento,erro&order=id.asc&limit=1000",{headers:h}).catch(()=>null);
  if(!itensResp?.ok)return response({ok:false,erro:"Lote criado; falha ao consultar destinatários."},503);
  const itens=await itensResp.json();
  // Apresenta a situação técnica de cada item sem reclassificar entrega como abertura.
  // Os eventos só serão vinculados quando cada item possuir tentativa_id auditada.
  // Pré-validação em modo leitura; NÃO equivale a autorização de envio.
  // Revalida estado vivo e supressões, sem editar o snapshot.
  const impedimentos:string[]=[];
  if(lote.situacao!=="preparado")impedimentos.push("Lote interrompido");
  if(!itens.length)impedimentos.push("Lote sem destinatários");
  if(itens.some((i:Record<string,unknown>)=>i.situacao!=="pendente"))
    impedimentos.push("Lote contém itens fora do estado pendente; revisar histórico antes de liberar");
  const liveResp=await fetch(url+"/rest/v1/cda_homologacao_destinatarios?campanha_id=eq."+campanha+"&ativo=eq.true&select=email&limit=1000",{headers:h}).catch(()=>null);
  if(!liveResp?.ok)return response({ok:false,erro:"Não foi possível validar destinatários ativos."},503);
  const ativos=new Set((await liveResp.json()).map((x:Record<string,unknown>)=>String(x.email||"").trim().toLowerCase()));
  const supResp=await fetch(url+"/rest/v1/cda_email_supressoes?select=email&limit=5000",{headers:h}).catch(()=>null);
  if(!supResp?.ok)return response({ok:false,erro:"Não foi possível validar supressões."},503);
  const suprimidos=new Set((await supResp.json()).map((x:Record<string,unknown>)=>String(x.email||"").trim().toLowerCase()));
  const irregular=itens.filter((i:Record<string,unknown>)=>!ativos.has(String(i.email||"").toLowerCase()));
  const suprimidosNoLote=itens.filter((i:Record<string,unknown>)=>suprimidos.has(String(i.email||"").toLowerCase()));
  if(irregular.length)impedimentos.push(irregular.length+" destinatário(s) não está(ão) mais ativo(s) na lista atual");
  if(suprimidosNoLote.length)impedimentos.push(suprimidosNoLote.length+" destinatário(s) presente(s) na lista de supressão");
  const auditResp=await fetch(url+"/rest/v1/cda_envio_lote_auditoria?lote_id=eq."+lote.id+"&select=id,acao,situacao_anterior,situacao_nova,ocorrido_em&order=id.desc&limit=20",{headers:h}).catch(()=>null);
  if(!auditResp?.ok)return response({ok:false,erro:"Não foi possível consultar auditoria."},503);
  const auditoria=await auditResp.json();
  const ids=itens.map((i:Record<string,unknown>)=>Number(i.tentativa_id)).filter((id:number)=>Number.isSafeInteger(id)&&id>0);
  const eventosPorTentativa=new Map<number,Record<string,unknown>[]>();
  if(ids.length){
    const evResp=await fetch(url+"/rest/v1/cda_email_eventos?tentativa_id=in.("+ids.join(",")+")&select=tentativa_id,tipo,ocorrido_em&order=ocorrido_em.asc&limit=2000",{headers:h}).catch(()=>null);
    if(!evResp?.ok)return response({ok:false,erro:"Falha ao consultar eventos técnicos."},503);
    for(const evento of await evResp.json()){
      const id=Number(evento.tentativa_id);
      eventosPorTentativa.set(id,[...(eventosPorTentativa.get(id)||[]),evento]);
    }
  }
  const prioridade=["email.complained","email.bounced","email.delivered","email.delivery_delayed"];
  const enriquecidos=itens.map((i:Record<string,unknown>)=>{
    const eventos=eventosPorTentativa.get(Number(i.tentativa_id))||[];
    const evento=prioridade.map(tipo=>eventos.filter(e=>e.tipo===tipo).at(-1)).find(Boolean);
    const situacao=evento ? ({
      "email.delivered":"entregue","email.bounced":"devolvido",
      "email.complained":"reclamacao","email.delivery_delayed":"atrasado"
    } as Record<string,string>)[String(evento.tipo)] : String(i.situacao);
    return {...i,situacao_observada:situacao,evento_tecnico:evento||null};
  });
  const contagens:Record<string,number>={pendente:0,processando:0,indeterminado:0,aceito:0,entregue:0,falha:0,devolvido:0,reclamacao:0,atrasado:0,bloqueado:0};
  for(const item of enriquecidos){
    const situacao=String(item.situacao_observada);
    contagens[situacao]=(contagens[situacao]||0)+1;
  }
  return response({ok:true,lote,itens:enriquecidos,quantidade:enriquecidos.length,
    contagens,processados:enriquecidos.length-(contagens.pendente||0)-(contagens.bloqueado||0),
    validacao:{consulta_concluida:true,sem_impedimentos:impedimentos.length===0,impedimentos,autorizado:false,
      observacao:"Pré-validação não autoriza disparos nem substitui análise de LGPD, idempotência Resend e liberação manual."},
    auditoria,simulacao,executor,
    envio_habilitado:false,
    aviso:"Rastreio em modo somente leitura. Nenhuma mensagem é enviada por esta função."});
});

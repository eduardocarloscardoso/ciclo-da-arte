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
  if(!["status","preparar","interromper"].includes(acao))return response({ok:false,erro:"Operação não permitida."},400);
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
  if(acao==="interromper"){
    if(!lote)return response({ok:false,erro:"Lote ainda não preparado."},404);
    if(lote.situacao==="preparado"){
      const upd=await fetch(url+"/rest/v1/cda_envio_lotes?id=eq."+lote.id+"&situacao=eq.preparado",{
        method:"PATCH",headers:{...h,"Content-Type":"application/json",Prefer:"return=representation"},
        body:JSON.stringify({situacao:"interrompido",atualizado_em:new Date().toISOString()})
      }).catch(()=>null);
      if(!upd?.ok)return response({ok:false,erro:"Não foi possível interromper."},503);
      r=await consulta();lote=(await r.json())[0]||null;
    }
  }
  if(!lote)return response({ok:true,lote:null,itens:[],envio_habilitado:false});
  const itensResp=await fetch(url+"/rest/v1/cda_envio_lote_itens?lote_id=eq."+lote.id+"&select=id,nome,email,situacao,criado_em&order=id.asc&limit=1000",{headers:h}).catch(()=>null);
  if(!itensResp?.ok)return response({ok:false,erro:"Lote criado; falha ao consultar destinatários."},503);
  const itens=await itensResp.json();
  return response({ok:true,lote,itens,quantidade:itens.length,envio_habilitado:false,
    aviso:"Operação de leitura/preparação: nenhum envio solicitado ao Resend."});
});

// Fase 1 — CONTRATO do executor de lote de homologação (SEM ENVIO).
// Nenhum cliente Resend, nenhuma requisição externa de email, nenhuma reivindicação.
// Contrato "enviar" devolve sempre 423. Somente "diagnosticar" consulta dados.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const cors={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization,apikey,x-client-info,content-type",
  "Access-Control-Allow-Methods":"POST,OPTIONS"
};
const reply=(obj:Record<string,unknown>,status=200)=>
  new Response(JSON.stringify(obj),{status,headers:{...cors,"Content-Type":"application/json"}});
Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(req.method!=="POST")return reply({ok:false,erro:"Método não permitido"},405);
  const url=Deno.env.get("SUPABASE_URL")||"";
  const anon=Deno.env.get("SUPABASE_ANON_KEY")||"";
  const sk=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
  const bearer=req.headers.get("Authorization")||"";
  if(!url||!anon||!sk||!/^Bearer .+$/i.test(bearer))
    return reply({ok:false,erro:"Autenticação indisponível"},401);
  const userReq=await fetch(url+"/auth/v1/user",{headers:{apikey:anon,Authorization:bearer}}).catch(()=>null);
  if(!userReq?.ok)return reply({ok:false,erro:"Sessão inválida"},401);
  const usuario=await userReq.json().catch(()=>null);
  if(!usuario?.id)return reply({ok:false,erro:"Usuário não identificado"},401);
  const membro=await fetch(url+"/rest/v1/rpc/cda_e_membro_equipe",{
    method:"POST",headers:{apikey:anon,Authorization:bearer,"Content-Type":"application/json"},body:"{}"
  }).catch(()=>null);
  if(!membro?.ok||(await membro.json().catch(()=>false))!==true)
    return reply({ok:false,erro:"Acesso restrito à equipe autorizada"},403);
  let body:Record<string,unknown>;
  try{body=await req.json()}catch{return reply({ok:false,erro:"Dados inválidos"},400)}
  const loteId=Number(body.lote_id),acao=String(body.acao||"diagnosticar");
  if(!Number.isSafeInteger(loteId)||loteId<1||!["diagnosticar","enviar"].includes(acao))
    return reply({ok:false,erro:"Ação ou lote inválido"},400);
  // BLOQUEIO IRREVOGÁVEL NESTA VERSÃO:
  // conferir apenas depois da autenticação, mas antes de acessar operações.
  if(acao==="enviar")
    return reply({ok:false,erro:"EXECUTOR_BLOQUEADO: autorização e envio ainda indisponíveis",envio_habilitado:false},423);
  const h={apikey:sk,Authorization:"Bearer "+sk,"Content-Type":"application/json"};
  const consultar=async(nome:string)=>{
    const res=await fetch(url+"/rest/v1/rpc/"+nome,{
      method:"POST",headers:h,body:JSON.stringify({p_lote_id:loteId})
    }).catch(()=>null);
    if(!res?.ok)throw new Error("Diagnóstico indisponível");
    return await res.json();
  };
  try{
    const [executor,diario]=await Promise.all([
      consultar("cda_diagnosticar_executor_lote"),
      consultar("cda_diagnosticar_diario_lote")
    ]);
    if(executor?.trava_ativa!==true||executor?.pode_enviar!==false||
       diario?.envio_habilitado!==false)
      return reply({ok:false,erro:"Diagnóstico de segurança inconsistente"},503);
    return reply({ok:true,executor,diario,envio_habilitado:false,envios_solicitados:0});
  }catch{
    return reply({ok:false,erro:"Não foi possível consultar o diário de segurança"},503);
  }
});

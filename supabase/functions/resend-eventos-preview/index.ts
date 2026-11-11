// Resend signed webhook receiver — Ciclo da Arte preview, nov/2026.
// Fail closed until RESEND_WEBHOOK_SECRET is configured in Supabase Edge Secrets.
// No mass sending; no client data modifications; accepts only events of known test attempts.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

function response(obj:Record<string,unknown>, status=200) {
  return new Response(JSON.stringify(obj),{status,headers:{"Content-Type":"application/json"}});
}
function constantTimeEqual(a:Uint8Array,b:Uint8Array):boolean {
  if(a.length!==b.length)return false;
  let diff=0;for(let i=0;i<a.length;i++)diff|=a[i]^b[i];return diff===0;
}
async function verificarAssinatura(req:Request, payload:string, secret:string):Promise<boolean> {
  const id=req.headers.get("svix-id");
  const timestamp=req.headers.get("svix-timestamp");
  const signatures=req.headers.get("svix-signature");
  if(!id||!timestamp||!signatures||!secret.startsWith("whsec_"))return false;
  if(!/^\d+$/.test(timestamp))return false;
  const secs=Number(timestamp);
  if(!Number.isSafeInteger(secs)||Math.abs(Date.now()/1000-secs)>300)return false;
  let keyBytes:Uint8Array;
  try { keyBytes=Uint8Array.from(atob(secret.slice(6)),c=>c.charCodeAt(0)); }
  catch { return false; }
  const key=await crypto.subtle.importKey("raw",keyBytes,{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const msg=new TextEncoder().encode(id+"."+timestamp+"."+payload);
  const valid=new Uint8Array(await crypto.subtle.sign("HMAC",key,msg));
  for (const item of signatures.trim().split(/\s+/)) {
    if(!item.startsWith("v1,"))continue;
    try {
      const candidate=Uint8Array.from(atob(item.slice(3)),c=>c.charCodeAt(0));
      if(constantTimeEqual(valid,candidate))return true;
    }catch {/* invalid signature candidate */}
  }
  return false;
}
const TIPOS=new Set(["email.delivered","email.bounced","email.delivery_delayed","email.complained"]);
Deno.serve(async(req:Request)=>{
  if(req.method!=="POST")return response({ok:false,erro:"Método não permitido"},405);
  let secret=Deno.env.get("RESEND_WEBHOOK_SECRET")||"";
  if (!secret) {
    // O segredo fica criptografado no Supabase Vault e nunca é enviado ao navegador.
    const url=Deno.env.get("SUPABASE_URL")||"";
    const sk=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
    if(url && sk) {
      const r=await fetch(url+"/rest/v1/rpc/cda_resend_webhook_secret_ler",{
        method:"POST",headers:{apikey:sk,Authorization:"Bearer "+sk,"Content-Type":"application/json"},body:"{}"
      }).catch(()=>null);
      if(r?.ok)secret=String((await r.json().catch(()=>""))||"");
    }
  }
  if(!secret)return response({ok:false,erro:"Webhook ainda não configurado."},503);
  const raw=await req.text();
  if(raw.length>100_000)return response({ok:false,erro:"Evento excede limite."},413);
  if(!(await verificarAssinatura(req,raw,secret)))return response({ok:false,erro:"Assinatura inválida ou expirada"},401);
  let event:Record<string,unknown>;
  try {event=JSON.parse(raw);}catch{return response({ok:false,erro:"JSON inválido"},400);}
  const type=String(event.type||"");
  if(!TIPOS.has(type))return response({ok:true,ignorado:true});
  const d=(event.data&&typeof event.data==="object")?event.data as Record<string,unknown>:{};
  const resendId=String(d.email_id||"");
  if(!/^[a-zA-Z0-9-]{8,128}$/.test(resendId))return response({ok:false,erro:"Identificador inválido"},400);
  const eventId=req.headers.get("svix-id")||"";
  const occurred=String(event.created_at||"");
  if(!occurred||Number.isNaN(Date.parse(occurred)))return response({ok:false,erro:"Data inválida"},400);
  const url=Deno.env.get("SUPABASE_URL")||"";
  const sk=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
  if(!url||!sk)return response({ok:false,erro:"Banco indisponível"},503);
  const headers={apikey:sk,Authorization:"Bearer "+sk};
  // Atribui apenas a testes existentes. Eventos de outras mensagens são ignorados.
  const lookup=await fetch(url+"/rest/v1/cda_email_tentativas?resend_email_id=eq."+encodeURIComponent(resendId)+"&select=id&limit=1",{headers});
  if(!lookup.ok)return response({ok:false,erro:"Falha na consulta de tentativa"},503);
  const existing=await lookup.json();
  const tentativa=existing[0];
  if(!tentativa?.id){
    // Transmissão Oficial (nov/2026): eventos de envios oficiais são conciliados
    // pela RPC dedicada; devolução e reclamação suprimem o endereço.
    const oficial=await fetch(url+"/rest/v1/rpc/cda_oficial_registrar_evento",{
      method:"POST",headers:{...headers,"Content-Type":"application/json"},
      body:JSON.stringify({p_svix_id:eventId,p_resend_email_id:resendId,p_tipo:type,
        p_ocorrido_em:new Date(occurred).toISOString()})
    }).catch(()=>null);
    if(!oficial?.ok)return response({ok:false,erro:"Falha na conciliação oficial"},503);
    const r=await oficial.json().catch(()=>({aplicado:false}));
    return response({ok:true,oficial:true,aplicado:r?.aplicado===true,motivo:r?.motivo||null});
  }
  const insert=await fetch(url+"/rest/v1/cda_email_eventos?on_conflict=svix_id",{
    method:"POST",headers:{...headers,"Content-Type":"application/json",Prefer:"resolution=ignore-duplicates,return=minimal"},
    body:JSON.stringify({tentativa_id:tentativa.id,svix_id:eventId,resend_email_id:resendId,tipo:type,ocorrido_em:new Date(occurred).toISOString()})
  });
  if(!insert.ok)return response({ok:false,erro:"Falha ao registrar evento"},503);
  // Somente após autenticação Svix e registro de evento.
  // A RPC correlaciona lote por tentativa + Resend ID. Testes antigos intocados.
  const sync=await fetch(url+"/rest/v1/rpc/cda_reconciliar_evento_lote",{
    method:"POST",headers:{...headers,"Content-Type":"application/json"},
    body:JSON.stringify({p_svix_id:eventId})
  }).catch(()=>null);
  if(!sync?.ok)return response({ok:false,erro:"Evento gravado, reconciliação pendente"},503);
  const lote=await sync.json().catch(()=>({aplicado:false}));
  return response({ok:true,registrado:true,lote_reconciliado:lote?.aplicado===true});
});
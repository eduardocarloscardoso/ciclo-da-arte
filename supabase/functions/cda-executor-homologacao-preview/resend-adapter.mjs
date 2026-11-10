// Adaptador de requisição única ao Resend — NÃO importado/executado pelo endpoint ativo.
// SÓ poderá ser ligado depois de autorização revisada para o lote de homologação.
// Exportações puras e injeção de fetch permitem teste sem contato ao Resend.
const EMAIL_ID=/^[a-zA-Z0-9-]{8,128}$/;
const UUID=/^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$/;
export function chaveIdempotenciaResend(chave) {
  if (typeof chave!=="string"||!UUID.test(chave))throw Error("Chave idempotente inválida");
  return "ciclo-homologacao/"+chave.toLowerCase();
}
export function classificarRespostaResend(status,data) {
  if(status>=200&&status<300){
    const id=typeof data?.id==="string"?data.id:"";
    return EMAIL_ID.test(id)
      ?{estado:"aceita",resend_email_id:id,http_status:status,erro:null}
      :{estado:"indeterminada",resend_email_id:null,http_status:status,
        erro:"Resend respondeu sucesso sem um identificador utilizável. Revisão manual necessária."};
  }
  // Resposta explicitamente recusada por parâmetros/autenticação: não repetir.
  // 409, 429, erros 5xx e demais respostas inesperadas: conservadoramente
  // indeterminados, pois o processamento no provedor pode ser desconhecido.
  const definitiva=[400,401,403,404,422].includes(status);
  return{estado:definitiva?"falha":"indeterminada",resend_email_id:null,
    http_status:status,erro:definitiva
      ?"Resend recusou a solicitação. Revisar parâmetros e credenciais."
      :"Resultado do provedor não conclusivo. Não reenviar automaticamente."};
}
export async function solicitarResendUmaVez({apiKey,payload,chave,fetchFn=fetch,timeoutMs=18000}){
  if(typeof apiKey!=="string"||apiKey.length<8)throw Error("Credencial Resend indisponível");
  if(!payload||typeof payload!=="object"||!Array.isArray(payload.to)||
     payload.to.length!==1||typeof payload.html!=="string"||
     !payload.html.trim()||typeof payload.subject!=="string"||
     !payload.subject.trim())throw Error("Payload Resend não validado");
  const key=chaveIdempotenciaResend(chave);
  if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1000||timeoutMs>30000)
     throw Error("Timeout inválido");
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const resp=await fetchFn("https://api.resend.com/emails",{
      method:"POST",
      headers:{"Authorization":"Bearer "+apiKey,"Content-Type":"application/json",
        "Idempotency-Key":key},
      body:JSON.stringify(payload),signal:controller.signal
    });
    const data=await resp.json().catch(()=>null);
    return classificarRespostaResend(resp.status,data);
  }catch(e){
    // Erro de rede/timeout é AMBÍGUO: o pedido pode ter chegado ao provedor.
    return{estado:"indeterminada",resend_email_id:null,http_status:null,
      erro:"Falha ou timeout na comunicação. Consultar o Resend antes de qualquer nova tentativa."};
  }finally{
    clearTimeout(timeout);
  }
}

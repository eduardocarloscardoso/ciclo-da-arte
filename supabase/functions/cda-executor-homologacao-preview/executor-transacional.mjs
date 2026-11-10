// Executor transacional para homologação. NÃO está exposto pelo endpoint ativo.
// Injetar somente componentes do servidor; jamais chaves/API recebidas do navegador.
// Intencionalmente sem loops e sem retries. Uma execução processa um único item.
import { solicitarResendUmaVez } from "./resend-adapter.mjs";

const HASH=/^[0-9a-f]{64}$/;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function validarEnvelopeLote({loteId,itemId,payload,chave,sha256}) {
  if(!Number.isSafeInteger(loteId)||loteId<1||
    !Number.isSafeInteger(itemId)||itemId<1||
    !HASH.test(sha256)||!UUID.test(chave||""))throw Error("Envelope inválido");
  if(!payload||!Array.isArray(payload.to)||payload.to.length!==1||
    !EMAIL.test(payload.to[0])||
    !String(payload.from||"").includes("@send.ciclodaarte.com.br")||
    !String(payload.subject||"").startsWith("[TESTE] ")||
    !String(payload.html||"").trim()||!String(payload.text||"").trim()){
    throw Error("Payload de homologação inválido");
  }
}
export async function sha256Json(payload) {
  const bytes=new Uint8Array(await crypto.subtle.digest("SHA-256",
    new TextEncoder().encode(JSON.stringify(payload))));
  return Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("");
}

// A autorização deve ser consultada novamente no banco em cada passagem.
// As RPCs são service_role-only e bloqueadas por constraints enquanto pendentes.
export async function executarItemHomologacaoBloqueado({
  loteId,itemId,payload,chave,sha256,apiKey,store,transmitir=solicitarResendUmaVez
}) {
  validarEnvelopeLote({loteId,itemId,payload,chave,sha256});
  if(typeof store?.autorizar!=="function"||typeof store?.reservar!=="function"||
    typeof store?.marcarSolicitacao!=="function"||typeof store?.concluir!=="function"){
    throw Error("Adaptador transacional incompleto");
  }
  if((await sha256Json(payload))!==sha256)throw Error("Payload modificado depois da conferência");
  // Fail closed. A permissão do banco não existe nesta versão.
  const autorizacao=await store.autorizar(loteId);
  if(autorizacao?.habilitado!==true||autorizacao?.autorizado!==true||
     autorizacao?.modo!=="homologacao"||autorizacao?.lote_id!==loteId)
    return{estado:"bloqueado",item_id:itemId,enviou:false};

  // Uma reserva definitiva por item. Se a transação falhar, zero chamadas Resend.
  const reserva=await store.reservar(loteId,itemId,sha256);
  if(reserva?.item_id!==itemId||reserva?.payload_sha256!==sha256||
     reserva?.chave_idempotencia!==chave||!reserva?.tentativa_id)
    throw Error("Reserva inconsistente — envio não iniciado");

  // A RPC usa locks e revalida autorização, pausa e supressão.
  // O estado 'solicitada' é definitivo e NUNCA deve ser retomado automaticamente.
  const marco=await store.marcarSolicitacao(loteId,itemId,sha256);
  if(marco?.solicitada!==true||marco?.chave_idempotencia!==chave)
    throw Error("Solicitação não autorizada — envio não iniciado");

  // A partir daqui, qualquer erro de rede é INDETERMINADO. Jamais repetir.
  let resultado;
  try{
    resultado=await transmitir({apiKey,payload,chave});
  }catch{
    resultado={estado:"indeterminada",resend_email_id:null,
      erro:"Exceção no adaptador — consultar provedor, sem reenvio"};
  }
  if(!["aceita","falha","indeterminada"].includes(resultado?.estado))
    resultado={estado:"indeterminada",resend_email_id:null,
      erro:"Resposta inesperada — consultar provedor, sem reenvio"};
  try{
    await store.concluir(loteId,itemId,resultado.estado,
      resultado.resend_email_id||null,resultado.erro||null);
  }catch{
    // Persistência falhou após início do HTTP: nunca repetir e sinalizar revisão.
    return{estado:"revisao_manual",item_id:itemId,enviou:resultado.estado==="aceita",
      reenvio_automatico:false};
  }
  return{estado:resultado.estado,item_id:itemId,
    aceito:resultado.estado==="aceita",reenvio_automatico:false};
}

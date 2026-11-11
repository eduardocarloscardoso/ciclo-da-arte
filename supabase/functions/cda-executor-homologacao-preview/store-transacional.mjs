// Adaptador de persistência transacional do lote, exclusivamente server-side.
// Este módulo NÃO recebe service_role do navegador e NÃO é acionado por 'enviar'.
// O banco mantém CHECK habilitado=false e autorização nula.
export function criarStoreTransacional({supabaseUrl,serviceRoleKey,fetchFn=fetch}) {
  if(typeof supabaseUrl!=="string"||!/^https:\/\/[^/]+\.supabase\.co$/.test(supabaseUrl))
    throw Error("URL Supabase inválida");
  if(typeof serviceRoleKey!=="string"||serviceRoleKey.length<20)
    throw Error("Credencial de serviço indisponível");
  const rpc=async(nome,body)=>{
    const resp=await fetchFn(supabaseUrl+"/rest/v1/rpc/"+nome,{
      method:"POST",
      headers:{apikey:serviceRoleKey,Authorization:"Bearer "+serviceRoleKey,
        "Content-Type":"application/json"},
      body:JSON.stringify(body)
    });
    if(!resp.ok)throw Error("Operação transacional indisponível: "+nome);
    return await resp.json();
  };
  return Object.freeze({
    async autorizar(loteId){
      // Estado read-only do lote: falta de autorização é falha fechada.
      const info=await rpc("cda_resumo_preenvio_homologacao",{p_lote_id:loteId});
      return Object.freeze({
        lote_id:Number(info?.lote_id),modo:info?.modo,
        habilitado:info?.envio_habilitado===true,
        autorizado:info?.autorizado===true,
        total:Number(info?.total||0),
        pendentes:Number(info?.pendentes||0),
        tem_operacoes:info?.tem_operacoes===true
      });
    },
    reservar(loteId,itemId,sha256){
      return rpc("cda_reservar_tentativa_lote",{
        p_lote_id:loteId,p_item_id:itemId,p_payload_sha256:sha256});
    },
    marcarSolicitacao(loteId,itemId,sha256){
      return rpc("cda_marcar_solicitacao_lote",{
        p_lote_id:loteId,p_item_id:itemId,p_payload_sha256:sha256});
    },
    concluir(loteId,itemId,estado,resendId,erro){
      return rpc("cda_concluir_tentativa_lote",{
        p_lote_id:loteId,p_item_id:itemId,p_resultado:estado,
        p_resend_email_id:resendId,p_erro:erro});
    }
  });
}

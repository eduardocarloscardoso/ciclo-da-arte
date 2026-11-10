// Montagem do envelope individual a partir do banco. Proibido aceitar payload do navegador.
const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const n=s=>String(s||"").trim().toLowerCase();
export async function prepararEnvelopeHomologacao({
  url,serviceRoleKey,loteId,itemId,montar
}){
 if(!Number.isSafeInteger(loteId)||loteId<1||!Number.isSafeInteger(itemId)||itemId<1||
   typeof montar!=="function")throw Error("Identificadores inválidos");
 const headers={apikey:serviceRoleKey,Authorization:"Bearer "+serviceRoleKey};
 const fetchRows=async(path)=>{
   const resp=await fetch(url+"/rest/v1/"+path,{headers});
   if(!resp.ok)throw Error("Fonte da mensagem indisponível");
   return await resp.json();
 };
 const lotes=await fetchRows("cda_envio_lotes?id=eq."+loteId+
   "&modo=eq.homologacao&select=id,campanha_id,mensagem_id,situacao&limit=1");
 const lote=lotes[0];
 if(!lote||lote.situacao!=="preparado")throw Error("Lote indisponível");
 const [itens,mensagens,campanhas,ativos,supressoes,operacoes]=await Promise.all([
  fetchRows("cda_envio_lote_itens?id=eq."+itemId+"&lote_id=eq."+loteId+
   "&select=id,nome,email,situacao,chave_idempotencia,tentativa_id,resend_email_id,inicio_processamento_em&limit=1"),
  fetchRows("cda_campanha_mensagens?id=eq."+lote.mensagem_id+
   "&campanha_id=eq."+lote.campanha_id+
   "&select=id,assunto,previa,conteudo,remetente_nome,remetente_email,responder_para&limit=1"),
  fetchRows("cda_campanhas?id=eq."+lote.campanha_id+"&select=id,nome&limit=1"),
  fetchRows("cda_homologacao_destinatarios?campanha_id=eq."+lote.campanha_id+
   "&ativo=eq.true&select=email&limit=1000"),
  fetchRows("cda_email_supressoes?select=email&limit=5000"),
  fetchRows("cda_envio_lote_operacoes?item_id=eq."+itemId+"&select=id&limit=1")
 ]);
 const item=itens[0],msg=mensagens[0],camp=campanhas[0];
 if(!item||!msg||!camp)throw Error("Item, campanha ou mensagem indisponível");
 const email=n(item.email),from=n(msg.remetente_email),reply=n(msg.responder_para);
 if(!EMAIL.test(email)||!EMAIL.test(from)||!EMAIL.test(reply)||
   !from.endsWith("@send.ciclodaarte.com.br"))
   throw Error("E-mail ou remetente inválido");
 if(item.situacao!=="pendente"||item.tentativa_id||item.resend_email_id||
   item.inicio_processamento_em||!item.chave_idempotencia||operacoes.length)
   throw Error("Item já utilizado ou indisponível");
 if(!ativos.some(x=>n(x.email)===email)||
   supressoes.some(x=>n(x.email)===email))
   throw Error("Destinatário inativo ou suprimido");
 const conteudo=msg.conteudo||{};
 if(!String(msg.assunto||"").trim()||!String(conteudo.texto||"").trim()||
   !/^https:\/\/[^\s]+$/i.test(String(conteudo.botaoLink||"").trim()))
   throw Error("Conteúdo ou link da mensagem inválido");
 const render=montar({nome:camp.nome,emailConteudo:conteudo,
   emailAssunto:msg.assunto,emailPrevia:msg.previa},{nome:item.nome},{});
 if(render.assunto!==msg.assunto||!render.html||!render.texto)
   throw Error("Montagem da mensagem inconsistente");
 const payload={
   from:msg.remetente_nome?String(msg.remetente_nome).trim()+" <"+from+">":from,
   to:[email],subject:"[TESTE] "+render.assunto,
   html:render.html,text:render.texto,reply_to:reply,
   tags:[{name:"mensagem_id",value:String(msg.id)},{name:"tipo",value:"teste"}]
 };
 return {payload,chave:String(item.chave_idempotencia),itemId:Number(item.id)};
}

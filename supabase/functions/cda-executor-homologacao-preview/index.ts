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
  if(!Number.isSafeInteger(loteId)||loteId<1||!["diagnosticar","conferir_conteudo","enviar"].includes(acao))
    return reply({ok:false,erro:"Ação ou lote inválido"},400);
  // BLOQUEIO IRREVOGÁVEL NESTA VERSÃO:
  // conferir apenas depois da autenticação, mas antes de acessar operações.
  if(acao==="enviar")
    return reply({ok:false,erro:"EXECUTOR_BLOQUEADO: autorização e envio ainda indisponíveis",envio_habilitado:false},423);
  const h={apikey:sk,Authorization:"Bearer "+sk,"Content-Type":"application/json"};
  // Conferência sem side effects da mensagem e dos destinatários congelados.
  // Não gera HTML definitivo nem autoriza a execução. Os dados vêm EXCLUSIVAMENTE
  // do Supabase; assunto, destinatários e conteúdo jamais são aceitos do navegador.
  if(acao==="conferir_conteudo"){
    const fetchRows=async(path:string)=>{
      const res=await fetch(url+"/rest/v1/"+path,{headers:h}).catch(()=>null);
      if(!res?.ok)throw new Error("Consulta indisponível");
      return await res.json();
    };
    try{
      const lotes=await fetchRows("cda_envio_lotes?id=eq."+loteId+"&modo=eq.homologacao&select=id,campanha_id,mensagem_id,situacao&limit=1");
      const lote=lotes[0];
      if(!lote)return reply({ok:false,erro:"Lote de homologação não encontrado"},404);
      const [mensagens,itens,origens,suprimidos,operacoes]=await Promise.all([
        fetchRows("cda_campanha_mensagens?id=eq."+lote.mensagem_id+"&campanha_id=eq."+lote.campanha_id+"&select=id,nome,assunto,remetente_email,responder_para,conteudo,atualizado_em&limit=1"),
        fetchRows("cda_envio_lote_itens?lote_id=eq."+loteId+"&select=id,pessoa_id,nome,email,situacao,chave_idempotencia,tentativa_id,resend_email_id&order=id.asc&limit=1000"),
        fetchRows("cda_homologacao_destinatarios?campanha_id=eq."+lote.campanha_id+"&ativo=eq.true&select=email&limit=1000"),
        fetchRows("cda_email_supressoes?select=email&limit=5000"),
        fetchRows("cda_envio_lote_operacoes?lote_id=eq."+loteId+"&select=item_id,chave_idempotencia,estado&limit=1000")
      ]);
      const msg=mensagens[0],issues:string[]=[];
      if(!msg)issues.push("Mensagem não encontrada na campanha");
      const c=msg?.conteudo&&typeof msg.conteudo==="object"?msg.conteudo:{};
      const assunto=String(msg?.assunto||"").trim();
      const remetente=String(msg?.remetente_email||"").trim().toLowerCase();
      const resposta=String(msg?.responder_para||"").trim().toLowerCase();
      const mail=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if(!assunto)issues.push("Assunto ausente");
      if(!mail.test(remetente)||!remetente.endsWith("@send.ciclodaarte.com.br"))
        issues.push("Remetente fora do domínio autorizado");
      if(!mail.test(resposta))issues.push("Responder para inválido");
      if(!String(c.texto||"").trim())issues.push("Corpo da mensagem ausente");
      const link=String(c.botaoLink||"").trim();
      if(!/^https:\/\/[^\s]+$/i.test(link))issues.push("Link de ação inválido ou não HTTPS");
      // Decisão recuperada de 09–10/11/2026: para a lista interna de
      // homologação o descadastramento não é requisito bloqueante nesta etapa.
      // O fallback '#descadastrar' continua uma pendência do fluxo comercial,
      // que deve ser revista antes de liberar o modo oficial.
      // A supressão de endereços continua sendo verificada logo abaixo.
      if(lote.situacao!=="preparado")issues.push("Lote não está preparado");
      const normalize=(v:unknown)=>String(v||"").trim().toLowerCase();
      const ativos=new Set(origens.map((i:Record<string,unknown>)=>normalize(i.email)));
      const sup=new Set(suprimidos.map((i:Record<string,unknown>)=>normalize(i.email)));
      // Impressão digital somente leitura: prende o rascunho ao item e à versão
      // da mensagem, sem reservar item nem criar histórico de tentativa.
      // NÃO é o hash final do HTML/JSON enviado ao Resend.
      const canonical=(value:unknown):unknown=>{
        if(Array.isArray(value))return value.map(canonical);
        if(value&&typeof value==="object")
          return Object.fromEntries(Object.entries(value as Record<string,unknown>)
            .sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,canonical(v)]));
        return value;
      };
      const digest=async(data:unknown)=>{
        const raw=new TextEncoder().encode(JSON.stringify(canonical(data)));
        const bytes=new Uint8Array(await crypto.subtle.digest("SHA-256",raw));
        return Array.from(bytes,x=>x.toString(16).padStart(2,"0")).join("");
      };
      const operados=new Set(operacoes.map((o:Record<string,unknown>)=>String(o.item_id)));
      const fingerprints:Array<{item_id:number;chave_idempotencia:string;rascunho_sha256:string}>=[];
      const enderecos=new Set<string>();let aptos=0,ignorar=0;
      for(const item of itens){
        const email=normalize(item.email);
        const valido=mail.test(email);
        const unico=!enderecos.has(email);enderecos.add(email);
        const apto=valido&&unico&&ativos.has(email)&&!sup.has(email)&&item.situacao==="pendente"&&
          !item.tentativa_id&&!item.resend_email_id&&!!item.chave_idempotencia&&
          !operados.has(String(item.id));
        if(apto){
          aptos++;
          fingerprints.push({
            item_id:Number(item.id),chave_idempotencia:String(item.chave_idempotencia),
            rascunho_sha256:await digest({
              tipo:"homologacao_preview_rascunho_v1",lote_id:loteId,item_id:item.id,
              chave_idempotencia:item.chave_idempotencia,email,nome:item.nome,
              mensagem_id:msg?.id,atualizado_em:msg?.atualizado_em,
              assunto:msg?.assunto,remetente_email:msg?.remetente_email,
              responder_para:msg?.responder_para,conteudo:c
            })
          });
        }else ignorar++;
      }
      if(!itens.length)issues.push("Lote sem destinatários");
      if(ignorar)issues.push(ignorar+" destinatários exigem revisão de elegibilidade");
      if(itens.length>1000)issues.push("Limite de conferência excedido");
      return reply({ok:true,lote_id:loteId,campanha_id:lote.campanha_id,mensagem_id:lote.mensagem_id,
        assunto,remetente,quantidade:itens.length,elegiveis:aptos,em_revisao:ignorar,
        conteudo_presente:!!String(c.texto||"").trim(),
        url_acao_https:/^https:\/\//i.test(link),
        descadastro_funcional:false,conteudo_conferido_sem_descadastro:issues.length===0,
        integridade_diario:operacoes.length===0?"sem_operacoes":operacoes.length+" operações previamente registradas",
        impressao_digital:"rascunho_de_conteudo_nao_payload_final",
        fingerprints,pronto_para_envio:false,envio_habilitado:false,
        bloqueios:issues,envios_solicitados:0});
    }catch{
      return reply({ok:false,erro:"Falha na conferência, execução permanece bloqueada"},503);
    }
  }
  const consultar=async(nome:string)=>{
    const res=await fetch(url+"/rest/v1/rpc/"+nome,{
      method:"POST",headers:h,body:JSON.stringify({p_lote_id:loteId})
    }).catch(()=>null);
    if(!res?.ok)throw new Error("Diagnóstico indisponível");
    return await res.json();
  };
  try{
    const [executor,diario,integridade]=await Promise.all([
      consultar("cda_diagnosticar_executor_lote"),
      consultar("cda_diagnosticar_diario_lote"),
      consultar("cda_auditar_integridade_lote")
    ]);
    if(executor?.trava_ativa!==true||executor?.pode_enviar!==false||
       diario?.envio_habilitado!==false||integridade?.envio_habilitado!==false||
       integridade?.chaves_consistentes!==true)
      return reply({ok:false,erro:"Diagnóstico de segurança inconsistente"},503);
    return reply({ok:true,executor,diario,integridade,envio_habilitado:false,envios_solicitados:0});
  }catch{
    return reply({ok:false,erro:"Não foi possível consultar o diário de segurança"},503);
  }
});

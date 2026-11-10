// @ts-nocheck
// A lógica de renderização abaixo é cópia fiel das funções já homologadas
// em cda-dados-compartilhados.js; o retorno nunca é enviado ao Resend.
// Fase 1 — CONTRATO do executor de lote de homologação (SEM ENVIO).
// Nenhum cliente Resend, nenhuma requisição externa de email, nenhuma reivindicação.
// Contrato "enviar" devolve sempre 423. Somente "diagnosticar" consulta dados.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { executarItemHomologacaoBloqueado, sha256Json } from "./executor-transacional.mjs";
function cdaPrimeiroNome(nome) {
  const p = String(nome || '').trim().split(/\s+/)[0] || '';
  return p ? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() : '';
}

function cdaUfDe(cliente) { return String((cliente && cliente.estado) || '').trim().toUpperCase(); }

function cdaVariaveisEmail(texto, cliente) {
  const c = cliente || {};
  const nome = cdaPrimeiroNome(c.nome) || 'cliente';
  return String(texto || '')
    .replace(/\{nome\}/g, nome).replace(/\{nome_completo\}/g, (c.nome || nome).trim())
    .replace(/\{cidade\}/g, c.cidade || '').replace(/\{uf\}/g, cdaUfDe(c));
}

function cdaLinkComUtm(link, campanha) {
  if (!link) return '';
  try {
    const u = new URL(link);
    const slug = String((campanha && campanha.nome) || 'campanha').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    if (!u.searchParams.has('utm_source')) u.searchParams.set('utm_source', 'ciclodarte');
    if (!u.searchParams.has('utm_medium')) u.searchParams.set('utm_medium', 'email');
    if (!u.searchParams.has('utm_campaign')) u.searchParams.set('utm_campaign', slug);
    return u.toString();
  } catch (e) { return link; }
}

function cdaMontarEmailCampanha(campanha, cliente, opts) {
  opts = opts || {};
  const k = (campanha && campanha.emailConteudo) || {};
  const esc = t => String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const v = t => cdaVariaveisEmail(t, cliente);
  // texto livre → parágrafos (linha em branco) e quebras de linha
  const paragrafos = (t, estilo) => v(t).split(/\n\s*\n/).map(p => p.trim()).filter(Boolean)
    .map(p => '<p style="' + estilo + '">' + esc(p).replace(/\n/g, '<br>') + '</p>').join('');
  const fonte = "font-family:Arial,Helvetica,sans-serif;";
  const pTxt = fonte + 'margin:0 0 14px;font-size:16px;line-height:1.55;color:#1a1a1a;';
  const link = cdaLinkComUtm(k.botaoLink, campanha);
  const descadastro = opts.linkDescadastro || '#descadastrar';
  // Links institucionais verificados. Únicos para todas as mensagens atuais,
  // inclusive as já salvas; não altera conteúdos, testes nem o Reply-To.
  const siteCiclo = 'https://www.ciclodaarte.com.br/';
  const redesCiclo = 'https://linktr.ee/ciclo_arte';
  const assunto = v((campanha && campanha.emailAssunto) || '');
  const previa = v((campanha && campanha.emailPrevia) || '');
  const sacEmail = String(k.sacEmail || '').trim();
  const sacTel = String(k.sacTelefone || '').trim();
  const linkSacEmail = sacEmail ? 'mailto:' + sacEmail : '';
  // Botão "à prova de Outlook": cor de fundo na célula (bgcolor) e cor do texto repetida no <span>
  const botao = (href, texto, cor, tam, pad) => '<table role="presentation" cellpadding="0" cellspacing="0" style="display:inline-table;margin:4px;"><tr><td bgcolor="' + cor + '" style="background:' + cor + ';border-radius:4px;mso-padding-alt:' + pad + ';">' +
    '<a href="' + esc(href) + '"' + (String(href).indexOf('mailto:') === 0 ? '' : ' target="_blank"') + ' style="display:inline-block;padding:' + pad + ';' + fonte + 'font-size:' + tam + 'px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:4px;"><span style="color:#ffffff;">' + texto + '</span></a></td></tr></table>';
  const digitosTel = sacTel.replace(/\D/g, '');
  const linkWhats = digitosTel.length >= 10 ? 'https://wa.me/' + (digitosTel.length <= 11 ? '55' : '') + digitosTel : '';
  const html = '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc(assunto) + '</title></head>' +
    '<body style="margin:0;padding:0;background:#f2efe9;">' +
    '<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">' + esc(previa) + '&#847;&zwnj;&nbsp;'.repeat(30) + '</div>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2efe9;"><tr><td align="center" style="padding:24px 12px;">' +
    '<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;">' +
      '<tr><td style="background:#1a1a1a;padding:14px 24px;' + fonte + 'font-size:13px;letter-spacing:3px;color:#ffffff;font-weight:bold;">CICLO DA ARTE</td></tr>' +
      (k.imagemUrl ? '<tr><td><a href="' + esc(link || '#') + '"><img src="' + esc(k.imagemUrl) + '" width="600" alt="' + esc(v(k.imagemAlt || k.titulo || '')) + '" style="display:block;width:100%;max-width:600px;height:auto;border:0;"></a></td></tr>' : '') +
      '<tr><td style="padding:28px 32px 8px;">' +
        (k.titulo ? '<h1 style="' + fonte + 'margin:0 0 16px;font-size:24px;line-height:1.25;color:#1a1a1a;">' + esc(v(k.titulo)) + '</h1>' : '') +
        (k.saudacao ? paragrafos(k.saudacao, pTxt) : '') +
        (k.texto ? paragrafos(k.texto, pTxt) : '') +
      '</td></tr>' +
      (k.cupomCodigo ? '<tr><td align="center" style="padding:6px 32px 18px;"><table role="presentation" cellpadding="0" cellspacing="0" style="border:2px dashed #c0392b;"><tr><td align="center" style="padding:14px 28px;' + fonte + '">' +
        '<div style="font-size:12px;letter-spacing:2px;color:#c0392b;font-weight:bold;">CUPOM</div>' +
        '<div style="font-size:28px;letter-spacing:3px;color:#1a1a1a;font-weight:bold;">' + esc(k.cupomCodigo) + '</div>' +
        (k.cupomTexto ? '<div style="font-size:14px;color:#444;margin-top:4px;">' + esc(v(k.cupomTexto)) + '</div>' : '') +
        '</td></tr></table></td></tr>' : '') +
      (link && k.botaoTexto ? '<tr><td align="center" style="padding:4px 32px 26px;">' + botao(link, esc(v(k.botaoTexto)), '#c0392b', 16, '15px 30px') + '</td></tr>' : '') +
      (k.infoTexto ? '<tr><td style="padding:0 32px 26px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f4ee;"><tr><td style="padding:18px 20px;' + fonte + '">' +
        (k.infoTitulo ? '<div style="font-size:15px;font-weight:bold;color:#1a1a1a;margin-bottom:8px;">' + esc(v(k.infoTitulo)) + '</div>' : '') +
        '<div style="font-size:14px;line-height:1.6;color:#333;">' + esc(v(k.infoTexto)).replace(/\n/g, '<br>') + '</div></td></tr></table></td></tr>' : '') +
      // Fale Conosco · SAC (nov/2026): telefone/e-mail visíveis + botões que abrem o e-mail e o WhatsApp do cliente
      (sacEmail || sacTel ? '<tr><td style="padding:0 32px 26px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e1d8;"><tr><td align="center" style="padding:18px 20px;' + fonte + '">' +
        '<div style="font-size:15px;font-weight:bold;color:#1a1a1a;margin-bottom:6px;">' + esc(v(k.sacTitulo || 'Fale Conosco · SAC')) + '</div>' +
        '<div style="font-size:14px;line-height:1.7;color:#333;margin-bottom:12px;">' +
          (sacTel ? '📞 ' + esc(sacTel) : '') + (sacTel && sacEmail ? '<br>' : '') +
          (sacEmail ? '✉ <a href="mailto:' + esc(sacEmail) + '" style="color:#333;">' + esc(sacEmail) + '</a>' : '') + '</div>' +
        // Uma única linha de tabela, com uma célula por botão: evita empilhamento no Outlook desktop.
        (sacEmail || linkWhats ? '<table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="margin:8px auto 0;border-collapse:collapse;"><tr>' +
          (sacEmail ? '<td align="center" valign="middle" style="padding:0 5px;white-space:nowrap;">' +
            botao(linkSacEmail, '✉ Enviar e-mail', '#2f6fb3', 14, '11px 20px') + '</td>' : '') +
          (linkWhats ? '<td align="center" valign="middle" style="padding:0 5px;white-space:nowrap;">' +
            botao(linkWhats, '💬 WhatsApp', '#1f8a4c', 14, '11px 20px') + '</td>' : '') +
          '</tr></table>' : '') +
        '</td></tr></table></td></tr>' : '') +
      '<tr><td style="padding:18px 32px 26px;border-top:1px solid #e5e1d8;' + fonte + 'font-size:12px;line-height:1.6;color:#777;">' +
        esc(v(k.rodape || '')).replace(/\n/g, '<br>') +
        '<br><br><b style="color:#444">Acompanhe a Ciclo da Arte</b>' +
        '<br>Site oficial: <a href="' + esc(siteCiclo) + '" target="_blank" style="color:#555;text-decoration:underline">www.ciclodaarte.com.br</a>' +
        '<br>Redes sociais e novidades: <a href="' + esc(redesCiclo) + '" target="_blank" style="color:#555;text-decoration:underline">Ciclo da Arte · redes sociais</a>' +
        '<br><br><a href="' + esc(descadastro) + '" style="color:#777;">Não quero mais receber estes e-mails</a></td></tr>' +
    '</table></td></tr></table></body></html>';
  const texto = [assunto, '', v(k.titulo), '', v(k.saudacao), '', v(k.texto), '',
    k.cupomCodigo ? 'CUPOM: ' + k.cupomCodigo + (k.cupomTexto ? ' — ' + v(k.cupomTexto) : '') : '',
    link ? (v(k.botaoTexto) || 'Saiba mais') + ': ' + link : '', '', v(k.infoTitulo), v(k.infoTexto), '',
    (sacEmail || sacTel) ? v(k.sacTitulo || 'Fale Conosco · SAC') : '', sacTel ? 'Telefone/WhatsApp: ' + sacTel : '', sacEmail ? 'E-mail: ' + sacEmail : '', '', v(k.rodape),
    '', 'Site oficial: ' + siteCiclo, 'Redes sociais e novidades: ' + redesCiclo,
    'Para não receber mais: ' + descadastro].filter((l, i, a) => !(l === '' && a[i - 1] === '')).join('\n');
  return { assunto: assunto, previa: previa, html: html, texto: texto };
}

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
  if(!Number.isSafeInteger(loteId)||loteId<1||!["diagnosticar","conferir_conteudo","conferir_payload","simular_orquestracao","enviar"].includes(acao))
    return reply({ok:false,erro:"Ação ou lote inválido"},400);
  // BLOQUEIO IRREVOGÁVEL NESTA VERSÃO:
  // conferir apenas depois da autenticação, mas antes de acessar operações.
  if(acao==="enviar")
    return reply({ok:false,erro:"EXECUTOR_BLOQUEADO: autorização e envio ainda indisponíveis",envio_habilitado:false},423);
  // Simulação EXCLUSIVAMENTE sintética: sem dados da campanha, sem SQL de
  // escrita e com adaptadores que lançam se alguém tentar reservar ou enviar.
  if(acao==="simular_orquestracao"){
    const dummy={
      from:"Ciclo da Arte <noreply@send.ciclodaarte.com.br>",
      to:["nao-enviar@example.invalid"],subject:"[TESTE] Simulacao bloqueada",
      html:"<p>Simulacao interna sem envio.</p>",text:"Simulacao interna sem envio."
    };
    const sha=await sha256Json(dummy);
    const negar=async()=>{throw new Error("SIMULACAO: qualquer gravação ou transmissão é proibida");};
    try{
      const resultado=await executarItemHomologacaoBloqueado({
        loteId,itemId:1,payload:dummy,sha256:sha,
        chave:"00000000-0000-4000-8000-000000000001",
        apiKey:"NAO_EXISTE_CHAVE_REAL",
        store:{autorizar:async()=>({
          habilitado:false,autorizado:false,modo:"homologacao",lote_id:loteId
        }),reservar:negar,marcarSolicitacao:negar,concluir:negar},
        transmitir:negar
      });
      if(resultado.estado!=="bloqueado")return reply({ok:false,erro:"Simulação inconsistente"},503);
      return reply({ok:true,estado:"bloqueado",envio_habilitado:false,
        envios_solicitados:0,operacoes_criadas:0,modo:"simulacao_sintetica"});
    }catch{
      return reply({ok:false,erro:"Simulação falhou sem efetuar envios"},503);
    }
  }
  const h={apikey:sk,Authorization:"Bearer "+sk,"Content-Type":"application/json"};
  // Gera a composição FINAL de HTML e texto em memória usando EXATAMENTE
  // o montador aprovado no navegador. Não escreve na base nem chama o Resend.
  // Os dados vêm do banco, nunca de campos de email enviados no request.
  if(acao==="conferir_payload"){
    const rows=async(path)=>{
      const r=await fetch(url+"/rest/v1/"+path,{headers:h}).catch(()=>null);
      if(!r?.ok)throw Error("Consulta indisponível");
      return await r.json();
    };
    const hash=async(input)=>{
      const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(input));
      return Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,"0")).join("");
    };
    const normal=e=>String(e||"").trim().toLowerCase();
    const mail=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    try{
      const lotes=await rows("cda_envio_lotes?id=eq."+loteId+"&modo=eq.homologacao&select=id,campanha_id,mensagem_id,situacao&limit=1");
      const lote=lotes[0];
      if(!lote)return reply({ok:false,erro:"Lote de homologação inexistente"},404);
      const [msgs,camps,itens,ativos,supressoes,operacoes]=await Promise.all([
        rows("cda_campanha_mensagens?id=eq."+lote.mensagem_id+"&campanha_id=eq."+lote.campanha_id+"&select=id,assunto,previa,conteudo,remetente_nome,remetente_email,responder_para,atualizado_em&limit=1"),
        rows("cda_campanhas?id=eq."+lote.campanha_id+"&select=id,nome&limit=1"),
        rows("cda_envio_lote_itens?lote_id=eq."+loteId+"&select=id,nome,email,situacao,chave_idempotencia,tentativa_id,resend_email_id,inicio_processamento_em&order=id.asc&limit=1000"),
        rows("cda_homologacao_destinatarios?campanha_id=eq."+lote.campanha_id+"&ativo=eq.true&select=email&limit=1000"),
        rows("cda_email_supressoes?select=email&limit=5000"),
        rows("cda_envio_lote_operacoes?lote_id=eq."+loteId+"&select=item_id&limit=1000")
      ]);
      const msg=msgs[0],camp=camps[0];
      const impedimentos=[];
      if(!msg||!camp)impedimentos.push("Campanha ou mensagem indisponível");
      if(lote.situacao!=="preparado")impedimentos.push("Lote não preparado");
      const from=normal(msg?.remetente_email),replyTo=normal(msg?.responder_para);
      if(!mail.test(from)||!from.endsWith("@send.ciclodaarte.com.br"))
        impedimentos.push("Remetente inválido");
      if(!mail.test(replyTo))impedimentos.push("Responder para inválido");
      if(!String(msg?.assunto||"").trim()||!String(msg?.conteudo?.texto||"").trim())
        impedimentos.push("Assunto ou texto ausente");
      const ativosSet=new Set(ativos.map(x=>normal(x.email)));
      const supSet=new Set(supressoes.map(x=>normal(x.email)));
      const anteriores=new Set(operacoes.map(x=>String(x.item_id)));
      const emails=new Set(),assinaturas=[];
      if(itens.length===0||itens.length>=1000)impedimentos.push("Lista vazia ou limite excedido");
      for(const item of itens){
        const email=normal(item.email);
        if(!mail.test(email)||emails.has(email)||!ativosSet.has(email)||supSet.has(email)||
          item.situacao!=="pendente"||item.tentativa_id||item.resend_email_id||
          item.inicio_processamento_em||!item.chave_idempotencia||anteriores.has(String(item.id))){
          impedimentos.push("Destinatário não elegível: item "+item.id);
          continue;
        }
        emails.add(email);
        if(!msg||!camp)continue;
        const render=cdaMontarEmailCampanha({
          nome:camp.nome,emailConteudo:msg.conteudo||{},
          emailAssunto:msg.assunto,emailPrevia:msg.previa
        },{nome:item.nome},{});
        if(!render.html||!render.texto||render.assunto!==msg.assunto){
          impedimentos.push("Falha na renderização do item "+item.id);
          continue;
        }
        const payload={
          from:msg.remetente_nome?String(msg.remetente_nome).trim()+" <"+from+">":from,
          to:[email],
          subject:"[TESTE] "+render.assunto,
          html:render.html,
          text:render.texto,
          reply_to:replyTo,
          tags:[{name:"mensagem_id",value:String(msg.id)},{name:"tipo",value:"teste"}]
        };
        const json=JSON.stringify(payload);
        assinaturas.push({
          item_id:item.id,
          payload_sha256:await hash(json),
          tamanho_html:render.html.length,tamanho_texto:render.texto.length,
          chave_idempotencia_preservada:true,
          saudacao_personalizada:render.html.includes("Oi, "+cdaPrimeiroNome(item.nome)+"!"),
          cupom_presente:render.html.includes(String(msg.conteudo?.cupomCodigo||"")),
          link_acao_presente:render.html.includes(String(msg.conteudo?.botaoLink||""))
        });
      }
      return reply({ok:true,lote_id:loteId,mensagem_id:lote.mensagem_id,
        destinatarios:itens.length,construidos:assinaturas.length,
        assinaturas,impedimentos,envio_habilitado:false,envios_solicitados:0,
        observacao:"Hashes do JSON do futuro payload Resend, calculados em memória. Nenhum envio ou tentativa foi registrado."});
    }catch(e){
      return reply({ok:false,erro:"Não foi possível conferir o payload. Nenhum envio solicitado."},503);
    }
  }
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
    const [executor,diario,integridade,resumo]=await Promise.all([
      consultar("cda_diagnosticar_executor_lote"),
      consultar("cda_diagnosticar_diario_lote"),
      consultar("cda_auditar_integridade_lote"),
      consultar("cda_resumo_preenvio_homologacao")
    ]);
    if(executor?.trava_ativa!==true||executor?.pode_enviar!==false||
       diario?.envio_habilitado!==false||integridade?.envio_habilitado!==false||
       integridade?.chaves_consistentes!==true||resumo?.autorizado!==false||
       resumo?.envio_habilitado!==false)
      return reply({ok:false,erro:"Diagnóstico de segurança inconsistente"},503);
    return reply({ok:true,executor,diario,integridade,resumo,envio_habilitado:false,envios_solicitados:0});
  }catch{
    return reply({ok:false,erro:"Não foi possível consultar o diário de segurança"},503);
  }
});

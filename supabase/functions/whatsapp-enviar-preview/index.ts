// Edge Function: whatsapp-enviar-preview (v1 · 16/11/2026)
// Projeto Marketing Meta · Etapa 2 — envio de mensagens pela Cloud API (Meta).
//
// Ações (body.acao):
//   "enviar_texto"  { conversa_id, texto }  → envia texto livre (só dentro da janela de 24h)
//   "marcar_lida"   { conversa_id }         → zera não lidas e marca a última mensagem recebida
//                                             como lida no WhatsApp do cliente (✔✔ azul)
//
// Regras:
//   • Exige login de um membro da tabela `equipe` (mesma guarda das demais funções).
//   • Bloqueia envio para números na lista de opt-out (cda_whatsapp_supressoes).
//   • Fora da janela de 24h só é possível enviar template aprovado (Etapa 3) — aqui é bloqueado.
//   • Grava a mensagem enviada em cda_whatsapp_mensagens; os status (enviada/entregue/lida/falha)
//     chegam depois pelo webhook.
// Secrets: WHATSAPP_TOKEN. O token nunca é devolvido.

const G = "https://graph.facebook.com/v21.0";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const sbH = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" };

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

async function membroEquipe(req: Request): Promise<{ id: number; nome: string } | Response> {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json(401, { error: "Faça login no sistema para usar esta função." });
  const anon = Deno.env.get("SUPABASE_ANON_KEY") || SERVICE;
  const u = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: anon, Authorization: `Bearer ${token}` } });
  if (!u.ok) return json(401, { error: "Sessão inválida ou expirada. Entre novamente no sistema." });
  const email = String((await u.json())?.email || "").trim().toLowerCase();
  if (!email) return json(401, { error: "Sessão sem e-mail." });
  const r = await fetch(`${SUPABASE_URL}/rest/v1/equipe?select=id,name&email=ilike.${encodeURIComponent(email)}`, { headers: sbH });
  const rows = r.ok ? await r.json() : [];
  if (!Array.isArray(rows) || !rows.length) return json(403, { error: "Usuário sem acesso ao sistema." });
  return { id: rows[0].id, nome: rows[0].name };
}

async function sbGet(path: string) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: sbH });
  if (!r.ok) throw new Error(`Banco: ${r.status} ${await r.text()}`);
  return r.json();
}
async function sbPatch(path: string, body: unknown) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { method: "PATCH", headers: { ...sbH, Prefer: "return=minimal" }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`Banco: ${r.status} ${await r.text()}`);
}
async function sbInsert(table: string, body: unknown) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, { method: "POST", headers: { ...sbH, Prefer: "return=representation" }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`Banco: ${r.status} ${await r.text()}`);
  return (await r.json())[0];
}

async function carregarConversa(id: number) {
  const rows = await sbGet(`cda_whatsapp_conversas?id=eq.${id}&select=*,cda_whatsapp_numeros(phone_number_id,ativo)`);
  return rows[0] || null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { error: "Método não permitido." });

  const quem = await membroEquipe(req);
  if (quem instanceof Response) return quem;

  const TOKEN = Deno.env.get("WHATSAPP_TOKEN");
  if (!TOKEN) return json(503, { error: "WHATSAPP_TOKEN não configurado." });

  let body: any = {};
  try { body = await req.json(); } catch { return json(400, { error: "JSON inválido." }); }
  const acao = String(body.acao || "");
  const conversaId = Number(body.conversa_id);
  if (!conversaId) return json(400, { error: "conversa_id obrigatório." });

  try {
    const conv = await carregarConversa(conversaId);
    if (!conv) return json(404, { error: "Conversa não encontrada." });
    const phoneId = conv.cda_whatsapp_numeros?.phone_number_id;
    if (!phoneId) return json(422, { error: "Número da empresa não encontrado para esta conversa." });

    // ── Marcar como lida ──
    if (acao === "marcar_lida") {
      await sbPatch(`cda_whatsapp_conversas?id=eq.${conversaId}`, { nao_lidas: 0, atualizado_em: new Date().toISOString() });
      const ult = await sbGet(`cda_whatsapp_mensagens?conversa_id=eq.${conversaId}&direcao=eq.entrada&wa_message_id=not.is.null&order=ocorrido_em.desc&limit=1&select=wa_message_id`);
      if (ult[0]?.wa_message_id) {
        // Melhor esforço: se a Meta recusar (mensagem antiga), não é erro para o usuário.
        await fetch(`${G}/${phoneId}/messages`, {
          method: "POST",
          headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
          body: JSON.stringify({ messaging_product: "whatsapp", status: "read", message_id: ult[0].wa_message_id }),
        }).catch(() => null);
      }
      return json(200, { ok: true });
    }

    // ── Enviar texto livre ──
    if (acao === "enviar_texto") {
      const texto = String(body.texto || "").trim();
      if (!texto) return json(400, { error: "Digite a mensagem." });
      if (texto.length > 4096) return json(400, { error: "Mensagem acima de 4.096 caracteres." });

      const sup = await sbGet(`cda_whatsapp_supressoes?telefone=eq.${encodeURIComponent(conv.contato_wa)}&select=telefone`);
      if (sup.length) return json(422, { error: "Este contato pediu para não receber mensagens (opt-out). Envio bloqueado." });

      const exp = conv.janela_expira_em ? new Date(conv.janela_expira_em).getTime() : 0;
      if (exp <= Date.now()) {
        return json(422, { error: "A janela de 24h está fechada. Fora dela, só é possível enviar modelo aprovado pela Meta (disponível na Etapa 3 — Campanhas).", janela_fechada: true });
      }

      // Usa o número exatamente como a Meta enviou na última mensagem recebida (wa_id original);
      // se não houver, usa o número padronizado.
      const ultEntrada = await sbGet(`cda_whatsapp_mensagens?conversa_id=eq.${conversaId}&direcao=eq.entrada&order=ocorrido_em.desc&limit=1&select=conteudo_bruto`);
      const destino = String(ultEntrada[0]?.conteudo_bruto?.from || conv.contato_wa);

      const r = await fetch(`${G}/${phoneId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to: destino, type: "text", text: { body: texto, preview_url: true } }),
      });
      const j = await r.json().catch(() => ({}));
      const agora = new Date().toISOString();

      if (!r.ok || j?.error) {
        const erro = j?.error ? { codigo: j.error.code, subcodigo: j.error.error_subcode, mensagem: j.error.message, detalhe: j.error.error_data?.details } : { http: r.status };
        await sbInsert("cda_whatsapp_mensagens", {
          conversa_id: conversaId, direcao: "saida", tipo: "text", texto, status: "falha", erro,
          enviado_por: quem.id, ocorrido_em: agora,
        });
        return json(502, { error: "A Meta recusou o envio: " + (erro as any).mensagem, erro });
      }

      const waId = j?.messages?.[0]?.id || null;
      const msg = await sbInsert("cda_whatsapp_mensagens", {
        conversa_id: conversaId, wa_message_id: waId, direcao: "saida", tipo: "text", texto,
        status: "pendente", enviado_por: quem.id, ocorrido_em: agora, conteudo_bruto: { to: destino, resposta_meta: j },
      });
      await sbPatch(`cda_whatsapp_conversas?id=eq.${conversaId}`, {
        ultima_mensagem_em: agora, ultima_mensagem_previa: texto.slice(0, 200), atualizado_em: agora,
        ...(conv.responsavel_id ? {} : { responsavel_id: quem.id }),
      });
      return json(200, { ok: true, mensagem: msg });
    }

    return json(400, { error: "Ação desconhecida." });
  } catch (e) {
    console.error("[whatsapp-enviar]", String(e));
    return json(500, { error: String(e) });
  }
});

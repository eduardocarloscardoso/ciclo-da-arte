// Edge Function: whatsapp-webhook (PRODUÇÃO · v1 · 18/11/2026 — cópia idêntica do whatsapp-webhook-preview testado)
// Projeto Marketing Meta · Etapa 1.3 — recebe mensagens e status do WhatsApp (Cloud API da Meta).
//
// GET  → verificação do webhook pela Meta (hub.mode / hub.verify_token / hub.challenge)
//        Secret: WHATSAPP_VERIFY_TOKEN
// POST → eventos da Meta. A assinatura X-Hub-Signature-256 é validada com o
//        Secret WHATSAPP_APP_SECRET (chave secreta do app). Sem o secret, o POST é recusado.
//
// Gravação via funções do banco (service_role):
//   cda_wa_registrar_entrada  → conversa + mensagem recebida (idempotente por wa_message_id)
//   cda_wa_registrar_status   → enviada / entregue / lida / falha + categoria de cobrança
//
// verify_jwt = false (quem chama é a Meta). Nenhum token da Meta é usado aqui.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function resp(status: number, body: unknown, text = false) {
  return new Response(text ? String(body) : JSON.stringify(body), {
    status,
    headers: { "Content-Type": text ? "text/plain" : "application/json" },
  });
}

function igualSeguro(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

async function assinaturaValida(raw: string, header: string | null, segredo: string) {
  if (!header || !header.startsWith("sha256=")) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(segredo), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw));
  const hex = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return igualSeguro(hex, header.slice(7));
}

async function rpc(nome: string, args: Record<string, unknown>) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${nome}`, {
    method: "POST",
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`${nome}: ${r.status} ${t}`);
  return t ? JSON.parse(t) : null;
}

// Extrai texto legível + mídia de cada tipo de mensagem
function extrair(m: any): { texto: string | null; midia: any } {
  switch (m.type) {
    case "text": return { texto: m.text?.body ?? null, midia: null };
    case "image": case "video": case "audio": case "document": case "sticker": {
      const x = m[m.type] || {};
      return { texto: x.caption ?? null, midia: { tipo: m.type, media_id: x.id, mime: x.mime_type, nome: x.filename ?? null, voz: x.voice ?? null } };
    }
    case "location": {
      const l = m.location || {};
      return { texto: [l.name, l.address].filter(Boolean).join(" — ") || "[localização]", midia: { tipo: "location", lat: l.latitude, lng: l.longitude } };
    }
    case "contacts": return { texto: "[contato compartilhado]", midia: { tipo: "contacts", contatos: m.contacts } };
    case "reaction": return { texto: m.reaction?.emoji ? `Reagiu ${m.reaction.emoji}` : "[reação removida]", midia: { tipo: "reaction", mensagem: m.reaction?.message_id } };
    case "button": return { texto: m.button?.text ?? null, midia: { tipo: "button", payload: m.button?.payload } };
    case "interactive": {
      const i = m.interactive || {};
      const s = i.button_reply || i.list_reply || {};
      return { texto: s.title ?? null, midia: { tipo: "interactive", id: s.id, descricao: s.description ?? null } };
    }
    default: return { texto: `[${m.type || "mensagem"} não suportada]`, midia: null };
  }
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);

  // ── Verificação do webhook (configuração no painel da Meta) ──
  if (req.method === "GET") {
    const esperado = Deno.env.get("WHATSAPP_VERIFY_TOKEN");
    if (esperado && url.searchParams.get("hub.mode") === "subscribe" &&
        igualSeguro(url.searchParams.get("hub.verify_token") || "", esperado)) {
      return resp(200, url.searchParams.get("hub.challenge") || "", true);
    }
    return resp(403, { error: "Verificação recusada." });
  }

  if (req.method !== "POST") return resp(405, { error: "Método não permitido." });

  const segredo = Deno.env.get("WHATSAPP_APP_SECRET");
  if (!segredo) return resp(503, { error: "WHATSAPP_APP_SECRET não configurado." });

  const raw = await req.text();
  if (!(await assinaturaValida(raw, req.headers.get("x-hub-signature-256"), segredo))) {
    return resp(401, { error: "Assinatura inválida." });
  }

  let body: any;
  try { body = JSON.parse(raw); } catch { return resp(400, { error: "JSON inválido." }); }

  const resumo = { mensagens: 0, duplicadas: 0, status: 0, erros: 0 };

  for (const entry of body?.entry || []) {
    for (const change of entry?.changes || []) {
      if (change?.field !== "messages") continue;
      const v = change.value || {};
      const phoneId = v.metadata?.phone_number_id;
      const display = v.metadata?.display_phone_number ?? null;
      const nomes: Record<string, string> = {};
      for (const c of v.contacts || []) if (c?.wa_id) nomes[c.wa_id] = c.profile?.name ?? "";

      for (const m of v.messages || []) {
        try {
          const { texto, midia } = extrair(m);
          const r = await rpc("cda_wa_registrar_entrada", {
            p_phone_number_id: phoneId, p_display: display, p_wa_id: m.from, p_nome: nomes[m.from] ?? null,
            p_msg_id: m.id, p_tipo: m.type, p_texto: texto, p_midia: midia, p_bruto: m,
            p_ts: m.timestamp ? new Date(Number(m.timestamp) * 1000).toISOString() : null,
          });
          if (r?.duplicada) resumo.duplicadas++; else resumo.mensagens++;
        } catch (e) { resumo.erros++; console.error("[whatsapp-webhook] entrada", m?.id, String(e)); }
      }

      for (const s of v.statuses || []) {
        try {
          await rpc("cda_wa_registrar_status", {
            p_msg_id: s.id, p_status: s.status,
            p_ts: s.timestamp ? new Date(Number(s.timestamp) * 1000).toISOString() : null,
            p_erro: s.errors ?? null,
            p_categoria: s.pricing?.category ?? s.conversation?.origin?.type ?? null,
            p_cobravel: typeof s.pricing?.billable === "boolean" ? s.pricing.billable : null,
          });
          resumo.status++;
        } catch (e) { resumo.erros++; console.error("[whatsapp-webhook] status", s?.id, String(e)); }
      }
    }
  }

  console.log("[whatsapp-webhook]", JSON.stringify(resumo));
  // Sempre 200 após assinatura válida: a Meta reenviaria em caso de erro, e a gravação é idempotente.
  return resp(200, { ok: true, ...resumo });
});

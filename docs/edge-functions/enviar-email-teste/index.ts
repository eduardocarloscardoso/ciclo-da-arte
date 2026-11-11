// ════════════════════════════════════════════════════════════════════
// enviar-email-teste — Biblioteca de Mensagens (Comercial) · nov/2026
// Envia UMA mensagem da biblioteca para até 3 endereços de teste.
// • Só membros logados da equipe (JWT do usuário + cda_e_membro_equipe()).
// • Remetente e "Responder para" vêm da mensagem gravada no banco.
// • O HTML vem do navegador, montado por cdaMontarEmailCampanha() —
//   o mesmo montador da pré-visualização (o aprovado é o enviado).
// • Nunca toca a lista congelada. Chave: Secret RESEND_API_KEY.
// ════════════════════════════════════════════════════════════════════
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const DOMINIOS_REMETENTE = ["send.ciclodaarte.com.br"];
const MAX_DESTINOS = 3;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (o: unknown, s = 200) =>
    new Response(JSON.stringify(o), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
  try {
    const apiKey = Deno.env.get("RESEND_API_KEY");
    if (!apiKey) return json({ ok: false, erro: "RESEND_API_KEY não encontrada nos Secrets do Supabase." }, 500);
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const sk = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const auth = req.headers.get("Authorization") || "";

    // 1) Quem chama precisa ser membro da equipe (sessão do usuário)
    const membro = await fetch(`${url}/rest/v1/rpc/cda_e_membro_equipe`, {
      method: "POST", headers: { apikey: anon, Authorization: auth, "Content-Type": "application/json" }, body: "{}",
    });
    if (!membro.ok || (await membro.json()) !== true) return json({ ok: false, erro: "Apenas membros logados da equipe podem enviar testes." }, 403);

    // 2) Dados do pedido
    const { mensagem_id, para, assunto, html, texto, usuario } = await req.json();
    const destinos = [...new Set((Array.isArray(para) ? para : [para]).map((x: string) => String(x || "").trim().toLowerCase()).filter(Boolean))];
    if (!destinos.length) return json({ ok: false, erro: "Informe ao menos um endereço de teste." }, 400);
    if (destinos.length > MAX_DESTINOS) return json({ ok: false, erro: `No máximo ${MAX_DESTINOS} endereços por teste.` }, 400);
    const invalido = destinos.find((d) => !EMAIL_RE.test(d));
    if (invalido) return json({ ok: false, erro: `Endereço inválido: ${invalido}` }, 400);
    if (!html || !assunto) return json({ ok: false, erro: "Mensagem sem assunto ou conteúdo." }, 400);

    // 3) Remetente e "Responder para" gravados na mensagem
    const hdrSk = { apikey: sk, Authorization: `Bearer ${sk}` };
    const r = await fetch(`${url}/rest/v1/cda_campanha_mensagens?id=eq.${Number(mensagem_id)}&select=id,campanha_id,remetente_nome,remetente_email,responder_para`, { headers: hdrSk });
    const [msg] = await r.json();
    if (!msg) return json({ ok: false, erro: "Mensagem não encontrada — salve a mensagem antes de enviar o teste." }, 404);
    const dominio = String(msg.remetente_email || "").split("@")[1]?.toLowerCase();
    if (!DOMINIOS_REMETENTE.includes(dominio)) {
      return json({ ok: false, erro: `O remetente precisa terminar em @${DOMINIOS_REMETENTE.join(" ou @")} (domínio verificado no Resend).` }, 400);
    }

    const payload: Record<string, unknown> = {
      from: msg.remetente_nome ? `${msg.remetente_nome} <${msg.remetente_email}>` : msg.remetente_email,
      to: destinos,
      subject: `[TESTE] ${assunto}`,
      html,
      tags: [{ name: "mensagem_id", value: String(msg.id) }, { name: "tipo", value: "teste" }],
    };
    if (texto) payload.text = texto;
    if (msg.responder_para && EMAIL_RE.test(msg.responder_para)) payload.reply_to = msg.responder_para;

    const envio = await fetch("https://api.resend.com/emails", {
      method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify(payload),
    });
    const resp = await envio.json();
    if (!envio.ok) return json({ ok: false, erro: resp?.message || "O Resend recusou o envio.", resend: resp }, 502);

    // 4) Registra o último teste na mensagem
    await fetch(`${url}/rest/v1/cda_campanha_mensagens?id=eq.${msg.id}`, {
      method: "PATCH", headers: { ...hdrSk, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ ultimo_teste_em: new Date().toISOString(), ultimo_teste_para: destinos.join(", ") + (usuario ? ` (por ${usuario})` : "") }),
    });
    return json({ ok: true, id: resp.id, para: destinos });
  } catch (e) {
    return json({ ok: false, erro: String(e) }, 500);
  }
});

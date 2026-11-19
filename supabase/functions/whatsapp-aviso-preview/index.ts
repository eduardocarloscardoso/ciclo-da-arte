// Edge Function: whatsapp-aviso-preview (v1 · 19/11/2026 — SIMULAÇÃO do aviso por e-mail)
// Projeto Marketing Meta · aviso de "cliente respondeu no WhatsApp" por e-mail (Resend).
// v1 só SIMULA: envia um e-mail de exemplo para um membro da equipe (nunca para clientes).
// Acesso: login de membro da equipe, ou acesso técnico x-diag = WHATSAPP_VERIFY_TOKEN.
// body: { acao: "simular", equipe_id }

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FROM = "Ciclo Arte · Sistema <noreply@send.ciclodaarte.com.br>";
const APP = "https://ciclo-da-arte.vercel.app/";
const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-diag",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const sbH = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" };
const json = (s: number, b: unknown) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

async function sb(path: string) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: sbH });
  if (!r.ok) throw new Error(`Banco: ${r.status} ${await r.text()}`);
  return r.json();
}
async function membro(req: Request) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const anon = Deno.env.get("SUPABASE_ANON_KEY") || SERVICE;
  const u = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: anon, Authorization: `Bearer ${token}` } });
  if (!u.ok) return null;
  const email = String((await u.json())?.email || "").trim().toLowerCase();
  const rows = email ? await sb(`equipe?select=id&email=ilike.${encodeURIComponent(email)}`) : [];
  return rows.length ? rows[0] : null;
}

function html(d: { cliente: string; grupo: string; resposta: string; enviadaModelo: string; enviadaEm: string; recebidaEm: string; telefone: string }) {
  return `<!doctype html><html><body style="margin:0;background:#f4f1ea;font-family:Arial,Helvetica,sans-serif;color:#1b1b1b">
<div style="max-width:560px;margin:0 auto;padding:20px">
  <div style="background:#b3261e;color:#fff;font-size:12px;font-weight:bold;letter-spacing:1px;padding:6px 12px;text-align:center">SIMULAÇÃO — exemplo de aviso, nenhum cliente respondeu</div>
  <div style="background:#1b283d;color:#fff;padding:14px 18px">
    <div style="font-size:12px;letter-spacing:2px;opacity:.8">CICLO ARTE · CONVERSAS WHATSAPP</div>
    <div style="font-size:19px;font-weight:bold;margin-top:4px">💬 Nova resposta de ${esc(d.cliente)}</div>
  </div>
  <div style="background:#fff;padding:18px;border:1px solid #e3ddd0">
    <table style="font-size:13px;color:#555;border-collapse:collapse;width:100%">
      <tr><td style="padding:2px 0;width:130px">Cliente</td><td><b style="color:#1b1b1b">${esc(d.cliente)}</b> · ${esc(d.grupo)}</td></tr>
      <tr><td style="padding:2px 0">WhatsApp</td><td>${esc(d.telefone)}</td></tr>
      <tr><td style="padding:2px 0">Recebida em</td><td>${esc(d.recebidaEm)}</td></tr>
      <tr><td style="padding:2px 0">Em resposta a</td><td>${esc(d.enviadaModelo)} (enviada ${esc(d.enviadaEm)})</td></tr>
    </table>
    <div style="margin:16px 0 6px;font-size:12px;color:#777">Mensagem do cliente:</div>
    <div style="background:#e7f8dc;border-radius:8px;padding:12px 14px;font-size:15px;line-height:1.45">${esc(d.resposta)}</div>
    <div style="margin-top:14px;font-size:12.5px;color:#555">⏱ Você tem até 24h a partir desta mensagem para responder livremente (sem custo de modelo).</div>
    <div style="text-align:center;margin:20px 0 6px">
      <a href="${APP}" style="background:#b3261e;color:#fff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:4px;display:inline-block">Abrir a conversa no sistema</a>
    </div>
    <div style="font-size:11px;color:#999;text-align:center">Comercial › Conversas WhatsApp</div>
  </div>
  <div style="font-size:11px;color:#999;padding:12px 4px;line-height:1.5">Aviso automático do sistema Ciclo Arte, enviado só para a equipe. Para não lotar sua caixa: no máximo 1 aviso por conversa a cada 30 minutos.</div>
</div></body></html>`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { error: "Método não permitido." });
  const diag = Deno.env.get("WHATSAPP_VERIFY_TOKEN");
  const viaSistema = !!diag && req.headers.get("x-diag") === diag;
  if (!viaSistema && !(await membro(req).catch(() => null))) return json(401, { error: "Faça login no sistema." });
  const KEY = Deno.env.get("RESEND_API_KEY") || "";
  if (KEY.length < 8) return json(503, { error: "Resend não configurado." });
  let b: any = {};
  try { b = await req.json(); } catch { return json(400, { error: "JSON inválido." }); }
  if (b.acao !== "simular") return json(400, { error: "Ação desconhecida." });
  try {
    // destinatário: somente e-mail de membro da equipe (nunca cliente)
    const eq = (await sb(`equipe?select=id,name,email&id=eq.${Number(b.equipe_id)}`))?.[0];
    if (!eq?.email) return json(404, { error: "Membro da equipe não encontrado." });
    const dados = {
      cliente: "Maria Silva", grupo: "Premium", telefone: "+55 21 9XXXX-XXXX (exemplo)",
      resposta: "Oi! O desconto de 20% vale também para as peças da collab da Luedji? Quero comprar duas camisetas.",
      enviadaModelo: "Black Friday · aviso (black_friday_2026_aviso)", enviadaEm: "hoje às 18:35",
      recebidaEm: new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }),
    };
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST", headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [eq.email], subject: `[SIMULAÇÃO] 💬 Nova resposta no WhatsApp · ${dados.cliente}`,
        html: html(dados), text: `SIMULAÇÃO — ${dados.cliente} (${dados.grupo}) respondeu: "${dados.resposta}". Abra: ${APP} › Comercial › Conversas WhatsApp.` }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return json(502, { error: "Resend recusou: " + (j?.message || JSON.stringify(j)) });
    return json(200, { ok: true, para: eq.email, resend_id: j?.id });
  } catch (e) {
    return json(500, { error: String((e as Error)?.message || e) });
  }
});

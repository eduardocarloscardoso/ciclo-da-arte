// @ts-nocheck
// Descadastro por link assinado (Transmissão Oficial, nov/2026). Público, sem login:
// a autenticidade vem do HMAC por destinatário. Suporta RFC 8058 (one-click POST).
// GET redireciona para a página de confirmação, evitando descadastro por robôs de pré-visualização.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const PAGINA = "https://ciclo-da-arte.vercel.app/descadastro.html";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type", "Access-Control-Allow-Methods": "GET,POST,OPTIONS" };
const reply = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const hex = (buf) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
function iguais(a, b) { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const u = new URL(req.url);
  let i = u.searchParams.get("i") || "", t = u.searchParams.get("t") || "";
  if (req.method === "GET") return Response.redirect(PAGINA + "?i=" + encodeURIComponent(i) + "&t=" + encodeURIComponent(t), 302);
  if (req.method !== "POST") return reply({ ok: false }, 405);
  const ct = req.headers.get("content-type") || "";
  if (ct.includes("application/json")) { const b = await req.json().catch(() => ({})); i = String(b.i || i); t = String(b.t || t); }
  if (!/^\d{1,12}$/.test(i) || !/^[0-9a-f]{40}$/.test(t)) return reply({ ok: false, erro: "Link inválido" }, 400);
  const url = Deno.env.get("SUPABASE_URL") || "", sk = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const h = { apikey: sk, Authorization: "Bearer " + sk, "Content-Type": "application/json" };
  const sr = await fetch(url + "/rest/v1/rpc/cda_oficial_segredo_descadastro", { method: "POST", headers: h, body: "{}" }).catch(() => null);
  const segredo = sr?.ok ? String(await sr.json()) : "";
  if (!segredo) return reply({ ok: false, erro: "Serviço indisponível" }, 503);
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(segredo), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const esperado = hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode("descadastro:" + i))).slice(0, 40);
  if (!iguais(esperado, t)) return reply({ ok: false, erro: "Link inválido ou expirado" }, 403);
  const r = await fetch(url + "/rest/v1/rpc/cda_oficial_descadastrar_item", { method: "POST", headers: h,
    body: JSON.stringify({ p_item_id: Number(i), p_origem: ct.includes("json") ? "pagina" : "um_clique" }) }).catch(() => null);
  if (!r?.ok) return reply({ ok: false, erro: "Não foi possível registrar agora" }, 503);
  return reply({ ok: true, descadastrado: true });
});

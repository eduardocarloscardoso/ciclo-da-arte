// @ts-nocheck
// Prévia de mensagem para aprovação (nov/2026). Duas ações:
//  - gerar (POST autenticado, membro da equipe): devolve o código do link da prévia da mensagem.
//  - ver   (público, com código HMAC): devolve o e-mail montado com um nome de EXEMPLO.
// Não envia nada e não expõe dados de clientes.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { cdaMontarEmailCampanha } from "./montador.mjs";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization,apikey,x-client-info,content-type", "Access-Control-Allow-Methods": "GET,POST,OPTIONS" };
const reply = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const hex = (b) => Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, "0")).join("");
function iguais(a, b) { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const url = Deno.env.get("SUPABASE_URL") || "", anon = Deno.env.get("SUPABASE_ANON_KEY") || "", sk = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const h = { apikey: sk, Authorization: "Bearer " + sk, "Content-Type": "application/json" };
  const rows = async (p) => { const r = await fetch(url + "/rest/v1/" + p, { headers: h }); if (!r.ok) throw Error("Consulta indisponível"); return await r.json(); };
  const codigo = async (id) => {
    const sr = await fetch(url + "/rest/v1/rpc/cda_oficial_segredo_descadastro", { method: "POST", headers: h, body: "{}" });
    const segredo = sr.ok ? String(await sr.json()) : "";
    if (!segredo) throw Error("Serviço indisponível");
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(segredo), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    return hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode("previa:" + id))).slice(0, 32);
  };
  let body = {};
  if (req.method === "POST") body = await req.json().catch(() => ({}));
  const u = new URL(req.url);
  const acao = String(body.acao || u.searchParams.get("acao") || "ver");
  const id = Number(body.m || u.searchParams.get("m"));
  if (!Number.isSafeInteger(id) || id < 1) return reply({ ok: false, erro: "Mensagem inválida" }, 400);
  try {
    if (acao === "gerar") {
      const bearer = req.headers.get("Authorization") || "";
      const ur = await fetch(url + "/auth/v1/user", { headers: { apikey: anon, Authorization: bearer } }).catch(() => null);
      const usuario = ur?.ok ? await ur.json().catch(() => null) : null;
      const email = String(usuario?.email || "").trim().toLowerCase();
      if (!email) return reply({ ok: false, erro: "Sessão inválida" }, 401);
      const eq = await rows("equipe?email=eq." + encodeURIComponent(email) + "&select=email&limit=1");
      if (!eq.length) return reply({ ok: false, erro: "Acesso restrito à equipe" }, 403);
      return reply({ ok: true, m: id, t: await codigo(id) });
    }
    const t = String(body.t || u.searchParams.get("t") || "");
    if (!/^[0-9a-f]{32}$/.test(t) || !iguais(await codigo(id), t)) return reply({ ok: false, erro: "Link inválido" }, 403);
    const m = (await rows("cda_campanha_mensagens?id=eq." + id + "&select=id,campanha_id,nome,assunto,previa,conteudo,remetente_nome,remetente_email&limit=1"))[0];
    if (!m) return reply({ ok: false, erro: "Mensagem não encontrada" }, 404);
    const c = (await rows("cda_campanhas?id=eq." + m.campanha_id + "&select=nome&limit=1"))[0];
    const r = cdaMontarEmailCampanha({ nome: c?.nome || m.nome, emailConteudo: m.conteudo || {}, emailAssunto: m.assunto, emailPrevia: m.previa },
      { nome: "Maria Silva", cidade: "São Paulo", estado: "SP" }, { linkDescadastro: "#descadastro-exemplo" });
    return reply({ ok: true, nome: m.nome, assunto: r.assunto,
      de: (m.remetente_nome ? m.remetente_nome + " <" + m.remetente_email + ">" : m.remetente_email), html: r.html });
  } catch (e) {
    return reply({ ok: false, erro: "Prévia indisponível" }, 503);
  }
});

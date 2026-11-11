// @ts-nocheck
// Executor OFICIAL da Transmissão Oficial (nov/2026). Separado do executor de homologação.
// Reaproveita o desenho homologado: autorização pessoal expirável presa a fingerprint,
// diário gravado ANTES do HTTP, uma chamada = um e-mail, sem reenvio automático.
// O navegador informa apenas identificadores; conteúdo e destinatário vêm do snapshot congelado.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { cdaMontarEmailCampanha } from "./montador.mjs";
import { solicitarResendUmaVez } from "./resend-adapter.mjs";

const SITE_DESCADASTRO = "https://ciclo-da-arte.vercel.app/descadastro.html";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization,apikey,x-client-info,content-type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};
const reply = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const hex = (buf) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
async function sha256(txt) { return hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(txt))); }
async function hmac(secret, msg) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg))).slice(0, 40);
}
const ACOES = ["painel", "inconsistencias", "status", "previa", "confirmar_lgpd", "autorizar", "pausar", "enviar_proximo"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ ok: false, erro: "Método não permitido" }, 405);
  const url = Deno.env.get("SUPABASE_URL") || "", anon = Deno.env.get("SUPABASE_ANON_KEY") || "",
    sk = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "", bearer = req.headers.get("Authorization") || "";
  if (!url || !anon || !sk || !/^Bearer .+$/i.test(bearer)) return reply({ ok: false, erro: "Autenticação indisponível" }, 401);
  const uReq = await fetch(url + "/auth/v1/user", { headers: { apikey: anon, Authorization: bearer } }).catch(() => null);
  const usuario = uReq?.ok ? await uReq.json().catch(() => null) : null;
  if (!usuario?.id) return reply({ ok: false, erro: "Sessão inválida" }, 401);
  const h = { apikey: sk, Authorization: "Bearer " + sk, "Content-Type": "application/json" };
  const rows = async (path) => { const r = await fetch(url + "/rest/v1/" + path, { headers: h }); if (!r.ok) throw Error("Consulta indisponível"); return await r.json(); };
  const rpc = async (nome, params) => {
    const r = await fetch(url + "/rest/v1/rpc/" + nome, { method: "POST", headers: h, body: JSON.stringify(params) });
    const j = await r.json().catch(() => null);
    if (!r.ok) throw Error(String(j?.message || "Operação recusada pelo banco"));
    return j;
  };
  const email = String(usuario.email || "").trim().toLowerCase();
  let equipe = [];
  try { equipe = await rows("equipe?email=eq." + encodeURIComponent(email) + "&select=email,is_admin,permissao&limit=1"); } catch { return reply({ ok: false, erro: "Equipe indisponível" }, 503); }
  if (!equipe.length) return reply({ ok: false, erro: "Acesso restrito à equipe autorizada" }, 403);
  const admin = equipe[0].is_admin === true && equipe[0].permissao === "leitura_escrita" && usuario.email_confirmed_at != null;

  let body; try { body = await req.json(); } catch { return reply({ ok: false, erro: "Dados inválidos" }, 400); }
  const acao = String(body.acao || "");
  if (!ACOES.includes(acao)) return reply({ ok: false, erro: "Ação inválida" }, 400);
  const loteId = Number(body.lote_id), transmissaoId = Number(body.transmissao_id);
  if (["painel", "inconsistencias", "confirmar_lgpd"].includes(acao) ? !(transmissaoId > 0) : !(loteId > 0))
    return reply({ ok: false, erro: "Identificador inválido" }, 400);
  if (["confirmar_lgpd", "autorizar", "pausar", "enviar_proximo"].includes(acao) && !admin && acao !== "pausar")
    return reply({ ok: false, erro: "Somente administrador com escrita" }, 403);

  // Monta o e-mail final de um item a partir do snapshot congelado.
  const montar = async (d) => {
    const segredo = await rpc("cda_oficial_segredo_descadastro", {});
    const token = await hmac(String(segredo), "descadastro:" + d.item_id);
    const linkPagina = SITE_DESCADASTRO + "?i=" + d.item_id + "&t=" + token;
    const linkUmClique = url + "/functions/v1/cda-descadastro?i=" + d.item_id + "&t=" + token;
    let previa = "";
    try {
      const m = await rows("cda_campanha_mensagens?id=eq." + d.mensagem_id + "&select=previa,conteudo&limit=1");
      if (m[0] && JSON.stringify(m[0].conteudo) === JSON.stringify(d.conteudo)) previa = m[0].previa || "";
    } catch { /* prévia é opcional */ }
    const r = cdaMontarEmailCampanha({ nome: d.campanha_nome, emailConteudo: d.conteudo || {}, emailAssunto: d.assunto, emailPrevia: previa },
      { nome: d.nome }, { linkDescadastro: linkPagina });
    const rem = d.remetente || {};
    const from = String(rem.email || "").trim().toLowerCase();
    if (!/^[^\s@]+@send\.ciclodaarte\.com\.br$/.test(from)) throw Error("Remetente fora do domínio autorizado");
    if (!r.html || !r.texto || r.assunto !== d.assunto || r.html.includes("#descadastrar")) throw Error("Montagem inconsistente");
    return {
      from: rem.nome ? String(rem.nome).trim() + " <" + from + ">" : from,
      to: [String(d.email)], subject: r.assunto, html: r.html, text: r.texto,
      reply_to: String(rem.reply_to || "").trim() || undefined,
      headers: { "List-Unsubscribe": "<" + linkUmClique + ">", "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
      tags: [{ name: "tipo", value: "oficial" }, { name: "transmissao_id", value: String(d.transmissao_id) },
        { name: "lote", value: String(d.lote_numero) }],
    };
  };

  try {
    if (acao === "painel") return reply({ ok: true, admin, painel: await rpc("cda_oficial_painel", { p_transmissao_id: transmissaoId }) });
    if (acao === "inconsistencias") return reply({ ok: true, itens: await rpc("cda_oficial_inconsistencias", { p_transmissao_id: transmissaoId }) });
    if (acao === "status") {
      const st = await rpc("cda_oficial_status_lote", { p_lote_id: loteId });
      const itens = await rows("cda_transmissao_envios?lote_id=eq." + loteId + "&select=item_id,email,estado,erro,solicitado_em&order=item_id.asc&limit=1000");
      return reply({ ok: true, admin, status: st, envios: itens, confirmacao_exigida: "AUTORIZAR LOTE " + st.numero,
        provedor_configurado: (Deno.env.get("RESEND_API_KEY") || "").length >= 8 });
    }
    if (acao === "previa") {
      // Renderiza o primeiro destinatário pendente em memória. Nada é gravado nem enviado.
      const lote = (await rows("cda_transmissao_lotes?id=eq." + loteId + "&select=id,numero,transmissao_id&limit=1"))[0];
      const t = (await rows("cda_transmissoes_oficiais?id=eq." + lote.transmissao_id + "&select=id,campanha_id,mensagem_id,assunto_snapshot,conteudo_snapshot,remetente_snapshot&limit=1"))[0];
      const it = (await rows("cda_transmissao_lote_itens?lote_id=eq." + loteId + "&situacao=eq.pendente&select=id,email_snapshot,nome_snapshot&order=id.asc&limit=1"))[0];
      const camp = (await rows("cda_campanhas?id=eq." + t.campanha_id + "&select=nome&limit=1"))[0];
      const p = await montar({ item_id: it.id, email: it.email_snapshot, nome: it.nome_snapshot, transmissao_id: t.id, lote_numero: lote.numero,
        campanha_nome: camp?.nome, mensagem_id: t.mensagem_id, assunto: t.assunto_snapshot, conteudo: t.conteudo_snapshot, remetente: t.remetente_snapshot });
      return reply({ ok: true, de: p.from, para: p.to[0], assunto: p.subject, responder_para: p.reply_to, html: p.html, envios_solicitados: 0 });
    }
    if (acao === "confirmar_lgpd") {
      if (String(body.confirmacao || "") !== "CONFIRMO A BASE LEGAL") return reply({ ok: false, erro: "Confirmação divergente" }, 409);
      return reply({ ok: true, resultado: await rpc("cda_oficial_confirmar_lgpd", { p_transmissao_id: transmissaoId, p_usuario: usuario.id,
        p_texto: "Administrador " + email + " confirmou a base legal (legítimo interesse) e a oferta de descadastro em cada e-mail." }) });
    }
    if (acao === "autorizar") {
      const st = await rpc("cda_oficial_status_lote", { p_lote_id: loteId });
      if (String(body.confirmacao || "") !== "AUTORIZAR LOTE " + st.numero || String(body.fingerprint_sha256 || "") !== st.fingerprint_sha256)
        return reply({ ok: false, erro: "Confirmação ou fotografia do lote divergente; atualize." }, 409);
      if ((Deno.env.get("RESEND_API_KEY") || "").length < 8) return reply({ ok: false, erro: "Resend não configurado" }, 503);
      return reply({ ok: true, autorizacao: await rpc("cda_oficial_autorizar_lote", { p_lote_id: loteId, p_fingerprint: st.fingerprint_sha256, p_usuario: usuario.id, p_minutos: 60 }), envios_solicitados: 0 });
    }
    if (acao === "pausar") return reply({ ok: true, resultado: await rpc("cda_oficial_revogar_lote", { p_lote_id: loteId, p_usuario: usuario.id, p_motivo: "Pausa pelo operador " + email }) });

    // enviar_proximo: no máximo UM e-mail por chamada.
    const apiKey = Deno.env.get("RESEND_API_KEY") || "";
    if (apiKey.length < 8) return reply({ ok: false, erro: "Resend não configurado" }, 503);
    const r = await rpc("cda_oficial_reservar_proximo", { p_lote_id: loteId, p_usuario: usuario.id });
    if (!r?.reservado) return reply({ ok: true, enviado: false, motivo: r?.motivo, aguardar_segundos: r?.aguardar_segundos || null, continuar: r?.continuar === true });
    let payload, sha = null;
    try { payload = await montar(r); sha = await sha256(JSON.stringify(payload)); }
    catch (e) {
      // Falha antes do HTTP: o provedor não foi chamado; registra falha definitiva para revisão.
      await rpc("cda_oficial_concluir", { p_envio_id: r.envio_id, p_resultado: "falha", p_resend_email_id: null, p_erro: "Montagem: " + String(e?.message || e), p_payload_sha256: null });
      return reply({ ok: false, enviado: false, estado: "falha", erro: "Falha na montagem; nada foi enviado." }, 409);
    }
    let res;
    try { res = await solicitarResendUmaVez({ apiKey, payload, chave: String(r.chave_idempotencia) }); }
    catch { res = { estado: "indeterminada", resend_email_id: null, erro: "Exceção no adaptador" }; }
    try {
      await rpc("cda_oficial_concluir", { p_envio_id: r.envio_id, p_resultado: res.estado, p_resend_email_id: res.resend_email_id || null, p_erro: res.erro || null, p_payload_sha256: sha });
    } catch {
      return reply({ ok: false, enviado: res.estado === "aceita", estado: "revisao_manual", reenvio_automatico: false }, 202);
    }
    return reply({ ok: res.estado === "aceita", enviado: res.estado === "aceita", estado: res.estado, item_id: r.item_id, email: r.email, reenvio_automatico: false },
      res.estado === "aceita" ? 200 : 202);
  } catch (e) {
    return reply({ ok: false, erro: String(e?.message || "Falha segura"), envios_solicitados: 0 }, 409);
  }
});

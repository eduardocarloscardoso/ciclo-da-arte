// Edge Function: whatsapp-midia-preview (v1 · 16/11/2026)
// Projeto Marketing Meta · Etapa 2 — mídias recebidas (foto, áudio, vídeo, documento, figurinha).
//
// body: { mensagem_id }
// 1ª vez: baixa a mídia da Meta (pelo media_id), guarda no Storage privado "whatsapp-midias"
//         e registra o caminho em cda_whatsapp_mensagens.midia.storage_path
//         (a Meta só mantém a mídia por tempo limitado — assim ela fica preservada no sistema).
// Sempre: devolve um link temporário (1h) assinado para o navegador exibir/baixar.
// Exige login de um membro da tabela `equipe`. Secret: WHATSAPP_TOKEN.

const G = "https://graph.facebook.com/v21.0";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BUCKET = "whatsapp-midias";
const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const sbH = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` };

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

async function membroEquipe(req: Request): Promise<boolean | Response> {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json(401, { error: "Faça login no sistema para usar esta função." });
  const anon = Deno.env.get("SUPABASE_ANON_KEY") || SERVICE;
  const u = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: anon, Authorization: `Bearer ${token}` } });
  if (!u.ok) return json(401, { error: "Sessão inválida ou expirada. Entre novamente no sistema." });
  const email = String((await u.json())?.email || "").trim().toLowerCase();
  const r = await fetch(`${SUPABASE_URL}/rest/v1/equipe?select=id&email=ilike.${encodeURIComponent(email)}`, { headers: sbH });
  const rows = r.ok ? await r.json() : [];
  if (!email || !Array.isArray(rows) || !rows.length) return json(403, { error: "Usuário sem acesso ao sistema." });
  return true;
}

const EXT: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "audio/ogg": "ogg", "audio/mpeg": "mp3",
  "audio/mp4": "m4a", "audio/aac": "aac", "audio/amr": "amr", "video/mp4": "mp4", "video/3gpp": "3gp",
  "application/pdf": "pdf",
};

async function assinar(path: string) {
  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/${BUCKET}/${path}`, {
    method: "POST", headers: { ...sbH, "Content-Type": "application/json" }, body: JSON.stringify({ expiresIn: 3600 }),
  });
  const j = await r.json();
  if (!r.ok || !j?.signedURL) throw new Error("Falha ao gerar link da mídia: " + JSON.stringify(j));
  return `${SUPABASE_URL}/storage/v1${j.signedURL}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { error: "Método não permitido." });
  const ok = await membroEquipe(req);
  if (ok instanceof Response) return ok;

  let body: any = {};
  try { body = await req.json(); } catch { return json(400, { error: "JSON inválido." }); }
  const id = Number(body.mensagem_id);
  if (!id) return json(400, { error: "mensagem_id obrigatório." });

  try {
    const r0 = await fetch(`${SUPABASE_URL}/rest/v1/cda_whatsapp_mensagens?id=eq.${id}&select=id,conversa_id,midia`, { headers: sbH });
    const m = (await r0.json())[0];
    if (!m?.midia) return json(404, { error: "Mensagem sem mídia." });
    const midia = m.midia;

    if (midia.storage_path) {
      return json(200, { url: await assinar(midia.storage_path), mime: midia.mime, nome: midia.nome || null });
    }
    if (!midia.media_id) return json(404, { error: "Mídia sem identificador da Meta." });

    const TOKEN = Deno.env.get("WHATSAPP_TOKEN");
    if (!TOKEN) return json(503, { error: "WHATSAPP_TOKEN não configurado." });

    const info = await (await fetch(`${G}/${midia.media_id}`, { headers: { Authorization: `Bearer ${TOKEN}` } })).json();
    if (info?.error || !info?.url) return json(502, { error: "A Meta não devolveu a mídia (pode ter expirado): " + (info?.error?.message || "sem URL") });

    const arq = await fetch(info.url, { headers: { Authorization: `Bearer ${TOKEN}` } });
    if (!arq.ok) return json(502, { error: "Falha ao baixar a mídia da Meta: HTTP " + arq.status });
    const bytes = new Uint8Array(await arq.arrayBuffer());
    const mime = String(info.mime_type || midia.mime || "application/octet-stream").split(";")[0].trim();
    const ext = EXT[mime] || (midia.nome && midia.nome.includes(".") ? midia.nome.split(".").pop() : "bin");
    const path = `conversa-${m.conversa_id}/msg-${m.id}.${ext}`;

    const up = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
      method: "POST", headers: { ...sbH, "Content-Type": mime, "x-upsert": "true" }, body: bytes,
    });
    if (!up.ok) return json(500, { error: "Falha ao guardar a mídia: " + (await up.text()) });

    const novaMidia = { ...midia, storage_path: path, mime, tamanho: bytes.length, sha256: info.sha256 || null };
    await fetch(`${SUPABASE_URL}/rest/v1/cda_whatsapp_mensagens?id=eq.${id}`, {
      method: "PATCH", headers: { ...sbH, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ midia: novaMidia, atualizado_em: new Date().toISOString() }),
    });

    return json(200, { url: await assinar(path), mime, nome: midia.nome || null });
  } catch (e) {
    console.error("[whatsapp-midia]", String(e));
    return json(500, { error: String(e) });
  }
});

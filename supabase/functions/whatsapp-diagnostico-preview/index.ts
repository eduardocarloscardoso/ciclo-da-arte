// Edge Function: whatsapp-diagnostico-preview (v1 · 16/11/2026)
// Projeto Marketing Meta · Diagnóstico SOMENTE LEITURA da conexão com a Cloud API.
// Confere se WHATSAPP_TOKEN existe e é válido, lê dados do número e as inscrições (subscribed_apps) da WABA.
// Nunca devolve o token. Protegida pelo cabeçalho x-diag = WHATSAPP_VERIFY_TOKEN.

const G = "https://graph.facebook.com/v21.0";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

Deno.serve(async (req: Request) => {
  const chave = Deno.env.get("WHATSAPP_VERIFY_TOKEN");
  if (!chave || req.headers.get("x-diag") !== chave) return json(403, { error: "Acesso negado." });

  let body: any = {};
  try { body = await req.json(); } catch { /* vazio */ }
  const phoneId = String(body.phone_number_id || "");
  const wabaId = String(body.waba_id || "");

  const token = Deno.env.get("WHATSAPP_TOKEN");
  const out: Record<string, unknown> = {
    whatsapp_token_configurado: !!token,
    whatsapp_app_secret_configurado: !!Deno.env.get("WHATSAPP_APP_SECRET"),
  };
  if (!token) return json(200, out);

  async function get(path: string) {
    const r = await fetch(`${G}/${path}`, { headers: { Authorization: `Bearer ${token}` } });
    const j = await r.json().catch(() => ({}));
    if (j?.error) return { erro: { codigo: j.error.code, subcodigo: j.error.error_subcode, mensagem: j.error.message } };
    return j;
  }

  if (phoneId) out.numero = await get(`${phoneId}?fields=display_phone_number,verified_name,quality_rating,code_verification_status,platform_type,throughput`);
  if (wabaId) {
    out.waba = await get(`${wabaId}?fields=name,currency,timezone_id,message_template_namespace`);
    const s: any = await get(`${wabaId}/subscribed_apps`);
    out.apps_inscritos = s?.data ? s.data.map((a: any) => a?.whatsapp_business_api_data?.name || a?.whatsapp_business_api_data?.id || a) : s;
  }
  return json(200, out);
});

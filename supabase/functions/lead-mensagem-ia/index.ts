// Edge Function: lead-mensagem-ia (24/11/2026)
// Apoio de IA para a mensagem individual do lead no Pipeline B2C.
//   modo "sugerir": escreve uma proposta de mensagem com o contexto do cliente.
//   modo "revisar": revisa o texto do usuário (ortografia, tom, marca) e comenta o que mudou.
// Nunca envia nada ao cliente; só devolve texto para o usuário decidir.
// Exige login de um membro da tabela `equipe`. A chave da Anthropic fica no servidor.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, obj: unknown) =>
  new Response(JSON.stringify(obj), { status, headers: { ...CORS, "Content-Type": "application/json" } });

async function membroEquipe(req: Request): Promise<string | null> {
  const url = Deno.env.get("SUPABASE_URL")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY") || service;
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const u = await fetch(`${url}/auth/v1/user`, { headers: { apikey: anon, Authorization: `Bearer ${token}` } });
  if (!u.ok) return null;
  const email = String((await u.json())?.email || "").trim().toLowerCase();
  if (!email) return null;
  const r = await fetch(`${url}/rest/v1/equipe?select=id&email=ilike.${encodeURIComponent(email)}`,
    { headers: { apikey: service, Authorization: `Bearer ${service}` } });
  const rows = r.ok ? await r.json() : [];
  return Array.isArray(rows) && rows.length ? email : null;
}

const limpar = (v: unknown, n = 400) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { error: "Método não permitido" });
  try {
    if (!(await membroEquipe(req))) return json(401, { error: "Faça login no sistema com um usuário da equipe." });
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) return json(500, { error: "ANTHROPIC_API_KEY não configurada." });
    const b = await req.json().catch(() => ({}));
    const modo = b.modo === "revisar" ? "revisar" : "sugerir";
    const c = b.contexto || {};
    const texto = String(b.texto ?? "").trim().slice(0, 1500);
    if (modo === "revisar" && !texto) return json(400, { error: "Escreva sua mensagem antes de pedir a revisão." });

    const hoje = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
    const ctx = [
      `Data de hoje: ${hoje}`,
      c.primeiroNome ? `Primeiro nome do cliente: ${limpar(c.primeiroNome, 60)}` : null,
      c.campanha ? `Campanha: ${limpar(c.campanha, 120)}` : null,
      c.objetivo ? `Oferta/objetivo da campanha: ${limpar(c.objetivo, 500)}` : null,
      c.condicoes ? `Condições: ${limpar(c.condicoes, 400)}` : null,
      c.canal ? `Canal desta conversa: ${limpar(c.canal, 40)}` : null,
      c.etapa ? `Etapa no funil: ${limpar(c.etapa, 40)}` : null,
      c.grupo ? `Grupo do cliente: ${limpar(c.grupo, 40)}` : null,
      c.ultimaPeca ? `Última peça comprada: ${limpar(c.ultimaPeca, 120)}` : null,
      c.ultimaCompra ? `Data da última compra: ${limpar(c.ultimaCompra, 20)}` : null,
      c.respostaCliente ? `Última mensagem do cliente: "${limpar(c.respostaCliente, 300)}"` : null,
      c.observacoes ? `Observações do vendedor: ${limpar(c.observacoes, 300)}` : null,
    ].filter(Boolean).join("\n");

    const regras = `Regras:
- Marca: escreva sempre "Ciclo Arte" (nunca "Ciclo da Arte").
- Português do Brasil, tom caloroso, pessoal e respeitoso; no máximo 4 frases curtas, adequado a WhatsApp.
- Não invente desconto, prazo, frete ou condição que não esteja no contexto ou no texto do vendedor.
- No máximo 1 emoji. Sem markdown, sem aspas, sem variáveis entre chaves.
- Use o primeiro nome do cliente quando houver.`;

    const prompt = modo === "sugerir"
      ? `Você ajuda a equipe comercial da Ciclo Arte (moda, acessórios e merchandising cultural, com collabs de artistas) a escrever UMA mensagem individual para um cliente.\n\nContexto:\n${ctx}\n\n${regras}\n\nResponda SOMENTE com JSON: {"texto": "<mensagem pronta>", "comentario": "<1 frase explicando a abordagem>"}`
      : `Você revisa uma mensagem que um vendedor da Ciclo Arte (moda, acessórios e merchandising cultural) vai mandar para um cliente.\n\nContexto:\n${ctx}\n\nTexto do vendedor:\n"""${texto}"""\n\nCorrija ortografia, acentuação e pontuação, ajuste o tom se necessário e mantenha a intenção e as informações do vendedor (não acrescente ofertas). ${regras}\n\nResponda SOMENTE com JSON: {"texto": "<versão revisada>", "comentario": "<até 2 frases dizendo o que mudou e por quê; aponte se algo no texto original pode confundir o cliente>"}`;

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 600, messages: [{ role: "user", content: prompt }] }),
    });
    if (!r.ok) return json(502, { error: "Falha na IA: " + (await r.text()).slice(0, 300) });
    const d = await r.json();
    const bruto = (d.content || []).map((x: any) => x.text || "").join("").trim();
    let out: any = null;
    try { out = JSON.parse(bruto.replace(/^```(json)?/i, "").replace(/```$/, "").trim()); } catch { /* fallback */ }
    if (!out || !out.texto) out = { texto: bruto, comentario: "" };
    return json(200, { texto: String(out.texto).trim().slice(0, 1500), comentario: limpar(out.comentario, 400), modo });
  } catch (e) {
    return json(500, { error: String(e) });
  }
});

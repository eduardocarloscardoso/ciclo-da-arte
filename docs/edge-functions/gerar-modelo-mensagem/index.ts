// Edge Function: gerar-modelo-mensagem
// Roda no servidor — a chave da Anthropic nunca chega ao navegador.
// Recebe o contexto da Campanha (Nível 1) e devolve um MOLDE (texto
// fixo + {variaveis} literais, nunca preenchidas) pronto pra ser
// revisado pelo usuário.
//
// tipo: 'mensagem' (padrão) — texto pro CLIENTE, via WhatsApp.
//       'tarefa'   — instrução INTERNA pro vendedor seguir, não é
//                     enviada a ninguém fora da equipe. Se
//                     mensagemReferencia vier preenchida, a IA ADAPTA
//                     aquele texto em instrução de ação, em vez de
//                     ignorar e escrever do zero.
//
// 22/10/2026: exige login de um membro da tabela `equipe`.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// ── Guarda de acesso (out/2026): só membros da equipe logados ─────────────
// Valida o token de sessão do usuário (Authorization: Bearer <access_token>)
// no Supabase Auth e confere se o e-mail está na tabela `equipe`.
// A chave pública (anon/publishable) NÃO é aceita como login.
async function exigirMembroEquipe(req: Request, cors: Record<string, string>): Promise<Response | null> {
  const negar = (status: number, msg: string) =>
    new Response(JSON.stringify({ error: msg }), { status, headers: { ...cors, "Content-Type": "application/json" } });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY") || service;
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return negar(401, "Faça login no sistema para usar esta função.");
    const u = await fetch(`${url}/auth/v1/user`, { headers: { apikey: anon, Authorization: `Bearer ${token}` } });
    if (!u.ok) return negar(401, "Sessão inválida ou expirada. Entre novamente no sistema.");
    const user = await u.json();
    const email = String(user?.email || "").trim().toLowerCase();
    if (!email) return negar(401, "Sessão sem e-mail. Entre novamente no sistema.");
    const r = await fetch(`${url}/rest/v1/equipe?select=id&email=ilike.${encodeURIComponent(email)}`, {
      headers: { apikey: service, Authorization: `Bearer ${service}` },
    });
    const rows = r.ok ? await r.json() : [];
    if (!Array.isArray(rows) || !rows.length) return negar(403, "Usuário sem acesso ao sistema.");
    return null;
  } catch (e) {
    return negar(500, "Falha ao validar acesso: " + String(e));
  }
}

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const VARIAVEIS_DISPONIVEIS = [
  "{nome}", "{cidade}", "{dias_parado}", "{ultima_peca}", "{ultima_collab}", "{valor_total_historico}"
];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  const negado = await exigirMembroEquipe(req, CORS_HEADERS);
  if (negado) return negado;

  try {
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "ANTHROPIC_API_KEY não configurada nos Secrets desta função." }),
        { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const {
      nomeCampanha, objetivo, beneficioTipo, beneficioValor, beneficioCondicoes,
      publicoConhecido, publicoTemperatura, canaisSelecionados, estrategiaCanal, tipo, mensagemReferencia
    } = body || {};
    const ehTarefa = tipo === "tarefa";

    const contexto = [
      `Nome da campanha: ${nomeCampanha || "(sem nome)"}`,
      objetivo ? `Objetivo: ${objetivo}` : null,
      beneficioTipo && beneficioTipo !== "nenhum" ? `Benefício oferecido: ${beneficioTipo}${beneficioValor ? " — " + beneficioValor : ""}${beneficioCondicoes ? " (" + beneficioCondicoes + ")" : ""}` : null,
      publicoConhecido ? `Público: ${publicoConhecido}` : null,
      publicoTemperatura ? `Temperatura do público: ${publicoTemperatura}` : null,
      canaisSelecionados && canaisSelecionados.length ? `Canais: ${canaisSelecionados.join(", ")}` : null,
      estrategiaCanal ? `Estratégia: ${estrategiaCanal}` : null,
    ].filter(Boolean).join("\n");

    const prompt = ehTarefa
      ? `Você está escrevendo um MOLDE de DESCRIÇÃO DE TAREFA para a equipe comercial da Ciclo da Arte (marca de moda/acessórios e merchandising cultural) seguir — é uma instrução INTERNA pro vendedor, NUNCA é enviada ao cliente.

Contexto da campanha:
${contexto}
${mensagemReferencia ? `\nA mensagem que será enviada ao cliente nesta campanha é esta (use como REFERÊNCIA do que a ação deve cobrir — ADAPTE pra virar instrução de ação pro vendedor, NÃO copie o texto como está):\n"${mensagemReferencia}"\n` : ''}
Regras OBRIGATÓRIAS:
- Escreva em português do Brasil, direto e objetivo, no máximo 2 frases (é uma instrução de trabalho, não uma mensagem de venda).
- Use OBRIGATORIAMENTE estas variáveis literais, exatamente como estão escritas (com as chaves {}), NUNCA as substitua por um valor: ${VARIAVEIS_DISPONIVEIS.join(", ")}.
- Use pelo menos {nome}. Use as outras só se fizer sentido.
- Descreva a AÇÃO que o vendedor deve tomar (ex: ligar, mandar mensagem, oferecer algo específico do contexto acima) — NUNCA reproduza a mensagem do cliente palavra por palavra, escreva a instrução pro vendedor.
- Não use emoji.
- Responda APENAS com o texto da instrução, sem explicação, sem aspas, sem markdown.`
      : `Você está escrevendo um MOLDE de mensagem de WhatsApp para a Ciclo da Arte, uma marca brasileira de moda/acessórios e merchandising cultural (parcerias com artistas/collabs).

Contexto da campanha:
${contexto}

Regras OBRIGATÓRIAS:
- Escreva em português do Brasil, tom caloroso e pessoal, no máximo 4 frases.
- Use OBRIGATORIAMENTE estas variáveis literais, exatamente como estão escritas (com as chaves {}), NUNCA as substitua por um valor: ${VARIAVEIS_DISPONIVEIS.join(", ")}.
- Use pelo menos {nome} e {ultima_peca}. Use as outras variáveis só se fizer sentido pro contexto.
- Não invente desconto/valor que não esteja no contexto acima.
- Não use emoji em excesso (no máximo 1).
- Responda APENAS com o texto da mensagem, sem explicação, sem aspas, sem markdown.`;

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 300,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return new Response(
        JSON.stringify({ error: "Erro na API da Anthropic: " + errText }),
        { status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const data = await resp.json();
    const texto = (data.content || []).map((b: any) => b.text || "").join("").trim();

    return new Response(JSON.stringify({ texto }), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});

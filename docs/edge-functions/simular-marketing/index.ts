// Edge Function: simular-marketing (v3 — exige login de membro da equipe)
// Busca o histórico real de campanhas (últimos 3 meses + acumulado total)
// por canal, monta um contexto de negócio (Ciclo da Arte — moda/merchandising
// em collab com artistas), chama a API da Anthropic (Claude) pedindo uma
// sugestão de alocação de orçamento por canal + ações recomendadas, e grava
// o resultado em cda_marketing_simulacoes.
//
// Se "id" vier no body, SOBRESCREVE a simulação existente (refazer) em vez
// de criar uma nova.
//
// v3 (22/10/2026): exige Authorization com o token de sessão de um usuário
// cadastrado na tabela `equipe` (antes aceitava qualquer chamada).

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

Deno.serve(async (req: Request) => {
  const CORS_HEADERS: Record<string, string> = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  const negado = await exigirMembroEquipe(req, CORS_HEADERS);
  if (negado) return negado;

  try {
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY não configurada nos Secrets do Supabase." }), { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!;
    const sbHeaders = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` };

    const body = await req.json();
    const id: number | null = body.id ? Number(body.id) : null;
    const nome: string = body.nome;
    const orcamentoTotal: number = Number(body.orcamento_total);
    const periodo: string = body.periodo || "";
    const descricao: string = body.descricao || "";

    if (!nome || !orcamentoTotal) {
      return new Response(JSON.stringify({ error: "nome e orcamento_total são obrigatórios." }), { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
    }

    // ── 1) Buscar dados reais ──────────────────────────────────────────
    async function sbGet(path: string) {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: sbHeaders });
      if (!r.ok) throw new Error(`Erro ao buscar ${path}: ${r.status} ${await r.text()}`);
      return r.json();
    }

    const [campanhas, metricas, canais] = await Promise.all([
      sbGet("cda_marketing_campanhas?select=id,nome,canal_id,status,objetivo"),
      sbGet("cda_marketing_metricas?select=campanha_id,data,investimento,receita,conversoes,cliques,impressoes"),
      sbGet("canais?select=id,nome"),
    ]);

    const campPorId: Record<string, any> = {};
    for (const c of campanhas) campPorId[c.id] = c;
    const canalPorId: Record<string, any> = {};
    for (const c of canais) canalPorId[c.id] = c;

    const tresMesesAtras = new Date();
    tresMesesAtras.setMonth(tresMesesAtras.getMonth() - 3);
    const tresMesesIso = tresMesesAtras.toISOString().substring(0, 10);

    function agregarPorCanal(soment3m: boolean) {
      const acc: Record<string, { spend: number; revenue: number; conv: number; canalNome: string }> = {};
      for (const m of metricas) {
        if (soment3m && m.data.substring(0, 10) < tresMesesIso) continue;
        const camp = campPorId[m.campanha_id];
        const canalId = camp ? camp.canal_id : null;
        const key = canalId || "sem-canal";
        const canalNome = canalId && canalPorId[canalId] ? canalPorId[canalId].nome : "Sem canal específico";
        if (!acc[key]) acc[key] = { spend: 0, revenue: 0, conv: 0, canalNome };
        acc[key].spend += Number(m.investimento || 0);
        acc[key].revenue += Number(m.receita || 0);
        acc[key].conv += Number(m.conversoes || 0);
      }
      return Object.entries(acc).map(([canalId, v]) => ({
        canal: v.canalNome,
        investido: Math.round(v.spend * 100) / 100,
        receita: Math.round(v.revenue * 100) / 100,
        roas: v.spend > 0 ? Math.round((v.revenue / v.spend) * 100) / 100 : 0,
        conversoes: v.conv,
      })).sort((a, b) => b.investido - a.investido);
    }

    const dados3meses = agregarPorCanal(true);
    const dadosTotal = agregarPorCanal(false);

    // ── 2) Montar prompt e chamar Claude ────────────────────────────────
    const systemPrompt = `Você é um analista de mídia paga especializado em moda/merchandising cultural em collab com artistas (o negócio é a Ciclo da Arte — cada canal geralmente corresponde a um artista/parceiro: shows, e-commerce próprio do artista, etc). Diferente de e-commerce genérico, o investimento é fortemente orientado a eventos específicos (lançamento de coleção, agenda de shows), não sazonalidade de mercado tradicional.

Você vai receber: (a) performance dos últimos 3 meses por canal — sinal principal; (b) performance histórica total por canal — contexto secundário, útil para não penalizar um canal que teve um mês fraco por falta de agenda de eventos, não por fraqueza real do canal.

Responda EXCLUSIVAMENTE em JSON válido, sem nenhum texto antes ou depois, seguindo este schema exato:
{
  "alocacoes": [ { "canal": "string", "percentual": number, "valor": number, "justificativa": "string curta" } ],
  "acoes_sugeridas": [ "string com ação concreta e específica" ],
  "roas_esperado": number,
  "receita_esperada": number,
  "resumo": "string — 2-3 frases de síntese da estratégia recomendada"
}
Os percentuais em "alocacoes" devem somar 100. Os valores em "valor" devem somar o orçamento total informado. Seja específico nas justificativas e ações — cite números reais dos dados recebidos.`;

    const userPrompt = `Orçamento a alocar: R$ ${orcamentoTotal.toFixed(2)}
Período: ${periodo || "não especificado"}
${descricao ? `Contexto adicional informado pelo usuário: ${descricao}\n` : ""}
Performance dos últimos 3 meses por canal:
${JSON.stringify(dados3meses, null, 2)}

Performance histórica total (todos os meses disponíveis) por canal:
${JSON.stringify(dadosTotal, null, 2)}

Gere a sugestão de alocação de orçamento seguindo o schema JSON especificado.`;

    const claudeResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!claudeResp.ok) {
      const errText = await claudeResp.text();
      return new Response(JSON.stringify({ error: `Erro na API da Anthropic (${claudeResp.status}): ${errText}` }), { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
    }
    const claudeData = await claudeResp.json();
    const textoResposta = (claudeData.content || []).map((b: any) => b.text || "").join("\n").trim();

    let parsed: any;
    try {
      const limpo = textoResposta.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
      parsed = JSON.parse(limpo);
    } catch (e) {
      return new Response(JSON.stringify({ error: "A IA não retornou um JSON válido.", resposta_bruta: textoResposta }), { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
    }

    // ── 3) Gravar (insert) ou sobrescrever (update, se id veio) ────────
    const sugestaoTexto = [
      parsed.resumo || "",
      "",
      "Ações sugeridas:",
      ...(parsed.acoes_sugeridas || []).map((a: string) => "• " + a),
    ].join("\n");

    const payload = {
      nome,
      descricao: descricao || null,
      orcamento_total: orcamentoTotal,
      periodo,
      status: "ativa",
      alocacoes: parsed.alocacoes || [],
      sugestao_ia: sugestaoTexto,
      sugestao_ia_gerada_em: new Date().toISOString(),
      roas_esperado: parsed.roas_esperado || null,
      receita_esperada: parsed.receita_esperada || null,
    };

    let saveResp: Response;
    if (id) {
      saveResp = await fetch(`${SUPABASE_URL}/rest/v1/cda_marketing_simulacoes?id=eq.${id}`, {
        method: "PATCH",
        headers: { ...sbHeaders, "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify({ ...payload, atualizado_em: new Date().toISOString() }),
      });
    } else {
      saveResp = await fetch(`${SUPABASE_URL}/rest/v1/cda_marketing_simulacoes`, {
        method: "POST",
        headers: { ...sbHeaders, "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify(payload),
      });
    }
    if (!saveResp.ok) {
      const errText = await saveResp.text();
      return new Response(JSON.stringify({ error: `Erro ao gravar simulação: ${errText}` }), { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
    }
    const saved = await saveResp.json();

    return new Response(JSON.stringify({ ok: true, simulacao: saved[0] }), { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
  }
});

// Edge Function: sync-meta-ads (v5)
// Sincroniza campanhas e métricas da conta de anúncios do Meta Ads.
//
// Política: ATUALIZA campanhas já existentes (match por meta_campaign_id) e
// grava métricas para elas. Campanhas do Meta que NÃO existem no nosso banco
// NÃO são criadas automaticamente — apenas listadas na resposta, para revisão
// manual (evita popular o sistema com histórico antigo/testes sem canal).
//
// Token: lido de Deno.env("META_ACCESS_TOKEN"). Aceita "token" no body como
// fallback TEMPORÁRIO para testes antes do Secret estar configurado.
//
// v4 — CORREÇÃO DE BUG CRÍTICO (25/08/2026):
// A versão anterior buscava métricas com date_preset=last_30d (acumulado
// rolante dos últimos 30 dias) e gravava isso como UMA linha datada de "hoje".
// Como o dashboard SOMA todas as linhas do mês por campanha, cada sincronização
// adicional no mesmo mês somava o mesmo período de novo, inflando "Gasto até
// hoje" e "Receita" proporcionalmente ao número de sincronizações manuais.
// Agora a busca usa time_range + time_increment=1, trazendo UMA linha por DIA
// por campanha, com o valor real daquele dia — e o intervalo sincronizado é
// apagado e regravado por completo a cada execução (idempotente).
//
// v5 (22/10/2026): exige login de um membro da tabela `equipe`.

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
  const CORS: Record<string, string> = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const negado = await exigirMembroEquipe(req, CORS);
  if (negado) return negado;

  try {
    let bodyToken: string | null = null;
    let adAccountOverride: string | null = null;
    let sinceOverride: string | null = null;
    let untilOverride: string | null = null;
    try {
      const body = await req.json();
      bodyToken = body.token || null;
      adAccountOverride = body.ad_account_id || null;
      sinceOverride = body.since || null; // "YYYY-MM-DD" opcional, para re-sincronizar mês fechado
      untilOverride = body.until || null; // "YYYY-MM-DD" opcional
    } catch (_) { /* sem body, ok */ }

    const TOKEN = Deno.env.get("META_ACCESS_TOKEN") || bodyToken;
    if (!TOKEN) {
      return new Response(JSON.stringify({ error: "Nenhum token disponível. Configure o Secret META_ACCESS_TOKEN ou passe {token} no body para teste." }), { status: 400, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!;
    const sbHeaders = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` };

    async function sbGet(path: string) {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: sbHeaders });
      if (!r.ok) throw new Error(`sbGet ${path}: ${r.status} ${await r.text()}`);
      return r.json();
    }

    const configRows = await sbGet("cda_marketing_meta_config?select=*&id=eq.1");
    const config = configRows[0] || {};
    const AD_ACCOUNT = adAccountOverride || config.ad_account_id || "3027130010902338";

    // ── Intervalo padrão: dia 1º do mês corrente até hoje (fuso UTC) ──
    const agora = new Date();
    const hojeStr = agora.toISOString().substring(0, 10); // YYYY-MM-DD
    const primeiroDiaMesStr = `${agora.getUTCFullYear()}-${String(agora.getUTCMonth() + 1).padStart(2, "0")}-01`;
    const SINCE = sinceOverride || primeiroDiaMesStr;
    const UNTIL = untilOverride || hojeStr;

    // ── 1) Buscar campanhas na conta do Meta ──────────────────
    const campUrl = `https://graph.facebook.com/v19.0/act_${AD_ACCOUNT}/campaigns?fields=id,name,status,objective,daily_budget,lifetime_budget,start_time,stop_time&limit=200&access_token=${TOKEN}`;
    const campResp = await fetch(campUrl);
    const campData = await campResp.json();
    if (campData.error) {
      return new Response(JSON.stringify({ error: "Erro ao buscar campanhas no Meta: " + campData.error.message }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
    }
    const metaCampanhas = campData.data || [];

    // ── 2) Buscar campanhas já cadastradas no nosso banco ───────────
    const nossasCampanhas = await sbGet("cda_marketing_campanhas?select=id,meta_campaign_id,nome");
    const porMetaId: Record<string, any> = {};
    for (const c of nossasCampanhas) if (c.meta_campaign_id) porMetaId[c.meta_campaign_id] = c;

    const statusMap: Record<string, string> = { ACTIVE: "ativa", PAUSED: "pausada", DELETED: "arquivada", ARCHIVED: "arquivada" };

    let campanhasAtualizadas = 0;
    const novasEncontradas: any[] = [];
    for (const mc of metaCampanhas) {
      const existente = porMetaId[mc.id];
      const statusNosso = statusMap[mc.status] || "rascunho";
      if (existente) {
        await fetch(`${SUPABASE_URL}/rest/v1/cda_marketing_campanhas?id=eq.${existente.id}`, {
          method: "PATCH",
          headers: { ...sbHeaders, "Content-Type": "application/json" },
          body: JSON.stringify({ status: statusNosso, atualizado_em: new Date().toISOString() }),
        });
        campanhasAtualizadas++;
      } else {
        novasEncontradas.push({ meta_campaign_id: mc.id, nome: mc.name, status: mc.status });
      }
    }

    // ── 3) Buscar métricas (insights) DIÁRIAS do intervalo [SINCE, UNTIL] ──
    // time_increment=1 faz o Meta devolver uma linha por dia por campanha,
    // em vez de um acumulado rolante — corrige o bug de duplicação por soma.
    const timeRange = encodeURIComponent(JSON.stringify({ since: SINCE, until: UNTIL }));
    const insightsUrl = `https://graph.facebook.com/v19.0/act_${AD_ACCOUNT}/insights?level=campaign&fields=campaign_id,spend,impressions,clicks,reach,ctr,cpc,cpm,actions,action_values&time_range=${timeRange}&time_increment=1&limit=500&access_token=${TOKEN}`;
    const insightsResp = await fetch(insightsUrl);
    const insightsData = await insightsResp.json();
    if (insightsData.error) {
      return new Response(JSON.stringify({ error: "Erro ao buscar métricas no Meta: " + insightsData.error.message }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
    }
    const insights = insightsData.data || [];

    const agoraIso = agora.toISOString();

    // ── Limpa todo o intervalo sincronizado, por campanha, ANTES de regravar ──
    // (idempotente: rodar de novo no mesmo intervalo sobrescreve, nunca duplica)
    const idsCampanhasNoIntervalo = new Set<number>();
    for (const ins of insights) {
      const existente = porMetaId[ins.campaign_id];
      if (existente) idsCampanhasNoIntervalo.add(existente.id);
    }
    for (const campanhaId of idsCampanhasNoIntervalo) {
      await fetch(`${SUPABASE_URL}/rest/v1/cda_marketing_metricas?campanha_id=eq.${campanhaId}&origem=eq.meta_api&data=gte.${SINCE}&data=lte.${UNTIL}`, {
        method: "DELETE", headers: sbHeaders,
      });
    }

    let metricasGravadas = 0;
    const linhasParaInserir: any[] = [];
    for (const ins of insights) {
      const existente = porMetaId[ins.campaign_id];
      if (!existente) continue; // só grava métrica de campanha que já existe no nosso banco
      const campanhaId = existente.id;

      const spend = Number(ins.spend || 0);
      const impressoes = Number(ins.impressions || 0);
      const cliques = Number(ins.clicks || 0);
      const alcance = Number(ins.reach || 0);
      const acoesCompra = (ins.actions || []).find((a: any) => a.action_type === "omni_purchase" || a.action_type === "purchase");
      const conversoes = acoesCompra ? Number(acoesCompra.value) : 0;
      const valoresCompra = (ins.action_values || []).find((a: any) => a.action_type === "omni_purchase" || a.action_type === "purchase");
      const receita = valoresCompra ? Number(valoresCompra.value) : 0;
      const roas = spend > 0 ? receita / spend : 0;
      const cac = conversoes > 0 ? spend / conversoes : 0;
      const taxaConversao = cliques > 0 ? (conversoes / cliques) * 100 : 0;

      // ins.date_start = dia real do insight (YYYY-MM-DD), graças a time_increment=1
      const dataDoRegistro = ins.date_start || SINCE;

      linhasParaInserir.push({
        campanha_id: campanhaId, data: dataDoRegistro, impressoes, alcance, cliques, investimento: spend,
        conversoes, receita, cpc: Number(ins.cpc || 0), cpm: Number(ins.cpm || 0), ctr: Number(ins.ctr || 0),
        taxa_conversao: taxaConversao, roas, cac, origem: "meta_api", criado_em: agoraIso,
      });
      metricasGravadas++;
    }

    if (linhasParaInserir.length > 0) {
      await fetch(`${SUPABASE_URL}/rest/v1/cda_marketing_metricas`, {
        method: "POST",
        headers: { ...sbHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify(linhasParaInserir),
      });
    }

    // ── 4) Atualizar status da config ───────────────────────
    await fetch(`${SUPABASE_URL}/rest/v1/cda_marketing_meta_config?id=eq.1`, {
      method: "PATCH",
      headers: { ...sbHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ conectado: true, ultima_sincronizacao: agoraIso, status_sincronizacao: "ok", ad_account_id: AD_ACCOUNT, atualizado_em: agoraIso }),
    });

    return new Response(JSON.stringify({
      ok: true,
      periodo_sincronizado: { since: SINCE, until: UNTIL },
      campanhas_no_meta: metaCampanhas.length,
      campanhas_atualizadas: campanhasAtualizadas,
      metricas_gravadas: metricasGravadas,
      novas_encontradas: novasEncontradas.slice(0, 100),
      total_novas_encontradas: novasEncontradas.length,
    }), { headers: { ...CORS, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
  }
});

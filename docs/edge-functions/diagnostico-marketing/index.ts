// Edge Function: diagnostico-marketing (v17 — exige login de membro da equipe)
// v16 — periodo dinamico, identidade tipo+periodo, tabela generica por tipo
// v17 (22/10/2026): exige Authorization com token de sessão de usuário da tabela `equipe`.

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
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY nao configurada." }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
    }
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!;
    const sbHeaders = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` };

    const ACOES_VALIDAS = ["manter", "revisar", "pausar", "reativar", "escalar", "proteger_orcamento", "aguardar_agenda"];
    const CANAL_PRIVATE_LABEL_ID = "1778540708657";
    const ANO_MVP_MINIMO = 2023; // MVP em jul/2022 — 2022 excluido de comparacoes A/A por desvio estatistico

    async function sbGet(path: string) {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: sbHeaders });
      if (!r.ok) throw new Error(`sbGet ${path}: ${r.status} ${await r.text()}`);
      return r.json();
    }
    async function chamarClaude(system: string, userMsg: string) {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 4000, system, messages: [{ role: "user", content: userMsg }] }),
      });
      if (!resp.ok) throw new Error(`Anthropic API: ${resp.status} ${await resp.text()}`);
      const data = await resp.json();
      const texto = (data.content || []).map((b: any) => b.text || "").join("\n").trim();
      const limpo = texto.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
      try {
        return JSON.parse(limpo);
      } catch (e) {
        throw new Error(`A IA retornou um JSON invalido ou incompleto (possivel corte por limite de tokens): ${String(e)}`);
      }
    }

    function fmtMoeda(v: number) {
      return "R$ " + Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    function ultimoDiaMes(anoMes: string) {
      const [ano, mes] = anoMes.split("-").map(Number);
      const d = new Date(Date.UTC(ano, mes, 0));
      return anoMes + "-" + String(d.getUTCDate()).padStart(2, "0");
    }
    function deslocarAnos(anoMes: string, deslocamento: number) {
      const [ano, mes] = anoMes.split("-").map(Number);
      return (ano - deslocamento) + "-" + String(mes).padStart(2, "0");
    }
    const NOMES_MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
    function rotuloPeriodo(inicio: string, fim: string) {
      const [aIni, mIni] = inicio.split("-").map(Number);
      const [aFim, mFim] = fim.split("-").map(Number);
      if (inicio === fim) return NOMES_MES[mIni - 1] + "/" + aIni;
      if (aIni === aFim) return NOMES_MES[mIni - 1] + "-" + NOMES_MES[mFim - 1] + " " + aFim;
      return NOMES_MES[mIni - 1] + "/" + aIni + " a " + NOMES_MES[mFim - 1] + "/" + aFim;
    }

    const body = await req.json();
    const acao = body.acao; // 'iniciar' | 'continuar'

    const MARKET_CONTEXT = `Contexto de mercado (Meta Ads, moda/e-commerce, Brasil, 2026):
- CTR saudavel para moda: 1,8% a 2,9% (moda tem CTR mais alto que a media geral do mercado)
- ROAS saudavel para moda: 2,2x a 3,0x normal; top 25% chega a 4,4x; elite 6x+
- Fadiga de criativo: vida media de um criativo e de ~8 dias antes de cair performance
- Sinal de fadiga: Frequencia (impressoes/alcance) acima de 3,5 OU queda de CTR de 25%+ em relacao ao pico
- UGC/conteudo autentico supera anuncio produzido: +48% CTR, -26% custo por resultado
- Sazonalidade fim de ano (moda/e-commerce Brasil): CPM sobe tipicamente 35-41% em novembro-dezembro por concorrencia de leilao (Black Friday, Natal); benchmark de MERCADO, nao leitura de dado interno (nosso Meta Ads e snapshot agregado por campanha, sem serie diaria)
- Recomendacao pratica: trocar criativo quando os sinais de fadiga aparecem, mesmo com orcamento disponivel`;

    if (acao === "iniciar") {
      const tipo = body.tipo || "fadiga_criativo";
      const nomeTipo = body.nome_tipo || "Diagnóstico";
      const periodoSolicitado = body.periodo_solicitado; // {inicio:'YYYY-MM', fim:'YYYY-MM'}
      const statusFiltro = body.status_filtro || "todos";
      if (!periodoSolicitado || !periodoSolicitado.inicio || !periodoSolicitado.fim) {
        return new Response(JSON.stringify({ error: "periodo_solicitado {inicio, fim} obrigatorio" }), { status: 400, headers: { ...CORS, "Content-Type": "application/json" } });
      }
      const inicio = periodoSolicitado.inicio, fim = periodoSolicitado.fim;
      if (inicio > fim) {
        return new Response(JSON.stringify({ error: "periodo invalido: inicio posterior ao fim" }), { status: 400, headers: { ...CORS, "Content-Type": "application/json" } });
      }
      const rotulo = rotuloPeriodo(inicio, fim);
      const periodoCompleto = { inicio, fim, rotulo };
      const dataInicioSql = inicio + "-01";
      const dataFimSql = ultimoDiaMes(fim);

      let linhas: any[] = [];
      let statusPorItem: Record<string, string> = {};
      let system = "";
      let userMsg = "";

      // ===================== FADIGA DE CRIATIVO =====================
      if (tipo === "fadiga_criativo") {
        const campanhasQS = statusFiltro !== "todos"
          ? `cda_marketing_campanhas?select=id,nome,status,objetivo,canal_id&status=eq.${statusFiltro}`
          : "cda_marketing_campanhas?select=id,nome,status,objetivo,canal_id";
        const [campanhas, metricas, canais] = await Promise.all([
          sbGet(campanhasQS),
          sbGet("cda_marketing_metricas?select=campanha_id,data,impressoes,alcance,cliques,investimento,receita"),
          sbGet("canais?select=id,nome"),
        ]);
        const campPorId: Record<string, any> = {}; for (const c of campanhas) campPorId[c.id] = c;
        const canalPorId: Record<string, any> = {}; for (const c of canais) canalPorId[c.id] = c;

        const porCampanha: Record<string, any[]> = {};
        for (const m of metricas) {
          if (!campPorId[m.campanha_id]) continue;
          if (!porCampanha[m.campanha_id]) porCampanha[m.campanha_id] = [];
          porCampanha[m.campanha_id].push(m);
        }

        for (const campId of Object.keys(porCampanha)) {
          const lista = porCampanha[campId].sort((a, b) => a.data.localeCompare(b.data));
          const doPeriodo = lista.filter((m) => m.data.substring(0, 7) >= inicio && m.data.substring(0, 7) <= fim);
          if (!doPeriodo.length) continue;
          const primeiro = lista[0];

          const impP = doPeriodo.reduce((s, m) => s + Number(m.impressoes || 0), 0);
          const alcP = doPeriodo.reduce((s, m) => s + Number(m.alcance || 0), 0);
          const cliP = doPeriodo.reduce((s, m) => s + Number(m.cliques || 0), 0);
          const spendP = doPeriodo.reduce((s, m) => s + Number(m.investimento || 0), 0);
          const revP = doPeriodo.reduce((s, m) => s + Number(m.receita || 0), 0);
          const freq = alcP > 0 ? impP / alcP : 0;
          const ctrAtual = impP > 0 ? (cliP / impP) * 100 : 0;
          const ctrPico = Number(primeiro.impressoes || 0) > 0 ? (Number(primeiro.cliques || 0) / Number(primeiro.impressoes || 0)) * 100 : ctrAtual;
          const variacaoCtr = ctrPico > 0 ? ((ctrAtual - ctrPico) / ctrPico) * 100 : 0;
          const sinalFadiga = freq > 3.5 || variacaoCtr <= -25;
          const roasP = spendP > 0 ? revP / spendP : 0;

          const camp = campPorId[campId];
          const canalNome = camp && camp.canal_id && canalPorId[camp.canal_id] ? canalPorId[camp.canal_id].nome : null;
          const statusLabel = camp && camp.status === "ativo" ? "ativa" : "pausada";
          linhas.push({
            item: camp ? camp.nome : ("#" + campId), campanha: camp ? camp.nome : ("#" + campId),
            status: statusLabel, filtro_valor: statusLabel, status_label: statusLabel === "ativa" ? "Ativa" : "Pausada",
            objetivo: camp ? camp.objetivo : null, canal: canalNome,
            gasto_real: Number(spendP.toFixed(2)), gasto_fmt: fmtMoeda(spendP),
            receita_real: Number(revP.toFixed(2)), receita_fmt: fmtMoeda(revP),
            roas_mes: Number(roasP.toFixed(2)), roas_fmt: roasP.toFixed(2) + "x",
            frequencia: Number(freq.toFixed(2)), frequencia_fmt: freq.toFixed(2) + " (mercado: até 3,5)",
            ctr_atual: Number(ctrAtual.toFixed(2)), ctr_atual_fmt: ctrAtual.toFixed(2) + "% (mercado: 1,8-2,9%)",
            ctr_pico_mes_inicial: Number(ctrPico.toFixed(2)), ctr_pico_fmt: ctrPico.toFixed(2) + "%",
            variacao_ctr_pct: Number(variacaoCtr.toFixed(1)), variacao_fmt: (variacaoCtr > 0 ? "+" : "") + variacaoCtr.toFixed(1) + "%",
            sinal_fadiga: sinalFadiga, sinal_fmt: sinalFadiga ? "⚠️ Fadiga" : "✅ OK",
          });
        }
        linhas.sort((a, b) => (b.sinal_fadiga ? 1 : 0) - (a.sinal_fadiga ? 1 : 0));
        for (const l of linhas) statusPorItem[l.item] = l.filtro_valor;

        system = `Voce e um analista de midia paga da Ciclo da Arte (moda/merchandising cultural, collabs com artistas). ${MARKET_CONTEXT}\n\nAnalise a tabela de Fadiga de Criativo recebida (periodo: ${rotulo}) e responda EXCLUSIVAMENTE em JSON, sem texto fora do JSON e sem markdown dentro das strings, no schema:\n{\n  "resumo": "string CURTA (1-2 frases) - visao geral do periodo",\n  "itens": [\n    {\n      "item": "nome EXATO da campanha, identico ao da tabela recebida",\n      "analise": "string CURTA (1-3 frases) com a analise e sugestao especifica, citando numeros reais",\n      "acao_sugerida": "uma destas strings exatas: manter | revisar | pausar | reativar | escalar"\n    }\n  ], // OBRIGATORIO: UMA entrada para CADA campanha da tabela recebida\n  "perguntas": [{"texto": "pergunta especifica", "item": "nome exato da campanha OU null se geral"}],\n  "acoes_finais": "string OBRIGATORIA (NUNCA null) - plano de acao ATUAL por campanha/prioridade",\n  "finalizar": false\n}`;
        userMsg = `Periodo: ${rotulo} (${inicio} a ${fim})\nFiltro de status aplicado: ${statusFiltro}\n\nTabela Fadiga de Criativo:\n${JSON.stringify(linhas, null, 2)}`;
      }

      // ===================== CALENDARIO ANUAL (SAZONAL) =====================
      else if (tipo === "calendario_sazonal") {
        const [compras, canais] = await Promise.all([
          sbGet(`compras?select=canal_id,valor_total,data_compra&data_compra=gte.${deslocarAnos(inicio, 2)}-01&data_compra=lte.${ultimoDiaMes(fim)}`),
          sbGet("canais?select=id,nome"),
        ]);
        const canalPorId: Record<string, any> = {}; for (const c of canais) canalPorId[c.id] = c;

        const anoAtual = Number(inicio.split("-")[0]);
        const rangeAtualIni = inicio, rangeAtualFim = ultimoDiaMes(fim);
        const rangeAnteriorIni = deslocarAnos(inicio, 1), rangeAnteriorFim = ultimoDiaMes(deslocarAnos(fim, 1));

        const porCanal: Record<string, { atual: number; anterior: number; canalId: string }> = {};
        for (const c of compras) {
          if (String(c.canal_id) === CANAL_PRIVATE_LABEL_ID) continue;
          const dataStr = String(c.data_compra).substring(0, 10);
          const nomeCanal = canalPorId[c.canal_id] ? canalPorId[c.canal_id].nome : ("Canal #" + c.canal_id);
          if (!porCanal[nomeCanal]) porCanal[nomeCanal] = { atual: 0, anterior: 0, canalId: c.canal_id };
          if (dataStr >= rangeAtualIni + "-01" && dataStr <= rangeAtualFim) porCanal[nomeCanal].atual += Number(c.valor_total || 0);
          else if (dataStr >= rangeAnteriorIni + "-01" && dataStr <= rangeAnteriorFim && Number(rangeAnteriorIni.split("-")[0]) >= ANO_MVP_MINIMO) porCanal[nomeCanal].anterior += Number(c.valor_total || 0);
        }

        // Meta Ads do periodo atual, por canal (via campanhas)
        const campanhas = await sbGet("cda_marketing_campanhas?select=id,canal_id");
        const canalIdPorCampanha: Record<string, string> = {}; for (const c of campanhas) canalIdPorCampanha[c.id] = c.canal_id;
        const metricas = await sbGet(`cda_marketing_metricas?select=campanha_id,data,investimento,receita&data=gte.${rangeAtualIni}-01&data=lte.${rangeAtualFim}`);
        const investPorCanal: Record<string, { invest: number; rec: number }> = {};
        for (const m of metricas) {
          const canalId = canalIdPorCampanha[m.campanha_id];
          if (!canalId) continue;
          const nomeCanal = canalPorId[canalId] ? canalPorId[canalId].nome : ("Canal #" + canalId);
          if (!investPorCanal[nomeCanal]) investPorCanal[nomeCanal] = { invest: 0, rec: 0 };
          investPorCanal[nomeCanal].invest += Number(m.investimento || 0);
          investPorCanal[nomeCanal].rec += Number(m.receita || 0);
        }

        // Fase atual: primeiro mes do periodo = preparacao; resto = pico; fora do periodo = null
        const hoje = new Date();
        const mesHoje = hoje.getUTCFullYear() + "-" + String(hoje.getUTCMonth() + 1).padStart(2, "0");
        let faseAtual: string | null = null;
        if (mesHoje >= inicio && mesHoje <= fim) faseAtual = mesHoje === inicio ? "preparacao" : "pico";
        const faseLabel = faseAtual === "preparacao" ? "🔧 Preparação" : faseAtual === "pico" ? "🚀 Pico" : "Fora do período";

        for (const nomeCanal of Object.keys(porCanal)) {
          const dado = porCanal[nomeCanal];
          const invest = investPorCanal[nomeCanal] || { invest: 0, rec: 0 };
          const variacao = dado.anterior > 0 ? ((dado.atual - dado.anterior) / dado.anterior) * 100 : null;
          const roas = invest.invest > 0 ? invest.rec / invest.invest : 0;
          linhas.push({
            item: nomeCanal, canal: nomeCanal,
            fase: faseAtual, filtro_valor: faseAtual || "todos", fase_label: faseLabel,
            receita_ano_atual: Number(dado.atual.toFixed(2)), receita_ano_atual_fmt: fmtMoeda(dado.atual),
            receita_ano_anterior: Number(dado.anterior.toFixed(2)), receita_ano_anterior_fmt: dado.anterior > 0 ? fmtMoeda(dado.anterior) : "sem dado no ano anterior",
            variacao_aa_pct: variacao !== null ? Number(variacao.toFixed(1)) : null, variacao_aa_fmt: variacao !== null ? (variacao > 0 ? "+" : "") + variacao.toFixed(1) + "%" : "—",
            investimento_meta: Number(invest.invest.toFixed(2)), investimento_meta_fmt: fmtMoeda(invest.invest),
            roas_mes: Number(roas.toFixed(2)), roas_fmt: invest.invest > 0 ? roas.toFixed(2) + "x" : "—",
          });
        }
        linhas.sort((a, b) => b.receita_ano_atual - a.receita_ano_atual);
        for (const l of linhas) statusPorItem[l.item] = l.filtro_valor;

        system = `Voce e um analista de midia paga e performance de canais da Ciclo da Arte (moda/merchandising cultural, collabs com artistas). ${MARKET_CONTEXT}\n\nAnalise a tabela de Calendario Anual (comparacao ano-a-ano por canal, Bling excluindo Private Label + investimento Meta Ads do periodo atual) e responda EXCLUSIVAMENTE em JSON, sem markdown dentro das strings, no schema:\n{\n  "resumo": "string CURTA (1-2 frases) - visao geral do periodo ${rotulo}, fase atual: ${faseLabel}",\n  "itens": [\n    {\n      "item": "nome EXATO do canal, identico a tabela recebida",\n      "analise": "string CURTA (1-3 frases) citando numeros reais (receita atual vs ano anterior, investimento, ROAS)",\n      "acao_sugerida": "uma destas strings exatas: escalar | manter | revisar | proteger_orcamento | aguardar_agenda"\n    }\n  ], // OBRIGATORIO: UMA entrada para CADA canal da tabela\n  "perguntas": [{"texto": "pergunta especifica", "item": "nome exato do canal OU null se geral"}],\n  "acoes_finais": "string OBRIGATORIA (NUNCA null) - plano de acao por canal, considerando a fase atual (${faseLabel}): se Preparacao, foco em aquecer/testar; se Pico, foco em escalar o validado",\n  "finalizar": false\n}`;
        userMsg = `Periodo solicitado: ${rotulo} (${inicio} a ${fim})\nFase atual (hoje): ${faseLabel}\nComparacao ano-a-ano: ${rangeAtualIni} a ${rangeAtualFim} vs mesmo periodo ano anterior (${rangeAnteriorIni} a ${rangeAnteriorFim})\nNota: Private Label excluido (atacado, sem relacao com sazonalidade de calendario). Meta Ads e snapshot agregado por campanha, sem serie diaria.\n\nTabela por canal:\n${JSON.stringify(linhas, null, 2)}`;
      }

      else {
        return new Response(JSON.stringify({ error: `tipo desconhecido: ${tipo}` }), { status: 400, headers: { ...CORS, "Content-Type": "application/json" } });
      }

      const resultado = await chamarClaude(system, userMsg);

      const itensAnalise = (resultado.itens || []).map((c: any) => ({
        item: c.item, campanha: c.item, canal: c.item,
        filtro_valor: statusPorItem[c.item] || null,
        analise: c.analise,
        acao_sugerida: ACOES_VALIDAS.includes(c.acao_sugerida) ? c.acao_sugerida : "revisar",
      }));
      const perguntasIa = (resultado.perguntas || []).map((p: any, idx: number) => ({
        id: idx + 1, texto: p.texto, item: p.item || null, campanha: p.item || null, resposta_usuario: null, respondido_por: null,
      }));

      const payload = {
        tipo, titulo: nomeTipo + " — " + rotulo, mes_referencia: inicio, periodo_solicitado: periodoCompleto, filtro_aplicado: statusFiltro,
        tabela_comparativa: linhas, resumo: resultado.resumo || null, campanhas_analise: itensAnalise,
        perguntas_ia: perguntasIa, perguntas_usuario: [],
        acoes_finais: resultado.acoes_finais || null,
        status: resultado.finalizar ? "concluido" : "aberto", atualizado_em: new Date().toISOString(),
      };

      // Identidade = tipo + periodo (inicio+fim). Mesmo tipo com periodo diferente = novo registro.
      const existentes = await sbGet(`cda_marketing_diagnosticos?select=id&tipo=eq.${tipo}&periodo_solicitado->>inicio=eq.${inicio}&periodo_solicitado->>fim=eq.${fim}`);
      let resultRow: any;
      if (existentes.length) {
        const upResp = await fetch(`${SUPABASE_URL}/rest/v1/cda_marketing_diagnosticos?id=eq.${existentes[0].id}`, {
          method: "PATCH", headers: { ...sbHeaders, "Content-Type": "application/json", Prefer: "return=representation" },
          body: JSON.stringify(payload),
        });
        resultRow = (await upResp.json())[0];
      } else {
        const insResp = await fetch(`${SUPABASE_URL}/rest/v1/cda_marketing_diagnosticos`, {
          method: "POST", headers: { ...sbHeaders, "Content-Type": "application/json", Prefer: "return=representation" },
          body: JSON.stringify(payload),
        });
        resultRow = (await insResp.json())[0];
      }
      return new Response(JSON.stringify({ ok: true, diagnostico: resultRow }), { headers: { ...CORS, "Content-Type": "application/json" } });
    }

    if (acao === "continuar") {
      const id = body.id;
      const respostasUsuario = body.respostas_usuario || [];
      const novaPergunta = body.nova_pergunta || null;
      const usuarioNome = body.usuario_nome || "Usuário";
      if (!id) return new Response(JSON.stringify({ error: "id obrigatorio" }), { status: 400, headers: { ...CORS, "Content-Type": "application/json" } });
      if (!respostasUsuario.length && !novaPergunta) return new Response(JSON.stringify({ error: "nada para enviar (nenhuma resposta preenchida nem pergunta nova)" }), { status: 400, headers: { ...CORS, "Content-Type": "application/json" } });

      const rows = await sbGet(`cda_marketing_diagnosticos?select=*&id=eq.${id}`);
      const diag = rows[0];
      if (!diag) return new Response(JSON.stringify({ error: "diagnostico nao encontrado" }), { status: 404, headers: { ...CORS, "Content-Type": "application/json" } });

      var perguntasIa = diag.perguntas_ia || [];
      var perguntasUsuario = diag.perguntas_usuario || [];

      const respostasPorId: Record<string, string> = {};
      for (const r of respostasUsuario) respostasPorId[String(r.id)] = r.resposta;
      perguntasIa = perguntasIa.map((p: any) => respostasPorId[String(p.id)] !== undefined ? { ...p, resposta_usuario: respostasPorId[String(p.id)], respondido_por: usuarioNome } : p);

      const perguntasIaTextos = perguntasIa.map((p: any) => p.texto);
      const rotulo = diag.periodo_solicitado ? diag.periodo_solicitado.rotulo : diag.mes_referencia;

      const system = `Voce e um analista de midia paga e performance de canais da Ciclo da Arte. ${MARKET_CONTEXT}\n\nO usuario respondeu perguntas anteriores e/ou fez uma pergunta nova, como se fosse uma nova rodada da mesma conversa sobre o periodo ${rotulo}. Responda EXCLUSIVAMENTE em JSON, sem markdown dentro das strings, no schema: {"resposta_nova_pergunta": "string ou null - SE houver 'pergunta_nova_do_usuario' abaixo, responda-a diretamente aqui usando o contexto disponivel; se nao houver pergunta nova, deixe null", "novas_perguntas_ia": [{"texto": "pergunta nova", "item": "nome exato do item (campanha/canal) OU null se geral"}] // NUNCA repita, nem com palavras diferentes, nenhuma pergunta que ja esteja em 'perguntas_ia_ja_feitas'. Se nao houver nada novo relevante, retorne array vazio [], "acoes_finais": "string OBRIGATORIA (NUNCA null) - REGERE o plano de acao completo, incorporando TODAS as respostas e perguntas ja trocadas ate agora", "finalizar": boolean}`;
      const userMsg = `Tabela original:\n${JSON.stringify(diag.tabela_comparativa, null, 2)}\n\nPlano de acao anterior (se houver):\n${diag.acoes_finais || "(nenhum ainda)"}\n\nPerguntas da IA e respostas do usuario ate agora:\n${JSON.stringify(perguntasIa, null, 2)}\n\nPerguntas do usuario e respostas da IA ate agora:\n${JSON.stringify(perguntasUsuario, null, 2)}\n\nperguntas_ia_ja_feitas (NAO REPETIR, nem reformuladas):\n${JSON.stringify(perguntasIaTextos, null, 2)}\n\npergunta_nova_do_usuario: ${novaPergunta ? JSON.stringify(novaPergunta) : "null"}\n\nGere sua proxima resposta.`;
      const resultado = await chamarClaude(system, userMsg);

      if (novaPergunta) {
        const proximoId = perguntasUsuario.length ? Math.max(...perguntasUsuario.map((p: any) => p.id)) + 1 : 1;
        perguntasUsuario = [...perguntasUsuario, { id: proximoId, texto: novaPergunta, resposta_ia: resultado.resposta_nova_pergunta || null, perguntado_por: usuarioNome }];
      }
      if (resultado.novas_perguntas_ia && resultado.novas_perguntas_ia.length) {
        let proximoId = perguntasIa.length ? Math.max(...perguntasIa.map((p: any) => p.id)) + 1 : 1;
        const novas = resultado.novas_perguntas_ia.map((p: any) => ({ id: proximoId++, texto: p.texto, item: p.item || null, campanha: p.item || null, resposta_usuario: null, respondido_por: null }));
        perguntasIa = [...perguntasIa, ...novas];
      }

      const updateResp = await fetch(`${SUPABASE_URL}/rest/v1/cda_marketing_diagnosticos?id=eq.${id}`, {
        method: "PATCH", headers: { ...sbHeaders, "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify({
          perguntas_ia: perguntasIa, perguntas_usuario: perguntasUsuario,
          acoes_finais: resultado.acoes_finais || diag.acoes_finais,
          status: resultado.finalizar ? "concluido" : "aberto", atualizado_em: new Date().toISOString(),
        }),
      });
      const updated = await updateResp.json();
      return new Response(JSON.stringify({ ok: true, diagnostico: updated[0] }), { headers: { ...CORS, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "acao invalida. Use 'iniciar' ou 'continuar'." }), { status: 400, headers: { ...CORS, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
  }
});

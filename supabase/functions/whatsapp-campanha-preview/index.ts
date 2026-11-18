// Edge Function: whatsapp-campanha-preview (v3 · 18/11/2026 — envio por grupo; acesso técnico só para modelos)
// Projeto Marketing Meta · Etapa 3 (versão enxuta) — modelos (templates) e disparo de campanha por WhatsApp.
//
// Ações (body.acao):
//   templates          → sincroniza com a Meta os modelos da conta (status de aprovação) e devolve a lista
//   template_criar     → cria um modelo de MARKETING na Meta (cabeçalho com imagem opcional, corpo com {{1}} = nome,
//                        rodapé e botão de link) e grava em cda_whatsapp_templates  [admin]
//   preparar           → monta a fila do disparo para uma campanha (cda_wa_preparar_disparo)        [admin]
//   resumo             → números da fila, limite de 24h e custo previsto/realizado
//   enviar             → envia até N mensagens da fila (máx. 50 por chamada), respeitando o limite diário [admin]
//
// Segurança: login de membro da `equipe`; ações que gravam/enviam exigem administrador com escrita.
// Secrets: WHATSAPP_TOKEN. App: WHATSAPP_APP_ID (padrão: Ciclo Arte Conexão).

const G = "https://graph.facebook.com/v21.0";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_ID = Deno.env.get("WHATSAPP_APP_ID") || "2492882017905303";
const LIMITE_DIA = Number(Deno.env.get("WHATSAPP_LIMITE_DIA") || "250");
const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const sbH = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" };
const json = (s: number, b: unknown) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function sb(path: string, init: RequestInit = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers: { ...sbH, ...(init.headers || {}) } });
  const t = await r.text();
  if (!r.ok) throw new Error(`Banco: ${r.status} ${t}`);
  return t ? JSON.parse(t) : null;
}
const rpc = (nome: string, args: unknown) => sb(`rpc/${nome}`, { method: "POST", body: JSON.stringify(args) });

async function quem(req: Request) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const anon = Deno.env.get("SUPABASE_ANON_KEY") || SERVICE;
  const u = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: anon, Authorization: `Bearer ${token}` } });
  if (!u.ok) return null;
  const email = String((await u.json())?.email || "").trim().toLowerCase();
  if (!email) return null;
  const rows = await sb(`equipe?select=id,name,is_admin,permissao&email=ilike.${encodeURIComponent(email)}`);
  if (!rows?.length) return null;
  return { id: rows[0].id, nome: rows[0].name, admin: rows[0].is_admin === true && rows[0].permissao === "leitura_escrita" };
}

async function meta(path: string, token: string, init: RequestInit = {}) {
  const r = await fetch(`${G}/${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers || {}) } });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok && !j?.error, j };
}

// Sobe a imagem para a Meta (upload retomável) e devolve o "header_handle" exigido no modelo
async function subirImagemModelo(urlImagem: string, token: string) {
  const img = await fetch(urlImagem);
  if (!img.ok) throw new Error("Não consegui baixar a imagem do cabeçalho.");
  const bytes = new Uint8Array(await img.arrayBuffer());
  const tipo = (img.headers.get("content-type") || "image/jpeg").split(";")[0];
  const s = await fetch(`${G}/${APP_ID}/uploads?file_name=cabecalho&file_length=${bytes.length}&file_type=${encodeURIComponent(tipo)}`,
    { method: "POST", headers: { Authorization: `Bearer ${token}` } });
  const sj = await s.json();
  if (!sj?.id) throw new Error("Meta recusou a sessão de upload: " + JSON.stringify(sj?.error || sj));
  const u = await fetch(`${G}/${sj.id}`, { method: "POST", headers: { Authorization: `OAuth ${token}`, file_offset: "0" }, body: bytes });
  const uj = await u.json();
  if (!uj?.h) throw new Error("Meta recusou o upload da imagem: " + JSON.stringify(uj?.error || uj));
  return uj.h as string;
}

function primeiroNome(n: string | null) {
  const p = String(n || "").replace(/[()\[\]]/g, " ").trim().split(/\s+/)[0] || "";
  return p ? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() : "cliente";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { error: "Método não permitido." });
  // Acesso técnico (somente criar/listar modelos — nunca envia): cabeçalho x-diag = WHATSAPP_VERIFY_TOKEN
  const diag = Deno.env.get("WHATSAPP_VERIFY_TOKEN");
  const viaSistema = !!diag && req.headers.get("x-diag") === diag;
  const u = viaSistema ? { id: null as any, nome: "Claude (sistema)", admin: true } : await quem(req).catch(() => null);
  if (!u) return json(401, { error: "Faça login no sistema com um usuário da equipe." });
  const TOKEN = Deno.env.get("WHATSAPP_TOKEN");
  if (!TOKEN) return json(503, { error: "WHATSAPP_TOKEN não configurado." });

  let b: any = {};
  try { b = await req.json(); } catch { return json(400, { error: "JSON inválido." }); }
  const acao = String(b.acao || "");
  if (viaSistema && !["templates", "template_criar"].includes(acao)) return json(403, { error: "Ação não permitida por acesso técnico." });
  const exigeAdmin = ["template_criar", "preparar", "enviar"].includes(acao);
  if (exigeAdmin && !u.admin) return json(403, { error: "Somente administrador com permissão de escrita." });

  try {
    // número de campanhas ativo
    const numeros = await sb(`cda_whatsapp_numeros?select=id,phone_number_id,waba_id,funcao,numero_exibicao&ativo=eq.true&funcao=eq.campanhas&limit=1`);
    const num = numeros?.[0];
    if (!num?.waba_id) return json(422, { error: "Nenhum número de Campanhas ativo com conta (WABA) cadastrada." });

    if (acao === "templates") {
      const r = await meta(`${num.waba_id}/message_templates?fields=id,name,status,language,category,rejected_reason&limit=200`, TOKEN);
      if (!r.ok) return json(502, { error: "Meta: " + (r.j?.error?.message || "falha ao listar modelos") });
      for (const t of r.j.data || []) {
        await sb(`cda_whatsapp_templates?waba_id=eq.${num.waba_id}&nome=eq.${encodeURIComponent(t.name)}&idioma=eq.${encodeURIComponent(t.language)}`, {
          method: "PATCH", headers: { Prefer: "return=minimal" },
          body: JSON.stringify({ meta_template_id: t.id, status: t.status, categoria: t.category, motivo_rejeicao: t.rejected_reason && t.rejected_reason !== "NONE" ? t.rejected_reason : null, atualizado_em: new Date().toISOString() }),
        });
      }
      const lista = await sb(`cda_whatsapp_templates?waba_id=eq.${num.waba_id}&order=criado_em.desc`);
      return json(200, { ok: true, numero: num, templates: lista, meta: (r.j.data || []).map((t: any) => ({ nome: t.name, status: t.status, idioma: t.language, categoria: t.category })) });
    }

    if (acao === "template_criar") {
      const nome = String(b.nome || "").toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 60);
      const corpo = String(b.corpo || "").trim();
      if (!nome || !corpo) return json(400, { error: "Nome e corpo são obrigatórios." });
      if (!corpo.includes("{{1}}")) return json(400, { error: "O corpo precisa ter {{1}} (nome do cliente)." });
      const comps: any[] = [];
      if (b.cabecalho_imagem_url) {
        const h = await subirImagemModelo(String(b.cabecalho_imagem_url), TOKEN);
        comps.push({ type: "HEADER", format: "IMAGE", example: { header_handle: [h] } });
      }
      comps.push({ type: "BODY", text: corpo, example: { body_text: [["Maria"]] } });
      if (b.rodape) comps.push({ type: "FOOTER", text: String(b.rodape).slice(0, 60) });
      if (b.botao_texto && b.botao_url) comps.push({ type: "BUTTONS", buttons: [{ type: "URL", text: String(b.botao_texto).slice(0, 25), url: String(b.botao_url) }] });
      const r = await meta(`${num.waba_id}/message_templates`, TOKEN, {
        method: "POST", body: JSON.stringify({ name: nome, language: "pt_BR", category: "MARKETING", components: comps }),
      });
      if (!r.ok) return json(502, { error: "Meta recusou o modelo: " + (r.j?.error?.error_user_msg || r.j?.error?.message || JSON.stringify(r.j)) });
      const linha = await sb(`cda_whatsapp_templates?on_conflict=waba_id,nome,idioma`, {
        method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify({ waba_id: num.waba_id, meta_template_id: r.j.id, nome, idioma: "pt_BR", categoria: r.j.category || "MARKETING",
          status: r.j.status || "PENDING", corpo, rodape: b.rodape || null, botao_texto: b.botao_texto || null, botao_url: b.botao_url || null,
          cabecalho_imagem_url: b.cabecalho_imagem_url || null, campanha_id: b.campanha_id || null, criado_por: u.nome }),
      });
      return json(200, { ok: true, template: linha?.[0], meta: r.j });
    }

    if (acao === "preparar") {
      const campanhaId = Number(b.campanha_id);
      if (!campanhaId) return json(400, { error: "Campanha obrigatória." });
      const r = await rpc("cda_wa_preparar_disparo", { p_campanha: campanhaId, p_numero_id: num.id, p_nome: String(b.nome || "Disparo WhatsApp"), p_criterio: String(b.criterio || "vip_gold_premium"), p_usuario: u.nome });
      return json(200, { ok: true, ...r });
    }

    if (acao === "resumo") {
      const id = Number(b.disparo_id);
      const d = (await sb(`cda_whatsapp_disparos?id=eq.${id}&select=*`))?.[0];
      if (!d) return json(404, { error: "Disparo não encontrado." });
      const itens = await sb(`cda_whatsapp_disparo_itens?disparo_id=eq.${id}&select=estado,grupo&limit=20000`);
      const por: Record<string, number> = {}, grupos: Record<string, number> = {}, pendGrupo: Record<string, number> = {};
      for (const i of itens) {
        por[i.estado] = (por[i.estado] || 0) + 1; grupos[i.grupo || "—"] = (grupos[i.grupo || "—"] || 0) + 1;
        if (i.estado === "pendente") pendGrupo[i.grupo || "—"] = (pendGrupo[i.grupo || "—"] || 0) + 1;
      }
      const usados = Number(await rpc("cda_wa_contatos_24h", {}));
      const msgs = await sb(`cda_whatsapp_mensagens?campanha_id=eq.${d.campanha_id}&direcao=eq.saida&template_nome=not.is.null&select=status,cobravel`);
      const st: Record<string, number> = {};
      for (const m of msgs) st[m.status] = (st[m.status] || 0) + 1;
      const entregues = (st.entregue || 0) + (st.lida || 0);
      return json(200, { ok: true, disparo: d, por_estado: por, grupos, pendentes_por_grupo: pendGrupo, total: itens.length,
        limite_dia: LIMITE_DIA, usados_24h: usados, disponivel_hoje: Math.max(0, LIMITE_DIA - usados),
        custo_previsto: Number(((por.pendente || 0) * d.tarifa_unitaria).toFixed(2)),
        status_mensagens: st, custo_realizado_estimado: Number((entregues * d.tarifa_unitaria).toFixed(2)) });
    }

    if (acao === "enviar") {
      const id = Number(b.disparo_id), tplId = Number(b.template_id);
      const qtd = Math.min(50, Math.max(1, Number(b.quantidade) || 1));
      if (String(b.confirmacao || "") !== "ENVIAR") return json(409, { error: "Confirmação ausente." });
      const d = (await sb(`cda_whatsapp_disparos?id=eq.${id}&select=*`))?.[0];
      const t = (await sb(`cda_whatsapp_templates?id=eq.${tplId}&select=*`))?.[0];
      if (!d || !t) return json(404, { error: "Disparo ou modelo não encontrado." });
      if (t.status !== "APPROVED") return json(422, { error: `O modelo "${t.nome}" ainda não está aprovado pela Meta (status: ${t.status}).` });
      if (d.situacao === "cancelado" || d.situacao === "pausado") return json(422, { error: "Disparo pausado ou cancelado." });
      const usados = Number(await rpc("cda_wa_contatos_24h", {}));
      const livre = Math.max(0, LIMITE_DIA - usados);
      if (!livre) return json(429, { error: `Limite diário atingido (${LIMITE_DIA} contatos em 24h). Continue amanhã.`, usados_24h: usados });
      const n = Math.min(qtd, livre);
      const grupo = b.grupo ? String(b.grupo) : "";
      const fila = await sb(`cda_whatsapp_disparo_itens?disparo_id=eq.${id}&estado=eq.pendente${grupo ? `&grupo=eq.${encodeURIComponent(grupo)}` : ""}&order=ordem.asc&limit=${n}&select=*`);
      await sb(`cda_whatsapp_disparos?id=eq.${id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ situacao: "enviando", template_id: tplId, atualizado_em: new Date().toISOString() }) });

      let ok = 0, falhas = 0;
      for (const it of fila) {
        // reserva o item (evita envio duplo se duas abas clicarem ao mesmo tempo)
        const reservado = await sb(`cda_whatsapp_disparo_itens?id=eq.${it.id}&estado=eq.pendente`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ estado: "enviando" }) });
        if (!reservado?.length) continue;
        const nome = primeiroNome(it.nome);
        const texto = String(t.corpo).replace(/\{\{1\}\}/g, nome);
        const comps: any[] = [];
        if (t.cabecalho_imagem_url) comps.push({ type: "header", parameters: [{ type: "image", image: { link: t.cabecalho_imagem_url } }] });
        comps.push({ type: "body", parameters: [{ type: "text", text: nome }] });
        // 9º dígito: tenta com o 9 e, se a Meta recusar o número, tenta sem
        const cands = [it.telefone];
        if (/^55\d{2}9\d{8}$/.test(it.telefone)) cands.push(it.telefone.slice(0, 4) + it.telefone.slice(5));
        let r: any = null, destino = cands[0];
        for (const alvo of cands) {
          destino = alvo;
          r = await meta(`${num.phone_number_id}/messages`, TOKEN, { method: "POST", body: JSON.stringify({
            messaging_product: "whatsapp", recipient_type: "individual", to: alvo, type: "template",
            template: { name: t.nome, language: { code: t.idioma }, components: comps } }) });
          const cod = r.j?.error?.code;
          if (!r.ok && (cod === 131026 || cod === 131030) && alvo !== cands[cands.length - 1]) continue;
          break;
        }
        const waId = r.ok ? (r.j?.messages?.[0]?.id || null) : null;
        const erro = r.ok ? null : { codigo: r.j?.error?.code, mensagem: r.j?.error?.error_user_msg || r.j?.error?.message, detalhe: r.j?.error?.error_data?.details };
        await rpc("cda_wa_registrar_envio_item", { p_item_id: it.id, p_template_id: tplId, p_wa_id: waId, p_texto: texto, p_destino: destino, p_erro: erro, p_usuario_equipe: u.id });
        if (waId) ok++; else falhas++;
        // limites da Meta: erro de taxa/limite → para o lote
        if (erro && [130429, 131048, 131056, 368, 4].includes(Number(erro.codigo))) break;
        await dormir(250);
      }
      const restantes = (await sb(`cda_whatsapp_disparo_itens?disparo_id=eq.${id}&estado=eq.pendente&select=id&limit=1`))?.length || 0;
      if (!restantes) await sb(`cda_whatsapp_disparos?id=eq.${id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ situacao: "concluido", atualizado_em: new Date().toISOString() }) });
      return json(200, { ok: true, enviadas: ok, falhas, usados_24h: usados + ok, disponivel_hoje: Math.max(0, LIMITE_DIA - usados - ok), ha_pendentes: !!restantes });
    }

    return json(400, { error: "Ação desconhecida." });
  } catch (e) {
    console.error("[whatsapp-campanha]", String(e));
    return json(500, { error: String((e as Error)?.message || e) });
  }
});

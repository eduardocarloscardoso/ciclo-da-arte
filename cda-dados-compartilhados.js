// ════════════════════════════════════════════════════════════════════
// cda-dados-compartilhados.js
// Camada única de acesso às entidades centrais do ecossistema Ciclo Arte:
// clientes (leitura+gravação), produtos (leitura+gravação),
// canais/collabs e parceiros/cvs (SOMENTE LEITURA).
//
// Usado por: financeiro.html, comercial.html, e qualquer módulo futuro
// que precise dessas entidades. NÃO duplicar esta lógica nos arquivos —
// qualquer campo novo entra aqui, uma única vez.
//
// Requer que window.supabase (client oficial @supabase/supabase-js) já
// tenha sido carregado via <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js">
// antes deste arquivo.
// ════════════════════════════════════════════════════════════════════

const CDA_SUPABASE_URL = 'https://gsizoiwefejsllgtsard.supabase.co';
const CDA_SUPABASE_KEY = 'sb_publishable__DhSVHxis9MFXLwF1fDyJA_U-UbK1ay';
const cdaClient = window.supabase.createClient(CDA_SUPABASE_URL, CDA_SUPABASE_KEY);

// Geração de ID client-side — a coluna `id` de `clientes`/`produtos` é
// bigint SEM auto-incremento (sem sequence/identity no Postgres). O
// financeiro.html já resolve assim (função uid() de lá); replicamos aqui
// a MESMA convenção para os dois arquivos gerarem IDs no mesmo formato
// e sem colidir entre si.
function cdaUid(){ return Date.now() + Math.floor(Math.random()*999); }

// ── Paginação: Supabase limita a 1000 linhas por select ─────────────
async function cdaFetchAll(table, columns, orderBy) {
  columns = columns || '*';
  orderBy = orderBy || 'id';
  let all = [], from = 0, pageSize = 1000;
  while (true) {
    const { data, error } = await cdaClient.from(table).select(columns).order(orderBy, { ascending: true }).range(from, from + pageSize - 1);
    if (error) throw error;
    all = all.concat(data || []);
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

// ── CLIENTES (leitura + gravação) ───────────────────────────────────
// tipo_comercial: null/'' = cliente já convertido (veio da Loja Integrada)
//                 'lead_b2c' | 'canal_b2b' | 'artista' | 'imprensa' = ainda em prospecção
const CDA_CLIENTE_MAP = {
  fromRow: r => ({
    id: String(r.id), nome: r.nome, email: r.email, cpf: r.cpf, sexo: r.sexo,
    'data-nascimento': r.nascimento, celular: r.celular, telefone: r.telefone,
    'telefone-celular': r.celular, 'telefone-principal': r.telefone_principal,
    'telefone-comercial': r.telefone_comercial, endereco: r.endereco, numero: r.numero,
    complemento: r.complemento, referencia: r.referencia, bairro: r.bairro, cidade: r.cidade,
    estado: r.estado, cep: r.cep, pais: r.pais, situacao: r.situacao, grupo: r.grupo,
    ativo: r.ativo, tipo: r.tipo, rg: r.rg, cnpj: r.cnpj, 'razao-social': r.razao_social,
    ie: r.ie, 'data-criacao': r.data_criacao,
    // campos comerciais (novos)
    tipoComercial: r.tipo_comercial || '', instagram: r.instagram || '',
    origem: r.origem || '', origemDados: r.origem_dados || '',
    responsavelComercial: r.responsavel_comercial || '',
    tagsComercial: r.tags_comercial ? r.tags_comercial.split(',').map(t => t.trim()).filter(Boolean) : [],
    obsComercial: r.obs_comercial || '',
    // Status CRM — SOMENTE LEITURA aqui. Calculado pelo job noturno
    // cda_recalcular_status_crm() no Supabase; nunca gravado pelo frontend
    // (por isso não aparece em toRow), pra não sobrescrever com dado velho.
    statusCrmId: r.status_crm_id != null ? Number(r.status_crm_id) : null,
    statusCrmAtualizadoEm: r.status_crm_atualizado_em || null,
    cadastroIncompleto: !!r.cadastro_incompleto,
    criadoEm: r.criado_em || null
  }),
  toRow: o => ({
    id: o.id, nome: o.nome || null, email: o.email || null, cpf: o.cpf || null, sexo: o.sexo || null,
    nascimento: o['data-nascimento'] || null, celular: o['telefone-celular'] || o.celular || null,
    telefone: o.telefone || null, telefone_principal: o['telefone-principal'] || null,
    telefone_comercial: o['telefone-comercial'] || null, endereco: o.endereco || null,
    numero: o.numero || null, complemento: o.complemento || null, referencia: o.referencia || null,
    bairro: o.bairro || null, cidade: o.cidade || null, estado: o.estado || null, cep: o.cep || null,
    pais: o.pais || null, situacao: o.situacao || null, grupo: o.grupo || null, ativo: o.ativo || null,
    tipo: o.tipo || null, rg: o.rg || null, cnpj: o.cnpj || null, razao_social: o['razao-social'] || null,
    ie: o.ie || null, data_criacao: o['data-criacao'] || null,
    // campos comerciais (novos)
    tipo_comercial: o.tipoComercial || null, instagram: o.instagram || null,
    origem: o.origem || null, origem_dados: o.origemDados || null,
    responsavel_comercial: o.responsavelComercial || null,
    tags_comercial: (o.tagsComercial && o.tagsComercial.length) ? o.tagsComercial.join(', ') : null,
    obs_comercial: o.obsComercial || null
  })
};

async function cdaCarregarClientes() {
  const rows = await cdaFetchAll('clientes');
  return rows.map(CDA_CLIENTE_MAP.fromRow);
}

// upsert de 1 cliente. Se o.id vier vazio, deixa o Postgres gerar (bigint identity)
async function cdaSalvarCliente(o) {
  const row = CDA_CLIENTE_MAP.toRow(o);
  if (!row.id) row.id = cdaUid();
  const { data, error } = await cdaClient.from('clientes').upsert(row).select().single();
  if (error) throw error;
  return CDA_CLIENTE_MAP.fromRow(data);
}

async function cdaExcluirCliente(id) {
  const { error } = await cdaClient.from('clientes').delete().eq('id', id);
  if (error) throw error;
}

// vínculo N:N cliente-canal (tabela cliente_canal, já existente)
async function cdaCarregarClienteCanais() {
  const rows = await cdaFetchAll('cliente_canal', '*', 'cliente_id');
  return rows.map(r => ({ clienteId: String(r.cliente_id), canalId: String(r.canal_id) }));
}
async function cdaVincularClienteCanal(clienteId, canalId) {
  const { error } = await cdaClient.from('cliente_canal').upsert({ cliente_id: clienteId, canal_id: canalId });
  if (error) throw error;
}
async function cdaDesvincularClienteCanal(clienteId, canalId) {
  const { error } = await cdaClient.from('cliente_canal').delete().eq('cliente_id', clienteId).eq('canal_id', canalId);
  if (error) throw error;
}

// ── PRODUTOS (leitura + gravação) ───────────────────────────────────
const CDA_PRODUTO_MAP = {
  fromRow: r => ({
    id: r.id, nome: r.nome, tipo: r.tipo, colecao: r.colecao,
    canalId: r.canal_id, parceiroId: r.parceiro_id, preco: r.preco, cor: r.cor, tam: r.tam,
    status: r.status || 'Ativo', codigoBling: r.codigo_bling || ''
  }),
  toRow: o => ({
    id: o.id, nome: o.nome || null, tipo: o.tipo || null, colecao: o.colecao || null,
    canal_id: o.canalId || null, parceiro_id: o.parceiroId || null, preco: o.preco, cor: o.cor || null, tam: o.tam || null,
    status: o.status || 'Ativo', codigo_bling: o.codigoBling || null
  })
};
async function cdaCarregarProdutos() {
  const rows = await cdaFetchAll('produtos');
  return rows.map(CDA_PRODUTO_MAP.fromRow);
}
async function cdaCarregarTiposProduto() {
  const rows = await cdaFetchAll('tipos_produto', 'nome', 'nome');
  return rows.map(r => r.nome).filter(Boolean);
}
async function cdaCarregarColecoes() {
  const rows = await cdaFetchAll('colecoes', 'nome', 'nome');
  return rows.map(r => r.nome).filter(Boolean);
}
async function cdaSalvarProduto(o) {
  const row = CDA_PRODUTO_MAP.toRow(o);
  if (!row.id) row.id = cdaUid();
  const { data, error } = await cdaClient.from('produtos').upsert(row).select().single();
  if (error) throw error;
  return CDA_PRODUTO_MAP.fromRow(data);
}
async function cdaExcluirProduto(id) {
  const { error } = await cdaClient.from('produtos').delete().eq('id', id);
  if (error) throw error;
}

// ── CANAIS / COLLABS e PARCEIROS / CVS — SOMENTE LEITURA ────────────
// Escrita continua exclusiva do financeiro.html: envolve parâmetros
// financeiros sensíveis (comissão, impostos) fora do escopo do Comercial.
async function cdaCarregarCanais() {
  const rows = await cdaFetchAll('canais');
  return rows.map(r => ({
    id: r.id, nome: r.nome, tipo: r.tipo, comissao: r.comissao, pctImp: r.pct_imp,
    pctOp: r.pct_op, pctCs: r.pct_cs, semFrete: r.sem_frete, email: r.email, obs: r.obs, parceiroId: r.parceiro_id,
    // 'b2c' | 'b2b' — define se o canal entra no universo de Segmentação/Pipeline B2C
    escopo: r.escopo || 'b2c'
  }));
}
async function cdaCarregarParceiros() {
  const rows = await cdaFetchAll('parceiros');
  return rows.map(r => ({ id: r.id, nome: r.nome, obs: r.obs }));
}

// Constantes reaproveitáveis pelas telas
const CDA_TIPO_COMERCIAL_LABEL = {
  '': 'Cliente (convertido)',
  lead_b2c: 'Lead / Cliente Final (B2C)',
  canal_b2b: 'Canal / Parceiro (B2B)',
  artista: 'Artista / Collab',
  imprensa: 'Imprensa / Influenciador'
};
const CDA_ORIGEM_DADOS_OPCOES = ['Loja Integrada', 'ERP Bling', 'Pesquisa de Mercado', 'Outros'];

// ── HISTÓRICO DE COMPRAS ─────────────────────────────────────────────
// Escrita (criar/editar/excluir) é exclusiva do financeiro.html.
// O comercial.html só lê (mesmo padrão de canais/parceiros).
const CDA_COMPRA_MAP = {
  fromRow: r => ({
    id: r.id, clienteId: r.cliente_id != null ? String(r.cliente_id) : null,
    canalId: r.canal_id != null ? String(r.canal_id) : null,
    produtoId: r.produto_id != null ? String(r.produto_id) : null,
    produto: r.produto, variacao: r.variacao, quantidade: r.quantidade,
    valorUnitario: r.valor_unitario, valorBruto: r.valor_bruto, valorTotal: r.valor_total,
    desconto: r.desconto, frete: r.frete, outrasDespesas: r.outras_despesas,
    situacao: r.situacao, dataCompra: r.data_compra, numeroPedido: r.numero_pedido,
    origem: r.origem, obs: r.obs
  }),
  toRow: o => ({
    id: o.id, cliente_id: o.clienteId || null, canal_id: o.canalId || null,
    produto_id: o.produtoId || null, produto: o.produto || null, variacao: o.variacao || null,
    quantidade: o.quantidade || null, valor_unitario: o.valorUnitario || null,
    valor_bruto: o.valorBruto || null, valor_total: o.valorTotal || null,
    desconto: o.desconto || null, frete: o.frete || null, outras_despesas: o.outrasDespesas || null,
    situacao: o.situacao || null, data_compra: o.dataCompra || null,
    numero_pedido: o.numeroPedido || null, origem: o.origem || null, obs: o.obs || null
  })
};
async function cdaCarregarCompras() {
  const rows = await cdaFetchAll('compras');
  return rows.map(CDA_COMPRA_MAP.fromRow);
}
// Só usado pelo financeiro.html (editavel:true)
async function cdaSalvarCompra(o) {
  const row = CDA_COMPRA_MAP.toRow(o);
  if (!row.id) row.id = 'cp' + cdaUid();
  const { data, error } = await cdaClient.from('compras').upsert(row).select().single();
  if (error) throw error;
  return CDA_COMPRA_MAP.fromRow(data);
}
async function cdaExcluirCompra(id) {
  const { error } = await cdaClient.from('compras').delete().eq('id', id);
  if (error) throw error;
}

// ── PIPELINE B2C (leads_b2c) ─────────────────────────────────────────
const CDA_LEAD_B2C_MAP = {
  fromRow: r => ({
    id: r.id, nome: r.nome, telefone: r.telefone, email: r.email,
    canalId: r.canal_id != null ? String(r.canal_id) : null,
    etapa: r.etapa, valorEstimado: r.valor_estimado, responsavel: r.responsavel,
    clienteId: r.cliente_id != null ? String(r.cliente_id) : null,
    obs: r.obs, criadoEm: r.criado_em, movidoEm: r.movido_em, motivoPerda: r.motivo_perda,
    // resultado atual dentro da etapa (ex: 'pediu_catalogo') — aponta pro catálogo cda_status_crm
    resultadoId: r.resultado_id != null ? Number(r.resultado_id) : null
  }),
  toRow: o => ({
    id: o.id, nome: o.nome || null, telefone: o.telefone || null, email: o.email || null,
    canal_id: o.canalId || null, etapa: o.etapa || 'novo_lead', valor_estimado: o.valorEstimado,
    responsavel: o.responsavel || null, cliente_id: o.clienteId || null, obs: o.obs || null,
    movido_em: o.movidoEm || new Date().toISOString(), motivo_perda: o.motivoPerda || null,
    resultado_id: o.resultadoId != null ? o.resultadoId : null
  })
};
async function cdaCarregarLeadsB2C() {
  const rows = await cdaFetchAll('leads_b2c');
  return rows.map(CDA_LEAD_B2C_MAP.fromRow);
}
async function cdaSalvarLeadB2C(o) {
  const row = CDA_LEAD_B2C_MAP.toRow(o);
  if (!row.id) row.id = 'lb2c' + cdaUid();
  const { data, error } = await cdaClient.from('leads_b2c').upsert(row).select().single();
  if (error) throw error;
  return CDA_LEAD_B2C_MAP.fromRow(data);
}
async function cdaExcluirLeadB2C(id) {
  const { error } = await cdaClient.from('leads_b2c').delete().eq('id', id);
  if (error) throw error;
}

// ── HISTÓRICO DE INTERAÇÕES (transições do Pipeline B2C) ─────────────
const CDA_HISTORICO_MAP = {
  fromRow: r => ({
    id: r.id, leadId: r.lead_id, clienteId: r.cliente_id != null ? String(r.cliente_id) : null,
    etapa: r.etapa, resultadoId: r.resultado_id != null ? Number(r.resultado_id) : null,
    observacao: r.observacao, criadoEm: r.criado_em, criadoPor: r.criado_por
  })
};
async function cdaCarregarHistoricoPorLead(leadId) {
  const { data, error } = await cdaClient.from('cda_historico_interacoes').select('*').eq('lead_id', leadId).order('criado_em', { ascending: false });
  if (error) throw error;
  return (data || []).map(CDA_HISTORICO_MAP.fromRow);
}
async function cdaSalvarHistoricoInteracao(o) {
  const row = { lead_id: o.leadId, cliente_id: o.clienteId || null, etapa: o.etapa, resultado_id: o.resultadoId || null, observacao: o.observacao || null, criado_por: o.criadoPor || null };
  const { data, error } = await cdaClient.from('cda_historico_interacoes').insert(row).select().single();
  if (error) throw error;
  return CDA_HISTORICO_MAP.fromRow(data);
}

// ── SEGMENTOS SALVOS (filtros de segmentação de clientes) ────────────
const CDA_SEGMENTO_MAP = {
  fromRow: r => ({ id: r.id, nome: r.nome, filtros: r.filtros, criadoEm: r.criado_em }),
  toRow: o => ({ id: o.id, nome: o.nome || null, filtros: o.filtros || [] })
};
async function cdaCarregarSegmentos() {
  const rows = await cdaFetchAll('segmentos_salvos');
  return rows.map(CDA_SEGMENTO_MAP.fromRow);
}
async function cdaSalvarSegmento(o) {
  const row = CDA_SEGMENTO_MAP.toRow(o);
  if (!row.id) row.id = 'seg' + cdaUid();
  const { data, error } = await cdaClient.from('segmentos_salvos').upsert(row).select().single();
  if (error) throw error;
  return CDA_SEGMENTO_MAP.fromRow(data);
}
async function cdaExcluirSegmento(id) {
  const { error } = await cdaClient.from('segmentos_salvos').delete().eq('id', id);
  if (error) throw error;
}

// ── STATUS CRM (catálogo — segmentação e resultados de pipeline) ────
// Somente leitura pelo Comercial. Alimenta os atalhos rápidos de
// Segmentação e o modal de transição do Pipeline B2C.
async function cdaCarregarStatusCrm() {
  const rows = await cdaFetchAll('cda_status_crm', '*', 'ordem');
  return rows.filter(r => r.ativo !== false).map(r => ({
    id: r.id, tipo: r.tipo, codigo: r.codigo, nome: r.nome, descricao: r.descricao,
    acaoSugerida: r.acao_sugerida, cor: r.cor || '#888', ordem: r.ordem,
    etapaAplicavel: r.etapa_aplicavel || []
  }));
}

// ── RECÁLCULO DE VALORES (Premium/VIP) — leitura + gravação ─────────
async function cdaCarregarParametrosSegmentacao() {
  const { data, error } = await cdaClient.from('cda_parametros_segmentacao').select('*').eq('id', 1).single();
  if (error) throw error;
  return {
    valorPremium: Number(data.valor_premium), valorVip: Number(data.valor_vip),
    modo: data.modo, atualizadoEm: data.atualizado_em, atualizadoPor: data.atualizado_por
  };
}
async function cdaSalvarParametrosSegmentacao(o) {
  const row = {
    id: 1, valor_premium: o.valorPremium, valor_vip: o.valorVip, modo: o.modo,
    atualizado_em: new Date().toISOString().slice(0, 10), atualizado_por: o.atualizadoPor || null
  };
  const { data, error } = await cdaClient.from('cda_parametros_segmentacao').upsert(row).select().single();
  if (error) throw error;
  return { valorPremium: Number(data.valor_premium), valorVip: Number(data.valor_vip), modo: data.modo, atualizadoEm: data.atualizado_em, atualizadoPor: data.atualizado_por };
}

async function cdaExecutarRecalculoValores(usuario) {
  const { data, error } = await cdaClient.rpc('cda_executar_recalculo_valores', { p_usuario: usuario || 'Usuário' });
  if (error) throw error;
  return data && data[0] ? { valorPremium: Number(data[0].valor_premium), valorVip: Number(data[0].valor_vip) } : null;
}

// ── TUTORIAL — comentários da equipe (importados de Word) ────────────
async function cdaCarregarComentariosTutorial() {
  const { data, error } = await cdaClient.from('cda_tutorial_comentarios').select('*').order('importado_em', { ascending: false });
  if (error) throw error;
  return (data || []).map(r => ({ id: r.id, conteudo: r.conteudo, arquivoOrigem: r.arquivo_origem, importadoEm: r.importado_em, importadoPor: r.importado_por }));
}
async function cdaSalvarComentarioTutorial(o) {
  const row = { conteudo: o.conteudo, arquivo_origem: o.arquivoOrigem || null, importado_por: o.importadoPor || null };
  const { data, error } = await cdaClient.from('cda_tutorial_comentarios').insert(row).select().single();
  if (error) throw error;
  return { id: data.id, conteudo: data.conteudo, arquivoOrigem: data.arquivo_origem, importadoEm: data.importado_em, importadoPor: data.importado_por };
}

// ── CANAIS / PARCEIROS — escrita (agora liberada também para uso no hub unificado) ──
async function cdaSalvarCanal(o) {
  const row = {
    id: o.id || cdaUid(), nome: o.nome || null, tipo: o.tipo || null,
    comissao: o.comissao, pct_imp: o.pctImp, pct_op: o.pctOp, pct_cs: o.pctCs,
    sem_frete: !!o.semFrete, email: o.email || null, obs: o.obs || null, parceiro_id: o.parceiroId || null
  };
  const { data, error } = await cdaClient.from('canais').upsert(row).select().single();
  if (error) throw error;
  return { id: data.id, nome: data.nome, tipo: data.tipo, comissao: data.comissao, pctImp: data.pct_imp, pctOp: data.pct_op, pctCs: data.pct_cs, semFrete: data.sem_frete, email: data.email, obs: data.obs, parceiroId: data.parceiro_id };
}
async function cdaExcluirCanal(id) {
  const { error } = await cdaClient.from('canais').delete().eq('id', id);
  if (error) throw error;
}
async function cdaSalvarParceiro(o) {
  const row = { id: o.id || cdaUid(), nome: o.nome || null, obs: o.obs || null };
  const { data, error } = await cdaClient.from('parceiros').upsert(row).select().single();
  if (error) throw error;
  return { id: data.id, nome: data.nome, obs: data.obs };
}
async function cdaExcluirParceiro(id) {
  const { error } = await cdaClient.from('parceiros').delete().eq('id', id);
  if (error) throw error;
}
async function cdaAdicionarTipoProduto(nome) {
  const { error } = await cdaClient.from('tipos_produto').insert({ nome });
  if (error) throw error;
}
async function cdaExcluirTipoProduto(nome) {
  const { error } = await cdaClient.from('tipos_produto').delete().eq('nome', nome);
  if (error) throw error;
}
async function cdaAdicionarColecao(nome) {
  const { error } = await cdaClient.from('colecoes').insert({ nome });
  if (error) throw error;
}
async function cdaExcluirColecao(nome) {
  const { error } = await cdaClient.from('colecoes').delete().eq('nome', nome);
  if (error) throw error;
}

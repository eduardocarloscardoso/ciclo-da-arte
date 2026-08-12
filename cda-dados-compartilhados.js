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
// ── Classificação automática de Tipo de Peça (por nome do produto) ─────
// Usada na importação de planilhas (Produtos e Histórico de Compras/Bling)
// para preencher "tipo" automaticamente quando não vier informado.
// Baseada nos mesmos critérios aplicados na classificação em massa do
// catálogo (ago/2026). Retorna null quando não há match confiável —
// nesse caso o produto fica sem tipo, para classificação manual depois.
function cdaClassificarTipoPeca(nomeRaw) {
  var n = String(nomeRaw || '').toUpperCase().trim();
  if (!n) return null;
  if (n.indexOf('T-SHIRT') !== -1 || n.indexOf('T- SHIRT') !== -1 || n.indexOf('T SHIRT') !== -1 ||
      n.indexOf('CAMISETA') === 0 || n.indexOf('BODY INFANTIL') === 0) return 'T-shirt';
  if (n.indexOf('BERMUDA') === 0) return 'Bermudas';
  if (n.indexOf('CROPPED') === 0) return 'Cropped';
  if (n.indexOf('CANGA') === 0 || n.indexOf('PANÔ') === 0 || n.indexOf('PANNEAUX') === 0 ||
      n.indexOf('PANO ') === 0 || n.indexOf('MANTO') === 0) return 'Canga';
  if (n.indexOf('HOT PANT') === 0) return 'Hot Pants';
  if (n.indexOf('SHORTS') === 0 || n.indexOf('SHORT ') === 0 || n.indexOf('BOARDSHORT') === 0 ||
      n.indexOf('WATER SHORTS') === 0) return 'Shorts';
  if (n.indexOf('CALÇA') === 0) return 'Calça';
  if (n.indexOf('MOLETOM') === 0 || n.indexOf('MOLETINHO') === 0) return 'Moletom';
  if (n.indexOf('BONÉ') === 0 || n.indexOf('BONE ') === 0 || n.indexOf('BUCKET') === 0) return 'Bonés';
  if (n.indexOf('JAQUETA') === 0 || n.indexOf('WINDBRAKER') === 0) return 'Casacos';
  if (n.indexOf('POSTER') === 0) return 'Posters';
  if (n.indexOf('REGATA') === 0 || n.indexOf('REGATÃO') === 0) return 'Regatas';
  if (n.indexOf('LENÇO') === 0) return 'Lenços';
  if (n.indexOf('MEIA') === 0) return 'Meias';
  if (n.indexOf('TOTE') === 0) return 'Bolsas';
  if (n.indexOf('DISCO') === 0 || (n.indexOf('DISCO') !== -1 && n.indexOf('VINIL') !== -1)) return 'Discos';
  if (n.indexOf('COPO') === 0) return 'Copos';
  if (n.indexOf('UNIFORME') === 0) return 'Uniformes';
  if (n.indexOf('TOP ') === 0) return 'Tops';
  if (n.indexOf('ABADA') === 0) return 'Abadás';
  if (n.indexOf('GENÉRICO') === 0 || n.indexOf('DIVERSOS') === 0 || n.indexOf('COMERCIAL') === 0 ||
      n.indexOf('SHOW DIA') === 0 || n.indexOf('VER DETALHAMENTO') === 0 || n.indexOf('MARCA MUC') === 0 ||
      n.indexOf('JERSEY') === 0) return 'Diversos';
  return null;
}
var CDA_CANAL_PRIVATE_LABEL_ID = '1778540708657';

// ── Vendas por Tipo de Peça, com rateio proporcional de "Diversos" ─────
// Usada pelo submódulo "Vendas por Tipo de Peça" e, futuramente, pelo
// "Planejamento de Compras" — mesma lógica, uma função só.
//
// Metodologia do rateio (validada com o CEO em ago/2026):
// - % de participação de cada tipo é sempre calculado sobre TODOS os
//   canais do período filtrado (nunca só o canal selecionado) — mantém
//   o rateio estatisticamente estável ("Opção A").
//
// FÓRMULA DO % PARTICIPAÇÃO (conforme definido pelo CEO):
//   % participação (tipo) = (Valor real do tipo + Valor estimado de
//   Diversos do tipo) ÷ (Valor real de TODOS os tipos + Valor total
//   de Diversos) × 100
//   Ou seja: soma o Diversos já ratado a cada tipo, tanto no numerador
//   quanto no denominador, e divide depois de somar — não antes.
//
//   Isso é matematicamente EQUIVALENTE a calcular direto sobre o valor
//   real (sem Diversos): Valor real do tipo ÷ Valor real de TODOS os
//   tipos × 100 — é assim que o código calcula, por eficiência (evita
//   uma referência circular: o valor de Diversos de cada tipo depende
//   do % participação, que dependeria do valor de Diversos já somado).
//   Quando o rateio é proporcional, a fatia de cada tipo ANTES de
//   somar o Diversos é sempre igual à fatia DEPOIS de somar — por
//   isso os dois caminhos sempre batem no mesmo número (confirmado
//   com o CEO em ago/2026: T-shirt = 42,90% pelos dois métodos).
// - Preço médio usado para converter valor estimado em quantidade
//   estimada também é sempre o preço médio GLOBAL do tipo (todos os
//   canais), pelo mesmo motivo.
// - Só as colunas "real" (Qtd/Valor real) e o valor de Diversos a
//   ratear respeitam o filtro de canal, quando informado.
// - Private Label é SEMPRE excluído (não é venda de varejo).
//
// params: { compras, produtoById, dataIni, dataFim, canalId }
//   compras: array já carregado via cdaCarregarCompras()
//   produtoById: mapa id -> produto (precisa ter .tipo)
//   dataIni/dataFim: strings 'YYYY-MM-DD'
//   canalId: opcional — string do id do canal para filtrar
// Retorna: { linhas: [...], totais: {...} }
function cdaCalcularVendasPorTipoPeca(params) {
  var compras = params.compras || [];
  var produtoById = params.produtoById || {};
  var dataIni = params.dataIni, dataFim = params.dataFim;
  var canalId = params.canalId || null;
  // canalIds: lista opcional de ids — permite escopar por "todos os canais de uma collab".
  // Se informado, tem prioridade sobre canalId (que continua funcionando sozinho, p/ compatibilidade).
  var canalIds = params.canalIds ? params.canalIds.map(String) : null;
  function noEscopo(c) {
    if (canalIds) return canalIds.indexOf(String(c.canalId)) !== -1;
    if (canalId) return String(c.canalId) === String(canalId);
    return true;
  }

  function tipoDe(c) {
    var p = produtoById[c.produtoId];
    return p ? p.tipo : null;
  }
  function valorDe(c) {
    if (c.valorTotal != null) return Number(c.valorTotal) || 0;
    if (c.valorBruto != null) return Number(c.valorBruto) || 0;
    return 0;
  }

  // Base do período — todos os canais, exclui Private Label sempre.
  var comprasPeriodoTodos = compras.filter(function (c) {
    if (!c.dataCompra || String(c.canalId) === CDA_CANAL_PRIVATE_LABEL_ID) return false;
    if (dataIni && c.dataCompra < dataIni) return false;
    if (dataFim && c.dataCompra > dataFim) return false;
    return true;
  });

  // Identificado = tipo != Diversos e != null, usado pra % de participação global (não filtra canal/collab).
  var identificadoGlobal = {}; // tipo -> {qtd, valor}
  comprasPeriodoTodos.forEach(function (c) {
    var tipo = tipoDe(c);
    if (!tipo || tipo === 'Diversos') return;
    if (!identificadoGlobal[tipo]) identificadoGlobal[tipo] = { qtd: 0, valor: 0 };
    identificadoGlobal[tipo].qtd += Number(c.quantidade) || 0;
    identificadoGlobal[tipo].valor += valorDe(c);
  });
  var valorTotalIdentificadoGlobal = Object.keys(identificadoGlobal).reduce(function (s, t) { return s + identificadoGlobal[t].valor; }, 0);

  // Diversos a ratear — respeita o filtro de canal/canais quando informado.
  var valorDiversos = 0;
  comprasPeriodoTodos.forEach(function (c) {
    if (!noEscopo(c)) return;
    var tipo = tipoDe(c);
    if (tipo === 'Diversos') valorDiversos += valorDe(c);
  });

  // Vendas reais exibidas — respeitam o filtro de canal/canais quando informado.
  var identificadoExibido = {};
  comprasPeriodoTodos.forEach(function (c) {
    if (!noEscopo(c)) return;
    var tipo = tipoDe(c);
    if (!tipo || tipo === 'Diversos') return;
    if (!identificadoExibido[tipo]) identificadoExibido[tipo] = { qtd: 0, valor: 0 };
    identificadoExibido[tipo].qtd += Number(c.quantidade) || 0;
    identificadoExibido[tipo].valor += valorDe(c);
  });

  var tiposOrdenados = Object.keys(identificadoGlobal).sort(function (a, b) {
    return identificadoGlobal[b].valor - identificadoGlobal[a].valor;
  });

  var linhas = tiposOrdenados.map(function (tipo) {
    var g = identificadoGlobal[tipo];
    var precoMedioReal = g.qtd > 0 ? g.valor / g.qtd : 0;
    var pctParticipacao = valorTotalIdentificadoGlobal > 0 ? (g.valor / valorTotalIdentificadoGlobal) * 100 : 0;
    var exib = identificadoExibido[tipo] || { qtd: 0, valor: 0 };
    var valorEstimadoDiversos = (pctParticipacao / 100) * valorDiversos;
    var qtdEstimadaDiversos = precoMedioReal > 0 ? valorEstimadoDiversos / precoMedioReal : 0;
    return {
      tipo: tipo,
      qtdReal: exib.qtd, valorReal: exib.valor, precoMedioReal: precoMedioReal,
      pctParticipacao: pctParticipacao,
      qtdEstimadaDiversos: qtdEstimadaDiversos, valorEstimadoDiversos: valorEstimadoDiversos,
      qtdTotal: exib.qtd + qtdEstimadaDiversos, valorTotal: exib.valor + valorEstimadoDiversos
    };
  }).filter(function (l) { return l.qtdReal > 0 || l.valorReal > 0 || l.qtdEstimadaDiversos > 0; });

  var totais = linhas.reduce(function (acc, l) {
    acc.qtdReal += l.qtdReal; acc.valorReal += l.valorReal;
    acc.qtdEstimadaDiversos += l.qtdEstimadaDiversos; acc.valorEstimadoDiversos += l.valorEstimadoDiversos;
    acc.qtdTotal += l.qtdTotal; acc.valorTotal += l.valorTotal;
    return acc;
  }, { qtdReal: 0, valorReal: 0, qtdEstimadaDiversos: 0, valorEstimadoDiversos: 0, qtdTotal: 0, valorTotal: 0 });
  totais.valorDiversosFiltrado = valorDiversos;

  return { linhas: linhas, totais: totais };
}


// ── Vendas por Canal, dentro de uma Collab/Artista ──────────────────
// Diferente do rateio de tipo de peça, aqui o canal do "Diversos" é
// dado REAL (já sabemos exatamente em qual canal cada Diversos
// aconteceu) — não precisamos ratear/estimar isso. A única estimativa
// que sobra é converter o R$ do Diversos em nº de peças, já que o
// campo "quantidade" das linhas de Diversos não é confiável (é
// contagem de pedido/linha, não de peça física).
//
// params: { compras, produtoById, canais, dataIni, dataFim, collabId, canalIdFiltro }
//   canais: array já carregado via cdaCarregarCanais() (precisa de .parceiroId)
//   collabId: obrigatório — id do parceiro/collab selecionado
//   canalIdFiltro: opcional — drill-down num canal específico da collab
// Retorna: { linhas: [...], totais: {...}, precoMedioCollab }
function cdaCalcularVendasPorCanal(params) {
  var compras = params.compras || [];
  var produtoById = params.produtoById || {};
  var canais = params.canais || [];
  var dataIni = params.dataIni, dataFim = params.dataFim;
  var collabId = params.collabId;
  var canalIdFiltro = params.canalIdFiltro || null;

  function tipoDe(c) {
    var p = produtoById[c.produtoId];
    return p ? p.tipo : null;
  }
  function valorDe(c) {
    if (c.valorTotal != null) return Number(c.valorTotal) || 0;
    if (c.valorBruto != null) return Number(c.valorBruto) || 0;
    return 0;
  }

  var canaisDaCollab = canais.filter(function (c) {
    return collabId && String(c.parceiroId) === String(collabId) && String(c.id) !== CDA_CANAL_PRIVATE_LABEL_ID;
  });
  var canalIds = canaisDaCollab.map(function (c) { return String(c.id); });

  var comprasPeriodo = compras.filter(function (c) {
    if (!c.dataCompra || canalIds.indexOf(String(c.canalId)) === -1) return false;
    if (dataIni && c.dataCompra < dataIni) return false;
    if (dataFim && c.dataCompra > dataFim) return false;
    return true;
  });

  var porCanalReal = {}; canalIds.forEach(function (id) { porCanalReal[id] = { qtd: 0, valor: 0 }; });
  var porCanalDiversos = {}; canalIds.forEach(function (id) { porCanalDiversos[id] = 0; });

  comprasPeriodo.forEach(function (c) {
    var id = String(c.canalId);
    var tipo = tipoDe(c);
    if (tipo === 'Diversos') { porCanalDiversos[id] += valorDe(c); return; }
    if (!tipo) return;
    porCanalReal[id].qtd += Number(c.quantidade) || 0;
    porCanalReal[id].valor += valorDe(c);
  });

  var totalCollabQtd = canalIds.reduce(function (s, id) { return s + porCanalReal[id].qtd; }, 0);
  var totalCollabValor = canalIds.reduce(function (s, id) { return s + porCanalReal[id].valor; }, 0);
  var precoMedioCollab = totalCollabQtd > 0 ? totalCollabValor / totalCollabQtd : 0;

  var linhas = canaisDaCollab.map(function (canal) {
    var id = String(canal.id);
    var real = porCanalReal[id];
    var pctParticipacao = totalCollabValor > 0 ? (real.valor / totalCollabValor) * 100 : 0;
    var valorDiversos = porCanalDiversos[id];
    var qtdEstimadaDiversos = precoMedioCollab > 0 ? valorDiversos / precoMedioCollab : 0;
    return {
      canal: canal.nome, canalId: id,
      qtdReal: real.qtd, valorReal: real.valor, pctParticipacao: pctParticipacao,
      valorDiversos: valorDiversos, qtdEstimadaDiversos: qtdEstimadaDiversos,
      qtdTotal: real.qtd + qtdEstimadaDiversos, valorTotal: real.valor + valorDiversos
    };
  }).filter(function (l) { return l.qtdReal > 0 || l.valorReal > 0 || l.valorDiversos > 0; })
    .filter(function (l) { return !canalIdFiltro || l.canalId === String(canalIdFiltro); })
    .sort(function (a, b) { return b.valorTotal - a.valorTotal; });

  var totais = linhas.reduce(function (acc, l) {
    acc.qtdReal += l.qtdReal; acc.valorReal += l.valorReal;
    acc.qtdEstimadaDiversos += l.qtdEstimadaDiversos; acc.valorDiversos += l.valorDiversos;
    acc.qtdTotal += l.qtdTotal; acc.valorTotal += l.valorTotal;
    return acc;
  }, { qtdReal: 0, valorReal: 0, qtdEstimadaDiversos: 0, valorDiversos: 0, qtdTotal: 0, valorTotal: 0 });

  return { linhas: linhas, totais: totais, precoMedioCollab: precoMedioCollab };
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
    resultadoId: r.resultado_id != null ? Number(r.resultado_id) : null,
    campanhaId: r.campanha_id != null ? Number(r.campanha_id) : null,
    responsavelId: r.responsavel_id != null ? Number(r.responsavel_id) : null,
    mensagemSugerida: r.mensagem_sugerida, mensagemFinalUsuario: r.mensagem_final_usuario,
    meiosSelecionados: r.meios_selecionados
  }),
  toRow: o => ({
    id: o.id, nome: o.nome || null, telefone: o.telefone || null, email: o.email || null,
    canal_id: o.canalId || null, etapa: o.etapa || 'novo_lead', valor_estimado: o.valorEstimado,
    responsavel: o.responsavel || null, cliente_id: o.clienteId || null, obs: o.obs || null,
    movido_em: o.movidoEm || new Date().toISOString(), motivo_perda: o.motivoPerda || null,
    resultado_id: o.resultadoId != null ? o.resultadoId : null,
    campanha_id: o.campanhaId != null ? o.campanhaId : null,
    responsavel_id: o.responsavelId != null ? o.responsavelId : null,
    mensagem_sugerida: o.mensagemSugerida != null ? o.mensagemSugerida : undefined,
    mensagem_final_usuario: o.mensagemFinalUsuario != null ? o.mensagemFinalUsuario : undefined,
    meios_selecionados: o.meiosSelecionados !== undefined ? o.meiosSelecionados : undefined
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
    etapaNova: r.etapa_nova, etapaAnterior: r.etapa_anterior,
    resultadoId: r.resultado_id != null ? Number(r.resultado_id) : null,
    observacao: r.observacao, criadoEm: r.criado_em, criadoPor: r.criado_por,
    tipoInteracao: r.tipo_interacao || 'pipeline', canalId: r.canal_id != null ? String(r.canal_id) : null,
    responsavelId: r.responsavel_id != null ? Number(r.responsavel_id) : null,
    campanhaId: r.campanha_id != null ? Number(r.campanha_id) : null,
    origemEvento: r.origem_evento || 'manual', agenteIaId: r.agente_ia_id != null ? Number(r.agente_ia_id) : null
  })
};
async function cdaCarregarHistoricoPorLead(leadId) {
  const { data, error } = await cdaClient.from('cda_historico_interacoes').select('*').eq('lead_id', leadId).order('criado_em', { ascending: false });
  if (error) throw error;
  return (data || []).map(CDA_HISTORICO_MAP.fromRow);
}
// Carrega TODO o histórico (todos os leads) — usado pelo Diário Comercial
// (feed geral). Paginado via cdaFetchAll, mais recente primeiro.
async function cdaCarregarHistoricoCompleto() {
  const rows = await cdaFetchAll('cda_historico_interacoes', '*', 'criado_em');
  return rows.map(CDA_HISTORICO_MAP.fromRow).reverse();
}
async function cdaSalvarHistoricoInteracao(o) {
  const row = {
    lead_id: o.leadId, cliente_id: o.clienteId || null, etapa_nova: o.etapaNova || null,
    etapa_anterior: o.etapaAnterior || null, resultado_id: o.resultadoId || null,
    observacao: o.observacao || null, criado_por: o.criadoPor || null,
    tipo_interacao: o.tipoInteracao || 'pipeline', canal_id: o.canalId || null,
    responsavel_id: o.responsavelId || null, campanha_id: o.campanhaId || null,
    origem_evento: o.origemEvento || 'manual', agente_ia_id: o.agenteIaId || null
  };
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

// ── AVALIAR SEGMENTO (compartilhado) ──────────────────────────────────
// Recalcula, a qualquer momento, quais clientes batem com os filtros de
// um segmento salvo. Espelha a lógica de cda-modulo-segmentacao.js —
// usado por outros módulos (ex: Campanhas) que precisam da lista de
// clientes de um segmento sem duplicar o motor de filtros inteiro na tela.
const CDA_UF_REGIAO_COMPARTILHADO = {
  AC:'Norte', AM:'Norte', AP:'Norte', PA:'Norte', RO:'Norte', RR:'Norte', TO:'Norte',
  AL:'Nordeste', BA:'Nordeste', CE:'Nordeste', MA:'Nordeste', PB:'Nordeste', PE:'Nordeste', PI:'Nordeste', RN:'Nordeste', SE:'Nordeste',
  DF:'Centro-Oeste', GO:'Centro-Oeste', MT:'Centro-Oeste', MS:'Centro-Oeste',
  ES:'Sudeste', MG:'Sudeste', RJ:'Sudeste', SP:'Sudeste',
  PR:'Sul', RS:'Sul', SC:'Sul'
};
function cdaAvaliarSegmento(clientes, compras, statusCrm, filtros) {
  var agora = new Date();
  var inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
  var inicioTrimestre = new Date(agora.getFullYear(), Math.floor(agora.getMonth() / 3) * 3, 1);
  var inicioAno = new Date(agora.getFullYear(), 0, 1);
  var agregados = {};
  compras.forEach(function (cp) {
    if (!cp.clienteId) return;
    var a = agregados[cp.clienteId];
    if (!a) { a = { qtd: 0, total: 0, primeiraData: null, ultimaData: null, canais: new Set(), produtos: new Set(), mes: false, trimestre: false, ano: false }; agregados[cp.clienteId] = a; }
    a.qtd++;
    a.total += Number(cp.valorTotal) || 0;
    if (cp.dataCompra && (!a.ultimaData || cp.dataCompra > a.ultimaData)) a.ultimaData = cp.dataCompra;
    if (cp.dataCompra && (!a.primeiraData || cp.dataCompra < a.primeiraData)) a.primeiraData = cp.dataCompra;
    if (cp.canalId) a.canais.add(String(cp.canalId));
    if (cp.produtoId) a.produtos.add(String(cp.produtoId));
    if (cp.dataCompra) {
      var d = new Date(cp.dataCompra);
      if (d >= inicioMes) a.mes = true;
      if (d >= inicioTrimestre) a.trimestre = true;
      if (d >= inicioAno) a.ano = true;
    }
  });
  function aggDe(id) { return agregados[id] || { qtd: 0, total: 0, primeiraData: null, ultimaData: null, canais: new Set(), produtos: new Set(), mes: false, trimestre: false, ano: false }; }

  function passa(cliente, f) {
    var agg = aggDe(cliente.id);
    switch (f.tipo) {
      case 'status_crm': return !f.valor || String(cliente.statusCrmId) === String(f.valor);
      case 'tag_valor': return !f.valor || (cliente.tagsComercial || []).indexOf(f.valor) !== -1;
      case 'aniversario': {
        if (!f.valor) return true;
        var dn = cliente['data-nascimento']; if (!dn) return false;
        var partes = dn.split('/'); if (partes.length !== 3) return false;
        return Number(partes[1]) === Number(f.valor);
      }
      case 'recencia_compra': {
        if (!f.valor) return true;
        if (!agg.ultimaData) return f.operador === '>';
        var dias = Math.floor((Date.now() - new Date(agg.ultimaData).getTime()) / 86400000);
        return f.operador === '>' ? dias > Number(f.valor) : dias < Number(f.valor);
      }
      case 'nunca_comprou': return agg.qtd === 0;
      case 'valor_gasto': return (f.valor === '' || f.valor == null) || (f.operador === '>' ? agg.total > Number(f.valor) : agg.total < Number(f.valor));
      case 'qtd_compras': return (f.valor === '' || f.valor == null) || (f.operador === '>' ? agg.qtd >= Number(f.valor) : agg.qtd < Number(f.valor));
      case 'canal': return !f.valor || agg.canais.has(String(f.valor));
      case 'produto': return !f.valor || agg.produtos.has(String(f.valor));
      case 'cidade': return !f.valor || (cliente.cidade || '').toLowerCase().indexOf(f.valor.toLowerCase()) !== -1;
      case 'estado': return !f.valor || (cliente.estado || '').toLowerCase() === f.valor.toLowerCase();
      case 'ticket_medio': {
        if (f.valor === '' || f.valor == null) return true;
        var tm = agg.qtd ? agg.total / agg.qtd : 0;
        return f.operador === '>' ? tm > Number(f.valor) : tm < Number(f.valor);
      }
      case 'comprou_periodo': return !f.valor || !!agg[f.valor];
      case 'dias_cadastro': {
        if (!f.valor || !cliente.criadoEm) return f.operador === '>';
        var diasC = Math.floor((Date.now() - new Date(cliente.criadoEm).getTime()) / 86400000);
        return f.operador === '>' ? diasC > Number(f.valor) : diasC < Number(f.valor);
      }
      case 'dias_primeira_compra': {
        if (!f.valor) return true;
        if (!agg.primeiraData) return f.operador === '>';
        var diasP = Math.floor((Date.now() - new Date(agg.primeiraData).getTime()) / 86400000);
        return f.operador === '>' ? diasP > Number(f.valor) : diasP < Number(f.valor);
      }
      case 'nunca_comprou_produto': return !f.valor || !agg.produtos.has(String(f.valor));
      case 'regiao': return !f.valor || CDA_UF_REGIAO_COMPARTILHADO[(cliente.estado || '').toUpperCase()] === f.valor;
      case 'pais': return !f.valor || (cliente.pais || '').toLowerCase().indexOf(f.valor.toLowerCase()) !== -1;
      case 'cep': return !f.valor || (cliente.cep || '').replace(/\D/g, '').indexOf(f.valor.replace(/\D/g, '')) === 0;
      case 'origem': return !f.valor || cliente.origem === f.valor;
      case 'sem_vendedor': return !cliente.responsavelComercial;
      case 'tipo_comercial':
        if (!f.valor) return true;
        if (f.valor === '__vazio__') return !cliente.tipoComercial;
        return cliente.tipoComercial === f.valor;
      default: return true;
    }
  }
  return clientes.filter(function (c) { return !c.cadastroIncompleto && filtros.every(function (f) { return passa(c, f); }); });
}


// ── CAMPANHAS ──────────────────────────────────────────────────────
const CDA_CAMPANHA_MAP = {
  fromRow: r => ({
    id: r.id, nome: r.nome, objetivo: r.objetivo, publicoSegmentoId: r.publico_segmento_id,
    pipelineEtapaEntrada: r.pipeline_etapa_entrada, periodoInicio: r.periodo_inicio, periodoFim: r.periodo_fim,
    metaDescricao: r.meta_descricao, metaNumero: r.meta_numero != null ? Number(r.meta_numero) : null,
    responsavel: r.responsavel, status: r.status, criadoEm: r.criado_em, criadoPor: r.criado_por,
    beneficioTipo: r.beneficio_tipo || 'nenhum', beneficioValor: r.beneficio_valor != null ? Number(r.beneficio_valor) : null,
    beneficioCupom: r.beneficio_cupom, beneficioCondicoes: r.beneficio_condicoes,
    publicoConhecido: r.publico_conhecido, publicoTemperatura: r.publico_temperatura,
    canaisSelecionados: r.canais_selecionados || [], estrategiaCanal: r.estrategia_canal,
    responsavelIds: (r.responsavel_ids || []).map(Number), modeloMensagemFinal: r.modelo_mensagem_final,
    modeloMensagemSugerida: r.modelo_mensagem_sugerida,
    modeloTarefaSugerida: r.modelo_tarefa_sugerida, modeloTarefaFinal: r.modelo_tarefa_final
  }),
  toRow: o => {
    const row = {
      nome: o.nome, objetivo: o.objetivo || null, publico_segmento_id: o.publicoSegmentoId || null,
      pipeline_etapa_entrada: o.pipelineEtapaEntrada || 'novo_lead', periodo_inicio: o.periodoInicio || null, periodo_fim: o.periodoFim || null,
      meta_descricao: o.metaDescricao || null, meta_numero: o.metaNumero != null ? o.metaNumero : null,
      responsavel: o.responsavel || null, status: o.status || 'ativa', criado_por: o.criadoPor || null,
      beneficio_tipo: o.beneficioTipo || 'nenhum', beneficio_valor: o.beneficioValor != null ? o.beneficioValor : null,
      beneficio_cupom: o.beneficioCupom || null, beneficio_condicoes: o.beneficioCondicoes || null,
      publico_conhecido: o.publicoConhecido || null, publico_temperatura: o.publicoTemperatura || null,
      canais_selecionados: o.canaisSelecionados || [], estrategia_canal: o.estrategiaCanal || null,
      responsavel_ids: o.responsavelIds || [], modelo_mensagem_final: o.modeloMensagemFinal || null,
      modelo_mensagem_sugerida: o.modeloMensagemSugerida != null ? o.modeloMensagemSugerida : undefined,
      modelo_tarefa_sugerida: o.modeloTarefaSugerida != null ? o.modeloTarefaSugerida : undefined,
      modelo_tarefa_final: o.modeloTarefaFinal || null
    };
    if (o.id) row.id = o.id;
    return row;
  }
};
async function cdaCarregarCampanhas() {
  const rows = await cdaFetchAll('cda_campanhas', '*', 'criado_em');
  return rows.map(CDA_CAMPANHA_MAP.fromRow).reverse();
}
async function cdaSalvarCampanha(o) {
  const row = CDA_CAMPANHA_MAP.toRow(o);
  let data, error;
  if (row.id) {
    const id = row.id;
    delete row.id; // GENERATED ALWAYS AS IDENTITY — não pode aparecer no corpo do UPDATE, só no WHERE
    ({ data, error } = await cdaClient.from('cda_campanhas').update(row).eq('id', id).select().single());
  } else {
    ({ data, error } = await cdaClient.from('cda_campanhas').insert(row).select().single());
  }
  if (error) throw error;
  return CDA_CAMPANHA_MAP.fromRow(data);
}
async function cdaExcluirCampanha(id) {
  const { error } = await cdaClient.from('cda_campanhas').delete().eq('id', id);
  if (error) throw error;
}

// Adiciona em lote os clientes de um segmento ao Pipeline, vinculados a uma campanha.
// Não duplica: pula quem já tem lead nessa campanha específica.
async function cdaAdicionarPublicoCampanha(campanha, clientesAlvo, usuario) {
  const { data: existentes, error: errExist } = await cdaClient.from('leads_b2c').select('cliente_id').eq('campanha_id', campanha.id);
  if (errExist) throw errExist;
  const jaAdicionados = new Set((existentes || []).map(r => String(r.cliente_id)));
  const novos = clientesAlvo.filter(c => !jaAdicionados.has(String(c.id)));
  if (!novos.length) return { adicionados: 0, jaExistentes: clientesAlvo.length };

  const agora = new Date().toISOString();
  const leadRows = novos.map(c => ({
    id: 'lb2c' + cdaUid() + Math.random().toString(36).slice(2, 6),
    nome: c.nome, telefone: c['telefone-celular'] || c['telefone-principal'] || null, email: c.email || null,
    canal_id: null, etapa: campanha.pipelineEtapaEntrada || 'novo_lead', cliente_id: c.id,
    campanha_id: campanha.id, movido_em: agora, obs: 'Adicionado via campanha "' + campanha.nome + '"'
  }));
  const { data: inseridos, error: errIns } = await cdaClient.from('leads_b2c').insert(leadRows).select();
  if (errIns) throw errIns;

  const histRows = (inseridos || []).map(l => ({
    lead_id: l.id, cliente_id: l.cliente_id, etapa_nova: l.etapa, resultado_id: null,
    observacao: 'Entrou no funil via campanha "' + campanha.nome + '"', criado_por: usuario || 'Usuário',
    tipo_interacao: 'pipeline', origem_evento: 'manual', campanha_id: campanha.id
  }));
  if (histRows.length) {
    const { error: errHist } = await cdaClient.from('cda_historico_interacoes').insert(histRows);
    if (errHist) throw errHist;
  }
  return { adicionados: novos.length, jaExistentes: clientesAlvo.length - novos.length };
}

// ── EQUIPE (responsáveis reais, usados por Tarefas e outros módulos) ─
// Lê da mesma tabela 'equipe' usada pelo Credenciamento — uma fonte única
// de pessoas, não uma lista separada. name→nome pra manter o resto do
// app usando .nome como já fazia antes desta unificação.
async function cdaCarregarEquipe() {
  const rows = await cdaFetchAll('equipe', '*', 'name');
  return rows.map(r => ({ id: r.id, nome: r.name, email: r.email, ativo: true }));
}

// ── TAREFAS & FOLLOW-UP ────────────────────────────────────────────
const CDA_TAREFA_MAP = {
  fromRow: r => ({
    id: r.id, descricao: r.descricao, leadId: r.lead_id,
    clienteId: r.cliente_id != null ? String(r.cliente_id) : null,
    campanhaId: r.campanha_id != null ? Number(r.campanha_id) : null,
    responsavelId: r.responsavel_id != null ? Number(r.responsavel_id) : null,
    tipo: r.tipo, prioridade: r.prioridade, status: r.status,
    dataInicio: r.data_inicio, dataPrevista: r.data_prevista, dataConclusao: r.data_conclusao,
    resultado: r.resultado, criadoEm: r.criado_em, criadoPor: r.criado_por, descricaoSugerida: r.descricao_sugerida
  }),
  toRow: o => {
    const row = {
      descricao: o.descricao, lead_id: o.leadId || null, cliente_id: o.clienteId || null,
      campanha_id: o.campanhaId || null, responsavel_id: o.responsavelId || null,
      tipo: o.tipo || 'outro', prioridade: o.prioridade || 'media', status: o.status || 'pendente',
      data_inicio: o.dataInicio || null, data_prevista: o.dataPrevista || null, data_conclusao: o.dataConclusao || null,
      resultado: o.resultado || null, criado_por: o.criadoPor || null,
      descricao_sugerida: o.descricaoSugerida != null ? o.descricaoSugerida : undefined
    };
    if (o.id) row.id = o.id;
    return row;
  }
};
async function cdaCarregarTarefas() {
  const rows = await cdaFetchAll('cda_tarefas', '*', 'data_prevista');
  return rows.map(CDA_TAREFA_MAP.fromRow);
}
async function cdaSalvarTarefa(o) {
  const row = CDA_TAREFA_MAP.toRow(o);
  let data, error;
  if (row.id) {
    const id = row.id; delete row.id;
    ({ data, error } = await cdaClient.from('cda_tarefas').update(row).eq('id', id).select().single());
  } else {
    ({ data, error } = await cdaClient.from('cda_tarefas').insert(row).select().single());
  }
  if (error) throw error;
  return CDA_TAREFA_MAP.fromRow(data);
}
async function cdaExcluirTarefa(id) {
  const { error } = await cdaClient.from('cda_tarefas').delete().eq('id', id);
  if (error) throw error;
}

// ── MENSAGENS (Explodir molde → texto pronto por lead) ───────────────
// Substituição pura de {variável} — sem IA, grátis, instantâneo (Opção A
// que fechamos). Nível 3 (o lead) nunca guarda {variável} crua — sempre
// já explodida antes de virar mensagem_sugerida.
var CDA_TEMPLATE_PADRAO = 'Oi {nome}! Tudo bem? Aqui é da Ciclo da Arte 💛 Reparamos que faz um tempo que você não passa por aqui — a última peça que você levou foi {ultima_peca}, e temos novidades que combinam com seu estilo. Separamos algumas peças pensando em você — quer dar uma olhada?';

function cdaCalcularDadosVariaveis(lead, cliente, compras, canalPorId) {
  var comprasCliente = (compras || []).filter(function (cp) { return String(cp.clienteId) === String(lead.clienteId); })
    .sort(function (a, b) { return (b.dataCompra || '').localeCompare(a.dataCompra || ''); });
  var ultima = comprasCliente[0];
  var diasParado = ultima && ultima.dataCompra ? Math.floor((Date.now() - new Date(ultima.dataCompra).getTime()) / 86400000) : null;
  var valorTotal = comprasCliente.reduce(function (s, cp) { return s + (Number(cp.valorTotal) || 0); }, 0);
  var canal = ultima && canalPorId ? canalPorId[String(ultima.canalId)] : null;
  var primeiroNome = (lead.nome || (cliente && cliente.nome) || '').split(' ')[0] || '';
  if (primeiroNome) primeiroNome = primeiroNome.charAt(0).toUpperCase() + primeiroNome.slice(1).toLowerCase();
  return {
    nome: primeiroNome,
    cidade: (cliente && cliente.cidade) || '',
    dias_parado: diasParado != null ? String(diasParado) : '',
    ultima_peca: ultima ? (ultima.produto || 'uma peça especial') : 'uma peça especial',
    ultima_collab: canal ? canal.nome : '',
    valor_total_historico: valorTotal ? valorTotal.toLocaleString('pt-BR') : ''
  };
}
function cdaExplodirTemplate(template, dados) {
  var texto = template || CDA_TEMPLATE_PADRAO;
  Object.keys(dados).forEach(function (chave) {
    texto = texto.split('{' + chave + '}').join(dados[chave] || '');
  });
  return texto;
}
async function cdaSalvarMensagensLote(atualizacoes) {
  // atualizacoes = [{id, mensagemSugerida}]
  for (var i = 0; i < atualizacoes.length; i += 100) {
    var lote = atualizacoes.slice(i, i + 100);
    await Promise.all(lote.map(function (a) {
      return cdaClient.from('leads_b2c').update({ mensagem_sugerida: a.mensagemSugerida }).eq('id', a.id);
    }));
  }
}

// Chama a Edge Function (servidor) que usa a Claude API com a chave guardada
// em segredo — o navegador nunca vê a chave, só o resultado. Quando tipo
// é 'tarefa', mensagemReferencia é passada pra IA ADAPTAR a mensagem em
// instrução de ação, em vez de ignorá-la.
async function cdaGerarSugestaoMensagemIA(campanha, tipo, mensagemReferencia) {
  const { data, error } = await cdaClient.functions.invoke('gerar-modelo-mensagem', {
    body: {
      nomeCampanha: campanha.nome, objetivo: campanha.objetivo,
      beneficioTipo: campanha.beneficioTipo, beneficioValor: campanha.beneficioValor, beneficioCondicoes: campanha.beneficioCondicoes,
      publicoConhecido: campanha.publicoConhecido, publicoTemperatura: campanha.publicoTemperatura,
      canaisSelecionados: campanha.canaisSelecionados, estrategiaCanal: campanha.estrategiaCanal,
      tipo: tipo || 'mensagem', mensagemReferencia: mensagemReferencia || null
    }
  });
  if (error) throw error;
  if (data && data.error) throw new Error(data.error);
  return data.texto;
}

// Update direto de UM campo só — evita o risco de um save parcial
// apagar os outros campos da campanha (toRow monta o objeto inteiro).
async function cdaSalvarCampoCampanha(campanhaId, coluna, valor) {
  var patch = {}; patch[coluna] = valor;
  const { error } = await cdaClient.from('cda_campanhas').update(patch).eq('id', campanhaId);
  if (error) throw error;
}

// Cria em lote as tarefas do Roadmap de uma campanha — 1 por lead, sem
// duplicar quem já tem tarefa dessa campanha.
async function cdaCriarTarefasRoadmap(tarefas) {
  const { data: existentes, error: errExist } = await cdaClient.from('cda_tarefas').select('lead_id').not('lead_id', 'is', null);
  if (errExist) throw errExist;
  const jaTem = new Set((existentes || []).map(r => r.lead_id));
  const novas = tarefas.filter(t => !jaTem.has(t.leadId));
  if (!novas.length) return { criadas: 0, jaExistentes: tarefas.length };

  const rows = novas.map(t => ({
    descricao: t.descricao, lead_id: t.leadId, cliente_id: t.clienteId || null, campanha_id: t.campanhaId || null,
    responsavel_id: t.responsavelId || null, tipo: t.tipo || 'whatsapp', prioridade: t.prioridade || 'media',
    status: 'pendente', data_inicio: t.dataInicio || null, data_prevista: t.dataPrevista || null,
    descricao_sugerida: t.descricaoSugerida || null, criado_por: t.criadoPor || null
  }));
  for (let i = 0; i < rows.length; i += 200) {
    const lote = rows.slice(i, i + 200);
    const { error } = await cdaClient.from('cda_tarefas').insert(lote);
    if (error) throw error;
  }
  return { criadas: novas.length, jaExistentes: tarefas.length - novas.length };
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

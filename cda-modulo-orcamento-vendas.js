// Orçamento Vendas — navegação inicial; sem gravação de dados nesta etapa.
var ORCAMENTO_PAGES={
 projetos:{icon:'📁',label:'Projetos'},
 shows:{icon:'🎤',label:'Parcerias Shows/Eventos'},
 ecommerce:{icon:'🛒',label:'Parcerias E-Commerce'},
 private_label:{icon:'👕',label:'Parcerias Private Label'},
 consolidado:{icon:'📊',label:'Consolidado do Projeto'},
 configuracoes:{icon:'⚙',label:'Configurações'}
};
var ORCAMENTO_CONFIG=[
 {nome:'Participantes e referências',itens:['Empresas e Pessoas','Papéis dos participantes','Funções profissionais','Produtos e categorias','Locais de eventos']},
 {nome:'Estrutura financeira',itens:['Categorias, rubricas e subrubricas','Modalidades e bases de cálculo','Unidades de referência','Regras de participação e rateio']},
 {nome:'Modelos e controle',itens:['Tipos de parceria','Modelos de cenários','Modelos de orçamento','Situações e etapas']}
];
window._orcamentoPage='configuracoes';
function navigateOrcamento(page){
 if(!canAccessProject('orcamento_vendas')){showToast('Seu usuário não tem acesso a Orçamento Vendas.','info');return;}
 if(!ORCAMENTO_PAGES[page])return;
 currentProject='orcamento_vendas';window._orcamentoPage=page;renderSidebarNav();
 document.getElementById('page-title').textContent='Orçamento Vendas · '+ORCAMENTO_PAGES[page].label;
 var el=document.getElementById('main-content');
 var banner=isReadOnly()?'<div class="readonly-banner">👁 Modo somente leitura</div>':'';
 el.innerHTML=banner+'<div class="ph"><h1>'+ORCAMENTO_PAGES[page].icon+' '+ORCAMENTO_PAGES[page].label+'</h1><p>Orçamento Vendas</p></div>';
 if(page==='configuracoes'){
   el.innerHTML+='<p style="color:var(--muted2);margin-bottom:20px">Cadastros e tabelas básicas compartilhados pelas modalidades de parceria. Selecione um item para consultar seu escopo.</p>'+ORCAMENTO_CONFIG.map(function(g,gi){return '<div class="card" style="margin-bottom:16px"><div class="card-title">'+g.nome+'</div><div style="display:flex;gap:8px;flex-wrap:wrap">'+g.itens.map(function(nome,ii){return '<button class="btn btn-ghost" onclick="abrirConfiguracaoOrcamento('+gi+','+ii+')">'+nome+'</button>';}).join('')+'</div></div>';}).join('')+'<div id="orcamento-config-detalhe" aria-live="polite"></div>';
 }else{
   var textos={projetos:'Organizar projetos, participantes e modalidades. Um mesmo projeto poderá reunir Shows/Eventos, E-Commerce e Private Label.',shows:'Orçamentos de shows, turnês e eventos. A matriz será integrada após os cadastros e tabelas básicas.',ecommerce:'Orçamentos de vendas digitais. Desenvolvimento posterior.',private_label:'Orçamentos de produção para parceiros. Desenvolvimento posterior.',consolidado:'Reunir as modalidades do projeto, contabilizando custos compartilhados uma única vez.'};
   el.innerHTML+='<div class="card"><div class="card-title">Estrutura prevista</div><p style="color:var(--muted2)">'+textos[page]+'</p><p style="color:var(--muted);margin-top:12px">Funcionalidade em desenvolvimento. Nesta etapa, está disponível a navegação.</p></div>';
 }
}
function abrirConfiguracaoOrcamento(gi,ii){
 if(!canAccessProject('orcamento_vendas'))return;
 var nome=ORCAMENTO_CONFIG[gi]&&ORCAMENTO_CONFIG[gi].itens[ii];if(!nome)return;
 var desc={
 'Empresas e Pessoas':'Cadastro único. Obrigatórios: nome e pelo menos um papel. Tipo de pessoa, CPF/CNPJ, contatos e endereço opcionais.',
 'Papéis dos participantes':'Owner Product; Parceiro Cultural; Cliente; Parceiro Fabricação; Fornecedor; Prestador de Serviços. Uma pessoa ou empresa poderá acumular papéis.',
 'Funções profissionais':'Designer, supervisor, filmmaker, vendedor, estoquista e apoio, com valores de referência.',
 'Produtos e categorias':'Referências de produtos, categorias, custos e preços para os orçamentos.',
 'Locais de eventos':'Espaços, localização, capacidade e contatos.',
 'Categorias, rubricas e subrubricas':'Organização das receitas, deduções, custos, investimentos e remunerações.',
 'Modalidades e bases de cálculo':'Percentual, valor fixo ou quantidade × valor unitário. Bases como venda bruta e venda após descontos.',
 'Unidades de referência':'Pessoa, diária, quilômetro, veículo, peça, pedido, loja, show e mês.',
 'Regras de participação e rateio':'Remuneração administrativa, divisão do resultado e distribuição dos custos compartilhados.',
 'Tipos de parceria':'Shows/Eventos; E-Commerce; Private Label.',
 'Modelos de cenários':'Pessimista, Conservador e Otimista.',
 'Modelos de orçamento':'Rubricas e parâmetros iniciais para cada tipo de parceria. Referências não alteram versões já aprovadas.',
 'Situações e etapas':'Rascunho, Em elaboração, Em revisão, Aprovado, Encerrado e Cancelado.'
 };
 document.getElementById('orcamento-config-detalhe').innerHTML='<div class="card"><div class="card-title">'+nome+'</div><p style="color:var(--muted2)">'+desc[nome]+'</p><p style="color:var(--muted);margin-top:12px">Escopo definido. Cadastro e gravação serão implementados na próxima etapa.</p></div>';
}

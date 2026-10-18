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
 {nome:'Estrutura financeira',itens:['Categorias e Subcategorias','Modalidades e bases de cálculo','Unidades de referência','Regras de participação e rateio','Dimensionamento operacional']},
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
 if(gi===1&&ii===4){orcDimensionamento();return;}
 if(gi===1&&ii===0){orcCategorias();return;}
 if(gi===0&&(ii===0||ii===1)){orcCadastro(ii===0?'pessoas':'papeis');return;}
 if(!canAccessProject('orcamento_vendas'))return;
 var nome=ORCAMENTO_CONFIG[gi]&&ORCAMENTO_CONFIG[gi].itens[ii];if(!nome)return;
 var desc={
 'Empresas e Pessoas':'Cadastro único. Obrigatórios: nome e pelo menos um papel. Tipo de pessoa, CPF/CNPJ, contatos e endereço opcionais.',
 'Papéis dos participantes':'Owner Product; Parceiro Cultural; Cliente; Parceiro Fabricação; Fornecedor; Prestador de Serviços. Uma pessoa ou empresa poderá acumular papéis.',
 'Funções profissionais':'Designer, supervisor, filmmaker, vendedor, estoquista e apoio, com valores de referência.',
 'Produtos e categorias':'Referências de produtos, categorias, custos e preços para os orçamentos.',
 'Locais de eventos':'Espaços, localização, capacidade e contatos.',
 'Categorias e Subcategorias':'Organização das receitas, deduções, custos, investimentos e remunerações.',
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

var orcDados={pessoas:[],papeis:[]};
function orcEsc(v){return String(v||'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function orcPodeEditar(){return canAccessProject('orcamento_vendas')&&!isReadOnly();}
async function orcCadastro(tipo){
 if(!canAccessProject('orcamento_vendas'))return;
 var el=document.getElementById('orcamento-config-detalhe');if(!el)return;
 el.innerHTML='<div class="card">Carregando cadastros...</div>';
 try{
 var rows=await Promise.all([sb.get('cda_orc_pessoas','order=nome'),sb.get('cda_orc_papeis','order=nome')]);orcDados.pessoas=rows[0];orcDados.papeis=rows[1];
 if(currentProject!=='orcamento_vendas'||window._orcamentoPage!=='configuracoes')return;
 var titulo=tipo==='pessoas'?'Empresas e Pessoas':'Papéis dos participantes';
 el.innerHTML='<div class="card"><div class="card-title">'+titulo+'</div>'+(orcPodeEditar()?'<button class="btn btn-primary" onclick="orcFormulario(\''+tipo+'\')">＋ Novo cadastro</button>':'<p>Somente leitura</p>')+'<div id="orc-form" style="margin-top:16px"></div><div class="tbl-wrap"><table><thead><tr><th>Nome</th>'+(tipo==='pessoas'?'<th>Papéis</th>':'')+'<th>Situação</th><th>Ações</th></tr></thead><tbody>'+orcDados[tipo].map(function(p){
 var papeis=(p.papeis||[]).map(function(id){var r=orcDados.papeis.find(function(x){return x.id===id;});return orcEsc(r?r.nome:'Papel indisponível');}).join(', ');
 return '<tr><td>'+orcEsc(p.nome)+'</td>'+(tipo==='pessoas'?'<td>'+papeis+'</td>':'')+'<td>'+(p.ativo?'Ativo':'Inativo')+'</td><td>'+(orcPodeEditar()?'<button class="btn btn-ghost btn-sm" onclick="orcFormulario(\''+tipo+'\',\''+p.id+'\')">Editar</button> <button class="btn btn-ghost btn-sm" onclick="orcSituacao(\''+tipo+'\',\''+p.id+'\')">'+(p.ativo?'Inativar':'Reativar')+'</button>':'—')+'</td></tr>';
 }).join('')+'</tbody></table></div></div>';
 }catch(e){el.innerHTML='<div class="card">Não foi possível carregar os cadastros. Atualize sua sessão e tente novamente.</div>';showToast('Falha ao consultar os cadastros','error');}
}
function orcFormulario(tipo,id){
 if(!orcPodeEditar())return;
 var p=orcDados[tipo].find(function(x){return x.id===id;})||{};
 var html='<form id="orc-cadastro-form"><div class="form-group"><label class="form-label" for="orc-nome">Nome *</label><input class="form-input" id="orc-nome" required maxlength="160" value="'+orcEsc(p.nome)+'"></div>';
 if(tipo==='pessoas'){
 html+='<div class="form-group"><label class="form-label">Papéis * — selecione pelo menos um</label>'+orcDados.papeis.filter(function(r){return r.ativo||(p.papeis||[]).indexOf(r.id)>=0;}).map(function(r){return '<label style="display:inline-flex;gap:7px;margin:6px 18px 6px 0"><input type="checkbox" class="orc-papel" value="'+r.id+'" '+((p.papeis||[]).indexOf(r.id)>=0?'checked':'')+'>'+orcEsc(r.nome)+(r.ativo?'':' (inativo)')+'</label>';}).join('')+'</div><details><summary style="cursor:pointer;margin-bottom:14px">Dados complementares opcionais</summary><div class="form-group"><label class="form-label" for="orc-tipo">Tipo de pessoa</label><select class="form-input" id="orc-tipo"><option value="">Não informado</option><option value="fisica" '+(p.tipo==='fisica'?'selected':'')+'>Física</option><option value="juridica" '+(p.tipo==='juridica'?'selected':'')+'>Jurídica</option></select></div>';
 [['documento','CPF/CNPJ'],['email','E-mail'],['telefone','Telefone / WhatsApp'],['endereco','Endereço'],['observacoes','Observações']].forEach(function(f){html+='<div class="form-group"><label class="form-label" for="orc-'+f[0]+'">'+f[1]+'</label><input class="form-input" id="orc-'+f[0]+'" '+(f[0]==='email'?'type="email"':'')+' value="'+orcEsc(p[f[0]])+'"></div>';});
 html+='</details>';
 }
 html+='<button class="btn btn-primary" type="submit">Salvar</button> <button class="btn btn-ghost" type="button" onclick="document.getElementById(\'orc-form\').innerHTML=\'\'">Cancelar</button></form>';
 document.getElementById('orc-form').innerHTML=html;
 document.getElementById('orc-cadastro-form').onsubmit=async function(e){
 e.preventDefault();if(!orcPodeEditar())return;
 var d={nome:document.getElementById('orc-nome').value.trim()};if(!d.nome){showToast('Informe o nome','error');return;}
 if(tipo==='pessoas'){
 d.papeis=Array.from(document.querySelectorAll('.orc-papel:checked')).map(function(x){return x.value;});if(!d.papeis.length){showToast('Selecione pelo menos um papel','error');return;}
 d.tipo=document.getElementById('orc-tipo').value||null;
 ['documento','email','telefone','endereco','observacoes'].forEach(function(k){d[k]=document.getElementById('orc-'+k).value.trim()||null;});
 }
 var btn=e.target.querySelector('[type=submit]');btn.disabled=true;
 try{if(id)await sb.patch('cda_orc_'+tipo,id,d);else await sb.post('cda_orc_'+tipo,d);showToast('Cadastro salvo no banco de dados','success');await orcCadastro(tipo);}
 catch(err){btn.disabled=false;showToast('Não foi possível salvar. Confira sua permissão e, para papéis, se o nome já existe.','error');}
 };
}
async function orcSituacao(tipo,id){
 if(!orcPodeEditar())return;var p=orcDados[tipo].find(function(x){return x.id===id;});if(!p)return;
 try{await sb.patch('cda_orc_'+tipo,id,{ativo:!p.ativo});showToast('Situação atualizada','success');await orcCadastro(tipo);}catch(e){showToast('Não foi possível alterar a situação','error');}
}

var orcCategoriasDados=[];
function orcOrdenarCategorias(rows){
 var saida=[];function visitar(pai){rows.filter(function(r){return r.pai_id===pai;}).sort(function(a,b){return a.ordem-b.ordem;}).forEach(function(r){saida.push(r);visitar(r.id);});}visitar(null);return saida;
}
async function orcCategorias(){
 if(!canAccessProject('orcamento_vendas'))return;
 var el=document.getElementById('orcamento-config-detalhe');if(!el)return;
 el.innerHTML='<div class="card">Carregando categorias...</div>';
 try{
 orcCategoriasDados=await sb.get('cda_orc_categorias','order=ordem');
 if(currentProject!=='orcamento_vendas'||window._orcamentoPage!=='configuracoes')return;
 var rows=orcOrdenarCategorias(orcCategoriasDados);
 el.innerHTML='<div class="card"><div class="card-title">Categorias e Subcategorias — Plano de contas</div><p style="color:var(--muted2);margin-bottom:16px">Três níveis: Categoria → Subcategoria → Desdobramento. Códigos permanentes e gerados automaticamente.</p>'+(orcPodeEditar()?'<button class="btn btn-primary" onclick="orcCategoriaForm()">＋ Nova categoria</button>':'<p>Somente leitura</p>')+'<div id="orc-cat-form" style="margin-top:16px"></div><div class="tbl-wrap"><table><thead><tr><th>Código</th><th>Descrição</th><th>Nível</th><th>Subdivisão</th><th>Situação</th><th>Ações</th></tr></thead><tbody>'+rows.map(function(r){
 var filhos=rows.filter(function(x){return x.pai_id===r.id;}).length;
 return '<tr><td>'+r.codigo+'</td><td style="padding-left:'+((r.nivel-1)*20+13)+'px;'+(r.nivel===1?'font-weight:700':'')+'">'+orcEsc(r.nome)+'</td><td>'+r.nivel+'</td><td>'+(filhos?filhos+' registro(s)':'Inexistente')+'</td><td>'+(r.ativo?'Ativo':'Inativo')+'</td><td>'+(orcPodeEditar()?'<button class="btn btn-ghost btn-sm" onclick="orcCategoriaForm(\''+r.id+'\')">Editar</button> '+(r.nivel<3&&r.ativo?'<button class="btn btn-ghost btn-sm" onclick="orcCategoriaForm(null,\''+r.id+'\')">Adicionar subdivisão</button> ':'')+'<button class="btn btn-ghost btn-sm" onclick="orcCategoriaSituacao(\''+r.id+'\')">'+(r.ativo?'Inativar':'Reativar')+'</button>':'—')+'</td></tr>';
 }).join('')+'</tbody></table></div><p style="color:var(--muted);margin-top:16px">Inativar um registro preserva suas subdivisões e seus códigos. Cadastros inativos não devem ser utilizados em novos orçamentos. Esta etapa não altera valores nem versões de orçamento.</p></div>';
 }catch(e){el.innerHTML='<div class="card">Não foi possível carregar as categorias. Atualize sua sessão e tente novamente.</div>';}
}
function orcCategoriaForm(id,paiId){
 if(!orcPodeEditar())return;
 var r=orcCategoriasDados.find(function(x){return x.id===id;}),pai=orcCategoriasDados.find(function(x){return x.id===paiId;});
 if(pai&&(pai.nivel>=3||!pai.ativo))return;
 var el=document.getElementById('orc-cat-form');
 el.innerHTML='<form id="orc-cat-editor"><p style="margin-bottom:12px">'+(r?'Editar '+r.codigo:pai?'Nova subdivisão de '+pai.codigo+' — '+orcEsc(pai.nome):'Nova categoria — nível 1')+'</p><label class="form-label" for="orc-cat-nome">Nome *</label><input class="form-input" id="orc-cat-nome" required maxlength="160" value="'+orcEsc(r?r.nome:'')+'"><div style="margin:14px 0"><button class="btn btn-primary" type="submit">Salvar</button> <button class="btn btn-ghost" type="button" onclick="document.getElementById(\'orc-cat-form\').innerHTML=\'\'">Cancelar</button></div></form>';
 document.getElementById('orc-cat-editor').onsubmit=async function(e){
 e.preventDefault();if(!orcPodeEditar())return;var nome=document.getElementById('orc-cat-nome').value.trim();if(!nome)return;
 var btn=e.target.querySelector('[type=submit]');btn.disabled=true;
 try{if(r)await sb.patch('cda_orc_categorias',r.id,{nome:nome});else await sb.post('cda_orc_categorias',{nome:nome,pai_id:paiId||null});showToast('Categoria salva no banco de dados','success');await orcCategorias();}
 catch(err){btn.disabled=false;showToast('Não foi possível salvar a categoria. Confira sua permissão.','error');}
 };
 el.scrollIntoView({behavior:'smooth',block:'nearest'});
}
async function orcCategoriaSituacao(id){
 if(!orcPodeEditar())return;var r=orcCategoriasDados.find(function(x){return x.id===id;});if(!r)return;
 try{await sb.patch('cda_orc_categorias',id,{ativo:!r.ativo});showToast('Situação atualizada','success');await orcCategorias();}
 catch(e){showToast('Não foi possível atualizar a situação','error');}
}

var orcDim=null;
var orcDimCampos={shows:'Quantidade de shows',publico:'Público por show',capacidade_loja:'Compradores atendidos por loja/show',compradores_vendedor:'Compradores atendidos por vendedor/show',estoquistas_loja:'Estoquistas por loja',apoio_loja:'Apoio por loja',apoio_evento:'Apoio fixo por evento',valor_vendedor:'Vendedor — R$/show',valor_estoquista:'Estoquista — R$/show',valor_apoio:'Apoio — R$/show'};
function orcDimCalcular(d,r){
 var round=d.arredondamento==='proximo'?Math.round:Math.ceil;
 var compradores=d.publico*r.conversao/100;
 var lojas=d.capacidade_loja?round(compradores/d.capacidade_loja):null;
 var vendedores=d.compradores_vendedor?round(compradores/d.compradores_vendedor):null;
 var estoquistas=lojas!==null&&d.estoquistas_loja!==null?round(lojas*d.estoquistas_loja):null;
 var apoio=lojas!==null&&d.apoio_loja!==null&&d.apoio_evento!==null?round(lojas*d.apoio_loja+d.apoio_evento):null;
 var total=vendedores!==null&&estoquistas!==null&&apoio!==null&&d.valor_vendedor!==null&&d.valor_estoquista!==null&&d.valor_apoio!==null?(vendedores*d.valor_vendedor+estoquistas*d.valor_estoquista+apoio*d.valor_apoio)*d.shows:null;
 return {compradores:compradores,lojas:lojas,vendedores:vendedores,estoquistas:estoquistas,apoio:apoio,total:total};
}
async function orcDimensionamento(){
 if(!canAccessProject('orcamento_vendas'))return;var el=document.getElementById('orcamento-config-detalhe');if(!el)return;
 el.innerHTML='<div class="card">Carregando dimensionamento...</div>';
 try{
 var rows=await sb.get('cda_orc_dimensionamento','order=atualizado_em');
 orcDim=rows[0];if(!orcDim)throw Error('Sem referência');
 if(currentProject!=='orcamento_vendas'||window._orcamentoPage!=='configuracoes')return;
 var d=orcDim;
 el.innerHTML='<div class="card"><div class="card-title">Dimensionamento operacional</div><p style="color:var(--muted2);margin-bottom:18px">Parâmetros de referência. Campos sem valor aguardam conferência da memória original e não são tratados como zero. O simulador abaixo não substitui a matriz aprovada.</p><form id="orc-dim-form"><div class="form-row">'+Object.keys(orcDimCampos).map(function(k){return '<div class="form-group"><label class="form-label" for="dim-'+k+'">'+orcDimCampos[k]+'</label><input class="form-input" id="dim-'+k+'" type="number" min="'+(['shows','publico','capacidade_loja','compradores_vendedor'].includes(k)?'1':'0')+'" step="'+(['shows','publico'].includes(k)?'1':'any')+'" '+(['shows','publico'].includes(k)?'required':'')+' value="'+(d[k]===null?'':d[k])+'" '+(orcPodeEditar()?'':'disabled')+'></div>';}).join('')+'</div><label class="form-label" for="dim-round">Arredondamento da simulação</label><select id="dim-round" class="form-input" '+(orcPodeEditar()?'':'disabled')+'><option value="cima" '+(d.arredondamento==='cima'?'selected':'')+'>Para cima</option><option value="proximo" '+(d.arredondamento==='proximo'?'selected':'')+'>Inteiro mais próximo</option></select><p style="color:var(--muted);margin:12px 0">Regra inicial do simulador: compradores = público × conversão; lojas = compradores ÷ capacidade/loja; vendedores = compradores ÷ capacidade/vendedor; estoquistas = lojas × fator; apoio = lojas × fator + fixos. Os fatores da memória original ainda precisam ser conferidos.</p>'+(orcPodeEditar()?'<button class="btn btn-primary" type="submit">Salvar parâmetros</button>':'')+'</form><div id="dim-memoria" style="margin-top:18px"></div></div>';
 orcDimMemoria();
 document.getElementById('orc-dim-form').onsubmit=async function(e){e.preventDefault();if(!orcPodeEditar())return;var next={};Object.keys(orcDimCampos).forEach(function(k){var v=document.getElementById('dim-'+k).value;next[k]=v===''?null:Number(v);});next.arredondamento=document.getElementById('dim-round').value;next.atualizado_em=new Date().toISOString();var btn=e.target.querySelector('[type=submit]');btn.disabled=true;try{await sb.patch('cda_orc_dimensionamento',d.id,next);Object.assign(orcDim,next);orcDimMemoria();showToast('Parâmetros salvos no Supabase','success');}catch(err){showToast('Não foi possível salvar os parâmetros','error');}finally{btn.disabled=false;}};
 }catch(e){el.innerHTML='<div class="card">Não foi possível carregar o dimensionamento.</div>';}
}
function orcDimMemoria(){
 var d=orcDim,fmt=function(v){return v===null?'Pendente':Number(v).toLocaleString('pt-BR');};
 document.getElementById('dim-memoria').innerHTML='<div class="card-title">Referências aprovadas e memória da simulação</div><div class="tbl-wrap"><table><thead><tr><th>Cenário</th><th>Conversão</th><th>Compradores/show</th><th>Lojas aprovadas / calculadas</th><th>Vendedores aprovados / calculados</th><th>Estoquistas/show</th><th>Apoio/show</th><th>Equipe — total R$</th></tr></thead><tbody>'+d.referencias.map(function(r){var x=orcDimCalcular(d,r);return '<tr><td>'+orcEsc(r.cenario)+'</td><td>'+r.conversao+'%</td><td>'+fmt(x.compradores)+'</td><td>'+r.lojas+' / '+fmt(x.lojas)+'</td><td>'+r.vendedores+' / '+fmt(x.vendedores)+'</td><td>'+fmt(x.estoquistas)+'</td><td>'+fmt(x.apoio)+'</td><td>'+fmt(x.total)+'</td></tr>';}).join('')+'</tbody></table></div><p style="color:var(--muted);margin-top:12px">Público e shows são referências para novos orçamentos. A cópia dos parâmetros por versão e as exceções de cada evento serão integradas ao cadastro de projetos posteriormente.</p>';
}

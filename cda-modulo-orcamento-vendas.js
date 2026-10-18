// Orçamento Vendas — navegação inicial; sem gravação de dados nesta etapa.
var ORCAMENTO_PAGES={
 tipos:{icon:'🗂',label:'Tipos de Projeto'},
 projetos:{icon:'📁',label:'Projetos'},
 configuracoes:{icon:'⚙',label:'Cadastros compartilhados'}
};
var ORCAMENTO_CONFIG=[
 {nome:'Participantes e referências',itens:['Empresas e Pessoas','Papéis dos participantes','Funções profissionais','Produtos e categorias','Locais de eventos']},
 {nome:'Estrutura financeira',itens:['Categorias e Subcategorias','Modalidades e bases de cálculo','Unidades de referência','Regras de participação e rateio','Dimensionamento operacional']},
 {nome:'Controle',itens:['Cenários','Situações e etapas']}
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
 if(page==='tipos'||page==='projetos'){orcEstrutura(page);return;}
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
var orcCategoriaTipo=null,orcCategoriaTipos=[];
function orcOrdenarCategorias(rows){
 var saida=[];function visitar(pai){rows.filter(function(r){return r.pai_id===pai;}).sort(function(a,b){return a.ordem-b.ordem;}).forEach(function(r){saida.push(r);visitar(r.id);});}visitar(null);return saida;
}
async function orcCategorias(){
 if(!canAccessProject('orcamento_vendas'))return;
 var el=document.getElementById('orcamento-config-detalhe');if(!el)return;
 el.innerHTML='<div class="card">Carregando categorias...</div>';
 try{
 orcCategoriaTipos=await sb.get('cda_orc_tipos_projeto','order=codigo');
 if(!orcCategoriaTipo&&orcCategoriaTipos.length)orcCategoriaTipo=orcCategoriaTipos[0].id;
 var todasCategorias=await sb.get('cda_orc_categorias','order=ordem');
 orcCategoriasDados=todasCategorias.filter(function(x){return x.tipo_id===orcCategoriaTipo;});
 if(currentProject!=='orcamento_vendas'||window._orcamentoPage!=='configuracoes')return;
 var rows=orcOrdenarCategorias(orcCategoriasDados);
 el.innerHTML='';
 el.innerHTML='<div class="card"><div class="card-title">Categorias e Subcategorias — Plano de contas</div><p style="color:var(--muted2);margin-bottom:16px">Três níveis: Categoria → Subcategoria → Desdobramento. Padrões separados por Tipo de Projeto.</p><label class="form-label" for="orc-cat-tipo">Tipo de Projeto</label><select class="form-input" id="orc-cat-tipo" onchange="orcCategoriaTipo=this.value;orcCategorias()">'+orcCategoriaTipos.map(function(t){return '<option value="'+t.id+'" '+(t.id===orcCategoriaTipo?'selected':'')+'>'+String(t.codigo).padStart(2,'0')+' — '+orcEsc(t.nome)+'</option>';}).join('')+'</select><br>'+(orcPodeEditar()?'<button class="btn btn-primary" onclick="orcCategoriaForm()">＋ Nova categoria</button>':'<p>Somente leitura</p>')+'<div id="orc-cat-form" style="margin-top:16px"></div><div class="tbl-wrap"><table><thead><tr><th>Código</th><th>Descrição</th><th>Nível</th><th>Subdivisão</th><th>Situação</th><th>Ações</th></tr></thead><tbody>'+rows.map(function(r){
 var filhos=rows.filter(function(x){return x.pai_id===r.id;}).length;
 return '<tr><td>'+r.codigo+'</td><td style="padding-left:'+((r.nivel-1)*20+13)+'px;'+(r.nivel===1?'font-weight:700':'')+'">'+orcEsc(r.nome)+'</td><td>'+r.nivel+'</td><td>'+(filhos?filhos+' registro(s)':'')+'</td><td>'+(r.ativo?'Ativo':'Inativo')+'</td><td>'+(orcPodeEditar()?'<button class="btn btn-ghost btn-sm" onclick="orcCategoriaForm(\''+r.id+'\')">Editar</button> '+(r.nivel<3&&r.ativo?'<button class="btn btn-ghost btn-sm" onclick="orcCategoriaForm(null,\''+r.id+'\')">Adicionar subdivisão</button> ':'')+'<button class="btn btn-ghost btn-sm" onclick="orcCategoriaSituacao(\''+r.id+'\')">'+(r.ativo?'Inativar':'Reativar')+'</button>':'—')+'</td></tr>';
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
 try{if(r)await sb.patch('cda_orc_categorias',r.id,{nome:nome});else await sb.post('cda_orc_categorias',{nome:nome,pai_id:paiId||null,tipo_id:orcCategoriaTipo});showToast('Categoria salva no banco de dados','success');await orcCategorias();}
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

var orcEstr={tipos:[],projetos:[],vinculos:[],pessoas:[],participantes:[]};
async function orcEstrCarregar(){
 var r=await Promise.all([sb.get('cda_orc_tipos_projeto','order=codigo'),sb.get('cda_orc_projetos','order=nome'),sb.get('cda_orc_projeto_tipos','order=id'),sb.get('cda_orc_pessoas','order=nome'),sb.get('cda_orc_projeto_participantes','order=id')]);
 orcEstr={tipos:r[0],projetos:r[1],vinculos:r[2],pessoas:r[3],participantes:r[4]};
}
async function orcEstrutura(page){
 if(!canAccessProject('orcamento_vendas'))return;
 var el=document.getElementById('main-content');el.innerHTML='<div class="card">Carregando...</div>';
 try{await orcEstrCarregar();if(window._orcamentoPage!==page)return;
 var isTipo=page==='tipos',rows=isTipo?orcEstr.tipos:orcEstr.projetos;
 el.innerHTML='<div class="ph"><h1>'+(isTipo?'Tipos de Projeto':'Projetos')+'</h1><p>'+(isTipo?'Regras reutilizáveis por negócio. Um projeto pode utilizar vários tipos.':'Selecione um projeto para acessar seus tipos de negócio e o consolidado.')+'</p></div>'+(orcPodeEditar()?'<button class="btn btn-primary" onclick="orcEstrForm(\''+page+'\')">＋ '+(isTipo?'Novo tipo':'Novo projeto')+'</button>':'<div class="readonly-banner">Somente leitura</div>')+'<div id="orc-estr-form" style="margin:16px 0"></div><div class="card"><div class="tbl-wrap"><table><thead><tr><th>Nome</th><th>'+(isTipo?'Descrição':'Tipos vinculados')+'</th><th>Situação</th><th>Ações</th></tr></thead><tbody>'+rows.map(function(r){
 var tipos=orcEstr.vinculos.filter(function(v){return v.projeto_id===r.id&&v.ativo;}).map(function(v){var t=orcEstr.tipos.find(function(x){return x.id===v.tipo_id;});return t?orcEsc(t.nome):'';}).join(', ');
 return '<tr><td>'+(isTipo?String(r.codigo).padStart(2,'0')+' — ':'')+orcEsc(r.nome)+'</td><td>'+(isTipo?orcEsc(r.descricao):tipos)+'</td><td>'+(r.ativo?'Ativo':'Inativo')+'</td><td>'+(!isTipo?'<button class="btn btn-primary btn-sm" onclick="orcAbrirProjeto(\''+r.id+'\')">Abrir projeto</button> ':'')+(orcPodeEditar()?'<button class="btn btn-ghost btn-sm" onclick="orcEstrForm(\''+page+'\',\''+r.id+'\')">Editar</button> <button class="btn btn-ghost btn-sm" onclick="orcEstrAtivo(\''+page+'\',\''+r.id+'\')">'+(r.ativo?'Inativar':'Reativar')+'</button>':'')+'</td></tr>';
 }).join('')+'</tbody></table></div></div>';
 }catch(e){el.innerHTML='<div class="card">Não foi possível carregar a estrutura de projetos.</div>';}
}
function orcEstrForm(page,id){
 if(!orcPodeEditar())return;var tipo=page==='tipos',r=orcEstr[page].find(function(x){return x.id===id;})||{};
 document.getElementById('orc-estr-form').innerHTML='<form id="orc-estr-editor" class="card"><label class="form-label" for="estr-nome">Nome *</label><input class="form-input" id="estr-nome" required value="'+orcEsc(r.nome)+'"><label class="form-label" for="estr-desc" style="margin-top:12px">Descrição</label><input class="form-input" id="estr-desc" value="'+orcEsc(r.descricao)+'">'+(!tipo?'<p style="margin:14px 0">Tipos de Projeto * — selecione pelo menos um</p>'+orcEstr.tipos.filter(function(t){return t.ativo||orcEstr.vinculos.some(function(v){return v.projeto_id===id&&v.tipo_id===t.id&&v.ativo;});}).map(function(t){var selected=orcEstr.vinculos.some(function(v){return v.projeto_id===id&&v.tipo_id===t.id&&v.ativo;});return '<label style="display:inline-flex;gap:8px;margin-right:18px"><input type="checkbox" class="estr-tipo" value="'+t.id+'" '+(selected?'checked':'')+'>'+orcEsc(t.nome)+'</label>';}).join(''):'')+'<p style="margin-top:16px"><button type="submit" class="btn btn-primary">Salvar</button> <button type="button" class="btn btn-ghost" onclick="orcEstrutura(\''+page+'\')">Voltar / Cancelar</button></p></form>';
 document.getElementById('orc-estr-editor').onsubmit=async function(e){e.preventDefault();if(!orcPodeEditar())return;
 var nome=document.getElementById('estr-nome').value.trim(),descricao=document.getElementById('estr-desc').value.trim(),ids=Array.from(document.querySelectorAll('.estr-tipo:checked')).map(function(x){return x.value;});if(!nome||(!tipo&&!ids.length)){showToast('Informe nome e pelo menos um tipo para o projeto','error');return;}
 var btn=e.target.querySelector('button');btn.disabled=true;
 try{
 var table=tipo?'cda_orc_tipos_projeto':'cda_orc_projetos',pid=id;
 if(id)await sb.patch(table,id,{nome:nome,descricao:descricao});else{var created=await sb.post(table,{nome:nome,descricao:descricao});pid=created[0].id;}
 if(!tipo){
 for(var v of orcEstr.vinculos.filter(function(x){return x.projeto_id===pid;}))await sb.patch('cda_orc_projeto_tipos',v.id,{ativo:ids.indexOf(v.tipo_id)>=0});
 for(var tid of ids)if(!orcEstr.vinculos.some(function(x){return x.projeto_id===pid&&x.tipo_id===tid;}))await sb.post('cda_orc_projeto_tipos',{projeto_id:pid,tipo_id:tid});
 }
 showToast('Cadastro salvo','success');await orcEstrutura(page);
 }catch(err){showToast('Não foi possível concluir. Reabra o cadastro para conferir o que foi salvo antes de repetir.','error');btn.disabled=false;}
 };
}
async function orcEstrAtivo(page,id){if(!orcPodeEditar())return;var r=orcEstr[page].find(function(x){return x.id===id;});try{await sb.patch(page==='tipos'?'cda_orc_tipos_projeto':'cda_orc_projetos',id,{ativo:!r.ativo});await orcEstrutura(page);}catch(e){showToast('Não foi possível alterar a situação','error');}}
function orcAbrirProjeto(id){
 if(!canAccessProject('orcamento_vendas'))return;
 var p=orcEstr.projetos.find(function(x){return x.id===id;});if(!p)return;
 var el=document.getElementById('main-content');
 document.getElementById('page-title').textContent='Orçamento Vendas · '+p.nome;
 var participantes=orcEstr.participantes.filter(function(x){return x.projeto_id===id&&x.ativo;}).map(function(x){var pessoa=orcEstr.pessoas.find(function(a){return a.id===x.pessoa_id;});return pessoa?orcEsc(pessoa.nome):'';}).join(', ');
 el.innerHTML='<div class="ph"><h1>'+orcEsc(p.nome)+'</h1><p>Participantes: '+(participantes||'Nenhum vinculado')+'</p></div><button class="btn btn-ghost" onclick="navigateOrcamento(\'projetos\')">← Projetos</button><div id="orc-projeto-tipos" style="margin-top:18px">'+orcEstr.vinculos.filter(function(v){return v.projeto_id===id&&v.ativo;}).map(function(v){var t=orcEstr.tipos.find(function(x){return x.id===v.tipo_id;});return '<div class="card" style="margin-bottom:14px"><div class="card-title">'+String(t.codigo).padStart(2,'0')+' — '+orcEsc(t.nome)+'</div><button class="btn btn-primary" onclick="orcProjetoTipo(\''+v.id+'\')">Abrir orçamento deste tipo</button></div>';}).join('')+'</div><div class="card"><div class="card-title">Consolidado do projeto</div><p>Reunirá os resultados dos tipos vinculados, sem duplicar custos compartilhados. Integração dos orçamentos em desenvolvimento.</p></div><div id="orc-projeto-detalhe" style="margin-top:18px"></div>';
}
function orcProjetoTipo(id){
 var v=orcEstr.vinculos.find(function(x){return x.id===id;});if(!v||!canAccessProject('orcamento_vendas'))return;
 var t=orcEstr.tipos.find(function(x){return x.id===v.tipo_id;}),p=orcEstr.projetos.find(function(x){return x.id===v.projeto_id;}),params=v.parametros||{};
 document.getElementById('orc-projeto-detalhe').innerHTML='<div class="card"><div class="card-title">'+orcEsc(p.nome)+' → '+orcEsc(t.nome)+'</div><p>Orçamento próprio deste projeto e tipo. Sem camada de modelos de orçamento.</p>'+(params.publico_total?'<p style="margin-top:12px">Público total: '+params.publico_total.toLocaleString('pt-BR')+' · Shows: '+params.shows+' · Conversões: '+params.conversoes.join('%, ')+'%</p>':'<p style="margin-top:12px">Premissas específicas ainda não definidas.</p>')+'<p style="color:var(--muted2);margin-top:12px">Categorias, regras padrão por tipo e cópia dos parâmetros para cada versão serão integradas na próxima etapa. Os cadastros existentes foram preservados.</p></div>';
 document.getElementById('orc-projeto-detalhe').innerHTML+='<div class="card" style="margin-top:14px"><div class="card-title">Cadastros do projeto · '+orcEsc(t.nome)+'</div><button class="btn btn-primary" onclick="orcGeracaoPrevia(\''+id+'\')">Consultar cadastros do projeto</button><div id="orc-geracao" style="margin-top:16px"></div></div>';
 orcGeracaoPrevia(id);
 document.getElementById('orc-projeto-detalhe').scrollIntoView({behavior:'smooth',block:'nearest'});
}

var ORC_CADASTROS={categorias:'Categorias e Subcategorias',premissas:'Premissas e cenários',dimensionamento:'Regras de dimensionamento',funcoes:'Funções profissionais e remunerações',calculos:'Modalidades e bases de cálculo',produtos:'Produtos e preços',participantes:'Participantes e papéis',participacao:'Participação e rateio'};
var orcGeracao={vinculo:null,previa:[],gerados:[]};
async function orcRpc(nome,dados){return await sb.post('rpc/'+nome,dados);}
async function orcGeracaoPrevia(id){
 if(!canAccessProject('orcamento_vendas'))return;
 var el=document.getElementById('orc-geracao');if(!el)return;el.innerHTML='Carregando prévia...';
 try{
 var res=await Promise.all([orcRpc('cda_orc_previa_cadastros',{vinculo:id}),sb.get('cda_orc_cadastros_projeto','projeto_tipo_id=eq.'+id)]);
 orcGeracao={vinculo:id,previa:res[0],gerados:res[1]};
 el.innerHTML='<p style="color:var(--muted2);margin-bottom:14px">Cadastros próprios deste projeto e tipo. Os itens gerados estão disponíveis para consulta. Pessoas e empresas mantêm seus vínculos. A geração só é necessária para cadastros ainda inexistentes.</p><div class="tbl-wrap"><table><thead><tr><th>Cadastro</th><th>Situação</th><th>Ação</th></tr></thead><tbody>'+Object.keys(ORC_CADASTROS).map(function(k){var g=res[1].find(function(x){return x.chave===k;}),p=res[0].find(function(x){return x.chave===k;}),d=g?g.conteudo:p?p.conteudo:null,empty=!d||!Object.keys(d).length;return '<tr><td>'+ORC_CADASTROS[k]+'</td><td>'+(g?'Gerado':'Ainda não gerado')+(empty?' · Pendente de definição':'')+'</td><td><button class="btn btn-ghost btn-sm" onclick="orcGeracaoConsultar(\''+k+'\')">'+(g?'Consultar cadastro':'Ver prévia')+'</button></td></tr>';}).join('')+'</tbody></table></div>'+(orcPodeEditar()&&res[1].length<Object.keys(ORC_CADASTROS).length?'<button id="orc-gerar-btn" class="btn btn-primary" style="margin-top:16px" onclick="orcGeracaoExecutar()">Gerar cadastros faltantes</button>':'')+'<div id="orc-cadastro-projeto" style="margin-top:16px"></div>';
 }catch(e){el.innerHTML='Não foi possível carregar a prévia dos cadastros.';}
}
async function orcGeracaoExecutar(){
 if(!orcPodeEditar())return;var id=orcGeracao.vinculo,b=document.getElementById('orc-gerar-btn');b.disabled=true;
 try{var n=await orcRpc('cda_orc_gerar_cadastros',{vinculo:id});showToast(n?'Cadastros gerados sem substituir os existentes':'Os cadastros já estavam gerados','success');await orcGeracaoPrevia(id);}catch(e){showToast('Não foi possível gerar os cadastros. Nenhuma geração parcial foi aplicada.','error');b.disabled=false;}
}
function orcGeracaoConsultar(k){
 if(k==='categorias'){orcCategoriasProjeto();return;}
 if(!canAccessProject('orcamento_vendas'))return;
 var g=orcGeracao.gerados.find(function(x){return x.chave===k;}),p=orcGeracao.previa.find(function(x){return x.chave===k;}),d=g?g.conteudo:p?p.conteudo:null;
 var el=document.getElementById('orc-cadastro-projeto');if(!el)return;
 var label=function(x){return ({publico_total:'Público total',shows:'Quantidade de shows',conversoes:'Conversões (%)',situacao:'Situação',valor_unitario:'Valor unitário',nome:'Nome',unidade:'Unidade',codigo:'Código',nivel:'Nível',papeis:'Papéis',pessoa_id:'Participante',publico:'Público por show',capacidade_loja:'Compradores por loja',compradores_vendedor:'Compradores por vendedor',estoquistas_loja:'Estoquistas por loja',apoio_loja:'Apoio por loja',apoio_evento:'Apoio fixo por evento',valor_vendedor:'Vendedor R$/show',valor_estoquista:'Estoquista R$/show',valor_apoio:'Apoio R$/show',arredondamento:'Arredondamento',referencias:'Referências aprovadas',cenario:'Cenário',conversao:'Conversão (%)',lojas:'Lojas',vendedores:'Vendedores',modalidades:'Modalidades',bases:'Bases'})[x]||x;};
 function mostrar(v){
 if(v===null||v===undefined)return 'Pendente';
 if(typeof v!=='object')return orcEsc(v);
 if(Array.isArray(v)){if(!v.length)return '<p>Pendente de definição</p>';return v.map(function(x){return '<div style="padding:10px;border-bottom:1px solid var(--border)">'+mostrar(x)+'</div>';}).join('');}
 var keys=Object.keys(v).filter(function(x){return !['id','pai_id','tipo_id','criado_em','atualizado_em','ativo'].includes(x);});
 return '<table><tbody>'+keys.map(function(x){var val=v[x];if(x==='pessoa_id'){var pessoa=orcEstr.pessoas.find(function(z){return z.id===val;});val=pessoa?pessoa.nome:'Participante vinculado';}return '<tr><td>'+label(x)+'</td><td>'+mostrar(val)+'</td></tr>';}).join('')+'</tbody></table>';
 }
 el.innerHTML='<button class="btn btn-ghost" type="button" onclick="orcVoltarCadastros()">← Voltar aos cadastros</button><div class="card" style="margin-top:14px"><div class="card-title">'+ORC_CADASTROS[k]+' · '+(g?'Cadastro do projeto':'Prévia')+'</div>'+(!d||!Object.keys(d).length?'<p>Pendente de definição.</p>':mostrar(d))+'<p style="color:var(--muted);margin-top:14px">'+(g?'Cópia preservada desde '+new Date(g.gerado_em).toLocaleString('pt-BR')+'.':'Conteúdo de referência antes da geração.')+' A edição específica destes cadastros será integrada na próxima etapa.</p></div>';
}

function orcCategoriasProjeto(){
 if(!canAccessProject('orcamento_vendas'))return;
 var g=orcGeracao.gerados.find(function(x){return x.chave==='categorias';}),p=orcGeracao.previa.find(function(x){return x.chave==='categorias';}),rows=(g?g.conteudo:p?p.conteudo:[])||[],el=document.getElementById('orc-cadastro-projeto');if(!el)return;
 var sorted=orcOrdenarCategorias(rows),escrita=g&&orcPodeEditar();
 el.innerHTML='<button class="btn btn-ghost" type="button" onclick="orcVoltarCadastros()">← Voltar aos cadastros</button><div class="card" style="margin-top:14px"><div class="card-title">Categorias e Subcategorias · '+(g?'Cadastro próprio do projeto':'Prévia do Tipo de Projeto')+'</div><p style="color:var(--muted2);margin-bottom:14px">'+rows.filter(function(x){return x.nivel===1;}).length+' categorias e '+rows.filter(function(x){return x.nivel>1;}).length+' subdivisões. '+(g?'Alterações aqui pertencem somente a este projeto e tipo.':'Gere os cadastros para criar e editar a cópia do projeto.')+'</p>'+(escrita?'<button class="btn btn-primary" onclick="orcCategoriaProjetoForm()">＋ Nova categoria</button>':'')+'<div id="orc-proj-cat-form" style="margin:14px 0"></div><div class="tbl-wrap"><table><thead><tr><th>Código</th><th>Categoria / Subcategoria</th><th>Nível</th><th>Subdivisões</th><th>Situação</th><th>Ações</th></tr></thead><tbody>'+sorted.map(function(r){var filhos=rows.filter(function(x){return x.pai_id===r.id;}).length;return '<tr><td>'+orcEsc(r.codigo)+'</td><td style="padding-left:'+((r.nivel-1)*20+13)+'px;'+(r.nivel===1?'font-weight:bold':'')+'">'+orcEsc(r.nome)+'</td><td>'+r.nivel+'</td><td>'+(filhos||'')+'</td><td>'+(r.ativo===false?'Inativo':'Ativo')+'</td><td>'+(escrita?'<button class="btn btn-ghost btn-sm" onclick="orcCategoriaProjetoForm(\''+r.id+'\')">Editar</button> '+(r.nivel<3&&r.ativo!==false?'<button class="btn btn-ghost btn-sm" onclick="orcCategoriaProjetoForm(null,\''+r.id+'\')">Adicionar subdivisão</button> ':'')+'<button class="btn btn-ghost btn-sm" onclick="orcCategoriaProjetoSituacao(\''+r.id+'\')">'+(r.ativo===false?'Reativar':'Inativar')+'</button>':'—')+'</td></tr>';}).join('')+'</tbody></table></div></div>';
 el.scrollIntoView({behavior:'smooth',block:'start'});
}
function orcCategoriaProjetoForm(id,pai){
 if(!orcPodeEditar())return;var g=orcGeracao.gerados.find(function(x){return x.chave==='categorias';});if(!g)return;
 var r=g.conteudo.find(function(x){return x.id===id;}),par=g.conteudo.find(function(x){return x.id===pai;});
 var el=document.getElementById('orc-proj-cat-form');
 el.innerHTML='<form id="orc-proj-cat-editor"><p>'+(r?'Editar '+orcEsc(r.codigo):par?'Adicionar subdivisão em '+orcEsc(par.codigo):'Nova categoria do projeto')+'</p><label class="form-label" for="orc-proj-cat-nome">Nome *</label><input class="form-input" id="orc-proj-cat-nome" required maxlength="160" value="'+orcEsc(r?r.nome:'')+'"><p style="margin-top:12px"><button class="btn btn-primary" type="submit">Salvar no projeto</button> <button class="btn btn-ghost" type="button" onclick="orcCategoriasProjeto()">Cancelar</button></p></form>';
 document.getElementById('orc-proj-cat-editor').onsubmit=async function(e){e.preventDefault();var nome=document.getElementById('orc-proj-cat-nome').value.trim();if(!nome)return;var b=e.target.querySelector('button');b.disabled=true;try{await orcCategoriaProjetoSalvar({cadastro:g.id,acao:r?'renomear':'adicionar',item:id||null,pai:pai||null,nome:nome});}catch(err){b.disabled=false;showToast('Não foi possível salvar a categoria do projeto','error');}};
 el.scrollIntoView({behavior:'smooth',block:'nearest'});
}
async function orcCategoriaProjetoSalvar(payload){
 if(!orcPodeEditar())return;
 var result=await orcRpc('cda_orc_editar_categoria_projeto',payload);
 var g=orcGeracao.gerados.find(function(x){return x.id===payload.cadastro;});if(g)g.conteudo=result;
 showToast('Cadastro do projeto atualizado','success');orcCategoriasProjeto();
}
async function orcCategoriaProjetoSituacao(id){
 if(!orcPodeEditar())return;var g=orcGeracao.gerados.find(function(x){return x.chave==='categorias';});if(!g)return;
 try{await orcCategoriaProjetoSalvar({cadastro:g.id,acao:'situacao',item:id});}catch(e){showToast('Não foi possível alterar a situação','error');}
}

function orcVoltarCadastros(){var el=document.getElementById('orc-cadastro-projeto');if(el)el.innerHTML='';var lista=document.getElementById('orc-geracao');if(lista)lista.scrollIntoView({behavior:'smooth',block:'start'});}

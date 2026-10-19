// Orçamento Vendas — navegação inicial; sem gravação de dados nesta etapa.
var ORCAMENTO_PAGES={
 tipos:{icon:'🗂',label:'Tipos de Projeto'},
 projetos:{icon:'📁',label:'Projetos'},
 configuracoes:{icon:'⚙',label:'Cadastros compartilhados'}
};
var ORCAMENTO_CONFIG=[
 {nome:'Identidades compartilhadas',itens:['Tipo Participantes','Participantes']},
 {nome:'Cadastros padrão por Tipo de Projeto',itens:['Participantes por Tipo','Categorias e Subcategorias','Premissas e cenários','Regras de dimensionamento','Funções profissionais e remunerações','Produtos e preços','Participação e rateio']}
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
 if(!canAccessProject('orcamento_vendas'))return;
 if(gi===0){orcCadastro(ii===0?'papeis':'pessoas');return;}
 if(gi===1){var chave=['participantes','categorias','premissas','dimensionamento','funcoes','produtos','participacao'][ii];if(chave==='categorias'){orcCategorias();return;}if(chave)orcPadraoTipo(chave);}
}

var orcDados={pessoas:[],papeis:[]};
function orcEsc(v){return String(v===null||v===undefined?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function orcPodeEditar(){return canAccessProject('orcamento_vendas')&&!isReadOnly();}
async function orcCadastro(tipo){
 if(!canAccessProject('orcamento_vendas'))return;
 var el=document.getElementById('orcamento-config-detalhe');if(!el)return;
 el.innerHTML='<div class="card">Carregando cadastros...</div>';
 try{
 var rows=await Promise.all([sb.get('cda_orc_pessoas','order=nome'),sb.get('cda_orc_papeis','order=nome')]);orcDados.pessoas=rows[0];orcDados.papeis=rows[1];
 if(currentProject!=='orcamento_vendas'||window._orcamentoPage!=='configuracoes')return;
 var titulo=tipo==='pessoas'?'Participantes':'Tipo Participantes';
 el.innerHTML='<div class="card"><div class="card-title">'+titulo+'</div>'+(orcPodeEditar()?'<button class="btn btn-primary" onclick="orcFormulario(\''+tipo+'\')">＋ Novo cadastro</button>':'<p>Somente leitura</p>')+'<div id="orc-form" style="margin-top:16px"></div><div class="tbl-wrap"><table><thead><tr><th>Nome</th>'+(tipo==='pessoas'?'<th>Tipo Participantes</th>':'')+'<th>Situação</th><th>Ações</th></tr></thead><tbody>'+orcDados[tipo].map(function(p){
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
 html+='<div class="form-group"><label class="form-label">Tipo Participantes * — selecione pelo menos um</label>'+orcDados.papeis.filter(function(r){return r.ativo||(p.papeis||[]).indexOf(r.id)>=0;}).map(function(r){return '<label style="display:inline-flex;gap:7px;margin:6px 18px 6px 0"><input type="checkbox" class="orc-papel" value="'+r.id+'" '+((p.papeis||[]).indexOf(r.id)>=0?'checked':'')+'>'+orcEsc(r.nome)+(r.ativo?'':' (inativo)')+'</label>';}).join('')+'</div><details><summary style="cursor:pointer;margin-bottom:14px">Dados complementares opcionais</summary><div class="form-group"><label class="form-label" for="orc-tipo">Tipo de pessoa</label><select class="form-input" id="orc-tipo"><option value="">Não informado</option><option value="fisica" '+(p.tipo==='fisica'?'selected':'')+'>Física</option><option value="juridica" '+(p.tipo==='juridica'?'selected':'')+'>Jurídica</option></select></div>';
 [['documento','CPF/CNPJ'],['email','E-mail'],['telefone','Telefone / WhatsApp'],['endereco','Endereço'],['observacoes','Observações']].forEach(function(f){html+='<div class="form-group"><label class="form-label" for="orc-'+f[0]+'">'+f[1]+'</label><input class="form-input" id="orc-'+f[0]+'" '+(f[0]==='email'?'type="email"':'')+' value="'+orcEsc(p[f[0]])+'"></div>';});
 html+='</details>';
 }
 html+='<button class="btn btn-primary" type="submit">Salvar</button> <button class="btn btn-ghost" type="button" onclick="document.getElementById(\'orc-form\').innerHTML=\'\'">Cancelar</button></form>';
 document.getElementById('orc-form').innerHTML=html;
 document.getElementById('orc-cadastro-form').onsubmit=async function(e){
 e.preventDefault();if(!orcPodeEditar())return;
 var d={nome:document.getElementById('orc-nome').value.trim()};if(!d.nome){showToast('Informe o nome','error');return;}
 if(tipo==='pessoas'){
 d.papeis=Array.from(document.querySelectorAll('.orc-papel:checked')).map(function(x){return x.value;});if(!d.papeis.length){showToast('Selecione pelo menos um tipo de participante','error');return;}
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

var orcCategoriasDados=[],orcFormulasCategorias=[];
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
 var todasCategorias=await sb.get('cda_orc_categorias','order=ordem');orcFormulasCategorias=await sb.get('cda_orc_formulas_categoria','select=*');
 orcCategoriasDados=todasCategorias.filter(function(x){return x.tipo_id===orcCategoriaTipo;});
 if(currentProject!=='orcamento_vendas'||window._orcamentoPage!=='configuracoes')return;
 var rows=orcOrdenarCategorias(orcCategoriasDados);
 el.innerHTML='';
 el.innerHTML='<div class="card"><div class="card-title">Categorias e Subcategorias — Plano de contas</div><p style="color:var(--muted2);margin-bottom:16px">Três níveis: Categoria → Subcategoria → Desdobramento. Padrões separados por Tipo de Projeto.</p><label class="form-label" for="orc-cat-tipo">Tipo de Projeto</label><select class="form-input" id="orc-cat-tipo" onchange="orcCategoriaTipo=this.value;orcCategorias()">'+orcCategoriaTipos.map(function(t){return '<option value="'+t.id+'" '+(t.id===orcCategoriaTipo?'selected':'')+'>'+String(t.codigo).padStart(2,'0')+' — '+orcEsc(t.nome)+'</option>';}).join('')+'</select><br>'+(orcPodeEditar()?'<button class="btn btn-primary" onclick="orcCategoriaForm()">＋ Nova categoria</button>':'<p>Somente leitura</p>')+'<div id="orc-cat-form" style="margin-top:16px"></div><div class="tbl-wrap"><table><thead><tr><th>Código</th><th>Descrição</th><th>Nível</th><th>Subdivisão</th><th>Situação</th><th>Ações</th></tr></thead><tbody>'+rows.map(function(r){
 var filhos=rows.filter(function(x){return x.pai_id===r.id;}).length;
 return '<tr><td>'+r.codigo+'</td><td style="padding-left:'+((r.nivel-1)*20+13)+'px;'+(r.nivel===1?'font-weight:700':'')+'">'+orcEsc(r.nome)+'</td><td>'+r.nivel+'</td><td>'+(filhos?filhos+' registro(s)':'')+'</td><td>'+(r.ativo?'Ativo':'Inativo')+'</td><td><button class="btn btn-ghost btn-sm" onclick="orcFormulaAbrir(\'padrao\',\''+r.id+'\')">Fórmula de cálculo</button> '+(orcPodeEditar()?'<button class="btn btn-ghost btn-sm" onclick="orcCategoriaForm(\''+r.id+'\')">Editar</button> '+(r.nivel<3&&r.ativo?'<button class="btn btn-ghost btn-sm" onclick="orcCategoriaForm(null,\''+r.id+'\')">Adicionar subdivisão</button> ':'')+'<button class="btn btn-ghost btn-sm" onclick="orcCategoriaSituacao(\''+r.id+'\')">'+(r.ativo?'Inativar':'Reativar')+'</button>':'—')+'</td></tr>';
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
var orcDimCampos={shows:'Quantidade de shows',publico:'Público por show',capacidade_loja:'Compradores atendidos por loja/show',compradores_vendedor:'Compradores atendidos por vendedor/show',estoquistas_loja:'Estoquistas por loja',apoio_loja:'Apoio por loja',vendedores_loja:'Vendedores por loja',valor_vendedor:'Vendedor — R$/show',valor_estoquista:'Estoquista — R$/show',valor_apoio:'Apoio — R$/show'};
function orcDimCalcular(d,r){
 var round=Math.round;
 var compradores=d.publico*r.conversao/100;
 var lojas=d.capacidade_loja?round(compradores/d.capacidade_loja):null;
 var vendedores=d.compradores_vendedor?round(compradores/d.compradores_vendedor):null;
 var estoquistas=lojas!==null&&d.estoquistas_loja!==null?round(lojas*d.estoquistas_loja):null;
 var apoio=lojas!==null&&d.apoio_loja!==null?round(lojas*d.apoio_loja):null;
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
 el.innerHTML='<div class="card"><div class="card-title">Dimensionamento operacional</div><p style="color:var(--muted2);margin-bottom:18px">Parâmetros de referência. Campos sem valor aguardam conferência da memória original e não são tratados como zero. O simulador abaixo não substitui a matriz aprovada.</p><form id="orc-dim-form"><div class="form-row">'+Object.keys(orcDimCampos).map(function(k){return '<div class="form-group"><label class="form-label" for="dim-'+k+'">'+orcDimCampos[k]+'</label><input class="form-input" id="dim-'+k+'" type="number" min="'+(['shows','publico','capacidade_loja','compradores_vendedor'].includes(k)?'1':'0')+'" step="'+(['shows','publico'].includes(k)?'1':'any')+'" '+(['shows','publico'].includes(k)?'required':'')+' value="'+(d[k]==null?'':d[k])+'" '+(orcPodeEditar()?'':'disabled')+'></div>';}).join('')+'</div><label class="form-label" for="dim-round">Arredondamento da simulação</label><select id="dim-round" class="form-input" '+(orcPodeEditar()?'':'disabled')+'><option value="cima" '+(d.arredondamento==='cima'?'selected':'')+'>Para cima</option><option value="proximo" '+(d.arredondamento==='proximo'?'selected':'')+'>Inteiro mais próximo</option></select><p style="color:var(--muted);margin:12px 0">Regra inicial do simulador: compradores = público × conversão; lojas = compradores ÷ capacidade/loja; vendedores = compradores ÷ capacidade/vendedor; estoquistas = lojas × fator; apoio = lojas × apoio por loja. Os fatores da memória original ainda precisam ser conferidos.</p>'+(orcPodeEditar()?'<button class="btn btn-primary" type="submit">Salvar parâmetros</button>':'')+'</form><div id="dim-memoria" style="margin-top:18px"></div></div>';
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
 document.getElementById('orc-projeto-detalhe').innerHTML='<div class="card"><div class="card-title">'+orcEsc(p.nome)+' → '+orcEsc(t.nome)+'</div><p>Orçamento próprio deste projeto e tipo. Sem camada de modelos de orçamento.</p>'+(params.publico_total?'<p style="margin-top:12px">Público total: '+params.publico_total.toLocaleString('pt-BR')+' · Shows: '+params.shows+' · Conversões: '+params.conversoes.join('%, ')+'%</p>':'<p style="margin-top:12px">Premissas específicas ainda não definidas.</p>')+'<p style="color:var(--muted2);margin-top:12px">Os cadastros deste projeto são cópias independentes dos padrões do Tipo de Projeto. Alterações nos padrões não modificam estas cópias.</p></div>';
 document.getElementById('orc-projeto-detalhe').innerHTML+='<div class="card" style="margin-top:14px"><div class="card-title">Cadastros do projeto · '+orcEsc(t.nome)+'</div><button class="btn btn-primary" onclick="orcGeracaoPrevia(\''+id+'\')">Consultar cadastros do projeto</button><div id="orc-geracao" style="margin-top:16px"></div></div>';
 orcGeracaoPrevia(id);
 document.getElementById('orc-projeto-detalhe').scrollIntoView({behavior:'smooth',block:'nearest'});
}

var ORC_CADASTROS={categorias:'Categorias e Subcategorias',premissas:'Premissas e cenários',dimensionamento:'Regras de dimensionamento',funcoes:'Funções profissionais e remunerações',calculos:'Modalidades e bases de cálculo',produtos:'Produtos e preços',participantes:'Participantes por Tipo',participacao:'Participação e rateio'};
var orcGeracao={vinculo:null,previa:[],gerados:[]};
async function orcRpc(nome,dados){return await sb.post('rpc/'+nome,dados);}
async function orcGeracaoPrevia(id){
 if(!canAccessProject('orcamento_vendas'))return;
 var el=document.getElementById('orc-geracao');if(!el)return;el.innerHTML='Carregando prévia...';
 try{
 var res=await Promise.all([orcRpc('cda_orc_previa_cadastros',{vinculo:id}),sb.get('cda_orc_cadastros_projeto','projeto_tipo_id=eq.'+id)]);
 orcGeracao={vinculo:id,previa:res[0],gerados:res[1]};
 el.innerHTML='<p style="color:var(--muted2);margin-bottom:14px">Cadastros próprios deste projeto e tipo. Os itens gerados estão disponíveis para consulta. Pessoas e empresas mantêm seus vínculos. A geração só é necessária para cadastros ainda inexistentes.</p><div class="tbl-wrap"><table><thead><tr><th>Cadastro</th><th>Situação</th><th>Ação</th></tr></thead><tbody>'+Object.keys(ORC_CADASTROS).filter(function(k){return k!=='calculos';}).map(function(k){var g=res[1].find(function(x){return x.chave===k;}),p=res[0].find(function(x){return x.chave===k;}),d=g?g.conteudo:p?p.conteudo:null,empty=!d||!Object.keys(d).length;return '<tr><td>'+ORC_CADASTROS[k]+'</td><td>'+(g?'Gerado':'Ainda não gerado')+(empty?' · Pendente de definição':'')+'</td><td><button class="btn btn-ghost btn-sm" onclick="orcGeracaoConsultar(\''+k+'\')">'+(g?'Consultar cadastro':'Ver prévia')+'</button></td></tr>';}).join('')+'</tbody></table></div>'+(orcPodeEditar()&&res[1].length<Object.keys(ORC_CADASTROS).length?'<button id="orc-gerar-btn" class="btn btn-primary" style="margin-top:16px" onclick="orcGeracaoExecutar()">Gerar cadastros faltantes</button>':'')+'<div id="orc-cadastro-projeto" style="margin-top:16px"></div>';
 }catch(e){el.innerHTML='Não foi possível carregar a prévia dos cadastros.';}
}
async function orcGeracaoExecutar(){
 if(!orcPodeEditar())return;var id=orcGeracao.vinculo,b=document.getElementById('orc-gerar-btn');b.disabled=true;
 try{var n=await orcRpc('cda_orc_gerar_cadastros',{vinculo:id});showToast(n?'Cadastros gerados sem substituir os existentes':'Os cadastros já estavam gerados','success');await orcGeracaoPrevia(id);}catch(e){showToast('Não foi possível gerar os cadastros. Nenhuma geração parcial foi aplicada.','error');b.disabled=false;}
}
function orcGeracaoConsultar(k){
 if(k==='categorias'){orcCategoriasProjeto();return;}
 orcProjetoCadastroEditor(k);return;
 if(!canAccessProject('orcamento_vendas'))return;
 var g=orcGeracao.gerados.find(function(x){return x.chave===k;}),p=orcGeracao.previa.find(function(x){return x.chave===k;}),d=g?g.conteudo:p?p.conteudo:null;
 var el=document.getElementById('orc-cadastro-projeto');if(!el)return;
 var label=function(x){return ({publico_total:'Público total',shows:'Quantidade de shows',conversoes:'Conversões (%)',situacao:'Situação',valor_unitario:'Valor unitário',nome:'Nome',unidade:'Unidade',codigo:'Código',nivel:'Nível',papeis:'Papéis',pessoa_id:'Participante',publico:'Público por show',capacidade_loja:'Compradores por loja',compradores_vendedor:'Compradores por vendedor',estoquistas_loja:'Estoquistas por loja',apoio_loja:'Apoio por loja',vendedores_loja:'Vendedores por loja',valor_vendedor:'Vendedor R$/show',valor_estoquista:'Estoquista R$/show',valor_apoio:'Apoio R$/show',arredondamento:'Arredondamento',referencias:'Referências aprovadas',cenario:'Cenário',conversao:'Conversão (%)',lojas:'Lojas',vendedores:'Vendedores',modalidades:'Modalidades',bases:'Bases'})[x]||x;};
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
 el.innerHTML='<button class="btn btn-ghost" type="button" onclick="orcVoltarCadastros()">← Voltar aos cadastros</button><div class="card" style="margin-top:14px"><div class="card-title">Categorias e Subcategorias · '+(g?'Cadastro próprio do projeto':'Prévia do Tipo de Projeto')+'</div><p style="color:var(--muted2);margin-bottom:14px">'+rows.filter(function(x){return x.nivel===1;}).length+' categorias e '+rows.filter(function(x){return x.nivel>1;}).length+' subdivisões. '+(g?'Alterações aqui pertencem somente a este projeto e tipo.':'Gere os cadastros para criar e editar a cópia do projeto.')+'</p>'+(escrita?'<button class="btn btn-primary" onclick="orcCategoriaProjetoForm()">＋ Nova categoria</button>':'')+'<div id="orc-proj-cat-form" style="margin:14px 0"></div><div class="tbl-wrap"><table><thead><tr><th>Código</th><th>Categoria / Subcategoria</th><th>Nível</th><th>Subdivisões</th><th>Situação</th><th>Ações</th></tr></thead><tbody>'+sorted.map(function(r){var filhos=rows.filter(function(x){return x.pai_id===r.id;}).length;return '<tr><td>'+orcEsc(r.codigo)+'</td><td style="padding-left:'+((r.nivel-1)*20+13)+'px;'+(r.nivel===1?'font-weight:bold':'')+'">'+orcEsc(r.nome)+'</td><td>'+r.nivel+'</td><td>'+(filhos||'')+'</td><td>'+(r.ativo===false?'Inativo':'Ativo')+'</td><td><button class="btn btn-ghost btn-sm" onclick="orcFormulaAbrir(\'projeto\',\''+r.id+'\')">Fórmula de cálculo</button> '+(escrita?'<button class="btn btn-ghost btn-sm" onclick="orcCategoriaProjetoForm(\''+r.id+'\')">Editar</button> '+(r.nivel<3&&r.ativo!==false?'<button class="btn btn-ghost btn-sm" onclick="orcCategoriaProjetoForm(null,\''+r.id+'\')">Adicionar subdivisão</button> ':'')+'<button class="btn btn-ghost btn-sm" onclick="orcCategoriaProjetoSituacao(\''+r.id+'\')">'+(r.ativo===false?'Reativar':'Inativar')+'</button>':'—')+'</td></tr>';}).join('')+'</tbody></table></div></div>';
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

var orcPadraoSelecionado=null,orcEditor=null;
var orcEsquemas={
 premissas:{publico_total:null,shows:null,cenarios:[{nome:'',conversao:null}],valores:{ticket_medio:null}},
 dimensionamento:{area_loja:null,capacidade_loja:null,compradores_vendedor:null,vendedores_loja:null,estoquistas_loja:null,apoio_loja:null,arredondamento:'proximo'},
 funcoes:[{nome:'',unidade:'profissional/show',valor_unitario:null}],
 calculos:{modalidades:[''],bases:['']},
 produtos:[{nome:'',unidade:'peça',custo_unitario:null,preco_venda:null}],
 participantes:[{pessoa_id:'',papel:''}],
 participacao:{regras:[{nome:'',percentual:null,base:''}]}
};
var orcRotulos={ticket_medio:'Ticket médio por comprador (R$)',valores:'Premissas de valores por show/evento',nome:'Nome',publico_total:'Público total',shows:'Quantidade de eventos',cenarios:'Cenários',conversao:'Conversão (%)',conversoes:'Conversões (%)',capacidade_loja:'Compradores atendidos por loja/evento',area_loja:'Área por loja (m²)',compradores_vendedor:'Compradores atendidos por vendedor/evento',estoquistas_loja:'Estoquistas por loja',apoio_loja:'Apoio por loja',vendedores_loja:'Vendedores por loja',arredondamento:'Arredondamento',unidade:'Unidade',valor_unitario:'Valor unitário (R$)',modalidades:'Modalidades',bases:'Bases de cálculo',custo_unitario:'Custo unitário (R$)',preco_venda:'Preço de venda (R$)',pessoa_id:'Participante',papel:'Tipo Participação',regras:'Regras',percentual:'Percentual (%)',base:'Base de cálculo',publico:'Público por evento',valor_vendedor:'Vendedor — R$/evento',valor_estoquista:'Estoquista — R$/evento',valor_apoio:'Apoio — R$/evento',referencias:'Referências preservadas',cenario:'Cenário',lojas:'Lojas',vendedores:'Vendedores',situacao:'Situação'};
async function orcPadraoTipo(k){
 if(!canAccessProject('orcamento_vendas'))return;
 var el=document.getElementById('orcamento-config-detalhe');el.innerHTML='<div class="card">Carregando padrões por tipo...</div>';
 try{
 var tipos=await sb.get('cda_orc_tipos_projeto','order=codigo');
 if(!orcPadraoSelecionado&&tipos.length)orcPadraoSelecionado=tipos[0].id;
 var rows=await sb.get('cda_orc_padroes_tipo','tipo_id=eq.'+orcPadraoSelecionado+'&chave=eq.'+k);
 var pessoas=await sb.get('cda_orc_pessoas','order=nome');
 el.innerHTML='<div class="card"><div class="card-title">'+ORC_CADASTROS[k]+' · Cadastro compartilhado</div><label class="form-label" for="orc-padrao-tipo">Tipo de Projeto</label><select id="orc-padrao-tipo" class="form-input">'+tipos.map(function(t){return '<option value="'+t.id+'" '+(t.id===orcPadraoSelecionado?'selected':'')+'>'+String(t.codigo).padStart(2,'0')+' — '+orcEsc(t.nome)+'</option>';}).join('')+'</select><p style="color:var(--muted2);margin:14px 0">Padrão exclusivo do tipo selecionado. Salvar aqui não altera os cadastros já gerados nos projetos.</p><div id="orc-editor-conteudo"></div></div>';
 document.getElementById('orc-padrao-tipo').onchange=function(){orcPadraoSelecionado=this.value;orcPadraoTipo(k);};
 var r=rows[0]||{id:null,conteudo:{},tipo_id:orcPadraoSelecionado,chave:k};
 var tiposParticipantes=k==='participantes'?await sb.get('cda_orc_papeis','order=nome'):[];
 orcIniciarEditor('padrao',r,k,pessoas,tiposParticipantes);
 }catch(e){el.innerHTML='<div class="card">Não foi possível carregar o cadastro compartilhado.</div>';}
}
async function orcProjetoCadastroEditor(k){
 if(!canAccessProject('orcamento_vendas'))return;
 var g=orcGeracao.gerados.find(function(x){return x.chave===k;}),p=orcGeracao.previa.find(function(x){return x.chave===k;});
 var el=document.getElementById('orc-cadastro-projeto');
 if(!g){el.innerHTML='<button class="btn btn-ghost" onclick="orcVoltarCadastros()">← Voltar aos cadastros</button><div class="card" style="margin-top:14px"><p>Gere este cadastro para editar a cópia do projeto.</p></div>';return;}
 el.innerHTML='<button class="btn btn-ghost" onclick="orcVoltarCadastros()">← Voltar aos cadastros</button><div class="card" style="margin-top:14px"><div class="card-title">'+ORC_CADASTROS[k]+' · Cadastro próprio do projeto</div><p style="color:var(--muted2);margin-bottom:14px">Estas alterações pertencem somente ao projeto e tipo selecionados. O padrão compartilhado é preservado.</p><div id="orc-editor-conteudo"></div></div>';
 try{var pessoas=await sb.get('cda_orc_pessoas','order=nome');var tiposParticipantes=k==='participantes'?await sb.get('cda_orc_papeis','order=nome'):[];orcIniciarEditor('projeto',g,k,pessoas,tiposParticipantes);}catch(e){showToast('Não foi possível abrir o editor','error');}
 el.scrollIntoView({behavior:'smooth',block:'start'});
}
function orcIniciarEditor(escopo,r,k,pessoas,tiposParticipantes){
 var d=JSON.parse(JSON.stringify(r.conteudo));
 if(k==='dimensionamento'&&d&&typeof d==='object'&&!Array.isArray(d)&&Object.keys(d).length){delete d['apoio'+'_evento'];if(d.vendedores_loja===undefined)d.vendedores_loja=4;}
 if(!d||!Object.keys(d).length)d=JSON.parse(JSON.stringify(orcEsquemas[k]));
 if(k==='premissas'){if(!d.valores||typeof d.valores!=='object')d.valores={};if(d.valores.ticket_medio===undefined)d.valores.ticket_medio=null;}
 if(k==='dimensionamento'){d.arredondamento='proximo';['area_loja','capacidade_loja','compradores_vendedor','vendedores_loja','estoquistas_loja','apoio_loja'].forEach(function(key){if(d[key]===undefined)d[key]=null;});}
 if(k==='participantes'&&Array.isArray(d))d.forEach(function(item){
 if(item.papel===undefined||item.papel===null)item.papel='';
 var tipo=(tiposParticipantes||[]).find(function(t){return t.id===item.papel||t.nome===item.papel;});
 if(tipo)item.papel=tipo.id;
 });
 orcEditor={escopo:escopo,r:r,k:k,anterior:JSON.parse(JSON.stringify(r.conteudo)),dados:d,pessoas:pessoas,tiposParticipantes:tiposParticipantes||[]};
 orcRenderEditor();
}
function orcEditorGet(path){return path.reduce(function(o,k){return o[k];},orcEditor.dados);}
function orcEditorSet(path,value){if(!orcPodeEditar())return;var parent=orcEditor.dados;for(var i=0;i<path.length-1;i++)parent=parent[path[i]];parent[path[path.length-1]]=value;}
function orcRenderEditor(){
 if(orcEditor.k==='participantes'){orcRenderParticipantesTipo();return;}
 var paths=[],editable=orcPodeEditar();
 function campo(v,path,key){
 var n=paths.push(path)-1,label=orcRotulos[key]||key||'Item',disabled=editable?'':' disabled';
 if(Array.isArray(v)){
 return '<fieldset style="border:1px solid var(--border2);padding:14px;margin:14px 0"><legend>'+orcEsc(label)+'</legend>'+v.map(function(item,i){return '<div style="border-bottom:1px solid var(--border);padding:12px 0">'+campo(item,path.concat(i),key)+(editable?'<button class="btn btn-ghost btn-sm" type="button" data-remove="'+n+':'+i+'">Retirar item</button>':'')+'</div>';}).join('')+(editable?'<button class="btn btn-ghost" type="button" data-add="'+n+'">＋ Adicionar item</button>':'')+'</fieldset>';
 }
 if(v&&typeof v==='object'){
 return (orcEditor.k==='premissas'&&key==='valores'?'<h3 style="margin:18px 0">Premissas de valores por show/evento</h3>':'')+'<div class="form-row">'+(orcEditor.k==='dimensionamento'&&orcEditor.escopo==='padrao'&&path.length===0?['area_loja','capacidade_loja','compradores_vendedor','vendedores_loja','estoquistas_loja','apoio_loja']:Object.keys(v)).filter(function(k){return !['id','criado_em','atualizado_em','arredondamento'].includes(k);}).map(function(k){return '<div>'+campo(v[k],path.concat(k),k)+'</div>';}).join('')+'</div>';
 }
 if(key==='papel'&&orcEditor.k==='participantes'){
 var tipos=orcEditor.tiposParticipantes.filter(function(t){return t.ativo||t.id===v;});
 return '<label class="form-label">'+label+'</label><select class="form-input" data-field="'+n+'"'+disabled+'><option value="">Selecione</option>'+((v&&!tipos.some(function(t){return t.id===v;}))?'<option value="'+orcEsc(v)+'" selected>'+orcEsc(v)+' (cadastro anterior)</option>':'')+tipos.map(function(t){return '<option value="'+orcEsc(t.id)+'" '+(t.id===v?'selected':'')+'>'+orcEsc(t.nome)+(t.ativo?'':' (inativo)')+'</option>';}).join('')+'</select>';
 }
 if(key==='pessoa_id')return '<label class="form-label">'+label+'</label><select class="form-input" data-field="'+n+'"'+disabled+'><option value="">Selecione</option>'+orcEditor.pessoas.map(function(p){return '<option value="'+p.id+'" '+(p.id===v?'selected':'')+'>'+orcEsc(p.nome)+'</option>';}).join('')+'</select>';
 if(key==='arredondamento')return '<label class="form-label">'+label+'</label><select class="form-input" data-field="'+n+'"'+disabled+'><option value="cima" '+(v==='cima'?'selected':'')+'>Para cima</option><option value="proximo" '+(v==='proximo'?'selected':'')+'>Inteiro mais próximo</option></select>';
 var numeric=typeof v==='number'||v===null;
 return '<div class="form-group"><label class="form-label">'+orcEsc(label)+'</label><input class="form-input" data-field="'+n+'" data-number="'+numeric+'" type="'+(numeric?'number':'text')+'" '+(numeric?'min="0" step="any"':'')+' value="'+orcEsc(v===null?'':v)+'"'+disabled+'></div>';
 }
 var el=document.getElementById('orc-editor-conteudo');if(!el)return;
 el.innerHTML='<form id="orc-padrao-editor">'+campo(orcEditor.dados,[],ORC_CADASTROS[orcEditor.k])+(editable?'<p style="margin-top:18px"><button class="btn btn-primary" type="submit">Salvar '+(orcEditor.escopo==='padrao'?'padrão do tipo':'no projeto')+'</button> <button class="btn btn-ghost" id="orc-editor-cancel" type="button">Cancelar alterações</button></p>':'<p>Somente leitura</p>')+'</form>';
 el.querySelectorAll('[data-field]').forEach(function(input){input.onchange=function(){orcEditorSet(paths[Number(this.dataset.field)],this.dataset.number==='true'?(this.value===''?null:Number(this.value)):this.value);};});
 el.querySelectorAll('[data-remove]').forEach(function(b){b.onclick=function(){if(!orcPodeEditar())return;var x=this.dataset.remove.split(':');orcEditorGet(paths[Number(x[0])]).splice(Number(x[1]),1);orcRenderEditor();};});
 el.querySelectorAll('[data-add]').forEach(function(b){b.onclick=function(){if(!orcPodeEditar())return;var path=paths[Number(this.dataset.add)],arr=orcEditorGet(path),schema=orcEsquemas[orcEditor.k];for(var i=0;i<path.length;i++){if(schema===undefined)break;schema=Array.isArray(schema)&&typeof path[i]==='number'?schema[0]:schema[path[i]];}var sample=arr[0]!==undefined?arr[0]:Array.isArray(schema)?schema[0]:'';var item=JSON.parse(JSON.stringify(sample===undefined?'':sample));function limpar(x){if(Array.isArray(x))return [];if(x&&typeof x==='object'){Object.keys(x).forEach(function(k){x[k]=limpar(x[k]);});return x;}return typeof x==='number'?null:'';}arr.push(limpar(item));orcRenderEditor();};});
 var cancel=document.getElementById('orc-editor-cancel');if(cancel)cancel.onclick=function(){orcIniciarEditor(orcEditor.escopo,orcEditor.r,orcEditor.k,orcEditor.pessoas,orcEditor.tiposParticipantes);};
 document.getElementById('orc-padrao-editor').onsubmit=async function(e){e.preventDefault();if(!orcPodeEditar())return;var ed=orcEditor,btn=e.target.querySelector('[type=submit]');btn.disabled=true;
 try{
 if(ed.r.id)await orcRpc('cda_orc_salvar_cadastro',{escopo:ed.escopo,registro:ed.r.id,anterior:ed.anterior,novo:ed.dados});
 else{var res=await sb.post('cda_orc_padroes_tipo',{tipo_id:ed.r.tipo_id,chave:ed.k,conteudo:ed.dados});ed.r.id=res[0].id;}
 ed.r.conteudo=JSON.parse(JSON.stringify(ed.dados));ed.anterior=JSON.parse(JSON.stringify(ed.dados));showToast('Cadastro salvo no '+(ed.escopo==='padrao'?'padrão do tipo':'projeto'),'success');
 }catch(err){showToast('Não foi possível salvar. Reabra o cadastro para conferir permissões ou alterações em outra sessão.','error');}finally{btn.disabled=false;}
 };
}

function orcRenderParticipantesTipo(){
 var ed=orcEditor,el=document.getElementById('orc-editor-conteudo'),editavel=orcPodeEditar();
 el.innerHTML=(editavel?'<button class="btn btn-primary" id="orc-part-novo">＋ Novo cadastro</button>':'')+'<div id="orc-part-form" style="margin-top:16px"></div><div class="tbl-wrap"><table><thead><tr><th>Participante</th><th>Tipo Participação</th><th>Situação</th><th>Ações</th></tr></thead><tbody>'+ed.dados.map(function(item,i){
 if(!item.pessoa_id&&!item.papel)return '';
 var pessoa=ed.pessoas.find(function(p){return p.id===item.pessoa_id;}),tipo=ed.tiposParticipantes.find(function(t){return t.id===item.papel;});
 return '<tr><td>'+orcEsc(pessoa?pessoa.nome:item.pessoa_id||'')+'</td><td>'+orcEsc(tipo?tipo.nome:item.papel||'')+'</td><td>'+(item.ativo===false?'Inativo':'Ativo')+'</td><td>'+(editavel?'<button class="btn btn-ghost btn-sm" data-part-edit="'+i+'">Editar</button> <button class="btn btn-ghost btn-sm" data-part-status="'+i+'">'+(item.ativo===false?'Reativar':'Inativar')+'</button>':'—')+'</td></tr>';
 }).join('')+(ed.escopo==='padrao'?ed.pessoas.filter(function(p){return !ed.dados.some(function(x){return x.pessoa_id===p.id;});}).map(function(p){
 return '<tr><td>'+orcEsc(p.nome)+'</td><td></td><td>Não vinculado a este tipo</td><td>'+(editavel?'<button class="btn btn-ghost btn-sm" data-part-link="'+orcEsc(p.id)+'">Cadastrar participação</button>':'—')+'</td></tr>';
 }).join(''):'')+'</tbody></table></div>'+(ed.dados.some(function(x){return x.pessoa_id||x.papel;})?'':'<p>Nenhuma participação vinculada a este tipo. Selecione um participante para cadastrar.</p>');
 var novo=document.getElementById('orc-part-novo');if(novo)novo.onclick=function(){orcParticipanteTipoForm();};
 el.querySelectorAll('[data-part-link]').forEach(function(b){b.onclick=function(){orcParticipanteTipoForm(undefined,this.dataset.partLink);};});
 el.querySelectorAll('[data-part-edit]').forEach(function(b){b.onclick=function(){orcParticipanteTipoForm(Number(this.dataset.partEdit));};});
 el.querySelectorAll('[data-part-status]').forEach(function(b){b.onclick=async function(){
 if(!orcPodeEditar())return;this.disabled=true;
 var dados=JSON.parse(JSON.stringify(ed.dados)),i=Number(this.dataset.partStatus);dados[i].ativo=dados[i].ativo===false;
 if(!await orcSalvarParticipantesTipo(ed,dados))this.disabled=false;
 };});
}
function orcParticipanteTipoForm(indice,pessoaId){
 if(!orcPodeEditar())return;
 var ed=orcEditor,item=indice===undefined?{pessoa_id:pessoaId||'',papel:'',ativo:true}:ed.dados[indice],el=document.getElementById('orc-part-form');
 el.innerHTML='<form id="orc-part-editor"><div class="form-row"><div><label class="form-label" for="orc-part-pessoa">Participante *</label><select class="form-input" id="orc-part-pessoa" required><option value="">Selecione</option>'+ed.pessoas.filter(function(p){return p.ativo!==false||p.id===item.pessoa_id;}).map(function(p){return '<option value="'+orcEsc(p.id)+'" '+(p.id===item.pessoa_id?'selected':'')+'>'+orcEsc(p.nome)+'</option>';}).join('')+'</select></div><div><label class="form-label" for="orc-part-tipo">Tipo Participação *</label><select class="form-input" id="orc-part-tipo" required><option value="">Selecione</option>'+((item.papel&&!ed.tiposParticipantes.some(function(t){return t.id===item.papel;}))?'<option value="'+orcEsc(item.papel)+'" selected>'+orcEsc(item.papel)+' (cadastro anterior)</option>':'')+ed.tiposParticipantes.filter(function(t){return t.ativo!==false||t.id===item.papel;}).map(function(t){return '<option value="'+orcEsc(t.id)+'" '+(t.id===item.papel?'selected':'')+'>'+orcEsc(t.nome)+'</option>';}).join('')+'</select></div></div><p style="margin:16px 0"><button class="btn btn-primary" type="submit">Salvar</button> <button class="btn btn-ghost" type="button" id="orc-part-cancel">Cancelar</button></p></form>';
 document.getElementById('orc-part-cancel').onclick=function(){el.innerHTML='';};
 document.getElementById('orc-part-editor').onsubmit=async function(e){
 e.preventDefault();if(!orcPodeEditar())return;
 var pessoa=document.getElementById('orc-part-pessoa').value,papel=document.getElementById('orc-part-tipo').value;
 if(!pessoa||!papel)return;
 if(ed.dados.some(function(x,i){return i!==indice&&x.pessoa_id===pessoa&&x.papel===papel;})){showToast('Este participante já possui este tipo de participação.','error');return;}
 var dados=JSON.parse(JSON.stringify(ed.dados)),registro=Object.assign({},item,{pessoa_id:pessoa,papel:papel});
 if(indice===undefined){dados=dados.filter(function(x){return x.pessoa_id||x.papel;});dados.push(registro);}else dados[indice]=registro;
 var btn=e.target.querySelector('[type=submit]');btn.disabled=true;if(!await orcSalvarParticipantesTipo(ed,dados))btn.disabled=false;
 };
}
async function orcSalvarParticipantesTipo(ed,dados){
 if(!orcPodeEditar())return false;
 try{
 if(ed.r.id)await orcRpc('cda_orc_salvar_cadastro',{escopo:ed.escopo,registro:ed.r.id,anterior:ed.anterior,novo:dados});
 else{var res=await sb.post('cda_orc_padroes_tipo',{tipo_id:ed.r.tipo_id,chave:ed.k,conteudo:dados});ed.r.id=res[0].id;}
 ed.r.conteudo=JSON.parse(JSON.stringify(dados));ed.anterior=JSON.parse(JSON.stringify(dados));ed.dados=dados;
 if(orcEditor===ed)orcRenderParticipantesTipo();showToast('Cadastro salvo','success');return true;
 }catch(e){showToast('Não foi possível salvar. Reabra o cadastro para conferir permissões ou alterações em outra sessão.','error');return false;}
}

function orcFormulaResumo(f){
 if(!f||!f.forma)return 'Não configurada';
 if(f.calculo==='receita_bruta')return 'Público por evento × Conversão do cenário ÷ 100 × Ticket médio';
 if(f.forma==='soma_filhos')return 'Soma das subdivisões ativas';
 var multiplicador=f.aplicacao==='evento'?' × quantidade de eventos':'';
 if(f.forma==='percentual')return f.percentual+'% × '+f.base+(f.aplicacao==='evento'?' por evento':' do projeto')+multiplicador;
 if(f.forma==='fixo')return 'R$ '+f.valor+multiplicador;
 return (f.quantidade_origem==='informada'?f.quantidade:f.quantidade_origem)+' × '+(f.valor_origem==='funcao'?'remuneração: '+f.funcao:'R$ '+f.valor)+multiplicador;
}
var orcFormulaSessao=0;
async function orcFormulaAbrir(escopo,id){
 if(!canAccessProject('orcamento_vendas'))return;
 var sessao=++orcFormulaSessao,g=escopo==='projeto'?orcGeracao.gerados.find(function(x){return x.chave==='categorias';}):null;
 var previa=escopo==='projeto'?orcGeracao.previa.find(function(x){return x.chave==='categorias';}):null;
 var rows=escopo==='padrao'?orcCategoriasDados:(g?g.conteudo:previa?previa.conteudo:[]),cat=rows.find(function(x){return x.id===id;});if(!cat)return;
 var filhos=rows.some(function(x){return x.pai_id===id&&x.ativo!==false;}),registro=escopo==='padrao'?orcFormulasCategorias.find(function(x){return x.categoria_id===id;}):null;
 var f=(escopo==='padrao'?registro&&registro.definicao:cat.formula)||{},el=document.getElementById(escopo==='padrao'?'orc-cat-form':'orc-proj-cat-form');
 el.innerHTML='<div class="card">Carregando fórmula...</div>';
 try{
 var funcoes=[],bases=['Venda bruta','Venda após desconto comercial','Venda após descontos comerciais e financeiros','Resultado distribuível'];
 if(escopo==='padrao'){
 var refs=await sb.get('cda_orc_padroes_tipo','tipo_id=eq.'+cat.tipo_id),fun=refs.find(function(x){return x.chave==='funcoes';}),bas=refs.find(function(x){return x.chave==='calculos';});
 funcoes=fun&&Array.isArray(fun.conteudo)?fun.conteudo:[];
 if(bas&&Array.isArray(bas.conteudo.bases)&&bas.conteudo.bases.length)bases=bas.conteudo.bases;
 }else{var fun=orcGeracao.gerados.find(function(x){return x.chave==='funcoes';});funcoes=fun&&Array.isArray(fun.conteudo)?fun.conteudo:[];}
 if(sessao!==orcFormulaSessao)return;
 var refPremissaBase=(escopo==='padrao'?refs:(g?orcGeracao.gerados:orcGeracao.previa)).find(function(x){return x.chave==='premissas';}),premissasBase=refPremissaBase?refPremissaBase.conteudo:{};
 if(cat.codigo==='6'&&rows.some(function(x){return x.pai_id===cat.id&&(escopo==='padrao'?orcFormulasCategorias.some(function(fc){return fc.categoria_id===x.id&&fc.definicao.calculo==='administracao';}):x.formula&&x.formula.calculo==='administracao');})){orcAdministracaoTotal(el,cat,premissasBase,escopo,rows,g,f);return;}
 if(f.calculo==='administracao'||f.calculo==='tributos'||f.calculo==='participacao_cultural'){orcCulturalRender(el,cat,premissasBase,escopo,rows,g,registro);return;}
 if(f.calculo==='fabricacao_ticket'||f.calculo==='desconto_vendas'||cat.codigo==='2'&&rows.some(function(x){return x.pai_id===cat.id&&(escopo==='padrao'?orcFormulasCategorias.some(function(fc){return fc.categoria_id===x.id&&fc.definicao.calculo==='desconto_vendas';}):x.formula&&x.formula.calculo==='desconto_vendas');})){
 orcDescontoRender(el,cat,premissasBase,escopo,rows,g,registro);orcDescricaoUniversal(el,cat,f,escopo,g);return;
 }
 if(!filhos&&f.calculo==='receita_bruta'){
 var premissa;
 if(escopo==='padrao'){var refPremissa=refs.find(function(x){return x.chave==='premissas';});premissa=refPremissa?refPremissa.conteudo:{};}
 else{var refPremissa=(g?orcGeracao.gerados:orcGeracao.previa).find(function(x){return x.chave==='premissas';});premissa=refPremissa?refPremissa.conteudo:{};}
 orcReceitaRender(el,cat,premissa,escopo,orcPodeEditar()&&(escopo==='padrao'||!!g));orcDescricaoUniversal(el,cat,f,escopo,g);return;
 }
 function select(k,label,options,value){return '<div class="form-group"><label class="form-label" for="orc-f-'+k+'">'+label+'</label><select class="form-input" id="orc-f-'+k+'">'+options.map(function(o){var key=Array.isArray(o)?o[0]:o,nome=Array.isArray(o)?o[1]:o;return '<option value="'+orcEsc(key)+'" '+(key===value?'selected':'')+'>'+orcEsc(nome)+'</option>';}).join('')+'</select></div>';}
 function numero(k,label,value){return '<div class="form-group"><label class="form-label" for="orc-f-'+k+'">'+label+'</label><input class="form-input" type="number" min="0" step="any" id="orc-f-'+k+'" value="'+orcEsc(value===undefined?'':value)+'"></div>';}
 var escrita=orcPodeEditar()&&(escopo==='padrao'||g);
 el.innerHTML='<div class="card"><div class="card-title">Fórmula de cálculo · '+orcEsc(cat.codigo)+' — '+orcEsc(cat.nome)+'</div><p>'+orcEsc(orcFormulaResumo(filhos?{forma:'soma_filhos'}:f))+'</p>'+(filhos?'<p>Configure as fórmulas nas subdivisões. Esta categoria soma os filhos ativos.</p>':!escrita?'<p>Consulta da fórmula. A edição exige permissão de escrita e cadastro próprio do projeto gerado.</p>':'<form id="orc-formula-editor">'+select('forma','Forma de cálculo',[['','Selecione'],['percentual','Percentual'],['quantidade','Quantidade × valor unitário'],['fixo','Valor fixo']],f.forma)+
 '<div data-formula="percentual">'+select('base','Base de cálculo',bases,f.base)+numero('percentual','Percentual (%)',f.percentual)+'</div>'+
 '<div data-formula="quantidade">'+select('quantidade_origem','Origem da quantidade',[['','Selecione'],['vendedores','Dimensionamento → Vendedores por evento'],['estoquistas','Dimensionamento → Estoquistas por evento'],['apoio','Dimensionamento → Apoio por evento'],['lojas','Dimensionamento → Lojas por evento'],['area_total','Dimensionamento → Área total das lojas (m²) por evento'],['compradores','Premissas e cenários → Compradores por evento'],['informada','Quantidade informada']],f.quantidade_origem)+
 '<div id="orc-f-qmanual">'+numero('quantidade','Quantidade',f.quantidade)+'</div>'+select('valor_origem','Origem do valor unitário',[['funcao','Funções profissionais e remunerações'],['informado','Valor informado']],f.valor_origem)+
 '<div id="orc-f-funcao">'+select('funcao','Função profissional',[['','Selecione']].concat(funcoes.filter(function(x){return x.nome;}).map(function(x){return [x.nome,x.nome+' — R$ '+x.valor_unitario+' / '+x.unidade];})),f.funcao)+'</div></div>'+
 '<div id="orc-f-vmanual">'+numero('valor','Valor (R$)',f.valor)+'</div>'+select('aplicacao','Aplicação',[['projeto','Uma vez no projeto'],['evento','Por show/evento × quantidade de eventos das premissas']],f.aplicacao||'projeto')+
 '<p id="orc-f-previa" style="margin:14px 0"></p><button class="btn btn-primary" type="submit">Salvar fórmula</button></form>')+'<button class="btn btn-ghost" id="orc-f-voltar" style="margin-top:12px">← Voltar às categorias</button></div>';
 el.insertAdjacentHTML('afterbegin',orcPremissasCabecalho(premissasBase));orcDescricaoUniversal(el,cat,f,escopo,g);
 document.getElementById('orc-f-voltar').onclick=function(){orcFormulaSessao++;el.innerHTML='';};
 if(!filhos&&escrita){
 function ler(){function val(k){return document.getElementById('orc-f-'+k).value;}function num(k){return val(k)===''?null:Number(val(k));}
 var n={forma:val('forma'),aplicacao:val('aplicacao')};
 if(n.forma==='percentual'){n.base=val('base');n.percentual=num('percentual');}
 if(n.forma==='fixo')n.valor=num('valor');
 if(n.forma==='quantidade'){n.quantidade_origem=val('quantidade_origem');if(n.quantidade_origem==='informada')n.quantidade=num('quantidade');n.valor_origem=val('valor_origem');if(n.valor_origem==='funcao')n.funcao=val('funcao');else n.valor=num('valor');}
 return n;}
 function atualizar(){var n=ler();el.querySelectorAll('[data-formula]').forEach(function(x){x.style.display=x.dataset.formula===n.forma?'':'none';});document.getElementById('orc-f-qmanual').style.display=n.quantidade_origem==='informada'?'':'none';document.getElementById('orc-f-funcao').style.display=n.valor_origem==='funcao'?'':'none';document.getElementById('orc-f-vmanual').style.display=n.forma==='fixo'||n.forma==='quantidade'&&n.valor_origem==='informado'?'':'none';document.getElementById('orc-f-previa').textContent=n.forma?orcFormulaResumo(n):'';}
 el.querySelectorAll('input,select').forEach(function(x){x.oninput=atualizar;});atualizar();
 document.getElementById('orc-formula-editor').onsubmit=async function(e){
 e.preventDefault();if(!orcPodeEditar())return;var n=ler();
 if(!n.forma||n.forma==='percentual'&&(!n.base||n.percentual===null)||n.forma==='fixo'&&n.valor===null||n.forma==='quantidade'&&(!n.quantidade_origem||n.quantidade_origem==='informada'&&n.quantidade===null||n.valor_origem==='funcao'&&!n.funcao||n.valor_origem==='informado'&&n.valor===null)){showToast('Preencha os parâmetros da fórmula','error');return;}
 var btn=e.target.querySelector('[type=submit]');btn.disabled=true;
 try{
 if(escopo==='padrao'){if(registro)await sb.patch('cda_orc_formulas_categoria',registro.id,{definicao:n,atualizado_em:new Date().toISOString()});else await sb.post('cda_orc_formulas_categoria',{categoria_id:id,definicao:n});await orcCategorias();}
 else{g.conteudo=await orcRpc('cda_orc_salvar_formula_projeto',{cadastro:g.id,item:id,anterior:cat.formula||null,nova:n});orcCategoriasProjeto();}
 showToast('Fórmula salva','success');
 }catch(err){btn.disabled=false;showToast('Não foi possível salvar. Reabra a categoria e confira os parâmetros.','error');}
 };
 }
 el.scrollIntoView({behavior:'smooth',block:'nearest'});
 }catch(e){el.innerHTML='<p>Não foi possível abrir a fórmula. Reabra as categorias.</p>';}
}

function orcReceitaCalcular(p){
 var total=Number(p.publico_total),shows=Number(p.shows),ticket=p.valores&&p.valores.ticket_medio;
 var valido=p.publico_total!==null&&p.publico_total!==undefined&&p.shows!==null&&p.shows!==undefined&&Number.isFinite(total)&&total>=0&&Number.isFinite(shows)&&shows>0&&ticket!==null&&ticket!==undefined&&Number.isFinite(Number(ticket))&&Number(ticket)>=0;
 var cenarios=Array.isArray(p.cenarios)?p.cenarios:Array.isArray(p.conversoes)?p.conversoes.map(function(v,i){return {nome:['Pessimista','Conservador','Otimista'][i]||'Cenário '+(i+1),conversao:v};}):[];
 return {publico:p.publico_total!==null&&p.publico_total!==undefined&&Number.isFinite(total)&&shows>0?total/shows:null,shows:shows,total:total,ticket:ticket,cenarios:cenarios.map(function(c){var ok=valido&&c.conversao!==null&&c.conversao!==undefined&&Number.isFinite(Number(c.conversao))&&Number(c.conversao)>=0&&Number(c.conversao)<=100,compradores=ok?total/shows*Number(c.conversao)/100:null;return {nome:c.nome,conversao:c.conversao,compradores:compradores,evento:ok?compradores*Number(ticket):null,projeto:ok?compradores*Number(ticket)*shows:null};})};
}
function orcReceitaNumero(v,moeda){return v===null||v===undefined||!Number.isFinite(Number(v))?'—':Number(v).toLocaleString('pt-BR',moeda?{style:'currency',currency:'BRL'}:{maximumFractionDigits:2});}
function orcReceitaPopup(d,escopo,descritivo){
 var anterior=document.getElementById('orc-receita-dialog');if(anterior)anterior.remove();
 var modal=document.createElement('dialog');modal.id='orc-receita-dialog';modal.setAttribute('aria-labelledby','orc-receita-dialog-titulo');modal.style.cssText='width:min(900px,94vw);max-height:88vh;overflow:auto;border:1px solid var(--border2);border-radius:12px;padding:24px;background:var(--bg,#181818);color:var(--text,#fff);margin:auto';
 var origem=escopo==='padrao'?'Padrão do Tipo de Projeto':'Cadastro próprio do projeto';
 modal.innerHTML='<h2 id="orc-receita-dialog-titulo">1 — Receitas de vendas · Fórmula de cálculo</h2><p>'+orcEsc(descritivo||'')+'</p><div class="card" style="margin:18px 0"><strong>Receita Bruta por evento = Público por evento × Conversão do cenário ÷ 100 × Ticket médio</strong><p style="margin-top:12px"><strong>Receita Bruta do projeto = Receita Bruta por evento × Quantidade de eventos</strong></p></div><p>Calculada simultaneamente para os três cenários, antes dos descontos, impostos e demais deduções.</p><div class="tbl-wrap"><table><thead><tr><th>Campo da fórmula</th><th>Origem</th><th>Apresentação</th></tr></thead><tbody><tr><td>Público por evento</td><td>Premissas quantitativas → Público total ÷ Quantidade de eventos</td><td>Automático: '+orcReceitaNumero(d.publico)+' pessoas</td></tr><tr><td>Conversão do cenário</td><td>Premissas e cenários → Conversão (%)</td><td>'+d.cenarios.map(function(c){return orcEsc(c.nome)+': '+orcReceitaNumero(c.conversao)+'%';}).join('<br>')+'</td></tr><tr><td>Ticket médio por comprador</td><td>Premissas de valores → Ticket médio por comprador</td><td>'+orcReceitaNumero(d.ticket,true)+' · mesmo valor nos três cenários</td></tr><tr><td>Quantidade de eventos</td><td>Premissas quantitativas → Quantidade de eventos</td><td>Automático: '+orcReceitaNumero(d.shows)+'</td></tr></tbody></table></div><p style="margin:14px 0">Origem dos valores: '+origem+'.</p><button class="btn btn-primary" id="orc-receita-fechar">Fechar</button>';
 document.body.appendChild(modal);modal.onclose=function(){modal.remove();};modal.querySelector('#orc-receita-fechar').onclick=function(){modal.close();};modal.showModal();
}
function orcReceitaRender(el,cat,p,escopo,editavel){
 var d=orcReceitaCalcular(p),n=orcReceitaNumero;
 el.innerHTML='<div class="card"><div class="card-title">'+orcEsc(cat.codigo)+' — '+orcEsc(cat.nome)+' · Previsão de Receita Bruta</div><button class="btn btn-ghost" id="orc-receita-explicar">Entender fórmula e origem dos campos</button><h3 style="margin:20px 0 12px">Premissas quantitativas do projeto</h3><div class="tbl-wrap"><table><thead><tr><th>Público total</th><th>Quantidade de eventos</th><th>Público por evento · automático</th></tr></thead><tbody><tr><td>'+n(d.total)+'</td><td>'+n(d.shows)+'</td><td>'+n(d.publico)+'</td></tr></tbody></table></div><h3 style="margin:20px 0 12px">Premissas de valores por show/evento</h3><p>Ticket médio por comprador: <strong>'+n(d.ticket,true)+'</strong></p>'+(editavel?'<button class="btn btn-ghost btn-sm" id="orc-receita-premissas">Editar premissas e ticket médio</button>':'')+'<h3 style="margin:20px 0 12px">Resultado por cenário</h3><div class="tbl-wrap"><table><thead><tr><th>Cenário</th><th>Conversão</th><th>Compradores/evento</th><th>Ticket médio</th><th>Receita bruta/evento</th><th>Receita bruta/projeto</th></tr></thead><tbody>'+d.cenarios.map(function(c){return '<tr><td>'+orcEsc(c.nome)+'</td><td>'+n(c.conversao)+'%</td><td>'+n(c.compradores)+'</td><td>'+n(d.ticket,true)+'</td><td>'+n(c.evento,true)+'</td><td><strong>'+n(c.projeto,true)+'</strong></td></tr>';}).join('')+'</tbody></table></div>'+(!d.cenarios.length||d.cenarios.some(function(c){return c.evento===null;})?'<p>Complete as premissas para calcular os resultados. Valores ausentes não são considerados zero.</p>':'')+'<button class="btn btn-ghost" id="orc-receita-voltar" style="margin-top:16px">← Voltar às categorias</button></div>';
 document.getElementById('orc-receita-explicar').onclick=function(){orcReceitaPopup(d,escopo,cat.descritivo_calculo);};
 document.getElementById('orc-receita-voltar').onclick=function(){orcFormulaSessao++;el.innerHTML='';};
 var editar=document.getElementById('orc-receita-premissas');if(editar)editar.onclick=function(){if(escopo==='padrao'){orcPadraoSelecionado=cat.tipo_id;orcPadraoTipo('premissas');}else orcProjetoCadastroEditor('premissas');};
 el.scrollIntoView({behavior:'smooth',block:'nearest'});
}

function orcPremissasCabecalho(p){
 var d=orcReceitaCalcular(p||{}),n=orcReceitaNumero;
 return '<h3 style="margin:18px 0 12px">Premissas quantitativas do projeto</h3><div class="tbl-wrap"><table><thead><tr><th>Público total</th><th>Quantidade de eventos</th><th>Público por evento · automático</th></tr></thead><tbody><tr><td>'+n(d.total)+'</td><td>'+n(d.shows)+'</td><td>'+n(d.publico)+'</td></tr></tbody></table></div>';
}
function orcDescontoResultados(p,formulas){
 var receita=orcReceitaCalcular(p);
 return receita.cenarios.map(function(c){var parcelas=formulas.map(function(f){var pct=f&&f.percentual,ok=pct!==null&&pct!==undefined&&Number.isFinite(Number(pct))&&Number(pct)>=0&&Number(pct)<=100;return {percentual:pct,evento:ok&&c.evento!==null?c.evento*Number(pct)/100:null,projeto:ok&&c.projeto!==null?c.projeto*Number(pct)/100:null};});var valido=parcelas.every(function(x){return x.evento!==null;});return {nome:c.nome,receitaEvento:c.evento,receitaProjeto:c.projeto,parcelas:parcelas,evento:valido?parcelas.reduce(function(s,x){return s+x.evento;},0):null,projeto:valido?parcelas.reduce(function(s,x){return s+x.projeto;},0):null};});
}
function orcDescontoPopup(cat,f,total,p){
 var antigo=document.getElementById('orc-desconto-dialog');if(antigo)antigo.remove();var modal=document.createElement('dialog');modal.id='orc-desconto-dialog';modal.setAttribute('aria-labelledby','orc-desconto-titulo');modal.style.cssText='width:min(900px,94vw);max-height:88vh;overflow:auto;border:1px solid var(--border2);border-radius:12px;padding:24px;background:var(--bg,#181818);color:var(--text,#fff);margin:auto';
 var fabrica=f.calculo==='fabricacao_ticket';
 var formula=fabrica?'Fabricação por comprador = Ticket médio × Percentual ÷ 100. Fabricação por evento = Custo por comprador × Compradores do cenário. Total do projeto = Fabricação por evento × Quantidade de eventos.':total?'Descontos sobre as Vendas = Descontos Comerciais + Descontos Financeiros':'Valor do desconto = Receita Bruta de Vendas × Percentual para orçamento ÷ 100';
 modal.innerHTML='<h2 id="orc-desconto-titulo">'+orcEsc(cat.codigo)+' — '+orcEsc(cat.nome)+'</h2><div class="card" style="margin:18px 0"><strong>'+formula+'</strong></div><p>'+orcEsc(total?'Soma automática das subcategorias ativas, por evento e no projeto, em cada cenário.':f.descritivo||'')+'</p><div class="tbl-wrap"><table><thead><tr><th>Campo da fórmula</th><th>Origem</th><th>Apresentação</th></tr></thead><tbody>'+ (fabrica?'<tr><td>Ticket médio por comprador</td><td>Premissas de valores → Ticket médio</td><td>'+orcReceitaNumero(p.valores&&p.valores.ticket_medio,true)+'</td></tr><tr><td>Percentual de fabricação</td><td>Fórmula desta categoria</td><td>'+orcReceitaNumero(f.percentual)+'%</td></tr><tr><td>Compradores por evento</td><td>Público por evento × Conversão do cenário ÷ 100</td><td>Automático nos três cenários</td></tr><tr><td>Quantidade de eventos</td><td>Premissas quantitativas</td><td>'+orcReceitaNumero(p.shows)+'</td></tr>':total?'<tr><td>Descontos Comerciais</td><td>Subcategoria 2.1 → Fórmula de cálculo</td><td>Automático nos três cenários</td></tr><tr><td>Descontos Financeiros</td><td>Subcategoria 2.2 → Fórmula de cálculo</td><td>Automático nos três cenários</td></tr>':'<tr><td>Receita Bruta de Vendas</td><td>Categoria 1 → Público × Conversão do cenário ÷ 100 × Ticket médio</td><td>Automático por evento e projeto</td></tr><tr><td>Percentual para orçamento</td><td>Fórmula desta subcategoria</td><td>'+orcReceitaNumero(f.percentual)+'% sobre toda a receita bruta</td></tr>')+'</tbody></table></div><p style="margin:14px 0">'+(fabrica?'O percentual é aplicado ao ticket médio e multiplicado pelos compradores previstos.':'O percentual representa o maior desconto previsto para orçamento.')+' Os cenários usam as premissas do cadastro aberto.</p><button class="btn btn-primary" id="orc-desconto-fechar">Fechar</button>';
 document.body.appendChild(modal);modal.onclose=function(){modal.remove();};modal.querySelector('#orc-desconto-fechar').onclick=function(){modal.close();};modal.showModal();
}
function orcDescontoRender(el,cat,p,escopo,rows,g,registro){
 var total=cat.codigo==='2',f=escopo==='padrao'?registro&&registro.definicao:cat.formula;f=f||{};var fabrica=f.calculo==='fabricacao_ticket';
 function formula(item){if(escopo==='projeto')return item.formula;var reg=orcFormulasCategorias.find(function(x){return x.categoria_id===item.id;});return reg&&reg.definicao;}
 var filhos=total?rows.filter(function(x){return x.pai_id===cat.id&&x.ativo!==false;}):[cat],formulas=filhos.map(formula),resultados=orcDescontoResultados(p,formulas),n=orcReceitaNumero,escrita=orcPodeEditar()&&(escopo==='padrao'||!!g);
 el.innerHTML='<div class="card"><div class="card-title">'+orcEsc(cat.codigo)+' — '+orcEsc(cat.nome)+'</div>'+orcPremissasCabecalho(p)+'<h3 style="margin:20px 0 12px">'+(total?'Valor Descontos sobre as Vendas · automático (somatório das subcategorias)':(fabrica?'Parâmetros de fabricação':'Parâmetros do desconto'))+'</h3>'+(total?'':'<form id="orc-desc-form"><label class="form-label" for="orc-desc-percentual" style="margin-top:12px">'+(fabrica?'Percentual de fabricação sobre o ticket médio (%)':'Percentual para orçamento (%) · maior desconto previsto')+'</label><input class="form-input" id="orc-desc-percentual" type="number" min="0" max="100" step="any" required value="'+orcEsc(f.percentual===undefined?'':f.percentual)+'" '+(escrita?'':'disabled')+'><p>'+(fabrica?'Custo de fabricação por comprador = Ticket médio × percentual. Total = custo por comprador × compradores do cenário.':'Base: Receita Bruta de Vendas integral, em cada cenário.')+'</p>'+(escrita?'<button class="btn btn-primary" type="submit">Salvar percentual</button>':'')+'</form>')+(fabrica?'<p>Ticket médio: <strong>'+n(p.valores&&p.valores.ticket_medio,true)+'</strong> · Fabricação por comprador: <strong>'+n(p.valores&&p.valores.ticket_medio!==undefined&&f.percentual!==undefined?Number(p.valores.ticket_medio)*Number(f.percentual)/100:null,true)+'</strong></p>':'')+'<button class="btn btn-ghost" id="orc-desc-explicar" style="margin:14px 0">Entender fórmula e origem dos campos</button><div class="tbl-wrap"><table><thead><tr><th>Cenário</th><th>Receita Bruta/evento</th>'+(total?filhos.map(function(x){return '<th>'+orcEsc(x.nome)+'/evento</th>';}).join(''):'<th>Percentual</th>')+'<th>'+(fabrica?'Fabricação':'Valor descontos')+'/evento</th><th>'+(fabrica?'Fabricação':'Valor descontos')+'/projeto</th></tr></thead><tbody>'+resultados.map(function(r){return '<tr><td>'+orcEsc(r.nome)+'</td><td>'+n(r.receitaEvento,true)+'</td>'+(total?r.parcelas.map(function(x){return '<td>'+n(x.evento,true)+'</td>';}).join(''):'<td>'+n(f.percentual)+'%</td>')+'<td><strong>'+n(r.evento,true)+'</strong></td><td><strong>'+n(r.projeto,true)+'</strong></td></tr>';}).join('')+'</tbody></table></div>'+(total&&!filhos.length?'<p>Cadastre as subcategorias para compor o total.</p>':'')+'<button class="btn btn-ghost" id="orc-desc-voltar" style="margin-top:16px">← Voltar às categorias</button></div>';
 document.getElementById('orc-desc-explicar').onclick=function(){orcDescontoPopup(cat,Object.assign({},f,{descritivo:cat.descritivo_calculo===undefined?f.descritivo:cat.descritivo_calculo}),total,p);};document.getElementById('orc-desc-voltar').onclick=function(){orcFormulaSessao++;el.innerHTML='';};
 if(!total&&escrita)document.getElementById('orc-desc-form').onsubmit=async function(e){e.preventDefault();if(!orcPodeEditar())return;var raw=document.getElementById('orc-desc-percentual').value,pct=Number(raw);if(raw===''||!Number.isFinite(pct)||pct<0||pct>100)return;var novo=Object.assign({},f,{forma:'percentual',calculo:f.calculo||'desconto_vendas',base:f.base||'Venda bruta',aplicacao:'projeto',percentual:pct}),b=e.target.querySelector('[type=submit]');b.disabled=true;
 try{if(escopo==='padrao'){if(registro)await sb.patch('cda_orc_formulas_categoria',registro.id,{definicao:novo,atualizado_em:new Date().toISOString()});else await sb.post('cda_orc_formulas_categoria',{categoria_id:cat.id,definicao:novo});await orcCategorias();}else{g.conteudo=await orcRpc('cda_orc_salvar_formula_projeto',{cadastro:g.id,item:cat.id,anterior:cat.formula||null,nova:novo});orcCategoriasProjeto();}showToast('Percentual salvo','success');await orcFormulaAbrir(escopo,cat.id);}catch(err){b.disabled=false;showToast('Não foi possível salvar. Reabra o cadastro antes de tentar novamente.','error');}
 };
 el.scrollIntoView({behavior:'smooth',block:'nearest'});
}

function orcDescricaoUniversal(el,cat,f,escopo,g){
 var escrita=orcPodeEditar()&&(escopo==='padrao'||!!g),texto=cat.descritivo_calculo===null||cat.descritivo_calculo===undefined?f.descritivo||'':cat.descritivo_calculo;
 var html='<div class="card" id="orc-descritivo-universal" style="margin:16px 0"><form id="orc-descritivo-form"><label class="form-label" for="orc-descritivo-texto">Descritivo da fórmula · texto livre</label><textarea class="form-input" id="orc-descritivo-texto" rows="4" maxlength="10000" '+(escrita?'':'disabled')+'>'+orcEsc(texto)+'</textarea>'+(escrita?'<button class="btn btn-ghost btn-sm" type="submit" style="margin-top:10px">Salvar descritivo</button>':'')+'</form></div>';
 if(!el.querySelector('#orc-desc-explicar')&&!el.querySelector('#orc-receita-explicar')&&!el.querySelector('#orc-cultural-explicar')){
 html+='<button class="btn btn-ghost" id="orc-universal-explicar">Entender fórmula e origem dos campos</button>';
 }
 var tabela=el.querySelector('.tbl-wrap');if(tabela)tabela.insertAdjacentHTML('afterend',html);else el.insertAdjacentHTML('afterbegin',html);
 var explicar=document.getElementById('orc-universal-explicar');if(explicar)explicar.onclick=function(){
 var d=document.createElement('dialog');d.setAttribute('aria-label','Fórmula e origem dos campos');d.style.cssText='width:min(850px,94vw);max-height:88vh;overflow:auto;border:1px solid var(--border2);border-radius:12px;padding:24px;background:var(--bg,#181818);color:var(--text,#fff);margin:auto';
 var campos={forma:'Fórmula da categoria',base:'Base selecionada na fórmula',percentual:'Percentual cadastrado na fórmula',quantidade_origem:'Referência ao dimensionamento ou quantidade informada',quantidade:'Quantidade informada na fórmula',valor_origem:'Origem do valor unitário',funcao:'Funções profissionais e remunerações',valor:'Valor informado na fórmula',aplicacao:'Por projeto ou quantidade de eventos das premissas'};
 var filhos=(escopo==='padrao'?orcCategoriasDados:g?g.conteudo:[]).some(function(x){return x.pai_id===cat.id&&x.ativo!==false;});
 d.innerHTML='<h2>'+orcEsc(cat.codigo)+' — '+orcEsc(cat.nome)+'</h2><p>'+orcEsc(texto)+'</p><div class="card"><strong>'+orcEsc(orcFormulaResumo(filhos?{forma:'soma_filhos'}:f))+'</strong></div><div class="tbl-wrap"><table><thead><tr><th>Campo da fórmula</th><th>Origem</th><th>Apresentação</th></tr></thead><tbody>'+(filhos?'<tr><td>Total</td><td>Subcategorias ativas</td><td>Soma automática</td></tr>':Object.keys(campos).filter(function(k){return f[k]!==undefined;}).map(function(k){return '<tr><td>'+orcEsc(orcRotulos[k]||k)+'</td><td>'+orcEsc(campos[k])+'</td><td>'+orcEsc(f[k])+'</td></tr>';}).join(''))+'</tbody></table></div><button class="btn btn-primary">Fechar</button>';
 document.body.appendChild(d);d.querySelector('button').onclick=function(){d.close();};d.onclose=function(){d.remove();};d.showModal();
 };
 if(escrita)document.getElementById('orc-descritivo-form').onsubmit=async function(e){e.preventDefault();if(!orcPodeEditar())return;var novo=document.getElementById('orc-descritivo-texto').value,b=e.target.querySelector('[type=submit]');b.disabled=true;
 try{await orcRpc('cda_orc_salvar_descritivo_calculo',{escopo:escopo,registro:g?g.id:null,item:cat.id,anterior:cat.descritivo_calculo===undefined?null:cat.descritivo_calculo,novo:novo});
 if(escopo==='padrao')await orcCategorias();else{cat.descritivo_calculo=novo;orcCategoriasProjeto();}await orcFormulaAbrir(escopo,cat.id);showToast('Descritivo salvo','success');}
 catch(err){b.disabled=false;showToast('Não foi possível salvar. Reabra o cadastro para conferir alterações em outra sessão.','error');}
 };
}

function orcParticipacaoResultados(p,percentual,descontos){
 var d=orcDescontoResultados(p,descontos),pct=Number(percentual),ok=percentual!==null&&percentual!==undefined&&Number.isFinite(pct)&&pct>=0&&pct<=100;
 return d.map(function(r){var liquida=r.evento===null||r.receitaEvento===null?null:r.receitaEvento-r.evento;var liquidaProjeto=r.projeto===null||r.receitaProjeto===null?null:r.receitaProjeto-r.projeto;return Object.assign({},r,{liquida:liquida,liquidaProjeto:liquidaProjeto,participacao:ok&&liquida!==null?liquida*pct/100:null,participacaoProjeto:ok&&liquidaProjeto!==null?liquidaProjeto*pct/100:null});});
}
function orcCulturalRender(el,cat,p,escopo,rows,g,registro){
 var f=(escopo==='padrao'?registro&&registro.definicao:cat.formula)||{},n=orcReceitaNumero,escrita=orcPodeEditar()&&(escopo==='padrao'||!!g),tributo=f.calculo==='tributos',administracao=f.calculo==='administracao',raiz=rows.find(function(x){return x.codigo===(tributo?'2.1':'2');}),descontos=[];
 function obter(item){if(escopo==='projeto')return item.formula;var reg=orcFormulasCategorias.find(function(x){return x.categoria_id===item.id;});return reg&&reg.definicao;}
 function visitar(pai){rows.filter(function(x){return x.pai_id===pai&&x.ativo!==false;}).forEach(function(x){if(rows.some(function(y){return y.pai_id===x.id&&y.ativo!==false;}))visitar(x.id);else descontos.push(obter(x));});}
 if(raiz&&raiz.ativo!==false){if(tributo&&!rows.some(function(x){return x.pai_id===raiz.id&&x.ativo!==false;}))descontos.push(obter(raiz));else visitar(raiz.id);if(!descontos.length)descontos.push(undefined);}else if(!raiz)descontos.push(undefined);
 var r=orcParticipacaoResultados(p,f.percentual,descontos);
 el.innerHTML='<div class="card"><div class="card-title">'+orcEsc(cat.codigo)+' — '+orcEsc(cat.nome)+'</div>'+orcPremissasCabecalho(p)+'<form id="orc-cultural-form"><label class="form-label" for="orc-cultural-percentual">'+(tributo?'Alíquota de tributos (%)':administracao?'Percentual de administração (%)':'Percentual de participação (%)')+'</label><input class="form-input" id="orc-cultural-percentual" type="number" min="0" max="100" step="any" required value="'+orcEsc(f.percentual===undefined?'':f.percentual)+'" '+(escrita?'':'disabled')+'><p>Base: Receita Bruta de Vendas (categoria 1) − '+(tributo?'Descontos Comerciais (subcategoria 2.1)':'Descontos sobre as Vendas (categoria 2)')+'.</p>'+(escrita?'<button class="btn btn-primary" type="submit">Salvar percentual</button>':'')+'</form><button class="btn btn-ghost" id="orc-cultural-explicar" style="margin:14px 0">Entender fórmula e origem dos campos</button><h3>Resultados por cenário</h3><div class="tbl-wrap"><table><thead><tr><th>Cenário</th><th>Receita Bruta/evento</th><th>'+(tributo?'Descontos Comerciais':'Descontos')+'/evento</th><th>'+(tributo?'Base de cálculo':'Receita Líquida')+'/evento</th><th>'+(tributo?'Alíquota':administracao?'Administração':'Participação')+' (%)</th><th>'+(tributo?'Tributos':administracao?'Administração':'Participação')+'/evento</th><th>'+(tributo?'Tributos':administracao?'Administração':'Participação')+'/projeto</th></tr></thead><tbody>'+r.map(function(x){return '<tr><td>'+orcEsc(x.nome)+'</td><td>'+n(x.receitaEvento,true)+'</td><td>'+n(x.evento,true)+'</td><td>'+n(x.liquida,true)+'</td><td>'+n(f.percentual)+'%</td><td><strong>'+n(x.participacao,true)+'</strong></td><td><strong>'+n(x.participacaoProjeto,true)+'</strong></td></tr>';}).join('')+'</tbody></table></div>'+(r.some(function(x){return x.participacao===null;})?'<p>Complete as premissas e as fórmulas das subcategorias de descontos para calcular '+(tributo?'os tributos':'a participação')+'.</p>':'')+'<button class="btn btn-ghost" id="orc-cultural-voltar" style="margin-top:16px">← Voltar às categorias</button></div>';
 document.getElementById('orc-cultural-voltar').onclick=function(){orcFormulaSessao++;el.innerHTML='';};
 document.getElementById('orc-cultural-explicar').onclick=function(){
 var d=document.createElement('dialog');d.setAttribute('aria-label',tributo?'Fórmula de tributos':administracao?'Fórmula de administração':'Fórmula da participação cultural');d.style.cssText='width:min(900px,94vw);max-height:88vh;overflow:auto;border:1px solid var(--border2);border-radius:12px;padding:24px;background:var(--bg,#181818);color:var(--text,#fff);margin:auto';
 d.innerHTML='<h2>'+orcEsc(cat.codigo)+' — '+orcEsc(cat.nome)+'</h2><p>'+orcEsc(cat.descritivo_calculo||'')+'</p><div class="card"><strong>'+(tributo?'Tributos = (Receita Bruta de Vendas − Descontos Comerciais) × Alíquota ÷ 100':administracao?'Administração = (Receita Bruta de Vendas − Descontos sobre as Vendas) × Percentual de administração ÷ 100':'Participação Cultural = (Receita Bruta de Vendas − Descontos sobre as Vendas) × Percentual de participação ÷ 100')+'</strong></div><div class="tbl-wrap"><table><thead><tr><th>Campo da fórmula</th><th>Origem</th><th>Apresentação</th></tr></thead><tbody><tr><td>Receita Bruta de Vendas</td><td>Categoria 1 → Público × Conversão do cenário ÷ 100 × Ticket médio</td><td>Automático nos três cenários</td></tr><tr><td>'+(tributo?'Descontos Comerciais':'Descontos sobre as Vendas')+'</td><td>'+(tributo?'Subcategoria 2.1 → Fórmula dos Descontos Comerciais':'Categoria 2 → Soma das subcategorias ativas')+'</td><td>Automático · parâmetros do cadastro aberto</td></tr><tr><td>'+(tributo?'Base de cálculo dos tributos':'Receita Líquida')+'</td><td>'+(tributo?'Categoria 1 − Subcategoria 2.1':'Categoria 1 − Categoria 2')+'</td><td>Automático por cenário</td></tr><tr><td>'+(tributo?'Alíquota de tributos':administracao?'Percentual de administração':'Percentual de participação')+'</td><td>Fórmula desta categoria</td><td>'+n(f.percentual)+'% · editável</td></tr><tr><td>Quantidade de eventos</td><td>Premissas quantitativas</td><td>'+n(p.shows)+' · multiplica o valor por evento</td></tr></tbody></table></div><button class="btn btn-primary">Fechar</button>';
 document.body.appendChild(d);d.querySelector('button').onclick=function(){d.close();};d.onclose=function(){d.remove();};d.showModal();
 };
 if(escrita)document.getElementById('orc-cultural-form').onsubmit=async function(e){e.preventDefault();if(!orcPodeEditar())return;var raw=document.getElementById('orc-cultural-percentual').value,pct=Number(raw);if(raw===''||!Number.isFinite(pct)||pct<0||pct>100)return;var novo=Object.assign({},f,{percentual:pct}),b=e.target.querySelector('[type=submit]');b.disabled=true;
 try{if(escopo==='padrao'){if(registro)await sb.patch('cda_orc_formulas_categoria',registro.id,{definicao:novo,atualizado_em:new Date().toISOString()});else await sb.post('cda_orc_formulas_categoria',{categoria_id:cat.id,definicao:novo});await orcCategorias();}else{g.conteudo=await orcRpc('cda_orc_salvar_formula_projeto',{cadastro:g.id,item:cat.id,anterior:cat.formula||null,nova:novo});orcCategoriasProjeto();}await orcFormulaAbrir(escopo,cat.id);showToast('Percentual salvo','success');}catch(err){b.disabled=false;showToast('Não foi possível salvar. Reabra o cadastro antes de tentar novamente.','error');}
 };
 orcDescricaoUniversal(el,cat,f,escopo,g);el.scrollIntoView({behavior:'smooth',block:'nearest'});
}

function orcAdministracaoTotal(el,cat,p,escopo,rows,g,f){
 var filhos=rows.filter(function(x){return x.pai_id===cat.id&&x.ativo!==false;}),n=orcReceitaNumero;
 function obter(x){if(escopo==='projeto')return x.formula;var a=orcFormulasCategorias.find(function(r){return r.categoria_id===x.id;});return a&&a.definicao;}
 var descontoRaiz=rows.find(function(x){return x.codigo==='2';}),descontos=[];
 function visitar(id){rows.filter(function(x){return x.pai_id===id&&x.ativo!==false;}).forEach(function(x){if(rows.some(function(y){return y.pai_id===x.id&&y.ativo!==false;}))visitar(x.id);else descontos.push(obter(x));});}
 if(descontoRaiz&&descontoRaiz.ativo!==false){visitar(descontoRaiz.id);if(!descontos.length)descontos.push(undefined);}else if(!descontoRaiz)descontos.push(undefined);
 var series=filhos.map(function(x){var regra=obter(x);return orcParticipacaoResultados(p,regra?regra.percentual:null,descontos);}),base=orcParticipacaoResultados(p,0,descontos);
 el.innerHTML='<div class="card"><div class="card-title">'+orcEsc(cat.codigo)+' — '+orcEsc(cat.nome)+'</div>'+orcPremissasCabecalho(p)+'<h3 style="margin:18px 0">Valor Administração Ciclo Arte · automático (somatório das subcategorias)</h3><p>Base das subcategorias: Receita Bruta de Vendas − Descontos sobre as Vendas.</p><div class="tbl-wrap"><table><thead><tr><th>Cenário</th><th>Receita Líquida/evento</th>'+filhos.map(function(x){var regra=obter(x);return '<th>'+orcEsc(x.nome)+' · '+n(regra&&regra.percentual)+'% /evento</th>';}).join('')+'<th>Administração/evento</th><th>Administração/projeto</th></tr></thead><tbody>'+base.map(function(b,i){var itens=series.map(function(s){return s[i];}),ok=itens.length>0&&itens.every(function(x){return x.participacao!==null;});return '<tr><td>'+orcEsc(b.nome)+'</td><td>'+n(b.liquida,true)+'</td>'+itens.map(function(x){return '<td>'+n(x.participacao,true)+'</td>';}).join('')+'<td><strong>'+n(ok?itens.reduce(function(s,x){return s+x.participacao;},0):null,true)+'</strong></td><td><strong>'+n(ok?itens.reduce(function(s,x){return s+x.participacaoProjeto;},0):null,true)+'</strong></td></tr>';}).join('')+'</tbody></table></div><button class="btn btn-ghost" id="orc-adm-voltar" style="margin-top:16px">← Voltar às categorias</button></div>';
 document.getElementById('orc-adm-voltar').onclick=function(){orcFormulaSessao++;el.innerHTML='';};orcDescricaoUniversal(el,cat,f,escopo,g);el.scrollIntoView({behavior:'smooth',block:'nearest'});
}

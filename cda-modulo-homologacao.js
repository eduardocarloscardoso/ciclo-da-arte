// Lista de Homologação · Comercial
// Pessoas globais com múltiplos endereços por campanha. Nenhum envio é executado aqui.
async function montarModuloHomologacao(containerId, opts) {
  const root = document.getElementById(containerId);
  if (!root) return;
  const editavel = !!(opts && opts.editavel);
  let campanhas = [], pessoas = [], destinos = [], campanhaId = '';
  let editPessoa = null, editEmail = null;
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const normalEmail = v => String(v || '').trim().toLowerCase();
  const emailValido = v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  const btn = (acao, label, extra = '') => '<button type="button" class="btn sm" data-ac="'+acao+'" '+extra+'>'+label+'</button>';
  const banner = msg => { const el = root.querySelector('#homolog-msg'); el.textContent = msg; el.style.display = msg ? '' : 'none'; };
  async function consultar(tabela, query) {
    const res = await query;
    if (res.error) throw res.error;
    return res.data || [];
  }
  async function atualizar() {
    try {
      banner('');
      [pessoas, destinos] = await Promise.all([
        consultar('cda_homologacao_pessoas', cdaClient.from('cda_homologacao_pessoas').select('id,nome').order('nome')),
        consultar('cda_homologacao_destinatarios', cdaClient.from('cda_homologacao_destinatarios').select('id,campanha_id,pessoa_id,email,principal,ativo').eq('campanha_id', Number(campanhaId)).order('email'))
      ]);
      desenhar();
    } catch (e) { console.error(e); banner('Erro ao carregar lista: '+(e.message || e)); }
  }
  function nomePessoa(id) { const p=pessoas.find(p => String(p.id)===String(id)); return p ? p.nome : 'Pessoa #'+id; }
  function desenhar() {
    const ativos = destinos.filter(d => d.ativo);
    const ps = new Set(ativos.map(d => String(d.pessoa_id)));
    root.querySelector('#homolog-resumo').textContent = ps.size+' pessoa(s) · '+ativos.length+' e-mail(s) ativo(s) · '+destinos.filter(d=>!d.ativo).length+' inativo(s)';
    const filtro = root.querySelector('#homolog-busca').value.trim().toLowerCase();
    const registros = destinos.filter(d => !filtro || (nomePessoa(d.pessoa_id)+' '+d.email).toLowerCase().includes(filtro))
      .sort((a,b) => nomePessoa(a.pessoa_id).localeCompare(nomePessoa(b.pessoa_id),'pt-BR') || Number(b.principal)-Number(a.principal) || a.email.localeCompare(b.email));
    root.querySelector('#homolog-lista').innerHTML = registros.length ?
      '<div style="overflow-x:auto"><table style="width:100%;min-width:770px"><thead><tr><th>Pessoa</th><th>E-mail</th><th>Tipo</th><th>Situação</th><th>Ações</th></tr></thead><tbody>'+
      registros.map(d=>'<tr><td>'+esc(nomePessoa(d.pessoa_id))+'</td><td>'+esc(d.email)+'</td><td>'+(d.principal?'Principal':'Adicional')+'</td><td>'+(d.ativo?'Ativo':'Inativo')+'</td><td><div style="display:flex;gap:5px;flex-wrap:wrap">'+
       (editavel ? btn('editar-email','Editar','data-id="'+d.id+'"')+' '+
          (!d.principal && d.ativo ? btn('principal','Tornar principal','data-id="'+d.id+'"') : '')+' '+
          btn('ativar',d.ativo?'Desativar':'Reativar','data-id="'+d.id+'"')+' '+
          btn('excluir-email','Excluir','data-id="'+d.id+'"') : 'Somente leitura')+
       '</div></td></tr>').join('')+'</tbody></table></div>' :
      '<p style="padding:12px">Nenhum endereço nesta campanha'+(filtro?' corresponde à busca':'')+'.</p>';
    if(editavel) root.querySelector('#homolog-selec-pessoa').innerHTML = '<option value="">Selecione uma pessoa</option>'+
      pessoas.map(p=>'<option value="'+p.id+'">'+esc(p.nome)+'</option>').join('');
    root.querySelector('#homolog-pessoas').innerHTML = pessoas.length ?
      '<div style="display:flex;flex-wrap:wrap;gap:8px">'+pessoas.map(p=>
       '<div style="border:1px solid #667085;border-radius:8px;padding:9px;display:flex;align-items:center;gap:8px">'+esc(p.nome)+
       (editavel ? btn('editar-pessoa','Editar','data-id="'+p.id+'"')+' '+btn('excluir-pessoa','Excluir','data-id="'+p.id+'"') : '')+
       '</div>').join('')+'</div>' : 'Nenhuma pessoa cadastrada.';
    if(editavel && editPessoa)root.querySelector('#homolog-selec-pessoa').value=String(editPessoa);
  }
  function limparForm() {
    editPessoa=null;editEmail=null;
    if(editavel)root.querySelector('#homolog-nome').value='';
    if(editavel)root.querySelector('#homolog-id-pessoa').value='';
    if(editavel)root.querySelector('#homolog-email').value='';
    if(editavel)root.querySelector('#homolog-selec-pessoa').value='';
    if(editavel) {
      root.querySelector('#homolog-principal').checked=false;
      root.querySelector('#homolog-form-pessoa-titulo').textContent='Nova pessoa';
      root.querySelector('#homolog-form-email-titulo').textContent='Adicionar e-mail à campanha';
    }
  }
  async function gravarPessoa(ev) {
    ev.preventDefault(); if(!editavel)return;
    const nome=root.querySelector('#homolog-nome').value.trim();
    if(!nome){banner('Informe o nome da pessoa.');return;}
    const ja=pessoas.find(p=>p.nome.toLocaleLowerCase('pt-BR')===nome.toLocaleLowerCase('pt-BR')&&String(p.id)!==String(editPessoa));
    if(ja){banner('Já existe uma pessoa com esse nome. Utilize a opção de editar ou inclua um e-mail adicional.');return;}
    const b=root.querySelector('#homolog-salvar-pessoa');b.disabled=true;
    try {
      const query = editPessoa ?
        cdaClient.from('cda_homologacao_pessoas').update({nome,atualizado_em:new Date().toISOString()}).eq('id',editPessoa) :
        cdaClient.from('cda_homologacao_pessoas').insert({nome});
      const resp=await query.select('id').single();
      if(resp.error)throw resp.error;
      limparForm();await atualizar();banner('Pessoa salva com sucesso. Adicione o endereço de e-mail abaixo.');
      root.querySelector('#homolog-selec-pessoa').value=String(resp.data.id);
    } catch(e){console.error(e);banner('Não foi possível salvar a pessoa: '+(e.message||e));}
    finally{b.disabled=false;}
  }
  async function gravarEmail(ev) {
    ev.preventDefault();if(!editavel)return;
    const pessoaId=Number(root.querySelector('#homolog-selec-pessoa').value);
    const email=normalEmail(root.querySelector('#homolog-email').value);
    const principal=root.querySelector('#homolog-principal').checked;
    if(!pessoaId || !pessoas.some(p=>Number(p.id)===pessoaId)){banner('Selecione uma pessoa cadastrada.');return;}
    if(!emailValido(email)){banner('Informe um endereço de e-mail válido.');return;}
    const duplicado=destinos.find(d=>d.email===email&&String(d.id)!==String(editEmail));
    if(duplicado){banner('Este endereço já está cadastrado na campanha. Edite ou reative o registro existente.');return;}
    const b=root.querySelector('#homolog-salvar-email');b.disabled=true;
    try {
      // Somente um e-mail principal ativo por pessoa e campanha.
      if(principal){
        const outros=destinos.filter(d=>d.principal&&d.ativo&&d.pessoa_id===pessoaId&&String(d.id)!==String(editEmail));
        for(const d of outros){
          const r=await cdaClient.from('cda_homologacao_destinatarios').update({principal:false}).eq('id',d.id).eq('campanha_id',Number(campanhaId));
          if(r.error)throw r.error;
        }
      }
      const dados={pessoa_id:pessoaId,email,principal,ativo:true};
      const query=editEmail ?
        cdaClient.from('cda_homologacao_destinatarios').update(dados).eq('id',editEmail).eq('campanha_id',Number(campanhaId)) :
        cdaClient.from('cda_homologacao_destinatarios').insert(Object.assign({campanha_id:Number(campanhaId)},dados));
      const resp=await query.select('id').single();
      if(resp.error)throw resp.error;
      limparForm();await atualizar();banner('E-mail salvo na lista de homologação. Nenhuma mensagem foi enviada.');
    } catch(e){console.error(e);await atualizar();banner('Erro ao salvar e-mail: '+(e.message||e)+'. Confira o principal antes de tentar novamente.');}
    finally{b.disabled=false;}
  }
  async function acaoTabela(ev) {
    const b=ev.target.closest('[data-ac]');if(!b||!editavel)return;
    const ac=b.dataset.ac,id=Number(b.dataset.id);
    const d=destinos.find(x=>Number(x.id)===id);
    const p=pessoas.find(x=>Number(x.id)===id);
    try {
      if(ac==='editar-pessoa' && p) {
        editPessoa=p.id;root.querySelector('#homolog-nome').value=p.nome;
        root.querySelector('#homolog-form-pessoa-titulo').textContent='Editar pessoa';
        root.querySelector('#homolog-form-pessoa').scrollIntoView({block:'nearest',behavior:'smooth'});return;
      }
      if(ac==='editar-email' && d) {
        editEmail=d.id;root.querySelector('#homolog-selec-pessoa').value=String(d.pessoa_id);
        root.querySelector('#homolog-email').value=d.email;
        root.querySelector('#homolog-principal').checked=d.principal;
        root.querySelector('#homolog-form-email-titulo').textContent='Editar e-mail';
        root.querySelector('#homolog-form-email').scrollIntoView({block:'nearest',behavior:'smooth'});return;
      }
      if(ac==='excluir-pessoa' && p) {
        // Segurança: nunca apagar uma pessoa referenciada por outra campanha.
        const r=await cdaClient.from('cda_homologacao_destinatarios').select('id',{count:'exact',head:true}).eq('pessoa_id',id);
        if(r.error)throw r.error;
        if(r.count){banner('Esta pessoa tem e-mails vinculados a campanhas. Exclua os endereços antes de excluir a pessoa.');return;}
        if(!confirm('Excluir definitivamente a pessoa '+p.nome+'?'))return;
        const del=await cdaClient.from('cda_homologacao_pessoas').delete().eq('id',id);
        if(del.error)throw del.error;
      } else if(ac==='principal' && d) {
        if(!confirm('Definir '+d.email+' como e-mail principal de '+nomePessoa(d.pessoa_id)+' nesta campanha?'))return;
        const outros=destinos.filter(x=>x.pessoa_id===d.pessoa_id&&x.principal&&x.id!==d.id);
        for(const o of outros){
          const r=await cdaClient.from('cda_homologacao_destinatarios').update({principal:false}).eq('id',o.id).eq('campanha_id',Number(campanhaId));
          if(r.error)throw r.error;
        }
        const r=await cdaClient.from('cda_homologacao_destinatarios').update({principal:true}).eq('id',d.id).eq('campanha_id',Number(campanhaId));if(r.error)throw r.error;
      } else if(ac==='ativar' && d) {
        if(d.ativo && !confirm('Desativar '+d.email+' nesta campanha?'))return;
        const dados={ativo:!d.ativo};
        // Reativação não pode produzir dois endereços principais ativos.
        if(!d.ativo&&d.principal&&destinos.some(x=>x.pessoa_id===d.pessoa_id&&x.principal&&x.ativo&&x.id!==d.id))dados.principal=false;
        const r=await cdaClient.from('cda_homologacao_destinatarios').update(dados).eq('id',d.id).eq('campanha_id',Number(campanhaId));if(r.error)throw r.error;
      } else if(ac==='excluir-email' && d) {
        if(!confirm('Excluir '+d.email+' da lista desta campanha? Essa exclusão não interfere nos clientes oficiais.'))return;
        const r=await cdaClient.from('cda_homologacao_destinatarios').delete().eq('id',d.id).eq('campanha_id',Number(campanhaId));if(r.error)throw r.error;
      } else return;
      limparForm();await atualizar();banner('Cadastro atualizado. Nenhum envio foi realizado.');
    } catch(e){console.error(e);await atualizar();banner('Não foi possível concluir: '+(e.message||e));}
  }
  root.innerHTML = '<div style="padding:18px;display:grid;gap:18px">'+
    '<div><h2 style="margin:0 0 8px">Lista de Homologação</h2><p style="margin:0;color:var(--text-muted,#64748b)">Equipe de testes independente dos clientes e do Pipeline B2C. Esta tela não realiza disparos.</p></div>'+
    '<div style="border:1px solid #64748b;border-radius:10px;padding:14px;display:grid;gap:10px">'+
      '<label for="homolog-campanha"><b>Campanha</b></label><select id="homolog-campanha" style="max-width:600px;padding:9px;color:#111;background:#fff"></select>'+
      '<div id="homolog-resumo" style="font-weight:700"></div><input id="homolog-busca" placeholder="Buscar por pessoa ou e-mail" style="max-width:500px;padding:9px;color:#111;background:#fff">'+
      '<div id="homolog-lista"></div></div>'+
    (editavel ? '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px">'+
      '<form id="homolog-form-pessoa" style="border:1px solid #64748b;border-radius:10px;padding:14px;display:grid;gap:10px"><h3 id="homolog-form-pessoa-titulo" style="margin:0">Nova pessoa</h3><label>Nome completo</label><input id="homolog-nome" required maxlength="180" style="padding:9px;color:#111;background:#fff"><input id="homolog-id-pessoa" type="hidden"><div style="display:flex;gap:8px"><button id="homolog-salvar-pessoa" class="btn rust" type="submit">Salvar pessoa</button><button class="btn" type="button" id="homolog-cancelar-pessoa">Cancelar edição</button></div></form>'+
      '<form id="homolog-form-email" style="border:1px solid #64748b;border-radius:10px;padding:14px;display:grid;gap:10px"><h3 id="homolog-form-email-titulo" style="margin:0">Adicionar e-mail à campanha</h3><label>Pessoa</label><select id="homolog-selec-pessoa" required style="padding:9px;color:#111;background:#fff"></select><label>Endereço de e-mail</label><input id="homolog-email" type="email" required maxlength="254" style="padding:9px;color:#111;background:#fff"><label><input id="homolog-principal" type="checkbox"> E-mail principal desta pessoa nesta campanha</label><div style="display:flex;gap:8px"><button id="homolog-salvar-email" class="btn rust" type="submit">Salvar e-mail</button><button class="btn" type="button" id="homolog-cancelar-email">Cancelar edição</button></div></form></div>'+
      '<div style="border:1px solid #64748b;border-radius:10px;padding:14px;display:grid;gap:10px"><h3 style="margin:0">Pessoas cadastradas</h3><p style="margin:0;font-size:12px">Uma pessoa pode ter vários endereços e participar de várias campanhas. A exclusão da pessoa exige retirar antes todos os vínculos.</p><div id="homolog-pessoas"></div></div>' :
      '<div style="border:1px solid #64748b;border-radius:10px;padding:14px"><h3 style="margin:0 0 8px">Pessoas cadastradas</h3><div id="homolog-pessoas"></div></div>')+
    '<p id="homolog-msg" role="status" aria-live="polite" style="display:none;padding:12px;border:1px solid #64748b;border-radius:8px"></p>'+
    '<p style="font-size:12px;color:var(--text-muted,#64748b)">Somente a equipe autorizada pode acessar estes registros. Não é a lista oficial de transmissão e não altera a quantidade de leads.</p>'+
    '</div>';
  root.querySelector('#homolog-campanha').addEventListener('change', e=>{campanhaId=e.target.value;limparForm();atualizar();});
  root.querySelector('#homolog-busca').addEventListener('input',desenhar);
  root.addEventListener('click',acaoTabela);
  if(editavel) {
    root.querySelector('#homolog-form-pessoa').addEventListener('submit',gravarPessoa);
    root.querySelector('#homolog-form-email').addEventListener('submit',gravarEmail);
    root.querySelector('#homolog-cancelar-pessoa').addEventListener('click',()=>{editPessoa=null;root.querySelector('#homolog-nome').value='';root.querySelector('#homolog-form-pessoa-titulo').textContent='Nova pessoa';});
    root.querySelector('#homolog-cancelar-email').addEventListener('click',()=>{editEmail=null;root.querySelector('#homolog-email').value='';root.querySelector('#homolog-principal').checked=false;root.querySelector('#homolog-form-email-titulo').textContent='Adicionar e-mail à campanha';});
  }
  try {
    campanhas=await consultar('cda_campanhas',cdaClient.from('cda_campanhas').select('id,nome').order('nome'));
    const sel=root.querySelector('#homolog-campanha');
    sel.innerHTML=campanhas.map(c=>'<option value="'+c.id+'">'+esc(c.nome)+'</option>').join('');
    const preferida=campanhas.find(c=>c.id===4);
    campanhaId=String(preferida?preferida.id:(campanhas[0]&&campanhas[0].id)||'');
    if(!campanhaId){banner('Cadastre uma campanha antes de criar listas de homologação.');return;}
    sel.value=campanhaId;
    await atualizar();
  }catch(e){console.error(e);banner('Erro ao consultar campanhas: '+(e.message||e));}
}

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
      desenharPreparo();
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

  // Pré-voo exclusivamente de leitura. Não cria tentativa nem chama Edge Function.
  // O envio somente será habilitado após motor transacional/idempotente no servidor.
  let mensagensLote = [];
  async function carregarMensagensLote() {
    const seletor = root.querySelector('#homolog-lote-mensagem');
    const mensagemAnterior=seletor.value;
    seletor.innerHTML = '<option value="">Carregando mensagens...</option>';
    seletor.disabled = true;
    try {
      mensagensLote = await consultar('cda_campanha_mensagens', cdaClient
        .from('cda_campanha_mensagens').select('id,nome,assunto,campanha_id')
        .eq('campanha_id',Number(campanhaId)).order('nome'));
      seletor.innerHTML = '<option value="">Selecione a mensagem</option>' +
        mensagensLote.map(m=>'<option value="'+m.id+'">'+esc(m.nome)+' — '+esc(m.assunto||'Sem assunto')+'</option>').join('');
      seletor.disabled = false;
      if (mensagensLote.some(m=>String(m.id)===mensagemAnterior)) seletor.value=mensagemAnterior;
      else if (mensagensLote.length===1) seletor.value=String(mensagensLote[0].id);
      desenharPreparo();
      if(seletor.value)await acionarLote('status');
      else root.querySelector('#homolog-lote-operacao').textContent='Selecione uma mensagem para consultar ou preparar o lote.';
    } catch(e) {
      mensagensLote = [];
      seletor.innerHTML = '<option value="">Não foi possível consultar mensagens</option>';
      root.querySelector('#homolog-lote-detalhes').textContent = 'Falha ao consultar mensagens: '+(e.message||e);
    }
  }
  function desenharPreparo() {
    const painel=root.querySelector('#homolog-lote-detalhes');
    if(!painel)return;
    const selecionada=mensagensLote.find(m=>String(m.id)===root.querySelector('#homolog-lote-mensagem').value);
    const ativos=destinos.filter(d=>d.ativo);
    const emails=new Set();
    const elegiveis=[], invalidos=[], repetidos=[];
    for(const d of ativos) {
      const email=normalEmail(d.email);
      const item={email,nome:nomePessoa(d.pessoa_id),id:d.id};
      if(!emailValido(email)) invalidos.push(item);
      else if(emails.has(email)) repetidos.push(item);
      else {emails.add(email);elegiveis.push(item);}
    }
    painel.innerHTML =
      '<div><b>Modo:</b> Homologação · <b>Campanha:</b> '+esc((campanhas.find(c=>String(c.id)===String(campanhaId))||{}).nome||'')+
      ' · <b>Mensagem:</b> '+esc(selecionada?selecionada.nome:'não selecionada')+'</div>'+
      '<div><b>'+elegiveis.length+' destinatário(s) elegível(is)</b> · '+invalidos.length+' inválido(s) · '+repetidos.length+' duplicado(s) · '+destinos.filter(d=>!d.ativo).length+' inativo(s) excluído(s).</div>'+
      '<div style="overflow-x:auto;max-height:230px;overflow-y:auto"><table style="width:100%"><thead><tr><th>Pessoa</th><th>E-mail</th><th>Situação</th></tr></thead><tbody>'+
      elegiveis.map(d=>'<tr><td>'+esc(d.nome)+'</td><td>'+esc(d.email)+'</td><td>Pendente · não enviado</td></tr>').join('')+
      '</tbody></table></div>'+
      '<p style="margin:0;font-size:12px">Prévia calculada sobre os cadastros atuais. Antes de qualquer envio, o servidor deverá congelar novamente os destinatários, verificar permissões, supressões, idempotência e autorização específica.</p>';
    root.querySelector('#homolog-lote-aviso').textContent=selecionada
      ? 'Preparação concluída. Nenhuma mensagem enviada. Envio bloqueado nesta etapa de segurança.'
      : 'Selecione uma mensagem para concluir a preparação. Envio bloqueado.';
  }

  // Operações persistidas no servidor, SEM envio (Edge Function não conhece o Resend).
  async function acionarLote(acao) {
    const el=root.querySelector('#homolog-lote-operacao');
    const mensagemId=Number(root.querySelector('#homolog-lote-mensagem').value);
    if(!mensagemId){el.textContent='Selecione uma mensagem da campanha.';return;}
    if(acao==='preparar' && !confirm('Congelar a lista atual para esta mensagem? Esta operação só registra o lote e NÃO envia e-mails.'))return;
    if(acao==='interromper' && !confirm('Interromper este lote? Não houve envio. A retomada dependerá de liberação posterior.'))return;
    const a=root.querySelector('#homolog-lote-preparar'),b=root.querySelector('#homolog-lote-interromper');
    a.disabled=true;b.disabled=true;
    el.textContent=acao==='preparar'?'Preparando lista e registrando destinatários (sem envio)...':
      acao==='interromper'?'Registrando interrupção...':'Consultando operação...';
    try {
      const res=await cdaClient.functions.invoke('cda-lote-homologacao-preview',{
        body:{acao,campanha_id:Number(campanhaId),mensagem_id:mensagemId}
      });
      if(res.error)throw res.error;
      const dados=res.data;
      if(!dados||!dados.ok)throw new Error((dados&&dados.erro)||'Falha na consulta');
      const lote=dados.lote;
      if(!lote){
        el.textContent='Nenhum lote persistido para esta campanha/mensagem. Utilize Preparar lote (sem envio).';
        a.disabled=false;
        return;
      }
      const itens=Array.isArray(dados.itens)?dados.itens:[];
      const cont=dados.contagens||{};
      const total=itens.length;
      const processados=Number(dados.processados)||0;
      const contagem=k=>Number(cont[k])||0;
      const percent=total?Math.round(processados*100/total):0;
      const labels={pendente:'Pendente',bloqueado:'Bloqueado',processando:'Processando',
        indeterminado:'Resultado indeterminado',aceito:'Aceito pelo Resend',
        entregue:'Entregue',falha:'Falha',devolvido:'Devolvido',reclamacao:'Reclamação',atrasado:'Entrega atrasada'};
      const indicadores=[
        ['Pendentes',contagem('pendente')],['Processando',contagem('processando')],
        ['Aceitos pelo Resend',contagem('aceito')],['Entregues',contagem('entregue')],
        ['Falhas',contagem('falha')],['Devolvidos',contagem('devolvido')],
        ['Bloqueados',contagem('bloqueado')],['Indeterminados',contagem('indeterminado')]
      ];
      el.innerHTML='<p style="margin:0"><b>Lote #'+esc(lote.id)+'</b> · '+
        esc(lote.situacao==='interrompido'?'Operação interrompida':'Preparado, aguardando autorização')+
        ' · <b>'+total+' destinatário(s) registrado(s)</b></p>'+
        '<p style="margin:0"><b>'+processados+' de '+total+' destinatários processados</b> · '+percent+'%'+
        ' (processamento técnico, não necessariamente entrega)</p>'+
        '<div style="height:9px;border-radius:9px;background:#d1d5db;overflow:hidden" aria-label="Progresso">'+
        '<div style="height:100%;width:'+percent+'%;background:#64748b"></div></div>'+
        '<div style="display:flex;flex-wrap:wrap;gap:7px">'+indicadores.map(x=>
          '<span style="border:1px solid #9ca3af;border-radius:6px;padding:5px 9px;font-size:12px">'+
          esc(x[0])+': <b>'+x[1]+'</b></span>').join('')+'</div>'+
        '<p style="margin:0;font-size:12px">Snapshot persistente. Envio desabilitado, sem autorização de disparo. '+
        'Aceitação do provedor não confirma entrega; entrega não confirma leitura. Os eventos exibidos provêm do histórico técnico.</p>'+
        '<div style="overflow:auto"><table style="width:100%;min-width:680px"><thead><tr><th>Nome</th><th>E-mail</th><th>Estado</th><th>Resend</th></tr></thead><tbody>'+
        itens.map(i=>'<tr><td>'+esc(i.nome)+'</td><td>'+esc(i.email)+'</td><td>'+
        esc(labels[i.situacao_observada||i.situacao]||i.situacao_observada||i.situacao)+
        '</td><td>'+esc(i.resend_email_id||'—')+'</td></tr>').join('')+
        '</tbody></table></div>'+
        '<p style="font-size:12px;margin:0">O lote não será executado automaticamente, mesmo após recarregar ou retomar a página.</p>';
      b.disabled=lote.situacao!=='preparado';
      a.disabled=true;
    }catch(e){
      console.error(e);
      el.textContent='Não foi possível consultar/registrar o lote: '+(e.message||e)+'. Nenhum envio solicitado.';
      // Sem reabilitar "preparar" após resultado ambíguo; consultar primeiro.
      a.disabled=true;
    }
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
    '<section style="border:1px solid #64748b;border-radius:10px;padding:14px;display:grid;gap:10px" aria-label="Preparação de envio em lote">'+
      '<h3 style="margin:0">Preparação de envio em lote · Homologação</h3>'+
      '<p style="margin:0">Conferência de destinatários e mensagem, sem qualquer disparo. A execução permanece bloqueada até implantação do controle transacional no servidor e nova autorização.</p>'+
      '<label for="homolog-lote-mensagem"><b>Mensagem da campanha</b></label><select id="homolog-lote-mensagem" style="max-width:650px;padding:9px;color:#111;background:#fff"></select>'+
      '<div id="homolog-lote-detalhes" aria-live="polite">Preparando lista de destinatários...</div>'+
      '<p id="homolog-lote-aviso" role="status" style="margin:0"></p>'+
      '<div style="display:flex;gap:10px;flex-wrap:wrap"><button type="button" class="btn" id="homolog-lote-atualizar">Atualizar conferência</button><button type="button" class="btn" id="homolog-lote-preparar">Preparar lote (sem envio)</button><button type="button" class="btn" id="homolog-lote-interromper" disabled>Interromper lote</button><button type="button" class="btn rust" disabled title="Aguardando autorização específica e segurança transacional">Enviar lote (bloqueado)</button></div>'+ 
      '<div id="homolog-lote-operacao" role="status" aria-live="polite">Selecione a mensagem para consultar lotes anteriores.</div>'+
      '<p style="margin:0;font-size:12px">Modo Oficial bloqueado. A lista congelada de clientes e o Pipeline B2C não são consultados nesta preparação.</p>'+
    '</section>'+
    '<p id="homolog-msg" role="status" aria-live="polite" style="display:none;padding:12px;border:1px solid #64748b;border-radius:8px"></p>'+
    '<p style="font-size:12px;color:var(--text-muted,#64748b)">Somente a equipe autorizada pode acessar estes registros. Não é a lista oficial de transmissão e não altera a quantidade de leads.</p>'+
    '</div>';
  root.querySelector('#homolog-campanha').addEventListener('change', async e=>{campanhaId=e.target.value;limparForm();await atualizar();await carregarMensagensLote();});
  root.querySelector('#homolog-lote-mensagem').addEventListener('change',()=>{desenharPreparo();if(root.querySelector('#homolog-lote-mensagem').value)acionarLote('status');else root.querySelector('#homolog-lote-operacao').textContent='Selecione uma mensagem.';});
  root.querySelector('#homolog-lote-preparar').addEventListener('click',()=>acionarLote('preparar'));
  root.querySelector('#homolog-lote-interromper').addEventListener('click',()=>acionarLote('interromper'));
  root.querySelector('#homolog-lote-atualizar').addEventListener('click',async()=>{await atualizar();await carregarMensagensLote();});
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
    const preferenciaPipeline=String(window._cdaHomologacaoCampanhaId || '');
    const preferida=campanhas.find(c=>String(c.id)===preferenciaPipeline) || campanhas.find(c=>Number(c.id)===4);
    window._cdaHomologacaoCampanhaId = '';
    campanhaId=String(preferida?preferida.id:(campanhas[0]&&campanhas[0].id)||'');
    if(!campanhaId){banner('Cadastre uma campanha antes de criar listas de homologação.');return;}
    sel.value=campanhaId;
    await atualizar();
    await carregarMensagensLote();
  }catch(e){console.error(e);banner('Erro ao consultar campanhas: '+(e.message||e));}
}

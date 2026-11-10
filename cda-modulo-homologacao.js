// Lista de Homologação · Comercial
// Pessoas globais com múltiplos endereços por campanha. Nenhum envio é executado aqui.
async function montarModuloHomologacao(containerId, opts) {
  const root = document.getElementById(containerId);
  if (!root) return;
  const editavel = !!(opts && opts.editavel);
  let campanhas = [], pessoas = [], destinos = [], campanhaId = '';
  let editPessoa = null, editEmail = null;
  let loteIdParaEnvio = null, itensPendentesEnvio = [];
  let permissaoDeEnvio = false, envioEmExecucao = false;
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
      registros.map(d=>'<tr><td>'+esc(nomePessoa(d.pessoa_id))+'</td><td>'+esc(d.email)+'</td><td>'+(d.principal?'Principal':'Adicional')+'</td><td>'+(d.ativo?'Ativo':'Inativo')+'</td><td>'+
       (editavel ? '<details class="hom-row-actions"><summary style="cursor:pointer;font-weight:700">Gerenciar</summary>'+
         '<div style="display:flex;gap:5px;flex-wrap:wrap;padding-top:8px">'+
         btn('editar-email','Editar e-mail','data-id="'+d.id+'"')+' '+btn('editar-pessoa','Editar pessoa','data-id="'+d.pessoa_id+'"')+' '+
         (!d.principal && d.ativo ? btn('principal','Tornar principal','data-id="'+d.id+'"') : '')+' '+
         btn('ativar',d.ativo?'Desativar':'Reativar','data-id="'+d.id+'"')+' '+
         btn('excluir-email','Excluir','data-id="'+d.id+'"')+
         '</div></details>' : 'Somente leitura')+
       '</td></tr>').join('')+'</tbody></table></div>' :
      '<p style="padding:12px">Nenhum endereço nesta campanha'+(filtro?' corresponde à busca':'')+'.</p>';
    if(editavel){const sel=root.querySelector('#homolog-selec-pessoa'),old=sel.value;
      sel.innerHTML='<option value="">Nova pessoa</option>'+pessoas.map(p=>'<option value="'+p.id+'">'+esc(p.nome)+'</option>').join('');
      if(pessoas.some(p=>String(p.id)===old))sel.value=old;
    }
  }
  function limparForm(){
    editPessoa=null;editEmail=null;if(!editavel)return;
    root.querySelector('#homolog-cadastro').open=false;
    const sel=root.querySelector('#homolog-selec-pessoa');sel.disabled=false;sel.value='';
    root.querySelector('#homolog-nome').value='';root.querySelector('#homolog-email').value='';
    root.querySelector('#homolog-principal').checked=false;
    root.querySelector('#homolog-form-titulo').textContent='Cadastrar pessoa e e-mail';
    root.querySelector('#homolog-nome-linha').hidden=false;
    root.querySelector('#homolog-email-linha').hidden=false;
    root.querySelector('#homolog-principal-linha').hidden=false;
    root.querySelector('#homolog-email').required=true;
    root.querySelector('#homolog-excluir-pessoa').disabled=true;
  }
  function trocarPessoa(){
    if(editPessoa!==null||editEmail!==null)return;
    const outra=!!root.querySelector('#homolog-selec-pessoa').value;
    root.querySelector('#homolog-excluir-pessoa').disabled=!outra;
    root.querySelector('#homolog-nome-linha').hidden=outra;
    root.querySelector('#homolog-nome').value='';
    root.querySelector('#homolog-form-titulo').textContent=outra?'Adicionar e-mail à pessoa existente':'Cadastrar pessoa e e-mail';
  }
  async function excluirPessoaSemVinculos(){
    const id=Number(root.querySelector('#homolog-selec-pessoa').value);
    const pessoa=pessoas.find(p=>Number(p.id)===id);
    if(!pessoa)return;
    try{
      const r=await cdaClient.from('cda_homologacao_destinatarios').select('id',{count:'exact',head:true}).eq('pessoa_id',id);
      if(r.error)throw r.error;
      if(r.count){banner('Pessoa vinculada a e-mails. Remova os vínculos em todas as campanhas antes de excluir.');return;}
      if(!confirm('Excluir definitivamente a pessoa '+pessoa.nome+'?'))return;
      const x=await cdaClient.from('cda_homologacao_pessoas').delete().eq('id',id);
      if(x.error)throw x.error;
      limparForm();await atualizar();banner('Pessoa excluída do cadastro de homologação. Nenhum envio realizado.');
    }catch(e){console.error(e);banner('Falha na exclusão: '+(e.message||e));}
  }
  async function salvarCadastro(e){
    e.preventDefault();if(!editavel)return;
    const nome=root.querySelector('#homolog-nome').value.trim(),
      email=normalEmail(root.querySelector('#homolog-email').value),
      principal=root.querySelector('#homolog-principal').checked,
      soNome=editPessoa!==null&&editEmail===null;
    let pid=soNome?Number(editPessoa):Number(root.querySelector('#homolog-selec-pessoa').value);
    if((!pid||soNome)&&!nome){banner('Informe o nome da pessoa.');return;}
    if(!soNome&&!emailValido(email)){banner('Informe um e-mail válido.');return;}
    if(nome&&pessoas.some(p=>p.nome.toLowerCase()===nome.toLowerCase()&&Number(p.id)!==pid)){banner('Pessoa já cadastrada. Selecione-a na lista.');return;}
    if(!soNome&&destinos.some(d=>normalEmail(d.email)===email&&Number(d.id)!==Number(editEmail))){banner('E-mail já cadastrado nesta campanha.');return;}
    const btnSalvar=root.querySelector('#homolog-salvar-cadastro');btnSalvar.disabled=true;
    try{
      if(soNome){
        const z=await cdaClient.from('cda_homologacao_pessoas').update({nome,atualizado_em:new Date().toISOString()}).eq('id',pid);
        if(z.error)throw z.error;
      }else{
        if(!pid){
          const z=await cdaClient.from('cda_homologacao_pessoas').insert({nome}).select('id').single();
          if(z.error)throw z.error;pid=Number(z.data.id);
        }
        if(principal){
          for(const d of destinos.filter(d=>Number(d.pessoa_id)===pid&&d.principal&&d.ativo&&Number(d.id)!==Number(editEmail))){
            const z=await cdaClient.from('cda_homologacao_destinatarios').update({principal:false}).eq('id',d.id).eq('campanha_id',Number(campanhaId));
            if(z.error)throw z.error;
          }
        }
        const dados={pessoa_id:pid,email,principal,ativo:true};
        const q=editEmail!==null?
          cdaClient.from('cda_homologacao_destinatarios').update(dados).eq('id',editEmail).eq('campanha_id',Number(campanhaId)):
          cdaClient.from('cda_homologacao_destinatarios').insert({...dados,campanha_id:Number(campanhaId)});
        const z=await q.select('id').single();if(z.error)throw z.error;
      }
      limparForm();await atualizar();banner('Cadastro salvo. Nenhum envio realizado.');
    }catch(err){console.error(err);await atualizar();banner('Não foi possível salvar: '+(err.message||err)+'. Confira o cadastro antes de tentar novamente.');}
    finally{btnSalvar.disabled=false;}
  }
  async function acaoTabela(ev) {
    const b=ev.target.closest('[data-ac]');if(!b||!editavel)return;
    const ac=b.dataset.ac,id=Number(b.dataset.id);
    const d=destinos.find(x=>Number(x.id)===id);
    const p=pessoas.find(x=>Number(x.id)===id);
    try {
      if(ac==='editar-pessoa' && p){
        limparForm();root.querySelector('#homolog-cadastro').open=true;editPessoa=p.id;
        const sel=root.querySelector('#homolog-selec-pessoa');sel.value=String(p.id);sel.disabled=true;
        root.querySelector('#homolog-nome').value=p.nome;
        root.querySelector('#homolog-email-linha').hidden=true;
        root.querySelector('#homolog-principal-linha').hidden=true;
        root.querySelector('#homolog-email').required=false;
        root.querySelector('#homolog-form-titulo').textContent='Editar nome da pessoa';
        root.querySelector('#homolog-form-cadastro').scrollIntoView({block:'nearest',behavior:'smooth'});return;
      }
      if(ac==='editar-email' && d){
        limparForm();root.querySelector('#homolog-cadastro').open=true;editEmail=d.id;
        const sel=root.querySelector('#homolog-selec-pessoa');sel.value=String(d.pessoa_id);sel.disabled=true;
        root.querySelector('#homolog-nome-linha').hidden=true;
        root.querySelector('#homolog-email').value=d.email;
        root.querySelector('#homolog-principal').checked=d.principal;
        root.querySelector('#homolog-form-titulo').textContent='Editar e-mail de '+nomePessoa(d.pessoa_id);
        root.querySelector('#homolog-form-cadastro').scrollIntoView({block:'nearest',behavior:'smooth'});return;
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
      const single=mensagensLote.length===1;
      root.querySelector('#homolog-lote-mensagem-linha').hidden=single;
      const resumoMensagem=root.querySelector('#homolog-lote-mensagem-unica');
      resumoMensagem.hidden=!single;
      resumoMensagem.textContent=single?'Mensagem: '+mensagensLote[0].nome+(mensagensLote[0].assunto?' · '+mensagensLote[0].assunto:''):'';
      if (mensagensLote.some(m=>String(m.id)===mensagemAnterior)) seletor.value=mensagemAnterior;
      else if (mensagensLote.length===1) seletor.value=String(mensagensLote[0].id);
      if(seletor.value)await acionarLote('status');
      else root.querySelector('#homolog-lote-operacao').textContent='Selecione uma mensagem para consultar ou preparar o lote.';
    } catch(e) {
      mensagensLote = [];
      seletor.innerHTML = '<option value="">Não foi possível consultar mensagens</option>';
      root.querySelector('#homolog-lote-operacao').textContent = 'Falha ao consultar mensagens: '+(e.message||e);
    }
  }
  // Visualização consolidada: os destinos congelados aparecem só na tabela do lote.
  // Só habilita enviar quando o servidor confirmar aprovação específica do lote.
  // Este método é read-only e não solicita qualquer transmissão.
  async function consultarPermissaoDeEnvio(loteId) {
    const botao=root.querySelector('#homolog-lote-enviar');
    permissaoDeEnvio=false;botao.disabled=true;
    if(!loteId||envioEmExecucao)return;
    try{
      const res=await cdaClient.functions.invoke('cda-executor-homologacao-preview',{
        body:{acao:'diagnosticar',lote_id:Number(loteId)}
      });
      if(res.error||!res.data?.ok)throw new Error('Diagnóstico indisponível');
      const resumo=res.data.resumo||{};
      const correta=Number(resumo.lote_id)===Number(loteId)&&
        Number(resumo.campanha_id)===Number(campanhaId)&&
        Number(resumo.mensagem_id)===Number(root.querySelector('#homolog-lote-mensagem').value);
      permissaoDeEnvio=correta&&resumo.autorizado===true&&
        resumo.envio_habilitado===true&&itensPendentesEnvio.length>0;
      botao.disabled=!permissaoDeEnvio;
      botao.title=permissaoDeEnvio
        ?'Lote autorizado: o envio só ocorrerá após confirmar esta ação.'
        :'Envio bloqueado até autorização específica deste lote.';
      const status=root.querySelector('#homolog-lote-estado-envio');
      status.textContent=permissaoDeEnvio
        ?'Lote autorizado por prazo limitado. Confira os destinatários e confirme o envio conscientemente.'
        :'Envio bloqueado: aguardando autorização específica do lote.';
      status.style.color=permissaoDeEnvio?'#166534':'';
    }catch{
      root.querySelector('#homolog-lote-estado-envio').textContent=
        'Sem diagnóstico de autorização: envio permanece bloqueado.';
    }
  }
  // Cada clique requer confirmação; uma chamada por item e nenhuma retomada
  // automática após falha ou resultado incerto.
  async function enviarHomologacaoConfirmada() {
    if(envioEmExecucao||!permissaoDeEnvio||!loteIdParaEnvio)return;
    const loteId=loteIdParaEnvio;
    const itens=itensPendentesEnvio.slice(0,5);
    const descricao=itens.map(i=>'- '+i.nome+' <'+i.email+'>').join('\n');
    if(!confirm('CONFIRMAR ENVIO REAL da mensagem selecionada pelo Resend para os '
       +itens.length+' endereços de homologação?\n\n'+descricao+
       '\n\nCada destinatário será processado individualmente.'))return;
    // Nova verificação da autorização e lote, mesmo depois do clique.
    envioEmExecucao=true;
    root.querySelector('#homolog-lote-enviar').disabled=true;
    const saida=root.querySelector('#homolog-lote-estado-envio');
    let aceitos=0;
    try{
      for(const i of itens){
        saida.textContent='Enviando mensagem '+(aceitos+1)+' de '+itens.length+
          ' · '+i.email+' — aguardando resposta do Resend...';
        const res=await cdaClient.functions.invoke('cda-executor-homologacao-preview',{
          body:{acao:'enviar',lote_id:Number(loteId),item_id:Number(i.id)}
        });
        const resultado=res.data||{};
        if(res.error||!resultado.ok||resultado.estado!=='aceita'){
          saida.textContent='Envio interrompido após '+aceitos+
            ' aceite(s). Resultado pendente ou erro; atualize a consulta e revise o histórico. Não haverá reenvio automático.';
          return;
        }
        aceitos++;
      }
      saida.textContent='Resend aceitou '+aceitos+' solicitação(ões). Aguarde eventos de entrega; aceite não comprova entrega.';
    }catch{
      saida.textContent='Envio interrompido após '+aceitos+
        ' aceite(s). Verifique o histórico; nenhuma repetição automática.';
    }finally{
      envioEmExecucao=false;permissaoDeEnvio=false;
      root.querySelector('#homolog-lote-enviar').disabled=true;
      // Somente status; não dispara nada durante o refresh.
      await acionarLote('status');
    }
  }
  // Operações persistidas no servidor, SEM envio (Edge Function não conhece o Resend).
  async function acionarLote(acao) {
    const el=root.querySelector('#homolog-lote-operacao');
    const mensagemId=Number(root.querySelector('#homolog-lote-mensagem').value);
    if(!mensagemId){el.textContent='Selecione uma mensagem da campanha.';return;}
    if(acao==='preparar' && !confirm('Congelar a lista atual para esta mensagem? Esta operação só registra o lote e NÃO envia e-mails.'))return;
    if(acao==='interromper' && !confirm('Interromper este lote? Nenhuma mensagem será enviada.'))return;
    if(acao==='retomar' && !confirm('Retomar a preparação do lote? Isso NÃO autoriza nem executa envios.'))return;
    const a=root.querySelector('#homolog-lote-preparar'),b=root.querySelector('#homolog-lote-interromper'),c=root.querySelector('#homolog-lote-retomar'),d=root.querySelector('#homolog-lote-simular');
    a.disabled=true;b.disabled=true;c.disabled=true;d.disabled=true;
    root.querySelector('#homolog-lote-enviar').disabled=true;
    permissaoDeEnvio=false;
    el.textContent=acao==='preparar'?'Preparando lista e registrando destinatários (sem envio)...':
      acao==='interromper'?'Registrando interrupção...':acao==='retomar'?'Registrando retomada segura...':acao==='simular'?'Simulando fila sem envio...':'Consultando operação...';
    try {
      const res=await cdaClient.functions.invoke('cda-lote-homologacao-preview',{
        body:{acao,campanha_id:Number(campanhaId),mensagem_id:mensagemId}
      });
      if(res.error)throw res.error;
      const dados=res.data;
      if(!dados||!dados.ok)throw new Error((dados&&dados.erro)||'Falha na consulta');
      const lote=dados.lote;
      if(!lote){
        loteIdParaEnvio=null;itensPendentesEnvio=[];permissaoDeEnvio=false;
        root.querySelector('#homolog-lote-estado-envio').textContent='Nenhum lote preparado; envio bloqueado.';
        root.querySelector('#homolog-preparacao-inicial').hidden=!editavel;
        root.querySelector('#homolog-verificacao').textContent='Nenhum lote preparado. Veja os detalhes técnicos para preparar um lote sem envio.';
        el.textContent='Nenhum lote persistido para esta campanha/mensagem. Utilize Preparar lote (sem envio).';
        a.disabled=false;
        return;
      }
      root.querySelector('#homolog-preparacao-inicial').hidden=true;
      const itens=Array.isArray(dados.itens)?dados.itens:[];
      loteIdParaEnvio=Number(lote.id);
      itensPendentesEnvio=itens.filter(i=>i.situacao==='pendente');
      const cont=dados.contagens||{};
      const total=itens.length;
      const processados=Number(dados.processados)||0;
      const contagem=k=>Number(cont[k])||0;
      const percent=total?Math.round(processados*100/total):0;
      const labels={pendente:'Pendente',bloqueado:'Bloqueado',processando:'Processando',
        indeterminado:'Resultado indeterminado',aceito:'Aceito pelo Resend',
        entregue:'Entregue',falha:'Falha',devolvido:'Devolvido',reclamacao:'Reclamação',atrasado:'Entrega atrasada'};
      const indicadores=[['Pendentes',contagem('pendente')],['Aceitos',contagem('aceito')],['Entregues',contagem('entregue')],['Falhas',contagem('falha')+contagem('devolvido')+contagem('reclamacao')],['Em andamento',contagem('processando')+contagem('atrasado')+contagem('indeterminado')]];
      const situacaoLote=lote.situacao==='interrompido'?'Interrompido':'Preparado';
      el.innerHTML='<div style="display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px"><span><b>Lote #'+esc(lote.id)+'</b> · '+esc(situacaoLote)+' · '+total+' destinatários</span><b>'+processados+'/'+total+' processados</b></div>'+
        '<div style="height:7px;border-radius:7px;background:#d1d5db;overflow:hidden"><div style="height:100%;width:'+percent+'%;background:#64748b"></div></div>'+
        '<div style="display:flex;flex-wrap:wrap;gap:6px">'+indicadores.map(x=>'<span style="padding:4px 8px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px">'+esc(x[0])+': <b>'+x[1]+'</b></span>').join('')+'</div>'+
        '<div style="overflow:auto"><table style="width:100%;min-width:630px"><thead><tr><th>Nome</th><th>E-mail</th><th>Estado</th><th>Resend</th></tr></thead><tbody>'+
        itens.map(i=>'<tr><td>'+esc(i.nome)+'</td><td>'+esc(i.email)+'</td><td>'+esc(labels[i.situacao_observada||i.situacao]||i.situacao_observada||i.situacao)+'</td><td>'+esc(i.resend_email_id||'—')+'</td></tr>').join('')+'</tbody></table></div>'+
        '<p style="font-size:12px;margin:0;color:#64748b">Envio bloqueado. Aceitação pelo Resend não confirma entrega ou leitura.</p>';
      const validacao=dados.validacao||{};
      const executor=dados.executor||{};
      const auditoria=Array.isArray(dados.auditoria)?dados.auditoria:[];
      const resultado=root.querySelector('#homolog-lote-seguranca');
      const falhas=Array.isArray(validacao.impedimentos)?validacao.impedimentos:[];
      resultado.innerHTML='<div style="display:grid;gap:7px"><h4 style="margin:0">Verificação de segurança · somente leitura</h4>'+
        '<p style="margin:0"><b>Pré-validação:</b> '+esc(validacao.consulta_concluida?
          (falhas.length?'Requer revisão':'Sem impedimentos detectados nesta consulta'):'Não concluída')+
        ' · <b>Autorização de envio:</b> NÃO concedida · <b>Executor:</b> desabilitado</p>'+
        '<p style="margin:0;font-size:12px">Trava de execução: <b>'+esc(executor.trava_ativa===true?'ATIVA':'SEM DIAGNÓSTICO')+
        '</b> · Reivindicação permitida: NÃO · Destinatários em revisão: '+esc(Number(executor.em_revisao)||0)+
        '. A estrutura de concorrência não envia mensagens e permanece indisponível.</p>'+
        (falhas.length?'<ul style="margin:0;padding-left:22px">'+falhas.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>':'')+
        '<p style="margin:0;font-size:12px">A pré-validação não substitui autorização específica, conformidade LGPD nem idempotência do provedor.</p>'+
        '<h4 style="margin:4px 0 0">Histórico de controle</h4>'+
        (auditoria.length?'<div style="overflow-x:auto"><table style="width:100%"><thead><tr><th>Ação</th><th>Anterior</th><th>Atual</th><th>Data</th></tr></thead><tbody>'+
          auditoria.map(x=>'<tr><td>'+esc(x.acao)+'</td><td>'+esc(x.situacao_anterior)+'</td><td>'+esc(x.situacao_nova)+'</td><td>'+esc(x.ocorrido_em)+'</td></tr>').join('')+
          '</tbody></table></div>':'<p style="margin:0;font-size:12px">Nenhuma interrupção ou retomada registrada.</p>')+
        '</div>';
      const simul=dados.simulacao;
      const aviso=root.querySelector('#homolog-verificacao');
      if(simul){
        const impedimentos=(simul.inativos||0)+(simul.suprimidos||0)+(simul.bloqueados||0)+(simul.ja_processados||0);
        const elegivel=impedimentos===0 && lote.situacao==='preparado';
        aviso.textContent=elegivel?'Verificação automática: '+simul.elegiveis+' destinatários elegíveis. Envio não autorizado.':
          'Verificação automática: '+simul.elegiveis+' elegíveis; '+impedimentos+' requerem revisão. Envio não autorizado.';
        aviso.style.color=elegivel?'#166534':'#9a3412';
        root.querySelector('#homolog-lote-simulacao').innerHTML=
          '<p style="margin:0">Elegíveis: <b>'+esc(simul.elegiveis)+'</b> / '+esc(simul.total)+
          ' · Inativos: '+esc(simul.inativos)+' · Suprimidos: '+esc(simul.suprimidos)+
          ' · Bloqueados: '+esc(simul.bloqueados)+' · Já processados: '+esc(simul.ja_processados)+'</p>'+
          '<p style="margin:6px 0 0">Pré-validação de leitura, sem reservas nem envios.</p>';
      }else aviso.textContent='Verificação automática indisponível. Envio permanece bloqueado.';
      b.disabled=lote.situacao!=='preparado'||!editavel;
      c.disabled=lote.situacao!=='interrompido'||!editavel;
      d.disabled=!editavel;
      a.disabled=true;
      await consultarPermissaoDeEnvio(lote.id);
    }catch(e){
      console.error(e);
      el.textContent='Não foi possível consultar/registrar o lote: '+(e.message||e)+'. Nenhum envio solicitado.';
      // Sem reabilitar "preparar" após resultado ambíguo; consultar primeiro.
      a.disabled=true;
    }
  }
  root.innerHTML =
    '<style>'+
      '#'+containerId+' .hom-tabs{display:flex;flex-wrap:wrap;gap:8px;margin:2px 0 0}'+
      '#'+containerId+' .hom-tabs button{border:1px solid #94a3b8;background:transparent;color:inherit;border-radius:9px;padding:10px 16px;font-weight:700;cursor:pointer}'+
      '#'+containerId+' .hom-tabs button[aria-selected="true"]{background:#1f2937;color:#fff;border-color:#1f2937}'+
      '#'+containerId+' .hom-pane[hidden]{display:none!important}'+
      '#'+containerId+' #homolog-lote-mensagem-linha[hidden]{display:none!important}'+
      '#'+containerId+' #homolog-preparacao-inicial[hidden]{display:none!important}'+
      '#'+containerId+' .hom-pane{display:grid;gap:14px}'+
      '#'+containerId+' .hom-card{border:1px solid #cbd5e1;border-radius:12px;padding:16px;display:grid;gap:12px;background:rgba(255,255,255,.18)}'+
      '#'+containerId+' .hom-fold{border:1px solid #cbd5e1;border-radius:10px;padding:12px 14px}'+
      '#'+containerId+' .hom-fold summary{cursor:pointer;font-weight:700;list-style-position:inside}'+
      '#'+containerId+' .hom-fold[open] summary{margin-bottom:12px}'+
      '#'+containerId+' .hom-toolbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center}'+
      '#'+containerId+' .hom-toolbar .btn{white-space:normal}'+
      '#'+containerId+' .hom-pane h3{margin:0;font-size:17px}'+
      '@media(max-width:650px){#'+containerId+' .hom-tabs button{flex:1;min-width:130px}#'+containerId+' .hom-card{padding:11px}}'+
    '</style>'+
    '<div style="padding:18px;display:grid;gap:16px">'+
    '<div style="display:grid;gap:6px"><h2 style="margin:0">Lista de Homologação</h2><p style="margin:0;color:var(--text-muted,#64748b)">Cadastros de teste separados dos clientes oficiais. Nenhum envio autorizado.</p></div>'+
    '<div class="hom-card"><label for="homolog-campanha"><b>Campanha</b></label><select id="homolog-campanha" style="max-width:650px;padding:9px;color:#111;background:#fff"></select></div>'+
    '<nav class="hom-tabs" role="tablist" aria-label="Áreas da homologação">'+
      '<button type="button" id="homolog-tab-dest" role="tab" aria-selected="true" aria-controls="homolog-pane-dest">1 · Destinatários</button>'+
      '<button type="button" id="homolog-tab-lote" role="tab" aria-selected="false" aria-controls="homolog-pane-lote">2 · Operação do lote</button>'+
    '</nav>'+
    '<div id="homolog-pane-dest" class="hom-pane" role="tabpanel" aria-labelledby="homolog-tab-dest">'+
      '<section class="hom-card"><div><h3>Endereços da campanha</h3><p style="margin:4px 0 0;color:var(--text-muted,#64748b)">Uma pessoa pode ter vários e-mails. Gerencie os endereços aqui.</p></div>'+
      '<div id="homolog-resumo" style="font-weight:700"></div><input id="homolog-busca" placeholder="Buscar pessoa ou e-mail" aria-label="Buscar pessoa ou e-mail" style="max-width:500px;padding:9px;color:#111;background:#fff">'+
      '<div id="homolog-lista"></div></section>'+
    (editavel ? '<details class="hom-fold" id="homolog-cadastro"><summary>Adicionar pessoa ou e-mail</summary>'+
      '<form id="homolog-form-cadastro" style="display:grid;gap:12px;padding:9px 0">'+
      '<h3 id="homolog-form-titulo">Cadastrar pessoa e e-mail</h3>'+
      '<label>Pessoa já cadastrada (opcional)</label><select id="homolog-selec-pessoa" style="padding:9px;color:#111;background:#fff"></select>'+
      '<div id="homolog-nome-linha" style="display:grid;gap:6px"><label>Nome da nova pessoa</label><input id="homolog-nome" maxlength="180" style="padding:9px;color:#111;background:#fff"></div>'+
      '<div id="homolog-email-linha" style="display:grid;gap:6px"><label>E-mail</label><input id="homolog-email" type="email" maxlength="254" required style="padding:9px;color:#111;background:#fff"></div>'+
      '<label id="homolog-principal-linha"><input id="homolog-principal" type="checkbox"> E-mail principal</label>'+
      '<div class="hom-toolbar"><button type="submit" id="homolog-salvar-cadastro" class="btn rust">Salvar cadastro</button><button type="button" id="homolog-cancelar-cadastro" class="btn">Cancelar</button><button type="button" id="homolog-excluir-pessoa" class="btn" disabled>Excluir pessoa sem vínculos</button></div>'+
      '</form></details>' : '')+
    '</div>'+
    '<div id="homolog-pane-lote" class="hom-pane" role="tabpanel" aria-labelledby="homolog-tab-lote" hidden>'+
    '<section class="hom-card" aria-label="Preparação de envio em lote">'+
      '<div><h3>Operação do lote</h3><p style="margin:5px 0 0;color:var(--text-muted,#64748b)">Acompanhamento da campanha selecionada. Envio ainda não autorizado.</p></div>'+
      '<div id="homolog-lote-mensagem-linha" style="display:grid;gap:6px"><label for="homolog-lote-mensagem"><b>Mensagem</b></label><select id="homolog-lote-mensagem" style="max-width:650px;padding:9px;color:#111;background:#fff"></select></div>'+
      '<p id="homolog-lote-mensagem-unica" hidden style="margin:0;color:var(--text-muted,#64748b)"></p>'+
      '<p id="homolog-verificacao" role="status" aria-live="polite" style="margin:0;font-size:13px">Verificando destinatários automaticamente...</p>'+
      '<div id="homolog-lote-operacao" role="status" aria-live="polite">Consultando lote...</div>'+
      '<details class="hom-fold" id="homolog-detalhes-tecnicos"><summary>Ações Finais de Envio de Mensagens</summary><div style="display:grid;gap:14px;margin-top:12px">'+
        '<p style="margin:0;font-size:12px;color:var(--text-muted,#64748b)">Confira os destinatários acima antes de autorizar qualquer operação. O envio permanece bloqueado.</p>'+
        '<div class="hom-toolbar"><button type="button" class="btn" id="homolog-lote-atualizar">Atualizar consulta</button>'+
        '<button type="button" class="btn rust" id="homolog-lote-enviar" disabled title="Aguardando autorização específica do lote">Enviar mensagens</button>'+
        '<button type="button" class="btn" id="homolog-lote-interromper" disabled>Interromper</button><button type="button" class="btn" id="homolog-lote-retomar" disabled>Retomar</button></div>'+
        '<p id="homolog-lote-estado-envio" role="status" aria-live="polite" style="font-size:12px;margin:0;color:var(--text-muted,#64748b)">Envio bloqueado: aguardando autorização específica do lote.</p>'+
        '<details class="hom-fold" id="homolog-preparacao-inicial" hidden><summary>Preparação inicial (sem envio)</summary><p style="font-size:12px">Disponível apenas para campanhas sem lote. Registra destinatários sem enviar mensagens.</p><button type="button" class="btn" id="homolog-lote-preparar" disabled>Preparar lote</button></details>'+
        '<button type="button" id="homolog-lote-simular" hidden disabled aria-hidden="true">Verificação automática</button>'+
        '<div id="homolog-lote-simulacao" role="status" aria-live="polite"></div>'+
        '<div id="homolog-lote-seguranca" aria-live="polite"></div>'+
      '</div></details>'+
      '<p style="margin:0;font-size:12px">Modo Oficial bloqueado. A lista congelada de clientes e o Pipeline B2C não são consultados nesta preparação.</p>'+
    '</section></div>'+
    '<p id="homolog-msg" role="status" aria-live="polite" style="display:none;padding:12px;border:1px solid #64748b;border-radius:8px"></p>'+
    '<p style="font-size:12px;color:var(--text-muted,#64748b)">Somente a equipe autorizada pode acessar estes registros. Não é a lista oficial de transmissão e não altera a quantidade de leads.</p>'+
    '</div>';
  // Navegação local: formulários e consultas mantêm seus IDs e handlers originais.
  function selecionarArea(area) {
    const op=area==='lote';
    root.querySelector('#homolog-pane-dest').hidden=op;
    root.querySelector('#homolog-pane-lote').hidden=!op;
    root.querySelector('#homolog-tab-dest').setAttribute('aria-selected',String(!op));
    root.querySelector('#homolog-tab-lote').setAttribute('aria-selected',String(op));
  }
  root.querySelector('#homolog-tab-dest').addEventListener('click',()=>selecionarArea('dest'));
  root.querySelector('#homolog-tab-lote').addEventListener('click',()=>selecionarArea('lote'));
  root.querySelector('#homolog-campanha').addEventListener('change', async e=>{campanhaId=e.target.value;limparForm();await atualizar();await carregarMensagensLote();});
  root.querySelector('#homolog-lote-mensagem').addEventListener('change',()=>{if(root.querySelector('#homolog-lote-mensagem').value)acionarLote('status');else root.querySelector('#homolog-lote-operacao').textContent='Selecione uma mensagem.';});
  root.querySelector('#homolog-lote-preparar').addEventListener('click',()=>acionarLote('preparar'));
  root.querySelector('#homolog-lote-interromper').addEventListener('click',()=>acionarLote('interromper'));
  root.querySelector('#homolog-lote-retomar').addEventListener('click',()=>acionarLote('retomar'));
  root.querySelector('#homolog-lote-simular').addEventListener('click',()=>acionarLote('simular'));
  root.querySelector('#homolog-lote-enviar').addEventListener('click',enviarHomologacaoConfirmada);
  root.querySelector('#homolog-lote-atualizar').addEventListener('click',async()=>{await atualizar();await carregarMensagensLote();});
  root.querySelector('#homolog-busca').addEventListener('input',desenhar);
  root.addEventListener('click',acaoTabela);
  if(editavel) {
    root.querySelector('#homolog-form-cadastro').addEventListener('submit',salvarCadastro);
    root.querySelector('#homolog-selec-pessoa').addEventListener('change',trocarPessoa);
    root.querySelector('#homolog-cancelar-cadastro').addEventListener('click',limparForm);
    root.querySelector('#homolog-excluir-pessoa').addEventListener('click',excluirPessoaSemVinculos);
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

# Checkpoint — Enviar Teste no Preparar Envio de Campanhas

**Data:** 09/11/2026
**Branch:** `preview/campanha-mensagens` (não publicar em `main` sem homologação)
**Commit funcional:** `8aa97cc4941f3210d942112c70b5c766e9d87a19`
**Preview READY:** https://ciclo-da-arte-igy2sh1p5-eduardocarloscardosos-projects.vercel.app

## Implementação
- Botão **Enviar Teste** ao lado de **Visualizar Mensagem** em Campanhas → Preparar Envio, visível somente para perfis com edição (`editavel`).
- O botão fica desabilitado sem mensagem selecionada.
- Reutiliza `cdaMsgPerguntarEEnviarTeste()` da Biblioteca de Mensagens, sem criar outro provedor de envio nem outra função backend.
- O fluxo da Biblioteca abre janela com remetente e Responder para, exige confirmação explícita dos destinatários e aceita no máximo 3 endereços de teste. Cancelar não envia.
- Reutiliza a função Supabase Edge `enviar-email-teste` existente (`verify_jwt=true`, membros da equipe autenticados), com provedor Resend, remetente validado no domínio e prefixo `[TESTE]` no assunto. A Edge Function registra `ultimo_teste_em` e `ultimo_teste_para` na mensagem.
- Conteúdo da mensagem é montado pelo mesmo `cdaMontarEmailMensagem()` da Biblioteca, utilizando **dados fictícios** (`Cliente de Teste`, São Paulo/SP) para personalização de teste, nunca os dados reais da lista congelada.
- **Envio em massa permanece desabilitado.** Nenhum e-mail foi disparado por esta implementação.
- Supabase verificado: lista Luedji Luna 861; válidos 853; 1 mensagem vinculada.
- O envio real de teste e a entrega dependem de confirmação manual do usuário e das credenciais de Resend no Supabase; ainda não homologados.
- Mudança no Preview apenas; Supabase backend existente não foi alterado; nenhum dado de cliente ou destinatário foi alterado.

## Teste de homologação
1. Abrir Preview → Comercial → Campanhas → Luedji Luna · São Paulo → Preparar Envio.
2. Escolher a mensagem Convite com cupom LUEDJI20.
3. Clicar Enviar Teste, conferir remetente e preencher somente o endereço pessoal para teste.
4. Confirmar; verificar feedback e caixa postal. Não usar e-mails de clientes para homologação.

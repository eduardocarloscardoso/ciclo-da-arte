# Checkpoint — Ativação Resend por API e segredo protegido no Vault (09/11/2026)

Projeto: Ciclo da Arte CRM/ERP
Branch: `preview/campanha-mensagens` — não houve merge em `main`.
Commit do Preview: `3ea275d16961a3cae598468de5265c240de876f2`
Vercel READY: https://ciclo-da-arte-7nsufw82e-eduardocarloscardosos-projects.vercel.app
Supabase comum à produção: `gsizoiwefejsllgtsard`.

## Objetivo e mecanismo
- Resend permite criar webhook por API `POST /webhooks` com eventos, devolvendo `signing_secret`.
- Migração `cda_resend_webhook_vault_secret_service_only` adicionou duas funções RPC protegidas, `cda_resend_webhook_secret_salvar` e `cda_resend_webhook_secret_ler`, EXECUTE exclusivamente por `service_role`. O segredo é armazenado criptografado no Supabase Vault sob o nome `cda_resend_webhook_preview`.
- Edge Function **`configurar-webhook-resend-preview`**, `verify_jwt=true`, valida sessão do usuário no Supabase Auth e permissão de administrador por `equipe.is_admin`; usa `RESEND_API_KEY` existente somente no servidor. Consulta webhooks existentes, evita duplicidade e, se não encontrar o endpoint específico, cadastra os quatro eventos `email.delivered`, `email.bounced`, `email.delivery_delayed`, `email.complained` para `https://gsizoiwefejsllgtsard.supabase.co/functions/v1/resend-eventos-preview`. Obtém signing secret e grava no Vault, nunca retorna segredo ao browser. Se a chave não tiver permissão de gestão de webhooks, explica o erro sem modificar o envio homologado.
- Edge Function receptora `resend-eventos-preview` versão 2 agora consegue obter segredo do Vault em vez de depender somente da variável manual `RESEND_WEBHOOK_SECRET`; verifica assinatura HMAC-SHA256 antes de gravar qualquer evento. Mantém fallback ao segredo de ambiente já existente.
- No **Pipeline B2C → Comunicações da Campanha** foi acrescentado botão **Ativar eventos Resend**, que requer confirmação, chama o serviço apenas com JWT autenticado e mostra retorno de ativação ou de erro. O botão não envia e-mails.
- A função original de teste de e-mail, os destinatários congelados e o botão de envio em massa permaneceram inalterados.

## Verificações
- JS do Pipeline analisado sintaticamente.
- Supabase: RPC `salvar` e `ler` não são executáveis por `authenticated`; são executáveis por `service_role`.
- Setup e receptor ativos; Vercel READY.
- `vault.secrets` ainda possui **0** segredos `cda_resend_webhook_preview` e `cda_email_eventos` ainda possui **0** eventos no momento do checkpoint. **Logo, NÃO declarar webhook já cadastrado/ativo no Resend.**
- O botão necessita ser acionado por administrador logado para fazer o cadastro real via API. O usuário deverá confirmar resultado e fazer novo teste, depois Atualizar histórico.

## Nota operacional
- A chave `RESEND_API_KEY` pode estar configurada apenas com permissão para enviar e-mails; caso não possa gerir webhooks, a interface informa e é necessário ajustar permissões no Resend.
- Evitar registrar ou revelar em conversa, logs de frontend ou commit os segredos RESEND_API_KEY e signing secret `whsec_...`.
- O estado READY na Vercel confirma deploy, não prova invocação bem-sucedida da função de ativação nem recebimento efetivo de webhook.

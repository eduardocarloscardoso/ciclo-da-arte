# Checkpoint — Rastreamento por destinatário, testes controlados

Data: 10/11/2026. Repo `eduardocarloscardoso/ciclo-da-arte`, branch `preview/campanha-mensagens`. Sem merge em main.

## Decisão do usuário
- Manter 853 leads atuais da campanha Luedji Luna · São Paulo, não gerar lead duplicado a cada envio.
- Cada comunicação gera histórico técnico de tentativa, aceite pelo Resend e eventos subsequentes sem alterar automaticamente o estágio comercial.
- Não iniciar envio oficial antes de homologar com alguns endereços internos da equipe.

## Implementação
- View `public.cda_rastreio_email_por_destinatario` (security_invoker=true): expande destinatários das tentativas existentes e consulta último evento, entregue, devolvido, reclamação, com acesso RLS das tabelas base. Eventos de tentativas com mais de um endereço não são indevidamente atribuídos como entrega individual; UI indica evento coletivo.
- Pipeline B2C → Tabela operacional: colunas `E-mail / Resend` e `Data do envio`, com status `Aguardando envio` quando não há tentativa; não altera etapa comercial.
- Pipeline B2C → `Abrir` um lead → aba `E-mails / Resend`: consulta registros deste endereço e campanha e botão `Atualizar e-mails`.
- Teste de e-mail pelo front (`cdaEnviarTesteMensagem`) permanece limitado a 1 a 3 destinatários explicitamente informados, mas chama o endpoint existente em uma tentativa SEPARADA para cada destinatário. Isso produz ID Resend individual e evento correspondente; erro após um teste anterior avisa para verificar histórico antes de repetir.
- O endpoint `enviar-email-teste-historico-preview` e webhook `resend-eventos-preview` foram mantidos sem modificações. Ambos já suportam esse fluxo. O webhook continua restrito aos IDs Resend conhecidos.
- Não foi criado serviço de disparo em massa, nem botão para envio oficial, nem movimentação de leads.

## Validação
- JS sintaticamente válido. Vercel READY: https://ciclo-da-arte-28dm6qk09-eduardocarloscardosos-projects.vercel.app
- Commits `2d6ba0524daa310a06f93e696c707ad963e89245` (Pipeline), `31f1417045397a2c7226435ae735c9af94e9a218` (testes individualizados), `0a12cde8acd52ee2784a863513638056dd0643d4` (cache).
- Supabase: 853 leads Luedji, 2 testes anteriores, 0 oficiais e 2 linhas de rastreio (ambos os testes já realizados para a caixa interna). Um desses testes tem evento `email.delivered` confirmado.
- Não houve envio de novos e-mails nesta etapa. Homologação visual do usuário pendente.

## Próximas validações
1. Pipeline → campanha Luedji → nova coluna `E-mail / Resend`: os 853 deverão mostrar `Aguardando envio` (salvo eventual correspondência de teste com cliente). Em `Abrir` → `E-mails / Resend`, situação individual vazia se não houve tentativa.
2. `Comunicações da Campanha`: verificar duas tentativas anteriores.
3. Biblioteca → Mensagem `Convite com cupom LUEDJI20` → Salvar e enviar teste → informar de 1 a 3 endereços internos; confirmá-los manualmente e conferir entrega no Resend/consulta Pipeline. Não iniciar envios oficiais.
4. Depois de homologação, planejar serviço de envio individual auditável com bloqueio de duplicatas, política de supressão/descadastramento e autorização final de campanha.

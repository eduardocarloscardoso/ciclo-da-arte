# Checkpoint — Eventos Resend com webhook assinado (estrutura, 09/11/2026)

Projeto: Ciclo da Arte CRM/ERP. Repo `eduardocarloscardoso/ciclo-da-arte`, branch `preview/campanha-mensagens`.
Commit funcional `78e6e8d68f9e9ed559fed55c7e61acc726c0b88f`.
Vercel Preview READY: https://ciclo-da-arte-q1jkv22z9-eduardocarloscardosos-projects.vercel.app
Supabase compartilhado com produção `gsizoiwefejsllgtsard`.

## Implementado
- Migração `cda_email_eventos_resend_assinados_preview`: tabela `public.cda_email_eventos` (tentativa_id, svix_id único, resend_email_id, tipo, ocorrido_em, recebido_em); RLS de leitura somente para equipe e sem INSERT/UPDATE/DELETE para browser autenticado.
- Edge Function separada `resend-eventos-preview`, ACTIVE com `verify_jwt=false` somente porque o Resend não envia JWT do Supabase. A função exige assinatura HMAC-SHA256 válida nos cabeçalhos `svix-id`, `svix-timestamp`, `svix-signature`, timestamp dentro de 5 minutos e segredo de ambiente `RESEND_WEBHOOK_SECRET`. **Sem o segredo, retorna 503 e não grava nada.**
- Registra somente eventos assinados `email.delivered`, `email.bounced`, `email.delivery_delayed`, `email.complained` associados a `resend_email_id` de tentativas de teste existentes; ignora outros identificadores. Deduplicação por `svix_id`. Não interfere no envio nem nas listas.
- Pipeline B2C → Comunicações da Campanha: passa a consultar `cda_email_eventos` e apresentar eventos por tentativa, contadores de entregas, devoluções, reclamações e data de cada evento. Antes de receber eventos, mostra 'Sem evento recebido'; texto deixa claro que zero eventos não prova ausência de entregas enquanto não estiver configurado.
- Campanhas → Resultados: resumo apenas de consulta, com entregas/devoluções notificadas, sem duplicar a tabela detalhada do Pipeline.
- Não foi alterada a função de envio de teste de produção nem liberado envio em massa.

## Ativação pendente — usuário no Resend e Supabase
1. No Resend, configurar um webhook para URL `https://gsizoiwefejsllgtsard.supabase.co/functions/v1/resend-eventos-preview` com tipos `email.delivered`, `email.bounced`, `email.delivery_delayed`, `email.complained`.
2. Copiar segredo de assinatura do webhook (`whsec_...`) **sem colocá-lo em frontend, GitHub ou conversa**.
3. Inserir no Supabase Edge Function Secrets a variável **`RESEND_WEBHOOK_SECRET`** com esse segredo.
4. Somente depois, enviar novo e-mail de teste para o próprio endereço, aguardar evento e validar em Pipeline → Comunicações → Atualizar histórico.
5. Opcional: usar função de teste de webhook no Resend após configurar; não inventar eventos retroativos.

## Verificação
- Migration aplicada; Edge Function status ACTIVE, assinatura exigida no código, mas endpoint ainda não confirmado como conectado ao Resend (segredo e cadastro dependem de configuração do usuário).
- JavaScript dos dois módulos válido; Vercel Preview READY.
- Supabase: 1 tentativa prévia, 0 eventos recebidos, 861 destinatários congelados na campanha Luedji Luna; authenticated tem SELECT e não tem INSERT em cda_email_eventos.
- **Não homologado:** envio de webhook real e verificação ponta a ponta. **Não há garantia de entrega derivada de pedido aceito pelo Resend.**
- Atenção: se webhook chega antes do ID Resend ser gravado na tentativa, evento sem correspondência é ignorado. Avaliar retentativa/conciliador antes de uso em produção ampla.

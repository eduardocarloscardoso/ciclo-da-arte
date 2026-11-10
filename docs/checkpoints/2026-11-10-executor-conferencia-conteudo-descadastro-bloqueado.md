# CHECKPOINT — EXECUTOR FASE 1.1 — PRÉ-VOO DE CONTEÚDO E DESCADASTRAMENTO
Data: 10/11/2026. Branch de Preview: `preview/campanha-mensagens`.
Commit funcional: `20083afc8a6abefb99659883a0b3d9f9c56598e2`.
Preview READY funcional: `https://ciclo-da-arte-3u0821nta-eduardocarloscardosos-projects.vercel.app`.
Edge Function `cda-executor-homologacao-preview` versão 3, ACTIVE.

## Feito
- Adicionada ação `conferir_conteudo` ao executor de diagnóstico. É read-only, exige JWT real e membro da equipe, e só trabalha com `cda_envio_lotes.modo=homologacao`.
- O servidor consulta diretamente a mensagem da campanha, o snapshot de destinatários, a lista viva de homologação e supressões, sem confiar em payload de e-mail enviado pelo cliente.
- Valida assunto, remetente do domínio autorizado, reply-to, corpo, link HTTPS, destinatários ativos, estado e chave de idempotência.
- Identificado bloqueio de conformidade: o montador existente em `cda-dados-compartilhados.js` usa `#descadastrar` como fallback; NÃO há mecanismo de descadastramento individual implementado no executor. A ação de diagnóstico informa `descadastro_funcional=false`, `pronto_para_envio=false`, `envio_habilitado=false` e o bloqueio correspondente.
- Mantida ação `enviar` como HTTP 423 `EXECUTOR_BLOQUEADO` incondicional. **Nenhum** código Resend foi acrescentado, e nenhuma API de envio é chamada.

## Verificações
- Mensagem 1 da campanha 4: assunto Show Luedji Luna · Cine Joia SP; remetente `noreply@send.ciclodaarte.com.br`; link Shotgun HTTPS confirmado; corpo presente.
- Lote #1: 5 itens, 5 pendentes, 0 tentativas, 0 IDs Resend.
- Diário de idempotência: 5 chaves distintas, 0 operações, 0 indeterminados, autorizado false, envio habilitado false.
- Diff: somente `supabase/functions/cda-executor-homologacao-preview/index.ts`; nenhuma mudança de frontend, DB ou tabelas nesta etapa.
- Vercel READY após commit. `main` e produção preservadas.
- A ação de conferência não foi invocada com JWT de usuário real; ainda falta teste autenticado via aplicativo. Validação SQL de dados e status da Edge Function foram feitas.

## Próximas etapas
1. Definir descadastramento funcional, assinado por destinatário e campanha, e registrar supressão no Supabase; validar LGPD e evitar token na interface pública antes de fluxo pronto.
2. Montar HTML/texto no servidor com equivalência ao preview de `cdaMontarEmailCampanha`, inserir descadastro real e conferir conteúdo exato.
3. Persistir snapshot imutável de payload/hash e implementar envio individual com `Idempotency-Key` estável, limites de taxa e tratamento de timeout indeterminado. A garantia do Resend é limitada a 24 horas: https://resend.com/changelog/idempotency-keys .
4. Revisar autorização específica e auditar resultados do webhook.
5. Só habilitar após autorização expressa; não enviar aos 5 testes nem aos 867 clientes oficiais sem autorização.

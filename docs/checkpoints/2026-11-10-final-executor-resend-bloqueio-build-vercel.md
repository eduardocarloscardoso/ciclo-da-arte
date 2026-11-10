# CHECKPOINT — FINALIZAÇÃO DO EXECUTOR DE HOMOLOGAÇÃO RESEND (SEM ENVIO)
Data: 10/11/2026 | Branch: `preview/campanha-mensagens`
Últimos commits funcionais:
- `8e08048a998817a53b1486869194a491fdfbf63e`: aprovação de lote expirável, restrita a service_role e vinculada a fingerprint.
- `d5ddc5c658362222b85b7fdfa494427fe903459a`: reserva e marcação exigem aprovação válida em cada transação.
- `e23ddf2dfddacada16106c2783e7869e2ec9d82a`: envelope individual montado no servidor a partir de campanha, mensagem e itens do banco.
- `b6aebddc2fe0d220493b45150f98ace0fbbfd331`: ação `enviar` real, limitada a um item, só após autorização de lote e validação do mesmo usuário JWT aprovador.
- `920839348d2684c717c141ab9ec8e4ebfd2a2db7`: diagnóstico mostra autorização dinâmica.
- `8a23409960ebba2064eed708c2a6d1de73707d01`: botão da UI condicionado a autorização válida, confirmação humana no clique e envio sequencial (até 5), interrompendo em qualquer falha/incerteza.
- `d0fb533ef136b24a39e35c5dd4090161703956f7`: interrupção revoga aprovação.
- `c3c60c2eb4555f3e069acafdc0cf20a1852f5358`: cache-busting do script.
- `082d1e71df74069763e09da3dce38571bc07cae4`: workflow de validação de sintaxe e testes Node com mocks, sem envio.

## O que está pronto
- Caminho individual `acionarLote/enviar -> cda-executor-homologacao-preview -> envelope banco -> store transacional -> adapter Resend`, condicionado a autorização.
- Aprovação futura exige transação de serviço, autorização pessoal, manifesto SHA-256, validade de 30 minutos e no máximo 5 endereços. **Não foi concedida.**
- Um item por request, chave de idempotência estável, journal antes da requisição, sem retry de timeout/indeterminado.
- Remetente e reply-to obtidos da mensagem salva, personalização e HTML/texto do montador homologado.
- API de envio não aceita payload nem e-mail fornecido pelo frontend.
- Webhook Resend recebe eventos com assinatura, vincula à tentativa/operação somente após verificar ID.
- Revogação no interromper impede reutilizar autorização após retomada.

## Testes efetivamente executados
- Supabase Edge Function `cda-executor-homologacao-preview` v12 ACTIVE com 5 arquivos.
- Banco: teste de reserva e marcação sem aprovação negou corretamente, sem novas tentativas.
- Banco: teste positivo de **aprovação + reserva + marcação** executado dentro de subtransação PL/pgSQL com exceção deliberada de rollback, **sem HTTP/Resend**, confirmou funcionamento das RPCs; depois auditou que tudo foi revertido.
- Lote #1: 5 pendentes, 5 chaves únicas, 0 operações e 0 tentativas de lote, 0 IDs Resend, 0 aprovações, controle desabilitado.
- `cda_email_tentativas` tem 6 registros de testes históricos anteriores, não pertencentes ao lote.
- UI JavaScript e testes Node versionados. Execução do CI Node não confirmada; sem homologação visual nem teste HTTP com JWT real.

## BLOQUEIO EXTERNO ATUAL DE RELEASE
- Vercel informou status `failure` por **build-rate-limit**, URL do provedor: `https://vercel.com/eduardocarloscardosos-projects?upgradeToPro=build-rate-limit`.
- Último deployment efetivamente READY da branch é o commit `d5ddc5c658362222b85b7fdfa494427fe903459a`, anterior ao frontend novo.
- Portanto o código do frontend atual existe no GitHub mas **ainda não está disponível no Preview**; não afirmar homologação final.
- A Edge Function do Supabase foi implantada independentemente e está ACTIVE.
- Não promover `main`, não alterar produção Vercel, não enviar e-mail sem aprovação expressa.

## Próximos critérios objetivos (não criar novos módulos)
1. Quando a Vercel permitir build, verificar último commit da branch Preview READY e executar validação visual do novo botão bloqueado.
2. Confirmar sintaxe/testes Node (workflow ou execução local) e invocação do diagnóstico com JWT real da equipe.
3. Só após testes e decisão explícita do usuário, registrar aprovação do lote exato por service_role usando fingerprint atual e UUID do próprio usuário logado. Em seguida, o usuário deve confirmar manualmente o clique de envio.
4. Nunca disparar aos 867 leads oficiais nesta etapa.

# CHECKPOINT — ORQUESTRADOR INTEGRADO EM SIMULAÇÃO + RESUMO DE HOMOLOGAÇÃO
Data: 10/11/2026. Branch: `preview/campanha-mensagens`. Base anterior: `58891d7872a06b6eabfb87ab70037c01763bc22c`.
Último commit funcional: `3c21a8c13883f59d464126c0a705537d49c99586`.

## Implementado
1. `supabase/functions/cda-executor-homologacao-preview/executor-transacional.mjs`: orquestra **um destinatário por vez**, sem loops/retries. Valida envelope e SHA-256 do JSON, exige permissão consultada por injeção no servidor, usa reserva atômica e marcação de solicitação antes de transmitir, registra resultado ou retorna revisão manual em caso de falha pós-HTTP. `resend-adapter.mjs` é sua dependência.
2. `tests/executor-transacional.test.mjs`: seis testes isolados com mocks para bloqueio, hash modificado, falha de marcação, aceite, timeout e falha de escrituração. Testes versionados, **ainda não executados em runtime Node neste turno**, por indisponibilidade de checkout autenticado no contêiner.
3. Edge Function `cda-executor-homologacao-preview` implantada ACTIVE v9 contendo arquivos `index.ts`, `executor-transacional.mjs` e `resend-adapter.mjs`; rota `simular_orquestracao` usa mensagem sintética `nao-enviar@example.invalid`, adaptadores de gravação/transmissão proibitivos e autorização sempre falsa. A rota real `enviar` segue retornando HTTP 423 **antes** de qualquer seleção de banco/envio. Nunca consulta chave Resend no executor ativo.
4. Migration `20261110_resumo_preenvio_homologacao_somente_leitura.sql` aplicada ao Supabase compartilhado: RPC `cda_resumo_preenvio_homologacao` somente service_role, sem DML, apresenta campanha, mensagem, cinco destinatários e estado de autorização. Resumo incluído na ação diagnóstica do executor.
5. Nenhuma modificação de interface; `main` e produção Vercel não alteradas; clientes oficiais não tocados.

## Verificação
- RPC resumo retornou campanha 4 Luedji Luna · São Paulo, mensagem 1 Convite com cupom LUEDJI20, cinco endereços de homologação, autorização false e envio false.
- RLS: anon/authenticated sem privilégio EXECUTE para RPC resumo, service_role com privilégio.
- Auditoria lote #1: 5 pendentes, 5 chaves únicas, 0 operações, 0 tentativas, 0 IDs Resend, envio não habilitado.
- Controle: 0 autorizações e 0 habilitações.
- GitHub diff desde base: somente arquivos Edge Function, teste e migration; status ACTIVE v9 confirmado.
- **Não foi possível exercitar a Edge Function com um JWT de usuário real, nem executar teste end-to-end/mocks versionados em ambiente Node neste turno**. O deployment ACTIVE não equivale à homologação runtime completa.
- `enviar` bloqueado por HTTP 423; banco mantém CHECKs habilitado=false e autorizacao nula; nenhuma mensagem foi solicitada ao Resend.

## Trabalho restante
- Testar cenário sintético autenticado e conferir payload real com JWT da equipe, sem enviar.
- Consolidar mecanismos de autorização auditável exclusivamente para lote de homologação e seu snapshot, incluindo confirmação explícita do usuário; **não retirar CHECKs nem habilitar envio antes dessa autorização**.
- Finalizar ligação do adaptador à rota real somente quando fluxos e testes passarem e houver autorização expressa para o primeiro lote.
- Backlog de descadastramento da campanha oficial, fora do caminho crítico do envio interno conforme decisões anteriores.

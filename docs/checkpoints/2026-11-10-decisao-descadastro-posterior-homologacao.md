# CORREÇÃO DE PRIORIDADE — DESCADASTRAMENTO × CAMPANHA LUEDJI20
Data: 10/11/2026. Referência: decisões do usuário de 09/11 e 10/11/2026, recuperadas do histórico; checkpoint consolidado `2026-11-10-checkpoint-consolidado-crud-homologacao-integracoes.md`.

## Regra operacional confirmada
- Para o primeiro lote de **homologação interna** da campanha 4/mensagem 1, com 5 endereços previamente definidos, **não priorizar a implementação do descadastramento**. Prioridade: motor seguro de envio individual, rastreabilidade, prevenção de duplicidades, confirmação e testes Resend.
- Descadastramento específico fica no backlog; antes da campanha comercial oficial, revisar base legal, informação ao titular, supressões, mecanismo de oposição/descadastramento e conformidade aplicável. Não tratar o aceite/opt-in como automaticamente comprovado.
- A verificação de destinatários ativos e lista de supressão **permanece obrigatória**.
- Nenhum envio a cinco testes sem autorização expressa do usuário; 867 destinatários oficiais fora de escopo, nenhum envio.
- Main e produção Vercel não alteradas.

## Correção técnica
- No `supabase/functions/cda-executor-homologacao-preview/index.ts` removido apenas o impedimento obrigatório `Descadastramento individual ainda não implementado no executor` do pré-voo de homologação.
- Mantidos `descadastro_funcional:false`, `pronto_para_envio:false` e `envio_habilitado:false` no resultado; `enviar` continua 423 `EXECUTOR_BLOQUEADO`.
- Adicionado campo de diagnóstico `conteudo_conferido_sem_descadastro`, sem conceder autorização.
- A Edge Function foi implantada na versão 4 (ACTIVE). Nenhum envio realizado nesta correção.
- Commit funcional: `aecfe9ee799a05b0ba5127c2c3574777566ba54a`.

## Próximos passos
Implementar montagem definitiva no servidor, vínculo de tentativa individual e respostas Resend, mantendo idempotência, pré-voo, limite de concorrência e interrupção/retomada. Rever descadastramento antes de disparo comercial oficial, não como precondição artificial de homologação interna.

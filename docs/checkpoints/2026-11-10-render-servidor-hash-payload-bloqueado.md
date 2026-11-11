# CHECKPOINT — RENDERIZAÇÃO SERVIDOR E HASH DO PAYLOAD SEM ENVIO
Data: 10/11/2026. Branch exclusiva: `preview/campanha-mensagens`.
Commit funcional: `a85b2cc53e60f433c4df8e41e16d924c23a359b9`.

## Alteração implementada
- `supabase/functions/cda-executor-homologacao-preview/index.ts`: ação autenticada `conferir_payload`, restrita a membro de equipe, com `verify_jwt=true`.
- Reutiliza diretamente as implementações homologadas `cdaPrimeiroNome`, `cdaUfDe`, `cdaVariaveisEmail`, `cdaLinkComUtm` e `cdaMontarEmailCampanha` copiadas fielmente de `cda-dados-compartilhados.js` (SHA de origem `fde47343a34d53e372e6a963707770d056f31135`).
- Consulta `cda_envio_lotes`, a mensagem e a campanha, o snapshot dos itens, destinatários ativos, supressões e operações anteriores diretamente via banco (service_role apenas dentro da Edge Function).
- Para cada item elegível, monta o par HTML/texto incluindo saudação individual e UTM, o futuro JSON Resend com `from`, `to`, `subject` prefixado `[TESTE]`, `html`, `text`, `reply_to` e tags; calcula o SHA-256 do JSON em memória.
- Retorna ao operador autenticado **somente** identificador de item, hash, tamanho HTML/texto e indicadores de conteúdo. Não retorna HTML nem texto completo no endpoint, não grava payload, não cria operações e não solicita envio.
- Ação `enviar` continua rejeitada com HTTP 423 `EXECUTOR_BLOQUEADO`, sem código para chamar `api.resend.com` e sem acesso ao segredo Resend. UI mantém botão desabilitado.
- Descadastramento não é prioridade dos testes internos; permanece no backlog antes de envio oficial conforme decisão de 09–10/11. O template atual ainda inclui `#descadastrar` provisório; não confundir montagem com liberação de envio comercial.

## Validações realizadas
- Edge Function `cda-executor-homologacao-preview` implantada em versão 7, status ACTIVE. Consulta de código confirmou expressão regular corrigida, rota enviar bloqueada, autenticação e ausência de chamada ao Resend.
- `cda_auditar_integridade_lote(1)`: 5 destinatários, 5 pendentes, 5 chaves distintas, 0 operações, 0 tentativas, 0 Resend IDs, envio desabilitado.
- Controle: 0 habilitações, 0 autorizações.
- Diff em relação ao checkpoint anterior: apenas a Edge Function, nenhuma alteração frontend ou banco.
- **Limitação**: a nova ação `conferir_payload` ainda não foi executada com JWT de usuário real, nem comparada bit a bit com renderização em navegador. O cálculo efetivo de hashes dos cinco itens ainda depende desse teste. Não declarar homologação end-to-end. Nenhum envio realizado.

## Próxima fase
- Exercitar o endpoint autenticado com dados reais de homologação sem gravar nem enviar; conferir os cinco hashes e correspondência ao HTML/texto aprovados.
- Projetar/implementar transação que reserve item, relacione tentativa individual, diário e hash exato do payload antes de invocar provedor, garantindo zero reenvio automático de `indeterminado`.
- Integrar respostas, estado e eventos webhook com controle de taxa, autorização específica e bloqueios físicos mantidos até autorização expressa.
- Não alterar main/produção, não enviar aos cinco testes nem aos 867 oficiais sem autorização explícita.

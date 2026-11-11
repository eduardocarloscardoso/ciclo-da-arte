# CHECKPOINT — OPERAÇÃO DO LOTE SIMPLIFICADA COM VALIDAÇÃO AUTOMÁTICA
Data: 10/11/2026. Branch: `preview/campanha-mensagens`.
Commit funcional: `16edab19361229cd2fd352e665ffbfe6fae667b0`.
Preview funcional READY: `https://ciclo-da-arte-dmf0ydidd-eduardocarloscardosos-projects.vercel.app`.

## Organização
- Uma ação principal: **Enviar mensagens — aguardando autorização** (botão desabilitado).
- Entrada na tela automaticamente consulta o lote; Edge Function v6 executa a simulação SQL somente leitura em ações `status`, `validar` e `simular`. O diagnóstico resumo é exibido automaticamente, sem clique em Atualizar ou Simular.
- Tabela de destinatários congelados mantida, com estados por Resend.
- As funções Atualizar, Rever simulação, Preparar, Interromper e Retomar foram movidas para um único painel **Detalhes técnicos e auditoria**, onde constam resultados de simulação e histórico.
- Campanha e mensagem são preservadas; em campanha com mensagem única esta é apresentada como descrição.
- A autorização e a execução continuam incondicionalmente bloqueadas, inclusive na função e no banco.

## Integridade e escopo
- Apenas `cda-modulo-homologacao.js`, `index.html` e `supabase/functions/cda-lote-homologacao-preview/index.ts` modificados. Nenhuma migration ou alteração de registros.
- Lote #1: preparado, 5 destinatários pendentes, 0 tentativas vinculadas. Nenhum envio realizado.
- `main`, produção, lista oficial e módulos financeiros não alterados.
- A validação visual do usuário ainda é necessária.

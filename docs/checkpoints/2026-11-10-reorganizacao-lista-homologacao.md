# CHECKPOINT — REORGANIZAÇÃO VISUAL DA LISTA DE HOMOLOGAÇÃO
Data: 10/11/2026. Branch: `preview/campanha-mensagens`.
Commit funcional: `cd0beb3f84ffe98347cf982a7bb22f3fe6d49f48`.
Preview READY: `https://ciclo-da-arte-rdagt6mf4-eduardocarloscardosos-projects.vercel.app`.

## Alteração solicitada
A página original tinha múltiplas tabelas e formulários simultaneamente, dificultando a navegação.

## Nova organização
- Cabeçalho conciso + seleção única de campanha.
- Aba **1 · Destinatários**: lista de e-mails ativos/inativos, busca, resumo; ações por linha dentro de **Gerenciar**; cadastramento de Pessoa, cadastramento de e-mail e cadastro global de Pessoas ficam em painéis recolhíveis.
- Aba **2 · Operação do lote**: escolha de mensagem; conferência detalhada recolhível; ações de lote (atualizar, preparar, interromper, retomar e simular) preservadas; resultado, simulação e segurança/histórico em painéis separados, recolhíveis.
- Ao escolher Editar na tabela, o formulário correspondente abre automaticamente. Auto-seleção da mensagem única preservada.
- Enviar lote segue visivelmente bloqueado, sem função de disparo.

## Integridade
- Mudanças apenas em `cda-modulo-homologacao.js` e `index.html` (atualização de versão/cache).
- Nenhuma migração, Edge Function, alteração Supabase ou envio.
- Lote #1 confirmado: preparado, cinco destinatários pendentes, zero tentativas vinculadas.
- Branch `main` e produção não alteradas.
- Homologação visual necessária antes de continuar a arquitetura do executor.

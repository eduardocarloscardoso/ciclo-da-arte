# CHECKPOINT — OPERAÇÃO DO LOTE COM INTERFACE COMPACTA
Data: 10/11/2026
Branch: `preview/campanha-mensagens`
Commit funcional: `20d1e394f708aabe7cc6a7de60b180d4435bc6e7`
Preview READY funcional: `https://ciclo-da-arte-cr6gqdyz8-eduardocarloscardosos-projects.vercel.app`

## Solicitação e decisões
- Campanha única no cabeçalho da Lista de Homologação, compartilhada entre as duas abas.
- Mensagem faz parte da campanha e precisa manter o ID para integridade do lote. Se houver uma única mensagem, o seletor desaparece e é exibido resumo textual; quando houver múltiplas, seletor permanece visível.
- Removida a Conferência detalhada duplicada de destinatários. Tabela do Lote #1 Nome / E-mail / Estado / Resend mantida como fonte operacional, separada do CRUD na aba Destinatários.
- Reduzidos textos repetidos de lote e progresso. Exibe linha compacta de lote, quantidade, situação e processados, barra de progresso discreta e indicadores concisos.
- Comandos Preparar, Interromper e Retomar movidos para painel recolhível Controles administrativos. Simular e Atualizar ficam na área principal; Enviar continua desabilitado.
- Botão no Pipeline B2C renomeado de Lista de Homologação para Abrir Homologação: é apenas atalho para a mesma página, não cria segunda lista.

## Controle de alterações
- Só `cda-modulo-homologacao.js`, `cda-modulo-pipeline-b2c.js` e `index.html` alterados.
- Não alterados banco, tabelas, integrações Resend, Edge Functions, envio, lista comercial, `main` ou produção.
- Lote #1 consultado em modo leitura: preparado, 5 destinatários pendentes, 0 tentativas vinculadas.
- Sintaxe JavaScript validada; validação visual e interativa pelo usuário pendente.

# Checkpoint UX — Transmissão Oficial objetiva (11/11/2026)

Projeto: `eduardocarloscardoso/ciclo-da-arte`; branch `preview/transmissao-oficial-universal`.
Solicitação: reduzir ao mínimo os passos visíveis ao operador, retirando a profusão de seções B1/B2/B3/B4/B5/B5.2.

## Layout do operador
1. **Selecionar** campanha, mensagem e quantidade por lote.
2. **Preparar** — congelar lista e lotes se ainda não existirem. Se já estiverem congelados, apresentar resumo de destinatários, lotes, revisões e pré-aprovações; não voltar a oferecer congelamento.
3. **Enviar e acompanhar** — permanece visualmente indicado, mas indisponível enquanto o executor real não estiver implementado e autorizado.

Um botão abre `Controles administrativos e histórico`; nele permanecem, recolhidos, validações, grade de lotes, B3 revisão, B4 limites/pré-aprovação, B5 simulações, B5.2 reservas globais e governança técnica. Não excluir funcionalidades nem alterar estrutura de tabelas.

## Implementação
- Novo componente `cda-transmissao-ux-simples.js` (apenas apresentação).
- Integrado em `cda-modulo-transmissao-oficial.js` com atualização de resumo a partir dos estados já existentes, sem novas RPCs ou API de envio.
- Carregamento com versionamento atualizado em `index.html`.
- Scripts JS e scripts embutidos validados sintaticamente.
- Nenhuma mudança de banco nesta entrega. Nenhuma alteração em produção, nenhuma mensagem enviada.
- Validação visual no Preview pendente; apenas depois discutir merge para `main`.

## Regra de UX futura
Não criar novas seções numeradas B para o usuário. Incorporar executor e acompanhamento na terceira fase já existente, com ação única consciente de enviar e estados Enviando/Pausado/Concluído/Erro e relatórios acessíveis pelo próprio fluxo. Manter auditoria detalhada exclusivamente sob controles administrativos.

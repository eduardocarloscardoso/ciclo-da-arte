# Checkpoint — Modal próprio do CRM para inclusão no Pipeline B2C

Data 09/11/2026. Projeto `eduardocarloscardoso/ciclo-da-arte`; branch `preview/campanha-mensagens`, sem merge em main.
Commit funcional `d2e9b2eba4b620d7e7f4e20e70bdf4a9c52a72a5`.
Preview Vercel READY: https://ciclo-da-arte-ok9w9ft2w-eduardocarloscardosos-projects.vercel.app

## Alteração
- Em Campanhas → Execução → Adicionar público ao Pipeline, substituída a janela `confirm()` padrão por modal da própria aplicação, com layout responsivo, cabeçalho, cartões numéricos, etapa de entrada e mensagens de aviso.
- Exibe quantidades de destinatários congelados, clientes elegíveis, leads já na campanha, novos previstos, clientes presentes em outras campanhas; origem e etapa de entrada.
- Botões `Cancelar` e `Confirmar inclusão de N leads`.
- Confirmação desabilitada quando houver divergência de destinatários congelados ou nenhum lead novo.
- Fechar pelo X, Escape ou clique fora cancela; retorna foco ao controle anterior; listeners removidos ao encerrar.
- Consulta e simulação não gravam nada. Só clique explícito em confirmar aciona a RPC transacional `cda_incluir_publico_pipeline_seguro` já homologada tecnicamente; envio em massa continua desabilitado.

## Verificação
- JavaScript validado sintaticamente; deploy Vercel READY.
- Banco após deploy: 861 congelados da Luedji, zero leads da campanha, 286 leads de outras campanhas, zero pares duplicados.
- **Pendente:** validação visual do modal pelo usuário. Nenhuma inclusão real executada.

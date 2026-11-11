# Checkpoint consolidado — Lista de Homologação × Resend
Data: 2026-11-11
Projeto: ciclo-da-arte (não é o Portal Ciclo Arte)
Branch de homologação: preview/campanha-mensagens
Produção/main: não alteradas neste marco.

## Escopo concluído
- Lista de Homologação independente da lista oficial, pessoas com mais de um e-mail e acesso autenticado.
- Campanha 4: Luedji Luna · São Paulo; mensagem 1: Convite com cupom LUEDJI20.
- Fluxo operacional guiado: selecionar lote → validar sem envio → revisar e autorizar → enviar individualmente → resultado.
- Controle de aprovação no Supabase ligado ao usuário autorizado, fingerprint SHA-256, expiração 30 minutos, autorização específica por lote; nenhuma autorização ou envio implícito.
- Resend via Supabase Edge Function com chave de idempotência por destinatário/lote, histórico transacional e recepção de eventos de entrega/devolução.
- Apenas um envio por confirmação; em resultado desconhecido, não efetuar reenvio automático.
- Consulta automática de eventos a cada 10 s, até 5 min, sem transmitir; Atualizar status manual.
- URL persistente da homologação contendo campanha/mensagem/lote/área e restauração após Ctrl+F5.
- Auditoria recolhida e resumo de resultados na etapa 5.
- Filtro por status de lote: Todos, Pendente, Em processamento, Concluído; calculado pelos estados dos itens, não pelo campo estrutural 'preparado' do lote. Um lote com devoluções pode ser Concluído; detalhamento da ocorrência permanece visível. Filtro não troca o lote em trabalho automaticamente.
- Supabase Edge Function de consulta de lotes ACTIVE v11. O endpoint expõe apenas leitura de lotes da campanha/mensagem já autenticadas.
- Lotes complementares preservam o snapshot e histórico dos lotes originais, com autorização independente.

## Evidências de homologação
Lote 1 (original): cinco tentativas; quatro mensagens entregues e uma devolvida (`patcardoso@datapaper.com.br`); cinco operações/IDs Resend.
Lote 2 (complementar): um destinatário `patcardoso@databras.com.br`, uma tentativa, entrega confirmada; um ID Resend. Endereço original devolvido preservado no lote 1.
Usuário confirmou recebimento e apresentação do primeiro e-mail, além da navegação revisada, atualização manual e restauração com Ctrl+F5.
Nenhum envio adicional foi realizado durante a implementação dos filtros.
Filtro testado em SQL: lotes 1 e 2 => Concluído, inclusive lote 1 com devolução.
Testes pendentes: validação visual do filtro no Preview; a transição automática de "Aceito" para "Entregue" em um novo envio ainda não foi observada com o usuário.

## Fronteira de segurança
- Lista oficial: 867 e-mails previamente válidos, separada e BLOQUEADA para envio neste marco.
- Nenhuma campanha oficial enviada ou autorizada.
- Antes de envio oficial: auditoria de opt-in/base legal e supressão/descadastro, reputação/limites do provedor, segmentação, pré-voo, lote oficial próprio e autorização distinta.
- Não reutilizar a aprovação do lote 1 ou do lote 2 para futuros envios.
- Não promover à produção sem validação visual e solicitação explícita.
- Fluxo GitHub branch preview → commit → um Preview Vercel → usuário homologa; main continua fonte de verdade até merge aprovado.

## Código técnico deste incremento
- `supabase/functions/cda-lote-homologacao-preview/index.ts`: acrescenta `resumo_lotes` com classificação por situação, sem caminho de envio.
- `cda-modulo-homologacao.js`: filtro antes do seletor de lotes; opção aberta permanece visível quando fora do filtro; status do filtro na URL.
- `index.html`: atualização de cache da interface para o Preview.
- Resend/executor não alterados neste incremento.

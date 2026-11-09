# Checkpoint — Plano inicial de comunicação, remetente e endereço de resposta

Data: 09/11/2026. Repositório `eduardocarloscardoso/ciclo-da-arte`; branch `preview/campanha-mensagens` (sem merge em main).

## Decisões do usuário
- Biblioteca de Conteúdos centraliza materiais comerciais; Campanhas seleciona os conteúdos; Pipeline acompanha interações.
- Uma campanha pode ter várias ações em momentos diferentes, cada uma com conteúdo, canal, público e resultados próprios.
- Para a mensagem Luedji Luna · São Paulo, remetente `noreply@send.ciclodaarte.com.br`; Reply-To `contato@epcparticipacoes.com.br`.
- O endereço Reply-To não identifica sozinho a pessoa responsável pelo atendimento nem garante captura de respostas no CRM.

## Verificações diretas
- Em `cda_campanha_mensagens`, a mensagem ID=1 `Convite com cupom LUEDJI20`, campanha ID=4, já tinha ambos os endereços gravados. Nenhuma correção de dados necessária.
- Edge Function `enviar-email-teste` carrega os campos da mensagem gravada e transmite `reply_to` ao Resend quando válido; `enviar-email-teste-historico-preview` delega à função de teste existente.
- A Biblioteca de Mensagens já oferece edição e pré-visualização desses campos, inclusive com validação de endereço.

## Alteração implementada
- Aba Mensagens de Campanhas: seção `Plano de Comunicação · ações de e-mail` lista mensagens vinculadas com assunto, From, Reply-To, situação de testes, esclarecimento de que o responsável humano está a definir e de que não existem ações agendadas.
- Mantido botão `Preparar Envio` e envio em massa desabilitado. Nenhuma mensagem disparada; nenhuma atualização de lead, histórico, etapa ou responsável.
- Commit funcional: `39f9155165047cd5f11379d1792e6a6835925a1a`.
- Cache `index.html` atualizado no commit `480124b681156786caba45edc8b57134fc0d45ae`.
- Vercel Preview READY: https://ciclo-da-arte-ec027kc4v-eduardocarloscardosos-projects.vercel.app

## Próximos passos
- Homologação visual desta primeira visão em Campanhas → Mensagens.
- Evolução de Plano de Comunicação de uma lista de mensagens existentes para ações independentes com canal, elegibilidade, janela e aprovação, sem disparo até autorização posterior.
- Decidir como mapear caixas Reply-To a pessoas comerciais e como receber respostas na plataforma (integração de caixa postal específica).

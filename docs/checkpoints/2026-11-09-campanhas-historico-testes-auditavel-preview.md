# Checkpoint — Histórico auditável de testes de e-mail (09/11/2026)

## Escopo e infraestrutura
- Projeto: Ciclo da Arte CRM/ERP, repositório `eduardocarloscardoso/ciclo-da-arte`, branch `preview/campanha-mensagens`.
- Frontend funcional commit `a2b31884354f4dd003747af600ec1e57e9eb06a6`.
- Vercel Preview READY: https://ciclo-da-arte-p2ee031n9-eduardocarloscardosos-projects.vercel.app.
- Supabase compartilhado com produção: `gsizoiwefejsllgtsard`. **Não houve alteração na função de produção `enviar-email-teste`; não houve merge em `main`.**

## Implementações
- Tabela **`public.cda_email_tentativas`** (migração `cda_email_tentativas_historico_testes_preview`) com campanha/mensagem, data, usuários, e-mails de teste, estado (`solicitado`, `aceito_provedor`, `rejeitado_provedor`, `falha_tecnica`), ID de e-mail do Resend e erro eventual.
- RLS ativo. Membros da equipe autenticados têm `SELECT` via `cda_e_membro_equipe()`. Não há INSERT/UPDATE/DELETE para `authenticated` ou `anon`, pois gravação é realizada somente pela função backend com chave servidor.
- Nova função **`enviar-email-teste-historico-preview`**, `verify_jwt=true`, verifica pertencimento à equipe, destinatários (1–3), salva tentativa inicial no banco e faz proxy autenticado para a função de teste ORIGINAL `enviar-email-teste`. Ao receber o resultado, atualiza estado e identificador do Resend. A função original continua em sua versão anterior e atende à produção.
- O Preview de `cda-dados-compartilhados.js` utiliza somente a nova função; `main` continua utilizando a função original.
- Aba **Resultados** exibe histórico cronológico dos testes (cada tentativa, e-mail(s), mensagem, data/hora, situação e ID Resend), com contadores, sem inferir entrega. Botão **Atualizar dados** relê mensagens e tentativas.
- O quadro legado do *último teste por mensagem* foi preservado para os testes anteriores à implantação. Não foi criado histórico retroativo artificial.
- O botão de envio em massa segue desabilitado. Lista congelada, segmentação, dados dos clientes, fundamentos LGPD, mensagens homologadas e testes anteriores não foram modificados.

## Validação técnica
- Migração aplicada com sucesso, Edge Function `enviar-email-teste-historico-preview` ACTIVE e `verify_jwt=true`; função original `enviar-email-teste` ACTIVE (inalterada).
- `authenticated` tem `SELECT`, não tem `INSERT` na tabela. JS sintaticamente válido. Vercel Preview READY.
- Ainda não foi feito novo envio de teste real; é necessária a homologação pelo usuário para verificar a gravação de ponta a ponta.

## Limitações e próximo marco
- Este primeiro histórico registra solicitações/aceites/erros no momento do teste. **Não prova entrega ao destinatário**.
- Eventos posteriores de entrega, rejeição, abertura, clique e resposta ainda **não** estão integrados: dependem de webhook seguro e configuração autenticada no Resend. Não apresentar esses indicadores como disponíveis.
- Como Supabase é compartilhado, a nova tabela e função existem no projeto comum; apenas o frontend Preview chama a função nova. Nenhuma publicação em produção.

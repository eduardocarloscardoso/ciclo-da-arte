# CHECKPOINT TÉCNICO CONSOLIDADO — CICLO DA ARTE
Data: 10/11/2026 | Área: Comercial · Pipeline B2C · Lista de Homologação · Mensagens/Resend

## 1. Fonte da verdade e ambientes
- GitHub: `eduardocarloscardoso/ciclo-da-arte`.
- Branch de trabalho/homologação: `preview/campanha-mensagens`.
- `main`: produção/fonte oficial; **NÃO alterar, mesclar ou publicar em produção sem autorização expressa**.
- Último commit funcional verificado antes deste checkpoint: `af800cb1ebf69bc778e62ab6cbcf24a1810b8fe4` — `feat(nav): mover homologacao do menu lateral para botao do Pipeline B2C`.
- Vercel projeto: `ciclo-da-arte`, project ID `prj_kHAlkCLZ0frvSDdBUTRyt9mhSnRG`, scope `eduardocarloscardosos-projects` (account/team ID `team_ZFV9Amn9eObWPwL4XinJTFLO`).
- Último Preview READY verificado: `https://ciclo-da-arte-3qcnlsr0g-eduardocarloscardosos-projects.vercel.app` (deployment `dpl_2gppeYn2JiRhTShtuxjZaC2HYjBF`).
- Domínios do projeto: `ciclo-da-arte.vercel.app`, `ciclo-da-arte-eduardocarloscardosos-projects.vercel.app`, `ciclo-da-arte-git-main-eduardocarloscardosos-projects.vercel.app`. Não confundir domínios com Previews de commit.
- Supabase oficial compartilhado entre preview e produção: projeto `gsizoiwefejsllgtsard`, endpoint `https://gsizoiwefejsllgtsard.supabase.co`.
- Resend: provedor de e-mail via Edge Functions do Supabase; remetente `noreply@send.ciclodaarte.com.br`; reply-to `contato@epcparticipacoes.com.br`. **Nunca colocar API key, service_role, signing secret ou senhas no prompt, código público ou commit.** Consultar configuração segura nos painéis somente se necessário, sem imprimir segredos.

## 2. Campanha e conteúdo homologados
- Campanha ID `4`: `Luedji Luna · São Paulo`.
- Mensagem ID `1`: `Convite com cupom LUEDJI20`, assunto `Show Luedji Luna · Cine Joia SP`.
- Evento: 18/11/2026, Cine Joia, São Paulo; cupom `LUEDJI20`, desconto 20%; link `https://shotgun.live/events/luedjilunanocinejoia`.
- Lista congelada em `public.cda_campanha_destinatarios`: 875 registros, 867 endereços válidos, 8 inválidos.
- Pipeline `public.leads_b2c`: 867 leads na campanha, todos `novo_lead` ao consultar em 10/11.
- `public.cda_email_tentativas`: 6 tentativas `tipo='teste'`, todas aceitas pelo provedor; **0 tentativas oficiais**.
- `public.cda_email_eventos`: 5 eventos `email.delivered` relativos aos testes; um teste antigo (09/11) sem evento de entrega, não afirmar entrega desse.
- Rastreio por destino: view `public.cda_rastreio_email_por_destinatario`; `email.delivered` não modifica a etapa comercial.
- Testes para `cardoso@epcparticipacoes.com.br`, `cardoso@databras.com.br`, `erik@epcparticipacoes.com.br` entregues nos eventos recentes. A lista de homologação ainda não foi usada como lote através de motor oficial.

## 3. Lista de Homologação — CRUD FUNCIONANDO E VALIDADO VISUALMENTE PELO USUÁRIO
- Acesso no Comercial → Pipeline B2C → selecionar campanha → botão `🧪 Lista de Homologação`. Botão de retorno ao Pipeline.
- Pessoas podem ter múltiplos e-mails, com indicador de e-mail principal e possibilidade de ativar/inativar.
- Tabelas independentes:
  - `public.cda_homologacao_pessoas` (id, nome, criado_em, atualizado_em);
  - `public.cda_homologacao_destinatarios` (id, campanha_id, pessoa_id, email, principal, ativo, criado_em).
- RLS habilitada nas duas tabelas com política autenticada `cda_e_membro_equipe()`. Usar direitos do usuário, não privilegiar frontend. Respeitar vínculo com campanha.
- Estrutura NÃO é tabela de clientes, NÃO cria leads, NÃO altera lista congelada, NÃO concede login ou privilégios.
- Campanha 4, lista confirmada: 4 Pessoas, 5 e-mails ativos:
  1. Eduardo Carlos Cardoso — `cardoso@epcparticipacoes.com.br` [principal].
  2. Eduardo Carlos Cardoso — `cardoso@databras.com.br` [adicional].
  3. Erik Cardoso — `erik@epcparticipacoes.com.br` [principal].
  4. CLEIDIANE FERREIRA LIMA — `cleide@epcparticipacoes.com.br` [principal].
  5. Patricia Cardoso — `patcardoso@datapaper.com.br` [principal].
- Atenção: registro de login na `public.equipe` para `cleide@epcparticipacoes.com.br` tem outro nome (`Cleide Mendonça`). Não alterar o login sem aprovação separada. Algumas associações de e-mail em `public.clientes` também são históricas e divergentes. Não corrigir por hipótese.

## 4. Arquivos do frontend e estados
- `index.html`: scripts do app, rotas internas e cache-busting.
- `cda-modulo-homologacao.js`: CRUD independente por campanha, edição, cadastro, exclusão, e-mails adicionais, principal, ativação e filtro. Comentário do código: nenhum envio executado aqui.
- `cda-modulo-pipeline-b2c.js`: botão Lista de Homologação na barra de ações, histórico individual E-mails/Resend, colunas `E-mail / Resend` e `Data do envio`, vínculo da campanha.
- `cda-modulo-mensagens.js`: Biblioteca de Conteúdos/Editor, prévia, diálogo de até três destinatários e painel de estado `Enviando...` → `Aceito pelo Resend` / `Erro`.
- `cda-dados-compartilhados.js`: `cdaEnviarTesteMensagem` executa um destinatário por tentativa, com Resend ID por endereço. Regex corrigida para aceitar e-mails válidos.
- Checkpoints prévios: `docs/checkpoints/2026-11-10-homologacao-luedji-tres-pessoas-quatro-emails.md`, `docs/checkpoints/2026-11-10-pipeline-rastreio-envio-email-por-destinatario-preview.md`, `docs/checkpoints/2026-11-10-luedji-ampliacao-publico-outubro-867.md`, `docs/checkpoints/2026-11-10-conciliacao-outubro-bling-sem-alterar-calculos.md` e checkpoint CRUD por commit `bb00be956c60345bfb76bf8636fe760475243a9b`.

## 5. Integração Supabase ⇄ Resend
- Supabase Edge Function `enviar-email-teste`: função original de envio de testes (ACTIVE, verify_jwt true).
- `enviar-email-teste-historico-preview`: wrapper de testes com JWT, checagem `cda_e_membro_equipe`, registro `cda_email_tentativas`, chamada à função original e armazenamento de Resend ID; ACTIVE, verify_jwt true.
- `resend-eventos-preview`: webhook de eventos do Resend; ACTIVE, verify_jwt false porque requer verificação de assinatura do próprio webhook.
- `configurar-webhook-resend-preview`: configuração segura; ACTIVE, verify_jwt true.
- Teste atual envolve 1–3 e-mails explícitos, individualmente rastreáveis; **NÃO confundir com envio em lote de homologação**, que ainda precisa ser implementado.
- `cda_email_tentativas` guarda campanha, mensagem, `tipo`, destinos, situação, Resend ID, erro e carimbos de tempo.
- `cda_email_eventos` guarda `tipo`, `tentativa_id`, `resend_email_id`, `svix_id`, horário e recebimento.
- `cda_rastreio_email_por_destinatario` compõe visão individual de pedido + eventos.
- Segredos técnicos pertencem a Supabase Edge Function secrets/Vault ou configuração segura do servidor, nunca ao HTML frontend. Não republicar valores.
- A verificação de `email.delivered` significa evento do provedor, não prova de leitura. Aberturas não estão acompanhadas.

## 6. Segurança, governança e procedimento de engenharia
- Antes de alterar código: ler `preview/campanha-mensagens`, confirmar arquivo e SHA; commit somente nessa branch; se necessário atualizar query ?v dos scripts no `index.html`; verificar diff/commit e deployment Vercel READY; pedir validação visual.
- Usar conectores autenticados GitHub, Vercel e Supabase. Vercel: omitir `teamId` quando sessão direta funcionar; obter deployments com `projectId:'ciclo-da-arte', branch:'preview/campanha-mensagens'`. Em Supabase, usar sempre project_id `gsizoiwefejsllgtsard`.
- O banco Supabase é COMPARTILHADO com produção: DDL/DML altera dados vivos, mesmo quando código está em Preview. Consultar impacto e evitar alterações destrutivas.
- A branch `main` está congelada para mudanças desta frente até autorização.
- Proibido disparo oficial aos 867 leads sem autorização expressa. Não iniciar teste de homologação de forma automática, mesmo após cadastro.
- Preservar financeiro/outubro e regras de cálculos aprovadas; não alterar outros módulos.

## 7. Próximas tarefas, ainda NÃO homologadas
1. Implementar **motor de disparo controlado em lote**, inicialmente para Lista de Homologação selecionada, usando o mesmo mecanismo transacional futuro dos clientes oficiais.
2. Validar escolha explícita de campanha, mensagem, destinatários, contagem prévia, modo homologação x oficial, operação única e autorização, com idempotência/sem duplicatas, status por e-mail e proteção contra reinício/timeout/reenvio.
3. Garantir separação de dados entre testes e oficiais, registro de cada tentativa e Resend ID, resultados aceitos/entregues/devolvidos, progresso, parada e retomada seguras.
4. Confirmar descadastramento funcional, lista de supressão e requisitos LGPD antes de qualquer envio comercial em massa.
5. Homologar visualmente e receber autorização específica para **cada envio real**; envio em homologação também deve ser explicitamente autorizado. Nenhum envio executado neste checkpoint.
6. Não misturar o CRUD de gestão da lista (feito) com o motor de disparo (pendente).

## 8. Texto de passagem para próxima conversa
Continuar o projeto Ciclo da Arte **do checkpoint de 10/11/2026**, sem reiniciar e sem mesclar `main`. Verificar branch `preview/campanha-mensagens` e último Preview READY. A Lista de Homologação CRUD já foi aprovada, acessível pelo Pipeline B2C, com quatro pessoas e cinco e-mails. O próximo trabalho é desenhar/implementar o motor seguro de envio em lote com modo homologação, prevenção de duplicidades, feedback e rastreabilidade por destinatário, seguido por homologação humana. Supabase `gsizoiwefejsllgtsard`, Vercel `ciclo-da-arte`, GitHub `eduardocarloscardoso/ciclo-da-arte`, Resend via Supabase Edge Functions. Não disparar e-mails sem nova autorização; preservar 867 leads e 0 envios oficiais.

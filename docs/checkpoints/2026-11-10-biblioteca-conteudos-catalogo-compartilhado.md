# Checkpoint — Biblioteca de Conteúdos (primeira fase)
Data: 10/11/2026.
Repo `eduardocarloscardoso/ciclo-da-arte`; branch `preview/campanha-mensagens`, sem merge em main.

## Decisões
- Biblioteca de Conteúdos reúne mensagens, imagens, vídeos, ofertas, links e outros materiais comerciais.
- Biblioteca organiza; Campanhas seleciona; Pipeline acompanha execução e resultados.
- Um Plano de Comunicação pode ter várias ações; ainda não há agendamento ou envio real em massa.
- E-mail remetente da mensagem Luedji: `noreply@send.ciclodaarte.com.br`; Reply-To `contato@epcparticipacoes.com.br` é alias gerido pela TI e encaminha respostas aos colaboradores; não precisa distribuir leads para colaboradores.

## Entregue
- Nova tabela `public.cda_biblioteca_conteudos` para materiais compartilhados, campos tipo (imagem, video, oferta, link, outro), título, descrição, URL, situação (rascunho, em revisão, aprovado, arquivado), direitos/créditos e auditoria básica.
- RLS habilitada, acesso somente a membro autenticado da equipe (`cda_e_membro_equipe()`).
- Visualização existente da Biblioteca de Mensagens preservada, com todas as mensagens de e-mail originais em `cda_campanha_mensagens`; acervo complementar na mesma tela com busca, filtros, inclusão/edição de materiais e URL HTTPS.
- Menu e título de navegação passam a ser `Biblioteca de Conteúdos`.
- Não implementados ainda: upload de arquivo/imagens, versionamento imutável, vinculação de materiais a campanhas, plano de múltiplas ações, histórico de respostas via alias. Estes itens são fases posteriores.
- Envio em massa continua desabilitado.

## Verificação
- Validação sintática JavaScript OK.
- Vercel READY: https://ciclo-da-arte-fk2on0f2e-eduardocarloscardosos-projects.vercel.app, commit `4fe42bbfdacc0955c092aac93fed55e35c019036`.
- Banco: 0 novos materiais (acervo vazio até cadastro), 1 mensagem original preservada, 853 leads Luedji preservados, 1 política RLS equipe.
- Atenção: banco Supabase é compartilhado com produção; a nova tabela foi criada sem alterar tabelas prévias.

## Próximo
Validar visualmente a Biblioteca e cadastro/consulta de um material; depois evoluir vínculo Biblioteca → Campanha e criação de ações independentes do Plano de Comunicação, sem disparos automáticos.

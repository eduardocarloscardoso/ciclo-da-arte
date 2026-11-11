# Checkpoint — Comercial > Lista de Homologação (10/11/2026)

## Implementação Preview
- CRUD em `cda-modulo-homologacao.js` e integração em `index.html` (branch `preview/campanha-mensagens`, não em `main`).
- Acesso: Comercial > Lista de Homologação; permissões de leitura/escrita são as mesmas do submódulo Biblioteca de Conteúdos (`mensagens`), com validação da equipe também por RLS no Supabase.
- Selecionar campanha, consultar/buscar e-mails, cadastrar/editar Pessoa, adicionar/editar endereços, marcar um endereço principal ativo por pessoa/campanha, ativar/desativar/excluir endereço, excluir Pessoa sem vínculos.
- Não existe botão de envio nesta página; nenhuma campanha foi disparada.
- Banco: `public.cda_homologacao_pessoas`, `public.cda_homologacao_destinatarios`, projeto Supabase `gsizoiwefejsllgtsard`.
- Campanha 4 Luedji Luna · São Paulo: quatro pessoas, cinco e-mails.
  - Eduardo Carlos Cardoso: cardoso@epcparticipacoes.com.br (principal), cardoso@databras.com.br (adicional).
  - Erik Cardoso: erik@epcparticipacoes.com.br (principal).
  - CLEIDIANE FERREIRA LIMA: cleide@epcparticipacoes.com.br (principal).
  - Patricia Cardoso: patcardoso@datapaper.com.br (principal).
- Controle de e-mails válidos e duplicados por campanha; sem alterar `clientes`, `leads_b2c`, `cda_campanha_destinatarios` ou `equipe`.
- Antes da homologação visual: Vercel READY no commit `5dabf61c9b162392a2217c0a128fd12cbf42f535`: `https://ciclo-da-arte-iv3ysp03d-eduardocarloscardosos-projects.vercel.app`.

## Próximos passos
- Homologar visualmente o CRUD.
- Em etapa separada, projetar motor seguro de envio em lotes, retomada e deduplicação, com opção de usar lista de homologação e autorização expressa antes de disparar.
- Não alterar `main` nem enviar para 867 clientes sem autorização.

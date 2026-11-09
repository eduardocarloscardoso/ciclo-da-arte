# Checkpoint — Prévia da inclusão de público no Pipeline B2C
Data: 09/11/2026. Projeto Ciclo da Arte CRM/ERP.
Repo: `eduardocarloscardoso/ciclo-da-arte`, branch `preview/campanha-mensagens` (sem merge em main).
Commit funcional `e42eec832a9069beb11829f478860263189175bf`.
Preview Vercel READY: https://ciclo-da-arte-hbyx7ve3a-eduardocarloscardosos-projects.vercel.app

## Auditoria
- Campanha Luedji Luna · São Paulo, id=4: 861 destinatários congelados, 861 IDs únicos, zero leads no Pipeline; 2 testes no histórico e 1 evento Resend.
- Pipeline já vincula leads a `cliente_id` e `campanha_id`. Entre as campanhas existentes não há duplicidade de `(campanha_id, cliente_id)`.
- `cdaAdicionarPublicoCampanha` evita reinserir clientes já cadastrados na mesma campanha por consulta prévia, mas banco ainda não impõe índice único por par: concorrência simultânea ainda representa risco residual. **Não aplicada migração no Supabase compartilhado com produção.**

## Alteração no Preview — Campanhas → Execução → Adicionar público ao Pipeline
- Antes de gravar, consulta lista congelada ou calcula público, confere cliente completo disponível, remove repetição de IDs e busca estado atual dos leads.
- Exibe prévia com origem do público, total da lista congelada, quantidade de clientes localizados, já existentes na campanha, novos previstos, clientes que também participam de outras campanhas e etapa de entrada.
- Impede inclusão silenciosa quando existem destinatários congelados sem cliente elegível localizado.
- Requer confirmação explícita e somente então invoca a função de inclusão existente. Recarrega leads após gravar, exibindo contagem de adicionados e já existentes.
- Nenhum lead criado por esta alteração: depende de clique e confirmação. Testes, eventos e congelamento preservados; nenhum envio em massa liberado.

## Verificação
- JavaScript válido, Vercel READY.
- Consulta no Supabase: 861 congelados; 0 leads da campanha; 2 testes; 1 evento.
- Pendente homologação visual pelo usuário da **prévia**; não confirmar a inclusão dos 861 leads até decisão de operação comercial.

## Próxima etapa proposta
- Validar prévia em Campanhas → Execução. Antes de uso concorrente em volume, avaliar índice único ou função transacional de inclusão no Supabase, com teste específico de compatibilidade do app legado, uma vez que o banco é compartilhado com produção.

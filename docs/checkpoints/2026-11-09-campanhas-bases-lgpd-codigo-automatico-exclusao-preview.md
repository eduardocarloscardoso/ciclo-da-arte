# Checkpoint — Bases legais LGPD · Código automático e exclusão protegida

**Data:** 09/11/2026
**Projeto:** Ciclo da Arte CRM/ERP
**Branch de trabalho:** `preview/campanha-mensagens` — não fazer merge em main sem autorização
**Commit funcional:** `c2c776c6232471724e0d2415f280d65e8b4a09e4`
**Vercel READY:** https://ciclo-da-arte-dyq6etuhq-eduardocarloscardosos-projects.vercel.app

## Implementado
- Em Comercial → Campanhas, botão Base Legal LGPD ao lado de Selecionar campanha.
- Tabela `public.cda_lgpd_fundamentacoes` no Supabase oficial `gsizoiwefejsllgtsard`, RLS para membros autenticados da equipe.
- Cinco modelos iniciais: legítimo interesse, consentimento, execução de contrato, obrigação legal/regulatória, outra.
- CRUD: consultar, cadastrar, editar, desativar/reativar e excluir definitivamente.
- Código interno oculto e gerado automaticamente a partir do nome, com sufixo sequencial para colisões conhecidas; código existente não muda na edição.
- Exclusão exige confirmação e verifica campanhas vinculadas; além da checagem da interface, gatilho `cda_lgpd_impedir_exclusao_vinculada` impede exclusão no banco quando código estiver utilizado em `cda_campanhas.lgpd_base_legal`.
- A seleção da base legal no formulário da campanha preenche automaticamente `Finalidade e Fundamentação LGPD`; texto editável e cópia salva na campanha preservada.
- O registro de teste `teste_lgpd` foi excluído definitivamente. Consulta confirma cinco modelos ativos e a base legal de Luedji Luna preservada como `legitimo_interesse`.
- Disparo em massa continua desabilitado; lista congelada e todos os outros módulos preservados.

## Validação
- JavaScript sem erros de sintaxe; deploy Vercel READY; tabela e gatilho confirmados em banco.
- **Pendente:** validação visual e funcional pelo usuário dos ajustes finais de código automático/exclusão e do preenchimento automático no navegador.

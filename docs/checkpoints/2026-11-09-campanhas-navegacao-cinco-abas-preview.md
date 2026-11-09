# Checkpoint — Campanhas organizadas em cinco abas (09/11/2026)

**Projeto:** Ciclo da Arte CRM/ERP
**GitHub:** `eduardocarloscardoso/ciclo-da-arte`
**Branch de homologação:** `preview/campanha-mensagens`; `main` preservada.
**Commit funcional:** `286778121350fde91b4482a73c4a4dcadc7da2aa`
**Vercel READY:** https://ciclo-da-arte-8lyz2m90h-eduardocarloscardosos-projects.vercel.app

## Reorganização exclusivamente visual
- O menu lateral **Campanhas** permanece o mesmo, sem submenus adicionais.
- Cada card de campanha passa a exibir 5 abas e apenas o conteúdo/comandos da aba ativa:
  - **Visão Geral** — resumo da campanha, público, e-mails, segmentação, mensagens, período, responsáveis, etapa, meta, benefício; ações **Editar** e **Duplicar**.
  - **Público** — segmentação, público calculado, lista congelada; ação **Congelar/Recongelar Lista**.
  - **Mensagens** — mensagens da Biblioteca e ação **Preparar Envio**, que mantém **Visualizar Mensagem**, **Enviar Teste** e envio em massa desabilitado.
  - **Execução** — etapa/responsáveis; ações **Adicionar Público ao Pipeline**, **Gerar Mensagens**, **Gerar Roadmap de Tarefas**.
  - **Resultados** — KPIs já existentes, quando há leads; aviso de futura implantação do controle de envios.
- Aba ativa retida somente no estado do navegador por campanha durante o uso da tela, sem mudanças no Supabase.
- Botão **Base Legal LGPD** continua ao lado do seletor de campanha, como cadastro compartilhado.
- Os eventos e IDs dos botões originais foram reutilizados sem alterações em suas rotinas.

## Verificações
- Sintaxe JavaScript validada.
- Vercel Preview READY.
- Supabase: 4 campanhas, Luedji Luna com 861 destinatários congelados, 853 e-mails válidos e uma mensagem vinculada; nenhum registro alterado.
- **Pendente:** homologação visual/funcional do usuário para conferir cada aba e abrir ações já existentes.
- **Importante:** nenhuma publicação na produção, nenhuma habilitação do disparo em massa.

# Checkpoint — Busca de destinatários da campanha (09/11/2026)

**Projeto:** Ciclo da Arte CRM/ERP
**Branch:** `preview/campanha-mensagens`
**Commit funcional:** `36565a06d349ad204ef5602768d683900bf7d5ce`
**Vercel READY:** https://ciclo-da-arte-jlqdtwnce-eduardocarloscardosos-projects.vercel.app

## Implementado
- Em `Campanhas → Preparar Envio`, busca por nome ou e-mail posicionada ao lado do contador **Destinatários**.
- Consulta em toda a lista congelada da campanha, não apenas na página atual, com correspondência parcial e sem distinção de maiúsculas e acentos.
- Pesquisa respeita filtro técnico (`Com e-mail válido e único` como padrão, `Excluídos tecnicamente`, `Todos os registros`).
- Contagem e paginação atualizadas; digitar reseta a navegação para primeira página.
- Botão Limpar restaura a lista do filtro técnico selecionado.
- A busca é descartada ao fechar e abrir uma nova preparação.
- Sem mudanças em dados, segmentação, mensagens, campanha, lista congelada ou regras LGPD.
- Envio em massa continua indisponível.

## Verificação
- JavaScript sintaticamente válido.
- Vercel Preview READY, sem publicação na produção.
- Cliente `clarawfadel@gmail.com` confirmado na lista congelada da campanha Luedji Luna por consulta ao Supabase.
- **Pendente:** homologação visual do usuário no navegador.

# Checkpoint — Recuperação do carregamento de Campanhas homologada

**Data:** 07/11/2026
**Projeto:** Ciclo da Arte CRM/ERP
**Repositório:** `eduardocarloscardoso/ciclo-da-arte`
**Branch:** `preview/campanha-mensagens`
**Commit funcional homologado:** `bb071185343902f174f0958d9b70bd4ac94253f4`
**Preview READY:** `https://ciclo-da-arte-3na6ul7ye-eduardocarloscardosos-projects.vercel.app`
**Confirmação do usuário:** "funcionou" após abrir o Preview corrigido.

## Problema e resolução
- Após adicionar o filtro de seleção de campanhas, a tela apresentava apenas a opção "Todas as campanhas" sem listar os registros.
- Consulta direta ao Supabase confirmou quatro campanhas preservadas: IDs 1, 3, 4 e 5.
- O módulo aguardava todas as fontes auxiliares em um `Promise.all`; lentidão/falha de alguma delas podia impedir a listagem.
- Alteração mínima em `cda-modulo-campanhas.js`: carregamentos isolados com limite de espera e aviso para dados auxiliares ausentes, mantendo campanhas visíveis sempre que sua própria consulta terminar com sucesso.
- Cache atualizado em `index.html`. Nenhum dado de campanha foi alterado.
- Validação visual pelo usuário concluída. Vercel READY. Produção `main` não alterada.

## Governança e próximos passos
- Preservar a homologação da Biblioteca de Mensagens e do flyer da Luedji Luna (ver checkpoint `2026-11-07-comercial-campanhas-biblioteca-mensagens-homologacao-final.md`).
- A etapa proposta seguinte é Preparação e Envio de E-mails, iniciando por seleção de campanha, mensagem, destinatários aptos e confirmação, SEM liberar disparo real em massa antes de homologação específica.
- Fluxo: inspecionar código → alteração incremental → commit na branch Preview → Vercel READY → validação usuário → merge `main` somente quando autorizado.

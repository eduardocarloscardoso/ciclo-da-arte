# Checkpoint — Fechamento do editor e rodapé institucional dos e-mails
Data 10/11/2026, projeto `eduardocarloscardoso/ciclo-da-arte`, branch `preview/campanha-mensagens`.

## Problemas relatados
Usuário relatou botão para sair da edição de mensagem travado e solicitou links de site/rede social na última caixa de rodapé da mensagem.

## Diagnóstico / correção de código
- Editor `cdaEditorMensagem` era anexado a `document.body`, mas o CSS que exibe modal e define estilos dos controles usa seletores `.crm-embed .mo.op`, exigindo ancestral `.crm-embed`. Agora o editor é anexado ao módulo `.crm-embed` ativo, inclusive ao reabrir depois de mudar de módulo. Botão com texto `Sair da edição` e `type=button`; `X` e Escape também fecham.
- Rodapé gerado por `cdaMontarEmailCampanha`: inclui site `https://www.ciclodaarte.com.br/` (loja oficial), e `https://linktr.ee/ciclo_arte` (Linktree da marca com redes sociais), tanto no HTML quanto na versão texto; links verificados em fontes públicas, sem inventar Instagram/Facebook individuais. Conteúdo armazenado na mensagem não alterado. O rodapé existente, remetente, Reply-To e links de descadastro foram preservados.
- Mensagem Luedji já possui From `noreply@send.ciclodaarte.com.br` e Reply-To `contato@epcparticipacoes.com.br` (alias distribuído pela TI).
- Branch somente Preview, commits `d2cd55204f016aee873381e6a32493052d1b2297` (editor), `52d4a95778c57998a024859e2e8c6fc30f5a71f8` (rodapé), `324f599c93640641431b97e2cf0e4e8d4059b97e` (cache).
- Vercel READY: https://ciclo-da-arte-qo1z0st3f-eduardocarloscardosos-projects.vercel.app
- JS verificado sintaticamente, homologação visual pelo usuário pendente.

## Pendência prioritária
O link de descadastramento gerado para testes usa fallback `#descadastrar`, que não é implementação de opt-out; precisa de endpoint seguro, registro de supressão por cliente e campanha, auditoria e testes de funcionamento ANTES de habilitar envios reais. Nenhum envio em massa foi habilitado.

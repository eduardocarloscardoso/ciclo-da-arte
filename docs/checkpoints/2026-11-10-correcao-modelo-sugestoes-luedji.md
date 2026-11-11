# CHECKPOINT — CORREÇÃO DE SUGESTÕES GENÉRICAS DA CAMPANHA LUEDJI LUNA
Data: 10/11/2026. Branch: `preview/campanha-mensagens`.
Commit funcional: `93fd0b522051d42cd4618b0563ecb3d87f77778a`.
Preview READY funcional: `https://ciclo-da-arte-oo3hzx6a3-eduardocarloscardosos-projects.vercel.app`.

## Diagnóstico
O botão "Gerar textos (filtrados)" aplicou uma mensagem genérica de reativação de clientes aos 867 leads da campanha 4, porque ambos os campos `modelo_mensagem_final` e `modelo_mensagem_sugerida` estavam vazios. A implementação anterior recorria automaticamente ao `CDA_TEMPLATE_PADRAO`.
A campanha já possuía, na tabela `cda_campanha_mensagens`, mensagem oficial id 1 "Convite com cupom LUEDJI20". Esse registro não foi alterado.

## Remediação executada
- Script auditável em `docs/checkpoints/2026-11-10-remediacao-sugestoes-genericas-luedji.sql`, aplicado transacionalmente ao banco compartilhado.
- Backup privado dos 867 textos anteriores na tabela `public.cda_backup_sugestoes_luedji_20261110` com RLS habilitada e sem acesso para anon/authenticated.
- 867 `leads_b2c.mensagem_sugerida` da campanha 4 limpos somente quando continham a frase genérica específica, mantendo IDs, e-mails, etapas, responsáveis, `mensagem_final_usuario` e demais colunas inalterados.
- Configurado `cda_campanhas.modelo_mensagem_sugerida` da campanha 4 a partir da saudação, texto e link oficiais da mensagem id 1. O modelo não foi aplicado automaticamente a leads: exige conferência antes de eventual geração.

## Prevenção de recorrência
- `cda-modulo-pipeline-b2c.js`: na geração individual e em lote, campanhas sem modelo explícito agora bloqueiam geração em vez de utilizar modelo genérico.
- Geração em lote exige seleção explícita de uma campanha e confirmação com nome/quantidade; nunca realiza envio.
- Atualização local das sugestões ocorre apenas depois de gravação bem-sucedida.
- `index.html` atualizado para impedir uso da versão JavaScript em cache.

## Verificações
- 867 leads na campanha; 0 sugestões genéricas remanescentes; 0 sugestões preenchidas remanescentes; 867 cópias no backup protegido.
- 875 destinatários oficiais congelados; 0 envios oficiais.
- `main` e produção não alteradas; não foram feitos envios Resend; nenhum lead foi removido ou movido no funil.
- Validação visual do usuário ainda pendente. Não clicar em Gerar textos para os 867 leads até homologar a mensagem sugerida da campanha.

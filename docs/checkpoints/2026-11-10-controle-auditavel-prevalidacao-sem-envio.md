# CHECKPOINT — CONTROLE AUDITÁVEL E PRÉ-VALIDAÇÃO, SEM ENVIO
Data: 10/11/2026. Branch: `preview/campanha-mensagens`.
Commit funcional desta etapa: `0026785d10e2cd8786a7ef220f2e0ab1edab7840`.
Base anterior: `6e1b0d282698468bd344561cf1dceba233054c52`.

## Implementado
- `cda_envio_lote_auditoria`: histórico de interrupção/retomada, somente consulta permitida ao cliente autenticado membro da equipe; escrita somente por service_role.
- RPC `cda_controlar_lote_sem_envio`: trava linha `FOR UPDATE`, valida transições, grava histórico atomicamente e nunca autoriza envio.
- Edge Function `cda-lote-homologacao-preview` versão 4: `status`, `preparar`, `interromper`, `retomar` e `validar`. Autentica usuário real Supabase Auth + `cda_e_membro_equipe`; checa destinatários ainda ativos, supressões, situação de lote, consulta auditoria. Retorna sempre `envio_habilitado:false` e `validacao.autorizado:false`.
- Interface: novas seções Verificação de segurança e Histórico de controle; botão Retomar preparação (sem envio), condicionado a lote interrompido. Enviar lote permanece desabilitado.
- Migration versionada `supabase/migrations/20261110_lote_controle_auditavel_sem_envio.sql`.
- Alterações somente em 4 arquivos: UI, index, Edge Function e migration.
- Nenhuma alteração em `main`.

## Verificações
- Lote #1 (campanha 4, mensagem 1): `preparado`, 5 destinatários, todos pendentes; zero tentativas de lote.
- RPC do controle: EXECUTE anon=false, authenticated=false, service_role=true.
- Preview READY após commit funcional: `https://ciclo-da-arte-fhw44h6ha-eduardocarloscardosos-projects.vercel.app`.
- Não houve execução das operações de interromper/retomar; registrar somente quando usuário validar.
- Esta implementação **NÃO cria um executor de envio**, não chama Resend, não concede autorização.
- Modo Oficial e lista 867 permanecem bloqueados.

## Pendências de segurança
- Antes de liberar envios: aprovação específica de campanha, mensagem, destinatários e quantidade; garantia de idempotência no provedor e resolução de resultado ambíguo; supressões/descadastramento LGPD; limites e políticas de concorrência e retries; correlação de webhook, teste controlado mediante autorização expressa.
- Pré-validação sem impedimentos não equivale a permissão de disparar. A operação de 'retomar' apenas altera o estado administrativo, sem mensagens.

# Checkpoint — Entrega 1: executor oficial da Transmissão Oficial (11/11/2026)

## Reaproveitado do motor homologado (executor de homologação)
- Montador de e-mail (cópia fiel de `cdaMontarEmailCampanha`) e adaptador Resend de chamada única
  (Idempotency-Key estável `ciclo-oficial/<chave>`, sem retry; timeout/5xx = indeterminado).
- Desenho de segurança: autorização pessoal expirável presa a fingerprint, diário gravado antes do HTTP,
  uma chamada = um e-mail, nenhum reenvio automático.

## Novo
- Migration `20261111_transmissao_oficial_executor.sql`: `cda_transmissao_autorizacoes`, `cda_transmissao_envios`,
  `cda_transmissao_envio_eventos`, segredo HMAC de descadastro e RPCs `cda_oficial_*` (somente service_role).
  Tabelas congeladas (transmissões, lotes, itens) não foram alteradas.
- Reserva com trava global (advisory lock), limites globais B5 / B4 (10/min, 120/h, 300/dia), supressão.
- Autorização exige: transmissão congelada, LGPD confirmada, snapshot íntegro, pré-aprovação B4 e fingerprint atual.
- Edge Functions: `cda-executor-transmissao-oficial` (v1), `cda-descadastro` (v1, pública, HMAC),
  `resend-eventos-preview` v4 (ramo oficial acrescentado; caminho de homologação inalterado).
- Devolução/reclamação gravam supressão automática. Descadastro: link no rodapé + List-Unsubscribe one-click.
- Página `descadastro.html` (servida pelo domínio de produção).
- UI: `cda-transmissao-envio.js` — etapa 3 com confirmação LGPD, prévia, autorização digitada, iniciar/pausar, progresso.

## Testes
- Banco: ciclo completo dentro de transação revertida (bloqueio LGPD, fingerprint, pré-aprovação, outro usuário,
  limite por minuto na 11ª reserva, não reconclusão, evento entregue/duplicado/devolução+supressão, pausa). Revertido: 0 linhas.
- Montador: saudação, link de descadastro real (sem `#descadastrar`). UI: jsdom com respostas simuladas.
- Nenhum e-mail enviado durante o desenvolvimento.

## Pendente de anuência do usuário
- Confirmar base legal na tela; decidir sobre o texto "Ciclo  Arte"; publicar em Production; autorizar e iniciar o lote 1.

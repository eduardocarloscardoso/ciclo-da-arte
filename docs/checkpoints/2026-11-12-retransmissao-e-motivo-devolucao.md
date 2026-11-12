# Checkpoint — Retransmissão e motivo da devolução (12/11/2026)

## Resultado da transmissão nº 1 (Luedji Luna · SP)
- 867 processados em 11–12/11; ~840 entregues; 26 devolvidos e 1 descadastro (suprimidos automaticamente).
- Incidente: plano Free do Resend (100/dia) recusou com HTTP 429 após 194 envios; 3 itens devolvidos à fila
  após o upgrade para plano pago (auditoria `oficial_refila_429`).

## Implementado
- Webhook v5: grava o motivo da devolução (`bounce.type/subType: message`) em `cda_transmissao_envio_eventos.motivo`
  e no `erro` do envio (aparece em Inconsistências).
- `cda_oficial_retransmitir(origem, mensagem, usuário)`: encerra a origem e cria nova transmissão com o MESMO público
  (sem suprimidos), mensagem à escolha, mesmos controles de ritmo; LGPD herdada da origem. Executor v3: ação `retransmitir`.
- Montador (tela e servidor): descrição do cupom em várias linhas, 2º botão opcional (`botao2Texto`/`botao2Link`),
  primeiro nome ignora parênteses ("(Jady) JARLENE" → "Jady"). Editor da Biblioteca com os novos campos.
- Mensagem nº 2 criada (cópia da nº 1, texto idêntico por decisão do usuário): assunto
  "Luedji Luna: 20% no ingresso + 15% nas peças", cupom em 3 linhas, 2º botão para a collab no site.
- Tela: caixa "Retransmitir para o mesmo público" quando a transmissão termina; transmissão encerrada continua visível.

## Testes
- Retransmissão em transação revertida: 840 destinatários, 28 lotes, 27 excluídos, snapshot íntegro, ritmo 20/900.
- Montador: saudação "Jady", 3 linhas do cupom, 2º botão com UTM. UI com jsdom (mocks).
- Nenhum e-mail enviado.

## Pendente
- Usuário: cadastrar LUEDJI20 com 15% na loja do site; conferir prévia da mensagem nº 2; publicar em produção.

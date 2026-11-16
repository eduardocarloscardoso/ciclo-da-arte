# Checkpoint — Projeto Marketing Meta · WhatsApp (Etapas 1 e 2) — 16/11/2026 16:50

## Estado
- **Etapa 1 (conexão) — concluída e testada em 16/11.** App Meta "Ciclo Arte Conexão" (BM Ciclo da Arte,
  uso próprio, sem App Review). Número de teste `+1 555-175-5537` (phone_number_id `1369191586285354`,
  WABA `1144232028203751`), qualidade GREEN. Webhook `whatsapp-webhook-preview` verificado; campo `messages`
  assinado; WABA inscrita no app. Secrets `WHATSAPP_TOKEN` (novo), `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`.
- **Etapa 2 (Caixa de Conversas) — em PREVIEW**, branch `preview/whatsapp-conversas`
  (https://ciclo-da-arte-git-preview-3d48fb-eduardocarloscardosos-projects.vercel.app). Produção (main) intocada.
  - Funções: `whatsapp-enviar-preview` v2 (fallback 9º dígito), `whatsapp-midia-preview` v1,
    `whatsapp-diagnostico-preview` v1.
  - Banco: tabelas `cda_whatsapp_*`, funções `cda_wa_*`, bucket privado `whatsapp-midias`,
    permissão `comercial/whatsapp` (somente acréscimos; nada existente alterado).

## Testes reais (conversa id 4 — Guilherme Emerick / cliente 78888479 "Teste do Guilherme da Effect")
| Teste | Resultado |
|---|---|
| Receber texto | ✅ 16:08 |
| Identificar cliente pelo celular | ✅ |
| Enviar resposta (janela 24h) | ✅ 16:32 — entregue, categoria `service`, não cobrável |
| 9º dígito (131030) | ✅ corrigido: tenta wa_id e depois a forma com 9 |
| Receber foto / áudio e guardar no Storage | ✅ 16:33 / 16:35 |
| Status "lida" (✓✓ azul) | ⏳ ficou "entregue" (pode ser confirmação de leitura desligada no celular de teste) |
| Criar lead / Diário / Tarefa pela tela | ⏳ não testado |

## Incidentes
- Token de acesso Meta (`EAAj…`) exibido em reunião gravada e registrado no log do webhook (16/11 15:26–15:28).
  Novo token gerado e gravado; **revogação do antigo ainda não confirmada**.
- Verificação da empresa na Meta **rejeitada** (país preenchido como "Other"); refazer com Brasil.

## Pendências — ver resumo em Word (Claude / Cardoso / Agência).

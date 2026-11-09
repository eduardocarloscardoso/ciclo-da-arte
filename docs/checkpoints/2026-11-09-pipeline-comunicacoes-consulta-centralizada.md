# Checkpoint — Comunicações da Campanha no Pipeline B2C

Data: 09/11/2026. Projeto Ciclo da Arte CRM/ERP.
Branch de homologação: `preview/campanha-mensagens`. Main/produção preservados.
Commit funcional: `107c2809a2e0ad37e824998fc7331443a37c97c4`.
Preview Vercel READY: https://ciclo-da-arte-ali2qd0yh-eduardocarloscardosos-projects.vercel.app

## Entregas
- Pipeline B2C: botão **Comunicações da Campanha** junto aos filtros, abre painel retrátil só de consulta. O filtro de campanha já existente restringe histórico; Todas as campanhas reúne todas, Sem campanha vinculada não mostra registros.
- O painel lê `cda_email_tentativas` e `cda_campanha_mensagens` via funções compartilhadas; informa totais de tentativas, aceitas, falhas, pendentes e tabela cronológica com mensagem, campanha, destinatários de teste, data, estado e ID Resend.
- Botão **Atualizar histórico** relê o Supabase, sem gravar nada.
- A consulta é independente de haver leads no Pipeline. Campanha Luedji Luna possui 1 teste registrado e zero leads no Pipeline.
- Campanhas → Resultados: retiradas tabelas detalhadas duplicadas de tentativas e último teste. Mantidos KPIs comerciais e resumo dos envios com contadores e instrução para consultar detalhes no Pipeline B2C. Botão Atualizar dados preservado.
- Sem alterações no Supabase, mensagens, destinatários, segmentação, LGPD, vendas ou envio; disparo em massa continua desabilitado.

## Validação
- Código dos dois módulos validado por análise sintática JS.
- Vercel READY para commit funcional.
- Consultado Supabase: histórico total 1, teste Luedji 1, lista congelada 861, leads Luedji 0.
- **Pendente:** homologação visual e funcional do usuário, principalmente filtro Luedji → botão Comunicações da Campanha e botão Atualizar histórico.

## Próximos passos
- Após homologação, definir eventual incorporação de eventos posteriores do Resend (entregue, rejeitado, aberto) com webhook autenticado; nunca inferir entrega a partir do status aceito.

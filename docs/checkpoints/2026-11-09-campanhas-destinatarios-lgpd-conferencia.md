# Checkpoint — Destinatários da Campanha, LGPD e conferência técnica

**Data:** 09/11/2026
**Projeto:** Ciclo da Arte CRM/ERP
**Branch:** `preview/campanha-mensagens`, sem merge para `main`.
**Commit funcional:** `9440af2608ae16b48ea92ba905b72d3658485aab`
**Preview Vercel READY:** https://ciclo-da-arte-h119ca2qd-eduardocarloscardosos-projects.vercel.app

## Escopo
- Em Comercial → Campanhas → Preparar Envio, substituir bloco 'Elegibilidade dos Destinatários' por 'Destinatários da Campanha'.
- Indicar lista congelada, e-mail válido e único, exclusões técnicas e duplicidades (resumo existente preservado).
- Remover classificação automática 'Pendentes de comprovação' / 'Aptos comprovados' para endereços válidos; situação por endereço agora é 'E-mail válido' ou 'Excluído tecnicamente'.
- Filtro dos registros: todos / válidos e únicos / excluídos tecnicamente.
- Exibir base legal e fundamentação copiadas do próprio registro da campanha, com nota de que registro não equivale a adequação jurídica automaticamente demonstrada e que eventuais oposições devem ser respeitadas.
- Não exigir consentimento individual quando a hipótese aplicável for legítimo interesse; não afirmar liberação jurídica automática.
- Botão Enviar Campanha permanece desabilitado, e a Visualização de Mensagem continua de leitura.

## Validação técnica
- JavaScript validado sintaticamente, deploy READY no Preview.
- Supabase: campanha Luedji Luna (id=4) mantém `lgpd_base_legal=legitimo_interesse`, fundamentação registrada, lista congelada 861, 853 e-mails válidos e 8 inválidos/ausentes.
- Não foram alterados registros, tabelas, mensagens ou destinatários.
- **Pendente:** homologação visual/funcional do usuário no navegador.

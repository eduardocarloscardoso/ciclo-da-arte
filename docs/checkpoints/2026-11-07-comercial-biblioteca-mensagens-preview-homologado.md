# Checkpoint — Comercial · Biblioteca de Mensagens de E-mail (Preview homologado)

**Data:** 07/11/2026 (America/Sao_Paulo)  
**Projeto:** Ciclo da Arte — CRM/ERP, módulo Comercial  
**Repositório:** `eduardocarloscardoso/ciclo-da-arte`  
**Branch de trabalho:** `preview/campanha-mensagens`  
**Commit funcional homologado pelo usuário:** `f0c3ecdd7d44a73bc03518450c12014366b903d7`  
**Vercel Preview confirmado READY:** `dpl_72uZ2hEGgEADxkPYZnnjst4d6ge4`  
**Preview:** https://ciclo-da-arte-29cli8m2o-eduardocarloscardosos-projects.vercel.app  
**Estado:** HOMOLOGADO PELO USUÁRIO NO PREVIEW (07/11/2026). Não publicado na `main` neste checkpoint.

## Confirmação do usuário
O usuário informou expressamente: **"esta tudo funcionando"** e solicitou a criação deste checkpoint. Esta confirmação homologa o estado atual do Preview da Biblioteca de Mensagens, sem exigir novos ajustes neste momento.

## Escopo implementado
- Biblioteca de mensagens de e-mail do módulo Comercial, com múltiplas mensagens por campanha.
- Listagem e operações Abrir, Editar, Duplicar, Enviar teste e Excluir.
- Editor reutilizado pela Biblioteca e pelo formulário da Campanha, com pré-visualização.
- Conteúdo do e-mail: assunto, prévia, imagem, título, saudação, corpo, cupom, CTA, informações adicionais, rodapé e opção de descadastro.
- Remetente e endereço de Responder para.
- Bloco padrão Fale Conosco · SAC, com e-mail e WhatsApp; endereço do showroom do Rio de Janeiro no rodapé.
- Teste de e-mail por Edge Function `enviar-email-teste` e serviço Resend, limitado a 3 destinatários; restrição de acesso à equipe autenticada.
- Ajustes finais: botão de teste somente muda após a confirmação, com retorno do estado após sucesso/erro/limite de 30 segundos; botões de e-mail em formato compatível com Outlook; links `mailto:` sem `target="_blank"`, evitando a aba em branco.

## Arquivos e referências técnicas
- `cda-modulo-mensagens.js`
- `cda-modulo-campanhas.js`
- `cda-dados-compartilhados.js`
- `docs/edge-functions/enviar-email-teste/index.ts`
- `docs/sql/comercial_campanha_mensagens.sql`
- `docs/sql/comercial_campanha_email_modelo.sql`
- `docs/MANUAL-DE-SISTEMAS.md`
- `cda-modulo-tutorial.js`
- `index.html`

## Governança / retomada
1. O estado funcional de referência é o commit `f0c3ecdd7d44a73bc03518450c12014366b903d7` da branch de Preview, **antes do commit documental deste checkpoint**.
2. Preservar a branch `preview/campanha-mensagens`; não realizar merge ou publicar produção sem solicitação expressa.
3. Não refazer funcionalidades homologadas e não presumir pendências.
4. Para retomar, consultar este checkpoint, o Manual de Sistemas e o histórico de commits/Preview. Validar mudanças incrementais antes de alterar código.
5. O checkpoint é apenas documental. Não altera tabelas Supabase, código funcional nem configuração de envio.

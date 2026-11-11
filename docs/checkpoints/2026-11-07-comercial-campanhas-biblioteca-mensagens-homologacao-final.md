# Checkpoint consolidado — Comercial · Campanhas + Biblioteca de Mensagens
**Data:** 07/11/2026 (America/Sao_Paulo)  
**Projeto:** Ciclo da Arte CRM/ERP  
**GitHub:** `eduardocarloscardoso/ciclo-da-arte`  
**Branch homologada funcionalmente:** `preview/campanha-mensagens`  
**Commit funcional de referência (antes deste checkpoint):** `5ebfb4aeef2dd387b6e6dfd997976de35eaef78d`  
**Vercel Preview READY:** `dpl_7bexQRFJ8rzZS8ZHyYbT55a4KsF7`  
**Preview validado:** https://ciclo-da-arte-r3djm24ec-eduardocarloscardosos-projects.vercel.app  
**Situação:** homologado pelo usuário em Preview, com confirmação expressa "funcionou tudo". **Não há autorização implícita para merge à `main` ou disparo de e-mails em massa.**

## Escopo homologado
1. Biblioteca de Mensagens do Módulo Comercial integrada às Campanhas: criar, editar, duplicar, abrir/visualizar, excluir e envio controlado de teste.
2. Mensagem de e-mail com remetente, responder para, assunto, prévia, imagem de flyer, título, saudação, conteúdo, cupom, CTA, informações adicionais, SAC e rodapé.
3. Bloco **Fale Conosco · SAC** com botões **Enviar e-mail (azul)** e **WhatsApp (verde)** lado a lado, compatíveis com o Outlook; endereço do showroom do Rio de Janeiro no rodapé.
4. Botão **Enviar teste** na própria aba de visualização aberta pela Biblioteca, ao lado dos botões SAC **apenas no Preview**, sem compor o HTML enviado ao destinatário. Diálogo de destinatários permite até três e-mails e Cancelar/Esc sem envio.
5. Botão **Abrir** atualizado para consultar a mensagem mais recente no banco antes de renderizar a pré-visualização; resolve dados desatualizados após upload do flyer.
6. Foto original do flyer de Luedji Luna para campanha no Cine Joia, cupom **LUEDJI20**, enviada pelo usuário e armazenada no bucket público `campanhas-email` do Supabase. Usuário confirmou exibição tanto no e-mail do Outlook quanto no botão Abrir.
7. Filtro de seleção em **Campanhas**: todas as campanhas ou uma campanha específica, no padrão da Biblioteca.
8. As funcionalidades e conteúdos já existentes foram preservados.

## Parâmetros operacionais
- Repositório: `eduardocarloscardoso/ciclo-da-arte` — não confundir com `ciclo-plataforma-cultural`.
- GitHub `main`: fonte de verdade da produção; branch de homologação `preview/campanha-mensagens`.
- Vercel projeto `ciclo-da-arte` no escopo autenticado; nas operações com conector omitir `teamId`.
- Supabase projeto oficial do Ciclo da Arte: `gsizoiwefejsllgtsard`. Bucket público das imagens: `campanhas-email`.
- Fluxo de governança: inspecionar estado atual → alteração mínima → commit → Preview Vercel READY → validação pelo usuário → merge à main somente mediante autorização.
- Arquivos principais: `cda-modulo-campanhas.js`, `cda-modulo-mensagens.js`, `cda-dados-compartilhados.js`, `index.html`; documentação `docs/MANUAL-DE-SISTEMAS.md`.
- Ao retomar, consultar também o checkpoint inicial `docs/checkpoints/2026-11-07-comercial-biblioteca-mensagens-preview-homologado.md`.

## Próxima etapa proposta (NÃO implementada)
**Campanhas → Envio operacional controlado de e-mail**: escolher campanha e mensagem, validar lista congelada e e-mails válidos, verificar consentimento/descadastro e elegibilidade, prévia dos destinatários, autorização e confirmação antes de envio, definir limites e lotes, registrar rastreabilidade/status/erros e métricas básicas. Concluir desenho funcional e requisitos de segurança/compliance antes de implementar ou realizar disparos reais.

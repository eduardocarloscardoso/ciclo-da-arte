# Checkpoint — Campanhas de Shows · ARTISTA · PRAÇA · PÚBLICO

Data 10/11/2026. Repositório `eduardocarloscardoso/ciclo-da-arte`, branch `preview/campanha-mensagens` sem merge em main.

## Decisão funcional
Biblioteca de Conteúdos tem categoria `Campanhas de Shows` e modelo estrutural `ARTISTA · PRAÇA · PÚBLICO` para preparar comunicação de shows futuros sem reutilizar por engano dados específicos de outra campanha.

## Registros efetivos em Supabase
- Migração adicionou categoria, referência opcional a mensagem de origem, estrutura JSON do modelo e tipo `modelo` em `cda_biblioteca_conteudos` (nova estrutura compartilhada com produção, sem mexer em mensagens originais).
- Foram cadastrados como referências à mensagem existente ID=1 da campanha Luedji Luna · São Paulo (ID=4): (1) imagem/flyer URL do arquivo original (sem duplicação de arquivo), (2) oferta cupom LUEDJI20, (3) link de ingressos. Todos em `em_revisao`, com observações de revisão de autorização/validade.
- Modelo de campanha ID=4, tipo `modelo`, situação `rascunho`, categoria `campanhas_shows`, título `Campanhas de Shows · ARTISTA · PRAÇA · PÚBLICO` e estrutura `campos_obrigatorios` artista, praça, público; campos complementares data, local, objetivo, mensagem, flyer, oferta, CTA, canal, remetente, Reply-To, elegibilidade, aprovação.
- O registro do modelo apenas descreve um gabarito. Não cria campanha nem público nem envia comunicação.

## Interface implementada
- Biblioteca de Conteúdos: filtro de categoria `Campanhas de Shows`, filtro de tipo `Modelos de campanha`, coluna Categoria e indicação da mensagem de origem para referências.
- Novo/Editar material com categoria e tipo modelo.
- Ação `Usar como base` preenche um cadastro novo, preservando os campos estruturais do gabarito; para modelos inicia título com placeholders de outro artista/praça/público e não copia link, imagem, oferta, cupom ou destinatários da Luedji. Salvar cria um novo item na Biblioteca, não uma campanha.

## Verificações
- 4 registros no acervo: flyer, oferta, link e modelo genérico.
- JavaScript sintaticamente válido, deploy Vercel READY: https://ciclo-da-arte-ha378aio0-eduardocarloscardosos-projects.vercel.app
- Commits: `0f975acac1089aff8343d66441ce2ee382d798fe`, `ff3a1c6764821ae3ad554fd2944eb6b93d372d2f`, cache `b8f70799ead4269e56c1563f49d3fae8f8335354`.

## Pendências
- Homologação visual da categoria e ação Usar como base.
- Posteriormente, criar função explícita de instanciar nova Campanha usando modelo, selecionando artista/praça/público e conteúdos aprovados, sem duplicar clientes de outra campanha e sem envio automático.
- Verificar direitos e validade de flyer/oferta/link; implementar fluxo de aprovação do conteúdo.
- O descadastramento de marketing ainda precisa de implementação antes de qualquer envio em massa.

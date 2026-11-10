# Checkpoint — Lista de homologação Luedji Luna · São Paulo — 10/11/2026

## Situação realizada
- Criadas no Supabase oficial (projeto `gsizoiwefejsllgtsard`) as tabelas `public.cda_homologacao_pessoas` e `public.cda_homologacao_destinatarios`, com RLS de equipe e vínculo `campanha_id`.
- Campanha 4 — Luedji Luna · São Paulo.
- Eduardo Carlos Cardoso — `cardoso@epcparticipacoes.com.br` (principal) e `cardoso@databras.com.br` (adicional).
- Erik Cardoso — `erik@epcparticipacoes.com.br` (principal).
- CLEIDIANE FERREIRA LIMA — `cleide@epcparticipacoes.com.br` (principal).
- Verificado: 3 Pessoas, 4 e-mails ativos, nenhuma alteração nos 867 leads da campanha e zero envios oficiais.
- Essa estrutura é de homologação e não altera os cadastros comerciais em `clientes` nem login de `equipe`.

## Atenção: divergência em cadastro preexistente
- Na tabela `equipe`, o e-mail `cleide@epcparticipacoes.com.br` já consta vinculado ao nome "Cleide Mendonça" (registro existente). NÃO renomeamos nem duplicamos a credencial de acesso; o nome solicitado "CLEIDIANE FERREIRA LIMA" foi usado na lista de homologação. Revisão do cadastro de acesso exige confirmação separada.

## Próximas etapas
- Implementar UI de gestão/seleção da lista de homologação no Preview.
- Implementar motor de envio controlado reutilizável para listas com rastreabilidade por destinatário, proteção contra duplicados e autorização expressa.
- Não disparar e-mail oficial nem de teste automaticamente.
- Não tocar na branch `main` sem autorização.

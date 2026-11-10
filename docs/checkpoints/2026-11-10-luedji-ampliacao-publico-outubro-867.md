# Checkpoint: ampliação público Luedji Luna · São Paulo — 10/11/2026

## Contexto
Campanha id 4. Após importação e conciliação de vendas outubro 2026, verificados 14 novos clientes de SP com email válido e compras B2C no centro 3 (E-COMMERCE LUEDJI LUNA) ou 19 (SHOWS LUEDJI LUNA), dentro dos filtros de Conta 1, Grupos 22/15, Subcontas 3/7, centros 3/19. Ausência de correspondência com destinatários e leads existentes, incluindo por email normalizado.

## Operação realizada
Por autorização explícita do usuário ('siga'), adicionados apenas 14 clientes ao `cda_campanha_destinatarios` (sem recongelar ou alterar os 861 registros de 07/11) e 14 leads na etapa `novo_lead` em `leads_b2c`, sem responsável e com observação de origem. Operação transacional com pré-condições e validação de contagens; IDs de destinatários gerados pela identidade padrão do banco.

## Conferência pós-inclusão
- Lista: 875 destinatários totais, 867 emails válidos e distintos, 8 inválidos originais.
- Originais preservados: 861; novos: 14.
- Pipeline: 867 leads, 14 novos; todos em `novo_lead`.
- 0 destinatários válidos sem lead.
- E-mail Resend: 2 tentativas de teste históricas e 0 envios oficiais.

## Próximo passo
Homologação visual no Comercial → Pipeline B2C / Campanhas; depois testes de envio APENAS para 1-3 emails internos autorizados por operação. Nenhum envio oficial aos 867 autorizado ou executado. Nenhuma regra financeira ou código de produção alterado nesta etapa.

# Checkpoint — Preparar Envio · Preview homologado

**Data:** 09/11/2026
**Projeto:** Ciclo da Arte CRM/ERP · Comercial
**GitHub:** `eduardocarloscardoso/ciclo-da-arte`
**Branch:** `preview/campanha-mensagens`
**Commit funcional homologado pelo usuário:** `bc9a37f54a368d384fdc665850c500703e4cb8ad`
**Vercel Preview READY:** https://ciclo-da-arte-hormkyzh8-eduardocarloscardosos-projects.vercel.app
**Confirmação do usuário:** "funcionou" sobre substituição da pré-visualização embutida pelo botão Visualizar Mensagem.

## Funcionalidades homologadas
- Campanhas possuem ação **Preparar Envio**; não existe disparo real de e-mail em massa.
- Janela de conferência mostra campanha, dropdown das mensagens vinculadas, origem/data da lista congelada e contagens de válidos únicos, sem e-mail/inválidos e duplicados.
- Paginação da lista de destinatários pré-selecionados; rolagem e cabeçalho/rodapé acessíveis.
- **Visualizar Mensagem** substitui iframe embutido e reutiliza o botão **Abrir** da Biblioteca, abrindo o e-mail completo em outra aba.
- Ação de envio segue **desabilitada**.
- Exemplo Luedji Luna · São Paulo: 861 registros congelados, 853 e-mails sintaticamente válidos e únicos, 8 sem e-mail/inválidos, 0 duplicados. Mensagem **Convite com cupom LUEDJI20**, com flyer restaurado.

## Observações técnicas e governança
- Supabase do CRM/ERP: `gsizoiwefejsllgtsard`. Tabelas `cda_campanhas`, `cda_campanha_destinatarios`, `cda_campanha_mensagens`.
- Arquivos: `cda-modulo-campanhas.js`, `cda-modulo-mensagens.js`, `cda-dados-compartilhados.js`, `index.html`.
- GitHub `main` e produção não alterados. Preservar branch Preview e os checkpoints anteriores de Campanhas/Biblioteca.
- Observação de segurança: e-mail válido e único não equivale a consentimento. Inspeção de colunas públicas no Supabase em 09/11 não localizou campos com nomes evidentes para consentimento, opt-out, descadastro ou bloqueio. É necessária análise de governança e fontes de autorização/supressão antes de permitir envio.

## Próxima etapa proposta — não implementada
- Verificar origem/comprovação de permissões de contato para fins promocionais e formas de revogação/descadastro.
- Implementar registro controlado de consentimento/supressão, tratamento de bloqueios e classificação da elegibilidade antes de considerar qualquer autorização.
- Apresentar totais aptos, pendentes e excluídos com motivos e auditoria. Manter disparo em massa desabilitado até homologação expressa.

# CHECKPOINT — CADASTRO UNIFICADO DA LISTA DE HOMOLOGAÇÃO
Data: 10/11/2026. Branch `preview/campanha-mensagens`.
Commit de implementação: `904b6d66de86dfe88bc8e4ca8808e7e92bc3aa5c`.

## Simplificação solicitada
A aba Destinatários possuía três interfaces redundantes: Cadastrar/editar pessoa, Adicionar/editar e-mail, Gerenciar cadastro global de pessoas.
Agora existe somente um painel **Adicionar pessoa ou e-mail**. Nele:
- Seleção vazia: cadastrar nova pessoa com seu primeiro e-mail em um fluxo.
- Seleção de pessoa já cadastrada: adicionar e-mail adicional, sem novo cadastro duplicado.
- Tabela única com colunas Pessoa, E-mail, Tipo, Situação e Ações.
- No controle Gerenciar da linha, ações **Editar pessoa** e **Editar e-mail** abrem o mesmo formulário contextual, além de principal, ativar/desativar e excluir e-mail.
- A opção **Excluir pessoa sem vínculos** fica nesse formulário e exige ausência de associações com qualquer campanha; não existe segunda lista global.
- Pessoas com e-mails em outra campanha continuam disponíveis no seletor.
- Aba Operação do Lote e todas as travas de envio preservadas.

## Controle de mudanças
Apenas `cda-modulo-homologacao.js` e `index.html` alterados. Sem alterações de tabelas, Edge Functions, dados comerciais, fórmula, main ou produção.
Lote #1 confirmado preparado, cinco pendentes, nenhuma tentativa vinculada. Nenhum envio.
Preview READY: `https://ciclo-da-arte-6wxnlx88f-eduardocarloscardosos-projects.vercel.app`.
Homologação visual pendente; edição e persistência do novo formulário não testadas com escrita, para não modificar cadastros sem autorização.

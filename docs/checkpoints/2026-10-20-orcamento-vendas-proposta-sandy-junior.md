# CHECKPOINT — Orçamento Vendas / Sandy Junior 2027
Data: 20/10/2026, horário de Brasília. Estado verificado diretamente em GitHub, Vercel e Supabase.

## Escopo e regras
Continuar o aplicativo existente ciclo-da-arte. NÃO confundir com ciclo-plataforma-cultural (Portal), outro repositório e outro Supabase.
Não reiniciar, redesenhar ou alterar outros módulos. GitHub main é fonte da verdade. Fluxo para mudanças de código: consultar fonte atual → editar → commit main → aguardar deploy automático Vercel READY → validação visual do usuário.
Usuário autoriza continuidade com siga/ok; não pedir confirmações rotineiras.
Não usar percentuais antigos de memórias/Excel quando o banco atual os substituir.
Conversa anterior perdeu apenas o ambiente local de arquivos; GitHub/Supabase/Vercel continuaram acessíveis. Outra conversa consegue ler Word. Isso não prova erro no arquivo.
Não alegar teste visual autenticado sem realizá-lo.
A geração de documentos deve ler o Word anexado na nova conversa, preservar seus textos e regenerar tabelas numéricas com dados próprios atuais do projeto.
Não reintroduzir royalties no texto do Anexo 02 se ausentes no texto final do usuário. No Anexo 01 manter a cláusula fornecida.
Correção expressa no corpo: “a articulação com o parceiro de fabricação” → “a fabricação”.

## Infraestrutura — identificadores, sem segredos
GitHub: eduardocarloscardoso/ciclo-da-arte
URL: https://github.com/eduardocarloscardoso/ciclo-da-arte
Branch main; repo ID 1225068467.
Arquivo principal cda-modulo-orcamento-vendas.js; index.html carrega script com cache versionado.
JS blob SHA conferido: 2ef3956e3dd1f0828de0d4471cdb6b64689a5c58. SEMPRE buscar SHA atual antes de editar.
Commit funcional conferido: eabc4defe35b51ad15bdad7fdcfb3e894a593aef.
Vercel projeto ciclo-da-arte; projectId prj_kHAlkCLZ0frvSDdBUTRyt9mhSnRG; teamId team_ZFV9Amn9eObWPwL4XinJTFLO.
Produção https://ciclo-da-arte.vercel.app
Deployment funcional conferido dpl_FHedKaTSiXQc2TSyFLZU4M73sCc6, production READY, main/eabc4defe35b51ad15bdad7fdcfb3e894a593aef.
Scope eduardocarloscardosos-projects.
Usar conectores autenticados existentes; não solicitar tokens. Este checkpoint adicionará um commit documental posterior ao funcional.
Supabase project_id gsizoiwefejsllgtsard.
Projeto Projeto Sandy Junior 2027: de6792a0-433f-49f9-8440-c7bc6d1fe119.
Tipo 01 Shows/Eventos: 727e5cc1-5410-40c8-97b2-a0bb1dee1507; projeto_tipo_id 0800fab6-12c0-4f53-94af-9749e5b98e1c.
Tipo 02 E-Commerce: e0f03209-b745-4964-af0b-6675e5bf4dc3; projeto_tipo_id 738ecbc6-db21-4ad7-a420-8050b3ef0ffb.

## Ferramentas e acesso
Descobrir ferramentas disponíveis por ALL_TOOLS, sem imprimir registro completo.
github_fetch_file({repository_full_name,path}) → structuredContent.content e sha.
github_update_file({repository_full_name,path,branch:"main",sha,content,message}).
supabase_execute_sql({project_id,query}) para consultas/DML; apply_migration para DDL.
vercel_list_deployments({projectId,teamId,sha,limit:1}); get_deployment({idOrUrl,teamId}).
Não gerar deployment duplicado se Git integration já estiver construindo o commit.

## Dados
cda_orc_tipos_projeto; cda_orc_projetos; cda_orc_projeto_tipos.
cda_orc_padroes_tipo: tipo_id,chave,conteudo JSON (compartilhados).
cda_orc_categorias: tipo_id,codigo,pai_id,nivel,ordem,nome,ativo,descritivo_calculo.
cda_orc_formulas_categoria: categoria_id,definicao JSON.
cda_orc_cadastros_projeto: projeto_tipo_id,chave,conteudo JSON,gerado_em; snapshots próprios independentes.
Chaves: categorias,premissas,dimensionamento,funcoes,produtos,participantes,calculos,participacao. As duas últimas não aparecem nos menus; rateio está em 90/91/92.
Não usar projeto_tipos.parametros legado nos cálculos. O resumo legado foi retirado da tela para não exibir público antigo.
Participantes reais: Ciclo Arte (Owner Products), Sandy & Junior (Cultural), Dimona (Fabricação); fornecedores/prestadores futuros não adicionar agora.

## Sincronização implementada e homologada
Botão “Atualizar a partir dos cadastros compartilhados” após “Consultar resultados”, no cartão de cada tipo dentro do projeto.
RPC cda_orc_atualizar_cadastros(vinculo uuid,anterior jsonb,padrao jsonb).
Fonte cda_orc_previa_cadastros(vinculo) reúne categorias+fórmulas e padrões. Atualiza os 8 snapshots em transação única; cria faltantes; preserva IDs existentes por upsert; atualiza gerado_em.
Janela confirma substituição geral por tipo, inclusive vazios e edições próprias. Outros tipos, identidades globais e propostas emitidas preservados.
Checa snapshots anteriores e padrões atuais; se mudaram desde a abertura, aborta tudo. Segurança invoker, RLS e permissão módulo escrita; anon sem EXECUTE.
SQL versionado database/orcamento_atualizar_cadastros_por_tipo.sql.
Usuário confirmou “funcionou” e sincronizou os dois tipos. Banco confirmou premissas abaixo.
Gerar cadastros antigo apenas cria faltantes e não substitui existentes.
Resultados Type02 ainda não habilitados na consulta gerencial geral (bloqueio tipo!=1). NÃO afirmar que estão prontos. Fórmulas de categorias Tipo02 calculam normalmente.

## Premissas próprias atuais — verificadas
Tipo01: publico_total 408000; shows10; público/evento40800; ticket120; cenários5/7/9%.
Tipo02: visitantes_periodo408000; meses12; visitantes_mensais34000; ticket180 (produtos sem frete); cenários1/2/3%.
visitantes_mensais é derivado de visitantes_periodo/meses por orcVisitantesMensais; apresentação inteira por orcVisitantesExibir, precisão interna mantida.
Tipo02 dimensionamento e funções profissionais “Não se Aplica a este tipo de Projeto”.
Shows lojas 4/6/7,25m² por loja, capacidade500 compradores/loja, vendedores4,estoquista1,apoio1 por loja. Manter 7 no otimista. Designer Visual Merchandising é profissional da Ciclo para vitrinas; designer criação dos produtos tem negociação específica fora da proposta final fornecida.

## Categoria2 e participação — matriz única
2=sum ativas2.1+2.2+2.3+2.4, sem raiz5.
2.1 comercial percentual da receita bruta produtos.
2.2 financeiro percentual da receita bruta produtos.
2.3 tributos=(receita bruta−SOMENTE desconto comercial)×alíquota.
2.4 frete estimado=receita bruta×percentual_frete; imposto=frete×alíquota. SÓ imposto integra categoria2. Frete não aumenta receita de produtos nem é deduzido outra vez.
Tipo01: comercial5%,financeiro5%,tributo10%,frete0%,imposto frete0%,cultural25%.
Tipo02: comercial10%,financeiro10%,tributo10%,frete5%,imposto frete10%,cultural20%.
Categoria3 participação=(receita1−categoria2)×percentual cultural.
Cada imposto/custo deduzido uma vez.
Outras categorias devem ser lidas novamente do banco caso precise reconstruir DRE. Categoria90 lucro,91parcela+admin6,92parcela+fabricação4; não novas despesas nem confundir com categoria3 cultural.

## Valores conferidos — Pessimista / Conservador / Otimista
Tipo01, por evento:
Receita 244800 /342720 /440640.
Descontos categoria2 47736 /66830.40 /85924.80.
Base cultural197064 /275889.60 /354715.20.
Participação25%49266 /68972.40 /88678.80.
Tipo01 total10eventos:
Receita2448000 /3427200 /4406400.
Descontos477360 /668304 /859248.
Base1970640 /2758896 /3547152.
Participação492660 /689724 /886788.
Tipo02 mensal:
Receita61200 /122400 /183600.
Descontos18054 /36108 /54162.
Base43146 /86292 /129438.
Participação20%8629.20 /17258.40 /25887.60.
Tipo02 total12meses:
Receita734400 /1468800 /2203200.
Descontos216648 /433296 /649944.
Base517752 /1035504 /1553256.
Participação103550.40 /207100.80 /310651.20.
Resumo cultural, total dos dois tipos por cenário:
596210.40 /896824.80 /1197439.20.
Somar totais10eventos+12meses; nunca somar valor/evento a valor/mês. Públicos não devem ser somados como pessoas únicas.

## Proposta — confirmação corrigida do estado
Tabela cda_orc_propostas: projeto_id,numero,versao,titulo,conteudo JSON,ativo.
Número101026.
V4 ATIVA ID d987aeb7-122e-4c13-8bf8-35e15dc82ae1. V1,V2,V3 inativas.
IMPORTANTE: a chamada de gravação da V4 foi interrompida antes da resposta, e por isso o assistente havia informado erroneamente que permanecia V3. Consulta posterior confirmou V4 realmente gravada. Não duplicar V4.
Origem V4: textos finais colados pelo usuário em20/10, fabricação corrigida,408000 nos dois tipos,consolidado após Anexo02.
V4 contém corpo final com negociação específica designer, seleção/contratação do(s) parceiro(s) de fabricação pelaCiclo e assinaturas em tabela lado a lado.
Anexo01 no formato simplificado: intro+cenários;1Premissas;2Participação;matrizevento;matriz10eventos. Descontos agregados em uma linha.
Anexo02 mesmo formato: intro+cenários;1Premissas;2Participação;matrizmensal;matriz12meses. Texto final não inclui a cláusula de royalties que consta no Anexo01.
Resumo consolidado foi acrescentado ao final dos blocos do Anexo02 (não como terceiro Tipo de Projeto).
Conteudo={corpo:[{tipo:"texto",texto,estilo}|{tipo:"tabela",linhas:[header,...]}],anexos:[{tipo_codigo:1|2,titulo,blocos:[...]}],origem}.
Aplicativo Proposta Comercial consulta/edita textos/exporta DOCX nativo/Imprimir PDF. Exporta snapshots salvos; não recalcula automaticamente quando os cadastros mudam.
PowerPoint NÃO implementado.
Não presumir que o arquivo Word em Library V4 antigo seja atualizado: o arquivo foi produzido ANTES do público408000. A proposta DB V4 e arquivoWordV4 são estados diferentes.
Se Word final novo trouxer mudanças frente aoDBV4, reconciliar e atualizar com controle de concorrência ou criar versão posterior preservando histórico. Nunca sobrescrever textos finais comV3.

## Arquivos e próximos passos
Usuário vai anexar na nova conversa o Word final cuja redação deve prevalecer. Ler diretamente o arquivo anexado local, sem Library read para anexos disponibilizados emscratch.
Último Word enviado anterior: Proposta_Comercial_Sandy_Junior_2027_V3_Anexos_01_02 (3)(1).docx, Library libfile_3f4af87de140819182df2359b18d2a0a.
WordV4 gerado antes de408000: libfile_783b0b11017881919fed41d724adb793; NÃO entregar comoatual.
Ambiente desta conversa indisponível; nova deve usar documentos/PDFskills, preservar textos Word, recriar todas as tabelas de premissas e cálculo comdadosprojeto atuais, incluir resumo apósAnexo02, renderizar e inspecionar todasaspáginas, salvarWordePDF e entregarlinks.
Conferir oDBV4 járegistrado contraWordfinal e exportação noapp. Usuário quer emissão também peloaplicativo.
Não criar ambienteReplitouSitepara contornar indisponibilidade.

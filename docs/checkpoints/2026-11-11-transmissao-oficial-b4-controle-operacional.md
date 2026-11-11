# Checkpoint B4 — Controles operacionais universais sem executor (11/11/2026)

## Situação
- Projeto: `eduardocarloscardoso/ciclo-da-arte`
- Branch exclusiva de desenvolvimento: `preview/transmissao-oficial-universal`
- Production/`main`: NÃO modificada
- Transmissão nº 1 / Luedji Luna: 867 destinatários congelados, 29 lotes, 1 revisão B3 já realizada

## Implementado
- Plano de controle B4 por transmissão: estado `pausado` / `planejamento`; limites máximos por minuto, hora, dia e lote com validação server-side.
- Revisão múltipla de lotes pendentes e/ou revogados, em uma única transação, com hash SHA-256 por lote, checagem da contagem congelada e auditoria individual.
- Pré-aprovação administrativa individual de lote já revisado, com revogação, assinatura SHA-256 e rastreabilidade. **Pré-aprovação não é autorização real para envio.**
- Interface em Comercial → Pipeline B2C → Transmissão Oficial, na seção B4. Confirmações textuais embutidas na tela (não dependem de prompt nativo).
- Todos os endpoints B4 exigem administrador autenticado de `auth.users` vinculado a `equipe.is_admin`.
- Tabelas internas `cda_transmissao_controles_b4`, `cda_transmissao_preaprovacoes_b4` com RLS ativo e nenhum acesso direto aos papéis anon/authenticated; RPCs controladas exclusivamente.
- Prevenção de duplicidade: identidades únicas por lote de origem, fingerprints calculados para revisão e pré-aprovação; auditoria e chaves de idempotência mantidas na estrutura B2/B3.
- Pausa/retomada se refere SOMENTE à situação administrativa de planejamento. Não existe executor para pausar/retomar nesta fase.
- LGPD e preferências continuam acompanhadas separadamente, sem interromper evolução, mas antes de qualquer disparo real devem ser cumpridos controles aplicáveis.

## Segurança
- `habilitado=false` é imposto por CHECK em transmissões, lotes e controle B4.
- `autoriza_envio=false` imposto por CHECK nas pré-aprovações.
- Nenhuma função B4 chama Resend, executa filas, altera `autorizado_em`, gera autorização de transmissão real ou desbloqueia envio.
- Dados B4 sem registros até a homologação do usuário; nenhum lote foi alterado por implantação.

## Dados verificados
- Uma transmissão, 29 lotes, um lote revisado, zero controles B4, zero pré-aprovações, zero lotes habilitados, zero transmissões habilitadas.
- RPCs B4 têm SECURITY DEFINER com verificação interna de administrador; anon sem permissão de execução.
- JS parse validado.

## Homologação visual sugerida
1. Abrir Preview, seção B4.
2. Salvar limites sugeridos (10/min, 120/h, 300/dia, 100/lote) em estado pausado.
3. Confirmar que os limites persistem após Atualizar controles e Ctrl+F5.
4. Opcionalmente pré-aprovar somente o lote nº 1 já revisado: continua sem envio.
5. Revisão múltipla dos 28 restantes é possível, mas não precisa ser feita até aprovação do usuário; a confirmação é explícita.
6. Não promover `main` nem enviar mensagens sem homologação e autorização específicas.

## Próximo marco
B5: autorização operacional real, controle de ritmo do executor isolado de homologação, retomada segura, webhook Resend, monitoramento, disponibilidade apenas após auditoria e confirmação administrativa distinta. Nenhum envio real foi solicitado/efetuado na B4.

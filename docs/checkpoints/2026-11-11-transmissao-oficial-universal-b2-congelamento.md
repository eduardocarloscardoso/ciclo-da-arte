# Checkpoint B2 — Congelamento oficial auditável (11/11/2026)

## Escopo
Projeto: `eduardocarloscardoso/ciclo-da-arte`.
Branch: `preview/transmissao-oficial-universal`.
Base: `main` Production homologada, mantida inalterada nesta fase.
Módulo: Comercial → Pipeline B2C → Transmissão Oficial.

## Realizado
- Operação B2 de congelamento persistente em PostgreSQL com função `cda_congelar_transmissao_oficial_b2(campanha,mensagem,tamanho_lote)`.
- Restrita a administrador autenticado por Supabase Auth e cadastro `equipe.is_admin`; sem permissão para acesso anônimo.
- Confirmação explícita `CONGELAR LISTA` antes de gravar; não se confunde com enviar.
- Verificação server-side de vínculo mensagem/campanha, fundamentação e finalidade LGPD cadastradas, assunto preenchido, seleção congelada 1–20.000, tamanho 1–1.000.
- Seleção reproduzida no servidor para validade sintática, normalização, deduplicação por endereço e exclusões da tabela de supressões, com totais de exclusão por motivo em auditoria.
- Bloqueio transacional de concorrência para mesmo par campanha/mensagem e índice impedindo segunda transmissão congelada para a mesma mensagem e campanha.
- Registro persistente de snapshots do assunto, conteúdo, remetente/Reply-To, base legal/finalidade e SHA-256; criação de lotes e itens com idempotência única.
- Controle `habilitado=false` no plano e em todos os lotes, reforçado por CHECK no banco; `validacao_lgpd_pendente=true`.
- Consulta exclusiva de administrador `cda_consultar_transmissoes_b2`: exibe lotes, totais e fingerprint, não expõe dados da lista inteira no retorno.
- Interface com botão de congelar desabilitado para não administradores e até cumprir as condições; histórico da campanha/mensagem.
- As tabelas de transmissão oficial usam RLS e não são acessíveis diretamente a papéis `anon` e `authenticated`; operações são por RPC controlada.

## Evidências
A migração B2 foi aplicada no Supabase do Ciclo da Arte.
Consulta confirmou: 0 planos oficiais, 0 lotes oficiais, 0 destinatários oficiais em lotes e 0 auditorias B2 antes de qualquer confirmação do usuário. A campanha Luedji Luna continua com 867 e-mails sintaticamente válidos.
Sintaxe do frontend validada; autorização real pelo usuário e teste em navegador dependem da homologação visual.

## Não realizado — fases futuras
- Não foi criado executor de envio oficial ou integração com Resend para lotes oficiais.
- Não há autorização comercial para transmissão oficial, agendamento, nem desbloqueio.
- Conferência de pedidos de oposição e descadastro ainda pendente; cadastro de base legal não é por si só autorização.
- É necessário projetar governança e consentimento/oposição, rate limit, integração Resend, conciliação, permissão revogável e validação antes da primeira transmissão real.
- Somente publicar em `main` após homologação específica e autorização de promoção do usuário.

## Teste funcional recomendado
Na campanha selecionada: conferir 867 endereços tecnicamente válidos; usar 30 por lote e congelar conscientemente (sem envio); observar transmissão persistida com 29 lotes e flag envio bloqueado; recarregar e confirmar idempotência/impedimento de congelamento duplicado.

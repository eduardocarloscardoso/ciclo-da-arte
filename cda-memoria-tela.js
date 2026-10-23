// ════════════════════════════════════════════════════════════════════
// cda-memoria-tela.js — lembra a última tela aberta (out/2026)
// Ao atualizar a página (F5 / Ctrl+Shift+R), o hub volta para o mesmo
// módulo e submódulo em que o usuário estava. No Planejamento Anual também
// guarda os filtros (ano, mês, conta, subconta, trimestre, status, modo).
//
// Como funciona: envolve as funções de navegação do hub (openProject,
// navigateCRM, navigateMkt, navigate, navigateOrcamento, navigatePlanejamento)
// e grava a última chamada no localStorage do navegador, por usuário.
// initApp() chama cdaRestaurarTela() depois de restaurar a sessão.
// Carregar DEPOIS do script principal do index.html e ANTES de initApp().
// ════════════════════════════════════════════════════════════════════
(function () {
  var PREFIXO = 'cda_ultima_tela_v1:';
  var FUNCOES = ['openProject', 'navigateCRM', 'navigateMkt', 'navigate', 'navigateOrcamento', 'navigatePlanejamento'];
  var CAMPOS_PA = ['ano', 'mes', 'tipo', 'subcontaId', 'sintetico', 'busca', 'mesComp', 'trim', 'statusMeta', 'grupoAberto'];
  var restaurando = false;

  function chave() { return PREFIXO + ((window.cu && cu.email) || '').toLowerCase(); }

  function salvar(fn, arg) {
    if (restaurando || !window.cu) return;
    try {
      var d = { fn: fn, arg: arg, proj: window.currentProject || null, em: Date.now() };
      if (window.currentProject === 'planejamento_anual' && window.paEstado) {
        d.pa = {}; CAMPOS_PA.forEach(function (k) { if (paEstado[k] !== undefined) d.pa[k] = paEstado[k]; });
      }
      localStorage.setItem(chave(), JSON.stringify(d));
    } catch (e) { /* navegador sem localStorage: segue sem lembrar */ }
  }

  FUNCOES.forEach(function (nome) {
    var original = window[nome];
    if (typeof original !== 'function') return;
    window[nome] = function (arg) {
      var r = original.apply(this, arguments);
      salvar(nome, arg);
      return r;
    };
  });

  // Filtros do Planejamento Anual mudam sem trocar de tela: grava ao sair da página.
  window.addEventListener('beforeunload', function () {
    if (!restaurando && window.currentProject === 'planejamento_anual' && window.paEstado) salvar('navigatePlanejamento', paEstado.page);
  });

  window.cdaRestaurarTela = async function () {
    var d = null;
    try { d = JSON.parse(localStorage.getItem(chave()) || 'null'); } catch (e) { d = null; }
    if (!d || !d.proj) return false;
    // Respeita permissões atuais (podem ter mudado desde a última visita).
    if ((d.proj === 'credenciamento' || d.proj === 'seguranca') && !(window.cu && cu.is_admin)) return false;
    if (window.PROJETOS && PROJETOS[d.proj] && typeof canAccessProject === 'function' && !canAccessProject(d.proj)) return false;
    restaurando = true;
    try {
      if (d.pa && window.paEstado) Object.keys(d.pa).forEach(function (k) { paEstado[k] = d.pa[k]; });
      if (d.fn === 'openProject') await window.openProject(d.arg);
      else if (d.fn === 'navigatePlanejamento') await window.navigatePlanejamento(d.arg);
      else if (d.fn === 'navigateOrcamento') { await window.openProject('orcamento_vendas'); window.navigateOrcamento(d.arg); }
      else { await window.openProject(d.proj); await window[d.fn](d.arg); }
      return true;
    } catch (e) {
      console.warn('[memória de tela] não foi possível restaurar a última tela', e);
      return false;
    } finally {
      restaurando = false;
      salvar(d.fn, d.arg);
    }
  };
})();

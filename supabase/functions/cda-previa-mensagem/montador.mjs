export function cdaPrimeiroNome(nome) {
  const p = String(nome || '').replace(/[()\[\]]/g, ' ').trim().split(/\s+/)[0] || '';
  return p ? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() : '';
}

function cdaUfDe(cliente) { return String((cliente && cliente.estado) || '').trim().toUpperCase(); }

function cdaVariaveisEmail(texto, cliente) {
  const c = cliente || {};
  const nome = cdaPrimeiroNome(c.nome) || 'cliente';
  return String(texto || '')
    .replace(/\{nome\}/g, nome).replace(/\{nome_completo\}/g, (c.nome || nome).trim())
    .replace(/\{cidade\}/g, c.cidade || '').replace(/\{uf\}/g, cdaUfDe(c));
}

function cdaLinkComUtm(link, campanha) {
  if (!link) return '';
  try {
    const u = new URL(link);
    const slug = String((campanha && campanha.nome) || 'campanha').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    if (!u.searchParams.has('utm_source')) u.searchParams.set('utm_source', 'ciclodarte');
    if (!u.searchParams.has('utm_medium')) u.searchParams.set('utm_medium', 'email');
    if (!u.searchParams.has('utm_campaign')) u.searchParams.set('utm_campaign', slug);
    return u.toString();
  } catch (e) { return link; }
}

export function cdaMontarEmailCampanha(campanha, cliente, opts) {
  opts = opts || {};
  const k = (campanha && campanha.emailConteudo) || {};
  const esc = t => String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const v = t => cdaVariaveisEmail(t, cliente);
  // texto livre → parágrafos (linha em branco) e quebras de linha
  const paragrafos = (t, estilo) => v(t).split(/\n\s*\n/).map(p => p.trim()).filter(Boolean)
    .map(p => '<p style="' + estilo + '">' + esc(p).replace(/\n/g, '<br>') + '</p>').join('');
  const fonte = "font-family:Arial,Helvetica,sans-serif;";
  const pTxt = fonte + 'margin:0 0 14px;font-size:16px;line-height:1.55;color:#1a1a1a;';
  const link = cdaLinkComUtm(k.botaoLink, campanha);
  const link2 = cdaLinkComUtm(k.botao2Link, campanha);
  const descadastro = opts.linkDescadastro || '#descadastrar';
  // Links institucionais verificados. Únicos para todas as mensagens atuais,
  // inclusive as já salvas; não altera conteúdos, testes nem o Reply-To.
  const siteCiclo = 'https://www.ciclodaarte.com.br/';
  const redesCiclo = 'https://linktr.ee/ciclo_arte';
  const assunto = v((campanha && campanha.emailAssunto) || '');
  const previa = v((campanha && campanha.emailPrevia) || '');
  const sacEmail = String(k.sacEmail || '').trim();
  const sacTel = String(k.sacTelefone || '').trim();
  const linkSacEmail = sacEmail ? 'mailto:' + sacEmail : '';
  // Botão "à prova de Outlook": cor de fundo na célula (bgcolor) e cor do texto repetida no <span>
  const botao = (href, texto, cor, tam, pad) => '<table role="presentation" cellpadding="0" cellspacing="0" style="display:inline-table;margin:4px;"><tr><td bgcolor="' + cor + '" style="background:' + cor + ';border-radius:4px;mso-padding-alt:' + pad + ';">' +
    '<a href="' + esc(href) + '"' + (String(href).indexOf('mailto:') === 0 ? '' : ' target="_blank"') + ' style="display:inline-block;padding:' + pad + ';' + fonte + 'font-size:' + tam + 'px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:4px;"><span style="color:#ffffff;">' + texto + '</span></a></td></tr></table>';
  const digitosTel = sacTel.replace(/\D/g, '');
  const linkWhats = digitosTel.length >= 10 ? 'https://wa.me/' + (digitosTel.length <= 11 ? '55' : '') + digitosTel : '';
  const html = '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc(assunto) + '</title></head>' +
    '<body style="margin:0;padding:0;background:#f2efe9;">' +
    '<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">' + esc(previa) + '&#847;&zwnj;&nbsp;'.repeat(30) + '</div>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2efe9;"><tr><td align="center" style="padding:24px 12px;">' +
    '<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;">' +
      '<tr><td style="background:#1a1a1a;padding:14px 24px;' + fonte + 'font-size:13px;letter-spacing:3px;color:#ffffff;font-weight:bold;">CICLO DA ARTE</td></tr>' +
      (k.imagemUrl ? '<tr><td><a href="' + esc(link || '#') + '"><img src="' + esc(k.imagemUrl) + '" width="600" alt="' + esc(v(k.imagemAlt || k.titulo || '')) + '" style="display:block;width:100%;max-width:600px;height:auto;border:0;"></a></td></tr>' : '') +
      '<tr><td style="padding:28px 32px 8px;">' +
        (k.titulo ? '<h1 style="' + fonte + 'margin:0 0 16px;font-size:24px;line-height:1.25;color:#1a1a1a;">' + esc(v(k.titulo)) + '</h1>' : '') +
        (k.saudacao ? paragrafos(k.saudacao, pTxt) : '') +
        (k.texto ? paragrafos(k.texto, pTxt) : '') +
      '</td></tr>' +
      (k.cupomCodigo ? '<tr><td align="center" style="padding:6px 32px 18px;"><table role="presentation" cellpadding="0" cellspacing="0" style="border:2px dashed #c0392b;"><tr><td align="center" style="padding:14px 28px;' + fonte + '">' +
        '<div style="font-size:12px;letter-spacing:2px;color:#c0392b;font-weight:bold;">CUPOM</div>' +
        '<div style="font-size:28px;letter-spacing:3px;color:#1a1a1a;font-weight:bold;">' + esc(k.cupomCodigo) + '</div>' +
        (k.cupomTexto ? '<div style="font-size:14px;line-height:1.5;color:#444;margin-top:4px;">' + esc(v(k.cupomTexto)).replace(/\n/g, '<br>') + '</div>' : '') +
        '</td></tr></table></td></tr>' : '') +
      (link && k.botaoTexto ? '<tr><td align="center" style="padding:4px 32px 26px;">' + botao(link, esc(v(k.botaoTexto)), '#c0392b', 16, '15px 30px') + '</td></tr>' : '') +
      (link2 && k.botao2Texto ? '<tr><td align="center" style="padding:0 32px 26px;">' + botao(link2, esc(v(k.botao2Texto)), '#1a1a1a', 15, '13px 26px') + '</td></tr>' : '') +
      (k.infoTexto ? '<tr><td style="padding:0 32px 26px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f4ee;"><tr><td style="padding:18px 20px;' + fonte + '">' +
        (k.infoTitulo ? '<div style="font-size:15px;font-weight:bold;color:#1a1a1a;margin-bottom:8px;">' + esc(v(k.infoTitulo)) + '</div>' : '') +
        '<div style="font-size:14px;line-height:1.6;color:#333;">' + esc(v(k.infoTexto)).replace(/\n/g, '<br>') + '</div></td></tr></table></td></tr>' : '') +
      // Fale Conosco · SAC (nov/2026): telefone/e-mail visíveis + botões que abrem o e-mail e o WhatsApp do cliente
      (sacEmail || sacTel ? '<tr><td style="padding:0 32px 26px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e1d8;"><tr><td align="center" style="padding:18px 20px;' + fonte + '">' +
        '<div style="font-size:15px;font-weight:bold;color:#1a1a1a;margin-bottom:6px;">' + esc(v(k.sacTitulo || 'Fale Conosco · SAC')) + '</div>' +
        '<div style="font-size:14px;line-height:1.7;color:#333;margin-bottom:12px;">' +
          (sacTel ? '📞 ' + esc(sacTel) : '') + (sacTel && sacEmail ? '<br>' : '') +
          (sacEmail ? '✉ <a href="mailto:' + esc(sacEmail) + '" style="color:#333;">' + esc(sacEmail) + '</a>' : '') + '</div>' +
        // Uma única linha de tabela, com uma célula por botão: evita empilhamento no Outlook desktop.
        (sacEmail || linkWhats ? '<table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="margin:8px auto 0;border-collapse:collapse;"><tr>' +
          (sacEmail ? '<td align="center" valign="middle" style="padding:0 5px;white-space:nowrap;">' +
            botao(linkSacEmail, '✉ Enviar e-mail', '#2f6fb3', 14, '11px 20px') + '</td>' : '') +
          (linkWhats ? '<td align="center" valign="middle" style="padding:0 5px;white-space:nowrap;">' +
            botao(linkWhats, '💬 WhatsApp', '#1f8a4c', 14, '11px 20px') + '</td>' : '') +
          '</tr></table>' : '') +
        '</td></tr></table></td></tr>' : '') +
      '<tr><td style="padding:18px 32px 26px;border-top:1px solid #e5e1d8;' + fonte + 'font-size:12px;line-height:1.6;color:#777;">' +
        esc(v(k.rodape || '')).replace(/\n/g, '<br>') +
        '<br><br><b style="color:#444">Acompanhe a Ciclo da Arte</b>' +
        '<br>Site oficial: <a href="' + esc(siteCiclo) + '" target="_blank" style="color:#555;text-decoration:underline">www.ciclodaarte.com.br</a>' +
        '<br>Redes sociais e novidades: <a href="' + esc(redesCiclo) + '" target="_blank" style="color:#555;text-decoration:underline">Ciclo da Arte · redes sociais</a>' +
        '<br><br><a href="' + esc(descadastro) + '" style="color:#777;">Não quero mais receber estes e-mails</a></td></tr>' +
    '</table></td></tr></table></body></html>';
  const texto = [assunto, '', v(k.titulo), '', v(k.saudacao), '', v(k.texto), '',
    k.cupomCodigo ? 'CUPOM: ' + k.cupomCodigo + (k.cupomTexto ? (String(k.cupomTexto).indexOf('\n') >= 0 ? '\n' : ' — ') + v(k.cupomTexto) : '') : '',
    link ? (v(k.botaoTexto) || 'Saiba mais') + ': ' + link : '', link2 ? (v(k.botao2Texto) || 'Saiba mais') + ': ' + link2 : '', '', v(k.infoTitulo), v(k.infoTexto), '',
    (sacEmail || sacTel) ? v(k.sacTitulo || 'Fale Conosco · SAC') : '', sacTel ? 'Telefone/WhatsApp: ' + sacTel : '', sacEmail ? 'E-mail: ' + sacEmail : '', '', v(k.rodape),
    '', 'Site oficial: ' + siteCiclo, 'Redes sociais e novidades: ' + redesCiclo,
    'Para não receber mais: ' + descadastro].filter((l, i, a) => !(l === '' && a[i - 1] === '')).join('\n');
  return { assunto: assunto, previa: previa, html: html, texto: texto };
}


const DEFAULT_BRAND = 'CODESTRA';
const DEFAULT_HOME = 'https://codestra.co';
const DEFAULT_FOOTER = 'Powered by Codestra.co';

function docOf(documentRef) {
  const doc = documentRef ?? globalThis.document;
  if (!doc?.createElement) throw new TypeError('A DOM document is required');
  return doc;
}

function element(doc, tag, className, text) {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = String(text);
  return node;
}

function safeHref(value, { currentOrigin, allowedOrigins = [] } = {}) {
  const origin = currentOrigin ?? globalThis.location?.origin ?? DEFAULT_HOME;
  let url;
  try { url = new URL(String(value ?? ''), origin); } catch { return null; }
  if (url.username || url.password) return null;
  const localhost = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(localhost && url.protocol === 'http:')) return null;
  const allowed = new Set([origin, ...allowedOrigins]);
  if (!allowed.has(url.origin)) return null;
  return url.origin === origin ? `${url.pathname}${url.search}${url.hash}` : url.toString();
}

function appendNavigationLink(doc, parent, item, options) {
  const href = safeHref(item?.href, options);
  if (!href || !item?.label) return;
  const link = element(doc, 'a', 'orbit-nav__link', item.label);
  link.href = href;
  if (item.current) link.setAttribute('aria-current', 'page');
  parent.append(link);
}

export function createOrbitHeader({
  documentRef,
  brand = DEFAULT_BRAND,
  homeHref = DEFAULT_HOME,
  navigation = [],
  session = { authenticated: false },
  loginHref = '/auth/login',
  accountHref = '/app',
  allowedOrigins = [],
  onLogout
} = {}) {
  const doc = docOf(documentRef);
  const options = { currentOrigin: doc.location?.origin ?? globalThis.location?.origin, allowedOrigins };
  const header = element(doc, 'header', 'orbit-header');
  header.dataset.orbitComponent = 'header';
  const inner = element(doc, 'div', 'orbit-header__inner');
  const brandLink = element(doc, 'a', 'orbit-brand', brand);
  brandLink.href = safeHref(homeHref, options) ?? '/';
  brandLink.setAttribute('aria-label', `${brand} home`);

  const nav = element(doc, 'nav', 'orbit-nav');
  nav.id = `orbit-nav-${Math.random().toString(36).slice(2)}`;
  nav.setAttribute('aria-label', 'Primary navigation');
  for (const item of navigation) appendNavigationLink(doc, nav, item, options);

  const actions = element(doc, 'div', 'orbit-header__actions');
  if (session?.authenticated) {
    const account = element(doc, 'a', 'orbit-header__action', session.displayName || 'Account');
    account.href = safeHref(accountHref, options) ?? '/app';
    actions.append(account);
    const logout = element(doc, 'button', 'orbit-header__action orbit-header__action--primary', 'Log out');
    logout.type = 'button';
    logout.addEventListener('click', async () => {
      if (logout.disabled) return;
      logout.disabled = true;
      logout.setAttribute('aria-busy', 'true');
      try { await onLogout?.(); }
      finally { logout.disabled = false; logout.removeAttribute('aria-busy'); }
    });
    actions.append(logout);
  } else {
    const login = element(doc, 'a', 'orbit-header__action orbit-header__action--primary', 'Log in');
    login.href = safeHref(loginHref, options) ?? '/auth/login';
    actions.append(login);
  }

  const mobile = element(doc, 'button', 'orbit-mobile-toggle', 'Menu');
  mobile.type = 'button';
  mobile.setAttribute('aria-expanded', 'false');
  mobile.setAttribute('aria-controls', nav.id);
  mobile.addEventListener('click', () => {
    const expanded = mobile.getAttribute('aria-expanded') === 'true';
    mobile.setAttribute('aria-expanded', String(!expanded));
    nav.hidden = expanded;
  });
  if (globalThis.matchMedia?.('(max-width: 900px)').matches) nav.hidden = true;

  inner.append(brandLink, nav, actions, mobile);
  header.append(inner);
  return header;
}

export function createOrbitFooter({
  documentRef,
  brand = 'Codestra.co',
  links = [],
  social = [],
  allowedOrigins = [],
  attribution = DEFAULT_FOOTER,
  variant = 'full',
  year = new Date().getUTCFullYear()
} = {}) {
  const doc = docOf(documentRef);
  const options = { currentOrigin: doc.location?.origin ?? globalThis.location?.origin, allowedOrigins };
  const footer = element(doc, 'footer', 'orbit-footer');
  footer.dataset.orbitComponent = 'footer';
  footer.dataset.variant = variant;
  const inner = element(doc, 'div', 'orbit-footer__inner');
  const row = element(doc, 'div', 'orbit-footer__row');
  const linkGroup = element(doc, 'nav', 'orbit-footer__links');
  linkGroup.setAttribute('aria-label', 'Footer navigation');
  for (const item of links) {
    const href = safeHref(item?.href, options);
    if (!href || !item?.label) continue;
    const link = element(doc, 'a', 'orbit-footer__link', item.label);
    link.href = href;
    linkGroup.append(link);
  }
  row.append(linkGroup);

  if (social.length) {
    const socialGroup = element(doc, 'div', 'orbit-social');
    socialGroup.setAttribute('aria-label', 'Social profiles');
    for (const item of social) {
      if (!item?.published || !item?.validated || !item?.label) continue;
      let url;
      try { url = new URL(item.href); } catch { continue; }
      if (url.protocol !== 'https:' || url.username || url.password) continue;
      const link = element(doc, 'a', 'orbit-social__link', item.label);
      link.href = url.toString();
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      socialGroup.append(link);
    }
    if (socialGroup.childElementCount) row.append(socialGroup);
  }

  const meta = element(doc, 'div', 'orbit-footer__meta');
  meta.append(element(doc, 'span', '', `© ${year} ${brand}. `), element(doc, 'span', '', attribution));
  inner.append(row, meta);
  footer.append(inner);
  return footer;
}

export function createOrbitAuthShell({ documentRef, title, description, content, footerLinks = [], brand, homeHref, allowedOrigins = [] } = {}) {
  const doc = docOf(documentRef);
  const root = element(doc, 'div', 'orbit-root');
  root.dataset.orbitTheme = 'dark';
  const skip = element(doc, 'a', 'orbit-skip-link', 'Skip to content');
  skip.href = '#orbit-main';
  const header = createOrbitHeader({ documentRef: doc, brand, homeHref, navigation: [], session: {authenticated: false}, allowedOrigins });
  const main = element(doc, 'main', 'orbit-main orbit-auth-stage');
  main.id = 'orbit-main';
  const panel = element(doc, 'section', 'orbit-auth-panel');
  panel.setAttribute('aria-labelledby', 'orbit-auth-title');
  const heading = element(doc, 'h1', 'orbit-auth-panel__title', title || 'Account');
  heading.id = 'orbit-auth-title';
  panel.append(heading);
  if (description) panel.append(element(doc, 'p', 'orbit-auth-panel__description', description));
  if (content) panel.append(content);
  main.append(panel);
  const footer = createOrbitFooter({ documentRef: doc, links: footerLinks, allowedOrigins, variant: 'auth-compact' });
  root.append(skip, header, main, footer);
  return root;
}

export function mountOrbitPage({ target, header, main, footer, documentRef } = {}) {
  const doc = docOf(documentRef);
  if (!target?.replaceChildren) throw new TypeError('target must be a DOM element');
  const root = element(doc, 'div', 'orbit-root');
  root.dataset.orbitTheme = 'dark';
  const skip = element(doc, 'a', 'orbit-skip-link', 'Skip to content');
  skip.href = '#orbit-main';
  if (main) { main.id ||= 'orbit-main'; main.classList.add('orbit-main'); }
  root.append(skip);
  if (header) root.append(header);
  if (main) root.append(main);
  if (footer) root.append(footer);
  target.replaceChildren(root);
  return { root, unmount: () => target.replaceChildren() };
}

export const orbitUiVersion = '2.0.0';

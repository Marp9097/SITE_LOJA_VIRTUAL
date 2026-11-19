// Vitrine da loja
const S = {
  settings: {},
  categories: [],
  products: [],
  cart: JSON.parse(localStorage.getItem('cart') || '[]'),
  coupon: null, // { code, discount_cents }
  cat: null,
  q: '',
  poll: null,
};

const ICON_PH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></svg>';

const unitPrice = (p) => (p.promo_price_cents && p.promo_price_cents < p.price_cents ? p.promo_price_cents : p.price_cents);
const findProduct = (id) => S.products.find((p) => p.id === id);

async function init() {
  try {
    const [settings, cats, prods] = await Promise.all([api('/api/public/settings'), api('/api/categories'), api('/api/products')]);
    S.settings = settings; S.categories = cats; S.products = prods;
  } catch (e) {
    $('#app').innerHTML = `<div class="offline"><h2>Loja temporariamente fora do ar</h2><p style="color:var(--muted);margin-top:8px">${esc(e.message)}</p><button class="btn" style="margin-top:16px" onclick="location.reload()">Tentar de novo</button></div>`;
    return;
  }
  applyTheme(S.settings);
  renderBrand();
  renderCategories();
  renderGrid();
  // remove do carrinho o que não existe mais
  S.cart = S.cart.filter((i) => findProduct(i.id));
  saveCart();
  const pid = new URLSearchParams(location.search).get('produto');
  if (pid) openProduct(Number(pid));
}

function renderBrand() {
  const s = S.settings;
  document.title = s.store_name + (s.store_tagline ? ' — ' + s.store_tagline : '');
  $('#brand').innerHTML = s.logo_image_id
    ? `<img src="${imgUrl(s.logo_image_id)}" alt="${esc(s.store_name)}">`
    : `<div class="dot"></div><span>${esc(s.store_name)}</span>`;
  $('#heroTitle').textContent = s.banner_title || s.store_name;
  $('#heroSub').textContent = s.banner_subtitle || '';
  const hero = $('#hero');
  if (s.banner_image_id) {
    hero.classList.add('has-img');
    hero.insertAdjacentHTML('afterbegin', `<img class="hero-img" src="${imgUrl(s.banner_image_id)}" alt="">`);
  }
  $('#footName').textContent = s.store_name;
  $('#footText').textContent = s.footer_text || `© ${new Date().getFullYear()} ${s.store_name}. Todos os direitos reservados.`;
  const soc = [];
  if (s.instagram) soc.push(`<a class="btn ghost sm" target="_blank" rel="noopener" href="https://instagram.com/${esc(s.instagram.replace(/^@/, ''))}">Instagram</a>`);
  if (s.whatsapp) {
    const n = s.whatsapp.replace(/\D/g, '');
    soc.push(`<a class="btn ghost sm" target="_blank" rel="noopener" href="https://wa.me/${n}">WhatsApp</a>`);
    $('#wpp').href = `https://wa.me/${n}`; $('#wpp').hidden = false;
  }
  $('#socials').innerHTML = soc.join('');
}

function renderCategories() {
  const cats = S.categories;
  const withImg = cats.filter((c) => c.image_id);
  $('#catSection').hidden = withImg.length === 0;
  $('#catCards').innerHTML = withImg.map((c) => `
    <button class="cat-card ${S.cat === c.id ? 'active' : ''}" data-cat="${c.id}">
      <img src="${imgUrl(c.image_id)}" alt="" loading="lazy"><span>${esc(c.name)}</span>
    </button>`).join('');
  $('#chips').innerHTML = [`<button class="chip ${S.cat == null ? 'active' : ''}" data-cat="">Todos</button>`]
    .concat(cats.map((c) => `<button class="chip ${S.cat === c.id ? 'active' : ''}" data-cat="${c.id}">${esc(c.name)}</button>`)).join('');
  $('#chips').hidden = cats.length === 0;
}

function renderGrid() {
  const q = S.q.toLowerCase();
  const list = S.products.filter((p) => (S.cat == null || p.category_id === S.cat) &&
    (!q || p.name.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q)));
  const cat = S.categories.find((c) => c.id === S.cat);
  $('#gridTitle').textContent = q ? `Resultados para "${S.q}"` : cat ? cat.name : 'Todos os produtos';
  $('#gridCount').textContent = `${list.length} produto${list.length === 1 ? '' : 's'}`;
  if (!list.length) {
    $('#grid').innerHTML = `<div class="empty">Nenhum produto encontrado por aqui.</div>`;
    return;
  }
  $('#grid').innerHTML = list.map((p, i) => {
    const out = p.stock != null && p.stock <= 0;
    const promo = p.promo_price_cents && p.promo_price_cents < p.price_cents;
    const off = promo ? Math.round((1 - p.promo_price_cents / p.price_cents) * 100) : 0;
    const c = S.categories.find((x) => x.id === p.category_id);
    return `<article class="card" style="animation-delay:${Math.min(i, 12) * 40}ms">
      <div class="thumb" data-open="${p.id}">
        ${p.images[0] ? `<img src="${imgUrl(p.images[0])}" alt="${esc(p.name)}" loading="lazy">` : `<div class="ph">${ICON_PH}</div>`}
        ${out ? '<span class="tag out">Esgotado</span>' : promo ? `<span class="tag">-${off}%</span>` : p.featured ? '<span class="tag">Destaque</span>' : ''}
      </div>
      <div class="info">
        ${c ? `<div class="cat">${esc(c.name)}</div>` : ''}
        <h3 data-open="${p.id}">${esc(p.name)}</h3>
        <div class="price"><b>${brl(unitPrice(p))}</b>${promo ? `<s>${brl(p.price_cents)}</s>` : ''}</div>
        <button class="btn sm block" data-add="${p.id}" ${out ? 'disabled' : ''}>${out ? 'Esgotado' : 'Adicionar'}</button>
      </div>
    </article>`;
  }).join('');
}

// ---------- produto ----------
function openProduct(id) {
  const p = findProduct(id);
  if (!p) return;
  let qty = 1;
  const out = p.stock != null && p.stock <= 0;
  const promo = p.promo_price_cents && p.promo_price_cents < p.price_cents;
  const c = S.categories.find((x) => x.id === p.category_id);
  $('#productBox').innerHTML = `
    <button class="icon-btn modal-close" data-close-modal>✕</button>
    <div class="product-view">
      <div class="gallery">
        <div class="main">${p.images[0] ? `<img id="pvMain" src="${imgUrl(p.images[0])}" alt="">` : `<div class="thumb"><div class="ph" style="aspect-ratio:1">${ICON_PH}</div></div>`}</div>
        ${p.images.length > 1 ? `<div class="thumbs">${p.images.map((im, i) => `<img src="${imgUrl(im)}" data-img="${im}" class="${i ? '' : 'active'}" alt="">`).join('')}</div>` : ''}
      </div>
      <div class="pv-info">
        ${c ? `<div class="cat" style="color:var(--muted);font-size:12px;text-transform:uppercase;letter-spacing:.08em">${esc(c.name)}</div>` : ''}
        <h2>${esc(p.name)}</h2>
        <div class="price"><b>${brl(unitPrice(p))}</b>${promo ? `<s>${brl(p.price_cents)}</s>` : ''}</div>
        ${p.description ? `<div class="desc">${esc(p.description)}</div>` : ''}
        ${p.stock != null && p.stock > 0 && p.stock <= 5 ? `<div style="color:var(--warn);font-size:14px">Restam apenas ${p.stock} unidade${p.stock > 1 ? 's' : ''}!</div>` : ''}
        <div style="display:flex;gap:12px;align-items:center;margin-top:auto;flex-wrap:wrap">
          <div class="qty"><button id="qMinus">−</button><span id="qVal">1</span><button id="qPlus">+</button></div>
          <button class="btn" id="pvAdd" style="flex:1" ${out ? 'disabled' : ''}>${out ? 'Esgotado' : 'Adicionar ao carrinho'}</button>
        </div>
      </div>
    </div>`;
  $('#qMinus').onclick = () => { qty = Math.max(1, qty - 1); $('#qVal').textContent = qty; };
  $('#qPlus').onclick = () => { qty = p.stock != null ? Math.min(p.stock, qty + 1) : qty + 1; $('#qVal').textContent = qty; };
  $('#pvAdd').onclick = () => { addToCart(p.id, qty); closeModals(); openCart(); };
  $$('.thumbs img', $('#productBox')).forEach((t) => (t.onclick = () => {
    $('#pvMain').src = imgUrl(t.dataset.img);
    $$('.thumbs img', $('#productBox')).forEach((x) => x.classList.toggle('active', x === t));
  }));
  openModal('#productModal');
}

// ---------- carrinho ----------
function saveCart() {
  localStorage.setItem('cart', JSON.stringify(S.cart));
  const n = S.cart.reduce((a, i) => a + i.qty, 0);
  const b = $('#cartCount');
  b.textContent = n;
  b.classList.toggle('show', n > 0);
}
function addToCart(id, qty = 1) {
  const p = findProduct(id);
  const it = S.cart.find((i) => i.id === id);
  const max = p.stock != null ? p.stock : Infinity;
  if (it) it.qty = Math.min(max, it.qty + qty); else S.cart.push({ id, qty: Math.min(max, qty) });
  saveCart();
  renderCart();
  toast(`${p.name} adicionado`);
}
const subtotal = () => S.cart.reduce((a, i) => a + unitPrice(findProduct(i.id)) * i.qty, 0);

async function revalidateCoupon() {
  if (!S.coupon) return;
  try {
    const r = await api('/api/coupons/validate', { method: 'POST', body: { code: S.coupon.code, subtotal_cents: subtotal() } });
    S.coupon = r;
  } catch (e) {
    toast(e.message, 'err');
    S.coupon = null;
  }
  renderCart();
}

function renderCart() {
  const box = $('#cartItems');
  if (!S.cart.length) {
    box.innerHTML = `<div class="empty" style="padding:60px 10px"><div style="font-size:40px">🛒</div><p style="margin-top:10px">Seu carrinho está vazio</p></div>`;
    $('#cartFoot').hidden = true;
    return;
  }
  $('#cartFoot').hidden = false;
  box.innerHTML = S.cart.map((i) => {
    const p = findProduct(i.id);
    return `<div class="cart-item">
      ${p.images[0] ? `<img src="${imgUrl(p.images[0])}" alt="">` : '<div class="ph"></div>'}
      <div><div class="name">${esc(p.name)}</div><div class="unit">${brl(unitPrice(p))}</div>
        <div class="qty" style="margin-top:6px"><button data-dec="${p.id}">−</button><span>${i.qty}</span><button data-inc="${p.id}">+</button></div></div>
      <div class="right"><b>${brl(unitPrice(p) * i.qty)}</b><button class="link" data-rm="${p.id}">remover</button></div>
    </div>`;
  }).join('');

  $('#couponBox').innerHTML = S.coupon
    ? `<div class="coupon-ok"><span>🏷️ Cupom <b>${esc(S.coupon.code)}</b> aplicado</span><button class="link" id="rmCoupon">remover</button></div>`
    : `<div class="coupon-row"><input class="input" id="couponInput" placeholder="Cupom de desconto" style="text-transform:uppercase"><button class="btn ghost" id="applyCoupon">Aplicar</button></div>`;

  const sub = subtotal();
  const disc = S.coupon ? S.coupon.discount_cents : 0;
  const ship = Number(S.settings.shipping_cents || 0);
  $('#cartTotals').innerHTML = `
    <div class="muted"><span>Subtotal</span><span>${brl(sub)}</span></div>
    ${disc ? `<div class="disc"><span>Desconto</span><span>− ${brl(disc)}</span></div>` : ''}
    ${ship ? `<div class="muted"><span>Entrega</span><span>${brl(ship)}</span></div>` : ''}
    <div class="grand"><span>Total</span><span>${brl(Math.max(0, sub - disc) + ship)}</span></div>`;
}

function openCart() { renderCart(); $('#cart').classList.add('open'); $('#overlay').classList.add('open'); }
function closeCart() { $('#cart').classList.remove('open'); $('#overlay').classList.remove('open'); }
function openModal(sel) { $(sel).classList.add('open'); document.body.style.overflow = 'hidden'; }
function closeModals() {
  $$('.modal').forEach((m) => m.classList.remove('open'));
  document.body.style.overflow = '';
  clearInterval(S.poll);
}

// ---------- checkout ----------
function openCheckout() {
  closeCart();
  const saved = JSON.parse(localStorage.getItem('customer') || '{}');
  const s = S.settings;
  $('#checkoutBox').innerHTML = `
    <h2 style="font-size:22px;margin-bottom:4px">Finalizar pedido</h2>
    <p style="color:var(--muted);font-size:14px;margin-bottom:18px">Preencha seus dados para gerar o pagamento.</p>
    <form id="checkoutForm">
      <div class="field"><label>Nome completo *</label><input class="input" name="customer_name" required value="${esc(saved.customer_name || '')}"></div>
      <div class="row2">
        <div class="field"><label>E-mail *</label><input class="input" type="email" name="customer_email" required value="${esc(saved.customer_email || '')}"></div>
        <div class="field"><label>WhatsApp</label><input class="input" type="tel" name="customer_phone" value="${esc(saved.customer_phone || '')}"></div>
      </div>
      ${s.ask_address === '1' ? `<div class="field"><label>Endereço de entrega</label><textarea class="input" name="customer_address" rows="2">${esc(saved.customer_address || '')}</textarea></div>` : ''}
      <div class="field"><label>Observações</label><input class="input" name="notes" placeholder="Opcional"></div>
      <div class="totals" style="margin:6px 0 16px">${$('#cartTotals').innerHTML}</div>
      <button class="btn block" type="submit" id="placeBtn">${s.payment_available ? 'Gerar Pix e pagar' : 'Enviar pedido'}</button>
    </form>`;
  $('#checkoutForm').onsubmit = placeOrder;
  openModal('#checkoutModal');
}

async function placeOrder(ev) {
  ev.preventDefault();
  const data = Object.fromEntries(new FormData(ev.target));
  localStorage.setItem('customer', JSON.stringify({ ...data, notes: undefined }));
  const btn = $('#placeBtn');
  btn.disabled = true; btn.textContent = 'Enviando...';
  try {
    const order = await api('/api/orders', {
      method: 'POST',
      body: { ...data, items: S.cart.map((i) => ({ product_id: i.id, qty: i.qty })), coupon_code: S.coupon?.code },
    });
    S.cart = []; S.coupon = null; saveCart();
    // atualiza estoques
    api('/api/products').then((p) => { S.products = p; renderGrid(); }).catch(() => {});
    const mine = JSON.parse(localStorage.getItem('my_orders') || '[]');
    mine.unshift({ c: order.code, t: order.public_token, at: Date.now() });
    localStorage.setItem('my_orders', JSON.stringify(mine.slice(0, 20)));
    showPayment(order);
  } catch (e) {
    toast(e.message, 'err');
    btn.disabled = false; btn.textContent = 'Tentar novamente';
  }
}

function orderLink(o) { return `pedido.html?c=${encodeURIComponent(o.code)}&t=${encodeURIComponent(o.public_token)}`; }

function showPayment(order) {
  if (order.status !== 'pending') return showPaid(order);
  const box = $('#checkoutBox');
  if (!order.pix_payload && !order.pix_qr_base64) {
    box.innerHTML = `<div class="pay"><div class="success-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="m5 12 5 5 9-10"/></svg></div>
      <h2>Pedido #${esc(order.code)} recebido!</h2><p style="color:var(--muted)">Total ${brl(order.total_cents)}. Em breve entraremos em contato para combinar o pagamento.</p>
      <a class="btn block" href="${orderLink(order)}">Ver nota do pedido</a></div>`;
    return;
  }
  const qr = order.pix_qr_base64 ? `data:image/png;base64,${order.pix_qr_base64}` : qrDataUrl(order.pix_payload);
  const auto = order.payment_method === 'mercadopago';
  box.innerHTML = `<div class="pay">
    <span class="status-pill pending"><span class="pulse"></span> Aguardando pagamento</span>
    <h2 style="font-size:22px">Pague com Pix</h2>
    <div style="font-size:30px;font-weight:800;letter-spacing:-.02em">${brl(order.total_cents)}</div>
    ${qr ? `<div class="qr"><img src="${qr}" alt="QR Code Pix"></div>` : ''}
    <p style="color:var(--muted);font-size:14px">Abra o app do seu banco, escolha <b>Pix → Ler QR Code</b> ou use o código copia e cola:</p>
    <div class="code">${esc(order.pix_payload || '')}</div>
    <button class="btn block" id="copyPix">Copiar código Pix</button>
    <p style="color:var(--muted);font-size:13px">${auto ? 'A confirmação é automática — esta tela atualiza sozinha assim que o pagamento cair.' : 'Após pagar, o pedido será confirmado pela loja. Você recebe a confirmação por e-mail.'}</p>
    <a class="link" href="${orderLink(order)}" style="font-size:13px">Pedido #${esc(order.code)} · ver nota</a>
  </div>`;
  $('#copyPix').onclick = () => copyText(order.pix_payload);
  clearInterval(S.poll);
  S.poll = setInterval(async () => {
    try {
      const o = await api(`/api/orders/${order.code}?t=${order.public_token}`);
      if (o.status !== 'pending') { clearInterval(S.poll); showPaid(o); }
    } catch {}
  }, 4000);
}

function showPaid(order) {
  $('#checkoutBox').innerHTML = `<div class="pay">
    <div class="success-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="m5 12 5 5 9-10"/></svg></div>
    <h2>Pagamento confirmado!</h2>
    <p style="color:var(--muted)">Pedido <b>#${esc(order.code)}</b> · ${brl(order.total_cents)}<br>Enviamos a nota para o seu e-mail.</p>
    <a class="btn block" href="${orderLink(order)}">Ver nota do pedido</a>
    <button class="btn ghost block" data-close-modal>Continuar comprando</button>
  </div>`;
}

// ---------- eventos ----------
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-add],[data-open],[data-cat],[data-inc],[data-dec],[data-rm],[data-close-modal],[data-close-cart],#cartBtn,#overlay,#checkoutBtn,#applyCoupon,#rmCoupon');
  if (!t) { if (e.target.classList.contains('modal')) closeModals(); return; }
  if (t.dataset.add) addToCart(Number(t.dataset.add));
  else if (t.dataset.open) openProduct(Number(t.dataset.open));
  else if (t.dataset.cat !== undefined) {
    const v = t.dataset.cat ? Number(t.dataset.cat) : null;
    S.cat = t.classList.contains('cat-card') && S.cat === v ? null : v;
    renderCategories(); renderGrid();
    if (t.classList.contains('cat-card')) $('#produtos').scrollIntoView({ behavior: 'smooth' });
  } else if (t.dataset.inc || t.dataset.dec) {
    const id = Number(t.dataset.inc || t.dataset.dec);
    const it = S.cart.find((i) => i.id === id);
    const p = findProduct(id);
    if (t.dataset.inc) it.qty = p.stock != null ? Math.min(p.stock, it.qty + 1) : it.qty + 1;
    else it.qty = Math.max(1, it.qty - 1);
    saveCart(); renderCart(); revalidateCoupon();
  } else if (t.dataset.rm) {
    S.cart = S.cart.filter((i) => i.id !== Number(t.dataset.rm));
    saveCart(); renderCart(); revalidateCoupon();
  } else if (t.hasAttribute('data-close-modal')) closeModals();
  else if (t.hasAttribute('data-close-cart') || t.id === 'overlay') closeCart();
  else if (t.id === 'cartBtn') openCart();
  else if (t.id === 'checkoutBtn') openCheckout();
  else if (t.id === 'rmCoupon') { S.coupon = null; renderCart(); }
  else if (t.id === 'applyCoupon') applyCoupon();
});

async function applyCoupon() {
  const code = $('#couponInput').value.trim();
  if (!code) return;
  try {
    S.coupon = await api('/api/coupons/validate', { method: 'POST', body: { code, subtotal_cents: subtotal() } });
    toast('Cupom aplicado!');
    renderCart();
  } catch (e) { toast(e.message, 'err'); }
}
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { closeModals(); closeCart(); }
  if (e.key === 'Enter' && e.target.id === 'couponInput') applyCoupon();
});
let st;
$('#search').addEventListener('input', (e) => {
  clearTimeout(st);
  st = setTimeout(() => { S.q = e.target.value.trim(); renderGrid(); }, 150);
});

saveCart();
init();

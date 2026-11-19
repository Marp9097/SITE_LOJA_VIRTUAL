// Página da nota do pedido (link enviado ao cliente)
const qp = new URLSearchParams(location.search);
const code = qp.get('c');
const token = qp.get('t');
let settings = {};
let timer;

function receiptHTML(o) {
  const date = new Date(o.created_at.replace(' ', 'T') + 'Z').toLocaleString('pt-BR');
  return `<div class="receipt">
    <div class="r-head">
      ${settings.logo_image_id ? `<img src="${imgUrl(settings.logo_image_id)}" alt="">` : ''}
      <div style="font-weight:800;font-size:18px">${esc(settings.store_name)}</div>
      <div class="r-sm">Pedido <b>#${esc(o.code)}</b> · ${esc(date)}</div>
      <div style="margin-top:10px"><span class="status-pill ${o.status}">${o.status === 'pending' ? '<span class="pulse"></span>' : ''}${STATUS_LABEL[o.status] || o.status}</span></div>
    </div>
    <div class="r-cust">
      <b>Cliente:</b> ${esc(o.customer_name)}<br>
      ${o.customer_email ? `<b>E-mail:</b> ${esc(o.customer_email)}<br>` : ''}
      ${o.customer_phone ? `<b>Telefone:</b> ${esc(o.customer_phone)}<br>` : ''}
      ${o.customer_address ? `<b>Endereço:</b> ${esc(o.customer_address)}<br>` : ''}
      ${o.notes ? `<b>Obs.:</b> ${esc(o.notes)}` : ''}
    </div>
    <table class="r-items">${o.items.map((i) => `<tr><td>${esc(i.name)}<div class="r-sm">${i.qty} × ${brl(i.unit_cents)}</div></td><td style="text-align:right;white-space:nowrap">${brl(i.total_cents)}</td></tr>`).join('')}</table>
    <table style="margin-top:8px">
      <tr><td class="r-sm">Subtotal</td><td style="text-align:right">${brl(o.subtotal_cents)}</td></tr>
      ${o.discount_cents ? `<tr><td style="color:#0a8a4a">Desconto ${o.coupon_code ? '(' + esc(o.coupon_code) + ')' : ''}</td><td style="text-align:right;color:#0a8a4a">− ${brl(o.discount_cents)}</td></tr>` : ''}
      ${o.shipping_cents ? `<tr><td class="r-sm">Entrega</td><td style="text-align:right">${brl(o.shipping_cents)}</td></tr>` : ''}
      <tr class="r-total"><td>Total</td><td style="text-align:right">${brl(o.total_cents)}</td></tr>
    </table>
  </div>`;
}

function render(o) {
  let pay = '';
  if (o.status === 'pending' && (o.pix_payload || o.pix_qr_base64)) {
    const qr = o.pix_qr_base64 ? `data:image/png;base64,${o.pix_qr_base64}` : qrDataUrl(o.pix_payload);
    pay = `<div class="pay no-print" style="max-width:460px;margin:20px auto 0;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:22px">
      <h3>Pague com Pix</h3>
      ${qr ? `<div class="qr"><img src="${qr}" alt="QR Pix"></div>` : ''}
      <div class="code">${esc(o.pix_payload || '')}</div>
      <button class="btn block" id="copy">Copiar código Pix</button>
    </div>`;
  }
  $('#main').innerHTML = receiptHTML(o) + pay +
    `<div class="no-print" style="text-align:center;margin-top:18px"><button class="btn ghost" onclick="print()">Imprimir / salvar PDF</button></div>`;
  const c = $('#copy');
  if (c) c.onclick = () => copyText(o.pix_payload);
}

async function load() {
  try {
    const o = await api(`/api/orders/${encodeURIComponent(code)}?t=${encodeURIComponent(token)}`);
    render(o);
    clearInterval(timer);
    if (o.status === 'pending') timer = setInterval(async () => {
      try {
        const n = await api(`/api/orders/${encodeURIComponent(code)}?t=${encodeURIComponent(token)}`);
        if (n.status !== 'pending') { clearInterval(timer); render(n); toast('Pagamento confirmado!'); }
      } catch {}
    }, 5000);
  } catch (e) {
    $('#main').innerHTML = `<div class="offline"><h2>Pedido não encontrado</h2><p style="color:var(--muted)">${esc(e.message)}</p></div>`;
  }
}

(async () => {
  try {
    settings = await api('/api/public/settings');
    applyTheme(settings);
    document.title = `Pedido #${code} — ${settings.store_name}`;
    $('#brand').innerHTML = settings.logo_image_id ? `<img src="${imgUrl(settings.logo_image_id)}" alt="">` : `<div class="dot"></div><span>${esc(settings.store_name)}</span>`;
  } catch {}
  load();
})();

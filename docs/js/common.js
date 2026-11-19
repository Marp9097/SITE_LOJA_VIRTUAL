// Funções compartilhadas entre loja, pedido e admin
(function () {
  const qs = new URLSearchParams(location.search);
  if (qs.get('api')) localStorage.setItem('api_override', qs.get('api'));
  const override = localStorage.getItem('api_override');
  const cfg = (window.LOJA_CONFIG && window.LOJA_CONFIG.API_URL) || '';
  window.API = (override || cfg || location.origin).replace(/\/$/, '');
})();

async function api(path, opts = {}) {
  const headers = {};
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  const tok = localStorage.getItem('admin_token');
  if (opts.auth && tok) headers.Authorization = 'Bearer ' + tok;
  let r;
  try {
    r = await fetch(API + path, { method: opts.method || 'GET', headers, body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined });
  } catch (e) {
    const err = new Error('Não foi possível conectar ao servidor da loja. Ele está ligado?');
    err.offline = true;
    throw err;
  }
  let data = {};
  try { data = await r.json(); } catch {}
  if (!r.ok) {
    const e = new Error(data.error || 'Erro ' + r.status);
    e.status = r.status;
    throw e;
  }
  return data;
}

const imgUrl = (id) => (id ? `${API}/api/images/${id}` : '');
const brl = (c) => (Number(c || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const STATUS_LABEL = { pending: 'Aguardando pagamento', paid: 'Pago', shipped: 'Enviado', done: 'Concluído', canceled: 'Cancelado' };

function hexToRgb(hex) {
  const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex || '');
  return m ? `${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}` : '139, 92, 246';
}

function applyTheme(s) {
  const r = document.documentElement.style;
  r.setProperty('--bg', s.color_bg);
  r.setProperty('--surface', s.color_surface);
  r.setProperty('--primary', s.color_primary);
  r.setProperty('--primary-rgb', hexToRgb(s.color_primary));
  r.setProperty('--accent', s.color_accent);
  r.setProperty('--text', s.color_text);
  r.setProperty('--muted', s.color_muted);
  r.setProperty('--radius', (s.radius || 18) + 'px');
  if (s.font) {
    const id = 'gfont';
    let l = document.getElementById(id);
    if (!l) { l = document.createElement('link'); l.id = id; l.rel = 'stylesheet'; document.head.appendChild(l); }
    l.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(s.font)}:wght@400;500;600;700;800&display=swap`;
    r.setProperty('--font', `'${s.font}', system-ui, sans-serif`);
  }
  if (s.bg_image_id) {
    r.setProperty('--bg-image', `url("${imgUrl(s.bg_image_id)}")`);
    r.setProperty('--bg-overlay', s.bg_overlay || '0.75');
    document.body.classList.add('has-bg-image');
  } else document.body.classList.remove('has-bg-image');
  const fav = s.favicon_image_id || s.logo_image_id;
  if (fav) {
    let l = document.querySelector('link[rel="icon"]');
    if (!l) { l = document.createElement('link'); l.rel = 'icon'; document.head.appendChild(l); }
    l.href = imgUrl(fav);
  }
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) { meta = document.createElement('meta'); meta.name = 'theme-color'; document.head.appendChild(meta); }
  meta.content = s.color_bg;
}

function toast(msg, type = 'ok') {
  let box = $('#toasts');
  if (!box) { box = document.createElement('div'); box.id = 'toasts'; document.body.appendChild(box); }
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.textContent = msg;
  box.appendChild(t);
  setTimeout(() => t.classList.add('show'), 10);
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 3500);
}

// QR Code (biblioteca carregada via CDN no HTML)
function qrDataUrl(text) {
  if (typeof qrcode !== 'function') return '';
  const q = qrcode(0, 'M');
  q.addData(text);
  q.make();
  return q.createDataURL(8, 2);
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); }
  catch {
    const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); ta.remove();
  }
  toast('Código Pix copiado!');
}

import { supabase } from './supabase-client.js';
import { requireRole, signOut } from './auth.js';
import { buildTopActions } from './rules-engine.js';

let profile = null;

init();

async function init() {
  profile = await requireRole('seller');
  if (!profile) return;

  document.getElementById('storeName').textContent = profile.store_name || profile.full_name || profile.email;
  document.getElementById('logoutBtn').onclick = signOut;

  setupDropzone();
  await loadSkus();
  await loadActions();
}

function setupDropzone() {
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('csvFile');

  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('active'); });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('active'));
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('active');
    if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
  });
  fileInput.addEventListener('change', () => {
    if (fileInput.files.length) handleFile(fileInput.files[0]);
  });
}

function handleFile(file) {
  const statusEl = document.getElementById('uploadStatus');
  statusEl.innerHTML = `<div class="msg success">Fayl o'qilmoqda: ${file.name}...</div>`;

  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: async (results) => {
      try {
        const rows = results.data.map(normalizeRow).filter(r => r.sku_code);
        if (!rows.length) {
          statusEl.innerHTML = `<div class="msg error">CSV'da to'g'ri qatorlar topilmadi. Ustunlar: sku_code, name, price, cost, stock, competitor_price, unanswered_reviews</div>`;
          return;
        }
        await upsertSkus(rows);
        await supabase.from('imports').insert({
          seller_id: profile.id, filename: file.name, row_count: rows.length, source: 'csv',
        });
        statusEl.innerHTML = `<div class="msg success">${rows.length} ta mahsulot muvaffaqiyatli yuklandi va tahlil qilindi.</div>`;
        await loadSkus();
        await recomputeActions();
        await loadActions();
      } catch (err) {
        statusEl.innerHTML = `<div class="msg error">Xato: ${err.message}</div>`;
      }
    },
    error: (err) => {
      statusEl.innerHTML = `<div class="msg error">CSV o'qishda xato: ${err.message}</div>`;
    },
  });
}

function normalizeRow(row) {
  const get = (keys) => {
    for (const k of keys) {
      const found = Object.keys(row).find(rk => rk.trim().toLowerCase() === k);
      if (found && row[found] !== undefined && row[found] !== '') return row[found];
    }
    return null;
  };
  return {
    seller_id: profile.id,
    sku_code: get(['sku_code', 'sku', 'artikul', 'id']),
    name: get(['name', 'nomi', 'title']),
    price: get(['price', 'narx']),
    cost: get(['cost', 'tannarx']),
    stock: get(['stock', 'qoldiq', 'ombor']),
    competitor_price: get(['competitor_price', 'raqobatchi_narx']),
    unanswered_reviews: get(['unanswered_reviews', 'javobsiz_sharh']) || 0,
    raw_data: row,
  };
}

async function upsertSkus(rows) {
  const { error } = await supabase.from('skus').upsert(rows, { onConflict: 'seller_id,sku_code' });
  if (error) throw error;
}

async function loadSkus() {
  const { data, error } = await supabase.from('skus').select('*').eq('seller_id', profile.id).order('updated_at', { ascending: false });
  if (error) return;
  document.getElementById('skuCount').textContent = data.length;
  window.__skus = data;
}

async function recomputeActions() {
  const skus = window.__skus || [];
  if (!skus.length) return;
  const { top } = buildTopActions(skus, 20);

  // Eski 'open' action'larni tozalab, yangilarini yozamiz (oddiy MVP mantiq)
  await supabase.from('actions').delete().eq('seller_id', profile.id).eq('status', 'open');
  if (top.length) {
    await supabase.from('actions').insert(top);
  }
}

async function loadActions() {
  const { data, error } = await supabase
    .from('actions')
    .select('*')
    .eq('seller_id', profile.id)
    .order('score', { ascending: false });
  if (error) return;

  const openCount = data.filter(a => a.status === 'open').length;
  const doneCount = data.filter(a => a.status === 'done').length;
  document.getElementById('openCount').textContent = openCount;
  document.getElementById('doneCount').textContent = doneCount;

  const tbody = document.getElementById('actionsBody');
  tbody.innerHTML = '';
  data.forEach(a => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${a.title}<br><span style="color:var(--text-dim);font-size:12px">${a.description || ''}</span></td>
      <td class="mono">${a.score}</td>
      <td><span class="badge ${a.status}">${statusLabel(a.status)}</span></td>
      <td></td>
    `;
    const actionsTd = tr.lastElementChild;
    if (a.status === 'open') {
      const doneBtn = document.createElement('button');
      doneBtn.className = 'btn accent'; doneBtn.textContent = 'Bajarildi';
      doneBtn.onclick = () => updateActionStatus(a.id, 'done');
      const dismissBtn = document.createElement('button');
      dismissBtn.className = 'btn secondary'; dismissBtn.style.marginLeft = '8px';
      dismissBtn.textContent = "Bekor qilish";
      dismissBtn.onclick = () => updateActionStatus(a.id, 'dismissed');
      actionsTd.append(doneBtn, dismissBtn);
    }
    tbody.appendChild(tr);
  });
}

function statusLabel(status) {
  return { open: 'Ochiq', done: 'Bajarildi', dismissed: 'Bekor qilingan' }[status] || status;
}

async function updateActionStatus(id, status) {
  await supabase.from('actions').update({ status, resolved_at: new Date().toISOString() }).eq('id', id);
  await loadActions();
}

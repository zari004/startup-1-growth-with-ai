import { supabase } from './supabase-client.js';
import { requireRole, signOut } from './auth.js';

init();

async function init() {
  const profile = await requireRole('admin');
  if (!profile) return;

  document.getElementById('adminName').textContent = profile.full_name || profile.email;
  document.getElementById('logoutBtn').onclick = signOut;

  await loadSellers();
}

async function loadSellers() {
  const { data: sellers, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'seller')
    .order('created_at', { ascending: false });
  if (error) return;

  const { data: skus } = await supabase.from('skus').select('seller_id');
  const { data: actions } = await supabase.from('actions').select('seller_id, status');

  document.getElementById('sellerCount').textContent = sellers.length;

  const skuCountBySeller = {};
  (skus || []).forEach(s => { skuCountBySeller[s.seller_id] = (skuCountBySeller[s.seller_id] || 0) + 1; });

  const openBySeller = {};
  (actions || []).forEach(a => {
    if (a.status === 'open') openBySeller[a.seller_id] = (openBySeller[a.seller_id] || 0) + 1;
  });

  const totalOpen = Object.values(openBySeller).reduce((a, b) => a + b, 0);
  document.getElementById('openTotal').textContent = totalOpen;

  const tbody = document.getElementById('sellersBody');
  tbody.innerHTML = '';
  sellers.forEach(s => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${s.store_name || '—'}<br><span style="color:var(--text-dim); font-size:12px;">${s.full_name || ''} · ${s.email || ''}</span></td>
      <td class="mono">${s.plan}</td>
      <td class="mono">${skuCountBySeller[s.id] || 0}</td>
      <td class="mono">${openBySeller[s.id] || 0}</td>
      <td class="mono">${new Date(s.created_at).toLocaleDateString('uz-UZ')}</td>
    `;
    tbody.appendChild(tr);
  });
}

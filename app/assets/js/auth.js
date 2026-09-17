import { supabase } from './supabase-client.js';

export async function signUp(email, password, fullName, storeName) {
  const { data, error } = await supabase.auth.signUp({
    email, password,
    options: { data: { full_name: fullName, store_name: storeName } },
  });
  if (error) throw error;
  // store_name ni profiles jadvaliga ham yozib qo'yamiz (trigger full_name'ni yozadi)
  if (data.user) {
    await supabase.from('profiles').update({ store_name: storeName }).eq('id', data.user.id);
  }
  return data;
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  await supabase.auth.signOut();
  window.location.href = './login.html';
}

export async function getCurrentProfile() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single();
  if (error) return null;
  return { ...profile, email: session.user.email };
}

// Sahifani himoya qiladi: session bo'lmasa login'ga, rol mos kelmasa mos dashboard'ga yo'naltiradi.
export async function requireRole(requiredRole) {
  const profile = await getCurrentProfile();
  if (!profile) {
    window.location.href = './login.html';
    return null;
  }
  if (requiredRole && profile.role !== requiredRole && profile.role !== 'admin') {
    window.location.href = profile.role === 'admin' ? './admin-dashboard.html' : './seller-dashboard.html';
    return null;
  }
  return profile;
}

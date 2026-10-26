import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, Check, Cloud, FilePlus2, Layers3, LogOut, Pencil, Plus, ShieldCheck, Trash2, X } from 'lucide-react';

const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
async function api(path, options = {}) {
  const response = await fetch(`${API_URL}/api${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Request failed. Please try again.');
  return data;
}

function Brand() {
  return <div className="brand"><div className="brand-icon"><Cloud size={21} strokeWidth={2.4}/></div><span>cloudkeep</span><span className="brand-dot">.</span></div>;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [page, setPage] = useState('signin');
  const [checking, setChecking] = useState(true);
  const [items, setItems] = useState([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [form, setForm] = useState({ title: '', details: '' });
  const [editingId, setEditingId] = useState(null);
  const [showItemForm, setShowItemForm] = useState(false);

  const loadItems = useCallback(async () => {
    const data = await api('/items');
    setItems(data.items);
  }, []);

  useEffect(() => {
    api('/auth/me').then(({ user: currentUser }) => {
      setUser(currentUser);
      setPage('dashboard');
      return api('/items').then(({ items: currentItems }) => setItems(currentItems));
    }).catch(() => {}).finally(() => setChecking(false));
  }, []);

  function notify(message, type = 'success') {
    setNotice({ message, type });
    window.setTimeout(() => setNotice(null), 4200);
  }

  async function handleAuth(event) {
    event.preventDefault();
    setBusy(true);
    try {
      if (page === 'signup') {
        await api('/auth/signup', { method: 'POST', body: JSON.stringify({ email, password }) });
        setPage('signin');
        setPassword('');
        notify('Account created! Sign in with your new account.');
      } else {
        const data = await api('/auth/signin', { method: 'POST', body: JSON.stringify({ email, password }) });
        setUser(data.user);
        setPassword('');
        setPage('dashboard');
        setItems((await api('/items')).items);
        notify('Welcome back. You are signed in.');
      }
    } catch (error) { notify(error.message, 'error'); }
    finally { setBusy(false); }
  }

  async function signout() {
    try { await api('/auth/signout', { method: 'POST' }); } catch {}
    setUser(null); setItems([]); setPage('signin'); setEmail(''); setPassword('');
    notify('You have signed out.');
  }

  function openNewItem() {
    setEditingId(null); setForm({ title: '', details: '' }); setShowItemForm(true);
  }
  function openEditItem(item) {
    setEditingId(item.id); setForm({ title: item.title, details: item.details || '' }); setShowItemForm(true);
  }
  async function saveItem(event) {
    event.preventDefault(); setBusy(true);
    try {
      const method = editingId ? 'PUT' : 'POST';
      const path = editingId ? `/items/${editingId}` : '/items';
      await api(path, { method, body: JSON.stringify(form) });
      await loadItems(); setShowItemForm(false); setEditingId(null);
      setForm({ title: '', details: '' }); notify(editingId ? 'Item updated.' : 'Item added.');
    } catch (error) { notify(error.message, 'error'); }
    finally { setBusy(false); }
  }
  async function deleteItem(item) {
    if (!window.confirm(`Delete “${item.title}”? This cannot be undone.`)) return;
    try { await api(`/items/${item.id}`, { method: 'DELETE' }); await loadItems(); notify('Item deleted.'); }
    catch (error) { notify(error.message, 'error'); }
  }

  if (checking) return <div className="loading-screen"><div className="loader"/><span>Getting your space ready…</span></div>;

  if (!user || page !== 'dashboard') {
    const isSignup = page === 'signup';
    return <main className="auth-layout">
      <section className="auth-left">
        <div className="auth-top"><Brand/><span className="secure-label"><ShieldCheck size={15}/> Private by design</span></div>
        <div className="auth-content">
          <div className="eyebrow"><span className="eyebrow-dot"/> A LITTLE SPACE FOR YOUR IDEAS</div>
          <h1>Keep your things<br/>in <span>one calm place.</span></h1>
          <p className="auth-description">A simple, secure space to save notes, track little tasks, and keep life moving.</p>
          <div className="feature-list">
            <div><span className="feature-icon"><Layers3 size={18}/></span><span><strong>Everything together</strong><small>Your items, neatly organized in one place.</small></span></div>
            <div><span className="feature-icon"><ShieldCheck size={18}/></span><span><strong>Your account, your space</strong><small>Your items are only visible to you.</small></span></div>
            <div><span className="feature-icon"><Cloud size={18}/></span><span><strong>Ready for the cloud</strong><small>Access your space wherever you are.</small></span></div>
          </div>
        </div>
        <div className="auth-footer">A small step toward a little more clarity.</div>
      </section>
      <section className="auth-right">
        <div className="mobile-brand"><Brand/></div>
        <div className="auth-card-wrap">
          <div className="auth-card-heading"><div className="form-mark">{isSignup ? <FilePlus2 size={22}/> : <Cloud size={22}/>}</div><h2>{isSignup ? 'Create your account' : 'Welcome back'}</h2><p>{isSignup ? 'Start your own little corner of CloudKeep.' : 'Sign in to pick up where you left off.'}</p></div>
          <form className="auth-form" onSubmit={handleAuth}>
            <label htmlFor="email">Email address</label>
            <input id="email" type="email" placeholder="you@example.com" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required maxLength={254}/>
            <div className="password-label"><label htmlFor="password">Password</label>{isSignup && <span>8 characters minimum</span>}</div>
            <input id="password" type="password" placeholder={isSignup ? 'Create a strong password' : 'Enter your password'} autoComplete={isSignup ? 'new-password' : 'current-password'} value={password} onChange={e => setPassword(e.target.value)} required minLength={isSignup ? 8 : 1} maxLength={72}/>
            <button className="primary-button auth-submit" disabled={busy}>{busy ? 'Please wait…' : isSignup ? 'Create account' : 'Sign in'} {!busy && <ArrowRight size={17}/>}</button>
          </form>
          <div className="auth-switch">{isSignup ? 'Already have an account?' : 'New to CloudKeep?'} <button onClick={() => {setPage(isSignup ? 'signin' : 'signup');setPassword('');}}>{isSignup ? 'Sign in' : 'Create an account'}</button></div>
          <div className="auth-legal"><ShieldCheck size={14}/> Your password is securely hashed before it is stored.</div>
        </div>
        <div className="right-bottom">Built for your everyday.</div>
      </section>
      {notice && <div className={`toast ${notice.type}`}><span>{notice.type === 'success' ? <Check size={17}/> : <X size={17}/>}</span>{notice.message}<button onClick={() => setNotice(null)} aria-label="Dismiss"><X size={15}/></button></div>}
    </main>;
  }

  return <main className="app-shell">
    <header className="topbar"><Brand/><div className="topbar-right"><span className="online-pill"><span/> Your space is synced</span><div className="avatar">{user.email?.[0]?.toUpperCase() || 'U'}</div><button className="signout-button" onClick={signout}><LogOut size={16}/><span>Sign out</span></button></div></header>
    <section className="dashboard-main">
      <div className="welcome-row"><div><div className="eyebrow"><span className="eyebrow-dot"/> YOUR PERSONAL WORKSPACE</div><h1>Your space, <span>your pace.</span></h1><p className="dashboard-subtitle">A clear mind starts with getting things out of your head.</p></div><button className="primary-button add-button" onClick={openNewItem}><Plus size={18}/> Add an item</button></div>
      <div className="stats-grid"><div className="stat-card"><div className="stat-top"><span>Total items</span><span className="stat-icon lavender"><Layers3 size={18}/></span></div><div className="stat-number">{items.length}</div><div className="stat-caption">Things in your space</div></div><div className="stat-card"><div className="stat-top"><span>Account status</span><span className="stat-icon mint"><ShieldCheck size={18}/></span></div><div className="stat-number status-text">All good <Check size={18}/></div><div className="stat-caption">Signed in as {user.email}</div></div><div className="stat-card"><div className="stat-top"><span>Storage</span><span className="stat-icon peach"><Cloud size={18}/></span></div><div className="stat-number status-text">Cloud ready</div><div className="stat-caption">Your data is saved to MongoDB</div></div></div>
      <section className="items-panel"><div className="panel-heading"><div><h2>Your items</h2><p>Keep track of notes, ideas, and little reminders.</p></div><span className="item-count">{items.length} {items.length === 1 ? 'item' : 'items'}</span></div>
        {items.length === 0 ? <div className="empty-state"><div className="empty-illustration"><div className="empty-circle"><FilePlus2 size={30}/></div><span className="spark spark-one">✳</span><span className="spark spark-two">✦</span></div><h3>A fresh start.</h3><p>Your space is empty for now. Add your first item and start collecting your thoughts.</p><button className="secondary-button" onClick={openNewItem}><Plus size={17}/> Create your first item</button></div> : <div className="items-grid">{items.map(item => <article className="item-card" key={item.id}><div className="item-card-top"><span className="item-type"><FilePlus2 size={15}/> PERSONAL ITEM</span><div className="item-actions"><button onClick={() => openEditItem(item)} aria-label={`Edit ${item.title}`} title="Edit"><Pencil size={15}/></button><button className="delete-action" onClick={() => deleteItem(item)} aria-label={`Delete ${item.title}`} title="Delete"><Trash2 size={15}/></button></div></div><h3>{item.title}</h3><p className="item-details">{item.details || 'No details added.'}</p><div className="item-card-footer"><span>Added {new Date(item.created_at).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})}</span><span className="saved-dot"><Check size={13}/> Saved</span></div></article>)}</div>}
      </section>
      <footer className="dashboard-footer"><span><ShieldCheck size={15}/> Your items are private to your account.</span><span>Made for a little more clarity <span className="footer-heart">✳</span></span></footer>
    </section>
    {showItemForm && <div className="modal-backdrop" onMouseDown={e => {if(e.target === e.currentTarget) setShowItemForm(false);}}><section className="item-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-heading"><div><span className="eyebrow"><span className="eyebrow-dot"/> YOUR SPACE</span><h2 id="modal-title">{editingId ? 'Edit your item' : 'Add something new'}</h2><p>A note, a task, an idea — whatever you need.</p></div><button className="modal-close" onClick={() => setShowItemForm(false)} aria-label="Close"><X size={19}/></button></div><form onSubmit={saveItem} className="item-form"><label htmlFor="item-title">Title</label><input id="item-title" autoFocus value={form.title} onChange={e => setForm({...form,title:e.target.value})} placeholder="e.g. Project ideas" required maxLength={120}/><label htmlFor="item-details">Details <span className="optional">OPTIONAL</span></label><textarea id="item-details" value={form.details} onChange={e => setForm({...form,details:e.target.value})} placeholder="Add a few details to remember…" rows={4} maxLength={500}/><div className="modal-actions"><button type="button" className="cancel-button" onClick={() => setShowItemForm(false)}>Cancel</button><button className="primary-button" disabled={busy}>{busy ? 'Saving…' : editingId ? 'Save changes' : 'Save item'} {!busy && <ArrowRight size={16}/>}</button></div></form></section></div>}
    {notice && <div className={`toast ${notice.type}`}><span>{notice.type === 'success' ? <Check size={17}/> : <X size={17}/>}</span>{notice.message}<button onClick={() => setNotice(null)} aria-label="Dismiss"><X size={15}/></button></div>}
  </main>;
}

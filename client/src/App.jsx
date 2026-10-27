
import { useCallback, useEffect, useState } from 'react';
import {
  ArrowRight,
  Check,
  Cloud,
  FilePlus2,
  Layers3,
  LogOut,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  X,
  Users,
  LockKeyhole,
  Package,
  ShoppingCart,
  ClipboardList,
  Search,
  AlertTriangle,
  RefreshCw,
  Boxes
} from 'lucide-react';

import './inventory.css';

const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

async function api(path, options = {}) {
  const response = await fetch(`${API_URL}/api${path}`, {
    credentials: 'include',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.message || data.error || 'Request failed. Please try again.'
    );
  }

  return data;
}

const transitions = {
  placed: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: ['completed'],
  completed: [],
  cancelled: []
};

const statusLabels = {
  placed: 'Order placed',
  confirmed: 'Confirmed',
  processing: 'Processing',
  shipped: 'Shipped',
  delivered: 'Delivered',
  completed: 'Completed',
  cancelled: 'Cancelled'
};

function Brand() {
  return (
    <div className="brand">
      <div className="brand-icon">
        <Cloud size={21} strokeWidth={2.4} />
      </div>
      <span>StashSpark</span>
      <span className="brand-dot">.</span>
    </div>
  );
}

function money(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2
  }).format(value || 0);
}

export default function App() {
  const [user, setUser] = useState(null);
  const [page, setPage] = useState('signin');
  const [view, setView] = useState('catalog');
  const [checking, setChecking] = useState(true);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState('user');
  const [adminCode, setAdminCode] = useState('');

  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [quantities, setQuantities] = useState({});

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProductId, setEditingProductId] = useState(null);

  const emptyProductForm = {
    name: '',
    sku: '',
    description: '',
    category: '',
    price: '',
    stock: '0',
    reorderLevel: '5'
  };

  const [productForm, setProductForm] = useState(emptyProductForm);

  const isAdmin = user?.role === 'admin';

  const notify = useCallback((message, type = 'success') => {
    setNotice({ message, type });
    window.setTimeout(() => setNotice(null), 4500);
  }, []);

  const loadProducts = useCallback(async () => {
    const data = await api('/products');
    setProducts(data.products || []);
  }, []);

  const loadOrders = useCallback(async () => {
    const data = await api('/orders');
    setOrders(data.orders || []);
  }, []);

  const refreshWorkspace = useCallback(async () => {
    await Promise.all([loadProducts(), loadOrders()]);
  }, [loadProducts, loadOrders]);

  useEffect(() => {
    let active = true;

    async function restoreSession() {
      try {
        const result = await api('/auth/me');

        if (!active) return;

        setUser(result.user);
        setPage('dashboard');

        const [productResult, orderResult] = await Promise.all([
          api('/products'),
          api('/orders')
        ]);

        if (!active) return;

        setProducts(productResult.products || []);
        setOrders(orderResult.orders || []);
      } catch {
        // No valid session, so show the sign-in page.
      } finally {
        if (active) setChecking(false);
      }
    }

    restoreSession();

    return () => {
      active = false;
    };
  }, []);

  async function handleAuth(event) {
    event.preventDefault();
    setBusy(true);

    try {
      if (page === 'signup') {
        await api('/auth/signup', {
          method: 'POST',
          body: JSON.stringify({
            email,
            password,
            role: selectedRole,
            ...(selectedRole === 'admin' ? { adminCode } : {})
          })
        });

        setPage('signin');
        setPassword('');
        setAdminCode('');
        setSelectedRole('user');

        notify('Account created. Sign in to continue.');
      } else {
        const result = await api('/auth/signin', {
          method: 'POST',
          body: JSON.stringify({ email, password })
        });

        setUser(result.user);
        setPassword('');
        setPage('dashboard');
        setView('catalog');

        await refreshWorkspace();

        notify('Welcome to StashSpark!');
      }
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function signout() {
    try {
      await api('/auth/signout', { method: 'POST' });
    } catch {
      // Clear local UI even if the network request fails.
    }

    setUser(null);
    setProducts([]);
    setOrders([]);
    setPage('signin');
    setView('catalog');
    setEmail('');
    setPassword('');
    setAdminCode('');
    setSelectedRole('user');

    notify('You have signed out.');
  }

  function openNewProduct() {
    setEditingProductId(null);
    setProductForm(emptyProductForm);
    setShowProductForm(true);
  }

  function openEditProduct(product) {
    setEditingProductId(product.id);

    setProductForm({
      name: product.name,
      sku: product.sku,
      description: product.description || '',
      category: product.category,
      price: String(product.price),
      stock: String(product.stock),
      reorderLevel: String(product.reorderLevel)
    });

    setShowProductForm(true);
  }

  async function saveProduct(event) {
    event.preventDefault();
    setBusy(true);

    try {
      const payload = {
        ...productForm,
        price: Number(productForm.price),
        stock: Number(productForm.stock),
        reorderLevel: Number(productForm.reorderLevel)
      };

      const editing = Boolean(editingProductId);

      await api(
        editing
          ? `/products/${editingProductId}`
          : '/products',
        {
          method: editing ? 'PUT' : 'POST',
          body: JSON.stringify(payload)
        }
      );

      await loadProducts();

      setShowProductForm(false);
      setEditingProductId(null);
      setProductForm(emptyProductForm);

      notify(editing ? 'Product updated.' : 'Product added.');
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function deactivateProduct(product) {
    if (
      !window.confirm(
        `Deactivate "${product.name}"? Customers will no longer be able to order it.`
      )
    ) {
      return;
    }

    try {
      await api(`/products/${product.id}`, {
        method: 'DELETE'
      });

      await loadProducts();
      notify('Product deactivated.');
    } catch (error) {
      notify(error.message, 'error');
    }
  }

  async function placeOrder(product) {
    const quantity = Number(quantities[product.id] || 1);

    if (!Number.isInteger(quantity) || quantity < 1) {
      notify('Enter a valid quantity.', 'error');
      return;
    }

    setBusy(true);

    try {
      await api('/orders', {
        method: 'POST',
        body: JSON.stringify({
          productId: product.id,
          quantity
        })
      });

      await refreshWorkspace();

      setQuantities(current => ({
        ...current,
        [product.id]: 1
      }));

      notify(`Order placed for ${product.name}.`);
    } catch (error) {
      notify(error.message, 'error');

      // Refresh stock after an unsuccessful order attempt.
      try {
        await loadProducts();
      } catch {
        // Preserve the original error message.
      }
    } finally {
      setBusy(false);
    }
  }

  async function updateOrderStatus(order, status) {
    setBusy(true);

    try {
      await api(`/orders/${order.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });

      await refreshWorkspace();
      notify(`Order status updated: ${statusLabels[status]}.`);
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function confirmReceived(order) {
    setBusy(true);

    try {
      await api(`/orders/${order.id}/received`, {
        method: 'POST'
      });

      await refreshWorkspace();
      notify('Receipt confirmed. Thank you!');
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  const categories = [
    ...new Set(products.filter(p => p.isActive).map(p => p.category))
  ].sort();

  const visibleProducts = products.filter(product => {
    const query = search.trim().toLowerCase();

    const matchesSearch =
      !query ||
      product.name.toLowerCase().includes(query) ||
      product.sku.toLowerCase().includes(query) ||
      product.category.toLowerCase().includes(query);

    const matchesCategory =
      categoryFilter === 'all' ||
      product.category === categoryFilter;

    return matchesSearch && matchesCategory;
  });

  const activeProducts = products.filter(p => p.isActive);
  const lowStockProducts = activeProducts.filter(
    p => p.stock <= p.reorderLevel
  );

  const totalUnits = activeProducts.reduce(
    (total, product) => total + product.stock,
    0
  );

  const inventoryValue = activeProducts.reduce(
    (total, product) => total + product.stock * product.price,
    0
  );

  const pendingOrders = orders.filter(order =>
    !['completed', 'cancelled'].includes(order.status)
  ).length;

  if (checking) {
    return (
      <div className="loading-screen">
        <div className="loader" />
        <span>Getting StashSpark ready…</span>
      </div>
    );
  }

  if (!user || page !== 'dashboard') {
    const isSignup = page === 'signup';

    return (
      <main className="auth-layout">
        <section className="auth-left">
          <div className="auth-top">
            <Brand />
            <span className="secure-label">
              <ShieldCheck size={15} /> Inventory, organized
            </span>
          </div>

          <div className="auth-content">
            <div className="eyebrow">
              <span className="eyebrow-dot" />
              SIMPLE INVENTORY. BETTER CONTROL.
            </div>

            <h1>
              Stock smarter.
              <br />
              Order <span>simpler.</span>
            </h1>

            <p className="auth-description">
              Manage products, keep stock accurate, and track customer
              orders in one easy workspace.
            </p>

            <div className="feature-list">
              <div>
                <span className="feature-icon"><Package size={18} /></span>
                <span>
                  <strong>Product catalogue</strong>
                  <small>Browse items and available stock.</small>
                </span>
              </div>
              <div>
                <span className="feature-icon"><ShoppingCart size={18} /></span>
                <span>
                  <strong>Simple ordering</strong>
                  <small>Place orders and follow their progress.</small>
                </span>
              </div>
              <div>
                <span className="feature-icon"><ShieldCheck size={18} /></span>
                <span>
                  <strong>Role-based access</strong>
                  <small>Customers order; admins manage inventory.</small>
                </span>
              </div>
            </div>
          </div>

          <div className="auth-footer">
            StashSpark — your inventory, in sync.
          </div>
        </section>

        <section className="auth-right">
          <div className="mobile-brand"><Brand /></div>

          <div className="auth-card-wrap">
            <div className="auth-card-heading">
              <div className="form-mark">
                {isSignup ? <FilePlus2 size={22} /> : <Cloud size={22} />}
              </div>

              <h2>{isSignup ? 'Create your account' : 'Welcome back'}</h2>
              <p>
                {isSignup
                  ? 'Create a customer account or register as an authorized admin.'
                  : 'Sign in to your StashSpark workspace.'}
              </p>
            </div>

            <form className="auth-form" onSubmit={handleAuth}>
              {isSignup && (
                <>
                  <label htmlFor="account-role">Account type</label>
                  <select
                    id="account-role"
                    value={selectedRole}
                    onChange={event => {
                      setSelectedRole(event.target.value);
                      setAdminCode('');
                    }}
                  >
                    <option value="user">Customer</option>
                    <option value="admin">Admin</option>
                  </select>

                  {selectedRole === 'admin' && (
                    <div className="admin-code-field">
                      <label htmlFor="admin-code">
                        <LockKeyhole size={14} /> Admin invitation code
                      </label>
                      <input
                        id="admin-code"
                        type="password"
                        value={adminCode}
                        onChange={event => setAdminCode(event.target.value)}
                        placeholder="Enter invitation code"
                        autoComplete="off"
                        required
                      />
                      <p className="role-help">
                        Admin registration requires an authorized invitation code.
                      </p>
                    </div>
                  )}
                </>
              )}

              <label htmlFor="email">Email address</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={event => setEmail(event.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                maxLength={254}
                required
              />

              <div className="password-label">
                <label htmlFor="password">Password</label>
                {isSignup && <span>8 characters minimum</span>}
              </div>

              <input
                id="password"
                type="password"
                value={password}
                onChange={event => setPassword(event.target.value)}
                placeholder={isSignup ? 'Create a password' : 'Enter your password'}
                autoComplete={isSignup ? 'new-password' : 'current-password'}
                minLength={isSignup ? 8 : 1}
                maxLength={72}
                required
              />

              <button className="primary-button auth-submit" disabled={busy}>
                {busy ? 'Please wait…' : isSignup ? 'Create account' : 'Sign in'}
                {!busy && <ArrowRight size={17} />}
              </button>
            </form>

            <div className="auth-switch">
              {isSignup ? 'Already have an account?' : 'New to StashSpark?'}
              {' '}
              <button
                onClick={() => {
                  setPage(isSignup ? 'signin' : 'signup');
                  setPassword('');
                  setAdminCode('');
                  setSelectedRole('user');
                }}
              >
                {isSignup ? 'Sign in' : 'Create an account'}
              </button>
            </div>

            <div className="auth-legal">
              <ShieldCheck size={14} />
              Access permissions are enforced by the backend.
            </div>
          </div>

          <div className="right-bottom">Built for better stock management.</div>
        </section>

        {notice && (
          <div className={`toast ${notice.type}`}>
            <span>
              {notice.type === 'success' ? <Check size={17} /> : <X size={17} />}
            </span>
            {notice.message}
            <button onClick={() => setNotice(null)} aria-label="Dismiss">
              <X size={15} />
            </button>
          </div>
        )}
      </main>
    );
  }

  return (
    <main className="app-shell inventory-shell">
      <header className="topbar">
        <Brand />

        <div className="topbar-right">
          <span className="online-pill">
            <span />
            {isAdmin ? 'Admin workspace' : 'Customer workspace'}
          </span>

          <div className={`role-badge ${isAdmin ? 'admin' : 'user'}`}>
            {isAdmin ? <ShieldCheck size={13} /> : <Users size={13} />}
            {isAdmin ? 'Admin' : 'Customer'}
          </div>

          <div className="avatar">
            {user.email?.[0]?.toUpperCase() || 'U'}
          </div>

          <button className="signout-button" onClick={signout}>
            <LogOut size={16} />
            <span>Sign out</span>
          </button>
        </div>
      </header>

      <section className="dashboard-main inventory-main">
        <div className="welcome-row inventory-welcome">
          <div>
            <div className="eyebrow">
              <span className="eyebrow-dot" />
              {isAdmin ? 'INVENTORY CONTROL' : 'PRODUCT CATALOGUE'}
            </div>

            <h1>
              {isAdmin
                ? <>Manage stock, <span>stay ahead.</span></>
                : <>Find your next <span>favourite.</span></>}
            </h1>

            <p className="dashboard-subtitle">
              {isAdmin
                ? 'Manage products, review every order, and keep inventory accurate.'
                : 'Explore available products and follow your orders from placement to delivery.'}
            </p>
          </div>

          {isAdmin && (
            <button className="primary-button add-button" onClick={openNewProduct}>
              <Plus size={18} /> Add product
            </button>
          )}
        </div>

        <nav className="inventory-nav">
          <button
            className={view === 'catalog' ? 'active' : ''}
            onClick={() => setView('catalog')}
          >
            <Boxes size={17} />
            {isAdmin ? 'Inventory' : 'Products'}
          </button>

          <button
            className={view === 'orders' ? 'active' : ''}
            onClick={() => setView('orders')}
          >
            <ClipboardList size={17} />
            {isAdmin ? 'All orders' : 'My orders'}
            {pendingOrders > 0 && (
              <span className="nav-count">{pendingOrders}</span>
            )}
          </button>

          <button
            className="refresh-button"
            onClick={() => refreshWorkspace().catch(error => notify(error.message, 'error'))}
            title="Refresh data"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </nav>

        {view === 'catalog' && (
          <>
            <div className="inventory-stats">
              <div className="inventory-stat">
                <span className="inventory-stat-icon purple"><Package size={19} /></span>
                <span className="inventory-stat-label">Active products</span>
                <strong>{activeProducts.length}</strong>
              </div>

              <div className="inventory-stat">
                <span className="inventory-stat-icon blue"><Boxes size={19} /></span>
                <span className="inventory-stat-label">
                  {isAdmin ? 'Units in stock' : 'Products available'}
                </span>
                <strong>{isAdmin ? totalUnits : activeProducts.length}</strong>
              </div>

              <div className="inventory-stat">
                <span className="inventory-stat-icon orange">
                  <AlertTriangle size={19} />
                </span>
                <span className="inventory-stat-label">Low stock</span>
                <strong>{lowStockProducts.length}</strong>
              </div>

              {isAdmin && (
                <div className="inventory-stat">
                  <span className="inventory-stat-icon green"><Layers3 size={19} /></span>
                  <span className="inventory-stat-label">Stock value at selling price</span>
                  <strong>{money(inventoryValue)}</strong>
                </div>
              )}
            </div>

            {isAdmin && lowStockProducts.length > 0 && (
              <div className="low-stock-banner">
                <AlertTriangle size={18} />
                <div>
                  <strong>{lowStockProducts.length} product(s) need attention</strong>
                  <p>Review low quantities and consider updating inventory.</p>
                </div>
              </div>
            )}

            <section className="inventory-panel">
              <div className="inventory-panel-heading">
                <div>
                  <h2>{isAdmin ? 'Product inventory' : 'Browse products'}</h2>
                  <p>
                    {isAdmin
                      ? 'Update product information and available stock.'
                      : 'Choose a product and quantity to place your order.'}
                  </p>
                </div>

                <span className="item-count">
                  {visibleProducts.length} products
                </span>
              </div>

              <div className="inventory-filters">
                <div className="inventory-search">
                  <Search size={17} />
                  <input
                    value={search}
                    onChange={event => setSearch(event.target.value)}
                    placeholder="Search product name, SKU or category…"
                  />
                </div>

                <select
                  value={categoryFilter}
                  onChange={event => setCategoryFilter(event.target.value)}
                  aria-label="Filter by category"
                >
                  <option value="all">All categories</option>
                  {categories.map(category => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              {visibleProducts.length === 0 ? (
                <div className="inventory-empty">
                  <Package size={32} />
                  <h3>No products found</h3>
                  <p>
                    {isAdmin
                      ? 'Add your first product or adjust the search filters.'
                      : 'There are no products matching your search right now.'}
                  </p>
                  {isAdmin && (
                    <button className="primary-button" onClick={openNewProduct}>
                      <Plus size={16} /> Add product
                    </button>
                  )}
                </div>
              ) : (
                <div className="product-grid">
                  {visibleProducts.map(product => {
                    const lowStock = product.stock <= product.reorderLevel;

                    return (
                      <article className="product-card" key={product.id}>
                        <div className="product-card-top">
                          <div className="product-image-placeholder">
                            <Package size={28} />
                          </div>

                          <span className={`stock-badge ${lowStock ? 'low' : 'good'}`}>
                            {product.stock === 0
                              ? 'Out of stock'
                              : lowStock
                                ? 'Low stock'
                                : 'In stock'}
                          </span>
                        </div>

                        <div className="product-category">{product.category}</div>
                        <h3>{product.name}</h3>
                        <p className="product-sku">SKU: {product.sku}</p>
                        <p className="product-description">
                          {product.description || 'No description provided.'}
                        </p>

                        <div className="product-price-row">
                          <strong>{money(product.price)}</strong>
                          <span>{product.stock} available</span>
                        </div>

                        {isAdmin ? (
                          <div className="product-admin-actions">
                            <button
                              className="secondary-button"
                              onClick={() => openEditProduct(product)}
                            >
                              <Pencil size={15} /> Edit
                            </button>

                            {product.isActive && (
                              <button
                                className="danger-button"
                                onClick={() => deactivateProduct(product)}
                              >
                                <Trash2 size={15} /> Deactivate
                              </button>
                            )}

                            {!product.isActive && (
                              <span className="inactive-label">
                                Inactive
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="product-order-actions">
                            <label htmlFor={`qty-${product.id}`}>Quantity</label>

                            <input
                              id={`qty-${product.id}`}
                              type="number"
                              min="1"
                              max={product.stock}
                              value={quantities[product.id] ?? 1}
                              disabled={product.stock < 1 || busy}
                              onChange={event => {
                                setQuantities(current => ({
                                  ...current,
                                  [product.id]: event.target.value
                                }));
                              }}
                            />

                            <button
                              className="primary-button"
                              disabled={product.stock < 1 || busy}
                              onClick={() => placeOrder(product)}
                            >
                              <ShoppingCart size={15} />
                              {product.stock < 1 ? 'Unavailable' : 'Place order'}
                            </button>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}

        {view === 'orders' && (
          <section className="inventory-panel orders-panel">
            <div className="inventory-panel-heading">
              <div>
                <h2>{isAdmin ? 'Customer orders' : 'My orders'}</h2>
                <p>
                  {isAdmin
                    ? 'Review orders and update their fulfilment status.'
                    : 'Track the status of your purchases and confirm receipt.'}
                </p>
              </div>

              <span className="item-count">{orders.length} orders</span>
            </div>

            {orders.length === 0 ? (
              <div className="inventory-empty">
                <ShoppingCart size={32} />
                <h3>No orders yet</h3>
                <p>
                  {isAdmin
                    ? 'Customer orders will appear here.'
                    : 'Browse products and place your first order.'}
                </p>

                {!isAdmin && (
                  <button className="primary-button" onClick={() => setView('catalog')}>
                    Browse products
                  </button>
                )}
              </div>
            ) : (
              <div className="order-list">
                {orders.map(order => {
                  const nextStatuses = transitions[order.status] || [];

                  return (
                    <article className="order-card" key={order.id}>
                      <div className="order-card-heading">
                        <div className="order-product-icon">
                          <Package size={21} />
                        </div>

                        <div className="order-heading-text">
                          <h3>{order.productName}</h3>
                          <p>
                            Order #{order.id.slice(-8).toUpperCase()}
                            {' · '}
                            {new Date(order.createdAt).toLocaleDateString()}
                          </p>
                        </div>

                        <span className={`order-status status-${order.status}`}>
                          {statusLabels[order.status] || order.status}
                        </span>
                      </div>

                      {isAdmin && order.userEmail && (
                        <div className="order-customer">
                          <Users size={15} />
                          Customer: {order.userEmail}
                        </div>
                      )}

                      <div className="order-details-grid">
                        <div>
                          <span>Quantity</span>
                          <strong>{order.quantity}</strong>
                        </div>
                        <div>
                          <span>Unit price</span>
                          <strong>{money(order.unitPrice)}</strong>
                        </div>
                        <div>
                          <span>Total</span>
                          <strong>{money(order.totalAmount)}</strong>
                        </div>
                        <div>
                          <span>SKU</span>
                          <strong>{order.sku}</strong>
                        </div>
                      </div>

                      {order.receivedAt && (
                        <p className="received-note">
                          <Check size={15} />
                          Receipt confirmed on{' '}
                          {new Date(order.receivedAt).toLocaleDateString()}
                        </p>
                      )}

                      {isAdmin && nextStatuses.length > 0 && (
                        <div className="order-admin-actions">
                          <span>Update status:</span>

                          {nextStatuses.map(status => (
                            <button
                              key={status}
                              className={
                                status === 'cancelled'
                                  ? 'danger-button'
                                  : 'secondary-button'
                              }
                              disabled={busy}
                              onClick={() => updateOrderStatus(order, status)}
                            >
                              {status === 'cancelled'
                                ? 'Cancel order'
                                : `Mark ${statusLabels[status]}`}
                            </button>
                          ))}
                        </div>
                      )}

                      {!isAdmin &&
                        ['delivered', 'completed'].includes(order.status) &&
                        !order.receivedAt && (
                          <button
                            className="primary-button received-button"
                            disabled={busy}
                            onClick={() => confirmReceived(order)}
                          >
                            <Check size={16} />
                            Confirm order received
                          </button>
                        )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}

        <footer className="dashboard-footer">
          <span>
            <ShieldCheck size={15} />
            {isAdmin
              ? 'Only administrators can manage inventory.'
              : 'Your orders are visible only to you and authorized admins.'}
          </span>
          <span>StashSpark <span className="footer-heart">✳</span></span>
        </footer>
      </section>

      {showProductForm && isAdmin && (
        <div
          className="modal-backdrop"
          onMouseDown={event => {
            if (event.target === event.currentTarget) {
              setShowProductForm(false);
            }
          }}
        >
          <section
            className="item-modal inventory-product-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-form-title"
          >
            <div className="modal-heading">
              <div>
                <span className="eyebrow">
                  <span className="eyebrow-dot" />
                  INVENTORY MANAGEMENT
                </span>

                <h2 id="product-form-title">
                  {editingProductId ? 'Edit product' : 'Add a product'}
                </h2>

                <p>Product and stock details are saved to MongoDB.</p>
              </div>

              <button
                className="modal-close"
                onClick={() => setShowProductForm(false)}
                aria-label="Close"
              >
                <X size={19} />
              </button>
            </div>

            <form className="item-form product-form" onSubmit={saveProduct}>
              <label htmlFor="product-name">Product name</label>
              <input
                id="product-name"
                value={productForm.name}
                onChange={event => setProductForm({
                  ...productForm,
                  name: event.target.value
                })}
                required
                maxLength={120}
              />

              <div className="product-form-two">
                <div>
                  <label htmlFor="product-sku">SKU</label>
                  <input
                    id="product-sku"
                    value={productForm.sku}
                    onChange={event => setProductForm({
                      ...productForm,
                      sku: event.target.value.toUpperCase()
                    })}
                    required
                    maxLength={40}
                  />
                </div>

                <div>
                  <label htmlFor="product-category">Category</label>
                  <input
                    id="product-category"
                    value={productForm.category}
                    onChange={event => setProductForm({
                      ...productForm,
                      category: event.target.value
                    })}
                    required
                    maxLength={80}
                  />
                </div>
              </div>

              <label htmlFor="product-description">Description</label>
              <textarea
                id="product-description"
                value={productForm.description}
                onChange={event => setProductForm({
                  ...productForm,
                  description: event.target.value
                })}
                rows={3}
                maxLength={1000}
              />

              <div className="product-form-three">
                <div>
                  <label htmlFor="product-price">Price (₹)</label>
                  <input
                    id="product-price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={productForm.price}
                    onChange={event => setProductForm({
                      ...productForm,
                      price: event.target.value
                    })}
                    required
                  />
                </div>

                <div>
                  <label htmlFor="product-stock">Stock</label>
                  <input
                    id="product-stock"
                    type="number"
                    min="0"
                    step="1"
                    value={productForm.stock}
                    onChange={event => setProductForm({
                      ...productForm,
                      stock: event.target.value
                    })}
                    required
                  />
                </div>

                <div>
                  <label htmlFor="product-reorder">Reorder at</label>
                  <input
                    id="product-reorder"
                    type="number"
                    min="0"
                    step="1"
                    value={productForm.reorderLevel}
                    onChange={event => setProductForm({
                      ...productForm,
                      reorderLevel: event.target.value
                    })}
                    required
                  />
                </div>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="cancel-button"
                  onClick={() => setShowProductForm(false)}
                >
                  Cancel
                </button>

                <button className="primary-button" disabled={busy}>
                  {busy
                    ? 'Saving…'
                    : editingProductId
                      ? 'Save changes'
                      : 'Create product'}
                  {!busy && <ArrowRight size={16} />}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {notice && (
        <div className={`toast ${notice.type}`}>
          <span>
            {notice.type === 'success' ? <Check size={17} /> : <X size={17} />}
          </span>
          {notice.message}
          <button onClick={() => setNotice(null)} aria-label="Dismiss">
            <X size={15} />
          </button>
        </div>
      )}
    </main>
  );
}


import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { connectDatabase, mongoose } from './db.js';
import { User } from './models/User.js';
import { Item } from './models/Item.js';
import { Product } from './models/Product.js';
import { Order } from './models/Order.js';
import { z } from 'zod';
const app = express();
const port = Number(process.env.PORT || 5000);
const isProduction = process.env.NODE_ENV === 'production';

const DEFAULT_JWT_SECRET =
  'replace_this_with_a_long_random_secret';

const DEFAULT_ADMIN_CODE =
  'replace_with_a_long_random_admin_invite_code';

if (
  !process.env.JWT_SECRET ||
  process.env.JWT_SECRET === DEFAULT_JWT_SECRET
) {
  if (isProduction) {
    throw new Error(
      'Set a strong, private JWT_SECRET in server/.env.'
    );
  }

  console.warn(
    'WARNING: Configure a private JWT_SECRET.'
  );
}

app.disable('x-powered-by');
app.use(helmet());

app.use(cors({
  origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  credentials: true
}));

app.use(express.json({ limit: '50kb' }));
app.use(cookieParser());
// =====================================================
// RATE LIMITING
// =====================================================

// General API limit: 100 requests per 15 minutes per IP.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests. Please try again later.'
  }
});

// Authentication limit: 10 requests per 15 minutes per IP.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many authentication attempts. Please try again in 15 minutes.'
  }
});

// Apply the general limit to API endpoints.
app.use('/api', apiLimiter);
// =====================================================
// CSRF PROTECTION: CHECK REQUEST ORIGIN
// =====================================================
//uknow 
const trustedClientOrigin =
  process.env.CLIENT_ORIGIN || 'http://localhost:5173';

app.use('/api', (req, res, next) => {
  const modifyingMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];

  // Read-only requests do not need this Origin check.
  if (!modifyingMethods.includes(req.method)) {
    return next();
  }

  const requestOrigin = req.get('origin');

  // Reject missing or untrusted origins.
  if (!requestOrigin || requestOrigin !== trustedClientOrigin) {
    return res.status(403).json({
      error: 'Request origin is not allowed.'
    });
  }

  return next();
});
const cookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? 'none' : 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/'
};

// =====================================================
// AUTHENTICATION HELPERS
// =====================================================

function createToken(user) {
  return jwt.sign(
    {
      sub: user._id.toString(),
      email: user.email
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

async function requireAuth(req, res, next) {
  const token = req.cookies?.session;

  if (!token) {
    return res.status(401).json({
      error: 'Please sign in to continue.'
    });
  }

  let decoded;

  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    res.clearCookie('session', cookieOptions);

    return res.status(401).json({
      error: 'Your session expired. Please sign in again.'
    });
  }

  if (!mongoose.isValidObjectId(decoded.sub)) {
    res.clearCookie('session', cookieOptions);

    return res.status(401).json({
      error: 'Invalid session.'
    });
  }

  try {
    // Always read the current role from the database.
    const account = await User.findById(decoded.sub)
      .select('email role');

    if (!account) {
      res.clearCookie('session', cookieOptions);

      return res.status(401).json({
        error: 'Account not found.'
      });
    }

    req.user = {
      sub: account._id.toString(),
      email: account.email,
      role: account.role === 'admin' ? 'admin' : 'user'
    };

    return next();
  } catch (error) {
    return next(error);
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({
      error: 'Admin access is required.'
    });
  }

  return next();
}

const validEmail = (email) =>
  typeof email === 'string' &&
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
  email.length <= 254;

const isValidId = (id) =>
  mongoose.isValidObjectId(id);

// =====================================================
// RESPONSE HELPERS
// =====================================================

function publicUser(user) {
  return {
    id: user._id.toString(),
    email: user.email,
    role: user.role === 'admin' ? 'admin' : 'user',
    created_at: user.createdAt
  };
}

function publicItem(item) {
  return {
    id: item._id.toString(),
    title: item.title,
    details: item.details,
    created_at: item.createdAt,
    updated_at: item.updatedAt
  };
}

function publicProduct(product) {
  return {
    id: product._id.toString(),
    name: product.name,
    sku: product.sku,
    description: product.description || '',
    category: product.category,
    price: product.price,
    stock: product.stock,
    reorderLevel: product.reorderLevel,
    isActive: product.isActive,
    createdBy: product.createdBy?.toString?.() ?? product.createdBy,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt
  };
}

function publicOrder(order) {
  const user = order.userId;

  const userId =
    user && typeof user === 'object' && user._id
      ? user._id.toString()
      : user?.toString();

  return {
    id: order._id.toString(),
    userId,
    userEmail:
      user && typeof user === 'object'
        ? user.email
        : undefined,
    productId: order.productId.toString(),
    productName: order.productName,
    sku: order.sku,
    quantity: order.quantity,
    unitPrice: order.unitPrice,
    totalAmount: order.totalAmount,
    status: order.status,
    receivedAt: order.receivedAt,
    completedAt: order.completedAt,
    stockRestored: order.stockRestored,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt
  };
}

// =====================================================
// PRODUCT VALIDATION
// =====================================================

function parseProductPayload(body, { partial = false } = {}) {
  if (
    !body ||
    typeof body !== 'object' ||
    Array.isArray(body)
  ) {
    return { error: 'Request body must be a JSON object.' };
  }

  const data = {};

  const has = (key) =>
    Object.prototype.hasOwnProperty.call(body, key);

  const supplied = (key) =>
    has(key) && body[key] !== undefined;

  if (!partial || supplied('name')) {
    if (
      typeof body.name !== 'string' ||
      !body.name.trim() ||
      body.name.trim().length > 120
    ) {
      return { error: 'Enter a valid product name.' };
    }

    data.name = body.name.trim();
  }

  if (!partial || supplied('sku')) {
    if (typeof body.sku !== 'string') {
      return { error: 'SKU is required.' };
    }

    const sku = body.sku.trim().toUpperCase();

    if (
      !sku ||
      sku.length > 40 ||
      !/^[A-Z0-9][A-Z0-9._-]*$/.test(sku)
    ) {
      return { error: 'Enter a valid SKU.' };
    }

    data.sku = sku;
  }

  if (!partial || supplied('category')) {
    if (
      typeof body.category !== 'string' ||
      !body.category.trim() ||
      body.category.trim().length > 80
    ) {
      return { error: 'Enter a valid category.' };
    }

    data.category = body.category.trim();
  }

  if (!partial || supplied('price')) {
    const raw = body.price;

    if (
      raw === '' ||
      raw === null ||
      raw === undefined ||
      (typeof raw === 'string' && !raw.trim())
    ) {
      return { error: 'Enter a valid price.' };
    }

    const value = typeof raw === 'number' ? raw : Number(raw);

    if (!Number.isFinite(value) || value < 0) {
      return { error: 'Price must be non-negative.' };
    }

    data.price = value;
  }

  if (!partial || supplied('stock')) {
    const raw = body.stock;

    if (
      raw === '' ||
      raw === null ||
      raw === undefined ||
      (typeof raw === 'string' && !raw.trim())
    ) {
      return { error: 'Enter a valid stock quantity.' };
    }

    const value = typeof raw === 'number' ? raw : Number(raw);

    if (!Number.isInteger(value) || value < 0) {
      return {
        error: 'Stock must be a non-negative whole number.'
      };
    }

    data.stock = value;
  }

  if (supplied('description') || !partial) {
    const raw = body.description === undefined
      ? ''
      : body.description;

    if (typeof raw !== 'string' || raw.length > 1000) {
      return { error: 'Description must be at most 1000 characters.' };
    }

    data.description = raw.trim();
  }

  if (supplied('reorderLevel') || !partial) {
    const raw = body.reorderLevel === undefined
      ? 5
      : body.reorderLevel;

    const value = typeof raw === 'number' ? raw : Number(raw);

    if (
      (typeof raw === 'string' && !raw.trim()) ||
      !Number.isInteger(value) ||
      value < 0
    ) {
      return {
        error: 'Reorder level must be a non-negative integer.'
      };
    }

    data.reorderLevel = value;
  }

  if (partial && supplied('isActive')) {
    if (typeof body.isActive !== 'boolean') {
      return { error: 'isActive must be true or false.' };
    }

    data.isActive = body.isActive;
  }

  if (partial && Object.keys(data).length === 0) {
    return { error: 'Provide fields to update.' };
  }

  return { data };
}

// =====================================================
// LEGACY ITEM WORKSPACE HELPERS
// =====================================================

function itemFilterFor(user) {
  if (user.role === 'admin') {
    return { scope: 'admin' };
  }

  return {
    userId: user.sub,
    $or: [
      { scope: 'personal' },
      { scope: { $exists: false } }
    ]
  };
}

function itemFilterByIdFor(user, id) {
  if (user.role === 'admin') {
    return { _id: id, scope: 'admin' };
  }

  return {
    _id: id,
    userId: user.sub,
    $or: [
      { scope: 'personal' },
      { scope: { $exists: false } }
    ]
  };
}

// =====================================================
// HEALTH CHECK
// =====================================================

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    database:
      mongoose.connection.readyState === 1
        ? 'connected'
        : 'disconnected'
  });
});

// =====================================================
// AUTHENTICATION ROUTES
// =====================================================

app.post('/api/auth/signup', authLimiter, async (req, res, next) => {
  try {
    const body = req.body ?? {};

    const email =
      typeof body.email === 'string'
        ? body.email.trim().toLowerCase()
        : '';

    const password = body.password;

    const requestedRole =
      body.role === undefined ? 'user' : body.role;

    const adminCode =
      typeof body.adminCode === 'string'
        ? body.adminCode
        : '';

    if (!validEmail(email)) {
      return res.status(400).json({
        error: 'Enter a valid email address.'
      });
    }

    if (
      typeof password !== 'string' ||
      password.length < 8 ||
      password.length > 72
    ) {
      return res.status(400).json({
        error: 'Password must be 8–72 characters long.'
      });
    }

    if (!['user', 'admin'].includes(requestedRole)) {
      return res.status(400).json({
        error: 'Choose either User or Admin.'
      });
    }

    if (requestedRole === 'admin') {
      const configuredCode = process.env.ADMIN_SIGNUP_CODE;

      if (
        !configuredCode ||
        configuredCode === DEFAULT_ADMIN_CODE
      ) {
        return res.status(403).json({
          error: 'Admin registration is not enabled.'
        });
      }

      if (adminCode !== configuredCode) {
        return res.status(403).json({
          error: 'The admin invitation code is incorrect.'
        });
      }
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await User.create({
      email,
      passwordHash,
      role: requestedRole
    });

    return res.status(201).json({
      message: 'Account created. Please sign in.',
      user: publicUser(user)
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({
        error: 'An account with this email already exists.'
      });
    }

    return next(error);
  }
});

app.post('/api/auth/signin', authLimiter, async (req, res, next) => {
  try {
    const body = req.body ?? {};

    const email =
      typeof body.email === 'string'
        ? body.email.trim().toLowerCase()
        : '';

    const password = body.password;

    if (!validEmail(email) || typeof password !== 'string') {
      return res.status(400).json({
        error: 'Enter your email and password.'
      });
    }

    const user = await User.findOne({ email })
      .select('+passwordHash');

    if (
      !user ||
      !(await bcrypt.compare(password, user.passwordHash))
    ) {
      return res.status(401).json({
        error: 'Incorrect email or password.'
      });
    }

    res.cookie('session', createToken(user), cookieOptions);

    return res.json({
      message: 'Signed in successfully.',
      user: publicUser(user)
    });
  } catch (error) {
    return next(error);
  }
});

app.get('/api/auth/me', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.sub);

    if (!user) {
      return res.status(401).json({
        error: 'Account not found.'
      });
    }

    return res.json({ user: publicUser(user) });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/auth/signout', (_req, res) => {
  res.clearCookie('session', {
    httpOnly: cookieOptions.httpOnly,
    secure: cookieOptions.secure,
    sameSite: cookieOptions.sameSite,
    path: cookieOptions.path
  });

  return res.json({ message: 'Signed out.' });
});

// =====================================================
// PRODUCT ROUTES
// =====================================================

// Signed-in users see active products.
// Admins can see inactive products as well.
app.get('/api/products', requireAuth, async (req, res, next) => {
  try {
    const filter = req.user.role === 'admin'
      ? {}
      : { isActive: true };

    const products = await Product.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      products: products.map(publicProduct)
    });
  } catch (error) {
    return next(error);
  }
});

app.get('/api/products/:id', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        error: 'Invalid product ID.'
      });
    }

    const filter = req.user.role === 'admin'
      ? { _id: id }
      : { _id: id, isActive: true };

    const product = await Product.findOne(filter).lean();

    if (!product) {
      return res.status(404).json({
        error: 'Product not found.'
      });
    }

    return res.json({
      product: publicProduct(product)
    });
  } catch (error) {
    return next(error);
  }
});

// Admin creates products.
app.post(
  '/api/products',
  requireAuth,
  requireAdmin,
  async (req, res, next) => {
    try {
      const parsed = parseProductPayload(req.body);

      if (parsed.error) {
        return res.status(400).json({ error: parsed.error });
      }

      const product = await Product.create({
        ...parsed.data,
        isActive: true,
        createdBy: req.user.sub
      });

      return res.status(201).json({
        message: 'Product created.',
        product: publicProduct(product)
      });
    } catch (error) {
      if (error?.code === 11000) {
        return res.status(409).json({
          error: 'A product with this SKU already exists.'
        });
      }

      if (error?.name === 'ValidationError') {
        return res.status(400).json({
          error: 'Please check the product details.'
        });
      }

      return next(error);
    }
  }
);

// Admin updates product details or stock.
app.put(
  '/api/products/:id',
  requireAuth,
  requireAdmin,
  async (req, res, next) => {
    try {
      const { id } = req.params;

      if (!isValidId(id)) {
        return res.status(400).json({
          error: 'Invalid product ID.'
        });
      }

      const parsed = parseProductPayload(
        req.body,
        { partial: true }
      );

      if (parsed.error) {
        return res.status(400).json({ error: parsed.error });
      }

      const product = await Product.findByIdAndUpdate(
        id,
        { $set: parsed.data },
        { new: true, runValidators: true }
      );

      if (!product) {
        return res.status(404).json({
          error: 'Product not found.'
        });
      }

      return res.json({
        message: 'Product updated.',
        product: publicProduct(product)
      });
    } catch (error) {
      if (error?.code === 11000) {
        return res.status(409).json({
          error: 'A product with this SKU already exists.'
        });
      }

      if (
        error?.name === 'ValidationError' ||
        error?.name === 'CastError'
      ) {
        return res.status(400).json({
          error: 'Invalid product details.'
        });
      }

      return next(error);
    }
  }
);

// Admin deactivates products instead of hard deleting them.
app.delete(
  '/api/products/:id',
  requireAuth,
  requireAdmin,
  async (req, res, next) => {
    try {
      const { id } = req.params;

      if (!isValidId(id)) {
        return res.status(400).json({
          error: 'Invalid product ID.'
        });
      }

      const product = await Product.findByIdAndUpdate(
        id,
        { $set: { isActive: false } },
        { new: true, runValidators: true }
      );

      if (!product) {
        return res.status(404).json({
          error: 'Product not found.'
        });
      }

      return res.json({
        message: 'Product deactivated.',
        product: publicProduct(product)
      });
    } catch (error) {
      return next(error);
    }
  }
);

// =====================================================
// ORDER ROUTES
// =====================================================

// Customer places an order for one product.
// Stock reservation and order insertion are atomic.
// =====================================================
// ORDER REQUEST VALIDATION
// =====================================================
const createOrderSchema = z.object({
  productId: z.string().refine(
    (id) => mongoose.isValidObjectId(id),
    { message: 'A valid productId is required.' }
  ),
  quantity: z.coerce.number()
    .int('Quantity must be a whole number.')
    .min(1, 'Quantity must be at least 1.')
    .max(10000, 'Quantity cannot exceed 10000.')
}).strict();


app.post('/api/orders', requireAuth, async (req, res, next) => {
  if (req.user.role !== 'user') {
    return res.status(403).json({
      error: 'Only customer accounts can place orders.'
    });
  }

  // Validate the request body using Zod.
  const parsed = createOrderSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid order details.',
      details: parsed.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message
      }))
    });
  }

  // Only validated productId and quantity are accepted.
  const { productId, quantity } = parsed.data;

  const session = await mongoose.startSession();
  let createdOrder = null;
  let unavailableProduct = null;

  try {
    await session.withTransaction(async () => {
      // Transaction callbacks may be retried.
      createdOrder = null;
      unavailableProduct = null;

      // Conditionally reserve stock to prevent overselling.
      const product = await Product.findOneAndUpdate(
        {
          _id: productId,
          isActive: true,
          stock: { $gte: quantity }
        },
        { $inc: { stock: -quantity } },
        { new: true, session }
      );

      if (!product) {
        unavailableProduct = await Product.findById(productId)
          .session(session)
          .lean();

        return;
      }

      // Always calculate the order price using database data.
      const unitPrice = product.price;
      const totalAmount = Number(
        (unitPrice * quantity).toFixed(2)
      );

      const orders = await Order.create(
        [{
          userId: req.user.sub,
          productId: product._id,
          productName: product.name,
          sku: product.sku,
          quantity,
          unitPrice,
          totalAmount,
          status: 'placed',
          stockRestored: false
        }],
        { session }
      );

      createdOrder = orders[0];
    });

    if (!createdOrder) {
      if (!unavailableProduct || !unavailableProduct.isActive) {
        return res.status(404).json({
          error: 'This product is unavailable.'
        });
      }

      return res.status(409).json({
        error: 'Insufficient stock.',
        availableStock: unavailableProduct.stock,
        message: unavailableProduct.stock === 0
          ? 'This product is currently out of stock.'
          : `Only ${unavailableProduct.stock} units are available.`
      });
    }

    return res.status(201).json({
      message: 'Order placed successfully.',
      order: publicOrder(createdOrder)
    });
  } catch (error) {
    return next(error);
  } finally {
    await session.endSession();
  }
});


// Customers see only their own orders.
// Admins see orders from all customers.
app.get('/api/orders', requireAuth, async (req, res, next) => {
  try {
    const filter = req.user.role === 'admin'
      ? {}
      : { userId: req.user.sub };

    const orders = await Order.find(filter)
      .populate('userId', 'email')
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      orders: orders.map(publicOrder)
    });
  } catch (error) {
    return next(error);
  }
});

// Fetch one order, restricted to its owner unless the requester is admin.
app.get('/api/orders/:id', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        error: 'Invalid order ID.'
      });
    }

    const filter = req.user.role === 'admin'
      ? { _id: id }
      : { _id: id, userId: req.user.sub };

    const order = await Order.findOne(filter)
      .populate('userId', 'email')
      .lean();

    if (!order) {
      return res.status(404).json({
        error: 'Order not found.'
      });
    }

    return res.json({ order: publicOrder(order) });
  } catch (error) {
    return next(error);
  }
});

const allowedOrderTransitions = {
  placed: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: ['completed'],
  completed: [],
  cancelled: []
};

// Admin updates order status.
app.patch(
  '/api/orders/:id/status',
  requireAuth,
  requireAdmin,
  async (req, res, next) => {
    const { id } = req.params;
    const nextStatus = req.body?.status;

    if (!isValidId(id)) {
      return res.status(400).json({
        error: 'Invalid order ID.'
      });
    }

    if (
      typeof nextStatus !== 'string' ||
      !Object.prototype.hasOwnProperty.call(
        allowedOrderTransitions,
        nextStatus
      )
    ) {
      return res.status(400).json({
        error: 'Invalid order status.'
      });
    }

    const session = await mongoose.startSession();
    let updatedOrder = null;
    let failure = null;

    try {
      await session.withTransaction(async () => {
        updatedOrder = null;
        failure = null;

        const order = await Order.findById(id).session(session);

        if (!order) {
          failure = 'not-found';
          return;
        }

        if (
          !allowedOrderTransitions[order.status].includes(nextStatus)
        ) {
          failure = 'invalid-transition';
          return;
        }

        // Restore stock exactly once when an order is cancelled.
        if (
          nextStatus === 'cancelled' &&
          !order.stockRestored
        ) {
          const result = await Product.updateOne(
            { _id: order.productId },
            { $inc: { stock: order.quantity } },
            { session }
          );

          if (result.matchedCount !== 1) {
            throw new Error(
              'Could not restore stock for cancelled order.'
            );
          }

          order.stockRestored = true;
        }

        order.status = nextStatus;

        if (nextStatus === 'completed' && !order.completedAt) {
          order.completedAt = new Date();
        }

        await order.save({ session });
        updatedOrder = order;
      });

      if (failure === 'not-found') {
        return res.status(404).json({
          error: 'Order not found.'
        });
      }

      if (failure === 'invalid-transition') {
        return res.status(409).json({
          error: 'That order status transition is not permitted.'
        });
      }

      return res.json({
        message: `Order status changed to ${nextStatus}.`,
        order: publicOrder(updatedOrder)
      });
    } catch (error) {
      return next(error);
    } finally {
      await session.endSession();
    }
  }
);

// Customer confirms receipt after the admin marks an order delivered.
// Receipt confirmation also marks the order completed.
app.post(
  '/api/orders/:id/received',
  requireAuth,
  async (req, res, next) => {
    if (req.user.role !== 'user') {
      return res.status(403).json({
        error: 'Only customers can confirm receipt.'
      });
    }

    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        error: 'Invalid order ID.'
      });
    }

    const session = await mongoose.startSession();
    let updatedOrder = null;
    let failure = null;
    let alreadyReceived = false;

    try {
      await session.withTransaction(async () => {
        updatedOrder = null;
        failure = null;
        alreadyReceived = false;

        const order = await Order.findOne({
          _id: id,
          userId: req.user.sub
        }).session(session);

        if (!order) {
          failure = 'not-found';
          return;
        }

        if (!['delivered', 'completed'].includes(order.status)) {
          failure = 'not-delivered';
          return;
        }

        if (order.receivedAt) {
          alreadyReceived = true;
          updatedOrder = order;
          return;
        }

        const now = new Date();

        order.receivedAt = now;

        if (order.status === 'delivered') {
          order.status = 'completed';
        }

        if (!order.completedAt) {
          order.completedAt = now;
        }

        await order.save({ session });
        updatedOrder = order;
      });

      if (failure === 'not-found') {
        return res.status(404).json({
          error: 'Order not found.'
        });
      }

      if (failure === 'not-delivered') {
        return res.status(409).json({
          error: 'You can confirm receipt only after delivery.'
        });
      }

      return res.json({
        message: alreadyReceived
          ? 'Receipt was already confirmed.'
          : 'Receipt confirmed. Thank you!',
        order: publicOrder(updatedOrder)
      });
    } catch (error) {
      return next(error);
    } finally {
      await session.endSession();
    }
  }
);

// =====================================================
// EXISTING GENERIC ITEM ROUTES
// =====================================================

app.get('/api/items', requireAuth, async (req, res, next) => {
  try {
    const items = await Item.find(itemFilterFor(req.user))
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      items: items.map(publicItem),
      workspace:
        req.user.role === 'admin'
          ? 'shared-admin'
          : 'personal'
    });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/items', requireAuth, async (req, res, next) => {
  try {
    const body = req.body ?? {};

    const title =
      typeof body.title === 'string'
        ? body.title.trim()
        : '';

    const details =
      typeof body.details === 'string'
        ? body.details.trim()
        : '';

    if (!title || title.length > 120) {
      return res.status(400).json({
        error: 'Title is required and must be at most 120 characters.'
      });
    }

    if (details.length > 500) {
      return res.status(400).json({
        error: 'Details must be at most 500 characters.'
      });
    }

    const scope = req.user.role === 'admin'
      ? 'admin'
      : 'personal';

    const itemData = { scope, title, details };

    if (scope === 'personal') {
      itemData.userId = req.user.sub;
    }

    const item = await Item.create(itemData);

    return res.status(201).json({
      item: publicItem(item)
    });
  } catch (error) {
    return next(error);
  }
});

app.put('/api/items/:id', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const body = req.body ?? {};

    if (!isValidId(id)) {
      return res.status(400).json({
        error: 'Invalid item ID.'
      });
    }

    const title =
      typeof body.title === 'string'
        ? body.title.trim()
        : '';

    const details =
      typeof body.details === 'string'
        ? body.details.trim()
        : '';

    if (!title || title.length > 120) {
      return res.status(400).json({
        error: 'Title is required and must be at most 120 characters.'
      });
    }

    if (details.length > 500) {
      return res.status(400).json({
        error: 'Details must be at most 500 characters.'
      });
    }

    const item = await Item.findOneAndUpdate(
      itemFilterByIdFor(req.user, id),
      { $set: { title, details } },
      { new: true, runValidators: true }
    );

    if (!item) {
      return res.status(404).json({
        error: 'Item not found in your workspace.'
      });
    }

    return res.json({ item: publicItem(item) });
  } catch (error) {
    return next(error);
  }
});

app.delete('/api/items/:id', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        error: 'Invalid item ID.'
      });
    }

    const item = await Item.findOneAndDelete(
      itemFilterByIdFor(req.user, id)
    );

    if (!item) {
      return res.status(404).json({
        error: 'Item not found in your workspace.'
      });
    }

    return res.json({ message: 'Item deleted.' });
  } catch (error) {
    return next(error);
  }
});

// =====================================================
// ERROR HANDLING
// =====================================================


app.use((err, _req, res, next) => {
  // If the response has already started, let Express handle it.
  if (res.headersSent) {
    return next(err);
  }

  console.error(err);

  // Invalid JSON sent by the client.
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: 'Invalid JSON in request body.'
    });
  }

  // Request body exceeds the configured size limit.
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({
      error: 'Request body is too large.'
    });
  }

  // Duplicate values, such as an existing SKU or email.
  if (err?.code === 11000) {
    return res.status(409).json({
      error: 'A record with those unique details already exists.'
    });
  }

  // Mongoose schema validation failures.
  if (err?.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Please check the submitted details.'
    });
  }

  // Invalid MongoDB IDs or incompatible database values.
  if (
    err?.name === 'CastError' ||
    err?.name === 'StrictModeError'
  ) {
    return res.status(400).json({
      error: 'Invalid data was submitted.'
    });
  }

  // Unexpected server errors.
  return res.status(500).json({
    error: 'Something went wrong. Please try again later.'
  });
});


// =====================================================
// DATABASE CONNECTION AND SERVER STARTUP
// =====================================================

connectDatabase()
  .then(() => {
    app.listen(port, () => {
      console.log(
        `StashSpark API listening on http://localhost:${port}`
      );
    });
  })
  .catch((error) => {
    console.error(
      'MongoDB connection failed:',
      error.message
    );

    console.error(
      'Check MONGODB_URI, the database credentials and the Atlas Network Access allowlist.'
    );

    process.exit(1);
  });

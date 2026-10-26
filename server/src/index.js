import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { connectDatabase, mongoose } from './db.js';
import { User } from './models/User.js';
import { Item } from './models/Item.js';

const app = express();
const port = Number(process.env.PORT || 5000);
const isProduction = process.env.NODE_ENV === 'production';
if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'replace_this_with_a_long_random_secret') {
  if (isProduction) throw new Error('Set a strong, private JWT_SECRET in production.');
  console.warn('WARNING: Set a private random JWT_SECRET in server/.env before using this outside local development.');
}

app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '20kb' }));
app.use(cookieParser());

const cookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? 'none' : 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/'
};

function createToken(user) {
  return jwt.sign({ sub: user._id.toString(), email: user.email }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

function requireAuth(req, res, next) {
  const token = req.cookies?.session;
  if (!token) return res.status(401).json({ error: 'Please sign in to continue.' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.clearCookie('session', cookieOptions);
    return res.status(401).json({ error: 'Your session expired. Please sign in again.' });
  }
}

const validEmail = (email) => typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
const isValidId = (id) => mongoose.isValidObjectId(id);

function publicUser(user) {
  return {
    id: user._id.toString(),
    email: user.email,
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

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' });
});

app.post('/api/auth/signup', async (req, res, next) => {
  try {
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = req.body.password;
    if (!validEmail(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
    if (typeof password !== 'string' || password.length < 8 || password.length > 72) {
      return res.status(400).json({ error: 'Password must be 8–72 characters long.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ email, passwordHash });
    res.status(201).json({ message: 'Account created. You can now sign in.', user: publicUser(user) });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ error: 'An account with this email already exists.' });
    next(error);
  }
});

app.post('/api/auth/signin', async (req, res, next) => {
  try {
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = req.body.password;
    if (!validEmail(email) || typeof password !== 'string') {
      return res.status(400).json({ error: 'Enter your email and password.' });
    }

    const user = await User.findOne({ email }).select('+passwordHash');
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: 'Incorrect email or password.' });
    }

    res.cookie('session', createToken(user), cookieOptions);
    res.json({ message: 'Signed in successfully.', user: publicUser(user) });
  } catch (error) { next(error); }
});

app.get('/api/auth/me', requireAuth, async (req, res, next) => {
  try {
    if (!isValidId(req.user.sub)) return res.status(401).json({ error: 'Account not found.' });
    const user = await User.findById(req.user.sub);
    if (!user) return res.status(401).json({ error: 'Account not found.' });
    res.json({ user: publicUser(user) });
  } catch (error) { next(error); }
});

app.post('/api/auth/signout', (_req, res) => {
  res.clearCookie('session', { ...cookieOptions, maxAge: undefined });
  res.json({ message: 'Signed out.' });
});

app.get('/api/items', requireAuth, async (req, res, next) => {
  try {
    const items = await Item.find({ userId: req.user.sub }).sort({ createdAt: -1 }).lean();
    res.json({ items: items.map(publicItem) });
  } catch (error) { next(error); }
});

app.post('/api/items', requireAuth, async (req, res, next) => {
  try {
    const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
    const details = typeof req.body.details === 'string' ? req.body.details.trim() : '';
    if (!title || title.length > 120) return res.status(400).json({ error: 'Title is required and must be at most 120 characters.' });
    if (details.length > 500) return res.status(400).json({ error: 'Details must be at most 500 characters.' });

    const item = await Item.create({ userId: req.user.sub, title, details });
    res.status(201).json({ item: publicItem(item) });
  } catch (error) { next(error); }
});

app.put('/api/items/:id', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
    const details = typeof req.body.details === 'string' ? req.body.details.trim() : '';
    if (!isValidId(id)) return res.status(400).json({ error: 'Invalid item ID.' });
    if (!title || title.length > 120) return res.status(400).json({ error: 'Title is required and must be at most 120 characters.' });
    if (details.length > 500) return res.status(400).json({ error: 'Details must be at most 500 characters.' });

    const item = await Item.findOneAndUpdate(
      { _id: id, userId: req.user.sub },
      { $set: { title, details } },
      { new: true, runValidators: true }
    );
    if (!item) return res.status(404).json({ error: 'Item not found.' });
    res.json({ item: publicItem(item) });
  } catch (error) { next(error); }
});

app.delete('/api/items/:id', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).json({ error: 'Invalid item ID.' });
    const item = await Item.findOneAndDelete({ _id: id, userId: req.user.sub });
    if (!item) return res.status(404).json({ error: 'Item not found.' });
    res.json({ message: 'Item deleted.' });
  } catch (error) { next(error); }
});

app.use((err, _req, res, _next) => {
  if (err?.name === 'ValidationError') return res.status(400).json({ error: 'Please check the submitted details.' });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong. Check the server logs.' });
});

connectDatabase()
  .then(() => app.listen(port, () => console.log(`API listening on http://localhost:${port}`)))
  .catch((error) => {
    console.error('MongoDB connection failed:', error.message);
    console.error('Check MONGODB_URI, your Atlas database username/password, and the Atlas Network Access allowlist.');
    process.exit(1);
  });

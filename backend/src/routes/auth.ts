import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query, checkDatabase } from '../lib/db';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-super-secret-key-change-me';

// ── POST /api/auth/signup ───────────────────────────────────────────────────
router.post('/signup', async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'E-mail e senha são obrigatórios' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'A senha deve conter no mínimo 6 caracteres' });
  }

  try {
    // Check if user already exists
    const checkUser = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (checkUser.rows.length > 0) {
      return res.status(400).json({ error: 'Este e-mail já está cadastrado' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Insert user (trigger will automatically create profile)
    const newUser = await query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
      [email, passwordHash]
    );

    const user = newUser.rows[0];

    // Generate JWT
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

    return res.status(201).json({ token, user });
  } catch (err: unknown) {
    console.error('Signup error:', err);
    const pgCode = (err as { code?: string })?.code;
    if (pgCode === '42P01') {
      return res.status(503).json({
        error: 'Tabelas não encontradas. Execute database/schema.sql no Postgres.',
      });
    }
    if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) {
      return res.status(503).json({
        error: 'Banco não configurado. Defina DATABASE_URL na API.',
      });
    }
    return res.status(500).json({ error: 'Falha ao registrar usuário' });
  }
});

// ── POST /api/auth/login ────────────────────────────────────────────────────
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'E-mail e senha são obrigatórios' });
  }

  try {
    // Look up user
    const findUser = await query('SELECT id, email, password_hash FROM users WHERE email = $1', [email]);
    if (findUser.rows.length === 0) {
      return res.status(400).json({ error: 'E-mail ou senha incorretos' });
    }

    const user = findUser.rows[0];

    // Check password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ error: 'E-mail ou senha incorretos' });
    }

    // Generate JWT
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

    return res.json({
      token,
      user: { id: user.id, email: user.email },
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Falha ao autenticar' });
  }
});

// ── GET /api/auth/me ────────────────────────────────────────────────────────
router.get('/me', requireAuth as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userResult = await query(
      `SELECT u.id, u.email, p.slug 
       FROM users u 
       LEFT JOIN profiles p ON p.user_id = u.id 
       WHERE u.id = $1`,
      [req.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    return res.json(userResult.rows[0]);
  } catch (err) {
    console.error('Auth /me error:', err);
    return res.status(500).json({ error: 'Erro no servidor' });
  }
});

export default router;

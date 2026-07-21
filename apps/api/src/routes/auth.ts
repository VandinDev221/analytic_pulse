import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { query } from '../infrastructure/db';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { env } from '../config/env';
import { sendVerificationCode } from '../services/emailService';
import { verifyGoogleToken, isGoogleAuthConfigured } from '../services/googleAuthService';

const router = Router();
const CODE_TTL_MINUTES = 15;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function issueToken(userId: string): string {
  return jwt.sign({ userId }, env.jwtSecret, { expiresIn: '7d' });
}

function generateCode(): string {
  return String(crypto.randomInt(100000, 999999));
}

function pgErrorResponse(res: Response, err: unknown, fallback: string) {
  console.error(fallback, err);
  const pgCode = (err as { code?: string })?.code;
  if (pgCode === '42P01') {
    return res.status(503).json({
      error: 'Tabelas não encontradas. Execute database/schema.sql e migration_auth_oauth.sql.',
    });
  }
  if (!env.databaseUrl) {
    return res.status(503).json({ error: 'Banco não configurado. Defina DATABASE_URL na API.' });
  }
  return res.status(500).json({ error: fallback });
}

// ── POST /api/auth/signup/send-code ─────────────────────────────────────────
router.post('/signup/send-code', async (req: Request, res: Response) => {
  const email = normalizeEmail(req.body.email ?? '');
  const password = req.body.password ?? '';

  if (!email || !password) {
    return res.status(400).json({ error: 'E-mail e senha são obrigatórios' });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'E-mail inválido' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'A senha deve conter no mínimo 6 caracteres' });
  }

  try {
    const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Este e-mail já está cadastrado' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const code = generateCode();
    const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000);

    await query('DELETE FROM email_verification_codes WHERE email = $1', [email]);
    await query(
      `INSERT INTO email_verification_codes (email, password_hash, code, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [email, passwordHash, code, expiresAt.toISOString()]
    );

    await sendVerificationCode(email, code);

    const payload: Record<string, string> = {
      message: 'Código enviado para o seu e-mail',
    };
    if (process.env.NODE_ENV !== 'production' && !process.env.RESEND_API_KEY) {
      payload.devCode = code;
    }

    return res.json(payload);
  } catch (err) {
    return pgErrorResponse(res, err, 'Falha ao enviar código');
  }
});

// ── POST /api/auth/signup/verify ──────────────────────────────────────────────
router.post('/signup/verify', async (req: Request, res: Response) => {
  const email = normalizeEmail(req.body.email ?? '');
  const code = String(req.body.code ?? '').trim();

  if (!email || !code) {
    return res.status(400).json({ error: 'E-mail e código são obrigatórios' });
  }
  if (!/^\d{6}$/.test(code)) {
    return res.status(400).json({ error: 'Código inválido' });
  }

  try {
    const pending = await query(
      `SELECT password_hash FROM email_verification_codes
       WHERE email = $1 AND code = $2 AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [email, code]
    );

    if (pending.rows.length === 0) {
      return res.status(400).json({ error: 'Código inválido ou expirado' });
    }

    const { password_hash: passwordHash } = pending.rows[0];

    const newUser = await query(
      `INSERT INTO users (email, password_hash, email_verified)
       VALUES ($1, $2, TRUE) RETURNING id, email`,
      [email, passwordHash]
    );

    await query('DELETE FROM email_verification_codes WHERE email = $1', [email]);

    const user = newUser.rows[0];
    const token = issueToken(user.id);

    return res.status(201).json({ token, user });
  } catch (err) {
    return pgErrorResponse(res, err, 'Falha ao criar conta');
  }
});

// ── POST /api/auth/signup (legado — redireciona para fluxo com código) ─────────
router.post('/signup', (_req: Request, res: Response) => {
  return res.status(400).json({
    error: 'Cadastro requer verificação por e-mail. Use /auth/signup/send-code e /auth/signup/verify.',
  });
});

// ── POST /api/auth/google ─────────────────────────────────────────────────────
router.post('/google', async (req: Request, res: Response) => {
  const credential = req.body.credential as string | undefined;

  if (!credential) {
    return res.status(400).json({ error: 'Token Google ausente' });
  }
  if (!isGoogleAuthConfigured()) {
    return res.status(503).json({ error: 'Login com Google não configurado' });
  }

  try {
    const profile = await verifyGoogleToken(credential);

    const byGoogle = await query(
      'SELECT id, email FROM users WHERE google_id = $1',
      [profile.googleId]
    );
    if (byGoogle.rows.length > 0) {
      const user = byGoogle.rows[0];
      const token = issueToken(user.id);
      return res.json({ token, user: { id: user.id, email: user.email } });
    }

    const byEmail = await query(
      'SELECT id, email, google_id FROM users WHERE email = $1',
      [profile.email]
    );

    if (byEmail.rows.length > 0) {
      const existing = byEmail.rows[0];
      if (existing.google_id) {
        const token = issueToken(existing.id);
        return res.json({ token, user: { id: existing.id, email: existing.email } });
      }

      await query(
        `UPDATE users SET google_id = $1, email_verified = TRUE WHERE id = $2`,
        [profile.googleId, existing.id]
      );
      const token = issueToken(existing.id);
      return res.json({ token, user: { id: existing.id, email: existing.email } });
    }

    const created = await query(
      `INSERT INTO users (email, google_id, email_verified)
       VALUES ($1, $2, TRUE) RETURNING id, email`,
      [profile.email, profile.googleId]
    );
    const user = created.rows[0];
    const token = issueToken(user.id);
    return res.status(201).json({ token, user: { id: user.id, email: user.email } });
  } catch (err) {
    console.error('Google auth error:', err);
    return res.status(401).json({ error: 'Falha ao autenticar com Google' });
  }
});

// ── GET /api/auth/config ──────────────────────────────────────────────────────
router.get('/config', (_req: Request, res: Response) => {
  res.json({
    googleEnabled: isGoogleAuthConfigured(),
    emailVerificationEnabled: true,
  });
});

// ── POST /api/auth/login ────────────────────────────────────────────────────
router.post('/login', async (req: Request, res: Response) => {
  const email = normalizeEmail(req.body.email ?? '');
  const password = req.body.password ?? '';

  if (!email || !password) {
    return res.status(400).json({ error: 'E-mail e senha são obrigatórios' });
  }

  try {
    const findUser = await query(
      'SELECT id, email, password_hash, email_verified FROM users WHERE email = $1',
      [email]
    );
    if (findUser.rows.length === 0) {
      return res.status(400).json({ error: 'E-mail ou senha incorretos' });
    }

    const user = findUser.rows[0];

    if (!user.password_hash) {
      return res.status(400).json({ error: 'Esta conta usa login com Google' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ error: 'E-mail ou senha incorretos' });
    }

    if (!user.email_verified) {
      return res.status(403).json({ error: 'E-mail não verificado. Crie a conta novamente para receber um código.' });
    }

    const token = issueToken(user.id);

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

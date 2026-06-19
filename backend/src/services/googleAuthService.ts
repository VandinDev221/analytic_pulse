import { OAuth2Client } from 'google-auth-library';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

let client: OAuth2Client | null = null;

function getClient(): OAuth2Client {
  if (!GOOGLE_CLIENT_ID) {
    throw new Error('Login com Google não configurado');
  }
  if (!client) {
    client = new OAuth2Client(GOOGLE_CLIENT_ID);
  }
  return client;
}

export interface GoogleProfile {
  googleId: string;
  email: string;
  emailVerified: boolean;
  name?: string;
}

export async function verifyGoogleToken(credential: string): Promise<GoogleProfile> {
  const ticket = await getClient().verifyIdToken({
    idToken: credential,
    audience: GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();
  if (!payload?.sub || !payload.email) {
    throw new Error('Token Google inválido');
  }

  return {
    googleId: payload.sub,
    email: payload.email.toLowerCase(),
    emailVerified: payload.email_verified ?? false,
    name: payload.name,
  };
}

export function isGoogleAuthConfigured(): boolean {
  return !!GOOGLE_CLIENT_ID;
}

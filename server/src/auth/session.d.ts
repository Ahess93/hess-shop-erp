import type { SessionUser } from './auth.service';

declare module 'express-session' {
  interface SessionData {
    user: SessionUser;
    /** Temporary marker during 2FA login — cleared once 2FA is verified */
    pending2fa?: { userId: string; tenantId: string };
  }
}

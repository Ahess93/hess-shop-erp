import type { SessionUser } from './auth.service';

declare module 'express-session' {
  interface SessionData {
    user: SessionUser;
  }
}

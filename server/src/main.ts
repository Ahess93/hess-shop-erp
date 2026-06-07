import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import session from 'express-session';
import helmet from 'helmet';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  const sessionSecret = process.env['SESSION_SECRET'];
  if (!sessionSecret) {
    throw new Error('SESSION_SECRET environment variable is required');
  }

  // ── Proxy trust ──────────────────────────────────────────────────────────
  // When behind Cloudflare Tunnel, Tailscale, or nginx, trust the first
  // proxy so req.ip reflects the real client IP (for audit logs + rate limits).
  // Set TRUST_PROXY=1 in production when using a reverse proxy.
  const trustProxy = process.env['TRUST_PROXY'];
  if (trustProxy) {
    const httpAdapter = app.getHttpAdapter();

    (httpAdapter.getInstance() as { set: (k: string, v: unknown) => void }).set(
      'trust proxy',
      parseInt(trustProxy, 10) || 1,
    );
  }

  // ── Security headers (Helmet) ─────────────────────────────────────────────
  // Always on. Helmet sets X-Frame-Options, X-Content-Type-Options, HSTS, etc.
  // In production (especially WAN), also enforce a strict Content-Security-Policy.
  const isProduction = process.env['NODE_ENV'] === 'production';
  const isRemoteAccess = process.env['REMOTE_ACCESS'] === 'true';

  app.use(
    helmet({
      // HSTS: force HTTPS for 1 year when behind a TLS-terminating proxy
      strictTransportSecurity: isRemoteAccess
        ? { maxAge: 31_536_000, includeSubDomains: true }
        : false,
      // CSP: restrict resources to same origin; allow inline styles for Tailwind
      contentSecurityPolicy: isRemoteAccess
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'"], // Tailwind inlines styles
              imgSrc: ["'self'", 'data:', 'blob:'],
              fontSrc: ["'self'"],
              connectSrc: ["'self'"],
              frameSrc: ["'none'"],
              objectSrc: ["'none'"],
            },
          }
        : false, // Disable CSP on LAN — no need, simpler dev experience
      crossOriginEmbedderPolicy: false, // Required for PDF previews (blob URLs)
    }),
  );

  // ── Session middleware ─────────────────────────────────────────────────────
  app.use(
    session({
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        // Secure cookies when exposed to WAN (Cloudflare terminates TLS)
        secure: isProduction || isRemoteAccess,
        sameSite: isRemoteAccess ? 'strict' : 'lax',
        maxAge: 8 * 60 * 60 * 1000, // 8-hour idle timeout
      },
    }),
  );

  // ── CORS ──────────────────────────────────────────────────────────────────
  app.enableCors({
    origin: isProduction
      ? false // In production, web is served by the same server
      : 'http://localhost:5173',
    credentials: true,
  });

  const port = process.env['PORT'] ?? 3001;
  await app.listen(port);
}

bootstrap().catch(console.error);

/**
 * ServerManager — spawns and manages the NestJS backend process.
 *
 * In production the server is bundled alongside the Electron app.
 * In development we assume the server is already running (or launch it from
 * the project root).
 */
import { ChildProcess, spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as net from 'net';
import * as log from 'electron-log';

export const SERVER_PORT = 3001;

export class ServerManager {
  private process: ChildProcess | null = null;

  /** Start the NestJS server and wait until it's accepting connections. */
  async start(resourcesPath: string): Promise<void> {
    if (await this.isReady()) {
      log.info('Server already running — skipping start');
      return;
    }

    const isDev = process.env['NODE_ENV'] !== 'production';

    if (isDev) {
      log.info('Dev mode — server should be started separately via npm run dev:server');
      // In dev, wait for the external server to come up
      await this.waitForPort(SERVER_PORT, 60_000);
      return;
    }

    // Production: the server bundle is at resources/server/dist/main.js
    const serverScript = path.join(resourcesPath, 'server', 'dist', 'main.js');
    if (!fs.existsSync(serverScript)) {
      throw new Error(`Server bundle not found at: ${serverScript}`);
    }

    log.info(`Starting server: node ${serverScript}`);

    this.process = spawn(process.execPath, [serverScript], {
      env: {
        ...process.env,
        NODE_ENV: 'production',
        PORT: String(SERVER_PORT),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    this.process.stdout?.on('data', (data: Buffer) => {
      log.info(`[server] ${data.toString().trim()}`);
    });

    this.process.stderr?.on('data', (data: Buffer) => {
      log.warn(`[server:err] ${data.toString().trim()}`);
    });

    this.process.on('exit', (code) => {
      log.warn(`Server process exited with code ${String(code)}`);
      this.process = null;
    });

    await this.waitForPort(SERVER_PORT, 60_000);
    log.info('Server is ready');
  }

  /** Gracefully stop the server process. */
  stop(): void {
    if (this.process) {
      log.info('Stopping server process…');
      this.process.kill('SIGTERM');
      this.process = null;
    }
  }

  /** Check if the server is already listening on SERVER_PORT. */
  async isReady(): Promise<boolean> {
    return this.checkPort(SERVER_PORT);
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private checkPort(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(500);
      socket
        .once('connect', () => {
          socket.destroy();
          resolve(true);
        })
        .once('error', () => {
          socket.destroy();
          resolve(false);
        })
        .once('timeout', () => {
          socket.destroy();
          resolve(false);
        })
        .connect(port, '127.0.0.1');
    });
  }

  private async waitForPort(port: number, timeoutMs: number): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (await this.checkPort(port)) return;
      await sleep(500);
    }
    throw new Error(`Server did not become ready on port ${port} within ${timeoutMs}ms`);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

import { AuthService } from './auth.service';

/**
 * Unit tests for AuthService — no database required.
 * We test the password hashing and verification logic.
 */
describe('AuthService — password hashing', () => {
  // Minimal mocks — we only need to test hashPassword / verifyHash
  const mockPrisma = {} as never;
  const mockAudit = {} as never;
  const service = new AuthService(mockPrisma, mockAudit);

  describe('hashPassword()', () => {
    it('produces a hash that is not the plaintext password', async () => {
      const hash = await service.hashPassword('MySecret123!');
      expect(hash).not.toBe('MySecret123!');
    });

    it('produces an argon2 hash (starts with $argon2)', async () => {
      const hash = await service.hashPassword('MySecret123!');
      expect(hash).toMatch(/^\$argon2/);
    });

    it('produces different hashes for the same password (salted)', async () => {
      const hash1 = await service.hashPassword('SamePassword');
      const hash2 = await service.hashPassword('SamePassword');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('verifyHash()', () => {
    it('returns true for matching password', async () => {
      const hash = await service.hashPassword('CorrectPassword');
      const result = await service.verifyHash(hash, 'CorrectPassword');
      expect(result).toBe(true);
    });

    it('returns false for wrong password', async () => {
      const hash = await service.hashPassword('CorrectPassword');
      const result = await service.verifyHash(hash, 'WrongPassword');
      expect(result).toBe(false);
    });
  });

  describe('hashPin()', () => {
    it('produces an argon2 hash for a PIN', async () => {
      const hash = await service.hashPin('1234');
      expect(hash).toMatch(/^\$argon2/);
      expect(hash).not.toBe('1234');
    });
  });

  describe('argon2id algorithm', () => {
    it('uses argon2id variant (not argon2i or argon2d)', async () => {
      const hash = await service.hashPassword('test');
      // argon2id hashes contain 'argon2id' in their identifier
      expect(hash).toMatch(/\$argon2id\$/);
    });
  });
});

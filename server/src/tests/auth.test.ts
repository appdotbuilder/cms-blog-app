import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type LoginInput } from '../schema';
import { login, verifyToken, getCurrentUser, createUserWithHashedPassword } from '../handlers/auth';
import { eq } from 'drizzle-orm';

// Helper to decode JWT payload for testing
function decodeJwtPayload(token: string) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }
    return JSON.parse(atob(parts[1]));
  } catch {
    return null;
  }
}

// Test user data
const testUserData = {
  email: 'test@example.com',
  username: 'testuser',
  password: 'testpassword123',
  first_name: 'Test',
  last_name: 'User',
  role: 'author' as const,
  avatar_url: 'https://example.com/avatar.jpg',
  bio: 'Test user bio'
};

const testLoginInput: LoginInput = {
  email: 'test@example.com',
  password: 'testpassword123'
};

describe('Auth Handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('login', () => {
    it('should successfully login with valid credentials', async () => {
      // Create test user
      const createdUser = await createUserWithHashedPassword(testUserData);

      // Attempt login
      const result = await login(testLoginInput);

      // Verify response structure
      expect(result.user).toBeDefined();
      expect(result.token).toBeDefined();
      expect(typeof result.token).toBe('string');

      // Verify user data (excluding password_hash)
      expect(result.user.id).toBe(createdUser.id);
      expect(result.user.email).toBe(testUserData.email);
      expect(result.user.username).toBe(testUserData.username);
      expect(result.user.first_name).toBe(testUserData.first_name);
      expect(result.user.last_name).toBe(testUserData.last_name);
      expect(result.user.role).toBe(testUserData.role);
      expect(result.user.avatar_url).toBe(testUserData.avatar_url);
      expect(result.user.bio).toBe(testUserData.bio);
      expect(result.user.is_active).toBe(true);
      expect(result.user.created_at).toBeInstanceOf(Date);
      expect(result.user.updated_at).toBeInstanceOf(Date);

      // Verify password_hash is not included in response
      expect((result.user as any).password_hash).toBeUndefined();

      // Verify JWT token is valid
      const decoded = decodeJwtPayload(result.token);
      expect(decoded).not.toBeNull();
      expect(decoded.userId).toBe(createdUser.id);
      expect(decoded.email).toBe(testUserData.email);
      expect(decoded.role).toBe(testUserData.role);
      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBeDefined();
      expect(decoded.exp).toBeGreaterThan(decoded.iat);
    });

    it('should throw error for non-existent email', async () => {
      const invalidLoginInput: LoginInput = {
        email: 'nonexistent@example.com',
        password: 'anypassword'
      };

      await expect(login(invalidLoginInput)).rejects.toThrow(/invalid email or password/i);
    });

    it('should throw error for wrong password', async () => {
      // Create test user
      await createUserWithHashedPassword(testUserData);

      const wrongPasswordInput: LoginInput = {
        email: testUserData.email,
        password: 'wrongpassword'
      };

      await expect(login(wrongPasswordInput)).rejects.toThrow(/invalid email or password/i);
    });

    it('should throw error for deactivated user', async () => {
      // Create deactivated user
      const deactivatedUserData = {
        ...testUserData,
        is_active: false
      };
      await createUserWithHashedPassword(deactivatedUserData);

      await expect(login(testLoginInput)).rejects.toThrow(/account is deactivated/i);
    });

    it('should handle different user roles', async () => {
      const adminUserData = {
        ...testUserData,
        email: 'admin@example.com',
        username: 'adminuser',
        role: 'super_admin' as const
      };
      await createUserWithHashedPassword(adminUserData);

      const adminLoginInput: LoginInput = {
        email: 'admin@example.com',
        password: 'testpassword123'
      };

      const result = await login(adminLoginInput);
      expect(result.user.role).toBe('super_admin');

      const decoded = decodeJwtPayload(result.token);
      expect(decoded.role).toBe('super_admin');
    });
  });

  describe('verifyToken', () => {
    it('should return user for valid token', async () => {
      // Create test user and login to get token
      const createdUser = await createUserWithHashedPassword(testUserData);
      const loginResult = await login(testLoginInput);

      // Verify token
      const result = await verifyToken(loginResult.token);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(createdUser.id);
      expect(result!.email).toBe(testUserData.email);
      expect(result!.username).toBe(testUserData.username);
      expect(result!.is_active).toBe(true);

      // Verify password_hash is not included
      expect((result as any)?.password_hash).toBeUndefined();
    });

    it('should return null for invalid token', async () => {
      const result = await verifyToken('invalid.jwt.token');
      expect(result).toBeNull();
    });

    it('should return null for expired/malformed token', async () => {
      const malformedToken = 'malformed';
      const result = await verifyToken(malformedToken);
      expect(result).toBeNull();
    });

    it('should return null for deactivated user with valid token', async () => {
      // Create and login user
      const createdUser = await createUserWithHashedPassword(testUserData);
      const loginResult = await login(testLoginInput);

      // Deactivate user
      await db.update(usersTable)
        .set({ is_active: false })
        .where(eq(usersTable.id, createdUser.id))
        .execute();

      // Token should now be invalid
      const result = await verifyToken(loginResult.token);
      expect(result).toBeNull();
    });

    it('should return null for deleted user with valid token', async () => {
      // Create and login user
      const createdUser = await createUserWithHashedPassword(testUserData);
      const loginResult = await login(testLoginInput);

      // Delete user
      await db.delete(usersTable)
        .where(eq(usersTable.id, createdUser.id))
        .execute();

      // Token should now be invalid
      const result = await verifyToken(loginResult.token);
      expect(result).toBeNull();
    });

    it('should return null for token with wrong signature', async () => {
      // Create valid token first
      const createdUser = await createUserWithHashedPassword(testUserData);
      const loginResult = await login(testLoginInput);
      
      // Tamper with the token by changing the last character
      const tamperedToken = loginResult.token.slice(0, -1) + 'X';
      
      const result = await verifyToken(tamperedToken);
      expect(result).toBeNull();
    });
  });

  describe('getCurrentUser', () => {
    it('should return user by id', async () => {
      // Create test user
      const createdUser = await createUserWithHashedPassword(testUserData);

      // Get current user
      const result = await getCurrentUser(createdUser.id);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(createdUser.id);
      expect(result!.email).toBe(testUserData.email);
      expect(result!.username).toBe(testUserData.username);
      expect(result!.first_name).toBe(testUserData.first_name);
      expect(result!.last_name).toBe(testUserData.last_name);
      expect(result!.role).toBe(testUserData.role);
      expect(result!.is_active).toBe(true);

      // Verify password_hash is not included
      expect((result as any)?.password_hash).toBeUndefined();
    });

    it('should return null for non-existent user id', async () => {
      const result = await getCurrentUser(99999);
      expect(result).toBeNull();
    });

    it('should return deactivated user (getCurrentUser does not filter by is_active)', async () => {
      // Create deactivated user
      const deactivatedUserData = {
        ...testUserData,
        is_active: false
      };
      const createdUser = await createUserWithHashedPassword(deactivatedUserData);

      // Get current user - should still return the user even if deactivated
      const result = await getCurrentUser(createdUser.id);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(createdUser.id);
      expect(result!.is_active).toBe(false);
    });
  });

  describe('createUserWithHashedPassword helper', () => {
    it('should create user with all fields', async () => {
      const result = await createUserWithHashedPassword(testUserData);

      expect(result.email).toBe(testUserData.email);
      expect(result.username).toBe(testUserData.username);
      expect(result.first_name).toBe(testUserData.first_name);
      expect(result.last_name).toBe(testUserData.last_name);
      expect(result.role).toBe(testUserData.role);
      expect(result.avatar_url).toBe(testUserData.avatar_url);
      expect(result.bio).toBe(testUserData.bio);
      expect(result.is_active).toBe(true);
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.updated_at).toBeInstanceOf(Date);

      // Verify password_hash is not returned
      expect((result as any).password_hash).toBeUndefined();

      // Verify user exists in database with hashed password
      const dbUsers = await db.select()
        .from(usersTable)
        .where(eq(usersTable.id, result.id))
        .execute();

      expect(dbUsers).toHaveLength(1);
      expect(dbUsers[0].password_hash).toBeDefined();
      expect(dbUsers[0].password_hash).not.toBe(testUserData.password); // Should be hashed
    });

    it('should create user with minimal fields and defaults', async () => {
      const minimalUserData = {
        email: 'minimal@example.com',
        username: 'minimaluser',
        password: 'password123',
        first_name: 'Min',
        last_name: 'User'
      };

      const result = await createUserWithHashedPassword(minimalUserData);

      expect(result.email).toBe(minimalUserData.email);
      expect(result.username).toBe(minimalUserData.username);
      expect(result.first_name).toBe(minimalUserData.first_name);
      expect(result.last_name).toBe(minimalUserData.last_name);
      expect(result.role).toBe('author'); // Default role
      expect(result.avatar_url).toBeNull(); // Default null
      expect(result.bio).toBeNull(); // Default null
      expect(result.is_active).toBe(true); // Default true
    });

    it('should throw error for duplicate email', async () => {
      // Create first user
      await createUserWithHashedPassword(testUserData);

      // Try to create second user with same email
      const duplicateEmailData = {
        ...testUserData,
        username: 'differentusername'
      };

      await expect(createUserWithHashedPassword(duplicateEmailData)).rejects.toThrow();
    });

    it('should throw error for duplicate username', async () => {
      // Create first user
      await createUserWithHashedPassword(testUserData);

      // Try to create second user with same username
      const duplicateUsernameData = {
        ...testUserData,
        email: 'different@example.com'
      };

      await expect(createUserWithHashedPassword(duplicateUsernameData)).rejects.toThrow();
    });
  });

  describe('password hashing integration', () => {
    it('should verify that different passwords produce different hashes', async () => {
      const user1Data = {
        ...testUserData,
        email: 'user1@example.com',
        username: 'user1',
        password: 'password1'
      };

      const user2Data = {
        ...testUserData,
        email: 'user2@example.com',
        username: 'user2',
        password: 'password2'
      };

      await createUserWithHashedPassword(user1Data);
      await createUserWithHashedPassword(user2Data);

      // Get both users from database
      const users = await db.select()
        .from(usersTable)
        .execute();

      expect(users).toHaveLength(2);
      expect(users[0].password_hash).not.toBe(users[1].password_hash);
      expect(users[0].password_hash).not.toBe('password1');
      expect(users[1].password_hash).not.toBe('password2');
    });

    it('should verify login works with hashed passwords', async () => {
      // Create user
      await createUserWithHashedPassword(testUserData);

      // Login should work with plain password
      const result = await login(testLoginInput);
      expect(result.user.email).toBe(testUserData.email);
      expect(result.token).toBeDefined();

      // Wrong password should fail
      const wrongPasswordInput: LoginInput = {
        email: testUserData.email,
        password: 'wrongpassword'
      };
      await expect(login(wrongPasswordInput)).rejects.toThrow();
    });

    it('should verify that same password produces same hash consistently', async () => {
      const userData1 = {
        ...testUserData,
        email: 'user1@example.com',
        username: 'user1'
      };

      const userData2 = {
        ...testUserData,
        email: 'user2@example.com',
        username: 'user2'
        // Same password as testUserData
      };

      await createUserWithHashedPassword(userData1);
      await createUserWithHashedPassword(userData2);

      // Get both users from database
      const users = await db.select()
        .from(usersTable)
        .execute();

      expect(users).toHaveLength(2);
      // Same password should produce same hash
      expect(users[0].password_hash).toBe(users[1].password_hash);

      // Both should be able to login with the same password
      const login1 = await login({ email: 'user1@example.com', password: testUserData.password });
      const login2 = await login({ email: 'user2@example.com', password: testUserData.password });

      expect(login1.user.email).toBe('user1@example.com');
      expect(login2.user.email).toBe('user2@example.com');
      expect(login1.token).toBeDefined();
      expect(login2.token).toBeDefined();
    });
  });

  describe('JWT token functionality', () => {
    it('should create tokens with proper expiration', async () => {
      const createdUser = await createUserWithHashedPassword(testUserData);
      const loginResult = await login(testLoginInput);

      const decoded = decodeJwtPayload(loginResult.token);
      expect(decoded).not.toBeNull();
      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBeDefined();
      
      // Should expire 24 hours from now (within a reasonable margin)
      const expectedExpiration = decoded.iat + (24 * 60 * 60);
      expect(Math.abs(decoded.exp - expectedExpiration)).toBeLessThan(5); // Within 5 seconds
    });

    it('should include correct user information in token', async () => {
      const adminUserData = {
        ...testUserData,
        email: 'admin@example.com',
        username: 'adminuser',
        role: 'super_admin' as const
      };
      await createUserWithHashedPassword(adminUserData);

      const adminLogin = await login({
        email: 'admin@example.com',
        password: 'testpassword123'
      });

      const decoded = decodeJwtPayload(adminLogin.token);
      expect(decoded.userId).toBeDefined();
      expect(decoded.email).toBe('admin@example.com');
      expect(decoded.role).toBe('super_admin');
    });
  });
});
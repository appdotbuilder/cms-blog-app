import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type CreateUserInput, type UpdateUserInput, type PaginationInput } from '../schema';
import { createUser, updateUser, deleteUser, getUsers, getUserById } from '../handlers/users';
import { eq } from 'drizzle-orm';

// Test input data
const testUserInput: CreateUserInput = {
  email: 'test@example.com',
  username: 'testuser',
  password: 'password123',
  first_name: 'Test',
  last_name: 'User',
  role: 'author',
  avatar_url: 'https://example.com/avatar.jpg',
  bio: 'Test user bio'
};

const testSuperAdminInput: CreateUserInput = {
  email: 'admin@example.com',
  username: 'admin',
  password: 'adminpass123',
  first_name: 'Admin',
  last_name: 'User',
  role: 'super_admin',
  avatar_url: null,
  bio: null
};

describe('User Handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('createUser', () => {
    it('should create a user with all fields', async () => {
      const result = await createUser(testUserInput);

      expect(result.email).toEqual('test@example.com');
      expect(result.username).toEqual('testuser');
      expect(result.first_name).toEqual('Test');
      expect(result.last_name).toEqual('User');
      expect(result.role).toEqual('author');
      expect(result.avatar_url).toEqual('https://example.com/avatar.jpg');
      expect(result.bio).toEqual('Test user bio');
      expect(result.is_active).toEqual(true);
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.updated_at).toBeInstanceOf(Date);
      expect(result.password_hash).toBeDefined();
      expect(result.password_hash).not.toEqual('password123'); // Should be hashed
    });

    it('should create a super admin user', async () => {
      const result = await createUser(testSuperAdminInput);

      expect(result.role).toEqual('super_admin');
      expect(result.avatar_url).toBeNull();
      expect(result.bio).toBeNull();
      expect(result.is_active).toEqual(true);
    });

    it('should save user to database', async () => {
      const result = await createUser(testUserInput);

      const users = await db.select()
        .from(usersTable)
        .where(eq(usersTable.id, result.id))
        .execute();

      expect(users).toHaveLength(1);
      expect(users[0].email).toEqual('test@example.com');
      expect(users[0].username).toEqual('testuser');
      expect(users[0].is_active).toEqual(true);
    });

    it('should hash password', async () => {
      const result = await createUser(testUserInput);

      expect(result.password_hash).not.toEqual('password123');
      expect(result.password_hash.length).toBeGreaterThan(20); // Hashed passwords are longer
    });

    it('should enforce unique email constraint', async () => {
      await createUser(testUserInput);

      const duplicateInput = { ...testUserInput, username: 'different' };

      await expect(createUser(duplicateInput)).rejects.toThrow();
    });

    it('should enforce unique username constraint', async () => {
      await createUser(testUserInput);

      const duplicateInput = { ...testUserInput, email: 'different@example.com' };

      await expect(createUser(duplicateInput)).rejects.toThrow();
    });
  });

  describe('updateUser', () => {
    it('should update user fields', async () => {
      const user = await createUser(testUserInput);

      const updateInput: UpdateUserInput = {
        id: user.id,
        email: 'updated@example.com',
        first_name: 'Updated',
        bio: 'Updated bio'
      };

      const result = await updateUser(updateInput);

      expect(result.email).toEqual('updated@example.com');
      expect(result.first_name).toEqual('Updated');
      expect(result.bio).toEqual('Updated bio');
      expect(result.last_name).toEqual('User'); // Should remain unchanged
      expect(result.updated_at.getTime()).toBeGreaterThan(user.updated_at.getTime());
    });

    it('should update role', async () => {
      const user = await createUser(testUserInput);

      const updateInput: UpdateUserInput = {
        id: user.id,
        role: 'super_admin'
      };

      const result = await updateUser(updateInput);

      expect(result.role).toEqual('super_admin');
    });

    it('should update is_active status', async () => {
      const user = await createUser(testUserInput);

      const updateInput: UpdateUserInput = {
        id: user.id,
        is_active: false
      };

      const result = await updateUser(updateInput);

      expect(result.is_active).toEqual(false);
    });

    it('should handle null values for optional fields', async () => {
      const user = await createUser(testUserInput);

      const updateInput: UpdateUserInput = {
        id: user.id,
        avatar_url: null,
        bio: null
      };

      const result = await updateUser(updateInput);

      expect(result.avatar_url).toBeNull();
      expect(result.bio).toBeNull();
    });

    it('should throw error for non-existent user', async () => {
      const updateInput: UpdateUserInput = {
        id: 999,
        first_name: 'Updated'
      };

      await expect(updateUser(updateInput)).rejects.toThrow(/User not found/i);
    });

    it('should save changes to database', async () => {
      const user = await createUser(testUserInput);

      const updateInput: UpdateUserInput = {
        id: user.id,
        email: 'updated@example.com'
      };

      await updateUser(updateInput);

      const updatedUser = await db.select()
        .from(usersTable)
        .where(eq(usersTable.id, user.id))
        .execute();

      expect(updatedUser[0].email).toEqual('updated@example.com');
    });
  });

  describe('deleteUser', () => {
    it('should delete existing user', async () => {
      const user = await createUser(testUserInput);

      const result = await deleteUser(user.id);

      expect(result.success).toEqual(true);

      const deletedUser = await db.select()
        .from(usersTable)
        .where(eq(usersTable.id, user.id))
        .execute();

      expect(deletedUser).toHaveLength(0);
    });

    it('should throw error for non-existent user', async () => {
      await expect(deleteUser(999)).rejects.toThrow(/User not found/i);
    });
  });

  describe('getUsers', () => {
    beforeEach(async () => {
      // Create test users
      await createUser({ ...testUserInput, email: 'user1@example.com', username: 'user1' });
      await createUser({ ...testUserInput, email: 'user2@example.com', username: 'user2' });
      await createUser({ ...testUserInput, email: 'user3@example.com', username: 'user3' });
    });

    it('should return paginated users', async () => {
      const paginationInput: PaginationInput = {
        page: 1,
        limit: 2
      };

      const result = await getUsers(paginationInput);

      expect(result.items).toHaveLength(2);
      expect(result.total).toEqual(3);
      expect(result.page).toEqual(1);
      expect(result.limit).toEqual(2);
      expect(result.totalPages).toEqual(2);
    });

    it('should return second page of results', async () => {
      const paginationInput: PaginationInput = {
        page: 2,
        limit: 2
      };

      const result = await getUsers(paginationInput);

      expect(result.items).toHaveLength(1);
      expect(result.total).toEqual(3);
      expect(result.page).toEqual(2);
      expect(result.totalPages).toEqual(2);
    });

    it('should return all users when limit is high', async () => {
      const paginationInput: PaginationInput = {
        page: 1,
        limit: 10
      };

      const result = await getUsers(paginationInput);

      expect(result.items).toHaveLength(3);
      expect(result.total).toEqual(3);
      expect(result.totalPages).toEqual(1);
    });

    it('should return empty result when page exceeds total pages', async () => {
      const paginationInput: PaginationInput = {
        page: 10,
        limit: 2
      };

      const result = await getUsers(paginationInput);

      expect(result.items).toHaveLength(0);
      expect(result.total).toEqual(3);
      expect(result.page).toEqual(10);
    });

    it('should include password_hash in results', async () => {
      const paginationInput: PaginationInput = {
        page: 1,
        limit: 1
      };

      const result = await getUsers(paginationInput);

      expect(result.items[0].password_hash).toBeDefined();
    });
  });

  describe('getUserById', () => {
    it('should return user by id', async () => {
      const user = await createUser(testUserInput);

      const result = await getUserById(user.id);

      expect(result).not.toBeNull();
      expect(result!.id).toEqual(user.id);
      expect(result!.email).toEqual('test@example.com');
      expect(result!.username).toEqual('testuser');
      expect(result!.password_hash).toBeDefined();
    });

    it('should return null for non-existent user', async () => {
      const result = await getUserById(999);

      expect(result).toBeNull();
    });

    it('should include all user fields', async () => {
      const user = await createUser(testUserInput);

      const result = await getUserById(user.id);

      expect(result!.email).toEqual('test@example.com');
      expect(result!.username).toEqual('testuser');
      expect(result!.first_name).toEqual('Test');
      expect(result!.last_name).toEqual('User');
      expect(result!.role).toEqual('author');
      expect(result!.avatar_url).toEqual('https://example.com/avatar.jpg');
      expect(result!.bio).toEqual('Test user bio');
      expect(result!.is_active).toEqual(true);
      expect(result!.created_at).toBeInstanceOf(Date);
      expect(result!.updated_at).toBeInstanceOf(Date);
      expect(result!.password_hash).toBeDefined();
    });
  });
});
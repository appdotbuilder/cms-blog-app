import { db } from '../db';
import { usersTable } from '../db/schema';
import { type CreateUserInput, type UpdateUserInput, type User, type PaginationInput } from '../schema';
import { eq } from 'drizzle-orm';

// Simple password hashing function (in production, use bcrypt or similar)
const hashPassword = async (password: string): Promise<string> => {
  // Using Bun's built-in password hashing
  return await Bun.password.hash(password);
};

export const createUser = async (input: CreateUserInput): Promise<User> => {
  try {
    // Hash the password
    const passwordHash = await hashPassword(input.password);

    // Insert user record
    const result = await db.insert(usersTable)
      .values({
        email: input.email,
        username: input.username,
        password_hash: passwordHash,
        first_name: input.first_name,
        last_name: input.last_name,
        role: input.role,
        avatar_url: input.avatar_url || null,
        bio: input.bio || null,
        is_active: true
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('User creation failed:', error);
    throw error;
  }
};

export const updateUser = async (input: UpdateUserInput): Promise<User> => {
  try {
    // Build update object with only provided fields
    const updateFields: Partial<typeof usersTable.$inferInsert> = {};
    
    if (input.email !== undefined) updateFields.email = input.email;
    if (input.username !== undefined) updateFields.username = input.username;
    if (input.first_name !== undefined) updateFields.first_name = input.first_name;
    if (input.last_name !== undefined) updateFields.last_name = input.last_name;
    if (input.role !== undefined) updateFields.role = input.role;
    if (input.avatar_url !== undefined) updateFields.avatar_url = input.avatar_url;
    if (input.bio !== undefined) updateFields.bio = input.bio;
    if (input.is_active !== undefined) updateFields.is_active = input.is_active;
    
    // Always update the updated_at timestamp
    updateFields.updated_at = new Date();

    const result = await db.update(usersTable)
      .set(updateFields)
      .where(eq(usersTable.id, input.id))
      .returning()
      .execute();

    if (result.length === 0) {
      throw new Error('User not found');
    }

    return result[0];
  } catch (error) {
    console.error('User update failed:', error);
    throw error;
  }
};

export const deleteUser = async (userId: number): Promise<{ success: boolean }> => {
  try {
    const result = await db.delete(usersTable)
      .where(eq(usersTable.id, userId))
      .returning()
      .execute();

    if (result.length === 0) {
      throw new Error('User not found');
    }

    return { success: true };
  } catch (error) {
    console.error('User deletion failed:', error);
    throw error;
  }
};

export const getUsers = async (input: PaginationInput): Promise<{ items: User[], total: number, page: number, limit: number, totalPages: number }> => {
  try {
    const offset = (input.page - 1) * input.limit;

    // Get total count
    const totalResult = await db.select({ count: usersTable.id })
      .from(usersTable)
      .execute();
    const total = totalResult.length;

    // Get paginated users
    const users = await db.select()
      .from(usersTable)
      .limit(input.limit)
      .offset(offset)
      .execute();

    const totalPages = Math.ceil(total / input.limit);

    return {
      items: users,
      total,
      page: input.page,
      limit: input.limit,
      totalPages
    };
  } catch (error) {
    console.error('Users retrieval failed:', error);
    throw error;
  }
};

export const getUserById = async (userId: number): Promise<User | null> => {
  try {
    const result = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error('User retrieval failed:', error);
    throw error;
  }
};
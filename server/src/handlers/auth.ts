import { db } from '../db';
import { usersTable } from '../db/schema';
import { type LoginInput, type AuthResponse, type User } from '../schema';
import { eq } from 'drizzle-orm';

// In a real application, these should be environment variables
const JWT_SECRET = process.env['JWT_SECRET'] || 'your-secret-key';
const JWT_EXPIRES_IN_HOURS = 24;

// Simple password hashing for demonstration - in production use bcrypt or similar
async function hashPassword(password: string): Promise<string> {
  // This is a simplified hash - use bcrypt in production
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'salt');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const inputHash = await hashPassword(password);
  return inputHash === hash;
}

// Simple JWT implementation without external dependencies
function createToken(payload: { userId: number; email: string; role: string }): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    ...payload,
    iat: now,
    exp: now + (JWT_EXPIRES_IN_HOURS * 60 * 60)
  };

  const encodedHeader = btoa(JSON.stringify(header)).replace(/=/g, '');
  const encodedPayload = btoa(JSON.stringify(claims)).replace(/=/g, '');
  
  const signature = btoa(`${encodedHeader}.${encodedPayload}.${JWT_SECRET}`).replace(/=/g, '');
  
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

function verifyTokenSignature(token: string): { userId: number; email: string; role: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const [encodedHeader, encodedPayload, signature] = parts;
    
    // Verify signature
    const expectedSignature = btoa(`${encodedHeader}.${encodedPayload}.${JWT_SECRET}`).replace(/=/g, '');
    if (signature !== expectedSignature) {
      return null;
    }

    // Decode payload
    const payload = JSON.parse(atob(encodedPayload));
    
    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null;
    }

    return {
      userId: payload.userId,
      email: payload.email,
      role: payload.role
    };
  } catch (error) {
    return null;
  }
}

export async function login(input: LoginInput): Promise<AuthResponse> {
  try {
    // Find user by email
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.email, input.email))
      .execute();

    const user = users[0];
    if (!user) {
      throw new Error('Invalid email or password');
    }

    // Check if user is active
    if (!user.is_active) {
      throw new Error('Account is deactivated');
    }

    // Verify password
    const isValidPassword = await verifyPassword(input.password, user.password_hash);
    if (!isValidPassword) {
      throw new Error('Invalid email or password');
    }

    // Generate JWT token
    const token = createToken({
      userId: user.id, 
      email: user.email,
      role: user.role 
    });

    // Return user without password hash
    const { password_hash, ...userWithoutPassword } = user;
    
    return {
      user: userWithoutPassword as User,
      token
    };
  } catch (error) {
    console.error('Login failed:', error);
    throw error;
  }
}

export async function verifyToken(token: string): Promise<User | null> {
  try {
    // Verify JWT token
    const decoded = verifyTokenSignature(token);
    if (!decoded) {
      return null;
    }
    
    // Fetch current user data from database
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, decoded.userId))
      .execute();

    const user = users[0];
    if (!user || !user.is_active) {
      return null;
    }

    // Return user without password hash
    const { password_hash, ...userWithoutPassword } = user;
    return userWithoutPassword as User;
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

export async function getCurrentUser(userId: number): Promise<User | null> {
  try {
    // Fetch user by ID
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    const user = users[0];
    if (!user) {
      return null;
    }

    // Return user without password hash
    const { password_hash, ...userWithoutPassword } = user;
    return userWithoutPassword as User;
  } catch (error) {
    console.error('Get current user failed:', error);
    throw error;
  }
}

// Helper function for creating users with hashed passwords (for testing)
export async function createUserWithHashedPassword(userData: {
  email: string;
  username: string;
  password: string;
  first_name: string;
  last_name: string;
  role?: 'super_admin' | 'author';
  avatar_url?: string | null;
  bio?: string | null;
  is_active?: boolean;
}) {
  try {
    const password_hash = await hashPassword(userData.password);
    
    const result = await db.insert(usersTable)
      .values({
        email: userData.email,
        username: userData.username,
        password_hash,
        first_name: userData.first_name,
        last_name: userData.last_name,
        role: userData.role || 'author',
        avatar_url: userData.avatar_url || null,
        bio: userData.bio || null,
        is_active: userData.is_active !== undefined ? userData.is_active : true
      })
      .returning()
      .execute();

    const user = result[0];
    const { password_hash: _, ...userWithoutPassword } = user;
    return userWithoutPassword as User;
  } catch (error) {
    console.error('User creation failed:', error);
    throw error;
  }
}
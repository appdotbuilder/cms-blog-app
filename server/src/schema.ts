import { z } from 'zod';

// Enums
export const userRoleEnum = z.enum(['super_admin', 'author']);
export const postStatusEnum = z.enum(['draft', 'published']);

// User schemas
export const userSchema = z.object({
  id: z.number(),
  email: z.string().email(),
  username: z.string(),
  password_hash: z.string(),
  first_name: z.string(),
  last_name: z.string(),
  role: userRoleEnum,
  avatar_url: z.string().nullable(),
  bio: z.string().nullable(),
  is_active: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type User = z.infer<typeof userSchema>;

// Input schemas for user operations
export const createUserInputSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(50),
  password: z.string().min(8),
  first_name: z.string().min(1).max(100),
  last_name: z.string().min(1).max(100),
  role: userRoleEnum,
  avatar_url: z.string().url().nullable().optional(),
  bio: z.string().max(500).nullable().optional()
});

export type CreateUserInput = z.infer<typeof createUserInputSchema>;

export const updateUserInputSchema = z.object({
  id: z.number(),
  email: z.string().email().optional(),
  username: z.string().min(3).max(50).optional(),
  first_name: z.string().min(1).max(100).optional(),
  last_name: z.string().min(1).max(100).optional(),
  role: userRoleEnum.optional(),
  avatar_url: z.string().url().nullable().optional(),
  bio: z.string().max(500).nullable().optional(),
  is_active: z.boolean().optional()
});

export type UpdateUserInput = z.infer<typeof updateUserInputSchema>;

// Category schemas
export const categorySchema = z.object({
  id: z.number(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Category = z.infer<typeof categorySchema>;

export const createCategoryInputSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens"),
  description: z.string().max(500).nullable().optional()
});

export type CreateCategoryInput = z.infer<typeof createCategoryInputSchema>;

export const updateCategoryInputSchema = z.object({
  id: z.number(),
  name: z.string().min(1).max(100).optional(),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/).optional(),
  description: z.string().max(500).nullable().optional()
});

export type UpdateCategoryInput = z.infer<typeof updateCategoryInputSchema>;

// Tag schemas
export const tagSchema = z.object({
  id: z.number(),
  name: z.string(),
  slug: z.string(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Tag = z.infer<typeof tagSchema>;

export const createTagInputSchema = z.object({
  name: z.string().min(1).max(50),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens")
});

export type CreateTagInput = z.infer<typeof createTagInputSchema>;

export const updateTagInputSchema = z.object({
  id: z.number(),
  name: z.string().min(1).max(50).optional(),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/).optional()
});

export type UpdateTagInput = z.infer<typeof updateTagInputSchema>;

// Blog post schemas
export const blogPostSchema = z.object({
  id: z.number(),
  title: z.string(),
  slug: z.string(),
  content: z.string(),
  excerpt: z.string().nullable(),
  author_id: z.number(),
  featured_image_url: z.string().nullable(),
  status: postStatusEnum,
  published_at: z.coerce.date().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type BlogPost = z.infer<typeof blogPostSchema>;

export const createBlogPostInputSchema = z.object({
  title: z.string().min(1).max(200),
  slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens"),
  content: z.string().min(1),
  excerpt: z.string().max(500).nullable().optional(),
  featured_image_url: z.string().url().nullable().optional(),
  status: postStatusEnum,
  category_ids: z.array(z.number()).min(1),
  tag_ids: z.array(z.number()).optional()
});

export type CreateBlogPostInput = z.infer<typeof createBlogPostInputSchema>;

export const updateBlogPostInputSchema = z.object({
  id: z.number(),
  title: z.string().min(1).max(200).optional(),
  slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/).optional(),
  content: z.string().min(1).optional(),
  excerpt: z.string().max(500).nullable().optional(),
  featured_image_url: z.string().url().nullable().optional(),
  status: postStatusEnum.optional(),
  category_ids: z.array(z.number()).optional(),
  tag_ids: z.array(z.number()).optional()
});

export type UpdateBlogPostInput = z.infer<typeof updateBlogPostInputSchema>;

// Blog post with relations schema
export const blogPostWithRelationsSchema = z.object({
  id: z.number(),
  title: z.string(),
  slug: z.string(),
  content: z.string(),
  excerpt: z.string().nullable(),
  author_id: z.number(),
  featured_image_url: z.string().nullable(),
  status: postStatusEnum,
  published_at: z.coerce.date().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
  author: userSchema,
  categories: z.array(categorySchema),
  tags: z.array(tagSchema)
});

export type BlogPostWithRelations = z.infer<typeof blogPostWithRelationsSchema>;

// AdSense configuration schemas
export const adSenseConfigSchema = z.object({
  id: z.number(),
  publisher_id: z.string(),
  ad_slot_header: z.string().nullable(),
  ad_slot_sidebar: z.string().nullable(),
  ad_slot_footer: z.string().nullable(),
  ad_slot_in_content: z.string().nullable(),
  is_enabled: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type AdSenseConfig = z.infer<typeof adSenseConfigSchema>;

export const updateAdSenseConfigInputSchema = z.object({
  publisher_id: z.string().min(1),
  ad_slot_header: z.string().nullable().optional(),
  ad_slot_sidebar: z.string().nullable().optional(),
  ad_slot_footer: z.string().nullable().optional(),
  ad_slot_in_content: z.string().nullable().optional(),
  is_enabled: z.boolean()
});

export type UpdateAdSenseConfigInput = z.infer<typeof updateAdSenseConfigInputSchema>;

// Authentication schemas
export const loginInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export type LoginInput = z.infer<typeof loginInputSchema>;

export const authResponseSchema = z.object({
  user: userSchema,
  token: z.string()
});

export type AuthResponse = z.infer<typeof authResponseSchema>;

// Query schemas
export const paginationInputSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(10)
});

export type PaginationInput = z.infer<typeof paginationInputSchema>;

export const blogPostsQueryInputSchema = paginationInputSchema.extend({
  status: postStatusEnum.optional(),
  category_id: z.number().optional(),
  tag_id: z.number().optional(),
  author_id: z.number().optional(),
  search: z.string().optional()
});

export type BlogPostsQueryInput = z.infer<typeof blogPostsQueryInputSchema>;

export const paginatedResponseSchema = <T extends z.ZodType>(itemSchema: T) => z.object({
  items: z.array(itemSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  totalPages: z.number()
});
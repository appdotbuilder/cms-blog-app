import { 
  serial, 
  text, 
  pgTable, 
  timestamp, 
  boolean, 
  integer, 
  pgEnum,
  primaryKey,
  unique,
  index
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const userRoleEnum = pgEnum('user_role', ['super_admin', 'author']);
export const postStatusEnum = pgEnum('post_status', ['draft', 'published']);

// Users table
export const usersTable = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull(),
  username: text('username').notNull(),
  password_hash: text('password_hash').notNull(),
  first_name: text('first_name').notNull(),
  last_name: text('last_name').notNull(),
  role: userRoleEnum('role').notNull().default('author'),
  avatar_url: text('avatar_url'),
  bio: text('bio'),
  is_active: boolean('is_active').notNull().default(true),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  emailIdx: unique().on(table.email),
  usernameIdx: unique().on(table.username),
}));

// Categories table
export const categoriesTable = pgTable('categories', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  description: text('description'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  slugIdx: unique().on(table.slug),
}));

// Tags table
export const tagsTable = pgTable('tags', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  slugIdx: unique().on(table.slug),
}));

// Blog posts table
export const blogPostsTable = pgTable('blog_posts', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  slug: text('slug').notNull(),
  content: text('content').notNull(),
  excerpt: text('excerpt'),
  author_id: integer('author_id').notNull().references(() => usersTable.id, { onDelete: 'cascade' }),
  featured_image_url: text('featured_image_url'),
  status: postStatusEnum('status').notNull().default('draft'),
  published_at: timestamp('published_at'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  slugIdx: unique().on(table.slug),
  authorIdx: index().on(table.author_id),
  statusIdx: index().on(table.status),
  publishedAtIdx: index().on(table.published_at),
}));

// Many-to-many: Blog posts to categories
export const blogPostCategoriesTable = pgTable('blog_post_categories', {
  blog_post_id: integer('blog_post_id').notNull().references(() => blogPostsTable.id, { onDelete: 'cascade' }),
  category_id: integer('category_id').notNull().references(() => categoriesTable.id, { onDelete: 'cascade' }),
}, (table) => ({
  pk: primaryKey({ columns: [table.blog_post_id, table.category_id] }),
}));

// Many-to-many: Blog posts to tags
export const blogPostTagsTable = pgTable('blog_post_tags', {
  blog_post_id: integer('blog_post_id').notNull().references(() => blogPostsTable.id, { onDelete: 'cascade' }),
  tag_id: integer('tag_id').notNull().references(() => tagsTable.id, { onDelete: 'cascade' }),
}, (table) => ({
  pk: primaryKey({ columns: [table.blog_post_id, table.tag_id] }),
}));

// AdSense configuration table
export const adSenseConfigTable = pgTable('adsense_config', {
  id: serial('id').primaryKey(),
  publisher_id: text('publisher_id').notNull(),
  ad_slot_header: text('ad_slot_header'),
  ad_slot_sidebar: text('ad_slot_sidebar'),
  ad_slot_footer: text('ad_slot_footer'),
  ad_slot_in_content: text('ad_slot_in_content'),
  is_enabled: boolean('is_enabled').notNull().default(false),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(usersTable, ({ many }) => ({
  blogPosts: many(blogPostsTable),
}));

export const categoriesRelations = relations(categoriesTable, ({ many }) => ({
  blogPostCategories: many(blogPostCategoriesTable),
}));

export const tagsRelations = relations(tagsTable, ({ many }) => ({
  blogPostTags: many(blogPostTagsTable),
}));

export const blogPostsRelations = relations(blogPostsTable, ({ one, many }) => ({
  author: one(usersTable, {
    fields: [blogPostsTable.author_id],
    references: [usersTable.id],
  }),
  blogPostCategories: many(blogPostCategoriesTable),
  blogPostTags: many(blogPostTagsTable),
}));

export const blogPostCategoriesRelations = relations(blogPostCategoriesTable, ({ one }) => ({
  blogPost: one(blogPostsTable, {
    fields: [blogPostCategoriesTable.blog_post_id],
    references: [blogPostsTable.id],
  }),
  category: one(categoriesTable, {
    fields: [blogPostCategoriesTable.category_id],
    references: [categoriesTable.id],
  }),
}));

export const blogPostTagsRelations = relations(blogPostTagsTable, ({ one }) => ({
  blogPost: one(blogPostsTable, {
    fields: [blogPostTagsTable.blog_post_id],
    references: [blogPostsTable.id],
  }),
  tag: one(tagsTable, {
    fields: [blogPostTagsTable.tag_id],
    references: [tagsTable.id],
  }),
}));

// TypeScript types for table schemas
export type User = typeof usersTable.$inferSelect;
export type NewUser = typeof usersTable.$inferInsert;

export type Category = typeof categoriesTable.$inferSelect;
export type NewCategory = typeof categoriesTable.$inferInsert;

export type Tag = typeof tagsTable.$inferSelect;
export type NewTag = typeof tagsTable.$inferInsert;

export type BlogPost = typeof blogPostsTable.$inferSelect;
export type NewBlogPost = typeof blogPostsTable.$inferInsert;

export type BlogPostCategory = typeof blogPostCategoriesTable.$inferSelect;
export type NewBlogPostCategory = typeof blogPostCategoriesTable.$inferInsert;

export type BlogPostTag = typeof blogPostTagsTable.$inferSelect;
export type NewBlogPostTag = typeof blogPostTagsTable.$inferInsert;

export type AdSenseConfig = typeof adSenseConfigTable.$inferSelect;
export type NewAdSenseConfig = typeof adSenseConfigTable.$inferInsert;

// Export all tables and relations for proper query building
export const tables = {
  users: usersTable,
  categories: categoriesTable,
  tags: tagsTable,
  blogPosts: blogPostsTable,
  blogPostCategories: blogPostCategoriesTable,
  blogPostTags: blogPostTagsTable,
  adSenseConfig: adSenseConfigTable,
};
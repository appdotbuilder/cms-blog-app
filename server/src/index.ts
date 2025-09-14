import { initTRPC, TRPCError } from '@trpc/server';
import { z } from 'zod';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';

// Import schemas
import {
  // Auth schemas
  loginInputSchema,
  
  // User schemas
  createUserInputSchema,
  updateUserInputSchema,
  paginationInputSchema,
  
  // Category schemas
  createCategoryInputSchema,
  updateCategoryInputSchema,
  
  // Tag schemas
  createTagInputSchema,
  updateTagInputSchema,
  
  // Blog post schemas
  createBlogPostInputSchema,
  updateBlogPostInputSchema,
  blogPostsQueryInputSchema,
  
  // AdSense schemas
  updateAdSenseConfigInputSchema
} from './schema';

// Import handlers
import { login, verifyToken, getCurrentUser } from './handlers/auth';
import { 
  createUser, 
  updateUser, 
  deleteUser, 
  getUsers, 
  getUserById 
} from './handlers/users';
import { 
  createCategory, 
  updateCategory, 
  deleteCategory, 
  getCategories, 
  getCategoryById, 
  getCategoryBySlug 
} from './handlers/categories';
import { 
  createTag, 
  updateTag, 
  deleteTag, 
  getTags, 
  getTagById, 
  getTagBySlug 
} from './handlers/tags';
import { 
  createBlogPost, 
  updateBlogPost, 
  deleteBlogPost, 
  getBlogPosts, 
  getBlogPostById, 
  getBlogPostBySlug, 
  getMyBlogPosts 
} from './handlers/blog_posts';
import { 
  getAdSenseConfig, 
  updateAdSenseConfig, 
  getPublicAdSenseConfig 
} from './handlers/adsense';

const t = initTRPC.context<{
  user?: { id: number; role: string } | null;
}>().create({
  transformer: superjson,
});

const publicProcedure = t.procedure;

// Middleware for authentication
const authMiddleware = t.middleware(async ({ next, ctx }) => {
  // This is a placeholder! Real implementation should extract JWT from headers
  // and verify it using the verifyToken handler
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

// Middleware for super admin only
const superAdminMiddleware = authMiddleware.unstable_pipe(async ({ next, ctx }) => {
  if (ctx.user?.role !== 'super_admin') {
    throw new TRPCError({ code: 'FORBIDDEN' });
  }
  return next({ ctx });
});

const authProcedure = publicProcedure.use(authMiddleware);
const superAdminProcedure = publicProcedure.use(superAdminMiddleware);

const router = t.router;

const appRouter = router({
  // Health check
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // Authentication routes
  auth: router({
    login: publicProcedure
      .input(loginInputSchema)
      .mutation(({ input }) => login(input)),
    
    me: authProcedure
      .query(({ ctx }) => getCurrentUser(ctx.user!.id)),
  }),

  // User management routes
  users: router({
    create: superAdminProcedure
      .input(createUserInputSchema)
      .mutation(({ input }) => createUser(input)),
    
    update: authProcedure
      .input(updateUserInputSchema)
      .mutation(({ input, ctx }) => {
        // Authors can only update themselves, super_admin can update anyone
        if (ctx.user!.role !== 'super_admin' && input.id !== ctx.user!.id) {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        return updateUser(input);
      }),
    
    delete: superAdminProcedure
      .input(z.number())
      .mutation(({ input }) => deleteUser(input)),
    
    list: superAdminProcedure
      .input(paginationInputSchema)
      .query(({ input }) => getUsers(input)),
    
    getById: authProcedure
      .input(z.number())
      .query(({ input, ctx }) => {
        // Authors can only view themselves, super_admin can view anyone
        if (ctx.user!.role !== 'super_admin' && input !== ctx.user!.id) {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        return getUserById(input);
      }),
  }),

  // Category management routes
  categories: router({
    create: superAdminProcedure
      .input(createCategoryInputSchema)
      .mutation(({ input }) => createCategory(input)),
    
    update: superAdminProcedure
      .input(updateCategoryInputSchema)
      .mutation(({ input }) => updateCategory(input)),
    
    delete: superAdminProcedure
      .input(z.number())
      .mutation(({ input }) => deleteCategory(input)),
    
    list: publicProcedure
      .query(() => getCategories()),
    
    getById: publicProcedure
      .input(z.number())
      .query(({ input }) => getCategoryById(input)),
    
    getBySlug: publicProcedure
      .input(z.string())
      .query(({ input }) => getCategoryBySlug(input)),
  }),

  // Tag management routes
  tags: router({
    create: superAdminProcedure
      .input(createTagInputSchema)
      .mutation(({ input }) => createTag(input)),
    
    update: superAdminProcedure
      .input(updateTagInputSchema)
      .mutation(({ input }) => updateTag(input)),
    
    delete: superAdminProcedure
      .input(z.number())
      .mutation(({ input }) => deleteTag(input)),
    
    list: publicProcedure
      .query(() => getTags()),
    
    getById: publicProcedure
      .input(z.number())
      .query(({ input }) => getTagById(input)),
    
    getBySlug: publicProcedure
      .input(z.string())
      .query(({ input }) => getTagBySlug(input)),
  }),

  // Blog post routes
  posts: router({
    create: authProcedure
      .input(createBlogPostInputSchema)
      .mutation(({ input, ctx }) => createBlogPost(input, ctx.user!.id)),
    
    update: authProcedure
      .input(updateBlogPostInputSchema)
      .mutation(({ input, ctx }) => updateBlogPost(input, ctx.user!.id, ctx.user!.role)),
    
    delete: authProcedure
      .input(z.number())
      .mutation(({ input, ctx }) => deleteBlogPost(input, ctx.user!.id, ctx.user!.role)),
    
    list: publicProcedure
      .input(blogPostsQueryInputSchema)
      .query(({ input }) => getBlogPosts(input)),
    
    getById: publicProcedure
      .input(z.number())
      .query(({ input }) => getBlogPostById(input)),
    
    getBySlug: publicProcedure
      .input(z.string())
      .query(({ input }) => getBlogPostBySlug(input)),
    
    myPosts: authProcedure
      .input(blogPostsQueryInputSchema)
      .query(({ input, ctx }) => getMyBlogPosts(ctx.user!.id, input)),
  }),

  // AdSense configuration routes
  adsense: router({
    getConfig: superAdminProcedure
      .query(() => getAdSenseConfig()),
    
    updateConfig: superAdminProcedure
      .input(updateAdSenseConfigInputSchema)
      .mutation(({ input }) => updateAdSenseConfig(input)),
    
    getPublicConfig: publicProcedure
      .query(() => getPublicAdSenseConfig()),
  }),
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors()(req, res, next);
    },
    router: appRouter,
    createContext() {
      // This is a placeholder! Real implementation should extract user from JWT token
      return {
        user: null // This should be populated from JWT verification
      };
    },
  });
  server.listen(port);
  console.log(`TRPC server listening at port: ${port}`);
}

start();
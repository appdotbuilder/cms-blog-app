import { db } from '../db';
import { 
    usersTable,
    blogPostsTable, 
    categoriesTable,
    tagsTable,
    blogPostCategoriesTable,
    blogPostTagsTable
} from '../db/schema';
import { 
    type CreateBlogPostInput, 
    type UpdateBlogPostInput, 
    type BlogPost, 
    type BlogPostWithRelations,
    type BlogPostsQueryInput 
} from '../schema';
import { eq, and, or, like, ilike, desc, count, SQL } from 'drizzle-orm';

export async function createBlogPost(input: CreateBlogPostInput, authorId: number): Promise<BlogPost> {
    try {
        // Verify author exists
        const author = await db.select()
            .from(usersTable)
            .where(eq(usersTable.id, authorId))
            .execute();
        
        if (author.length === 0) {
            throw new Error('Author not found');
        }

        // Verify categories exist
        const categories = await db.select()
            .from(categoriesTable)
            .where(or(...input.category_ids.map(id => eq(categoriesTable.id, id)))!)
            .execute();
        
        if (categories.length !== input.category_ids.length) {
            throw new Error('One or more categories not found');
        }

        // Verify tags exist if provided
        if (input.tag_ids && input.tag_ids.length > 0) {
            const tags = await db.select()
                .from(tagsTable)
                .where(or(...input.tag_ids.map(id => eq(tagsTable.id, id)))!)
                .execute();
            
            if (tags.length !== input.tag_ids.length) {
                throw new Error('One or more tags not found');
            }
        }

        // Create blog post
        const publishedAt = input.status === 'published' ? new Date() : null;
        
        const result = await db.insert(blogPostsTable)
            .values({
                title: input.title,
                slug: input.slug,
                content: input.content,
                excerpt: input.excerpt || null,
                author_id: authorId,
                featured_image_url: input.featured_image_url || null,
                status: input.status,
                published_at: publishedAt
            })
            .returning()
            .execute();

        const blogPost = result[0];

        // Create category associations
        if (input.category_ids.length > 0) {
            await db.insert(blogPostCategoriesTable)
                .values(
                    input.category_ids.map(categoryId => ({
                        blog_post_id: blogPost.id,
                        category_id: categoryId
                    }))
                )
                .execute();
        }

        // Create tag associations
        if (input.tag_ids && input.tag_ids.length > 0) {
            await db.insert(blogPostTagsTable)
                .values(
                    input.tag_ids.map(tagId => ({
                        blog_post_id: blogPost.id,
                        tag_id: tagId
                    }))
                )
                .execute();
        }

        return blogPost;
    } catch (error) {
        console.error('Blog post creation failed:', error);
        throw error;
    }
}

export async function updateBlogPost(input: UpdateBlogPostInput, currentUserId: number, currentUserRole: string): Promise<BlogPost> {
    try {
        // Get existing blog post
        const existingPost = await db.select()
            .from(blogPostsTable)
            .where(eq(blogPostsTable.id, input.id))
            .execute();
        
        if (existingPost.length === 0) {
            throw new Error('Blog post not found');
        }

        const post = existingPost[0];

        // Check permissions
        if (currentUserRole !== 'super_admin' && post.author_id !== currentUserId) {
            throw new Error('Permission denied: can only update your own posts');
        }

        // Verify categories exist if provided
        if (input.category_ids && input.category_ids.length > 0) {
            const categories = await db.select()
                .from(categoriesTable)
                .where(or(...input.category_ids.map(id => eq(categoriesTable.id, id)))!)
                .execute();
            
            if (categories.length !== input.category_ids.length) {
                throw new Error('One or more categories not found');
            }
        }

        // Verify tags exist if provided
        if (input.tag_ids && input.tag_ids.length > 0) {
            const tags = await db.select()
                .from(tagsTable)
                .where(or(...input.tag_ids.map(id => eq(tagsTable.id, id)))!)
                .execute();
            
            if (tags.length !== input.tag_ids.length) {
                throw new Error('One or more tags not found');
            }
        }

        // Determine published_at timestamp
        let publishedAt = post.published_at;
        if (input.status === 'published' && post.status === 'draft') {
            publishedAt = new Date();
        } else if (input.status === 'draft') {
            publishedAt = null;
        }

        // Build update values
        const updateValues: any = {
            updated_at: new Date()
        };

        if (input.title !== undefined) updateValues.title = input.title;
        if (input.slug !== undefined) updateValues.slug = input.slug;
        if (input.content !== undefined) updateValues.content = input.content;
        if (input.excerpt !== undefined) updateValues.excerpt = input.excerpt;
        if (input.featured_image_url !== undefined) updateValues.featured_image_url = input.featured_image_url;
        if (input.status !== undefined) {
            updateValues.status = input.status;
            updateValues.published_at = publishedAt;
        }

        // Update blog post
        const result = await db.update(blogPostsTable)
            .set(updateValues)
            .where(eq(blogPostsTable.id, input.id))
            .returning()
            .execute();

        // Update category associations if provided
        if (input.category_ids !== undefined) {
            // Remove existing associations
            await db.delete(blogPostCategoriesTable)
                .where(eq(blogPostCategoriesTable.blog_post_id, input.id))
                .execute();

            // Add new associations
            if (input.category_ids.length > 0) {
                await db.insert(blogPostCategoriesTable)
                    .values(
                        input.category_ids.map(categoryId => ({
                            blog_post_id: input.id,
                            category_id: categoryId
                        }))
                    )
                    .execute();
            }
        }

        // Update tag associations if provided
        if (input.tag_ids !== undefined) {
            // Remove existing associations
            await db.delete(blogPostTagsTable)
                .where(eq(blogPostTagsTable.blog_post_id, input.id))
                .execute();

            // Add new associations
            if (input.tag_ids.length > 0) {
                await db.insert(blogPostTagsTable)
                    .values(
                        input.tag_ids.map(tagId => ({
                            blog_post_id: input.id,
                            tag_id: tagId
                        }))
                    )
                    .execute();
            }
        }

        return result[0];
    } catch (error) {
        console.error('Blog post update failed:', error);
        throw error;
    }
}

export async function deleteBlogPost(postId: number, currentUserId: number, currentUserRole: string): Promise<{ success: boolean }> {
    try {
        // Get existing blog post
        const existingPost = await db.select()
            .from(blogPostsTable)
            .where(eq(blogPostsTable.id, postId))
            .execute();
        
        if (existingPost.length === 0) {
            throw new Error('Blog post not found');
        }

        const post = existingPost[0];

        // Check permissions
        if (currentUserRole !== 'super_admin' && post.author_id !== currentUserId) {
            throw new Error('Permission denied: can only delete your own posts');
        }

        // Delete blog post (cascades will handle category/tag associations)
        await db.delete(blogPostsTable)
            .where(eq(blogPostsTable.id, postId))
            .execute();

        return { success: true };
    } catch (error) {
        console.error('Blog post deletion failed:', error);
        throw error;
    }
}

export async function getBlogPosts(input: BlogPostsQueryInput): Promise<{ 
    items: BlogPostWithRelations[], 
    total: number, 
    page: number, 
    limit: number, 
    totalPages: number 
}> {
    try {
        // Build main conditions for filtering
        const conditions: SQL<unknown>[] = [];
        
        if (input.status) {
            conditions.push(eq(blogPostsTable.status, input.status));
        }
        
        if (input.author_id) {
            conditions.push(eq(blogPostsTable.author_id, input.author_id));
        }
        
        if (input.search) {
            conditions.push(
                or(
                    ilike(blogPostsTable.title, `%${input.search}%`),
                    ilike(blogPostsTable.content, `%${input.search}%`),
                    ilike(blogPostsTable.excerpt, `%${input.search}%`)
                )!
            );
        }

        // Handle category and tag filtering with separate queries to avoid complex joins
        let filteredPostIds: number[] | null = null;

        if (input.category_id) {
            const postsInCategory = await db.select({ id: blogPostCategoriesTable.blog_post_id })
                .from(blogPostCategoriesTable)
                .where(eq(blogPostCategoriesTable.category_id, input.category_id))
                .execute();
            filteredPostIds = postsInCategory.map(p => p.id);
        }

        if (input.tag_id) {
            const postsWithTag = await db.select({ id: blogPostTagsTable.blog_post_id })
                .from(blogPostTagsTable)
                .where(eq(blogPostTagsTable.tag_id, input.tag_id))
                .execute();
            const tagPostIds = postsWithTag.map(p => p.id);
            
            // Intersect with existing filter if any
            if (filteredPostIds !== null) {
                filteredPostIds = filteredPostIds.filter(id => tagPostIds.includes(id));
            } else {
                filteredPostIds = tagPostIds;
            }
        }

        // If filtered by category/tag and no posts found, return empty result
        if (filteredPostIds !== null && filteredPostIds.length === 0) {
            return {
                items: [],
                total: 0,
                page: input.page,
                limit: input.limit,
                totalPages: 0
            };
        }

        // Add post ID filter if we have filtered results
        if (filteredPostIds !== null) {
            conditions.push(or(...filteredPostIds.map(id => eq(blogPostsTable.id, id)))!);
        }

        // Execute main query to get blog posts with authors
        const offset = (input.page - 1) * input.limit;
        
        const baseQuery = db.select()
            .from(blogPostsTable)
            .innerJoin(usersTable, eq(blogPostsTable.author_id, usersTable.id));

        const results = conditions.length > 0
            ? await baseQuery
                .where(conditions.length === 1 ? conditions[0] : and(...conditions))
                .orderBy(desc(blogPostsTable.created_at))
                .limit(input.limit)
                .offset(offset)
                .execute()
            : await baseQuery
                .orderBy(desc(blogPostsTable.created_at))
                .limit(input.limit)
                .offset(offset)
                .execute();

        // Get post IDs for fetching relations
        const postIds = results.map((result: any) => result.blog_posts.id);
        
        // Fetch categories for posts
        const postCategories = postIds.length > 0 ? await db.select()
            .from(blogPostCategoriesTable)
            .innerJoin(categoriesTable, eq(blogPostCategoriesTable.category_id, categoriesTable.id))
            .where(or(...postIds.map(id => eq(blogPostCategoriesTable.blog_post_id, id)))!)
            .execute() : [];

        // Fetch tags for posts
        const postTags = postIds.length > 0 ? await db.select()
            .from(blogPostTagsTable)
            .innerJoin(tagsTable, eq(blogPostTagsTable.tag_id, tagsTable.id))
            .where(or(...postIds.map(id => eq(blogPostTagsTable.blog_post_id, id)))!)
            .execute() : [];

        // Build the response items
        const items: BlogPostWithRelations[] = results.map((result: any) => {
            const post = result.blog_posts;
            const author = result.users;

            // Get categories for this post
            const categories = postCategories
                .filter((pc: any) => pc.blog_post_categories.blog_post_id === post.id)
                .map((pc: any) => pc.categories);

            // Get tags for this post
            const tags = postTags
                .filter((pt: any) => pt.blog_post_tags.blog_post_id === post.id)
                .map((pt: any) => pt.tags);

            return {
                ...post,
                author,
                categories,
                tags
            };
        });

        // Get total count
        const countQuery = db.select({ count: count() }).from(blogPostsTable);
        const countResult = conditions.length > 0
            ? await countQuery
                .where(conditions.length === 1 ? conditions[0] : and(...conditions))
                .execute()
            : await countQuery.execute();

        const total = countResult[0].count;
        const totalPages = Math.ceil(total / input.limit);

        return {
            items,
            total,
            page: input.page,
            limit: input.limit,
            totalPages
        };
    } catch (error) {
        console.error('Get blog posts failed:', error);
        throw error;
    }
}

export async function getBlogPostById(postId: number): Promise<BlogPostWithRelations | null> {
    try {
        // Get blog post with author
        const results = await db.select()
            .from(blogPostsTable)
            .innerJoin(usersTable, eq(blogPostsTable.author_id, usersTable.id))
            .where(eq(blogPostsTable.id, postId))
            .execute();

        if (results.length === 0) {
            return null;
        }

        const result = results[0];
        const post = (result as any).blog_posts;
        const author = (result as any).users;

        // Get categories for this post
        const postCategories = await db.select()
            .from(blogPostCategoriesTable)
            .innerJoin(categoriesTable, eq(blogPostCategoriesTable.category_id, categoriesTable.id))
            .where(eq(blogPostCategoriesTable.blog_post_id, postId))
            .execute();

        const categories = postCategories.map((pc: any) => pc.categories);

        // Get tags for this post
        const postTags = await db.select()
            .from(blogPostTagsTable)
            .innerJoin(tagsTable, eq(blogPostTagsTable.tag_id, tagsTable.id))
            .where(eq(blogPostTagsTable.blog_post_id, postId))
            .execute();

        const tags = postTags.map((pt: any) => pt.tags);

        return {
            ...post,
            author,
            categories,
            tags
        };
    } catch (error) {
        console.error('Get blog post by ID failed:', error);
        throw error;
    }
}

export async function getBlogPostBySlug(slug: string): Promise<BlogPostWithRelations | null> {
    try {
        // Get blog post with author
        const results = await db.select()
            .from(blogPostsTable)
            .innerJoin(usersTable, eq(blogPostsTable.author_id, usersTable.id))
            .where(eq(blogPostsTable.slug, slug))
            .execute();

        if (results.length === 0) {
            return null;
        }

        const result = results[0];
        const post = (result as any).blog_posts;
        const author = (result as any).users;

        // Get categories for this post
        const postCategories = await db.select()
            .from(blogPostCategoriesTable)
            .innerJoin(categoriesTable, eq(blogPostCategoriesTable.category_id, categoriesTable.id))
            .where(eq(blogPostCategoriesTable.blog_post_id, post.id))
            .execute();

        const categories = postCategories.map((pc: any) => pc.categories);

        // Get tags for this post
        const postTags = await db.select()
            .from(blogPostTagsTable)
            .innerJoin(tagsTable, eq(blogPostTagsTable.tag_id, tagsTable.id))
            .where(eq(blogPostTagsTable.blog_post_id, post.id))
            .execute();

        const tags = postTags.map((pt: any) => pt.tags);

        return {
            ...post,
            author,
            categories,
            tags
        };
    } catch (error) {
        console.error('Get blog post by slug failed:', error);
        throw error;
    }
}

export async function getMyBlogPosts(authorId: number, input: BlogPostsQueryInput): Promise<{ 
    items: BlogPostWithRelations[], 
    total: number, 
    page: number, 
    limit: number, 
    totalPages: number 
}> {
    try {
        // Create input with author filter
        const authorFilteredInput = {
            ...input,
            author_id: authorId
        };

        return await getBlogPosts(authorFilteredInput);
    } catch (error) {
        console.error('Get my blog posts failed:', error);
        throw error;
    }
}
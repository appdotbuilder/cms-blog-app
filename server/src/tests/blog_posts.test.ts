import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
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
    type BlogPostsQueryInput
} from '../schema';
import { 
    createBlogPost,
    updateBlogPost,
    deleteBlogPost,
    getBlogPosts,
    getBlogPostById,
    getBlogPostBySlug,
    getMyBlogPosts
} from '../handlers/blog_posts';
import { eq } from 'drizzle-orm';

// Test data
const testAuthor = {
    email: 'author@test.com',
    username: 'testauthor',
    password_hash: 'hashedpassword',
    first_name: 'Test',
    last_name: 'Author',
    role: 'author' as const
};

const testSuperAdmin = {
    email: 'admin@test.com',
    username: 'testadmin',
    password_hash: 'hashedpassword',
    first_name: 'Test',
    last_name: 'Admin',
    role: 'super_admin' as const
};

const testCategory1 = {
    name: 'Technology',
    slug: 'technology',
    description: 'Tech articles'
};

const testCategory2 = {
    name: 'Lifestyle',
    slug: 'lifestyle',
    description: 'Lifestyle articles'
};

const testTag1 = {
    name: 'JavaScript',
    slug: 'javascript'
};

const testTag2 = {
    name: 'Web Development',
    slug: 'web-development'
};

const createBlogPostInput: CreateBlogPostInput = {
    title: 'Test Blog Post',
    slug: 'test-blog-post',
    content: 'This is the content of the test blog post.',
    excerpt: 'This is a test excerpt.',
    featured_image_url: 'https://example.com/image.jpg',
    status: 'draft',
    category_ids: [],
    tag_ids: []
};

describe('Blog Posts Handlers', () => {
    let authorId: number;
    let superAdminId: number;
    let categoryId1: number;
    let categoryId2: number;
    let tagId1: number;
    let tagId2: number;

    beforeEach(async () => {
        await createDB();
        
        // Create test users
        const authorResult = await db.insert(usersTable)
            .values(testAuthor)
            .returning()
            .execute();
        authorId = authorResult[0].id;

        const adminResult = await db.insert(usersTable)
            .values(testSuperAdmin)
            .returning()
            .execute();
        superAdminId = adminResult[0].id;

        // Create test categories
        const category1Result = await db.insert(categoriesTable)
            .values(testCategory1)
            .returning()
            .execute();
        categoryId1 = category1Result[0].id;

        const category2Result = await db.insert(categoriesTable)
            .values(testCategory2)
            .returning()
            .execute();
        categoryId2 = category2Result[0].id;

        // Create test tags
        const tag1Result = await db.insert(tagsTable)
            .values(testTag1)
            .returning()
            .execute();
        tagId1 = tag1Result[0].id;

        const tag2Result = await db.insert(tagsTable)
            .values(testTag2)
            .returning()
            .execute();
        tagId2 = tag2Result[0].id;
    });

    afterEach(resetDB);

    describe('createBlogPost', () => {
        it('should create a draft blog post with categories and tags', async () => {
            const input = {
                ...createBlogPostInput,
                category_ids: [categoryId1, categoryId2],
                tag_ids: [tagId1, tagId2]
            };

            const result = await createBlogPost(input, authorId);

            expect(result.title).toEqual('Test Blog Post');
            expect(result.slug).toEqual('test-blog-post');
            expect(result.content).toEqual('This is the content of the test blog post.');
            expect(result.excerpt).toEqual('This is a test excerpt.');
            expect(result.author_id).toEqual(authorId);
            expect(result.featured_image_url).toEqual('https://example.com/image.jpg');
            expect(result.status).toEqual('draft');
            expect(result.published_at).toBeNull();
            expect(result.id).toBeDefined();
            expect(result.created_at).toBeInstanceOf(Date);

            // Verify category associations
            const categories = await db.select()
                .from(blogPostCategoriesTable)
                .where(eq(blogPostCategoriesTable.blog_post_id, result.id))
                .execute();
            expect(categories).toHaveLength(2);

            // Verify tag associations
            const tags = await db.select()
                .from(blogPostTagsTable)
                .where(eq(blogPostTagsTable.blog_post_id, result.id))
                .execute();
            expect(tags).toHaveLength(2);
        });

        it('should create a published blog post with published_at timestamp', async () => {
            const input = {
                ...createBlogPostInput,
                status: 'published' as const,
                category_ids: [categoryId1]
            };

            const result = await createBlogPost(input, authorId);

            expect(result.status).toEqual('published');
            expect(result.published_at).toBeInstanceOf(Date);
        });

        it('should create blog post without tags', async () => {
            const input = {
                ...createBlogPostInput,
                category_ids: [categoryId1]
            };

            const result = await createBlogPost(input, authorId);

            expect(result.id).toBeDefined();
            
            // Verify no tag associations
            const tags = await db.select()
                .from(blogPostTagsTable)
                .where(eq(blogPostTagsTable.blog_post_id, result.id))
                .execute();
            expect(tags).toHaveLength(0);
        });

        it('should throw error when author does not exist', async () => {
            const input = {
                ...createBlogPostInput,
                category_ids: [categoryId1]
            };

            await expect(createBlogPost(input, 9999)).rejects.toThrow(/author not found/i);
        });

        it('should throw error when category does not exist', async () => {
            const input = {
                ...createBlogPostInput,
                category_ids: [9999]
            };

            await expect(createBlogPost(input, authorId)).rejects.toThrow(/categories not found/i);
        });

        it('should throw error when tag does not exist', async () => {
            const input = {
                ...createBlogPostInput,
                category_ids: [categoryId1],
                tag_ids: [9999]
            };

            await expect(createBlogPost(input, authorId)).rejects.toThrow(/tags not found/i);
        });
    });

    describe('updateBlogPost', () => {
        let blogPostId: number;

        beforeEach(async () => {
            const input = {
                ...createBlogPostInput,
                category_ids: [categoryId1],
                tag_ids: [tagId1]
            };
            const post = await createBlogPost(input, authorId);
            blogPostId = post.id;
        });

        it('should update blog post by author', async () => {
            const updateInput: UpdateBlogPostInput = {
                id: blogPostId,
                title: 'Updated Title',
                status: 'published'
            };

            const result = await updateBlogPost(updateInput, authorId, 'author');

            expect(result.title).toEqual('Updated Title');
            expect(result.status).toEqual('published');
            expect(result.published_at).toBeInstanceOf(Date);
            expect(result.updated_at).toBeInstanceOf(Date);
        });

        it('should update blog post categories and tags', async () => {
            const updateInput: UpdateBlogPostInput = {
                id: blogPostId,
                category_ids: [categoryId2],
                tag_ids: [tagId2]
            };

            await updateBlogPost(updateInput, authorId, 'author');

            // Verify category associations updated
            const categories = await db.select()
                .from(blogPostCategoriesTable)
                .where(eq(blogPostCategoriesTable.blog_post_id, blogPostId))
                .execute();
            expect(categories).toHaveLength(1);
            expect(categories[0].category_id).toEqual(categoryId2);

            // Verify tag associations updated
            const tags = await db.select()
                .from(blogPostTagsTable)
                .where(eq(blogPostTagsTable.blog_post_id, blogPostId))
                .execute();
            expect(tags).toHaveLength(1);
            expect(tags[0].tag_id).toEqual(tagId2);
        });

        it('should allow super_admin to update any post', async () => {
            const updateInput: UpdateBlogPostInput = {
                id: blogPostId,
                title: 'Updated by Admin'
            };

            const result = await updateBlogPost(updateInput, superAdminId, 'super_admin');

            expect(result.title).toEqual('Updated by Admin');
        });

        it('should throw error when author tries to update another author\'s post', async () => {
            // Create another author
            const anotherAuthor = await db.insert(usersTable)
                .values({
                    email: 'another@test.com',
                    username: 'another',
                    password_hash: 'hash',
                    first_name: 'Another',
                    last_name: 'Author',
                    role: 'author'
                })
                .returning()
                .execute();

            const updateInput: UpdateBlogPostInput = {
                id: blogPostId,
                title: 'Unauthorized Update'
            };

            await expect(
                updateBlogPost(updateInput, anotherAuthor[0].id, 'author')
            ).rejects.toThrow(/permission denied/i);
        });

        it('should throw error when blog post does not exist', async () => {
            const updateInput: UpdateBlogPostInput = {
                id: 9999,
                title: 'Non-existent Post'
            };

            await expect(
                updateBlogPost(updateInput, authorId, 'author')
            ).rejects.toThrow(/not found/i);
        });

        it('should set published_at when changing from draft to published', async () => {
            const updateInput: UpdateBlogPostInput = {
                id: blogPostId,
                status: 'published'
            };

            const result = await updateBlogPost(updateInput, authorId, 'author');

            expect(result.status).toEqual('published');
            expect(result.published_at).toBeInstanceOf(Date);
        });
    });

    describe('deleteBlogPost', () => {
        let blogPostId: number;

        beforeEach(async () => {
            const input = {
                ...createBlogPostInput,
                category_ids: [categoryId1],
                tag_ids: [tagId1]
            };
            const post = await createBlogPost(input, authorId);
            blogPostId = post.id;
        });

        it('should delete blog post by author', async () => {
            const result = await deleteBlogPost(blogPostId, authorId, 'author');

            expect(result.success).toBe(true);

            // Verify post is deleted
            const posts = await db.select()
                .from(blogPostsTable)
                .where(eq(blogPostsTable.id, blogPostId))
                .execute();
            expect(posts).toHaveLength(0);
        });

        it('should allow super_admin to delete any post', async () => {
            const result = await deleteBlogPost(blogPostId, superAdminId, 'super_admin');

            expect(result.success).toBe(true);
        });

        it('should throw error when author tries to delete another author\'s post', async () => {
            // Create another author
            const anotherAuthor = await db.insert(usersTable)
                .values({
                    email: 'another@test.com',
                    username: 'another',
                    password_hash: 'hash',
                    first_name: 'Another',
                    last_name: 'Author',
                    role: 'author'
                })
                .returning()
                .execute();

            await expect(
                deleteBlogPost(blogPostId, anotherAuthor[0].id, 'author')
            ).rejects.toThrow(/permission denied/i);
        });

        it('should throw error when blog post does not exist', async () => {
            await expect(
                deleteBlogPost(9999, authorId, 'author')
            ).rejects.toThrow(/not found/i);
        });
    });

    describe('getBlogPosts', () => {
        let publishedPostId: number;
        let draftPostId: number;

        beforeEach(async () => {
            // Create published post
            const publishedInput = {
                ...createBlogPostInput,
                title: 'Published Post',
                slug: 'published-post',
                status: 'published' as const,
                category_ids: [categoryId1],
                tag_ids: [tagId1]
            };
            const publishedPost = await createBlogPost(publishedInput, authorId);
            publishedPostId = publishedPost.id;

            // Create draft post
            const draftInput = {
                ...createBlogPostInput,
                title: 'Draft Post',
                slug: 'draft-post',
                status: 'draft' as const,
                category_ids: [categoryId2],
                tag_ids: [tagId2]
            };
            const draftPost = await createBlogPost(draftInput, authorId);
            draftPostId = draftPost.id;
        });

        it('should get all blog posts with pagination', async () => {
            const input: BlogPostsQueryInput = {
                page: 1,
                limit: 10
            };

            const result = await getBlogPosts(input);

            expect(result.items).toHaveLength(2);
            expect(result.total).toEqual(2);
            expect(result.page).toEqual(1);
            expect(result.limit).toEqual(10);
            expect(result.totalPages).toEqual(1);
            
            // Check that items include relations
            expect(result.items[0].author).toBeDefined();
            expect(result.items[0].categories).toBeDefined();
            expect(result.items[0].tags).toBeDefined();
        });

        it('should filter by status', async () => {
            const input: BlogPostsQueryInput = {
                page: 1,
                limit: 10,
                status: 'published'
            };

            const result = await getBlogPosts(input);

            expect(result.items).toHaveLength(1);
            expect(result.items[0].status).toEqual('published');
        });

        it('should filter by category', async () => {
            const input: BlogPostsQueryInput = {
                page: 1,
                limit: 10,
                category_id: categoryId1
            };

            const result = await getBlogPosts(input);

            expect(result.items).toHaveLength(1);
            expect(result.items[0].title).toEqual('Published Post');
        });

        it('should filter by tag', async () => {
            const input: BlogPostsQueryInput = {
                page: 1,
                limit: 10,
                tag_id: tagId2
            };

            const result = await getBlogPosts(input);

            expect(result.items).toHaveLength(1);
            expect(result.items[0].title).toEqual('Draft Post');
        });

        it('should filter by author', async () => {
            const input: BlogPostsQueryInput = {
                page: 1,
                limit: 10,
                author_id: authorId
            };

            const result = await getBlogPosts(input);

            expect(result.items).toHaveLength(2);
            result.items.forEach(item => {
                expect(item.author_id).toEqual(authorId);
            });
        });

        it('should search in title and content', async () => {
            const input: BlogPostsQueryInput = {
                page: 1,
                limit: 10,
                search: 'Published'
            };

            const result = await getBlogPosts(input);

            expect(result.items).toHaveLength(1);
            expect(result.items[0].title).toEqual('Published Post');
        });

        it('should handle pagination correctly', async () => {
            const input: BlogPostsQueryInput = {
                page: 1,
                limit: 1
            };

            const result = await getBlogPosts(input);

            expect(result.items).toHaveLength(1);
            expect(result.total).toEqual(2);
            expect(result.totalPages).toEqual(2);
        });
    });

    describe('getBlogPostById', () => {
        let blogPostId: number;

        beforeEach(async () => {
            const input = {
                ...createBlogPostInput,
                category_ids: [categoryId1],
                tag_ids: [tagId1]
            };
            const post = await createBlogPost(input, authorId);
            blogPostId = post.id;
        });

        it('should get blog post by ID with relations', async () => {
            const result = await getBlogPostById(blogPostId);

            expect(result).toBeDefined();
            expect(result!.id).toEqual(blogPostId);
            expect(result!.title).toEqual('Test Blog Post');
            expect(result!.author).toBeDefined();
            expect(result!.author.id).toEqual(authorId);
            expect(result!.categories).toHaveLength(1);
            expect(result!.tags).toHaveLength(1);
        });

        it('should return null when blog post does not exist', async () => {
            const result = await getBlogPostById(9999);

            expect(result).toBeNull();
        });
    });

    describe('getBlogPostBySlug', () => {
        let blogPostId: number;

        beforeEach(async () => {
            const input = {
                ...createBlogPostInput,
                category_ids: [categoryId1],
                tag_ids: [tagId1]
            };
            const post = await createBlogPost(input, authorId);
            blogPostId = post.id;
        });

        it('should get blog post by slug with relations', async () => {
            const result = await getBlogPostBySlug('test-blog-post');

            expect(result).toBeDefined();
            expect(result!.slug).toEqual('test-blog-post');
            expect(result!.title).toEqual('Test Blog Post');
            expect(result!.author).toBeDefined();
            expect(result!.categories).toHaveLength(1);
            expect(result!.tags).toHaveLength(1);
        });

        it('should return null when blog post does not exist', async () => {
            const result = await getBlogPostBySlug('non-existent-slug');

            expect(result).toBeNull();
        });
    });

    describe('getMyBlogPosts', () => {
        let anotherAuthorId: number;

        beforeEach(async () => {
            // Create another author
            const anotherAuthor = await db.insert(usersTable)
                .values({
                    email: 'another@test.com',
                    username: 'another',
                    password_hash: 'hash',
                    first_name: 'Another',
                    last_name: 'Author',
                    role: 'author'
                })
                .returning()
                .execute();
            anotherAuthorId = anotherAuthor[0].id;

            // Create posts for both authors
            await createBlogPost({
                ...createBlogPostInput,
                title: 'My Post 1',
                slug: 'my-post-1',
                category_ids: [categoryId1]
            }, authorId);

            await createBlogPost({
                ...createBlogPostInput,
                title: 'Another Author Post',
                slug: 'another-author-post',
                category_ids: [categoryId1]
            }, anotherAuthorId);
        });

        it('should get only posts by specific author', async () => {
            const input: BlogPostsQueryInput = {
                page: 1,
                limit: 10
            };

            const result = await getMyBlogPosts(authorId, input);

            expect(result.items).toHaveLength(1);
            expect(result.items[0].title).toEqual('My Post 1');
            expect(result.items[0].author_id).toEqual(authorId);
        });

        it('should support filtering and pagination', async () => {
            // Create another post for the same author
            await createBlogPost({
                ...createBlogPostInput,
                title: 'My Post 2',
                slug: 'my-post-2',
                status: 'published',
                category_ids: [categoryId1]
            }, authorId);

            const input: BlogPostsQueryInput = {
                page: 1,
                limit: 10,
                status: 'published'
            };

            const result = await getMyBlogPosts(authorId, input);

            expect(result.items).toHaveLength(1);
            expect(result.items[0].title).toEqual('My Post 2');
            expect(result.items[0].status).toEqual('published');
        });
    });
});
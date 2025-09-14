import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { categoriesTable, blogPostsTable, blogPostCategoriesTable, usersTable } from '../db/schema';
import { type CreateCategoryInput, type UpdateCategoryInput } from '../schema';
import { 
  createCategory, 
  updateCategory, 
  deleteCategory, 
  getCategories, 
  getCategoryById, 
  getCategoryBySlug 
} from '../handlers/categories';
import { eq } from 'drizzle-orm';

// Test data
const testCategoryInput: CreateCategoryInput = {
  name: 'Technology',
  slug: 'technology',
  description: 'All about technology trends'
};

const testCategoryInputMinimal: CreateCategoryInput = {
  name: 'Minimal Category',
  slug: 'minimal-category'
};

describe('Categories Handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('createCategory', () => {
    it('should create a category with all fields', async () => {
      const result = await createCategory(testCategoryInput);

      expect(result.name).toEqual('Technology');
      expect(result.slug).toEqual('technology');
      expect(result.description).toEqual('All about technology trends');
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should create a category with minimal fields', async () => {
      const result = await createCategory(testCategoryInputMinimal);

      expect(result.name).toEqual('Minimal Category');
      expect(result.slug).toEqual('minimal-category');
      expect(result.description).toBeNull();
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should save category to database', async () => {
      const result = await createCategory(testCategoryInput);

      const categories = await db.select()
        .from(categoriesTable)
        .where(eq(categoriesTable.id, result.id))
        .execute();

      expect(categories).toHaveLength(1);
      expect(categories[0].name).toEqual('Technology');
      expect(categories[0].slug).toEqual('technology');
      expect(categories[0].description).toEqual('All about technology trends');
    });

    it('should enforce unique slug constraint', async () => {
      await createCategory(testCategoryInput);

      const duplicateInput: CreateCategoryInput = {
        name: 'Different Name',
        slug: 'technology', // Same slug
        description: 'Different description'
      };

      await expect(createCategory(duplicateInput)).rejects.toThrow();
    });
  });

  describe('updateCategory', () => {
    let categoryId: number;

    beforeEach(async () => {
      const category = await createCategory(testCategoryInput);
      categoryId = category.id;
    });

    it('should update all fields', async () => {
      const updateInput: UpdateCategoryInput = {
        id: categoryId,
        name: 'Updated Technology',
        slug: 'updated-technology',
        description: 'Updated description about technology'
      };

      const result = await updateCategory(updateInput);

      expect(result.id).toEqual(categoryId);
      expect(result.name).toEqual('Updated Technology');
      expect(result.slug).toEqual('updated-technology');
      expect(result.description).toEqual('Updated description about technology');
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should update partial fields', async () => {
      const updateInput: UpdateCategoryInput = {
        id: categoryId,
        name: 'Partially Updated'
      };

      const result = await updateCategory(updateInput);

      expect(result.id).toEqual(categoryId);
      expect(result.name).toEqual('Partially Updated');
      expect(result.slug).toEqual('technology'); // Should remain unchanged
      expect(result.description).toEqual('All about technology trends'); // Should remain unchanged
    });

    it('should update description to null', async () => {
      const updateInput: UpdateCategoryInput = {
        id: categoryId,
        description: null
      };

      const result = await updateCategory(updateInput);

      expect(result.description).toBeNull();
    });

    it('should save updates to database', async () => {
      const updateInput: UpdateCategoryInput = {
        id: categoryId,
        name: 'Database Updated'
      };

      await updateCategory(updateInput);

      const categories = await db.select()
        .from(categoriesTable)
        .where(eq(categoriesTable.id, categoryId))
        .execute();

      expect(categories[0].name).toEqual('Database Updated');
    });

    it('should throw error for non-existent category', async () => {
      const updateInput: UpdateCategoryInput = {
        id: 99999,
        name: 'Non-existent'
      };

      await expect(updateCategory(updateInput)).rejects.toThrow(/not found/i);
    });

    it('should enforce unique slug constraint on update', async () => {
      // Create second category
      const secondCategory = await createCategory({
        name: 'Second Category',
        slug: 'second-category'
      });

      const updateInput: UpdateCategoryInput = {
        id: secondCategory.id,
        slug: 'technology' // Trying to use existing slug
      };

      await expect(updateCategory(updateInput)).rejects.toThrow();
    });
  });

  describe('deleteCategory', () => {
    let categoryId: number;

    beforeEach(async () => {
      const category = await createCategory(testCategoryInput);
      categoryId = category.id;
    });

    it('should delete category', async () => {
      const result = await deleteCategory(categoryId);

      expect(result.success).toBe(true);

      // Verify category is deleted
      const categories = await db.select()
        .from(categoriesTable)
        .where(eq(categoriesTable.id, categoryId))
        .execute();

      expect(categories).toHaveLength(0);
    });

    it('should remove category associations from blog posts', async () => {
      // Create test user first
      const userResult = await db.insert(usersTable)
        .values({
          email: 'test@example.com',
          username: 'testuser',
          password_hash: 'hashedpassword',
          first_name: 'Test',
          last_name: 'User',
          role: 'author'
        })
        .returning()
        .execute();

      const userId = userResult[0].id;

      // Create blog post
      const blogPostResult = await db.insert(blogPostsTable)
        .values({
          title: 'Test Post',
          slug: 'test-post',
          content: 'Test content',
          author_id: userId,
          status: 'draft'
        })
        .returning()
        .execute();

      const blogPostId = blogPostResult[0].id;

      // Create association
      await db.insert(blogPostCategoriesTable)
        .values({
          blog_post_id: blogPostId,
          category_id: categoryId
        })
        .execute();

      // Delete category
      await deleteCategory(categoryId);

      // Verify associations are removed
      const associations = await db.select()
        .from(blogPostCategoriesTable)
        .where(eq(blogPostCategoriesTable.category_id, categoryId))
        .execute();

      expect(associations).toHaveLength(0);
    });

    it('should throw error for non-existent category', async () => {
      await expect(deleteCategory(99999)).rejects.toThrow(/not found/i);
    });
  });

  describe('getCategories', () => {
    it('should return empty array when no categories exist', async () => {
      const result = await getCategories();
      expect(result).toHaveLength(0);
    });

    it('should return all categories ordered by name', async () => {
      // Create multiple categories
      await createCategory({ name: 'Zebra', slug: 'zebra' });
      await createCategory({ name: 'Alpha', slug: 'alpha' });
      await createCategory({ name: 'Beta', slug: 'beta' });

      const result = await getCategories();

      expect(result).toHaveLength(3);
      expect(result[0].name).toEqual('Alpha');
      expect(result[1].name).toEqual('Beta');
      expect(result[2].name).toEqual('Zebra');
    });

    it('should return categories with all fields', async () => {
      await createCategory(testCategoryInput);

      const result = await getCategories();

      expect(result).toHaveLength(1);
      expect(result[0].name).toEqual('Technology');
      expect(result[0].slug).toEqual('technology');
      expect(result[0].description).toEqual('All about technology trends');
      expect(result[0].id).toBeDefined();
      expect(result[0].created_at).toBeInstanceOf(Date);
      expect(result[0].updated_at).toBeInstanceOf(Date);
    });
  });

  describe('getCategoryById', () => {
    let categoryId: number;

    beforeEach(async () => {
      const category = await createCategory(testCategoryInput);
      categoryId = category.id;
    });

    it('should return category by id', async () => {
      const result = await getCategoryById(categoryId);

      expect(result).not.toBeNull();
      expect(result!.id).toEqual(categoryId);
      expect(result!.name).toEqual('Technology');
      expect(result!.slug).toEqual('technology');
      expect(result!.description).toEqual('All about technology trends');
    });

    it('should return null for non-existent id', async () => {
      const result = await getCategoryById(99999);
      expect(result).toBeNull();
    });
  });

  describe('getCategoryBySlug', () => {
    beforeEach(async () => {
      await createCategory(testCategoryInput);
    });

    it('should return category by slug', async () => {
      const result = await getCategoryBySlug('technology');

      expect(result).not.toBeNull();
      expect(result!.name).toEqual('Technology');
      expect(result!.slug).toEqual('technology');
      expect(result!.description).toEqual('All about technology trends');
    });

    it('should return null for non-existent slug', async () => {
      const result = await getCategoryBySlug('non-existent');
      expect(result).toBeNull();
    });

    it('should be case sensitive', async () => {
      const result = await getCategoryBySlug('TECHNOLOGY');
      expect(result).toBeNull();
    });
  });
});
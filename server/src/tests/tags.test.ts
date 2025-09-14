import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { tagsTable, usersTable, blogPostsTable, blogPostTagsTable } from '../db/schema';
import { type CreateTagInput, type UpdateTagInput } from '../schema';
import { 
  createTag, 
  updateTag, 
  deleteTag, 
  getTags, 
  getTagById, 
  getTagBySlug 
} from '../handlers/tags';
import { eq } from 'drizzle-orm';

// Test inputs
const testCreateTagInput: CreateTagInput = {
  name: 'Technology',
  slug: 'technology'
};

const testUpdateTagInput: UpdateTagInput = {
  id: 1,
  name: 'Updated Technology',
  slug: 'updated-technology'
};

describe('Tag Handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('createTag', () => {
    it('should create a tag successfully', async () => {
      const result = await createTag(testCreateTagInput);

      expect(result.id).toBeDefined();
      expect(result.name).toEqual('Technology');
      expect(result.slug).toEqual('technology');
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should save tag to database', async () => {
      const result = await createTag(testCreateTagInput);

      const tagsInDb = await db.select()
        .from(tagsTable)
        .where(eq(tagsTable.id, result.id))
        .execute();

      expect(tagsInDb).toHaveLength(1);
      expect(tagsInDb[0].name).toEqual('Technology');
      expect(tagsInDb[0].slug).toEqual('technology');
    });

    it('should throw error for duplicate slug', async () => {
      await createTag(testCreateTagInput);

      const duplicateInput: CreateTagInput = {
        name: 'Different Name',
        slug: 'technology' // Same slug
      };

      await expect(createTag(duplicateInput)).rejects.toThrow();
    });
  });

  describe('updateTag', () => {
    it('should update tag successfully', async () => {
      const createdTag = await createTag(testCreateTagInput);
      
      const updateInput: UpdateTagInput = {
        id: createdTag.id,
        name: 'Updated Technology',
        slug: 'updated-technology'
      };

      const result = await updateTag(updateInput);

      expect(result.id).toEqual(createdTag.id);
      expect(result.name).toEqual('Updated Technology');
      expect(result.slug).toEqual('updated-technology');
      expect(result.updated_at.getTime()).toBeGreaterThan(createdTag.updated_at.getTime());
    });

    it('should update only provided fields', async () => {
      const createdTag = await createTag(testCreateTagInput);
      
      const updateInput: UpdateTagInput = {
        id: createdTag.id,
        name: 'Only Name Updated'
      };

      const result = await updateTag(updateInput);

      expect(result.name).toEqual('Only Name Updated');
      expect(result.slug).toEqual('technology'); // Should remain unchanged
    });

    it('should throw error for non-existent tag', async () => {
      const updateInput: UpdateTagInput = {
        id: 999,
        name: 'Non-existent'
      };

      await expect(updateTag(updateInput)).rejects.toThrow(/not found/i);
    });

    it('should throw error for duplicate slug during update', async () => {
      const tag1 = await createTag({ name: 'Tag 1', slug: 'tag-1' });
      const tag2 = await createTag({ name: 'Tag 2', slug: 'tag-2' });

      const updateInput: UpdateTagInput = {
        id: tag2.id,
        slug: 'tag-1' // Duplicate slug
      };

      await expect(updateTag(updateInput)).rejects.toThrow();
    });
  });

  describe('deleteTag', () => {
    it('should delete tag successfully', async () => {
      const createdTag = await createTag(testCreateTagInput);

      const result = await deleteTag(createdTag.id);

      expect(result.success).toBe(true);

      // Verify tag is removed from database
      const tagsInDb = await db.select()
        .from(tagsTable)
        .where(eq(tagsTable.id, createdTag.id))
        .execute();

      expect(tagsInDb).toHaveLength(0);
    });

    it('should remove tag associations from blog posts', async () => {
      // Create test data
      const user = await db.insert(usersTable)
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

      const tag = await createTag(testCreateTagInput);

      const blogPost = await db.insert(blogPostsTable)
        .values({
          title: 'Test Post',
          slug: 'test-post',
          content: 'Test content',
          author_id: user[0].id,
          status: 'draft'
        })
        .returning()
        .execute();

      // Create tag association
      await db.insert(blogPostTagsTable)
        .values({
          blog_post_id: blogPost[0].id,
          tag_id: tag.id
        })
        .execute();

      // Delete tag
      const result = await deleteTag(tag.id);

      expect(result.success).toBe(true);

      // Verify associations are removed
      const associations = await db.select()
        .from(blogPostTagsTable)
        .where(eq(blogPostTagsTable.tag_id, tag.id))
        .execute();

      expect(associations).toHaveLength(0);
    });

    it('should throw error for non-existent tag', async () => {
      await expect(deleteTag(999)).rejects.toThrow(/not found/i);
    });
  });

  describe('getTags', () => {
    it('should return empty array when no tags exist', async () => {
      const result = await getTags();

      expect(result).toEqual([]);
    });

    it('should return all tags ordered by name', async () => {
      await createTag({ name: 'Zebra', slug: 'zebra' });
      await createTag({ name: 'Apple', slug: 'apple' });
      await createTag({ name: 'Banana', slug: 'banana' });

      const result = await getTags();

      expect(result).toHaveLength(3);
      expect(result[0].name).toEqual('Apple');
      expect(result[1].name).toEqual('Banana');
      expect(result[2].name).toEqual('Zebra');
    });
  });

  describe('getTagById', () => {
    it('should return tag when found', async () => {
      const createdTag = await createTag(testCreateTagInput);

      const result = await getTagById(createdTag.id);

      expect(result).not.toBeNull();
      expect(result!.id).toEqual(createdTag.id);
      expect(result!.name).toEqual('Technology');
      expect(result!.slug).toEqual('technology');
    });

    it('should return null when tag not found', async () => {
      const result = await getTagById(999);

      expect(result).toBeNull();
    });
  });

  describe('getTagBySlug', () => {
    it('should return tag when found', async () => {
      const createdTag = await createTag(testCreateTagInput);

      const result = await getTagBySlug('technology');

      expect(result).not.toBeNull();
      expect(result!.id).toEqual(createdTag.id);
      expect(result!.name).toEqual('Technology');
      expect(result!.slug).toEqual('technology');
    });

    it('should return null when tag not found', async () => {
      const result = await getTagBySlug('non-existent');

      expect(result).toBeNull();
    });

    it('should handle slug case sensitivity', async () => {
      await createTag({ name: 'Test', slug: 'test-slug' });

      const result = await getTagBySlug('Test-Slug');

      expect(result).toBeNull(); // Should be case sensitive
    });
  });
});
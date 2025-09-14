import { db } from '../db';
import { tagsTable, blogPostTagsTable } from '../db/schema';
import { type CreateTagInput, type UpdateTagInput, type Tag } from '../schema';
import { eq } from 'drizzle-orm';

export async function createTag(input: CreateTagInput): Promise<Tag> {
  try {
    const result = await db.insert(tagsTable)
      .values({
        name: input.name,
        slug: input.slug
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Tag creation failed:', error);
    throw error;
  }
}

export async function updateTag(input: UpdateTagInput): Promise<Tag> {
  try {
    const updateData: Partial<typeof tagsTable.$inferInsert> = {
      updated_at: new Date()
    };

    if (input.name !== undefined) {
      updateData.name = input.name;
    }

    if (input.slug !== undefined) {
      updateData.slug = input.slug;
    }

    const result = await db.update(tagsTable)
      .set(updateData)
      .where(eq(tagsTable.id, input.id))
      .returning()
      .execute();

    if (result.length === 0) {
      throw new Error(`Tag with id ${input.id} not found`);
    }

    return result[0];
  } catch (error) {
    console.error('Tag update failed:', error);
    throw error;
  }
}

export async function deleteTag(tagId: number): Promise<{ success: boolean }> {
  try {
    // First delete all blog post associations
    await db.delete(blogPostTagsTable)
      .where(eq(blogPostTagsTable.tag_id, tagId))
      .execute();

    // Then delete the tag itself
    const result = await db.delete(tagsTable)
      .where(eq(tagsTable.id, tagId))
      .returning()
      .execute();

    if (result.length === 0) {
      throw new Error(`Tag with id ${tagId} not found`);
    }

    return { success: true };
  } catch (error) {
    console.error('Tag deletion failed:', error);
    throw error;
  }
}

export async function getTags(): Promise<Tag[]> {
  try {
    const result = await db.select()
      .from(tagsTable)
      .orderBy(tagsTable.name)
      .execute();

    return result;
  } catch (error) {
    console.error('Get tags failed:', error);
    throw error;
  }
}

export async function getTagById(tagId: number): Promise<Tag | null> {
  try {
    const result = await db.select()
      .from(tagsTable)
      .where(eq(tagsTable.id, tagId))
      .execute();

    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error('Get tag by ID failed:', error);
    throw error;
  }
}

export async function getTagBySlug(slug: string): Promise<Tag | null> {
  try {
    const result = await db.select()
      .from(tagsTable)
      .where(eq(tagsTable.slug, slug))
      .execute();

    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error('Get tag by slug failed:', error);
    throw error;
  }
}
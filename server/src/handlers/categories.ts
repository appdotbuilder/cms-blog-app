import { db } from '../db';
import { categoriesTable, blogPostCategoriesTable } from '../db/schema';
import { type CreateCategoryInput, type UpdateCategoryInput, type Category } from '../schema';
import { eq, SQL } from 'drizzle-orm';

export async function createCategory(input: CreateCategoryInput): Promise<Category> {
  try {
    // Insert category record
    const result = await db.insert(categoriesTable)
      .values({
        name: input.name,
        slug: input.slug,
        description: input.description || null
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Category creation failed:', error);
    throw error;
  }
}

export async function updateCategory(input: UpdateCategoryInput): Promise<Category> {
  try {
    // Build update object dynamically
    const updateData: Partial<typeof categoriesTable.$inferInsert> = {
      updated_at: new Date()
    };

    if (input.name !== undefined) {
      updateData.name = input.name;
    }
    if (input.slug !== undefined) {
      updateData.slug = input.slug;
    }
    if (input.description !== undefined) {
      updateData.description = input.description;
    }

    // Update category record
    const result = await db.update(categoriesTable)
      .set(updateData)
      .where(eq(categoriesTable.id, input.id))
      .returning()
      .execute();

    if (result.length === 0) {
      throw new Error(`Category with id ${input.id} not found`);
    }

    return result[0];
  } catch (error) {
    console.error('Category update failed:', error);
    throw error;
  }
}

export async function deleteCategory(categoryId: number): Promise<{ success: boolean }> {
  try {
    // First, remove all category associations from blog posts
    await db.delete(blogPostCategoriesTable)
      .where(eq(blogPostCategoriesTable.category_id, categoryId))
      .execute();

    // Then delete the category
    const result = await db.delete(categoriesTable)
      .where(eq(categoriesTable.id, categoryId))
      .returning({ id: categoriesTable.id })
      .execute();

    if (result.length === 0) {
      throw new Error(`Category with id ${categoryId} not found`);
    }

    return { success: true };
  } catch (error) {
    console.error('Category deletion failed:', error);
    throw error;
  }
}

export async function getCategories(): Promise<Category[]> {
  try {
    const result = await db.select()
      .from(categoriesTable)
      .orderBy(categoriesTable.name)
      .execute();

    return result;
  } catch (error) {
    console.error('Categories retrieval failed:', error);
    throw error;
  }
}

export async function getCategoryById(categoryId: number): Promise<Category | null> {
  try {
    const result = await db.select()
      .from(categoriesTable)
      .where(eq(categoriesTable.id, categoryId))
      .execute();

    return result[0] || null;
  } catch (error) {
    console.error('Category retrieval by id failed:', error);
    throw error;
  }
}

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  try {
    const result = await db.select()
      .from(categoriesTable)
      .where(eq(categoriesTable.slug, slug))
      .execute();

    return result[0] || null;
  } catch (error) {
    console.error('Category retrieval by slug failed:', error);
    throw error;
  }
}
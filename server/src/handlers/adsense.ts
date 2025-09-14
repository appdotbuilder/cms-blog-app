import { db } from '../db';
import { adSenseConfigTable } from '../db/schema';
import { type UpdateAdSenseConfigInput, type AdSenseConfig } from '../schema';

export async function getAdSenseConfig(): Promise<AdSenseConfig | null> {
  try {
    const results = await db.select()
      .from(adSenseConfigTable)
      .limit(1)
      .execute();

    if (results.length === 0) {
      return null;
    }

    return results[0];
  } catch (error) {
    console.error('Failed to fetch AdSense config:', error);
    throw error;
  }
}

export async function updateAdSenseConfig(input: UpdateAdSenseConfigInput): Promise<AdSenseConfig> {
  try {
    // Check if config already exists
    const existingConfig = await getAdSenseConfig();

    if (existingConfig) {
      // Update existing config
      const results = await db.update(adSenseConfigTable)
        .set({
          publisher_id: input.publisher_id,
          ad_slot_header: input.ad_slot_header ?? null,
          ad_slot_sidebar: input.ad_slot_sidebar ?? null,
          ad_slot_footer: input.ad_slot_footer ?? null,
          ad_slot_in_content: input.ad_slot_in_content ?? null,
          is_enabled: input.is_enabled,
          updated_at: new Date()
        })
        .returning()
        .execute();

      return results[0];
    } else {
      // Create new config
      const results = await db.insert(adSenseConfigTable)
        .values({
          publisher_id: input.publisher_id,
          ad_slot_header: input.ad_slot_header ?? null,
          ad_slot_sidebar: input.ad_slot_sidebar ?? null,
          ad_slot_footer: input.ad_slot_footer ?? null,
          ad_slot_in_content: input.ad_slot_in_content ?? null,
          is_enabled: input.is_enabled
        })
        .returning()
        .execute();

      return results[0];
    }
  } catch (error) {
    console.error('Failed to update AdSense config:', error);
    throw error;
  }
}

export async function getPublicAdSenseConfig(): Promise<{
  ad_slot_header: string | null;
  ad_slot_sidebar: string | null;
  ad_slot_footer: string | null;
  ad_slot_in_content: string | null;
  is_enabled: boolean;
} | null> {
  try {
    const config = await getAdSenseConfig();

    if (!config) {
      return null;
    }

    // Return only public fields, excluding sensitive publisher_id
    return {
      ad_slot_header: config.ad_slot_header,
      ad_slot_sidebar: config.ad_slot_sidebar,
      ad_slot_footer: config.ad_slot_footer,
      ad_slot_in_content: config.ad_slot_in_content,
      is_enabled: config.is_enabled
    };
  } catch (error) {
    console.error('Failed to fetch public AdSense config:', error);
    throw error;
  }
}
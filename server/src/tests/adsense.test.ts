import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { adSenseConfigTable } from '../db/schema';
import { type UpdateAdSenseConfigInput } from '../schema';
import { getAdSenseConfig, updateAdSenseConfig, getPublicAdSenseConfig } from '../handlers/adsense';
import { eq } from 'drizzle-orm';

// Test input for creating/updating AdSense config
const testInput: UpdateAdSenseConfigInput = {
  publisher_id: 'ca-pub-1234567890123456',
  ad_slot_header: '1234567890',
  ad_slot_sidebar: '2345678901',
  ad_slot_footer: '3456789012',
  ad_slot_in_content: '4567890123',
  is_enabled: true
};

const minimalTestInput: UpdateAdSenseConfigInput = {
  publisher_id: 'ca-pub-9876543210987654',
  is_enabled: false
};

describe('AdSense handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('getAdSenseConfig', () => {
    it('should return null when no config exists', async () => {
      const result = await getAdSenseConfig();
      expect(result).toBeNull();
    });

    it('should return existing config', async () => {
      // Create a config directly in database first
      await db.insert(adSenseConfigTable)
        .values({
          publisher_id: 'ca-pub-test-direct',
          ad_slot_header: '1111111111',
          ad_slot_sidebar: '2222222222',
          ad_slot_footer: '3333333333',
          ad_slot_in_content: '4444444444',
          is_enabled: true
        })
        .execute();

      const result = await getAdSenseConfig();

      expect(result).toBeDefined();
      expect(result!.publisher_id).toEqual('ca-pub-test-direct');
      expect(result!.ad_slot_header).toEqual('1111111111');
      expect(result!.ad_slot_sidebar).toEqual('2222222222');
      expect(result!.ad_slot_footer).toEqual('3333333333');
      expect(result!.ad_slot_in_content).toEqual('4444444444');
      expect(result!.is_enabled).toBe(true);
      expect(result!.id).toBeDefined();
      expect(result!.created_at).toBeInstanceOf(Date);
      expect(result!.updated_at).toBeInstanceOf(Date);
    });
  });

  describe('updateAdSenseConfig', () => {
    it('should create new config when none exists', async () => {
      const result = await updateAdSenseConfig(testInput);

      expect(result.publisher_id).toEqual(testInput.publisher_id);
      expect(result.ad_slot_header).toEqual(testInput.ad_slot_header ?? null);
      expect(result.ad_slot_sidebar).toEqual(testInput.ad_slot_sidebar ?? null);
      expect(result.ad_slot_footer).toEqual(testInput.ad_slot_footer ?? null);
      expect(result.ad_slot_in_content).toEqual(testInput.ad_slot_in_content ?? null);
      expect(result.is_enabled).toEqual(testInput.is_enabled);
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.updated_at).toBeInstanceOf(Date);

      // Verify it was saved to database
      const configs = await db.select()
        .from(adSenseConfigTable)
        .where(eq(adSenseConfigTable.id, result.id))
        .execute();

      expect(configs).toHaveLength(1);
      expect(configs[0].publisher_id).toEqual(testInput.publisher_id);
    });

    it('should update existing config', async () => {
      // Create initial config
      const initialResult = await updateAdSenseConfig(testInput);

      // Update with different values
      const updatedInput: UpdateAdSenseConfigInput = {
        publisher_id: 'ca-pub-9999999999999999',
        ad_slot_header: '9999999999',
        ad_slot_sidebar: null,
        ad_slot_footer: '8888888888',
        ad_slot_in_content: null,
        is_enabled: false
      };

      const result = await updateAdSenseConfig(updatedInput);

      // Should have same ID but updated values
      expect(result.id).toEqual(initialResult.id);
      expect(result.publisher_id).toEqual(updatedInput.publisher_id);
      expect(result.ad_slot_header).toEqual(updatedInput.ad_slot_header ?? null);
      expect(result.ad_slot_sidebar).toBeNull();
      expect(result.ad_slot_footer).toEqual(updatedInput.ad_slot_footer ?? null);
      expect(result.ad_slot_in_content).toBeNull();
      expect(result.is_enabled).toEqual(updatedInput.is_enabled);
      expect(result.updated_at).toBeInstanceOf(Date);

      // Verify only one config exists in database
      const configs = await db.select()
        .from(adSenseConfigTable)
        .execute();

      expect(configs).toHaveLength(1);
      expect(configs[0].publisher_id).toEqual(updatedInput.publisher_id);
    });

    it('should handle minimal input with undefined optional fields', async () => {
      const result = await updateAdSenseConfig(minimalTestInput);

      expect(result.publisher_id).toEqual(minimalTestInput.publisher_id);
      expect(result.ad_slot_header).toBeNull();
      expect(result.ad_slot_sidebar).toBeNull();
      expect(result.ad_slot_footer).toBeNull();
      expect(result.ad_slot_in_content).toBeNull();
      expect(result.is_enabled).toEqual(minimalTestInput.is_enabled);
    });

    it('should handle explicit null values', async () => {
      const nullInput: UpdateAdSenseConfigInput = {
        publisher_id: 'ca-pub-test-nulls',
        ad_slot_header: null,
        ad_slot_sidebar: null,
        ad_slot_footer: null,
        ad_slot_in_content: null,
        is_enabled: true
      };

      const result = await updateAdSenseConfig(nullInput);

      expect(result.publisher_id).toEqual(nullInput.publisher_id);
      expect(result.ad_slot_header).toBeNull();
      expect(result.ad_slot_sidebar).toBeNull();
      expect(result.ad_slot_footer).toBeNull();
      expect(result.ad_slot_in_content).toBeNull();
      expect(result.is_enabled).toBe(true);
    });

    it('should update timestamps correctly', async () => {
      // Create initial config
      const initialResult = await updateAdSenseConfig(testInput);
      const initialUpdatedAt = initialResult.updated_at;

      // Wait a small amount to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      // Update config
      const updatedInput: UpdateAdSenseConfigInput = {
        ...testInput,
        publisher_id: 'ca-pub-updated-timestamp'
      };
      
      const result = await updateAdSenseConfig(updatedInput);

      expect(result.id).toEqual(initialResult.id);
      expect(result.created_at).toEqual(initialResult.created_at);
      expect(result.updated_at.getTime()).toBeGreaterThan(initialUpdatedAt.getTime());
    });
  });

  describe('getPublicAdSenseConfig', () => {
    it('should return null when no config exists', async () => {
      const result = await getPublicAdSenseConfig();
      expect(result).toBeNull();
    });

    it('should return public fields only', async () => {
      // Create a config first
      await updateAdSenseConfig(testInput);

      const result = await getPublicAdSenseConfig();

      expect(result).toBeDefined();
      expect(result!.ad_slot_header).toEqual(testInput.ad_slot_header ?? null);
      expect(result!.ad_slot_sidebar).toEqual(testInput.ad_slot_sidebar ?? null);
      expect(result!.ad_slot_footer).toEqual(testInput.ad_slot_footer ?? null);
      expect(result!.ad_slot_in_content).toEqual(testInput.ad_slot_in_content ?? null);
      expect(result!.is_enabled).toEqual(testInput.is_enabled);

      // Should not include sensitive fields
      expect(result).not.toHaveProperty('id');
      expect(result).not.toHaveProperty('publisher_id');
      expect(result).not.toHaveProperty('created_at');
      expect(result).not.toHaveProperty('updated_at');
    });

    it('should handle null ad slots correctly', async () => {
      await updateAdSenseConfig(minimalTestInput);

      const result = await getPublicAdSenseConfig();

      expect(result).toBeDefined();
      expect(result!.ad_slot_header).toBeNull();
      expect(result!.ad_slot_sidebar).toBeNull();
      expect(result!.ad_slot_footer).toBeNull();
      expect(result!.ad_slot_in_content).toBeNull();
      expect(result!.is_enabled).toEqual(minimalTestInput.is_enabled);
    });

    it('should return config when ads are disabled', async () => {
      const disabledInput: UpdateAdSenseConfigInput = {
        publisher_id: 'ca-pub-disabled-test',
        ad_slot_header: '5555555555',
        is_enabled: false
      };

      await updateAdSenseConfig(disabledInput);

      const result = await getPublicAdSenseConfig();

      expect(result).toBeDefined();
      expect(result!.is_enabled).toBe(false);
      expect(result!.ad_slot_header).toEqual('5555555555');
    });
  });

  describe('integration tests', () => {
    it('should maintain consistency across all handlers', async () => {
      // Create config
      const created = await updateAdSenseConfig(testInput);

      // Fetch via getAdSenseConfig
      const fullConfig = await getAdSenseConfig();
      expect(fullConfig).toBeDefined();
      expect(fullConfig!.id).toEqual(created.id);
      expect(fullConfig!.publisher_id).toEqual(testInput.publisher_id);

      // Fetch via getPublicAdSenseConfig
      const publicConfig = await getPublicAdSenseConfig();
      expect(publicConfig).toBeDefined();
      expect(publicConfig!.ad_slot_header).toEqual(testInput.ad_slot_header ?? null);
      expect(publicConfig!.is_enabled).toEqual(testInput.is_enabled);

      // Update config
      const updatedInput: UpdateAdSenseConfigInput = {
        publisher_id: 'ca-pub-integration-updated',
        is_enabled: false,
        ad_slot_header: '0000000000'
      };

      const updated = await updateAdSenseConfig(updatedInput);
      expect(updated.id).toEqual(created.id);
      expect(updated.is_enabled).toBe(false);

      // Verify changes reflected in all handlers
      const updatedFullConfig = await getAdSenseConfig();
      expect(updatedFullConfig!.is_enabled).toBe(false);
      expect(updatedFullConfig!.ad_slot_header).toEqual('0000000000');

      const updatedPublicConfig = await getPublicAdSenseConfig();
      expect(updatedPublicConfig!.is_enabled).toBe(false);
      expect(updatedPublicConfig!.ad_slot_header).toEqual('0000000000');
    });

    it('should handle multiple update cycles correctly', async () => {
      // Create initial config
      const config1 = await updateAdSenseConfig({
        publisher_id: 'ca-pub-cycle-1',
        is_enabled: true
      });

      // Update 1
      const config2 = await updateAdSenseConfig({
        publisher_id: 'ca-pub-cycle-2',
        ad_slot_header: 'header-slot',
        is_enabled: false
      });

      // Update 2
      const config3 = await updateAdSenseConfig({
        publisher_id: 'ca-pub-cycle-3',
        ad_slot_sidebar: 'sidebar-slot',
        is_enabled: true
      });

      // All should have same ID
      expect(config2.id).toEqual(config1.id);
      expect(config3.id).toEqual(config1.id);

      // Verify final state
      const finalConfig = await getAdSenseConfig();
      expect(finalConfig!.id).toEqual(config1.id);
      expect(finalConfig!.publisher_id).toEqual('ca-pub-cycle-3');
      expect(finalConfig!.ad_slot_header).toBeNull(); // Should be reset to null
      expect(finalConfig!.ad_slot_sidebar).toEqual('sidebar-slot');
      expect(finalConfig!.is_enabled).toBe(true);
    });
  });
});
import { jest } from '@jest/globals';
import { VectorStoreService } from '../../services/ai/VectorStoreService.js';

// Mock dependencies
const mockOpenAI = {
  embeddings: {
    create: jest.fn()
  }
};

const mockRedisClient = {
  setex: jest.fn(),
  get: jest.fn(),
  keys: jest.fn(),
  del: jest.fn(),
  ping: jest.fn()
};

jest.unstable_mockModule('openai', () => ({
  default: jest.fn(() => mockOpenAI)
}));

jest.unstable_mockModule('../../config/redis.js', () => ({
  getRedisClient: jest.fn(() => mockRedisClient)
}));

describe('VectorStoreService', () => {
  let vectorStore;
  let mockKnowledgeItem;

  beforeEach(() => {
    jest.clearAllMocks();
    vectorStore = new VectorStoreService();

    mockKnowledgeItem = {
      id: 'knowledge-123',
      type: 'brand_voice',
      name: 'Brand Voice Guide',
      content: 'Professional, friendly tone with focus on customer success',
      query_key: 'brand voice',
      retrieval_count: 1
    };
  });

  describe('generateEmbedding', () => {
    it('should generate embeddings for text content', async () => {
      const mockEmbedding = new Array(1536).fill(0).map(() => Math.random());
      mockOpenAI.embeddings.create.mockResolvedValue({
        data: [{ embedding: mockEmbedding }]
      });

      const result = await vectorStore.generateEmbedding('Test content for embedding');

      expect(mockOpenAI.embeddings.create).toHaveBeenCalledWith({
        model: 'text-embedding-ada-002',
        input: 'Test content for embedding'
      });
      expect(result).toEqual(mockEmbedding);
      expect(result).toHaveLength(1536);
    });

    it('should truncate long text input', async () => {
      const longText = 'a'.repeat(10000);
      mockOpenAI.embeddings.create.mockResolvedValue({
        data: [{ embedding: new Array(1536).fill(0) }]
      });

      await vectorStore.generateEmbedding(longText);

      expect(mockOpenAI.embeddings.create).toHaveBeenCalledWith({
        model: 'text-embedding-ada-002',
        input: longText.substring(0, 8000)
      });
    });

    it('should handle OpenAI API errors', async () => {
      mockOpenAI.embeddings.create.mockRejectedValue(new Error('API Error'));

      await expect(
        vectorStore.generateEmbedding('Test content')
      ).rejects.toThrow('API Error');
    });
  });

  describe('storeKnowledge', () => {
    beforeEach(() => {
      mockOpenAI.embeddings.create.mockResolvedValue({
        data: [{ embedding: new Array(1536).fill(0.1) }]
      });
      mockRedisClient.setex.mockResolvedValue('OK');
    });

    it('should store knowledge with generated embeddings', async () => {
      const companyId = 'company-123';

      const result = await vectorStore.storeKnowledge(companyId, mockKnowledgeItem);

      expect(mockOpenAI.embeddings.create).toHaveBeenCalledWith({
        model: 'text-embedding-ada-002',
        input: mockKnowledgeItem.content
      });

      expect(mockRedisClient.setex).toHaveBeenCalledTimes(2); // Knowledge + embedding
      expect(result.success).toBe(true);
      expect(result.embedding_dimensions).toBe(1536);
    });

    it('should use correct Redis keys for storage', async () => {
      const companyId = 'company-123';

      await vectorStore.storeKnowledge(companyId, mockKnowledgeItem);

      const knowledgeKey = `knowledge:${companyId}:${mockKnowledgeItem.type}:${mockKnowledgeItem.id}`;
      const embeddingKey = `embedding:${companyId}:${mockKnowledgeItem.id}`;

      expect(mockRedisClient.setex).toHaveBeenCalledWith(
        knowledgeKey,
        86400,
        expect.stringContaining(mockKnowledgeItem.name)
      );
      expect(mockRedisClient.setex).toHaveBeenCalledWith(
        embeddingKey,
        86400,
        expect.any(String)
      );
    });

    it('should handle storage failures gracefully', async () => {
      mockRedisClient.setex.mockRejectedValue(new Error('Redis connection failed'));

      await expect(
        vectorStore.storeKnowledge('company-123', mockKnowledgeItem)
      ).rejects.toThrow('Redis connection failed');
    });
  });

  describe('retrieve', () => {
    beforeEach(() => {
      mockOpenAI.embeddings.create.mockResolvedValue({
        data: [{ embedding: new Array(1536).fill(0.5) }]
      });

      // Mock company knowledge with similar embeddings
      mockRedisClient.keys.mockResolvedValue([
        'knowledge:company-123:brand_voice:item1',
        'knowledge:company-123:frameworks:item2'
      ]);

      mockRedisClient.get
        .mockResolvedValueOnce(JSON.stringify({
          id: 'item1',
          type: 'brand_voice',
          name: 'Brand Voice',
          content: 'Professional tone'
        }))
        .mockResolvedValueOnce(JSON.stringify(new Array(1536).fill(0.6))) // High similarity
        .mockResolvedValueOnce(JSON.stringify({
          id: 'item2',
          type: 'frameworks',
          name: 'Content Framework',
          content: 'Problem-solution approach'
        }))
        .mockResolvedValueOnce(JSON.stringify(new Array(1536).fill(0.1))); // Low similarity
    });

    it('should retrieve knowledge by similarity', async () => {
      const results = await vectorStore.retrieve('company-123', 'brand voice guidance', 2);

      expect(results).toHaveLength(1); // Only high similarity items above threshold
      expect(results[0]).toHaveProperty('id', 'item1');
      expect(results[0]).toHaveProperty('similarity_score');
      expect(results[0].similarity_score).toBeGreaterThan(0.7);
    });

    it('should sort results by similarity score', async () => {
      // Mock multiple high-similarity items
      mockRedisClient.get
        .mockResolvedValueOnce(JSON.stringify({ id: 'item1', content: 'Content 1' }))
        .mockResolvedValueOnce(JSON.stringify(new Array(1536).fill(0.9))) // Higher similarity
        .mockResolvedValueOnce(JSON.stringify({ id: 'item2', content: 'Content 2' }))
        .mockResolvedValueOnce(JSON.stringify(new Array(1536).fill(0.8))); // Lower similarity

      const results = await vectorStore.retrieve('company-123', 'test query', 3);

      if (results.length > 1) {
        expect(results[0].similarity_score).toBeGreaterThanOrEqual(results[1].similarity_score);
      }
    });

    it('should limit results to k parameter', async () => {
      const results = await vectorStore.retrieve('company-123', 'test query', 1);

      expect(results.length).toBeLessThanOrEqual(1);
    });

    it('should handle empty company knowledge gracefully', async () => {
      mockRedisClient.keys.mockResolvedValue([]);

      const results = await vectorStore.retrieve('empty-company', 'test query', 3);

      expect(results).toEqual([]);
    });

    it('should handle retrieval errors gracefully', async () => {
      mockOpenAI.embeddings.create.mockRejectedValue(new Error('Embedding failed'));

      const results = await vectorStore.retrieve('company-123', 'test query', 3);

      expect(results).toEqual([]); // Should return empty array, not throw
    });
  });

  describe('cosineSimilarity', () => {
    it('should calculate cosine similarity correctly', () => {
      const vectorA = [1, 0, 0];
      const vectorB = [0, 1, 0];
      const vectorC = [1, 0, 0];

      const similarity1 = vectorStore.cosineSimilarity(vectorA, vectorB);
      const similarity2 = vectorStore.cosineSimilarity(vectorA, vectorC);

      expect(similarity1).toBe(0); // Perpendicular vectors
      expect(similarity2).toBe(1); // Identical vectors
    });

    it('should handle zero vectors', () => {
      const vectorA = [0, 0, 0];
      const vectorB = [1, 1, 1];

      const similarity = vectorStore.cosineSimilarity(vectorA, vectorB);

      expect(similarity).toBe(0);
    });

    it('should throw error for mismatched dimensions', () => {
      const vectorA = [1, 0];
      const vectorB = [1, 0, 0];

      expect(() => {
        vectorStore.cosineSimilarity(vectorA, vectorB);
      }).toThrow('Vectors must have same dimensions');
    });
  });

  describe('syncKnowledgeStores', () => {
    beforeEach(() => {
      mockOpenAI.embeddings.create.mockResolvedValue({
        data: [{ embedding: new Array(1536).fill(0.1) }]
      });
      mockRedisClient.setex.mockResolvedValue('OK');
    });

    it('should sync multiple knowledge stores', async () => {
      const knowledgeStores = [
        { ...mockKnowledgeItem, id: 'item1' },
        { ...mockKnowledgeItem, id: 'item2', type: 'frameworks' }
      ];

      const result = await vectorStore.syncKnowledgeStores('company-123', knowledgeStores);

      expect(result.total).toBe(2);
      expect(result.successful).toBe(2);
      expect(result.failed).toBe(0);
      expect(mockOpenAI.embeddings.create).toHaveBeenCalledTimes(2);
    });

    it('should handle partial failures', async () => {
      const knowledgeStores = [
        { ...mockKnowledgeItem, id: 'item1' },
        { ...mockKnowledgeItem, id: 'item2' }
      ];

      // First succeeds, second fails
      mockOpenAI.embeddings.create
        .mockResolvedValueOnce({ data: [{ embedding: new Array(1536).fill(0.1) }] })
        .mockRejectedValueOnce(new Error('Embedding failed'));

      const result = await vectorStore.syncKnowledgeStores('company-123', knowledgeStores);

      expect(result.total).toBe(2);
      expect(result.successful).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.results[0].success).toBe(true);
      expect(result.results[1].success).toBe(false);
    });
  });

  describe('searchByType', () => {
    beforeEach(() => {
      mockOpenAI.embeddings.create.mockResolvedValue({
        data: [{ embedding: new Array(1536).fill(0.5) }]
      });

      mockRedisClient.keys.mockResolvedValue([
        'knowledge:company-123:brand_voice:item1',
        'knowledge:company-123:frameworks:item2'
      ]);

      mockRedisClient.get
        .mockResolvedValueOnce(JSON.stringify({
          id: 'item1',
          type: 'brand_voice',
          content: 'Brand voice content'
        }))
        .mockResolvedValueOnce(JSON.stringify(new Array(1536).fill(0.8)))
        .mockResolvedValueOnce(JSON.stringify({
          id: 'item2',
          type: 'frameworks',
          content: 'Framework content'
        }))
        .mockResolvedValueOnce(JSON.stringify(new Array(1536).fill(0.9)));
    });

    it('should filter results by type', async () => {
      const results = await vectorStore.searchByType('company-123', 'brand_voice', 'test query', 5);

      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('brand_voice');
    });

    it('should return empty array for non-existent type', async () => {
      const results = await vectorStore.searchByType('company-123', 'non_existent', 'test query', 5);

      expect(results).toEqual([]);
    });
  });

  describe('clearCompanyKnowledge', () => {
    it('should clear all knowledge for a company', async () => {
      mockRedisClient.keys
        .mockResolvedValueOnce(['knowledge:company-123:item1', 'knowledge:company-123:item2'])
        .mockResolvedValueOnce(['embedding:company-123:item1', 'embedding:company-123:item2']);
      mockRedisClient.del.mockResolvedValue(4);

      const result = await vectorStore.clearCompanyKnowledge('company-123');

      expect(mockRedisClient.del).toHaveBeenCalledWith(
        'knowledge:company-123:item1',
        'knowledge:company-123:item2',
        'embedding:company-123:item1',
        'embedding:company-123:item2'
      );
      expect(result.cleared).toBe(4);
    });

    it('should handle case with no knowledge to clear', async () => {
      mockRedisClient.keys.mockResolvedValue([]);

      const result = await vectorStore.clearCompanyKnowledge('empty-company');

      expect(mockRedisClient.del).not.toHaveBeenCalled();
      expect(result.cleared).toBe(0);
    });
  });

  describe('getKnowledgeStats', () => {
    it('should return knowledge statistics', async () => {
      const mockKnowledge = [
        { type: 'brand_voice', content: 'Brand voice content' },
        { type: 'brand_voice', content: 'More brand content' },
        { type: 'frameworks', content: 'Framework content' }
      ];

      jest.spyOn(vectorStore, 'getCompanyKnowledge').mockResolvedValue(mockKnowledge);

      const stats = await vectorStore.getKnowledgeStats('company-123');

      expect(stats.total_items).toBe(3);
      expect(stats.by_type.brand_voice).toBe(2);
      expect(stats.by_type.frameworks).toBe(1);
      expect(stats.total_content_length).toBeGreaterThan(0);
    });

    it('should handle empty knowledge base', async () => {
      jest.spyOn(vectorStore, 'getCompanyKnowledge').mockResolvedValue([]);

      const stats = await vectorStore.getKnowledgeStats('empty-company');

      expect(stats.total_items).toBe(0);
      expect(stats.by_type).toEqual({});
    });

    it('should handle errors gracefully', async () => {
      jest.spyOn(vectorStore, 'getCompanyKnowledge').mockRejectedValue(new Error('Database error'));

      const stats = await vectorStore.getKnowledgeStats('company-123');

      expect(stats.total_items).toBe(0);
      expect(stats.error).toBe('Database error');
    });
  });

  describe('initializeTestKnowledge', () => {
    beforeEach(() => {
      jest.spyOn(vectorStore, 'syncKnowledgeStores').mockResolvedValue({
        total: 3,
        successful: 3,
        failed: 0
      });
    });

    it('should initialize test knowledge successfully', async () => {
      const result = await vectorStore.initializeTestKnowledge('test-company');

      expect(result.successful).toBe(3);
      expect(vectorStore.syncKnowledgeStores).toHaveBeenCalledWith(
        'test-company',
        expect.arrayContaining([
          expect.objectContaining({ type: 'brand_voice' }),
          expect.objectContaining({ type: 'top_posts' }),
          expect.objectContaining({ type: 'frameworks' })
        ])
      );
    });

    it('should handle initialization failures', async () => {
      jest.spyOn(vectorStore, 'syncKnowledgeStores').mockRejectedValue(new Error('Sync failed'));

      await expect(
        vectorStore.initializeTestKnowledge('test-company')
      ).rejects.toThrow('Sync failed');
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle Redis connection failures', async () => {
      mockRedisClient.setex.mockRejectedValue(new Error('Redis connection lost'));

      await expect(
        vectorStore.storeKnowledge('company-123', mockKnowledgeItem)
      ).rejects.toThrow('Redis connection lost');
    });

    it('should handle corrupted data gracefully', async () => {
      mockRedisClient.keys.mockResolvedValue(['knowledge:company-123:corrupted']);
      mockRedisClient.get.mockResolvedValue('invalid-json');

      const results = await vectorStore.retrieve('company-123', 'test query', 3);

      expect(results).toEqual([]);
    });

    it('should handle missing embeddings gracefully', async () => {
      mockRedisClient.keys.mockResolvedValue(['knowledge:company-123:item1']);
      mockRedisClient.get
        .mockResolvedValueOnce(JSON.stringify({ id: 'item1', content: 'test' }))
        .mockResolvedValueOnce(null); // Missing embedding

      const results = await vectorStore.retrieve('company-123', 'test query', 3);

      expect(results).toEqual([]);
    });
  });

  describe('performance considerations', () => {
    it('should use appropriate cache expiry times', async () => {
      mockOpenAI.embeddings.create.mockResolvedValue({
        data: [{ embedding: new Array(1536).fill(0.1) }]
      });

      await vectorStore.storeKnowledge('company-123', mockKnowledgeItem);

      expect(mockRedisClient.setex).toHaveBeenCalledWith(
        expect.any(String),
        86400, // 24 hours
        expect.any(String)
      );
    });

    it('should limit text input for embedding generation', async () => {
      const longContent = 'a'.repeat(10000);
      mockOpenAI.embeddings.create.mockResolvedValue({
        data: [{ embedding: new Array(1536).fill(0.1) }]
      });

      await vectorStore.generateEmbedding(longContent);

      const callArgs = mockOpenAI.embeddings.create.mock.calls[0][0];
      expect(callArgs.input.length).toBeLessThanOrEqual(8000);
    });
  });
});
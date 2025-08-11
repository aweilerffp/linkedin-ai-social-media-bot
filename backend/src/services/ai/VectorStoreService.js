import OpenAI from 'openai';
import { logger } from '../../utils/logger.js';
import { getRedisClient } from '../../config/redis.js';
import { ApiError } from '../../middleware/errorHandler.js';

/**
 * Vector Store Service for knowledge retrieval
 * Uses OpenAI embeddings with Redis for caching and similarity search
 */
export class VectorStoreService {
  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }
    
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    
    this.embeddingModel = 'text-embedding-ada-002';
    this.embeddingDimensions = 1536;
    this.similarityThreshold = 0.7;
    
    // Redis keys
    this.embeddingPrefix = 'embedding:';
    this.knowledgePrefix = 'knowledge:';
    this.cacheExpiry = 86400; // 24 hours
  }

  /**
   * Generate embedding for text content
   */
  async generateEmbedding(text) {
    try {
      const response = await this.openai.embeddings.create({
        model: this.embeddingModel,
        input: text.substring(0, 8000) // Limit input length
      });

      return response.data[0].embedding;
    } catch (error) {
      logger.error('Failed to generate embedding', {
        error: error.message,
        textLength: text.length
      });
      throw error;
    }
  }

  /**
   * Store knowledge with embeddings
   */
  async storeKnowledge(companyId, knowledgeItem) {
    try {
      const { id, type, name, content, query_key, retrieval_count } = knowledgeItem;
      
      // Generate embedding for content
      const embedding = await this.generateEmbedding(content);
      
      // Store in Redis with structured key
      const redisClient = getRedisClient();
      const knowledgeKey = `${this.knowledgePrefix}${companyId}:${type}:${id}`;
      const embeddingKey = `${this.embeddingPrefix}${companyId}:${id}`;
      
      const knowledgeData = {
        id,
        type,
        name,
        content,
        query_key,
        retrieval_count,
        embedding_dimensions: this.embeddingDimensions,
        stored_at: new Date().toISOString()
      };
      
      await Promise.all([
        redisClient.setex(knowledgeKey, this.cacheExpiry, JSON.stringify(knowledgeData)),
        redisClient.setex(embeddingKey, this.cacheExpiry, JSON.stringify(embedding))
      ]);

      logger.info('Knowledge stored with embedding', {
        companyId,
        knowledgeId: id,
        type,
        contentLength: content.length
      });

      return { success: true, embedding_dimensions: this.embeddingDimensions };
    } catch (error) {
      logger.error('Failed to store knowledge', {
        error: error.message,
        companyId,
        knowledgeId: knowledgeItem.id
      });
      throw error;
    }
  }

  /**
   * Retrieve knowledge by similarity search
   */
  async retrieve(companyId, query, k = 3) {
    try {
      // Generate embedding for query
      const queryEmbedding = await this.generateEmbedding(query);
      
      // Get all knowledge items for company
      const knowledgeItems = await this.getCompanyKnowledge(companyId);
      
      if (knowledgeItems.length === 0) {
        logger.warn('No knowledge items found for company', { companyId });
        return [];
      }

      // Calculate similarities and rank
      const similarities = [];
      for (const item of knowledgeItems) {
        const similarity = this.cosineSimilarity(queryEmbedding, item.embedding);
        if (similarity >= this.similarityThreshold) {
          similarities.push({
            ...item,
            similarity_score: similarity
          });
        }
      }

      // Sort by similarity and return top k
      const results = similarities
        .sort((a, b) => b.similarity_score - a.similarity_score)
        .slice(0, k)
        .map(item => ({
          id: item.id,
          type: item.type,
          name: item.name,
          content: item.content,
          similarity_score: item.similarity_score
        }));

      logger.info('Knowledge retrieved by similarity', {
        companyId,
        query,
        resultsCount: results.length,
        topScore: results[0]?.similarity_score
      });

      return results;
    } catch (error) {
      logger.error('Failed to retrieve knowledge', {
        error: error.message,
        companyId,
        query
      });
      return []; // Return empty array instead of throwing to allow graceful degradation
    }
  }

  /**
   * Get all knowledge items for a company
   */
  async getCompanyKnowledge(companyId) {
    try {
      const redisClient = getRedisClient();
      const knowledgePattern = `${this.knowledgePrefix}${companyId}:*`;
      const knowledgeKeys = await redisClient.keys(knowledgePattern);
      
      if (knowledgeKeys.length === 0) {
        return [];
      }

      // Get all knowledge items
      const knowledgeItems = [];
      for (const key of knowledgeKeys) {
        try {
          const knowledgeData = await redisClient.get(key);
          if (knowledgeData) {
            const item = JSON.parse(knowledgeData);
            
            // Get corresponding embedding
            const embeddingKey = `${this.embeddingPrefix}${companyId}:${item.id}`;
            const embeddingData = await redisClient.get(embeddingKey);
            
            if (embeddingData) {
              item.embedding = JSON.parse(embeddingData);
              knowledgeItems.push(item);
            }
          }
        } catch (parseError) {
          logger.warn('Failed to parse knowledge item', {
            key,
            error: parseError.message
          });
        }
      }

      return knowledgeItems;
    } catch (error) {
      logger.error('Failed to get company knowledge', {
        error: error.message,
        companyId
      });
      return [];
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  cosineSimilarity(vectorA, vectorB) {
    if (vectorA.length !== vectorB.length) {
      throw new Error('Vectors must have same dimensions');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vectorA.length; i++) {
      dotProduct += vectorA[i] * vectorB[i];
      normA += vectorA[i] * vectorA[i];
      normB += vectorB[i] * vectorB[i];
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    
    if (magnitude === 0) {
      return 0;
    }

    return dotProduct / magnitude;
  }

  /**
   * Bulk store knowledge from database
   */
  async syncKnowledgeStores(companyId, knowledgeStores) {
    try {
      const results = [];
      
      for (const store of knowledgeStores) {
        try {
          const result = await this.storeKnowledge(companyId, store);
          results.push({ id: store.id, success: true, ...result });
        } catch (error) {
          results.push({ id: store.id, success: false, error: error.message });
          logger.error('Failed to sync knowledge store', {
            companyId,
            storeId: store.id,
            error: error.message
          });
        }
      }

      const successful = results.filter(r => r.success).length;
      const failed = results.length - successful;

      logger.info('Knowledge sync completed', {
        companyId,
        total: results.length,
        successful,
        failed
      });

      return {
        total: results.length,
        successful,
        failed,
        results
      };
    } catch (error) {
      logger.error('Knowledge sync failed', {
        error: error.message,
        companyId
      });
      throw error;
    }
  }

  /**
   * Search knowledge by type and query
   */
  async searchByType(companyId, type, query, k = 3) {
    try {
      const queryEmbedding = await this.generateEmbedding(query);
      const allKnowledge = await this.getCompanyKnowledge(companyId);
      
      // Filter by type first
      const typeFiltered = allKnowledge.filter(item => item.type === type);
      
      if (typeFiltered.length === 0) {
        logger.warn('No knowledge items found for type', { companyId, type });
        return [];
      }

      // Calculate similarities
      const similarities = typeFiltered.map(item => ({
        ...item,
        similarity_score: this.cosineSimilarity(queryEmbedding, item.embedding)
      }));

      // Filter by threshold and return top k
      const results = similarities
        .filter(item => item.similarity_score >= this.similarityThreshold)
        .sort((a, b) => b.similarity_score - a.similarity_score)
        .slice(0, k)
        .map(item => ({
          id: item.id,
          type: item.type,
          name: item.name,
          content: item.content,
          similarity_score: item.similarity_score
        }));

      return results;
    } catch (error) {
      logger.error('Failed to search knowledge by type', {
        error: error.message,
        companyId,
        type,
        query
      });
      return [];
    }
  }

  /**
   * Initialize with sample knowledge for testing
   */
  async initializeTestKnowledge(companyId) {
    const sampleKnowledge = [
      {
        id: 'brand-voice-1',
        type: 'brand_voice',
        name: 'FlatFilePro Brand Voice Guide',
        content: `FlatFilePro Brand Voice: Confident, practical, solution-focused. We speak to Amazon sellers who are tired of manual catalog management. Our tone is conversational yet authoritative. We avoid buzzwords like "revolutionary" or "game-changing." Instead, we focus on concrete benefits: time savings, error reduction, improved seller health. We position ourselves as the practical experts who understand the real challenges of Amazon selling. Key messaging: efficiency, accuracy, seller success.`,
        query_key: 'brand voice snapshot',
        retrieval_count: 1
      },
      {
        id: 'top-post-1',
        type: 'top_posts',
        name: 'High-Performing Amazon Seller Post',
        content: `Amazon sellers: Your biggest competitor isn't another seller. It's your own catalog inefficiency. I analyzed 500+ seller accounts last month. The pattern was clear: Sellers spending 15+ hours/week on manual listing updates had 23% lower profit margins. Why? Time costs money. Error rates increase with manual processes. Account health suffers from inconsistencies. The solution isn't working harder. It's working smarter with automation that validates every change. What's eating up most of your catalog management time?`,
        query_key: 'reference linkedin post',
        retrieval_count: 3
      },
      {
        id: 'framework-1',
        type: 'frameworks',
        name: 'Problem-Agitation-Solution Framework',
        content: `Engagement Framework: Problem-Agitation-Solution. Start with a counterintuitive statement that challenges common assumptions in Amazon selling. Agitate by showing the hidden costs of the status quo - lost time, reduced profits, account health risks. Reveal the solution by demonstrating how automation solves the core problem. End with an open question that invites sellers to share their experiences. This framework works because it connects emotionally before presenting logic.`,
        query_key: 'engagement frameworks',
        retrieval_count: 2
      }
    ];

    try {
      const syncResult = await this.syncKnowledgeStores(companyId, sampleKnowledge);
      logger.info('Test knowledge initialized', {
        companyId,
        itemsStored: syncResult.successful
      });
      return syncResult;
    } catch (error) {
      logger.error('Failed to initialize test knowledge', {
        error: error.message,
        companyId
      });
      throw error;
    }
  }

  /**
   * Clear all knowledge for a company
   */
  async clearCompanyKnowledge(companyId) {
    try {
      const redisClient = getRedisClient();
      
      const knowledgeKeys = await redisClient.keys(`${this.knowledgePrefix}${companyId}:*`);
      const embeddingKeys = await redisClient.keys(`${this.embeddingPrefix}${companyId}:*`);
      
      const allKeys = [...knowledgeKeys, ...embeddingKeys];
      
      if (allKeys.length > 0) {
        await redisClient.del(...allKeys);
      }

      logger.info('Company knowledge cleared', {
        companyId,
        itemsCleared: allKeys.length
      });

      return { cleared: allKeys.length };
    } catch (error) {
      logger.error('Failed to clear company knowledge', {
        error: error.message,
        companyId
      });
      throw error;
    }
  }

  /**
   * Get knowledge statistics for a company
   */
  async getKnowledgeStats(companyId) {
    try {
      const knowledge = await this.getCompanyKnowledge(companyId);
      
      const stats = {
        total_items: knowledge.length,
        by_type: {},
        total_content_length: 0,
        avg_similarity_threshold: this.similarityThreshold
      };

      knowledge.forEach(item => {
        stats.by_type[item.type] = (stats.by_type[item.type] || 0) + 1;
        stats.total_content_length += item.content.length;
      });

      return stats;
    } catch (error) {
      logger.error('Failed to get knowledge stats', {
        error: error.message,
        companyId
      });
      return { total_items: 0, by_type: {}, error: error.message };
    }
  }
}

// Export singleton instance
export const vectorStoreService = new VectorStoreService();
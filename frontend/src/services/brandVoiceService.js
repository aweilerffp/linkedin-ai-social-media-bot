// Brand Voice Service
// Manages storage and retrieval of brand voice data and knowledge base

class BrandVoiceService {
  constructor() {
    this.storageKey = 'brand_voice_knowledge_base';
    this.analysisKey = 'brand_voice_analysis';
    this.draftKey = 'brand_voice_draft';
  }

  // Save brand voice analysis
  saveAnalysis(analysisData) {
    try {
      const timestamp = new Date().toISOString();
      const dataWithTimestamp = {
        ...analysisData,
        saved_at: timestamp,
        version: '1.0'
      };
      
      localStorage.setItem(this.analysisKey, JSON.stringify(dataWithTimestamp));
      
      // Also update the knowledge base
      this.updateKnowledgeBase(analysisData);
      
      return { success: true, data: dataWithTimestamp };
    } catch (error) {
      console.error('Error saving brand voice analysis:', error);
      return { success: false, error: error.message };
    }
  }

  // Get saved analysis
  getAnalysis() {
    try {
      const saved = localStorage.getItem(this.analysisKey);
      return saved ? JSON.parse(saved) : null;
    } catch (error) {
      console.error('Error retrieving brand voice analysis:', error);
      return null;
    }
  }

  // Update knowledge base with new content
  updateKnowledgeBase(analysisData) {
    try {
      const existingKB = this.getKnowledgeBase() || {
        content_samples: [],
        patterns: {},
        metadata: {}
      };
      
      // Add new content samples
      if (analysisData.content_samples) {
        existingKB.content_samples.push({
          ...analysisData.content_samples,
          added_at: new Date().toISOString()
        });
      }
      
      // Update patterns (merge with existing)
      if (analysisData.extracted_patterns) {
        existingKB.patterns = {
          ...existingKB.patterns,
          ...analysisData.extracted_patterns,
          last_updated: new Date().toISOString()
        };
      }
      
      // Update metadata
      existingKB.metadata = {
        total_samples: existingKB.content_samples.length,
        last_analysis: new Date().toISOString(),
        version: '1.0'
      };
      
      localStorage.setItem(this.storageKey, JSON.stringify(existingKB));
      
      return existingKB;
    } catch (error) {
      console.error('Error updating knowledge base:', error);
      return null;
    }
  }

  // Get the complete knowledge base
  getKnowledgeBase() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      return saved ? JSON.parse(saved) : null;
    } catch (error) {
      console.error('Error retrieving knowledge base:', error);
      return null;
    }
  }

  // Save draft content (auto-save while user is typing)
  saveDraft(draftData) {
    try {
      localStorage.setItem(this.draftKey, JSON.stringify({
        ...draftData,
        saved_at: new Date().toISOString()
      }));
      return true;
    } catch (error) {
      console.error('Error saving draft:', error);
      return false;
    }
  }

  // Get saved draft
  getDraft() {
    try {
      const saved = localStorage.getItem(this.draftKey);
      return saved ? JSON.parse(saved) : null;
    } catch (error) {
      console.error('Error retrieving draft:', error);
      return null;
    }
  }

  // Clear draft after successful save
  clearDraft() {
    try {
      localStorage.removeItem(this.draftKey);
      return true;
    } catch (error) {
      console.error('Error clearing draft:', error);
      return false;
    }
  }

  // Get brand voice patterns for content generation
  getVoicePatterns() {
    const kb = this.getKnowledgeBase();
    if (!kb || !kb.patterns) return null;
    
    return {
      formality: kb.patterns.formality_level,
      tone: kb.patterns.emotional_tone,
      sentenceStyle: kb.patterns.sentence_structure,
      commonPhrases: kb.patterns.common_phrases || [],
      pronounStyle: kb.patterns.pronoun_usage?.style,
      storytelling: kb.patterns.storytelling_approach,
      vocabulary: kb.patterns.vocabulary
    };
  }

  // Get content examples by type
  getContentExamples(contentType) {
    const kb = this.getKnowledgeBase();
    if (!kb || !kb.content_samples) return [];
    
    const examples = [];
    
    kb.content_samples.forEach(sample => {
      if (contentType === 'social' && sample.social_media_posts) {
        examples.push(sample.social_media_posts);
      } else if (contentType === 'marketing' && sample.marketing_emails) {
        examples.push(sample.marketing_emails);
      } else if (contentType === 'support' && sample.support_communications) {
        examples.push(sample.support_communications);
      } else if (contentType === 'website' && sample.homepage_content) {
        examples.push(sample.homepage_content);
      }
    });
    
    return examples;
  }

  // Generate content prompt based on brand voice
  generatePrompt(contentType, topic) {
    const patterns = this.getVoicePatterns();
    if (!patterns) return null;
    
    const examples = this.getContentExamples(contentType);
    
    let prompt = `Generate ${contentType} content about "${topic}" using the following brand voice characteristics:\n\n`;
    
    // Add voice characteristics
    prompt += `Formality: ${patterns.formality}\n`;
    prompt += `Tone: ${patterns.tone?.join(', ')}\n`;
    prompt += `Sentence Style: ${patterns.sentenceStyle}\n`;
    prompt += `Pronoun Style: ${patterns.pronounStyle}\n`;
    prompt += `Storytelling Approach: ${patterns.storytelling}\n\n`;
    
    // Add common phrases
    if (patterns.commonPhrases && patterns.commonPhrases.length > 0) {
      prompt += `Common Phrases to Use:\n`;
      patterns.commonPhrases.forEach(phrase => {
        prompt += `- "${phrase}"\n`;
      });
      prompt += '\n';
    }
    
    // Add examples if available
    if (examples.length > 0) {
      prompt += `Example of Our Voice:\n`;
      prompt += `"${examples[0].substring(0, 200)}..."\n\n`;
    }
    
    prompt += `Generate content that matches this brand voice exactly.`;
    
    return prompt;
  }

  // Validate if content matches brand voice
  validateContent(content) {
    const patterns = this.getVoicePatterns();
    if (!patterns) return { valid: true, feedback: [] };
    
    const feedback = [];
    const lowerContent = content.toLowerCase();
    
    // Check for common phrases usage
    if (patterns.commonPhrases && patterns.commonPhrases.length > 0) {
      const usedPhrases = patterns.commonPhrases.filter(phrase => 
        lowerContent.includes(phrase.toLowerCase())
      );
      
      if (usedPhrases.length === 0) {
        feedback.push('Consider using some of your brand\'s common phrases');
      }
    }
    
    // Check formality level
    const casualWords = ['hey', 'gonna', 'wanna', 'yeah'];
    const formalWords = ['therefore', 'furthermore', 'consequently'];
    
    const hasCasual = casualWords.some(word => lowerContent.includes(word));
    const hasFormal = formalWords.some(word => lowerContent.includes(word));
    
    if (patterns.formality === 'formal' && hasCasual) {
      feedback.push('Content seems too casual for your formal brand voice');
    } else if (patterns.formality === 'casual' && hasFormal) {
      feedback.push('Content seems too formal for your casual brand voice');
    }
    
    // Check sentence length
    const sentences = content.split(/[.!?]+/).filter(s => s.trim());
    const avgLength = sentences.reduce((sum, s) => sum + s.split(/\s+/).length, 0) / sentences.length;
    
    if (patterns.sentenceStyle === 'short_punchy' && avgLength > 15) {
      feedback.push('Sentences are longer than your typical punchy style');
    } else if (patterns.sentenceStyle === 'long_detailed' && avgLength < 10) {
      feedback.push('Sentences are shorter than your typical detailed style');
    }
    
    return {
      valid: feedback.length === 0,
      feedback,
      score: Math.max(0, 100 - (feedback.length * 20))
    };
  }

  // Export knowledge base for backup
  exportKnowledgeBase() {
    const kb = this.getKnowledgeBase();
    const analysis = this.getAnalysis();
    
    const exportData = {
      knowledge_base: kb,
      analysis: analysis,
      exported_at: new Date().toISOString(),
      version: '1.0'
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
      type: 'application/json' 
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `brand_voice_kb_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    return true;
  }

  // Import knowledge base from backup
  importKnowledgeBase(fileContent) {
    try {
      const data = JSON.parse(fileContent);
      
      if (data.knowledge_base) {
        localStorage.setItem(this.storageKey, JSON.stringify(data.knowledge_base));
      }
      
      if (data.analysis) {
        localStorage.setItem(this.analysisKey, JSON.stringify(data.analysis));
      }
      
      return { success: true, message: 'Knowledge base imported successfully' };
    } catch (error) {
      console.error('Error importing knowledge base:', error);
      return { success: false, error: error.message };
    }
  }

  // Clear all brand voice data
  clearAll() {
    try {
      localStorage.removeItem(this.storageKey);
      localStorage.removeItem(this.analysisKey);
      localStorage.removeItem(this.draftKey);
      return true;
    } catch (error) {
      console.error('Error clearing brand voice data:', error);
      return false;
    }
  }

  // Get statistics about the knowledge base
  getStatistics() {
    const kb = this.getKnowledgeBase();
    if (!kb) return null;
    
    const stats = {
      totalSamples: kb.content_samples?.length || 0,
      contentTypes: {},
      lastUpdated: kb.metadata?.last_analysis || null,
      patternsIdentified: Object.keys(kb.patterns || {}).length,
      totalWords: 0
    };
    
    // Count content by type
    if (kb.content_samples) {
      kb.content_samples.forEach(sample => {
        if (sample.demo_videos) stats.contentTypes.demos = (stats.contentTypes.demos || 0) + 1;
        if (sample.homepage_content) stats.contentTypes.website = (stats.contentTypes.website || 0) + 1;
        if (sample.social_media_posts) stats.contentTypes.social = (stats.contentTypes.social || 0) + 1;
        if (sample.support_communications) stats.contentTypes.support = (stats.contentTypes.support || 0) + 1;
        if (sample.marketing_emails) stats.contentTypes.marketing = (stats.contentTypes.marketing || 0) + 1;
        
        // Count total words
        const allContent = Object.values(sample).filter(v => typeof v === 'string').join(' ');
        stats.totalWords += allContent.split(/\s+/).length;
      });
    }
    
    return stats;
  }
}

// Export singleton instance
const brandVoiceService = new BrandVoiceService();
export default brandVoiceService;
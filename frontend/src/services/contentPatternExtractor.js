// Content Pattern Extractor Service
// Analyzes text content to extract brand voice patterns and characteristics

class ContentPatternExtractor {
  constructor() {
    this.formalityIndicators = {
      formal: [
        'therefore', 'furthermore', 'consequently', 'pursuant', 'moreover',
        'nevertheless', 'accordingly', 'hence', 'thus', 'wherein',
        'regarding', 'concerning', 'pertaining', 'aforementioned'
      ],
      casual: [
        'hey', 'gonna', 'wanna', 'yeah', 'awesome', 'cool', 'stuff',
        'things', 'pretty', 'really', 'super', 'totally', 'basically',
        'honestly', 'literally', 'actually', 'kinda', 'sorta'
      ],
      contractions: ["don't", "won't", "can't", "wouldn't", "shouldn't", "it's", "we're", "you're"]
    };

    this.emotionalToneIndicators = {
      enthusiastic: ['excited', 'amazing', 'incredible', 'fantastic', 'wonderful', 'thrilled', 'delighted'],
      professional: ['deliver', 'solution', 'enterprise', 'strategic', 'implementation', 'optimize', 'leverage'],
      friendly: ['happy', 'glad', 'welcome', 'thanks', 'appreciate', 'enjoy', 'love'],
      urgent: ['now', 'today', 'limited', 'hurry', 'immediate', 'quickly', 'fast', 'asap'],
      educational: ['learn', 'discover', 'understand', 'explore', 'guide', 'teach', 'explain'],
      confident: ['guaranteed', 'proven', 'trusted', 'leader', 'expert', 'best', 'top'],
      empathetic: ['understand', 'feel', 'experience', 'relate', 'support', 'care', 'help']
    };

    this.technicalIndicators = {
      jargon: ['API', 'SDK', 'ROI', 'KPI', 'SaaS', 'B2B', 'B2C', 'UI/UX', 'AI/ML'],
      complex: ['optimization', 'integration', 'implementation', 'infrastructure', 'architecture'],
      simple: ['easy', 'simple', 'quick', 'fast', 'basic', 'clear', 'straightforward']
    };
  }

  // Main analysis function
  analyzeContent(contentSamples) {
    const allContent = this.combineContent(contentSamples);
    
    return {
      formality: this.analyzeFormalityLevel(allContent),
      complexity: this.analyzeTechnicalComplexity(allContent),
      emotionalTone: this.analyzeEmotionalTone(allContent),
      sentenceStructure: this.analyzeSentenceStructure(allContent),
      commonPhrases: this.extractCommonPhrases(allContent),
      pronounUsage: this.analyzePronounUsage(allContent),
      punctuationStyle: this.analyzePunctuation(allContent),
      storytellingApproach: this.detectStorytellingStyle(allContent),
      voiceVariations: this.analyzeVoiceVariations(contentSamples),
      vocabulary: this.analyzeVocabulary(allContent),
      readability: this.calculateReadability(allContent)
    };
  }

  // Combine all content samples into one string
  combineContent(contentSamples) {
    const sections = [
      contentSamples.demo_videos || '',
      contentSamples.homepage_content || '',
      contentSamples.additional_pages || '',
      contentSamples.social_media_posts || '',
      contentSamples.support_communications || '',
      contentSamples.marketing_emails || ''
    ];
    
    if (contentSamples.storybrand) {
      sections.push(Object.values(contentSamples.storybrand).join(' '));
    }
    
    return sections.join(' ');
  }

  // Analyze formality level
  analyzeFormalityLevel(content) {
    const lowerContent = content.toLowerCase();
    const words = lowerContent.split(/\s+/);
    
    let formalScore = 0;
    let casualScore = 0;
    
    // Check formal indicators
    this.formalityIndicators.formal.forEach(indicator => {
      const count = (lowerContent.match(new RegExp(`\\b${indicator}\\b`, 'g')) || []).length;
      formalScore += count;
    });
    
    // Check casual indicators
    this.formalityIndicators.casual.forEach(indicator => {
      const count = (lowerContent.match(new RegExp(`\\b${indicator}\\b`, 'g')) || []).length;
      casualScore += count;
    });
    
    // Check contractions (casual)
    this.formalityIndicators.contractions.forEach(contraction => {
      const count = (lowerContent.match(new RegExp(contraction.replace("'", "\\'"), 'g')) || []).length;
      casualScore += count * 0.5;
    });
    
    // Calculate ratio
    const totalIndicators = formalScore + casualScore;
    if (totalIndicators === 0) return { level: 'neutral', confidence: 0.5 };
    
    const formalityRatio = formalScore / totalIndicators;
    
    let level;
    if (formalityRatio > 0.7) level = 'very_formal';
    else if (formalityRatio > 0.55) level = 'formal';
    else if (formalityRatio > 0.45) level = 'balanced';
    else if (formalityRatio > 0.3) level = 'casual';
    else level = 'very_casual';
    
    return {
      level,
      confidence: Math.min(totalIndicators / words.length * 100, 1),
      formalScore,
      casualScore,
      ratio: formalityRatio
    };
  }

  // Analyze technical complexity
  analyzeTechnicalComplexity(content) {
    const words = content.split(/\s+/);
    const sentences = content.split(/[.!?]+/).filter(s => s.trim());
    
    // Calculate average word length
    const avgWordLength = words.reduce((sum, word) => sum + word.length, 0) / words.length;
    
    // Count technical terms
    let technicalTermCount = 0;
    const lowerContent = content.toLowerCase();
    
    [...this.technicalIndicators.jargon, ...this.technicalIndicators.complex].forEach(term => {
      technicalTermCount += (lowerContent.match(new RegExp(`\\b${term.toLowerCase()}\\b`, 'g')) || []).length;
    });
    
    // Count simple terms
    let simpleTermCount = 0;
    this.technicalIndicators.simple.forEach(term => {
      simpleTermCount += (lowerContent.match(new RegExp(`\\b${term}\\b`, 'g')) || []).length;
    });
    
    // Calculate complexity score
    const technicalDensity = technicalTermCount / words.length;
    const simpleDensity = simpleTermCount / words.length;
    
    let level;
    if (technicalDensity > 0.05) level = 'highly_technical';
    else if (technicalDensity > 0.02) level = 'technical';
    else if (simpleDensity > 0.02) level = 'simple';
    else level = 'moderate';
    
    return {
      level,
      avgWordLength: avgWordLength.toFixed(2),
      technicalTermCount,
      simpleTermCount,
      technicalDensity: (technicalDensity * 100).toFixed(2) + '%',
      vocabulary: this.categorizeVocabularyLevel(avgWordLength)
    };
  }

  // Categorize vocabulary level based on word length
  categorizeVocabularyLevel(avgWordLength) {
    if (avgWordLength > 6) return 'advanced';
    if (avgWordLength > 5) return 'intermediate';
    if (avgWordLength > 4) return 'basic';
    return 'simple';
  }

  // Analyze emotional tone
  analyzeEmotionalTone(content) {
    const lowerContent = content.toLowerCase();
    const words = lowerContent.split(/\s+/).length;
    const tones = [];
    const toneScores = {};
    
    Object.entries(this.emotionalToneIndicators).forEach(([tone, indicators]) => {
      let score = 0;
      indicators.forEach(indicator => {
        score += (lowerContent.match(new RegExp(`\\b${indicator}\\b`, 'g')) || []).length;
      });
      
      if (score > 0) {
        toneScores[tone] = score;
        const density = (score / words) * 100;
        tones.push({
          tone,
          score,
          density: density.toFixed(2) + '%',
          strength: density > 1 ? 'strong' : density > 0.5 ? 'moderate' : 'mild'
        });
      }
    });
    
    // Sort by score
    tones.sort((a, b) => b.score - a.score);
    
    // Detect overall sentiment
    const sentiment = this.detectSentiment(content);
    
    return {
      primary: tones[0]?.tone || 'neutral',
      secondary: tones[1]?.tone || null,
      all: tones,
      sentiment,
      diversity: Object.keys(toneScores).length
    };
  }

  // Detect overall sentiment
  detectSentiment(content) {
    const positive = ['good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'love', 'best'];
    const negative = ['bad', 'poor', 'terrible', 'awful', 'worst', 'hate', 'problem', 'issue'];
    
    const lowerContent = content.toLowerCase();
    let positiveCount = 0;
    let negativeCount = 0;
    
    positive.forEach(word => {
      positiveCount += (lowerContent.match(new RegExp(`\\b${word}\\b`, 'g')) || []).length;
    });
    
    negative.forEach(word => {
      negativeCount += (lowerContent.match(new RegExp(`\\b${word}\\b`, 'g')) || []).length;
    });
    
    if (positiveCount > negativeCount * 2) return 'positive';
    if (negativeCount > positiveCount * 2) return 'negative';
    return 'neutral';
  }

  // Analyze sentence structure
  analyzeSentenceStructure(content) {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (sentences.length === 0) return { pattern: 'none', avgLength: 0 };
    
    const sentenceLengths = sentences.map(s => s.split(/\s+/).length);
    const avgLength = sentenceLengths.reduce((sum, len) => sum + len, 0) / sentenceLengths.length;
    
    // Calculate variation
    const variance = sentenceLengths.reduce((sum, len) => sum + Math.pow(len - avgLength, 2), 0) / sentenceLengths.length;
    const stdDev = Math.sqrt(variance);
    
    // Categorize sentence patterns
    let pattern;
    if (avgLength < 10) pattern = 'short_punchy';
    else if (avgLength < 15) pattern = 'medium_balanced';
    else if (avgLength < 20) pattern = 'long_detailed';
    else pattern = 'very_long_complex';
    
    // Check for questions
    const questions = (content.match(/\?/g) || []).length;
    const questionRatio = questions / sentences.length;
    
    return {
      pattern,
      avgLength: avgLength.toFixed(1),
      minLength: Math.min(...sentenceLengths),
      maxLength: Math.max(...sentenceLengths),
      variation: stdDev.toFixed(1),
      totalSentences: sentences.length,
      questions,
      questionRatio: (questionRatio * 100).toFixed(1) + '%',
      variety: stdDev > 5 ? 'high' : stdDev > 3 ? 'moderate' : 'low'
    };
  }

  // Extract common phrases (2-4 word combinations)
  extractCommonPhrases(content) {
    const words = content.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/);
    const phrases = {};
    
    // Extract 2-word phrases
    for (let i = 0; i < words.length - 1; i++) {
      const phrase = `${words[i]} ${words[i + 1]}`;
      if (!this.isCommonPhrase(phrase)) {
        phrases[phrase] = (phrases[phrase] || 0) + 1;
      }
    }
    
    // Extract 3-word phrases
    for (let i = 0; i < words.length - 2; i++) {
      const phrase = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
      if (!this.isCommonPhrase(phrase)) {
        phrases[phrase] = (phrases[phrase] || 0) + 1;
      }
    }
    
    // Filter and sort phrases
    const significantPhrases = Object.entries(phrases)
      .filter(([phrase, count]) => count > 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([phrase, count]) => ({
        phrase,
        count,
        frequency: ((count / words.length) * 100).toFixed(2) + '%'
      }));
    
    return significantPhrases;
  }

  // Check if phrase is too common to be significant
  isCommonPhrase(phrase) {
    const commonStarts = ['the', 'and', 'for', 'with', 'that', 'this', 'from', 'have', 'will', 'can', 'are', 'was', 'been'];
    const firstWord = phrase.split(' ')[0];
    return commonStarts.includes(firstWord);
  }

  // Analyze pronoun usage
  analyzePronounUsage(content) {
    const lowerContent = content.toLowerCase();
    const totalWords = content.split(/\s+/).length;
    
    const pronounGroups = {
      first_person_singular: ['i', 'me', 'my', 'mine', 'myself'],
      first_person_plural: ['we', 'us', 'our', 'ours', 'ourselves'],
      second_person: ['you', 'your', 'yours', 'yourself', 'yourselves'],
      third_person: ['he', 'she', 'it', 'they', 'him', 'her', 'them', 'his', 'hers', 'its', 'their']
    };
    
    const usage = {};
    let totalPronouns = 0;
    
    Object.entries(pronounGroups).forEach(([group, pronouns]) => {
      let count = 0;
      pronouns.forEach(pronoun => {
        count += (lowerContent.match(new RegExp(`\\b${pronoun}\\b`, 'g')) || []).length;
      });
      usage[group] = {
        count,
        percentage: ((count / totalWords) * 100).toFixed(2) + '%'
      };
      totalPronouns += count;
    });
    
    // Determine primary perspective
    let perspective = 'neutral';
    if (usage.first_person_plural.count > usage.second_person.count * 1.5) {
      perspective = 'inclusive_we';
    } else if (usage.second_person.count > usage.first_person_plural.count * 1.5) {
      perspective = 'direct_you';
    } else if (usage.first_person_singular.count > totalPronouns * 0.3) {
      perspective = 'personal_i';
    }
    
    return {
      perspective,
      usage,
      totalPronouns,
      pronounDensity: ((totalPronouns / totalWords) * 100).toFixed(2) + '%',
      style: this.categorizePronounStyle(usage)
    };
  }

  // Categorize pronoun style
  categorizePronounStyle(usage) {
    const we = usage.first_person_plural.count;
    const you = usage.second_person.count;
    const i = usage.first_person_singular.count;
    
    if (we > you && we > i) return 'collaborative';
    if (you > we && you > i) return 'conversational';
    if (i > we && i > you) return 'personal';
    return 'balanced';
  }

  // Analyze punctuation usage
  analyzePunctuation(content) {
    const totalChars = content.length;
    
    const punctuation = {
      exclamation_points: (content.match(/!/g) || []).length,
      questions: (content.match(/\?/g) || []).length,
      em_dashes: (content.match(/—|--/g) || []).length,
      parentheses: (content.match(/\(/g) || []).length,
      colons: (content.match(/:/g) || []).length,
      semicolons: (content.match(/;/g) || []).length,
      ellipses: (content.match(/\.\.\./g) || []).length,
      quotes: (content.match(/["']/g) || []).length
    };
    
    // Calculate enthusiasm level
    let enthusiasm = 'moderate';
    if (punctuation.exclamation_points > 10) enthusiasm = 'high';
    else if (punctuation.exclamation_points < 2) enthusiasm = 'low';
    
    // Detect punctuation style
    let style = 'standard';
    if (punctuation.em_dashes > 5 || punctuation.parentheses > 10) style = 'expressive';
    if (punctuation.exclamation_points > 10) style = 'enthusiastic';
    if (punctuation.questions > 20) style = 'inquisitive';
    
    return {
      counts: punctuation,
      enthusiasm,
      style,
      density: ((Object.values(punctuation).reduce((sum, count) => sum + count, 0) / totalChars) * 100).toFixed(2) + '%'
    };
  }

  // Detect storytelling style
  detectStorytellingStyle(content) {
    const lowerContent = content.toLowerCase();
    const styles = [];
    
    // Check for different storytelling patterns
    const patterns = {
      narrative: ['once', 'story', 'journey', 'began', 'then', 'finally'],
      problem_solution: ['problem', 'challenge', 'solution', 'solve', 'fix', 'resolve'],
      case_study: ['client', 'customer', 'case', 'example', 'success', 'result'],
      instructional: ['step', 'first', 'next', 'then', 'finally', 'how to'],
      comparative: ['versus', 'compared', 'unlike', 'whereas', 'alternatively', 'better than'],
      testimonial: ['said', 'told', 'shared', 'testimonial', 'review', 'feedback']
    };
    
    Object.entries(patterns).forEach(([style, keywords]) => {
      let score = 0;
      keywords.forEach(keyword => {
        score += (lowerContent.match(new RegExp(`\\b${keyword}\\b`, 'g')) || []).length;
      });
      
      if (score > 2) {
        styles.push({ style, score, strength: score > 5 ? 'strong' : 'moderate' });
      }
    });
    
    // Sort by score
    styles.sort((a, b) => b.score - a.score);
    
    return {
      primary: styles[0]?.style || 'informational',
      secondary: styles[1]?.style || null,
      all: styles,
      diversity: styles.length
    };
  }

  // Analyze voice variations across different contexts
  analyzeVoiceVariations(contentSamples) {
    const variations = {};
    
    // Analyze each content type separately
    const contentTypes = [
      { key: 'demo_videos', label: 'demos', expectedTone: 'educational' },
      { key: 'homepage_content', label: 'website', expectedTone: 'professional' },
      { key: 'social_media_posts', label: 'social', expectedTone: 'casual' },
      { key: 'support_communications', label: 'support', expectedTone: 'helpful' },
      { key: 'marketing_emails', label: 'marketing', expectedTone: 'persuasive' }
    ];
    
    contentTypes.forEach(({ key, label }) => {
      const content = contentSamples[key];
      if (content && content.length > 100) {
        const formality = this.analyzeFormalityLevel(content);
        const tone = this.analyzeEmotionalTone(content);
        const structure = this.analyzeSentenceStructure(content);
        
        variations[label] = {
          formality: formality.level,
          primaryTone: tone.primary,
          sentenceStyle: structure.pattern,
          characteristics: this.summarizeCharacteristics(formality, tone, structure)
        };
      }
    });
    
    // Detect consistency
    const formalityLevels = Object.values(variations).map(v => v.formality).filter(Boolean);
    const isConsistent = new Set(formalityLevels).size <= 2;
    
    return {
      contexts: variations,
      consistency: isConsistent ? 'consistent' : 'varied',
      adaptability: Object.keys(variations).length > 3 ? 'high' : 'moderate'
    };
  }

  // Summarize characteristics for a content type
  summarizeCharacteristics(formality, tone, structure) {
    const chars = [];
    
    if (formality.level.includes('formal')) chars.push('formal');
    if (formality.level.includes('casual')) chars.push('casual');
    if (tone.primary) chars.push(tone.primary);
    if (structure.pattern.includes('short')) chars.push('concise');
    if (structure.pattern.includes('long')) chars.push('detailed');
    
    return chars.join('_');
  }

  // Analyze vocabulary diversity and sophistication
  analyzeVocabulary(content) {
    const words = content.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/);
    const uniqueWords = new Set(words);
    
    // Calculate lexical diversity
    const lexicalDiversity = (uniqueWords.size / words.length) * 100;
    
    // Count syllables (simplified)
    const avgSyllables = words.reduce((sum, word) => sum + this.countSyllables(word), 0) / words.length;
    
    // Categorize vocabulary
    let sophistication;
    if (avgSyllables > 2.5) sophistication = 'advanced';
    else if (avgSyllables > 2) sophistication = 'intermediate';
    else if (avgSyllables > 1.5) sophistication = 'standard';
    else sophistication = 'simple';
    
    return {
      totalWords: words.length,
      uniqueWords: uniqueWords.size,
      lexicalDiversity: lexicalDiversity.toFixed(1) + '%',
      avgSyllables: avgSyllables.toFixed(2),
      sophistication,
      richness: lexicalDiversity > 60 ? 'rich' : lexicalDiversity > 40 ? 'moderate' : 'repetitive'
    };
  }

  // Count syllables in a word (simplified algorithm)
  countSyllables(word) {
    word = word.toLowerCase();
    let count = 0;
    let previousWasVowel = false;
    
    for (let i = 0; i < word.length; i++) {
      const isVowel = 'aeiou'.includes(word[i]);
      if (isVowel && !previousWasVowel) {
        count++;
      }
      previousWasVowel = isVowel;
    }
    
    // Adjust for silent e
    if (word.endsWith('e')) count--;
    
    // Ensure at least one syllable
    return Math.max(1, count);
  }

  // Calculate readability scores
  calculateReadability(content) {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim());
    const words = content.split(/\s+/);
    const syllables = words.reduce((sum, word) => sum + this.countSyllables(word), 0);
    
    if (sentences.length === 0 || words.length === 0) {
      return { score: 0, level: 'unknown' };
    }
    
    // Flesch Reading Ease Score
    const avgSentenceLength = words.length / sentences.length;
    const avgSyllablesPerWord = syllables / words.length;
    const fleschScore = 206.835 - 1.015 * avgSentenceLength - 84.6 * avgSyllablesPerWord;
    
    // Categorize reading level
    let level;
    if (fleschScore >= 90) level = 'very_easy';
    else if (fleschScore >= 80) level = 'easy';
    else if (fleschScore >= 70) level = 'fairly_easy';
    else if (fleschScore >= 60) level = 'standard';
    else if (fleschScore >= 50) level = 'fairly_difficult';
    else if (fleschScore >= 30) level = 'difficult';
    else level = 'very_difficult';
    
    // Estimate grade level
    const gradeLevel = 0.39 * avgSentenceLength + 11.8 * avgSyllablesPerWord - 15.59;
    
    return {
      fleschScore: Math.max(0, Math.min(100, fleschScore)).toFixed(1),
      level,
      gradeLevel: Math.max(1, Math.min(18, gradeLevel)).toFixed(1),
      avgSentenceLength: avgSentenceLength.toFixed(1),
      avgSyllablesPerWord: avgSyllablesPerWord.toFixed(2)
    };
  }

  // Generate a comprehensive brand voice summary
  generateSummary(analysis) {
    const summary = {
      overview: '',
      strengths: [],
      recommendations: [],
      voicePersonality: ''
    };
    
    // Create overview
    const formality = analysis.formality.level.replace('_', ' ');
    const tone = analysis.emotionalTone.primary;
    const structure = analysis.sentenceStructure.pattern.replace('_', ' ');
    
    summary.overview = `Your brand voice is ${formality} with a ${tone} tone, using ${structure} sentence structures.`;
    
    // Identify strengths
    if (analysis.formality.confidence > 0.7) {
      summary.strengths.push('Consistent formality level');
    }
    if (analysis.emotionalTone.diversity > 3) {
      summary.strengths.push('Rich emotional range');
    }
    if (analysis.vocabulary.richness === 'rich') {
      summary.strengths.push('Diverse vocabulary');
    }
    if (analysis.voiceVariations.consistency === 'consistent') {
      summary.strengths.push('Consistent voice across contexts');
    }
    
    // Generate recommendations
    if (analysis.readability.level === 'very_difficult') {
      summary.recommendations.push('Consider simplifying complex sentences for broader accessibility');
    }
    if (analysis.pronounUsage.perspective === 'neutral') {
      summary.recommendations.push('Develop a stronger perspective with more consistent pronoun usage');
    }
    if (analysis.commonPhrases.length < 3) {
      summary.recommendations.push('Develop signature phrases for better brand recognition');
    }
    
    // Define voice personality
    const personalities = [];
    if (formality.includes('formal')) personalities.push('Professional');
    if (formality.includes('casual')) personalities.push('Approachable');
    if (tone === 'enthusiastic') personalities.push('Energetic');
    if (tone === 'educational') personalities.push('Knowledgeable');
    if (analysis.storytellingApproach.primary === 'narrative') personalities.push('Storyteller');
    
    summary.voicePersonality = personalities.join(' ');
    
    return summary;
  }
}

// Export singleton instance
const contentPatternExtractor = new ContentPatternExtractor();
export default contentPatternExtractor;
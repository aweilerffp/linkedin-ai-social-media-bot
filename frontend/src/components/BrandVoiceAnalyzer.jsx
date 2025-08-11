import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import contentPatternExtractor from '../services/contentPatternExtractor';
import brandVoiceService from '../services/brandVoiceService';
// Updated: 2025-08-11 - Fixed analyze button issue

const BrandVoiceAnalyzer = ({ onAnalysisComplete, initialData = null }) => {
  const [currentSection, setCurrentSection] = useState('demo_videos');
  const [isSaving, setIsSaving] = useState(false);
  
  const [contentData, setContentData] = useState({
    demo_videos: '',
    homepage_content: '',
    additional_pages: '',
    social_media_posts: '',
    support_communications: '',
    marketing_emails: '',
    storybrand: {
      character: '',
      problem: '',
      guide: '',
      plan: '',
      call_to_action: '',
      success: '',
      failure: ''
    },
    additional_context: {
      industry: '',
      primary_audience: '',
      company_stage: 'startup',
      existing_guidelines: ''
    }
  });


  const sections = [
    { id: 'demo_videos', label: 'Demo Videos/Transcripts', icon: '🎥' },
    { id: 'website', label: 'Website Content', icon: '🌐' },
    { id: 'social_media', label: 'Social Media Posts', icon: '📱' },
    { id: 'support', label: 'Support Communications', icon: '💬' },
    { id: 'marketing', label: 'Marketing Emails', icon: '📧' },
    { id: 'storybrand', label: 'StoryBrand Framework', icon: '📖' },
    { id: 'context', label: 'Additional Context', icon: '⚙️' }
  ];

  useEffect(() => {
    // Try to load saved draft first
    const savedDraft = brandVoiceService.getDraft();
    if (savedDraft && savedDraft.demo_videos) {
      setContentData(savedDraft);
      toast.success('Loaded saved draft');
    } else if (initialData) {
      setContentData(prev => ({ ...prev, ...initialData }));
    }
  }, [initialData]);

  const handleContentChange = (field, value) => {
    setContentData(prev => ({
      ...prev,
      [field]: value
    }));
    // Auto-save to localStorage
    const savedData = { ...contentData, [field]: value };
    localStorage.setItem('brand_voice_draft', JSON.stringify(savedData));
  };

  const handleStorybrandChange = (field, value) => {
    setContentData(prev => ({
      ...prev,
      storybrand: {
        ...prev.storybrand,
        [field]: value
      }
    }));
  };

  const handleContextChange = (field, value) => {
    setContentData(prev => ({
      ...prev,
      additional_context: {
        ...prev.additional_context,
        [field]: value
      }
    }));
  };



  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Auto-analyze the content when saving
      const analysis = contentPatternExtractor.analyzeContent(contentData);
      
      // Transform the analysis to match our component's expected format
      const patterns = {
        formality_level: analysis.formality.level,
        technical_complexity: analysis.complexity.level,
        emotional_tone: analysis.emotionalTone.all.map(t => t.tone),
        sentence_structure: analysis.sentenceStructure.pattern,
        common_phrases: analysis.commonPhrases.map(p => p.phrase),
        pronoun_usage: analysis.pronounUsage,
        punctuation_style: analysis.punctuationStyle.counts,
        storytelling_approach: analysis.storytellingApproach.primary,
        voice_variations: analysis.voiceVariations.contexts,
        vocabulary: analysis.vocabulary,
        readability: analysis.readability,
        sentiment: analysis.emotionalTone.sentiment
      };
      
      const analysisResult = {
        content_samples: contentData,
        extracted_patterns: patterns,
        analyzed_at: new Date().toISOString()
      };
      
      // Save using the brand voice service
      const saveResult = brandVoiceService.saveAnalysis(analysisResult);
      
      if (saveResult.success) {
        // Clear draft after successful save
        brandVoiceService.clearDraft();
        
        if (onAnalysisComplete) {
          onAnalysisComplete(analysisResult);
        }
        
        toast.success('Brand voice knowledge base created successfully!');
      } else {
        throw new Error(saveResult.error);
      }
    } catch (error) {
      toast.error('Failed to save brand voice analysis');
      console.error('Save error:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const getCompletionPercentage = () => {
    const fields = [
      contentData.demo_videos,
      contentData.homepage_content,
      contentData.social_media_posts
    ];
    const filledFields = fields.filter(field => field && field.length > 50).length;
    return Math.round((filledFields / 3) * 100);
  };

  const renderDemoVideos = () => (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Demo Videos/Transcripts</h3>
        <p className="text-sm text-gray-600 mb-4">
          Paste transcripts from any demo videos, walkthroughs, or tutorial content. This helps capture how you explain your product.
        </p>
        <textarea
          value={contentData.demo_videos}
          onChange={(e) => handleContentChange('demo_videos', e.target.value)}
          className="w-full h-64 px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Example: 'Welcome to our product demo. Today I'll show you how our platform helps teams collaborate more effectively...'"
        />
        <p className="text-xs text-gray-500 mt-2">
          {contentData.demo_videos.length} characters
        </p>
      </div>
    </div>
  );

  const renderWebsiteContent = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Homepage Copy</h3>
        <p className="text-sm text-gray-600 mb-4">
          Copy and paste your entire homepage text including headlines, subheadings, and body copy.
        </p>
        <textarea
          value={contentData.homepage_content}
          onChange={(e) => handleContentChange('homepage_content', e.target.value)}
          className="w-full h-48 px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Paste your homepage content here..."
        />
      </div>
      
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Additional Key Pages</h3>
        <p className="text-sm text-gray-600 mb-4">
          Include 2-3 other important pages (About Us, Product Features, etc.)
        </p>
        <textarea
          value={contentData.additional_pages}
          onChange={(e) => handleContentChange('additional_pages', e.target.value)}
          className="w-full h-48 px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Paste additional page content here..."
        />
      </div>
    </div>
  );

  const renderSocialMedia = () => (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Social Media Posts</h3>
        <p className="text-sm text-gray-600 mb-4">
          Copy 10-15 recent posts from LinkedIn, Twitter/X, Facebook, etc. Include both the text and any context.
        </p>
        <textarea
          value={contentData.social_media_posts}
          onChange={(e) => handleContentChange('social_media_posts', e.target.value)}
          className="w-full h-64 px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Example:&#10;[LinkedIn Post 1]&#10;Excited to announce our new feature...&#10;&#10;[Twitter Post 1]&#10;Quick tip for better productivity..."
        />
        <p className="text-xs text-gray-500 mt-2">
          Tip: Include posts from different platforms to capture voice variations
        </p>
      </div>
    </div>
  );

  const renderSupport = () => (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Customer Support Communications</h3>
        <p className="text-sm text-gray-600 mb-4">
          Include 5-10 help desk tickets or support emails YOU'VE WRITTEN (remove sensitive customer data)
        </p>
        <textarea
          value={contentData.support_communications}
          onChange={(e) => handleContentChange('support_communications', e.target.value)}
          className="w-full h-64 px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Example:&#10;Hi [Customer],&#10;&#10;Thanks for reaching out! I understand you're having trouble with...&#10;&#10;Here's how to resolve this:&#10;1. First...&#10;2. Then..."
        />
        <p className="text-xs text-gray-500 mt-2">
          Include both problem-solving responses and general inquiries
        </p>
      </div>
    </div>
  );

  const renderMarketing = () => (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Marketing Emails</h3>
        <p className="text-sm text-gray-600 mb-4">
          Include 3-5 recent marketing emails (newsletters, product updates, promotions)
        </p>
        <textarea
          value={contentData.marketing_emails}
          onChange={(e) => handleContentChange('marketing_emails', e.target.value)}
          className="w-full h-64 px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Example:&#10;Subject: Your Monthly Product Update&#10;&#10;Hi [Name],&#10;&#10;This month we've been busy..."
        />
      </div>
    </div>
  );

  const renderStorybrand = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 mb-2">StoryBrand Framework (Optional)</h3>
      <p className="text-sm text-gray-600 mb-4">
        If you've completed a StoryBrand exercise, fill in the framework below
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Character (Customer)
          </label>
          <textarea
            value={contentData.storybrand.character}
            onChange={(e) => handleStorybrandChange('character', e.target.value)}
            className="w-full h-24 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Who is your hero customer?"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Problem
          </label>
          <textarea
            value={contentData.storybrand.problem}
            onChange={(e) => handleStorybrandChange('problem', e.target.value)}
            className="w-full h-24 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="What problem do they face?"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Guide (Your Company)
          </label>
          <textarea
            value={contentData.storybrand.guide}
            onChange={(e) => handleStorybrandChange('guide', e.target.value)}
            className="w-full h-24 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="How do you guide them?"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Plan
          </label>
          <textarea
            value={contentData.storybrand.plan}
            onChange={(e) => handleStorybrandChange('plan', e.target.value)}
            className="w-full h-24 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Your 3-step plan"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Call to Action
          </label>
          <input
            type="text"
            value={contentData.storybrand.call_to_action}
            onChange={(e) => handleStorybrandChange('call_to_action', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Primary CTA"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Success
          </label>
          <textarea
            value={contentData.storybrand.success}
            onChange={(e) => handleStorybrandChange('success', e.target.value)}
            className="w-full h-24 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="What success looks like"
          />
        </div>
        
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Failure
          </label>
          <textarea
            value={contentData.storybrand.failure}
            onChange={(e) => handleStorybrandChange('failure', e.target.value)}
            className="w-full h-24 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="What they want to avoid"
          />
        </div>
      </div>
    </div>
  );

  const renderContext = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 mb-2">Additional Context (Optional)</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Industry/Niche
          </label>
          <input
            type="text"
            value={contentData.additional_context.industry}
            onChange={(e) => handleContextChange('industry', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., B2B SaaS, E-commerce, Healthcare"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Primary Audience
          </label>
          <input
            type="text"
            value={contentData.additional_context.primary_audience}
            onChange={(e) => handleContextChange('primary_audience', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., Marketing managers, Small business owners"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Company Stage
          </label>
          <select
            value={contentData.additional_context.company_stage}
            onChange={(e) => handleContextChange('company_stage', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="startup">Startup</option>
            <option value="growth">Growth</option>
            <option value="established">Established</option>
          </select>
        </div>
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Any specific voice guidelines you already follow
        </label>
        <textarea
          value={contentData.additional_context.existing_guidelines}
          onChange={(e) => handleContextChange('existing_guidelines', e.target.value)}
          className="w-full h-24 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="e.g., Always use 'we' not 'I', Avoid jargon, Keep sentences under 20 words..."
        />
      </div>
    </div>
  );


  const renderCurrentSection = () => {
    switch (currentSection) {
      case 'demo_videos': return renderDemoVideos();
      case 'website': return renderWebsiteContent();
      case 'social_media': return renderSocialMedia();
      case 'support': return renderSupport();
      case 'marketing': return renderMarketing();
      case 'storybrand': return renderStorybrand();
      case 'context': return renderContext();
      default: return renderDemoVideos();
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Brand Voice Analysis</h1>
        <p className="text-gray-600">
          Build your company knowledge base by providing actual content samples
        </p>
        
        <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-900">Completion Progress</p>
              <p className="text-xs text-blue-700 mt-1">
                Fill in at least 3 sections for best results
              </p>
            </div>
            <div className="text-2xl font-bold text-blue-600">
              {getCompletionPercentage()}%
            </div>
          </div>
          <div className="mt-3 w-full bg-blue-100 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${getCompletionPercentage()}%` }}
            />
          </div>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Sidebar Navigation */}
        <div className="w-64 flex-shrink-0">
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-medium text-gray-900 mb-4">Content Sections</h3>
            <nav className="space-y-1">
              {sections.map(section => (
                <button
                  key={section.id}
                  onClick={() => setCurrentSection(section.id)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    currentSection === section.id
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <span className="mr-2">{section.icon}</span>
                  {section.label}
                  {/* Show checkmark if section has content */}
                  {((section.id === 'demo_videos' && contentData.demo_videos.length > 100) ||
                    (section.id === 'website' && contentData.homepage_content.length > 100) ||
                    (section.id === 'social_media' && contentData.social_media_posts.length > 100) ||
                    (section.id === 'support' && contentData.support_communications.length > 100) ||
                    (section.id === 'marketing' && contentData.marketing_emails.length > 100)) && (
                    <span className="ml-1 text-green-600">✓</span>
                  )}
                </button>
              ))}
              
            </nav>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1">
          <div className="bg-white rounded-lg shadow p-6">
            {renderCurrentSection()}
            
            <div className="mt-8 flex justify-between">
              <button
                onClick={() => {
                  const sections = ['demo_videos', 'website', 'social_media', 'support', 'marketing', 'storybrand', 'context'];
                  const currentIndex = sections.indexOf(currentSection);
                  if (currentIndex > 0) {
                    setCurrentSection(sections[currentIndex - 1]);
                  }
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
                disabled={currentSection === 'demo_videos'}
              >
                ← Previous
              </button>
              
              <div className="flex gap-3">
                <button
                  onClick={handleSave}
                  disabled={isSaving || getCompletionPercentage() < 33}
                  className={`px-6 py-2 rounded-md font-medium ${
                    isSaving || getCompletionPercentage() < 33
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {isSaving ? (
                    <span className="flex items-center">
                      <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
                      Saving...
                    </span>
                  ) : (
                    'Save & Continue'
                  )}
                </button>
                
                {currentSection !== 'context' && (
                  <button
                    onClick={() => {
                      const sections = ['demo_videos', 'website', 'social_media', 'support', 'marketing', 'storybrand', 'context'];
                      const currentIndex = sections.indexOf(currentSection);
                      if (currentIndex < sections.length - 1) {
                        setCurrentSection(sections[currentIndex + 1]);
                      }
                    }}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800"
                  >
                    Next →
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BrandVoiceAnalyzer;
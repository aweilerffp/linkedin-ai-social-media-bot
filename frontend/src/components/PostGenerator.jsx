import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';

const PostGenerator = () => {
  const [transcripts, setTranscripts] = useState([]);
  const [selectedTranscript, setSelectedTranscript] = useState(null);
  const [hooks, setHooks] = useState([]);
  const [selectedHook, setSelectedHook] = useState(null);
  const [generatedPost, setGeneratedPost] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [postOptions, setPostOptions] = useState({
    post_length: 'medium',
    include_hashtags: true,
    include_emojis: true,
    call_to_action: 'engage'
  });

  // Load transcripts from the webhook AI processor
  useEffect(() => {
    loadTranscripts();
  }, []);

  const loadTranscripts = async () => {
    try {
      const response = await fetch('http://5.78.46.19:3002/api/transcripts');
      const data = await response.json();
      
      if (data.success) {
        setTranscripts(data.data);
      }
    } catch (error) {
      console.error('Error loading transcripts:', error);
      toast.error('Failed to load transcripts');
    }
  };

  const loadHooks = async (transcriptId) => {
    try {
      const response = await fetch(`http://5.78.46.19:3002/api/transcripts/${transcriptId}/hooks`);
      const data = await response.json();
      
      if (data.success) {
        setHooks(data.data);
      }
    } catch (error) {
      console.error('Error loading hooks:', error);
      toast.error('Failed to load marketing hooks');
    }
  };

  const handleTranscriptSelect = (transcript) => {
    setSelectedTranscript(transcript);
    setSelectedHook(null);
    setGeneratedPost(null);
    loadHooks(transcript.id);
  };

  const handleHookSelect = (hook) => {
    setSelectedHook(hook);
    setGeneratedPost(null);
  };

  const generatePost = async () => {
    if (!selectedHook) {
      toast.error('Please select a marketing hook first');
      return;
    }

    setIsGenerating(true);
    try {
      // For demo purposes, we'll simulate post generation
      // In production, this would call the backend API
      const mockPost = {
        post: `🚀 Just discovered something fascinating from our latest ${selectedTranscript?.title || 'meeting'}!\n\n${selectedHook.linkedin_post}\n\nThis isn't just about efficiency - it's about transforming how we approach ${selectedHook.pillar.toLowerCase()}.\n\n${selectedHook.source_quote}\n\nWhat strategies are you using to drive similar results in your organization? I'd love to hear your thoughts! 💭\n\n#Innovation #ProductivityHacks #BusinessStrategy #TeamWork #Growth`,
        hashtags: '#Innovation #ProductivityHacks #BusinessStrategy #TeamWork #Growth',
        metadata: {
          character_count: 0,
          word_count: 0,
          generated_at: new Date().toISOString()
        }
      };

      // Calculate actual counts
      mockPost.metadata.character_count = mockPost.post.length;
      mockPost.metadata.word_count = mockPost.post.split(/\s+/).length;

      setGeneratedPost(mockPost);
      toast.success('LinkedIn post generated successfully!');
    } catch (error) {
      console.error('Error generating post:', error);
      toast.error('Failed to generate post');
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">AI Content Generator</h1>
        <p className="text-gray-600">Transform meeting insights into engaging LinkedIn posts</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Transcripts Panel */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Meeting Transcripts</h2>
          
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {transcripts.length === 0 ? (
              <p className="text-gray-500 text-sm">No transcripts available</p>
            ) : (
              transcripts.map((transcript) => (
                <div
                  key={transcript.id}
                  onClick={() => handleTranscriptSelect(transcript)}
                  className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedTranscript?.id === transcript.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <h3 className="font-medium text-sm">{transcript.title}</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    {formatDate(transcript.meeting_date)}
                  </p>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                      {transcript.source}
                    </span>
                    <span className="text-xs text-blue-600">
                      {transcript.hooks_count} hooks
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          <button
            onClick={loadTranscripts}
            className="w-full mt-4 px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors text-sm"
          >
            Refresh Transcripts
          </button>
        </div>

        {/* Marketing Hooks Panel */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Marketing Hooks</h2>
          
          {selectedTranscript ? (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {hooks.length === 0 ? (
                <p className="text-gray-500 text-sm">No hooks available for this transcript</p>
              ) : (
                hooks.map((hook) => (
                  <div
                    key={hook.id}
                    onClick={() => handleHookSelect(hook)}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedHook?.id === hook.id
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                        {hook.pillar}
                      </span>
                      <span className="text-xs text-green-600 font-medium">
                        {(hook.insight_score * 100).toFixed(0)}%
                      </span>
                    </div>
                    
                    <p className="text-sm text-gray-700 mb-2">
                      "{hook.source_quote?.substring(0, 100)}..."
                    </p>
                    
                    <p className="text-xs text-gray-600">
                      {hook.linkedin_post?.substring(0, 120)}...
                    </p>
                  </div>
                ))
              )}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">Select a transcript to view marketing hooks</p>
          )}
        </div>

        {/* Post Generation Panel */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Generate LinkedIn Post</h2>
          
          {selectedHook ? (
            <div>
              {/* Post Options */}
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Post Length
                  </label>
                  <select
                    value={postOptions.post_length}
                    onChange={(e) => setPostOptions({...postOptions, post_length: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="short">Short (500-800 chars)</option>
                    <option value="medium">Medium (800-1500 chars)</option>
                    <option value="long">Long (1500-2200 chars)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Call to Action
                  </label>
                  <select
                    value={postOptions.call_to_action}
                    onChange={(e) => setPostOptions({...postOptions, call_to_action: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="engage">Encourage Engagement</option>
                    <option value="visit">Visit Website</option>
                    <option value="contact">Contact Us</option>
                    <option value="learn">Share Experience</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={postOptions.include_hashtags}
                      onChange={(e) => setPostOptions({...postOptions, include_hashtags: e.target.checked})}
                      className="mr-2"
                    />
                    <span className="text-sm">Include hashtags</span>
                  </label>
                  
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={postOptions.include_emojis}
                      onChange={(e) => setPostOptions({...postOptions, include_emojis: e.target.checked})}
                      className="mr-2"
                    />
                    <span className="text-sm">Include emojis</span>
                  </label>
                </div>
              </div>

              <button
                onClick={generatePost}
                disabled={isGenerating}
                className={`w-full px-4 py-3 rounded-md font-medium transition-colors ${
                  isGenerating
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {isGenerating ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Generating...
                  </div>
                ) : (
                  'Generate LinkedIn Post'
                )}
              </button>

              {/* Generated Post Display */}
              {generatedPost && (
                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="font-medium text-gray-900">Generated Post</h3>
                    <button
                      onClick={() => copyToClipboard(generatedPost.post)}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      Copy to Clipboard
                    </button>
                  </div>
                  
                  <div className="bg-white p-3 rounded border">
                    <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans">
                      {generatedPost.post}
                    </pre>
                  </div>
                  
                  <div className="flex justify-between text-xs text-gray-500 mt-2">
                    <span>{generatedPost.metadata.character_count} characters</span>
                    <span>{generatedPost.metadata.word_count} words</span>
                  </div>
                  
                  <div className="mt-3 flex space-x-2">
                    <button className="px-3 py-1 bg-green-100 text-green-800 rounded text-xs hover:bg-green-200">
                      Schedule Post
                    </button>
                    <button className="px-3 py-1 bg-blue-100 text-blue-800 rounded text-xs hover:bg-blue-200">
                      Edit Post
                    </button>
                    <button className="px-3 py-1 bg-purple-100 text-purple-800 rounded text-xs hover:bg-purple-200">
                      Generate Variations
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">Select a marketing hook to generate a LinkedIn post</p>
          )}
        </div>
      </div>

      {/* Status Bar */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center text-blue-800">
            <div className="w-2 h-2 bg-blue-600 rounded-full mr-2"></div>
            <span className="text-sm font-medium">AI Content Generation Active</span>
          </div>
          <div className="text-xs text-blue-600">
            Webhook: http://5.78.46.19:3002/api/webhooks/meeting-recorder
          </div>
        </div>
        <p className="text-xs text-blue-700 mt-2">
          New meeting transcripts will automatically generate marketing hooks and be available for post creation.
        </p>
      </div>
    </div>
  );
};

export default PostGenerator;
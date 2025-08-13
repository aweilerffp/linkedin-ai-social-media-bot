-- Create tables for AI content generation
-- PostgreSQL compatible version

-- Meeting Transcripts table
CREATE TABLE IF NOT EXISTS meeting_transcripts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL DEFAULT gen_random_uuid(),
    meeting_id VARCHAR(255) UNIQUE NOT NULL,
    title VARCHAR(500),
    meeting_date TIMESTAMP WITH TIME ZONE,
    duration INTEGER,
    participants JSONB,
    transcript_content TEXT NOT NULL,
    summary TEXT,
    metadata JSONB,
    source VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Webhook Events table
CREATE TABLE IF NOT EXISTS webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID,
    webhook_id VARCHAR(255) UNIQUE NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'received',
    payload JSONB NOT NULL,
    processing_started_at TIMESTAMP WITH TIME ZONE,
    processing_completed_at TIMESTAMP WITH TIME ZONE,
    processing_time_ms INTEGER,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    meeting_transcript_id UUID REFERENCES meeting_transcripts(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Marketing Hooks table
CREATE TABLE IF NOT EXISTS marketing_hooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL,
    meeting_transcript_id UUID NOT NULL REFERENCES meeting_transcripts(id) ON DELETE CASCADE,
    webhook_event_id UUID REFERENCES webhook_events(id) ON DELETE SET NULL,
    
    -- Hook content
    pillar VARCHAR(255) NOT NULL,
    source_quote TEXT NOT NULL,
    insight_score DECIMAL(3,2) CHECK (insight_score >= 0 AND insight_score <= 1),
    
    -- LinkedIn content
    linkedin_post TEXT NOT NULL,
    
    -- Blog content
    blog_title VARCHAR(500),
    blog_hook TEXT,
    
    -- Twitter content
    tweet VARCHAR(280),
    
    -- Metadata
    status VARCHAR(50) DEFAULT 'generated',
    approved_by UUID,
    approved_at TIMESTAMP WITH TIME ZONE,
    published_at TIMESTAMP WITH TIME ZONE,
    
    -- AI processing metadata
    model_used VARCHAR(100),
    tokens_used INTEGER,
    processing_cost DECIMAL(10,4),
    generation_timestamp TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Company Profiles table
CREATE TABLE IF NOT EXISTS company_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL,
    company_name VARCHAR(255) NOT NULL,
    industry VARCHAR(100),
    
    -- Brand voice configuration
    brand_voice JSONB NOT NULL DEFAULT '{}',
    
    -- Content pillars
    content_pillars JSONB NOT NULL DEFAULT '[]',
    
    -- Target personas
    target_personas JSONB NOT NULL DEFAULT '[]',
    
    -- Evaluation questions for AI processing
    evaluation_questions JSONB DEFAULT '[]',
    
    -- Visual style guide
    visual_style JSONB DEFAULT '{}',
    
    -- Slack configuration
    slack_config JSONB DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_meeting_transcripts_team_id ON meeting_transcripts(team_id);
CREATE INDEX IF NOT EXISTS idx_marketing_hooks_team_id ON marketing_hooks(team_id);
CREATE INDEX IF NOT EXISTS idx_company_profiles_team_id ON company_profiles(team_id);
CREATE INDEX IF NOT EXISTS idx_meeting_transcripts_meeting_id ON meeting_transcripts(meeting_id);
CREATE INDEX IF NOT EXISTS idx_marketing_hooks_transcript_id ON marketing_hooks(meeting_transcript_id);

-- Insert a default company profile for testing
INSERT INTO company_profiles (
    team_id, company_name, industry, brand_voice, content_pillars, target_personas, evaluation_questions
) VALUES (
    (SELECT id FROM (SELECT gen_random_uuid() as id) AS t),
    'TechCorp Solutions',
    'SaaS',
    '{"tone": ["professional", "innovative", "customer-focused"], "keywords": ["efficiency", "automation", "growth", "productivity"], "prohibited_terms": ["disruptive", "revolutionary"]}',
    '[{"title": "Product Innovation", "description": "Latest features and updates"}, {"title": "Customer Success", "description": "User stories and case studies"}, {"title": "Industry Insights", "description": "Market trends and analysis"}]',
    '[{"name": "Business Professionals", "pain_points": ["time management", "efficiency", "scaling operations"], "emotions": ["confidence", "success", "innovation"]}]',
    '["What specific problem does this solve?", "How does this align with our brand voice?", "What action should the reader take?", "Does this provide real value to our audience?"]'
) ON CONFLICT DO NOTHING;

-- Show table status
SELECT 'meeting_transcripts' as table_name, count(*) as row_count FROM meeting_transcripts
UNION ALL
SELECT 'marketing_hooks' as table_name, count(*) as row_count FROM marketing_hooks
UNION ALL
SELECT 'company_profiles' as table_name, count(*) as row_count FROM company_profiles;
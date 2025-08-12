-- Marketing Hooks and Webhook Events Schema
-- Created: 2025-08-12
-- Description: Schema for storing meeting transcripts, webhook events, and AI-generated marketing hooks

-- Meeting Transcripts table
CREATE TABLE IF NOT EXISTS meeting_transcripts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    meeting_id VARCHAR(255) UNIQUE NOT NULL,
    title VARCHAR(500),
    meeting_date TIMESTAMP WITH TIME ZONE,
    duration INTEGER, -- in seconds
    participants JSONB,
    transcript_content TEXT NOT NULL,
    summary TEXT,
    metadata JSONB, -- Store additional meeting metadata
    source VARCHAR(100), -- 'read.ai', 'zoom', 'custom', etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_meeting_transcripts_team_id (team_id),
    INDEX idx_meeting_transcripts_meeting_date (meeting_date),
    INDEX idx_meeting_transcripts_source (source)
);

-- Webhook Events table
CREATE TABLE IF NOT EXISTS webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    webhook_id VARCHAR(255) UNIQUE NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'received', -- received, processing, processed, failed
    payload JSONB NOT NULL,
    processing_started_at TIMESTAMP WITH TIME ZONE,
    processing_completed_at TIMESTAMP WITH TIME ZONE,
    processing_time_ms INTEGER,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    meeting_transcript_id UUID REFERENCES meeting_transcripts(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_webhook_events_team_id (team_id),
    INDEX idx_webhook_events_status (status),
    INDEX idx_webhook_events_event_type (event_type),
    INDEX idx_webhook_events_created_at (created_at DESC)
);

-- Marketing Hooks table
CREATE TABLE IF NOT EXISTS marketing_hooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
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
    status VARCHAR(50) DEFAULT 'generated', -- generated, approved, rejected, published
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    published_at TIMESTAMP WITH TIME ZONE,
    
    -- AI processing metadata
    model_used VARCHAR(100),
    tokens_used INTEGER,
    processing_cost DECIMAL(10,4),
    generation_timestamp TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_marketing_hooks_team_id (team_id),
    INDEX idx_marketing_hooks_transcript_id (meeting_transcript_id),
    INDEX idx_marketing_hooks_status (status),
    INDEX idx_marketing_hooks_pillar (pillar),
    INDEX idx_marketing_hooks_insight_score (insight_score DESC)
);

-- Hook Performance table (tracks engagement metrics)
CREATE TABLE IF NOT EXISTS hook_performance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    marketing_hook_id UUID NOT NULL REFERENCES marketing_hooks(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL, -- 'linkedin', 'twitter', 'blog'
    
    -- Engagement metrics
    views INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    shares INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    
    -- Calculated metrics
    engagement_rate DECIMAL(5,2),
    click_through_rate DECIMAL(5,2),
    
    measured_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_hook_performance_hook_id (marketing_hook_id),
    INDEX idx_hook_performance_platform (platform)
);

-- Company Profiles table (stores onboarding data for webhook processing)
CREATE TABLE IF NOT EXISTS company_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    company_name VARCHAR(255) NOT NULL,
    industry VARCHAR(100),
    
    -- Brand voice configuration
    brand_voice JSONB NOT NULL DEFAULT '{}',
    -- Expected structure:
    -- {
    --   "tone": ["professional", "friendly"],
    --   "keywords": ["innovation", "efficiency"],
    --   "prohibited_terms": ["revolutionary", "disruptive"]
    -- }
    
    -- Content pillars
    content_pillars JSONB NOT NULL DEFAULT '[]',
    -- Expected structure:
    -- [
    --   {"title": "Team Collaboration", "description": "...", "keywords": []}
    -- ]
    
    -- Target personas
    target_personas JSONB NOT NULL DEFAULT '[]',
    -- Expected structure:
    -- [
    --   {"name": "Team Leaders", "pain_points": [], "emotions": []}
    -- ]
    
    -- Evaluation questions for AI processing
    evaluation_questions JSONB DEFAULT '[]',
    
    -- Visual style guide
    visual_style JSONB DEFAULT '{}',
    
    -- Slack configuration
    slack_config JSONB DEFAULT '{}',
    
    -- Webhook authentication
    webhook_token VARCHAR(255) UNIQUE,
    webhook_secret VARCHAR(255),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_company_profiles_team_id (team_id),
    INDEX idx_company_profiles_webhook_token (webhook_token)
);

-- Processing Queue table (for async processing)
CREATE TABLE IF NOT EXISTS marketing_processing_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    webhook_event_id UUID NOT NULL REFERENCES webhook_events(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
    priority INTEGER DEFAULT 5,
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_processing_queue_status (status),
    INDEX idx_processing_queue_priority (priority DESC),
    INDEX idx_processing_queue_scheduled_at (scheduled_at)
);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to tables with updated_at
CREATE TRIGGER update_meeting_transcripts_updated_at 
    BEFORE UPDATE ON meeting_transcripts 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_marketing_hooks_updated_at 
    BEFORE UPDATE ON marketing_hooks 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_company_profiles_updated_at 
    BEFORE UPDATE ON company_profiles 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add indexes for common queries
CREATE INDEX idx_marketing_hooks_team_date ON marketing_hooks(team_id, created_at DESC);
CREATE INDEX idx_webhook_events_team_date ON webhook_events(team_id, created_at DESC);
CREATE INDEX idx_meeting_transcripts_team_date ON meeting_transcripts(team_id, meeting_date DESC);

-- Add foreign key constraints if not already present
ALTER TABLE marketing_hooks 
    ADD CONSTRAINT fk_marketing_hooks_team 
    FOREIGN KEY (team_id) 
    REFERENCES teams(id) 
    ON DELETE CASCADE;

-- Grant permissions (adjust based on your database users)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO your_app_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO your_app_user;

-- Add comments for documentation
COMMENT ON TABLE meeting_transcripts IS 'Stores meeting transcripts from webhook events';
COMMENT ON TABLE webhook_events IS 'Logs all incoming webhook events and their processing status';
COMMENT ON TABLE marketing_hooks IS 'AI-generated marketing insights extracted from meeting transcripts';
COMMENT ON TABLE hook_performance IS 'Tracks engagement metrics for published marketing hooks';
COMMENT ON TABLE company_profiles IS 'Stores company onboarding data for AI processing context';
COMMENT ON TABLE marketing_processing_queue IS 'Queue for async processing of webhook events';
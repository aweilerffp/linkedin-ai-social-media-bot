-- AI Features Database Schema Extension
-- This extends the existing social-media-poster schema with LinkedIn AI bot capabilities

-- Company profiles for brand voice and content strategy
CREATE TABLE company_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    company_name VARCHAR(255) NOT NULL,
    industry VARCHAR(100),
    brand_voice JSONB NOT NULL DEFAULT '{}',
    content_pillars JSONB NOT NULL DEFAULT '[]',
    target_personas JSONB NOT NULL DEFAULT '[]',
    evaluation_questions JSONB NOT NULL DEFAULT '[]',
    prompt_template_id UUID,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(team_id)
);

-- Knowledge stores for user-configurable brand information
CREATE TABLE knowledge_stores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_profile_id UUID REFERENCES company_profiles(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'brand_voice', 'top_posts', 'frameworks', 'company_info'
    query_key VARCHAR(100) NOT NULL,
    content TEXT NOT NULL,
    retrieval_count INTEGER DEFAULT 1,
    vector_embeddings VECTOR(1536), -- For similarity search
    is_active BOOLEAN DEFAULT true,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Version history for knowledge stores
CREATE TABLE knowledge_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    knowledge_store_id UUID REFERENCES knowledge_stores(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    content TEXT NOT NULL,
    changes_summary TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Reference posts for LinkedIn writing style
CREATE TABLE reference_posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_profile_id UUID REFERENCES company_profiles(id) ON DELETE CASCADE,
    platform VARCHAR(50) DEFAULT 'linkedin',
    content TEXT NOT NULL,
    performance_metrics JSONB DEFAULT '{}', -- engagement, clicks, etc.
    post_type VARCHAR(50), -- 'thought_leadership', 'case_study', 'industry_insight'
    engagement_score DECIMAL(3,2) DEFAULT 0.0,
    is_top_performer BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Content frameworks for engagement patterns
CREATE TABLE content_frameworks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_profile_id UUID REFERENCES company_profiles(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    structure JSONB NOT NULL, -- Framework template/structure
    use_cases TEXT[],
    effectiveness_score DECIMAL(3,2) DEFAULT 0.0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Visual style guides for image generation
CREATE TABLE visual_style_guides (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_profile_id UUID REFERENCES company_profiles(id) ON DELETE CASCADE,
    colors JSONB NOT NULL DEFAULT '{}', -- primary, secondary, accent colors
    illustration_style JSONB NOT NULL DEFAULT '{}',
    visual_elements JSONB NOT NULL DEFAULT '{}', -- industry-specific elements
    restrictions TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Visual elements library for reusable components
CREATE TABLE visual_elements_library (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    visual_style_guide_id UUID REFERENCES visual_style_guides(id) ON DELETE CASCADE,
    category VARCHAR(100), -- 'dashboards', 'interfaces', 'dataViz', etc.
    elements TEXT[],
    usage_frequency INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Prompt templates for customized AI generation
CREATE TABLE prompt_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_profile_id UUID REFERENCES company_profiles(id) ON DELETE CASCADE,
    template_type VARCHAR(50) NOT NULL, -- 'hook_generator', 'post_writer', 'image_prompt'
    template_content TEXT NOT NULL,
    variables JSONB DEFAULT '{}', -- Template variables and their sources
    version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    performance_score DECIMAL(3,2) DEFAULT 0.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Meeting transcripts from webhook sources
CREATE TABLE meeting_transcripts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    webhook_source VARCHAR(100), -- 'read.ai', 'otter.ai', 'fireflies.ai', etc.
    meeting_id VARCHAR(255),
    title VARCHAR(500),
    transcript_content TEXT NOT NULL,
    participants JSONB DEFAULT '[]',
    duration_minutes INTEGER,
    meeting_date TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}',
    processed BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Marketing insights extracted from transcripts
CREATE TABLE marketing_insights (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transcript_id UUID REFERENCES meeting_transcripts(id) ON DELETE CASCADE,
    company_profile_id UUID REFERENCES company_profiles(id) ON DELETE CASCADE,
    pillar VARCHAR(255),
    source_quote TEXT,
    blog_title VARCHAR(500),
    blog_hook TEXT,
    linkedin_hook TEXT, -- 150-word hook
    tweet_content VARCHAR(280),
    insight_score DECIMAL(3,2) DEFAULT 0.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- LinkedIn posts generated from hooks
CREATE TABLE linkedin_posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    insight_id UUID REFERENCES marketing_insights(id) ON DELETE CASCADE,
    original_post_id UUID REFERENCES posts(id) ON DELETE SET NULL,
    hook_text TEXT,
    full_content TEXT NOT NULL,
    character_count INTEGER,
    reading_level DECIMAL(3,1),
    keywords_used TEXT[],
    story_architecture VARCHAR(100),
    engagement_score DECIMAL(3,2) DEFAULT 0.0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Image prompts for DALL-E generation
CREATE TABLE image_prompts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    linkedin_post_id UUID REFERENCES linkedin_posts(id) ON DELETE CASCADE,
    visual_style_guide_id UUID REFERENCES visual_style_guides(id) ON DELETE SET NULL,
    prompt_text TEXT NOT NULL,
    alt_text VARCHAR(120),
    prompt_length INTEGER,
    visual_concept VARCHAR(255),
    style_elements TEXT[],
    color_palette JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Generated images with metadata
CREATE TABLE images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    image_prompt_id UUID REFERENCES image_prompts(id) ON DELETE CASCADE,
    dalle_image_url TEXT NOT NULL,
    local_image_path TEXT,
    image_hash VARCHAR(64),
    dimensions JSONB, -- width, height
    file_size INTEGER,
    generation_cost DECIMAL(10,4),
    quality_score DECIMAL(3,2),
    approved BOOLEAN DEFAULT false,
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Queue schedule for automated posting
CREATE TABLE queue_schedule (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    linkedin_post_id UUID REFERENCES linkedin_posts(id) ON DELETE CASCADE,
    image_id UUID REFERENCES images(id) ON DELETE SET NULL,
    scheduled_time TIMESTAMP WITH TIME ZONE NOT NULL,
    queue_position INTEGER,
    priority INTEGER DEFAULT 5, -- 1-10, higher is more priority
    status VARCHAR(50) DEFAULT 'queued', -- 'queued', 'approved', 'posting', 'posted', 'failed'
    approval_required BOOLEAN DEFAULT true,
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMP WITH TIME ZONE,
    posted_at TIMESTAMP WITH TIME ZONE,
    linkedin_post_url TEXT,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Post performance tracking
CREATE TABLE post_performance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    linkedin_post_id UUID REFERENCES linkedin_posts(id) ON DELETE CASCADE,
    post_id UUID REFERENCES posts(id) ON DELETE SET NULL,
    linkedin_post_url TEXT,
    views INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    shares INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    engagement_rate DECIMAL(5,2) DEFAULT 0.0,
    reach INTEGER DEFAULT 0,
    impressions INTEGER DEFAULT 0,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    raw_metrics JSONB DEFAULT '{}'
);

-- Audit logs for AI operations
CREATE TABLE audit_logs_ai (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    operation_type VARCHAR(100) NOT NULL, -- 'hook_generation', 'post_creation', 'image_generation', etc.
    entity_type VARCHAR(50),
    entity_id UUID,
    operation_data JSONB DEFAULT '{}',
    ai_model_used VARCHAR(100),
    tokens_used INTEGER,
    cost DECIMAL(10,4),
    processing_time_ms INTEGER,
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Extend existing posts table with AI metadata
ALTER TABLE posts ADD COLUMN IF NOT EXISTS ai_generated BOOLEAN DEFAULT false;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS linkedin_post_id UUID REFERENCES linkedin_posts(id) ON DELETE SET NULL;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS generation_metadata JSONB DEFAULT '{}';
ALTER TABLE posts ADD COLUMN IF NOT EXISTS approval_status VARCHAR(50) DEFAULT 'pending'; -- 'pending', 'approved', 'rejected', 'revision_requested'

-- Create indexes for performance
CREATE INDEX idx_company_profiles_team_id ON company_profiles(team_id);
CREATE INDEX idx_knowledge_stores_company_profile_id ON knowledge_stores(company_profile_id);
CREATE INDEX idx_knowledge_stores_type ON knowledge_stores(type);
CREATE INDEX idx_knowledge_versions_store_id ON knowledge_versions(knowledge_store_id);
CREATE INDEX idx_reference_posts_company_profile_id ON reference_posts(company_profile_id);
CREATE INDEX idx_reference_posts_performance ON reference_posts(engagement_score DESC);
CREATE INDEX idx_meeting_transcripts_team_id ON meeting_transcripts(team_id);
CREATE INDEX idx_meeting_transcripts_processed ON meeting_transcripts(processed);
CREATE INDEX idx_marketing_insights_transcript_id ON marketing_insights(transcript_id);
CREATE INDEX idx_marketing_insights_company_profile_id ON marketing_insights(company_profile_id);
CREATE INDEX idx_linkedin_posts_insight_id ON linkedin_posts(insight_id);
CREATE INDEX idx_image_prompts_linkedin_post_id ON image_prompts(linkedin_post_id);
CREATE INDEX idx_images_prompt_id ON images(image_prompt_id);
CREATE INDEX idx_queue_schedule_team_id ON queue_schedule(team_id);
CREATE INDEX idx_queue_schedule_status ON queue_schedule(status);
CREATE INDEX idx_queue_schedule_time ON queue_schedule(scheduled_time);
CREATE INDEX idx_post_performance_linkedin_post_id ON post_performance(linkedin_post_id);
CREATE INDEX idx_audit_logs_ai_team_id ON audit_logs_ai(team_id);
CREATE INDEX idx_audit_logs_ai_operation ON audit_logs_ai(operation_type);

-- Add triggers for updated_at columns
CREATE TRIGGER update_company_profiles_updated_at BEFORE UPDATE ON company_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_knowledge_stores_updated_at BEFORE UPDATE ON knowledge_stores
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reference_posts_updated_at BEFORE UPDATE ON reference_posts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_content_frameworks_updated_at BEFORE UPDATE ON content_frameworks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_visual_style_guides_updated_at BEFORE UPDATE ON visual_style_guides
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_prompt_templates_updated_at BEFORE UPDATE ON prompt_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_meeting_transcripts_updated_at BEFORE UPDATE ON meeting_transcripts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_linkedin_posts_updated_at BEFORE UPDATE ON linkedin_posts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_queue_schedule_updated_at BEFORE UPDATE ON queue_schedule
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create views for common queries
CREATE VIEW v_company_dashboard AS
SELECT 
    cp.id,
    cp.company_name,
    cp.industry,
    cp.team_id,
    COUNT(DISTINCT mt.id) as total_transcripts,
    COUNT(DISTINCT mi.id) as total_insights,
    COUNT(DISTINCT lp.id) as total_posts,
    COUNT(DISTINCT qs.id) as queued_posts,
    AVG(pp.engagement_rate) as avg_engagement_rate
FROM company_profiles cp
LEFT JOIN meeting_transcripts mt ON mt.team_id = cp.team_id
LEFT JOIN marketing_insights mi ON mi.company_profile_id = cp.id
LEFT JOIN linkedin_posts lp ON lp.insight_id = mi.id
LEFT JOIN queue_schedule qs ON qs.linkedin_post_id = lp.id AND qs.status = 'queued'
LEFT JOIN post_performance pp ON pp.linkedin_post_id = lp.id
WHERE cp.is_active = true
GROUP BY cp.id, cp.company_name, cp.industry, cp.team_id;

CREATE VIEW v_content_pipeline AS
SELECT 
    mt.id as transcript_id,
    mt.title as meeting_title,
    mt.meeting_date,
    COUNT(mi.id) as insights_count,
    COUNT(lp.id) as posts_count,
    COUNT(CASE WHEN qs.status = 'approved' THEN 1 END) as approved_posts,
    COUNT(CASE WHEN qs.status = 'posted' THEN 1 END) as published_posts
FROM meeting_transcripts mt
LEFT JOIN marketing_insights mi ON mi.transcript_id = mt.id
LEFT JOIN linkedin_posts lp ON lp.insight_id = mi.id
LEFT JOIN queue_schedule qs ON qs.linkedin_post_id = lp.id
GROUP BY mt.id, mt.title, mt.meeting_date
ORDER BY mt.meeting_date DESC;

-- Insert default content frameworks
INSERT INTO content_frameworks (id, company_profile_id, name, description, structure, use_cases, effectiveness_score, is_active) VALUES
(uuid_generate_v4(), NULL, 'Problem-Agitation-Solution', 'Classic persuasion framework identifying pain points and providing solutions', 
 '{"hook": "contrarian_statement", "body": ["problem_identification", "agitation", "solution_reveal"], "cta": "engagement_question"}',
 ARRAY['thought_leadership', 'product_insights', 'industry_commentary'], 0.85, true),
(uuid_generate_v4(), NULL, 'Case Study Format', 'Story-driven format showcasing real customer success', 
 '{"hook": "result_teaser", "body": ["situation", "challenge", "solution", "results"], "cta": "experience_question"}',
 ARRAY['customer_success', 'product_demos', 'social_proof'], 0.92, true),
(uuid_generate_v4(), NULL, 'Industry Insight', 'Educational content positioning company as thought leader', 
 '{"hook": "surprising_statistic", "body": ["trend_analysis", "implications", "expert_perspective"], "cta": "opinion_question"}',
 ARRAY['market_analysis', 'trend_commentary', 'expert_positioning'], 0.78, true);
-- Webhook configuration table
CREATE TABLE webhook_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    url VARCHAR(2048) NOT NULL,
    events JSONB NOT NULL,
    secret VARCHAR(255),
    name VARCHAR(100),
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(team_id, url)
);

-- Create enum for webhook delivery status
CREATE TYPE webhook_delivery_status AS ENUM ('success', 'failed', 'pending');

-- Webhook deliveries table for tracking delivery history
CREATE TABLE webhook_deliveries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    webhook_config_id UUID REFERENCES webhook_configs(id) ON DELETE CASCADE,
    event VARCHAR(100) NOT NULL,
    status webhook_delivery_status DEFAULT 'pending',
    response_code INTEGER,
    response_body JSONB,
    metadata JSONB,
    delivered_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX idx_webhook_configs_team_id ON webhook_configs(team_id);
CREATE INDEX idx_webhook_configs_is_active ON webhook_configs(is_active);
CREATE INDEX idx_webhook_configs_events ON webhook_configs USING GIN (events);

CREATE INDEX idx_webhook_deliveries_config_id ON webhook_deliveries(webhook_config_id);
CREATE INDEX idx_webhook_deliveries_event ON webhook_deliveries(event);
CREATE INDEX idx_webhook_deliveries_status ON webhook_deliveries(status);
CREATE INDEX idx_webhook_deliveries_created_at ON webhook_deliveries(created_at);
CREATE INDEX idx_webhook_deliveries_delivered_at ON webhook_deliveries(delivered_at);

-- Add function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger for webhook_configs
CREATE TRIGGER webhook_configs_updated_at
    BEFORE UPDATE ON webhook_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();
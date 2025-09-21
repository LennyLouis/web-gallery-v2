-- Create access_links table
CREATE TABLE IF NOT EXISTS access_links (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    token VARCHAR(255) UNIQUE NOT NULL,
    album_id UUID NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    used_count INTEGER DEFAULT 0,
    max_uses INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes for better performance
CREATE UNIQUE INDEX IF NOT EXISTS access_links_token_idx ON access_links(token);
CREATE INDEX IF NOT EXISTS access_links_album_id_idx ON access_links(album_id);
CREATE INDEX IF NOT EXISTS access_links_created_by_idx ON access_links(created_by);
CREATE INDEX IF NOT EXISTS access_links_is_active_idx ON access_links(is_active);
CREATE INDEX IF NOT EXISTS access_links_expires_at_idx ON access_links(expires_at);

-- Enable Row Level Security
ALTER TABLE access_links ENABLE ROW LEVEL SECURITY;

-- Create policies for access_links
CREATE POLICY "Users can view access links for their albums" ON access_links
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM albums
            WHERE albums.id = access_links.album_id
            AND albums.owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can create access links for their albums" ON access_links
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM albums
            WHERE albums.id = access_links.album_id
            AND albums.owner_id = auth.uid()
        )
        AND auth.uid() = created_by
    );

CREATE POLICY "Users can update access links for their albums" ON access_links
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM albums
            WHERE albums.id = access_links.album_id
            AND albums.owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete access links for their albums" ON access_links
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM albums
            WHERE albums.id = access_links.album_id
            AND albums.owner_id = auth.uid()
        )
    );

-- Create trigger to update updated_at column
CREATE TRIGGER update_access_links_updated_at
    BEFORE UPDATE ON access_links
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Create function to check if access link is valid
CREATE OR REPLACE FUNCTION is_access_link_valid(link_token VARCHAR)
RETURNS BOOLEAN AS $$
DECLARE
    link_record access_links%ROWTYPE;
BEGIN
    SELECT * INTO link_record
    FROM access_links
    WHERE token = link_token
    AND is_active = true;

    -- If no record found, return false
    IF NOT FOUND THEN
        RETURN false;
    END IF;

    -- Check expiration
    IF link_record.expires_at IS NOT NULL AND link_record.expires_at < now() THEN
        RETURN false;
    END IF;

    -- Check max uses
    IF link_record.max_uses IS NOT NULL AND link_record.used_count >= link_record.max_uses THEN
        RETURN false;
    END IF;

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
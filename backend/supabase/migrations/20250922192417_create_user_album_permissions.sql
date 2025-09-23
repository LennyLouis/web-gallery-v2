-- Create user_album_permissions table for granular permissions
CREATE TABLE IF NOT EXISTS user_album_permissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    album_id UUID NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
    permission_type VARCHAR(20) NOT NULL DEFAULT 'view' CHECK (permission_type IN ('view', 'download', 'manage')),
    granted_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

    -- Ensure unique constraint per user-album-permission combination
    UNIQUE(user_id, album_id, permission_type)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS user_album_permissions_user_id_idx ON user_album_permissions(user_id);
CREATE INDEX IF NOT EXISTS user_album_permissions_album_id_idx ON user_album_permissions(album_id);
CREATE INDEX IF NOT EXISTS user_album_permissions_granted_by_idx ON user_album_permissions(granted_by);
CREATE INDEX IF NOT EXISTS user_album_permissions_is_active_idx ON user_album_permissions(is_active);
CREATE INDEX IF NOT EXISTS user_album_permissions_expires_at_idx ON user_album_permissions(expires_at);

-- Enable Row Level Security
ALTER TABLE user_album_permissions ENABLE ROW LEVEL SECURITY;

-- Create policies for user_album_permissions
-- Users can see permissions granted to them
CREATE POLICY "Users can view permissions granted to them" ON user_album_permissions
    FOR SELECT USING (user_id = auth.uid());

-- Album owners can see all permissions for their albums
CREATE POLICY "Album owners can view all permissions for their albums" ON user_album_permissions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM albums
            WHERE albums.id = user_album_permissions.album_id
            AND albums.owner_id = auth.uid()
        )
    );

-- Album owners can create permissions for their albums
CREATE POLICY "Album owners can create permissions for their albums" ON user_album_permissions
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM albums
            WHERE albums.id = user_album_permissions.album_id
            AND albums.owner_id = auth.uid()
        )
        AND auth.uid() = granted_by
    );

-- Album owners can update permissions for their albums
CREATE POLICY "Album owners can update permissions for their albums" ON user_album_permissions
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM albums
            WHERE albums.id = user_album_permissions.album_id
            AND albums.owner_id = auth.uid()
        )
    );

-- Album owners can delete permissions for their albums
CREATE POLICY "Album owners can delete permissions for their albums" ON user_album_permissions
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM albums
            WHERE albums.id = user_album_permissions.album_id
            AND albums.owner_id = auth.uid()
        )
    );

-- Create trigger to update updated_at column
CREATE TRIGGER update_user_album_permissions_updated_at
    BEFORE UPDATE ON user_album_permissions
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Create function to check if user has permission on album
CREATE OR REPLACE FUNCTION user_has_album_permission(
    target_user_id UUID,
    target_album_id UUID,
    required_permission VARCHAR DEFAULT 'view'
)
RETURNS BOOLEAN AS $$
DECLARE
    album_record albums%ROWTYPE;
    permission_record user_album_permissions%ROWTYPE;
BEGIN
    -- Get album info
    SELECT * INTO album_record FROM albums WHERE id = target_album_id;

    -- If album doesn't exist, return false
    IF NOT FOUND THEN
        RETURN false;
    END IF;

    -- If user is the album owner, they have all permissions
    IF album_record.owner_id = target_user_id THEN
        RETURN true;
    END IF;

    -- If album is public and only view permission is required
    IF album_record.is_public = true AND required_permission = 'view' THEN
        RETURN true;
    END IF;

    -- Check explicit permissions
    SELECT * INTO permission_record
    FROM user_album_permissions
    WHERE user_id = target_user_id
    AND album_id = target_album_id
    AND permission_type = required_permission
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now());

    -- Return true if permission found
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create helper function to get user permissions for an album
CREATE OR REPLACE FUNCTION get_user_album_permissions(target_user_id UUID, target_album_id UUID)
RETURNS TABLE(permission_type VARCHAR, granted_at TIMESTAMP WITH TIME ZONE, expires_at TIMESTAMP WITH TIME ZONE) AS $$
DECLARE
    album_record albums%ROWTYPE;
BEGIN
    -- Get album info
    SELECT * INTO album_record FROM albums WHERE id = target_album_id;

    -- If album doesn't exist, return empty
    IF NOT FOUND THEN
        RETURN;
    END IF;

    -- If user is the album owner, they have all permissions
    IF album_record.owner_id = target_user_id THEN
        RETURN QUERY VALUES
            ('view'::VARCHAR, now()::TIMESTAMP WITH TIME ZONE, NULL::TIMESTAMP WITH TIME ZONE),
            ('download'::VARCHAR, now()::TIMESTAMP WITH TIME ZONE, NULL::TIMESTAMP WITH TIME ZONE),
            ('manage'::VARCHAR, now()::TIMESTAMP WITH TIME ZONE, NULL::TIMESTAMP WITH TIME ZONE);
        RETURN;
    END IF;

    -- If album is public, user has view permission
    IF album_record.is_public = true THEN
        RETURN QUERY VALUES ('view'::VARCHAR, album_record.created_at, NULL::TIMESTAMP WITH TIME ZONE);
    END IF;

    -- Return explicit permissions
    RETURN QUERY
    SELECT uap.permission_type, uap.granted_at, uap.expires_at
    FROM user_album_permissions uap
    WHERE uap.user_id = target_user_id
    AND uap.album_id = target_album_id
    AND uap.is_active = true
    AND (uap.expires_at IS NULL OR uap.expires_at > now());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
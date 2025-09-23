-- Add permission_type column to access_links table
-- This allows specifying different permission levels for access links

-- Add the permission_type column
ALTER TABLE access_links 
ADD COLUMN permission_type VARCHAR(20) DEFAULT 'view' CHECK (permission_type IN ('view', 'download'));

-- Update existing records to have 'view' permission (safe default)
UPDATE access_links SET permission_type = 'view' WHERE permission_type IS NULL;

-- Make the column NOT NULL after setting default values
ALTER TABLE access_links ALTER COLUMN permission_type SET NOT NULL;

-- Create index for better performance on permission_type queries
CREATE INDEX IF NOT EXISTS access_links_permission_type_idx ON access_links(permission_type);

-- Update the function that checks access link validity to include permission type
CREATE OR REPLACE FUNCTION is_access_link_valid_with_permission(link_token VARCHAR, required_permission VARCHAR DEFAULT 'view')
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

    -- Check permission level
    -- 'download' permission includes 'view' permission
    -- 'view' permission only allows viewing
    IF required_permission = 'download' AND link_record.permission_type != 'download' THEN
        RETURN false;
    END IF;

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comment explaining the permission levels
COMMENT ON COLUMN access_links.permission_type IS 'Permission level for access link: view (can only view photos) or download (can view and download photos)';
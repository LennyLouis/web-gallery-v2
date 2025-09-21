-- Create albums table
CREATE TABLE IF NOT EXISTS albums (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    date DATE,
    tags TEXT[] DEFAULT '{}',
    location VARCHAR(255),
    is_public BOOLEAN DEFAULT false,
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS albums_owner_id_idx ON albums(owner_id);
CREATE INDEX IF NOT EXISTS albums_is_public_idx ON albums(is_public);
CREATE INDEX IF NOT EXISTS albums_created_at_idx ON albums(created_at DESC);
CREATE INDEX IF NOT EXISTS albums_tags_idx ON albums USING GIN(tags);

-- Enable Row Level Security
ALTER TABLE albums ENABLE ROW LEVEL SECURITY;

-- Create policies for albums
CREATE POLICY "Users can view their own albums" ON albums
    FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "Users can view public albums" ON albums
    FOR SELECT USING (is_public = true);

CREATE POLICY "Users can create their own albums" ON albums
    FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their own albums" ON albums
    FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete their own albums" ON albums
    FOR DELETE USING (auth.uid() = owner_id);

-- Create trigger to update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_albums_updated_at
    BEFORE UPDATE ON albums
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
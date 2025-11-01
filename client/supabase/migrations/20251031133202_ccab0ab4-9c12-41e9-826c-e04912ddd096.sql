-- Create profiles table for user data
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Create linked_accounts table for Google Drive connections
CREATE TABLE IF NOT EXISTS public.linked_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  access_token TEXT,
  token_expiry TIMESTAMP WITH TIME ZONE,
  total_space BIGINT DEFAULT 16106127360, -- 15GB in bytes
  used_space BIGINT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on linked_accounts
ALTER TABLE public.linked_accounts ENABLE ROW LEVEL SECURITY;

-- Linked accounts policies
CREATE POLICY "Users can view their own linked accounts"
  ON public.linked_accounts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own linked accounts"
  ON public.linked_accounts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own linked accounts"
  ON public.linked_accounts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own linked accounts"
  ON public.linked_accounts FOR DELETE
  USING (auth.uid() = user_id);

-- Create files table
CREATE TABLE IF NOT EXISTS public.files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  size BIGINT NOT NULL,
  mime_type TEXT,
  total_chunks INTEGER DEFAULT 1,
  upload_status TEXT DEFAULT 'pending', -- pending, uploading, completed, failed
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on files
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;

-- Files policies
CREATE POLICY "Users can view their own files"
  ON public.files FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own files"
  ON public.files FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own files"
  ON public.files FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own files"
  ON public.files FOR DELETE
  USING (auth.uid() = user_id);

-- Create chunks table
CREATE TABLE IF NOT EXISTS public.chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID NOT NULL REFERENCES public.files(id) ON DELETE CASCADE,
  linked_account_id UUID NOT NULL REFERENCES public.linked_accounts(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  drive_file_id TEXT,
  size BIGINT NOT NULL,
  upload_status TEXT DEFAULT 'pending', -- pending, uploading, completed, failed
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(file_id, chunk_index)
);

-- Enable RLS on chunks
ALTER TABLE public.chunks ENABLE ROW LEVEL SECURITY;

-- Chunks policies (access through file ownership)
CREATE POLICY "Users can view chunks of their own files"
  ON public.chunks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.files
      WHERE files.id = chunks.file_id
      AND files.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert chunks for their own files"
  ON public.chunks FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.files
      WHERE files.id = chunks.file_id
      AND files.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update chunks of their own files"
  ON public.chunks FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.files
      WHERE files.id = chunks.file_id
      AND files.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete chunks of their own files"
  ON public.chunks FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.files
      WHERE files.id = chunks.file_id
      AND files.user_id = auth.uid()
    )
  );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create triggers for updated_at
CREATE TRIGGER set_updated_at_profiles
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_linked_accounts
  BEFORE UPDATE ON public.linked_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_files
  BEFORE UPDATE ON public.files
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_chunks
  BEFORE UPDATE ON public.chunks
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
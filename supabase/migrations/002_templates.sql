CREATE TABLE session_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  name text not null,
  description text,
  discipline text,
  total_duration integer,
  intensity_level text,
  genre_preference text,
  blocks jsonb,
  emoji text default '📋',
  created_at timestamptz default now()
);

ALTER TABLE session_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own templates"
  ON session_templates FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

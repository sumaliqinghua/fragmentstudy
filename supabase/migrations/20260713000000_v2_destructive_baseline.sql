-- Destructive v2 baseline. Apply only after an explicit backup and rollout decision.
DROP TABLE IF EXISTS article_tags, tags, quiz_questions, article_text_qa, article_text_annotations,
  dialogue_qa, dialogue_messages, galgame_messages, card_notes, ai_conversations, highlights,
  bookmarks, rewards, learning_progress, cards, articles CASCADE;

CREATE TABLE projects (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL REFERENCES auth.users(id), title text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE materials (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL REFERENCES auth.users(id), title text NOT NULL, source_type text NOT NULL, content text NOT NULL, source_url text, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE project_materials (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL REFERENCES auth.users(id), project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE, material_id uuid NOT NULL REFERENCES materials(id) ON DELETE CASCADE, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(project_id, material_id));
CREATE TABLE sections (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL REFERENCES auth.users(id), project_material_id uuid NOT NULL REFERENCES project_materials(id) ON DELETE CASCADE, title text NOT NULL, sequence_order integer NOT NULL);
CREATE TABLE fragments (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL REFERENCES auth.users(id), project_material_id uuid NOT NULL REFERENCES project_materials(id) ON DELETE CASCADE, section_id uuid REFERENCES sections(id) ON DELETE SET NULL, sequence_order integer NOT NULL, content text NOT NULL, source_text text NOT NULL, source_start integer NOT NULL, source_end integer NOT NULL);
CREATE TABLE generation_jobs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL REFERENCES auth.users(id), project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE, project_material_id uuid REFERENCES project_materials(id) ON DELETE CASCADE, status text NOT NULL, version integer NOT NULL, idempotency_key text NOT NULL, error text, attempts integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(project_id, idempotency_key));
CREATE TABLE experiences (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL REFERENCES auth.users(id), project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE, mode text NOT NULL);
CREATE TABLE experience_items (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL REFERENCES auth.users(id), experience_id uuid NOT NULL REFERENCES experiences(id) ON DELETE CASCADE, fragment_id uuid NOT NULL REFERENCES fragments(id) ON DELETE CASCADE, sequence_order integer NOT NULL);
CREATE TABLE sessions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL REFERENCES auth.users(id), project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE, project_material_id uuid NOT NULL REFERENCES project_materials(id) ON DELETE CASCADE, experience_id uuid NOT NULL REFERENCES experiences(id) ON DELETE CASCADE, mode text NOT NULL CHECK (mode IN ('card','dialogue','galgame')), status text NOT NULL CHECK (status IN ('ready','active','paused','ended')), current_item_index integer NOT NULL DEFAULT 0 CHECK (current_item_index >= 0), started_at timestamptz NOT NULL DEFAULT now(), ended_at timestamptz, end_reason text CHECK (end_reason IN ('completed','enough_for_today','switch_mode')));
CREATE TABLE exposures (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL REFERENCES auth.users(id), session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE, experience_item_id uuid NOT NULL REFERENCES experience_items(id) ON DELETE CASCADE, exposed_at timestamptz NOT NULL DEFAULT now());

CREATE FUNCTION enforce_v2_parent_ownership() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE parent_owned boolean;
BEGIN
  CASE TG_TABLE_NAME
    WHEN 'project_materials' THEN SELECT EXISTS (SELECT 1 FROM projects p JOIN materials m ON true WHERE p.id = NEW.project_id AND m.id = NEW.material_id AND p.owner_id = NEW.owner_id AND m.owner_id = NEW.owner_id) INTO parent_owned;
    WHEN 'sections' THEN SELECT EXISTS (SELECT 1 FROM project_materials p WHERE p.id = NEW.project_material_id AND p.owner_id = NEW.owner_id) INTO parent_owned;
    WHEN 'fragments' THEN SELECT EXISTS (SELECT 1 FROM project_materials p WHERE p.id = NEW.project_material_id AND p.owner_id = NEW.owner_id) AND (NEW.section_id IS NULL OR EXISTS (SELECT 1 FROM sections s WHERE s.id = NEW.section_id AND s.project_material_id = NEW.project_material_id AND s.owner_id = NEW.owner_id)) INTO parent_owned;
    WHEN 'generation_jobs' THEN SELECT EXISTS (SELECT 1 FROM projects p WHERE p.id = NEW.project_id AND p.owner_id = NEW.owner_id) AND (NEW.project_material_id IS NULL OR EXISTS (SELECT 1 FROM project_materials pm WHERE pm.id = NEW.project_material_id AND pm.project_id = NEW.project_id AND pm.owner_id = NEW.owner_id)) INTO parent_owned;
    WHEN 'experiences' THEN SELECT EXISTS (SELECT 1 FROM projects p WHERE p.id = NEW.project_id AND p.owner_id = NEW.owner_id) INTO parent_owned;
    WHEN 'experience_items' THEN SELECT EXISTS (SELECT 1 FROM experiences e JOIN fragments f ON f.id = NEW.fragment_id JOIN project_materials pm ON pm.id = f.project_material_id WHERE e.id = NEW.experience_id AND pm.project_id = e.project_id AND e.owner_id = NEW.owner_id AND f.owner_id = NEW.owner_id AND pm.owner_id = NEW.owner_id) INTO parent_owned;
    WHEN 'sessions' THEN SELECT EXISTS (SELECT 1 FROM experiences e JOIN project_materials pm ON pm.id = NEW.project_material_id WHERE e.id = NEW.experience_id AND e.project_id = NEW.project_id AND e.mode = NEW.mode AND pm.project_id = NEW.project_id AND e.owner_id = NEW.owner_id AND pm.owner_id = NEW.owner_id) INTO parent_owned;
    WHEN 'exposures' THEN SELECT EXISTS (SELECT 1 FROM sessions s JOIN experience_items i ON i.id = NEW.experience_item_id WHERE s.id = NEW.session_id AND i.experience_id = s.experience_id AND s.owner_id = NEW.owner_id AND i.owner_id = NEW.owner_id) INTO parent_owned;
    ELSE parent_owned := true;
  END CASE;
  IF NOT parent_owned THEN RAISE EXCEPTION 'parent row is not owned by owner_id'; END IF;
  RETURN NEW;
END $$;

DO $$ DECLARE table_name text; BEGIN
  FOREACH table_name IN ARRAY ARRAY['project_materials','sections','fragments','generation_jobs','experiences','experience_items','sessions','exposures'] LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION enforce_v2_parent_ownership()', table_name || '_parent_owner', table_name);
  END LOOP;
END $$;

DO $$ DECLARE table_name text; BEGIN
  FOREACH table_name IN ARRAY ARRAY['projects','materials','project_materials','sections','fragments','generation_jobs','experiences','experience_items','sessions','exposures'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('CREATE POLICY %I ON %I FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid())', table_name || '_owner', table_name);
  END LOOP;
END $$;
-- No policies are granted to anon; RLS therefore denies all anonymous access.

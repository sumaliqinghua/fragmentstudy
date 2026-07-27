ALTER TABLE public.markdown_reader_annotations
  ADD COLUMN highlight_active boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.markdown_reader_annotations.highlight_active IS
  'Controls only the visible Markdown highlight; quoted text, note, and chat remain durable.';

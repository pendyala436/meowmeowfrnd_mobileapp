-- Gender-split private groups visibility (men vs women).
-- Legacy private_groups_enabled remains as fallback when gender keys are missing.

INSERT INTO public.app_settings (setting_key, setting_value, setting_type, is_public, description)
VALUES
  (
    'private_groups_enabled_men',
    'true'::jsonb,
    'json',
    true,
    'Show Group Call tab and allow new private group joins for men.'
  ),
  (
    'private_groups_enabled_women',
    'true'::jsonb,
    'json',
    true,
    'Show Group Call tab and allow new private group hosts/joins for women.'
  )
ON CONFLICT (setting_key) DO NOTHING;

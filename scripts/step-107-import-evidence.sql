-- Step 107 Sergey pilot evidence executor.
-- Operational tooling only: no schema changes and no canonical mutation.
-- Caller must create/populate temp table step107_source_items in the same session:
--   observation_id uuid, fragment_id uuid, capture_idempotency_key uuid,
--   source_kind text, source_locator text, occurred_at timestamptz,
--   occurred_precision text, local_calendar_date date, exact_text text,
--   content_hash text.
-- Caller must set session-local GUCs before execution:
--   select set_config('realme.step107_world_id', '<server-derived-world-uuid>', true);
--   select set_config('realme.step107_account_id', '<authenticated-account-uuid>', true);

DO $$
DECLARE
  v_world_id uuid := current_setting('realme.step107_world_id')::uuid;
  v_account_id uuid := current_setting('realme.step107_account_id')::uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.world_memberships AS membership
    WHERE membership.world_id = v_world_id
      AND membership.user_id = v_account_id
      AND membership.role = 'owner'
  ) THEN
    RAISE EXCEPTION 'Step 107 importer requires the owning account and server-derived World.';
  END IF;
END;
$$;

INSERT INTO public.observations (
  id,
  world_id,
  recorded_by_account_id,
  source_kind,
  source_locator,
  occurred_at,
  occurred_precision,
  local_calendar_date,
  capture_idempotency_key
)
SELECT
  source.observation_id,
  current_setting('realme.step107_world_id')::uuid,
  current_setting('realme.step107_account_id')::uuid,
  source.source_kind,
  source.source_locator,
  source.occurred_at,
  source.occurred_precision,
  source.local_calendar_date,
  source.capture_idempotency_key
FROM step107_source_items AS source
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.source_fragments (
  id,
  world_id,
  observation_id,
  ordinal,
  exact_text,
  content_hash
)
SELECT
  source.fragment_id,
  current_setting('realme.step107_world_id')::uuid,
  source.observation_id,
  0,
  source.exact_text,
  source.content_hash
FROM step107_source_items AS source
ON CONFLICT (id) DO NOTHING;

DO $$
DECLARE
  v_world_id uuid := current_setting('realme.step107_world_id')::uuid;
  v_account_id uuid := current_setting('realme.step107_account_id')::uuid;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM step107_source_items AS source
    LEFT JOIN public.observations AS observation
      ON observation.world_id = v_world_id
     AND observation.id = source.observation_id
    LEFT JOIN public.source_fragments AS fragment
      ON fragment.world_id = v_world_id
     AND fragment.id = source.fragment_id
    WHERE observation.id IS NULL
       OR fragment.id IS NULL
       OR observation.recorded_by_account_id IS DISTINCT FROM v_account_id
       OR observation.source_kind IS DISTINCT FROM source.source_kind
       OR observation.source_locator IS DISTINCT FROM source.source_locator
       OR observation.occurred_at IS DISTINCT FROM source.occurred_at
       OR observation.occurred_precision IS DISTINCT FROM source.occurred_precision
       OR observation.local_calendar_date IS DISTINCT FROM source.local_calendar_date
       OR observation.capture_idempotency_key IS DISTINCT FROM source.capture_idempotency_key
       OR fragment.observation_id IS DISTINCT FROM source.observation_id
       OR fragment.ordinal <> 0
       OR fragment.exact_text IS DISTINCT FROM source.exact_text
       OR fragment.content_hash IS DISTINCT FROM source.content_hash
  ) THEN
    RAISE EXCEPTION 'Step 107 replay mismatch: persisted evidence differs from pinned source plan.';
  END IF;
END;
$$;

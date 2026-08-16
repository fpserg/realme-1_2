# Supabase Edge Functions

Bounded consumers for Supabase Queues will live here. Queue transport never replaces RealMe’s canonical job records. Consumers must load canonical job state, be idempotent, checkpoint bounded work and leave failed messages available for controlled retry.

No worker or provider-specific job is introduced during Step 96.

import postgres from "postgres";

import type {
  ClaimedInterpretationJob,
  InterpretationFailureCode,
  InterpretationJobRepository,
} from "@/application/interpretation/interpret-observation";

type SqlClient = ReturnType<typeof postgres>;

interface ClaimedRow {
  attempts: number;
  id: string;
  lock_token: string;
  observation_id: string;
  world_id: string;
}

interface EvidenceRow {
  content_hash: string;
  exact_text: string;
  id: string;
  ordinal: number;
}

export function interpretationDatabaseUrl(environment = process.env) {
  const value = environment.REALME_INTERPRETATION_DATABASE_URL;
  if (!value) throw new Error("Interpretation database is not configured.");
  const url = new URL(value);
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new Error("Interpretation database is not configured.");
  }
  return value;
}

export function createInterpretationDatabaseClient(
  url = interpretationDatabaseUrl(),
) {
  return postgres(url, {
    idle_timeout: 2,
    max: 1,
    max_lifetime: 60,
    prepare: true,
  });
}

export class PostgresInterpretationJobRepository
  implements InterpretationJobRepository
{
  constructor(private readonly sql: SqlClient) {}

  async claim(workerId: string): Promise<ClaimedInterpretationJob | null> {
    return this.sql.begin(async (transaction) => {
      const rows = await transaction<ClaimedRow[]>`
        with claimable as (
          select job.id
          from public.jobs as job
          where job.job_kind = 'interpret_observation'
            and job.attempts < job.max_attempts
            and (
              (job.status = 'queued' and job.available_at <= clock_timestamp())
              or (
                job.status = 'running'
                and job.locked_at < clock_timestamp() - interval '5 minutes'
              )
            )
          order by job.available_at, job.created_at, job.id
          for update skip locked
          limit 1
        )
        update public.jobs as job
        set status = 'running',
            attempts = job.attempts + 1,
            locked_at = clock_timestamp(),
            lock_token = ${workerId}::uuid,
            updated_at = clock_timestamp()
        from claimable
        where job.id = claimable.id
        returning job.id, job.world_id, job.observation_id,
                  job.attempts, job.lock_token
      `;
      const row = rows[0];
      if (!row) return null;

      await transaction`
        update public.interpretation_runs
        set status = 'failed', completed_at = clock_timestamp(),
            failure_code = 'timeout'
        where job_id = ${row.id}::uuid
          and status = 'running'
          and attempt_number < ${row.attempts}
      `;

      const evidence = await transaction<EvidenceRow[]>`
        select fragment.id, fragment.ordinal, fragment.exact_text,
               fragment.content_hash
        from public.source_fragments as fragment
        where fragment.world_id = ${row.world_id}::uuid
          and fragment.observation_id = ${row.observation_id}::uuid
        order by fragment.ordinal, fragment.id
      `;

      return {
        attemptNumber: row.attempts,
        evidence: evidence.map((fragment) => ({
          contentHash: fragment.content_hash,
          exactText: fragment.exact_text,
          id: fragment.id,
          ordinal: fragment.ordinal,
        })),
        id: row.id,
        lockToken: row.lock_token,
        observationId: row.observation_id,
        worldId: row.world_id,
      };
    });
  }

  async startRun(input: {
    inputHash: string;
    job: ClaimedInterpretationJob;
    model: string;
    promptVersion: string;
    provider: string;
    schemaVersion: string;
  }) {
    const rows = await this.sql<{ id: string }[]>`
      insert into public.interpretation_runs (
        world_id, job_id, observation_id, attempt_number, status,
        provider, model, prompt_version, schema_version, input_hash,
        started_at
      )
      select job.world_id, job.id, job.observation_id, job.attempts, 'running',
             ${input.provider}, ${input.model}, ${input.promptVersion},
             ${input.schemaVersion}, ${input.inputHash}, clock_timestamp()
      from public.jobs as job
      where job.id = ${input.job.id}::uuid
        and job.world_id = ${input.job.worldId}::uuid
        and job.status = 'running'
        and job.lock_token = ${input.job.lockToken}::uuid
        and job.attempts = ${input.job.attemptNumber}
      on conflict (job_id, attempt_number) do update
        set job_id = excluded.job_id
      returning id
    `;
    const row = rows[0];
    if (!row)
      throw new Error("Interpretation claim is no longer authoritative.");
    return row.id;
  }

  async complete(
    input: Parameters<InterpretationJobRepository["complete"]>[0],
  ) {
    await this.sql.begin(async (transaction) => {
      const claims = await transaction<{ id: string }[]>`
        select id
        from public.jobs
        where id = ${input.job.id}::uuid
          and world_id = ${input.job.worldId}::uuid
          and status = 'running'
          and lock_token = ${input.job.lockToken}::uuid
          and attempts = ${input.job.attemptNumber}
        for update
      `;
      if (!claims[0]) throw new Error("Interpretation claim is stale.");

      const runs = await transaction<{ id: string }[]>`
        select id
        from public.interpretation_runs
        where id = ${input.runId}::uuid
          and world_id = ${input.job.worldId}::uuid
          and job_id = ${input.job.id}::uuid
          and status = 'running'
        for update
      `;
      if (!runs[0]) throw new Error("Interpretation run is not completable.");

      for (const candidate of input.candidates) {
        const candidates = await transaction<{ id: string }[]>`
          insert into public.candidate_claims (
            world_id, interpretation_run_id, job_id, logical_key,
            proposed_subject_node_id, claim_kind, payload
          ) values (
            ${input.job.worldId}::uuid,
            ${input.runId}::uuid,
            ${input.job.id}::uuid,
            ${candidate.logicalKey},
            null,
            'proposition',
            ${transaction.json(candidate.payload)}
          )
          returning id
        `;
        const candidateId = candidates[0]?.id;
        if (!candidateId) throw new Error("Candidate persistence failed.");

        for (const fragmentId of candidate.evidenceFragmentIds) {
          await transaction`
            insert into public.candidate_claim_evidence (
              world_id, candidate_claim_id, source_fragment_id
            ) values (
              ${input.job.worldId}::uuid,
              ${candidateId}::uuid,
              ${fragmentId}::uuid
            )
          `;
        }
      }

      const completedRuns = await transaction`
        update public.interpretation_runs
        set status = 'succeeded', completed_at = clock_timestamp(), failure_code = null
        where id = ${input.runId}::uuid
          and status = 'running'
      `;
      if (completedRuns.count !== 1) {
        throw new Error("Interpretation run completion failed.");
      }

      const completedJobs = await transaction`
        update public.jobs
        set status = 'succeeded', locked_at = null, lock_token = null,
            last_failure_code = null, updated_at = clock_timestamp()
        where id = ${input.job.id}::uuid
          and status = 'running'
          and lock_token = ${input.job.lockToken}::uuid
      `;
      if (completedJobs.count !== 1) {
        throw new Error("Interpretation job completion failed.");
      }
    });
  }

  async fail(input: {
    code: InterpretationFailureCode;
    job: ClaimedInterpretationJob;
    retryable: boolean;
    runId: string | null;
  }) {
    return this.sql.begin(async (transaction) => {
      const jobs = await transaction<
        { attempts: number; max_attempts: number }[]
      >`
        select attempts, max_attempts
        from public.jobs
        where id = ${input.job.id}::uuid
          and world_id = ${input.job.worldId}::uuid
          and status = 'running'
          and lock_token = ${input.job.lockToken}::uuid
        for update
      `;
      const job = jobs[0];
      if (!job) return "stale" as const;

      if (input.runId) {
        await transaction`
          update public.interpretation_runs
          set status = 'failed', completed_at = clock_timestamp(),
              failure_code = ${input.code}
          where id = ${input.runId}::uuid
            and job_id = ${input.job.id}::uuid
            and status = 'running'
        `;
      }

      const retry = input.retryable && job.attempts < job.max_attempts;
      const terminalCode =
        job.attempts >= job.max_attempts ? "exhausted" : input.code;
      await transaction`
        update public.jobs
        set status = ${retry ? "queued" : "failed"},
            available_at = case
              when ${retry} then clock_timestamp()
                + make_interval(secs => least(1800, 30 * power(2, attempts - 1))::integer)
              else available_at
            end,
            locked_at = null,
            lock_token = null,
            last_failure_code = ${terminalCode},
            updated_at = clock_timestamp()
        where id = ${input.job.id}::uuid
          and lock_token = ${input.job.lockToken}::uuid
      `;
      return retry ? ("queued" as const) : ("failed" as const);
    });
  }
}

import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { userInfo } from "node:os";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Opt-in LOCAL Unix-socket database only. Never read a deployed DATABASE_URL.
describe.skipIf(process.env.REALME_LOCAL_SQL_TESTS !== "1")(
  "Phase 4P real PostgreSQL",
  () => {
    const database = `realme_phase4p_${randomUUID().replaceAll("-", "")}`;
    const config = {
      host: "/var/run/postgresql",
      username: userInfo().username,
      max: 1,
      onnotice: () => {},
    };
    let admin, db, account, world, otherAccount, otherWorld;
    const v2 = "candidate-set-v2";
    const simple = (
      subject = "Plan",
      predicate = "progressed",
      object = true,
    ) => ({ kind: "proposition", subject, predicate, object });
    const qualified = () => ({
      ...simple(
        "Plan",
        "requires_remaining_time",
        "approximately one to two more days",
      ),
      kind: "epistemic_proposition",
      epistemic: { actor: "Owner", mode: "estimate" },
    });
    const counts = () =>
      db`select (select count(*)::int from assertions) ordinary, (select count(*)::int from epistemic_assertions) epistemic`;
    const asUser = (actor, fn) =>
      db.begin(async (tx) => {
        await tx`select set_config('request.jwt.claim.sub',${actor},true)`;
        await tx`set local role authenticated`;
        return fn(tx);
      });
    const decide = (
      id,
      action = "accept",
      correction = null,
      actor = account,
    ) =>
      asUser(
        actor,
        (tx) =>
          tx`select * from public.decide_candidate(${id}::uuid,${action},${correction === null ? null : tx.json(correction)})`,
      );
    async function candidate(
      meaning = qualified(),
      w = world,
      owner = account,
      schema = v2,
    ) {
      const [o] =
        await db`insert into observations(world_id,recorded_by_account_id,source_kind) values(${w},${owner},'synthetic') returning id`;
      const [f] =
        await db`insert into source_fragments(world_id,observation_id,ordinal,exact_text,content_hash) values(${w},${o.id},0,'Synthetic local test evidence.','synthetic') returning id`;
      const prompt =
        schema === v2 ? "interpret-observation-v4" : "interpret-observation-v3";
      const [j] =
        await db`insert into jobs(world_id,observation_id,job_kind,idempotency_key,payload) values(${w},${o.id},'interpret_observation',${randomUUID()},${db.json({ prompt_version: prompt, schema_version: schema })}) returning id`;
      const [r] =
        await db`insert into interpretation_runs(world_id,job_id,observation_id,attempt_number,status,provider,model,prompt_version,schema_version,input_hash,started_at,completed_at) values(${w},${j.id},${o.id},1,'succeeded','synthetic','synthetic',${prompt},${schema},'synthetic',now(),now()) returning id`;
      const payload = {
        ...meaning,
        confidence: 0.9,
        explanation: "Synthetic explanation.",
        schema_version: schema,
      };
      if (schema !== v2) delete payload.kind;
      const [c] =
        await db`insert into candidate_claims(world_id,interpretation_run_id,job_id,logical_key,claim_kind,payload) values(${w},${r.id},${j.id},${randomUUID()},${meaning.kind},${db.json(payload)}) returning id`;
      await db`insert into candidate_claim_evidence(world_id,candidate_claim_id,source_fragment_id) values(${w},${c.id},${f.id})`;
      return {
        id: c.id,
        fragment: f.id,
        observation: o.id,
        job: j.id,
        run: r.id,
      };
    }
    async function createIdentity(label, w = world, owner = account) {
      const c = await candidate(
        simple(label, "classification", "synthetic entity"),
        w,
        owner,
      );
      const [result] = await decide(c.id, "accept", null, owner);
      return result.canonical_node_id;
    }
    beforeAll(async () => {
      admin = postgres({ ...config, database: "postgres" });
      for (const role of ["anon", "authenticated", "service_role"]) {
        if (!(await admin`select 1 from pg_roles where rolname=${role}`).length)
          await admin.unsafe(`CREATE ROLE ${role} NOLOGIN`);
      }
      await admin.unsafe(`CREATE DATABASE ${database}`);
      db = postgres({ ...config, database });
      await db.unsafe(
        "CREATE SCHEMA auth; CREATE SCHEMA extensions; CREATE EXTENSION pgcrypto WITH SCHEMA extensions; CREATE TABLE auth.users(id uuid PRIMARY KEY); CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; GRANT USAGE ON SCHEMA auth TO authenticated; GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;",
      );
      for (const name of (await readdir("supabase/migrations"))
        .filter((n) => n.endsWith(".sql"))
        .sort()) {
        try {
          await db.unsafe(
            await readFile(`supabase/migrations/${name}`, "utf8"),
          );
        } catch (error) {
          throw new Error(
            `${name}: ${error.message}; position ${error.position}; ${error.where ?? ""}; ${error.detail ?? ""}`,
          );
        }
      }
      account = randomUUID();
      otherAccount = randomUUID();
      await db`insert into auth.users(id) values(${account}),(${otherAccount})`;
      [{ id: world }] =
        await db`select id from worlds where initial_owner_id=${account}`;
      [{ id: otherWorld }] =
        await db`select id from worlds where initial_owner_id=${otherAccount}`;
      await createIdentity("Plan");
      await createIdentity("Owner");
    }, 60_000);
    afterAll(async () => {
      if (db) await db.end();
      if (admin) {
        await admin.unsafe(`DROP DATABASE IF EXISTS ${database}`);
        await admin.end();
      }
    });

    it("admits the WHOLE epistemic unit without its ordinary core; replays exactly once", async () => {
      const before = (await counts())[0];
      const c = await candidate();
      const [a] = await decide(c.id);
      const [b] = await decide(c.id);
      expect(a.canonical_assertion_id).toBeNull();
      expect(a.canonical_epistemic_assertion_id).toBeTruthy();
      expect(b.was_replay).toBe(true);
      expect(b.canonical_epistemic_assertion_id).toBe(
        a.canonical_epistemic_assertion_id,
      );
      expect((await counts())[0]).toEqual({
        ordinary: before.ordinary,
        epistemic: before.epistemic + 1,
      });
      const links =
        await db`select source_fragment_id from epistemic_assertion_evidence where epistemic_assertion_id=${a.canonical_epistemic_assertion_id}`;
      expect(links.map((l) => l.source_fragment_id)).toEqual([c.fragment]);
      await expect(
        db`insert into assertions(world_id,subject_node_id,predicate,value,admitted_by_decision_id) select world_id,subject_node_id,predicate,value,admitted_by_decision_id from epistemic_assertions where id=${a.canonical_epistemic_assertion_id}`,
      ).rejects.toThrow("Embedded epistemic");
    });
    it("coexists even with identical semantic content and distinct admissions", async () => {
      const a = await candidate(),
        b = await candidate();
      const [x] = await decide(a.id),
        [y] = await decide(b.id);
      expect(x.canonical_epistemic_assertion_id).not.toBe(
        y.canonical_epistemic_assertion_id,
      );
      const rows =
        await db`select valid_to,supersedes_epistemic_assertion_id from epistemic_assertions where id in (${x.canonical_epistemic_assertion_id},${y.canonical_epistemic_assertion_id})`;
      expect(rows).toHaveLength(2);
      for (const row of rows)
        expect(row).toEqual({
          valid_to: null,
          supersedes_epistemic_assertion_id: null,
        });
    });
    it("only explicit corrected lineage supersedes; complete correction controls replay", async () => {
      const old = await candidate();
      const [a] = await decide(old.id);
      const c = await candidate();
      const correction = {
        ...qualified(),
        object: "approximately three to four more days",
        schema_version: v2,
        supersedes_epistemic_assertion_id: a.canonical_epistemic_assertion_id,
      };
      const [b] = await decide(c.id, "correct", correction);
      expect((await decide(c.id, "correct", correction))[0].was_replay).toBe(
        true,
      );
      await expect(
        decide(c.id, "correct", {
          ...correction,
          epistemic: { actor: "Owner", mode: "belief" },
        }),
      ).rejects.toThrow("replay payload");
      const [row] =
        await db`select * from epistemic_assertions where id=${b.canonical_epistemic_assertion_id}`;
      expect(row.supersedes_epistemic_assertion_id).toBe(
        a.canonical_epistemic_assertion_id,
      );
      expect(
        (
          await db`select valid_to from epistemic_assertions where id=${a.canonical_epistemic_assertion_id}`
        )[0].valid_to,
      ).not.toBeNull();
      await expect(
        db`update epistemic_assertions set value='"rewritten"' where id=${b.canonical_epistemic_assertion_id}`,
      ).rejects.toThrow("explicit correction");
      await expect(
        db`delete from epistemic_assertions where id=${b.canonical_epistemic_assertion_id}`,
      ).rejects.toThrow("append-only");
    });
    it("rejects cross-World supersession and evidence even when the UUIDs exist", async () => {
      await createIdentity("Plan", otherWorld, otherAccount);
      await createIdentity("Owner", otherWorld, otherAccount);
      const foreignCandidate = await candidate(
        qualified(),
        otherWorld,
        otherAccount,
      );
      const [foreign] = await decide(
        foreignCandidate.id,
        "accept",
        null,
        otherAccount,
      );
      const localCandidate = await candidate();
      await expect(
        decide(localCandidate.id, "correct", {
          ...qualified(),
          schema_version: v2,
          supersedes_epistemic_assertion_id:
            foreign.canonical_epistemic_assertion_id,
        }),
      ).rejects.toThrow("predecessor unavailable");
      await expect(
        db`insert into epistemic_assertion_evidence(world_id,epistemic_assertion_id,source_fragment_id) values(${world},${foreign.canonical_epistemic_assertion_id},${localCandidate.fragment})`,
      ).rejects.toThrow();
    });
    it("fails closed for unresolved or ambiguous actor/core and cross-World identities", async () => {
      for (const meaning of [
        { ...qualified(), subject: "Missing" },
        { ...qualified(), epistemic: { actor: "Missing", mode: "belief" } },
      ]) {
        const c = await candidate(meaning);
        await expect(decide(c.id)).rejects.toThrow("unresolved or ambiguous");
      }
      await createIdentity("OtherWorldOnly", otherWorld, otherAccount);
      const c = await candidate({
        ...qualified(),
        epistemic: { actor: "OtherWorldOnly", mode: "belief" },
      });
      await expect(decide(c.id)).rejects.toThrow("unresolved or ambiguous");
      const ambiguous = await createIdentity("SecondOwner");
      await db`update ontology_aliases set alias='Owner' where world_id=${world} and node_id=${ambiguous}`;
      const d = await candidate();
      await expect(decide(d.id)).rejects.toThrow("unresolved or ambiguous");
      const subjectAmbiguous = await candidate({
        ...qualified(),
        subject: "Owner",
        epistemic: { actor: "Plan", mode: "belief" },
      });
      await expect(decide(subjectAmbiguous.id)).rejects.toThrow(
        "unresolved or ambiguous",
      );
    });
    it("reject/defer remain non-canonical; explicit conversion is required", async () => {
      const before = (await counts())[0];
      const c = await candidate();
      await decide(c.id, "defer");
      await decide(c.id, "reject");
      expect((await counts())[0]).toEqual(before);
      const d = await candidate();
      await expect(
        decide(d.id, "correct", {
          subject: "Plan",
          predicate: "progressed",
          object: true,
        }),
      ).rejects.toThrow("Complete candidate-set-v2");
      const [r] = await decide(d.id, "correct", {
        ...simple(),
        schema_version: v2,
      });
      expect(r.canonical_assertion_id).toBeTruthy();
      expect(r.canonical_epistemic_assertion_id).toBeNull();
    });
    it("preserves historical v1 candidate admission and simple v2 assertion semantics", async () => {
      const c = await candidate(
        simple("Plan", "historical_fact", true),
        world,
        account,
        "candidate-set-v1",
      );
      const [a] = await decide(c.id);
      const d = await candidate(simple("Plan", "historical_fact", false));
      const [b] = await decide(d.id);
      expect(b.superseded_assertion_id).toBe(a.canonical_assertion_id);
    });
    it("denies unauthenticated/cross-World decisions and direct canonical writes", async () => {
      const c = await candidate();
      await expect(decide(c.id, "accept", null, otherAccount)).rejects.toThrow(
        "outside",
      );
      await expect(decide(c.id, "accept", null, "")).rejects.toThrow(
        "Authentication required",
      );
      await expect(
        asUser(account, (tx) => tx`delete from epistemic_assertions`),
      ).rejects.toThrow("permission denied");
      const grants =
        await db`select has_table_privilege('anon','public.epistemic_assertions','INSERT') a,has_table_privilege('authenticated','public.epistemic_assertions','INSERT') b,has_table_privilege('authenticated','public.epistemic_assertion_evidence','UPDATE') c`;
      expect(grants[0]).toEqual({ a: false, b: false, c: false });
      expect(
        await asUser(
          otherAccount,
          (tx) => tx`select * from epistemic_assertions`,
        ),
      ).toHaveLength(0);
    });
    it("rejects malformed schemas, nested/participant/unsupported modes", async () => {
      for (const mode of ["other", "participant", "with", null])
        await expect(
          candidate({ ...qualified(), epistemic: { actor: "Owner", mode } }),
        ).rejects.toThrow();
      await expect(
        candidate({
          ...qualified(),
          epistemic: { actor: "Owner", mode: "estimate", with: "Someone" },
        }),
      ).rejects.toThrow();
      await expect(
        candidate({ ...qualified(), object: { subject: "nested" } }),
      ).rejects.toThrow();
    });
    it("v4/v2 is a closed durable pair; historical pairs remain allowed", async () => {
      const c = await candidate(simple());
      for (const prompt of [
        "interpret-observation-v1",
        "interpret-observation-v2",
        "interpret-observation-v3",
        "interpret-observation-v4",
      ]) {
        await db`insert into jobs(world_id,observation_id,job_kind,idempotency_key,payload) values(${world},${c.observation},'interpret_observation',${randomUUID()},${db.json({ prompt_version: prompt, schema_version: prompt.endsWith("v4") ? v2 : "candidate-set-v1" })})`;
      }
      for (const payload of [
        { prompt_version: "unknown", schema_version: v2 },
        {
          prompt_version: "interpret-observation-v4",
          schema_version: "candidate-set-v1",
        },
        { prompt_version: "interpret-observation-v3", schema_version: v2 },
        { prompt_version: null, schema_version: v2 },
      ]) {
        await expect(
          db`insert into jobs(world_id,observation_id,job_kind,idempotency_key,payload) values(${world},${c.observation},'interpret_observation',${randomUUID()},${db.json(payload)})`,
        ).rejects.toThrow();
      }
    });
  },
);

import { createClient } from "@supabase/supabase-js";

const url = process.env.REALME_TEST_SUPABASE_URL;
const publishableKey = process.env.REALME_TEST_SUPABASE_PUBLISHABLE_KEY;
const fixtureJson = process.env.REALME_TEST_FIXTURE_JSON;

if (!url || !publishableKey || !fixtureJson) {
  throw new Error(
    "Synthetic staging URL, publishable key and fixture JSON are required.",
  );
}

const fixture = JSON.parse(fixtureJson);
const password = fixture.password;

function client() {
  return createClient(url, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

const users = ["a", "b"].map((label, index) => ({
  client: client(),
  email: fixture.users[index].email,
  id: fixture.users[index].id,
  label,
}));

for (const user of users) {
  const { error } = await user.client.auth.signInWithPassword({
    email: user.email,
    password,
  });
  if (error) {
    throw new Error(`Synthetic ${user.label} sign-in failed: ${error.message}`);
  }
}

async function ownSnapshot(user) {
  const [accounts, worlds, memberships, companions] = await Promise.all([
    user.client.from("accounts").select("id"),
    user.client.from("worlds").select("id, initial_owner_id"),
    user.client.from("world_memberships").select("world_id, user_id, role"),
    user.client.from("companions").select("id, world_id"),
  ]);

  for (const [name, result] of Object.entries({
    accounts,
    companions,
    memberships,
    worlds,
  })) {
    if (result.error)
      throw new Error(`${user.label} ${name}: ${result.error.message}`);
    if (result.data.length !== 1) {
      throw new Error(`${user.label} must see exactly one ${name} row.`);
    }
  }

  return {
    accountId: accounts.data[0].id,
    companionId: companions.data[0].id,
    membership: memberships.data[0],
    worldId: worlds.data[0].id,
  };
}

const [snapshotA, snapshotB] = await Promise.all(
  users.map((user) => ownSnapshot(user)),
);

const crossChecks = await Promise.all([
  users[0].client.from("accounts").select("id").eq("id", snapshotB.accountId),
  users[0].client.from("worlds").select("id").eq("id", snapshotB.worldId),
  users[0].client
    .from("world_memberships")
    .select("world_id")
    .eq("user_id", snapshotB.accountId),
  users[0].client
    .from("companions")
    .select("id")
    .eq("id", snapshotB.companionId),
]);

for (const result of crossChecks) {
  if (result.error)
    throw new Error(
      `Cross-World read failed unexpectedly: ${result.error.message}`,
    );
  if (result.data.length !== 0) {
    throw new Error("Cross-World RLS isolation failed.");
  }
}

const forbiddenWrite = await users[0].client
  .from("worlds")
  .insert({ initial_owner_id: users[0].id })
  .select("id");

if (!forbiddenWrite.error) {
  throw new Error("Authenticated client unexpectedly inserted a World.");
}

console.log(
  JSON.stringify({
    event: "step-97-rls-verified",
    assertions: {
      crossWorldReadsReturnedZeroRows: crossChecks.length,
      directWorldInsertDenied: true,
      eachUserAccounts: 1,
      eachUserCompanions: 1,
      eachUserMemberships: 1,
      eachUserWorlds: 1,
      identitiesAreDistinct:
        snapshotA.worldId !== snapshotB.worldId &&
        snapshotA.companionId !== snapshotB.companionId,
    },
    syntheticUserIds: users.map((user) => user.id),
  }),
);

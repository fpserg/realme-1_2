import { expect, test } from "@playwright/test";

test("serves the mobile Step 102 candidate boundary without configured secrets", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "A private World begins here." }),
  ).toBeVisible();
  await expect(page.getByText("Build not configured")).toBeVisible();

  const response = await page.request.get("/api/health");
  expect(response.ok()).toBe(true);
  await expect(response.json()).resolves.toMatchObject({
    status: "ok",
    service: "realme-1-2",
    phase: "step-102-implementation-candidate",
  });
});

test("keeps the integrated core loop perceivable at mobile viewport", async ({
  page,
}) => {
  await page.goto("/e2e-integrated");

  const navigation = page.getByRole("navigation", { name: "RealMe core loop" });
  await expect(navigation).toBeVisible();

  for (const name of [
    "Capture",
    "Companion",
    "Review",
    "Today & Horizon",
    "World",
  ]) {
    await expect(navigation.getByRole("link", { name })).toBeVisible();
  }

  await navigation.getByRole("link", { name: "Capture" }).click();
  await expect(
    page.getByRole("region", { name: "Capture and continuity" }),
  ).toBeInViewport();
  await expect(page.getByLabel("Observation text")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save observation" }),
  ).toBeVisible();

  await navigation.getByRole("link", { name: "Companion" }).click();
  await expect(
    page.getByRole("region", { name: "Companion" }),
  ).toBeInViewport();
  await expect(page.getByRole("textbox", { name: "Message" })).toBeVisible();

  await navigation.getByRole("link", { name: "Review" }).click();
  await expect(
    page.getByRole("region", { name: "Interpretation review and admission" }),
  ).toBeInViewport();
  await expect(
    page.getByRole("heading", { name: "Nothing waiting for review" }),
  ).toBeVisible();

  await navigation.getByRole("link", { name: "Today & Horizon" }).click();
  const projections = page.getByRole("region", {
    name: "Operational projections",
  });
  await expect(projections).toBeInViewport();
  const commitments = projections.getByRole("region", { name: "Commitments" });
  await expect(
    commitments.getByRole("heading", { name: "Today" }),
  ).toBeVisible();
  await expect(
    commitments.getByRole("heading", { name: "Horizon · 30 days" }),
  ).toBeVisible();

  await navigation.getByRole("link", { name: "World" }).click();
  await expect(
    page.getByRole("region", { name: "World understanding" }),
  ).toBeInViewport();
  await expect(
    page.getByRole("region", { name: "Living World" }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "No admitted Realms yet. The World remains visually unformed.",
    ),
  ).toBeVisible();
});

test("captures, places in Today and reconstructs the timeline after reload", async ({
  page,
}) => {
  const exactText = `Mobile evidence ${crypto.randomUUID()}`;
  await page.goto("/e2e-capture");

  const captureRegion = page.getByRole("region", {
    name: "What should be remembered?",
  });

  await captureRegion.getByLabel("Observation text").fill(exactText);
  await expect(
    captureRegion.getByText("unsynced", { exact: true }),
  ).toBeVisible();
  await captureRegion.getByRole("button", { name: "Save observation" }).click();

  const history = page.getByRole("region", { name: "Observation history" });
  const savedObservation = history.getByRole("listitem").filter({
    hasText: exactText,
  });
  await expect(
    savedObservation.getByText("saved", { exact: true }),
  ).toBeVisible();
  await expect(savedObservation.getByText(exactText)).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "Today" })
      .getByRole("listitem")
      .filter({ hasText: exactText }),
  ).toBeVisible();

  await page.reload();
  await expect(
    page
      .getByRole("region", { name: "Today" })
      .getByRole("listitem")
      .filter({ hasText: exactText }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Saved evidence is durable. Later processing cannot erase it.",
    ),
  ).toBeVisible();
});

test("streams one-companion dialogue after evidence persistence", async ({
  page,
}) => {
  const exactText = `Dialogue evidence ${crypto.randomUUID()}`;
  await page.goto("/e2e-dialogue");

  const dialogue = page.getByRole("region", { name: "Dialogue" });
  await dialogue.getByRole("textbox", { name: "Message" }).fill(exactText);
  await dialogue.getByRole("button", { name: "Send" }).click();

  const userMessage = dialogue.getByRole("listitem").filter({
    hasText: exactText,
  });
  await expect(userMessage.getByText("saved", { exact: true })).toBeVisible();
  await expect(
    dialogue.getByText("I hear you. Your evidence is safely held."),
  ).toBeVisible();
  await expect(
    dialogue.getByText("fixture · step-101-deterministic"),
  ).toBeVisible();

  await page.reload();
  const history = page.getByRole("region", { name: "Observation history" });
  await expect(history.getByText(exactText)).toBeVisible();
  await expect(dialogue.getByText(exactText)).toHaveCount(0);
});

test("keeps saved evidence through provider failure and retries idempotently", async ({
  page,
}) => {
  const exactText = `FAIL_PROVIDER ${crypto.randomUUID()}`;
  await page.goto("/e2e-dialogue");

  const dialogue = page.getByRole("region", { name: "Dialogue" });
  await dialogue.getByRole("textbox", { name: "Message" }).fill(exactText);
  await dialogue.getByRole("button", { name: "Send" }).click();

  await expect(dialogue.getByText("incomplete", { exact: true })).toBeVisible();
  await expect(
    dialogue.getByText(
      "The companion could not respond. Saved evidence remains safe.",
    ),
  ).toBeVisible();
  await dialogue.getByRole("button", { name: "Retry companion" }).click();
  await expect(
    dialogue.getByText("I hear you. Your evidence is safely held."),
  ).toBeVisible();

  await page.reload();
  const history = page.getByRole("region", { name: "Observation history" });
  await expect(
    history.getByRole("listitem").filter({ hasText: exactText }),
  ).toHaveCount(1);
});

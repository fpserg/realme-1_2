import { expect, test } from "@playwright/test";

test("serves the mobile Step 100 candidate boundary without configured secrets", async ({
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
    phase: "step-100-implementation-candidate",
  });
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

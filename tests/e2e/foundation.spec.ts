import { expect, test } from "@playwright/test";

test("serves the mobile Step 99 candidate boundary without configured secrets", async ({
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
    phase: "step-99-implementation-candidate",
  });
});

test("captures, confirms saved evidence and reconstructs history after reload", async ({
  page,
}) => {
  const exactText = `Mobile evidence ${crypto.randomUUID()}`;
  await page.goto("/e2e-capture");

  await page.getByLabel("Observation text").fill(exactText);
  await expect(page.getByText("unsynced", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Save observation" }).click();

  const savedObservation = page.getByRole("listitem").filter({
    hasText: exactText,
  });
  await expect(
    savedObservation.getByText("saved", { exact: true }),
  ).toBeVisible();
  await expect(savedObservation.getByText(exactText)).toBeVisible();

  await page.reload();
  await expect(
    page.getByRole("listitem").filter({ hasText: exactText }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Saved evidence is durable. Later processing cannot erase it.",
    ),
  ).toBeVisible();
});

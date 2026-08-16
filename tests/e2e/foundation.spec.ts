import { expect, test } from "@playwright/test";

test("serves the mobile foundation and health boundary", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "The foundation is taking form." }),
  ).toBeVisible();

  const response = await page.request.get("/api/health");
  expect(response.ok()).toBe(true);
  await expect(response.json()).resolves.toMatchObject({
    status: "ok",
    service: "realme-1-2",
    phase: "step-96-accepted-step-97-not-started",
  });
});

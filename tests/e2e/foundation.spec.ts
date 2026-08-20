import { expect, test } from "@playwright/test";

test("serves the mobile Step 97 boundary without configured secrets", async ({
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
    phase: "step-97-accepted-step-98-not-started",
  });
});

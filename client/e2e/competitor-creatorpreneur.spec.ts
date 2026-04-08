/// <reference types="node" />
import { expect, test, type Page } from "@playwright/test";

const CREATORPRENEUR_QUIZ_URL =
  "https://www.creatorpreneur.ae/instagram-quiz-ai-page";

function quizOptionButtons(page: Page) {
  return page
    .getByRole("button")
    .filter({ hasNotText: /← Back/ })
    .filter({ hasNotText: /Continue →/ })
    .filter({ hasNotText: /Show Me My Results/ })
    .filter({ hasNotText: /Start My Free Audit/ });
}

test.describe("Creatorpreneur — Instagram quiz funnel @competitor", () => {
  test.skip(
    Boolean(process.env.CI) && process.env.COMPETITOR_E2E !== "1",
    "External site: run locally, or set COMPETITOR_E2E=1 in CI",
  );

  test("landing through quiz shows personalised diagnosis", async ({
    page,
  }) => {
    await page.goto(CREATORPRENEUR_QUIZ_URL, { waitUntil: "domcontentloaded" });

    await expect(page).toHaveTitle(/Instagram Personal Brand Audit/i);
    await page
      .getByRole("button", { name: /Start My Free Audit/i })
      .click();
    await expect(page.getByText(/Step \d+ of 11/)).toBeVisible({
      timeout: 15_000,
    });

    const maxSteps = 16;
    for (let step = 0; step < maxSteps; step++) {
      if (
        await page
          .getByText(/Instagram Growth Diagnosis/i)
          .isVisible()
          .catch(() => false)
      ) {
        break;
      }

      const options = quizOptionButtons(page);
      await expect(options.first()).toBeVisible({ timeout: 15_000 });
      await options.first().click({ force: true });

      const showResults = page.getByRole("button", {
        name: /Show Me My Results/i,
      });
      const continueBtn = page.getByRole("button", { name: /Continue/ });
      await page.waitForTimeout(400);

      const submitReady =
        (await showResults.count()) > 0 &&
        (await showResults.getAttribute("disabled")) == null;
      if (submitReady) {
        await showResults.click({ force: true });
        break;
      }

      await continueBtn.click({ force: true, timeout: 25_000 });
    }

    await expect(
      page.getByText(/Instagram Growth Diagnosis/i).first(),
    ).toBeVisible({ timeout: 90_000 });
  });
});

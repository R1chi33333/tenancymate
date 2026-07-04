import { expect, test } from '@playwright/test';

/**
 * UI flows with the model and database mocked at the network edge,
 * so the suite is deterministic and burns no free-tier quota. The
 * real generation path is exercised by eval/citations.ts instead.
 */

const ANSWER =
  'A general bond is capped at 4 weeks of rent [s 18]. Pet bonds add 2 weeks [s 18AA].';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.__testEmbed = () => Promise.resolve(new Array(384).fill(0.05) as number[]);
  });
  await page.route('**/api/ask', async (route) => {
    await route.fulfill({
      status: 200,
      headers: { 'x-provided-sections': '18,18AA,21' },
      contentType: 'text/plain',
      body: ANSWER,
    });
  });
  await page.route('**/api/sections**', async (route) => {
    await route.fulfill({
      json: {
        sections: [
          { id: '18', heading: 'General bonds', part: 'Part 2', body: 'Bond text...' },
          { id: '18AA', heading: 'Pet bonds', part: 'Part 2', body: 'Pet bond text...' },
        ],
      },
    });
  });
});

test('asking a question renders clickable citations and the section panel', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByText('General information, not legal advice.').first()).toBeVisible();

  await page.getByLabel('Your question').fill('How many weeks of bond can my landlord ask for?');
  await page.getByRole('button', { name: 'Send' }).click();

  await expect(page.getByRole('button', { name: '[s 18]' })).toBeVisible();
  await expect(page.locator('[data-section="18AA"]')).toBeVisible();
  await expect(page.getByRole('heading', { name: 's 18AA Pet bonds' })).toBeVisible();

  await page.getByRole('button', { name: '[s 18AA]' }).click();
  await expect(page.locator('[data-section="18AA"]')).toHaveClass(/border-accent/);
});

test('rate limit and validation errors surface in the conversation', async ({ page }) => {
  await page.route('**/api/ask', async (route) => {
    await route.fulfill({
      status: 429,
      json: { error: 'The free demo has reached its daily answer budget. Come back tomorrow.' },
    });
  });
  await page.goto('/');
  await page.getByLabel('Your question').fill('How much notice ends a periodic tenancy?');
  await page.getByRole('button', { name: 'Send' }).click();

  await expect(page.getByText('daily answer budget')).toBeVisible();
});

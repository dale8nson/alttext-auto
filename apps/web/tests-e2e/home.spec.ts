import { test, expect } from '@playwright/test';

test.skip('landing page responds', async ({ page }) => {
  const response = await page.goto('/');
  expect(response?.ok()).toBeTruthy();
  await expect(page).toHaveTitle(/AltText Auto/i);
});

test.skip('settings page responds', async ({ page }) => {
  const response = await page.goto('/settings');
  expect(response?.ok()).toBeTruthy();
  await expect(page).toHaveTitle(/AltText Auto/i);
});

test.skip('legal pages respond', async ({ page }) => {
  let response = await page.goto('/privacy');
  expect(response?.ok()).toBeTruthy();
  await expect(page.getByText(/privacy policy/i)).toBeVisible({ timeout: 10000 });
  response = await page.goto('/terms');
  expect(response?.ok()).toBeTruthy();
  await expect(page.getByText(/terms of service/i)).toBeVisible({ timeout: 10000 });
});

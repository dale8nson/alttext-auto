import { test, expect } from '@playwright/test';

test('landing loads and shows primary CTAs', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Alt text');
  await expect(page.getByRole('link', { name: /install/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /view dashboard/i })).toBeVisible();
});

test('settings page renders toggles', async ({ page }) => {
  await page.goto('/settings');
  await expect(page.getByRole('button', { name: /toggle dark mode/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /effects on/i })).toBeVisible();
});

test('legal pages exist', async ({ page }) => {
  await page.goto('/privacy');
  await expect(page.getByRole('heading', { name: /privacy/i })).toBeVisible();
  await page.goto('/terms');
  await expect(page.getByRole('heading', { name: /terms/i })).toBeVisible();
});


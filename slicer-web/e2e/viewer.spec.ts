import { test, expect } from '@playwright/test';

test('renders landing page with navigation', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'BMR Slicer' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Viewer' })).toBeVisible();
  await expect(page.getByText('Load a mesh to generate a print estimate.')).toBeVisible();
});

test('health endpoint responds', async ({ request }) => {
  const response = await request.get('/api/health');
  expect(response.ok()).toBeTruthy();
  const json = await response.json();
  expect(json.status).toBe('ok');
});

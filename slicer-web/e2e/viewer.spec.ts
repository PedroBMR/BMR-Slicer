import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

test('loads viewer and computes estimate for uploaded STL', async ({ page }) => {
  await page.goto('/viewer');

  const fileInput = page.locator('input[type="file"]');
  const sampleFile = path.resolve(__dirname, 'fixtures', 'sample.stl');

  await fileInput.setInputFiles(sampleFile);

  await expect(fileInput).toBeDisabled();
  await expect(fileInput).toBeEnabled();

  const summaryRegion = page.getByRole('region', { name: /estimate summary/i });
  await expect(summaryRegion.getByRole('heading', { name: 'Print estimate' })).toBeVisible();
  await expect(summaryRegion.getByRole('term', { name: 'Volume' })).toBeVisible();
  await expect(summaryRegion.getByRole('term', { name: 'Mass' })).toBeVisible();
});

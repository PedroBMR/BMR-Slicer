import { expect, test } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SAMPLE_FILE = path.resolve(__dirname, 'fixtures', 'sample.stl');

const sanitizeNumber = (value: string): number => {
  const parsed = parseFloat(value.replace(/[^0-9.]+/g, ''));
  return Number.isNaN(parsed) ? NaN : parsed;
};

test.describe('upload workflow', () => {
  test('uploads a model and validates estimate values', async ({ page }) => {
    await page.goto('/viewer');

    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toHaveCount(1);

    await fileInput.setInputFiles(SAMPLE_FILE);

    await expect(fileInput).toBeDisabled();
    await expect(fileInput).toBeEnabled();

    const summaryRegion = page.getByRole('region', { name: /estimate summary/i });
    await expect(summaryRegion.getByRole('heading', { name: 'Print estimate' })).toBeVisible();

    const volumeValue = summaryRegion.locator('dt:has-text("Volume") + dd');
    await expect(volumeValue).toBeVisible();
    const volumeText = await volumeValue.innerText();
    const volumeNumber = sanitizeNumber(volumeText);
    expect(volumeNumber).toBeGreaterThan(0);

    const resinCostValue = summaryRegion.locator('dt:has-text("Resin cost") + dd');
    await expect(resinCostValue).toBeVisible();
    const resinCostText = await resinCostValue.innerText();
    const resinCostNumber = sanitizeNumber(resinCostText);
    expect(resinCostNumber).toBeGreaterThan(0);
  });
});

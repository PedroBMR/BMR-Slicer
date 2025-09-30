import { expect, test } from '@playwright/test';

const HOME_HEADING = 'BMR Slicer';

/**
 * Ensures the home shell is cached by the service worker and can be reloaded while offline.
 */
test('serves the home shell while offline after initial visit', async ({ page, context }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) {
      throw new Error('Service workers are not supported in this browser context.');
    }

    const registration = await navigator.serviceWorker.ready;

    if (navigator.serviceWorker.controller) {
      return;
    }

    if (!registration.active) {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Service worker activation timeout')), 10_000);
        navigator.serviceWorker.addEventListener(
          'controllerchange',
          () => {
            clearTimeout(timeout);
            resolve();
          },
          { once: true }
        );
      });
    }
  });

  await context.setOffline(true);

  try {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: HOME_HEADING })).toBeVisible();
  } finally {
    await context.setOffline(false);
  }
});

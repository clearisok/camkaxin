import { test, expect } from '@playwright/test';

const username = process.env.E2E_USERNAME || 'admin';
const password = process.env.E2E_PASSWORD || 'admin123';

async function login(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByLabel('用户名').fill(username);
  await page.getByLabel('密码').fill(password);
  await page.getByRole('button', { name: '登录' }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 });
}

test.describe('业务导航', () => {
  test('登录后可打开预警排单页', async ({ page }) => {
    await login(page);
    await page.goto('/scheduling?tab=early_warning');
    await expect(page.getByText('预警排单').first()).toBeVisible({ timeout: 15_000 });
  });

  test('登录后可打开报价单列表', async ({ page }) => {
    await login(page);
    await page.goto('/quotations');
    await expect(page.getByText('报价单管理').first()).toBeVisible({ timeout: 15_000 });
  });
});

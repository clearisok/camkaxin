import { test, expect } from '@playwright/test';

const username = process.env.E2E_USERNAME || 'admin';
const password = process.env.E2E_PASSWORD || 'admin123';

test.describe('登录流程', () => {
  test('登录页展示表单', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: '登录柬凯内部系统' })).toBeVisible();
    await expect(page.getByLabel('用户名')).toBeVisible();
    await expect(page.getByLabel('密码')).toBeVisible();
    await expect(page.getByRole('button', { name: '登录' })).toBeVisible();
  });

  test('正确账号可进入工作台', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('用户名').fill(username);
    await page.getByLabel('密码').fill(password);
    await page.getByRole('button', { name: '登录' }).click();

    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByText('工作台').first()).toBeVisible({ timeout: 15_000 });
  });
});

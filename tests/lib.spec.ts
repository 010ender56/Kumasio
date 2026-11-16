// @ts-check
import { test, expect } from '@playwright/test';
import { shuffle, distance }  from "../src/js/utils.js";

// lib and utils tests
test('shuffle function distributes items uniformly', async () => {
  const items = ['A', 'B', 'C'];
  const iterations = 100;

  // { 'A': { 0:0, 1:0, 2:0 }, ... }
  const freq: Record<string, Record<number, number>> = {};
  items.forEach(item => freq[item] = { 0: 0, 1: 0, 2: 0 });

  for (let i = 0; i < iterations; i++) {
    const shuffled = [...items];
    const result = shuffle(shuffled);

    result.forEach((item, index) => {
      freq[item][index]++;
    });
  }

  // Verify each item appeared in each position roughly 1/3 of the time
  items.forEach(item => {
    Object.values(freq[item]).forEach(count => {
      // allow some variance: 20% of expected 33.3
      expect(count).toBeGreaterThan(iterations * 0.2);
    });
  });
});

// UI and html tests
test('homepage has basic UI loaded', async ({ page }) => {
  await page.goto('http://localhost:5173/');
  await expect(page.locator('#greeting-header')).toBeVisible();
  await expect(page.locator('#quiz-grid')).toBeVisible();
});

test('homepage displays items', async ({ page }) => {
  await page.goto('http://localhost:5173/');
  const items = await page.locator('.quiz-card').all();
  expect(items.length).toBeGreaterThan(0);
});
const store = require('../store');
const { defaultSettings } = require('../config');

let cache = null;
let cacheAt = 0;

async function getSettings() {
  if (cache && Date.now() - cacheAt < 10000) return cache;
  const s = (await store.getSettings()) || {};
  cache = {
    shopName: s.shopName || defaultSettings.shopName,
    categories: {
      expense: s.categories?.expense?.length ? s.categories.expense : defaultSettings.categories.expense,
      income: s.categories?.income?.length ? s.categories.income : defaultSettings.categories.income,
    },
  };
  cacheAt = Date.now();
  return cache;
}

const cleanList = (arr) => [...new Set((arr || []).map((x) => String(x).trim().slice(0, 30)).filter(Boolean))].slice(0, 30);

async function saveSettings(input) {
  const cur = await getSettings();
  const next = {
    shopName: String(input.shopName ?? cur.shopName).trim().slice(0, 40) || cur.shopName,
    categories: {
      expense: input.categories?.expense ? cleanList(input.categories.expense) : cur.categories.expense,
      income: input.categories?.income ? cleanList(input.categories.income) : cur.categories.income,
    },
  };
  if (!next.categories.expense.length || !next.categories.income.length) {
    const e = new Error('ต้องมีหมวดหมู่อย่างน้อย 1 รายการในแต่ละประเภท'); e.status = 400; throw e;
  }
  await store.saveSettings(next);
  cache = next; cacheAt = Date.now();
  return next;
}

module.exports = { getSettings, saveSettings };

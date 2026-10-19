import assert from 'node:assert/strict';
import vm from 'node:vm';
import { preferencesBootstrap } from '../lib/ui-preferences.ts';

function run({ saved = {}, language = 'en-US', systemDark = false, blocked = false } = {}) {
  const document = { documentElement: { dataset: {}, lang: '', classList: { toggle(name, enabled) { this[name] = enabled; } } } };
  vm.runInNewContext(preferencesBootstrap, {
    document, navigator: { language }, matchMedia: () => ({ matches: systemDark }),
    localStorage: { getItem(key) { if (blocked) throw new Error('Storage disabled'); return saved[key] ?? null; } },
  });
  return document.documentElement;
}
assert.equal(run().dataset.locale, 'en');
assert.equal(run({ language: 'zh-TW' }).lang, 'zh-CN');
assert.equal(run({ saved: { 'ckb-dao-locale': 'zh' } }).dataset.locale, 'zh');
assert.equal(run({ blocked: true, systemDark: true }).classList.dark, true);
assert.equal(run({ blocked: true }).dataset.locale, 'en');
assert.equal(run({ saved: { 'ckb-dao-theme': 'light' }, systemDark: true }).classList.dark, false);
assert.equal(run({ saved: { 'ckb-dao-theme': 'dark' } }).classList.dark, true);
assert.equal(run({ saved: { 'ckb-dao-theme': 'invalid' }, systemDark: true }).dataset.theme, 'system');
console.log('UI preferences: locale, system theme, explicit choices and blocked storage pass.');

export type ThemePreference = 'system' | 'light' | 'dark';

/** Runs before paint; storage is optional (private browsing must remain usable). */
export const preferencesBootstrap = `(function(){var d=document.documentElement,l=null,t=null;try{l=localStorage.getItem('ckb-dao-locale');t=localStorage.getItem('ckb-dao-theme');}catch(e){}if(l!=='zh'&&l!=='en')l=/^zh/i.test(navigator.language)?'zh':'en';d.dataset.locale=l;d.lang=l==='zh'?'zh-CN':'en';t=t==='light'||t==='dark'?t:'system';d.dataset.theme=t;d.classList.toggle('dark',t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches));})();`;

export function safeStore(key: string, value: string) {
  try { window.localStorage.setItem(key, value); } catch { /* Preference still works for this page. */ }
}

export function applyTheme(theme: ThemePreference) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.classList.toggle('dark', theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches));
  window.dispatchEvent(new Event('ckb-dao-theme-change'));
}

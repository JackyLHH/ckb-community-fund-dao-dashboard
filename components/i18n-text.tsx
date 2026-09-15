export function I18nText({ zh, en }: { zh: React.ReactNode; en: React.ReactNode }) {
  return (
    <>
      <span className="i18n-zh">{zh}</span>
      <span className="i18n-en">{en}</span>
    </>
  );
}

// Abbreviated markers need an explicit delivery/acceptance table, not a
// mention of M1 in prose or a reference to earlier work.
export function structuredMilestoneRow(headers: string[], cells: string[]) {
  const index = (pattern: RegExp) => headers.findIndex(header => pattern.test(header.trim()));
  const stage = index(/^(?:#|stage|milestone)$/i);
  const week = index(/^week$/i);
  const work = index(/^(?:work|deliverables?)$/i);
  const acceptance = index(/^(?:acceptance|acceptance criteria)$/i);
  if ([stage, week, work, acceptance].some(value => value < 0)) return null;
  const marker = cells[stage]?.trim() ?? '';
  const match = marker.match(/^(?:kick[ -]?off\s*\(m(0)\)|m(\d+))$/i);
  const time = cells[week]?.trim() ?? '';
  if (!match || !/^\d+(?:\s*[-–]\s*\d+)?$/.test(time) || !cells[work]?.trim() || !cells[acceptance]?.trim()) return null;
  return {
    key: match[1] === '0' ? 'kickoff' : match[2],
    title: `${marker} (Week ${time})`,
    eta: `Week ${time}`,
    description: `Work: ${cells[work].trim()}; Acceptance: ${cells[acceptance].trim()}`,
  };
}

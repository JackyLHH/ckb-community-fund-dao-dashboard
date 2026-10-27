// Shared by every automatic translation field and the Node API.
export const translationPolicyVersion = 'fiber-terms-v1';

export function preserveTechnicalTerms(translation, source) {
  if (!/\bfiber\b/i.test(source)) return translation;
  return translation
    .replace(/(?:光纤|光線|光线|纤维|纖維)\s*(?:网络|網絡|網路)/g, 'Fiber Network')
    .replace(/光纤|光纖|光線|光线|纤维|纖維/g, 'Fiber');
}

// The public provider caps the UTF-8 bytes, not JS characters. Prefer word
// boundaries, but also support CJK and unbroken text without losing characters.
export function splitTranslationText(text, byteLimit = 500) {
  const encoder = new TextEncoder();
  const chunks = [];
  let remaining = text.trim();
  while (encoder.encode(remaining).length > byteLimit) {
    let prefix = '';
    for (const character of remaining) {
      if (encoder.encode(prefix + character).length > byteLimit) break;
      prefix += character;
    }
    const boundary = prefix.lastIndexOf(' ');
    if (boundary > prefix.length / 2) prefix = prefix.slice(0, boundary);
    chunks.push(prefix.trim());
    remaining = remaining.slice(prefix.length).trimStart();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

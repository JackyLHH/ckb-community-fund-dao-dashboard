// Shared by every automatic translation field and the Node API.
export const translationPolicyVersion = 'technical-terms-v2';

export function preserveTechnicalTerms(translation, source) {
  let result = translation;
  if (/\bfiber\b/i.test(source)) {
    result = result
      .replace(/(?:光纤|光線|光线|纤维|纖維)\s*(?:网络|網絡|網路)/g, 'Fiber Network')
      .replace(/光纤|光纖|光線|光线|纤维|纖維/g, 'Fiber');
  }
  if (/\bbinding\s+trailers?\b/i.test(source)) {
    result = result.replace(/(?:绑定|綁定)\s*(?:预告片|預告片|拖车|拖車|尾部(?!数据)|尾随(?:数据)?)/g, '绑定尾部数据');
    // Reviewed wording for the IDL discovery deliverable; match its source
    // before replacing the provider's known incorrect Chinese sentence.
    if (source.includes('Initial candidate discovery and revalidation for code cells carrying recognizable IDL binding trailers.')) {
      result = result.replace(
        /携带可识别\s*IDL\s*绑定尾部数据的代码单元格的初始候选发现和重新验证[。.]?/g,
        '对带有可识别的 IDL 绑定尾部数据的代码 Cell，进行初步候选发现与重新验证。',
      );
    }
  }
  return result;
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

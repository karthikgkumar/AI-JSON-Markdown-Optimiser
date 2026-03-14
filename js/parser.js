// ============================================================
// parser.js — Core JSON → Markdown conversion logic
// ============================================================

/**
 * Normalizes a JSON key (camelCase / snake_case) into a
 * human-readable "Title Case" label.
 */
export function cleanKeyForLlm(key) {
  let cleaned = key.replace(/([A-Z])/g, ' $1');
  cleaned = cleaned.replace(/[_-]/g, ' ');
  return cleaned
    .split(' ')
    .filter((w) => w.trim() !== '')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Converts a primitive value to a readable string.
 * - null / undefined → *N/A*
 * - boolean          → Yes / No
 * - empty string     → *Empty*
 * - number           → locale-formatted
 */
export function formatValueForLlm(value) {
  if (value === null || value === undefined) return '*N/A*';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'string' && value.trim() === '') return '*Empty*';
  if (typeof value === 'number') return value.toLocaleString('en-US');
  return String(value).trim();
}

/**
 * Flat object → bulleted Markdown list.
 * Null values are dropped by default (saves tokens).
 */
export function flatDictToMarkdown(data, dropNulls = true) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return '';
  const lines = [];
  for (const [key, value] of Object.entries(data)) {
    if (dropNulls && (value === null || value === undefined)) continue;
    lines.push(`- **${cleanKeyForLlm(key)}**: ${formatValueForLlm(value)}`);
  }
  return lines.join('\n');
}

/**
 * Array of uniform objects → Markdown table.
 * Keys are extracted as column headers (one per column, not per row).
 */
export function arrayToMarkdownTable(dataList) {
  if (!Array.isArray(dataList) || dataList.length === 0) return '';

  const allKeys = new Set();
  dataList.forEach((item) => {
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      Object.keys(item).forEach((k) => allKeys.add(k));
    }
  });

  const headers = Array.from(allKeys);
  if (headers.length === 0) return '';

  const cleanHeaders = headers.map(cleanKeyForLlm);
  const lines = [];
  lines.push(`| ${cleanHeaders.join(' | ')} |`);
  lines.push(`|${headers.map(() => '---').join('|')}|`);

  dataList.forEach((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return;
    const row = headers.map((k) => formatValueForLlm(item[k]).replace(/\n/g, ' '));
    lines.push(`| ${row.join(' | ')} |`);
  });

  return lines.join('\n');
}

/**
 * Nested / hierarchical object → structured Markdown.
 * - Nested objects become ## headings
 * - Arrays of objects become inline Markdown tables
 * - Primitive arrays become bulleted sub-lists
 */
export function nestedDictToMarkdown(data, level = 2) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    if (Array.isArray(data)) return arrayToMarkdownTable(data);
    return '';
  }

  const lines = [];
  for (const [key, value] of Object.entries(data)) {
    const cleanKey = cleanKeyForLlm(key);
    const heading = '#'.repeat(Math.min(level, 6));

    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      lines.push(`\n${heading} ${cleanKey}`);
      lines.push(nestedDictToMarkdown(value, level + 1));
    } else if (Array.isArray(value)) {
      if (value.length === 0) {
        lines.push(`- **${cleanKey}**: *Empty List*`);
      } else if (value.every((i) => i !== null && typeof i === 'object' && !Array.isArray(i))) {
        lines.push(`\n${heading} ${cleanKey} (Data Table)`);
        lines.push(arrayToMarkdownTable(value));
      } else {
        lines.push(`- **${cleanKey}**:`);
        value.forEach((item) => {
          if (item !== null && typeof item === 'object' && !Array.isArray(item)) {
            const sub = flatDictToMarkdown(item);
            const indented = sub
              .split('\n')
              .filter((l) => l.trim())
              .map((l) => `    ${l}`)
              .join('\n');
            lines.push(indented);
          } else {
            lines.push(`  - ${formatValueForLlm(item)}`);
          }
        });
      }
    } else {
      lines.push(`- **${cleanKey}**: ${formatValueForLlm(value)}`);
    }
  }

  return lines.join('\n').trim();
}

/**
 * Top-level dispatcher — routes data to the correct formatter.
 */
export function convertToMarkdown(parsedData) {
  if (Array.isArray(parsedData)) {
    return arrayToMarkdownTable(parsedData);
  }
  return nestedDictToMarkdown(parsedData);
}
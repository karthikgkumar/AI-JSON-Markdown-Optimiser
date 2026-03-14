// ============================================================
// analysis.js — Advanced Latency Analysis Engine
// ============================================================

/**
 * LLM provider catalogue with fast vs pro model tiers.
 * Context limits are in tokens.
 */
export const LLM_PROVIDERS = {
  google: {
    name: 'Google Vertex / AI Studio',
    fast: { name: 'Gemini 2.5/3.0 Flash', maxTokens: 1_048_576, isReasoning: false },
    pro:  { name: 'Gemini 2.5/3.0 Pro',   maxTokens: 2_097_152, isReasoning: true  },
  },
  openai: {
    name: 'OpenAI API',
    fast: { name: 'GPT-4o-mini',           maxTokens: 128_000,   isReasoning: false },
    pro:  { name: 'o1 / o3 / GPT-4o',      maxTokens: 128_000,   isReasoning: true  },
  },
  anthropic: {
    name: 'Anthropic Claude',
    fast: { name: 'Claude 3.5 Haiku',      maxTokens: 200_000,   isReasoning: false },
    pro:  { name: 'Claude 3.7 Sonnet',     maxTokens: 200_000,   isReasoning: true  },
  },
};

/**
 * Recursively measures the nesting depth of a JSON value.
 */
export function getObjectDepth(obj) {
  if (obj === null || typeof obj !== 'object') return 0;
  let depth = 0;
  for (const key in obj) {
    depth = Math.max(depth, getObjectDepth(obj[key]));
  }
  return 1 + depth;
}

/**
 * Runs the full latency analysis and returns an HTML string
 * ready to be injected into the analysis panel.
 *
 * @param {*}      jsonData  - Parsed JSON value
 * @param {string} rawText   - Original raw JSON string (for token estimation)
 * @returns {string}         - HTML report
 */
export function runLatencyAnalysis(jsonData, rawText) {
  const depth        = getObjectDepth(jsonData);
  const approxTokens = Math.ceil(rawText.length / 4);
  const isArray      = Array.isArray(jsonData);

  // --- Complexity scoring ---
  let complexityScore = 0;
  if (depth >= 4)           complexityScore += 5;
  else if (depth === 3)     complexityScore += 3;
  else                      complexityScore += 1;

  if (approxTokens > 100_000)   complexityScore += 4;
  else if (approxTokens > 32_000) complexityScore += 2;
  else                            complexityScore += 1;

  const requiresProModel  = complexityScore >= 6;
  const complexityLabel   = requiresProModel
    ? 'High (Requires Reasoning Engine)'
    : 'Low to Moderate (Safe for Fast Tier)';

  const highRepetition = isArray && jsonData.length >= 5;

  // -------------------------------------------------------
  let html = '<div class="space-y-6">';

  // SECTION 1 — Right-Size Routing Matrix
  const s1Color = requiresProModel ? 'blue' : 'green';
  html += `
  <div class="p-5 rounded-xl border border-${s1Color}-200 bg-${s1Color}-50">
    <h3 class="font-bold text-slate-800 mb-2 flex items-center gap-2 text-lg">
      <i class="fa-solid fa-scale-balanced text-${s1Color}-600"></i>
      1. Right-Size Routing Matrix
    </h3>
    <p class="text-slate-700 mb-3 text-sm">Asking reasoning models to parse simple data causes high latency. We analysed your payload to recommend the correct tier across top providers.</p>
    <div class="bg-white p-3 rounded-lg border border-${s1Color}-100 text-xs font-mono mb-4 text-slate-700">
      <strong>Payload Metrics:</strong><br/>
      • Approx Tokens: <strong>${approxTokens.toLocaleString()}</strong><br/>
      • Nesting Depth: <strong>${depth} level(s)</strong><br/>
      • Assessed Complexity: <strong>${complexityLabel}</strong>
    </div>
    <div class="overflow-x-auto">
      <table class="w-full text-sm text-left border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm">
        <thead class="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
          <tr>
            <th class="py-2 px-3">Provider</th>
            <th class="py-2 px-3">Recommended Model</th>
            <th class="py-2 px-3">Context Limit Status</th>
          </tr>
        </thead>
        <tbody>`;

  Object.values(LLM_PROVIDERS).forEach((provider) => {
    const model        = requiresProModel ? provider.pro : provider.fast;
    const exceeded     = approxTokens > model.maxTokens;
    const limitStatus  = exceeded
      ? `<span class="text-red-600 font-bold text-xs"><i class="fa-solid fa-triangle-exclamation"></i> Exceeds Limit (${(model.maxTokens / 1000).toFixed(0)}k)</span>`
      : `<span class="text-emerald-600 text-xs"><i class="fa-solid fa-check"></i> Within Limit (${(model.maxTokens / 1000).toFixed(0)}k max)</span>`;

    html += `
          <tr class="border-b border-slate-100 last:border-0 hover:bg-slate-50">
            <td class="py-2 px-3 font-semibold text-slate-700">${provider.name}</td>
            <td class="py-2 px-3 font-mono text-blue-700 bg-blue-50/50">${model.name}</td>
            <td class="py-2 px-3">${limitStatus}</td>
          </tr>`;
  });

  html += `
        </tbody>
      </table>
    </div>
  </div>`;

  // SECTION 2 — Instruction Overhead
  const s2Color = highRepetition ? 'amber' : 'slate';
  html += `
  <div class="p-5 rounded-xl border border-${s2Color}-200 bg-${s2Color}-50">
    <h3 class="font-bold text-slate-800 mb-2 flex items-center gap-2">
      <i class="fa-solid fa-graduation-cap text-${s2Color}-${highRepetition ? '600' : '500'}"></i>
      2. Reduce "Instruction Overhead"
    </h3>
    <p class="text-slate-700 mb-2 text-sm">General models require massive context windows to understand specific schemas. If array repetition is high, fine-tuning eliminates prompt boilerplate.</p>
    <div class="bg-white p-3 rounded border border-slate-100 text-xs font-mono mb-2">
      <strong>Check:</strong> Structure Type: ${isArray ? 'Array of Objects' : 'Single Entity / Dict'} | Item Count: ${isArray ? jsonData.length : 1}
    </div>
    ${highRepetition
      ? `<p class="text-amber-800 font-medium text-sm">💡 <strong>Actionable Fix: Fine-tune this schema.</strong> You are processing an array of ${jsonData.length} uniform items. Fine-tuning a smaller model on this schema allows it to operate on "muscle memory," significantly improving TTFT (Time-to-First-Token).</p>`
      : `<p class="text-slate-600 text-sm">➖ No immediate fine-tuning triggers detected based on array repetition.</p>`
    }
  </div>`;

  // SECTION 3 — Thinking Budget
  html += `
  <div class="p-5 rounded-xl border border-purple-200 bg-purple-50">
    <h3 class="font-bold text-slate-800 mb-2 flex items-center gap-2">
      <i class="fa-solid fa-brain text-purple-600"></i>
      3. Cap the "Thinking Budget"
    </h3>
    <p class="text-slate-700 mb-2 text-sm">Newer reasoning models (like o1/o3 or Gemini Pro) can overthink simple formatting tasks, spending seconds reflecting unnecessarily on structured data.</p>
    ${!requiresProModel
      ? `<div class="bg-white p-3 rounded border border-purple-100 text-xs font-mono mb-2">
           <strong>Prompt Injection:</strong> Append <em>"Answer immediately without reflection. Do not overthink."</em> to the system prompt to force a fast response.
         </div>`
      : `<p class="text-slate-600 text-sm">➖ Due to the depth and complexity score (${complexityScore}) of this payload, normal thinking budgets should be maintained to prevent structural hallucinations.</p>`
    }
  </div>`;

  html += '</div>';
  return html;
}
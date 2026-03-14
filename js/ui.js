// ============================================================
// ui.js — All DOM interaction, tab switching & navigation
// ============================================================

import { convertToMarkdown } from './parser.js';
import { runLatencyAnalysis } from './analysis.js';

// ── Elements ─────────────────────────────────────────────────
const viewConverter  = document.getElementById('view-converter');
const viewFormats    = document.getElementById('view-formats');
const navConverter   = document.getElementById('navConverter');
const navFormats     = document.getElementById('navFormats');
const navFeatures    = document.getElementById('navFeatures');

const jsonInput      = document.getElementById('jsonInput');
const markdownOutput = document.getElementById('markdownOutput');
const previewOutput  = document.getElementById('previewOutput');
const latencyOutput  = document.getElementById('latencyOutput');
const convertBtn     = document.getElementById('convertBtn');
const formatJsonBtn  = document.getElementById('formatJsonBtn');
const copyBtn        = document.getElementById('copyBtn');
const copySuccess    = document.getElementById('copySuccess');
const errorMessage   = document.getElementById('errorMessage');
const errorText      = document.getElementById('errorText');

const tabMarkdown    = document.getElementById('tabMarkdown');
const tabPreview     = document.getElementById('tabPreview');
const tabLatency     = document.getElementById('tabLatency');

// ── Page Navigation ───────────────────────────────────────────
function switchPage(page) {
  const isConverter = page === 'converter';
  viewConverter.classList.toggle('hidden', !isConverter);
  viewFormats.classList.toggle('hidden', isConverter);

  navConverter.classList.toggle('text-blue-600', isConverter);
  navConverter.classList.toggle('text-slate-500', !isConverter);
  navFormats.classList.toggle('text-blue-600', !isConverter);
  navFormats.classList.toggle('text-slate-500', isConverter);

  if (!isConverter) window.scrollTo(0, 0);
}

navConverter.addEventListener('click', (e) => { e.preventDefault(); switchPage('converter'); });
navFormats.addEventListener('click',   (e) => { e.preventDefault(); switchPage('formats'); });
navFeatures.addEventListener('click',  ()  => { switchPage('converter'); });

// Make switchPage globally accessible for the logo click
window.switchPage = switchPage;

// ── Tab Switching ─────────────────────────────────────────────
const TABS = {
  markdown: { btn: tabMarkdown, content: markdownOutput, showCopy: true  },
  preview:  { btn: tabPreview,  content: previewOutput,  showCopy: false },
  latency:  { btn: tabLatency,  content: latencyOutput,  showCopy: false },
};

function switchTab(activeKey) {
  Object.entries(TABS).forEach(([key, { btn, content, showCopy }]) => {
    const isActive = key === activeKey;
    btn.classList.toggle('text-blue-600',       isActive);
    btn.classList.toggle('font-bold',           isActive);
    btn.classList.toggle('border-blue-600',     isActive);
    btn.classList.toggle('text-slate-500',      !isActive);
    btn.classList.toggle('font-semibold',       !isActive);
    btn.classList.toggle('border-transparent',  !isActive);
    content.classList.toggle('hidden',          !isActive);

    if (isActive) {
      copyBtn.style.display = showCopy ? 'flex' : 'none';
    }
  });
}

tabMarkdown.addEventListener('click', () => switchTab('markdown'));
tabPreview.addEventListener('click',  () => switchTab('preview'));
tabLatency.addEventListener('click',  () => switchTab('latency'));

// ── Convert ───────────────────────────────────────────────────
convertBtn.addEventListener('click', () => {
  const rawText = jsonInput.value.trim();
  if (!rawText) return;

  try {
    const parsedData = JSON.parse(rawText);
    errorMessage.classList.add('hidden');

    const markdown = convertToMarkdown(parsedData);
    markdownOutput.value = markdown;

    // Markdown preview (requires marked.js loaded in HTML)
    if (window.marked) {
      previewOutput.innerHTML = window.marked.parse(markdown);
    }

    // Latency analysis
    latencyOutput.innerHTML = runLatencyAnalysis(parsedData, rawText);

    // Enable copy button
    copyBtn.disabled = false;
    copyBtn.classList.remove('cursor-not-allowed', 'opacity-50');
    copyBtn.classList.add('text-blue-600', 'hover:text-blue-800');

    // Pulse the Preview tab to hint at it
    tabPreview.classList.add('animate-pulse');
    setTimeout(() => tabPreview.classList.remove('animate-pulse'), 2000);

  } catch (err) {
    errorMessage.classList.remove('hidden');
    errorText.textContent = `Invalid JSON: ${err.message}`;
  }
});

// ── Format JSON ───────────────────────────────────────────────
formatJsonBtn.addEventListener('click', () => {
  const rawText = jsonInput.value.trim();
  if (!rawText) return;
  try {
    jsonInput.value = JSON.stringify(JSON.parse(rawText), null, 2);
    errorMessage.classList.add('hidden');
  } catch {
    errorMessage.classList.remove('hidden');
    errorText.textContent = 'Cannot format: Invalid JSON structure.';
  }
});

// ── Copy Markdown ─────────────────────────────────────────────
copyBtn.addEventListener('click', () => {
  if (!markdownOutput.value) return;
  markdownOutput.select();
  markdownOutput.setSelectionRange(0, 99_999);
  try {
    document.execCommand('copy');
    window.getSelection().removeAllRanges();
    copySuccess.classList.remove('hidden');
    copyBtn.classList.add('hidden');
    setTimeout(() => {
      copySuccess.classList.add('hidden');
      copyBtn.classList.remove('hidden');
    }, 2000);
  } catch (err) {
    console.error('Copy failed:', err);
  }
});

// ── Textarea Auto-Resize ──────────────────────────────────────
function resizeTextareas() {
  const h = 'calc(100vh - 250px)';
  jsonInput.style.minHeight      = '300px';
  jsonInput.style.height         = h;
  markdownOutput.style.minHeight = '300px';
  markdownOutput.style.height    = h;
}
window.addEventListener('resize', resizeTextareas);
resizeTextareas();
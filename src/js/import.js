import {
  loadTheme,
  createImageUploader,
  fileToBase64,
  createSetTemplate,
  initState,
  getState,
  saveFullState,
  updateState,
  generateNavbar,
  messageDialog,
} from "./lib.js";

const nav = generateNavbar();
document.body.prepend(nav);

let state;

async function initApp() {
  state = await getState();
  if (state) {
    loadTheme(state.userPrefs.theme);
  }
}

function parseFlashcards(text) {
  if (!text || !text.trim()) return [];

  const normalizedText = text.replace(/\\r\\n/g, '\\n').replace(/\\r/g, '\\n');

  if (normalizedText.includes('\\t') || normalizedText.includes('\t')) {
    const rows = normalizedText.trim().split('\\n').filter(row => row.trim());
    return rows.map(row => {
      const [term, def] = row.split(/[\\t\\t]/);
      return { term, def };
    }).filter(item => item.term && item.def);
  }

  if (normalizedText.includes(';')) {
    const rows = normalizedText.trim().split(';').filter(row => row.trim());
    return rows.map(row => {
      const [term, def] = row.split(',');
      return { term, def };
    }).filter(item => item.term && item.def);
  }

  if (normalizedText.includes(',')) {
    const rows = normalizedText.trim().split('\\n').filter(row => row.trim());
    return rows.map(row => {
      const [term, def] = row.split(',');
      return { term, def };
    }).filter(item => item.term && item.def);
  }

  return [];
}

async function handleImport() {
  let text = "";
  const method = document.getElementById('paste-section').classList.contains('active') ? 'paste' : 'file';

  if (method === 'paste') {
    text = document.getElementById('import-text').value;
  } else {
    const fileInput = document.getElementById('file-input');
    const file = fileInput.files[0];
    if (!file) {
      messageDialog("Please select a file first.", { title: "Notice" });
      return;
    }
    text = await file.text();
  }

  const cards = parseFlashcards(text);

  if (cards.length === 0) {
    messageDialog("No valid flashcards found. Please check the format.", { title: "Notice" });
    return;
  }

  const newSetId = `i${Date.now()}`;
  const newSet = createSetTemplate('flashcards');
  newSet.name = "Imported Flashcards";
  
  newSet.questions = cards.map(card => ({
    id: crypto.randomUUID(),
    text: card.term.trim(),
    type: 'flashcard',
    options: [],
    expectedAnswer: card.def.trim(),
    image: null
  }));

  const currentState = await getState();
  currentState.sets[newSetId] = newSet;
  
  await saveFullState(currentState);
  window.location.href = './index.html';
}

const methodPaste = document.getElementById('method-paste');
const methodFile = document.getElementById('method-file');
const pasteSection = document.getElementById('paste-section');
const fileSection = document.getElementById('file-section');

methodPaste.addEventListener('click', () => {
  methodPaste.classList.add('active');
  methodFile.classList.remove('active');
  pasteSection.classList.add('active');
  fileSection.classList.remove('active');
});

methodFile.addEventListener('click', () => {
  methodFile.classList.add('active');
  methodPaste.classList.remove('active');
  fileSection.classList.add('active');
  pasteSection.classList.remove('active');
});

const browseBtn = document.getElementById('browse-btn');
const fileInput = document.getElementById('file-input');
const dropZone = document.getElementById('drop-zone');

browseBtn.addEventListener('click', () => fileInput.click());

['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
  dropZone.addEventListener(eventName, (e) => {
    e.preventDefault();
    e.stopPropagation();
  }, false);
});

dropZone.addEventListener('dragover', () => dropZone.classList.add('drag-over'));
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));

dropZone.addEventListener('drop', (e) => {
  dropZone.classList.remove('drag-over');
  const files = e.dataTransfer.files;
  if (files.length > 0) {
    fileInput.files = files;
    dropZone.querySelector('p').textContent = `Selected: ${files[0].name}`;
  }
});

fileInput.addEventListener('change', () => {
  if (fileInput.files.length > 0) {
    dropZone.querySelector('p').textContent = `Selected: ${fileInput.files[0].name}`;
  }
});

await initApp();

document.getElementById('import-btn').addEventListener('click', handleImport);

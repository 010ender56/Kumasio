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
} from "./lib.js";

document.addEventListener("DOMContentLoaded", async () => {
  const nav = generateNavbar();
  document.body.prepend(nav);

  // STATE
  let state = await getState();

  async function saveState() {
    await saveFullState(state);
    renderSetInfo();
  }

  // DOM ELEMENTS
  const sidebar = document.querySelector(".sidebar");
  const questionListEl = document.querySelector(".question-list");
  
  const addQuestionBtn = document.getElementById("add-question-btn");
  const previewQuizBtn = document.getElementById("preview-set");
  const editQuizBtn = document.getElementById("edit-set");
  const editQuizDialog = document.getElementById("edit-set-dialog");
  const quizInfoUploader = createImageUploader(document.getElementById("quiz-info-uploader"));
  const quizTitleInput = document.getElementById("quiz-title");
  const quizDescInput = document.getElementById("quiz-desc");
  const quizDescChars = document.getElementById("char-count");
  const quizTypeSelect = document.getElementById("quiz-type");
  const saveQuizInfoBtn = document.getElementById("save-quiz-info");
  const deleteSetBtn = document.getElementById("delete-set");
  const quizOnlyOptions = document.getElementById("quiz-only-options");
  const oneWayOnly = document.getElementById("one-way-quiz");
  const builderPanel = document.getElementById("builder-panel");
  const closeBtn = document.getElementById("edit-dialog-close");

  // QUESTION TYPE CONFIG
  const QUESTION_TYPES = {
    "multiple-choice": {
      needsOptions: true,
      singleCorrect: true,
      defaultOptions: () => [
        { text: "", correct: false },
        { text: "", correct: false },
        { text: "", correct: false },
        { text: "", correct: false },
      ],
    },
    "multiple-response": {
      needsOptions: true,
      singleCorrect: false,
      defaultOptions: () => [
        { text: "", correct: false },
        { text: "", correct: false },
        { text: "", correct: false },
        { text: "", correct: false },
      ],
    },
    "true-false": {
      needsOptions: true,
      singleCorrect: true,
      defaultOptions: () => [
        { text: "True", correct: false },
        { text: "False", correct: false },
      ],
    },
    "short-answer": {
      needsOptions: false,
      singleCorrect: false,
      defaultOptions: () => [],
    },
    "long-answer": {
      needsOptions: false,
      singleCorrect: false,
      defaultOptions: () => [],
    },
    "flashcard": {
      needsOptions: false,
      singleCorrect: false,
      defaultOptions: () => [],
    },
  };

  function createQuestion(type = "multiple-choice") {
    const cfg = QUESTION_TYPES[type];
    return {
      id: crypto.randomUUID(),
      text: "",
      type,
      options: cfg.defaultOptions(),
      expectedAnswer: "",
      validationType: "text",
      validationMode: "exact match",
      feedback: "submitted",
      required: false,
      changeable: true,
      image: null,
    };
  }

  function getQuestions() {
    return state.sets[state.currentSet]?.questions || [];
  }

  function renderSetInfo() {
    const quiz = state.sets[state.currentSet];
    if (!quiz) return;
    quizTitleInput.value = quiz.name || "";
    quizDescInput.value = quiz.description || "";
    quizTypeSelect.value = quiz.type || "quiz";

    if (quiz.image) {
      quizInfoUploader.previewBox.style.backgroundImage = `url('${quiz.image}')`;
      quizInfoUploader.uploadText.style.display = "none";
    } else {
      quizInfoUploader.previewBox.style.backgroundImage = "";
      quizInfoUploader.uploadText.style.display = "block";
    }
    quizInfoUploader.input.value = "";
    quizInfoUploader.resetCleared();

    oneWayOnly.checked = !quiz.oneWay;
    quizOnlyOptions.style.display = quiz.type === "quiz" ? "block" : "none";

    quizDescChars.textContent = `${quizDescInput.value.length}/100`;
  }

  function renderQuestionList() {
    questionListEl.innerHTML = "";

    const questions = getQuestions();
    if (questions.length === 0) {
      const noQuestionEl = document.createElement("small");
      noQuestionEl.textContent = "No question yet.";
      questionListEl.appendChild(noQuestionEl);
      return;
    }

    questions.forEach((q, idx) => {
      const item = document.createElement("div");
      item.className = "question-item";
      item.textContent = `Item ${idx + 1}`;
      item.dataset.id = q.id;

      const remove = document.createElement("button");
      remove.textContent = "Remove";
      remove.classList.add("btn", "remove-question-button");

      remove.addEventListener("click", async (e) => {
        e.stopPropagation();
        const index = questions.findIndex((quest) => quest.id === q.id);
        if (index !== -1) {
          questions.splice(index, 1);
          await saveState();
          renderQuestionList();
          renderBuilder();
        }
      });

      item.append(remove);
      if (state.currentIndex === idx) {
        item.style.backgroundColor = "var(--surface-lighter)";
        item.style.borderColor = "var(--accent)";
      }
      questionListEl.appendChild(item);
    });
  }

  // quiz
  function renderQuizBuilder(index) {
    const questions = getQuestions();
    if (index < 0 || index >= questions.length) {
      builderPanel.innerHTML = `<h1>No selected question</h1><p>Select a question to edit</p>`;
      return;
    }

    state.currentIndex = index;
    const q = questions[index];

    builderPanel.innerHTML = `
        <div class="builder-section">
            <label for="questionText">Question Text</label>
            <div class="row" style="flex-direction: row; align-items: start;">
                <div class="uploader-container" id="question-uploader"></div>
                <textarea id="questionText" placeholder="Enter your question here..." style="flex: 1;">${q.text || ""}</textarea>
            </div>
        </div>
        <div class="builder-section">
            <label for="type">Answer Type</label>
            <select id="type">
                <option value="multiple-choice" ${q.type === 'multiple-choice' ? 'selected' : ''}>Multiple Choice</option>
                <option value="multiple-response" ${q.type === 'multiple-response' ? 'selected' : ''}>Multiple Response</option>
                <option value="true-false" ${q.type === 'true-false' ? 'selected' : ''}>True or False</option>
                <option value="short-answer" ${q.type === 'short-answer' ? 'selected' : ''}>Short Answer</option>
                <option value="long-answer" ${q.type === 'long-answer' ? 'selected' : ''}>Long Answer</option>
            </select>
        </div>
        <div class="builder-section">
            <label for="feedback">Feedback Mode</label>
            <select id="feedback">
                <option value="show_correct" ${q.feedback === 'show_correct' ? 'selected' : ''}>Wrong/Right/Partially (Show Correct Answer)</option>
                <option value="hide_correct" ${q.feedback === 'hide_correct' ? 'selected' : ''}>Wrong/Right/Partially (Hide Correct Answer)</option>
                <option value="submitted" ${q.feedback === 'submitted' ? 'selected' : ''}>Submitted (No Feedback)</option>
            </select>
        </div>
        <div class="builder-section">
            <div class="row" style="flex-direction: row; gap: 20px;">
                <label><input type="checkbox" id="required" ${q.required ? 'checked' : ''}> Required Question</label>
                <label><input type="checkbox" id="changeable" ${q.changeable !== false ? 'checked' : ''}> Changeable after submission</label>
            </div>
        </div>
        <div class="builder-section">
            <label>Answer Options</label>
            <div class="answer-options"></div>
            <button class="btn" id="add-option-btn">+ Add Option</button>
        </div>
        <button class="cta" id="save-question-btn">Save Question</button>
    `;

    const uploader = createImageUploader(document.getElementById("question-uploader"), async (file) => {
      q.image = await fileToBase64(file);
    });
    if (q.image) {
      uploader.previewBox.style.backgroundImage = `url('${q.image}')`;
      uploader.uploadText.style.display = "none";
    }

    const qText = document.getElementById("questionText");
    const typeSel = document.getElementById("type");
    const feedSel = document.getElementById("feedback");
    const reqCheck = document.getElementById("required");
    const chanCheck = document.getElementById("changeable");
    const optContainer = document.querySelector(".answer-options");
    const addOptBtn = document.getElementById("add-option-btn");
    const saveBtn = document.getElementById("save-question-btn");

    qText.addEventListener("input", () => { q.text = qText.value.trim(); });
    typeSel.addEventListener("change", () => {
      q.type = typeSel.value;
      q.options = QUESTION_TYPES[q.type].defaultOptions();
      renderOptionsUI_Legacy(q);
    });
    feedSel.addEventListener("change", () => { q.feedback = feedSel.value; });
    reqCheck.addEventListener("change", () => { q.required = reqCheck.checked; });
    chanCheck.addEventListener("change", () => { q.changeable = chanCheck.checked; });

    function renderOptionsUI_Legacy(question) {
      optContainer.innerHTML = "";
      const cfg = QUESTION_TYPES[question.type];
      if (cfg.needsOptions) {
        question.options.forEach((opt, idx) => {
          const row = document.createElement("div");
          row.className = "answer-row";
          const cb = document.createElement("input");
          cb.type = "checkbox";
          cb.checked = !!opt.correct;
          cb.addEventListener("change", () => { opt.correct = cb.checked; });
          const ti = document.createElement("input");
          ti.type = "text";
          ti.value = opt.text || "";
          ti.addEventListener("input", () => { opt.text = ti.value; });
          const rb = document.createElement("button");
          rb.textContent = "×";
          rb.classList.add("btn");
          rb.addEventListener("click", () => {
            question.options.splice(idx, 1);
            renderOptionsUI_Legacy(question);
          });
          row.append(cb, ti, rb);
          optContainer.appendChild(row);
        });
      } else {
        const input = document.createElement("input");
        input.type = "text";
        input.value = question.expectedAnswer || "";
        input.addEventListener("input", () => { question.expectedAnswer = input.value; });
        optContainer.appendChild(input);
      }
    }

    renderOptionsUI_Legacy(q);
    addOptBtn.addEventListener("click", () => {
      if (QUESTION_TYPES[q.type].needsOptions) {
        q.options.push({ text: "", correct: false });
        renderOptionsUI_Legacy(q);
      }
    });
    saveBtn.addEventListener("click", async () => {
      await saveState();
      alert("Saved!");
    });
  }

  // flashcards
  function renderFlashcardBuilder() {
    const questions = getQuestions();
    builderPanel.innerHTML = `
        <div class="flashcard-builder-list">
            ${questions.map((q, idx) => `
                <div class="flashcard-edit-row" data-id="${q.id}" data-index="${idx}">
                    <div class="fc-field">
                        <label>Front</label>
                        <textarea class="fc-front" placeholder="Enter term...">${q.text || ""}</textarea>
                    </div>
                    <div class="fc-field">
                        <label>Back</label>
                        <textarea class="fc-back" placeholder="Enter definition...">${q.expectedAnswer || ""}</textarea>
                    </div>
                    <div class="fc-field fc-image-field">
                        <label>Image</label>
                        <div class="uploader-container fc-uploader"></div>
                    </div>
                    <button class="btn danger remove-card">×</button>
                </div>
            `).join("")}
        </div>
    `;

    questions.forEach((q, idx) => {
      const row = builderPanel.querySelector(`.flashcard-edit-row[data-index="${idx}"]`);
      if (!row) return;
      const frontT = row.querySelector(".fc-front");
      const backT = row.querySelector(".fc-back");
      const uploaderContainer = row.querySelector(".fc-uploader");

      frontT.addEventListener("input", async () => {
        q.text = frontT.value.trim();
        await saveState();
      });
      backT.addEventListener("input", async () => {
        q.expectedAnswer = backT.value.trim();
        await saveState();
      });

      const uploader = createImageUploader(uploaderContainer, async (file) => {
        q.image = await fileToBase64(file);
        await saveState();
      });
      if (q.image) {
        uploader.previewBox.style.backgroundImage = `url('${q.image}')`;
        uploader.uploadText.style.display = "none";
      }

      row.querySelector(".remove-card").addEventListener("click", async () => {
        questions.splice(idx, 1);
        await saveState();
        renderFlashcardBuilder();
        renderQuestionList();
      });
    });
  }

  function renderBuilder() {
    const type = state.sets[state.currentSet]?.type;
    if (type === "flashcards") {
      questionListEl.style.display = "none";
      builderPanel.style.width = "100%";
      renderFlashcardBuilder();
    } else {
      questionListEl.style.display = "flex";
      builderPanel.style.width = "80vw";
      const questions = getQuestions();
      if (questions.length === 0) {
        builderPanel.innerHTML = `<h1>No questions yet</h1><p>Click "Add Question" to create your first question.</p>`;
      } else if (state.currentIndex === undefined || state.currentIndex < 0) {
        builderPanel.innerHTML = `<h1>No selected question</h1><p>Please select a question to edit</p>`;
      } else {
        renderQuizBuilder(state.currentIndex);
      }
    }
  }

  // EVENTS
  editQuizBtn.addEventListener("click", () => {
    renderSetInfo();
    editQuizDialog.showModal();
  });

  addQuestionBtn.addEventListener("click", async () => {
    const type = state.sets[state.currentSet]?.type === "flashcards" ? "flashcard" : "multiple-choice";
    const newQ = createQuestion(type);
    const questions = getQuestions();
    questions.push(newQ);
    await saveState();
    renderQuestionList();
    renderBuilder();
  });

  questionListEl.addEventListener("click", (e) => {
    const item = e.target.closest(".question-item");
    if (!item || state.sets[state.currentSet]?.type === "flashcards") return;

    const id = item.dataset.id;
    const questions = getQuestions();
    const idx = questions.findIndex((q) => q.id === id);
    if (idx !== -1) {
      state.currentIndex = idx;
      renderQuestionList();
      renderBuilder();
    }
  });

  saveQuizInfoBtn.addEventListener("click", async () => {
    const quiz = state.sets[state.currentSet];
    quiz.name = quizTitleInput.value.trim();
    quiz.description = quizDescInput.value.trim();
    const quizFile = quizInfoUploader.getFile();
    if (quizFile) {
      quiz.image = await fileToBase64(quizFile);
    } else if (quizInfoUploader.getIsCleared()) {
      quiz.image = null;
    }
    quizInfoUploader.resetCleared();
    quiz.oneWay = !oneWayOnly.checked;
    await saveState();
    editQuizDialog.close();
    renderBuilder();
  });

  quizDescInput.addEventListener("input", () => {
    quizDescChars.textContent = `${quizDescInput.value.length}/100`;
  });

  deleteSetBtn.addEventListener("click", async () => {
    if (confirm("Are you sure you want to delete this quiz set?")) {
      delete state.sets[state.currentSet];
      const remaining = Object.keys(state.sets);
      if (remaining.length === 0) {
        const id = `i${Date.now()}`;
        state.sets[id] = createSetTemplate("quiz");
        state.currentSet = id;
      } else {
        state.currentSet = remaining[0];
      }
      await saveState();
      window.location.href = "./index.html";
    }
  });

  quizTypeSelect.addEventListener("change", async () => {
    if (confirm("Changing type will reset questions. Continue?")) {
      state.sets[state.currentSet].type = quizTypeSelect.value;
      await saveState();
      renderBuilder();
    } else {
      quizTypeSelect.value = state.sets[state.currentSet].type;
    }
  });

  previewQuizBtn.addEventListener("click", () => {
    if (state.sets[state.currentSet].type === "flashcards") {
      window.location.href = `./flashcards.html?set=${state.currentSet}&mode=review`; // review mode for preview
    } else {
      window.location.href = `./quiz.html?set=${state.currentSet}&preview`;
    }
  });

  async function initApp() {
    loadTheme(state.userPrefs.theme);
    const setParam = new URLSearchParams(window.location.search).get("set");
    if (setParam) {
      state.currentSet = setParam;
    } else {
      const type = new URLSearchParams(window.location.search).get("type") || "quiz";
      const newSetId = `i${Date.now()}`;
      state.currentSet = newSetId;
      state.sets[newSetId] = createSetTemplate(type);
      await saveState();
    }

    if (!state.sets[state.currentSet]) {
      state.sets[state.currentSet] = createSetTemplate("quiz");
      await saveState();
    }

    if (!state.sets[state.currentSet].questions?.length) {
      state.sets[state.currentSet].questions = [createQuestion(state.sets[state.currentSet].type === "flashcards" ? "flashcard" : "multiple-choice")];
      await saveState();
    }

    renderSetInfo();
    renderQuestionList();
    renderBuilder();
  }

  closeBtn.addEventListener("click", () => {
    editQuizDialog.close();
  });

  await initApp();
});

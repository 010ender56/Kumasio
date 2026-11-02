import {
  loadTheme,
  createImageUploader,
  fileToBase64,
  createSetTemplate,
  initState,
  getState,
  saveFullState,
  updateState,
  trackRecentSet,
  pluralHelper,
  generateNavbar,
} from "./lib.js";

const nav = generateNavbar();
document.body.prepend(nav);

let state;
const isPreview = new URLSearchParams(window.location.search).has("preview");
const currentSetID = new URLSearchParams(window.location.search).get("set");

const setNameEl = document.getElementById("set-name");
const setDescEl = document.getElementById("set-desc");
const setInfoEl = document.getElementById("set-info");
const previewModeEl = document.getElementById("preview-mode");
const startScreen = document.getElementById("start-screen");
const quizContainer = document.getElementById("quiz-container");
const questionView = document.getElementById("question-view");
const reviewView = document.getElementById("review-view");
const completeView = document.getElementById("complete-view");
const questionContent = document.getElementById("question-content");
const startBtn = document.getElementById("start");
const backBtn = document.querySelector(".back-btn");
const nextBtn = document.querySelector(".next-btn");
const skipBtn = document.querySelector(".skip-btn");

let currentIndex = 0;
let busy = false;

// helpers

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Normalize whatever the editor stored in `question.feedback` into one of:
 *   "show" -> Show Correct Answer
 *   "hide" -> Hide Correct Answer
 *   "none" -> No Feedback
 */
function getFeedbackMode(question) {
  const raw = String(question.feedback ?? "")
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, "_");
  if (["show_correct", "show", "show_correct_answer", "showcorrect"].includes(raw)) return "show";
  if (["hide_correct", "hide", "hide_correct_answer", "hidecorrect"].includes(raw)) return "hide";
  return "none";
}

const getSet = () => state.sets[currentSetID];
const getQuestion = () => getSet().questions[currentIndex];
const responsePath = (q) => `activeSetResponses.${currentSetID}.questions.${q.id}`;
const submissionPath = (q) => `activeSetSubmissions.${currentSetID}.${q.id}`;
const getSavedResponse = (q) => state.activeSetResponses?.[currentSetID]?.questions?.[q.id];
const isSubmitted = (q) => Boolean(state.activeSetSubmissions?.[currentSetID]?.[q.id]);
// Locked = submitted and the question is not changeable after submission
const isLocked = (q) => isSubmitted(q) && q.changeable !== true;

function isResponseEmpty(response) {
  if (response === undefined || response === null) return true;
  if (Array.isArray(response)) return response.length === 0;
  if (typeof response === "string") return response.trim() === "";
  return false;
}

let saveChain = Promise.resolve();
function persist(path, value) {
  saveChain = saveChain
    .then(async () => {
      state = await updateState(path, value);
    })
    .catch((err) => console.error("Save failed:", path, err));
  return saveChain;
}

async function loadAppState() {
  try {
    state = await getState();
    if (!state.activeSetResponses) state.activeSetResponses = {};
    if (!state.activeSetSubmissions) state.activeSetSubmissions = {};
    if (!state.results) state.results = {};

    loadTheme(state.userPrefs?.theme);
    initApp();
  } catch (err) {
    console.error("Error loading state:", err);
  }
}

function initApp() {
  const currentSet = state.sets?.[currentSetID];
  if (!currentSet) {
    alert("Set not found!");
    window.location.href = "./index.html";
    return;
  }

  if (!state.activeSetResponses[currentSetID]) {
    state.activeSetResponses[currentSetID] = { questions: {} };
  }
  if (!state.activeSetSubmissions[currentSetID]) {
    state.activeSetSubmissions[currentSetID] = {};
  }

  previewModeEl.style.display = isPreview ? "block" : "none";
  document.title = currentSet.name || "Untitled";
  setNameEl.textContent = currentSet.name || "Set Name";
  setDescEl.textContent = currentSet.description || "Set Description";
  setInfoEl.textContent = `${pluralHelper(currentSet.questions.length, "question")} · Estimated ${currentSet.questions.length * 2} mins · Quiz`;

  startBtn.addEventListener("click", startQuiz);
  backBtn.addEventListener("click", () => navigate(-1));
  nextBtn.addEventListener("click", handleNext);
  skipBtn.addEventListener("click", handleSkip);
}

function startQuiz() {
  const currentSet = getSet();
  if (!currentSet?.questions?.length) {
    alert("This set has no questions!");
    return;
  }
  startScreen.style.display = "none";
  quizContainer.style.display = "block";
  showQuestion(0);
}

// Navigation

async function showQuestion(index) {
  const set = getSet();
  currentIndex = Math.max(0, Math.min(index, set.questions.length - 1));
  const question = getQuestion();

  reviewView.style.display = "none";
  completeView.style.display = "none";
  questionView.style.display = "block";

  renderQuestion(question);
  restoreResponse(question);

  if (isSubmitted(question)) {
    renderFeedback(question);
    if (isLocked(question)) lockQuestion();
  }
  updateNavButtons();
}

async function navigate(direction) {
  await autoSave();
  await showQuestion(currentIndex + direction);
}

async function goToQuestion(index) {
  await autoSave();
  await showQuestion(index);
}

async function advance() {
  await autoSave();
  if (currentIndex >= getSet().questions.length - 1) {
    await showReview();
  } else {
    await showQuestion(currentIndex + 1);
  }
}

async function handleSkip() {
  if (busy) return;
  const question = getQuestion();
  if (question.required) return; // required questions can never be skipped
  busy = true;
  try {
    await advance();
  } finally {
    busy = false;
  }
}

async function handleNext() {
  if (busy) return;
  busy = true;
  try {
    const question = getQuestion();
    const response = getCurrentResponse();

    if (question.required && isResponseEmpty(response)) {
      showFeedbackBox("This question is required. Please answer it before continuing.", "error");
      return;
    }

    if (isSubmitted(question)) {
      await advance();
      return;
    }

    if (isResponseEmpty(response)) {
      await advance();
      return;
    }

    await persist(responsePath(question), response);
    await persist(submissionPath(question), true);

    renderFeedback(question);
    if (isLocked(question)) lockQuestion();
    updateNavButtons();
  } finally {
    busy = false;
  }
}

function updateNavButtons() {
  const set = getSet();
  const question = getQuestion();
  const isLast = currentIndex === set.questions.length - 1;

  backBtn.disabled = currentIndex === 0;
  backBtn.style.display = set.oneWay ? "none" : "";

  if (isSubmitted(question)) {
    nextBtn.textContent = isLast ? (set.oneWay ? "Finish" : "Review & Turn In") : "Next →";
    skipBtn.style.display = "none";
  } else {
    nextBtn.textContent = "Submit";
    skipBtn.style.display = question.required ? "none" : "";
  }
}

function getCurrentResponse() {
  const question = getQuestion();
  switch (question.type) {
    case "multiple-choice":
    case "true-false": {
      const selected = questionContent.querySelector('input[name="quiz-answer"]:checked');
      return selected ? parseInt(selected.value, 10) : null;
    }
    case "multiple-response":
      return Array.from(questionContent.querySelectorAll('input[type="checkbox"]:checked')).map(
        (cb) => parseInt(cb.value, 10),
      );
    case "short-answer": {
      const input = questionContent.querySelector(".short-answer-input");
      return input ? input.value.trim() : "";
    }
    case "long-answer": {
      const textarea = questionContent.querySelector(".long-answer-input");
      return textarea ? textarea.value.trim() : "";
    }
    default:
      return null;
  }
}

function restoreResponse(question) {
  const saved = getSavedResponse(question);
  if (saved === undefined || saved === null) return;

  if (question.type === "multiple-choice" || question.type === "true-false") {
    const radio = questionContent.querySelector(`input[name="quiz-answer"][value="${saved}"]`);
    if (radio) radio.checked = true;
  } else if (question.type === "multiple-response") {
    const list = Array.isArray(saved) ? saved : [];
    questionContent.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
      cb.checked = list.includes(parseInt(cb.value, 10));
    });
  } else if (question.type === "short-answer") {
    const input = questionContent.querySelector(".short-answer-input");
    if (input) input.value = saved;
  } else if (question.type === "long-answer") {
    const textarea = questionContent.querySelector(".long-answer-input");
    if (textarea) textarea.value = saved;
  }
}

async function autoSave() {
  if (!state?.sets?.[currentSetID]) return;
  const question = getQuestion();
  if (!question || isLocked(question)) return;
  await persist(responsePath(question), getCurrentResponse());
}

// this fires every answer edit
async function onAnswerChanged(event) {
  const question = getQuestion();
  if (isLocked(question)) return;

  if (question.type === "long-answer" && question.validationType === "number") {
    event.target.value = event.target.value.replace(/[^\d.\-]/g, "");
  }

  await autoSave();

  if (isSubmitted(question)) {
    if (isResponseEmpty(getSavedResponse(question))) {
      await persist(submissionPath(question), false);
      hideFeedbackBox();
    } else {
      renderFeedback(question);
    }
    updateNavButtons();
  }
}

function lockQuestion() {
  questionContent
    .querySelectorAll(".answer-container input, .answer-container textarea")
    .forEach((input) => {
      input.disabled = true;
      input.classList.add("locked-answer");
    });
  if (!questionContent.querySelector(".locked-notice")) {
    const notice = document.createElement("small");
    notice.className = "locked-notice";
    notice.textContent = "This question has been submitted. You cannot change it.";
    questionContent.appendChild(notice);
  }
}

function normalizeText(s) {
  return String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Returns { status, message, correctText }
 * status: "correct" | "partial" | "wrong" | "unanswered" | "ungraded"
 */
function getFeedback(question, response) {
  if (isResponseEmpty(response)) {
    return { status: "unanswered", message: "No answer provided.", correctText: "" };
  }

  const options = question.options || [];

  if (question.type === "multiple-choice" || question.type === "true-false") {
    const correctText = options
      .filter((o) => o.correct)
      .map((o) => o.text)
      .join(", ");
    const isCorrect = options[response]?.correct === true;
    return isCorrect
      ? { status: "correct", message: "Correct!", correctText }
      : { status: "wrong", message: "Wrong!", correctText };
  }

  if (question.type === "multiple-response") {
    const selected = Array.isArray(response) ? response : [];
    const correctIdx = options.map((o, i) => (o.correct ? i : -1)).filter((i) => i !== -1);
    const correctText = correctIdx.map((i) => options[i].text).join(", ");

    const hits = selected.filter((i) => correctIdx.includes(i)).length;
    const misses = selected.length - hits;
    const exact = hits === correctIdx.length && misses === 0;

    if (exact) return { status: "correct", message: "Correct!", correctText };
    if (hits > 0) return { status: "partial", message: "Partially Correct!", correctText };
    return { status: "wrong", message: "Wrong!", correctText };
  }

  if (question.type === "short-answer" || question.type === "long-answer") {
    const expected = String(question.expectedAnswer ?? "").trim();
    if (!expected) {
      return { status: "ungraded", message: "Submitted", correctText: "" };
    }

    const given = String(response).trim();
    let isCorrect;
    if (question.validationType === "number" && isFinite(Number(given)) && isFinite(Number(expected))) {
      isCorrect = Number(given) === Number(expected);
    } else if (/exact/i.test(question.validationMode || "")) {
      isCorrect = normalizeText(given) === normalizeText(expected);
    } else {
      isCorrect = normalizeText(given).includes(normalizeText(expected));
    }
    return isCorrect
      ? { status: "correct", message: "Correct!", correctText: expected }
      : { status: "wrong", message: "Wrong!", correctText: expected };
  }

  return { status: "ungraded", message: "Submitted", correctText: "" };
}

// todo: move to styles.css or smth
const FEEDBACK_COLORS = {
  correct: ["#d4edda", "#155724"],
  partial: ["#fff3cd", "#856404"],
  wrong: ["#f8d7da", "#721c24"],
  unanswered: ["#f8d7da", "#721c24"],
  error: ["#f8d7da", "#721c24"],
  neutral: ["#e2e3e5", "#383d41"],
};

function showFeedbackBox(lines, kind) {
  const box = document.getElementById("feedback-container");
  if (!box) return;
  const [bg, fg] = FEEDBACK_COLORS[kind] || FEEDBACK_COLORS.neutral;
  box.innerHTML = "";
  (Array.isArray(lines) ? lines : [lines]).forEach((line) => {
    const p = document.createElement("div");
    p.textContent = line;
    box.appendChild(p);
  });
  box.style.display = "block";
  box.style.backgroundColor = bg;
  box.style.color = fg;
}

function hideFeedbackBox() {
  const box = document.getElementById("feedback-container");
  if (box) box.style.display = "none";
}

function renderFeedback(question) {
  const mode = getFeedbackMode(question);
  const result = getFeedback(question, getSavedResponse(question));

  if (mode === "none") {
    showFeedbackBox("Submitted", "neutral");
    return;
  }

  const lines = [result.message];
  if (mode === "show" && result.correctText) {
    lines.push(`Correct answer: ${result.correctText}`);
  }
  showFeedbackBox(lines, result.status === "ungraded" ? "neutral" : result.status);
}

// review

async function showReview() {
  const set = getSet();
  let html = `<h1>You've finished.</h1>`;

  if (!set.oneWay) {
    html += `<p>Review your questions anytime before turning in.</p><div class="review-list">`;
    set.questions.forEach((q, idx) => {
      const answered = !isResponseEmpty(getSavedResponse(q));
      html += `
        <div class="review-item" data-index="${idx}">
          ${q.image ? `<img src="${escapeHtml(q.image)}" alt="Question image">` : ""}
          <div class="title"><p class="muted-text">${idx + 1}. </p>${q.required ? "* " : ""}${escapeHtml(q.text)}</div>
          <div class="status ${answered ? "answered" : "Unanswered"}">${answered ? "Answered" : "Unanswered"}</div>
        </div>`;
    });
    html += `</div><hr /><button class="cta" id="reviewBack">No, I want to go back.</button>`;
  }

  html += `<p id="review-error" style="display:none; color:#721c24;"></p>
           <button class="btn" id="finishQuiz">Yes, proceed and turn in.</button>`;

  reviewView.innerHTML = html;
  questionView.style.display = "none";
  completeView.style.display = "none";
  reviewView.style.display = "block";

  reviewView.querySelectorAll(".review-item").forEach((el) => {
    el.addEventListener("click", () => goToQuestion(parseInt(el.dataset.index, 10)));
  });
  document.getElementById("reviewBack")?.addEventListener("click", () => showQuestion(currentIndex));

  const finishBtn = document.getElementById("finishQuiz");
  finishBtn.addEventListener("click", async () => {
    const missing = set.questions
      .map((q, i) => ({ q, i }))
      .filter(({ q }) => q.required && isResponseEmpty(getSavedResponse(q)));
    if (missing.length) {
      const err = document.getElementById("review-error");
      err.textContent = `Required question${missing.length > 1 ? "s" : ""} unanswered: ${missing
        .map(({ i }) => i + 1)
        .join(", ")}.`;
      err.style.display = "block";
      return;
    }
    finishBtn.disabled = true;
    await renderCompleteScreen();
  });
}

async function renderCompleteScreen() {
  const set = getSet();
  const answers = state.activeSetResponses[currentSetID]?.questions || {};

  let correctCount = 0;
  let gradable = 0;
  let resultsHtml = `<div class="complete-results">`;
  const attempt = [];

  set.questions.forEach((q, idx) => {
    const response = answers[q.id];
    const fb = getFeedback(q, response);
    const answered = !isResponseEmpty(response);

    // Ungradable questions DO NOT count toward / reveal the score
    const counts = fb.status !== "ungraded";
    if (counts) {
      gradable++;
      if (fb.status === "correct") correctCount++;
    }
    attempt.push({ id: q.id, response: response ?? null, status: fb.status });

    let userAnsText = "No answer";
    if (answered) {
      if (q.type === "multiple-choice" || q.type === "true-false") {
        userAnsText = q.options[response]?.text ?? "No answer";
      } else if (q.type === "multiple-response") {
        userAnsText = (q.options || [])
          .filter((_, i) => Array.isArray(response) && response.includes(i))
          .map((o) => o.text)
          .join(", ");
      } else {
        userAnsText = String(response);
      }
    }

    let statusText;
    let statusColor = "inherit";
    if (!answered) {
      statusText = "Not answered";
    } else if (fb.status === "ungraded") {
      statusText = "Submitted";
    } else {
      statusText = fb.message;
      statusColor = fb.status === "correct" ? "green" : fb.status === "partial" ? "orange" : "red";
    }
    const showCorrect = fb.correctText;

    resultsHtml += `
      <div class="review-item">
        <div class="title">
          <p class="muted-text">${idx + 1}. </p>${escapeHtml(q.text)}
          <div style="font-size: 0.8rem; color: var(--muted);">
            Your answer: ${escapeHtml(userAnsText)}
            ${showCorrect ? `<br>Correct answer: ${escapeHtml(fb.correctText)}` : ""}
          </div>
        </div>
        <div class="status ${fb.status === "correct" && counts ? "answered" : ""}" style="color: ${statusColor}">
          ${escapeHtml(statusText)}
        </div>
      </div>`;
  });
  resultsHtml += `</div>`;

  const scoreBlock =
    gradable > 0
      ? `<div class="score-circle" style="width:100px; height:100px; border-radius:50%; border:5px solid var(--accent); display:flex; align-items:center; justify-content:center; font-size:1.5rem; font-weight:bold; margin: 20px auto;">${Math.round((correctCount / gradable) * 100)}%</div>
         <p style="text-align:center">${correctCount} out of ${gradable} correct</p>`
      : `<p style="text-align:center; margin: 20px 0;">Your responses have been submitted.</p>`;

  completeView.innerHTML = `
    <h1 style="text-align:center">You've reached the end.</h1>
    <p style="text-align:center">You finished <b>${escapeHtml(set.name)}</b> at <b>${new Date().toLocaleString("en-US", { hour12: false })}</b></p>
    ${scoreBlock}
    ${resultsHtml}
    <div style="display:flex; justify-content:center; margin-top:20px">
      <a href="./index.html" class="cta">Return to Home</a>
    </div>`;

  questionView.style.display = "none";
  reviewView.style.display = "none";
  completeView.style.display = "flex";
  completeView.style.flexDirection = "column";
  completeView.style.alignItems = "center";

  // Record the attempt, then reset the in-progress bucket so a retake starts fresh
  if (!isPreview) {
    trackRecentSet(currentSetID);
    const prior = Array.isArray(state.results?.[currentSetID]) ? state.results[currentSetID] : [];
    await persist(`results.${currentSetID}`, [
      ...prior,
      { finishedAt: Date.now(), correct: correctCount, gradable, answers: attempt },
    ]);
  }
  await persist(`activeSetResponses.${currentSetID}`, { questions: {} });
  await persist(`activeSetSubmissions.${currentSetID}`, {});
}

function buildOptionLabel(question, opt, idx, inputType) {
  const label = document.createElement("label");
  label.className = "answer-option";

  const input = document.createElement("input");
  input.type = inputType;
  if (inputType === "radio") input.name = "quiz-answer";
  input.value = idx;
  input.addEventListener("change", onAnswerChanged);

  const text = document.createElement("span");
  text.textContent = opt.text;

  label.appendChild(input);
  label.appendChild(text);

  if (opt.image) {
    const img = document.createElement("img");
    img.src = opt.image;
    img.className = "option-image";
    img.style.maxWidth = "100px";
    img.style.display = "block";
    label.appendChild(img);
  }
  return label;
}

function renderQuestion(question) {
  const set = getSet();
  questionContent.innerHTML = "";

  const container = document.createElement("div");
  container.className = "question-container";

  const qIndex = document.createElement("p");
  qIndex.textContent = `${currentIndex + 1}/${set.questions.length}`;
  container.appendChild(qIndex);

  const qText = document.createElement("h3");
  if (question.required) {
    const star = document.createElement("span");
    star.className = "required-marker";
    star.textContent = "* ";
    star.title = "Required";
    qText.appendChild(star);
  }
  qText.appendChild(document.createTextNode(question.text));
  container.appendChild(qText);

  if (question.image) {
    const img = document.createElement("img");
    img.src = question.image;
    img.className = "question-image";
    img.style.maxWidth = "100%";
    img.style.display = "block";
    img.style.margin = "10px 0";
    container.appendChild(img);
  }

  const answerContainer = document.createElement("div");
  answerContainer.className = "answer-container";

  if (question.type === "multiple-choice" || question.type === "true-false") {
    (question.options || []).forEach((opt, idx) =>
      answerContainer.appendChild(buildOptionLabel(question, opt, idx, "radio")),
    );
  } else if (question.type === "multiple-response") {
    (question.options || []).forEach((opt, idx) =>
      answerContainer.appendChild(buildOptionLabel(question, opt, idx, "checkbox")),
    );
  } else if (question.type === "short-answer") {
    const input = document.createElement("input");
    input.type = question.validationType === "number" ? "number" : "text";
    input.className = "short-answer-input";
    input.placeholder = "Your answer here...";
    input.addEventListener("input", onAnswerChanged);
    answerContainer.appendChild(input);
  } else if (question.type === "long-answer") {
    const textarea = document.createElement("textarea");
    textarea.className = "long-answer-input";
    textarea.placeholder = "Your answer here...";
    textarea.addEventListener("input", onAnswerChanged);
    answerContainer.appendChild(textarea);
  }

  container.appendChild(answerContainer);

  const feedbackDiv = document.createElement("div");
  feedbackDiv.id = "feedback-container";
  feedbackDiv.className = "feedback-container";
  feedbackDiv.style.display = "none";
  feedbackDiv.style.marginTop = "20px";
  feedbackDiv.style.padding = "10px";
  feedbackDiv.style.borderRadius = "5px";
  feedbackDiv.style.fontWeight = "bold";
  container.appendChild(feedbackDiv);

  questionContent.appendChild(container);
}

loadAppState();
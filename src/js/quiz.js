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
let isPreview = new URLSearchParams(window.location.search).has("preview") || false;
let currentSetID = new URLSearchParams(window.location.search).get("set");

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

async function loadAppState() {
  try {
    state = await getState();

    // Ensure activeSetResponses and results exist
    if (!state.activeSetResponses) {
      state.activeSetResponses = { questions: {} };
    }
    if (!state.results) {
      state.results = {};
    }

    loadTheme(state.userPrefs.theme);
    initApp();
  } catch (err) {
    console.error("Error loading state:", err);
  }
}

async function initApp() {
  let currentSet = state.sets[currentSetID];
  if (!currentSet) {
    alert("Set not found!");
    window.location.href = "./index.html";
    return;
  }
  console.log("Set data found:", currentSet);

  // Ensure current set's response bucket exists
  if (!state.activeSetResponses[currentSetID]) {
    state.activeSetResponses[currentSetID] = { questions: {} };
  }
  if (!state.activeSetSubmissions) {
    state.activeSetSubmissions = {};
  }
  if (!state.activeSetSubmissions[currentSetID]) {
    state.activeSetSubmissions[currentSetID] = {};
  }

  if (isPreview) {
    previewModeEl.style.display = "block";
  } else {
    previewModeEl.style.display = "none";
  }
  document.title = currentSet.name || "Untitled";
  setNameEl.textContent = currentSet.name || "Set Name";
  setDescEl.textContent = currentSet.description || "Set Description";

  setInfoEl.textContent = `${pluralHelper(currentSet.questions.length, "question")} · Estimated ${currentSet.questions.length * 2} mins · Quiz`;

  startBtn.addEventListener("click", startQuiz);
  backBtn.addEventListener("click", () => navigate(-1));
  nextBtn.addEventListener("click", handleNext);
  skipBtn.addEventListener("click", () => navigate(1));
}

async function handleNext() {
  const currentSet = state.sets[currentSetID];
  const currentQuestion = currentSet.questions[currentIndex];

  const response = getCurrentResponse();
  if (currentQuestion.required && isResponseEmpty(response)) {
    alert("This question is required. Please provide an answer before proceeding.");
    return;
  }

  if (currentIndex === currentSet.questions.length - 1) {
    // Save final response
    await updateState(
      `activeSetResponses.${currentSetID}.questions.${currentQuestion.id}`,
      response,
    );

    let reviewHtml = `<h1>You've finished.</h1>`;

    if (!currentSet.oneWay) {
      reviewHtml += `<p>Review your questions anytime before turning in.</p>
                          <div class="review-list">`;

      currentSet.questions.forEach((q, idx) => {
        const resp = state.activeSetResponses[currentSetID]?.questions[q.id];
        let isAnswered = false;
        if (resp !== undefined && resp !== null) {
          if (Array.isArray(resp)) {
            isAnswered = resp.length > 0;
          } else if (typeof resp === "string") {
            isAnswered = resp.trim() !== "";
          } else {
            isAnswered = true;
          }
        }
        reviewHtml += `
                                <div class="review-item" onclick="goToQuestion(${idx})">
                                    ${q.image ? `<img src="${q.image}" alt="Question image">` : ""}
                                    <div class="title"><p class="muted-text">${idx + 1}. </p>${q.text}</div>
                                    <div class="status ${isAnswered ? "answered" : "Unanswered"}">${isAnswered ? "Answered" : "Unanswered"}</div>
                                </div>
                            `;
      });

      reviewHtml += `</div>
                          <hr />
                          <button class="cta" onclick="navigate(0)">No, I want to go back.</button>`;
    }

    reviewHtml += `<button class="btn" id="finishQuiz">Yes, proceed and turn in.</button>`;
    reviewView.innerHTML = reviewHtml;
    questionView.style.display = "none";
    reviewView.style.display = "block";

    document.getElementById("finishQuiz").addEventListener("click", () => {
      renderCompleteScreen();
    });
  } else {
    const feedbackMode = currentQuestion.feedback || "submitted";
    if (
      feedbackMode !== "submitted" &&
      !state.activeSetSubmissions?.[currentSetID]?.[currentQuestion.id]
    ) {
      const response = getCurrentResponse();
      await updateState(
        `activeSetResponses.${currentSetID}.questions.${currentQuestion.id}`,
        response,
      );
      await updateState(`activeSetSubmissions.${currentSetID}.${currentQuestion.id}`, true);

      const feedback = getFeedback(currentQuestion, response);
      const feedbackDiv = document.getElementById("feedback-container");

      if (feedbackDiv) {
        feedbackDiv.textContent = feedback.message;
        feedbackDiv.style.display = "block";
        feedbackDiv.style.backgroundColor =
          feedback.status === "correct"
            ? "#d4edda"
            : feedback.status === "partial"
              ? "#fff3cd"
              : "#f8d7da";
        feedbackDiv.style.color =
          feedback.status === "correct"
            ? "#155724"
            : feedback.status === "partial"
              ? "#856404"
              : "#721c24";

        if (currentQuestion.feedback === "show_correct" && feedback.status !== "correct") {
          feedbackDiv.textContent += ` Correct answer: ${feedback.correctText}`;
        }
      }

      updateNavButtons();

      if (!isResponseEmpty(response) && currentQuestion.changeable !== true) {
        setInputsDisabled(true);
      }
    } else {
      navigate(1);
    }
  }
}

function startQuiz() {
  const currentSet = state.sets[currentSetID];
  if (!currentSet || !currentSet.questions || currentSet.questions.length === 0) {
    alert("This set has no questions!");
    return;
  }

  startScreen.style.display = "none";
  quizContainer.style.display = "block";
  currentIndex = 0;
  renderQuestion(currentSet.questions[currentIndex]);
  restoreResponse(currentIndex);
  updateNavButtons();
}

function getCurrentResponse() {
  const currentSet = state.sets[currentSetID];
  const question = currentSet.questions[currentIndex];
  let response = null;

  if (question.type === "multiple-choice" || question.type === "true-false") {
    const selectedOption = document.querySelector('input[name="quiz-answer"]:checked');
    if (selectedOption) {
      response = parseInt(selectedOption.value);
    }
  } else if (question.type === "multiple-response") {
    const selectedOptions = Array.from(
      document.querySelectorAll('input[type="checkbox"]:checked'),
    ).map((cb) => parseInt(cb.value));
    response = selectedOptions;
  } else if (question.type === "short-answer") {
    const input = document.querySelector(".short-answer-input");
    response = input ? input.value.trim() : "";
  } else if (question.type === "long-answer") {
    const textarea = document.querySelector(".long-answer-input");
    response = textarea ? textarea.value.trim() : "";
  }

  return response;
}

function restoreResponse(index) {
  const currentSet = state.sets[currentSetID];
  const savedResponse =
    state.activeSetResponses[currentSetID]?.questions[currentSet.questions[index].id];
  if (savedResponse !== undefined && savedResponse !== null) {
    if (
      currentSet.questions[index].type === "multiple-choice" ||
      currentSet.questions[index].type === "true-false"
    ) {
      const radioToCheck = document.querySelector(
        `input[name="quiz-answer"][value="${savedResponse}"]`,
      );
      if (radioToCheck) radioToCheck.checked = true;
    } else if (currentSet.questions[index].type === "multiple-response") {
      const checkboxesToCheck = document.querySelectorAll('input[type="checkbox"]');
      checkboxesToCheck.forEach((cb) => {
        cb.checked = savedResponse.includes(parseInt(cb.value));
      });
    } else if (currentSet.questions[index].type === "short-answer") {
      const input = document.querySelector(".short-answer-input");
      if (input) input.value = savedResponse;
    } else if (currentSet.questions[index].type === "long-answer") {
      const textarea = document.querySelector(".long-answer-input");
      if (textarea) textarea.value = savedResponse;
    }
  }
}

async function goToQuestion(index) {
  await autoSave();
  const currentSet = state.sets[currentSetID];
  currentIndex = Math.max(0, Math.min(index, currentSet.questions.length - 1));

  reviewView.style.display = "none";
  questionView.style.display = "block";

  renderQuestion(currentSet.questions[currentIndex]);
  updateNavButtons();
  restoreResponse(currentIndex);
}
window.goToQuestion = goToQuestion;

async function navigate(direction) {
  const currentSet = state.sets[currentSetID];
  reviewView.style.display = "none";
  questionView.style.display = "block";

  await autoSave();

  currentIndex += direction;
  if (currentIndex < 0) currentIndex = 0;
  if (currentIndex >= currentSet.questions.length) {
    currentIndex = currentSet.questions.length - 1;
  }

  renderQuestion(currentSet.questions[currentIndex]);
  updateNavButtons();
  restoreResponse(currentIndex);
}
window.navigate = navigate;

function updateNavButtons() {
  const currentSet = state.sets[currentSetID];
  const currentQuestion = currentSet.questions[currentIndex];
  const feedbackMode = currentQuestion.feedback || "submitted";
  backBtn.disabled = currentIndex === 0;
  skipBtn.style.display = "block";

  if (currentIndex === currentSet.questions.length - 1) {
    nextBtn.textContent = "Review & Turn In";
    skipBtn.style.display = "none";
  } else if (
    feedbackMode === "submitted" ||
    state.activeSetSubmissions?.[currentSetID]?.[currentQuestion.id]
  ) {
    nextBtn.textContent = "Next →";
    skipBtn.style.display = "none";
  } else {
    if (!currentQuestion.required) {
      skipBtn.style.display = "none";
    }
    nextBtn.textContent = "Submit";
  }
}

async function autoSave() {
  const currentSet = state.sets[currentSetID];
  if (currentSet && currentSet.questions[currentIndex]) {
    const response = getCurrentResponse();
    state = await updateState(
      `activeSetResponses.${currentSetID}.questions.${currentSet.questions[currentIndex].id}`,
      response,
    );
  }
}

function getFeedback(question, response) {
  if (response === undefined || response === null || response === "")
    return { status: "wrong", message: "No answer provided." };

  let isCorrect = false;
  let isPartial = false;
  let correctText = "";

  if (question.type === "multiple-choice" || question.type === "true-false") {
    const expected = question.options.find((o) => o.correct)?.text;
    const selected = question.options[response]?.text;
    isCorrect = selected === expected;
    correctText = expected;
  } else if (question.type === "multiple-response") {
    const expected = question.options
      .filter((o) => o.correct)
      .map((o) => o.text)
      .sort();
    const selected = question.options
      .filter((_, idx) => response.includes(idx))
      .map((o) => o.text)
      .sort();

    if (JSON.stringify(expected) === JSON.stringify(selected)) {
      isCorrect = true;
    } else {
      const correctSelected = selected.filter((s) => expected.includes(s));
      const wrongSelected = selected.filter((s) => !expected.includes(s));
      if (correctSelected.length > 0 && wrongSelected.length > 0) {
        isPartial = true;
      } else if (correctSelected.length > 0) {
        isPartial = true;
      }
    }

    correctText = expected.join(", ");
  } else if (question.type === "short-answer" || question.type === "long-answer") {
    const expected = question.expectedAnswer;
    const selected = response.trim();
    if (question.validationMode === "exact match") {
      isCorrect = selected.toLowerCase() === expected.toLowerCase();
    } else {
      isCorrect =
        selected.toLowerCase().includes(expected.toLowerCase()) ||
        expected.toLowerCase().includes(selected.toLowerCase());
    }
    correctText = expected;
  }

  if (isCorrect) return { status: "correct", message: "Correct!", correctText };
  if (isPartial) return { status: "partial", message: "Partially Correct!", correctText };
  return { status: "wrong", message: "Wrong!", correctText };
}

function isResponseEmpty(response) {
  if (response === undefined || response === null) return true;
  if (Array.isArray(response)) return response.length === 0;
  if (typeof response === "string") return response.trim() === "";
  return false;
}

function setInputsDisabled(disabled) {
  const inputs = document.querySelectorAll(".answer-container input, .answer-container textarea");
  inputs.forEach((input) => {
    input.disabled = disabled;
    if (disabled) {
      input.classList.add("locked-answer");
    } else {
      input.classList.remove("locked-answer");
    }
  });
}

function renderCompleteScreen() {
  trackRecentSet(currentSetID);
  const currentSet = state.sets[currentSetID];
  const responses = state.activeSetResponses[currentSetID] || { questions: {} };

  let correctCount = 0;
  let totalQuestions = currentSet.questions.length;

  let resultsHtml = `<div class="complete-results">`;

  currentSet.questions.forEach((q, idx) => {
    const response = responses.questions[q.id];
    const feedback = getFeedback(q, response);

    if (feedback.status === "correct") correctCount++;

    let userAnsText = response === null ? "No answer" : "Unknown";
    if (q.type === "multiple-choice" || q.type === "true-false") {
      userAnsText = q.options[response]?.text || "No answer";
    } else if (q.type === "multiple-response") {
      userAnsText = Array.isArray(response)
        ? q.options
            .filter((_, i) => response.includes(i))
            .map((o) => o.text)
            .join(", ")
        : "No answer";
    } else {
      userAnsText = response || "No answer";
    }

    resultsHtml += `
                        <div class="review-item">
                            <div class="title">
                                <p class="muted-text">${idx + 1}. </p>${q.text}
                                <div style="font-size: 0.8rem; color: var(--muted);">
                                    Your answer: ${userAnsText}
                                </div>
                            </div>
                            <div class="status ${feedback.status === "correct" ? "answered" : ""}" style="color: ${feedback.status === "correct" ? "green" : feedback.status === "partial" ? "orange" : "red"}">
                                ${feedback.message}
                            </div>
                        </div>
                    `;
  });
  resultsHtml += `</div>`;

  const percentage = Math.round((correctCount / totalQuestions) * 100);

  completeView.innerHTML = `
                    <h1 style="text-align:center">You've reached the end.</h1>
                    <p style="text-align:center">You finished <b>${currentSet.name}</b> at <b>${new Date().toLocaleString("en-US", { hour12: false })}</b></p>
                    <div class="score-circle" style="width:100px; height:100px; border-radius:50%; border:5px solid var(--accent); display:flex; align-items:center; justify-content:center; font-size:1.5rem; font-weight:bold; margin: 20px auto;">${percentage}%</div>
                    <p style="text-align:center">${correctCount} out of ${totalQuestions} correct</p>
                    ${resultsHtml}
                    <div style="display:flex; justify-content:center; margin-top:20px">
                        <a href="./index.html" class="cta">Return to Home</a>
                    </div>
                `;

  questionView.style.display = "none";
  reviewView.style.display = "none";
  completeView.style.display = "flex";
  completeView.style.flexDirection = "column";
  completeView.style.alignItems = "center";
}

function renderQuestion(question) {
  const currentSet = state.sets[currentSetID];
  questionContent.innerHTML = "";

  const container = document.createElement("div");
  container.className = "question-container";

  const qIndex = document.createElement("p");
  qIndex.textContent = `${currentSet.questions.findIndex((q) => q.id === question.id) + 1}/${currentSet.questions.length}`;
  container.appendChild(qIndex);

  const qText = document.createElement("h3");
  qText.textContent = `${question.required ? "*" : ""} ${question.text}`;
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
    question.options.forEach((opt, idx) => {
      const label = document.createElement("label");
      label.className = "answer-option";

      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = "quiz-answer";
      radio.value = idx;
      radio.addEventListener("change", autoSave);

      const text = document.createElement("span");
      text.textContent = opt.text;

      label.appendChild(radio);
      label.appendChild(text);

      if (opt.image) {
        const img = document.createElement("img");
        img.src = opt.image;
        img.className = "option-image";
        img.style.maxWidth = "100px";
        img.style.display = "block";
        label.appendChild(img);
      }

      answerContainer.appendChild(label);
    });
  } else if (question.type === "multiple-response") {
    question.options.forEach((opt, idx) => {
      const label = document.createElement("label");
      label.className = "answer-option";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = idx;
      checkbox.addEventListener("change", autoSave);

      const text = document.createElement("span");
      text.textContent = opt.text;

      label.appendChild(checkbox);
      label.appendChild(text);

      if (opt.image) {
        const img = document.createElement("img");
        img.src = opt.image;
        img.className = "option-image";
        img.style.maxWidth = "100px";
        img.style.display = "block";
        label.appendChild(img);
      }

      answerContainer.appendChild(label);
    });
  } else if (question.type === "short-answer") {
    const input = document.createElement("input");
    input.type = question.validationType === "number" ? "number" : "text";
    input.className = "short-answer-input";
    input.placeholder = "Your answer here...";
    input.addEventListener("input", autoSave);
    answerContainer.appendChild(input);
  } else if (question.type === "long-answer") {
    const textarea = document.createElement("textarea");
    textarea.className = "long-answer-input";
    textarea.placeholder = "Your answer here...";
    textarea.addEventListener("input", autoSave);
    if (question.validationType === "number") {
      textarea.oninput = function () {
        this.value = this.value.replace(/[\\d.]/g, "");
      };
    }
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

  const wasSubmitted = state.activeSetSubmissions?.[currentSetID]?.[question.id];
  const response = state.activeSetResponses?.[currentSetID]?.questions[question.id];
  if (wasSubmitted && !isResponseEmpty(response) && question.changeable !== true) {
    setInputsDisabled(true);

    const alreadyAnsweredNotice = document.createElement("small");
    alreadyAnsweredNotice.textContent =
      "This question has already been answered. You cannot change it.";
    questionContent.appendChild(alreadyAnsweredNotice);
  }
}

// Start the app
loadAppState();

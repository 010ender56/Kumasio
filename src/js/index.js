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
  notification,
  showToast,
  trackRecentSet,
} from "./lib.js";

const nav = generateNavbar();
document.body.prepend(nav);

const grid = document.getElementById("quizGrid");
const recentGrid = document.getElementById("recentSets");
const greetingHeader = document.getElementById("greeting-header");
const noQuizzesMsg = document.getElementById("noQuizzesMsg");
const createNewBtn = document.querySelector(".create-btn");
const createOptionsContainer = document.querySelector(".create-options-container");
const createFromImportBtn = document.getElementById("newImport");
const createFlashcardsBtn = document.getElementById("newFlashcard");
const createQuizBtn = document.getElementById("newQuiz");
const createDevQuizBtn = document.getElementById("newDevQuiz");
const overviewDialog = document.getElementById("set-overview");
const overviewDialogCloseBtn = document.getElementById("overview-close-btn");
const overviewDialogEditBtn = document.getElementById("edit-this-set");
const overviewDialogPracticeBtn = document.getElementById("practice-this-set");
const overviewSetName = document.getElementById("set-title");
const overviewSetDescription = document.getElementById("set-description");
const overviewSetType = document.getElementById("set-type");

let state;
let sneezes = 0;

function showOverviewDialog(setID) {
  if (!setID) throw new Error("need setID to open the overview dialog");

  // populate data
  const setData = state.sets[setID];
  overviewSetName.textContent = setData.name;
  overviewSetDescription.textContent = setData.description;

  // set the quiz type
  if (setData.type === "quiz") {
    overviewSetType.textContent = "Quiz";
  } else if (setData.type === "flashcards") {
    overviewSetType.textContent = "Flashcards";
  } else {
    overviewSetType.textContent = "Unknown";
  }

  overviewDialogEditBtn.addEventListener("click", () => {
    window.location.href = `./editor.html?set=${encodeURIComponent(setID)}`;
  });

  overviewDialogPracticeBtn.addEventListener("click", () => {
    if (setData.type === "quiz" || setData.type === "devquiz") {
      window.location.href = `./quiz.html?set=${encodeURIComponent(setID)}`;
    } else if (setData.type === "flashcards") {
      window.location.href = `./flashcards.html?set=${encodeURIComponent(setID)}`;
    }
  });

  // show the dialog
  overviewDialog.showModal();
}

async function initApp() {
  const hours = new Date().getHours();

  // update greeting header
  if (hours < 12) {
    greetingHeader.textContent = "Good morning";
  } else if (hours < 18) {
    greetingHeader.textContent = "Good afternoon";
  } else {
    greetingHeader.textContent = "Good evening";
  }

  // and update the greeting paragraph with a random message
  switch ((Math.random() * 4) | 0) {
    case 0:
      document.getElementById("greeting-paragraph").textContent = "Let's make today productive!";
      break;
    case 1:
      document.getElementById("greeting-paragraph").textContent = "Time to learn something new!";
      break;
    case 2:
      document.getElementById("greeting-paragraph").textContent = "Ready to test your knowledge?";
      break;
    case 3:
      document.getElementById("greeting-paragraph").textContent =
        "Your upcoming test will be no challenge at all.";
      break;
  }

  // now we can load the quizzes
  state = await getState();

  if (state) {
    loadTheme(state.userPrefs.theme);

    // now we begin loading
    const recentGridFragment = document.createDocumentFragment();
    const globalGridFragment = document.createDocumentFragment();

    // load the recent list
    state.userPrefs.recentSets.forEach((currentSet, key) => {
      const card = document.createElement("div");
      card.className = "quiz-card";

      const set = state.sets[currentSet];
      if (!set) return;
      const { image, name, type, description } = set;
      card.setAttribute("data-set", currentSet);

      card.innerHTML = `
        <img src="${image || "assets/placeholder.png"}" alt="Picture for ${name || "Untitled"}">
        <span class="quiz-title">${name || "Untitled Set"}</span>
        <span class="set-type">${type}</span>
        <p class="quiz-desc">${description || "No description available."}</p>
      `;

      card.addEventListener("click", () => {
        window.location.href = `./editor.html?set=${encodeURIComponent(currentSet)}`;
      });

      recentGridFragment.appendChild(card);
    });

    recentGrid.appendChild(recentGridFragment);

    // load the global view
    for (const [key, currentSet] of Object.entries(state.sets)) {
      const card = document.createElement("div");
      card.className = "quiz-card";

      const { image, name, type, description } = currentSet;

      card.innerHTML = `
                      <img src="${image || "assets/placeholder.png"}" alt="Picture for ${name}">
                      <span class="quiz-title">${name}</span>
                      <span class="set-type">${type}</span>
                      <p class="quiz-desc">${description}</p>
                    `;

      card.addEventListener("click", () => {
        // previously: window.location.href = `./editor.html?set=${encodeURIComponent(key)}`;

        showOverviewDialog(key);
      });

      globalGridFragment.appendChild(card);
    }

    // add the fragments to the page
    grid.appendChild(globalGridFragment);
  }

  // event listeners for create buttons
  createNewBtn.addEventListener("click", () => {
    createOptionsContainer.classList.toggle("hidden");
  });

  createFromImportBtn.addEventListener("click", () => {
    window.location.href = "./import.html";
  });

  createFlashcardsBtn.addEventListener("click", () => {
    window.location.href = "./editor.html?type=flashcards";
  });

  createQuizBtn.addEventListener("click", () => {
    window.location.href = "./editor.html?type=quiz";
  });

  createDevQuizBtn.addEventListener("click", () => {
    window.location.href = `./editor.html?type=devquiz`;
  });

  overviewDialogCloseBtn.addEventListener("click", () => {
    overviewDialog.close();
  });

  // dev tools
  document.getElementById("devReset").addEventListener("click", () => {
    initState();

    window.location.reload();
  });

  document.body.addEventListener("keydown", (e) => {
    if (e.key === "NumLock" && e.altKey) {
      e.preventDefault();
      sneezes += 1;
      console.log("achoo", sneezes);

      if (sneezes >= 5) {
        sneezes = 0;
        document.getElementById("devContainer").style.display = "block";
      }
    }
  });

  document.getElementById("closeDev").addEventListener("click", () => {
    document.getElementById("devContainer").style.display = "none";
    sneezes = 0;
  });

  document.getElementById("debugNotification").addEventListener("click", () => {
    notification({ title: "hello", body: "I am a test notification" });
  });

  document.getElementById("debugInfoToast").addEventListener("click", () => {
    showToast("info", "hello. I am a test toast. I will contain messages.", 5000);
  });

  document.getElementById("debugErrorToast").addEventListener("click", () => {
    showToast("error", "hello. I am a test toast. This is a fake error.", 5000);
  });

  document.getElementById("debugWarningToast").addEventListener("click", () => {
    showToast("warning", "hello. I am a test toast. This is a fake warning.", 5000);
  });
}

await initApp();

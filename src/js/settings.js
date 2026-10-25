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
  capitalize,
} from "./lib.js";

const nav = generateNavbar();
document.body.prepend(nav);

const SETTINGS_CONFIG = {
  general: {
    label: "General",
    settings: [
      {
        id: "theme",
        label: "Appearance",
        type: "toggle",
        options: [
          { value: "light", label: "Light" },
          { value: "dark", label: "Dark" },
          { value: "system-default", label: "System" },
          { value: "time", label: "Time Based" },
        ],
        description: "Switch between light and dark modes.",
      },
      {
        id: "reducedMotion",
        label: "Reduced Motion/Animations",
        type: "checkbox",
        description: "No flashcard flip animations, page transitions, etc.",
      },
    ],
  },
  account: {
    label: "Account",
    settings: [
      {
      id: "userName",
      label: "Display Name",
      type: "text",
      description: "The name shown on your profile."
      }
    ]
  },
  shortcuts: {
    label: "Keyboard Shortcuts",
    settings: [
      {
        id: "shortcuts.flip",
        label: "Flip Card",
        type: "keyboard-shortcut",
        description: "Shortcut to flip the card.",
      },
      {
        id: "shortcuts.next",
        label: "Next Card",
        type: "keyboard-shortcut",
        description: "Shortcut to move to the next flashcard.",
      },
      {
        id: "shortcuts.prev",
        label: "Previous Card",
        type: "keyboard-shortcut",
        description: "Shortcut to move to the previous flashcard.",
      },
      {
        id: "shortcuts.undo",
        label: "Undo Action",
        type: "keyboard-shortcut",
        description: "Shortcut to undo the last action.",
      },
    ]
  },
  experience: {
    label: "Experience",
    settings: [
      {
        id: "flipDirection",
        label: "Flashcards Flip Direction",
        type: "toggle",
        options: [
          { value: "vertical", label: "Vertical" },
          { value: "horizontal", label: "Horizontal" },
        ],
        description: "The direction in which flashcards flip.",
      },
    ],
  },
  addons: {
    label: "Add-ons",
    settings: [
      {
        id: "enableAddons",
        label: "Enable Add-ons",
        type: "checkbox",
        description: "Allow the use of third-party add-ons.",
      },
    ],
  },
  danger: {
    label: "Danger Zone",
    isDangerous: true,
    settings: [
      {
        id: "resetData",
        label: "Reset All Data",
        type: "button",
        action: "reset",
        dangerous: true,
        description: "Permanently delete all your quiz data and preferences.",
      },
    ],
  },
};

let state;
let currentCategory = "general";

async function initApp() {
  state = await getState();
  if (state) {
    loadTheme(state.userPrefs.theme);
  }

  renderSidebar();
  renderContent();

  // allow page to go back to previous screen based on url query params
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has("back")) {
    const backUrl = urlParams.get("back");
    const backSet = urlParams.get("set");
    const backBtn = document.getElementById("back");

    console.log(backUrl);

    backBtn.onclick = () => {
      switch (backUrl) {
        case "home":
          window.location.href = "./index.html";
          break;
        case "editor":
          if (backSet) {
            window.location.href = `./editor.html?set=${backSet}`;
          } else {
            window.location.href = "./editor.html";
          }
          break;
        case "quiz":
          if (backSet) {
            window.location.href = `./quiz.html?set=${backSet}`;
          } else {
            window.location.href = "./quiz.html";
          }
          break;
        case "import":
          window.location.href = "./import.html";
          break;
        case "flashcards":
          window.location.href = `./flashcards.html?set=${backSet}`;
          break;
        default:
          window.location.href = "./index.html";
      }
    };

    document.getElementById("back").textContent =
      `Back to ${capitalize(backUrl.includes("?") ? backUrl.split("?")[0] : backUrl)}`;
  } else {
    document.getElementById("back").textContent = "Back to Home";
    document.getElementById("back").onclick = () => {
      window.location.href = "./index.html";
    };
  }
}

function renderSidebar() {
  const sidebar = document.getElementById("settings-sidebar");
  sidebar.innerHTML = "";

  Object.entries(SETTINGS_CONFIG).forEach(([id, config]) => {
    const btn = document.createElement("button");
    btn.className = `category-btn ${id === currentCategory ? "active" : ""}`;
    btn.textContent = config.label;
    btn.onclick = () => {
      currentCategory = id;
      renderSidebar();
      renderContent();
    };
    sidebar.appendChild(btn);
  });
}

function renderContent() {
  const content = document.getElementById("settings-content");
  content.innerHTML = "";

  const config = SETTINGS_CONFIG[currentCategory];
  if (!config) {
    content.innerHTML = "<p>Category not found.</p>";
    return;
  }

  // Loading state simulation
  const skeleton = document.createElement("div");
  skeleton.innerHTML = `
                    <div class="skeleton" style="width: 40%; height: 24px; margin-bottom: 16px;"></div>
                    <div class="skeleton" style="width: 100%; height: 60px; margin-bottom: 24px;"></div>
                    <div class="skeleton" style="width: 100%; height: 60px; margin-bottom: 24px;"></div>
                `;
  content.appendChild(skeleton);
  renderSettingsList();
}

function renderSettingsList() {
  const content = document.getElementById("settings-content");
  const config = SETTINGS_CONFIG[currentCategory];

  if (!config) return;

  content.innerHTML = "";

  if (config.isDangerous) {
    const section = document.createElement("div");
    section.className = "dangerous-section";
    section.innerHTML = `<h2>${config.label}</h2>`;

    config.settings.forEach((setting) => {
      section.appendChild(createSettingElement(setting));
    });
    content.appendChild(section);
  } else {
    config.settings.forEach((setting) => {
      content.appendChild(createSettingElement(setting));
    });
  }
}

function createSettingElement(setting) {
  const container = document.createElement("div");
  container.className = setting.dangerous ? "dangerous-item" : "setting-item";

  const header = document.createElement("div");
  header.className = "setting-header";

  const label = document.createElement("span");
  label.className = "setting-label";
  label.textContent = setting.label;
  header.appendChild(label);

  let input;
  
  // resolve value for potentially nested paths (e.g., "shortcuts.next")
  const value = setting.id.includes('.') 
    ? setting.id.split('.').reduce((acc, part) => acc && acc[part], state?.userPrefs) 
    : state?.userPrefs?.[setting.id];

  const finalValue = value ?? "";

  if (setting.type === "text") {
    input = document.createElement("input");
    input.type = "text";
    input.value = finalValue;
    input.onchange = (e) => updateSetting(setting.id, e.target.value);
  } else if (setting.type === "select") {
    input = document.createElement("select");
    setting.options.forEach((opt) => {
      const option = document.createElement("option");
      option.value = opt;
      option.textContent = opt.charAt(0).toUpperCase() + opt.slice(1);
      if (opt === finalValue) option.selected = true;
      input.appendChild(option);
    });
    input.onchange = (e) => updateSetting(setting.id, e.target.value);
  } else if (setting.type === "checkbox") {
    input = document.createElement("input");
    input.type = "checkbox";
    input.checked = !!finalValue;
    input.onchange = (e) => updateSetting(setting.id, e.target.checked);

    const row = document.createElement("div");
    row.className = "row";
    row.appendChild(input);
    row.appendChild(document.createTextNode(setting.label));

    const desc = document.createElement("div");
    desc.className = "setting-description";
    desc.textContent = setting.description || "";

    const wrapper = document.createElement("div");
    wrapper.className = "setting-item";
    wrapper.appendChild(row);
    wrapper.appendChild(desc);
    return wrapper;
  } else if (setting.type === "toggle") {
    input = document.createElement("div");
    input.className = "toggle-group";

    setting.options.forEach((opt) => {
      const btn = document.createElement("button");
      btn.className = `toggle-btn ${opt.value === finalValue ? "active" : ""}`;
      btn.textContent = opt.label;
      btn.onclick = () => updateSetting(setting.id, opt.value);
      input.appendChild(btn);
    });
  } else if (setting.type === "button") {
    input = document.createElement("button");
    input.className = setting.dangerous ? "danger btn" : "btn";
    input.textContent = setting.label;
    input.onclick = () => handleAction(setting.action);
  } else if (setting.type === "keyboard-shortcut") {
    input = document.createElement("button");
    input.className = "kbd-button";
    input.textContent = finalValue === " " ? "Spacebar" : finalValue || "None";

    input.onclick = () => {
      input.textContent = "Press any key...";
      input.classList.add("listening");

      const handleKeyDown = (e) => {
        e.preventDefault();
        let shortcut = [];
        if (e.ctrlKey) shortcut.push("Ctrl");
        if (e.altKey) shortcut.push("Alt");
        if (e.shiftKey) shortcut.push("Shift");
        if (e.metaKey) shortcut.push("Meta");

        const modifierKeys = ["Control", "Alt", "Shift", "Meta"];
        if (!modifierKeys.includes(e.key)) {
          shortcut.push(e.key);
        }

        const shortcutString = shortcut.join(" + ") || e.key;
        updateSetting(setting.id, shortcutString);
        window.removeEventListener("keydown", handleKeyDown);
      };

      window.addEventListener("keydown", handleKeyDown);
    };
  }

  if (input) {
    header.appendChild(input);
  }

  container.appendChild(header);
  if (setting.description) {
    const desc = document.createElement("div");
    desc.className = "setting-description";
    desc.textContent = setting.description;
    container.appendChild(desc);
  }

  return container;
}

async function updateSetting(id, value) {
  state = await updateState(`userPrefs.${id}`, value);
  if (id === "theme") {
    loadTheme(value);
    document.getElementById("theme").checked = value === "dark";
  }
  renderSettingsList();
}

async function handleAction(action) {
  if (action === "reset") {
    if (confirm("Are you sure you want to reset all data? This cannot be undone.")) {
      await saveFullState(initState());
      location.reload();
    }
  }
}

await initApp();

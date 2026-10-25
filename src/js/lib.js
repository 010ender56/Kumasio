"use strict";

import localforage from "localforage";
import { LazyStore } from '@tauri-apps/plugin-store';
import Database from '@tauri-apps/plugin-sql';
import * as appWindow from '@tauri-apps/api/window';
import { ask, confirm, message, open } from "@tauri-apps/plugin-dialog";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import { shuffle, distance, pluralHelper, fileToBase64 } from "./utils.js";

export { shuffle, distance, pluralHelper, fileToBase64 }; // these are from utils.js

(() => {
  // check what environment we're in
  const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
  const isHostedCloudflarePages = typeof process !== "undefined" && process?.env?.CF_PAGES === "1";

  let environment = "";
  if (isTauri) {
    environment = "tauri";
  } else if (isHostedCloudflarePages) {
    environment = "cloudflare";
  } else {
    environment = "web";
  }

  Object.defineProperty(globalThis, "ENV", {
    // globalThis.ENV
    value: environment || "unknown",
    writable: false,
    configurable: false,
  });

  console.log("running in " + environment);
})();

let dbInstance = null;
let prefsStore = null;

async function getDb() {
  if (globalThis.ENV !== "tauri") return null;
  if (dbInstance) return dbInstance;

  try {
    dbInstance = await Database.load("sqlite:app-storage.db");
    await dbInstance.execute("CREATE TABLE IF NOT EXISTS kv_store (key TEXT PRIMARY KEY, value TEXT)");
    return dbInstance;
  } catch (e) {
    console.error("Failed to load SQL database:", e);
    return null;
  }
}

async function getPrefsStore() {
  if (globalThis.ENV !== "tauri") return null;
  if (prefsStore) return prefsStore;

  try {
    prefsStore = new LazyStore("settings.json");
    return prefsStore;
  } catch (e) {
    console.error("Failed to load LazyStore:", e);
    return null;
  }
}

async function dbGet(key) {
  if (globalThis.ENV !== "tauri") return await localforage.getItem(key);
  const db = await getDb();
  if (!db) return await localforage.getItem(key);
  const result = await db.select("SELECT value FROM kv_store WHERE key = ?", [key]);
  return result.length > 0 ? JSON.parse(result[0].value) : null;
}

async function dbSet(key, value) {
  if (globalThis.ENV !== "tauri") return await localforage.setItem(key, value);
  const db = await getDb();
  if (!db) return await localforage.setItem(key, value);
  await db.execute(
    "INSERT INTO kv_store (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value",
    [key, JSON.stringify(value)]
  );
}

export function save(filename, data, fileType = "text/html") {
  try {
    const blob = new Blob([data], {
      type: fileType,
    });
    const elem = window.document.createElement("a");

    elem.href = window.URL.createObjectURL(blob);
    elem.download = filename;

    document.body.appendChild(elem);
    elem.click();

    document.body.removeChild(elem);
    window.URL.revokeObjectURL(elem.href);
  } catch (error) {
    throw error;
  }
}

export async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    return false;
  }
}

// TODO: native web alert dialogs look bad, need to create custom ones
export async function yesNoDialog({ message, title = "Kumasio", kind = "warning" }, onYes, onNo) {
  const isTauri = globalThis.ENV === "tauri";

  const confirmed = isTauri
    ? await ask(message, { title: title, kind: kind })
    : window.confirm(message); // ok / cancel only, vanilla JS has does not have yes/no

  if (confirmed) {
    onYes?.();
  } else {
    onNo?.();
  }
}

export async function confirmationDialog(
  { message, title = "Kumasio", kind = "warning" },
  onYes,
  onNo,
) {
  const isTauri = globalThis.ENV === "tauri";

  const confirmed = isTauri
    ? await confirm(message, { title: title, kind: kind })
    : window.confirm(message);

  if (confirmed) {
    onYes?.();
  } else {
    onNo?.();
  }
}

export async function messageDialog(
  body,
  { title = "Kumasio", kind = "warning" },
  onOk,
  onClose,
) {
  const isTauri = globalThis.ENV === "tauri";

  const confirmed = isTauri
    ? await message(body, { title: title, kind: kind })
    : window.alert(body);

  if (confirmed) {
    onOk?.();
  } else {
    onClose?.();
  }
}

export async function notification({ title = "Kumasio", body }) {
  const isTauri = globalThis.ENV === "tauri";

  if (isTauri) {
    if (await isPermissionGranted() || (await requestPermission()) === "granted") {
      sendNotification({ title, body });
    }
  } else {
    if ("Notification" in window) {
      Notification.requestPermission().then((permission) => {
        if (permission === "granted") {
          const notification = new Notification(title, {
            body: body,
            icon: "../assets/logo.png",
          });
        }
      });
    }
  }
}

export function showToast(type, message, duration = 2000) {
  let container = document.querySelector(".toast-container");
  if (!container) {
    container = document.createElement("div");
    container.className = "toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;

  // remove when clicked on
  toast.addEventListener("click", () => {
    toast.classList.add("hidden");

    // wait until the toast is hidden visually, then remove
    setTimeout(() => {
      toast.remove();
    }, 250);
  });

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("hidden");

    // wait until the toast is hidden visually, then remove
    setTimeout(() => {
      toast.remove();
    }, 250);
  }, duration);
}

export function createImageUploader(container, onFileSelected) {
  container.innerHTML = `
        <input type="file" accept="image/*" style="display: none;" class="image-input" />
        <label class="drop-zone">
            <div class="preview-box">
                <p class="upload-text">Click to select an image</p>
            </div>
        </label>
    `;

  let isCleared = false;

  const input = container.querySelector(".image-input");
  const dropZone = container.querySelector(".drop-zone");
  const previewBox = container.querySelector(".preview-box");
  const uploadText = container.querySelector(".upload-text");

  const handleFile = (file) => {
    if (file && file.type.startsWith("image/")) {
      isCleared = false;
      const imageURL = URL.createObjectURL(file);
      previewBox.style.backgroundImage = `url('${imageURL}')`;
      uploadText.style.display = "none";
      if (onFileSelected) onFileSelected(file);
    }
  };

  previewBox.addEventListener("click", () => {
    input.click();
  });

  input.addEventListener("cancel", () => {
    isCleared = true;
    input.value = "";
    previewBox.style.backgroundImage = "";
    uploadText.style.display = "block";
  });

  input.addEventListener("change", (e) => {
    handleFile(e.target.files[0]);
  });

  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("drag-over");
  });

  dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("drag-over");
  });

  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("drag-over");
    handleFile(e.dataTransfer.files[0]);
  });

  return {
    input,
    previewBox,
    uploadText,
    getFile: () => input.files[0],
    getIsCleared: () => isCleared,
    resetCleared: () => {
      isCleared = false;
    },
  };
}

export function createSetTemplate(type = "quiz") {
  if (type === "devquiz") {
    return createDevQuiz();
  }

  return {
    name: type === "flashcards" ? "Untitled Flashcards" : "Untitled Quiz",
    description: "No description provided.",
    image: false,
    questions: [],
    type: type,
  };
}

export function createDevQuiz() {
  return {
    name: "DEV QUIZ",
    description:
      "For testing purposes only. This quiz contains all question types and variants (images, no images)",
    image: false,
    type: "quiz",
    questions: [
      {
        id: crypto.randomUUID(),
        text: "What is the capital of France?",
        type: "multiple-choice",
        options: [
          {
            text: "London",
            correct: false,
            image:
              "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?q=80&w=1470&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
          },
          {
            text: "Berlin",
            correct: false,
            image:
              "https://images.unsplash.com/photo-1599946347371-68eb71b16afc?q=80&w=1470&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
          },
          {
            text: "Paris",
            correct: true,
            image:
              "https://images.unsplash.com/photo-1550340499-a6c60fc8287c?q=80&w=1470&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
          },
          {
            text: "Madrid",
            correct: false,
            image:
              "https://images.unsplash.com/photo-1543783207-ec64e4d95325?q=80&w=1470&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
          },
        ],
        expectedAnswer: "Paris",
        image: null,
      },
      {
        id: crypto.randomUUID(),
        text: "Which of these are primary colors? (Select all that apply)",
        type: "multiple-response",
        options: [
          { text: "Red", correct: true },
          { text: "Green", correct: false },
          { text: "Blue", correct: true },
          { text: "Yellow", correct: false },
        ],
        expectedAnswer: "Red, Blue",
        image: null,
      },
      {
        id: crypto.randomUUID(),
        text: "The Earth is flat.",
        type: "true-false",
        options: [
          { text: "True", correct: false },
          { text: "False", correct: true },
        ],
        expectedAnswer: "False",
        image: null,
      },
      {
        id: crypto.randomUUID(),
        text: "What is the square root of 64?",
        type: "short-answer",
        options: [],
        expectedAnswer: "8",
        image: null,
      },
      {
        id: crypto.randomUUID(),
        text: "Describe the process of photosynthesis in detail.",
        type: "long-answer",
        options: [],
        expectedAnswer:
          "The process by which green plants and some other organisms use sunlight to synthesize foods with the help of chlorophyll pigments.",
        image: null,
      },
      {
        id: crypto.randomUUID(),
        text: "Which planet is known as the Red Planet? (Image variant)",
        type: "multiple-choice",
        options: [
          { text: "Venus", correct: false },
          { text: "Mars", correct: true },
          { text: "Jupiter", correct: false },
          { text: "Saturn", correct: false },
        ],
        expectedAnswer: "Mars",
        image:
          "https://images.unsplash.com/photo-1701014159024-f9781490a228?q=80&w=1528&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
      },
    ],
  };
}

export function initState(returnOnly = false) {
  const initialState = {
    sets: {
      i0: {
        name: "Untitled Quiz",
        description: "No description provided.",
        image: false,
        questions: [],
        type: "quiz",
        oneWay: false,
      },
    },
    userPrefs: {
      theme: "dark",
      language: "en",

      defaultSide: "front", // "front" or "back" | for flashcards
      reducedMotion: false,
      flipDirection: "vertical", // "vertical" or "horizontal" | for flashcards

      // keyboard shortcuts
      shortcuts: {
        next: "ArrowRight",
        prev: "ArrowLeft",
        flip: " ",
        undo: ""
      },
    },
    activeSetResponses: {
      questions: {},
    },
    activeSetSubmissions: {},
    flashcardsProgress: {},
    currentSet: "i0",
    currentIndex: -1,
  };

  if (returnOnly) {
    return initialState;
  }

  saveFullState(initialState).then(function () {
    console.log("Initial state created:", initialState);
  });
}

export function generateNavbar() {
  const nav = document.createElement("nav");
  nav.className = "top-bar";

  const pageMap = {
    "index.html": "home",
    "settings.html": "settings",
    "quiz.html": "quiz",
    "editor.html": "editor",
    "flashcards.html": "flashcards",
  };

  const pathname = window.location.pathname;
  const currentPage = pathname.substring(pathname.lastIndexOf("/") + 1) || "index.html";
  const searchParams = new URLSearchParams(window.location.search);

  const backValue = pageMap[currentPage] || "home";
  const setParam = searchParams.get("set");

  let settingsHref = `./settings.html?back=${backValue}`;
  if (setParam) {
    settingsHref += `&set=${setParam}`;
  }

  nav.innerHTML = `
    <div class="top-bar-content">
        <button class="btn icon-btn">Feedback</button>
        <a href="./index.html" class="btn icon-btn">Home</a>
        <a href="${settingsHref}" class="btn icon-btn">Settings</a>
        <small>indev</small>
    </div>
  `;
  return nav;
}

export function loadTheme(prefs = "light") {
  const root = document.documentElement;
  let targetTheme = prefs;

  if (prefs === "system-default") {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    targetTheme = mediaQuery.matches ? "dark" : "light";

    mediaQuery.addEventListener("change", (e) => {
      if (document.documentElement.getAttribute("data-theme-mode") === "system-default") {
        root.setAttribute("data-theme", e.matches ? "dark" : "light");
      }
    });
  }

  if (prefs === "time") {
    const hour = new Date().getHours();
    targetTheme = hour >= 18 || hour < 6 ? "dark" : "light";
  }

  root.setAttribute("data-theme", targetTheme);
  root.setAttribute("data-theme-mode", prefs);
}

export function capitalize(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export async function getState() {
  if (globalThis.ENV === "tauri") {
    const stateWithoutPrefs = await dbGet("appState");

    const store = await getPrefsStore();
    const userPrefs = store ? await store.get("userPrefs") : await localforage.getItem("userPrefs");

    if (!stateWithoutPrefs) return initState(true);

    return {
      ...stateWithoutPrefs,
      userPrefs: userPrefs || stateWithoutPrefs.userPrefs,
    };
  }

  const state = await localforage.getItem("appState");
  return state || initState(true);
}

export async function saveFullState(state) {
  if (globalThis.ENV === "tauri") {
    const { userPrefs, ...stateWithoutPrefs } = state;

    const store = await getPrefsStore();
    if (store) {
      await store.set("userPrefs", userPrefs);
      await store.save();
    } else {
      await localforage.setItem("userPrefs", userPrefs);
    }

    await dbSet("appState", stateWithoutPrefs);
  } else {
    await localforage.setItem("appState", state);
  }
}

export async function updateState(path, value) {
  const state = await getState();
  const keys = path.split(".");
  let current = state;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!current[key]) current[key] = {};
    current = current[key];
  }

  const lastKey = keys[keys.length - 1];
  const oldValue = current[lastKey];
  current[lastKey] = value;

  if (JSON.stringify(oldValue) !== JSON.stringify(value)) {
    await saveFullState(state);
    await queueChange(path, value);
  }

  return state;
}

export async function queueChange(path, value) {
  const queue = (await dbGet("syncQueue")) || [];
  const filteredQueue = queue.filter((item) => item.path !== path);

  filteredQueue.push({
    id: crypto.randomUUID(),
    path: path,
    value: value,
    timestamp: Date.now(),
    synced: false,
  });

  await dbSet("syncQueue", filteredQueue);
}

export async function getDirtyItems() {
  const queue = (await dbGet("syncQueue")) || [];
  return queue.filter((item) => !item.synced);
}

export async function markAsSynced(changeId) {
  const queue = (await dbGet("syncQueue")) || [];
  const updatedQueue = queue.map((item) => {
    if (item.id === changeId) return { ...item, synced: true };
    return item;
  });
  await dbSet("syncQueue", updatedQueue);
}

export async function syncWithServer() {
  if (!navigator.onLine) {
    console.log("Offline: Sync postponed.");
    return;
  }

  const dirty = await getDirtyItems();
  if (dirty.length === 0) return;

  console.log(`Syncing ${dirty.length} changes to server...`);
  for (const change of dirty) {
    await markAsSynced(change.id);
  }
  console.log("Sync complete.");
}

window.addEventListener("online", syncWithServer);

export function matchShortcut(event, shortcutString) {
  if (!shortcutString) return false;

  const parts = shortcutString.split(" + ");
  const modifiers = {
    Ctrl: event.ctrlKey,
    Alt: event.altKey,
    Shift: event.shiftKey,
    Meta: event.metaKey,
  };

  let keyMatch = false;
  let modifierMatch = true;

  for (const part of parts) {
    if (modifiers.hasOwnProperty(part)) {
      if (!modifiers[part]) {
        modifierMatch = false;
        break;
      }
    } else {
      if (part !== event.key) {
        modifierMatch = false;
        break;
      }
      keyMatch = true;
    }
  }

  if (!keyMatch && parts.length > 0) {
    const lastPart = parts[parts.length - 1];
    if (!modifiers.hasOwnProperty(lastPart)) {
      return false;
    }
  }

  return modifierMatch;
}

// 42 is everything

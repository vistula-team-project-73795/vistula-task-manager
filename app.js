let API = "";
let HEADERS = {};
let editingId = null;

const form = document.getElementById("task-form");
const titleInput = document.getElementById("task-title");
const descInput = document.getElementById("task-description");
const submitBtn = document.getElementById("task-submit");
const cancelBtn = document.getElementById("task-cancel");
const list = document.getElementById("task-list");
const statusEl = document.getElementById("status-message");

function setStatus(text, type) {
  statusEl.textContent = text || "";
  statusEl.className = type || "";
}

async function api(path, options = {}) {
  const res = await fetch(API + path, {
    ...options,
    headers: { ...HEADERS, ...(options.headers || {}) },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error("HTTP " + res.status + (body ? ": " + body : ""));
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function init() {
  try {
    const res = await fetch("config.json");
    const cfg = await res.json();
    API = cfg.supabaseUrl + "/rest/v1/" + cfg.tableName;
    HEADERS = {
      apikey: cfg.supabasePublishableKey,
      Authorization: "Bearer " + cfg.supabasePublishableKey,
      "Content-Type": "application/json",
    };
    await loadTasks();
  } catch (e) {
    setStatus("Could not load the application: " + e.message, "error");
  }
}

async function loadTasks() {
  try {
    const tasks = await api("?select=*&order=id.asc");
    render(tasks);
    setStatus("");
  } catch (e) {
    setStatus("Could not load tasks: " + e.message, "error");
  }
}

function render(tasks) {
  list.innerHTML = "";
  if (!tasks.length) {
    const p = document.createElement("p");
    p.className = "empty";
    p.textContent = "No tasks yet. Add your first task above.";
    list.appendChild(p);
    return;
  }
  tasks.forEach((t) => {
    const item = document.createElement("div");
    item.className = "task-item" + (t.completed ? " done" : "");
    item.dataset.id = t.id;

    const title = document.createElement("div");
    title.className = "task-title";
    title.textContent = t.title;

    const desc = document.createElement("div");
    desc.className = "task-description";
    desc.textContent = t.description || "";

    const status = document.createElement("div");
    status.className = "task-status";
    status.textContent = t.completed ? "Completed" : "Not completed";

    const actions = document.createElement("div");
    actions.className = "task-actions";

    const toggle = document.createElement("button");
    toggle.className = "toggle-task";
    toggle.textContent = t.completed ? "Mark incomplete" : "Mark complete";
    toggle.addEventListener("click", () => toggleTask(t));

    const edit = document.createElement("button");
    edit.className = "edit-task";
    edit.textContent = "Edit";
    edit.addEventListener("click", () => startEdit(t));

    const del = document.createElement("button");
    del.className = "delete-task";
    del.textContent = "Delete";
    del.addEventListener("click", () => deleteTask(t.id));

    actions.append(toggle, edit, del);
    item.append(title, desc, status, actions);
    list.appendChild(item);
  });
}

function startEdit(t) {
  editingId = t.id;
  titleInput.value = t.title;
  descInput.value = t.description || "";
  submitBtn.textContent = "Save changes";
  cancelBtn.hidden = false;
  titleInput.focus();
}

function resetForm() {
  editingId = null;
  form.reset();
  submitBtn.textContent = "Add task";
  cancelBtn.hidden = true;
}

cancelBtn.addEventListener("click", resetForm);

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const title = titleInput.value.trim();
  const description = descInput.value.trim();
  if (!title) {
    setStatus("Title is required.", "error");
    return;
  }
  try {
    if (editingId === null) {
      await api("", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ title, description, completed: false }),
      });
      setStatus("Task added.", "ok");
    } else {
      await api("?id=eq." + editingId, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ title, description }),
      });
      setStatus("Task updated.", "ok");
    }
    resetForm();
    await refreshKeepingMessage();
  } catch (err) {
    setStatus("Could not save the task: " + err.message, "error");
  }
});

async function toggleTask(t) {
  try {
    await api("?id=eq." + t.id, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ completed: !t.completed }),
    });
    await refreshKeepingMessage();
  } catch (err) {
    setStatus("Could not change the status: " + err.message, "error");
  }
}

async function deleteTask(id) {
  try {
    await api("?id=eq." + id, { method: "DELETE" });
    if (editingId === id) resetForm();
    setStatus("Task deleted.", "ok");
    await refreshKeepingMessage();
  } catch (err) {
    setStatus("Could not delete the task: " + err.message, "error");
  }
}

async function refreshKeepingMessage() {
  const msg = statusEl.textContent;
  const cls = statusEl.className;
  try {
    const tasks = await api("?select=*&order=id.asc");
    render(tasks);
    setStatus(msg, cls);
  } catch (e) {
    setStatus("Could not load tasks: " + e.message, "error");
  }
}

init();

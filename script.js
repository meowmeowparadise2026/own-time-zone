const template = document.querySelector("#goalCardTemplate");
const grid = document.querySelector("#goalGrid");
const roomBar = document.querySelector("#roomBar");
const roomSelect = document.querySelector("#roomSelect");
const roomMode = document.querySelector("#roomMode");
const memberStrip = document.querySelector("#memberStrip");
const authPanel = document.querySelector("#authPanel");
const accountPanel = document.querySelector("#accountPanel");
const invitePanel = document.querySelector("#invitePanel");
const editorPanel = document.querySelector("#editorPanel");
const accountName = document.querySelector("#accountName");
const accountEmail = document.querySelector("#accountEmail");
const messageLine = document.querySelector("#messageLine");

const loginForm = document.querySelector("#loginForm");
const registerForm = document.querySelector("#registerForm");
const showLogin = document.querySelector("#showLogin");
const showRegister = document.querySelector("#showRegister");
const logoutButton = document.querySelector("#logoutButton");
const joinForm = document.querySelector("#joinForm");
const joinCode = document.querySelector("#joinCode");
const inviteCode = document.querySelector("#inviteCode");
const copyButton = document.querySelector("#copyButton");

const form = document.querySelector("#goalForm");
const titleInput = document.querySelector("#goalTitle");
const planInput = document.querySelector("#goalPlan");
const imageInput = document.querySelector("#goalImage");
const imageLabel = document.querySelector("#imageLabel");
const uploadStatus = document.querySelector("#uploadStatus");
const doneInput = document.querySelector("#goalDone");
const sharedInput = document.querySelector("#goalShared");
const slotNumber = document.querySelector("#slotNumber");
const clearButton = document.querySelector("#clearButton");

let currentUser = null;
let rooms = [];
let currentRoom = null;
let selectedIndex = 0;

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    credentials: "same-origin",
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "操作失敗，請稍後再試。");
  return data;
}

function setMessage(message, type = "info") {
  messageLine.textContent = message || "";
  messageLine.dataset.type = type;
}

function setAuthMode(mode) {
  const loginMode = mode === "login";
  loginForm.hidden = !loginMode;
  registerForm.hidden = loginMode;
  showLogin.classList.toggle("is-active", loginMode);
  showRegister.classList.toggle("is-active", !loginMode);
}

function selectedRoomId() {
  return roomSelect.value || rooms[0]?.id || null;
}

function memberInitial(name) {
  return String(name || "?").trim().charAt(0).toUpperCase() || "?";
}

function renderShell() {
  const isLoggedIn = Boolean(currentUser);
  authPanel.hidden = isLoggedIn;
  accountPanel.hidden = !isLoggedIn;
  invitePanel.hidden = !isLoggedIn;
  editorPanel.hidden = !isLoggedIn || !currentRoom?.canEdit;
  roomBar.hidden = !isLoggedIn;

  if (!isLoggedIn) {
    grid.innerHTML = "";
    renderMembers([]);
    renderEmptyGrid("登入後即可建立自己的九宮格，也能用邀請碼查看朋友分享的目標。");
    return;
  }

  accountName.textContent = currentUser.name;
  accountEmail.textContent = currentUser.email;
  renderRoomSelect();
}

function renderMembers(members = currentRoom?.members || []) {
  memberStrip.innerHTML = "";

  if (!members.length) {
    const empty = document.createElement("span");
    empty.className = "member-empty";
    empty.textContent = "尚未有朋友加入";
    memberStrip.appendChild(empty);
    return;
  }

  members.forEach((member) => {
    const badge = document.createElement("span");
    badge.className = "member-badge";
    badge.textContent = memberInitial(member.name);
    badge.title = member.isOwner ? `${member.name}（房主）` : member.name;
    badge.setAttribute("aria-label", badge.title);
    badge.dataset.owner = String(Boolean(member.isOwner));
    memberStrip.appendChild(badge);
  });
}

function renderRoomSelect() {
  roomSelect.innerHTML = "";
  rooms.forEach((room) => {
    const option = document.createElement("option");
    option.value = room.id;
    option.textContent = room.canEdit ? `${room.title}（我的）` : `${room.title}（朋友）`;
    roomSelect.appendChild(option);
  });
  if (currentRoom) roomSelect.value = currentRoom.id;
}

function renderEmptyGrid(text) {
  grid.innerHTML = "";
  Array.from({ length: 9 }, (_, index) => {
    const node = template.content.firstElementChild.cloneNode(true);
    node.classList.add("is-empty");
    node.querySelector(".photo").style.setProperty("--photo-url", `url("./assets/goal-${index + 1}.png")`);
    node.querySelector(".front-title").textContent = index === 4 ? text : "";
    node.querySelector(".back-meta").textContent = "own time zone";
    node.querySelector(".back-title").textContent = "尚未載入";
    node.querySelector(".back-plan").textContent = text;
    node.querySelector(".back-footer").textContent = "";
    grid.appendChild(node);
  });
}

function renderGrid() {
  if (!currentRoom) {
    renderEmptyGrid("選擇一面目標牆開始。");
    return;
  }

  grid.innerHTML = "";
  roomMode.textContent = currentRoom.canEdit ? "你可以編輯這面牆" : "朋友分享給你查看";
  inviteCode.textContent = currentRoom.canEdit ? currentRoom.inviteCode : "朋友的目標牆";
  renderMembers();

  currentRoom.goals.forEach((goal, index) => {
    const node = template.content.firstElementChild.cloneNode(true);
    const photo = node.querySelector(".photo");
    const flipButton = node.querySelector(".flip-button");
    const selectButton = node.querySelector(".select-tab");

    node.classList.toggle("is-selected", index === selectedIndex && currentRoom.canEdit);
    node.classList.toggle("is-done", goal.done);
    node.classList.toggle("is-private", goal.private === true);
    photo.style.setProperty("--photo-url", `url("${goal.image}")`);
    node.querySelector(".front-title").textContent = goal.title || "尚未命名";
    node.querySelector(".back-meta").textContent = goal.shared ? "受邀朋友可見" : "只有自己可見";
    node.querySelector(".back-title").textContent = goal.title || "尚未命名";
    node.querySelector(".back-plan").textContent = goal.plan || "寫下下一步，讓這格開始有方向。";
    node.querySelector(".back-footer").textContent = goal.done ? "完成狀態：已完成" : "完成狀態：前進中";
    selectButton.hidden = !currentRoom.canEdit;
    selectButton.setAttribute("aria-label", `編輯第 ${index + 1} 格`);

    flipButton.addEventListener("click", () => {
      node.classList.toggle("is-flipped");
    });

    selectButton.addEventListener("click", (event) => {
      event.stopPropagation();
      selectedIndex = index;
      fillForm();
      renderGrid();
    });

    grid.appendChild(node);
  });
}

function fillForm() {
  if (!currentRoom?.canEdit) return;
  const goal = currentRoom.goals[selectedIndex];
  slotNumber.textContent = String(selectedIndex + 1).padStart(2, "0");
  titleInput.value = goal.title || "";
  planInput.value = goal.plan || "";
  doneInput.checked = Boolean(goal.done);
  sharedInput.checked = Boolean(goal.shared);
  imageInput.value = "";
  const hasCustomImage = goal.image?.startsWith("data:");
  imageLabel.textContent = hasCustomImage ? "自訂照片" : "選擇照片";
  uploadStatus.hidden = !hasCustomImage;
}

function readImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function loadMe() {
  try {
    const data = await api("/api/me");
    currentUser = data.user;
    rooms = data.rooms;
    renderShell();
    if (rooms.length) await loadRoom(rooms[0].id);
  } catch {
    currentUser = null;
    rooms = [];
    currentRoom = null;
    renderShell();
  }
}

async function loadRoom(roomId) {
  const data = await api(`/api/rooms/${roomId}`);
  currentRoom = data.room;
  selectedIndex = 0;
  renderShell();
  renderGrid();
  fillForm();
}

showLogin.addEventListener("click", () => setAuthMode("login"));
showRegister.addEventListener("click", () => setAuthMode("register"));

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage("登入中...");
  try {
    const data = await api("/api/login", {
      method: "POST",
      body: JSON.stringify({
        email: document.querySelector("#loginEmail").value,
        password: document.querySelector("#loginPassword").value,
      }),
    });
    currentUser = data.user;
    rooms = data.rooms;
    await loadRoom(rooms[0].id);
    setMessage("登入成功。", "success");
  } catch (error) {
    setMessage(error.message, "error");
  }
});

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage("建立帳號中...");
  try {
    const data = await api("/api/register", {
      method: "POST",
      body: JSON.stringify({
        name: document.querySelector("#registerName").value,
        email: document.querySelector("#registerEmail").value,
        password: document.querySelector("#registerPassword").value,
      }),
    });
    currentUser = data.user;
    rooms = data.rooms;
    await loadRoom(rooms[0].id);
    setMessage("帳號已建立，這面九宮格會存在伺服器。", "success");
  } catch (error) {
    setMessage(error.message, "error");
  }
});

logoutButton.addEventListener("click", async () => {
  await api("/api/logout", { method: "POST", body: "{}" });
  currentUser = null;
  currentRoom = null;
  rooms = [];
  renderShell();
  setMessage("已登出。");
});

roomSelect.addEventListener("change", async () => {
  setMessage("切換目標牆中...");
  try {
    await loadRoom(selectedRoomId());
    setMessage("");
  } catch (error) {
    setMessage(error.message, "error");
  }
});

joinForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage("加入朋友的目標牆中...");
  try {
    const data = await api("/api/join", {
      method: "POST",
      body: JSON.stringify({ inviteCode: joinCode.value }),
    });
    if (!rooms.some((room) => room.id === data.room.id)) rooms.push(data.room);
    joinCode.value = "";
    await loadRoom(data.room.id);
    setMessage("已加入朋友的目標牆。", "success");
  } catch (error) {
    setMessage(error.message, "error");
  }
});

copyButton.addEventListener("click", async () => {
  if (!currentRoom?.canEdit) return;
  await navigator.clipboard.writeText(currentRoom.inviteCode);
  copyButton.textContent = "已複製";
  setTimeout(() => {
    copyButton.textContent = "複製";
  }, 1400);
});

imageInput.addEventListener("change", () => {
  const file = imageInput.files?.[0];
  if (!file) return;
  imageLabel.textContent = file.name;
  uploadStatus.hidden = false;
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentRoom?.canEdit) return;

  setMessage("同步中...");
  const current = currentRoom.goals[selectedIndex];
  let image = current.image;

  if (imageInput.files?.[0]) {
    image = await readImage(imageInput.files[0]);
  }

  try {
    const data = await api(`/api/rooms/${currentRoom.id}/goals/${selectedIndex}`, {
      method: "PUT",
      body: JSON.stringify({
        title: titleInput.value,
        plan: planInput.value,
        image,
        done: doneInput.checked,
        shared: sharedInput.checked,
      }),
    });
    currentRoom = data.room;
    renderGrid();
    fillForm();
    setMessage("已同步到伺服器。", "success");
  } catch (error) {
    setMessage(error.message, "error");
  }
});

clearButton.addEventListener("click", () => {
  titleInput.value = "";
  planInput.value = "";
  doneInput.checked = false;
  sharedInput.checked = true;
  imageInput.value = "";
  imageLabel.textContent = "選擇照片";
  uploadStatus.hidden = true;
});

setAuthMode("login");
renderShell();
loadMe();

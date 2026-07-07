const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { URL } = require("node:url");

const PORT = Number(process.env.PORT || 8787);
const ROOT = __dirname;
const PUBLIC_DIR = ROOT;
const DATA_DIR = process.env.OTZ_DATA_DIR ? path.resolve(process.env.OTZ_DATA_DIR) : path.join(ROOT, "data");
const DATA_FILE = path.join(DATA_DIR, "store.json");
const MAX_BODY_BYTES = 8 * 1024 * 1024;
function envValue(...names) {
  for (const name of names) {
    const value = String(process.env[name] || "").trim();
    if (value) return value.replace(/^["']|["']$/g, "");
  }
  return "";
}

const SUPABASE_URL = envValue("SUPABASE_URL").replace(/\/$/, "");
const SUPABASE_KEY = envValue(
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_SECRET_KEY",
  "SUPABASE_SERVICE_KEY",
  "SUPABASE_ANON_KEY",
);
const STORE_ID = process.env.OTZ_STORE_ID || "main";

const sessions = new Map();

const defaultGoals = [
  {
    title: "穩定運動",
    plan: "每週三次，散步、瑜伽或重訓都可以。重點是把身體帶回生活裡。",
    image: "./assets/goal-1.png",
    done: false,
    shared: true,
  },
  {
    title: "讀完十二本書",
    plan: "每個月選一本，不追求速度，讀完後寫下三句真正留下來的話。",
    image: "./assets/goal-2.png",
    done: false,
    shared: true,
  },
  {
    title: "整理房間角落",
    plan: "從書桌、衣櫃、床邊開始。每次只整理 20 分鐘，留下會被使用的東西。",
    image: "./assets/goal-3.png",
    done: true,
    shared: true,
  },
  {
    title: "學會做早餐",
    plan: "練習五種可以快速完成的早餐，讓忙碌日子也有一個溫柔的開始。",
    image: "./assets/goal-4.png",
    done: false,
    shared: true,
  },
  {
    title: "存一筆旅行基金",
    plan: "每月固定存一點，不求很多。年底和朋友一起選一個想去的城市。",
    image: "./assets/goal-5.png",
    done: false,
    shared: true,
  },
  {
    title: "完成作品集",
    plan: "整理三個最喜歡的專案，補上文字、過程和想法，慢慢做成自己的樣子。",
    image: "./assets/goal-6.png",
    done: false,
    shared: false,
  },
  {
    title: "每週一次好好吃飯",
    plan: "約朋友、自己煮，或去想去很久的小店。把吃飯重新變成生活事件。",
    image: "./assets/goal-7.png",
    done: false,
    shared: true,
  },
  {
    title: "練習拍照",
    plan: "每週拍一組主題：光、影子、餐桌、街角。照片不用完美，只要有感覺。",
    image: "./assets/goal-8.png",
    done: false,
    shared: true,
  },
  {
    title: "早睡一點",
    plan: "先從每週兩天 12 點前放下手機開始。睡前留 15 分鐘給日記或拉筋。",
    image: "./assets/goal-9.png",
    done: false,
    shared: true,
  },
];

function emptyStore() {
  return { users: [], rooms: [] };
}

function useSupabase() {
  return Boolean(SUPABASE_URL && SUPABASE_KEY);
}

function isLegacyJwtKey(value) {
  return value.split(".").length === 3;
}

function ensureDataFile() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    writeLocalStore(emptyStore());
  }
}

function readLocalStore() {
  ensureDataFile();
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

function writeLocalStore(store) {
  fs.writeFileSync(DATA_FILE, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

async function supabaseRequest(pathname, options = {}) {
  const { headers: optionHeaders, ...requestOptions } = options;
  const separator = pathname.includes("?") ? "&" : "?";
  const requestPath = `${pathname}${separator}apikey=${encodeURIComponent(SUPABASE_KEY)}`;
  const headers = {
    apikey: SUPABASE_KEY,
    "Content-Type": "application/json",
    Prefer: "return=representation",
    ...(optionHeaders || {}),
  };
  if (isLegacyJwtKey(SUPABASE_KEY)) {
    headers.Authorization = `Bearer ${SUPABASE_KEY}`;
  }

  const response = await fetch(`${SUPABASE_URL}/rest/v1/${requestPath}`, {
    ...requestOptions,
    headers,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase request failed: ${response.status} ${text}`);
  }

  const text = await response.text();
  if (!text) return null;
  return JSON.parse(text);
}

async function readStore() {
  if (!useSupabase()) return readLocalStore();

  const rows = await supabaseRequest(`app_state?id=eq.${encodeURIComponent(STORE_ID)}&select=data`);
  if (rows[0]?.data) return rows[0].data;

  const store = emptyStore();
  await writeStore(store);
  return store;
}

async function writeStore(store) {
  if (!useSupabase()) {
    writeLocalStore(store);
    return;
  }

  await supabaseRequest("app_state?on_conflict=id", {
    method: "POST",
    body: JSON.stringify({
      id: STORE_ID,
      data: store,
      updated_at: new Date().toISOString(),
    }),
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
  });
}

function id(prefix) {
  return `${prefix}_${crypto.randomBytes(9).toString("hex")}`;
}

function inviteCode() {
  return crypto.randomBytes(4).toString("hex").toUpperCase();
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(":");
  const test = hashPassword(password, salt).split(":")[1];
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(test, "hex"));
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email };
}

function parseCookies(req) {
  return Object.fromEntries(
    String(req.headers.cookie || "")
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
      }),
  );
}

function getSessionUser(req, store) {
  const sid = parseCookies(req).otz_session;
  if (!sid) return null;
  const userId = sessions.get(sid);
  if (!userId) return null;
  return store.users.find((user) => user.id === userId) || null;
}

function setSession(res, userId) {
  const sid = id("sess");
  sessions.set(sid, userId);
  res.setHeader("Set-Cookie", `otz_session=${encodeURIComponent(sid)}; HttpOnly; SameSite=Lax; Path=/`);
}

function clearSession(req, res) {
  const sid = parseCookies(req).otz_session;
  if (sid) sessions.delete(sid);
  res.setHeader("Set-Cookie", "otz_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
}

function sendJson(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(data));
}

function sendError(res, status, message) {
  sendJson(res, status, { error: message });
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("資料太大，請改用較小的圖片或文字。"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      const text = Buffer.concat(chunks).toString("utf8") || "{}";
      try {
        resolve(JSON.parse(text));
      } catch {
        reject(new Error("JSON 格式不正確。"));
      }
    });
    req.on("error", reject);
  });
}

function canAccessRoom(user, room) {
  return room.ownerId === user.id || room.memberIds.includes(user.id);
}

function memberPayload(room, store) {
  const ids = [room.ownerId, ...room.memberIds];
  return ids
    .map((userId) => store.users.find((item) => item.id === userId))
    .filter(Boolean)
    .map((member) => ({
      id: member.id,
      name: member.name,
      isOwner: member.id === room.ownerId,
    }));
}

function roomSummary(room, user, store) {
  const isOwner = room.ownerId === user.id;
  return {
    id: room.id,
    title: room.title,
    ownerName: room.ownerName,
    inviteCode: isOwner ? room.inviteCode : null,
    canEdit: isOwner,
    members: store ? memberPayload(room, store) : [],
  };
}

function roomPayload(room, user, store) {
  const isOwner = room.ownerId === user.id;
  return {
    ...roomSummary(room, user, store),
    goals: room.goals.map((goal) => {
      if (isOwner || goal.shared === true) {
        return { ...goal, private: false };
      }

      return {
        title: "只有自己可見",
        plan: "這一格尚未分享給受邀朋友。",
        image: goal.image,
        done: goal.done,
        shared: false,
        private: true,
      };
    }),
  };
}

function createRoomForUser(user) {
  return {
    id: id("room"),
    ownerId: user.id,
    ownerName: user.name,
    title: `${user.name} 的九宮格`,
    inviteCode: inviteCode(),
    memberIds: [],
    goals: defaultGoals.map((goal) => ({ ...goal })),
    createdAt: new Date().toISOString(),
  };
}

function sanitizeGoal(input, existing) {
  const image = String(input.image || existing.image || "./assets/goal-1.png");
  if (image.length > MAX_BODY_BYTES) {
    throw new Error("圖片資料太大，請選擇較小的圖片。");
  }
  return {
    title: String(input.title || "").trim().slice(0, 28) || "尚未命名",
    plan: String(input.plan || "").trim().slice(0, 2000),
    image,
    done: Boolean(input.done),
    shared: Boolean(input.shared),
  };
}

async function handleApi(req, res, pathname) {
  const store = await readStore();
  const user = getSessionUser(req, store);

  if (req.method === "POST" && pathname === "/api/register") {
    const body = await readJson(req);
    const name = String(body.name || "").trim().slice(0, 24);
    const email = normalizeEmail(body.email);
    const password = String(body.password || "");
    if (!name || !email || password.length < 6) {
      return sendError(res, 400, "請輸入名稱、Email，並使用至少 6 碼密碼。");
    }
    if (store.users.some((item) => item.email === email)) {
      return sendError(res, 409, "這個 Email 已經註冊。");
    }
    const nextUser = {
      id: id("user"),
      name,
      email,
      passwordHash: hashPassword(password),
      createdAt: new Date().toISOString(),
    };
    const room = createRoomForUser(nextUser);
    store.users.push(nextUser);
    store.rooms.push(room);
    await writeStore(store);
    setSession(res, nextUser.id);
    return sendJson(res, 201, { user: publicUser(nextUser), rooms: [roomSummary(room, nextUser, store)] });
  }

  if (req.method === "POST" && pathname === "/api/login") {
    const body = await readJson(req);
    const email = normalizeEmail(body.email);
    const password = String(body.password || "");
    const found = store.users.find((item) => item.email === email);
    if (!found || !verifyPassword(password, found.passwordHash)) {
      return sendError(res, 401, "Email 或密碼不正確。");
    }
    setSession(res, found.id);
    const rooms = store.rooms.filter((room) => canAccessRoom(found, room)).map((room) => roomSummary(room, found, store));
    return sendJson(res, 200, { user: publicUser(found), rooms });
  }

  if (req.method === "POST" && pathname === "/api/logout") {
    clearSession(req, res);
    return sendJson(res, 200, { ok: true });
  }

  if (!user) {
    return sendError(res, 401, "請先登入。");
  }

  if (req.method === "GET" && pathname === "/api/me") {
    const rooms = store.rooms.filter((room) => canAccessRoom(user, room)).map((room) => roomSummary(room, user, store));
    return sendJson(res, 200, { user: publicUser(user), rooms });
  }

  if (req.method === "POST" && pathname === "/api/join") {
    const body = await readJson(req);
    const code = String(body.inviteCode || "").trim().toUpperCase();
    const room = store.rooms.find((item) => item.inviteCode === code);
    if (!room) return sendError(res, 404, "找不到這組邀請碼。");
    if (room.ownerId !== user.id && !room.memberIds.includes(user.id)) {
      room.memberIds.push(user.id);
      await writeStore(store);
    }
    return sendJson(res, 200, { room: roomSummary(room, user, store) });
  }

  const roomMatch = pathname.match(/^\/api\/rooms\/([^/]+)$/);
  if (req.method === "GET" && roomMatch) {
    const room = store.rooms.find((item) => item.id === roomMatch[1]);
    if (!room || !canAccessRoom(user, room)) return sendError(res, 404, "找不到可查看的目標牆。");
    return sendJson(res, 200, { room: roomPayload(room, user, store) });
  }

  const goalMatch = pathname.match(/^\/api\/rooms\/([^/]+)\/goals\/([0-8])$/);
  if (req.method === "PUT" && goalMatch) {
    const room = store.rooms.find((item) => item.id === goalMatch[1]);
    if (!room || room.ownerId !== user.id) return sendError(res, 403, "只有目標牆擁有者可以編輯。");
    const index = Number(goalMatch[2]);
    const body = await readJson(req);
    try {
      room.goals[index] = sanitizeGoal(body, room.goals[index]);
    } catch (error) {
      return sendError(res, 400, error.message);
    }
    await writeStore(store);
    return sendJson(res, 200, { room: roomPayload(room, user, store) });
  }

  return sendError(res, 404, "API 不存在。");
}

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml",
  }[ext] || "application/octet-stream";
}

function serveStatic(req, res, pathname) {
  const safePath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.normalize(path.join(PUBLIC_DIR, safePath));
  if (!filePath.startsWith(PUBLIC_DIR) || filePath.includes(`${path.sep}data${path.sep}`)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }
  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404);
      return res.end("Not found");
    }
    res.writeHead(200, { "Content-Type": contentType(filePath) });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url.pathname);
    } else {
      serveStatic(req, res, decodeURIComponent(url.pathname));
    }
  } catch (error) {
    if (!res.headersSent) sendError(res, 500, error.message || "伺服器發生錯誤。");
  }
});

if (!useSupabase()) ensureDataFile();
server.listen(PORT, "0.0.0.0", () => {
  console.log(`own time zone online is running at http://localhost:${PORT}`);
  console.log(useSupabase() ? "storage: Supabase" : `storage: ${DATA_FILE}`);
  console.log(`supabase url present: ${SUPABASE_URL ? "yes" : "no"}`);
  console.log(`supabase key present: ${SUPABASE_KEY ? "yes" : "no"}`);
  console.log(`supabase key mode: ${isLegacyJwtKey(SUPABASE_KEY) ? "legacy-jwt" : "secret-or-publishable"}`);
});

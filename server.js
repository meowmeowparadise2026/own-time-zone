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

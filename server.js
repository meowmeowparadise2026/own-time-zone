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

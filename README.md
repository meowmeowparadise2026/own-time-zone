# own time zone 線上 MVP

這是一個無外部依賴的 Node.js 小型線上版原型。只要所有人連到同一個伺服器，就能註冊、登入、建立自己的九宮格目標牆，並用邀請碼讓朋友查看分享的目標。

## 執行方式

```powershell
cd outputs\own-time-zone-online
node server.js
```

開啟：

```text
http://localhost:8787
```

本機開發時，資料預設寫入 `data/store.json`。

## 功能

- 會員註冊與登入
- 每位會員自動擁有一面九宮格目標牆
- 伺服器端儲存目標、細部規劃、完成狀態、分享設定與代表圖片
- 邀請碼加入朋友的目標牆
- 朋友只看得到標示為「分享給受邀朋友」的格子
- 隱私權政策與使用條款頁面

## 免費部署建議

建議使用：

- Render Free Web Service：部署 Node.js 網站
- Supabase Free Project：保存會員與九宮格資料

Render 免費 Web Service 的本機檔案系統會在重啟、休眠或重新部署後遺失，所以正式分享給朋友時，請務必設定 Supabase。若沒有設定 Supabase，部署後的會員資料和圖片可能消失。

## Supabase 設定

1. 到 Supabase 建立 Free project。
2. 進入 SQL Editor。
3. 貼上並執行 `supabase.sql`。
4. 到 Project Settings -> API，複製：
   - Project URL
   - service_role key

請勿把 service_role key 放到前端或公開分享；只放在 Render 的 Environment Variables。

## Render 設定

1. 把此資料夾上傳到 GitHub repo。
2. 到 Render 建立 Web Service，連接 GitHub repo。
3. Instance type 選 Free。
4. Start command 使用：

```text
npm start
```

5. 設定 Environment Variables：

```text
SUPABASE_URL=你的 Supabase Project URL
SUPABASE_SERVICE_ROLE_KEY=你的 Supabase service_role key
OTZ_STORE_ID=main
```

Render 也可以讀取 `render.yaml` 作為 Blueprint。

## 資料位置

本機模式資料會寫入：

```text
data/store.json
```

部署模式若設定 Supabase，資料會寫入 Supabase 的 `app_state` 表。

## 部署提醒

這份程式目前把圖片以 base64 存入同一份資料中，適合小圈圈 MVP 測試。若未來使用者或圖片變多，建議把圖片改放 Supabase Storage 或其他物件儲存服務。

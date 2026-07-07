# 免費部署步驟：Render + Supabase

這份教學是為了讓朋友直接開公開網址使用，而不是下載 ZIP 或連你的 `localhost`。

## 先知道限制

Render 免費 Web Service 會在閒置一段時間後休眠，第一次打開可能需要等約一分鐘。免費主機的本機檔案也可能在重啟或重新部署後消失，所以資料不能只存在 `data/store.json`。本專案已支援 Supabase，部署時請使用 Supabase 保存資料。

## 1. 建立 Supabase 免費資料庫

1. 到 Supabase 註冊/登入。
2. 建立 Free project。
3. 進入 SQL Editor。
4. 貼上 `supabase.sql` 的內容並執行。
5. 到 Project Settings -> API，複製：
   - Project URL
   - service_role key

`service_role key` 是後端密鑰，不要貼到公開網頁、GitHub README、聊天或前端程式。

## 2. 上傳到 GitHub

1. 建立一個新的 GitHub repository。
2. 把 `own-time-zone-online` 資料夾內的檔案上傳。
3. 不要上傳 `data/store.json`。

## 3. 建立 Render Web Service

1. 到 Render 註冊/登入。
2. 點 New -> Web Service。
3. 連接剛剛的 GitHub repository。
4. 設定：
   - Runtime: Node
   - Instance type: Free
   - Build command: `npm install`
   - Start command: `npm start`

## 4. 設定 Render 環境變數

在 Render 的 Environment Variables 加上：

```text
SUPABASE_URL=你的 Supabase Project URL
SUPABASE_SERVICE_ROLE_KEY=你的 Supabase service_role key
OTZ_STORE_ID=main
```

## 5. 開始部署

Render 部署完成後，會給你一個公開網址，例如：

```text
https://own-time-zone.onrender.com
```

之後你和朋友都用這個網址註冊、登入、輸入邀請碼，就會使用同一份線上資料。

## 6. 常見問題

如果網站第一次打開很慢：  
Render 免費服務休眠後正在醒來，等一下重新整理即可。

如果註冊成功後資料消失：  
通常是沒有設定 Supabase 環境變數，導致資料存在免費主機的暫存檔案。

如果部署失敗：  
檢查 Render logs，確認 `SUPABASE_URL` 和 `SUPABASE_SERVICE_ROLE_KEY` 有填，且 Supabase SQL 已執行。

如果圖片太大無法同步：  
目前單次請求限制約 8MB。請先壓縮圖片，未來正式版可改成 Supabase Storage。

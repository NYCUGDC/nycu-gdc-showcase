# NYCU GDC 期末 Showcase

NYCU GDC 期末成果展示網站。

## 🌐 網站網址

**https://showcase.nycu-gdc.org/**

## 架構

- 靜態頁面放在 `public/`
- Cloudflare Worker（`worker/src/index.js`）處理 API 請求（如作品瀏覽次數統計）
- 瀏覽次數儲存於 Cloudflare KV（`VIEWS_KV`）
- 透過 [Wrangler](https://developers.cloudflare.com/workers/wrangler/) 部署

## 開發

需先安裝 Wrangler CLI：

```bash
npm install -g wrangler
wrangler login
```

本機啟動開發伺服器：

```bash
wrangler dev
```

## 部署

```bash
wrangler deploy
```

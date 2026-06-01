# 📊 KenvinZone Portfolio

Web app quản lý danh mục chứng khoán cá nhân. Deploy trên GitHub Pages, dữ liệu lưu trên trình duyệt của từng người dùng.

## 🚀 Deploy lên GitHub Pages

1. Tạo repo mới trên GitHub (public hoặc private đều được)
2. Upload toàn bộ files vào repo
3. Vào **Settings → Pages → Source: Deploy from a branch → main / root**
4. Truy cập tại `https://username.github.io/repo-name`

---

## 🔌 Setup Google Apps Script Proxy (bắt buộc để lấy giá realtime)

> Miễn phí hoàn toàn, không cần API key

### Bước 1 — Tạo project

Vào [script.google.com](https://script.google.com) → Đăng nhập Gmail → **New project**

### Bước 2 — Paste code sau vào editor

```javascript
const TCBS = 'https://apipubaws.tcbs.com.vn/stock-insight/v1';

function doGet(e) {
  const symbols = (e.parameter.symbols || 'VCB').toUpperCase();
  const type    = e.parameter.type || 'quote';
  
  const url = type === 'intraday'
    ? `${TCBS}/intraday/${symbols}/his/paging?page=0&size=20&headIndex=-1`
    : `${TCBS}/stock/batch-quote?tickers=${symbols}`;

  try {
    const resp = UrlFetchApp.fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      muteHttpExceptions: true
    });
    return ContentService
      .createTextOutput(resp.getContentText())
      .setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: true, message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
```

### Bước 3 — Deploy

1. Click **Deploy** → **New deployment**
2. Click ⚙️ → chọn **Web app**
3. Cấu hình:
   - Execute as: **Me**
   - Who has access: **Anyone**
4. Click **Deploy** → **Authorize access** → Allow
5. Copy URL dạng: `https://script.google.com/macros/s/AKfycb.../exec`

### Bước 4 — Paste vào app

Vào app → Tab **Cài đặt** → paste URL vào ô **Google Apps Script Proxy URL** → **Lưu** → **Test**

---

## 📁 Cấu trúc file

```
├── index.html        ← App chính
├── css/
│   └── style.css     ← Toàn bộ styles
├── js/
│   ├── auth.js       ← Multi-user authentication
│   ├── api.js        ← Fetch giá via GAS proxy
│   ├── store.js      ← Lưu/đọc dữ liệu localStorage
│   └── app.js        ← UI logic
└── README.md
```

## 💾 Lưu ý dữ liệu

- Toàn bộ dữ liệu lưu trên **localStorage của trình duyệt**
- Mỗi người dùng trên mỗi máy có dữ liệu riêng biệt
- **Nhớ Export JSON backup định kỳ** tại tab Cài đặt
- Xóa cache/cookies trình duyệt sẽ mất dữ liệu nếu không có backup

# Finance - Bill Splitter Application

A modern bill splitting application built with React and Cloudflare Workers with D1 database.

## 🌟 Features

- **👥 Hesab Bölgüsü**: İştirakçılar arasında hesabları ədalətli bölüşdürün
- **📊 Məhsul İdarəetməsi**: Məhsulları əlavə edin və kimin hansı məhsula iştirak etdiyini seçin
- **💰 Manat Valyutası**: Azərbaycan manatı (₼) ilə hesablamalar
- **🌐 Azərbaycan Dili**: Tam Azərbaycan dilində interfeys
- **☁️ Cloudflare D1 Database**: Avtomatik Cloudflare D1-ə yadda saxlama
- **📸 Şəkil İxracı**: Hesabı şəkil kimi yükləyin
- **📄 CSV/JSON İxrac**: Məlumatları müxtəlif formatlarda ixrac edin
- **🔄 Avtomatik Yadda Saxlama**: Dəyişiklikləri avtomatik saxlayır

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ installed
- npm or yarn

### Installation

```bash
# Clone repository
git clone https://github.com/aladd1n/finance.git
cd finance

# Install dependencies
npm install
```

### Running the Application

**Development Mode:**
```bash
# Start Vite dev server (uses Cloudflare Workers API)
npm run dev
```

**Local Cloudflare Worker Development:**
```bash
# Run Cloudflare Worker locally with Wrangler
npm run worker:dev
```

Then open http://localhost:3000 in your browser.

## 📁 Project Structure

```
finance/
├── src/
│   ├── App.jsx          # Main React application
│   └── main.jsx         # React entry point
├── worker-auth.js       # Cloudflare Worker with authentication
├── worker.js            # Cloudflare Worker (simple version)
├── wrangler.toml        # Cloudflare configuration
├── schema.sql           # D1 database schema
├── index.html
├── package.json
├── vite.config.js
├── D1_SETUP.md          # D1 database setup guide
└── README.md
```

## 🔧 Configuration

### API URL
Default: `https://finance.psszdh.workers.dev/api`

For local development, set in `src/App.jsx`:
```javascript
const API_URL = import.meta.env.VITE_API_URL || 'https://finance.psszdh.workers.dev/api';
```

### Cloudflare D1 Setup
See [D1_SETUP.md](./D1_SETUP.md) for detailed database setup instructions.

## 📡 Deployment

The application automatically deploys to Cloudflare when you push to GitHub.

**Manual deployment:**
```bash
npm run worker:deploy
```

Quick reference:
- `GET /api/bills` - Get all bills
- `GET /api/bills/:id` - Get specific bill
- `POST /api/bills` - Create new bill
- `PUT /api/bills/:id` - Update bill
- `DELETE /api/bills/:id` - Delete bill
- `GET /api/health` - Server health check

## 💾 Data Storage

- **Server**: Data stored in `server/data/bills.json`
- **Client**: Backup in browser localStorage
- **Sync**: Automatic synchronization every 1 second
- **Fallback**: Works offline if server unavailable

## 🎨 UI Features

### Tabs
1. **İştirakçılar (People)**: Manage participants, mark who paid
2. **Məhsullar (Items)**: Add items, set prices, assign participants
3. **Xülasə (Summary)**: View breakdown, export data

### Status Indicators
- 🟢 Local - Saved locally
- 🔄 Syncing - Sending to server
- ☁️ Synced - Saved to server
- ⚠️ Error - Server unavailable

## 📤 Export Options

1. **Şəkil Çək (Screenshot)**: PNG image of current view
2. **CSV İxrac (CSV Export)**: Spreadsheet format
3. **JSON İxrac (JSON Export)**: Raw data format
4. **Buferə Köçür (Copy to Clipboard)**: Text summary

## 🛠️ Development

### Build for Production
```bash
npm run build
```

### Preview Production Build
```bash
npm run preview
```

### Technologies Used
- **Frontend**: React 19, Vite, Lucide Icons, html2canvas
- **Backend**: Express, Node.js
- **Styling**: Tailwind CSS (inline)

## 📝 License

ISC

## 👤 Author

GitHub: [@aladd1n](https://github.com/aladd1n)

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!
# Updated Fri Feb  6 12:40:50 UTC 2026

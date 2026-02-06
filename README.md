# Finance - Bill Splitter Application

A modern bill splitting application with server-side data persistence, built with React and Express.

## 🌟 Features

- **👥 Hesab Bölgüsü**: İştirakçılar arasında hesabları ədalətli bölüşdürün
- **📊 Məhsul İdarəetməsi**: Məhsulları əlavə edin və kimin hansı məhsula iştirak etdiyini seçin
- **💰 Manat Valyutası**: Azərbaycan manatı (₼) ilə hesablamalar
- **🌐 Azərbaycan Dili**: Tam Azərbaycan dilində interfeys
- **☁️ Server Sinxronizasiyası**: Avtomatik server-ə yadda saxlama
- **💾 Lokal Yedəkləmə**: Server olmadan da işləyir
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

**Option 1: Easy Start (Recommended)**
```bash
npm run dev:all
```
This starts both backend (port 3001) and frontend (port 5173).

**Option 2: Using startup script**
```bash
./start.sh
```

**Option 3: Run separately**

Terminal 1 - Backend:
```bash
npm run server
```

Terminal 2 - Frontend:
```bash
npm run dev
```

Then open http://localhost:5173 in your browser.

## 📁 Project Structure

```
finance/
├── src/
│   ├── App.jsx          # Main React application
│   └── main.jsx         # React entry point
├── server/
│   ├── index.js         # Express server
│   └── data/
│       └── bills.json   # Data storage
├── index.html
├── package.json
├── vite.config.js
├── SERVER_SETUP.md      # Detailed server documentation
└── README.md
```

## 🔧 Configuration

### API URL
Default: `http://localhost:3001/api`

To change, edit in `src/App.jsx`:
```javascript
const API_URL = 'http://localhost:3001/api';
```

### Server Port
Default: `3001`

To change, edit in `server/index.js` or set environment variable:
```bash
PORT=8080 npm run server
```

## 📡 API Endpoints

See [SERVER_SETUP.md](./SERVER_SETUP.md) for detailed API documentation.

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

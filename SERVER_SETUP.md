# Server Setup Guide

## Overview
The application now includes a backend server that stores bill data in JSON files on the server.

## Features
- **Automatic Sync**: Data is automatically saved to the server every second after changes
- **Fallback**: If server is unavailable, data is still saved locally in browser
- **Latest Data**: On startup, loads the most recent data from either local storage or server
- **Visual Feedback**: Status indicator shows sync status (local, syncing, synced, error)

## Running the Application

### Option 1: Run Everything Together
```bash
npm run dev:all
```
This starts both the backend server (port 3001) and frontend dev server (port 5173).

### Option 2: Run Separately
Terminal 1 - Backend Server:
```bash
npm run server
```

Terminal 2 - Frontend:
```bash
npm run dev
```

## API Endpoints

### Get all bills
```
GET http://localhost:3001/api/bills
```

### Get specific bill
```
GET http://localhost:3001/api/bills/:id
```

### Create new bill
```
POST http://localhost:3001/api/bills
Content-Type: application/json

{
  "participants": [...],
  "items": [...],
  "taxPercent": 10,
  "tipPercent": 15
}
```

### Update existing bill
```
PUT http://localhost:3001/api/bills/:id
Content-Type: application/json

{
  "participants": [...],
  "items": [...],
  "taxPercent": 10,
  "tipPercent": 15
}
```

### Delete bill
```
DELETE http://localhost:3001/api/bills/:id
```

### Health check
```
GET http://localhost:3001/api/health
```

## Data Storage
- All data is stored in: `server/data/bills.json`
- Each bill has a unique ID and timestamps (createdAt, updatedAt)
- Data format:
```json
{
  "bills": [
    {
      "id": "1234567890",
      "participants": [...],
      "items": [...],
      "taxPercent": 10,
      "tipPercent": 15,
      "createdAt": "2026-02-06T10:00:00.000Z",
      "updatedAt": "2026-02-06T10:05:00.000Z"
    }
  ]
}
```

## Status Indicators

The floating indicator at the bottom shows:
- 🟢 **Local**: Data saved locally (default state)
- 🔄 **Syncing**: Currently sending data to server
- ☁️ **Synced**: Successfully saved to server
- ⚠️ **Error**: Server unavailable, data saved locally only

## Troubleshooting

### Server won't start
- Make sure port 3001 is available
- Check if `node_modules` are installed: `npm install`

### Data not syncing
- Verify server is running: `http://localhost:3001/api/health`
- Check browser console for errors
- Data is still safe in localStorage even if server fails

### CORS errors
- Make sure the server is running on port 3001
- The server is configured to accept requests from any origin

import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';

const app = express();
const PORT = process.env.PORT || 3001;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/finance';

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
async function connectDB() {
  try {
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    process.exit(1);
  }
}

// Bill Schema
const billSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  participants: [{
    id: String,
    name: String,
    paid: Boolean
  }],
  items: [{
    id: String,
    name: String,
    price: Number,
    category: String,
    participants: [String]
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const Bill = mongoose.model('Bill', billSchema);

// Routes

// Get all bills
app.get('/api/bills', async (req, res) => {
  try {
    const bills = await Bill.find().sort({ createdAt: -1 });
    res.json(bills);
  } catch (error) {
    res.status(500).json({ error: 'Failed to read bills' });
  }
});

// Get a specific bill by ID
app.get('/api/bills/:id', async (req, res) => {
  try {
    const bill = await Bill.findOne({ id: req.params.id });
    if (bill) {
      res.json(bill);
    } else {
      res.status(404).json({ error: 'Bill not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to read bill' });
  }
});

// Get the current/active bill (most recent)
app.get('/api/bills/current', async (req, res) => {
  try {
    const bill = await Bill.findOne().sort({ createdAt: -1 });
    res.json(bill || null);
  } catch (error) {
    res.status(500).json({ error: 'Failed to read current bill' });
  }
});

// Create a new bill
app.post('/api/bills', async (req, res) => {
  try {
    const newBill = new Bill({
      id: Date.now().toString(),
      ...req.body,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    await newBill.save();
    res.status(201).json(newBill);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create bill' });
  }
});

// Update an existing bill
app.put('/api/bills/:id', async (req, res) => {
  try {
    const updatedBill = await Bill.findOneAndUpdate(
      { id: req.params.id },
      { ...req.body, updatedAt: new Date() },
      { new: true }
    );
    if (updatedBill) {
      res.json(updatedBill);
    } else {
      res.status(404).json({ error: 'Bill not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to update bill' });
  }
});

// Delete a bill
app.delete('/api/bills/:id', async (req, res) => {
  try {
    const result = await Bill.findOneAndDelete({ id: req.params.id });
    if (result) {
      res.json({ message: 'Bill deleted successfully' });
    } else {
      res.status(404).json({ error: 'Bill not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete bill' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Initialize and start server
async function startServer() {
  await connectDB();
  
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📊 Database: ${MONGODB_URI}`);
  });
}

startServer().catch(console.error);

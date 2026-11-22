// import express from 'express';
// import cors from 'cors';
// import dotenv from 'dotenv';
// import { connectDB } from './config/db.js';

// import serviceRoutes from './routes/serviceRoutes.js';
// import bookingRoutes from './routes/bookingRoutes.js';
// import adminRoutes from './routes/adminRoutes.js';
// import paymentRoutes, { stripeWebhookHandler } from './routes/paymentRoutes.js';

// dotenv.config();

// const app = express();
// const PORT = process.env.PORT || 5000;

// app.use(
//   cors({
//     origin: process.env.CLIENT_URL || 'http://localhost:3000',
//     credentials: true,
//     methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
//   })
// );

// // Stripe Webhook (অবশ্যই express.json()-এর আগে থাকতে হবে)
// app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), stripeWebhookHandler);

// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));

// app.get('/', (req, res) => {
//   res.status(200).json({ success: true, message: 'WedPlan Modular Server is running!' });
// });

// // সব আলাদা রাউট যুক্ত করা হলো
// app.use('/api', serviceRoutes);
// app.use('/api', bookingRoutes);
// app.use('/api', adminRoutes);
// app.use('/api', paymentRoutes);

// connectDB().then(() => {
//   app.listen(PORT, () => {
//     console.log(`Server is running on port ${PORT}`);
//   });
// });

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDB } from "./config/db.js";

import serviceRoutes from "./routes/serviceRoutes.js";
import bookingRoutes from "./routes/bookingRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import paymentRoutes, { stripeWebhookHandler } from "./routes/paymentRoutes.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

const allowedOrigins = [
  "https://wedplan-client-bay.vercel.app",
  "http://localhost:3000",
  process.env.CLIENT_URL,
].filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    if (
      !origin ||
      allowedOrigins.includes(origin) ||
      origin.endsWith(".vercel.app")
    ) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

// Stripe Webhook (অবশ্যই express.json()-এর আগে থাকতে হবে)
app.post(
  "/api/webhooks/stripe",
  express.raw({ type: "application/json" }),
  stripeWebhookHandler,
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// প্রতিটি রিকোয়েস্টের আগে DB কানেকশন নিশ্চিত করা
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    console.error("Database connection failed:", error);
    res
      .status(500)
      .json({ success: false, message: "Database connection error" });
  }
});

app.get("/", (req, res) => {
  res
    .status(200)
    .json({ success: true, message: "WedPlan Modular Server is running!" });
});

app.use("/api", serviceRoutes);
app.use("/api", bookingRoutes);
app.use("/api", adminRoutes);
app.use("/api", paymentRoutes);

if (process.env.NODE_ENV !== "production") {
  connectDB().then(() => {
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  });
}

export default app;

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const app = express();
app.use(
  cors({
    origin: "*", // Allows requests from any domain (useful for testing)
    methods: "GET,POST", // Allow only GET and POST requests
    allowedHeaders: "Content-Type",
  })
);
app.use(express.json());

console.log("Starting server...");

// Connect to MongoDB using the connection string from .env
mongoose
  .connect(process.env.DATABASE_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("✅ Connected to MongoDB");
  })
  .catch((err) => {
    console.error("❌ Database connection error:", err);
    process.exit(1);
  });

// Define MongoDB Schema for Reviews
const reviewSchema = new mongoose.Schema({
  product_id: String,
  customer_name: String,
  rating: Number,
  comment: String,
  helpful: { type: Number, default: 0 },
  created_at: { type: Date, default: Date.now },
});

const Review = mongoose.model("Review", reviewSchema);

// Fetch reviews for a product
app.get("/reviews", async (req, res) => {
  const { product_id } = req.query;
  if (!product_id) {
    return res.status(400).json({ error: "Missing product_id in request" });
  }
  try {
    const reviews = await Review.find({ product_id }).sort({ created_at: -1 });
    res.json(reviews);
  } catch (err) {
    console.error("❌ Error fetching reviews:", err);
    res.status(500).json({ error: err.message || "Unknown error occurred" });
  }
});

// Add a new review
app.post("/reviews", async (req, res) => {
  const { product_id, customer_name, rating, comment } = req.body;
  if (!product_id || !customer_name || !rating || !comment) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  try {
    const newReview = new Review({
      product_id,
      customer_name,
      rating,
      comment,
    });
    await newReview.save();
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Error adding review:", err);
    res.status(500).json({ error: err.message || "Unknown error occurred" });
  }
});

// handle helpful clicks
app.post("/reviews/helpful", async (req, res) => {
  const { review_id } = req.body;

  try {
    const updatedReview = await Review.findByIdAndUpdate(
      review_id,
      { $inc: { helpful: 1 } }, // Increment the "helpful" count
      { new: true }
    );

    if (!updatedReview) {
      return res.status(404).json({ error: "Review not found." });
    }

    res.json({ success: true, helpful: updatedReview.helpful });
  } catch (err) {
    res.status(500).json({ error: "Database error." });
  }
});

// conversion api

const axios = require("axios");

let lastRandomValue = null;
let lastGeneratedDate = null;

function getDailyRandomOffset() {
  const today = new Date().toISOString().slice(0, 10); // e.g., '2025-04-04'

  if (lastGeneratedDate !== today) {
    lastRandomValue = Math.floor(Math.random() * 6) + 1; // random 1–6
    lastGeneratedDate = today;
    console.log("🔁 Generated new random offset:", lastRandomValue);
  }

  return lastRandomValue || 0;
}

app.get("/order-count", async (req, res) => {
  try {
    const shopifyStore = process.env.SHOPIFY_STORE;
    const shopifyAPIKey = process.env.SHOPIFY_API_KEY;

    const response = await axios.get(
      `https://${shopifyStore}.myshopify.com/admin/api/2024-01/orders.json`,
      {
        params: {
          status: "paid",
          created_at_min: new Date(
            Date.now() - 2 * 24 * 60 * 60 * 1000
          ).toISOString(),
        },
        headers: {
          "X-Shopify-Access-Token": shopifyAPIKey,
        },
      }
    );

    const actualCount = response.data.orders.length;
    const offset = getDailyRandomOffset();
    const displayCount = actualCount + offset;

    res.json({ count: displayCount });
  } catch (error) {
    console.error("Error fetching order count:", error);
    res.status(500).json({ error: "Failed to fetch order count" });
  }
});

// ratings stats
app.get("/review-stats", async (req, res) => {
  try {
    const stats = await Review.aggregate([
      {
        $group: {
          _id: "$rating",
          count: { $sum: 1 },
        },
      },
    ]);

    // Convert the aggregation result into a structured response
    const totalReviews = stats.reduce((sum, item) => sum + item.count, 0);

    const ratings = {
      5: 0,
      4: 0,
      3: 0,
      2: 0,
      1: 0, // Default all ratings to 0
    };

    stats.forEach((item) => {
      ratings[item._id] = item.count;
    });

    res.json({
      totalReviews,
      ratings,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch review statistics" });
  }
});

// Start the server
const PORT = process.env.PORT || 3000;

// ✅ Prevent server from sleeping by pinging itself every 14 minutes
setInterval(() => {
  console.log("⏰ Waking up the server...");
  axios
    .get(`http://localhost:${PORT}/ping`)
    .then(() => console.log("✅ Server is awake!"))
    .catch((err) => console.error("❌ Error keeping server awake:", err));
}, 14 * 60 * 1000); // 14 minutes in milliseconds

// ✅ Add a simple ping route so the server can wake itself up
app.get("/ping", (req, res) => {
  console.log("Ping received at", new Date());
  res.send("pong");
});

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

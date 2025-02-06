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

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

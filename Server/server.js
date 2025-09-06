import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();
const app = express();
app.use(express.json());
app.use(cors());

// --------------------
// DB Connection
// --------------------
mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log("✅ MongoDB connected");
    await seed();         // admin & user
    await seedProducts(); // products
  })
  .catch(err => console.error("❌ Mongo error:", err));


// --------------------
// Schemas
// --------------------
const userSchema = new mongoose.Schema({
  email: { type: String, unique: true },
  password: String,
  phone: String,
  address: String,
  role: { type: String, enum: ["user", "admin"], default: "user" }
});

const productSchema = new mongoose.Schema({
  name: String,
  price: Number,
  image: String,
  description: String
});

const orderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  items: Array,
  total: Number,
  address: String,
  status: { type: String, default: "Pending" }
});

const User = mongoose.model("User", userSchema);
const Product = mongoose.model("Product", productSchema);
const Order = mongoose.model("Order", orderSchema);

// --------------------
// Seed Admin + Default User (run once)
// --------------------
async function seed() {
  const users = [
    { email: "admin@email.com", password: "admin123", role: "admin" },
    { email: "user@email.com", password: "user123", role: "user" }
  ];

  for (const u of users) {
    const exists = await User.findOne({ email: u.email });
    if (!exists) {
      await User.create(u);
      console.log(`Created ${u.role}: ${u.email}`);
    }
  }
}
seed();

// --------------------
// Routes
// --------------------

// Auth: Register
app.post("/api/auth/register", async (req, res) => {
  try {
    const { email, password, phone, address } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password required" });
    }
    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ message: "Email already exists" });

    const newUser = await User.create({ email, password, phone, address, role: "user" });
    res.status(201).json({
      _id: newUser._id,
      email: newUser.email,
      phone: newUser.phone,
      address: newUser.address,
      role: newUser.role
    });
  } catch (err) {
    res.status(500).json({ message: "Error registering user" });
  }
});

// Auth: Login
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email, password });
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    res.json({
      _id: user._id,
      email: user.email,
      role: user.role,
      phone: user.phone,
      address: user.address
    });
  } catch (err) {
    res.status(500).json({ message: "Error logging in" });
  }
});

// Account: Update user info
app.put("/api/users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { email, password, phone, address, name } = req.body;

    const updates = {};
    if (email) updates.email = email;
    if (password) updates.password = password;
    if (phone) updates.phone = phone;
    if (address) updates.address = address;
    if (name) updates.name = name;

    const updated = await User.findByIdAndUpdate(id, updates, { new: true });
    if (!updated) return res.status(404).json({ message: "User not found" });

    res.json({
      _id: updated._id,
      email: updated.email,
      role: updated.role,
      phone: updated.phone,
      address: updated.address
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error updating user" });
  }
});



// Products: Get All
app.get("/api/products", async (req, res) => {
  const products = await Product.find();
  res.json(products);
});

// Add this new route to your server code

// Products: Get Single Product by ID
app.get("/api/products/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.json(product);
  } catch (error) {
    console.error("Server error fetching product by ID:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Products: Add (open, but should be admin-only)
app.post("/api/products", async (req, res) => {
  try {
    const product = await Product.create(req.body);
    res.status(201).json(product);
  } catch {
    res.status(500).json({ message: "Error adding product" });
  }
});

// Orders: Place
app.post("/api/orders", async (req, res) => {
  try {
    const { userId, items, total, address } = req.body;
    const order = await Order.create({ userId, items, total, address });
    res.status(201).json(order);
  } catch {
    res.status(500).json({ message: "Error placing order" });
  }
});

// Orders: Get User Orders
app.get("/api/orders/:userId", async (req, res) => {
  const orders = await Order.find({ userId: req.params.userId });
  res.json(orders);
});

// Admin: Get All Orders (populate user email)
app.get("/api/admin/orders", async (req, res) => {
  const orders = await Order.find().populate("userId", "email");
  res.json(orders);
});

// Admin: Get All Users
app.get("/api/admin/users", async (req, res) => {
  const users = await User.find();
  res.json(users);
});

// Products: Delete
app.delete("/api/products/:id", async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: "Product deleted" });
  } catch {
    res.status(500).json({ message: "Error deleting product" });
  }
});


// Admin: Delete User by Email
app.delete("/api/admin/users", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email required" });

    const deleted = await User.findOneAndDelete({ email });
    if (!deleted) return res.status(404).json({ message: "User not found" });

    res.json({ message: "User deleted", email });
  } catch (err) {
    res.status(500).json({ message: "Error deleting user" });
  }
});
// --------------------
// Seed Default Products
// --------------------
async function seedProducts() {
  const existing = await Product.find();
  if (existing.length === 0) {
    const defaultProducts = [
      {
        name: "iPhone 15 Pro",
        price: 129999,
        image: "https://m.media-amazon.com/images/I/619oqSJVY5L._SX679_.jpg"
      },
      {
        name: "Samsung Galaxy S24 Ultra",
        price: 119999,
        image: "https://m.media-amazon.com/images/I/717Q2swzhBL._SX679_.jpg",
        description: "Samsung’s flagship with 200MP camera and S-Pen."
      },
      {
        name: "MacBook Air M2",
        price: 99999,
        image: "https://m.media-amazon.com/images/I/71CjP9jmqZL._SX679_.jpg",
        description: "Apple MacBook Air with M2 chip, 13.6-inch Liquid Retina display."
      },
      {
        name: "Sony WH-1000XM5 Headphones",
        price: 29999,
        image: "https://m.media-amazon.com/images/I/51aXvjzcukL._SX522_.jpg",
        description: "Noise-cancelling wireless headphones with 30-hour battery life."
      },
      {
        name: "Apple Watch Ultra 2",
        price: 79999,
        image: "https://m.media-amazon.com/images/I/81V3wgQBeuL._SX679_.jpg",
        description: "Apple Watch Series 9 with Always-On Retina display."
      }
    ];

    await Product.insertMany(defaultProducts);
    console.log("✅ Default products added to DB");
  }
}

seedProducts();

// --------------------
// Start Server
// --------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

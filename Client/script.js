// ===================
// script.js - Full updated file with Product Detail Page logic
// ===================

const API_BASE = "http://localhost:5000/api";
let currentUser = JSON.parse(localStorage.getItem("user")) || null;
let cart = [];
let pendingPaymentMethod = null;

// -------------------
// Toast Notification Helper
// -------------------
const toastEl = document.getElementById('liveToast');
const toast = new bootstrap.Toast(toastEl);

function showToast(message, title = 'Notification', type = 'success') {
  const toastBody = document.getElementById('toast-body');
  const toastTitle = document.getElementById('toast-title');

  const toastHeader = toastEl.querySelector('.toast-header');
  toastHeader.className = 'toast-header';
  toastHeader.classList.add(`text-bg-${type}`);

  toastTitle.textContent = title;
  toastBody.textContent = message;
  toast.show();
}

// -------------------
// Navigation helper
// -------------------
function navigateTo(pageId) {
  document.querySelectorAll(".page-section").forEach(sec =>
    sec.classList.remove("active")
  );
  const el = document.getElementById(pageId);
  if (el) el.classList.add("active");
}

// -------------------
// Page link wiring
// -------------------
document.querySelectorAll("[data-page]").forEach(link => {
  link.addEventListener("click", e => {
    e.preventDefault();
    const page = link.getAttribute("data-page");

    if (page === "account-page" && !currentUser) {
      new bootstrap.Modal(document.getElementById("loginModal")).show();
      return;
    }

    if (page === "products-page") loadProducts();
    if (page === "orders-page") loadOrders();
    if (page === "admin-dashboard-page") {
      if (!currentUser || currentUser.role !== "admin") {
        showToast("Admin access only!", "Access Denied", "danger");
        return;
      }
      loadAdminProducts();
      loadAdminOrders();
      loadAdminUsers();
    }

    navigateTo(page);
  });
});

// Go-to-products button (home)
document.getElementById("go-to-products-btn")?.addEventListener("click", e => {
  e.preventDefault();
  loadProducts();
  navigateTo("products-page");
});
// Ensure the new hero button works
document.getElementById("go-to-products-btn-hero")?.addEventListener("click", e => {
  e.preventDefault();
  loadProducts();
  navigateTo("products-page");
});

// -------------------
// Cart modal open
// -------------------
document.getElementById("cart-btn")?.addEventListener("click", () => {
  renderCart();
  new bootstrap.Modal(document.getElementById("cartModal")).show();
});

// -------------------
// Render cart
// -------------------
function renderCart() {
  const list = document.getElementById("cart-items");
  const totalEl = document.getElementById("cart-total");
  list.innerHTML = "";

  if (!cart || cart.length === 0) {
    list.innerHTML = `<li class="list-group-item text-center text-muted">Your cart is empty.</li>`;
    totalEl.textContent = "₹0.00";
    document.getElementById("cart-count").textContent = 0;
    return;
  }

  let total = 0;
  cart.forEach((item, i) => {
    total += Number(item.price || 0);
    const li = document.createElement("li");
    li.className = "list-group-item d-flex align-items-center justify-content-between";
    li.innerHTML = `
      <div class="d-flex align-items-center">
        <img src="${item.image || 'https://via.placeholder.com/64'}" alt="${item.name}" class="me-3 rounded" style="width: 64px; height: 64px; object-fit: cover;">
        <div>
          <div class="fw-bold">${item.name}</div>
          <div class="text-muted">₹${Number(item.price).toFixed(2)}</div>
        </div>
      </div>
      <button class="btn btn-sm btn-danger remove-from-cart" data-index="${i}">Remove</button>`;
    list.appendChild(li);
  });

  totalEl.textContent = `₹${total.toFixed(2)}`;
  document.getElementById("cart-count").textContent = cart.length;
}

// -------------------
// Global click handlers (delegation)
// -------------------
document.addEventListener("click", async e => {
  const target = e.target;

  // Add to cart from product list
  if (target.classList.contains("add-to-cart")) {
    const card = target.closest(".card");
    cart.push({
      id: target.dataset.id,
      name: card.querySelector(".card-title")?.textContent.trim(),
      price: parseFloat((card.querySelector(".fw-bold")?.textContent || "").replace(/[^\d.]/g, "")),
      image: target.dataset.image
    });
    renderCart();
    showToast(`${card.querySelector(".card-title")?.textContent.trim()} added to cart!`, "Cart Updated", "success");
    return;
  }

  // Add to cart from product detail page
  if (target.id === 'add-to-cart-detail-btn') {
      const btn = target;
      const quantity = parseInt(document.getElementById('quantity-input').value, 10);
      for (let i = 0; i < quantity; i++) {
          cart.push({
              id: btn.dataset.id,
              name: btn.dataset.name,
              price: parseFloat(btn.dataset.price),
              image: btn.dataset.image
          });
      }
      renderCart();
      showToast(`${quantity} x ${btn.dataset.name} added to cart!`, 'Cart Updated', 'success');
  }

  // Open product detail page
  const productCard = target.closest('.product-card');
  if (productCard && !target.classList.contains('add-to-cart')) {
      const productId = productCard.dataset.productId;
      if (productId) {
          showProductDetail(productId);
      }
  }

  // Remove from cart
  if (target.classList.contains("remove-from-cart")) {
    const idx = Number(target.dataset.index);
    if (!isNaN(idx)) {
      cart.splice(idx, 1);
      renderCart();
    }
    return;
  }

  // Delete product (admin)
  if (target.classList.contains("delete-product")) {
    if (confirm("Delete this product?")) {
      await fetch(`${API_BASE}/products/${target.dataset.id}`, { method: "DELETE" });
      showToast("Product deleted.", "Admin Action", "info");
      loadAdminProducts();
    }
    return;
  }

  // Delete user (admin)
  if (target.classList.contains("delete-user")) {
    if (confirm(`Delete user ${target.dataset.email}?`)) {
      const res = await fetch(`${API_BASE}/admin/users`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: target.dataset.email })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`User ${data.email} deleted.`, "Admin Action", "info");
        loadAdminUsers();
      } else {
        showToast(data.message || "Failed to delete user.", "Error", "danger");
      }
    }
    return;
  }
});


// -------------------
// Product Detail Page Logic
// -------------------
async function showProductDetail(productId) {
  try {
    const res = await fetch(`${API_BASE}/products/${productId}`);
    if (!res.ok) throw new Error('Product not found');
    
    const product = await res.json();

    document.getElementById('product-detail-image').src = product.image || 'https://via.placeholder.com/600';
    document.getElementById('product-detail-title').textContent = product.name;
    document.getElementById('product-detail-price').textContent = `₹${Number(product.price).toFixed(2)}`;
    document.getElementById('product-detail-description').textContent = product.description || 'No description available.';

    const addToCartBtn = document.getElementById('add-to-cart-detail-btn');
    addToCartBtn.dataset.id = product._id;
    addToCartBtn.dataset.name = product.name;
    addToCartBtn.dataset.price = product.price;
    addToCartBtn.dataset.image = product.image;

    document.getElementById('quantity-input').value = 1;
    navigateTo('product-detail-page');

  } catch (err) {
    console.error('Failed to load product details:', err);
    showToast('Could not load product details.', 'Error', 'danger');
  }
}

// Quantity and Back Button handlers
document.getElementById('quantity-plus')?.addEventListener('click', () => {
    const input = document.getElementById('quantity-input');
    input.value = parseInt(input.value, 10) + 1;
});
document.getElementById('quantity-minus')?.addEventListener('click', () => {
    const input = document.getElementById('quantity-input');
    let currentValue = parseInt(input.value, 10);
    if (currentValue > 1) input.value = currentValue - 1;
});
document.getElementById('back-to-products-btn')?.addEventListener('click', () => navigateTo('products-page'));


// -------------------
// Cart -> Order Summary
// -------------------
document.getElementById("view-order-summary-btn")?.addEventListener("click", () => {
  if (cart.length === 0) return showToast("Your cart is empty!", "Notice", "warning");

  const itemsList = document.getElementById("order-summary-items");
  itemsList.innerHTML = "";
  let total = 0;
  cart.forEach(item => {
    total += Number(item.price || 0);
    const li = document.createElement("li");
    li.className = "list-group-item d-flex align-items-center justify-content-between";
    li.innerHTML = `
      <div class="d-flex align-items-center">
        <img src="${item.image || 'https://via.placeholder.com/56'}" alt="${item.name}" class="me-3 rounded" style="width: 56px; height: 56px; object-fit: cover;">
        <div class="fw-bold">${item.name}</div>
      </div>
      <span>₹${Number(item.price).toFixed(2)}</span>`;
    itemsList.appendChild(li);
  });

  document.getElementById("summary-total").textContent = `₹${total.toFixed(2)}`;
  navigateTo("order-summary-page");
});
document.getElementById("cancel-summary-btn")?.addEventListener("click", () => navigateTo("products-page"));
document.getElementById("proceed-to-checkout-btn")?.addEventListener("click", () => {
  if (!currentUser) return showToast("Please login first to proceed.", "Login Required", "warning");
  if (cart.length === 0) return showToast("Your cart is empty!", "Notice", "warning");
  navigateTo("payment-page");
});


// -------------------
// Order Confirmation & Payment
// -------------------
document.getElementById("edit-address-btn")?.addEventListener("click", () => {
  bootstrap.Modal.getInstance(document.getElementById("orderConfirmationModal"))?.hide();
  navigateTo("account-page");
});
document.getElementById("cod-btn")?.addEventListener("click", () => {
  if (!currentUser) return showToast("Please login first.", "Login Required", "warning");
  if (cart.length === 0) return showToast("Your cart is empty!", "Notice", "warning");

  document.getElementById("confirmation-name").textContent = currentUser.email.split("@")[0] || "Name not set";
  document.getElementById("confirmation-phone").textContent = `Phone: ${currentUser.phone || "Not provided"}`;
  document.getElementById("confirmation-address").textContent = `Address: ${currentUser.address || "Not provided"}`;
  pendingPaymentMethod = "COD";
  new bootstrap.Modal(document.getElementById("orderConfirmationModal")).show();
});
document.getElementById("back-to-summary-btn")?.addEventListener("click", () => navigateTo("order-summary-page"));
document.getElementById("confirm-order-btn")?.addEventListener("click", async () => {
  if (!currentUser) return showToast("Login required.", "Error", "danger");
  if (cart.length === 0) return showToast("Your cart is empty!", "Error", "danger");

  const payload = {
    userId: currentUser._id,
    items: cart,
    total: cart.reduce((sum, item) => sum + Number(item.price || 0), 0),
    address: currentUser.address || "No address provided",
    paymentMethod: pendingPaymentMethod || "COD"
  };

  try {
    const res = await fetch(`${API_BASE}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      showToast("Your order has been placed successfully!", "Order Confirmed", "success");
      cart = [];
      renderCart();
      bootstrap.Modal.getInstance(document.getElementById("orderConfirmationModal"))?.hide();
      pendingPaymentMethod = null;
      navigateTo("orders-page");
      loadOrders();
    } else {
      const data = await res.json();
      showToast(data.message || "An unknown error occurred.", "Order Failed", "danger");
    }
  } catch (err) {
    showToast("Could not connect to the server to place order.", "Network Error", "danger");
  }
});


// -------------------
// AUTH: Register / Login / Logout
// -------------------
document.getElementById("register-form")?.addEventListener("submit", async e => {
  e.preventDefault();
  const payload = {
    email: document.getElementById("reg-email").value,
    password: document.getElementById("reg-password").value,
    phone: document.getElementById("reg-phone").value,
    address: document.getElementById("reg-address").value
  };
  try {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (res.ok) {
      showToast("Registered successfully! Please login.", "Success", "success");
      bootstrap.Modal.getInstance(document.getElementById("registerModal"))?.hide();
      new bootstrap.Modal(document.getElementById("loginModal")).show();
    } else {
      showToast(data.message || "Registration failed.", "Error", "danger");
    }
  } catch (err) { showToast("Could not connect to the server.", "Network Error", "danger"); }
});
document.getElementById("login-form")?.addEventListener("submit", async e => {
  e.preventDefault();
  const payload = { email: document.getElementById("login-email").value, password: document.getElementById("login-password").value };
  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (res.ok) {
      currentUser = data;
      localStorage.setItem("user", JSON.stringify(currentUser));
      showToast(`Welcome back, ${currentUser.email}!`, "Login Successful", "success");
      bootstrap.Modal.getInstance(document.getElementById("loginModal"))?.hide();
      updateUI();
      navigateTo("home-page");
    } else {
      showToast(data.message || "Invalid credentials.", "Login Failed", "danger");
    }
  } catch (err) { showToast("Could not connect to the server.", "Network Error", "danger"); }
});
document.getElementById("logout-btn")?.addEventListener("click", () => {
  currentUser = null;
  localStorage.removeItem("user");
  updateUI();
  navigateTo("home-page");
  showToast("You have been logged out.", "Goodbye!", "info");
});


// -------------------
// UI Update (account/admin links)
// -------------------
function updateUI() {
  const elMyOrders = document.getElementById("my-orders-link");
  const elAdmin = document.getElementById("admin-link");
  if (!currentUser) {
    elMyOrders?.classList.add("d-none");
    elAdmin?.classList.add("d-none");
    return;
  }
  elMyOrders?.classList.remove("d-none");
  if (currentUser.role === "admin") {
    elAdmin?.classList.remove("d-none");
  } else {
    elAdmin?.classList.add("d-none");
  }
  document.getElementById("account-name").value = currentUser.email.split("@")[0];
  document.getElementById("account-email").value = currentUser.email;
  document.getElementById("account-phone").value = currentUser.phone || "";
  document.getElementById("account-address").value = currentUser.address || "";
}


// -------------------
// PRODUCTS: load & render
// -------------------
async function loadProducts() {
  try {
    const res = await fetch(`${API_BASE}/products`);
    const products = await res.json();
    const container = document.getElementById("product-container");
    container.innerHTML = "";
    products.forEach(p => {
      const cardCol = document.createElement("div");
      cardCol.className = "col-lg-3 col-md-4 col-sm-6";
      cardCol.innerHTML = `
        <div class="card h-100 product-card" data-product-id="${p._id}" style="cursor: pointer;">
          <div class="product-image-container">
            <img src="${p.image || 'https://via.placeholder.com/300'}" class="card-img-top" alt="${p.name}">
          </div>
          <div class="card-body d-flex flex-column">
            <h5 class="card-title">${p.name}</h5>
            <p class="card-text small text-muted flex-grow-1">${(p.description || '').substring(0, 60)}...</p>
            <p class="fw-bold fs-5 my-2">₹${p.price}</p>
            <button class="btn btn-primary add-to-cart mt-auto" data-id="${p._id}" data-image="${p.image || ''}">Add to Cart</button>
          </div>
        </div>`;
      container.appendChild(cardCol);
    });
  } catch (err) { console.error("Failed to load products", err); }
}

async function loadFeaturedProducts() {
  try {
    const res = await fetch(`${API_BASE}/products`);
    const products = await res.json();
    const container = document.getElementById("featured-products-container");
    if (!container) return;
    
    container.innerHTML = "";
    const featured = products.slice(0, 4);
    if (featured.length === 0) {
        container.innerHTML = `<p class="text-center text-muted">Featured products will be shown here soon!</p>`;
        return;
    }

    featured.forEach(p => {
      const cardCol = document.createElement("div");
      cardCol.className = "col-lg-3 col-md-4 col-sm-6";
      cardCol.innerHTML = `
        <div class="card h-100 product-card" data-product-id="${p._id}" style="cursor: pointer;">
          <div class="product-image-container">
            <img src="${p.image || 'https://via.placeholder.com/300'}" class="card-img-top" alt="${p.name}">
          </div>
          <div class="card-body d-flex flex-column">
            <h5 class="card-title">${p.name}</h5>
            <p class="card-text small text-muted flex-grow-1">${(p.description || '').substring(0, 60)}...</p>
            <p class="fw-bold fs-5 my-2">₹${p.price}</p>
            <button class="btn btn-primary add-to-cart mt-auto" data-id="${p._id}" data-image="${p.image || ''}">Add to Cart</button>
          </div>
        </div>`;
      container.appendChild(cardCol);
    });
  } catch (err) {
    console.error("Failed to load featured products", err);
    document.getElementById("featured-products-container").innerHTML = `<p class="text-center text-danger">Could not load products.</p>`;
  }
}

// -------------------
// ORDERS (user)
// ------------------
async function loadOrders() {
  if (!currentUser) return;
  try {
    const res = await fetch(`${API_BASE}/orders/${currentUser._id}`);
    const orders = await res.json();
    const list = document.getElementById("orders-list");
    list.innerHTML = "";
    if (!orders || orders.length === 0) {
      list.innerHTML = `<div class="text-center text-muted p-5">You haven't placed any orders yet.</div>`;
      return;
    }
    orders.forEach(o => {
      const item = document.createElement("div");
      item.className = "list-group-item";
      item.innerHTML = `
        <div class="d-flex w-100 justify-content-between">
          <h5 class="mb-1">Order ID: ${o._id}</h5>
          <small>${new Date(o.createdAt).toLocaleDateString()}</small>
        </div>
        <p class="mb-1">Total: <strong>₹${o.total}</strong> | Status: <span class="badge bg-info">${o.status}</span></p>
        <small>Payment Method: ${o.paymentMethod}</small>`;
      list.appendChild(item);
    });
  } catch (err) { console.error("Failed to load orders", err); }
}


// -------------------
// ADMIN: products, orders, users
// -------------------
async function loadAdminProducts() {
  try {
    const res = await fetch(`${API_BASE}/products`);
    const products = await res.json();
    const list = document.getElementById("admin-product-list");
    list.innerHTML = "";
    products.forEach(p => {
      const li = document.createElement("li");
      li.className = "list-group-item d-flex justify-content-between align-items-center";
      li.innerHTML = `<span>${p.name} - ₹${p.price}</span> <button class="btn btn-sm btn-danger delete-product" data-id="${p._id}">Delete</button>`;
      list.appendChild(li);
    });
  } catch (err) { console.error(err); }
}
async function loadAdminOrders() {
  try {
    const res = await fetch(`${API_BASE}/admin/orders`);
    const orders = await res.json();
    const list = document.getElementById("admin-orders-list");
    list.innerHTML = "";
    if (!orders || orders.length === 0) {
      list.innerHTML = `<p class="text-muted text-center">No orders yet.</p>`;
      return;
    }
    orders.forEach(o => {
      const div = document.createElement("div");
      div.className = "border p-2 mb-2 rounded";
      div.textContent = `User: ${o.userId} | Total: ₹${o.total} | Status: ${o.status}`;
      list.appendChild(div);
    });
  } catch (err) { console.error(err); }
}
async function loadAdminUsers() {
  try {
    const res = await fetch(`${API_BASE}/admin/users`);
    const users = await res.json();
    const list = document.getElementById("admin-customers-list");
    list.innerHTML = "";
    users.forEach(u => {
      const li = document.createElement("li");
      li.className = "list-group-item d-flex justify-content-between align-items-center";
      li.innerHTML = `<span>${u.email} (${u.role})</span> <button class="btn btn-sm btn-danger delete-user" data-email="${u.email}">Delete</button>`;
      list.appendChild(li);
    });
  } catch (err) { console.error(err); }
}


// -------------------
// ADMIN: add product form
// -------------------
document.getElementById("add-product-form")?.addEventListener("submit", async e => {
  e.preventDefault();
  const payload = {
    name: document.getElementById("product-name").value,
    price: document.getElementById("product-price").value,
    image: document.getElementById("product-image").value,
    description: document.getElementById("product-description").value
  };
  try {
    const res = await fetch(`${API_BASE}/products`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
    });
    if (res.ok) {
      showToast("Product added successfully!", "Success", "success");
      loadAdminProducts();
      e.target.reset();
    } else {
      showToast("Failed to add product.", "Error", "danger");
    }
  } catch (err) { showToast("Could not connect to the server.", "Network Error", "danger"); }
});


// -------------------
// ACCOUNT edit/save (simplified)
// -------------------
document.getElementById("edit-account-btn")?.addEventListener("click", async () => {
  const form = document.getElementById("account-info-form");
  const fields = form.querySelectorAll("input, textarea");
  const btn = document.getElementById("edit-account-btn");
  const isEditing = btn.textContent === 'Save';

  if(isEditing) {
    const updatedUser = {
      name: document.getElementById("account-name").value,
      email: document.getElementById("account-email").value,
      phone: document.getElementById("account-phone").value,
      address: document.getElementById("account-address").value
    };
    try {
      const res = await fetch(`${API_BASE}/users/${currentUser._id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updatedUser)
      });
      if (res.ok) {
        currentUser = await res.json();
        localStorage.setItem("user", JSON.stringify(currentUser));
        showToast("Account updated successfully!", "Success", "success");
      } else {
        const data = await res.json();
        showToast(data.message || "Update failed", "Error", "danger");
      }
    } catch(err) { showToast("Error updating account.", "Network Error", "danger"); }
  }
  
  fields.forEach(field => field.disabled = isEditing);
  btn.textContent = isEditing ? 'Edit' : 'Save';
  btn.classList.toggle('btn-primary', isEditing);
  btn.classList.toggle('btn-success', !isEditing);
});


// -------------------
// Modal switches (login/register)
// -------------------
document.getElementById("show-login-link")?.addEventListener("click", e => {
  e.preventDefault();
  bootstrap.Modal.getInstance(document.getElementById("registerModal"))?.hide();
  new bootstrap.Modal(document.getElementById("loginModal")).show();
});
document.getElementById("show-register-link")?.addEventListener("click", e => {
  e.preventDefault();
  bootstrap.Modal.getInstance(document.getElementById("loginModal"))?.hide();
  new bootstrap.Modal(document.getElementById("registerModal")).show();
});


// -------------------
// Init
// -------------------
document.addEventListener('DOMContentLoaded', () => {
    updateUI();
    loadProducts();
    loadFeaturedProducts();
});
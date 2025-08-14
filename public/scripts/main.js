import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBa7_mkNVlIHQgWYytgXy0sLqkfuS-rVK4",
  authDomain: "rajukart-ae5ca.firebaseapp.com",
  projectId: "rajukart-ae5ca",
  storageBucket: "rajukart-ae5ca.firebasestorage.app",
  messagingSenderId: "570218176052",
  appId: "1:570218176052:web:ea421005352249c160b461",
  measurementId: "G-PGTT4FEZEJ"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const state = {
  cart: [],
  wishlist: [],
  products: {
    electronics: [
      {name: 'Samsung Galaxy S24', price: 79999},
      {name: 'iPhone 15', price: 89999},
      {name: 'OnePlus 12', price: 64999}
    ],
    clothing: [
      {name: 'Nike Dri-FIT T-Shirt', price: 1495},
      {name: 'Adidas Originals Tee', price: 1299}
    ]
  },
  currentCat: 'all'
};

const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

function allProducts() {
  return Object.values(state.products).flat();
}
function filtered() {
  return state.currentCat === 'all' ? allProducts() : (state.products[state.currentCat] || []);
}

function renderProducts() {
  const grid = $('#productsGrid');
  grid.innerHTML = '';
  filtered().forEach(p => {
    const div = document.createElement('div');
    div.className = 'product-card';
    div.innerHTML = `
      <h3>${p.name}</h3>
      <p>₹${p.price}</p>
      <button>Add to Cart</button>
    `;
    div.querySelector('button').onclick = () => alert('Add to cart placeholder');
    grid.appendChild(div);
  });
}

$$('.category-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    $$('.category-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.currentCat = btn.dataset.cat;
    renderProducts();
  });
});

onAuthStateChanged(auth, user => {
  $('#userInfo').textContent = user ? `uid:${user.uid.slice(0,6)}…` : 'Not signed in';
});
signInAnonymously(auth);

$('#logoutBtn').addEventListener('click', () => signOut(auth));

renderProducts();

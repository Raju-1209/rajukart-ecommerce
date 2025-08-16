// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { getFirestore, collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js"; // Import Firestore functions

// Your web app's Firebase configuration
// IMPORTANT: REPLACE WITH YOUR ACTUAL VALUES from Firebase Console -> Project Settings -> Your Apps (Web App)
const firebaseConfig = {
  apiKey: "AIzaSyBa7_mkNVlIHQgWYytgXy0sLqkfuS-rVK4", // Make sure this is your actual key
  authDomain: "rajukart-ae5ca.firebaseapp.com",
  projectId: "rajukart-ae5ca", // This should already be correct
  storageBucket: "rajukart-ae5ca.firebasestorage.app",
  messagingSenderId: "570218176052",
  appId: "1:570218176052:web:ea421005352249c160b461",
  measurementId: "G-PGTT4FEZEJ" // If you have Analytics enabled
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app); // Get the Authentication service instance
const db = getFirestore(app); // Get the Firestore service instance

const userStatusDiv = document.getElementById('user-status');
const allProductListDiv = document.getElementById('all-product-list');
const featuredProductListDiv = document.getElementById('featured-product-list');
const categoriesNav = document.querySelector('.categories-nav');

// --- Basic User Presence with Anonymous Authentication ---
onAuthStateChanged(auth, (user) => {
  if (user) {
    const uid = user.uid;
    console.log("User is signed in. UID:", uid);
    if (userStatusDiv) {
      userStatusDiv.textContent = `User is signed in. UID: ${uid} (Anonymous)`;
    }
  } else {
    console.log("User is signed out.");
    if (userStatusDiv) {
      userStatusDiv.textContent = `User is signed out.`;
    }
  }
});

signInAnonymously(auth)
  .then(() => {
    console.log("Successfully signed in anonymously.");
    // Once signed in (and rules are fixed), attempt to load products
    // Note: Product loading will fail until Firestore Security Rules allow 'read: true'
    // for the 'products' collection.
    // fetchAndDisplayProducts(); 
  })
  .catch((error) => {
    const errorCode = error.code;
    const errorMessage = error.message;
    console.error("Anonymous sign-in failed:", errorCode, errorMessage);
    if (userStatusDiv) {
      userStatusDiv.textContent = `Error signing in: ${errorMessage}`;
    }
  });


// --- Product Display Logic (Will work when Firestore rules are fixed) ---

// Helper function to create a product card HTML
function createProductCard(product) {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.innerHTML = `
        <img src="${product.imageUrl}" alt="${product.name}">
        <h3>${product.name}</h3>
        <p class="price">$${product.price.toFixed(2)}</p>
        <button>Add to Cart</button>
    `;
    return card;
}

// Function to fetch and display products
async function fetchAndDisplayProducts(category = 'all') {
    if (!allProductListDiv || !featuredProductListDiv) return; // Exit if containers not found

    allProductListDiv.innerHTML = 'Loading products...'; // Clear and show loading
    featuredProductListDiv.innerHTML = 'Loading featured products...';

    try {
        const productsCol = collection(db, 'products');
        let q;

        if (category === 'all') {
            q = productsCol; // No filter, get all
        } else {
            q = query(productsCol, where('category', '==', category)); // Filter by category
        }

        const productSnapshot = await getDocs(q);
        const products = productSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        allProductListDiv.innerHTML = ''; // Clear loading message
        featuredProductListDiv.innerHTML = '';

        if (products.length === 0) {
            allProductListDiv.innerHTML = `<p>No products found in ${category === 'all' ? 'any category' : category}.</p>`;
            featuredProductListDiv.innerHTML = `<p>No featured products available.</p>`;
            return;
        }

        // Display all products
        products.forEach(product => {
            allProductListDiv.appendChild(createProductCard(product));
        });

        // Display 5 featured products (for now, just take the first 5 or fewer if not enough)
        products.slice(0, 5).forEach(product => {
            featuredProductListDiv.appendChild(createProductCard(product));
        });

        console.log(`Displayed ${products.length} products.`);

    } catch (error) {
        console.error("Error fetching products:", error);
        allProductListDiv.innerHTML = '<p>Error loading products. Please check console.</p>';
        featuredProductListDiv.innerHTML = '<p>Error loading featured products.</p>';
        // This is where you'll see "permission denied" until rules are fixed.
    }
}

// Event listener for category navigation
categoriesNav.addEventListener('click', (event) => {
    event.preventDefault(); // Prevent default link behavior
    const target = event.target;
    if (target.tagName === 'A' && target.hasAttribute('data-category')) {
        // Remove active class from previous category
        categoriesNav.querySelectorAll('a').forEach(link => {
            link.classList.remove('active-category');
        });
        // Add active class to clicked category
        target.classList.add('active-category');
        
        const selectedCategory = target.getAttribute('data-category');
        console.log(`Category selected: ${selectedCategory}`);
        // This is where you would re-fetch and display products for the selected category
        // For now, we'll just log. Once rules are fixed, uncomment:
        // fetchAndDisplayProducts(selectedCategory);
    }
});

// --- Offer Advertisement Carousel Logic ---
const carouselTrack = document.getElementById('carousel-track');
const carouselIndicatorsContainer = document.getElementById('carousel-indicators');

const offerImages = [
    'https://via.placeholder.com/1200x300?text=Grand+Summer+Sale',
    'https://via.placeholder.com/1200x300?text=New+Arrivals+Alert',
    'https://via.placeholder.com/1200x300?text=Limited-Time+Offer',
    'https://via.placeholder.com/1200x300?text=Free+Shipping+on+All+Orders'
];

let currentIndex = 0;
let carouselInterval;

function createCarouselElements() {
    carouselTrack.innerHTML = '';
    carouselIndicatorsContainer.innerHTML = '';
    offerImages.forEach((src, index) => {
        const img = document.createElement('img');
        img.src = src;
        img.alt = `Offer ${index + 1}`;
        carouselTrack.appendChild(img);

        const indicator = document.createElement('div');
        indicator.className = 'indicator';
        indicator.addEventListener('click', () => goToSlide(index));
        carouselIndicatorsContainer.appendChild(indicator);
    });
    updateCarousel();
}

function updateCarousel() {
    carouselTrack.style.transform = `translateX(-${currentIndex * 100}%)`;
    carouselIndicatorsContainer.querySelectorAll('.indicator').forEach((indicator, index) => {
        if (index === currentIndex) {
            indicator.classList.add('active');
        } else {
            indicator.classList.remove('active');
        }
    });
}

function nextSlide() {
    currentIndex = (currentIndex + 1) % offerImages.length;
    updateCarousel();
}

function goToSlide(index) {
    currentIndex = index;
    updateCarousel();
    clearInterval(carouselInterval); // Reset interval on manual navigation
    carouselInterval = setInterval(nextSlide, 3000); // Restart interval
}

// Start carousel on page load
document.addEventListener('DOMContentLoaded', () => {
    createCarouselElements();
    carouselInterval = setInterval(nextSlide, 3000); // Change image every 3 seconds

    // Initially select 'All Products' category
    const allProductsLink = categoriesNav.querySelector('[data-category="all"]');
    if (allProductsLink) {
        allProductsLink.classList.add('active-category');
    }
    
    // Attempt to fetch and display products immediately (will fail if rules not fixed)
    fetchAndDisplayProducts(); 
});

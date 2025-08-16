// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { getFirestore, collection, getDocs, query, where, doc, runTransaction, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js"; // Import Firestore functions

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

// UI Elements
const userStatusDiv = document.getElementById('user-status');
const allProductListDiv = document.getElementById('all-product-list');
const featuredProductListDiv = document.getElementById('featured-product-list');
const categoriesNav = document.querySelector('.categories-nav');
const profileText = document.getElementById('profile-text'); // For updating profile name
const authModal = document.getElementById('auth-modal');
const loginButton = document.getElementById('login-button');
const signupButton = document.getElementById('signup-button');
const guestButton = document.getElementById('guest-button');

// --- Authentication Flow ---

// Function to generate a sequential Guest ID
async function getNextGuestId(uid) {
    const counterRef = doc(db, 'settings', 'guestCounter'); // Document to hold the counter
    const userDocRef = doc(db, 'users', uid); // User's document in 'users' collection

    try {
        let guestId = '';
        await runTransaction(db, async (transaction) => {
            const counterDoc = await transaction.get(counterRef);
            if (!counterDoc.exists) {
                // Initialize counter if it doesn't exist
                transaction.set(counterRef, { count: 0 });
            }
            
            const currentCount = counterDoc.data()?.count || 0;
            const newCount = currentCount + 1;
            
            // Format as Guest000001, Guest000002, etc.
            guestId = `Guest${String(newCount).padStart(6, '0')}`;
            
            // Update counter and create user document
            transaction.update(counterRef, { count: newCount });
            transaction.set(userDocRef, {
                uid: uid,
                guestId: guestId,
                isGuest: true,
                createdAt: serverTimestamp(),
                lastLoginAt: serverTimestamp()
            });
        });
        console.log(`Generated and saved new guest ID: ${guestId}`);
        return guestId;
    } catch (e) {
        console.error("Error generating guest ID via transaction:", e);
        // Fallback if transaction fails (e.g., rules prevent it)
        // This will create a non-sequential but unique ID for this session if Firestore fails
        return `Guest-${uid.substring(0, 6)}`;
    }
}

// Handler for anonymous sign-in
async function handleGuestSignIn() {
    try {
        const userCredential = await signInAnonymously(auth);
        const user = userCredential.user;
        let guestId = localStorage.getItem('localGuestId'); // Check local storage first

        if (!guestId) {
            // Fetch/generate guestId from Firestore only if not in local storage
            const userDocRef = doc(db, 'users', user.uid);
            const userDoc = await getDocs(query(collection(db, 'users'), where('uid', '==', user.uid)));

            if (userDoc.empty) {
                // New anonymous user, generate and save guest ID
                guestId = await getNextGuestId(user.uid);
            } else {
                // Existing anonymous user (re-visiting), retrieve their guest ID
                guestId = userDoc.docs[0].data().guestId;
                // Update last login
                await setDoc(userDocRef, { lastLoginAt: serverTimestamp() }, { merge: true });
            }
            localStorage.setItem('localGuestId', guestId); // Store in local storage for future visits
        }

        authModal.style.display = 'none'; // Hide modal
        profileText.textContent = guestId; // Update profile text
        console.log(`Signed in as guest: ${guestId} (UID: ${user.uid})`);

    } catch (error) {
        console.error("Anonymous sign-in failed:", error);
        userStatusDiv.textContent = `Error signing in as guest: ${error.message}`;
    }
}

// Listen to auth state changes
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // User is signed in (could be anonymous or permanent)
        let displayId = user.uid; // Default display
        if (user.isAnonymous) {
            // If anonymous, try to get the Guest ID from local storage or Firestore
            let localGuestId = localStorage.getItem('localGuestId');
            if (localGuestId) {
                displayId = localGuestId;
            } else {
                // This scenario means anonymous user is logged in, but we lost localGuestId.
                // Re-fetch from Firestore using UID, or regenerate if somehow not found (shouldn't happen)
                const userDoc = await getDocs(query(collection(db, 'users'), where('uid', '==', user.uid)));
                if (!userDoc.empty) {
                    displayId = userDoc.docs[0].data().guestId;
                    localStorage.setItem('localGuestId', displayId);
                } else {
                    // Fallback if somehow guest ID not found in Firestore either (should be rare)
                    displayId = `Guest-${user.uid.substring(0, 6)}`;
                    localStorage.setItem('localGuestId', displayId);
                }
            }
            userStatusDiv.textContent = `Welcome, ${displayId}! (Guest)`;
        } else {
            // Permanent user
            userStatusDiv.textContent = `Welcome, ${user.displayName || user.email}!`;
        }
        profileText.textContent = displayId; // Update header profile text
        authModal.style.display = 'none'; // Hide modal if logged in

    } else {
        // User is signed out (or not yet signed in)
        userStatusDiv.textContent = `You are signed out.`;
        profileText.textContent = 'Profile'; // Reset header profile text
        localStorage.removeItem('localGuestId'); // Clear guest ID on sign out
        authModal.style.display = 'flex'; // Show modal
    }
});

// Event Listeners for Modal Buttons
guestButton.addEventListener('click', handleGuestSignIn);
loginButton.addEventListener('click', () => {
    alert('Login functionality coming soon!'); // Placeholder for now
    // TODO: Implement actual login form
});
signupButton.addEventListener('click', () => {
    alert('Sign Up functionality coming soon!'); // Placeholder for now
    // TODO: Implement actual signup form
});
// Sign Out link (inside profile dropdown)
const signoutLink = document.getElementById('signout-link');
if (signoutLink) {
    signoutLink.addEventListener('click', async (e) => {
        e.preventDefault();
        try {
            await auth.signOut();
            console.log('User signed out.');
            // onAuthStateChanged will handle UI update
        } catch (error) {
            console.error('Error signing out:', error);
        }
    });
}


// --- Product Display Logic (Will work when Firestore rules are fixed) ---
// (No changes to this section from previous main.js)
// ... (Keep existing fetchAndDisplayProducts, createProductCard functions) ...
// ... (Keep carousel logic) ...

// Helper function to create a product card HTML (from previous main.js)
function createProductCard(product) {
    const card = document.createElement('div');
    card.className = 'product-card';
    // Add data attributes to buttons for future use, e.g., guest user checks
    card.innerHTML = `
        <img src="${product.imageUrl}" alt="${product.name}">
        <h3>${product.name}</h3>
        <p class="price">$${product.price ? product.price.toFixed(2) : 'N/A'}</p>
        <button class="add-to-cart-btn" data-product-id="${product.product_id}" data-action="add-to-cart">Add to Cart</button>
        <button class="wishlist-btn" data-product-id="${product.product_id}" data-action="add-to-wishlist">&#x2764;</button>
    `;
    return card;
}

// Function to fetch and display products (from previous main.js)
async function fetchAndDisplayProducts(category = 'all') {
    if (!allProductListDiv || !featuredProductListDiv) return;

    allProductListDiv.innerHTML = 'Loading products...';
    featuredProductListDiv.innerHTML = 'Loading featured products...';

    try {
        const productsCol = collection(db, 'products');
        let q;

        if (category === 'all') {
            q = productsCol;
        } else {
            q = query(productsCol, where('category', '==', category));
        }

        const productSnapshot = await getDocs(q);
        const products = productSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        allProductListDiv.innerHTML = '';
        featuredProductListDiv.innerHTML = '';

        if (products.length === 0) {
            allProductListDiv.innerHTML = `<p>No products found in ${category === 'all' ? 'any category' : category}.</p>`;
            featuredProductListDiv.innerHTML = `<p>No featured products available.</p>`;
            return;
        }

        products.forEach(product => {
            allProductListDiv.appendChild(createProductCard(product));
        });

        products.slice(0, 5).forEach(product => {
            featuredProductListDiv.appendChild(createProductCard(product));
        });

        console.log(`Displayed ${products.length} products.`);

    } catch (error) {
        console.error("Error fetching products:", error);
        allProductListDiv.innerHTML = '<p>Error loading products. Please check console.</p>';
        featuredProductListDiv.innerHTML = '<p>Error loading featured products.</p>';
    }
}

// Event listener for category navigation (from previous main.js)
categoriesNav.addEventListener('click', (event) => {
    event.preventDefault();
    const target = event.target;
    if (target.tagName === 'A' && target.hasAttribute('data-category')) {
        categoriesNav.querySelectorAll('a').forEach(link => {
            link.classList.remove('active-category');
        });
        target.classList.add('active-category');
        
        const selectedCategory = target.getAttribute('data-category');
        console.log(`Category selected: ${selectedCategory}`);
        // This will still fail due to rules, but ready when fixed:
        // fetchAndDisplayProducts(selectedCategory);
    }
});

// --- Offer Advertisement Carousel Logic (from previous main.js) ---
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
    clearInterval(carouselInterval);
    carouselInterval = setInterval(nextSlide, 3000);
}

// Start carousel on page load
document.addEventListener('DOMContentLoaded', () => {
    createCarouselElements();
    carouselInterval = setInterval(nextSlide, 3000);

    const allProductsLink = categoriesNav.querySelector('[data-category="all"]');
    if (allProductsLink) {
        allProductsLink.classList.add('active-category');
    }
    
    // fetchAndDisplayProducts will be called by onAuthStateChanged if user is signed in
});

// --- Feature Restriction Logic ---
// This will pop up a modal if a guest user tries to add to cart/wishlist
document.addEventListener('click', (event) => {
    const target = event.target;
    if (target.tagName === 'BUTTON' && (target.classList.contains('add-to-cart-btn') || target.classList.contains('wishlist-btn'))) {
        const user = auth.currentUser;
        if (user && user.isAnonymous) {
            event.preventDefault(); // Stop default button action
            alert('Please Login or Sign Up to add items to your cart or wishlist!');
            // You could show the authModal here instead of an alert
            // authModal.style.display = 'flex';
        } else if (!user) {
            event.preventDefault(); // Stop default button action
            // If user is null, meaning not even anonymous, show the auth modal
            authModal.style.display = 'flex';
        }
    }
});

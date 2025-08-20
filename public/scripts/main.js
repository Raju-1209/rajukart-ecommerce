// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { getFirestore, collection, getDocs, query, where, doc, runTransaction, setDoc, serverTimestamp, getDoc } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

// Your web app's Firebase configuration
// IMPORTANT: REPLACE WITH YOUR ACTUAL VALUES from Firebase Console -> Project Settings -> Your Apps (Web App)
const firebaseConfig = {
  apiKey: "AIzaSyBa7_mkNVlIHQgWYytgXy0sLqkfuS-rVK4",
  authDomain: "rajukart-ae5ca.firebaseapp.com",
  projectId: "rajukart-ae5ca",
  storageBucket: "rajukart-ae5ca.firebasestorage.app",
  messagingSenderId: "570218176052",
  appId: "1:570218176052:web:ea421005352249c160b461",
  measurementId: "G-PGTT4FEZEJ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app); // Get the Authentication service instance
const db = getFirestore(app); // Get the Firestore service instance

// --- UI Elements ---
const userStatusDiv = document.getElementById('user-status');
const allProductListDiv = document.getElementById('all-product-list');
const featuredProductListDiv = document.getElementById('featured-product-list');
const categoriesNav = document.querySelector('.categories-nav');
const profileText = document.getElementById('profile-text'); // For updating profile name

// Modals
const authModal = document.getElementById('authModal'); // The initial welcome modal
const loginModal = document.getElementById('loginModal'); // The login form modal
const signupModal = document.getElementById('signupModal'); // The signup form modal

// Welcome Modal Buttons
const guestButtonWelcome = document.getElementById('guest-button-welcome');
const loginButtonWelcome = document.getElementById('login-button-welcome');
const signupButtonWelcome = document.getElementById('signup-button-welcome');

// Login Form Elements
const loginForm = document.getElementById('login-form');
const loginUsernameEmailInput = document.getElementById('login-username-email');
const loginPasswordInput = document.getElementById('login-password');
const loginErrorDisplay = document.getElementById('login-error');
const closeLoginModalBtn = document.getElementById('close-login-modal');
const showSignupFromLoginBtn = document.getElementById('show-signup-from-login');

// Sign Up Form Elements
const signupForm = document.getElementById('signup-form');
const signupFullnameInput = document.getElementById('signup-fullname');
const signupEmailInput = document.getElementById('signup-email');
const signupUsernameInput = document.getElementById('signup-username');
const signupPasswordInput = document.getElementById('signup-password');
const signupErrorDisplay = document.getElementById('signup-error');
const closeSignupModalBtn = document.getElementById('close-signup-modal');
const showLoginFromSignupBtn = document.getElementById('show-login-from-signup');

// --- Helper Functions for Modal Management ---
function hideAllModals() {
    authModal.classList.add('hidden');
    loginModal.classList.add('hidden');
    signupModal.classList.add('hidden');
}

function showAuthModal() {
    hideAllModals();
    authModal.classList.remove('hidden');
}

function showLoginModal() {
    hideAllModals();
    loginModal.classList.remove('hidden');
}

function showSignupModal() {
    hideAllModals();
    signupModal.classList.remove('hidden');
}

// --- Authentication Flow ---

// Function to generate a sequential Guest ID
async function getNextGuestId(uid) {
    const counterRef = doc(db, 'settings', 'guestCounter');
    const userDocRef = doc(db, 'users', uid);

    try {
        let guestId = '';
        await runTransaction(db, async (transaction) => {
            const counterDoc = await transaction.get(counterRef);
            if (!counterDoc.exists) {
                transaction.set(counterRef, { count: 0 });
            }
            
            const currentCount = counterDoc.data()?.count || 0;
            const newCount = currentCount + 1;
            
            guestId = `Guest${String(newCount).padStart(6, '0')}`;
            
            transaction.update(counterRef, { count: newCount });
            transaction.set(userDocRef, {
                uid: uid,
                guestId: guestId,
                isGuest: true,
                createdAt: serverTimestamp(),
                lastLoginAt: serverTimestamp()
            }, { merge: true });
        });
        console.log(`[Guest Flow] Generated and saved new guest ID: ${guestId}`);
        return guestId;
    } catch (e) {
        console.error("[Guest Flow] Error generating guest ID via transaction:", e);
        return `Guest-${uid.substring(0, 6)}`;
    }
}

// Handle anonymous sign-in
async function handleGuestSignIn() {
    try {
        console.log("[Guest Flow] Attempting anonymous sign-in...");
        const userCredential = await signInAnonymously(auth);
        const user = userCredential.user;
        let guestId = localStorage.getItem('localGuestId');

        if (!guestId) {
            console.log("[Guest Flow] No localGuestId found, checking Firestore...");
            const userDocRef = doc(db, 'users', user.uid);
            const userDocSnap = await getDoc(userDocRef);

            if (!userDocSnap.exists() || !userDocSnap.data().guestId) {
                console.log("[Guest Flow] No guestId in Firestore, generating new one.");
                guestId = await getNextGuestId(user.uid);
            } else {
                console.log("[Guest Flow] GuestId found in Firestore, retrieving.");
                guestId = userDocSnap.data().guestId;
                await setDoc(userDocRef, { lastLoginAt: serverTimestamp() }, { merge: true });
            }
            localStorage.setItem('localGuestId', guestId);
        }

        hideAllModals();
        profileText.textContent = guestId;
        console.log(`[Guest Flow] Signed in as guest: ${guestId} (UID: ${user.uid})`);
        userStatusDiv.textContent = `Welcome, ${guestId}! (Guest)`;
        fetchAndDisplayProducts();

    } catch (error) {
        console.error("[Guest Flow] Anonymous sign-in failed:", error);
        userStatusDiv.textContent = `Error signing in as guest: ${error.message}`;
    }
}

// --- Validation Functions ---
function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.com$/;
    return emailRegex.test(email);
}

function validatePassword(password) {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~]/.test(password);

    return password.length >= minLength && hasUpperCase && hasLowerCase && hasNumber && hasSpecialChar;
}

function validateUsername(username) {
    const hasLetter = /[a-zA-Z]/.test(username);
    const hasNumber = /[0-9]/.test(username);
    return hasLetter && hasNumber && username.length > 0;
}


// --- Sign Up Logic ---
signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    signupErrorDisplay.textContent = '';

    const fullname = signupFullnameInput.value.trim();
    const email = signupEmailInput.value.trim();
    const username = signupUsernameInput.value.trim();
    const password = signupPasswordInput.value;

    if (!fullname || !email || !username || !password) {
        signupErrorDisplay.textContent = 'All fields are required.';
        return;
    }
    if (!validateEmail(email)) {
        signupErrorDisplay.textContent = 'Invalid email format. Must contain "@" and end with ".com"';
        return;
    }
    if (!validateUsername(username)) {
        signupErrorDisplay.textContent = 'Username must contain both letters and numbers.';
        return;
    }
    if (!validatePassword(password)) {
        signupErrorDisplay.textContent = 'Password must be 8+ characters, with at least one uppercase, one lowercase, one number, and one special character.';
        return;
    }

    /*
    // Temporarily commented out: Client-side username uniqueness check (insecure for production)
    try {
        console.log("[Sign Up] Checking username existence...");
        const usernameQuery = query(collection(db, 'users'), where('username', '==', username));
        const usernameSnapshot = await getDocs(usernameQuery);
        if (!usernameSnapshot.empty) {
            signupErrorDisplay.textContent = 'This username is already taken.';
            return;
        }
    } catch (error) {
        console.error("[Sign Up] Error checking username existence:", error);
        signupErrorDisplay.textContent = "Could not check username. Please try again.";
        return;
    }
    */

    try {
        console.log("[Sign Up] Creating user with email and password...");
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        console.log("[Sign Up] Saving additional user details to Firestore...");
        await setDoc(doc(db, 'users', user.uid), {
            uid: user.uid,
            fullName: fullname,
            username: username,
            email: email,
            createdAt: serverTimestamp(),
            lastLoginAt: serverTimestamp(),
            isGuest: false
        });

        console.log("[Sign Up] Updating Firebase Auth profile display name...");
        await updateProfile(user, { displayName: fullname });

        console.log(`[Sign Up] User signed up and profile saved: ${user.uid}`);
        hideAllModals();

    } catch (error) {
        console.error("[Sign Up] Sign Up failed:", error);
        let errorMessage = 'Sign Up failed. Please try again.';
        if (error.code === 'auth/email-already-in-use') {
            errorMessage = 'This email is already in use. Please login or use a different email.';
        } else if (error.code === 'auth/weak-password') {
             errorMessage = 'Password is too weak. ' + error.message;
        }
        signupErrorDisplay.textContent = errorMessage;
    }
});


// --- Login Logic ---
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginErrorDisplay.textContent = '';

    const usernameOrEmail = loginUsernameEmailInput.value.trim();
    const password = loginPasswordInput.value;

    if (!usernameOrEmail || !password) {
        loginErrorDisplay.textContent = 'Both fields are required.';
        return;
    }

    try {
        let emailToLogin = usernameOrEmail;

        if (!validateEmail(usernameOrEmail)) {
            console.log("[Login] Attempting username-based login. Checking Firestore for email...");
            const usernameQuery = query(collection(db, 'users'), where('username', '==', usernameOrEmail));
            const usernameSnapshot = await getDocs(usernameQuery);
            
            if (usernameSnapshot.empty) {
                loginErrorDisplay.textContent = 'Invalid username or password.';
                return;
            }
            emailToLogin = usernameSnapshot.docs[0].data().email;
            console.log(`[Login] Found email for username: ${emailToLogin}`);
        }

        console.log(`[Login] Signing in with email: ${emailToLogin}`);
        await signInWithEmailAndPassword(auth, emailToLogin, password);
        hideAllModals();
        console.log("[Login] User logged in successfully.");

    } catch (error) {
        console.error("[Login] Login failed:", error);
        let errorMessage = 'Login failed. Invalid username/email or password.';
        if (error.code === 'auth/invalid-email' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
             errorMessage = 'Invalid username/email or password.';
        } else if (error.code === 'auth/too-many-requests') {
             errorMessage = 'Too many failed login attempts. Please try again later.';
        }
        loginErrorDisplay.textContent = errorMessage;
    }
});


// --- Auth State Change Listener ---
onAuthStateChanged(auth, async (user) => {
    console.log("onAuthStateChanged triggered. User:", user ? user.uid : "null (signed out)");

    if (user) {
        let displayId = 'User';
        if (user.isAnonymous) {
            console.log("[Auth State] User is anonymous.");
            let localGuestId = localStorage.getItem('localGuestId');
            if (localGuestId) {
                displayId = localGuestId;
                console.log(`[Auth State] Found localGuestId: ${displayId}`);
            } else {
                console.log("[Auth State] No localGuestId, fetching from Firestore for anonymous user.");
                const userDocRef = doc(db, 'users', user.uid);
                const userDocSnap = await getDoc(userDocRef);
                if (userDocSnap.exists() && userDocSnap.data().guestId) {
                    displayId = userDocSnap.data().guestId;
                    localStorage.setItem('localGuestId', displayId);
                    console.log(`[Auth State] Retrieved guestId from Firestore: ${displayId}`);
                } else {
                    console.warn("[Auth State] Anonymous user has no guestId in Firestore. Generating new.");
                    displayId = await getNextGuestId(user.uid);
                    localStorage.setItem('localGuestId', displayId);
                }
            }
            userStatusDiv.textContent = `Welcome, ${displayId}! (Guest)`;
        } else {
            console.log("[Auth State] User is permanent.");
            displayId = user.displayName || user.email;
            userStatusDiv.textContent = `Welcome, ${displayId}!`;
            localStorage.removeItem('localGuestId');
        }
        profileText.textContent = displayId;
        hideAllModals();
        fetchAndDisplayProducts();

    } else {
        console.log("[Auth State] No user authenticated. Showing initial modal.");
        userStatusDiv.textContent = `You are signed out.`;
        profileText.textContent = 'Profile';
        localStorage.removeItem('localGuestId');
        showAuthModal();
    }
});


// --- Initial Modal Display & Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    // Welcome Modal Buttons
    guestButtonWelcome.addEventListener('click', handleGuestSignIn);
    loginButtonWelcome.addEventListener('click', showLoginModal);
    signupButtonWelcome.addEventListener('click', showSignupModal);

    // Login Modal Buttons
    closeLoginModalBtn.addEventListener('click', showAuthModal);
    showSignupFromLoginBtn.addEventListener('click', showSignupModal);

    // Signup Modal Buttons
    closeSignupModalBtn.addEventListener('click', showAuthModal);
    showLoginFromSignupBtn.addEventListener('click', showLoginModal);

    // Sign Out link (inside profile dropdown)
    const signoutLink = document.getElementById('signout-link');
    if (signoutLink) {
        signoutLink.addEventListener('click', async (e) => {
            e.preventDefault();
            try {
                console.log("[Sign Out] Attempting to sign user out...");
                await signOut(auth);
                console.log('[Sign Out] User signed out successfully.');
            } catch (error) {
                console.error('[Sign Out] Error signing out:', error);
            }
        });
    }

    // --- Offer Advertisement Carousel Logic ---
    const carouselTrack = document.getElementById('carousel-track');
    const carouselIndicatorsContainer = document.getElementById('carousel-indicators');

    // Using placeholder images for now, update with your local paths if ready
    const offerImages = [
        '/img/aug-month-offer.png', // Example of local path
        '/img/freedom-offer.png',
        '/img/aug-elec.png',
        '/img/aug-apparel.png'
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

    createCarouselElements();
    carouselInterval = setInterval(nextSlide, 3000);

    const allProductsLink = categoriesNav.querySelector('[data-category="all"]');
    if (allProductsLink) {
        allProductsLink.classList.add('active-category');
    }
});


// --- Product Display Logic ---

// Helper function to create a product card HTML
function createProductCard(product) {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.innerHTML = `
        <img src="${product.imageUrl}" alt="${product.name}">
        <h3>${product.name}</h3>
        <p class="price">₹${product.price ? product.price.toFixed(2) : 'N/A'}</p>
        <button class="add-to-cart-btn" data-product-id="${product.product_id}" data-action="add-to-cart">Add to Cart</button>
        <button class="wishlist-btn" data-product-id="${product.product_id}" data-action="add-to-wishlist">&#x2764;</button>
    `;
    return card;
}

// Function to fetch and display products
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

        // --- IMPORTANT DEBUG LOG ---
        console.log("[Product Fetch] Raw products array from Firestore:", products);
        // --- END DEBUG LOG ---

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

// Event listener for category navigation
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
        fetchAndDisplayProducts(selectedCategory);
    }
});


// --- Feature Restriction Logic ---
document.addEventListener('click', (event) => {
    const target = event.target;
    if (target.tagName === 'BUTTON' && (target.classList.contains('add-to-cart-btn') || target.classList.contains('wishlist-btn'))) {
        const user = auth.currentUser;
        if (!user || user.isAnonymous) {
            event.preventDefault();
            alert('Please Login or Sign Up to add items to your cart or wishlist!');
            showAuthModal();
        }
    }
});

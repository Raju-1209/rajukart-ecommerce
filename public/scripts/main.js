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

// Modal Elements
const authModal = document.getElementById('auth-modal');
const welcomeSection = document.getElementById('welcome-section');
const signupSection = document.getElementById('signup-section');
const loginSection = document.getElementById('login-section');

// Welcome Section Buttons
const loginButtonInitial = document.getElementById('login-button-initial');
const signupButtonInitial = document.getElementById('signup-button-initial');
const guestButton = document.getElementById('guest-button');

// Sign Up Form Elements
const signupForm = document.getElementById('signup-form');
const signupFullnameInput = document.getElementById('signup-fullname');
const signupEmailInput = document.getElementById('signup-email');
const signupUsernameInput = document.getElementById('signup-username');
const signupPasswordInput = document.getElementById('signup-password');
const signupErrorDisplay = document.getElementById('signup-error');

// Login Form Elements
const loginForm = document.getElementById('login-form');
const loginUsernameEmailInput = document.getElementById('login-username-email');
const loginPasswordInput = document.getElementById('login-password');
const loginErrorDisplay = document.getElementById('login-error');

// Back Buttons
const backButtons = document.querySelectorAll('.back-to-welcome');

// --- Helper Functions for Modal Management ---
function showAuthSection(sectionElement) {
    welcomeSection.classList.remove('active');
    signupSection.classList.remove('active');
    loginSection.classList.remove('active');

    sectionElement.classList.add('active');
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
            }, { merge: true }); // Use merge to avoid overwriting if doc exists
        });
        console.log(`Generated and saved new guest ID: ${guestId}`);
        return guestId;
    } catch (e) {
        console.error("Error generating guest ID via transaction:", e);
        return `Guest-${uid.substring(0, 6)}`; // Fallback ID
    }
}

// Handler for anonymous sign-in
async function handleGuestSignIn() {
    try {
        const userCredential = await signInAnonymously(auth);
        const user = userCredential.user;
        let guestId = localStorage.getItem('localGuestId');

        if (!guestId) {
            const userDocRef = doc(db, 'users', user.uid);
            const userDocSnap = await getDoc(userDocRef); // Get specific user doc

            if (!userDocSnap.exists() || !userDocSnap.data().guestId) {
                guestId = await getNextGuestId(user.uid);
            } else {
                guestId = userDocSnap.data().guestId;
                await setDoc(userDocRef, { lastLoginAt: serverTimestamp() }, { merge: true });
            }
            localStorage.setItem('localGuestId', guestId);
        }

        authModal.style.display = 'none'; // Hide modal
        profileText.textContent = guestId; // Update profile text
        console.log(`Signed in as guest: ${guestId} (UID: ${user.uid})`);
        userStatusDiv.textContent = `Welcome, ${guestId}! (Guest)`; // Update status bar
        fetchAndDisplayProducts(); // Attempt to load products after sign-in

    } catch (error) {
        console.error("Anonymous sign-in failed:", error);
        userStatusDiv.textContent = `Error signing in as guest: ${error.message}`;
    }
}

// --- Validation Functions ---
function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.com$/; // Must contain @ and end with .com
    return emailRegex.test(email);
}

function validatePassword(password) {
    // 8+ chars, 1 uppercase, 1 lowercase, 1 numeric, 1 special character
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~]/.test(password); // Common special chars

    return password.length >= minLength && hasUpperCase && hasLowerCase && hasNumber && hasSpecialChar;
}

function validateUsername(username) {
    // String + numeric: must contain at least one letter and at least one number
    // Could be more complex, but this satisfies "string + numeric"
    const hasLetter = /[a-zA-Z]/.test(username);
    const hasNumber = /[0-9]/.test(username);
    return hasLetter && hasNumber && username.length > 0;
}


// --- Sign Up Logic ---
signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    signupErrorDisplay.textContent = ''; // Clear previous errors

    const fullname = signupFullnameInput.value.trim();
    const email = signupEmailInput.value.trim();
    const username = signupUsernameInput.value.trim();
    const password = signupPasswordInput.value;

    // Client-side validation
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

    // Check if username already exists in Firestore (NOT SECURE CLIENT-SIDE - Cloud Function needed for robust check)
    // NOTE: This check is for illustrative purposes. For true security, this must be done via a Cloud Function
    // with proper Firestore Security Rules that prevent a user from claiming another's username.
    try {
        const usernameQuery = query(collection(db, 'users'), where('username', '==', username));
        const usernameSnapshot = await getDocs(usernameQuery);
        if (!usernameSnapshot.empty) {
            signupErrorDisplay.textContent = 'This username is already taken.';
            return;
        }
    } catch (error) {
        console.error("Error checking username existence:", error);
        signupErrorDisplay.textContent = "Could not check username. Please try again.";
        return;
    }
    // --- End of Client-Side Username Check ---


    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Store additional user details in Firestore
        // This requires Firestore rules to allow the user to write to their own document (e.g., match /users/{userId} { allow create: request.auth.uid == userId;})
        await setDoc(doc(db, 'users', user.uid), {
            uid: user.uid,
            fullName: fullname,
            username: username,
            email: email,
            createdAt: serverTimestamp(),
            lastLoginAt: serverTimestamp(),
            isGuest: false
        });

        // Update Firebase Auth profile display name (optional, but good for some Firebase services)
        await updateProfile(user, { displayName: fullname });

        console.log("User signed up and profile saved:", user.uid);
        authModal.style.display = 'none'; // Hide modal
        // onAuthStateChanged will handle UI update

    } catch (error) {
        console.error("Sign Up failed:", error);
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
    loginErrorDisplay.textContent = ''; // Clear previous errors

    const usernameOrEmail = loginUsernameEmailInput.value.trim();
    const password = loginPasswordInput.value;

    if (!usernameOrEmail || !password) {
        loginErrorDisplay.textContent = 'Both fields are required.';
        return;
    }

    try {
        let emailToLogin = usernameOrEmail;

        // If it looks like a username, try to find the corresponding email
        // NOTE: This client-side lookup is not fully secure for login by username.
        // A Cloud Function is recommended for production username-based login.
        if (!validateEmail(usernameOrEmail)) {
            const usernameQuery = query(collection(db, 'users'), where('username', '==', usernameOrEmail));
            const usernameSnapshot = await getDocs(usernameQuery);
            
            if (usernameSnapshot.empty) {
                loginErrorDisplay.textContent = 'Invalid username or password.';
                return;
            }
            emailToLogin = usernameSnapshot.docs[0].data().email;
        }
        // --- End of Client-Side Username Lookup ---


        await signInWithEmailAndPassword(auth, emailToLogin, password);
        authModal.style.display = 'none'; // Hide modal
        // onAuthStateChanged will handle UI update
        console.log("User logged in successfully.");

    } catch (error) {
        console.error("Login failed:", error);
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
    if (user) {
        let displayId = 'User';
        if (user.isAnonymous) {
            // Retrieve Guest ID from local storage or Firestore
            let localGuestId = localStorage.getItem('localGuestId');
            if (localGuestId) {
                displayId = localGuestId;
            } else {
                const userDocRef = doc(db, 'users', user.uid);
                const userDocSnap = await getDoc(userDocRef);
                if (userDocSnap.exists() && userDocSnap.data().guestId) {
                    displayId = userDocSnap.data().guestId;
                    localStorage.setItem('localGuestId', displayId);
                } else {
                    displayId = await getNextGuestId(user.uid); // Generate if not found
                }
            }
            userStatusDiv.textContent = `Welcome, ${displayId}! (Guest)`;
        } else {
            // Permanent user
            displayId = user.displayName || user.email; // Prefer displayName
            userStatusDiv.textContent = `Welcome, ${displayId}!`;
            localStorage.removeItem('localGuestId'); // Clear guest ID for permanent users
        }
        profileText.textContent = displayId; // Update header profile text
        authModal.style.display = 'none'; // Hide modal if logged in
        fetchAndDisplayProducts(); // Attempt to load products after user is determined

    } else {
        // User is signed out (or not yet signed in)
        userStatusDiv.textContent = `You are signed out.`;
        profileText.textContent = 'Profile'; // Reset header profile text
        localStorage.removeItem('localGuestId'); // Clear guest ID on sign out
        showAuthSection(welcomeSection); // Show welcome section
        authModal.style.display = 'flex'; // Show modal
    }
});


// --- Initial Modal Display & Navigation ---
document.addEventListener('DOMContentLoaded', () => {
    // Set active class for initial view
    showAuthSection(welcomeSection);

    // Event Listeners for Modal Buttons
    loginButtonInitial.addEventListener('click', () => showAuthSection(loginSection));
    signupButtonInitial.addEventListener('click', () => showAuthSection(signupSection));
    guestButton.addEventListener('click', handleGuestSignIn);

    // Event Listeners for Back Buttons
    backButtons.forEach(button => {
        button.addEventListener('click', () => showAuthSection(welcomeSection));
    });

    // Sign Out link (inside profile dropdown)
    const signoutLink = document.getElementById('signout-link');
    if (signoutLink) {
        signoutLink.addEventListener('click', async (e) => {
            e.preventDefault();
            try {
                await signOut(auth); // Use Firebase Auth signOut function
                console.log('User signed out.');
                // onAuthStateChanged will handle UI update and modal display
            } catch (error) {
                console.error('Error signing out:', error);
            }
        });
    }

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


// --- Product Display Logic (Will work when Firestore rules are fixed) ---

// Helper function to create a product card HTML
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
        // This will still fail due to rules, but ready when fixed:
        fetchAndDisplayProducts(selectedCategory);
    }
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
            showAuthSection(welcomeSection); // Show welcome section in modal
            authModal.style.display = 'flex'; // Show modal
        } else if (!user) {
            event.preventDefault(); // Stop default button action
            // If user is null, meaning not even anonymous, show the auth modal
            showAuthSection(welcomeSection); // Show welcome section in modal
            authModal.style.display = 'flex';
        }
    }
});

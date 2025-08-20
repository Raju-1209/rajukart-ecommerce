// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { getFirestore, collection, getDocs, query, where, doc, runTransaction, setDoc, serverTimestamp, getDoc, addDoc, orderBy } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

// Your web app's Firebase configuration
// IMPORTANT: REPLACE WITH YOUR ACTUAL VALUES from Firebase Console -> Project Settings -> Your Apps (Web App)
const firebaseConfig = {
  apiKey: "YOUR_API_KEY", // Make sure this is your actual key
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "rajukart-ae5ca", // This should already be correct
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID",
  measurementId: "YOUR_MEASUREMENT_ID" // If you have Analytics enabled
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app); // Get the Authentication service instance
const db = getFirestore(app); // Get the Firestore service instance

// --- Global State ---
let currentUser = null; // Stores the current Firebase Auth user object
let userCart = [];      // Stores products in the user's cart
let userWishlist = [];  // Stores products in the user's wishlist

// --- UI Elements ---
const userStatusDiv = document.getElementById('user-status');
const allProductListDiv = document.getElementById('all-product-list');
const featuredProductListDiv = document.getElementById('featured-product-list');
const categoriesNav = document.querySelector('.categories-nav');
const profileText = document.getElementById('profile-text'); // For updating profile name

// Checkout Modal Elements
const checkoutModal = document.getElementById('checkout-modal');
const closeCheckoutModalBtn = document.getElementById('close-checkout-modal');
const orderSummaryDetails = document.getElementById('order-summary-details');
const orderTotalAmount = document.getElementById('order-total-amount');
const deliveryAddressForm = document.getElementById('delivery-address-form');
const deliveryFullnameInput = document.getElementById('delivery-fullname');
const deliveryPhoneInput = document.getElementById('delivery-phone');
const deliveryAddress1Input = document.getElementById('delivery-address1');
const deliveryAddress2Input = document.getElementById('delivery-address2');
const deliveryCityInput = document.getElementById('delivery-city');
const deliveryStateInput = document.getElementById('delivery-state');
const deliveryPincodeInput = document.getElementById('delivery-pincode');
const paymentMethodsDiv = document.getElementById('payment-methods');
const placeOrderButton = document.getElementById('place-order-button');
const orderConfirmationMessage = document.getElementById('order-confirmation-message');
const confirmedOrderIdSpan = document.getElementById('confirmed-order-id');
const backToHomeButton = document.getElementById('back-to-home-button');
const paymentErrorDisplay = document.getElementById('payment-error'); // For payment method selection error

// My Orders Modal Elements
const myOrdersModal = document.getElementById('my-orders-modal');
const closeMyOrdersModalBtn = document.getElementById('close-my-orders-modal');
const myOrdersLinkHeader = document.getElementById('my-orders-link-header');
const ordersListDiv = document.getElementById('orders-list');
const noOrdersMessage = document.getElementById('no-orders-message');

// --- Helper Functions for Modal Management ---
function hideAllModals() {
    checkoutModal.classList.add('hidden');
    myOrdersModal.classList.add('hidden');
    // Add other modals here if they exist and need to be hidden
}

function showCheckoutModal() {
    hideAllModals();
    checkoutModal.classList.remove('hidden');
    // Ensure initial state is correct
    orderConfirmationMessage.classList.add('hidden');
    document.querySelector('.checkout-layout').classList.remove('hidden');
    placeOrderButton.classList.add('hidden'); // Hide until payment selected
    placeOrderButton.disabled = true; // Disable until valid
    paymentErrorDisplay.textContent = ''; // Clear previous errors
    deliveryAddressForm.reset(); // Clear address form
    paymentMethodsDiv.querySelectorAll('input[type="radio"]').forEach(radio => radio.checked = false); // Clear payment selection
}

function showMyOrdersModal() {
    hideAllModals();
    myOrdersModal.classList.remove('hidden');
    fetchAndDisplayOrders(); // Fetch orders when modal is opened
}

// --- Background Guest Authentication ---
async function ensureAuthenticatedUser() {
    return new Promise(resolve => {
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                currentUser = user; // Set global currentUser
                console.log("[Auth] User is already authenticated. UID:", user.uid);
                if (user.isAnonymous) {
                    let guestId = localStorage.getItem('localGuestId');
                    if (!guestId) {
                        const userDocRef = doc(db, 'users', user.uid);
                        const userDocSnap = await getDoc(userDocRef);
                        if (userDocSnap.exists() && userDocSnap.data().guestId) {
                            guestId = userDocSnap.data().guestId;
                        } else {
                            guestId = await getNextGuestId(user.uid); // Generate if somehow missing
                        }
                        localStorage.setItem('localGuestId', guestId);
                    }
                    userStatusDiv.textContent = `Welcome, ${guestId}! (Guest)`;
                    profileText.textContent = guestId;
                } else {
                    const userDocSnap = await getDoc(doc(db, 'users', user.uid));
                    let displayName = user.displayName || user.email;
                    if (userDocSnap.exists() && userDocSnap.data().username) {
                        displayName = userDocSnap.data().username;
                    }
                    userStatusDiv.textContent = `Welcome, ${displayName}!`;
                    profileText.textContent = displayName;
                    localStorage.removeItem('localGuestId'); // Clear guest ID for permanent users
                }
            } else {
                console.log("[Auth] No user authenticated. Signing in anonymously in background...");
                // Clear any lingering local guest ID if no user is found
                localStorage.removeItem('localGuestId');
                // Attempt anonymous sign-in
                try {
                    const userCredential = await signInAnonymously(auth);
                    currentUser = userCredential.user; // Set global currentUser
                    const guestId = await getNextGuestId(currentUser.uid); // Ensure guest ID is generated/retrieved
                    localStorage.setItem('localGuestId', guestId);
                    userStatusDiv.textContent = `Welcome, ${guestId}! (Guest)`;
                    profileText.textContent = guestId;
                    console.log(`[Auth] Background anonymous sign-in successful. Guest ID: ${guestId}`);
                } catch (error) {
                    console.error("[Auth] Background anonymous sign-in failed:", error);
                    userStatusDiv.textContent = `Error: Authentication failed.`;
                }
            }
            // Once user is set, resolve the promise and load user-specific data
            await loadUserSpecificData();
            fetchAndDisplayProducts(); // Always fetch products after user is determined
            resolve();
        });
    });
}

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

// --- Data Loading & Synchronization ---
async function loadUserSpecificData() {
    if (!currentUser) {
        console("[Data Load] No current user to load cart/wishlist.");
        userCart = [];
        userWishlist = [];
        return;
    }
    try {
        // Load Cart
        const cartSnapshot = await getDocs(collection(db, 'users', currentUser.uid, 'cart'));
        userCart = cartSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log("[Data Load] Cart loaded:", userCart);

        // Load Wishlist
        const wishlistSnapshot = await getDocs(collection(db, 'users', currentUser.uid, 'wishlist'));
        userWishlist = wishlistSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log("[Data Load] Wishlist loaded:", userWishlist);

    } catch (error) {
        console.error("[Data Load] Error loading user-specific data:", error);
        // This will happen if rules don't permit read, or user doc doesn't exist yet for anonymous users
    }
}

async function syncCartToFirestore() {
    if (!currentUser) return;
    const cartRef = collection(db, 'users', currentUser.uid, 'cart');
    // Clear existing cart in Firestore
    const existingCartSnapshot = await getDocs(cartRef);
    const batch = db.batch();
    existingCartSnapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    // Add current userCart to Firestore
    if (userCart.length > 0) {
        const newBatch = db.batch();
        userCart.forEach(item => {
            const docRef = doc(cartRef, item.id); // Use product ID as document ID for cart item
            newBatch.set(docRef, item);
        });
        await newBatch.commit();
    }
    console.log("[Cart Sync] Cart synced to Firestore.");
}

async function syncWishlistToFirestore() {
    if (!currentUser) return;
    const wishlistRef = collection(db, 'users', currentUser.uid, 'wishlist');
    // Clear existing wishlist in Firestore
    const existingWishlistSnapshot = await getDocs(wishlistRef);
    const batch = db.batch();
    existingWishlistSnapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    // Add current userWishlist to Firestore
    if (userWishlist.length > 0) {
        const newBatch = db.batch();
        userWishlist.forEach(item => {
            const docRef = doc(wishlistRef, item.id); // Use product ID as document ID for wishlist item
            newBatch.set(docRef, item);
        });
        await newBatch.commit();
    }
    console.log("[Wishlist Sync] Wishlist synced to Firestore.");
}


// --- Cart & Wishlist Actions ---
function addItemToCart(product) {
    // Check if product is already in cart, if so, increment quantity
    const existingItemIndex = userCart.findIndex(item => item.id === product.id);
    if (existingItemIndex > -1) {
        userCart[existingItemIndex].quantity = (userCart[existingItemIndex].quantity || 1) + 1;
    } else {
        userCart.push({ ...product, quantity: 1 });
    }
    console.log("[Cart] Added to cart:", product.name, userCart);
    syncCartToFirestore();
}

function removeItemFromCart(productId) {
    userCart = userCart.filter(item => item.id !== productId);
    console.log("[Cart] Removed from cart. Current cart:", userCart);
    syncCartToFirestore();
}

function addToWishlist(product) {
    const existingItem = userWishlist.find(item => item.id === product.id);
    if (!existingItem) {
        userWishlist.push(product);
        console.log("[Wishlist] Added to wishlist:", product.name, userWishlist);
        syncWishlistToFirestore();
    } else {
        console.log("[Wishlist] Already in wishlist:", product.name);
    }
}

function removeFromWishlist(productId) {
    userWishlist = userWishlist.filter(item => item.id !== productId);
    console.log("[Wishlist] Removed from wishlist. Current wishlist:", userWishlist);
    syncWishlistToFirestore();
}

// --- Product Display Logic ---
function createProductCard(product) {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.innerHTML = `
        <img src="${product.imageUrl}" alt="${product.name}">
        <h3>${product.name}</h3>
        <p class="price">₹${product.price ? product.price.toFixed(2) : 'N/A'}</p>
        <div class="product-actions">
            <button class="add-to-cart-btn" data-product-id="${product.id}">Add to Cart</button>
            <button class="wishlist-btn" data-product-id="${product.id}">&#x2764;</button>
            <button class="buy-now-btn" data-product-id="${product.id}">Buy Now</button>
        </div>
    `;

    // Attach event listeners to the buttons on the card
    card.querySelector('.add-to-cart-btn').addEventListener('click', () => addItemToCart(product));
    card.querySelector('.wishlist-btn').addEventListener('click', () => addToWishlist(product));
    card.querySelector('.buy-now-btn').addEventListener('click', () => startCheckout(product));

    return card;
}

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

        console.log("[Product Fetch] Raw products array from Firestore:", products);

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
        allProductListDiv.innerHTML = '<p>Error loading products. Please check console (Permissions error likely).</p>';
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

// --- Checkout Flow ---
let currentCheckoutProduct = null; // Stores the product being bought immediately

function startCheckout(product) {
    currentCheckoutProduct = product;
    showCheckoutModal();
    renderOrderSummary();
}

function renderOrderSummary() {
    orderSummaryDetails.innerHTML = '';
    let total = 0;

    if (currentCheckoutProduct) {
        // Buy Now flow
        const itemHtml = `
            <div class="product-item">
                <img src="${currentCheckoutProduct.imageUrl}" alt="${currentCheckoutProduct.name}">
                <div class="product-info">
                    <p class="product-name">${currentCheckoutProduct.name}</p>
                    <p>Quantity: 1</p>
                </div>
                <span class="product-price">₹${currentCheckoutProduct.price.toFixed(2)}</span>
            </div>
        `;
        orderSummaryDetails.innerHTML = itemHtml;
        total = currentCheckoutProduct.price;
    } else if (userCart.length > 0) {
        // Cart checkout flow (future expansion)
        // For now, this branch is not directly triggered, but is ready
        userCart.forEach(item => {
            const itemHtml = `
                <div class="product-item">
                    <img src="${item.imageUrl}" alt="${item.name}">
                    <div class="product-info">
                        <p class="product-name">${item.name}</p>
                        <p>Quantity: ${item.quantity || 1}</p>
                    </div>
                    <span class="product-price">₹${(item.price * (item.quantity || 1)).toFixed(2)}</span>
                </div>
            `;
            orderSummaryDetails.innerHTML += itemHtml;
            total += item.price * (item.quantity || 1);
        });
    } else {
        orderSummaryDetails.innerHTML = '<p>No items in order.</p>';
    }

    orderTotalAmount.textContent = `₹${total.toFixed(2)}`;
}

// Payment method selection handler
paymentMethodsDiv.addEventListener('change', () => {
    const selectedMethod = paymentMethodsDiv.querySelector('input[name="payment_method"]:checked');
    if (selectedMethod && deliveryAddressForm.checkValidity()) { // Check form validity too
        placeOrderButton.classList.remove('hidden');
        placeOrderButton.disabled = false;
        paymentErrorDisplay.textContent = ''; // Clear any previous payment errors
    } else {
        placeOrderButton.classList.add('hidden');
        placeOrderButton.disabled = true;
    }
});

// Address form input change listener for button visibility
deliveryAddressForm.addEventListener('input', () => {
    const selectedMethod = paymentMethodsDiv.querySelector('input[name="payment_method"]:checked');
    if (selectedMethod && deliveryAddressForm.checkValidity()) {
        placeOrderButton.classList.remove('hidden');
        placeOrderButton.disabled = false;
        paymentErrorDisplay.textContent = '';
    } else {
        placeOrderButton.classList.add('hidden');
        placeOrderButton.disabled = true;
    }
});

placeOrderButton.addEventListener('click', async () => {
    // Client-side validation for address form
    if (!deliveryAddressForm.checkValidity()) {
        deliveryAddressForm.reportValidity(); // Show browser's validation messages
        return;
    }

    const selectedPaymentMethod = paymentMethodsDiv.querySelector('input[name="payment_method"]:checked');
    if (!selectedPaymentMethod) {
        paymentErrorDisplay.textContent = 'Please select a payment method.';
        return;
    }

    // All checks pass, proceed with order placement
    try {
        const orderId = `RAJU-${Date.now()}`; // Simple unique ID
        const orderData = {
            orderId: orderId,
            userId: currentUser.uid,
            products: currentCheckoutProduct ? [{ // If it's a direct buy now
                id: currentCheckoutProduct.id,
                name: currentCheckoutProduct.name,
                imageUrl: currentCheckoutProduct.imageUrl,
                price: currentCheckoutProduct.price,
                quantity: 1
            }] : userCart, // Otherwise, if cart is implemented
            totalAmount: parseFloat(orderTotalAmount.textContent.replace('₹', '')),
            deliveryAddress: {
                fullName: deliveryFullnameInput.value.trim(),
                phone: deliveryPhoneInput.value.trim(),
                address1: deliveryAddress1Input.value.trim(),
                address2: deliveryAddress2Input.value.trim(),
                city: deliveryCityInput.value.trim(),
                state: deliveryStateInput.value.trim(),
                pincode: deliveryPincodeInput.value.trim()
            },
            paymentMethod: selectedPaymentMethod.value,
            orderStatus: 'Placed',
            createdAt: serverTimestamp()
        };

        // Save order to Firestore (under users subcollection for easy retrieval)
        await setDoc(doc(db, 'users', currentUser.uid, 'orders', orderId), orderData);
        console.log("Order placed successfully:", orderData);

        // Hide checkout layout and show confirmation
        document.querySelector('.checkout-layout').classList.add('hidden');
        orderConfirmationMessage.classList.remove('hidden');
        confirmedOrderIdSpan.textContent = orderId;

        // Clear cart if this was a cart checkout (future expansion)
        userCart = [];
        syncCartToFirestore();

        currentCheckoutProduct = null; // Clear bought product
        
    } catch (error) {
        console.error("Error placing order:", error);
        alert("Failed to place order. Please try again. Error: " + error.message);
    }
});

backToHomeButton.addEventListener('click', () => {
    hideAllModals(); // Hide confirmation and checkout modal
});

// --- My Orders Flow ---
async function fetchAndDisplayOrders() {
    if (!currentUser) {
        ordersListDiv.innerHTML = '<p>Please ensure you are authenticated to view orders.</p>';
        noOrdersMessage.classList.remove('hidden');
        return;
    }

    try {
        ordersListDiv.innerHTML = '<p>Loading your orders...</p>';
        noOrdersMessage.classList.add('hidden');
        const ordersRef = collection(db, 'users', currentUser.uid, 'orders');
        const q = query(ordersRef, orderBy('createdAt', 'desc'));
        const ordersSnapshot = await getDocs(q);

        ordersListDiv.innerHTML = ''; // Clear loading message

        if (ordersSnapshot.empty) {
            noOrdersMessage.classList.remove('hidden');
            return;
        } else {
            noOrdersMessage.classList.add('hidden');
        }

        ordersSnapshot.docs.forEach(doc => {
            const order = doc.data();
            const orderItemDiv = document.createElement('div');
            orderItemDiv.className = 'order-item';
            
            let productsSummary = order.products.map(p => `${p.name} (Qty: ${p.quantity})`).join('<br>');
            let totalAmount = order.totalAmount ? `₹${order.totalAmount.toFixed(2)}` : 'N/A';
            let orderDate = order.createdAt ? new Date(order.createdAt.toDate()).toLocaleString() : 'N/A';

            orderItemDiv.innerHTML = `
                <p class="order-id">Order ID: ${order.orderId}</p>
                <p>Date: ${orderDate}</p>
                <p>Status: ${order.orderStatus}</p>
                <p>Items: <br>${productsSummary}</p>
                <p>Payment Method: ${order.paymentMethod}</p>
                <p>Delivery To: ${order.deliveryAddress.fullName}, ${order.deliveryAddress.address1}, ${order.deliveryAddress.city}</p>
                <p class="order-total-item">Total: ${totalAmount}</p>
            `;
            ordersListDiv.appendChild(orderItemDiv);
        });

    } catch (error) {
        console.error("Error fetching orders:", error);
        ordersListDiv.innerHTML = '<p>Error loading orders. Please check permissions.</p>';
        noOrdersMessage.classList.add('hidden'); // Ensure message is gone on error
    }
}


// --- Initial Setup & Event Listeners ---
document.addEventListener('DOMContentLoaded', async () => {
    await ensureAuthenticatedUser(); // Ensure user is authenticated first
    
    // Carousel setup (from previous versions, unchanged)
    const carouselTrack = document.getElementById('carousel-track');
    const carouselIndicatorsContainer = document.getElementById('carousel-indicators');

    const offerImages = [
        '/img/offer1.jpg',
        '/img/offer2.png',
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

    // --- Modal Close Buttons ---
    closeCheckoutModalBtn.addEventListener('click', () => {
        checkoutModal.classList.add('hidden');
        currentCheckoutProduct = null; // Clear any product being bought
    });
    closeMyOrdersModalBtn.addEventListener('click', () => myOrdersModal.classList.add('hidden'));

    // --- Header Nav Links ---
    const signoutLink = document.getElementById('signout-link');
    if (signoutLink) {
        signoutLink.addEventListener('click', async (e) => {
            e.preventDefault();
            try {
                console.log("[Sign Out] Attempting to sign user out...");
                await signOut(auth);
                console.log('[Sign Out] User signed out successfully.');
                // onAuthStateChanged in ensureAuthenticatedUser will handle re-authentication
            } catch (error) {
                console.error('[Sign Out] Error signing out:', error);
            }
        });
    }

    myOrdersLinkHeader.addEventListener('click', (e) => {
        e.preventDefault();
        showMyOrdersModal();
    });
});

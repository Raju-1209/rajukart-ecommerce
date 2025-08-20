// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { getFirestore, collection, getDocs, query, where, doc, runTransaction, setDoc, serverTimestamp, getDoc, addDoc, orderBy, deleteDoc } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

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

// --- Global State ---
let currentUser = null; // Stores the current Firebase Auth user object
let userCart = [];      // Stores products in the user's cart (array of product objects with quantity)
let userWishlist = [];  // Stores products in the user's wishlist (array of product objects)
let currentCheckoutProduct = null; // Stores the product being bought directly via "Buy Now"

// --- UI Elements ---
const userStatusDiv = document.getElementById('user-status');
const allProductListDiv = document.getElementById('all-product-list');
const featuredProductListDiv = document.getElementById('featured-product-list');
const categoriesNav = document.querySelector('.categories-nav');
const profileText = document.getElementById('profile-text'); // For updating profile name

// Header Icons
const cartIconHeader = document.getElementById('cart-icon-header');
const wishlistIconHeader = document.querySelector('.header-icons .icon-item:first-child'); // First icon item
const cartCountBadge = document.getElementById('cart-count');

// Modals
const cartModal = document.getElementById('cart-modal');
const closeCartModalBtn = document.getElementById('close-cart-modal');
const cartItemsListDiv = document.getElementById('cart-items-list');
const emptyCartMessage = document.getElementById('empty-cart-message');
const cartTotalSummaryDiv = document.getElementById('cart-total-summary');
const cartTotalAmountSpan = document.getElementById('cart-total-amount');
const proceedToCheckoutBtn = document.getElementById('proceed-to-checkout-btn');

const wishlistModal = document.getElementById('wishlist-modal');
const closeWishlistModalBtn = document.getElementById('close-wishlist-modal');
const wishListItemsListDiv = document.getElementById('wishlist-items-list');
const emptyWishlistMessage = document.getElementById('empty-wishlist-message');

const myOrdersModal = document.getElementById('my-orders-modal');
const closeMyOrdersModalBtn = document.getElementById('close-my-orders-modal');
const myOrdersLinkHeader = document.getElementById('my-orders-link-header');
const ordersListDiv = document.getElementById('orders-list');
const noOrdersMessage = document.getElementById('no-orders-message');

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
const paymentErrorMessage = document.getElementById('payment-error-message'); // For payment method selection error

// Address Form Error Spans
const errorFullname = document.getElementById('error-fullname');
const errorPhone = document.getElementById('error-phone');
const errorAddress1 = document.getElementById('error-address1');
const errorCity = document.getElementById('error-city');
const errorState = document.getElementById('error-state');
const errorPincode = document.getElementById('error-pincode');


// --- Helper Functions for Modal Management ---
function hideAllModals() {
    checkoutModal.classList.add('hidden');
    myOrdersModal.classList.add('hidden');
    cartModal.classList.add('hidden');
    wishlistModal.classList.add('hidden');
}

function showCheckoutModal() {
    hideAllModals();
    checkoutModal.classList.remove('hidden');
    orderConfirmationMessage.classList.add('hidden'); // Hide confirmation message
    document.querySelector('.checkout-layout').classList.remove('hidden'); // Show checkout layout
    deliveryAddressForm.reset(); // Clear address form
    paymentMethodsDiv.querySelectorAll('input[type="radio"]').forEach(radio => radio.checked = false); // Clear payment selection
    updatePlaceOrderButtonState(); // Update button state based on initial form
    clearAddressFormErrors(); // Clear any previous address form errors
    paymentErrorMessage.textContent = ''; // Clear payment error
    renderOrderSummary(); // Render the summary for currentCheckoutProduct or cart
}

function showMyOrdersModal() {
    hideAllModals();
    myOrdersModal.classList.remove('hidden');
    fetchAndDisplayOrders();
}

function showCartModal() {
    hideAllModals();
    cartModal.classList.remove('hidden');
    renderCartItems();
}

function showWishlistModal() {
    hideAllModals();
    wishlistModal.classList.remove('hidden');
    renderWishlistItems();
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
                    let displayName = user.displayName || user.email; // Default to email if no displayName
                    if (userDocSnap.exists() && userDocSnap.data().username) {
                        displayName = userDocSnap.data().username;
                    }
                    userStatusDiv.textContent = `Welcome, ${displayName}!`;
                    profileText.textContent = displayName;
                    localStorage.removeItem('localGuestId'); // Clear guest ID for permanent users
                }
            } else {
                console.log("[Auth] No user authenticated. Signing in anonymously in background...");
                localStorage.removeItem('localGuestId'); // Clear any lingering local guest ID if no user is found
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
            await loadUserSpecificData(); // Load cart/wishlist
            fetchAndDisplayProducts(); // Always fetch products after user is determined
            resolve(); // Resolve the promise once authentication and data load are complete
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
        console.log("[Data Load] No current user to load cart/wishlist.");
        userCart = [];
        userWishlist = [];
        return;
    }
    try {
        // Load Cart
        const cartSnapshot = await getDocs(collection(db, 'users', currentUser.uid, 'cart'));
        userCart = cartSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log("[Data Load] Cart loaded:", userCart);
        updateCartCountBadge();

        // Load Wishlist
        const wishlistSnapshot = await getDocs(collection(db, 'users', currentUser.uid, 'wishlist'));
        userWishlist = wishlistSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log("[Data Load] Wishlist loaded:", userWishlist);

    } catch (error) {
        console.error("[Data Load] Error loading user-specific data:", error);
    }
}

async function syncCartToFirestore() {
    if (!currentUser) return;
    const cartRef = collection(db, 'users', currentUser.uid, 'cart');
    const batch = db.batch();

    // Remove items not in current userCart
    const existingCartSnapshot = await getDocs(cartRef);
    const existingProductIds = new Set(existingCartSnapshot.docs.map(doc => doc.id));
    const currentUserCartIds = new Set(userCart.map(item => item.id));

    existingProductIds.forEach(id => {
        if (!currentUserCartIds.has(id)) {
            batch.delete(doc(cartRef, id));
        }
    });

    // Add/Update items in current userCart
    userCart.forEach(item => {
        const docRef = doc(cartRef, item.id);
        batch.set(docRef, item); // Use set with merge if needed, for simplicity set overwrites
    });

    try {
        await batch.commit();
        console.log("[Cart Sync] Cart synced to Firestore.");
        updateCartCountBadge();
    } catch (error) {
        console.error("[Cart Sync] Error syncing cart to Firestore:", error);
    }
}

async function syncWishlistToFirestore() {
    if (!currentUser) return;
    const wishlistRef = collection(db, 'users', currentUser.uid, 'wishlist');
    const batch = db.batch();

    // Remove items not in current userWishlist
    const existingWishlistSnapshot = await getDocs(wishlistRef);
    const existingProductIds = new Set(existingWishlistSnapshot.docs.map(doc => doc.id));
    const currentUserWishlistIds = new Set(userWishlist.map(item => item.id));

    existingProductIds.forEach(id => {
        if (!currentUserWishlistIds.has(id)) {
            batch.delete(doc(wishlistRef, id));
        }
    });

    // Add/Update items in current userWishlist
    userWishlist.forEach(item => {
        const docRef = doc(wishlistRef, item.id);
        batch.set(docRef, item);
    });

    try {
        await batch.commit();
        console.log("[Wishlist Sync] Wishlist synced to Firestore.");
    } catch (error) {
        console.error("[Wishlist Sync] Error syncing wishlist to Firestore:", error);
    }
}

function updateCartCountBadge() {
    const totalItems = userCart.reduce((sum, item) => sum + (item.quantity || 1), 0);
    cartCountBadge.textContent = totalItems;
    if (totalItems > 0) {
        cartCountBadge.classList.remove('hidden');
    } else {
        cartCountBadge.classList.add('hidden');
    }
}


// --- Cart & Wishlist Actions ---
function addItemToCart(product) {
    const existingItemIndex = userCart.findIndex(item => item.id === product.id);
    if (existingItemIndex > -1) {
        userCart[existingItemIndex].quantity = (userCart[existingItemIndex].quantity || 1) + 1;
    } else {
        userCart.push({ ...product, quantity: 1 });
    }
    console.log("[Cart] Added to cart:", product.name, userCart);
    syncCartToFirestore();
    updateCartCountBadge();
    renderCartItems(); // Re-render cart modal if open
}

function removeItemFromCart(productId) {
    userCart = userCart.filter(item => item.id !== productId);
    console.log("[Cart] Removed from cart. Current cart:", userCart);
    syncCartToFirestore();
    updateCartCountBadge();
    renderCartItems();
}

function addToWishlist(product) {
    const existingItem = userWishlist.find(item => item.id === product.id);
    if (!existingItem) {
        userWishlist.push(product);
        console.log("[Wishlist] Added to wishlist:", product.name, userWishlist);
        syncWishlistToFirestore();
        renderWishlistItems(); // Re-render wishlist modal if open
    } else {
        console.log("[Wishlist] Already in wishlist:", product.name);
    }
}

function removeFromWishlist(productId) {
    userWishlist = userWishlist.filter(item => item.id !== productId);
    console.log("[Wishlist] Removed from wishlist. Current wishlist:", userWishlist);
    syncWishlistToFirestore();
    renderWishlistItems();
}

function renderCartItems() {
    cartItemsListDiv.innerHTML = '';
    let total = 0;
    if (userCart.length === 0) {
        emptyCartMessage.classList.remove('hidden');
        cartTotalSummaryDiv.classList.add('hidden');
        proceedToCheckoutBtn.classList.add('hidden');
    } else {
        emptyCartMessage.classList.add('hidden');
        cartTotalSummaryDiv.classList.remove('hidden');
        proceedToCheckoutBtn.classList.remove('hidden');
        userCart.forEach(item => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'cart-item';
            const itemPrice = item.price * (item.quantity || 1);
            total += itemPrice;
            itemDiv.innerHTML = `
                <img src="${item.imageUrl}" alt="${item.name}">
                <div class="cart-item-info">
                    <p class="item-name">${item.name}</p>
                    <p>Qty: ${item.quantity || 1}</p>
                </div>
                <span class="cart-item-price">₹${itemPrice.toFixed(2)}</span>
                <button class="remove-btn" data-product-id="${item.id}">Remove</button>
            `;
            itemDiv.querySelector('.remove-btn').addEventListener('click', () => removeItemFromCart(item.id));
            cartItemsListDiv.appendChild(itemDiv);
        });
    }
    cartTotalAmountSpan.textContent = `₹${total.toFixed(2)}`;
}

function renderWishlistItems() {
    wishListItemsListDiv.innerHTML = '';
    if (userWishlist.length === 0) {
        emptyWishlistMessage.classList.remove('hidden');
    } else {
        emptyWishlistMessage.classList.add('hidden');
        userWishlist.forEach(item => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'wishlist-item';
            itemDiv.innerHTML = `
                <img src="${item.imageUrl}" alt="${item.name}">
                <div class="wishlist-item-info">
                    <p class="item-name">${item.name}</p>
                    <p>Price: ₹${item.price.toFixed(2)}</p>
                </div>
                <button class="remove-btn" data-product-id="${item.id}">Remove</button>
            `;
            itemDiv.querySelector('.remove-btn').addEventListener('click', () => removeFromWishlist(item.id));
            wishListItemsListDiv.appendChild(itemDiv);
        });
    }
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
function startCheckout(product = null) {
    currentCheckoutProduct = product; // Can be null if starting from cart
    showCheckoutModal();
    renderOrderSummary();
}

function renderOrderSummary() {
    orderSummaryDetails.innerHTML = '';
    let total = 0;
    let itemsToRender = [];

    if (currentCheckoutProduct) {
        itemsToRender.push({ ...currentCheckoutProduct, quantity: 1 });
    } else if (userCart.length > 0) {
        itemsToRender = userCart;
    } else {
        orderSummaryDetails.innerHTML = '<p>No items in order.</p>';
        orderTotalAmount.textContent = `₹0.00`;
        return;
    }

    itemsToRender.forEach(item => {
        const itemPrice = item.price * (item.quantity || 1);
        total += itemPrice;
        const itemHtml = `
            <div class="product-item">
                <img src="${item.imageUrl}" alt="${item.name}">
                <div class="product-info">
                    <p class="product-name">${item.name}</p>
                    <p>Quantity: ${item.quantity || 1}</p>
                </div>
                <span class="product-price">₹${itemPrice.toFixed(2)}</span>
            </div>
        `;
        orderSummaryDetails.innerHTML += itemHtml;
    });

    orderTotalAmount.textContent = `₹${total.toFixed(2)}`;
}


// --- Address Form Validation ---
function validateAddressForm() {
    let isValid = true;
    const phoneRegex = /^[0-9]{10}$/;
    const pincodeRegex = /^[0-9]{6}$/;

    // Full Name
    if (deliveryFullnameInput.value.trim() === '') {
        errorFullname.textContent = 'Full Name is required.';
        deliveryFullnameInput.classList.add('invalid');
        isValid = false;
    } else {
        errorFullname.textContent = '';
        deliveryFullnameInput.classList.remove('invalid');
    }

    // Phone Number
    if (!phoneRegex.test(deliveryPhoneInput.value.trim())) {
        errorPhone.textContent = 'Please enter a valid 10-digit phone number.';
        deliveryPhoneInput.classList.add('invalid');
        isValid = false;
    } else {
        errorPhone.textContent = '';
        deliveryPhoneInput.classList.remove('invalid');
    }

    // Address Line 1
    if (deliveryAddress1Input.value.trim() === '') {
        errorAddress1.textContent = 'Address Line 1 is required.';
        deliveryAddress1Input.classList.add('invalid');
        isValid = false;
    } else {
        errorAddress1.textContent = '';
        deliveryAddress1Input.classList.remove('invalid');
    }

    // City
    if (deliveryCityInput.value.trim() === '') {
        errorCity.textContent = 'City is required.';
        deliveryCityInput.classList.add('invalid');
        isValid = false;
    } else {
        errorCity.textContent = '';
        deliveryCityInput.classList.remove('invalid');
    }

    // State
    if (deliveryStateInput.value.trim() === '') {
        errorState.textContent = 'State is required.';
        deliveryStateInput.classList.add('invalid');
        isValid = false;
    } else {
        errorState.textContent = '';
        deliveryStateInput.classList.remove('invalid');
    }

    // Pincode
    if (!pincodeRegex.test(deliveryPincodeInput.value.trim())) {
        errorPincode.textContent = 'Please enter a valid 6-digit pincode.';
        deliveryPincodeInput.classList.add('invalid');
        isValid = false;
    } else {
        errorPincode.textContent = '';
        deliveryPincodeInput.classList.remove('invalid');
    }

    return isValid;
}

function clearAddressFormErrors() {
    errorFullname.textContent = '';
    errorPhone.textContent = '';
    errorAddress1.textContent = '';
    errorCity.textContent = '';
    errorState.textContent = '';
    errorPincode.textContent = '';
    deliveryAddressForm.querySelectorAll('input').forEach(input => input.classList.remove('invalid'));
}

// Update "Place Your Order" button state based on payment and form validity
function updatePlaceOrderButtonState() {
    const selectedPaymentMethod = paymentMethodsDiv.querySelector('input[name="payment_method"]:checked');
    const isAddressFormValid = deliveryAddressForm.checkValidity(); // Browser's built-in validation
    
    // Add custom validation check
    const isCustomAddressValid = validateAddressForm(); // Our custom validation

    if (selectedPaymentMethod && isCustomAddressValid) { // Use our custom validation result
        placeOrderButton.disabled = false;
        paymentErrorMessage.textContent = ''; // Clear payment error if valid
    } else {
        placeOrderButton.disabled = true;
    }
}

// Attach input listeners for real-time validation and button state update
deliveryAddressForm.addEventListener('input', () => {
    validateAddressForm(); // Validate on every input change
    updatePlaceOrderButtonState();
});

// Payment method selection handler
paymentMethodsDiv.addEventListener('change', () => {
    paymentErrorMessage.textContent = ''; // Clear error on new selection
    updatePlaceOrderButtonState();
});

placeOrderButton.addEventListener('click', async () => {
    // Re-validate just before placing order
    if (!validateAddressForm()) {
        paymentErrorMessage.textContent = 'Please fill out all mandatory address fields correctly.';
        return;
    }

    const selectedPaymentMethod = paymentMethodsDiv.querySelector('input[name="payment_method"]:checked');
    if (!selectedPaymentMethod) {
        paymentErrorMessage.textContent = 'Please select a payment method.';
        return;
    }

    // All checks pass, proceed with order placement
    try {
        const orderId = `RAJU-${Date.now()}`; // Simple unique ID
        
        let productsInOrder = [];
        if (currentCheckoutProduct) {
            productsInOrder.push({ // If it's a direct buy now
                id: currentCheckoutProduct.id,
                name: currentCheckoutProduct.name,
                imageUrl: currentCheckoutProduct.imageUrl,
                price: currentCheckoutProduct.price,
                quantity: 1
            });
        } else {
            productsInOrder = userCart; // Otherwise, take items from cart
        }

        const totalAmountValue = parseFloat(orderTotalAmount.textContent.replace('₹', ''));

        const orderData = {
            orderId: orderId,
            userId: currentUser.uid,
            products: productsInOrder,
            totalAmount: totalAmountValue,
            deliveryAddress: {
                fullName: deliveryFullnameInput.value.trim(),
                phone: deliveryPhoneInput.value.trim(),
                address1: deliveryAddress1Input.value.trim(),
                address2: deliveryAddress2Input.value.trim(), // Optional field
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

        // Clear cart if this was a cart checkout
        if (!currentCheckoutProduct) { // Only clear cart if it wasn't a direct buy now
            userCart = [];
            await syncCartToFirestore(); // Ensure Firestore cart is also cleared
        }

        // Hide checkout layout and show confirmation
        document.querySelector('.checkout-layout').classList.add('hidden');
        orderConfirmationMessage.classList.remove('hidden');
        confirmedOrderIdSpan.textContent = orderId;

        currentCheckoutProduct = null; // Reset for next order
        
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
    closeCartModalBtn.addEventListener('click', () => cartModal.classList.add('hidden'));
    closeWishlistModalBtn.addEventListener('click', () => wishlistModal.classList.add('hidden'));

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

    cartIconHeader.addEventListener('click', (e) => {
        e.preventDefault();
        showCartModal();
    });

    wishlistIconHeader.addEventListener('click', (e) => {
        e.preventDefault();
        showWishlistModal();
    });

    proceedToCheckoutBtn.addEventListener('click', () => {
        // Clear currentCheckoutProduct as we are checking out the entire cart
        currentCheckoutProduct = null; 
        showCheckoutModal();
    });

    // Initial state for place order button (disabled)
    updatePlaceOrderButtonState();
});

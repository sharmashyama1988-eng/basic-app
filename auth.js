import { initializeApp } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-analytics.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyCasCfhLtstfPSyorRcm6cbj2xzhi87pRQ",
    authDomain: "gen-lang-client-0506417299.firebaseapp.com",
    projectId: "gen-lang-client-0506417299",
    storageBucket: "gen-lang-client-0506417299.firebasestorage.app",
    messagingSenderId: "214649300510",
    appId: "1:214649300510:web:6e1cd5832245d7d09bb00f",
    measurementId: "G-JDKJ0X6G56"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// Attach to window so onclick handlers can access them
window.handleSignIn = () => {
    signInWithPopup(auth, provider).catch(error => {
        console.error("Login Error:", error);
        alert("Login Failed: " + error.message);
    });
};

window.handleSignOut = () => {
    signOut(auth).catch(error => console.error("Logout Error:", error));
};

onAuthStateChanged(auth, (user) => {
    const loginBtn = document.getElementById('login-btn');
    const userProfile = document.getElementById('user-profile');

    if (user) {
        if (loginBtn) loginBtn.style.display = 'none';
        if (userProfile) {
            userProfile.style.display = 'flex';
            userProfile.innerHTML = `<img src="${user.photoURL}" alt="Profile" title="${user.displayName} (Click to sign out)" onclick="window.handleSignOut()">`;
        }
        localStorage.setItem('amisphere_user', JSON.stringify({ name: user.displayName, email: user.email }));
        console.log("Logged in as:", user.displayName);
    } else {
        if (loginBtn) loginBtn.style.display = 'inline-block';
        if (userProfile) userProfile.style.display = 'none';
        localStorage.removeItem('amisphere_user');
        console.log("User signed out");
    }
});

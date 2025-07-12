// Gerekli Firebase Fonksiyonlarını Import Etme
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

// Firebase Konfigürasyonu
const firebaseConfig = {
    apiKey: "AIzaSyDYkzZzNXB22U4oEXxOoPh-puwuE8kz0g4",
    authDomain: "pufemo-com.firebaseapp.com",
    projectId: "pufemo-com",
    storageBucket: "pufemo-com.appspot.com",
    messagingSenderId: "983352837227",
    appId: "1:983352837227:web:defaa8dae215776e2e1d2e",
    measurementId: "G-RH8XHC7P91"
};

// Firebase'i Başlat
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// HTML Elementleri
const loginButton = document.getElementById('loginButton');
const loadingSpinner = document.getElementById('loadingSpinner');
const loginContent = document.getElementById('loginContent');
const errorMessage = document.getElementById('errorMessage');

// Oturum Kontrolü
onAuthStateChanged(auth, (user) => {
    loadingSpinner.style.display = 'block';
    loginContent.style.display = 'none';

    if (user) {
        // Kullanıcı giriş yaptıysa yönlendir
        console.log("Giriş başarılı, yönlendiriliyor...");
        window.location.href = 'dashboard.html';
    } else {
        // Giriş yapılmamışsa giriş ekranı göster
        console.log("Giriş yapılmamış.");
        loadingSpinner.style.display = 'none';
        loginContent.style.display = 'block';
    }
});

// Google ile Giriş
loginButton.addEventListener('click', async () => {
    const provider = new GoogleAuthProvider();

    try {
        const result = await signInWithPopup(auth, provider);
        const user = result.user;

        const userRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(userRef);

        if (!docSnap.exists()) {
            await setDoc(userRef, {
                uid: user.uid,
                displayName: user.displayName,
                email: user.email,
                photoURL: user.photoURL,
                createdAt: new Date(),
                approved: false
            });
            alert("Hesabınız oluşturuldu. Yönetici onayından sonra giriş yapabileceksiniz.");
            await signOut(auth);
        } else {
            const userData = docSnap.data();
            if (userData.approved) {
                window.location.href = 'dashboard.html';
            } else {
                alert("Hesabınız henüz yönetici tarafından onaylanmadı.");
                await signOut(auth);
            }
        }
    } catch (error) {
        console.error("Giriş hatası:", error);
        errorMessage.textContent = "Giriş sırasında bir hata oluştu.";
        errorMessage.classList.remove('d-none');
    }
});

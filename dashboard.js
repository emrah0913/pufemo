// Gerekli Firebase Fonksiyonlarını Import Etme
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";

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

// Firebase'i ve Servisleri Başlatma
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// HTML Elementleri
const logoutButton = document.getElementById('logoutButton');

// Oturum kontrolü
onAuthStateChanged(auth, (user) => {
    if (!user) {
        // Eğer kullanıcı giriş yapmamışsa, giriş sayfasına yönlendir
        window.location.href = 'index.html';
    }
});

// Çıkış yap butonu
logoutButton.addEventListener('click', () => {
    signOut(auth)
        .then(() => {
            console.log('Çıkış başarılı.');
        })
        .catch((error) => {
            console.error('Çıkış hatası', error);
        });
});

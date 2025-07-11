// Gerekli Firebase Fonksiyonlarını Import Etme
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

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
const db = getFirestore(app);

// HTML Elementleri
const categoryTitle = document.getElementById('categoryTitle');
const moduleList = document.getElementById('moduleList');
const loadingIndicator = document.getElementById('loadingIndicator');
const logoutButton = document.getElementById('logoutButton');
const addModuleBtn = document.getElementById('addModuleBtn');

// Sayfa yüklendiğinde çalışacak ana fonksiyon
document.addEventListener('DOMContentLoaded', () => {
    // URL'den parametreleri al
    const params = new URLSearchParams(window.location.search);
    const categoryId = params.get('id');
    const categoryName = params.get('name');

    // Eğer parametreler yoksa, ana sayfaya yönlendir
    if (!categoryId || !categoryName) {
        alert("Kategori bilgisi bulunamadı!");
        window.location.href = 'modules.html';
        return;
    }

    // Kategori başlığını güncelle
    categoryTitle.textContent = decodeURIComponent(categoryName);
    
    // "Yeni Modül Ekle" butonuna tıklandığında doğru sayfaya yönlendir
    addModuleBtn.addEventListener('click', () => {
        window.location.href = `module-editor.html?categoryId=${categoryId}`;
    });

    // Kullanıcı oturumunu kontrol et
    onAuthStateChanged(auth, user => {
        if (user) {
            // Kullanıcı giriş yapmışsa modülleri getir
            fetchModules(user.uid, categoryId);
        } else {
            // Giriş yapmamışsa anasayfaya yönlendir
            window.location.href = 'index.html';
        }
    });
});

// Çıkış yap butonu
logoutButton.addEventListener('click', () => {
    signOut(auth);
});

// Belirli bir kategoriye ait modülleri getiren fonksiyon (ŞİMDİLİK BOŞ)
const fetchModules = (userId, categoryId) => {
    console.log(`'${categoryId}' ID'li kategori için modüller getirilecek.`);
    loadingIndicator.classList.remove('d-none');
    
    // TODO: Buraya Firestore'dan modülleri çekecek sorgu gelecek.
    // Şimdilik sadece bir mesaj gösteriyoruz.
    setTimeout(() => { // Gerçek bir yükleme hissi vermek için küçük bir gecikme
        loadingIndicator.classList.add('d-none');
        moduleList.innerHTML = `
            <div class="alert alert-info text-center">
                Bu kategoriye ait henüz bir modül şablonu oluşturulmadı.
            </div>
        `;
    }, 500);
};

// Gerekli Firebase Fonksiyonlarını Import Etme
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getFirestore, doc, getDoc, query, collection, where, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

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
    const params = new URLSearchParams(window.location.search);
    const categoryId = params.get('id');
    let categoryName = params.get('name'); // let olarak değiştirdik

    if (!categoryId) {
        alert("Geçersiz kategori. Ana sayfaya yönlendiriliyorsunuz.");
        window.location.href = 'modules.html';
        return;
    }

    // "Yeni Modül Ekle" butonunun linkini ayarla
    addModuleBtn.addEventListener('click', () => {
        window.location.href = `module-editor.html?categoryId=${categoryId}`;
    });

    // Kullanıcı oturumunu kontrol et
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // *** YENİ VE GÜNCELLENMİŞ BÖLÜM ***
            // Eğer URL'de kategori adı yoksa, veritabanından çek
            if (!categoryName) {
                try {
                    const docRef = doc(db, 'moduleCategories', categoryId);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        categoryName = docSnap.data().name;
                        categoryTitle.textContent = categoryName;
                    } else {
                        throw new Error("Kategori bulunamadı");
                    }
                } catch (error) {
                    console.error("Kategori adı alınamadı:", error);
                    alert("Kategori bilgileri yüklenemedi.");
                    window.location.href = 'modules.html';
                    return;
                }
            } else {
                // URL'de isim varsa direkt kullan
                categoryTitle.textContent = decodeURIComponent(categoryName);
            }
            // *** GÜNCELLEME SONU ***
            
            // Modülleri getir
            fetchModules(user.uid, categoryId);
        } else {
            window.location.href = 'index.html';
        }
    });
});

// Çıkış yap butonu
logoutButton.addEventListener('click', () => signOut(auth));

// Belirli bir kategoriye ait modülleri getiren fonksiyon
const fetchModules = (userId, categoryId) => {
    loadingIndicator.classList.remove('d-none');
    moduleList.innerHTML = '';

    // Firestore sorgusunu oluştur
    const q = query(
        collection(db, 'moduleTemplates'),
        where('userId', '==', userId),
        where('categoryId', '==', categoryId),
        orderBy('createdAt', 'desc')
    );

    // Sorguyu dinle
    onSnapshot(q, (querySnapshot) => {
        loadingIndicator.classList.add('d-none');
        moduleList.innerHTML = ''; // Her güncellemede listeyi temizle

        if (querySnapshot.empty) {
            moduleList.innerHTML = `
                <div class="alert alert-info text-center">
                    Bu kategoriye ait henüz bir modül şablonu oluşturulmadı.
                </div>
            `;
            return;
        }

        querySnapshot.forEach((doc) => {
            const module = doc.data();
            const moduleId = doc.id;
            const moduleElement = `
                <a href="#" class="list-group-item list-group-item-action">
                    ${module.name}
                </a>
            `;
            moduleList.innerHTML += moduleElement;
        });

    }, (error) => {
        console.error("Modüller getirilirken hata:", error);
        // Hata bir indeks eksikliğinden kaynaklanıyorsa kullanıcıyı bilgilendir
        if (error.code === 'failed-precondition') {
            alert("Veritabanı yapılandırması gerekiyor. Lütfen geliştirici konsolundaki (F12) linke tıklayarak gerekli indeksi oluşturun.");
        } else {
            alert("Modüller yüklenirken bir hata oluştu.");
        }
        loadingIndicator.classList.add('d-none');
    });
};

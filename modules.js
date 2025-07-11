// 1. Gerekli Firebase Fonksiyonlarını Yeni SDK'dan Import Etme
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    query, 
    where, 
    orderBy, 
    onSnapshot,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

// 2. Senin Paylaştığın Firebase Konfigürasyonu
const firebaseConfig = {
    apiKey: "AIzaSyDYkzZzNXB22U4oEXxOoPh-puwuE8kz0g4",
    authDomain: "pufemo-com.firebaseapp.com",
    projectId: "pufemo-com",
    storageBucket: "pufemo-com.appspot.com", // .firebasestorage.app yerine .appspot.com olabilir, kontrol et.
    messagingSenderId: "983352837227",
    appId: "1:983352837227:web:defaa8dae215776e2e1d2e",
    measurementId: "G-RH8XHC7P91"
};

// 3. Firebase'i ve Servisleri Başlatma (Yeni Yöntem)
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// HTML Elementlerini Değişkenlere Ata
const categoryList = document.getElementById('categoryList');
const loadingIndicator = document.getElementById('loadingIndicator');
const categoryModal = new bootstrap.Modal(document.getElementById('categoryModal'));
const categoryForm = document.getElementById('categoryForm');
const categoryNameInput = document.getElementById('categoryName');
const categoryIdInput = document.getElementById('categoryId');
const modalTitle = document.getElementById('modalTitle');
const saveCategoryBtn = document.getElementById('saveCategoryBtn');
const addCategoryBtn = document.getElementById('addCategoryBtn');
const logoutButton = document.getElementById('logoutButton');

// 4. Kullanıcı Oturum Kontrolü (Değişiklik yok, aynı)
onAuthStateChanged(auth, user => {
    if (user) {
        console.log("Kullanıcı giriş yaptı:", user.uid);
        fetchCategories(user.uid);
    } else {
        console.log("Kullanıcı bulunamadı, giriş sayfasına yönlendiriliyor.");
        window.location.href = 'index.html';
    }
});

// Çıkış yap butonu
logoutButton.addEventListener('click', () => {
    signOut(auth);
});

// 5. Kategorileri Firestore'dan Çekme (Yeni Yöntem)
const fetchCategories = (userId) => {
    loadingIndicator.classList.remove('d-none');
    categoryList.innerHTML = '';

    // Firestore sorgusunu yeni yöntemle oluştur
    const q = query(
        collection(db, 'moduleCategories'), 
        where('userId', '==', userId), 
        orderBy('createdAt', 'desc')
    );

    // Sorguyu dinle
    onSnapshot(q, (querySnapshot) => {
        loadingIndicator.classList.add('d-none');
        categoryList.innerHTML = '';

        if (querySnapshot.empty) {
            categoryList.innerHTML = '<p class="text-center text-muted">Henüz hiç kategori oluşturmadınız.</p>';
            return;
        }

        querySnapshot.forEach((doc) => {
            const category = doc.data();
            const categoryId = doc.id;

            const categoryElement = `
              <div class="list-group-item list-group-item-action d-flex justify-content-between align-items-center">
                  <span>${category.name}</span>
                  <div>
                      <button class="btn btn-sm btn-outline-secondary" onclick="window.openEditModal('${categoryId}', '${category.name}')">Düzenle</button>
                      <button class="btn btn-sm btn-outline-danger ms-2" onclick="window.deleteCategory('${categoryId}')">Sil</button>
                  </div>
              </div>
            `;
            categoryList.innerHTML += categoryElement;
        });
    }, (error) => {
        console.error("Kategorileri çekerken hata oluştu: ", error);
        alert("Kategoriler yüklenirken bir hata oluştu.");
        loadingIndicator.classList.add('d-none');
    });
}

// 6. Kategori Kaydetme (Yeni Yöntem)
saveCategoryBtn.addEventListener('click', async () => {
    const categoryName = categoryNameInput.value.trim();
    const categoryId = categoryIdInput.value;
    const user = auth.currentUser;

    if (!categoryName) {
        alert("Kategori adı boş olamaz.");
        return;
    }
    if (!user) {
        alert("İşlem yapmak için giriş yapmalısınız.");
        return;
    }

    try {
        if (categoryId) {
            // GÜNCELLEME
            const docRef = doc(db, 'moduleCategories', categoryId);
            await updateDoc(docRef, { name: categoryName });
            console.log("Kategori başarıyla güncellendi.");
        } else {
            // EKLEME
            await addDoc(collection(db, 'moduleCategories'), {
                name: categoryName,
                userId: user.uid,
                createdAt: serverTimestamp()
            });
            console.log("Kategori başarıyla eklendi.");
        }
        categoryModal.hide();
    } catch (error) {
        console.error("Kaydetme hatası: ", error);
        alert("İşlem sırasında bir hata oluştu.");
    }
});

// Yeni kategori ekle butonuna basıldığında modalı temizle
addCategoryBtn.addEventListener('click', () => {
    categoryForm.reset();
    categoryIdInput.value = '';
    modalTitle.textContent = 'Yeni Kategori Ekle';
});

// 7. Fonksiyonları Global Kapsama Taşıma
// "type=module" kullandığımız için fonksiyonlar artık globalde değil.
// HTML'deki onclick olaylarının çalışması için onları window nesnesine atamalıyız.
window.openEditModal = (id, name) => {
    categoryForm.reset();
    modalTitle.textContent = 'Kategoriyi Düzenle';
    categoryIdInput.value = id;
    categoryNameInput.value = name;
    categoryModal.show();
}

window.deleteCategory = async (id) => {
    if (confirm("Bu kategoriyi silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.")) {
        try {
            await deleteDoc(doc(db, 'moduleCategories', id));
            console.log("Kategori başarıyla silindi.");
        } catch (error) {
            console.error("Silme hatası: ", error);
            alert("Kategori silinirken bir hata oluştu.");
        }
    }
}

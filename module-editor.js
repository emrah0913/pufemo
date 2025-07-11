// Gerekli Firebase Fonksiyonlarını Import Etme
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getFirestore, addDoc, collection, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

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
const moduleForm = document.getElementById('moduleForm');
const moduleNameInput = document.getElementById('moduleName');
const partsContainer = document.getElementById('partsContainer');
const addPartBtn = document.getElementById('addPartBtn');
const saveModuleBtn = document.getElementById('saveModuleBtn');
const backButton = document.getElementById('backButton');
const logoutButton = document.getElementById('logoutButton');

let categoryId = null;

// Sayfa yüklendiğinde çalışacak ana fonksiyon
document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    categoryId = params.get('categoryId');

    if (!categoryId) {
        alert("Kategori ID'si bulunamadı!");
        window.location.href = 'modules.html';
        return;
    }
    
    // Geri butonunun linkini ayarla
    backButton.href = `module-list.html?id=${categoryId}`;

    // Kullanıcı oturumunu kontrol et
    onAuthStateChanged(auth, user => {
        if (!user) {
            window.location.href = 'index.html';
        }
    });
});

// Çıkış yap butonu
logoutButton.addEventListener('click', () => signOut(auth));

// Parça Ekle Butonuna Tıklandığında
addPartBtn.addEventListener('click', () => {
    const partId = `part-${Date.now()}`; // Her parça için benzersiz bir ID
    const partElement = document.createElement('div');
    partElement.className = 'card mb-2 part-row';
    partElement.id = partId;
    partElement.innerHTML = `
        <div class="card-body">
            <div class="row g-2 align-items-center">
                <div class="col-md-3">
                    <label class="form-label">Parça Adı</label>
                    <input type="text" class="form-control form-control-sm part-name" placeholder="Sol Yan" required>
                </div>
                <div class="col-md-1">
                    <label class="form-label">Adet</label>
                    <input type="number" class="form-control form-control-sm part-qty" value="1" required>
                </div>
                <div class="col-md-3">
                    <label class="form-label">Genişlik Formülü</label>
                    <input type="text" class="form-control form-control-sm part-width" placeholder="D" required>
                </div>
                <div class="col-md-3">
                    <label class="form-label">Yükseklik/Derinlik Formülü</label>
                    <input type="text" class="form-control form-control-sm part-height" placeholder="B" required>
                </div>
                <div class="col-md-2 text-end align-self-end">
                    <button type="button" class="btn btn-sm btn-outline-danger" onclick="document.getElementById('${partId}').remove()">Sil</button>
                </div>
            </div>
        </div>
    `;
    partsContainer.appendChild(partElement);
});

// Formu Kaydetme
moduleForm.addEventListener('submit', async (e) => {
    e.preventDefault(); // Formun varsayılan gönderme işlemini engelle
    const user = auth.currentUser;
    const moduleName = moduleNameInput.value.trim();

    if (!user || !moduleName) {
        alert("Modül adı boş bırakılamaz.");
        return;
    }

    // Tüm parça satırlarındaki verileri topla
    const parts = [];
    const partRows = document.querySelectorAll('.part-row');
    
    if (partRows.length === 0) {
        alert("Lütfen en az bir parça ekleyin.");
        return;
    }

    partRows.forEach(row => {
        const name = row.querySelector('.part-name').value.trim();
        const qty = parseInt(row.querySelector('.part-qty').value);
        const widthFormula = row.querySelector('.part-width').value.trim();
        const heightFormula = row.querySelector('.part-height').value.trim();
        
        if(name && qty > 0 && widthFormula && heightFormula) {
            parts.push({ name, qty, widthFormula, heightFormula });
        }
    });

    if (parts.length !== partRows.length) {
        alert("Lütfen tüm parça bilgilerini eksiksiz doldurun.");
        return;
    }

    // Veriyi Firestore'a kaydet
    try {
        saveModuleBtn.disabled = true;
        saveModuleBtn.textContent = 'Kaydediliyor...';

        await addDoc(collection(db, 'moduleTemplates'), {
            name: moduleName,
            userId: user.uid,
            categoryId: categoryId,
            parts: parts,
            createdAt: serverTimestamp()
        });

        alert('Modül şablonu başarıyla kaydedildi!');
        window.location.href = backButton.href; // Geri butonunun linkine yönlendir

    } catch (error) {
        console.error("Modül kaydedilirken hata oluştu: ", error);
        alert("Modül kaydedilirken bir hata oluştu. Lütfen tekrar deneyin.");
        saveModuleBtn.disabled = false;
        saveModuleBtn.textContent = 'Şablonu Kaydet';
    }
});

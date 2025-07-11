// Gerekli Firebase Fonksiyonlarını Import Etme
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { 
    getFirestore, 
    addDoc, 
    updateDoc,
    doc,
    getDoc,
    collection, 
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

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
const pageTitle = document.querySelector('h3');
const moduleForm = document.getElementById('moduleForm');
const moduleNameInput = document.getElementById('moduleName');
const partsContainer = document.getElementById('partsContainer');
const addPartBtn = document.getElementById('addPartBtn');
const saveModuleBtn = document.getElementById('saveModuleBtn');
const backButton = document.getElementById('backButton');
const logoutButton = document.getElementById('logoutButton');

let categoryId = null;
let moduleId = null; // Düzenleme modu için modül ID'sini tutacak

// Sayfa yüklendiğinde çalışacak ana fonksiyon
document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    categoryId = params.get('categoryId');
    moduleId = params.get('moduleId'); // moduleId'yi de al

    if (!categoryId) {
        alert("Kategori ID'si bulunamadı!");
        window.location.href = 'modules.html';
        return;
    }
    
    backButton.href = `module-list.html?id=${categoryId}`;

    onAuthStateChanged(auth, user => {
        if (user) {
            if (moduleId) {
                // Eğer URL'de moduleId varsa, bu bir DÜZENLEME modudur.
                loadModuleForEditing(moduleId);
            } else {
                // moduleId yoksa, bu bir YENİ EKLEME modudur.
                pageTitle.textContent = 'Yeni Modül Şablonu Oluştur';
                saveModuleBtn.textContent = 'Şablonu Kaydet';
            }
        } else {
            window.location.href = 'index.html';
        }
    });
});

// Çıkış yap butonu
logoutButton.addEventListener('click', () => signOut(auth));

// Düzenleme için modül verilerini yükleyen fonksiyon
const loadModuleForEditing = async (id) => {
    pageTitle.textContent = 'Modül Şablonunu Düzenle';
    saveModuleBtn.textContent = 'Değişiklikleri Kaydet';

    try {
        const docRef = doc(db, 'moduleTemplates', id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const moduleData = docSnap.data();
            moduleNameInput.value = moduleData.name;
            
            // Kayıtlı parçaları ekrana çiz
            partsContainer.innerHTML = ''; // Önce mevcutları temizle
            moduleData.parts.forEach(part => {
                addPartRow(part.name, part.qty, part.widthFormula, part.heightFormula);
            });
        } else {
            alert("Düzenlenecek modül bulunamadı.");
            window.location.href = backButton.href;
        }
    } catch (error) {
        console.error("Modül yüklenirken hata: ", error);
        alert("Modül bilgileri yüklenirken bir hata oluştu.");
    }
};

// Ekrana yeni bir parça satırı ekleyen fonksiyon
const addPartRow = (name = '', qty = 1, width = '', height = '') => {
    const partId = `part-${Date.now()}`;
    const partElement = document.createElement('div');
    partElement.className = 'card mb-2 part-row';
    partElement.id = partId;
    partElement.innerHTML = `
        <div class="card-body">
            <div class="row g-2 align-items-center">
                <div class="col-md-3">
                    <label class="form-label">Parça Adı</label>
                    <input type="text" class="form-control form-control-sm part-name" placeholder="Sol Yan" value="${name}" required>
                </div>
                <div class="col-md-1">
                    <label class="form-label">Adet</label>
                    <input type="number" class="form-control form-control-sm part-qty" value="${qty}" required>
                </div>
                <div class="col-md-3">
                    <label class="form-label">Genişlik Formülü</label>
                    <input type="text" class="form-control form-control-sm part-width" placeholder="D" value="${width}" required>
                </div>
                <div class="col-md-3">
                    <label class="form-label">Yükseklik/Derinlik Formülü</label>
                    <input type="text" class="form-control form-control-sm part-height" placeholder="B" value="${height}" required>
                </div>
                <div class="col-md-2 text-end align-self-end">
                    <button type="button" class="btn btn-sm btn-outline-danger" onclick="document.getElementById('${partId}').remove()">Sil</button>
                </div>
            </div>
        </div>
    `;
    partsContainer.appendChild(partElement);
};

// "+ Parça Ekle" butonuna tıklandığında boş bir satır ekle
addPartBtn.addEventListener('click', () => addPartRow());

// Formu Kaydetme (Hem Ekleme Hem Güncelleme)
moduleForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = auth.currentUser;
    const moduleName = moduleNameInput.value.trim();

    if (!user || !moduleName) {
        alert("Modül adı boş bırakılamaz.");
        return;
    }

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

    const dataToSave = {
        name: moduleName,
        userId: user.uid,
        categoryId: categoryId,
        parts: parts,
        createdAt: serverTimestamp() // Her kayıtta güncellenir
    };

    try {
        saveModuleBtn.disabled = true;
        saveModuleBtn.textContent = 'Kaydediliyor...';

        if (moduleId) {
            // GÜNCELLEME MODU
            const docRef = doc(db, 'moduleTemplates', moduleId);
            await updateDoc(docRef, dataToSave);
            alert('Modül şablonu başarıyla güncellendi!');
        } else {
            // YENİ EKLEME MODU
            await addDoc(collection(db, 'moduleTemplates'), dataToSave);
            alert('Modül şablonu başarıyla kaydedildi!');
        }
        
        window.location.href = backButton.href;

    } catch (error) {
        console.error("Modül kaydedilirken hata oluştu: ", error);
        alert("Modül kaydedilirken bir hata oluştu. Lütfen tekrar deneyin.");
        saveModuleBtn.disabled = false;
        saveModuleBtn.textContent = moduleId ? 'Değişiklikleri Kaydet' : 'Şablonu Kaydet';
    }
});

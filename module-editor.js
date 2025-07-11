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
const partRowTemplate = document.getElementById('partRowTemplate');

let categoryId = null;
let moduleId = null; 

// Sayfa yüklendiğinde çalışacak ana fonksiyon
document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    categoryId = params.get('categoryId');
    moduleId = params.get('moduleId');

    if (!categoryId) {
        alert("Kategori ID'si bulunamadı!");
        window.location.href = 'modules.html';
        return;
    }
    
    backButton.href = `module-list.html?id=${categoryId}`;

    onAuthStateChanged(auth, user => {
        if (user) {
            if (moduleId) {
                loadModuleForEditing(moduleId);
            } else {
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
            
            partsContainer.innerHTML = '';
            moduleData.parts.forEach(part => {
                addPartRow(part.name, part.qty, part.heightFormula, part.widthFormula, part.depthFormula);
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

// Ekrana yeni bir parça satırı ekleyen fonksiyon (GÜNCELLENDİ)
const addPartRow = (name = '', qty = 1, height = '', width = '', depth = '') => {
    const templateContent = partRowTemplate.content.cloneNode(true);
    const partRow = templateContent.querySelector('.part-row');
    
    partRow.querySelector('.part-name').value = name;
    partRow.querySelector('.part-qty').value = qty;
    partRow.querySelector('.part-height').value = height;
    partRow.querySelector('.part-width').value = width;
    partRow.querySelector('.part-depth').value = depth; // Yeni alanı doldur

    partsContainer.appendChild(templateContent);
};

// "+ Parça Ekle" butonuna tıklandığında boş bir satır ekle
addPartBtn.addEventListener('click', () => addPartRow());

// Sil butonlarına olay dinleyici ekle
partsContainer.addEventListener('click', (e) => {
    if (e.target.classList.contains('remove-part-btn')) {
        e.target.closest('.part-row').remove();
    }
});


// Formu Kaydetme (Hem Ekleme Hem Güncelleme) (GÜNCELLENDİ)
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
        const heightFormula = row.querySelector('.part-height').value.trim();
        const widthFormula = row.querySelector('.part-width').value.trim();
        const depthFormula = row.querySelector('.part-depth').value.trim(); // Yeni alanı oku
        
        // Boy ve En formülleri zorunlu, Derinlik opsiyonel
        if(name && qty > 0 && heightFormula && widthFormula) {
            parts.push({ name, qty, heightFormula, widthFormula, depthFormula });
        }
    });

    if (parts.length !== partRows.length) {
        alert("Lütfen tüm parça bilgilerini (Boy ve En formülleri dahil) eksiksiz doldurun.");
        return;
    }

    const dataToSave = {
        name: moduleName,
        userId: user.uid,
        categoryId: categoryId,
        parts: parts,
        createdAt: serverTimestamp() 
    };

    try {
        saveModuleBtn.disabled = true;
        saveModuleBtn.textContent = 'Kaydediliyor...';

        if (moduleId) {
            const docRef = doc(db, 'moduleTemplates', moduleId);
            await updateDoc(docRef, dataToSave);
            alert('Modül şablonu başarıyla güncellendi!');
        } else {
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

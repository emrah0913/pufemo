// Gerekli Firebase Fonksiyonlarını Import Etme
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
    getDoc,
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
const materialListEl = document.getElementById('materialList');
const loadingIndicator = document.getElementById('loadingIndicator');
const materialModal = new bootstrap.Modal(document.getElementById('materialModal'));
const materialForm = document.getElementById('materialForm');
const modalTitle = document.getElementById('modalTitle');
const saveMaterialBtn = document.getElementById('saveMaterialBtn');
const addMaterialBtn = document.getElementById('addMaterialBtn');
const logoutButton = document.getElementById('logoutButton');

let currentUser = null;

// Oturum kontrolü
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        fetchMaterials(user.uid);
    } else {
        window.location.href = 'index.html';
    }
});

// Çıkış yap
logoutButton.addEventListener('click', () => signOut(auth));

// Malzemeleri Firestore'dan çek ve listele
const fetchMaterials = (userId) => {
    loadingIndicator.classList.remove('d-none');
    const q = query(
        collection(db, 'materials'), 
        where('userId', '==', userId), 
        orderBy('createdAt', 'desc')
    );

    onSnapshot(q, (snapshot) => {
        loadingIndicator.classList.add('d-none');
        materialListEl.innerHTML = '';
        if (snapshot.empty) {
            materialListEl.innerHTML = '<p class="text-center text-muted">Henüz hiç malzeme tanımlamadınız.</p>';
            return;
        }
        snapshot.forEach(doc => {
            const material = doc.data();
            const materialId = doc.id;
            const materialElement = `
                <div class="list-group-item d-flex justify-content-between align-items-center">
                    <div>
                        <h5 class="mb-1">${material.name} <span class="badge bg-secondary">${material.type}</span></h5>
                        <p class="mb-1 text-muted">
                            Stok: <strong>${material.stock} ${material.unit}</strong> | Fiyat: <strong>${material.price} ₺/${material.unit}</strong>
                        </p>
                        <small class="text-muted">${material.notes || ''}</small>
                    </div>
                    <div>
                        <button class="btn btn-sm btn-outline-secondary" onclick="window.openEditModal('${materialId}')">Düzenle</button>
                        <button class="btn btn-sm btn-outline-danger ms-2" onclick="window.deleteMaterial('${materialId}')">Sil</button>
                    </div>
                </div>
            `;
            materialListEl.innerHTML += materialElement;
        });
    }, (error) => {
        console.error("Malzemeler getirilirken hata: ", error);
        if (error.code === 'failed-precondition') {
             alert("Veritabanı yapılandırması gerekiyor. Lütfen geliştirici konsolundaki (F12) linke tıklayarak gerekli indeksi oluşturun.");
        } else {
            alert("Malzemeler yüklenirken bir hata oluştu.");
        }
    });
};

// Yeni malzeme ekle butonuna basıldığında modalı temizle
addMaterialBtn.addEventListener('click', () => {
    materialForm.reset();
    document.getElementById('materialId').value = '';
    modalTitle.textContent = 'Yeni Malzeme Ekle';
});

// Malzeme Kaydetme (Ekleme ve Güncelleme)
saveMaterialBtn.addEventListener('click', async () => {
    const materialId = document.getElementById('materialId').value;
    const data = {
        name: document.getElementById('materialName').value.trim(),
        type: document.getElementById('materialType').value,
        unit: document.getElementById('materialUnit').value,
        stock: parseFloat(document.getElementById('materialStock').value) || 0,
        price: parseFloat(document.getElementById('materialPrice').value) || 0,
        notes: document.getElementById('materialNotes').value.trim(),
        userId: currentUser.uid,
    };

    if (!data.name) {
        alert("Malzeme adı boş olamaz.");
        return;
    }

    try {
        if (materialId) {
            // Güncelleme
            await updateDoc(doc(db, 'materials', materialId), data);
        } else {
            // Ekleme
            data.createdAt = serverTimestamp();
            await addDoc(collection(db, 'materials'), data);
        }
        materialModal.hide();
    } catch (error) {
        console.error("Malzeme kaydedilirken hata: ", error);
        alert("İşlem sırasında bir hata oluştu.");
    }
});

// Düzenleme Modalı Açma
window.openEditModal = async (materialId) => {
    materialForm.reset();
    modalTitle.textContent = 'Malzemeyi Düzenle';
    
    const docRef = doc(db, 'materials', materialId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
        const data = docSnap.data();
        document.getElementById('materialId').value = materialId;
        document.getElementById('materialName').value = data.name;
        document.getElementById('materialType').value = data.type;
        document.getElementById('materialUnit').value = data.unit;
        document.getElementById('materialStock').value = data.stock;
        document.getElementById('materialPrice').value = data.price;
        document.getElementById('materialNotes').value = data.notes;
        materialModal.show();
    } else {
        alert("Malzeme bulunamadı.");
    }
};

// Malzeme Silme
window.deleteMaterial = async (materialId) => {
    if (confirm("Bu malzemeyi silmek istediğinizden emin misiniz?")) {
        try {
            await deleteDoc(doc(db, 'materials', materialId));
        } catch (error) {
            alert("Malzeme silinirken bir hata oluştu.");
            console.error(error);
        }
    }
};

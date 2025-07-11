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
    serverTimestamp,
    query,
    where,
    getDocs
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
const accessoriesContainer = document.getElementById('accessoriesContainer');
const addPartBtn = document.getElementById('addPartBtn');
const addAccessoryBtn = document.getElementById('addAccessoryBtn');
const saveModuleBtn = document.getElementById('saveModuleBtn');
const backButton = document.getElementById('backButton');
const logoutButton = document.getElementById('logoutButton');
const partRowTemplate = document.getElementById('partRowTemplate');
const accessoryRowTemplate = document.getElementById('accessoryRowTemplate');
// Yeni Maliyet Hesaplayıcı Elementleri
const calculateSampleCostBtn = document.getElementById('calculateSampleCostBtn');
const sampleCostDisplay = document.getElementById('sampleCostDisplay');


let categoryId = null;
let moduleId = null; 
let allMaterials = new Map(); // Tüm malzemeleri ID'leriyle saklamak için
let currentUser = null;

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
            currentUser = user;
            loadAllMaterials().then(() => {
                if (moduleId) {
                    loadModuleForEditing(moduleId);
                } else {
                    pageTitle.textContent = 'Yeni Modül Şablonu Oluştur';
                }
            });
        } else {
            window.location.href = 'index.html';
        }
    });
});

// Tüm malzemeleri Firestore'dan çek ve Map'e kaydet
const loadAllMaterials = async () => {
    const q = query(collection(db, 'materials'), where('userId', '==', currentUser.uid));
    const querySnapshot = await getDocs(q);
    allMaterials.clear();
    querySnapshot.forEach(doc => {
        allMaterials.set(doc.id, { id: doc.id, ...doc.data() });
    });
};

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
            (moduleData.parts || []).forEach(part => {
                addPartRow(part.name, part.qty, part.heightFormula, part.widthFormula, part.materialId, part.banding);
            });

            accessoriesContainer.innerHTML = '';
            (moduleData.accessories || []).forEach(acc => {
                addAccessoryRow(acc.materialId, acc.qtyFormula);
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
const addPartRow = (name = '', qty = 1, height = '', width = '', materialId = '', banding = {}) => {
    const templateContent = partRowTemplate.content.cloneNode(true);
    const partRow = templateContent.querySelector('.part-row');
    
    const panelMaterials = Array.from(allMaterials.values()).filter(m => m.type === 'Panel');
    const bandingMaterials = Array.from(allMaterials.values()).filter(m => m.type === 'Kenar Bandı');

    const materialSelect = partRow.querySelector('.part-material');
    materialSelect.innerHTML = '<option value="">Panel Malzemesi Seçin...</option>';
    panelMaterials.forEach(mat => { materialSelect.innerHTML += `<option value="${mat.id}">${mat.name}</option>`; });

    const bandingSelect = partRow.querySelector('.part-banding-material');
    bandingSelect.innerHTML = '<option value="">Bant Malzemesi Seçin...</option>';
    bandingMaterials.forEach(mat => { bandingSelect.innerHTML += `<option value="${mat.id}">${mat.name}</option>`; });

    partRow.querySelector('.part-name').value = name;
    partRow.querySelector('.part-qty').value = qty;
    partRow.querySelector('.part-height').value = height;
    partRow.querySelector('.part-width').value = width;
    if (materialId) materialSelect.value = materialId;
    
    if (banding) {
        bandingSelect.value = banding.materialId || '';
        partRow.querySelector('.part-banding-b1').checked = banding.b1 || false;
        partRow.querySelector('.part-banding-b2').checked = banding.b2 || false;
        partRow.querySelector('.part-banding-e1').checked = banding.e1 || false;
        partRow.querySelector('.part-banding-e2').checked = banding.e2 || false;
    }

    partsContainer.appendChild(templateContent);
};

// Ekrana yeni bir aksesuar satırı ekleyen fonksiyon
const addAccessoryRow = (materialId = '', qtyFormula = '') => {
    const templateContent = accessoryRowTemplate.content.cloneNode(true);
    const accessoryRow = templateContent.querySelector('.accessory-row');
    
    const accessoryMaterials = Array.from(allMaterials.values()).filter(m => m.type === 'Aksesuar');
    const materialSelect = accessoryRow.querySelector('.accessory-material');
    materialSelect.innerHTML = '<option value="">Aksesuar Seçin...</option>';
    accessoryMaterials.forEach(mat => { materialSelect.innerHTML += `<option value="${mat.id}">${mat.name}</option>`; });

    accessoryRow.querySelector('.accessory-qty').value = qtyFormula;
    if (materialId) materialSelect.value = materialId;

    accessoriesContainer.appendChild(templateContent);
};

// Buton Olayları
addPartBtn.addEventListener('click', () => addPartRow());
addAccessoryBtn.addEventListener('click', () => addAccessoryRow());

// Silme Olayları
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('remove-part-btn')) e.target.closest('.part-row').remove();
    if (e.target.classList.contains('remove-accessory-btn')) e.target.closest('.accessory-row').remove();
});

// Örnek Maliyet Hesaplama Butonu (YENİ)
calculateSampleCostBtn.addEventListener('click', () => {
    const B = parseFloat(document.getElementById('sampleHeight').value);
    const E = parseFloat(document.getElementById('sampleWidth').value);
    const D = parseFloat(document.getElementById('sampleDepth').value);
    const K = parseFloat(document.getElementById('sampleThickness').value);

    if (!B || !E || !D || !K) {
        alert("Lütfen tüm örnek ölçüleri girin.");
        return;
    }

    let totalCost = 0;
    let errorOccurred = false;

    // Parça maliyetlerini hesapla
    document.querySelectorAll('.part-row').forEach(row => {
        if (errorOccurred) return;
        try {
            const materialId = row.querySelector('.part-material').value;
            const material = allMaterials.get(materialId);
            if (!material) return; // Malzeme seçilmemişse atla

            const height = eval(row.querySelector('.part-height').value.toUpperCase().replace(/ /g, ''));
            const width = eval(row.querySelector('.part-width').value.toUpperCase().replace(/ /g, ''));
            const qty = parseInt(row.querySelector('.part-qty').value);
            const area = (height / 1000) * (width / 1000); // m²
            totalCost += area * material.price * qty;

            // Kenar bandı maliyetini hesapla
            const bandingMaterialId = row.querySelector('.part-banding-material').value;
            const bandingMaterial = allMaterials.get(bandingMaterialId);
            if(bandingMaterial) {
                let totalBandingLength = 0; // metre
                if (row.querySelector('.part-banding-b1').checked) totalBandingLength += height / 1000;
                if (row.querySelector('.part-banding-b2').checked) totalBandingLength += height / 1000;
                if (row.querySelector('.part-banding-e1').checked) totalBandingLength += width / 1000;
                if (row.querySelector('.part-banding-e2').checked) totalBandingLength += width / 1000;
                totalCost += totalBandingLength * bandingMaterial.price * qty;
            }

        } catch (e) { errorOccurred = true; alert(`Bir parça formülünde hata var: ${e.message}`); }
    });

    // Aksesuar maliyetlerini hesapla
    document.querySelectorAll('.accessory-row').forEach(row => {
        if (errorOccurred) return;
        try {
            const materialId = row.querySelector('.accessory-material').value;
            const material = allMaterials.get(materialId);
            if (!material) return;

            const qty = Math.ceil(eval(row.querySelector('.accessory-qty').value.toUpperCase().replace(/ /g, '')));
            totalCost += qty * material.price;
        } catch (e) { errorOccurred = true; alert(`Bir aksesuar formülünde hata var: ${e.message}`); }
    });

    if (!errorOccurred) {
        sampleCostDisplay.textContent = `${totalCost.toFixed(2)} ₺`;
    }
});


// Formu Kaydetme
moduleForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const moduleName = moduleNameInput.value.trim();
    if (!moduleName) return alert("Modül adı boş bırakılamaz.");

    const parts = [];
    document.querySelectorAll('.part-row').forEach(row => {
        const data = {
            name: row.querySelector('.part-name').value.trim(),
            materialId: row.querySelector('.part-material').value,
            qty: parseInt(row.querySelector('.part-qty').value),
            heightFormula: row.querySelector('.part-height').value.trim(),
            widthFormula: row.querySelector('.part-width').value.trim(),
            banding: {
                materialId: row.querySelector('.part-banding-material').value,
                b1: row.querySelector('.part-banding-b1').checked,
                b2: row.querySelector('.part-banding-b2').checked,
                e1: row.querySelector('.part-banding-e1').checked,
                e2: row.querySelector('.part-banding-e2').checked,
            }
        };
        if(data.name && data.materialId && data.qty > 0 && data.heightFormula && data.widthFormula) {
            parts.push(data);
        }
    });

    const accessories = [];
    document.querySelectorAll('.accessory-row').forEach(row => {
        const data = {
            materialId: row.querySelector('.accessory-material').value,
            qtyFormula: row.querySelector('.accessory-qty').value.trim(),
        };
        if (data.materialId && data.qtyFormula) accessories.push(data);
    });

    const dataToSave = { name: moduleName, userId: currentUser.uid, categoryId, parts, accessories, createdAt: serverTimestamp() };

    try {
        saveModuleBtn.disabled = true;
        saveModuleBtn.textContent = 'Kaydediliyor...';
        if (moduleId) {
            await updateDoc(doc(db, 'moduleTemplates', moduleId), dataToSave);
            alert('Modül şablonu başarıyla güncellendi!');
        } else {
            await addDoc(collection(db, 'moduleTemplates'), dataToSave);
            alert('Modül şablonu başarıyla kaydedildi!');
        }
        window.location.href = backButton.href;
    } catch (error) {
        console.error("Kaydetme hatası: ", error);
        alert("İşlem sırasında bir hata oluştu.");
    }
});

// Çıkış yap
logoutButton.addEventListener('click', () => signOut(auth));

// Gerekli Firebase Fonksiyonlarını Import Etme
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    getDoc,
    updateDoc,
    arrayUnion,
    collection,
    query,
    where,
    getDocs,
    onSnapshot
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
const projectNameEl = document.getElementById('projectName');
const projectDescriptionEl = document.getElementById('projectDescription');
const partsListEl = document.getElementById('partsList');
const accessoriesListEl = document.getElementById('accessoriesList'); // Yeni
const loadingIndicator = document.getElementById('loadingIndicator');
const logoutButton = document.getElementById('logoutButton');
const moduleTemplateSelect = document.getElementById('moduleTemplateSelect');
const addModuleToProjectBtn = document.getElementById('addModuleToProjectBtn');
const addModuleModal = new bootstrap.Modal(document.getElementById('addModuleModal'));

let currentUser = null;
let projectId = null;
let moduleTemplates = [];

// Sayfa Yüklendiğinde
document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    projectId = params.get('id');

    if (!projectId) {
        alert("Proje ID'si bulunamadı!");
        window.location.href = 'projects.html';
        return;
    }

    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
            loadProjectDetails();
            loadModuleTemplates();
        } else {
            window.location.href = 'index.html';
        }
    });
});

// Proje detaylarını ve malzemeleri yükle
const loadProjectDetails = async () => {
    loadingIndicator.classList.remove('d-none');
    const projectRef = doc(db, 'projects', projectId);
    
    onSnapshot(projectRef, (docSnap) => {
        loadingIndicator.classList.add('d-none');
        if (docSnap.exists()) {
            const project = docSnap.data();
            projectNameEl.textContent = project.name;
            projectDescriptionEl.textContent = project.description || '';
            renderParts(project.parts || []);
            renderAccessories(project.accessories || []); // Yeni
        } else {
            alert("Proje bulunamadı.");
            window.location.href = 'projects.html';
        }
    });
};

// Parça listesini tabloya render et
const renderParts = (parts) => {
    partsListEl.innerHTML = '';
    if (parts.length === 0) {
        partsListEl.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Henüz hiç parça eklenmedi.</td></tr>';
        return;
    }
    parts.forEach(part => {
        const row = `
            <tr>
                <td>${part.name}</td>
                <td>${part.height}</td>
                <td>${part.width}</td>
                <td>${part.qty}</td>
                <td>${part.moduleInstanceName}</td>
                <td><button class="btn btn-sm btn-outline-danger" onclick="window.deletePart('${part.partId}')">Sil</button></td>
            </tr>
        `;
        partsListEl.innerHTML += row;
    });
};

// Aksesuar listesini tabloya render et (YENİ)
const renderAccessories = (accessories) => {
    accessoriesListEl.innerHTML = '';
    if (accessories.length === 0) {
        accessoriesListEl.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Henüz hiç aksesuar eklenmedi.</td></tr>';
        return;
    }
    accessories.forEach(acc => {
        const row = `
            <tr>
                <td>${acc.name}</td>
                <td>${acc.qty}</td>
                <td>${acc.moduleInstanceName}</td>
                <td><button class="btn btn-sm btn-outline-danger" onclick="window.deleteAccessory('${acc.accessoryId}')">Sil</button></td>
            </tr>
        `;
        accessoriesListEl.innerHTML += row;
    });
};

// Modül şablonlarını kütüphaneden çek
const loadModuleTemplates = async () => {
    const q = query(collection(db, 'moduleTemplates'), where('userId', '==', currentUser.uid));
    const querySnapshot = await getDocs(q);
    
    moduleTemplateSelect.innerHTML = '<option value="">Lütfen bir şablon seçin...</option>';
    querySnapshot.forEach(doc => {
        const template = { id: doc.id, ...doc.data() };
        moduleTemplates.push(template);
        moduleTemplateSelect.innerHTML += `<option value="${template.id}">${template.name}</option>`;
    });
};

// "Hesapla ve Projeye Ekle" Butonu (GÜNCELLENDİ)
addModuleToProjectBtn.addEventListener('click', async () => {
    const B = parseFloat(document.getElementById('moduleHeight').value);
    const E = parseFloat(document.getElementById('moduleWidth').value);
    const D = parseFloat(document.getElementById('moduleDepth').value);
    const K = parseFloat(document.getElementById('materialThickness').value);
    const templateId = document.getElementById('moduleTemplateSelect').value;
    const moduleInstanceName = document.getElementById('moduleInstanceName').value.trim() || 'İsimsiz Modül';

    if (!templateId || !B || !E || !D || !K) {
        alert("Lütfen tüm ölçüleri ve şablonu eksiksiz seçin.");
        return;
    }
    const selectedTemplate = moduleTemplates.find(t => t.id === templateId);
    if (!selectedTemplate) return;

    let errorOccurred = false;
    
    // Parçaları hesapla
    const calculatedParts = (selectedTemplate.parts || []).map(part => {
        try {
            return {
                partId: crypto.randomUUID(),
                name: part.name,
                width: eval(part.widthFormula.toUpperCase().replace(/ /g, '')),
                height: eval(part.heightFormula.toUpperCase().replace(/ /g, '')),
                qty: part.qty,
                moduleInstanceName,
            };
        } catch (e) { errorOccurred = true; alert(`'${part.name}' parça formülünde hata: ${e.message}`); }
    }).filter(Boolean);

    // Aksesuarları hesapla
    const calculatedAccessories = (selectedTemplate.accessories || []).map(acc => {
        try {
            return {
                accessoryId: crypto.randomUUID(),
                name: acc.name,
                qty: Math.ceil(eval(acc.qtyFormula.toUpperCase().replace(/ /g, ''))), // Formülü hesapla ve yukarı yuvarla
                moduleInstanceName,
            };
        } catch (e) { errorOccurred = true; alert(`'${acc.name}' aksesuar formülünde hata: ${e.message}`); }
    }).filter(Boolean);

    if (errorOccurred) return;

    try {
        const projectRef = doc(db, 'projects', projectId);
        await updateDoc(projectRef, {
            parts: arrayUnion(...calculatedParts),
            accessories: arrayUnion(...calculatedAccessories)
        });
        addModuleModal.hide();
        document.getElementById('calculateForm').reset();
    } catch (e) {
        console.error("Projeye eklenirken hata: ", e);
        alert("Malzemeler projeye eklenirken bir hata oluştu.");
    }
});

// Malzeme Silme Fonksiyonları
const deleteItem = async (itemId, itemType, fieldName) => {
    if (!confirm(`Bu ${itemType} listeden silmek istediğinizden emin misiniz?`)) return;
    try {
        const projectRef = doc(db, 'projects', projectId);
        const projectSnap = await getDoc(projectRef);
        if (projectSnap.exists()) {
            const currentItems = projectSnap.data()[fieldName] || [];
            const updatedItems = currentItems.filter(item => item[itemId] !== itemIdToDelete);
            await updateDoc(projectRef, { [fieldName]: updatedItems });
        }
    } catch (e) {
        alert(`${itemType} silinirken hata oluştu.`);
        console.error(e);
    }
};

window.deletePart = (partId) => deleteItem(partId, 'parçayı', 'parts');
window.deleteAccessory = (accessoryId) => deleteItem(accessoryId, 'aksesuarı', 'accessories');

// Çıkış yap
logoutButton.addEventListener('click', () => signOut(auth));

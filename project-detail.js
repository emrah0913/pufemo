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

// Değişkenleri globalde tanımla
let currentUser = null;
let projectId = null;
let moduleTemplates = [];
let allMaterials = new Map();
let isGroupedView = false;
let currentProjectData = {};

// Sayfa Yüklendiğinde
document.addEventListener('DOMContentLoaded', () => {
    // HTML Elementlerini tanımla
    const projectNameEl = document.getElementById('projectName');
    const projectDescriptionEl = document.getElementById('projectDescription');
    const totalCostEl = document.getElementById('totalCost');
    const partsListEl = document.getElementById('partsList');
    const accessoriesListEl = document.getElementById('accessoriesList');
    const partsTableHeader = document.getElementById('parts-table-header');
    const accessoriesTableHeader = document.getElementById('accessories-table-header');
    const groupViewToggle = document.getElementById('groupViewToggle');
    const loadingIndicator = document.getElementById('loadingIndicator');
    const logoutButton = document.getElementById('logoutButton');
    const optimizationLink = document.getElementById('optimizationLink');
    
    // Modül Ekleme Modalı Elementleri
    const moduleTemplateSelect = document.getElementById('moduleTemplateSelect');
    const addModuleToProjectBtn = document.getElementById('addModuleToProjectBtn');
    const addModuleModal = new bootstrap.Modal(document.getElementById('addModuleModal'));

    // Tek Parça Ekleme Modalı Elementleri
    const saveSinglePartBtn = document.getElementById('saveSinglePartBtn');
    const singlePartModal = new bootstrap.Modal(document.getElementById('addSinglePartModal'));
    const singlePartMaterialSelect = document.getElementById('singlePartMaterial');
    const singlePartBandingMaterialSelect = document.getElementById('singlePartBandingMaterial');

    // Tek Aksesuar Ekleme Modalı Elementleri
    const saveSingleAccessoryBtn = document.getElementById('saveSingleAccessoryBtn');
    const singleAccessoryModal = new bootstrap.Modal(document.getElementById('addSingleAccessoryModal'));
    const singleAccessoryMaterialSelect = document.getElementById('singleAccessoryMaterial');

    const params = new URLSearchParams(window.location.search);
    projectId = params.get('id');

    if (!projectId) {
        alert("Proje ID'si bulunamadı!");
        window.location.href = 'projects.html';
        return;
    }

    // Optimizasyon linkini ayarla
    optimizationLink.href = `optimization.html?id=${projectId}`;

    // Tüm malzemeleri Firestore'dan çek
    const loadAllMaterials = async () => {
        const q = query(collection(db, 'materials'), where('userId', '==', currentUser.uid));
        const querySnapshot = await getDocs(q);
        allMaterials.clear();
        querySnapshot.forEach(doc => {
            allMaterials.set(doc.id, { id: doc.id, ...doc.data() });
        });
        populateSingleItemDropdowns();
    };

    // Proje detaylarını yükle
    const loadProjectDetails = async () => {
        loadingIndicator.classList.remove('d-none');
        const projectRef = doc(db, 'projects', projectId);
        
        onSnapshot(projectRef, (docSnap) => {
            loadingIndicator.classList.add('d-none');
            if (docSnap.exists()) {
                currentProjectData = docSnap.data();
                projectNameEl.textContent = currentProjectData.name;
                projectDescriptionEl.textContent = currentProjectData.description || '';
                renderAllLists();
                calculateAndDisplayTotalCost(currentProjectData.parts || [], currentProjectData.accessories || []);
            } else {
                alert("Proje bulunamadı.");
                window.location.href = 'projects.html';
            }
        });
    };
    
    const renderAllLists = () => {
        renderParts(currentProjectData.parts || []);
        renderAccessories(currentProjectData.accessories || []);
    };

    // Parça listesini render et
    const renderParts = (parts) => {
        partsListEl.innerHTML = '';
        if (isGroupedView) {
            partsTableHeader.innerHTML = `<th>Parça Adı</th><th>Malzeme</th><th>Boy (mm)</th><th>En (mm)</th><th>Toplam Adet</th>`;
            const grouped = {};
            parts.forEach(p => {
                const bandingKey = p.banding ? `${p.banding.b1 || false}-${p.banding.b2 || false}-${p.banding.e1 || false}-${p.banding.e2 || false}` : 'none';
                const key = `${p.name}-${p.materialId}-${p.height}-${p.width}-${bandingKey}`;
                if (!grouped[key]) { grouped[key] = { ...p, qty: 0 }; }
                grouped[key].qty += p.qty;
            });
            Object.values(grouped).forEach(part => {
                const material = allMaterials.get(part.materialId);
                const row = `<tr><td>${part.name}</td><td>${material ? material.name : 'Bilinmeyen'}</td><td>${part.height}</td><td>${part.width}</td><td>${part.qty}</td></tr>`;
                partsListEl.innerHTML += row;
            });
        } else {
            partsTableHeader.innerHTML = `<th>Parça Adı</th><th>Boy (mm)</th><th>En (mm)</th><th>Adet</th><th>Ait Olduğu Modül</th><th>İşlemler</th>`;
            parts.forEach(part => {
                const row = `<tr><td>${part.name}</td><td>${part.height}</td><td>${part.width}</td><td>${part.qty}</td><td>${part.moduleInstanceName}</td><td><button class="btn btn-sm btn-outline-danger" onclick="window.deleteItem('${part.partId}', 'parçayı', 'parts')">Sil</button></td></tr>`;
                partsListEl.innerHTML += row;
            });
        }
    };

    // Aksesuar listesini render et
    const renderAccessories = (accessories) => {
        accessoriesListEl.innerHTML = '';
        if (isGroupedView) {
            accessoriesTableHeader.innerHTML = `<th>Aksesuar</th><th>Toplam Adet</th>`;
            // Gruplama mantığı...
        } else {
            accessoriesTableHeader.innerHTML = `<th>Aksesuar</th><th>Adet</th><th>Ait Olduğu Modül</th><th>İşlemler</th>`;
            accessories.forEach(acc => {
                const material = allMaterials.get(acc.materialId);
                const row = `<tr><td>${material ? material.name : 'Bilinmeyen'}</td><td>${acc.qty}</td><td>${acc.moduleInstanceName}</td><td><button class="btn btn-sm btn-outline-danger" onclick="window.deleteItem('${acc.accessoryId}', 'aksesuarı', 'accessories')">Sil</button></td></tr>`;
                accessoriesListEl.innerHTML += row;
            });
        }
    };

    // Toplam maliyet
    const calculateAndDisplayTotalCost = (parts, accessories) => {
        let totalCost = 0;
        parts.forEach(part => totalCost += (part.cost || 0));
        accessories.forEach(acc => totalCost += (acc.cost || 0));
        totalCostEl.textContent = `${totalCost.toFixed(2)} ₺`;
    };

    // Modül şablonlarını yükle
    const loadModuleTemplates = async () => {
        const q = query(collection(db, 'moduleTemplates'), where('userId', '==', currentUser.uid));
        const querySnapshot = await getDocs(q);
        moduleTemplateSelect.innerHTML = '<option value="">Lütfen bir şablon seçin...</option>';
        moduleTemplates = [];
        querySnapshot.forEach(doc => {
            const template = { id: doc.id, ...doc.data() };
            moduleTemplates.push(template);
            moduleTemplateSelect.innerHTML += `<option value="${template.id}">${template.name}</option>`;
        });
    };

    // Silme Fonksiyonu
    window.deleteItem = async (itemIdToDelete, itemType, fieldName) => {
        if (!confirm(`Bu ${itemType} listeden silmek istediğinizden emin misiniz?`)) return;
        try {
            const projectRef = doc(db, 'projects', projectId);
            const projectSnap = await getDoc(projectRef);
            if (projectSnap.exists()) {
                const idField = fieldName === 'parts' ? 'partId' : 'accessoryId';
                const currentItems = projectSnap.data()[fieldName] || [];
                const updatedItems = currentItems.filter(item => item[idField] !== itemIdToDelete);
                await updateDoc(projectRef, { [fieldName]: updatedItems });
            }
        } catch (e) { console.error(e); }
    };

    // Kimlik Kontrolü
    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
            loadAllMaterials().then(() => {
                loadProjectDetails();
                loadModuleTemplates();
            });
        } else { window.location.href = 'index.html'; }
    });

    logoutButton.addEventListener('click', () => signOut(auth));

    // --- KRİTİK GÜNCELLEME: MODÜL HESAPLAMA VE EKLEME ---
    addModuleToProjectBtn.addEventListener('click', async () => {
        const B = parseFloat(document.getElementById('moduleHeight').value);
        const E = parseFloat(document.getElementById('moduleWidth').value);
        const D = parseFloat(document.getElementById('moduleDepth').value);
        const K = parseFloat(document.getElementById('materialThickness').value);
        const templateId = document.getElementById('moduleTemplateSelect').value;
        const moduleInstanceNameRaw = document.getElementById('moduleInstanceName').value.trim() || 'İsimsiz Modül';
        
        // Yeni Adet Girişini Oku
        const moduleQtyInput = document.getElementById('moduleQuantity');
        const moduleTotalQty = moduleQtyInput ? parseInt(moduleQtyInput.value) || 1 : 1;

        if (!templateId || !B || !E || !D || !K) return alert("Lütfen tüm ölçüleri doldurun.");
        const selectedTemplate = moduleTemplates.find(t => t.id === templateId);
        if (!selectedTemplate) return;

        const moduleInstanceName = moduleTotalQty > 1 ? `${moduleInstanceNameRaw} (x${moduleTotalQty})` : moduleInstanceNameRaw;

        let errorOccurred = false;
        
        // PARÇALARI HESAPLA (Modül Adedi ile Çarp)
        const calculatedParts = (selectedTemplate.parts || []).map(part => {
            if (errorOccurred) return null;
            try {
                const material = allMaterials.get(part.materialId);
                const height = eval(part.heightFormula.toUpperCase().replace(/ /g, ''));
                const width = eval(part.widthFormula.toUpperCase().replace(/ /g, ''));
                
                // MİKTAR ÇARPANINI UYGULA
                const qty = part.qty * moduleTotalQty; 

                const area = (height / 1000) * (width / 1000);
                let cost = area * (material?.price || 0) * qty;

                // Kenar bandı maliyeti
                if (part.banding?.materialId) {
                    const bm = allMaterials.get(part.banding.materialId);
                    if (bm) {
                        let len = 0;
                        if (part.banding.b1) len += height / 1000;
                        if (part.banding.b2) len += height / 1000;
                        if (part.banding.e1) len += width / 1000;
                        if (part.banding.e2) len += width / 1000;
                        cost += len * bm.price * qty;
                    }
                }
                return { partId: crypto.randomUUID(), name: part.name, width, height, qty, materialId: part.materialId, cost, banding: part.banding, moduleInstanceName };
            } catch (e) { errorOccurred = true; return null; }
        }).filter(Boolean);

        // AKSESUARLARI HESAPLA (Modül Adedi ile Çarp)
        const calculatedAccessories = (selectedTemplate.accessories || []).map(acc => {
            if (errorOccurred) return null;
            try {
                const material = allMaterials.get(acc.materialId);
                const qty = Math.ceil(eval(acc.qtyFormula.toUpperCase().replace(/ /g, ''))) * moduleTotalQty; 
                const cost = qty * (material?.price || 0);
                return { accessoryId: crypto.randomUUID(), materialId: acc.materialId, qty, cost, moduleInstanceName };
            } catch (e) { errorOccurred = true; return null; }
        }).filter(Boolean);

        if (errorOccurred) return alert("Formül hesaplama hatası!");

        try {
            const projectRef = doc(db, 'projects', projectId);
            await updateDoc(projectRef, {
                parts: arrayUnion(...calculatedParts),
                accessories: arrayUnion(...calculatedAccessories)
            });
            addModuleModal.hide();
            document.getElementById('calculateForm').reset();
            if(moduleQtyInput) moduleQtyInput.value = 1;
        } catch (e) { alert("Hata oluştu."); console.error(e); }
    });

    // Tekil Ekleme Fonksiyonları (Dropdown Doldurma)
    const populateSingleItemDropdowns = () => {
        singlePartMaterialSelect.innerHTML = '<option value="">Panel Seçin...</option>';
        singlePartBandingMaterialSelect.innerHTML = '<option value="">Bant Seçin...</option>';
        singleAccessoryMaterialSelect.innerHTML = '<option value="">Aksesuar Seçin...</option>';
        allMaterials.forEach(m => {
            const opt = `<option value="${m.id}">${m.name}</option>`;
            if (m.type === 'Panel') singlePartMaterialSelect.innerHTML += opt;
            else if (m.type === 'Kenar Bandı') singlePartBandingMaterialSelect.innerHTML += opt;
            else if (m.type === 'Aksesuar') singleAccessoryMaterialSelect.innerHTML += opt;
        });
    };

    // Tek Parça Kaydet (Orijinal kodundaki fonksiyonun devamı)
    saveSinglePartBtn.addEventListener('click', async () => {
        const name = document.getElementById('singlePartName').value.trim();
        const materialId = document.getElementById('singlePartMaterial').value;
        const h = parseFloat(document.getElementById('singlePartHeight').value);
        const w = parseFloat(document.getElementById('singlePartWidth').value);
        const q = parseInt(document.getElementById('singlePartQty').value);
        if (!name || !materialId || !h || !w || !q) return alert("Eksik bilgi.");
        
        const m = allMaterials.get(materialId);
        let cost = (h/1000)*(w/1000)*m.price*q;
        const newPart = { partId: crypto.randomUUID(), name, width:w, height:h, qty:q, materialId, cost, moduleInstanceName: 'Tekil Parça' };
        
        try {
            await updateDoc(doc(db, 'projects', projectId), { parts: arrayUnion(newPart) });
            singlePartModal.hide();
        } catch (e) { console.error(e); }
    });

    // Gruplama ve Diğer Eventler (Orijinal Kodun Tamamı)
    groupViewToggle.addEventListener('change', (e) => {
        isGroupedView = e.target.checked;
        renderAllLists();
    });
});

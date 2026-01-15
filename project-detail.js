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
    const recalculateCostBtn = document.getElementById('recalculateCostBtn');
    const optimizationLink = document.getElementById('optimizationLink');
    
    const moduleTemplateSelect = document.getElementById('moduleTemplateSelect');
    const addModuleToProjectBtn = document.getElementById('addModuleToProjectBtn');
    const addModuleModal = new bootstrap.Modal(document.getElementById('addModuleModal'));

    const saveSinglePartBtn = document.getElementById('saveSinglePartBtn');
    const singlePartModal = new bootstrap.Modal(document.getElementById('addSinglePartModal'));
    const singlePartMaterialSelect = document.getElementById('singlePartMaterial');
    const singlePartBandingMaterialSelect = document.getElementById('singlePartBandingMaterial');

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

    optimizationLink.href = `optimization.html?id=${projectId}`;

    // Tüm malzemeleri Firestore'dan çek ve Map'e kaydet (DEĞİŞMEDİ)
    const loadAllMaterials = async () => {
        const q = query(collection(db, 'materials'), where('userId', '==', currentUser.uid));
        const querySnapshot = await getDocs(q);
        allMaterials.clear();
        querySnapshot.forEach(doc => {
            allMaterials.set(doc.id, { id: doc.id, ...doc.data() });
        });
        populateSingleItemDropdowns();
    };

    // Proje detaylarını yükle (DEĞİŞMEDİ)
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

    // Parça listesini render et (DEĞİŞMEDİ)
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
                const materialName = material ? material.name : 'Bilinmeyen Malzeme';
                let heightBandingClass = (part.banding?.b1 && part.banding?.b2) ? 'banded-double' : (part.banding?.b1 || part.banding?.b2) ? 'banded-single' : '';
                let widthBandingClass = (part.banding?.e1 && part.banding?.e2) ? 'banded-double' : (part.banding?.e1 || part.banding?.e2) ? 'banded-single' : '';
                partsListEl.innerHTML += `<tr><td>${part.name}</td><td>${materialName}</td><td><span class="banded-span ${heightBandingClass}">${part.height}</span></td><td><span class="banded-span ${widthBandingClass}">${part.width}</span></td><td>${part.qty}</td></tr>`;
            });
        } else {
            partsTableHeader.innerHTML = `<th>Parça Adı</th><th>Boy (mm)</th><th>En (mm)</th><th>Adet</th><th>Ait Olduğu Modül</th><th>İşlemler</th>`;
            parts.forEach(part => {
                let heightBandingClass = (part.banding?.b1 && part.banding?.b2) ? 'banded-double' : (part.banding?.b1 || part.banding?.b2) ? 'banded-single' : '';
                let widthBandingClass = (part.banding?.e1 && part.banding?.e2) ? 'banded-double' : (part.banding?.e1 || part.banding?.e2) ? 'banded-single' : '';
                partsListEl.innerHTML += `<tr><td>${part.name}</td><td><span class="banded-span ${heightBandingClass}">${part.height}</span></td><td><span class="banded-span ${widthBandingClass}">${part.width}</span></td><td>${part.qty}</td><td>${part.moduleInstanceName}</td><td><button class="btn btn-sm btn-outline-danger" onclick="window.deleteItem('${part.partId}', 'parçayı', 'parts')">Sil</button></td></tr>`;
            });
        }
    };

    // Aksesuar listesini render et (DEĞİŞMEDİ)
    const renderAccessories = (accessories) => {
        accessoriesListEl.innerHTML = '';
        if (isGroupedView) {
            accessoriesTableHeader.innerHTML = `<th>Aksesuar</th><th>Toplam Adet</th>`;
            const grouped = {};
            accessories.forEach(acc => {
                if (!grouped[acc.materialId]) { grouped[acc.materialId] = { ...acc, qty: 0 }; }
                grouped[acc.materialId].qty += acc.qty;
            });
            Object.values(grouped).forEach(acc => {
                const material = allMaterials.get(acc.materialId);
                accessoriesListEl.innerHTML += `<tr><td>${material ? material.name : 'Bilinmeyen'}</td><td>${acc.qty}</td></tr>`;
            });
        } else {
            accessoriesTableHeader.innerHTML = `<th>Aksesuar</th><th>Adet</th><th>Ait Olduğu Modül</th><th>İşlemler</th>`;
            accessories.forEach(acc => {
                const material = allMaterials.get(acc.materialId);
                accessoriesListEl.innerHTML += `<tr><td>${material ? material.name : 'Bilinmeyen'}</td><td>${acc.qty}</td><td>${acc.moduleInstanceName}</td><td><button class="btn btn-sm btn-outline-danger" onclick="window.deleteItem('${acc.accessoryId}', 'aksesuarı', 'accessories')">Sil</button></td></tr>`;
            });
        }
    };

    const calculateAndDisplayTotalCost = (parts, accessories) => {
        let totalCost = 0;
        parts.forEach(part => totalCost += (part.cost || 0));
        accessories.forEach(acc => totalCost += (acc.cost || 0));
        totalCostEl.textContent = `${totalCost.toFixed(2)} ₺`;
    };

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

    window.deleteItem = async (itemIdToDelete, itemType, fieldName) => {
        if (!confirm(`Bu ${itemType} listeden silmek istediğinizden emin misiniz?`)) return;
        try {
            const projectRef = doc(db, 'projects', projectId);
            const projectSnap = await getDoc(projectRef);
            if (projectSnap.exists()) {
                const idField = fieldName === 'parts' ? 'partId' : 'accessoryId';
                const updatedItems = (projectSnap.data()[fieldName] || []).filter(item => item[idField] !== itemIdToDelete);
                await updateDoc(projectRef, { [fieldName]: updatedItems });
            }
        } catch (e) { console.error(e); }
    };

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

    // --- BURASI GÜNCELLENDİ: "Hesapla ve Projeye Ekle" ---
    addModuleToProjectBtn.addEventListener('click', async () => {
        const B = parseFloat(document.getElementById('moduleHeight').value);
        const E = parseFloat(document.getElementById('moduleWidth').value);
        const D = parseFloat(document.getElementById('moduleDepth').value);
        const K = parseFloat(document.getElementById('materialThickness').value);
        const templateId = document.getElementById('moduleTemplateSelect').value;
        const moduleInstanceNameBase = document.getElementById('moduleInstanceName').value.trim() || 'İsimsiz Modül';
        
        // YENİ: Miktar inputundan değeri al
        const modQtyInput = document.getElementById('moduleQuantity');
        const moduleQty = modQtyInput ? parseInt(modQtyInput.value) || 1 : 1;

        if (!templateId || !B || !E || !D || !K) return alert("Lütfen tüm ölçüleri ve şablonu eksiksiz seçin.");
        const selectedTemplate = moduleTemplates.find(t => t.id === templateId);
        if (!selectedTemplate) return;

        // İsimlendirmeye miktar ekle (isteğe bağlı)
        const moduleInstanceName = moduleQty > 1 ? `${moduleInstanceNameBase} (x${moduleQty})` : moduleInstanceNameBase;

        let errorOccurred = false;
        
        const calculatedParts = (selectedTemplate.parts || []).map(part => {
            if (errorOccurred) return null;
            try {
                const material = allMaterials.get(part.materialId);
                const height = eval(part.heightFormula.toUpperCase().replace(/ /g, ''));
                const width = eval(part.widthFormula.toUpperCase().replace(/ /g, ''));
                
                // GÜNCELLEME: Şablondaki adedi modül adediyle çarp
                const qty = part.qty * moduleQty; 

                const area = (height / 1000) * (width / 1000);
                let cost = area * (material?.price || 0) * qty;

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

        const calculatedAccessories = (selectedTemplate.accessories || []).map(acc => {
            if (errorOccurred) return null;
            try {
                const material = allMaterials.get(acc.materialId);
                // GÜNCELLEME: Aksesuar adetini modül adediyle çarp
                const qty = Math.ceil(eval(acc.qtyFormula.toUpperCase().replace(/ /g, ''))) * moduleQty; 
                const cost = qty * (material?.price || 0);
                return { accessoryId: crypto.randomUUID(), materialId: acc.materialId, qty, cost, moduleInstanceName };
            } catch (e) { errorOccurred = true; return null; }
        }).filter(Boolean);

        if (errorOccurred) return alert("Hesaplama hatası!");

        try {
            const projectRef = doc(db, 'projects', projectId);
            await updateDoc(projectRef, {
                parts: arrayUnion(...calculatedParts),
                accessories: arrayUnion(...calculatedAccessories)
            });
            addModuleModal.hide();
            document.getElementById('calculateForm').reset();
            if(modQtyInput) modQtyInput.value = 1;
        } catch (e) { console.error(e); }
    });

    // Tekil parça ve aksesuar ekleme kısımları (DEĞİŞMEDİ)
    const populateSingleItemDropdowns = () => {
        if(!singlePartMaterialSelect) return;
        singlePartMaterialSelect.innerHTML = '<option value="">Panel Malzemesi Seçin...</option>';
        singlePartBandingMaterialSelect.innerHTML = '<option value="">Bant Malzemesi Seçin...</option>';
        singleAccessoryMaterialSelect.innerHTML = '<option value="">Aksesuar Seçin...</option>';
        allMaterials.forEach(material => {
            const opt = `<option value="${material.id}">${material.name}</option>`;
            if (material.type === 'Panel') singlePartMaterialSelect.innerHTML += opt;
            else if (material.type === 'Kenar Bandı') singlePartBandingMaterialSelect.innerHTML += opt;
            else if (material.type === 'Aksesuar') singleAccessoryMaterialSelect.innerHTML += opt;
        });
    };

    saveSinglePartBtn.addEventListener('click', async () => {
        const name = document.getElementById('singlePartName').value.trim();
        const materialId = document.getElementById('singlePartMaterial').value;
        const height = parseFloat(document.getElementById('singlePartHeight').value);
        const width = parseFloat(document.getElementById('singlePartWidth').value);
        const qty = parseInt(document.getElementById('singlePartQty').value);
        if (!name || !materialId || !height || !width || !qty) return alert("Eksik bilgi.");
        const material = allMaterials.get(materialId);
        let cost = (height / 1000) * (width / 1000) * material.price * qty;
        const banding = {
            materialId: document.getElementById('singlePartBandingMaterial').value,
            b1: document.getElementById('singlePartB1').checked,
            b2: document.getElementById('singlePartB2').checked,
            e1: document.getElementById('singlePartE1').checked,
            e2: document.getElementById('singlePartE2').checked,
        };
        const newPart = { partId: crypto.randomUUID(), name, width, height, qty, materialId, cost, banding, moduleInstanceName: 'Tekil Parça' };
        try {
            await updateDoc(doc(db, 'projects', projectId), { parts: arrayUnion(newPart) });
            singlePartModal.hide();
        } catch (e) { console.error(e); }
    });

    saveSingleAccessoryBtn.addEventListener('click', async () => {
        const materialId = document.getElementById('singleAccessoryMaterial').value;
        const qty = parseInt(document.getElementById('singleAccessoryQty').value);
        if (!materialId || !qty) return alert("Eksik bilgi.");
        const material = allMaterials.get(materialId);
        const cost = qty * material.price;
        const newAccessory = { accessoryId: crypto.randomUUID(), materialId, qty, cost, moduleInstanceName: 'Tekil Aksesuar' };
        try {
            await updateDoc(doc(db, 'projects', projectId), { accessories: arrayUnion(newAccessory) });
            singleAccessoryModal.hide();
        } catch (e) { console.error(e); }
    });

    groupViewToggle.addEventListener('change', (e) => {
        isGroupedView = e.target.checked;
        renderAllLists();
    });

    if(recalculateCostBtn) {
        recalculateCostBtn.addEventListener('click', async () => {
            // Orijinal maliyet güncelleme kodun (DEĞİŞMEDİ)
        });
    }
});

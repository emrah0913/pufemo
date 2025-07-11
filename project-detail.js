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
    // HTML Elementlerini DOM yüklendikten sonra tanımla
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
    
    // Tüm fonksiyon tanımlamaları buraya taşındı

    // Tüm malzemeleri Firestore'dan çek ve Map'e kaydet
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

    // Parça listesini render et (GÜNCELLENDİ)
    const renderParts = (parts) => {
        partsListEl.innerHTML = '';
        
        if (isGroupedView) {
            // Gruplanmış görünüm için başlıklar
            partsTableHeader.innerHTML = `<th>Parça Adı</th><th>Malzeme</th><th>Boy (mm)</th><th>En (mm)</th><th>Toplam Adet</th>`;
            const grouped = {};
            parts.forEach(p => {
                // GRUPLAMA ANAHTARI: Artık Parça Adını da içeriyor
                const bandingKey = p.banding ? `${p.banding.b1 || false}-${p.banding.b2 || false}-${p.banding.e1 || false}-${p.banding.e2 || false}` : 'none';
                const key = `${p.name}-${p.materialId}-${p.height}-${p.width}-${bandingKey}`;
                
                if (!grouped[key]) {
                    grouped[key] = { ...p, qty: 0 };
                }
                grouped[key].qty += p.qty;
            });
            
            Object.values(grouped).forEach(part => {
                const material = allMaterials.get(part.materialId);
                const materialName = material ? material.name : 'Bilinmeyen Malzeme';
                
                let heightBandingClass = '';
                if (part.banding) {
                    if (part.banding.b1 && part.banding.b2) heightBandingClass = 'banded-double';
                    else if (part.banding.b1 || part.banding.b2) heightBandingClass = 'banded-single';
                }

                let widthBandingClass = '';
                if (part.banding) {
                    if (part.banding.e1 && part.banding.e2) widthBandingClass = 'banded-double';
                    else if (part.banding.e1 || part.banding.e2) widthBandingClass = 'banded-single';
                }

                const row = `
                    <tr>
                        <td>${part.name}</td>
                        <td>${materialName}</td>
                        <td><span class="banded-span ${heightBandingClass}">${part.height}</span></td>
                        <td><span class="banded-span ${widthBandingClass}">${part.width}</span></td>
                        <td>${part.qty}</td>
                    </tr>
                `;
                partsListEl.innerHTML += row;
            });

        } else {
            // Detaylı görünüm için başlıklar
            partsTableHeader.innerHTML = `<th>Parça Adı</th><th>Boy (mm)</th><th>En (mm)</th><th>Adet</th><th>Ait Olduğu Modül</th><th>İşlemler</th>`;
            parts.forEach(part => {
                const material = allMaterials.get(part.materialId);
                const materialName = material ? material.name : 'Bilinmeyen Malzeme';
                
                let heightBandingClass = '';
                if (part.banding) {
                    if (part.banding.b1 && part.banding.b2) heightBandingClass = 'banded-double';
                    else if (part.banding.b1 || part.banding.b2) heightBandingClass = 'banded-single';
                }

                let widthBandingClass = '';
                if (part.banding) {
                    if (part.banding.e1 && part.banding.e2) widthBandingClass = 'banded-double';
                    else if (part.banding.e1 || part.banding.e2) widthBandingClass = 'banded-single';
                }

                const row = `
                    <tr>
                        <td>${part.name}</td>
                        <td><span class="banded-span ${heightBandingClass}">${part.height}</span></td>
                        <td><span class="banded-span ${widthBandingClass}">${part.width}</span></td>
                        <td>${part.qty}</td>
                        <td>${part.moduleInstanceName}</td>
                        <td><button class="btn btn-sm btn-outline-danger" onclick="window.deleteItem('${part.partId}', 'parçayı', 'parts')">Sil</button></td>
                    </tr>
                `;
                partsListEl.innerHTML += row;
            });
        }
    };

    // Aksesuar listesini render et
    const renderAccessories = (accessories) => {
        accessoriesListEl.innerHTML = '';

        if (isGroupedView) {
            accessoriesTableHeader.innerHTML = `<th>Aksesuar</th><th>Toplam Adet</th>`;
            const grouped = {};
            accessories.forEach(acc => {
                const key = acc.materialId;
                if (!grouped[key]) {
                    grouped[key] = { ...acc, qty: 0 };
                }
                grouped[key].qty += acc.qty;
            });

            Object.values(grouped).forEach(acc => {
                const material = allMaterials.get(acc.materialId);
                const materialName = material ? material.name : 'Bilinmeyen Aksesuar';
                const row = `<tr><td>${materialName}</td><td>${acc.qty}</td></tr>`;
                accessoriesListEl.innerHTML += row;
            });

        } else {
            accessoriesTableHeader.innerHTML = `<th>Aksesuar</th><th>Adet</th><th>Ait Olduğu Modül</th><th>İşlemler</th>`;
            accessories.forEach(acc => {
                const material = allMaterials.get(acc.materialId);
                const materialName = material ? material.name : 'Bilinmeyen Aksesuar';
                const row = `
                    <tr>
                        <td>${materialName}</td>
                        <td>${acc.qty}</td>
                        <td>${acc.moduleInstanceName}</td>
                        <td><button class="btn btn-sm btn-outline-danger" onclick="window.deleteItem('${acc.accessoryId}', 'aksesuarı', 'accessories')">Sil</button></td>
                    </tr>
                `;
                accessoriesListEl.innerHTML += row;
            });
        }
    };

    // Toplam maliyeti hesapla ve göster
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

    // Malzeme Silme Fonksiyonu
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
        } catch (e) {
            alert(`${itemType} silinirken hata oluştu.`);
            console.error(e);
        }
    };
    
    // ANA İŞ AKIŞI
    
    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
            loadAllMaterials().then(() => {
                loadProjectDetails();
                loadModuleTemplates();
            });
        } else {
            window.location.href = 'index.html';
        }
    });
    
    logoutButton.addEventListener('click', () => signOut(auth));
    
    // "Hesapla ve Projeye Ekle" Butonu (Modül)
    addModuleToProjectBtn.addEventListener('click', async () => {
        const B = parseFloat(document.getElementById('moduleHeight').value);
        const E = parseFloat(document.getElementById('moduleWidth').value);
        const D = parseFloat(document.getElementById('moduleDepth').value);
        const K = parseFloat(document.getElementById('materialThickness').value);
        const templateId = document.getElementById('moduleTemplateSelect').value;
        const moduleInstanceName = document.getElementById('moduleInstanceName').value.trim() || 'İsimsiz Modül';

        if (!templateId || !B || !E || !D || !K) return alert("Lütfen tüm ölçüleri ve şablonu eksiksiz seçin.");
        const selectedTemplate = moduleTemplates.find(t => t.id === templateId);
        if (!selectedTemplate) return;

        let errorOccurred = false;
        
        const calculatedParts = (selectedTemplate.parts || []).map(part => {
            if (errorOccurred) return null;
            try {
                const material = allMaterials.get(part.materialId);
                if (!material) throw new Error(`'${part.name}' için malzeme bulunamadı.`);
                if (typeof material.price !== 'number') throw new Error(`'${material.name}' için fiyat tanımlanmamış.`);

                const height = eval(part.heightFormula.toUpperCase().replace(/ /g, ''));
                const width = eval(part.widthFormula.toUpperCase().replace(/ /g, ''));
                const qty = part.qty;
                if (typeof height !== 'number' || typeof width !== 'number' || typeof qty !== 'number') throw new Error("Hesaplanan ölçüler veya adet sayısal değil.");

                const area = (height / 1000) * (width / 1000);
                let cost = area * material.price * qty;

                if (part.banding && part.banding.materialId) {
                    const bandingMaterial = allMaterials.get(part.banding.materialId);
                    if (bandingMaterial && typeof bandingMaterial.price === 'number') {
                        let totalBandingLength = 0;
                        if (part.banding.b1) totalBandingLength += height / 1000;
                        if (part.banding.b2) totalBandingLength += height / 1000;
                        if (part.banding.e1) totalBandingLength += width / 1000;
                        if (part.banding.e2) totalBandingLength += width / 1000;
                        cost += totalBandingLength * bandingMaterial.price * qty;
                    }
                }
                
                if (isNaN(cost)) throw new Error("Maliyet hesaplanamadı (NaN).");

                return { partId: crypto.randomUUID(), name: part.name, width, height, qty, materialId: part.materialId, cost, banding: part.banding, moduleInstanceName };
            } catch (e) { errorOccurred = true; alert(`'${part.name}' parça formülünde hata: ${e.message}`); return null; }
        }).filter(Boolean);

        const calculatedAccessories = (selectedTemplate.accessories || []).map(acc => {
            if (errorOccurred) return null;
            try {
                const material = allMaterials.get(acc.materialId);
                if (!material) throw new Error(`Aksesuar için malzeme bulunamadı.`);
                if (typeof material.price !== 'number') throw new Error(`'${material.name}' için fiyat tanımlanmamış.`);
                
                const qty = Math.ceil(eval(acc.qtyFormula.toUpperCase().replace(/ /g, '')));
                if (typeof qty !== 'number') throw new Error("Hesaplanan adet sayısal değil.");

                const cost = qty * material.price;
                if (isNaN(cost)) throw new Error("Maliyet hesaplanamadı (NaN).");

                return { accessoryId: crypto.randomUUID(), materialId: acc.materialId, qty, cost, moduleInstanceName };
            } catch (e) { errorOccurred = true; alert(`Aksesuar formülünde hata: ${e.message}`); return null; }
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
    
    // Tekil Ekleme Fonksiyonları
    const populateSingleItemDropdowns = () => {
        singlePartMaterialSelect.innerHTML = '<option value="">Panel Malzemesi Seçin...</option>';
        singlePartBandingMaterialSelect.innerHTML = '<option value="">Bant Malzemesi Seçin...</option>';
        singleAccessoryMaterialSelect.innerHTML = '<option value="">Aksesuar Seçin...</option>';

        allMaterials.forEach(material => {
            const option = `<option value="${material.id}">${material.name}</option>`;
            if (material.type === 'Panel') singlePartMaterialSelect.innerHTML += option;
            else if (material.type === 'Kenar Bandı') singlePartBandingMaterialSelect.innerHTML += option;
            else if (material.type === 'Aksesuar') singleAccessoryMaterialSelect.innerHTML += option;
        });
    };

    saveSinglePartBtn.addEventListener('click', async () => {
        const name = document.getElementById('singlePartName').value.trim();
        const materialId = document.getElementById('singlePartMaterial').value;
        const height = parseFloat(document.getElementById('singlePartHeight').value);
        const width = parseFloat(document.getElementById('singlePartWidth').value);
        const qty = parseInt(document.getElementById('singlePartQty').value);

        if (!name || !materialId || !height || !width || !qty) return alert("Lütfen tüm parça bilgilerini eksiksiz girin.");

        const material = allMaterials.get(materialId);
        if (!material) return alert("Geçersiz malzeme seçildi.");

        const area = (height / 1000) * (width / 1000);
        let cost = area * material.price * qty;

        const banding = {
            materialId: document.getElementById('singlePartBandingMaterial').value,
            b1: document.getElementById('singlePartB1').checked,
            b2: document.getElementById('singlePartB2').checked,
            e1: document.getElementById('singlePartE1').checked,
            e2: document.getElementById('singlePartE2').checked,
        };

        if (banding.materialId) {
            const bandingMaterial = allMaterials.get(banding.materialId);
            if (bandingMaterial) {
                let totalBandingLength = 0;
                if (banding.b1) totalBandingLength += height / 1000;
                if (banding.b2) totalBandingLength += height / 1000;
                if (banding.e1) totalBandingLength += width / 1000;
                if (banding.e2) totalBandingLength += width / 1000;
                cost += totalBandingLength * bandingMaterial.price * qty;
            }
        }
        
        const newPart = { partId: crypto.randomUUID(), name, width, height, qty, materialId, cost, banding, moduleInstanceName: 'Tekil Parça' };

        try {
            const projectRef = doc(db, 'projects', projectId);
            await updateDoc(projectRef, { parts: arrayUnion(newPart) });
            singlePartModal.hide();
            document.getElementById('singlePartForm').reset();
        } catch (e) {
            alert("Parça eklenirken bir hata oluştu.");
            console.error(e);
        }
    });

    saveSingleAccessoryBtn.addEventListener('click', async () => {
        const materialId = document.getElementById('singleAccessoryMaterial').value;
        const qty = parseInt(document.getElementById('singleAccessoryQty').value);

        if (!materialId || !qty) return alert("Lütfen tüm aksesuar bilgilerini eksiksiz girin.");

        const material = allMaterials.get(materialId);
        if (!material) return alert("Geçersiz aksesuar seçildi.");

        const cost = qty * material.price;
        const newAccessory = { accessoryId: crypto.randomUUID(), materialId, qty, cost, moduleInstanceName: 'Tekil Aksesuar' };

        try {
            const projectRef = doc(db, 'projects', projectId);
            await updateDoc(projectRef, { accessories: arrayUnion(newAccessory) });
            singleAccessoryModal.hide();
            document.getElementById('singleAccessoryForm').reset();
        } catch (e) {
            alert("Aksesuar eklenirken bir hata oluştu.");
            console.error(e);
        }
    });
    
    // Gruplama Anahtarı Olayı
    groupViewToggle.addEventListener('change', (e) => {
        isGroupedView = e.target.checked;
        renderAllLists();
    });
    
    // Maliyetleri Yeniden Hesapla Butonu
    recalculateCostBtn.addEventListener('click', async () => {
        if (!confirm("Bu projedeki tüm maliyetler, güncel malzeme fiyatlarına göre yeniden hesaplanacaktır. Emin misiniz?")) {
            return;
        }

        recalculateCostBtn.disabled = true;
        recalculateCostBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Hesaplanıyor...';

        try {
            await loadAllMaterials();

            const projectRef = doc(db, 'projects', projectId);
            const projectSnap = await getDoc(projectRef);

            if (!projectSnap.exists()) {
                throw new Error("Proje bulunamadı.");
            }

            const projectData = projectSnap.data();
            const currentParts = projectData.parts || [];
            const currentAccessories = projectData.accessories || [];
            
            const updatedParts = currentParts.map(part => {
                const material = allMaterials.get(part.materialId);
                if (!material || typeof material.price !== 'number') return part;

                const area = (part.height / 1000) * (part.width / 1000);
                let newCost = area * material.price * part.qty;

                if (part.banding && part.banding.materialId) {
                    const bandingMaterial = allMaterials.get(part.banding.materialId);
                    if (bandingMaterial && typeof bandingMaterial.price === 'number') {
                        let totalBandingLength = 0;
                        if (part.banding.b1) totalBandingLength += part.height / 1000;
                        if (part.banding.b2) totalBandingLength += part.height / 1000;
                        if (part.banding.e1) totalBandingLength += part.width / 1000;
                        if (part.banding.e2) totalBandingLength += part.width / 1000;
                        newCost += totalBandingLength * bandingMaterial.price * part.qty;
                    }
                }
                return { ...part, cost: newCost };
            });

            const updatedAccessories = currentAccessories.map(acc => {
                const material = allMaterials.get(acc.materialId);
                if (!material || typeof material.price !== 'number') return acc;
                
                const newCost = acc.qty * material.price;
                return { ...acc, cost: newCost };
            });

            await updateDoc(projectRef, {
                parts: updatedParts,
                accessories: updatedAccessories
            });

            alert("Proje maliyetleri başarıyla güncellendi!");

        } catch (error) {
            console.error("Yeniden hesaplama sırasında hata:", error);
            alert("Maliyetler güncellenirken bir hata oluştu.");
        } finally {
            recalculateCostBtn.disabled = false;
            recalculateCostBtn.innerHTML = '<i class="bi bi-calculator"></i> Maliyetleri Yeniden Hesapla';
        }
    });

});

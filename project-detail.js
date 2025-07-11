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

// Sayfa Yüklendiğinde
document.addEventListener('DOMContentLoaded', () => {
    // HTML Elementlerini DOM yüklendikten sonra tanımla
    const projectNameEl = document.getElementById('projectName');
    const projectDescriptionEl = document.getElementById('projectDescription');
    const totalCostEl = document.getElementById('totalCost');
    const partsListEl = document.getElementById('partsList');
    const accessoriesListEl = document.getElementById('accessoriesList');
    const loadingIndicator = document.getElementById('loadingIndicator');
    const logoutButton = document.getElementById('logoutButton');
    const moduleTemplateSelect = document.getElementById('moduleTemplateSelect');
    const addModuleToProjectBtn = document.getElementById('addModuleToProjectBtn');
    const addModuleModal = new bootstrap.Modal(document.getElementById('addModuleModal'));

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
    };

    // Proje detaylarını yükle
    const loadProjectDetails = async () => {
        loadingIndicator.classList.remove('d-none');
        const projectRef = doc(db, 'projects', projectId);
        
        onSnapshot(projectRef, (docSnap) => {
            loadingIndicator.classList.add('d-none');
            if (docSnap.exists()) {
                const project = docSnap.data();
                projectNameEl.textContent = project.name;
                projectDescriptionEl.textContent = project.description || '';
                
                const parts = project.parts || [];
                const accessories = project.accessories || [];

                renderParts(parts);
                renderAccessories(accessories);
                calculateAndDisplayTotalCost(parts, accessories);
            } else {
                alert("Proje bulunamadı.");
                window.location.href = 'projects.html';
            }
        });
    };

    // Parça listesini render et
    const renderParts = (parts) => {
        partsListEl.innerHTML = '';
        if (parts.length === 0) {
            partsListEl.innerHTML = '<tr><td colspan="7" class="text-center text-muted">Henüz hiç parça eklenmedi.</td></tr>';
            return;
        }
        parts.forEach(part => {
            const material = allMaterials.get(part.materialId);
            const materialName = material ? material.name : 'Bilinmeyen Malzeme';
            const cost = part.cost ? part.cost.toFixed(2) : '0.00';
            
            let heightBandingClass = '';
            if (part.banding.b1 && part.banding.b2) heightBandingClass = 'banded-double';
            else if (part.banding.b1 || part.banding.b2) heightBandingClass = 'banded-single';

            let widthBandingClass = '';
            if (part.banding.e1 && part.banding.e2) widthBandingClass = 'banded-double';
            else if (part.banding.e1 || part.banding.e2) widthBandingClass = 'banded-single';

            const row = `
                <tr>
                    <td>${part.name}</td>
                    <td class="${heightBandingClass}">${part.height}</td>
                    <td class="${widthBandingClass}">${part.width}</td>
                    <td>${part.qty}</td>
                    <td>${materialName}</td>
                    <td>${cost} ₺</td>
                    <td><button class="btn btn-sm btn-outline-danger" onclick="window.deleteItem('${part.partId}', 'parçayı', 'parts')">Sil</button></td>
                </tr>
            `;
            partsListEl.innerHTML += row;
        });
    };

    // Aksesuar listesini render et
    const renderAccessories = (accessories) => {
        accessoriesListEl.innerHTML = '';
        if (accessories.length === 0) {
            accessoriesListEl.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Henüz hiç aksesuar eklenmedi.</td></tr>';
            return;
        }
        accessories.forEach(acc => {
            const material = allMaterials.get(acc.materialId);
            const materialName = material ? material.name : 'Bilinmeyen Aksesuar';
            const unitPrice = material ? material.price.toFixed(2) : '0.00';
            const cost = acc.cost ? acc.cost.toFixed(2) : '0.00';
            const row = `
                <tr>
                    <td>${materialName}</td>
                    <td>${acc.qty}</td>
                    <td>${unitPrice} ₺</td>
                    <td>${cost} ₺</td>
                    <td><button class="btn btn-sm btn-outline-danger" onclick="window.deleteItem('${acc.accessoryId}', 'aksesuarı', 'accessories')">Sil</button></td>
                </tr>
            `;
            accessoriesListEl.innerHTML += row;
        });
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
        moduleTemplates = []; // Her yüklemede diziyi temizle
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
    
    // Oturum kontrolü
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
    
    // Çıkış yap
    logoutButton.addEventListener('click', () => signOut(auth));
    
    // "Hesapla ve Projeye Ekle" Butonu
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

                // Kenar bandı maliyetini hesaba kat
                if (part.banding && part.banding.materialId) {
                    const bandingMaterial = allMaterials.get(part.banding.materialId);
                    if (bandingMaterial && typeof bandingMaterial.price === 'number') {
                        let totalBandingLength = 0; // metre
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

});

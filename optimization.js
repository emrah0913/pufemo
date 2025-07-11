// Gerekli Firebase Fonksiyonlarını Import Etme
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getFirestore, doc, getDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

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

// Değişkenler
let currentUser = null;
let projectId = null;
let projectData = {};
let allMaterials = new Map();

// HTML Elementleri
const projectNameEl = document.getElementById('projectName');
const backButton = document.getElementById('backButton');
const logoutButton = document.getElementById('logoutButton');
const runOptimizationBtn = document.getElementById('runOptimizationBtn');
const loadingIndicator = document.getElementById('loadingIndicator');
const materialTabs = document.getElementById('materialTabs');
const materialTabContent = document.getElementById('materialTabContent');
const panelSummary = document.getElementById('panelSummary');
const bandingSummary = document.getElementById('bandingSummary');
const materialGrainSettings = document.getElementById('materialGrainSettings');
const unpackedContainer = document.getElementById('unpackedContainer');
const unpackedList = document.getElementById('unpackedList');


// Sayfa Yüklendiğinde
document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    projectId = params.get('id');

    if (!projectId) {
        alert("Proje ID'si bulunamadı!");
        window.location.href = 'projects.html';
        return;
    }
    
    backButton.href = `project-detail.html?id=${projectId}`;

    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
            loadProjectAndMaterials();
        } else {
            window.location.href = 'index.html';
        }
    });

    runOptimizationBtn.addEventListener('click', runOptimization);
});

// Proje ve Malzeme verilerini yükle
const loadProjectAndMaterials = async () => {
    const matQuery = query(collection(db, 'materials'), where('userId', '==', currentUser.uid));
    const matSnapshot = await getDocs(matQuery);
    allMaterials.clear();
    matSnapshot.forEach(doc => {
        allMaterials.set(doc.id, { id: doc.id, ...doc.data() });
    });

    const projectRef = doc(db, 'projects', projectId);
    const projectSnap = await getDoc(projectRef);
    if (projectSnap.exists()) {
        projectData = projectSnap.data();
        projectNameEl.textContent = projectData.name;
        createGrainSettingsUI();
    } else {
        alert("Proje bulunamadı.");
        window.location.href = 'projects.html';
    }
};

// Yön ayarları için arayüzü oluşturan fonksiyon
function createGrainSettingsUI() {
    materialGrainSettings.innerHTML = '';
    const uniquePanelIds = [...new Set((projectData.parts || []).map(p => p.materialId))];
    
    if (uniquePanelIds.length === 0) {
        materialGrainSettings.innerHTML = '<p class="text-muted">Projede panel malzemesi bulunmuyor.</p>';
        return;
    }

    uniquePanelIds.forEach(id => {
        const material = allMaterials.get(id);
        if (material && material.type === 'Panel') {
            const div = document.createElement('div');
            div.className = 'form-check form-check-inline';
            div.innerHTML = `
                <input class="form-check-input" type="checkbox" value="" id="grain-${id}">
                <label class="form-check-label" for="grain-${id}">
                    <b>${material.name}</b> Döndürme
                </label>
            `;
            materialGrainSettings.appendChild(div);
        }
    });
}


// Optimizasyonu Başlat
function runOptimization() {
    loadingIndicator.classList.remove('d-none');
    materialTabs.innerHTML = '';
    materialTabContent.innerHTML = '';
    panelSummary.innerHTML = '';
    bandingSummary.innerHTML = '';
    unpackedContainer.classList.add('d-none');
    unpackedList.innerHTML = '';
    let allUnpackedPieces = [];

    setTimeout(() => {
        const sheetWidth = parseInt(document.getElementById('sheetWidth').value);
        const sheetHeight = parseInt(document.getElementById('sheetHeight').value);
        const kerf = parseInt(document.getElementById('kerfValue').value) || 0; // Testere payını al
        
        if (!sheetWidth || !sheetHeight) {
            alert("Lütfen geçerli plaka ölçüleri girin.");
            loadingIndicator.classList.add('d-none');
            return;
        }

        const partsByMaterial = {};
        (projectData.parts || []).forEach(part => {
            if (!partsByMaterial[part.materialId]) {
                partsByMaterial[part.materialId] = [];
            }
            for (let i = 0; i < part.qty; i++) {
                // Parça boyutlarına testere payını ekle
                partsByMaterial[part.materialId].push({ w: part.width + kerf, h: part.height + kerf, name: part.name, originalW: part.width, originalH: part.height });
            }
        });

        let firstTab = true;
        for (const materialId in partsByMaterial) {
            const material = allMaterials.get(materialId);
            const materialName = material ? material.name : 'Bilinmeyen Malzeme';
            
            const grainCheckbox = document.getElementById(`grain-${materialId}`);
            const allowRotation = grainCheckbox ? !grainCheckbox.checked : true;
            
            const tabId = `tab-${materialId}`;
            const tabNavItem = document.createElement('li');
            tabNavItem.className = 'nav-item';
            tabNavItem.innerHTML = `<a class="nav-link ${firstTab ? 'active' : ''}" id="${tabId}-tab" data-bs-toggle="tab" href="#${tabId}" role="tab">${materialName}</a>`;
            materialTabs.appendChild(tabNavItem);

            const tabContentPane = document.createElement('div');
            tabContentPane.className = `tab-pane fade ${firstTab ? 'show active' : ''}`;
            tabContentPane.id = tabId;
            tabContentPane.role = 'tabpanel';
            
            const packer = new Packer(sheetWidth, sheetHeight);
            const { packedPieces, unpackedPieces } = packer.fit(partsByMaterial[materialId], allowRotation);
            
            // Plakaları görselleştir
            const sheets = packer.sheets;
            sheets.forEach((sheet, index) => {
                const sheetEl = document.createElement('div');
                sheetEl.className = 'sheet-container';
                const scale = 500 / sheetWidth;
                sheetEl.style.width = `${sheetWidth * scale}px`;
                sheetEl.style.height = `${sheetHeight * scale}px`;
                sheetEl.innerHTML = `<h5 class="p-2">Plaka ${index + 1}</h5>`;

                sheet.pieces.forEach(p => {
                    const pieceEl = document.createElement('div');
                    pieceEl.className = 'piece';
                    pieceEl.style.left = `${p.fit.x * scale}px`;
                    pieceEl.style.top = `${p.fit.y * scale}px`;
                    pieceEl.style.width = `${(p.w - kerf) * scale}px`;
                    pieceEl.style.height = `${(p.h - kerf) * scale}px`;
                    pieceEl.innerHTML = `<span>${p.name} (${p.originalH}x${p.originalW})</span>`;
                    sheetEl.appendChild(pieceEl);
                });
                tabContentPane.appendChild(sheetEl);
            });

            materialTabContent.appendChild(tabContentPane);
            
            panelSummary.innerHTML += `<li class="list-group-item">${materialName}: <strong>${sheets.length} plaka</strong></li>`;
            allUnpackedPieces.push(...unpackedPieces);
            firstTab = false;
        }
        
        if (allUnpackedPieces.length > 0) {
            renderUnpackedPieces(allUnpackedPieces);
        }
        
        calculateAndRenderBandingSummary();
        loadingIndicator.classList.add('d-none');
    }, 500);
}

// Sığmayan parçaları render et
function renderUnpackedPieces(pieces) {
    unpackedContainer.classList.remove('d-none');
    pieces.forEach(p => {
        unpackedList.innerHTML += `<tr><td>${p.name}</td><td>${p.originalH}</td><td>${p.originalW}</td></tr>`;
    });
}

// *** YENİ, DAHA GELİŞMİŞ PACKER SINIFI ***
class Packer {
    constructor(w, h) {
        this.root = { x: 0, y: 0, w: w, h: h };
        this.sheets = [];
    }

    fit(pieces, allowRotation) {
        let packedPieces = [];
        let unpackedPieces = [];
        
        // Parçaları alana göre büyükten küçüğe sırala
        pieces.sort((a, b) => (b.w * b.h) - (a.w * a.h));

        for (const piece of pieces) {
            let node = this.findNode(this.root, piece.w, piece.h);
            let isRotated = false;

            if (!node && allowRotation && piece.w !== piece.h) {
                node = this.findNode(this.root, piece.h, piece.w);
                if (node) isRotated = true;
            }

            if (node) {
                const fit = this.splitNode(node, isRotated ? piece.h : piece.w, isRotated ? piece.w : piece.h);
                packedPieces.push({ ...piece, fit: fit });
            } else {
                unpackedPieces.push(piece);
            }
        }
        
        // Bu kısım tek plaka için çalışır, çoklu plaka için runOptimization içinde yönetilir.
        // Bu örnekte, bu sınıfı her malzeme grubu için yeniden oluşturacağız.
        // Daha gelişmiş bir yapı, Packer sınıfının kendi içinde plaka listesi tutmasıdır.
        // Şimdilik bu yapı, istenen sonucu verecektir. Bu Packer'ı her plaka için yeniden başlatacağız.
        
        // Bu yüzden ana mantığı runOptimization içinde bırakıyoruz. Bu sınıf sadece bir plaka için çalışacak.
        // Bu mantığı yeniden yapılandıralım:
        return this.pack(pieces, allowRotation);
    }
    
    pack(pieces, allowRotation) {
        let packedPieces = [];
        let unpackedPieces = [];
        this.sheets = [];

        for (const piece of pieces) {
            let placed = false;
            // Mevcut plakalarda yer ara
            for (let i = 0; i < this.sheets.length; i++) {
                const node = this.findNode(this.sheets[i].root, piece.w, piece.h);
                if (node) {
                    this.splitNode(node, piece.w, piece.h, this.sheets[i].pieces);
                    placed = true;
                    break;
                }
                if (allowRotation && piece.w !== piece.h) {
                    const nodeRotated = this.findNode(this.sheets[i].root, piece.h, piece.w);
                    if (nodeRotated) {
                        [piece.w, piece.h] = [piece.h, piece.w];
                        this.splitNode(nodeRotated, piece.w, piece.h, this.sheets[i].pieces);
                        placed = true;
                        break;
                    }
                }
            }
            // Yerleşmediyse yeni plaka aç
            if (!placed) {
                const newSheet = { root: { x: 0, y: 0, w: this.root.w, h: this.root.h }, pieces: [] };
                const node = this.findNode(newSheet.root, piece.w, piece.h);
                if (node) {
                    this.splitNode(node, piece.w, piece.h, newSheet.pieces);
                    this.sheets.push(newSheet);
                    placed = true;
                } else if (allowRotation && piece.w !== piece.h) {
                     const nodeRotated = this.findNode(newSheet.root, piece.h, piece.w);
                     if(nodeRotated) {
                        [piece.w, piece.h] = [piece.h, piece.w];
                        this.splitNode(nodeRotated, piece.w, piece.h, newSheet.pieces);
                        this.sheets.push(newSheet);
                        placed = true;
                     }
                }
            }
            if(!placed) unpackedPieces.push(piece);
        }
        return { packedSheets: this.sheets, unpackedPieces };
    }

    findNode(root, w, h) {
        if (root.used) {
            return this.findNode(root.right, w, h) || this.findNode(root.down, w, h);
        } else if (w <= root.w && h <= root.h) {
            return root;
        }
        return null;
    }

    splitNode(node, w, h, pieces) {
        node.used = true;
        node.down = { x: node.x, y: node.y + h, w: node.w, h: node.h - h };
        node.right = { x: node.x + w, y: node.y, w: node.w - w, h: h };
        pieces.push({ w: w, h: h, fit: { x: node.x, y: node.y } });
    }
}


// Kenar bandı özetini hesapla ve render et
function calculateAndRenderBandingSummary() {
    const bandingTotals = {};
    (projectData.parts || []).forEach(part => {
        if (part.banding && part.banding.materialId) {
            const materialId = part.banding.materialId;
            if (!bandingTotals[materialId]) bandingTotals[materialId] = 0;
            let length = 0;
            if (part.banding.b1) length += part.height;
            if (part.banding.b2) length += part.height;
            if (part.banding.e1) length += part.width;
            if (part.banding.e2) length += part.width;
            bandingTotals[materialId] += length * part.qty;
        }
    });

    for (const materialId in bandingTotals) {
        const material = allMaterials.get(materialId);
        const materialName = material ? material.name : 'Bilinmeyen Bant';
        const totalMeters = (bandingTotals[materialId] / 1000).toFixed(2);
        bandingSummary.innerHTML += `<li class="list-group-item">${materialName}: <strong>${totalMeters} metre</strong></li>`;
    }
}

// Çıkış yap
logoutButton.addEventListener('click', () => signOut(auth));

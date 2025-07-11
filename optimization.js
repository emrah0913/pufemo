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
const resultsContainer = document.getElementById('resultsContainer');
const materialTabs = document.getElementById('materialTabs');
const materialTabContent = document.getElementById('materialTabContent');
const panelSummary = document.getElementById('panelSummary');
const bandingSummary = document.getElementById('bandingSummary');


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
    // Malzemeleri yükle
    const matQuery = query(collection(db, 'materials'), where('userId', '==', currentUser.uid));
    const matSnapshot = await getDocs(matQuery);
    allMaterials.clear();
    matSnapshot.forEach(doc => {
        allMaterials.set(doc.id, { id: doc.id, ...doc.data() });
    });

    // Projeyi yükle
    const projectRef = doc(db, 'projects', projectId);
    const projectSnap = await getDoc(projectRef);
    if (projectSnap.exists()) {
        projectData = projectSnap.data();
        projectNameEl.textContent = projectData.name;
    } else {
        alert("Proje bulunamadı.");
        window.location.href = 'projects.html';
    }
};

// Optimizasyonu Başlat
function runOptimization() {
    loadingIndicator.classList.remove('d-none');
    materialTabs.innerHTML = '';
    materialTabContent.innerHTML = '';
    panelSummary.innerHTML = '';
    bandingSummary.innerHTML = '';

    // Basit bir gecikme ile yükleme animasyonunu göster
    setTimeout(() => {
        const sheetWidth = parseInt(document.getElementById('sheetWidth').value);
        const sheetHeight = parseInt(document.getElementById('sheetHeight').value);
        
        if (!sheetWidth || !sheetHeight) {
            alert("Lütfen geçerli plaka ölçüleri girin.");
            loadingIndicator.classList.add('d-none');
            return;
        }

        // Parçaları malzeme türüne göre grupla
        const partsByMaterial = {};
        (projectData.parts || []).forEach(part => {
            if (!partsByMaterial[part.materialId]) {
                partsByMaterial[part.materialId] = [];
            }
            for (let i = 0; i < part.qty; i++) {
                partsByMaterial[part.materialId].push({ w: part.width, h: part.height, name: part.name });
            }
        });

        let firstTab = true;
        for (const materialId in partsByMaterial) {
            const material = allMaterials.get(materialId);
            const materialName = material ? material.name : 'Bilinmeyen Malzeme';
            
            // Sekme oluştur
            const tabId = `tab-${materialId}`;
            const tabNavItem = document.createElement('li');
            tabNavItem.className = 'nav-item';
            tabNavItem.innerHTML = `<a class="nav-link ${firstTab ? 'active' : ''}" id="${tabId}-tab" data-bs-toggle="tab" href="#${tabId}" role="tab">${materialName}</a>`;
            materialTabs.appendChild(tabNavItem);

            // Sekme içeriği oluştur
            const tabContentPane = document.createElement('div');
            tabContentPane.className = `tab-pane fade ${firstTab ? 'show active' : ''}`;
            tabContentPane.id = tabId;
            tabContentPane.role = 'tabpanel';
            
            // Optimizasyon algoritmasını çalıştır
            const { packedSheets, unpackedPieces } = simpleBinPacker(partsByMaterial[materialId], sheetWidth, sheetHeight);
            
            // Sonuçları render et
            packedSheets.forEach((sheet, index) => {
                const sheetEl = document.createElement('div');
                sheetEl.className = 'sheet-container';
                const scale = 500 / sheetWidth; // Görselleştirme için ölçek
                sheetEl.style.width = `${sheetWidth * scale}px`;
                sheetEl.style.height = `${sheetHeight * scale}px`;
                sheetEl.innerHTML = `<h5 class="p-2">Plaka ${index + 1}</h5>`;

                sheet.pieces.forEach(p => {
                    const pieceEl = document.createElement('div');
                    pieceEl.className = 'piece';
                    pieceEl.style.left = `${p.x * scale}px`;
                    pieceEl.style.top = `${p.y * scale}px`;
                    pieceEl.style.width = `${p.w * scale}px`;
                    pieceEl.style.height = `${p.h * scale}px`;
                    pieceEl.textContent = `${p.name} (${p.h}x${p.w})`;
                    sheetEl.appendChild(pieceEl);
                });
                tabContentPane.appendChild(sheetEl);
            });

            materialTabContent.appendChild(tabContentPane);
            
            // Panel özetini güncelle
            panelSummary.innerHTML += `<li class="list-group-item">${materialName}: <strong>${packedSheets.length} plaka</strong></li>`;

            firstTab = false;
        }
        
        // Kenar bandı özetini hesapla
        calculateAndRenderBandingSummary();

        loadingIndicator.classList.add('d-none');
    }, 500);
}

// Basit Yerleştirme Algoritması (Bin Packer)
function simpleBinPacker(pieces, sheetW, sheetH) {
    // Parçaları alana göre büyükten küçüğe sırala
    pieces.sort((a, b) => (b.w * b.h) - (a.w * a.h));
    
    let packedSheets = [];
    let unpackedPieces = [];

    pieces.forEach(piece => {
        let placed = false;
        // Mevcut plakalara yerleştirmeyi dene
        for (const sheet of packedSheets) {
            if (findSpot(sheet, piece)) {
                placed = true;
                break;
            }
        }
        // Yerleşmediyse yeni plaka aç
        if (!placed) {
            const newSheet = { w: sheetW, h: sheetH, pieces: [] };
            if (findSpot(newSheet, piece)) {
                packedSheets.push(newSheet);
                placed = true;
            }
        }
        if (!placed) {
            unpackedPieces.push(piece);
        }
    });

    return { packedSheets, unpackedPieces };
}

function findSpot(sheet, piece) {
    // Çok basit bir yer bulma mantığı: İlk boş köşeyi bul
    for (let y = 0; y <= sheet.h - piece.h; y++) {
        for (let x = 0; x <= sheet.w - piece.w; x++) {
            if (isSpotFree(sheet, x, y, piece.w, piece.h)) {
                piece.x = x;
                piece.y = y;
                sheet.pieces.push(piece);
                return true;
            }
        }
    }
    return false;
}

function isSpotFree(sheet, x, y, w, h) {
    for (const p of sheet.pieces) {
        if (x < p.x + p.w && x + w > p.x && y < p.y + p.h && y + h > p.y) {
            return false; // Çakışma var
        }
    }
    return true; // Boş
}

// Kenar bandı özetini hesapla ve render et
function calculateAndRenderBandingSummary() {
    const bandingTotals = {}; // { materialId: totalLength }
    (projectData.parts || []).forEach(part => {
        if (part.banding && part.banding.materialId) {
            const materialId = part.banding.materialId;
            if (!bandingTotals[materialId]) {
                bandingTotals[materialId] = 0;
            }
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

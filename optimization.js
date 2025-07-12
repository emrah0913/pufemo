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
    
    setTimeout(() => {
        const sheetWidth = parseInt(document.getElementById('sheetWidth').value);
        const sheetHeight = parseInt(document.getElementById('sheetHeight').value);
        const kerf = parseInt(document.getElementById('kerfValue').value) || 0;
        
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
            
            const packer = new MaxRectsPacker(sheetWidth, sheetHeight, allowRotation);
            packer.addArray(partsByMaterial[materialId]);
            
            const packedSheets = packer.sheets;
            const unpackedPieces = packer.unpacked;
            
            packedSheets.forEach((sheet, index) => {
                const sheetEl = document.createElement('div');
                sheetEl.className = 'sheet-container';
                const scale = 500 / sheetWidth;
                sheetEl.style.width = `${sheetWidth * scale}px`;
                sheetEl.style.height = `${sheetHeight * scale}px`;
                sheetEl.dataset.scale = scale;
                sheetEl.innerHTML = `<h5 class="p-2">Plaka ${index + 1}</h5>`;

                sheet.pieces.forEach((p, pieceIndex) => {
                    const pieceEl = document.createElement('div');
                    pieceEl.className = 'piece';
                    pieceEl.id = `piece-${materialId}-${index}-${pieceIndex}`;
                    pieceEl.style.left = `${p.x * scale}px`;
                    pieceEl.style.top = `${p.y * scale}px`;
                    pieceEl.style.width = `${(p.w - kerf) * scale}px`;
                    pieceEl.style.height = `${(p.h - kerf) * scale}px`;
                    pieceEl.dataset.w = p.w;
                    pieceEl.dataset.h = p.h;
                    pieceEl.dataset.kerf = kerf;
                    pieceEl.dataset.allowRotation = allowRotation;

                    pieceEl.innerHTML = `
                        <span class="piece-text">${p.name} (${p.originalH}x${p.originalW})</span>
                        <i class="bi bi-arrow-clockwise rotate-icon"></i>
                    `;
                    sheetEl.appendChild(pieceEl);
                });
                tabContentPane.appendChild(sheetEl);
            });

            materialTabContent.appendChild(tabContentPane);
            
            panelSummary.innerHTML += `<li class="list-group-item">${materialName}: <strong>${packedSheets.length} plaka</strong></li>`;
            
            if (unpackedPieces.length > 0) {
                renderUnpackedPieces(unpackedPieces);
            }
            firstTab = false;
        }
        
        calculateAndRenderBandingSummary();
        loadingIndicator.classList.add('d-none');
    }, 500);
}

// Sığmayan parçaları render et
function renderUnpackedPieces(pieces) {
    unpackedContainer.classList.remove('d-none');
    unpackedList.innerHTML = '';
    pieces.forEach(p => {
        unpackedList.innerHTML += `<tr><td>${p.name}</td><td>${p.originalH}</td><td>${p.originalW}</td></tr>`;
    });
}

// *** YENİ VE GÜVENİLİR MAXRECTS ALGORİTMASI SINIFI ***
class MaxRectsPacker {
    constructor(width, height, allowRotation) {
        this.binWidth = width;
        this.binHeight = height;
        this.allowRotation = allowRotation;
        this.sheets = [];
        this.unpacked = [];
    }

    addArray(pieces) {
        pieces.sort((a, b) => Math.max(b.w, b.h) - Math.max(a.w, a.h));
        for (const piece of pieces) {
            this.add(piece);
        }
    }

    add(piece) {
        let bestFit = { score: Infinity, sheetIndex: -1, nodeIndex: -1, rotated: false };

        for (let i = 0; i < this.sheets.length; i++) {
            const sheet = this.sheets[i];
            for (let j = 0; j < sheet.freeRects.length; j++) {
                const node = sheet.freeRects[j];
                // Orijinal
                if (piece.w <= node.w && piece.h <= node.h) {
                    const score = Math.min(node.w - piece.w, node.h - piece.h);
                    if (score < bestFit.score) bestFit = { score, sheetIndex: i, nodeIndex: j, rotated: false };
                }
                // Döndürülmüş
                if (this.allowRotation && piece.h <= node.w && piece.w <= node.h) {
                    const score = Math.min(node.w - piece.h, node.h - piece.w);
                    if (score < bestFit.score) bestFit = { score, sheetIndex: i, nodeIndex: j, rotated: true };
                }
            }
        }

        // *** DÜZELTME: Sonsuz döngüyü engelle ***
        if (bestFit.sheetIndex === -1) {
            // Parça yeni bir plakaya sığıyor mu?
            const canFit = (piece.w <= this.binWidth && piece.h <= this.binHeight) || 
                           (this.allowRotation && piece.h <= this.binWidth && piece.w <= this.binHeight);
            
            if (canFit) {
                const newSheet = { w: this.binWidth, h: this.binHeight, pieces: [], freeRects: [{ x: 0, y: 0, w: this.binWidth, h: this.binHeight }] };
                this.sheets.push(newSheet);
                this.add(piece); // Yeni plakada tekrar dene (artık güvenli)
            } else {
                this.unpacked.push(piece); // Sığmıyorsa ayır
            }
            return;
        }

        const targetSheet = this.sheets[bestFit.sheetIndex];
        const targetNode = targetSheet.freeRects[bestFit.nodeIndex];
        
        let w = piece.w;
        let h = piece.h;
        if (bestFit.rotated) [w, h] = [h, w];

        const newPiece = { ...piece, x: targetNode.x, y: targetNode.y, w: w, h: h };
        targetSheet.pieces.push(newPiece);

        const oldFreeRects = targetSheet.freeRects.slice();
        targetSheet.freeRects = [];
        for (const freeRect of oldFreeRects) {
            this.splitFreeNode(freeRect, newPiece, targetSheet.freeRects);
        }
        this.pruneFreeList(targetSheet.freeRects);
    }

    splitFreeNode(freeRect, usedNode, freeRects) {
        if (usedNode.x >= freeRect.x + freeRect.w || usedNode.x + usedNode.w <= freeRect.x ||
            usedNode.y >= freeRect.y + freeRect.h || usedNode.y + usedNode.h <= freeRect.y) {
            freeRects.push(freeRect);
            return;
        }
        if (usedNode.y > freeRect.y) freeRects.push({ x: freeRect.x, y: freeRect.y, w: freeRect.w, h: usedNode.y - freeRect.y });
        if (usedNode.y + usedNode.h < freeRect.y + freeRect.h) freeRects.push({ x: freeRect.x, y: usedNode.y + usedNode.h, w: freeRect.w, h: freeRect.y + freeRect.h - (usedNode.y + usedNode.h) });
        if (usedNode.x > freeRect.x) freeRects.push({ x: freeRect.x, y: freeRect.y, w: usedNode.x - freeRect.x, h: freeRect.h });
        if (usedNode.x + usedNode.w < freeRect.x + freeRect.w) freeRects.push({ x: usedNode.x + usedNode.w, y: freeRect.y, w: freeRect.x + freeRect.w - (usedNode.x + usedNode.w), h: freeRect.h });
    }

    pruneFreeList(freeRects) {
        for (let i = 0; i < freeRects.length; i++) {
            for (let j = i + 1; j < freeRects.length; j++) {
                if (this.isContained(freeRects[i], freeRects[j])) {
                    freeRects.splice(i--, 1);
                    break;
                }
                if (this.isContained(freeRects[j], freeRects[i])) {
                    freeRects.splice(j--, 1);
                }
            }
        }
    }
    
    isContained(a, b) {
        return a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h;
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

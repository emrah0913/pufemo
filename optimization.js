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
            div.className = 'form-check';
            div.innerHTML = `
                <input class="form-check-input" type="checkbox" value="" id="grain-${id}">
                <label class="form-check-label" for="grain-${id}">
                    <b>${material.name}</b> için döndürmeyi kilitle (Desenli)
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
                partsByMaterial[part.materialId].push({ w: part.width, h: part.height, name: part.name });
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
            
            const { packedSheets, unpackedPieces } = maxRectsPacker(partsByMaterial[materialId], sheetWidth, sheetHeight, allowRotation);
            
            packedSheets.forEach((sheet, index) => {
                const sheetEl = document.createElement('div');
                sheetEl.className = 'sheet-container';
                const scale = 500 / sheetWidth;
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
            
            panelSummary.innerHTML += `<li class="list-group-item">${materialName}: <strong>${packedSheets.length} plaka</strong></li>`;
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
        unpackedList.innerHTML += `<tr><td>${p.name}</td><td>${p.h}</td><td>${p.w}</td></tr>`;
    });
}


// *** YENİ PROFESYONEL MAXRECTS OPTİMİZASYON ALGORİTMASI ***
function maxRectsPacker(pieces, sheetW, sheetH, allowRotation) {
    let packedSheets = [];
    let unpackedPieces = [];

    // Parçaları alana göre büyükten küçüğe sırala
    pieces.sort((a, b) => (b.w * b.h) - (a.w * a.h));
    
    const initialPieces = [...pieces];

    while (initialPieces.length > 0) {
        const sheet = { w: sheetW, h: sheetH, pieces: [], freeRects: [{ x: 0, y: 0, w: sheetW, h: sheetH }] };
        sheets.push(sheet);

        let placedSomething = true;
        while(placedSomething) {
            placedSomething = false;
            let bestFit = { score: Infinity, pieceIndex: -1, nodeIndex: -1, rotated: false };

            for (let i = 0; i < initialPieces.length; i++) {
                const piece = initialPieces[i];
                for (let j = 0; j < sheet.freeRects.length; j++) {
                    const node = sheet.freeRects[j];
                    
                    // Orijinal yönüyle dene
                    if (piece.w <= node.w && piece.h <= node.h) {
                        const score = Math.min(node.w - piece.w, node.h - piece.h); // Best Short Side Fit
                        if (score < bestFit.score) {
                            bestFit = { score, pieceIndex: i, nodeIndex: j, rotated: false };
                        }
                    }
                    // Döndürerek dene
                    if (allowRotation && piece.h <= node.w && piece.w <= node.h) {
                         const score = Math.min(node.w - piece.h, node.h - piece.w);
                         if (score < bestFit.score) {
                            bestFit = { score, pieceIndex: i, nodeIndex: j, rotated: true };
                        }
                    }
                }
            }

            if (bestFit.pieceIndex > -1) {
                const pieceToPlace = initialPieces.splice(bestFit.pieceIndex, 1)[0];
                const nodeToUse = sheet.freeRects[bestFit.nodeIndex];

                if (bestFit.rotated) {
                    [pieceToPlace.w, pieceToPlace.h] = [pieceToPlace.h, pieceToPlace.w];
                }

                pieceToPlace.x = nodeToUse.x;
                pieceToPlace.y = nodeToUse.y;
                sheet.pieces.push(pieceToPlace);

                // Boş alanı yeni alanlara böl
                sheet.freeRects.splice(bestFit.nodeIndex, 1);
                splitFreeNode(sheet.freeRects, nodeToUse, pieceToPlace);
                
                pruneFreeList(sheet.freeRects);
                
                placedSomething = true;
            }
        }
    }
    
    unpackedPieces = initialPieces;
    return { packedSheets, unpackedPieces };
}

function splitFreeNode(freeRects, freeNode, usedNode) {
    // Eğer parça, boş alanla çakışıyorsa, boş alanı böl
    for (let i = freeRects.length - 1; i >= 0; --i) {
        const fr = freeRects[i];
        if (isContained(usedNode, fr)) {
            if (splitRect(fr, usedNode, freeRects)) {
                freeRects.splice(i, 1);
            }
        }
    }
}

function isContained(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function splitRect(freeRect, placedRect, newRects) {
    // Sağ taraf
    if (placedRect.x < freeRect.x + freeRect.w && placedRect.x + placedRect.w > freeRect.x) {
        // Üst taraf
        if (placedRect.y > freeRect.y && placedRect.y < freeRect.y + freeRect.h) {
            newRects.push({ x: freeRect.x, y: freeRect.y, w: freeRect.w, h: placedRect.y - freeRect.y });
        }
        // Alt taraf
        if (placedRect.y + placedRect.h < freeRect.y + freeRect.h) {
            newRects.push({ x: freeRect.x, y: placedRect.y + placedRect.h, w: freeRect.w, h: freeRect.y + freeRect.h - (placedRect.y + placedRect.h) });
        }
    }
    // Alt taraf
    if (placedRect.y < freeRect.y + freeRect.h && placedRect.y + placedRect.h > freeRect.y) {
        // Sol taraf
        if (placedRect.x > freeRect.x && placedRect.x < freeRect.x + freeRect.w) {
            newRects.push({ x: freeRect.x, y: freeRect.y, w: placedRect.x - freeRect.x, h: freeRect.h });
        }
        // Sağ taraf
        if (placedRect.x + placedRect.w < freeRect.x + freeRect.w) {
            newRects.push({ x: placedRect.x + placedRect.w, y: freeRect.y, w: freeRect.x + freeRect.w - (placedRect.x + placedRect.w), h: freeRect.h });
        }
    }
    return true;
}

function pruneFreeList(freeRects) {
    for (let i = 0; i < freeRects.length; i++) {
        for (let j = i + 1; j < freeRects.length; j++) {
            if (isContained(freeRects[i], freeRects[j])) {
                freeRects.splice(i--, 1);
                break;
            }
            if (isContained(freeRects[j], freeRects[i])) {
                freeRects.splice(j--, 1);
            }
        }
    }
}


// Kenar bandı özetini hesapla ve render et
function calculateAndRenderBandingSummary() {
    const bandingTotals = {};
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

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

// *** YENİ PROFESYONEL MAXRECTS ALGORİTMASI ***
function maxRectsPacker(pieces, sheetW, sheetH, allowRotation) {
    let unpackedPieces = [];
    const sheets = [{ w: sheetW, h: sheetH, pieces: [], freeRects: [{ x: 0, y: 0, w: sheetW, h: sheetH }] }];
    
    pieces.sort((a, b) => b.h - a.h); // Yüksekliğe göre sırala

    for (const piece of pieces) {
        let bestFit = { score: Infinity, sheetIndex: -1, nodeIndex: -1, rotated: false };

        // Plakaya sığma kontrolü
        if ((piece.w > sheetW || piece.h > sheetH) && (!allowRotation || (piece.h > sheetW || piece.w > sheetH))) {
            unpackedPieces.push(piece);
            continue;
        }
        
        for (let i = 0; i < sheets.length; i++) {
            const sheet = sheets[i];
            for (let j = 0; j < sheet.freeRects.length; j++) {
                const node = sheet.freeRects[j];

                // Orijinal yönüyle
                if (piece.w <= node.w && piece.h <= node.h) {
                    const score = node.h - piece.h; // Best Long Side Fit
                    if (score < bestFit.score) {
                        bestFit = { score, sheetIndex: i, nodeIndex: j, rotated: false };
                    }
                }
                // Döndürerek
                if (allowRotation && piece.h <= node.w && piece.w <= node.h) {
                    const score = node.h - piece.w;
                    if (score < bestFit.score) {
                        bestFit = { score, sheetIndex: i, nodeIndex: j, rotated: true };
                    }
                }
            }
        }

        if (bestFit.sheetIndex === -1) {
             // Yeni plaka aç
             const newSheet = { w: sheetW, h: sheetH, pieces: [], freeRects: [{ x: 0, y: 0, w: sheetW, h: sheetH }] };
             sheets.push(newSheet);
             // Yeni plakada tekrar yer ara
             // Bu kısmı basitleştirmek için, sığmazsa direkt ayırıyoruz. Daha gelişmiş bir versiyon eklenebilir.
             unpackedPieces.push(piece);
             continue;
        }
        
        const targetSheet = sheets[bestFit.sheetIndex];
        const targetNode = targetSheet.freeRects[bestFit.nodeIndex];
        
        if (bestFit.rotated) {
            [piece.w, piece.h] = [piece.h, piece.w];
        }

        piece.x = targetNode.x;
        piece.y = targetNode.y;
        targetSheet.pieces.push(piece);

        // Kullanılan boş alanı böl ve güncelle
        targetSheet.freeRects.splice(bestFit.nodeIndex, 1);
        
        const rightSplit = { x: targetNode.x + piece.w, y: targetNode.y, w: targetNode.w - piece.w, h: piece.h };
        if(rightSplit.w > 0) splitFurther(targetSheet.freeRects, rightSplit);
        
        const bottomSplit = { x: targetNode.x, y: targetNode.y + piece.h, w: targetNode.w, h: targetNode.h - piece.h };
        if(bottomSplit.h > 0) splitFurther(targetSheet.freeRects, bottomSplit);
    }

    return { packedSheets: sheets, unpackedPieces };
}

function splitFurther(freeRects, rectToSplit) {
    let madeSplit = false;
    for(let i=0; i<freeRects.length; i++) {
        const fr = freeRects[i];
        if (fr.x < rectToSplit.x + rectToSplit.w && fr.x + fr.w > rectToSplit.x &&
            fr.y < rectToSplit.y + rectToSplit.h && fr.y + fr.h > rectToSplit.y) {
            
            // Çakışan alanı 4'e böl
            // Sol
            if(rectToSplit.x > fr.x)
                freeRects.push({x: fr.x, y: fr.y, w: rectToSplit.x - fr.x, h: fr.h});
            // Sağ
            if(rectToSplit.x + rectToSplit.w < fr.x + fr.w)
                freeRects.push({x: rectToSplit.x + rectToSplit.w, y: fr.y, w: fr.x + fr.w - (rectToSplit.x + rectToSplit.w), h: fr.h});
            // Üst
            if(rectToSplit.y > fr.y)
                freeRects.push({x: fr.x, y: fr.y, w: fr.w, h: rectToSplit.y - fr.y});
            // Alt
            if(rectToSplit.y + rectToSplit.h < fr.y + fr.h)
                freeRects.push({x: fr.x, y: rectToSplit.y + rectToSplit.h, w: fr.w, h: fr.y + fr.h - (rectToSplit.y + rectToSplit.h)});
                
            freeRects.splice(i--, 1);
            madeSplit = true;
        }
    }
    if(!madeSplit) freeRects.push(rectToSplit);
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

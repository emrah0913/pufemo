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
            
            const packer = new Packer();
            const { packedSheets, unpackedPieces } = packer.fit(partsByMaterial[materialId], sheetWidth, sheetHeight, allowRotation);
            
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
                    pieceEl.style.left = `${p.fit.x * scale}px`;
                    pieceEl.style.top = `${p.fit.y * scale}px`;
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
        makePiecesInteractive();
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

class Packer {
    fit(pieces, binWidth, binHeight, allowRotation) {
        let sheets = [];
        let unpacked = [];
        pieces.sort((a, b) => (b.w * b.h) - (a.w * a.h));
        for (const piece of pieces) {
            let placed = false;
            for (const sheet of sheets) {
                if (this.placeInSheet(piece, sheet, allowRotation)) {
                    placed = true;
                    break;
                }
            }
            if (!placed) {
                const newSheet = { root: { x: 0, y: 0, w: binWidth, h: binHeight }, pieces: [] };
                if (this.placeInSheet(piece, newSheet, allowRotation)) {
                    sheets.push(newSheet);
                    placed = true;
                }
            }
            if (!placed) unpacked.push(piece);
        }
        return { packedSheets: sheets, unpackedPieces: unpacked };
    }
    placeInSheet(piece, sheet, allowRotation) {
        let node = this.findNode(sheet.root, piece.w, piece.h);
        if (node) {
            piece.fit = this.splitNode(node, piece.w, piece.h);
            sheet.pieces.push(piece);
            return true;
        }
        if (allowRotation && piece.w !== piece.h) {
            node = this.findNode(sheet.root, piece.h, piece.w);
            if (node) {
                [piece.w, piece.h] = [piece.h, piece.w];
                piece.fit = this.splitNode(node, piece.w, piece.h);
                sheet.pieces.push(piece);
                return true;
            }
        }
        return false;
    }
    findNode(root, w, h) {
        if (root.used) {
            return this.findNode(root.right, w, h) || this.findNode(root.down, w, h);
        } else if (w <= root.w && h <= root.h) {
            return root;
        }
        return null;
    }
    splitNode(node, w, h) {
        node.used = true;
        node.down = { x: node.x, y: node.y + h, w: node.w, h: node.h - h };
        node.right = { x: node.x + w, y: node.y, w: node.w - w, h: h };
        return { x: node.x, y: node.y };
    }
}

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

// *** YENİ VE GÜVENİLİR İNTERAKTİF EDİTÖR FONKSİYONLARI ***
function makePiecesInteractive() {
    let activePiece = null;
    let offsetX = 0, offsetY = 0;

    const startDrag = (e) => {
        const piece = e.target.closest('.piece');
        if (!piece) return;
        if (e.target.classList.contains('rotate-icon')) {
            rotatePiece(e);
            return;
        }
        e.preventDefault();
        activePiece = piece;
        
        const rect = activePiece.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;
        
        activePiece.classList.add('dragging');
        activePiece.style.zIndex = 1000;
        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', stopDrag, { once: true }); // Sadece bir kere çalış
    };

    const drag = (e) => {
        if (!activePiece) return;
        activePiece.style.left = `${e.clientX - offsetX}px`;
        activePiece.style.top = `${e.clientY - offsetY}px`;
    };

    const stopDrag = (e) => {
        if (!activePiece) return;
        document.removeEventListener('mousemove', drag);

        activePiece.style.visibility = 'hidden';
        const dropTarget = document.elementFromPoint(e.clientX, e.clientY);
        activePiece.style.visibility = 'visible';

        const targetSheet = dropTarget ? dropTarget.closest('.sheet-container') : null;

        if (targetSheet) {
            const parentRect = targetSheet.getBoundingClientRect();
            const newLeft = e.clientX - parentRect.left - offsetX;
            const newTop = e.clientY - parentRect.top - offsetY;

            // Yeni pozisyonun plaka içinde olduğundan emin ol
            const finalLeft = Math.max(0, Math.min(newLeft, parentRect.width - activePiece.offsetWidth));
            const finalTop = Math.max(0, Math.min(newTop, parentRect.height - activePiece.offsetHeight));

            if (checkCollision(activePiece, targetSheet, finalLeft, finalTop)) {
                activePiece.style.borderColor = 'red'; // Çarpışma varsa kırmızı yap
            } else {
                activePiece.style.borderColor = '#0d6efd'; // Yoksa normal
            }
            targetSheet.appendChild(activePiece);
            activePiece.style.position = 'absolute';
            activePiece.style.left = `${finalLeft}px`;
            activePiece.style.top = `${finalTop}px`;

        } else {
            // Geçerli bir plakaya bırakılmadıysa, hiçbir şey yapma (parça olduğu yerde kalır)
            // Daha gelişmiş bir versiyon, eski yerine döndürebilir.
        }
        
        activePiece.classList.remove('dragging');
        activePiece.style.zIndex = 'auto';
        activePiece = null;
    };
    
    const rotatePiece = (e) => {
        e.stopPropagation();
        const piece = e.target.closest('.piece');
        if (piece.dataset.allowRotation !== 'true') {
            alert("Bu malzemenin yönü kilitli, döndüremezsiniz.");
            return;
        }

        const currentW = piece.offsetWidth;
        const currentH = piece.offsetHeight;
        
        piece.style.width = `${currentH}px`;
        piece.style.height = `${currentW}px`;
        
        const parentRect = piece.parentElement.getBoundingClientRect();
        if (parseFloat(piece.style.left) + currentH > parentRect.width) {
            piece.style.left = `${parentRect.width - currentH}px`;
        }
        if (parseFloat(piece.style.top) + currentW > parentRect.height) {
            piece.style.top = `${parentRect.height - currentW}px`;
        }
    };

    function checkCollision(draggedPiece, targetSheet, newLeft, newTop) {
        const draggedRect = {
            left: newLeft, top: newTop,
            right: newLeft + draggedPiece.offsetWidth,
            bottom: newTop + draggedPiece.offsetHeight
        };
        let collision = false;
        targetSheet.querySelectorAll('.piece').forEach(otherPiece => {
            if (otherPiece === draggedPiece) return;
            const otherRect = {
                left: parseFloat(otherPiece.style.left), top: parseFloat(otherPiece.style.top),
                right: parseFloat(otherPiece.style.left) + otherPiece.offsetWidth,
                bottom: parseFloat(otherPiece.style.top) + otherPiece.offsetHeight
            };
            if (draggedRect.left < otherRect.right && draggedRect.right > otherRect.left &&
                draggedRect.top < otherRect.bottom && draggedRect.bottom > otherRect.top) {
                collision = true;
            }
        });
        return collision;
    }

    materialTabContent.addEventListener('mousedown', startDrag);
}

// Çıkış yap
logoutButton.addEventListener('click', () => signOut(auth));

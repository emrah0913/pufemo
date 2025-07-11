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

// HTML Elementleri
const projectNameEl = document.getElementById('projectName');
const projectDescriptionEl = document.getElementById('projectDescription');
const partsListEl = document.getElementById('partsList');
const loadingIndicator = document.getElementById('loadingIndicator');
const logoutButton = document.getElementById('logoutButton');
const moduleTemplateSelect = document.getElementById('moduleTemplateSelect');
const addModuleToProjectBtn = document.getElementById('addModuleToProjectBtn');
const addModuleModal = new bootstrap.Modal(document.getElementById('addModuleModal'));

let currentUser = null;
let projectId = null;
let moduleTemplates = [];

// Sayfa Yüklendiğinde
document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    projectId = params.get('id');

    if (!projectId) {
        alert("Proje ID'si bulunamadı!");
        window.location.href = 'projects.html';
        return;
    }

    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
            loadProjectDetails();
            loadModuleTemplates();
        } else {
            window.location.href = 'index.html';
        }
    });
});

// Proje detaylarını ve parçalarını yükle
const loadProjectDetails = async () => {
    loadingIndicator.classList.remove('d-none');
    const projectRef = doc(db, 'projects', projectId);
    
    const unsub = onSnapshot(projectRef, (docSnap) => {
        if (docSnap.exists()) {
            const project = docSnap.data();
            projectNameEl.textContent = project.name;
            projectDescriptionEl.textContent = project.description || '';
            renderParts(project.parts || []);
        } else {
            alert("Proje bulunamadı.");
            window.location.href = 'projects.html';
        }
        loadingIndicator.classList.add('d-none');
    });
};

// Parça listesini tabloya render et
const renderParts = (parts) => {
    partsListEl.innerHTML = '';
    if (parts.length === 0) {
        partsListEl.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Bu projeye henüz hiç parça eklenmedi.</td></tr>';
        return;
    }
    parts.forEach(part => {
        const row = `
            <tr>
                <td>${part.name}</td>
                <td>${part.height}</td>
                <td>${part.width}</td>
                <td>${part.qty}</td>
                <td>${part.moduleInstanceName}</td>
                <td>
                    <button class="btn btn-sm btn-outline-danger" onclick="window.deletePart('${part.partId}')">Sil</button>
                </td>
            </tr>
        `;
        partsListEl.innerHTML += row;
    });
};


// Modül şablonlarını kütüphaneden çekip select'e doldur
const loadModuleTemplates = async () => {
    const q = query(collection(db, 'moduleTemplates'), where('userId', '==', currentUser.uid));
    const querySnapshot = await getDocs(q);
    
    moduleTemplateSelect.innerHTML = '<option value="">Lütfen bir şablon seçin...</option>';
    querySnapshot.forEach(doc => {
        const template = { id: doc.id, ...doc.data() };
        moduleTemplates.push(template);
        const option = `<option value="${template.id}">${template.name}</option>`;
        moduleTemplateSelect.innerHTML += option;
    });
};

// "Hesapla ve Projeye Ekle" Butonuna Tıklandığında
addModuleToProjectBtn.addEventListener('click', async () => {
    const B = parseFloat(document.getElementById('moduleHeight').value);
    const E = parseFloat(document.getElementById('moduleWidth').value);
    const D = parseFloat(document.getElementById('moduleDepth').value);
    const K = parseFloat(document.getElementById('materialThickness').value);
    
    const templateId = document.getElementById('moduleTemplateSelect').value;
    const moduleInstanceName = document.getElementById('moduleInstanceName').value.trim() || 'İsimsiz Modül';

    if (!templateId || !B || !E || !D || !K) {
        alert("Lütfen tüm ölçüleri ve şablonu eksiksiz seçin.");
        return;
    }

    const selectedTemplate = moduleTemplates.find(t => t.id === templateId);
    if (!selectedTemplate) {
        alert("Geçerli bir şablon bulunamadı.");
        return;
    }

    const calculatedParts = [];
    let errorOccurred = false;
    selectedTemplate.parts.forEach(part => {
        if (errorOccurred) return;
        try {
            const calculatedHeight = eval(part.heightFormula.toUpperCase().replace(/ /g, ''));
            const calculatedWidth = eval(part.widthFormula.toUpperCase().replace(/ /g, ''));

            calculatedParts.push({
                partId: crypto.randomUUID(),
                name: part.name,
                width: calculatedWidth,
                height: calculatedHeight,
                qty: part.qty,
                moduleInstanceName: moduleInstanceName,
            });

        } catch (error) {
            console.error("Formül hesaplama hatası: ", error);
            alert(`'${part.name}' parçasının formülünde bir hata var: ${error.message}`);
            errorOccurred = true;
        }
    });
    
    if (errorOccurred) return;

    try {
        const projectRef = doc(db, 'projects', projectId);
        await updateDoc(projectRef, {
            parts: arrayUnion(...calculatedParts)
        });
        
        console.log("Parçalar projeye başarıyla eklendi.");
        addModuleModal.hide();
        document.getElementById('calculateForm').reset();
        
    } catch (error) {
        console.error("Parçalar projeye eklenirken hata: ", error);
        alert("Hesaplanan parçalar projeye eklenirken bir hata oluştu.");
    }
});

// Projeden bir parçayı silme
window.deletePart = async (partIdToDelete) => {
    if (!confirm("Bu parçayı listeden silmek istediğinizden emin misiniz?")) {
        return;
    }
    try {
        const projectRef = doc(db, 'projects', projectId);
        const projectSnap = await getDoc(projectRef);

        if (projectSnap.exists()) {
            const currentParts = projectSnap.data().parts || [];
            const updatedParts = currentParts.filter(part => part.partId !== partIdToDelete);
            
            await updateDoc(projectRef, {
                parts: updatedParts
            });
            console.log("Parça başarıyla silindi.");
        }
    } catch (error) {
        console.error("Parça silinirken hata: ", error);
        alert("Parça silinirken bir hata oluştu.");
    }
};

// Çıkış yap
logoutButton.addEventListener('click', () => signOut(auth));

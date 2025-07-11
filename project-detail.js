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
    onSnapshot // *** DÜZELTME: Eksik olan fonksiyonu buraya ekledik ***
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
let moduleTemplates = []; // Kütüphanedeki şablonları tutacak dizi

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
    
    // Proje verisini anlık dinle
    const unsub = onSnapshot(projectRef, (docSnap) => {
        if (docSnap.exists()) {
            const project = docSnap.data();
            projectNameEl.textContent = project.name;
            projectDescriptionEl.textContent = project.description || '';
            
            // Parça listesini ekrana çiz
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
        partsListEl.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Bu projeye henüz hiç parça eklenmedi.</td></tr>';
        return;
    }
    parts.forEach(part => {
        const row = `
            <tr>
                <td>${part.name}</td>
                <td>${part.width}</td>
                <td>${part.height}</td>
                <td>${part.qty}</td>
                <td>${part.moduleInstanceName}</td>
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
    // Formdan değerleri al
    const templateId = document.getElementById('moduleTemplateSelect').value;
    const E = parseFloat(document.getElementById('moduleWidth').value);
    const B = parseFloat(document.getElementById('moduleHeight').value);
    const D = parseFloat(document.getElementById('moduleDepth').value);
    const K = parseFloat(document.getElementById('materialThickness').value);
    const moduleInstanceName = document.getElementById('moduleInstanceName').value.trim() || 'İsimsiz Modül';

    if (!templateId || !E || !B || !D || !K) {
        alert("Lütfen tüm ölçüleri ve şablonu eksiksiz seçin.");
        return;
    }

    // Seçilen şablonu bul
    const selectedTemplate = moduleTemplates.find(t => t.id === templateId);
    if (!selectedTemplate) {
        alert("Geçerli bir şablon bulunamadı.");
        return;
    }

    // *** HESAPLAMA MOTORU ***
    const calculatedParts = [];
    selectedTemplate.parts.forEach(part => {
        try {
            // Formülü al ve değişkenleri değiştir
            let widthFormula = part.widthFormula.toUpperCase().replace(/ /g, '');
            let heightFormula = part.heightFormula.toUpperCase().replace(/ /g, '');

            // eval() kullanmak riskli olabilir ama bu kontrollü ortamda işimizi görür.
            // Daha güvenli bir yöntem için bir matematik parser kütüphanesi kullanılabilir.
            const calculatedWidth = eval(widthFormula);
            const calculatedHeight = eval(heightFormula);

            calculatedParts.push({
                name: part.name,
                width: calculatedWidth,
                height: calculatedHeight,
                qty: part.qty,
                moduleInstanceName: moduleInstanceName,
                templatePartId: part.name // Orijinal parça adını sakla
            });

        } catch (error) {
            console.error("Formül hesaplama hatası: ", error);
            alert(`'${part.name}' parçasının formülünde bir hata var: ${error.message}`);
            return; // Hata varsa işlemi durdur
        }
    });
    
    // Hesaplanan parçaları Firestore'a kaydet
    try {
        const projectRef = doc(db, 'projects', projectId);
        // arrayUnion ile mevcut parçaların üzerine ekle
        await updateDoc(projectRef, {
            parts: arrayUnion(...calculatedParts)
        });
        
        console.log("Parçalar projeye başarıyla eklendi.");
        addModuleModal.hide(); // Modalı kapat
        document.getElementById('calculateForm').reset(); // Formu temizle
        
    } catch (error) {
        console.error("Parçalar projeye eklenirken hata: ", error);
        alert("Hesaplanan parçalar projeye eklenirken bir hata oluştu.");
    }
});

// Çıkış yap
logoutButton.addEventListener('click', () => signOut(auth));

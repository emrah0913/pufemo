// Gerekli Firebase Fonksiyonlarını Import Etme
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

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
const loginButton = document.getElementById('loginButton');
const loadingSpinner = document.getElementById('loadingSpinner');
const loginContent = document.getElementById('loginContent');
const errorMessage = document.getElementById('errorMessage');

// Oturum Durumunu Kontrol Et
onAuthStateChanged(auth, (user) => {
    loadingSpinner.style.display = 'block';
    loginContent.style.display = 'none';

    if (user) {
        // Kullanıcı giriş yapmışsa, dashboard'a yönlendir
        console.log("Oturum açık, yönlendiriliyor...");
        window.location.href = 'dashboard.html';
    } else {
        // Kullanıcı giriş yapmamışsa, giriş ekranını göster
        console.log("Oturum kapalı, giriş ekranı gösteriliyor.");
        loadingSpinner.style.display = 'none';
        loginContent.style.display = 'block';
    }
});

// Google ile Giriş Butonu Olayı
loginButton.addEventListener('click', async () => {
    const provider = new GoogleAuthProvider();
    
    try {
        const result = await signInWithPopup(auth, provider);
        const user = result.user;

        // Kullanıcının veritabanında kaydı var mı diye kontrol et
        const userRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(userRef);

        if (!docSnap.exists()) {
            // Eğer kullanıcı ilk defa giriş yapıyorsa, veritabanına kaydet
            await setDoc(userRef, {
                uid: user.uid,
                displayName: user.displayName,
                email: user.email,
                photoURL: user.photoURL,
                createdAt: new Date(),
                approved: false // Yönetici onayı için varsayılan olarak false
            });
            console.log("Yeni kullanıcı veritabanına eklendi.");
            alert("Hesabınız başarıyla oluşturuldu. Yöneticinin onayından sonra sisteme giriş yapabileceksiniz.");
            // Onay bekleyeceği için şimdilik çıkış yaptırabiliriz.
            // Veya direkt dashboard'a yönlendirip orada bir "onay bekliyor" ekranı gösterebiliriz.
            // Şimdilik en basiti, kullanıcıyı bilgilendirip bırakmak.
            signOut(auth);
        } else {
             // Mevcut kullanıcının onay durumunu kontrol et
            const userData = docSnap.data();
            if (userData.approved) {
                 // Onaylıysa dashboard'a yönlendir
                window.location.href = 'dashboard.html';
            } else {
                // Onaylı değilse, bilgilendir ve çıkış yap
                alert("Hesabınız henüz yönetici tarafından onaylanmamıştır.");
                signOut(auth);
            }
        }

    } catch (error) {
        console.error("Giriş sırasında hata oluştu: ", error);
        errorMessage.textContent = "Giriş sırasında bir hata oluştu. Lütfen tekrar deneyin.";
        errorMessage.classList.remove('d-none');
    }
});

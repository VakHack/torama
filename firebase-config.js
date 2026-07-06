/* שלב 1 (המשך): הדבק כאן את קונפיגורציית ה-Firebase שלך          */
/* ============================================================ */
const firebaseConfig = {
  apiKey: "AIzaSyBNOW8D4InzyfdSqHasOgT1zqph9FIoC2o",
  authDomain: "torama-12b6a.firebaseapp.com",
  databaseURL: "https://torama-12b6a-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "torama-12b6a",
  storageBucket: "torama-12b6a.firebasestorage.app",
  messagingSenderId: "587011004925",
  appId: "1:587011004925:web:a102d103dc07f4febd2194",
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const auth = firebase.auth();

document.getElementById("brandIcon").src = "icon-192.png";

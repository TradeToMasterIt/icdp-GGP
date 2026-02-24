import { initializeApp } from "firebase/app";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBTycDUrVHGJLYlGqsoNSAZdPPEHUTglHo",
    authDomain: "icdp-sabarkantha.firebaseapp.com",
    databaseURL: "https://icdp-sabarkantha-default-rtdb.firebaseio.com",
    projectId: "icdp-sabarkantha",
    storageBucket: "icdp-sabarkantha.firebasestorage.app",
    messagingSenderId: "541470748762",
    appId: "1:541470748762:web:0ba2aeb3b5def2db686863"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
const db = getFirestore(app);
enableIndexedDbPersistence(db)
    .catch((err) => {
        if (err.code == 'failed-precondition') {
            console.log("Offline mode failed: Multiple tabs open.");
        } else if (err.code == 'unimplemented') {
            console.log("Offline mode not supported by this browser.");
        }
    });

const auth = getAuth(app);

export { db, auth };

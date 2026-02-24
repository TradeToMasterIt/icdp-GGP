
import { initializeApp } from "firebase/app";
import { getFirestore, collection, query, orderBy, limit, getDocs } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyBTycDUrVHGJLYlGqsoNSAZdPPEHUTglHo",
    authDomain: "icdp-sabarkantha.firebaseapp.com",
    databaseURL: "https://icdp-sabarkantha-default-rtdb.firebaseio.com",
    projectId: "icdp-sabarkantha",
    storageBucket: "icdp-sabarkantha.firebasestorage.app",
    messagingSenderId: "541470748762",
    appId: "1:541470748762:web:0ba2aeb3b5def2db686863"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function fetchLastEntry() {
    try {
        const q = query(collection(db, "breeding"), orderBy("createdAt", "desc"), limit(1));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            console.log("No entries found.");
            return;
        }

        querySnapshot.forEach((doc) => {
            console.log("LAST_ENTRY_DATA:", JSON.stringify(doc.data(), null, 2));
        });
    } catch (error) {
        console.error("Error fetching last entry:", error);
    }
}

fetchLastEntry();

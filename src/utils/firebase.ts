import { initializeApp, getApps } from 'firebase/app';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  collection,
  onSnapshot,
  setDoc,
  doc,
  deleteDoc,
  getDocFromServer,
  getFirestore,
  Firestore
} from 'firebase/firestore';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User,
  Auth
} from 'firebase/auth';
import config from '../../firebase-applet-config.json';
import { ProductItem, Transaction } from '../types';

const firebaseConfig = {
  apiKey: config.apiKey,
  authDomain: config.authDomain,
  projectId: config.projectId,
  storageBucket: config.storageBucket,
  messagingSenderId: config.messagingSenderId,
  appId: config.appId,
};

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Initialize Auth
export const auth: Auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Initialize Firestore with Database ID from config with safe fallback
function createFirestoreInstance(): Firestore {
  try {
    return initializeFirestore(
      app,
      {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager()
        })
      },
      config.firestoreDatabaseId
    );
  } catch (err) {
    console.warn('Persistent multiple tab cache init warning, using standard getFirestore:', err);
    try {
      return getFirestore(app, config.firestoreDatabaseId);
    } catch {
      return getFirestore(app);
    }
  }
}

export const db: Firestore = createFirestoreInstance();

// Deep sanitization helper to strip all undefined values (preventing Firestore undefined field errors)
export function sanitizeForFirestore<T>(obj: T): T {
  return JSON.parse(
    JSON.stringify(obj, (_key, value) => (value === undefined ? null : value))
  );
}

// Connection test
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('the client is offline')) {
      console.warn('Firebase client is offline or syncing locally.');
    }
    return false;
  }
}

// Optional Auth operations (if needed)
export const loginWithGoogle = async (): Promise<User | null> => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error('Google Sign In Error:', error);
    throw error;
  }
};

export const logoutGoogle = async (): Promise<void> => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Google Sign Out Error:', error);
    throw error;
  }
};

export const subscribeToAuth = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

// Firestore sync for Transactions - DIRECT REAL-TIME SYNC
export const subscribeToTransactions = (
  callback: (transactions: Transaction[]) => void
) => {
  const transCol = collection(db, 'transactions');
  return onSnapshot(
    transCol,
    (snapshot) => {
      const list: Transaction[] = [];
      snapshot.forEach((docSnap) => {
        const item = docSnap.data() as Transaction;
        if (item && item.id) {
          list.push(item);
        }
      });
      // Sort newest first
      list.sort((a, b) => {
        const timeA = new Date(a.date || a.createdAt || 0).getTime();
        const timeB = new Date(b.date || b.createdAt || 0).getTime();
        return timeB - timeA;
      });
      callback(list);
    },
    (err) => {
      console.warn('Transactions snapshot error:', err);
    }
  );
};

export const saveTransactionToCloud = async (
  transaction: Transaction,
  userOrEmail?: User | null | string
): Promise<boolean> => {
  try {
    const author =
      typeof userOrEmail === 'string'
        ? userOrEmail
        : userOrEmail?.email || userOrEmail?.displayName || 'Kasir Wigata';

    const cleanTrans = sanitizeForFirestore({
      ...transaction,
      updatedAt: new Date().toISOString(),
      updatedBy: author,
    });

    await setDoc(doc(db, 'transactions', transaction.id), cleanTrans, { merge: true });
    return true;
  } catch (error) {
    console.error('Save transaction error:', error);
    return false;
  }
};

export const deleteTransactionFromCloud = async (transactionId: string): Promise<boolean> => {
  try {
    await deleteDoc(doc(db, 'transactions', transactionId));
    return true;
  } catch (error) {
    console.error('Delete transaction error:', error);
    return false;
  }
};

// Firestore sync for Products - DIRECT REAL-TIME SYNC
export const subscribeToProducts = (
  callback: (products: ProductItem[], isSnapshotEmpty: boolean) => void
) => {
  const prodCol = collection(db, 'products');
  return onSnapshot(
    prodCol,
    (snapshot) => {
      if (snapshot.empty) {
        callback([], true);
        return;
      }
      const list: ProductItem[] = [];
      snapshot.forEach((docSnap) => {
        const p = docSnap.data() as ProductItem;
        if (p && p.id) {
          list.push(p);
        }
      });
      callback(list, false);
    },
    (err) => {
      console.warn('Products snapshot error:', err);
    }
  );
};

export const saveProductToCloud = async (
  product: ProductItem,
  userOrEmail?: User | null | string
): Promise<boolean> => {
  try {
    const author =
      typeof userOrEmail === 'string'
        ? userOrEmail
        : userOrEmail?.email || userOrEmail?.displayName || 'Kasir Wigata';

    const data = sanitizeForFirestore({
      ...product,
      updatedAt: new Date().toISOString(),
      updatedBy: author,
    });
    await setDoc(doc(db, 'products', product.id), data, { merge: true });
    return true;
  } catch (error) {
    console.error('Save product error:', error);
    return false;
  }
};

export const saveAllProductsToCloud = async (
  products: ProductItem[],
  userOrEmail?: User | null | string
): Promise<boolean> => {
  try {
    for (const prod of products) {
      await saveProductToCloud(prod, userOrEmail);
    }
    return true;
  } catch (error) {
    console.error('Batch save products error:', error);
    return false;
  }
};

export const deleteProductFromCloud = async (productId: string) => {
  try {
    await deleteDoc(doc(db, 'products', productId));
    return true;
  } catch (error) {
    console.error('Delete product error:', error);
    return false;
  }
};

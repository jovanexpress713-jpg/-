import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  type User as FirebaseUser,
} from "firebase/auth";

export { signOut, onAuthStateChanged, type FirebaseUser };
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  collection,
  getDocs,
  deleteDoc,
} from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json";

// Initialize Firebase App
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// CRITICAL: Must pass firestoreDatabaseId as required by the environment
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

// Validate connection on boot as mandated by the Firebase skill
async function testConnection() {
  try {
    await getDocFromServer(doc(db, "test", "connection"));
  } catch (error) {
    if (error instanceof Error && error.message.includes("the client is offline")) {
      console.warn("[Firebase] Client connection initialization check.");
    }
  }
}
void testConnection();

// Structured Firestore error handler mandated by Firebase skill
export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error("Firestore Error: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export interface StoredUserProfile {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  role: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface StoredChatMessage {
  id?: string;
  conversationId: string;
  userId: string;
  role: "user" | "model" | "system";
  text: string;
  modelUsed?: string;
  agentRole?: string;
  createdAt?: string;
}

/**
 * Sign in securely with Google using Firebase Auth popup.
 * Seamlessly creates or retrieves the user profile in Firestore.
 */
export async function signInWithGoogle(): Promise<{
  firebaseUser: FirebaseUser;
  profile: StoredUserProfile;
}> {
  try {
    const cred = await signInWithPopup(auth, googleProvider);
    const fbUser = cred.user;

    const path = `users/${fbUser.uid}`;
    let profile: StoredUserProfile;

    try {
      const snap = await getDoc(doc(db, path));
      if (snap.exists()) {
        profile = snap.data() as StoredUserProfile;
      } else {
        // Derive default initial role
        const defaultRole = fbUser.email?.includes("driver")
          ? "DRIVER"
          : fbUser.email?.includes("client")
            ? "CUSTOMER"
            : "OPERATIONS_MANAGER";

        profile = {
          uid: fbUser.uid,
          email: fbUser.email || "",
          displayName: fbUser.displayName || fbUser.email?.split("@")[0] || "مستخدم إيجاز",
          photoURL: fbUser.photoURL || undefined,
          role: defaultRole,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await setDoc(doc(db, path), profile);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }

    return { firebaseUser: fbUser, profile };
  } catch (error: any) {
    console.error("Google sign-in error:", error);
    throw error;
  }
}

/**
 * Persists or updates the active user profile in Firestore
 */
export async function syncUserProfileToFirestore(
  profile: Partial<StoredUserProfile> & { uid: string; email: string }
): Promise<void> {
  const path = `users/${profile.uid}`;
  try {
    await setDoc(
      doc(db, path),
      {
        ...profile,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

/**
 * Save user theme/language preferences to Firestore
 */
export async function saveUserPreferencesToFirestore(
  uid: string,
  prefs: { theme?: string; language?: string }
): Promise<void> {
  const path = `users/${uid}/preferences/main`;
  try {
    await setDoc(
      doc(db, path),
      {
        userId: uid,
        ...prefs,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

/**
 * Persists a Gemini chat message in Firestore
 */
export async function saveChatMessageToFirestore(
  message: StoredChatMessage
): Promise<void> {
  if (!auth.currentUser) return;
  const msgId = message.id || `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const path = `users/${message.userId}/conversations/${message.conversationId}/messages/${msgId}`;
  try {
    await setDoc(doc(db, path), {
      ...message,
      createdAt: message.createdAt || new Date().toISOString(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

/**
 * Loads conversation messages from Firestore for thread continuity
 */
export async function loadChatMessagesFromFirestore(
  userId: string,
  conversationId: string
): Promise<StoredChatMessage[]> {
  if (!auth.currentUser) return [];
  const path = `users/${userId}/conversations/${conversationId}/messages`;
  try {
    const colRef = collection(db, "users", userId, "conversations", conversationId, "messages");
    const snapshot = await getDocs(colRef);
    const messages: StoredChatMessage[] = [];
    snapshot.forEach((d) => {
      messages.push({ ...(d.data() as StoredChatMessage), id: d.id });
    });
    // Sort in memory by createdAt
    messages.sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));
    return messages;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

/**
 * Clears conversation messages in Firestore
 */
export async function clearChatMessagesFromFirestore(
  userId: string,
  conversationId: string
): Promise<void> {
  if (!auth.currentUser) return;
  const path = `users/${userId}/conversations/${conversationId}/messages`;
  try {
    const colRef = collection(db, "users", userId, "conversations", conversationId, "messages");
    const snapshot = await getDocs(colRef);
    const deletePromises = snapshot.docs.map((d) => deleteDoc(d.ref));
    await Promise.all(deletePromises);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

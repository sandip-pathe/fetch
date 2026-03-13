import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Copy,
  Trash2,
  LogOut,
  Check,
  Link as LinkIcon,
  Zap,
  History,
  Search,
  Moon,
  Sun,
  Laptop,
  Smartphone,
  Tablet,
  X,
  QrCode,
  ArrowUp,
} from "lucide-react";
import QRCodeLib from "qrcode";
import { formatDistanceToNow } from "date-fns";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { motion, AnimatePresence } from "motion/react";
import { getFirebase } from "./lib/firebase";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  User as FirebaseAuthUser,
} from "firebase/auth";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  serverTimestamp,
  startAfter,
  getDocs,
  Timestamp,
} from "firebase/firestore";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ─── Device detection ──────────────────────────────────────────────────────
function getDeviceLabel(): string {
  const stored = localStorage.getItem("qc_device_label");
  if (stored) return stored;
  const ua = navigator.userAgent;
  let label = "Unknown";
  if (/iPhone/.test(ua)) label = "iPhone";
  else if (/iPad/.test(ua)) label = "iPad";
  else if (/Android/.test(ua) && /Mobile/.test(ua)) label = "Android";
  else if (/Android/.test(ua)) label = "Tablet";
  else if (/Macintosh|MacIntel/.test(ua)) label = "Mac";
  else if (/Windows/.test(ua)) label = "Windows";
  else if (/Linux/.test(ua)) label = "Linux";
  localStorage.setItem("qc_device_label", label);
  return label;
}

function getDeviceIcon(label: string): React.ElementType {
  if (label === "iPhone" || label === "Android") return Smartphone;
  if (label === "iPad" || label === "Tablet") return Tablet;
  return Laptop; // Mac, Windows, Linux, Unknown
}

type Clip = {
  id: string;
  userId: string;
  content: string;
  contentHtml?: string; // rich text preserved silently — not rendered in UI
  createdAt: Timestamp | null;
  category?: string;
  device?: string;
  metadata?: {
    title: string;
    domain: string;
  };
};

// ─── Clip localStorage cache ───────────────────────────────────────────────
const CLIPS_CACHE_KEY = (uid: string) => `qc_clips_v1_${uid}`;

function cacheClips(uid: string, clips: Clip[]) {
  try {
    localStorage.setItem(
      CLIPS_CACHE_KEY(uid),
      JSON.stringify(
        clips.map((c) => ({
          ...c,
          createdAt: c.createdAt
            ? {
                seconds: c.createdAt.seconds,
                nanoseconds: c.createdAt.nanoseconds,
              }
            : null,
        })),
      ),
    );
  } catch {}
}

function loadCachedClips(uid: string): Clip[] {
  try {
    const raw = localStorage.getItem(CLIPS_CACHE_KEY(uid));
    if (!raw) return [];
    return JSON.parse(raw).map((c: any) => ({
      ...c,
      createdAt: c.createdAt
        ? {
            seconds: c.createdAt.seconds,
            nanoseconds: c.createdAt.nanoseconds,
            toDate: () =>
              new Date(
                c.createdAt.seconds * 1000 +
                  Math.floor(c.createdAt.nanoseconds / 1_000_000),
              ),
          }
        : null,
    }));
  } catch {
    return [];
  }
}

function getLastClipboard(): string {
  return localStorage.getItem("qc_last_clipboard") ?? "";
}
function setLastClipboard(text: string) {
  localStorage.setItem("qc_last_clipboard", text.slice(0, 1000));
}

export default function App() {
  const [firebaseError, setFirebaseError] = useState(false);
  const [user, setUser] = useState<FirebaseAuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Initialise dark mode from localStorage or OS preference (runs once)
  useEffect(() => {
    const stored = localStorage.getItem("qc_dark_mode");
    if (stored !== null) {
      document.documentElement.classList.toggle("dark", stored === "true");
    } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      document.documentElement.classList.add("dark");
    }
  }, []);

  useEffect(() => {
    try {
      const { auth } = getFirebase();
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        setUser(user);
        setLoading(false);
      });
      return () => unsubscribe();
    } catch (e) {
      setFirebaseError(true);
      setLoading(false);
    }
  }, []);

  if (firebaseError) return <FirebaseSetupError />;
  if (loading) {
    // Don't show a spinner — show the skeleton shell instantly so there's
    // zero perceived loading time once the page paints.
    return (
      <div className="min-h-screen bg-[#faf9f5] dark:bg-[#262624] font-sans">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-px animate-pulse">
          <div className="h-11 w-32 bg-gray-200 dark:bg-gray-800 rounded-2xl mb-8" />
          <div className="h-36 bg-gray-100 dark:bg-gray-800/60 rounded-3xl mb-6" />
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-16 bg-gray-100 dark:bg-gray-800/60"
              style={{
                borderRadius:
                  i === 0
                    ? "1.25rem 1.25rem 0 0"
                    : i === 3
                      ? "0 0 1.25rem 1.25rem"
                      : 0,
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  return user ? <MainApp user={user} /> : <Login />;
}

function FirebaseSetupError() {
  return (
    <div className="min-h-screen bg-[#faf9f5] dark:bg-[#262624] flex flex-col items-center justify-center p-6 font-sans">
      <div className="max-w-md w-full bg-white dark:bg-[#30302e] rounded-2xl p-8 text-center border border-[#E5E5E3] dark:border-[#3A3A38]">
        <div className="w-14 h-14 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Zap fill="currentColor" strokeWidth={0} className="w-7 h-7" />
        </div>
        <h2 className="text-2xl font-semibold text-[#1F1F1F] dark:text-[#F4F4F3] mb-4">
          Setup Required
        </h2>
        <p className="text-[#6B6B6B] dark:text-[#B3B3B0] mb-6 leading-relaxed">
          Fetch requires Firebase to sync your clips across devices. Please add
          your Firebase configuration to the environment variables.
        </p>
        <div className="text-left bg-gray-50 dark:bg-[#3A3A3C] p-4 rounded-2xl text-xs sm:text-sm text-gray-700 dark:text-gray-300 font-mono overflow-x-auto border border-gray-100 dark:border-gray-600">
          VITE_FIREBASE_API_KEY=...
          <br />
          VITE_FIREBASE_AUTH_DOMAIN=...
          <br />
          VITE_FIREBASE_PROJECT_ID=...
          <br />
          VITE_FIREBASE_STORAGE_BUCKET=...
          <br />
          VITE_FIREBASE_MESSAGING_SENDER_ID=...
          <br />
          VITE_FIREBASE_APP_ID=...
        </div>
      </div>
    </div>
  );
}

function Login() {
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [temporary, setTemporary] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleAuth = async (isRegister: boolean) => {
    setError("");
    setIsLoading(true);

    try {
      const { auth } = getFirebase();
      const email = userId.includes("@") ? userId : `${userId}@quickclip.app`;

      await setPersistence(
        auth,
        temporary ? browserSessionPersistence : browserLocalPersistence,
      );

      if (isRegister) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      setError(err.message.replace("Firebase: ", ""));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleAuth(false);
  };

  return (
    <div className="min-h-screen bg-[#faf9f5] dark:bg-[#262624] flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex flex-col items-center gap-4">
          <Zap
            fill="currentColor"
            strokeWidth={0}
            className="w-10 h-10 text-[#1F1F1F] dark:text-[#F4F4F3]"
          />
          <div className="text-center">
            <h1 className="text-3xl font-semibold tracking-tight text-[#1F1F1F] dark:text-[#F4F4F3]">
              Fetch
            </h1>
            <p className="mt-1 text-base text-[#6B6B6B] dark:text-[#B3B3B0]">
              Instant cross-device clipboard
            </p>
          </div>
        </div>
      </div>

      <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-[#30302e] py-8 px-4 sm:rounded-2xl sm:px-10 border border-[#E5E5E3] dark:border-[#3A3A38]">
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 ml-1 mb-2">
                User ID or Email
              </label>
              <input
                type="text"
                required
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="block w-full rounded-xl border border-[#E5E5E3] dark:border-[#3A3A38] bg-[#faf9f5] dark:bg-[#333330] px-4 py-3 text-[#1F1F1F] dark:text-[#F4F4F3] placeholder-[#6B6B6B] dark:placeholder-[#B3B3B0] focus:bg-white dark:focus:bg-[#333330] focus:border-[#C5C5C3] dark:focus:border-[#4A4A48] focus:outline-none transition-all duration-120 text-base"
                placeholder="e.g. alex123"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 ml-1 mb-2">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full rounded-xl border border-[#E5E5E3] dark:border-[#3A3A38] bg-[#faf9f5] dark:bg-[#333330] px-4 py-3 text-[#1F1F1F] dark:text-[#F4F4F3] placeholder-[#6B6B6B] dark:placeholder-[#B3B3B0] focus:bg-white dark:focus:bg-[#333330] focus:border-[#C5C5C3] dark:focus:border-[#4A4A48] focus:outline-none transition-all duration-120 text-base"
                placeholder="••••••••"
              />
            </div>

            <div className="flex items-start gap-3 ml-1 py-1">
              <input
                id="temporary"
                type="checkbox"
                checked={temporary}
                onChange={(e) => setTemporary(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-[#1C1C1E] focus:ring-0 transition-colors"
              />
              <label
                htmlFor="temporary"
                className="text-sm text-gray-600 dark:text-gray-400 leading-snug"
              >
                Temporary session{" "}
                <span className="text-gray-400 dark:text-gray-500">
                  (clears when you close the tab)
                </span>
              </label>
            </div>

            {error && (
              <div className="text-red-500 text-sm text-center bg-red-50 dark:bg-red-900/20 py-2.5 rounded-xl border border-red-100 dark:border-red-800/30">
                {error}
              </div>
            )}

            <div className="pt-1 flex gap-3">
              <button
                type="button"
                onClick={() => handleAuth(true)}
                disabled={isLoading}
                className="flex-1 justify-center rounded-xl bg-white dark:bg-[#30302e] border border-[#E5E5E3] dark:border-[#3A3A38] py-3.5 px-4 text-base font-medium text-[#1F1F1F] dark:text-[#F4F4F3] hover:bg-[#F0F0EE] dark:hover:bg-[#323230] focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-120"
              >
                Register
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="flex-1 justify-center rounded-xl bg-[#C15C37] py-3.5 px-4 text-base font-medium text-white hover:bg-[#AD5231] focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-120"
              >
                {isLoading ? "Connecting…" : "Login"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function InputCard({
  onSend,
  onSendSuggestion,
}: {
  onSend: (content: string, contentHtml?: string) => Promise<void>;
  onSendSuggestion?: () => void;
}) {
  const [content, setContent] = useState("");
  const [contentHtml, setContentHtml] = useState<string | undefined>(undefined);
  const justPasted = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handlePaste = async () => {
    try {
      // Prefer ClipboardItem API — captures HTML formatting alongside plain text
      if (typeof ClipboardItem !== "undefined" && navigator.clipboard.read) {
        const items = await navigator.clipboard.read();
        let plain = "";
        let html = "";
        for (const item of items) {
          if (item.types.includes("text/html"))
            html = await (await item.getType("text/html")).text();
          if (item.types.includes("text/plain"))
            plain = await (await item.getType("text/plain")).text();
        }
        if (plain || html) {
          setContent((prev) => prev + plain);
          if (html) setContentHtml(html);
          textareaRef.current?.focus();
          return;
        }
      }
      // Fallback for browsers without read()
      const text = await navigator.clipboard.readText();
      setContent((prev) => prev + text);
      textareaRef.current?.focus();
    } catch (err) {
      console.error("Failed to read clipboard", err);
    }
  };

  const handleSubmit = async () => {
    if (!content.trim()) return;
    const textToSend = content;
    const htmlToSend = contentHtml;
    setContent("");
    setContentHtml(undefined);
    textareaRef.current?.focus();
    try {
      await onSend(textToSend, htmlToSend);
    } catch (err) {
      console.error("Failed to send", err);
    }
  };

  return (
    <div className="bg-white dark:bg-[#30302e] rounded-[18px] border border-[#E5E5E3] dark:border-[#3A3A38] hover:border-[#C5C5C3] dark:hover:border-[#4A4A48] mb-6 transition-colors duration-120">
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => {
          setContent(e.target.value);
          // Clear stored HTML if user manually edits (not from a paste event)
          if (!justPasted.current) setContentHtml(undefined);
        }}
        onPaste={(e) => {
          const html = e.clipboardData?.getData("text/html");
          if (html) {
            justPasted.current = true;
            setContentHtml(html);
            setTimeout(() => {
              justPasted.current = false;
            }, 0);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (content.trim()) {
              handleSubmit();
            } else if (onSendSuggestion) {
              onSendSuggestion();
            }
          }
        }}
        placeholder="Paste text or links here…"
        className="w-full resize-none border-0 bg-transparent px-5 pt-5 pb-3 text-base text-[#1F1F1F] dark:text-[#F4F4F3] placeholder:text-[#6B6B6B] dark:placeholder:text-[#B3B3B0] focus:ring-0 focus:outline-none min-h-28 leading-[1.55]"
      />
      <div className="flex items-center justify-end gap-2 px-4 pb-3 pt-1">
        <button
          onClick={handlePaste}
          type="button"
          className="flex items-center gap-1.5 px-3 py-2 rounded-[10px] border border-[#E5E5E3] dark:border-[#3A3A38] text-[#6B6B6B] dark:text-[#B3B3B0] font-medium text-sm hover:bg-[#F0F0EE] dark:hover:bg-[#323230] focus:outline-none transition-all duration-120"
        >
          <Zap fill="currentColor" strokeWidth={0} className="w-4 h-4" />
          Paste
        </button>
        <button
          onClick={handleSubmit}
          type="button"
          disabled={!content.trim()}
          className="flex items-center justify-center w-9 h-9 rounded-[10px] bg-[#C15C37] text-white hover:bg-[#AD5231] disabled:opacity-30 focus:outline-none transition-all duration-120"
          title="Send"
        >
          <ArrowUp className="w-4 h-4" strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}

// ─── Floating toast ────────────────────────────────────────────────────────
function Toast({ message, visible }: { message: string; visible: boolean }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{
            opacity: 0,
            y: 4,
            scale: 0.97,
            transition: { duration: 0.15 },
          }}
          className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-[#1F1F1F] dark:bg-[#F4F4F3] text-white dark:text-[#1F1F1F] text-[13px] font-medium px-4 py-2 rounded-[10px] shadow-md z-60 flex items-center gap-1.5 pointer-events-none whitespace-nowrap"
        >
          <Check className="w-4 h-4" />
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function MainApp({ user }: { user: FirebaseAuthUser }) {
  // liveClips: top-5 real-time window. extraClips: older pages from "load more".
  const [liveClips, setLiveClips] = useState<Clip[]>(() =>
    loadCachedClips(user.uid),
  );
  const [extraClips, setExtraClips] = useState<Clip[]>([]);
  const liveLastDocRef = useRef<any>(null); // last Firestore doc from snapshot
  const extraLastDocRef = useRef<any>(null); // last Firestore doc from loadMore
  // Merged, deduplicated list — liveClips first (newest), then older extra pages
  const clips = useMemo(() => {
    const seen = new Set(liveClips.map((c) => c.id));
    return [...liveClips, ...extraClips.filter((c) => !seen.has(c.id))];
  }, [liveClips, extraClips]);
  const [loading, setLoading] = useState(
    () => loadCachedClips(user.uid).length === 0,
  );
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [clipboardSuggestion, setClipboardSuggestion] = useState<string | null>(
    null,
  );
  const [toast, setToast] = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  const [isDark, setIsDark] = useState(() =>
    document.documentElement.classList.contains("dark"),
  );
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSendRef = useRef<
    (content: string, contentHtml?: string) => Promise<void>
  >(async () => {});
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const showToastMsg = (msg: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(msg);
    setToastVisible(true);
    toastTimerRef.current = setTimeout(() => setToastVisible(false), 900);
  };

  const toggleDark = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("qc_dark_mode", String(next));
  };

  // ─── Clipboard suggestion ───────────────────────────────────────────────
  const checkClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim() && text.trim() !== getLastClipboard()) {
        setClipboardSuggestion(text.trim());
      }
    } catch {}
  };

  useEffect(() => {
    checkClipboard();
    const onVisible = () => {
      if (document.visibilityState === "visible") checkClipboard();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  // ─── Page-level drag-and-drop ───────────────────────────────────────────────
  useEffect(() => {
    let counter = 0;
    const onDragEnter = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes("text/plain")) return;
      counter++;
      setIsDraggingOver(true);
    };
    const onDragOver = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes("text/plain")) return;
      e.preventDefault(); // required for drop to fire
    };
    const onDragLeave = () => {
      counter--;
      if (counter <= 0) {
        counter = 0;
        setIsDraggingOver(false);
      }
    };
    const onDrop = (e: DragEvent) => {
      counter = 0;
      e.preventDefault();
      setIsDraggingOver(false);
      const text = e.dataTransfer?.getData("text/plain");
      if (text?.trim()) {
        handleSendRef.current(text.trim());
        setLastClipboard(text.trim());
        showToastMsg("Saved instantly");
      }
    };
    document.addEventListener("dragenter", onDragEnter);
    document.addEventListener("dragover", onDragOver);
    document.addEventListener("dragleave", onDragLeave);
    document.addEventListener("drop", onDrop);
    return () => {
      document.removeEventListener("dragenter", onDragEnter);
      document.removeEventListener("dragover", onDragOver);
      document.removeEventListener("dragleave", onDragLeave);
      document.removeEventListener("drop", onDrop);
    };
  }, []);

  // Real-time listener — always watches the latest 5 clips only
  useEffect(() => {
    const { db } = getFirebase();
    const q = query(
      collection(db, "clips"),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc"),
      limit(5),
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newLive = snapshot.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as Clip,
      );
      setLiveClips(newLive);
      liveLastDocRef.current =
        snapshot.docs.length > 0
          ? snapshot.docs[snapshot.docs.length - 1]
          : null;
      // Only drive hasMore from the snapshot until "load more" is ever used
      if (!extraLastDocRef.current) {
        setHasMore(snapshot.docs.length === 5);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user.uid]);

  // Keep localStorage cache in sync with what's visible
  useEffect(() => {
    if (clips.length > 0) cacheClips(user.uid, clips);
  }, [clips, user.uid]);

  const handleSend = async (content: string, contentHtml?: string) => {
    let finalContent = content.trim();
    if (!finalContent) return;

    setLastClipboard(finalContent);
    let category = "";

    // Parse slash command
    const slashMatch = finalContent.match(/^\/([a-zA-Z]+)\s+(.*)/s);
    if (slashMatch) {
      category = slashMatch[1].toUpperCase();
      finalContent = slashMatch[2];
    }

    const { db } = getFirebase();
    const docData: any = {
      userId: user.uid,
      content: finalContent,
      device: getDeviceLabel(),
      createdAt: serverTimestamp(),
    };
    if (category) docData.category = category;
    if (contentHtml) docData.contentHtml = contentHtml;

    // Add document immediately for optimistic UI
    const docRef = await addDoc(collection(db, "clips"), docData);

    // Check for single URL and fetch metadata asynchronously
    if (finalContent.match(/^https?:\/\/[^\s]+$/)) {
      try {
        const res = await fetch(
          `/api/metadata?url=${encodeURIComponent(finalContent)}`,
        );
        if (res.ok) {
          const metadata = await res.json();
          await updateDoc(docRef, { metadata });
        }
      } catch (err) {
        console.error("Failed to fetch metadata", err);
      }
    }
  };

  // Keep ref current so one-time drag listener always calls the latest handleSend
  handleSendRef.current = handleSend;

  const handleSendSuggestion = () => {
    if (!clipboardSuggestion) return;
    setLastClipboard(clipboardSuggestion);
    handleSend(clipboardSuggestion);
    setClipboardSuggestion(null);
  };

  const handleIgnoreSuggestion = () => {
    if (!clipboardSuggestion) return;
    setLastClipboard(clipboardSuggestion);
    setClipboardSuggestion(null);
  };

  const loadMore = async () => {
    const cursor = extraLastDocRef.current || liveLastDocRef.current;
    if (!cursor) return;
    setLoadingMore(true);
    const { db } = getFirebase();
    const q = query(
      collection(db, "clips"),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc"),
      startAfter(cursor),
      limit(10),
    );
    const snapshot = await getDocs(q);
    const more = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Clip);
    setExtraClips((prev) => [...prev, ...more]);
    if (snapshot.docs.length > 0) {
      extraLastDocRef.current = snapshot.docs[snapshot.docs.length - 1];
    }
    setHasMore(snapshot.docs.length === 10);
    setLoadingMore(false);
  };

  const handleDelete = async (id: string) => {
    const { db } = getFirebase();
    await deleteDoc(doc(db, "clips", id));
    // onSnapshot handles removal from liveClips; manually purge from extraClips
    setExtraClips((prev) => prev.filter((c) => c.id !== id));
  };

  return (
    <div className="min-h-screen bg-[#faf9f5] dark:bg-[#262624] font-sans text-[#1F1F1F] dark:text-[#F4F4F3]">
      <header className="bg-[#faf9f5]/85 dark:bg-[#262624]/85 backdrop-blur-xl sticky top-0 z-20 border-b border-[#E5E5E3] dark:border-[#3A3A38]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Zap
              fill="currentColor"
              strokeWidth={0}
              className="w-5 h-5 text-[#1F1F1F] dark:text-[#F4F4F3]"
            />
            <div>
              <h1 className="font-semibold text-[15px] tracking-tight leading-none text-[#1F1F1F] dark:text-[#F4F4F3]">
                Fetch
              </h1>
              <p className="text-[11px] text-[#6B6B6B] dark:text-[#B3B3B0] mt-0.5 leading-none">
                Instant clipboard
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowHistory(true)}
              className="px-3 py-2 text-[13px] font-medium text-[#6B6B6B] dark:text-[#B3B3B0] hover:text-[#1F1F1F] dark:hover:text-[#F4F4F3] hover:bg-[#EAEAE8] dark:hover:bg-[#2F2F2D] rounded-[10px] transition-all duration-120 flex items-center gap-1.5"
            >
              <History className="w-4 h-4" />
              <span className="hidden sm:inline">History</span>
            </button>
            <button
              onClick={toggleDark}
              className="p-2 text-[#6B6B6B] dark:text-[#B3B3B0] hover:text-[#1F1F1F] dark:hover:text-[#F4F4F3] hover:bg-[#EAEAE8] dark:hover:bg-[#2F2F2D] rounded-[10px] transition-all duration-120"
              title={isDark ? "Light mode" : "Dark mode"}
            >
              {isDark ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>
            <button
              onClick={() => getFirebase().auth.signOut()}
              className="p-2 text-[#6B6B6B] dark:text-[#B3B3B0] hover:text-[#1F1F1F] dark:hover:text-[#F4F4F3] hover:bg-[#EAEAE8] dark:hover:bg-[#2F2F2D] rounded-[10px] transition-all duration-120"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        <InputCard
          onSend={handleSend}
          onSendSuggestion={
            clipboardSuggestion ? handleSendSuggestion : undefined
          }
        />

        <AnimatePresence>
          {clipboardSuggestion && (
            <ClipboardSuggestionBar
              text={clipboardSuggestion}
              onSend={handleSendSuggestion}
              onIgnore={handleIgnoreSuggestion}
            />
          )}
        </AnimatePresence>

        {/* Clip list */}
        <div className="divide-y divide-[#E5E5E3] dark:divide-[#3A3A38]">
          <AnimatePresence initial={false}>
            {clips.map((clip) => (
              <ClipCard
                key={clip.id}
                clip={clip}
                onDelete={handleDelete}
                onCopy={(text) => {
                  setLastClipboard(text);
                  showToastMsg("Copied to clipboard");
                }}
              />
            ))}
          </AnimatePresence>

          {clips.length === 0 && (
            <div className="px-5 py-16 text-center">
              <p className="text-[13px] text-[#6B6B6B] dark:text-[#B3B3B0]">
                No clips yet. Paste something above!
              </p>
            </div>
          )}
        </div>

        {hasMore && clips.length > 0 && (
          <div className="pt-4 pb-10 flex justify-center">
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="px-6 py-2 rounded-[10px] border border-[#E5E5E3] dark:border-[#3A3A38] text-[#6B6B6B] dark:text-[#B3B3B0] font-medium text-[13px] hover:bg-white dark:hover:bg-[#30302e] transition-all duration-120 disabled:opacity-40 flex items-center gap-2"
            >
              {loadingMore && (
                <span className="w-3 h-3 border-[1.5px] border-current border-t-transparent rounded-full animate-spin" />
              )}
              Load more
            </button>
          </div>
        )}
      </main>

      <AnimatePresence>
        {showHistory && (
          <HistoryModal
            user={user}
            onClose={() => setShowHistory(false)}
            onDelete={handleDelete}
            onCopy={(text) => {
              setLastClipboard(text);
              showToastMsg("Copied to clipboard");
            }}
          />
        )}
      </AnimatePresence>

      {/* Drag-and-drop overlay */}
      <AnimatePresence>
        {isDraggingOver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.12 } }}
            exit={{ opacity: 0, transition: { duration: 0.08 } }}
            className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center"
          >
            <div className="absolute inset-4 rounded-3xl border-2 border-dashed border-[#007AFF]/60 dark:border-[#007AFF]/50 bg-[#007AFF]/5 dark:bg-[#007AFF]/8" />
            <div className="relative bg-white dark:bg-[#2C2C2E] rounded-3xl px-8 py-5 shadow-xl border border-gray-100 dark:border-gray-700/60 text-center">
              <p className="text-base font-semibold text-gray-900 dark:text-white">
                Drop to save
              </p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">
                Saves instantly to your clipboard
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Toast message={toast} visible={toastVisible} />
    </div>
  );
}

function ClipboardSuggestionBar({
  text,
  onSend,
  onIgnore,
}: {
  text: string;
  onSend: () => void;
  onIgnore: () => void;
}) {
  const preview = text.length > 140 ? text.slice(0, 140) + "…" : text;
  return (
    <motion.div
      initial={{ opacity: 0, y: -6, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, transition: { duration: 0.1 } }}
      transition={{ type: "spring", damping: 26, stiffness: 340 }}
      className="mb-4 rounded-[14px] border border-[#E5E5E3] dark:border-[#3A3A38] bg-white dark:bg-[#30302e] overflow-hidden"
    >
      <div className="px-5 pt-4 pb-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B6B6B] dark:text-[#B3B3B0] mb-1.5">
          Clipboard detected
        </p>
        <p className="text-[14px] text-[#1F1F1F] dark:text-[#F4F4F3] leading-snug break-all line-clamp-2">
          {preview}
        </p>
      </div>
      <div className="flex gap-2 px-4 pb-4 pt-0">
        <button
          onClick={onIgnore}
          className="flex-1 py-2.5 rounded-[10px] text-[13px] font-medium text-[#6B6B6B] dark:text-[#B3B3B0] bg-[#F0F0EE] dark:bg-[#333330] hover:bg-[#E8E8E6] dark:hover:bg-[#3A3A38] transition-all duration-120"
        >
          Ignore
        </button>
        <button
          onClick={onSend}
          className="flex-1 py-2.5 rounded-[10px] text-[13px] font-semibold bg-[#C15C37] text-white hover:bg-[#AD5231] transition-all duration-120"
        >
          Send
        </button>
      </div>
    </motion.div>
  );
}

// Split text by a search term, wrapping matches in a yellow <mark>
function renderHighlighted(text: string, term: string): React.ReactNode {
  if (!term.trim()) return text;
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  // Capturing group keeps matches in the array at odd indices
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <mark
        key={i}
        className="bg-yellow-100 dark:bg-yellow-500/25 text-inherit rounded-[3px] px-px not-italic"
      >
        {part}
      </mark>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    ),
  );
}

// ─── QR Modal ─────────────────────────────────────────────────────────────
function QrModal({ url, onClose }: { url: string; onClose: () => void }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    QRCodeLib.toDataURL(url, {
      width: 240,
      margin: 2,
      color: { dark: "#1F1F1F", light: "#FFFFFF" },
    }).then(setDataUrl);
  }, [url]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.92, opacity: 0 }}
        transition={{ type: "spring", damping: 28, stiffness: 380 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-[#2A2A28] rounded-3xl p-6 shadow-2xl flex flex-col items-center gap-4 max-w-xs w-full mx-4"
      >
        <div className="flex items-center justify-between w-full">
          <p className="text-[13px] font-semibold text-[#1F1F1F] dark:text-[#F4F4F3]">
            Scan to open
          </p>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#6B6B6B] dark:text-[#B3B3B0] hover:bg-[#f0eee6] dark:hover:bg-[#3A3A38] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {dataUrl ? (
          <img
            src={dataUrl}
            alt="QR code"
            width={200}
            height={200}
            className="rounded-xl"
          />
        ) : (
          <div className="w-50 h-50 rounded-xl bg-[#f0eee6] dark:bg-[#30302e] animate-pulse" />
        )}
        <p className="text-[11px] text-[#6B6B6B] dark:text-[#B3B3B0] break-all text-center max-w-full line-clamp-3">
          {url}
        </p>
      </motion.div>
    </motion.div>
  );
}

function ClipCard({
  clip,
  onDelete,
  onCopy,
  highlightTerm,
}: {
  clip: Clip;
  onDelete: (id: string) => void;
  onCopy?: (text: string) => void;
  highlightTerm?: string;
  key?: React.Key;
}) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [isLong, setIsLong] = useState(false);
  const DeviceIcon = clip.device ? getDeviceIcon(clip.device) : null;

  // Extract the first URL in the clip content, if any
  const firstUrl = useMemo(() => {
    const m = clip.content.match(/https?:\/\/[^\s]+/);
    return m ? m[0] : null;
  }, [clip.content]);

  useEffect(() => {
    if (contentRef.current) {
      setIsLong(
        contentRef.current.scrollHeight > contentRef.current.clientHeight + 4,
      );
    }
  }, [clip.content]);

  const handleCopy = async () => {
    try {
      // Restore rich formatting if available (e.g. bold/italic from Word, Notion, etc.)
      if (
        clip.contentHtml &&
        typeof ClipboardItem !== "undefined" &&
        navigator.clipboard.write
      ) {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/plain": new Blob([clip.content], { type: "text/plain" }),
            "text/html": new Blob([clip.contentHtml], { type: "text/html" }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(clip.content);
      }
      if (onCopy) onCopy(clip.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback — plain text only
      try {
        await navigator.clipboard.writeText(clip.content);
      } catch {}
    }
  };

  // Copy on any plain click — skip if user is selecting text
  const handleClick = (e: React.MouseEvent) => {
    const sel = window.getSelection();
    if (sel && sel.toString().length > 0) return;
    handleCopy();
  };

  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = clip.content.split(urlRegex);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.15 } }}
      layout
      onClick={handleClick}
      className="group relative px-5 py-3.5 cursor-default transition-all duration-120"
    >
      {clip.category && (
        <span className="mb-1.5 inline-flex items-center px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-700 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          {clip.category}
        </span>
      )}

      {/* Content — clamped to 4 lines, full text on expand */}
      <div
        ref={contentRef}
        className={cn(
          "text-[15px] text-[#1F1F1F] dark:text-[#F4F4F3] whitespace-pre-wrap wrap-break-word leading-snug",
          !expanded && "line-clamp-4",
        )}
      >
        {parts.map((part, i) => {
          if (part.match(urlRegex)) {
            return (
              <a
                key={i}
                href={part}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-[#007AFF] hover:underline break-all"
              >
                {part}
              </a>
            );
          }
          return (
            <span key={i}>
              {highlightTerm ? renderHighlighted(part, highlightTerm) : part}
            </span>
          );
        })}
      </div>

      {/* Expand toggle — only shown if content is long */}
      {isLong && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
          className="mt-1 text-xs text-[#007AFF] hover:underline focus:outline-none"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}

      {/* Link preview */}
      {clip.metadata && (
        <a
          href={clip.content}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="mt-2.5 flex items-center gap-2.5 text-sm text-[#6B6B6B] dark:text-[#B3B3B0] hover:text-[#1F1F1F] dark:hover:text-[#F4F4F3] transition-colors"
        >
          <LinkIcon className="w-3.5 h-3.5 shrink-0 text-[#6B6B6B] dark:text-[#B3B3B0]" />
          <span className="font-medium truncate">{clip.metadata.title}</span>
          <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">
            {clip.metadata.domain}
          </span>
        </a>
      )}

      {/* Footer row */}
      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-1 text-[12px] text-[#6B6B6B] dark:text-[#B3B3B0]">
          {clip.device && DeviceIcon && (
            <>
              <DeviceIcon className="w-3 h-3 shrink-0 opacity-60" />
              <span className="mx-1">·</span>
            </>
          )}
          <span>
            {clip.createdAt
              ? formatDistanceToNow(clip.createdAt.toDate(), {
                  addSuffix: true,
                })
              : "Just now"}
          </span>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          {firstUrl && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowQr(true);
              }}
              className="p-1.5 text-[#6B6B6B] dark:text-[#B3B3B0] hover:text-[#C15C37] dark:hover:text-[#C15C37] rounded-lg transition-colors"
              title="Show QR code"
            >
              <QrCode className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(clip.id);
            }}
            className="p-1.5 text-[#6B6B6B] dark:text-[#B3B3B0] hover:text-red-500 dark:hover:text-red-400 rounded-lg transition-colors"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleCopy();
            }}
            className={cn(
              "flex items-center gap-1 px-3 py-1.5 rounded-lg font-medium text-[12px] transition-all duration-120",
              copied
                ? "bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400"
                : "bg-[#f0eee6] dark:bg-[#30302e] text-[#6B6B6B] dark:text-[#B3B3B0] hover:bg-[#e8e6de] dark:hover:bg-[#3A3A38]",
            )}
          >
            {copied ? (
              <Check className="w-3 h-3" />
            ) : (
              <Copy className="w-3 h-3" />
            )}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
      <AnimatePresence>
        {showQr && firstUrl && (
          <QrModal url={firstUrl} onClose={() => setShowQr(false)} />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function HistoryModal({
  user,
  onClose,
  onDelete,
  onCopy,
}: {
  user: FirebaseAuthUser;
  onClose: () => void;
  onDelete: (id: string) => void;
  onCopy?: (text: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [clips, setClips] = useState<Clip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      const { db } = getFirebase();
      const q = query(
        collection(db, "clips"),
        where("userId", "==", user.uid),
        orderBy("createdAt", "desc"),
        limit(100),
      );
      const snapshot = await getDocs(q);
      setClips(
        snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Clip),
      );
      setLoading(false);
    };
    fetchAll();
  }, [user.uid]);

  const filtered = clips.filter((c) =>
    c.content.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/30 dark:bg-black/60"
      onClick={onClose}
    >
      {/* Bottom sheet — slides up from bottom, native feel */}
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 32, stiffness: 340, mass: 0.9 }}
        onClick={(e) => e.stopPropagation()}
        className="absolute inset-x-0 bottom-0 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-full sm:max-w-2xl h-[90vh] bg-[#faf9f5] dark:bg-[#262624] flex flex-col rounded-t-3xl overflow-hidden"
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
        </div>

        {/* Search header */}
        <div className="px-4 pb-3 pt-2 shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search history…"
              className="w-full bg-white dark:bg-[#30302e] text-[#1F1F1F] dark:text-[#F4F4F3] placeholder:text-[#6B6B6B] dark:placeholder:text-[#B3B3B0] border border-[#E5E5E3] dark:border-[#3A3A38] rounded-xl py-2.5 pl-10 pr-4 focus:outline-none transition-all duration-120 text-[13px]"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          <div className="mx-4 mb-4 divide-y divide-[#E5E5E3] dark:divide-[#3A3A38]">
            {loading ? (
              <div className="px-5 py-14 text-center">
                <div className="w-5 h-5 border-2 border-[#E5E5E3] dark:border-[#3A3A38] border-t-[#C15C37] rounded-full animate-spin mx-auto" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="px-5 py-14 text-center text-[13px] text-[#6B6B6B] dark:text-[#B3B3B0]">
                {search
                  ? `No clips matching "${search}"`
                  : "No clips in history yet"}
              </div>
            ) : (
              filtered.map((clip) => (
                <ClipCard
                  key={clip.id}
                  clip={clip}
                  highlightTerm={search}
                  onCopy={onCopy}
                  onDelete={(id) => {
                    onDelete(id);
                    setClips((prev) => prev.filter((c) => c.id !== id));
                  }}
                />
              ))
            )}
          </div>
        </div>

        {/* Close pill */}
        <div className="px-4 pb-6 pt-2 shrink-0">
          <button
            onClick={onClose}
            className="w-full py-3 rounded-[14px] bg-white dark:bg-[#30302e] border border-[#E5E5E3] dark:border-[#3A3A38] text-[#1F1F1F] dark:text-[#F4F4F3] font-medium text-[13px] hover:bg-[#F0F0EE] dark:hover:bg-[#2F2F2D] transition-all duration-120"
          >
            Close
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

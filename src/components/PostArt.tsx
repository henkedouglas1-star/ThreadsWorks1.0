import React, { useEffect, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";
type Asset = { id: string; postId: string; createdAt?: string };
async function request(uid: string, path = "", options: RequestInit = {}) {
  const user = auth.currentUser;
  if (!user || user.uid !== uid) throw new Error("Sign in to access artwork.");
  const token = await user.getIdToken();
  const response = await fetch("/api/post-art" + path, { ...options, headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" } });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(({ LIMIT: "Your artwork allowance has been used.", BUSY: "Artwork is already generating. Try again shortly.", UNAVAILABLE: "Artwork generation is not configured yet." } as Record<string,string>)[body.error] || "Artwork request failed. Please retry.");
  }
  return response;
}
function useUid() {
  const [uid, setUid] = useState(auth.currentUser?.uid || "");
  useEffect(() => onAuthStateChanged(auth, u => setUid(u?.uid || "")), []);
  return uid;
}
function Preview({ uid, asset }: { uid: string; asset: Asset }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true, objectUrl = "";
    setUrl(""); setError("");
    request(uid, "/" + asset.id + "/image").then(r => r.blob()).then(blob => {
      if (active) { objectUrl = URL.createObjectURL(blob); setUrl(objectUrl); }
    }).catch(() => { if (active) setError("Unable to load artwork. Reopen to retry."); });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [uid, asset.id]);
  return <div className="space-y-2">{error ? <p role="alert">{error}</p> : url ? <><img src={url} alt="Generated post artwork" className="max-w-full rounded-xl" /><a href={url} download={asset.id + ".png"} className="underline text-sm">Download artwork</a></> : <p role="status">Loading artwork…</p>}</div>;
}
export function PostArt({ postId, text }: { postId: string; text: string }) {
  const uid = useUid();
  return uid ? <PostArtSession key={uid + ":" + postId} uid={uid} postId={postId} text={text} /> : null;
}
function PostArtSession({ uid, postId, text }: { uid: string; postId: string; text: string }) {
  const [asset, setAsset] = useState<Asset | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    request(uid).then(r => r.json()).then(data => { if (mounted.current) setAsset(old => old || data.images.find((a: Asset) => a.postId === postId) || null); }).catch(() => {});
    return () => { mounted.current = false; };
  }, [uid, postId]);
  async function generate() {
    if (lock.current || !text.trim()) return;
    lock.current = true; setBusy(true); setError("");
    try {
      const result = await request(uid, "", { method: "POST", body: JSON.stringify({ postId, text }) });
      const image = await result.json();
      if (mounted.current) setAsset(image);
    } catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : "Generation failed."); }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  }
  return <div className="p-4 border-t border-border-primary space-y-2">{asset ? <Preview uid={uid} asset={asset} /> : <button type="button" disabled={busy || !text.trim()} onClick={generate} className="rounded-lg border border-brand-border px-3 py-2 text-sm font-semibold disabled:opacity-50">{busy ? "Generating art…" : error ? "Retry Generate Art" : "Generate Art"}</button>}{error && <p role="alert" className="text-sm">{error}</p>}</div>;
}
export function ArtAlbum() {
  const uid = useUid();
  return uid ? <AlbumSession key={uid} uid={uid} /> : <p>Sign in to view your artwork.</p>;
}
function AlbumSession({ uid }: { uid: string }) {
  const [images, setImages] = useState<Asset[]>([]);
  const [status, setStatus] = useState("Loading artwork…");
  const [revision, refresh] = useState(0);
  useEffect(() => {
    let active = true;
    setStatus("Loading artwork…");
    request(uid).then(r => r.json()).then(data => { if (active) { setImages(data.images); setStatus(data.images.length ? "" : "No artwork yet. Generate art from a post."); } }).catch(() => { if (active) setStatus("Unable to load artwork."); });
    return () => { active = false; };
  }, [uid, revision]);
  return <section className="p-4 space-y-4"><h2 className="text-xl font-bold">Album</h2><button type="button" onClick={() => refresh(v => v + 1)} className="underline text-sm">Refresh album</button>{status && <p role="status">{status}</p>}<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{images.map(a => <Preview key={a.id} uid={uid} asset={a} />)}</div></section>;
}

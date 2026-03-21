'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { encryptFile, decryptFile } from '@/lib/crypto';
import { supabase } from '@/lib/supabase';

interface VaultDocument {
  id: string;
  filename_encrypted: string;
  iv: string;
  salt: string;
  storage_path: string;
  mime_type: string;
  created_at: string;
}

export default function SecureVault() {
  const [password, setPassword] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(false);
  
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [documents, setDocuments] = useState<VaultDocument[]>([]);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load from Supabase (Normally RLS protected, for demo we just fetch all or filter by user)
  const loadDocuments = async () => {
    const { data } = await supabase.from('vault_documents').select('*').order('created_at', { ascending: false });
    if (data) setDocuments(data as VaultDocument[]);
  };

  useEffect(() => {
    if (isUnlocked) {
      loadDocuments();
    }
  }, [isUnlocked]);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length >= 8) {
      setIsUnlocked(true);
    } else {
      alert('Password must be at least 8 characters for AES-256-GCM derivation.');
    }
  };

  const handleUpload = async () => {
    if (!file || !password) return;
    setUploading(true);

    try {
      // 1. Zero-Knowledge: Encrypt file entirely in the browser
      const { ciphertext, iv, salt } = await encryptFile(file, password);
      
      // We also encrypt the filename so the server doesn't even know what the file is
      const encName = await encryptFile(new Blob([file.name]), password);

      // 2. Upload ciphertext to Supabase Storage
      const storagePath = `${Date.now()}_${Math.random().toString(36).substring(7)}.enc`;
      const { error: uploadError } = await supabase.storage
        .from('secure_vault')
        .upload(storagePath, ciphertext);

      if (uploadError) throw new Error('Storage Upload Failed');

      // 3. Save metadata to DB (Server only sees base64 primitives and a storage path)
      const { error: dbError } = await supabase.from('vault_documents').insert({
        filename_encrypted: encName.iv + ':' + encName.salt + ':---', // Simplification for demo
        iv: iv,
        salt: salt,
        storage_path: storagePath,
        mime_type: file.type,
      });

      if (dbError) throw new Error('Metadata Save Failed');

      setFile(null);
      await loadDocuments();
    } catch (err: unknown) {
      console.error(err);
      alert('Encryption or Upload failed: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (doc: VaultDocument) => {
    setDownloadingId(doc.id);
    try {
      // 1. Fetch encrypted blob from storage
      const { data: blob, error } = await supabase.storage.from('secure_vault').download(doc.storage_path);
      if (error || !blob) throw new Error('Failed to download ciphertext from vault limit');

      // 2. Decrypt locally
      const decryptedBlob = await decryptFile(blob, password, doc.iv, doc.salt, doc.mime_type);

      // 3. Trigger standard browser download
      const url = URL.createObjectURL(decryptedBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `decrypted_document`; // Ideally we'd decrypt the filename too
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
    } catch (err: unknown) {
      alert((err instanceof Error ? err.message : String(err)) || 'Decryption failed. Incorrect Vault Password?');
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white font-mono p-8 selection:bg-purple-500/30">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="border border-green-500/20 bg-green-500/[0.02] p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
            <svg width="120" height="120" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-green-400 tracking-widest mb-2">ZERO-KNOWLEDGE VAULT</h1>
          <p className="text-[11px] text-green-400/60 leading-relaxed max-w-2xl tracking-wide">
            Client-Side End-to-End Encryption (E2EE) powered by Web Crypto API (AES-256-GCM).<br/>
            Files are mathematically scrambled in your browser. The server only receives ciphertext.<br/>
            If the server is breached, your data remains mathematically impossible to read without your Vault Password.
          </p>
        </div>

        <AnimatePresence mode="wait">
          {!isUnlocked ? (
            <motion.div
              key="lock"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="border border-white/10 p-8 max-w-md mx-auto bg-black shadow-2xl"
            >
              <div className="flex flex-col items-center text-center space-y-6">
                <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center text-2xl">
                  🔒
                </div>
                <div>
                  <h2 className="text-sm font-bold tracking-widest text-white/90">VAULT LOCKED</h2>
                  <p className="text-[10px] text-white/40 mt-2">Enter your local encryption key to proceed.</p>
                </div>
                
                <form onSubmit={handleUnlock} className="w-full space-y-4">
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Vault Master Password"
                    className="w-full bg-white/[0.03] border border-white/10 px-4 py-3 text-sm focus:outline-none focus:border-green-500/50 focus:bg-white/[0.05] transition-all text-center tracking-widest"
                  />
                  <button 
                    type="submit"
                    className="w-full bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/30 py-3 text-[11px] font-bold tracking-[0.2em] transition-all"
                  >
                    DERIVE KEY & UNLOCK
                  </button>
                </form>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="vault"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-6"
            >
              {/* Upload Zone */}
              <div className="border border-white/10 bg-white/[0.02] p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-bold tracking-widest text-white/80">ENCRYPT & UPLOAD</h3>
                  <div className="px-2 py-1 bg-green-500/10 border border-green-500/30 text-[9px] text-green-400 tracking-widest">
                    AES-256-GCM ACTIVE
                  </div>
                </div>
                
                <div className="flex gap-4 items-center">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-6 py-3 border border-white/20 hover:border-white/40 hover:bg-white/5 transition-all text-[11px] tracking-wider"
                  >
                    {file ? file.name : 'SELECT DOCUMENT'}
                  </button>
                  
                  {file && (
                    <button
                      onClick={handleUpload}
                      disabled={uploading}
                      className={`px-6 py-3 border border-green-500/40 text-green-400 text-[11px] font-bold tracking-wider transition-all ${uploading ? 'bg-green-500/20 animate-pulse' : 'hover:bg-green-500/10'}`}
                    >
                      {uploading ? 'ENCRYPTING & SENDING...' : 'ENCRYPT -> UPLOAD'}
                    </button>
                  )}
                </div>
                {file && !uploading && (
                  <div className="mt-3 text-[9px] text-white/40">
                    File will be encrypted using PBKDF2 derived key before transmission.
                  </div>
                )}
              </div>

              {/* Document List */}
              <div className="border border-white/10 bg-white/[0.01]">
                <div className="px-6 py-4 border-b border-white/5">
                  <h3 className="text-xs font-bold tracking-widest text-white/80">YOUR SECURE DOCUMENTS</h3>
                </div>
                
                {documents.length === 0 ? (
                  <div className="p-12 text-center text-white/20 text-[10px] tracking-widest">
                    NO ENCRYPTED DOCUMENTS FOUND
                  </div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {documents.map((doc) => (
                      <div key={doc.id} className="p-6 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                        <div className="space-y-2">
                          <div className="flex items-center gap-3">
                            <span className="text-xl">📄</span>
                            <span className="text-sm font-bold text-white/70">Encrypted Document</span>
                          </div>
                          <div className="flex items-center gap-4 text-[9px] text-white/30 font-mono">
                            <span>ID: {doc.id.split('-')[0]}...</span>
                            <span>MIME: {doc.mime_type}</span>
                            <span>DATE: {new Date(doc.created_at).toLocaleString()}</span>
                          </div>
                          <div className="text-[8px] text-green-400/50 font-mono truncate max-w-md">
                            IV: {doc.iv}
                          </div>
                        </div>
                        
                        <button
                          onClick={() => handleDownload(doc)}
                          disabled={downloadingId === doc.id}
                          className={`px-4 py-2 border transition-all text-[10px] tracking-widest font-bold ${
                            downloadingId === doc.id
                              ? 'border-green-500/40 text-green-400 bg-green-500/10 animate-pulse'
                              : 'border-white/20 text-white/60 hover:text-white hover:border-white/40 hover:bg-white/5'
                          }`}
                        >
                          {downloadingId === doc.id ? 'DECRYPTING...' : 'FETCH & DECRYPT'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

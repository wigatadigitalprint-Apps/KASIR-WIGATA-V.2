import React, { useState } from 'react';
import {
  Cloud,
  CheckCircle2,
  RefreshCw,
  Server,
  Database,
  ExternalLink,
  Laptop,
  X,
  Mail,
  Save,
} from 'lucide-react';
import { Transaction, ProductItem } from '../types';

interface CloudSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: Transaction[];
  products: ProductItem[];
  userEmail: string;
  onUpdateUserEmail: (email: string) => void;
  onManualSyncAll: () => Promise<void>;
  onShowToast: (msg: string) => void;
}

export const CloudSyncModal: React.FC<CloudSyncModalProps> = ({
  isOpen,
  onClose,
  transactions,
  products,
  userEmail,
  onUpdateUserEmail,
  onManualSyncAll,
  onShowToast,
}) => {
  const [emailInput, setEmailInput] = useState(userEmail || 'wigatadigitalprint@gmail.com');
  const [isSyncing, setIsSyncing] = useState(false);

  if (!isOpen) return null;

  const handleSaveEmail = () => {
    onUpdateUserEmail(emailInput);
    onShowToast(`Akun Wigata disimpan: ${emailInput}`);
  };

  const handleSyncNow = async () => {
    setIsSyncing(true);
    try {
      await onManualSyncAll();
      onShowToast('Semua data berhasil disinkronkan ke Cloud!');
    } catch {
      onShowToast('Sinkronisasi cloud gagal');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-neutral-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Compact Header */}
        <div className="bg-[#0B1E3A] text-white px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-400 flex items-center justify-center">
              <Cloud className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 leading-none">
                <span className="font-extrabold text-sm">Cloud Sync Multi-PC & HP</span>
                <span className="bg-emerald-500 text-white text-[8.5px] px-1.5 py-0.5 rounded-full font-bold uppercase">
                  Aktif
                </span>
              </div>
              <p className="text-[10px] text-white/70 mt-0.5">
                Database Cloud Firestore Real-time
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 space-y-3 overflow-y-auto text-xs">
          {/* Status Alert Box */}
          <div className="bg-emerald-50/90 border border-emerald-200 rounded-xl p-2.5 flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <div className="text-[11px] text-emerald-900 leading-tight">
              <strong>Database Cloud Terhubung Real-Time.</strong> Penambahan nota &amp; produk di satu perangkat langsung tersinkron ke perangkat lain.
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-2.5 flex items-center justify-between">
              <div>
                <div className="text-[10.5px] text-neutral-500 font-semibold flex items-center gap-1">
                  <Database className="w-3 h-3 text-amber-500" />
                  <span>Nota Cloud</span>
                </div>
                <div className="text-base font-black text-[#0B1E3A]">{transactions.length}</div>
              </div>
              <span className="text-[9px] font-bold text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded">Sinkron</span>
            </div>

            <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-2.5 flex items-center justify-between">
              <div>
                <div className="text-[10.5px] text-neutral-500 font-semibold flex items-center gap-1">
                  <Server className="w-3 h-3 text-blue-500" />
                  <span>Produk Cloud</span>
                </div>
                <div className="text-base font-black text-[#0B1E3A]">{products.length}</div>
              </div>
              <span className="text-[9px] font-bold text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded">Aktif</span>
            </div>
          </div>

          {/* Share Link to HP */}
          <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[11px] text-blue-950 flex items-center gap-1">
                <Laptop className="w-3.5 h-3.5 text-blue-600" />
                <span>Buka di HP atau Komputer Lain:</span>
              </span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href);
                  onShowToast('Link disalin! Kirim via WA untuk dibuka di HP.');
                }}
                className="text-[10.5px] bg-blue-600 hover:bg-blue-700 text-white font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 cursor-pointer transition shadow-xs"
              >
                <ExternalLink className="w-3 h-3" />
                <span>Salin Link</span>
              </button>
            </div>
            <p className="text-[10.5px] text-blue-900 leading-relaxed">
              Buka link yang sama di Chrome/Safari HP. Data otomatis tersambung ke database yang sama.
            </p>
          </div>

          {/* Email Akun / Kasir */}
          <div className="space-y-1">
            <label className="font-bold text-[10.5px] text-[#0B1E3A] flex items-center gap-1">
              <Mail className="w-3 h-3 text-neutral-500" />
              <span>Email Akun / Kasir:</span>
            </label>
            <div className="flex gap-1.5">
              <input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="wigatadigitalprint@gmail.com"
                className="flex-1 px-2.5 py-1.5 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:border-blue-600 bg-neutral-50"
              />
              <button
                onClick={handleSaveEmail}
                className="bg-[#0B1E3A] hover:bg-black text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <Save className="w-3 h-3" />
                <span>Simpan</span>
              </button>
            </div>
          </div>
        </div>

        {/* Compact Footer */}
        <div className="bg-neutral-50 border-t border-neutral-200 px-4 py-2.5 flex items-center justify-between gap-2">
          <button
            onClick={handleSyncNow}
            disabled={isSyncing}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#FFD23F] hover:brightness-95 text-[#0B1E3A] flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Menyinkronkan...' : 'Upload & Sinkron Ulang'}</span>
          </button>

          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-neutral-200 hover:bg-neutral-300 text-neutral-800 cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};

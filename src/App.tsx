import React, { useState, useEffect } from 'react';
import {
  ProductItem,
  CartItem,
  Transaction,
  PrinterConfig,
  ExcelSyncConfig,
} from './types';
import {
  CATALOG_PRODUCTS,
  generateNoNota,
} from './utils/defaultData';
import { printerService } from './utils/printer';
import {
  DEFAULT_EXCEL_SYNC_CONFIG,
  syncTransactionToExcelWebhook,
} from './utils/excel';
import {
  subscribeToTransactions,
  subscribeToProducts,
  saveTransactionToCloud,
  deleteTransactionFromCloud,
  saveProductToCloud,
  deleteProductFromCloud,
  saveAllProductsToCloud,
  testFirestoreConnection,
} from './utils/firebase';
import { Navbar } from './components/Navbar';
import { KasirTab } from './components/KasirTab';
import { RiwayatTab } from './components/RiwayatTab';
import { LaporanTab } from './components/LaporanTab';
import { KatalogTab } from './components/KatalogTab';
import { PrinterModal } from './components/PrinterModal';
import { ExcelSyncModal } from './components/ExcelSyncModal';
import { DeployGuideModal } from './components/DeployGuideModal';
import { CloudSyncModal } from './components/CloudSyncModal';

export default function App() {
  // Navigation State
  const [activeTab, setActiveTab] = useState<'kasir' | 'riwayat' | 'laporan' | 'katalog'>('kasir');

  // Cloud Sync State
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);
  const [userEmail, setUserEmail] = useState<string>(() => {
    return localStorage.getItem('wigata_user_email') || 'wigatadigitalprint@gmail.com';
  });

  // Modals
  const [isPrinterModalOpen, setIsPrinterModalOpen] = useState(false);
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const [isDeployModalOpen, setIsDeployModalOpen] = useState(false);
  const [isCloudModalOpen, setIsCloudModalOpen] = useState(false);

  // Toast Notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // App Data with localStorage persistence as initial fallback
  const [products, setProducts] = useState<ProductItem[]>(() => {
    try {
      const saved = localStorage.getItem('wigata_products');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Error reading products', e);
    }
    return CATALOG_PRODUCTS;
  });

  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('wigata_cart');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return [];
  });

  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    try {
      const saved = localStorage.getItem('wigata_transactions');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Error reading transactions', e);
    }
    return [];
  });

  // Printer & Excel Config
  const [printerConfig, setPrinterConfig] = useState<PrinterConfig>(printerService.config);
  const [syncConfig, setSyncConfig] = useState<ExcelSyncConfig>(() => {
    try {
      const saved = localStorage.getItem('wigata_excel_config');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return DEFAULT_EXCEL_SYNC_CONFIG;
  });

  const [kasirName, setKasirName] = useState<string>(() => {
    return localStorage.getItem('wigata_kasir_name') || 'Admin';
  });

  // Test Firestore Connection on Boot
  useEffect(() => {
    testFirestoreConnection();
  }, []);

  // Real-time Cloud Sync for Transactions & Products (multi-PC & HP)
  useEffect(() => {
    setIsCloudSyncing(true);

    const unsubTrans = subscribeToTransactions((cloudTrans) => {
      setIsCloudSyncing(false);
      setTransactions(cloudTrans || []);
      try {
        localStorage.setItem('wigata_transactions', JSON.stringify(cloudTrans || []));
      } catch {
        // ignore
      }
    });

    const unsubProds = subscribeToProducts((cloudProds, isSnapshotEmpty) => {
      if (isSnapshotEmpty) {
        // Jika koleksi produk di cloud masih kosong, semai katalog default ke Cloud
        console.log('Database produk cloud kosong, mengunggah katalog default ke Cloud...');
        saveAllProductsToCloud(products, userEmail);
      } else if (cloudProds && cloudProds.length > 0) {
        setProducts(cloudProds);
        try {
          localStorage.setItem('wigata_products', JSON.stringify(cloudProds));
        } catch {
          // ignore
        }
      }
    });

    return () => {
      unsubTrans();
      unsubProds();
    };
  }, [userEmail]);

  // Otomatis sinkron ulang saat koneksi internet kembali aktif
  useEffect(() => {
    const handleOnline = () => {
      showToast('Koneksi internet kembali online! Memeriksa sinkronisasi Cloud...');
      handleManualSyncAll();
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [products, transactions, userEmail]);

  // Save changes to localStorage as offline cache
  useEffect(() => {
    localStorage.setItem('wigata_products', JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    localStorage.setItem('wigata_cart', JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    localStorage.setItem('wigata_transactions', JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem('wigata_excel_config', JSON.stringify(syncConfig));
  }, [syncConfig]);

  useEffect(() => {
    localStorage.setItem('wigata_kasir_name', kasirName);
  }, [kasirName]);

  useEffect(() => {
    localStorage.setItem('wigata_user_email', userEmail);
  }, [userEmail]);

  // Subscribe to printer changes
  useEffect(() => {
    return printerService.subscribe((cfg) => {
      setPrinterConfig(cfg);
    });
  }, []);

  // Toast auto-hide
  const showToast = (msg: string) => {
    setToastMessage(msg);
  };

  useEffect(() => {
    if (toastMessage) {
      const t = setTimeout(() => setToastMessage(null), 3500);
      return () => clearTimeout(t);
    }
  }, [toastMessage]);

  // Manual Full Cloud Sync
  const handleManualSyncAll = async () => {
    setIsCloudSyncing(true);
    try {
      await saveAllProductsToCloud(products, userEmail);
      const validToSync = transactions.filter((t) => !t.isDeleted);
      for (const t of validToSync) {
        await saveTransactionToCloud(t, userEmail);
      }
      showToast('Sinkronisasi cloud multi-PC berhasil diperbarui!');
    } catch {
      showToast('Gagal menyinkronkan ke cloud');
    } finally {
      setIsCloudSyncing(false);
    }
  };

  // Save transaction handler with automatic real-time Cloud & Excel sync
  const handleSaveTransaction = async (
    trxData: Omit<Transaction, 'id'>
  ): Promise<Transaction> => {
    const noNota = generateNoNota();
    const newTrx: Transaction = {
      ...trxData,
      id: `trx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      noNota,
      statusSyncExcel: syncConfig.webhookUrl ? 'pending' : 'local_only',
    };

    // 1. Simpan ke Cloud Firestore (agar komputer lain otomatis menerima secara instan)
    saveTransactionToCloud(newTrx, userEmail).then((saved) => {
      if (saved) {
        setIsCloudSyncing(true);
        setTimeout(() => setIsCloudSyncing(false), 800);
      }
    });

    // 2. Jika webhook Excel aktif, kirim juga ke Excel / Google Sheets
    if (syncConfig.webhookUrl && syncConfig.autoSyncOnSave) {
      try {
        const syncRes = await syncTransactionToExcelWebhook(newTrx, syncConfig.webhookUrl);
        if (syncRes.success) {
          newTrx.statusSyncExcel = 'synced';
          showToast(`Nota ${newTrx.noNota} tersimpan & sinkron multi-PC!`);
        } else {
          newTrx.statusSyncExcel = 'failed';
          newTrx.syncError = syncRes.error;
          showToast(`Tersimpan di Cloud. Sync Excel: ${syncRes.error}`);
        }
      } catch (err: unknown) {
        newTrx.statusSyncExcel = 'failed';
        newTrx.syncError = err instanceof Error ? err.message : 'Sync gagal';
      }
    } else {
      showToast(`Nota ${newTrx.noNota} tersimpan & sinkron ke komputer lain!`);
    }

    setTransactions((prev) => [newTrx, ...prev.filter((t) => t.id !== newTrx.id)]);
    return newTrx;
  };

  const handleDeleteTransaction = async (id: string) => {
    // 1. Hapus langsung dari memori state & localStorage
    setTransactions((prev) => {
      const next = prev.filter((t) => t.id !== id);
      try {
        localStorage.setItem('wigata_transactions', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });

    // 2. Hapus dari database Cloud Firestore (ditandai isDeleted: true sehingga semua perangkat seketika menyembunyikannya)
    const ok = await deleteTransactionFromCloud(id);
    if (ok) {
      showToast('Nota transaksi berhasil dihapus dari Cloud & semua perangkat.');
    } else {
      showToast('Nota transaksi dihapus secara lokal.');
    }
  };

  const handlePelunasanTransaction = async (id: string) => {
    const target = transactions.find((t) => t.id === id);
    if (!target) return;

    const updatedTrx: Transaction = {
      ...target,
      isDP: false,
      statusBayar: 'lunas',
      bayar: target.grandTotal,
      kembalian: 0,
      sisaTagihan: 0,
    };

    setTransactions((prev) => prev.map((t) => (t.id === id ? updatedTrx : t)));
    await saveTransactionToCloud(updatedTrx, userEmail);
    showToast(`Nota ${updatedTrx.noNota} berhasil dilunasi!`);
  };

  const handleAddProduct = async (newProd: ProductItem) => {
    setProducts((prev) => {
      const exists = prev.some((p) => p.id === newProd.id);
      return exists ? prev.map((p) => (p.id === newProd.id ? newProd : p)) : [...prev, newProd];
    });
    const ok = await saveProductToCloud(newProd, userEmail);
    if (ok) {
      showToast(`Produk "${newProd.name}" tersimpan di Cloud & semua perangkat!`);
    } else {
      showToast(`Produk "${newProd.name}" tersimpan secara lokal.`);
    }
  };

  const handleEditProduct = async (prod: ProductItem) => {
    setProducts((prev) => prev.map((p) => (p.id === prod.id ? prod : p)));
    const ok = await saveProductToCloud(prod, userEmail);
    if (ok) {
      showToast(`Produk "${prod.name}" diperbarui di Cloud & semua perangkat!`);
    } else {
      showToast(`Produk "${prod.name}" diperbarui secara lokal.`);
    }
  };

  const handleDeleteProduct = async (id: string, prodName: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== id));
    const ok = await deleteProductFromCloud(id);
    if (ok) {
      showToast(`Produk "${prodName}" dihapus dari Cloud & semua perangkat.`);
    }
  };

  const handleImportProducts = async (imported: ProductItem[]) => {
    setProducts(imported);
    await saveAllProductsToCloud(imported, userEmail);
    showToast(`${imported.length} produk diimpor & disinkronkan ke Cloud.`);
  };

  const handleResetCatalog = async () => {
    setProducts(CATALOG_PRODUCTS);
    await saveAllProductsToCloud(CATALOG_PRODUCTS, userEmail);
    showToast('Katalog direset ke default dan disinkronkan.');
  };

  return (
    <div className="min-h-screen bg-[#F4F6F9] text-[#0B1E3A] flex flex-col font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Navigation Header with Cloud Multi-PC Sync */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        syncConfig={syncConfig}
        printerConfig={printerConfig}
        onOpenExcelModal={() => setIsExcelModalOpen(true)}
        onOpenPrinterModal={() => setIsPrinterModalOpen(true)}
        onOpenDeployModal={() => setIsDeployModalOpen(true)}
        onOpenCloudModal={() => setIsCloudModalOpen(true)}
        kasirName={kasirName}
        onChangeKasir={setKasirName}
        trxCount={transactions.length}
        userEmail={userEmail}
        isCloudSyncing={isCloudSyncing}
      />

      {/* Main Tab Views */}
      <main className="flex-1 pb-10">
        {activeTab === 'kasir' && (
          <KasirTab
            products={products}
            cart={cart}
            setCart={setCart}
            onSaveTransaction={handleSaveTransaction}
            printerConfig={printerConfig}
            onOpenPrinterModal={() => setIsPrinterModalOpen(true)}
            onShowToast={showToast}
            kasirName={kasirName}
          />
        )}

        {activeTab === 'riwayat' && (
          <RiwayatTab
            transactions={transactions}
            onDeleteTransaction={handleDeleteTransaction}
            onPelunasanTransaction={handlePelunasanTransaction}
            printerConfig={printerConfig}
            onOpenPrinterModal={() => setIsPrinterModalOpen(true)}
            onShowToast={showToast}
          />
        )}

        {activeTab === 'laporan' && (
          <LaporanTab
            transactions={transactions}
            onShowToast={showToast}
          />
        )}

        {activeTab === 'katalog' && (
          <KatalogTab
            products={products}
            onAddProduct={handleAddProduct}
            onEditProduct={handleEditProduct}
            onDeleteProduct={handleDeleteProduct}
            onResetDefault={handleResetCatalog}
            onShowToast={showToast}
          />
        )}
      </main>

      {/* Modals */}
      <CloudSyncModal
        isOpen={isCloudModalOpen}
        onClose={() => setIsCloudModalOpen(false)}
        transactions={transactions}
        products={products}
        userEmail={userEmail}
        onUpdateUserEmail={setUserEmail}
        onManualSyncAll={handleManualSyncAll}
        onShowToast={showToast}
      />

      <PrinterModal
        isOpen={isPrinterModalOpen}
        onClose={() => setIsPrinterModalOpen(false)}
        onShowToast={showToast}
      />

      <ExcelSyncModal
        isOpen={isExcelModalOpen}
        onClose={() => setIsExcelModalOpen(false)}
        syncConfig={syncConfig}
        onUpdateConfig={(cfg) => setSyncConfig((prev) => ({ ...prev, ...cfg }))}
        transactions={transactions}
        products={products}
        onImportProducts={handleImportProducts}
        onShowToast={showToast}
      />

      <DeployGuideModal
        isOpen={isDeployModalOpen}
        onClose={() => setIsDeployModalOpen(false)}
        onShowToast={showToast}
      />

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 bg-[#0B1E3A] text-white px-5 py-3 rounded-2xl text-xs sm:text-sm font-black shadow-2xl border border-white/10 flex items-center gap-2 animate-bounce-in">
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}

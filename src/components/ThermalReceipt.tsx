import React, { useRef, useState } from 'react';
import { Transaction, PrinterConfig } from '../types';
import { STORE_INFO, formatRupiah, formatNumber } from '../utils/defaultData';
import { generateReceiptCanvas, getFinishingLabels } from '../utils/receiptCanvas';
import { printerService } from '../utils/printer';
import {
  FileText,
  Settings,
  Download,
  Share2,
  Copy,
  Check,
  AlertCircle,
  HelpCircle,
  X,
} from 'lucide-react';

interface ThermalReceiptProps {
  transaction: Transaction;
  printerConfig: PrinterConfig;
  onOpenPrinterModal: () => void;
  onShowToast: (msg: string) => void;
}

export const ThermalReceipt: React.FC<ThermalReceiptProps> = ({
  transaction,
  printerConfig,
  onOpenPrinterModal,
  onShowToast,
}) => {
  const [paperWidth, setPaperWidth] = useState<58 | 80>(printerConfig.paperWidth || 58);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [hasCopiedImage, setHasCopiedImage] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);

  // Cetak Struk: Rata Tengah, Panjang Pas Menyesuaikan Isi Nota, dan Format Tabel Spasi Rapi
  const handlePrintStruk = async () => {
    // 1. Jika terhubung via Direct WebUSB, Bluetooth, atau Serial Kabel
    if (printerConfig.type === 'bluetooth' || printerConfig.type === 'webusb' || printerConfig.type === 'serial') {
      onShowToast('Mengirim perintah cetak langsung ke printer thermal...');
      try {
        const res = await printerService.printTransaction(transaction);
        if (res.success) {
          onShowToast('Struk berhasil dicetak ke printer thermal!');
          return;
        } else {
          onShowToast(`Direct print: ${res.error}. Membuka dialog cetak sistem...`);
        }
      } catch (err) {
        console.warn('Direct print error:', err);
      }
    }

    // 2. Windows Spooler / System Print Mode (Dialog Browser ke Driver EPPOS 58)
    const receiptEl = receiptRef.current;
    if (!receiptEl) {
      window.print();
      return;
    }

    try {
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow?.document;
      if (!doc) {
        window.print();
        return;
      }

      const receiptHtml = receiptEl.innerHTML;
      const innerContentWidthMm = paperWidth === 80 ? '70mm' : '46mm';

      doc.open();
      doc.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Struk_${transaction.noNota}</title>
  <style>
    @page {
      size: auto;
      margin: 0mm !important;
    }
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      color: #000000 !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      width: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
      background: #ffffff !important;
      color: #000000 !important;
      font-family: 'Courier New', Courier, monospace !important;
      font-size: 10px !important;
      font-weight: 700 !important;
      line-height: 1.35 !important;
      height: auto !important;
      min-height: 0 !important;
      display: block !important;
      text-align: center !important;
    }
    .print-wrapper {
      display: block !important;
      width: ${innerContentWidthMm} !important;
      max-width: ${innerContentWidthMm} !important;
      margin: 0 auto !important;
      padding: 0mm 0.5mm 3mm 0.5mm !important;
      height: auto !important;
      background: #ffffff !important;
      color: #000000 !important;
      text-align: left !important;
      overflow: hidden !important;
      word-break: break-word !important;
    }
    .print-wrapper * {
      color: #000000 !important;
    }
    .text-center {
      text-align: center !important;
    }
    .text-right {
      text-align: right !important;
    }
    .font-bold {
      font-weight: bold !important;
    }
    .font-black {
      font-weight: 900 !important;
    }
    .row {
      display: flex !important;
      justify-content: space-between !important;
      align-items: flex-start !important;
      width: 100% !important;
      margin: 1.5px 0 !important;
      font-weight: 700 !important;
      color: #000000 !important;
    }
    .dashed-divider {
      border-top: 1.5px dashed #000000 !important;
      margin: 4px 0 !important;
      width: 100% !important;
      height: 0 !important;
    }
    .double-dashed-divider {
      border-top: 2px dashed #000000 !important;
      margin: 5px 0 !important;
      width: 100% !important;
      height: 0 !important;
    }
    .sub-item {
      font-size: 9px !important;
      color: #000000 !important;
      font-weight: 600 !important;
      margin: 1px 0 !important;
    }
    .finishing-item {
      font-size: 9px !important;
      padding-left: 6px !important;
      color: #000000 !important;
      font-weight: 600 !important;
      font-style: normal !important;
    }
  </style>
</head>
<body>
  <div class="print-wrapper">
    ${receiptHtml}
  </div>
</body>
</html>`);
      doc.close();

      // Membersihkan iframe hanya SETELAH proses cetak selesai (afterprint)
      // Jangan pernah menghapus iframe di tengah dialog preview aktif (penyebab utama error print)
      const cleanupIframe = () => {
        try {
          if (iframe.parentNode) {
            document.body.removeChild(iframe);
          }
        } catch {
          // ignore
        }
      };

      iframe.contentWindow?.addEventListener('afterprint', cleanupIframe);
      // Fallback timer panjang (2 menit) jika browser tidak memicu afterprint
      setTimeout(cleanupIframe, 120000);

      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (printErr) {
          console.warn('Iframe print blocked/failed, falling back to window.print():', printErr);
          cleanupIframe();
          window.print();
        }
      }, 250);

      onShowToast('Membuka dialog cetak struk...');
    } catch (e) {
      console.error('Print initialization error:', e);
      // Fallback langsung ke window.print() yang aman
      window.print();
      onShowToast('Membuka dialog cetak struk...');
    }
  };

  // Helper render struk menjadi HTML Canvas yang ultra-kompatibel di semua browser dan platform
  // Menggunakan pure Canvas 2D engine sehingga 100% bebas dari error oklch dan TIDAK AKAN PERNAH KOSONG.
  const captureReceiptCanvas = async (): Promise<HTMLCanvasElement | null> => {
    try {
      return generateReceiptCanvas(transaction, paperWidth);
    } catch (e) {
      console.error('generateReceiptCanvas error:', e);
      return null;
    }
  };

  // Download Gambar Struk PNG yang handal (Pure Canvas 2D: Pasti Berisi Teks & Tajam)
  const handleDownloadPNG = async () => {
    setIsGeneratingImage(true);
    onShowToast('Memproses gambar struk PNG...');

    try {
      const fileName = `Struk-${transaction.noNota}.png`;
      const canvas = generateReceiptCanvas(transaction, paperWidth);
      let downloaded = false;

      // Cara 1: Menggunakan toBlob (Standar W3C modern)
      await new Promise<void>((resolve) => {
        canvas.toBlob((blob) => {
          if (blob) {
            try {
              const blobUrl = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.style.display = 'none';
              link.href = blobUrl;
              link.download = fileName;
              document.body.appendChild(link);
              link.click();
              setTimeout(() => {
                try {
                  document.body.removeChild(link);
                  URL.revokeObjectURL(blobUrl);
                } catch {
                  // ignore
                }
              }, 1500);
              downloaded = true;
              onShowToast('Gambar struk PNG berhasil didownload!');
            } catch (err) {
              console.warn('Blob download error:', err);
            }
          }
          resolve();
        }, 'image/png');
      });

      // Cara 2: Jika toBlob belum terdownload, gunakan toDataURL
      if (!downloaded) {
        try {
          const dataUrl = canvas.toDataURL('image/png');
          const link = document.createElement('a');
          link.style.display = 'none';
          link.href = dataUrl;
          link.download = fileName;
          document.body.appendChild(link);
          link.click();
          setTimeout(() => {
            try {
              document.body.removeChild(link);
            } catch {
              // ignore
            }
          }, 1500);
          downloaded = true;
          onShowToast('Gambar struk PNG berhasil didownload!');
        } catch (err) {
          console.warn('DataURL download error:', err);
        }
      }
    } catch (err: unknown) {
      console.error('Download PNG Error:', err);
      const msg = err instanceof Error ? err.message : 'Gagal';
      onShowToast(`Gagal download gambar: ${msg}`);
    } finally {
      setIsGeneratingImage(false);
    }
  };

  // Salin Gambar ke Clipboard (Tinggal Ctrl+V di WhatsApp Web atau aplikasi lain)
  const handleCopyImage = async () => {
    setIsGeneratingImage(true);
    onShowToast('Menyalin gambar struk ke clipboard...');

    try {
      const canvas = generateReceiptCanvas(transaction, paperWidth);

      canvas.toBlob(async (blob) => {
        if (!blob) {
          onShowToast('Gagal memproses gambar');
          setIsGeneratingImage(false);
          return;
        }

        try {
          if (navigator.clipboard && window.ClipboardItem) {
            await navigator.clipboard.write([
              new ClipboardItem({ 'image/png': blob })
            ]);
            setHasCopiedImage(true);
            setTimeout(() => setHasCopiedImage(false), 3000);
            onShowToast('Gambar struk berhasil disalin! Tinggal tekan Ctrl + V di WhatsApp.');
          } else {
            onShowToast('Browser tidak mendukung salin gambar langsung (gunakan tombol Download PNG).');
          }
        } catch (clipErr) {
          console.error('Clipboard write error:', clipErr);
          onShowToast('Gagal menyalin ke clipboard (coba gunakan tombol Download PNG).');
        } finally {
          setIsGeneratingImage(false);
        }
      }, 'image/png');
    } catch (err) {
      console.error('Copy image error:', err);
      setIsGeneratingImage(false);
      onShowToast('Gagal menyalin gambar struk');
    }
  };

  // Generate Text Version for WhatsApp or TXT
  const generatePlainText = (): string => {
    const maxChars = paperWidth === 80 ? 42 : 32;
    const lineSep = '-'.repeat(maxChars);
    const doubleSep = '='.repeat(maxChars);

    let text = `*${STORE_INFO.name}*\n`;
    text += `${STORE_INFO.address}\n`;
    text += `${STORE_INFO.locationDetail}\n`;
    text += `WA: ${STORE_INFO.phone}\n`;
    text += `${lineSep}\n`;
    text += `No Nota : ${transaction.noNota}\n`;
    text += `Tanggal : ${transaction.dateStr} ${transaction.jam}\n`;
    text += `Pelanggan: ${transaction.pelanggan || 'Umum'}\n`;
    if (transaction.hp) text += `No HP   : ${transaction.hp}\n`;
    text += `Kasir   : ${transaction.kasir || 'Admin'}\n`;
    text += `${lineSep}\n`;

    transaction.items.forEach((item, idx) => {
      text += `${idx + 1}. *${item.product.name.toUpperCase()}* (${item.product.category})\n`;
      if (item.product.category === 'Meteran') {
        text += `   ${item.panjang}x${item.lebar}m x ${item.qty} = ${formatNumber(item.totalLuas, 2)}m2 @${formatNumber(item.product.price)}\n`;
      } else if (item.product.category === 'Cutting') {
        text += `   ${Math.round(item.panjang)}x${Math.round(item.lebar)}cm = ${Math.round(item.totalLuas)}cm @${formatNumber(item.product.price)}\n`;
      } else {
        text += `   ${item.qty} ${item.product.unit} @${formatNumber(item.product.price)}\n`;
      }

      const fins = getFinishingLabels(item.finishing, item.product.category);
      if (fins.length > 0) {
        text += `   - Fin: ${fins.join(', ')}\n`;
      }
      if (item.desainFee > 0) {
        text += `   - Desain: ${formatRupiah(item.desainFee)}\n`;
      }
      text += `   => *${formatRupiah(item.total)}*\n`;
    });

    text += `${lineSep}\n`;
    text += `Subtotal    : ${formatRupiah(transaction.subtotal)}\n`;
    if (transaction.diskonRp > 0) {
      const diskLabel = transaction.diskonPercent > 0 ? `Diskon (${transaction.diskonPercent}%)` : 'Diskon Tunai';
      text += `${diskLabel} : -${formatRupiah(transaction.diskonRp)}\n`;
    }
    text += `*GRAND TOTAL : ${formatRupiah(transaction.grandTotal)}*\n`;
    const isDpTrx = Boolean(transaction.isDP || (transaction.sisaTagihan && transaction.sisaTagihan > 0));
    if (isDpTrx) {
      const sisa = transaction.sisaTagihan ?? Math.max(0, transaction.grandTotal - transaction.bayar);
      text += `DP (${transaction.paymentMethod.toUpperCase()}) : ${formatRupiah(transaction.bayar)}\n`;
      text += `*SISA TAGIHAN : ${formatRupiah(sisa)}*\n`;
      text += `Status      : *BELUM LUNAS (DP)*\n`;
    } else {
      text += `Bayar (${transaction.paymentMethod.toUpperCase()}) : ${formatRupiah(transaction.bayar)}\n`;
      if (transaction.paymentMethod === 'tunai') {
        text += `Kembalian   : ${formatRupiah(transaction.kembalian)}\n`;
      }
      text += `Status      : *LUNAS*\n`;
    }
    text += `${doubleSep}\n`;
    text += `Terima Kasih Atas Kunjungan Anda!\n`;
    text += `${STORE_INFO.note1}\n`;
    text += `${STORE_INFO.note2}\n`;
    text += `WA: ${STORE_INFO.phone}\n`;
    text += `Wigata POS Digital Print\n`;

    return text;
  };

  // Kirim / Share ke WhatsApp (Format teks rapi + Otomatis download file gambar PNG + Salin ke Clipboard)
  const handleShareWA = async () => {
    setIsGeneratingImage(true);
    onShowToast('Menyiapkan gambar PNG & membuka WhatsApp...');

    const waText = generatePlainText();

    let cleanPhone = transaction.hp ? transaction.hp.replace(/\D/g, '') : '';
    if (cleanPhone.startsWith('0')) {
      cleanPhone = '62' + cleanPhone.slice(1);
    }

    const waUrl = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(waText)}`
      : `https://wa.me/?text=${encodeURIComponent(waText)}`;

    try {
      const canvas = await captureReceiptCanvas();
      if (canvas) {
        // 1. Download file PNG secara instan agar user punya file gambarnya langsung di komputer
        try {
          const dataUrl = canvas.toDataURL('image/png');
          const link = document.createElement('a');
          link.style.display = 'none';
          link.download = `Struk-${transaction.noNota}.png`;
          link.href = dataUrl;
          document.body.appendChild(link);
          link.click();
          setTimeout(() => {
            try {
              document.body.removeChild(link);
            } catch {
              // ignore
            }
          }, 1500);
        } catch {
          // fallback
        }

        // 2. Salin gambar ke clipboard jika didukung (sehingga di WhatsApp Web tinggal tekan Ctrl+V)
        try {
          canvas.toBlob(async (blob) => {
            if (blob && navigator.clipboard && window.ClipboardItem) {
              try {
                await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
              } catch {
                // abaikan jika browser blokir clipboard
              }
            }
          }, 'image/png');
        } catch {
          // ignore
        }
      }
    } catch (e) {
      console.warn('Canvas render error in shareWA:', e);
    } finally {
      setIsGeneratingImage(false);
      // 3. Buka WhatsApp
      window.open(waUrl, '_blank');
      onShowToast('WhatsApp dibuka! File PNG didownload & disalin (tinggal Ctrl+V).');
    }
  };

  // Download TXT
  const handleDownloadTxt = () => {
    const text = generatePlainText();
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Nota-${transaction.noNota}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    onShowToast('File TXT berhasil didownload');
  };

  return (
    <div className="bg-white rounded-3xl p-5 shadow-sm border border-neutral-200/80 space-y-4">
      {/* Top Header Selector & Paper Settings */}
      <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-[#0B1E3A] text-white flex items-center justify-center font-black text-sm">
            🖨️
          </div>
          <div>
            <div className="font-extrabold text-sm text-[#0B1E3A]">STRUK PEMBELIAN</div>
            <div className="text-[11px] text-black/50">Preview Struk Thermal Kasir</div>
          </div>
        </div>

        {/* Paper width toggle */}
        <div className="flex bg-neutral-100 p-1 rounded-xl text-xs font-bold">
          <button
            onClick={() => setPaperWidth(58)}
            className={`px-3 py-1 rounded-lg transition cursor-pointer ${
              paperWidth === 58
                ? 'bg-white text-[#0B1E3A] shadow-sm font-black'
                : 'text-black/60 hover:text-black'
            }`}
          >
            58mm
          </button>
          <button
            onClick={() => setPaperWidth(80)}
            className={`px-3 py-1 rounded-lg transition cursor-pointer ${
              paperWidth === 80
                ? 'bg-white text-[#0B1E3A] shadow-sm font-black'
                : 'text-black/60 hover:text-black'
            }`}
          >
            80mm
          </button>
        </div>
      </div>

      {/* Visual Paper Preview Container - Centered */}
      <div className="bg-[#EBEFF5] p-4 rounded-2xl flex justify-center overflow-x-auto shadow-inner">
        <div
          id="thermal-printable-receipt"
          ref={receiptRef}
          data-paper={paperWidth}
          style={{
            width: paperWidth === 80 ? '340px' : '250px',
            fontFamily: "'Courier New', Courier, monospace",
          }}
          className="bg-white text-black p-3.5 rounded-xl shadow-md border border-neutral-300 text-[10px] leading-snug space-y-1 select-text mx-auto"
        >
          {/* Header - Centered */}
          <div className="text-center pb-1">
            <div className="font-black text-[13px] tracking-tight text-black uppercase">
              {STORE_INFO.name}
            </div>
            <div className="text-[10px] text-black font-semibold leading-tight mt-0.5">
              {STORE_INFO.address}
              <br />
              {STORE_INFO.locationDetail}
              <br />
              WA: {STORE_INFO.phone}
            </div>
          </div>

          {/* Dashed Separator */}
          <div className="dashed-divider" style={{ borderTop: '1.5px dashed #000000', margin: '5px 0' }}></div>

          {/* Meta Info - Spasi Kiri & Kanan Terpisah Rapi */}
          <div className="text-[10.5px] space-y-0.5">
            <div className="row" style={{ display: 'flex', justifyContent: 'space-between', width: '100%', color: '#000000' }}>
              <span className="font-semibold text-black">No Nota :</span>
              <span className="font-bold text-black">{transaction.noNota}</span>
            </div>
            <div className="row" style={{ display: 'flex', justifyContent: 'space-between', width: '100%', color: '#000000' }}>
              <span className="font-semibold text-black">Tanggal :</span>
              <span className="text-black font-semibold">{transaction.dateStr}</span>
            </div>
            <div className="row" style={{ display: 'flex', justifyContent: 'space-between', width: '100%', color: '#000000' }}>
              <span className="font-semibold text-black">Jam :</span>
              <span className="text-black font-semibold">{transaction.jam}</span>
            </div>
            <div className="row" style={{ display: 'flex', justifyContent: 'space-between', width: '100%', color: '#000000' }}>
              <span className="font-semibold text-black">Pelanggan:</span>
              <span className="font-bold text-black">{transaction.pelanggan || 'Umum'}</span>
            </div>
            {transaction.hp && (
              <div className="row" style={{ display: 'flex', justifyContent: 'space-between', width: '100%', color: '#000000' }}>
                <span className="font-semibold text-black">No HP :</span>
                <span className="text-black font-semibold">{transaction.hp}</span>
              </div>
            )}
            <div className="row" style={{ display: 'flex', justifyContent: 'space-between', width: '100%', color: '#000000' }}>
              <span className="font-semibold text-black">Kasir :</span>
              <span className="text-black font-semibold">{transaction.kasir || 'Admin'}</span>
            </div>
          </div>

          {/* Dashed Separator */}
          <div className="dashed-divider" style={{ borderTop: '1.5px dashed #000000', margin: '5px 0' }}></div>

          {/* Items Header */}
          <div className="row font-black text-[10px] text-black pb-0.5" style={{ display: 'flex', justifyContent: 'space-between', width: '100%', color: '#000000' }}>
            <span>ITEM PESANAN</span>
            <span>TOTAL</span>
          </div>

          {/* Items List */}
          <div className="space-y-1.5 pt-0.5">
            {transaction.items.length === 0 ? (
              <div className="text-center py-2 text-black font-semibold italic">Tidak ada item</div>
            ) : (
              transaction.items.map((item, idx) => {
                const fins = getFinishingLabels(item.finishing, item.product.category);
                return (
                  <div key={idx} className="space-y-0.5">
                    {/* Item Name & Total */}
                    <div className="row font-bold text-[10.5px] text-black" style={{ display: 'flex', justifyContent: 'space-between', width: '100%', color: '#000000' }}>
                      <span className="pr-1">
                        {idx + 1}. {item.product.name}
                      </span>
                      <span className="shrink-0">{formatRupiah(item.total)}</span>
                    </div>

                    {/* Item Details: Ukuran / Qty & Subtotal */}
                    <div className="sub-item" style={{ fontSize: '9.5px', color: '#000000', fontWeight: 600 }}>
                      {item.product.category === 'Meteran' && (
                        <span>
                          {item.panjang}x{item.lebar}m ({item.qty} pcs) = {formatNumber(item.totalLuas, 2)}m² @{formatNumber(item.product.price)}
                        </span>
                      )}
                      {item.product.category === 'Cutting' && (
                        <span>
                          {Math.round(item.panjang)}x{Math.round(item.lebar)}cm = {Math.round(item.totalLuas)}cm @{formatNumber(item.product.price)}
                        </span>
                      )}
                      {item.product.category !== 'Meteran' && item.product.category !== 'Cutting' && (
                        <span>
                          {item.qty} {item.product.unit} @{formatNumber(item.product.price)}
                        </span>
                      )}
                    </div>

                    {/* Finishing details */}
                    {fins.length > 0 && (
                      <div className="finishing-item" style={{ fontSize: '9px', fontStyle: 'normal', paddingLeft: '8px', color: '#000000', fontWeight: 600 }}>
                        {fins.map((f, i) => (
                          <div key={i}>- {f}</div>
                        ))}
                      </div>
                    )}

                    {/* Design fee */}
                    {item.desainFee > 0 && (
                      <div className="sub-item" style={{ fontSize: '9.5px', paddingLeft: '8px', color: '#000000', fontWeight: 600 }}>
                        Desain: {formatRupiah(item.desainFee)}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Dashed Separator */}
          <div className="dashed-divider" style={{ borderTop: '1.5px dashed #000000', margin: '5px 0' }}></div>

          {/* Summary / Totals */}
          <div className="space-y-1 text-[11px] text-black">
            {/* Subtotal */}
            <div className="row font-bold" style={{ display: 'flex', justifyContent: 'space-between', width: '100%', color: '#000000' }}>
              <span>Subtotal</span>
              <span className="font-bold">{formatRupiah(transaction.subtotal)}</span>
            </div>

            {/* Diskon Tunai */}
            {transaction.diskonRp > 0 && (
              <div className="row font-bold" style={{ display: 'flex', justifyContent: 'space-between', width: '100%', color: '#000000' }}>
                <span>{transaction.diskonPercent > 0 ? `Diskon (${transaction.diskonPercent}%)` : 'Diskon Tunai'}</span>
                <span>-{formatRupiah(transaction.diskonRp)}</span>
              </div>
            )}

            {/* Grand Total */}
            <div className="row font-black text-xs pt-1" style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontWeight: 900, fontSize: '12.5px', color: '#000000' }}>
              <span>GRAND TOTAL</span>
              <span>{formatRupiah(transaction.grandTotal)}</span>
            </div>

            {/* DP vs Lunas */}
            {transaction.isDP || (transaction.sisaTagihan && transaction.sisaTagihan > 0) ? (
              <>
                <div className="row font-bold" style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: '10.5px', color: '#000000' }}>
                  <span>DP / Uang Muka ({transaction.paymentMethod.toUpperCase()})</span>
                  <span>{formatRupiah(transaction.bayar)}</span>
                </div>
                <div className="row font-black" style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: '11.5px', fontWeight: 900, color: '#000000' }}>
                  <span>SISA TAGIHAN</span>
                  <span>{formatRupiah(transaction.sisaTagihan ?? Math.max(0, transaction.grandTotal - transaction.bayar))}</span>
                </div>
                <div className="row font-black pt-0.5" style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: '10.5px', fontWeight: 900, color: '#000000' }}>
                  <span>STATUS</span>
                  <span>BELUM LUNAS (DP)</span>
                </div>
              </>
            ) : (
              <>
                {/* Bayar */}
                <div className="row font-semibold" style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: '10px', color: '#000000' }}>
                  <span>Bayar ({transaction.paymentMethod.toUpperCase()})</span>
                  <span>{formatRupiah(transaction.bayar)}</span>
                </div>

                {/* Kembalian */}
                {transaction.paymentMethod === 'tunai' && (
                  <div className="row font-bold" style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: '10.5px', fontWeight: 'bold', color: '#000000' }}>
                    <span>Kembalian</span>
                    <span>{formatRupiah(transaction.kembalian > 0 ? transaction.kembalian : 0)}</span>
                  </div>
                )}

                <div className="row font-black pt-0.5" style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: '10.5px', fontWeight: 900, color: '#000000' }}>
                  <span>STATUS</span>
                  <span>LUNAS</span>
                </div>
              </>
            )}
          </div>

          {/* Dashed Separator */}
          <div className="dashed-divider" style={{ borderTop: '1.5px dashed #000000', margin: '5px 0' }}></div>

          {/* Footer note - Centered */}
          <div className="text-center text-[9.5px] text-black font-semibold space-y-0.5 pt-1">
            <div className="font-black text-black">Terima kasih Sudah Order</div>
            <div>{STORE_INFO.note1}</div>
            <div>{STORE_INFO.note2}</div>
            <div className="pt-1 text-[9px] text-black font-semibold">
              Hubungi WA: {STORE_INFO.phone}
              <br />
              Dicetak: {new Date().toLocaleString('id-ID')}
              <br />
              <span className="font-black text-black">KASIR WIGATA DIGITAL PRINT</span>
              <br />
              <span className="text-[8.5px] font-medium">Powered by Wigata POS v2.0</span>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons - Tombol Cetak, Download PNG, Salin Gambar & Share WA */}
      <div id="struk-preview" className="space-y-2.5 pt-1">
        {/* Tombol Utama: Cetak Struk */}
        <button
          onClick={handlePrintStruk}
          className="w-full bg-[#0B1E3A] hover:bg-black text-white font-black py-3 rounded-xl h-[46px] flex items-center justify-center gap-2 shadow-sm transition cursor-pointer"
        >
          <span className="text-[16px]">🖨️</span>
          <span>Cetak Struk Thermal</span>
        </button>

        {/* Baris Tombol Aksi Gambar Struk */}
        <div className="grid grid-cols-3 gap-2">
          {/* Download PNG */}
          <button
            onClick={handleDownloadPNG}
            disabled={isGeneratingImage}
            className="bg-[#FFD23F] hover:brightness-95 text-[#0B1E3A] font-black py-2.5 px-2 rounded-xl h-[44px] text-xs flex items-center justify-center gap-1.5 shadow-sm transition cursor-pointer disabled:opacity-50"
            title="Download file gambar PNG struk ke komputer"
          >
            <Download className="w-4 h-4 text-[#0B1E3A] shrink-0" />
            <span className="truncate">{isGeneratingImage ? 'Memproses...' : 'Download PNG'}</span>
          </button>

          {/* Salin Gambar ke Clipboard */}
          <button
            onClick={handleCopyImage}
            disabled={isGeneratingImage}
            className="bg-neutral-800 hover:bg-neutral-900 text-white font-black py-2.5 px-2 rounded-xl h-[44px] text-xs flex items-center justify-center gap-1.5 shadow-sm transition cursor-pointer disabled:opacity-50"
            title="Salin gambar struk ke Clipboard, lalu tekan Ctrl+V di WhatsApp"
          >
            {hasCopiedImage ? (
              <>
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-emerald-400 truncate">Tersalin!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-white shrink-0" />
                <span className="truncate">Salin Gambar</span>
              </>
            )}
          </button>

          {/* Share ke WhatsApp */}
          <button
            onClick={handleShareWA}
            disabled={isGeneratingImage}
            className="bg-[#25D366] hover:bg-[#1ebe5a] text-white font-black py-2.5 px-2 rounded-xl h-[44px] text-xs flex items-center justify-center gap-1.5 shadow-sm transition disabled:opacity-50 cursor-pointer"
            title="Download PNG dan buka WhatsApp secara langsung"
          >
            <Share2 className="w-4 h-4 text-white shrink-0" />
            <span className="truncate">Share WA</span>
          </button>
        </div>

        {/* Tombol Cadangan: File TXT, Pengaturan Printer & Panduan Eror */}
        <div className="flex items-center justify-between gap-2 pt-1 text-[11px] flex-wrap">
          <button
            onClick={handleDownloadTxt}
            className="text-black/60 hover:text-black font-semibold flex items-center gap-1 py-1 cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Download TXT</span>
          </button>

          <button
            onClick={() => setShowGuideModal(true)}
            className="text-amber-700 hover:text-amber-900 font-bold flex items-center gap-1 py-1 cursor-pointer bg-amber-50 px-2 rounded-lg border border-amber-200"
            title="Panduan jika hasil print struk bermasalah / eror"
          >
            <HelpCircle className="w-3.5 h-3.5 text-amber-600" />
            <span>Solusi Cetak Eror?</span>
          </button>

          <button
            onClick={onOpenPrinterModal}
            className="text-blue-700 hover:text-blue-900 font-semibold flex items-center gap-1 py-1 cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Printer ({printerConfig.paperWidth}mm)</span>
          </button>
        </div>
      </div>

      {/* Modal Panduan Mengatasi Print Struk Eror */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-[500px] w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-neutral-200">
            <div className="bg-[#0B1E3A] text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-400 text-[#0B1E3A] flex items-center justify-center font-black">
                  <AlertCircle className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <h4 className="font-black text-sm">Panduan Solusi Cetak Struk Eror</h4>
                  <p className="text-[11px] text-white/70">Untuk Printer Thermal EPPOS 58 / POS-58 / VSC</p>
                </div>
              </div>
              <button
                onClick={() => setShowGuideModal(false)}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-3.5 text-xs text-[#0B1E3A]">
              {/* Point 1: Destination Printer */}
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3 space-y-1">
                <div className="font-black text-blue-950 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">1</span>
                  <span>Pilih Printer Tujuan (Destination) yang Tepat</span>
                </div>
                <p className="text-[11px] text-blue-900 leading-relaxed">
                  Saat jendela print muncul di Google Chrome / Edge, pastikan <strong>Destination / Tujuan</strong> diganti ke nama printer thermal Anda (contoh: <strong>POS-58</strong>, <strong>EPPOS 58</strong>, atau <strong>Generic / Text Only</strong>). Jangan pilih &quot;Save as PDF&quot; atau printer kantor A4 biasa.
                </p>
              </div>

              {/* Point 2: Margins & Paper Size */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 space-y-1">
                <div className="font-black text-emerald-950 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">2</span>
                  <span>Atur Margin ke &quot;None&quot; &amp; Paper Size 58mm</span>
                </div>
                <ul className="text-[11px] text-emerald-900 list-disc list-inside space-y-1 leading-relaxed pl-1">
                  <li><strong>Paper size:</strong> Pilih <strong>58mm</strong> / <strong>48mm</strong> / <strong>Roll Paper</strong>.</li>
                  <li><strong>Margins:</strong> Ubah dari Default menjadi <strong>None (Tanpa Margin)</strong> agar teks tidak terpotong.</li>
                  <li><strong>Headers and footers:</strong> Hilangkan centang agar tidak muncul link web / tanggal browser di atas dan bawah struk.</li>
                </ul>
              </div>

              {/* Point 3: Mode Direct WebUSB / Bluetooth vs Driver Windows */}
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 space-y-1">
                <div className="font-black text-amber-950 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-amber-600 text-white flex items-center justify-center text-[10px]">3</span>
                  <span>Jika Menggunakan Kabel USB di Windows</span>
                </div>
                <p className="text-[11px] text-amber-900 leading-relaxed">
                  Jika driver EPPOS 58 sudah diinstal di Windows, port USB dikunci oleh Windows. Pastikan mode printer diatur ke <strong>&quot;Windows Printer (Driver EPPOS 58)&quot;</strong> (bukan Direct WebUSB), lalu cetak melalui jendela browser.
                </p>
              </div>

              {/* Point 4: Opsi Alternatif Cepat */}
              <div className="bg-neutral-100 rounded-2xl p-3 space-y-1.5">
                <div className="font-black text-neutral-800 text-[11px]">Alternatif Jika Printer Sedang Offline:</div>
                <div className="grid grid-cols-2 gap-2 text-[10.5px]">
                  <button
                    onClick={() => {
                      setShowGuideModal(false);
                      handleDownloadPNG();
                    }}
                    className="p-2 rounded-xl bg-white border border-neutral-300 font-bold hover:bg-neutral-50 text-center cursor-pointer"
                  >
                    📸 Download PNG
                  </button>
                  <button
                    onClick={() => {
                      setShowGuideModal(false);
                      handleShareWA();
                    }}
                    className="p-2 rounded-xl bg-[#25D366] text-white font-bold hover:bg-[#1ebe5a] text-center cursor-pointer"
                  >
                    💬 Kirim ke WhatsApp
                  </button>
                </div>
              </div>
            </div>

            <div className="p-3 bg-neutral-50 border-t border-neutral-200 flex justify-end">
              <button
                onClick={() => setShowGuideModal(false)}
                className="px-4 py-2 bg-[#0B1E3A] hover:bg-black text-white text-xs font-bold rounded-xl cursor-pointer"
              >
                Saya Mengerti
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

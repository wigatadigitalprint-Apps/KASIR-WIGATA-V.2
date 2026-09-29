import { Transaction, FinishingOptions } from '../types';
import { STORE_INFO, formatRupiah, formatNumber } from './defaultData';

export const getFinishingLabels = (fin: FinishingOptions | Transaction['items'][0]['finishing'], cat: string): string[] => {
  const list: string[] = [];
  if (!fin) return list;
  if (cat === 'Meteran') {
    if (fin.mataAyam) list.push(`Ring/Mata Ayam (${fin.mataAyamCount || 4} ttk)`);
    if (fin.kelim) list.push('Lem Pas / Kelim');
    if (fin.laminasiDoffM) list.push('Lam. Doff Mtr');
    if (fin.laminasiGlossyM) list.push('Lam. Glossy Mtr');
  } else if (cat === 'A3+') {
    if (fin.ciscut) list.push('Ciscut (Kiss Cut)');
    if (fin.potong) list.push('Potong Jadi');
    if (fin.bolakBalik) list.push('Bolak Balik (2x)');
    if (fin.laminasiDingin) list.push('Lam. Dingin A3');
    if (fin.laminasiPanas) list.push('Lam. Panas A3');
    if (fin.laminatingF4) list.push('Laminating F4');
    if (fin.laminasiDoffA3) list.push('Lam. Doff A3');
    if (fin.laminasiGlossyA3) list.push('Lam. Glossy A3');
  } else if (cat === 'Nota Rim') {
    if (fin.warna2x) list.push('Cetak 2 Warna');
    if (fin.tambahanNomor) list.push('Numerator / Porporasi');
  }
  return list;
};

/**
 * Merender struk termal secara langsung ke HTML5 Canvas dengan teks solid hitam pekat (#000000)
 * Tanpa ketergantungan CSS eksternal sehingga 100% bebas dari error oklch dan TIDAK AKAN PERNAH KOSONG.
 */
export const generateReceiptCanvas = (
  transaction: Transaction,
  paperWidth: 58 | 80 = 58
): HTMLCanvasElement => {
  const scale = 2; // Skala Retina 2x untuk teks super tajam dan jelas
  const baseWidth = paperWidth === 80 ? 500 : 380;
  const canvasWidth = baseWidth * scale;
  const margin = 16 * scale;
  const printableWidth = canvasWidth - margin * 2;

  // Canvas sementara untuk mengukur layout
  const measureCanvas = document.createElement('canvas');
  const measureCtx = measureCanvas.getContext('2d');
  if (!measureCtx) {
    throw new Error('Canvas 2D context not supported');
  }

  const fontFamily = "'Courier New', Courier, monospace";

  // Helper pembungkus teks panjang
  const wrapText = (
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number,
    fontSize: number,
    isBold: boolean
  ): string[] => {
    ctx.font = `${isBold ? 'bold' : 'normal'} ${fontSize * scale}px ${fontFamily}`;
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      if (ctx.measureText(testLine).width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);
    return lines.length > 0 ? lines : [text];
  };

  // Fungsi komputasi posisi Y (Dipakai untuk ukur tinggi lalu gambar sebenarnya)
  const runLayout = (ctx: CanvasRenderingContext2D, isDrawing: boolean): number => {
    let y = 18 * scale;

    const drawCenterText = (text: string, fontSize: number, isBold: boolean, gapAfter: number = 3) => {
      ctx.font = `${isBold ? 'bold' : '600'} ${fontSize * scale}px ${fontFamily}`;
      if (isDrawing) {
        ctx.fillStyle = '#000000';
        ctx.textAlign = 'center';
        ctx.fillText(text, canvasWidth / 2, y + fontSize * scale);
      }
      y += (fontSize + gapAfter) * scale;
    };

    const drawDashedLine = (gapBefore: number = 4, gapAfter: number = 6) => {
      y += gapBefore * scale;
      if (isDrawing) {
        ctx.beginPath();
        ctx.setLineDash([5 * scale, 3 * scale]);
        ctx.lineWidth = 1.5 * scale;
        ctx.strokeStyle = '#000000';
        ctx.moveTo(margin, y);
        ctx.lineTo(canvasWidth - margin, y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      y += gapAfter * scale;
    };

    const drawRow = (
      leftText: string,
      rightText: string,
      fontSize: number,
      isBold: boolean,
      gapAfter: number = 3
    ) => {
      ctx.font = `${isBold ? 'bold' : '600'} ${fontSize * scale}px ${fontFamily}`;
      if (isDrawing) {
        ctx.fillStyle = '#000000';
        ctx.textAlign = 'left';
        ctx.fillText(leftText, margin, y + fontSize * scale);
        ctx.textAlign = 'right';
        ctx.fillText(rightText, canvasWidth - margin, y + fontSize * scale);
      }
      y += (fontSize + gapAfter) * scale;
    };

    const drawLeftText = (
      text: string,
      fontSize: number,
      isBold: boolean,
      indent: number = 0,
      gapAfter: number = 2
    ) => {
      ctx.font = `${isBold ? 'bold' : 'normal'} ${fontSize * scale}px ${fontFamily}`;
      if (isDrawing) {
        ctx.fillStyle = '#000000';
        ctx.textAlign = 'left';
        ctx.fillText(text, margin + indent * scale, y + fontSize * scale);
      }
      y += (fontSize + gapAfter) * scale;
    };

    // 1. Header Toko
    drawCenterText(STORE_INFO.name, 14.5, true, 3);
    drawCenterText(STORE_INFO.address, 10, false, 2);
    drawCenterText(STORE_INFO.locationDetail, 10, false, 2);
    drawCenterText(`WA: ${STORE_INFO.phone}`, 10, false, 4);

    // Separator
    drawDashedLine(3, 5);

    // 2. Metadata Transaksi
    drawRow('No Nota :', transaction.noNota, 10.5, true, 2.5);
    drawRow('Tanggal :', transaction.dateStr, 10, false, 2);
    drawRow('Jam     :', transaction.jam, 10, false, 2);
    drawRow('Pelanggan:', transaction.pelanggan || 'Umum', 10.5, true, 2.5);
    if (transaction.hp) {
      drawRow('No HP   :', transaction.hp, 10, false, 2);
    }
    drawRow('Kasir   :', transaction.kasir || 'Admin', 10, false, 3);

    // Separator
    drawDashedLine(3, 5);

    // 3. Header Item
    drawRow('ITEM PESANAN', 'TOTAL', 10.5, true, 4);

    // 4. List Items
    transaction.items.forEach((item, idx) => {
      const itemNumAndName = `${idx + 1}. ${item.product.name}`;
      const totalStr = formatRupiah(item.total);

      // Hitung lebar total agar nama item tidak menabrak
      ctx.font = `bold ${10.5 * scale}px ${fontFamily}`;
      const totalWidth = ctx.measureText(totalStr).width;
      const maxNameWidth = printableWidth - totalWidth - (12 * scale);

      const nameLines = wrapText(ctx, itemNumAndName, maxNameWidth, 10.5, true);

      // Baris pertama nama item + Total di sebelah kanan
      if (isDrawing) {
        ctx.font = `bold ${10.5 * scale}px ${fontFamily}`;
        ctx.fillStyle = '#000000';
        ctx.textAlign = 'left';
        ctx.fillText(nameLines[0], margin, y + 10.5 * scale);
        ctx.textAlign = 'right';
        ctx.fillText(totalStr, canvasWidth - margin, y + 10.5 * scale);
      }
      y += (10.5 + 2.5) * scale;

      // Baris kelanjutan nama item jika panjang
      for (let i = 1; i < nameLines.length; i++) {
        if (isDrawing) {
          ctx.font = `bold ${10.5 * scale}px ${fontFamily}`;
          ctx.fillStyle = '#000000';
          ctx.textAlign = 'left';
          ctx.fillText(nameLines[i], margin + (10 * scale), y + 10.5 * scale);
        }
        y += (10.5 + 2) * scale;
      }

      // Spesifikasi Ukuran / Qty
      let specText = '';
      if (item.product.category === 'Meteran') {
        specText = `${item.panjang}x${item.lebar}m (${item.qty} pcs) = ${formatNumber(item.totalLuas, 2)}m² @${formatNumber(item.product.price)}`;
      } else if (item.product.category === 'Cutting') {
        specText = `${Math.round(item.panjang)}x${Math.round(item.lebar)}cm = ${Math.round(item.totalLuas)}cm @${formatNumber(item.product.price)}`;
      } else {
        specText = `${item.qty} ${item.product.unit} @${formatNumber(item.product.price)}`;
      }
      drawLeftText(specText, 9.5, false, 8, 2);

      // Finishing details
      const fins = getFinishingLabels(item.finishing, item.product.category);
      fins.forEach((f) => {
        drawLeftText(`- ${f}`, 9, false, 12, 1.5);
      });

      // Desain Fee
      if (item.desainFee > 0) {
        drawLeftText(`Desain: ${formatRupiah(item.desainFee)}`, 9, false, 12, 2);
      }

      y += 2.5 * scale; // Spasi antar item
    });

    // Separator
    drawDashedLine(3, 5);

    // 5. Total dan Pembayaran
    drawRow('Subtotal', formatRupiah(transaction.subtotal), 10.5, true, 2.5);

    if (transaction.diskonRp > 0) {
      const diskLabel = transaction.diskonPercent > 0 ? `Diskon ${transaction.diskonPercent}%` : 'Diskon Tunai';
      drawRow(diskLabel, `-${formatRupiah(transaction.diskonRp)}`, 10.5, true, 2.5);
    }

    drawRow('GRAND TOTAL', formatRupiah(transaction.grandTotal), 12, true, 3.5);

    const isDpTrx = Boolean(transaction.isDP || (transaction.sisaTagihan && transaction.sisaTagihan > 0));
    if (isDpTrx) {
      const sisa = transaction.sisaTagihan ?? Math.max(0, transaction.grandTotal - transaction.bayar);
      drawRow(`DP (${transaction.paymentMethod.toUpperCase()})`, formatRupiah(transaction.bayar), 10.5, true, 2.5);
      drawRow('SISA TAGIHAN', formatRupiah(sisa), 11.5, true, 3);
      drawRow('STATUS', 'BELUM LUNAS (DP)', 10.5, true, 2.5);
    } else {
      drawRow(`Bayar (${transaction.paymentMethod.toUpperCase()})`, formatRupiah(transaction.bayar), 10, false, 2.5);
      if (transaction.paymentMethod === 'tunai') {
        const kembalian = transaction.kembalian > 0 ? transaction.kembalian : 0;
        drawRow('Kembalian', formatRupiah(kembalian), 10.5, true, 2.5);
      }
      drawRow('STATUS', 'LUNAS', 10.5, true, 2.5);
    }

    // Separator
    drawDashedLine(3, 5);

    // 6. Catatan Kaki / Footer
    drawCenterText('Terima kasih Sudah Order', 10.5, true, 2);
    drawCenterText(STORE_INFO.note1, 9.5, false, 2);
    drawCenterText(STORE_INFO.note2, 9.5, false, 3);

    drawCenterText(`Hubungi WA: ${STORE_INFO.phone}`, 9, false, 1.5);
    drawCenterText(`Dicetak: ${new Date().toLocaleString('id-ID')}`, 9, false, 2);
    drawCenterText('KASIR WIGATA DIGITAL PRINT', 10, true, 2);
    drawCenterText('Powered by Wigata POS v2.0', 8.5, false, 0);

    y += 18 * scale;
    return y;
  };

  // 1. Jalankan layout pass pertama untuk menghitung tinggi canvas yang tepat
  const totalHeight = Math.ceil(runLayout(measureCtx, false));

  // 2. Buat Canvas sebenarnya dengan dimensi yang telah dihitung
  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = totalHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to create canvas context');
  }

  // 3. Cat canvas dengan latar belakang putih bersih
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvasWidth, totalHeight);

  // 4. Jalankan layout pass kedua untuk menggambar semua elemen teks hitam pekat
  runLayout(ctx, true);

  return canvas;
};

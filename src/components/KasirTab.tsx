import React, { useState, useMemo } from 'react';
import {
  ProductItem,
  ProductCategory,
  CartItem,
  FinishingOptions,
  PaymentMethod,
  Transaction,
  PrinterConfig,
} from '../types';
import {
  CATALOG_PRODUCTS,
  CATEGORIES,
  INITIAL_FINISHING,
  FINISHING_RATES,
  formatRupiah,
  formatNumber,
  roundUpTo500,
} from '../utils/defaultData';
import { ThermalReceipt } from './ThermalReceipt';
import {
  Plus,
  Trash2,
  Check,
  CreditCard,
  Banknote,
  QrCode,
  Sparkles,
  Info,
  Layers,
  ArrowRight,
  Wallet,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface KasirTabProps {
  products: ProductItem[];
  cart: CartItem[];
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
  onSaveTransaction: (trxData: Omit<Transaction, 'id'>) => Promise<Transaction>;
  printerConfig: PrinterConfig;
  onOpenPrinterModal: () => void;
  onShowToast: (msg: string) => void;
  kasirName: string;
}

export const KasirTab: React.FC<KasirTabProps> = ({
  products,
  cart,
  setCart,
  onSaveTransaction,
  printerConfig,
  onOpenPrinterModal,
  onShowToast,
  kasirName,
}) => {
  // Catalog selection
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory>('Meteran');
  const [selectedProduct, setSelectedProduct] = useState<ProductItem>(
    products.find((p) => p.category === 'Meteran') || products[0]
  );

  // Dimensions & Qty
  const [panjang, setPanjang] = useState<number>(1);
  const [lebar, setLebar] = useState<number>(1);
  const [qty, setQty] = useState<number>(1);

  // Finishing
  const [finishing, setFinishing] = useState<FinishingOptions>({ ...INITIAL_FINISHING });
  const [desainFee, setDesainFee] = useState<number>(0);

  // Cart & Checkout state
  const [diskonTunai, setDiskonTunai] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('tunai');
  const [isDPMode, setIsDPMode] = useState<boolean>(false);
  const [dpNominal, setDpNominal] = useState<number>(0);
  const [bayarNominal, setBayarNominal] = useState<number>(0);
  const [pelanggan, setPelanggan] = useState<string>('Umum');
  const [noHp, setNoHp] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedTrx, setLastSavedTrx] = useState<Transaction | null>(null);

  // Filter products by selected category
  const filteredProducts = useMemo(() => {
    return products.filter((p) => p.category === selectedCategory);
  }, [products, selectedCategory]);

  const isMeteran = selectedProduct?.category === 'Meteran';
  const isA3 = selectedProduct?.category === 'A3+';
  const isCutting = selectedProduct?.category === 'Cutting';
  const isNota = selectedProduct?.category === 'Nota Rim';

  // Calculator logic for active product
  const calcDetails = useMemo(() => {
    if (!selectedProduct) {
      return {
        luas: 0,
        totalLuas: 0,
        rawBasePrice: 0,
        basePrice: 0,
        finishingCost: 0,
        total: 0,
        multiplier: 1,
        kelimPanjangTotal: 0,
        kelimCost: 0,
      };
    }

    let luas = 0;
    let totalLuas = 0;
    let rawBasePrice = 0;
    let basePrice = 0;
    let multiplier = 1;

    if (isMeteran) {
      luas = panjang * lebar;
      totalLuas = luas * qty;
      rawBasePrice = totalLuas * selectedProduct.price;
      // Pembulatan ke atas kelipatan Rp 500 (misal 3.200 -> 3.500, 3.600 -> 4.000)
      basePrice = roundUpTo500(rawBasePrice);
      multiplier = 1;
    } else if (isCutting) {
      luas = panjang * lebar;
      totalLuas = luas * qty;
      multiplier = finishing.warna2x ? FINISHING_RATES.multiplier2Warna : 1;
      rawBasePrice = totalLuas * selectedProduct.price * multiplier;
      // Pembulatan ke atas kelipatan Rp 500 (misal 3.200 -> 3.500, 3.600 -> 4.000)
      basePrice = roundUpTo500(rawBasePrice);
    } else if (isA3) {
      multiplier = finishing.bolakBalik ? FINISHING_RATES.multiplierBolakBalik : 1;
      rawBasePrice = selectedProduct.price * qty * multiplier;
      basePrice = rawBasePrice;
      totalLuas = qty;
    } else {
      rawBasePrice = selectedProduct.price * qty;
      basePrice = rawBasePrice;
      totalLuas = qty;
    }

    // Finishing Cost Calculations
    let finishingCost = 0;
    let kelimPanjangTotal = 0;
    let kelimCost = 0;

    if (isMeteran) {
      if (finishing.mataAyam) {
        finishingCost += (finishing.mataAyamCount || 0) * FINISHING_RATES.mataAyamPerTitik;
      }
      if (finishing.kelim) {
        // Rumus Wigata: (Panjang + Lebar) * Qty * 1000
        kelimPanjangTotal = (panjang + lebar) * qty;
        kelimCost = roundUpTo500(kelimPanjangTotal * FINISHING_RATES.kelimPerMeter);
        finishingCost += kelimCost;
      }
      if (finishing.laminasiDoffM) {
        finishingCost += roundUpTo500(totalLuas * FINISHING_RATES.laminasiDoffMeteran);
      }
      if (finishing.laminasiGlossyM) {
        finishingCost += roundUpTo500(totalLuas * FINISHING_RATES.laminasiGlossyMeteran);
      }
      finishingCost = roundUpTo500(finishingCost);
    } else if (isA3) {
      if (finishing.ciscut) {
        finishingCost += qty * FINISHING_RATES.ciscutPerLembar;
      }
      if (finishing.potong) {
        finishingCost += qty * FINISHING_RATES.potongPerLembar;
      }
      if (finishing.laminasiDingin) {
        finishingCost += qty * FINISHING_RATES.laminasiDinginA3;
      }
      if (finishing.laminasiPanas) {
        finishingCost += qty * FINISHING_RATES.laminasiPanasA3;
      }
      if (finishing.laminatingF4) {
        finishingCost += qty * FINISHING_RATES.laminatingF4;
      }
    }

    const rawTotal = basePrice + finishingCost + desainFee;
    const total = isMeteran || isCutting ? roundUpTo500(rawTotal) : rawTotal;

    return {
      luas,
      totalLuas,
      rawBasePrice,
      basePrice,
      finishingCost,
      total,
      multiplier,
      kelimPanjangTotal,
      kelimCost,
    };
  }, [selectedProduct, panjang, lebar, qty, finishing, desainFee, isMeteran, isA3, isCutting]);

  // Add active item to cart
  const handleAddToCart = () => {
    if (!selectedProduct) return;

    const newItem: CartItem = {
      cartId: `cart_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      product: selectedProduct,
      panjang: isMeteran || isCutting ? panjang : 0,
      lebar: isMeteran || isCutting ? lebar : 0,
      luas: isMeteran || isCutting ? calcDetails.luas : 0,
      totalLuas: isMeteran || isCutting ? calcDetails.totalLuas : qty,
      qty,
      finishing: { ...finishing },
      desainFee,
      basePrice: calcDetails.basePrice,
      finishingCost: calcDetails.finishingCost,
      total: calcDetails.total,
    };

    setCart((prev) => [...prev, newItem]);
    onShowToast(`${selectedProduct.name} ditambahkan ke keranjang`);

    // Reset temporary fees
    setDesainFee(0);
  };

  // Modify cart item qty
  const handleUpdateCartQty = (cartId: string, newQty: number) => {
    if (newQty < 1) return;
    setCart((prev) =>
      prev.map((item) => {
        if (item.cartId !== cartId) return item;

        // Recalculate
        const p = item.product;
        const isMet = p.category === 'Meteran';
        const isCut = p.category === 'Cutting';
        const isA3Cat = p.category === 'A3+';

        let itemLuas = item.luas;
        let itemTotalLuas = item.totalLuas;
        let itemBase = 0;

        if (isMet || isCut) {
          itemLuas = item.panjang * item.lebar;
          itemTotalLuas = itemLuas * newQty;
          const mult = isCut && item.finishing.warna2x ? 2 : 1;
          itemBase = roundUpTo500(itemTotalLuas * p.price * mult);
        } else if (isA3Cat) {
          const mult = item.finishing.bolakBalik ? 2 : 1;
          itemBase = p.price * newQty * mult;
          itemTotalLuas = newQty;
        } else {
          itemBase = p.price * newQty;
          itemTotalLuas = newQty;
        }

        let itemFinCost = 0;
        if (isMet) {
          if (item.finishing.mataAyam) itemFinCost += item.finishing.mataAyamCount * FINISHING_RATES.mataAyamPerTitik;
          if (item.finishing.kelim) itemFinCost += roundUpTo500((item.panjang + item.lebar) * newQty * FINISHING_RATES.kelimPerMeter);
          if (item.finishing.laminasiDoffM) itemFinCost += roundUpTo500(itemTotalLuas * FINISHING_RATES.laminasiDoffMeteran);
          if (item.finishing.laminasiGlossyM) itemFinCost += roundUpTo500(itemTotalLuas * FINISHING_RATES.laminasiGlossyMeteran);
          itemFinCost = roundUpTo500(itemFinCost);
        } else if (isA3Cat) {
          if (item.finishing.ciscut) itemFinCost += newQty * FINISHING_RATES.ciscutPerLembar;
          if (item.finishing.potong) itemFinCost += newQty * FINISHING_RATES.potongPerLembar;
          if (item.finishing.laminasiDingin) itemFinCost += newQty * FINISHING_RATES.laminasiDinginA3;
          if (item.finishing.laminasiPanas) itemFinCost += newQty * FINISHING_RATES.laminasiPanasA3;
          if (item.finishing.laminatingF4) itemFinCost += newQty * FINISHING_RATES.laminatingF4;
        }

        const rawTotal = itemBase + itemFinCost + item.desainFee;
        const newTotal = isMet || isCut ? roundUpTo500(rawTotal) : rawTotal;

        return {
          ...item,
          qty: newQty,
          luas: itemLuas,
          totalLuas: itemTotalLuas,
          basePrice: itemBase,
          finishingCost: itemFinCost,
          total: newTotal,
        };
      })
    );
  };

  const handleRemoveCartItem = (cartId: string) => {
    setCart((prev) => prev.filter((item) => item.cartId !== cartId));
  };

  // Cart Totals
  const subtotal = useMemo(() => cart.reduce((sum, it) => sum + it.total, 0), [cart]);
  const diskonRp = useMemo(() => Math.min(subtotal, Math.max(0, Math.round(diskonTunai || 0))), [subtotal, diskonTunai]);
  const grandTotal = Math.max(0, subtotal - diskonRp);
  const sisaTagihan = isDPMode ? Math.max(0, grandTotal - dpNominal) : 0;
  const kembalian = isDPMode
    ? Math.max(0, dpNominal - grandTotal)
    : paymentMethod === 'tunai'
    ? bayarNominal - grandTotal
    : 0;

  // Checkout Save
  const handleCheckout = async () => {
    if (cart.length === 0) {
      onShowToast('Keranjang masih kosong!');
      return;
    }

    if (!isDPMode && paymentMethod === 'tunai' && bayarNominal < grandTotal) {
      onShowToast('Uang tunai kurang! Aktifkan fitur DP jika pelanggan membayar uang muka.');
      return;
    }

    if (isDPMode && dpNominal <= 0) {
      onShowToast('Masukkan nominal uang DP (Uang Muka) terlebih dahulu!');
      return;
    }

    setIsSaving(true);
    try {
      const now = new Date();
      const effectiveIsDP = isDPMode && dpNominal < grandTotal;
      const effectiveSisa = effectiveIsDP ? Math.max(0, grandTotal - dpNominal) : 0;
      const effectiveBayar = isDPMode
        ? dpNominal
        : paymentMethod === 'tunai'
        ? bayarNominal
        : grandTotal;
      const effectiveKembalian = isDPMode
        ? Math.max(0, dpNominal - grandTotal)
        : paymentMethod === 'tunai'
        ? Math.max(0, kembalian)
        : 0;

      const transactionData: Omit<Transaction, 'id'> = {
        noNota: '', // Will be assigned
        date: now.toISOString(),
        dateStr: now.toLocaleDateString('id-ID'),
        tanggalDisplay: now.toLocaleDateString('id-ID', {
          weekday: 'long',
          day: '2-digit',
          month: 'long',
          year: 'numeric',
        }),
        jam: now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        pelanggan: pelanggan.trim() || 'Umum',
        hp: noHp.trim(),
        kasir: kasirName,
        items: [...cart],
        subtotal,
        diskonPercent: 0,
        diskonRp,
        grandTotal,
        paymentMethod,
        bayar: effectiveBayar,
        kembalian: effectiveKembalian,
        isDP: effectiveIsDP,
        sisaTagihan: effectiveSisa,
        statusBayar: effectiveIsDP ? 'dp' : 'lunas',
      };

      const saved = await onSaveTransaction(transactionData);
      setLastSavedTrx(saved);

      // Trigger celebratory confetti
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.8 },
      });

      // Clear cart
      setCart([]);
      setBayarNominal(0);
      setDpNominal(0);
      setIsDPMode(false);
      setDiskonTunai(0);
      setPelanggan('Umum');
      setNoHp('');

      onShowToast(
        effectiveIsDP
          ? `Transaksi DP ${saved.noNota} disimpan! Sisa tagihan: ${formatRupiah(effectiveSisa)}`
          : `Transaksi ${saved.noNota} berhasil disimpan!`
      );
    } catch {
      onShowToast('Terjadi kesalahan saat menyimpan transaksi');
    } finally {
      setIsSaving(false);
    }
  };

  // Preview transaction object (either the last saved one or live cart)
  const previewTransaction: Transaction = useMemo(() => {
    if (lastSavedTrx && cart.length === 0) {
      return lastSavedTrx;
    }
    const now = new Date();
    const effectiveIsDP = isDPMode && dpNominal < grandTotal;
    const effectiveSisa = effectiveIsDP ? Math.max(0, grandTotal - dpNominal) : 0;
    const effectiveBayar = isDPMode
      ? dpNominal
      : paymentMethod === 'tunai'
      ? bayarNominal
      : grandTotal;
    const effectiveKembalian = isDPMode
      ? Math.max(0, dpNominal - grandTotal)
      : paymentMethod === 'tunai'
      ? Math.max(0, kembalian)
      : 0;

    return {
      id: 'preview',
      noNota: 'WGT-DRAFT-PREVIEW',
      date: now.toISOString(),
      dateStr: now.toLocaleDateString('id-ID'),
      tanggalDisplay: now.toLocaleDateString('id-ID', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      }),
      jam: now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      pelanggan: pelanggan || 'Umum',
      hp: noHp,
      kasir: kasirName,
      items: cart,
      subtotal,
      diskonPercent: 0,
      diskonRp,
      grandTotal,
      paymentMethod,
      bayar: effectiveBayar,
      kembalian: effectiveKembalian,
      isDP: effectiveIsDP,
      sisaTagihan: effectiveSisa,
      statusBayar: effectiveIsDP ? 'dp' : 'lunas',
    };
  }, [
    lastSavedTrx,
    cart,
    pelanggan,
    noHp,
    kasirName,
    subtotal,
    diskonRp,
    grandTotal,
    paymentMethod,
    bayarNominal,
    kembalian,
    isDPMode,
    dpNominal,
  ]);

  return (
    <div className="max-w-[1440px] mx-auto p-3 sm:p-4 grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-4">
      {/* LEFT COLUMN: Catalog & Dynamic Calculator */}
      <div className="space-y-4">
        {/* Catalog Section */}
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-black/5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-black text-sm uppercase tracking-wide text-[#0B1E3A] flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-[#FFD23F]" />
              Katalog Produk Percetakan
            </h3>
            <span className="text-[11px] text-black/50">{filteredProducts.length} item tersedia</span>
          </div>

          {/* Category Filter Pills */}
          <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-1">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => {
                  setSelectedCategory(cat);
                  const firstInCat = products.find((p) => p.category === cat);
                  if (firstInCat) setSelectedProduct(firstInCat);
                }}
                className={`px-4 py-2 rounded-full text-xs font-bold transition whitespace-nowrap ${
                  selectedCategory === cat
                    ? 'bg-[#0B1E3A] text-white shadow-sm'
                    : 'bg-[#F1F3F8] text-[#0B1E3A] hover:bg-black/10'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Product Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[300px] overflow-y-auto pr-1">
            {filteredProducts.map((prod) => {
              const isSelected = selectedProduct?.id === prod.id;
              return (
                <button
                  key={prod.id}
                  onClick={() => setSelectedProduct(prod)}
                  className={`text-left p-3 rounded-2xl border transition flex items-center justify-between group ${
                    isSelected
                      ? 'border-[#0B1E3A] bg-[#0B1E3A]/[0.05] shadow-sm'
                      : 'border-black/10 bg-white hover:border-black/20'
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <div className="font-bold text-xs text-[#0B1E3A] flex items-center gap-1.5">
                      <span className="truncate">{prod.name}</span>
                      {prod.popular && (
                        <span className="bg-[#FFD23F] text-[#0B1E3A] text-[9px] px-1.5 py-0.5 rounded font-black shrink-0">
                          POPULER
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-black/60 font-semibold mt-0.5">
                      {formatRupiah(prod.price)}
                      <span className="text-[10px] text-black/40 ml-0.5">{prod.unit}</span>
                    </div>
                  </div>
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition shrink-0 ${
                      isSelected ? 'bg-[#0B1E3A] text-white' : 'bg-[#F1F3F8] text-black/50 group-hover:bg-black/10'
                    }`}
                  >
                    {isSelected ? '✓' : '›'}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Dynamic Calculator Section */}
        {selectedProduct && (
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-black/5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-black/5">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-black/40">Kalkulator Order</span>
                <h4 className="font-black text-base text-[#0B1E3A] leading-tight">
                  {selectedProduct.name}
                </h4>
              </div>
              <span className="bg-[#FFD23F] text-[#0B1E3A] text-xs font-black px-3 py-1.5 rounded-full shadow-sm">
                {formatRupiah(selectedProduct.price)} {selectedProduct.unit}
              </span>
            </div>

            {/* Dimension inputs for Meteran & Cutting */}
            {isMeteran || isCutting ? (
              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-black/70 mb-1">
                    Panjang {isCutting ? '(cm)' : '(m)'}
                  </label>
                  <input
                    type="number"
                    step={isCutting ? '1' : '0.01'}
                    min="0.1"
                    value={panjang}
                    onChange={(e) => setPanjang(parseFloat(e.target.value) || 0)}
                    className="w-full bg-[#F6F7FB] border border-black/10 rounded-2xl px-3 py-2 text-sm font-bold text-[#0B1E3A] outline-none focus:border-[#0B1E3A]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-black/70 mb-1">
                    Lebar {isCutting ? '(cm)' : '(m)'}
                  </label>
                  <input
                    type="number"
                    step={isCutting ? '1' : '0.01'}
                    min="0.1"
                    value={lebar}
                    onChange={(e) => setLebar(parseFloat(e.target.value) || 0)}
                    className="w-full bg-[#F6F7FB] border border-black/10 rounded-2xl px-3 py-2 text-sm font-bold text-[#0B1E3A] outline-none focus:border-[#0B1E3A]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-black/70 mb-1">
                    Jumlah (Qty)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={qty}
                    onChange={(e) => setQty(parseInt(e.target.value) || 1)}
                    className="w-full bg-[#F6F7FB] border border-black/10 rounded-2xl px-3 py-2 text-sm font-bold text-[#0B1E3A] outline-none focus:border-[#0B1E3A]"
                  />
                </div>

                <div className="col-span-3 bg-[#F1F3F8] rounded-2xl p-3 text-xs space-y-1">
                  <div className="flex justify-between font-bold text-[#0B1E3A]">
                    <span>
                      Luas: {isCutting ? `${Math.round(calcDetails.luas)} cm` : `${formatNumber(calcDetails.luas, 2)} m²`}
                    </span>
                    <span>
                      Total Luas: {isCutting ? `${Math.round(calcDetails.totalLuas)} cm` : `${formatNumber(calcDetails.totalLuas, 2)} m²`}
                    </span>
                  </div>
                  <div className="text-[11px] text-black/60">
                    {isMeteran && (
                      <span>
                        Rumus: {formatNumber(calcDetails.luas, 2)} m² × {qty} pcs × {formatRupiah(selectedProduct.price)} ={' '}
                        <strong className="text-[#0B1E3A]">{formatRupiah(calcDetails.basePrice)}</strong>
                        {Math.round(calcDetails.rawBasePrice) !== calcDetails.basePrice && (
                          <span className="ml-1.5 inline-block bg-amber-200/80 text-[#0B1E3A] px-1.5 py-0.5 rounded text-[10px] font-bold">
                            Pembulatan ke atas dari {formatRupiah(Math.round(calcDetails.rawBasePrice))}
                          </span>
                        )}
                      </span>
                    )}
                    {isCutting && (
                      <span>
                        Rumus: {Math.round(panjang)}×{Math.round(lebar)} cm = {Math.round(calcDetails.luas)} × {qty} × Rp{selectedProduct.price}{' '}
                        {finishing.warna2x ? '× 2 Warna ' : ''}={' '}
                        <strong className="text-[#0B1E3A]">{formatRupiah(calcDetails.basePrice)}</strong>
                        {Math.round(calcDetails.rawBasePrice) !== calcDetails.basePrice && (
                          <span className="ml-1.5 inline-block bg-amber-200/80 text-[#0B1E3A] px-1.5 py-0.5 rounded text-[10px] font-bold">
                            Pembulatan ke atas dari {formatRupiah(Math.round(calcDetails.rawBasePrice))}
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-[11px] font-bold text-black/70 mb-1">
                  Jumlah Lembar / Pcs (Qty)
                </label>
                <div className="flex gap-2 items-center">
                  <input
                    type="number"
                    min="1"
                    value={qty}
                    onChange={(e) => setQty(parseInt(e.target.value) || 1)}
                    className="flex-1 bg-[#F6F7FB] border border-black/10 rounded-2xl px-4 py-2.5 text-base font-bold text-[#0B1E3A] outline-none focus:border-[#0B1E3A]"
                  />
                  <div className="flex gap-1">
                    {[5, 10, 50, 100].map((quickQty) => (
                      <button
                        key={quickQty}
                        onClick={() => setQty(quickQty)}
                        className="px-3 py-2 bg-[#F1F3F8] hover:bg-black/10 rounded-xl text-xs font-bold text-[#0B1E3A]"
                      >
                        +{quickQty}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Finishing Options */}
            <div className="space-y-2">
              <span className="block text-xs font-bold uppercase tracking-wider text-black/60">
                Pilihan Finishing
              </span>

              {/* Meteran Finishings */}
              {isMeteran && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {/* Mata Ayam / Ring */}
                  <div className="border border-black/10 rounded-2xl p-3 flex items-center justify-between bg-[#FCFCFD]">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={finishing.mataAyam}
                        onChange={(e) => setFinishing({ ...finishing, mataAyam: e.target.checked })}
                        className="w-4 h-4 accent-[#0B1E3A]"
                      />
                      <div>
                        <div className="font-bold">Ring / Mata Ayam</div>
                        <div className="text-[10px] text-black/50">Rp 500 / titik</div>
                      </div>
                    </label>
                    {finishing.mataAyam && (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="1"
                          value={finishing.mataAyamCount}
                          onChange={(e) =>
                            setFinishing({ ...finishing, mataAyamCount: parseInt(e.target.value) || 0 })
                          }
                          className="w-12 bg-white border border-black/15 rounded-lg px-2 py-1 text-center font-bold"
                        />
                        <span className="text-[10px] text-black/50">ttk</span>
                      </div>
                    )}
                  </div>

                  {/* Kelim / Lem Pas */}
                  <div className="border border-black/10 rounded-2xl p-3 bg-[#FCFCFD]">
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={finishing.kelim}
                        onChange={(e) => setFinishing({ ...finishing, kelim: e.target.checked })}
                        className="w-4 h-4 accent-[#0B1E3A] mt-0.5"
                      />
                      <div>
                        <div className="font-bold">Lem Pas / Kelim</div>
                        <div className="text-[10px] text-black/50 leading-tight">
                          Rp 1.000 / meter keliling (P+L) × Qty
                        </div>
                      </div>
                    </label>
                    {finishing.kelim && (
                      <div className="mt-2 bg-[#FFF8D6] text-[#0B1E3A] p-1.5 rounded-lg text-[10px] font-bold">
                        ({panjang}m + {lebar}m) × {qty} = {calcDetails.kelimPanjangTotal}m = {formatRupiah(calcDetails.kelimCost)}
                      </div>
                    )}
                  </div>

                  {/* Laminasi Doff Meteran */}
                  <label className="border border-black/10 rounded-2xl p-3 flex items-center gap-2 cursor-pointer bg-[#FCFCFD]">
                    <input
                      type="checkbox"
                      checked={finishing.laminasiDoffM}
                      onChange={(e) => setFinishing({ ...finishing, laminasiDoffM: e.target.checked })}
                      className="w-4 h-4 accent-[#0B1E3A]"
                    />
                    <div>
                      <div className="font-bold">Laminasi Doff Mtr</div>
                      <div className="text-[10px] text-black/50">Rp 25.000 / m²</div>
                    </div>
                  </label>

                  {/* Laminasi Glossy Meteran */}
                  <label className="border border-black/10 rounded-2xl p-3 flex items-center gap-2 cursor-pointer bg-[#FCFCFD]">
                    <input
                      type="checkbox"
                      checked={finishing.laminasiGlossyM}
                      onChange={(e) => setFinishing({ ...finishing, laminasiGlossyM: e.target.checked })}
                      className="w-4 h-4 accent-[#0B1E3A]"
                    />
                    <div>
                      <div className="font-bold">Laminasi Glossy Mtr</div>
                      <div className="text-[10px] text-black/50">Rp 25.000 / m²</div>
                    </div>
                  </label>
                </div>
              )}

              {/* A3+ Finishings */}
              {isA3 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {/* Ciscut */}
                  <label className="border border-black/10 rounded-2xl p-3 flex items-center gap-2 cursor-pointer bg-[#FCFCFD]">
                    <input
                      type="checkbox"
                      checked={finishing.ciscut}
                      onChange={(e) => setFinishing({ ...finishing, ciscut: e.target.checked })}
                      className="w-4 h-4 accent-[#0B1E3A]"
                    />
                    <div>
                      <div className="font-bold">Ciscut (Kiss Cut Stiker)</div>
                      <div className="text-[10px] text-black/50">Rp 4.500 / lbr</div>
                    </div>
                  </label>

                  {/* Potong Jadi */}
                  <label className="border border-black/10 rounded-2xl p-3 flex items-center gap-2 cursor-pointer bg-[#FCFCFD]">
                    <input
                      type="checkbox"
                      checked={finishing.potong}
                      onChange={(e) => setFinishing({ ...finishing, potong: e.target.checked })}
                      className="w-4 h-4 accent-[#0B1E3A]"
                    />
                    <div>
                      <div className="font-bold">Potong Jadi (Cutting Dies/Mesin)</div>
                      <div className="text-[10px] text-black/50">Rp 2.000 / lbr</div>
                    </div>
                  </label>

                  {/* Cetak Bolak-Balik */}
                  <label className="border border-amber-300 bg-[#FFF8D6] rounded-2xl p-3 flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={finishing.bolakBalik}
                      onChange={(e) => setFinishing({ ...finishing, bolakBalik: e.target.checked })}
                      className="w-4 h-4 accent-[#0B1E3A]"
                    />
                    <div>
                      <div className="font-bold text-[#0B1E3A]">Cetak Bolak Balik (2 Muka)</div>
                      <div className="text-[10px] text-black/60">Harga Dasar Otomatis × 2</div>
                    </div>
                  </label>

                  {/* Laminasi Dingin */}
                  <label className="border border-black/10 rounded-2xl p-3 flex items-center gap-2 cursor-pointer bg-[#FCFCFD]">
                    <input
                      type="checkbox"
                      checked={finishing.laminasiDingin}
                      onChange={(e) => setFinishing({ ...finishing, laminasiDingin: e.target.checked })}
                      className="w-4 h-4 accent-[#0B1E3A]"
                    />
                    <div>
                      <div className="font-bold">Laminasi Dingin A3+</div>
                      <div className="text-[10px] text-black/50">Rp 5.000 / lbr</div>
                    </div>
                  </label>

                  {/* Laminasi Panas */}
                  <label className="border border-black/10 rounded-2xl p-3 flex items-center gap-2 cursor-pointer bg-[#FCFCFD]">
                    <input
                      type="checkbox"
                      checked={finishing.laminasiPanas}
                      onChange={(e) => setFinishing({ ...finishing, laminasiPanas: e.target.checked })}
                      className="w-4 h-4 accent-[#0B1E3A]"
                    />
                    <div>
                      <div className="font-bold">Laminasi Panas A3+ (Doff/Glossy)</div>
                      <div className="text-[10px] text-black/50">Rp 2.000 / lbr</div>
                    </div>
                  </label>

                  {/* Laminating F4 */}
                  <label className="border border-black/10 rounded-2xl p-3 flex items-center gap-2 cursor-pointer bg-[#FCFCFD]">
                    <input
                      type="checkbox"
                      checked={finishing.laminatingF4}
                      onChange={(e) => setFinishing({ ...finishing, laminatingF4: e.target.checked })}
                      className="w-4 h-4 accent-[#0B1E3A]"
                    />
                    <div>
                      <div className="font-bold">Laminating Press Tebal F4</div>
                      <div className="text-[10px] text-black/50">Rp 4.000 / lbr</div>
                    </div>
                  </label>
                </div>
              )}

              {/* Cutting Finishings */}
              {isCutting && (
                <label className="border border-amber-300 bg-[#FFF8D6] rounded-2xl p-3 flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={finishing.warna2x}
                    onChange={(e) => setFinishing({ ...finishing, warna2x: e.target.checked })}
                    className="w-4 h-4 accent-[#0B1E3A]"
                  />
                  <div>
                    <div className="font-bold text-[#0B1E3A]">Kombinasi 2 Warna</div>
                    <div className="text-[10px] text-black/60">Biaya cutting × 2 harga</div>
                  </div>
                </label>
              )}

              {!isMeteran && !isA3 && !isCutting && (
                <div className="text-xs text-black/50 bg-[#F6F7FB] p-3 rounded-2xl">
                  Harga kategori {selectedProduct.category} sudah termasuk proses standar percetakan.
                </div>
              )}
            </div>

            {/* Desain Fee Slider */}
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-black/70">Biaya Tambahan Jasa Desain:</span>
                <span className="font-black bg-[#0B1E3A] text-white px-2.5 py-0.5 rounded-full">
                  {formatRupiah(desainFee)}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100000"
                step="5000"
                value={desainFee}
                onChange={(e) => setDesainFee(Number(e.target.value))}
                className="w-full accent-[#0B1E3A]"
              />
              <div className="flex gap-1.5 justify-end">
                {[0, 15000, 25000, 50000].map((fee) => (
                  <button
                    key={fee}
                    onClick={() => setDesainFee(fee)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      desainFee === fee ? 'bg-[#0B1E3A] text-white' : 'bg-[#F1F3F8] text-black/60'
                    }`}
                  >
                    {fee === 0 ? 'Gratis' : `+${fee / 1000}k`}
                  </button>
                ))}
              </div>
            </div>

            {/* Total Calculation Card & Add To Cart Button */}
            <div className="bg-[#0B1E3A] text-white rounded-3xl p-4 space-y-3">
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-white/70">
                  <span>Cetak Dasar {calcDetails.multiplier > 1 ? `(×${calcDetails.multiplier})` : ''}</span>
                  <span className="font-bold text-white">{formatRupiah(calcDetails.basePrice)}</span>
                </div>
                <div className="flex justify-between text-white/70">
                  <span>Total Finishing</span>
                  <span className="font-bold text-white">{formatRupiah(calcDetails.finishingCost)}</span>
                </div>
                {desainFee > 0 && (
                  <div className="flex justify-between text-white/70">
                    <span>Biaya Desain</span>
                    <span className="font-bold text-white">{formatRupiah(desainFee)}</span>
                  </div>
                )}
                <div className="border-t border-white/15 pt-2 flex justify-between items-baseline">
                  <span className="font-black text-sm text-white/90">TOTAL ITEM:</span>
                  <span className="font-black text-xl text-[#FFD23F]">{formatRupiah(calcDetails.total)}</span>
                </div>
              </div>

              <button
                onClick={handleAddToCart}
                className="w-full bg-[#FFD23F] hover:brightness-95 text-[#0B1E3A] font-black py-3 rounded-2xl flex items-center justify-center gap-2 transition shadow-md"
              >
                <Plus className="w-5 h-5 stroke-[3]" />
                + MASUKKAN KE KERANJANG
              </button>
            </div>
          </div>
        )}
      </div>

      {/* RIGHT COLUMN: Cart, Checkout & Thermal Receipt */}
      <div className="space-y-4">
        {/* Cart Card */}
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-black/5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-black text-sm uppercase tracking-wide text-[#0B1E3A] flex items-center gap-1.5">
              <span>Keranjang Belanja</span>
              <span className="bg-[#0B1E3A] text-white text-[11px] px-2 py-0.5 rounded-full font-bold">
                {cart.length} item
              </span>
            </h3>
            {cart.length > 0 && (
              <button
                onClick={() => setCart([])}
                className="text-xs text-red-600 font-bold hover:underline"
              >
                Kosongkan
              </button>
            )}
          </div>

          {/* Cart Item List */}
          {cart.length === 0 ? (
            <div className="text-center py-8 bg-[#F6F7FB] rounded-2xl border border-dashed border-black/10 space-y-1">
              <div className="text-sm font-bold text-black/50">Keranjang masih kosong</div>
              <div className="text-xs text-black/40">
                Pilih produk dan tentukan ukuran di kalkulator samping, lalu klik Tambah.
              </div>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
              {cart.map((item, idx) => (
                <div
                  key={item.cartId}
                  className="p-3 rounded-2xl border border-black/10 bg-[#FCFCFD] space-y-2 hover:border-black/20 transition"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-bold text-xs text-[#0B1E3A]">
                        {idx + 1}. {item.product.name.toUpperCase()}
                      </div>
                      <div className="text-[11px] text-black/60">
                        {item.product.category === 'Meteran'
                          ? `${item.panjang}x${item.lebar}m = ${formatNumber(item.luas, 2)}m²`
                          : item.product.category === 'Cutting'
                          ? `${Math.round(item.panjang)}x${Math.round(item.lebar)}cm = ${Math.round(item.luas)}cm`
                          : `${item.product.category}`}
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveCartItem(item.cartId)}
                      className="text-black/30 hover:text-red-600 transition p-1"
                      title="Hapus Item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-black/5">
                    {/* Qty Stepper */}
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleUpdateCartQty(item.cartId, item.qty - 1)}
                        className="w-6 h-6 rounded-lg bg-[#F1F3F8] hover:bg-black/10 text-xs font-black flex items-center justify-center"
                      >
                        -
                      </button>
                      <span className="w-8 text-center text-xs font-bold">{item.qty}</span>
                      <button
                        onClick={() => handleUpdateCartQty(item.cartId, item.qty + 1)}
                        className="w-6 h-6 rounded-lg bg-[#0B1E3A] text-white text-xs font-black flex items-center justify-center"
                      >
                        +
                      </button>
                    </div>

                    <div className="font-black text-sm text-[#0B1E3A]">{formatRupiah(item.total)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Customer & Nota Input */}
          <div className="pt-2 border-t border-black/10 space-y-2">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <label className="block text-[10px] font-bold uppercase text-black/50 mb-0.5">Nama Pelanggan</label>
                <input
                  type="text"
                  value={pelanggan}
                  onChange={(e) => setPelanggan(e.target.value)}
                  placeholder="Nama Pelanggan"
                  className="w-full bg-[#F6F7FB] border border-black/10 rounded-xl px-3 py-2 font-bold outline-none focus:border-[#0B1E3A]"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-black/50 mb-0.5">No WhatsApp / HP</label>
                <input
                  type="text"
                  value={noHp}
                  onChange={(e) => setNoHp(e.target.value)}
                  placeholder="0812..."
                  className="w-full bg-[#F6F7FB] border border-black/10 rounded-xl px-3 py-2 font-bold outline-none focus:border-[#0B1E3A]"
                />
              </div>
            </div>

            {/* Cash Discount (Diskon Uang Tunai) & Payment Method */}
            <div className="grid grid-cols-2 gap-2 text-xs pt-1">
              <div>
                <label className="block text-[10px] font-bold uppercase text-black/50 mb-0.5">
                  Diskon Uang Tunai (Rp)
                </label>
                <div className="relative">
                  <span className="text-[11px] font-black text-black/40 absolute left-3 top-2">
                    Rp
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="500"
                    value={diskonTunai || ''}
                    placeholder="0"
                    onChange={(e) => setDiskonTunai(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full bg-[#F6F7FB] border border-black/10 rounded-xl pl-8 pr-3 py-2 font-bold outline-none focus:border-[#0B1E3A]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-black/50 mb-0.5">Metode Bayar</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full bg-[#F6F7FB] border border-black/10 rounded-xl px-3 py-2 font-bold outline-none cursor-pointer focus:border-[#0B1E3A]"
                >
                  <option value="tunai">Tunai (Cash)</option>
                  <option value="qris">QRIS (Otomatis)</option>
                  <option value="transfer">Transfer Bank</option>
                </select>
              </div>
            </div>

            {/* Tipe Pembayaran: LUNAS vs DP (Uang Muka) */}
            <div className="pt-1 space-y-1">
              <label className="block text-[10px] font-bold uppercase text-black/50">
                Status / Jenis Pembayaran
              </label>
              <div className="grid grid-cols-2 gap-1.5 bg-[#F1F3F8] p-1 rounded-2xl text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setIsDPMode(false);
                    setDpNominal(0);
                  }}
                  className={`py-2 px-3 rounded-xl font-black flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    !isDPMode
                      ? 'bg-[#0B1E3A] text-white shadow-sm'
                      : 'text-black/60 hover:text-[#0B1E3A]'
                  }`}
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>LUNAS (Penuh)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsDPMode(true);
                    if (dpNominal === 0 && grandTotal > 0) {
                      setDpNominal(roundUpTo500(grandTotal * 0.5));
                    }
                  }}
                  className={`py-2 px-3 rounded-xl font-black flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    isDPMode
                      ? 'bg-[#FFD23F] text-[#0B1E3A] shadow-sm'
                      : 'text-black/60 hover:text-[#0B1E3A]'
                  }`}
                >
                  <Wallet className="w-3.5 h-3.5" />
                  <span>DP (Uang Muka)</span>
                </button>
              </div>
            </div>

            {/* DP (Uang Muka) Input Panel */}
            {isDPMode ? (
              <div className="bg-amber-50 border-2 border-[#FFD23F] rounded-2xl p-3 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-black text-[#0B1E3A] block">Nominal DP / Uang Muka:</span>
                    <span className="text-[10px] text-black/50">
                      Dibayar via {paymentMethod.toUpperCase()}
                    </span>
                  </div>
                  <div className="relative">
                    <span className="text-xs font-black text-black/40 absolute left-2.5 top-2">Rp</span>
                    <input
                      type="number"
                      min="0"
                      step="500"
                      value={dpNominal || ''}
                      placeholder="Contoh: 50000"
                      onChange={(e) => setDpNominal(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-40 bg-white border border-black/20 rounded-xl pl-8 pr-3 py-1.5 text-right font-black text-sm text-[#0B1E3A] outline-none focus:border-[#0B1E3A]"
                    />
                  </div>
                </div>

                <div className="flex gap-1 justify-end flex-wrap">
                  {grandTotal > 0 && (
                    <>
                      <button
                        type="button"
                        onClick={() => setDpNominal(roundUpTo500(grandTotal * 0.3))}
                        className="px-2 py-1 bg-white hover:bg-black/5 border border-black/15 rounded-lg text-[10px] font-bold text-[#0B1E3A]"
                      >
                        DP 30%
                      </button>
                      <button
                        type="button"
                        onClick={() => setDpNominal(roundUpTo500(grandTotal * 0.5))}
                        className="px-2 py-1 bg-white hover:bg-black/5 border border-black/15 rounded-lg text-[10px] font-bold text-[#0B1E3A]"
                      >
                        DP 50%
                      </button>
                    </>
                  )}
                  {[20000, 50000, 100000, 200000].map((nominal) => (
                    <button
                      type="button"
                      key={nominal}
                      onClick={() => setDpNominal(nominal)}
                      className="px-2 py-1 bg-white hover:bg-black/5 border border-black/15 rounded-lg text-[10px] font-bold text-[#0B1E3A]"
                    >
                      {nominal / 1000}k
                    </button>
                  ))}
                </div>

                <div className="flex justify-between items-center pt-1.5 border-t border-amber-300/80">
                  <span className="font-bold text-red-700">Sisa Tagihan (Kurang Bayar):</span>
                  <span className="font-black text-sm px-2.5 py-0.5 rounded-lg bg-red-100 text-red-800">
                    {formatRupiah(sisaTagihan)}
                  </span>
                </div>
              </div>
            ) : (
              /* Cash nominal input if payment is Lunas & Tunai */
              paymentMethod === 'tunai' && (
                <div className="bg-[#FFF8D6] border border-amber-300 rounded-2xl p-3 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#0B1E3A]">Uang Tunai Diterima:</span>
                    <input
                      type="number"
                      value={bayarNominal || ''}
                      placeholder="Contoh: 100000"
                      onChange={(e) => setBayarNominal(parseFloat(e.target.value) || 0)}
                      className="w-36 bg-white border border-black/20 rounded-xl px-3 py-1.5 text-right font-black text-sm outline-none"
                    />
                  </div>

                  <div className="flex gap-1 justify-end flex-wrap">
                    <button
                      type="button"
                      onClick={() => setBayarNominal(grandTotal)}
                      className="px-2 py-1 bg-white hover:bg-black/5 border rounded-lg text-[10px] font-bold"
                    >
                      Uang Pas
                    </button>
                    {[50000, 100000, 200000, 500000].map((nominal) => (
                      <button
                        type="button"
                        key={nominal}
                        onClick={() => setBayarNominal(nominal)}
                        className="px-2 py-1 bg-white hover:bg-black/5 border rounded-lg text-[10px] font-bold"
                      >
                        {nominal / 1000}k
                      </button>
                    ))}
                  </div>

                  <div className="flex justify-between items-center pt-1 border-t border-black/10">
                    <span className="font-bold text-black/70">Kembalian:</span>
                    <span
                      className={`font-black text-sm px-2 py-0.5 rounded-lg ${
                        kembalian < 0 ? 'bg-red-200 text-red-800' : 'bg-white text-emerald-800'
                      }`}
                    >
                      {formatRupiah(kembalian > 0 ? kembalian : 0)}
                    </span>
                  </div>
                </div>
              )
            )}

            {/* Order Summary & Final Checkout Button */}
            <div className="bg-[#F6F7FB] rounded-2xl p-3.5 space-y-1.5 text-xs">
              <div className="flex justify-between text-black/70">
                <span>Subtotal ({cart.length} item)</span>
                <span>{formatRupiah(subtotal)}</span>
              </div>
              {diskonRp > 0 && (
                <div className="flex justify-between text-red-600 font-bold">
                  <span>Diskon Uang Tunai</span>
                  <span>-{formatRupiah(diskonRp)}</span>
                </div>
              )}
              <div className="flex justify-between items-baseline pt-1.5 border-t border-black/10 font-black text-base text-[#0B1E3A]">
                <span>GRAND TOTAL</span>
                <span className="text-xl text-[#0B1E3A]">{formatRupiah(grandTotal)}</span>
              </div>
              {isDPMode && (
                <div className="pt-1.5 border-t border-dashed border-black/15 space-y-1">
                  <div className="flex justify-between font-bold text-emerald-700">
                    <span>DP / Uang Muka ({paymentMethod.toUpperCase()})</span>
                    <span>{formatRupiah(dpNominal)}</span>
                  </div>
                  <div className="flex justify-between font-black text-red-600 text-sm">
                    <span>SISA TAGIHAN (BELUM LUNAS)</span>
                    <span>{formatRupiah(sisaTagihan)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Save Transaction Button */}
            <button
              onClick={handleCheckout}
              disabled={isSaving || cart.length === 0}
              className={`w-full py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition shadow-md ${
                cart.length === 0
                  ? 'bg-black/10 text-black/30 cursor-not-allowed'
                  : 'bg-[#25D366] hover:bg-[#1ebe5a] text-white'
              }`}
            >
              <Check className="w-5 h-5 stroke-[3]" />
              {isSaving ? 'Menyimpan Transaksi...' : `SIMPAN & SYNC EXCEL (${formatRupiah(grandTotal)})`}
            </button>
          </div>
        </div>

        {/* Live Thermal Receipt Preview */}
        <ThermalReceipt
          transaction={previewTransaction}
          printerConfig={printerConfig}
          onOpenPrinterModal={onOpenPrinterModal}
          onShowToast={onShowToast}
        />
      </div>
    </div>
  );
};

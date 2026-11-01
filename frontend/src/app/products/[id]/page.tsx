 "use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ApiError, api, formatVND } from "@/lib/api";
import { MAX_QTY_PER_ITEM, MAX_TOPPINGS, type Size, itemUnitPrice, useCartStore } from "@/store/cart";

type SizeOption = { size: Size; surcharge: number };
type Topping = { id: number; name: string; price: number };
/** Response của GET /products/:id (api.md mục 6.2). Phụ thu size và topping lấy từ đây, không viết cứng. */
type ProductDetail = { id: number; name: string; description?: string | null; price: number; imageUrl: string; category: string; stock: number; inStock: boolean; sizes: SizeOption[]; toppings: Topping[] };

const FALLBACK_IMG = "/img/ca-phe-sua.jpg";

export default function ProductDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { data: product, isPending, error, refetch } = useQuery({
    queryKey: ["product", id],
    queryFn: () => api<ProductDetail>(`/products/${id}`),
    retry: (count, err) => !(err instanceof ApiError && err.status < 500) && count < 2,
  });

  if (isPending) return <DetailSkeleton />;
  if (error || !product) {
    const notFound = error instanceof ApiError && (error.status === 404 || error.status === 400);
    return <main className="mx-auto max-w-3xl px-5 py-16">
      <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800">
        <h1 className="text-lg font-bold">{notFound ? "Không tìm thấy sản phẩm" : "Không tải được sản phẩm"}</h1>
        <p className="mt-1 text-sm">{notFound ? "Sản phẩm không tồn tại hoặc đã ngừng bán." : error?.message}</p>
        {!notFound && <button onClick={() => refetch()} className="mt-4 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800">Thử lại</button>}
      </div>
      <Link href="/menu" className="mt-5 inline-block font-semibold text-amber-900 hover:underline">← Quay lại thực đơn</Link>
    </main>;
  }
  // key = id: đổi sang sản phẩm khác thì lựa chọn size/topping được đặt lại.
  return <ProductOptions key={product.id} product={product} />;
}

function ProductOptions({ product }: { product: ProductDetail }) {
  const addItem = useCartStore((s) => s.addItem);
  const [size, setSize] = useState<Size>(product.sizes[0]?.size ?? "S");
  const [selected, setSelected] = useState<number[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState<string | null>(null);

  const sizeOption = product.sizes.find((s) => s.size === size);
  const chosenToppings = product.toppings.filter((t) => selected.includes(t.id));
  // Công thức api.md mục 4.1, tính lại ngay mỗi lần đổi lựa chọn.
  const unitPrice = itemUnitPrice({ basePrice: product.price, sizeSurcharge: sizeOption?.surcharge ?? 0, toppings: chosenToppings });
  const maxQty = Math.max(1, Math.min(MAX_QTY_PER_ITEM, product.stock));
  const limitReached = selected.length >= MAX_TOPPINGS;

  function toggleTopping(toppingId: number) {
    setAdded(null);
    setSelected((current) =>
      current.includes(toppingId) ? current.filter((x) => x !== toppingId) : current.length >= MAX_TOPPINGS ? current : [...current, toppingId],
    );
  }

  function handleAdd() {
    const ok = addItem(
      { productId: product.id, name: product.name, imageUrl: product.imageUrl, basePrice: product.price, size, sizeSurcharge: sizeOption?.surcharge ?? 0, toppings: chosenToppings },
      quantity,
    );
    setAdded(ok ? `Đã thêm ${quantity} × ${product.name} (size ${size}) vào giỏ.` : "Giỏ hàng đã đủ 30 dòng món, hãy đặt bớt trước khi thêm.");
  }

  return <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
    <Link href="/menu" className="text-sm font-semibold text-amber-900 hover:underline">← Quay lại thực đơn</Link>
    <div className="mt-5 grid gap-8 rounded-3xl border border-stone-200 bg-white p-5 shadow-sm md:grid-cols-2 md:p-8">
      <div className="flex min-h-72 items-center justify-center overflow-hidden rounded-2xl bg-amber-50">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={product.imageUrl || FALLBACK_IMG} alt={product.name} className="h-full max-h-[420px] w-full object-cover" onError={(e) => { e.currentTarget.src = FALLBACK_IMG; }} />
      </div>

      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-amber-800">{product.category}</p>
        <h1 className="mt-2 text-3xl font-extrabold">{product.name}</h1>
        <p className="mt-1 text-sm text-stone-500">Giá gốc (size S): {formatVND(product.price)}</p>
        <p className="mt-3 leading-7 text-stone-600">{product.description || "Thức uống được pha chế tươi ngon tại BrewLite."}</p>
        <p className={`mt-2 text-sm font-medium ${product.inStock ? "text-emerald-700" : "text-red-600"}`}>{product.inStock ? `Còn ${product.stock} phần` : "Tạm hết hàng"}</p>

        <section className="mt-7" aria-labelledby="size-heading">
          <h2 id="size-heading" className="font-bold">Chọn size</h2>
          <div role="radiogroup" aria-labelledby="size-heading" className="mt-3 grid grid-cols-3 gap-3">
            {product.sizes.map((s) => <button key={s.size} type="button" role="radio" aria-checked={size === s.size} onClick={() => { setSize(s.size); setAdded(null); }}
              className={`rounded-xl border px-3 py-3 text-sm font-semibold transition ${size === s.size ? "border-amber-800 bg-amber-50 text-amber-900 ring-1 ring-amber-800" : "border-stone-200 hover:border-amber-500"}`}>
              <span className="block text-base">{s.size}</span>
              <span className="mt-1 block text-xs font-normal">{s.surcharge === 0 ? "Giá gốc" : `+${formatVND(s.surcharge)}`}</span>
            </button>)}
          </div>
        </section>

        {product.toppings.length > 0 && <section className="mt-7" aria-labelledby="topping-heading">
          <div className="flex items-center justify-between">
            <h2 id="topping-heading" className="font-bold">Topping <span className="font-normal text-stone-500">(tối đa {MAX_TOPPINGS})</span></h2>
            <span className={`text-xs ${limitReached ? "font-semibold text-amber-800" : "text-stone-500"}`}>{selected.length}/{MAX_TOPPINGS} đã chọn</span>
          </div>
          <div className="mt-3 space-y-2">
            {product.toppings.map((t) => {
              const checked = selected.includes(t.id);
              const disabled = !checked && limitReached;
              return <label key={t.id} className={`flex items-center justify-between rounded-xl border px-4 py-3 transition ${checked ? "border-amber-800 bg-amber-50" : "border-stone-200"} ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-stone-50"}`}>
                <span className="flex items-center gap-3">
                  <input type="checkbox" checked={checked} disabled={disabled} onChange={() => toggleTopping(t.id)} className="h-4 w-4 accent-amber-800" />
                  <span className="text-sm font-medium">{t.name}</span>
                </span>
                <span className="text-sm text-stone-600">+{formatVND(t.price)}</span>
              </label>;
            })}
          </div>
          {limitReached && <p className="mt-2 text-xs text-amber-800">Đã đủ {MAX_TOPPINGS} topping. Bỏ chọn một topping để đổi sang loại khác.</p>}
        </section>}

        <section className="mt-7 flex items-center justify-between" aria-label="Số lượng">
          <h2 className="font-bold">Số lượng</h2>
          <div className="flex items-center gap-3">
            <button type="button" aria-label="Giảm số lượng" onClick={() => setQuantity((q) => Math.max(1, q - 1))} disabled={quantity <= 1} className="h-9 w-9 rounded-lg border border-stone-300 text-lg disabled:opacity-40">−</button>
            <span className="w-6 text-center font-semibold" aria-live="polite">{quantity}</span>
            <button type="button" aria-label="Tăng số lượng" onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))} disabled={quantity >= maxQty} className="h-9 w-9 rounded-lg border border-stone-300 text-lg disabled:opacity-40">+</button>
          </div>
        </section>

        <div className="mt-7 border-t border-stone-200 pt-5">
          <dl className="space-y-1.5 text-sm text-stone-600">
            <div className="flex justify-between"><dt>Giá gốc</dt><dd>{formatVND(product.price)}</dd></div>
            <div className="flex justify-between"><dt>Phụ thu size {size}</dt><dd>+{formatVND(sizeOption?.surcharge ?? 0)}</dd></div>
            {chosenToppings.map((t) => <div key={t.id} className="flex justify-between"><dt>{t.name}</dt><dd>+{formatVND(t.price)}</dd></div>)}
            <div className="flex justify-between font-semibold text-stone-800"><dt>Giá 1 ly</dt><dd>{formatVND(unitPrice)}</dd></div>
          </dl>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-stone-600">Thành tiền ({quantity} ly)</span>
            <strong className="text-2xl text-amber-900" aria-live="polite">{formatVND(unitPrice * quantity)}</strong>
          </div>
          <p className="mt-2 text-xs leading-5 text-stone-500">Giá hiển thị là giá dự kiến. Backend sẽ tính lại giá chính thức khi tạo đơn.</p>
          <button disabled={!product.inStock} onClick={handleAdd} className="mt-5 w-full rounded-xl bg-amber-800 px-5 py-3.5 font-bold text-white hover:bg-amber-900 disabled:cursor-not-allowed disabled:bg-stone-300">
            {product.inStock ? "Thêm vào giỏ hàng" : "Sản phẩm tạm hết hàng"}
          </button>
          {added && <div role="status" className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <span>{added}</span>
            <Link href="/cart" className="font-semibold underline">Xem giỏ hàng →</Link>
          </div>}
        </div>
      </div>
    </div>
  </main>;
}

function DetailSkeleton() {
  return <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6" aria-busy="true" aria-label="Đang tải chi tiết sản phẩm">
    <div className="mt-9 grid animate-pulse gap-8 rounded-3xl border border-stone-200 bg-white p-5 md:grid-cols-2 md:p-8">
      <div className="h-72 rounded-2xl bg-stone-200" />
      <div className="space-y-4">
        <div className="h-4 w-24 rounded bg-stone-200" />
        <div className="h-8 w-2/3 rounded bg-stone-200" />
        <div className="h-16 rounded bg-stone-200" />
        <div className="grid grid-cols-3 gap-3"><div className="h-16 rounded-xl bg-stone-200" /><div className="h-16 rounded-xl bg-stone-200" /><div className="h-16 rounded-xl bg-stone-200" /></div>
        <div className="h-32 rounded-xl bg-stone-200" />
      </div>
    </div>
  </main>;
}

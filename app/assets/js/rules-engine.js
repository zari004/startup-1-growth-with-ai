// ============================================================
// Rules Engine — SKU ma'lumotidan muammolarni topib,
// Impact x Confidence / Effort formulasi bo'yicha skorlaydi.
// ============================================================
// Har bir qoida: shart (condition) + agar rost bo'lsa qanday
// action yaratish kerakligi (impact/confidence/effort qo'lda
// belgilangan — bular vaqt o'tishi bilan real natijalarga
// qarab sozlanadi, lekin hoziroq ishlaydigan boshlang'ich nuqta).

function num(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

export function evaluateSku(sku) {
  const actions = [];
  const price = num(sku.price);
  const cost = num(sku.cost);
  const stock = num(sku.stock);
  const competitorPrice = num(sku.competitor_price);
  const unanswered = num(sku.unanswered_reviews) || 0;

  // 1. Foyda past / manfiy (margin)
  if (price !== null && cost !== null) {
    const margin = price - cost;
    const marginPct = price > 0 ? (margin / price) * 100 : 0;
    if (margin <= 0) {
      actions.push(mkAction(sku, 'low_margin',
        `"${sku.name || sku.sku_code}" — zarar bilan sotilmoqda`,
        `Narx (${price}) tannarxdan (${cost}) past yoki teng. Narxni oshiring yoki tannarxni qayta ko'rib chiqing.`,
        5, 5, 2));
    } else if (marginPct < 10) {
      actions.push(mkAction(sku, 'low_margin',
        `"${sku.name || sku.sku_code}" — foyda juda past (${marginPct.toFixed(1)}%)`,
        `Joriy foyda atigi ${marginPct.toFixed(1)}%. Narxni 5-10% oshirishni yoki xarajatlarni qisqartirishni ko'rib chiqing.`,
        4, 4, 2));
    }
  }

  // 2. Stock tugagan / kam qolgan
  if (stock !== null) {
    if (stock <= 0) {
      actions.push(mkAction(sku, 'out_of_stock',
        `"${sku.name || sku.sku_code}" — ombordan tugagan`,
        `Stock = 0. Bu mahsulot ko'rinmay qoladi va sotuv yo'qotasiz. Zudlik bilan to'ldiring.`,
        5, 5, 3));
    } else if (stock <= 3) {
      actions.push(mkAction(sku, 'low_stock',
        `"${sku.name || sku.sku_code}" — stock kam qolgan (${stock} dona)`,
        `Tez orada tugashi mumkin. Ombor to'ldirishni rejalashtiring.`,
        3, 4, 2));
    }
  }

  // 3. Raqobatchidan qimmat
  if (price !== null && competitorPrice !== null && competitorPrice > 0) {
    const gapPct = ((price - competitorPrice) / competitorPrice) * 100;
    if (gapPct > 15) {
      actions.push(mkAction(sku, 'price_gap',
        `"${sku.name || sku.sku_code}" — raqobatchidan ${gapPct.toFixed(0)}% qimmat`,
        `Sizning narx ${price}, raqobatchida ${competitorPrice}. Bu sotuvni pasaytirishi mumkin — narxni solishtiring.`,
        4, 3, 2));
    }
  }

  // 4. Javobsiz sharhlar
  if (unanswered > 0) {
    actions.push(mkAction(sku, 'unanswered_review',
      `"${sku.name || sku.sku_code}" — ${unanswered} ta javobsiz sharh`,
      `Javobsiz sharhlar mijoz ishonchini pasaytiradi. Tezroq javob yozing.`,
      3, 5, 1));
  }

  return actions;
}

function mkAction(sku, type, title, description, impact, confidence, effort) {
  return {
    seller_id: sku.seller_id,
    sku_id: sku.id || null,
    type, title, description,
    impact, confidence, effort,
    score: Math.round(((impact * confidence) / Math.max(effort, 1)) * 100) / 100,
  };
}

// Bir nechta SKU uchun barcha action'larni yig'ib, eng yuqori
// skordan pastga saralab, Top-N ni qaytaradi.
export function buildTopActions(skus, topN = 5) {
  const all = skus.flatMap(evaluateSku);
  all.sort((a, b) => b.score - a.score);
  return { all, top: all.slice(0, topN) };
}

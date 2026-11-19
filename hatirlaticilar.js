"use strict";

/*
 * Hatırlatıcılar: hastanın kliniğe tekrar gelmesi gereken işler. Her satırda hazır mesajlı
 * WhatsApp düğmesi vardır. Menüdeki rozet, günü gelmiş ya da geçmiş bekleyenlerin sayısıdır.
 */

const hatirlaticilarSayfasi = document.getElementById("hatirlaticilar-sayfasi");
const hatirlaticiSuzgeci = document.getElementById("hatirlatici-suzgeci");
const hatirlaticiArama = document.getElementById("hatirlatici-arama");
const hatirlaticiRozeti = document.getElementById("hatirlatici-rozeti");

function hatirlaticiDurumYazisi(h) {
  if (h.tamamlandi) return el("span", { className: "durum yapildi" }, `Tamamlandı${h.tamamlanmaTarihi ? ` · ${tarihGoster(h.tamamlanmaTarihi)}` : ""}`);
  const bugun = bugununTarihi();
  if (h.tarih < bugun) return el("span", { className: "durum gecikti" }, "Gecikti");
  if (h.tarih === bugun) return el("span", { className: "durum bugun" }, "Bugün");
  return el("span", { className: "durum" }, "Bekliyor");
}

function hatirlaticiEylemleri(h) {
  const hasta = hastaBul(h.hasta);
  return el("td", { className: "eylem" },
    hasta ? whatsappDugmesi(hasta, hatirlaticiMesaji(h)) : null,
    h.tamamlandi
      ? ikonDugmesi(IKON_ZIL, "Yeniden beklemeye al", () => hatirlaticiDurumu(h, false))
      : ikonDugmesi(IKON_ONAY, "Tamamlandı (hasta geldi)", () => hatirlaticiDurumu(h, true)),
    ikonDugmesi(IKON_KALEM, "Düzelt", () => hatirlaticiPenceresiniAc({ hastaId: h.hasta, kayit: h })),
    ikonDugmesi(IKON_COP, "Sil", () => onaylaVeSil("hatirlaticilar", h, `"${h.konu}" hatırlatıcısı silinsin mi?`)),
  );
}

// Hasta hesabındaki hatırlatıcı bölümü (hesap.js çağırır)
function hastaHatirlaticilariniCiz(hasta) {
  const liste = hastaninHatirlaticilari(hasta.id)
    .sort((a, b) => Number(a.tamamlandi) - Number(b.tamamlandi) || tarihSirasi(a, b));
  tabloyuDoldur(document.getElementById("hasta-hatirlatici-satirlari"), document.getElementById("hasta-hatirlatici-bos"),
    liste.map((h) => el("tr", { className: h.tamamlandi ? "planlanan" : "" },
      el("td", { className: "tarih" }, tarihGoster(h.tarih)),
      el("td", null, h.konu),
      el("td", null, h.not || ""),
      el("td", null, hatirlaticiDurumYazisi(h)),
      hatirlaticiEylemleri(h),
    )));
}

function hatirlaticiRozetiniGuncelle() {
  const sayi = vadesiGelenSayisi();
  hatirlaticiRozeti.hidden = sayi === 0;
  hatirlaticiRozeti.textContent = String(sayi);
}

function hatirlaticilariCiz() {
  const bugun = bugununTarihi();
  const secim = hatirlaticiSuzgeci.value;
  const sinir = { hafta: gunEkle(bugun, 7), ay: gunEkle(bugun, 30) }[secim];
  const aranan = kucult(hatirlaticiArama.value);
  const gorunen = veri.hatirlaticilar.filter((h) => {
    if (secim === "tamam" ? !h.tamamlandi : h.tamamlandi) return false;
    if (secim === "gelen" && h.tarih > bugun) return false;
    if (sinir && h.tarih > sinir) return false;
    const hasta = hastaBul(h.hasta);
    return kucult(`${h.konu} ${h.not || ""} ${hasta ? `${hasta.hastaNo} ${tamAd(hasta)}` : ""} ${telefonu(h.hasta)}`).includes(aranan);
  }).sort((a, b) => (secim === "tamam" ? tarihSirasi(b, a) : tarihSirasi(a, b)));

  tabloyuDoldur(document.getElementById("hatirlatici-satirlari"), document.getElementById("hatirlatici-bos"),
    gorunen.map((h) => {
      const hasta = hastaBul(h.hasta);
      return el("tr", { className: !h.tamamlandi && h.tarih < bugun ? "gecikmis-satir" : "" },
        el("td", { className: "tarih" }, tarihGoster(h.tarih), el("br"), hatirlaticiDurumYazisi(h)),
        el("td", null, hasta ? el("a", { href: `#hasta/${hasta.id}` }, `${tamAd(hasta)} (${hasta.hastaNo})`) : "Silinmiş hasta"),
        hasta ? el("td", null, telefonu(hasta.id) ? telefonGoster(telefonu(hasta.id))
          : el("button", { type: "button", className: "dugme kucuk", onclick: () => telefonPenceresiniAc(hasta.id) }, "Telefon ekle")) : el("td"),
        el("td", null, h.konu),
        el("td", null, h.not || ""),
        hatirlaticiEylemleri(h),
      );
    }),
    {
      gelen: "Günü gelen hatırlatıcı yok.",
      hafta: "Önümüzdeki 7 günde hatırlatıcı yok.",
      ay: "Önümüzdeki 30 günde hatırlatıcı yok.",
      acik: "Bekleyen hatırlatıcı yok. Hatırlatıcılar hasta hesabından eklenir.",
      tamam: "Tamamlanan hatırlatıcı yok.",
    }[secim] + (aranan ? " (arama süzgeci açık)" : ""));

  const bekleyen = bekleyenHatirlaticilar();
  ozetKutulari(document.getElementById("hatirlatici-ozeti"), [
    { baslik: "Gecikmiş", deger: String(bekleyen.filter((h) => h.tarih < bugun).length), sinif: bekleyen.some((h) => h.tarih < bugun) ? "borc" : "" },
    { baslik: "Bugün", deger: String(bekleyen.filter((h) => h.tarih === bugun).length), sinif: "vurgu" },
    { baslik: "Önümüzdeki 7 gün", deger: String(bekleyen.filter((h) => h.tarih > bugun && h.tarih <= gunEkle(bugun, 7)).length) },
    { baslik: "Telefonu olmayan bekleyen", deger: String(bekleyen.filter((h) => !telefonu(h.hasta)).length),
      alt: "WhatsApp için telefon gerekir" },
  ]);
}

hatirlaticiSuzgeci.addEventListener("change", hatirlaticilariCiz);
hatirlaticiArama.addEventListener("input", hatirlaticilariCiz);

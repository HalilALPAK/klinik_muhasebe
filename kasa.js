"use strict";

/* Günlük kasa: seçilen günün tahsilatları ve giderleri, yönteme göre toplamlar */

const kasaSayfasi = document.getElementById("kasa-sayfasi");
const kasaTarihi = document.getElementById("kasa-tarihi");
kasaTarihi.value = bugununTarihi();

function kasayiCiz() {
  const gun = kasaTarihi.value || bugununTarihi();
  const tahsilatlar = veri.odemeler.filter((o) => o.tarih === gun).sort(tarihSirasi);
  const giderler = veri.giderler.filter((g) => g.tarih === gun).sort(tarihSirasi);

  const yontemToplami = (liste, yontem) => toplam(liste.filter((x) => x.yontem === yontem), (x) => x.tutar);
  const nakitGiris = yontemToplami(tahsilatlar, "nakit");
  const nakitCikis = yontemToplami(giderler, "nakit");
  ozetKutulari(document.getElementById("kasa-ozeti"), [
    { baslik: "Toplam tahsilat", deger: paraGoster(toplam(tahsilatlar, (o) => o.tutar)), alt: `${tahsilatlar.length} ödeme` },
    { baslik: "Toplam gider", deger: paraGoster(toplam(giderler, (g) => g.tutar)), alt: `${giderler.length} gider` },
    { baslik: "Nakit kasa (giriş − çıkış)", deger: paraGoster(nakitGiris - nakitCikis), sinif: "vurgu",
      alt: `Giriş ${paraGoster(nakitGiris)} · Çıkış ${paraGoster(nakitCikis)}` },
    { baslik: "Kart", deger: paraGoster(yontemToplami(tahsilatlar, "kart") - yontemToplami(giderler, "kart")) },
    { baslik: "Havale / EFT", deger: paraGoster(yontemToplami(tahsilatlar, "havale") - yontemToplami(giderler, "havale")) },
  ]);

  tabloyuDoldur(document.getElementById("kasa-tahsilat-satirlari"), document.getElementById("kasa-tahsilat-bos"),
    tahsilatlar.map((o) => {
      const hasta = hastaBul(o.hasta);
      return el("tr", null,
        el("td", null, hasta ? el("a", { href: `#hasta/${hasta.id}` }, `${tamAd(hasta)} (${hasta.hastaNo})`) : "Silinmiş hasta"),
        el("td", null, YONTEMLER[o.yontem] || o.yontem),
        el("td", null, o.aciklama || ""),
        el("td", { className: "sayi" }, paraGoster(o.tutar)),
      );
    }));

  tabloyuDoldur(document.getElementById("kasa-gider-satirlari"), document.getElementById("kasa-gider-bos"),
    giderler.map((g) => el("tr", null,
      el("td", null, KATEGORILER[g.kategori] || g.kategori),
      el("td", null, YONTEMLER[g.yontem] || g.yontem),
      el("td", null, g.aciklama || ""),
      el("td", { className: "sayi" }, paraGoster(g.tutar)),
      el("td", { className: "eylem" },
        ikonDugmesi(IKON_KALEM, "Düzelt", () => giderPenceresiniAc({ kayit: g })),
        ikonDugmesi(IKON_COP, "Sil", () => onaylaVeSil("giderler", g,
          `${KATEGORILER[g.kategori] || g.kategori} gideri (${paraGoster(g.tutar)}) silinsin mi?`))),
    )));
}

function kasaGunu(gun) {
  kasaTarihi.value = gun;
  kasayiCiz();
}

kasaTarihi.addEventListener("change", kasayiCiz);
document.getElementById("kasa-onceki").addEventListener("click", () => kasaGunu(gunEkle(kasaTarihi.value || bugununTarihi(), -1)));
document.getElementById("kasa-sonraki").addEventListener("click", () => kasaGunu(gunEkle(kasaTarihi.value || bugununTarihi(), 1)));
document.getElementById("kasa-bugun").addEventListener("click", () => kasaGunu(bugununTarihi()));
document.getElementById("gider-ekle").addEventListener("click", () => giderPenceresiniAc({ tarih: kasaTarihi.value || bugununTarihi() }));

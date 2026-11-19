"use strict";

/*
 * Ücret, ödeme, gider ve fiyat pencereleri. Kayıt başarısızsa pencere açık kalır,
 * kullanıcının yazdığı kaybolmaz; hata pencerenin altında yazar.
 */

const TUM_PENCERELER = [...document.querySelectorAll("dialog")];

// Kapanmamış ve içinde değişiklik olan pencere var mı (sayfadan çıkarken sorulur)
const acikFormDegisti = () => TUM_PENCERELER.some((p) => p.open && p.dataset.degisti === "1");

function pencereleriKapat() {
  TUM_PENCERELER.forEach((p) => p.open && p.close());
}

// Sunucunun 400 cevabındaki alan hatalarını okunur metne çevirir
function sunucuHatasiMetni(hata, alanAdlari = {}) {
  if (agHatasiMi(hata)) return "Sunucuya bağlanılamıyor. Bağlantı gelince tekrar Kaydet'e basın.";
  if (hata.status === 404) return "Bu kayıt başka bir bilgisayarda silinmiş.";
  const alanlar = Object.entries(hata.response?.data || {});
  if (alanlar.length) {
    return alanlar.map(([alan, a]) => `${alanAdlari[alan] || alan}: ${a.code === "validation_not_unique" ? "zaten kayıtlı" : a.message}`).join(" · ");
  }
  return `Kaydedilemedi: ${hata.message}`;
}

/*
 * Ortak pencere davranışı. kur.kaydet(form) kaydı yapar; doğrulama hatasında
 * string atarsa o metin gösterilir. Başarılıysa pencere kapanır.
 */
function pencereKur(pencere, kur) {
  const form = pencere.querySelector("form");
  const mesaj = pencere.querySelector(".pencere-mesaji");
  const kaydetDugmesi = form.querySelector('button[type="submit"]');

  form.addEventListener("input", () => {
    pencere.dataset.degisti = "1";
    mesaj.textContent = "";
  });
  form.querySelector(".vazgec").addEventListener("click", () => {
    if (pencere.dataset.degisti === "1" && !confirm("Yazdıklarınız kaydedilmeyecek. Kapatılsın mı?")) return;
    pencere.close();
  });
  pencere.addEventListener("cancel", (olay) => {
    if (pencere.dataset.degisti === "1" && !confirm("Yazdıklarınız kaydedilmeyecek. Kapatılsın mı?")) olay.preventDefault();
  });

  form.addEventListener("submit", async (olay) => {
    olay.preventDefault();
    if (kaydetDugmesi.disabled) return;
    kaydetDugmesi.disabled = true;
    mesaj.textContent = "Kaydediliyor...";
    try {
      await kur.kaydet(form);
      pencere.dataset.degisti = "0";
      pencere.close();
    } catch (hata) {
      if (typeof hata === "string") mesaj.textContent = hata;
      else if (hata && hata.message === "oturum yok") mesaj.textContent = "";
      else mesaj.textContent = sunucuHatasiMetni(hata, kur.alanAdlari);
    } finally {
      kaydetDugmesi.disabled = false;
    }
  });

  return {
    form,
    ac(baslik) {
      pencere.querySelector("h2").textContent = baslik;
      mesaj.textContent = "";
      pencere.dataset.degisti = "0";
      pencere.showModal();
    },
  };
}

// 400 cevabında benzersizlik ihlali var mı (aynı işlem iki kez, aynı tedavi adı iki kez)
const benzersizHatasiMi = (hata) => hata && hata.status === 400
  && Object.values(hata.response?.data || {}).some((a) => a && a.code === "validation_not_unique");

// Sunucuya yazar; benzersizlik ihlalinde verilen metni gösterir
async function benzersizKaydet(koleksiyon, id, alanlar, metin) {
  try {
    await kaydet(koleksiyon, id, alanlar);
  } catch (hata) {
    if (benzersizHatasiMi(hata)) throw metin;
    throw hata;
  }
}

function tutarOku(kutu, ad, { sifirOlabilir = false } = {}) {
  const deger = paraOku(kutu.value);
  if (deger === null) throw `${ad} geçersiz. Örnek: 1.250,50`;
  if (!sifirOlabilir && deger <= 0) throw `${ad} sıfırdan büyük olmalı.`;
  return deger;
}

function tarihOku(kutu) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(kutu.value)) throw "Tarih seçin.";
  return kutu.value;
}

function onerileriDoldur() {
  const doldur = (id, adlar) => document.getElementById(id).replaceChildren(...adlar.map((ad) => el("option", { value: ad })));
  doldur("tedavi-onerileri", bilinenTedaviler());
  doldur("doktor-onerileri", bilinenDoktorlar());
}

/* Ücret (tahakkuk) */

const ucretPenceresi = document.getElementById("ucret-penceresi");
const ucretIslemNotu = document.getElementById("ucret-islem");
const ucretNet = document.getElementById("ucret-net");
let ucretBaglami = null; // { hastaId, islem, kayit }

const ucret = pencereKur(ucretPenceresi, {
  alanAdlari: { islemId: "Bu işlem", tutar: "Tutar", indirim: "İndirim", aciklama: "Açıklama", tarih: "Tarih" },
  async kaydet(form) {
    const { hastaId, islem, kayit } = ucretBaglami;
    const e = form.elements;
    const tarih = tarihOku(e.tarih);
    const aciklama = e.aciklama.value.trim();
    if (!aciklama) throw "Açıklama yazın.";
    const tutar = tutarOku(e.tutar, "Tutar");
    const indirim = tutarOku(e.indirim, "İndirim", { sifirOlabilir: true });
    if (indirim >= tutar) throw "İndirim tutardan küçük olmalı.";
    const islemId = kayit ? kayit.islemId : islem ? islem.id : "";
    if (islemId && veri.tahakkuklar.some((t) => t.hasta === hastaId && t.islemId === islemId && t.id !== kayit?.id)) {
      throw "Bu işlem zaten ücretlendirilmiş (başka bir bilgisayardan olabilir).";
    }
    const alanlar = { tarih, aciklama, doktor: e.doktor.value.trim(), tutar, indirim };
    if (!kayit) Object.assign(alanlar, { hasta: hastaId, islemId, disler: islem ? islem.disler || [] : [] });
    await benzersizKaydet("tahakkuklar", kayit?.id, alanlar, "Bu işlem zaten ücretlendirilmiş (başka bir bilgisayardan olabilir).");
  },
});

function ucretNetiniGoster() {
  const e = ucret.form.elements;
  const tutar = paraOku(e.tutar.value);
  const indirim = paraOku(e.indirim.value);
  ucretNet.textContent = tutar === null || indirim === null ? "-" : paraGoster(tutar - indirim);
}

// Adet ya da birim fiyat değişince tutar hesaplanır; tutar elle de yazılabilir
function ucretTutariniHesapla() {
  const e = ucret.form.elements;
  const birim = paraOku(e.birim.value);
  const adet = Math.max(1, Math.floor(Number(e.adet.value) || 1));
  if (birim) e.tutar.value = paraYaz(birim * adet);
  ucretNetiniGoster();
}

ucret.form.elements.adet.addEventListener("input", ucretTutariniHesapla);
ucret.form.elements.birim.addEventListener("input", ucretTutariniHesapla);
ucret.form.elements.tutar.addEventListener("input", ucretNetiniGoster);
ucret.form.elements.indirim.addEventListener("input", ucretNetiniGoster);

// islem: paneldeki işlem (ücretlendirilecek), kayit: düzeltilecek tahakkuk; ikisi de yoksa serbest ücret
function ucretPenceresiniAc({ hastaId, islem = null, kayit = null }) {
  ucretBaglami = { hastaId, islem, kayit };
  onerileriDoldur();
  const e = ucret.form.elements;
  ucret.form.reset();
  if (kayit) {
    e.tarih.value = kayit.tarih;
    e.aciklama.value = kayit.aciklama;
    e.doktor.value = kayit.doktor || "";
    e.tutar.value = paraYaz(kayit.tutar);
    e.indirim.value = paraYaz(kayit.indirim || 0);
  } else if (islem) {
    const fiyat = fiyatBul(islem.tedavi);
    const adet = Math.max(1, (islem.disler || []).length);
    e.tarih.value = islem.yapilmaTarihi || bugununTarihi();
    e.aciklama.value = islem.tedavi + ((islem.disler || []).length ? ` (${islem.disler.join(", ")})` : "");
    e.doktor.value = islem.doktor || "";
    e.adet.value = adet;
    e.birim.value = fiyat ? paraYaz(fiyat.fiyat) : "";
    e.tutar.value = fiyat ? paraYaz(fiyat.fiyat * adet) : "";
  } else {
    e.tarih.value = bugununTarihi();
  }
  const ilgili = kayit && kayit.islemId ? hastaninIslemleri(hastaBul(kayit.hasta)).find((i) => i.id === kayit.islemId) : islem;
  ucretIslemNotu.hidden = !ilgili && !(kayit && kayit.islemId);
  ucretIslemNotu.textContent = ilgili
    ? `Paneldeki işlem: ${ilgili.tedavi}${(ilgili.disler || []).length ? ` · Dişler: ${ilgili.disler.join(", ")}` : ""}${ilgili.yapildi ? "" : " · henüz yapılmadı"}`
    : "Bağlı olduğu işlem panelde silinmiş.";
  ucretNetiniGoster();
  ucret.ac(kayit ? "Ücreti Düzelt" : islem ? "İşlemi Ücretlendir" : "Ücret Ekle");
  (islem && !e.tutar.value ? e.birim : e.aciklama).focus();
}

/* Ödeme */

let odemeBaglami = null; // { hastaId, kayit }

const odeme = pencereKur(document.getElementById("odeme-penceresi"), {
  alanAdlari: { tutar: "Tutar", yontem: "Yöntem", tarih: "Tarih" },
  async kaydet(form) {
    const { hastaId, kayit } = odemeBaglami;
    const e = form.elements;
    const alanlar = {
      tarih: tarihOku(e.tarih),
      tutar: tutarOku(e.tutar, "Tutar"),
      yontem: e.yontem.value,
      aciklama: e.aciklama.value.trim(),
    };
    if (!kayit) alanlar.hasta = hastaId;
    await kaydet("odemeler", kayit?.id, alanlar);
  },
});

function odemePenceresiniAc({ hastaId, kayit = null }) {
  odemeBaglami = { hastaId, kayit };
  const e = odeme.form.elements;
  odeme.form.reset();
  e.tarih.value = kayit ? kayit.tarih : bugununTarihi();
  if (kayit) {
    e.tutar.value = paraYaz(kayit.tutar);
    e.yontem.value = kayit.yontem;
    e.aciklama.value = kayit.aciklama || "";
  }
  const hasta = hastaBul(hastaId);
  odeme.ac(`${kayit ? "Ödemeyi Düzelt" : "Ödeme Al"}${hasta ? ` · ${tamAd(hasta)}` : ""}`);
  e.tutar.focus();
}

/* Gider */

let giderBaglami = null; // { kayit }
const giderKategoriKutusu = document.querySelector("#gider-formu select[name=kategori]");
giderKategoriKutusu.append(...Object.entries(KATEGORILER).map(([deger, ad]) => el("option", { value: deger }, ad)));

const gider = pencereKur(document.getElementById("gider-penceresi"), {
  alanAdlari: { tutar: "Tutar", kategori: "Kategori", yontem: "Yöntem", tarih: "Tarih" },
  async kaydet(form) {
    const e = form.elements;
    await kaydet("giderler", giderBaglami.kayit?.id, {
      tarih: tarihOku(e.tarih),
      kategori: e.kategori.value,
      tutar: tutarOku(e.tutar, "Tutar"),
      yontem: e.yontem.value,
      aciklama: e.aciklama.value.trim(),
    });
  },
});

function giderPenceresiniAc({ kayit = null, tarih = bugununTarihi() } = {}) {
  giderBaglami = { kayit };
  const e = gider.form.elements;
  gider.form.reset();
  e.tarih.value = kayit ? kayit.tarih : tarih;
  if (kayit) {
    e.kategori.value = kayit.kategori;
    e.tutar.value = paraYaz(kayit.tutar);
    e.yontem.value = kayit.yontem;
    e.aciklama.value = kayit.aciklama || "";
  }
  gider.ac(kayit ? "Gideri Düzelt" : "Gider Ekle");
  e.tutar.focus();
}

/* Fiyat */

let fiyatBaglami = null; // { kayit }

const fiyat = pencereKur(document.getElementById("fiyat-penceresi"), {
  alanAdlari: { tedavi: "Tedavi adı", fiyat: "Fiyat" },
  async kaydet(form) {
    const { kayit } = fiyatBaglami;
    const e = form.elements;
    const tedavi = e.tedavi.value.trim().replace(/\s+/g, " ");
    if (!tedavi) throw "Tedavi adını yazın.";
    if (veri.fiyatlar.some((f) => f.id !== kayit?.id && kucult(f.tedavi) === kucult(tedavi))) {
      throw "Bu tedavinin fiyatı zaten listede; onu düzeltin.";
    }
    await benzersizKaydet("fiyatlar", kayit?.id, { tedavi, fiyat: tutarOku(e.fiyat, "Fiyat"), aktif: e.aktif.checked },
      "Bu tedavinin fiyatı zaten listede; onu düzeltin.");
  },
});

function fiyatPenceresiniAc({ kayit = null, tedavi = "" } = {}) {
  fiyatBaglami = { kayit };
  onerileriDoldur();
  const e = fiyat.form.elements;
  fiyat.form.reset();
  e.tedavi.value = kayit ? kayit.tedavi : tedavi;
  e.fiyat.value = kayit ? paraYaz(kayit.fiyat) : "";
  e.aktif.checked = kayit ? kayit.aktif : true;
  fiyat.ac(kayit ? "Fiyatı Düzelt" : "Fiyat Ekle");
  (e.tedavi.value ? e.fiyat : e.tedavi).focus();
}

// Silmeden önce sorar; hata olursa bildirir
async function onaylaVeSil(koleksiyon, kayit, soru) {
  if (!confirm(soru)) return;
  try {
    await sil(koleksiyon, kayit.id);
  } catch (hata) {
    if (!genelHatayiIsle(hata) && hata.message !== "oturum yok") bildir(`Silinemedi: ${hata.message}`);
  }
}

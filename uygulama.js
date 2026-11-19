"use strict";

/* Giriş, yönlendirme ve açılış. Sayfayı başlatan dosya; en son yüklenir. */

const girisSayfasi = document.getElementById("giris-sayfasi");
const girisFormu = document.getElementById("giris-formu");
const girisMesaji = document.getElementById("giris-mesaji");
const uygulamaKabi = document.getElementById("uygulama");
const EKRANLAR = {
  hastalar: { sayfa: hastalarSayfasi, ciz: hastalariCiz },
  hesap: { sayfa: hesapSayfasi, ciz: hesabiCiz },
  hatirlaticilar: { sayfa: hatirlaticilarSayfasi, ciz: hatirlaticilariCiz },
  kasa: { sayfa: kasaSayfasi, ciz: kasayiCiz },
  raporlar: { sayfa: raporlarSayfasi, ciz: raporlariCiz },
  fiyatlar: { sayfa: fiyatlarSayfasi, ciz: fiyatlariCiz },
};
let acikEkran = null;

function ekranGoster(ad) {
  const degisti = acikEkran !== ad;
  acikEkran = ad;
  for (const [ekranAdi, { sayfa }] of Object.entries(EKRANLAR)) sayfa.hidden = ekranAdi !== ad;
  const menu = ad === "hesap" ? "hastalar" : ad;
  document.querySelectorAll(".ana-menu a").forEach((a) => a.classList.toggle("secili", a.dataset.menu === menu));
  EKRANLAR[ad].ciz();
  hatirlaticiRozetiniGuncelle();
  if (degisti) window.scrollTo(0, 0);
}

function yonlendir() {
  if (!pb || !pb.authStore.isValid || uygulamaKabi.hidden) return;
  const hesap = location.hash.match(/^#hasta\/([a-z0-9]+)$/);
  if (hesap) {
    if (hesabiAc(hesap[1])) ekranGoster("hesap");
    return;
  }
  acikHesapId = null;
  const ad = location.hash.slice(1);
  ekranGoster(["hatirlaticilar", "kasa", "raporlar", "fiyatlar"].includes(ad) ? ad : "hastalar");
}

// Veri değişince (kendi kaydımız ya da başka bilgisayar) açık ekran yeniden çizilir.
// Açık pencereler (formlar) bundan etkilenmez.
let cizimBekliyor = false;
veriDegistiIsleyicisi = () => {
  if (cizimBekliyor) return;
  cizimBekliyor = true;
  requestAnimationFrame(() => {
    cizimBekliyor = false;
    if (!acikEkran || uygulamaKabi.hidden) return;
    if (acikEkran === "hesap" && !hastaBul(acikHesapId)) {
      bildir("Açık olan hasta kaydı sunucudan silindi.");
      location.hash = "";
      return;
    }
    EKRANLAR[acikEkran].ciz();
    hatirlaticiRozetiniGuncelle();
  });
};

/* Oturum */

function girisEkraniniGoster(mesaj = "") {
  uygulamaKabi.hidden = true;
  girisMesaji.textContent = mesaj;
  girisFormu.elements.beniHatirla.checked = beniHatirlaSecimi();
  girisSayfasi.hidden = false;
  girisFormu.elements.eposta.focus();
}

function oturumuBitir(mesaj) {
  oturumuKapat();
  veriyiBosalt();
  acikEkran = null;
  pencereleriKapat();
  girisEkraniniGoster(mesaj);
}

async function yenidenBaglandi() {
  try {
    await veriyiYukle();
  } catch {
    return;
  }
  veriDegistiIsleyicisi();
}

async function oturumuAc() {
  const k = kullanici();
  document.getElementById("kullanici-adi").textContent = `${k.name || k.email}${k.rol ? ` (${k.rol})` : ""}`;
  try {
    await veriyiYukle();
    await anlikGuncellemeleriBaslat(KOLEKSIYONLAR, anlikOlay, yenidenBaglandi);
  } catch (hata) {
    let mesaj = "";
    if (hata && hata.status === 404) mesaj = "Sunucuda muhasebe tabloları yok. Sunucudaki kurulum yapılmalı (SUNUCU-MUHASEBE.md).";
    else if (!genelHatayiIsle(hata) && hata.message !== "oturum yok") mesaj = `Sunucudan veri alınamadı: ${hata.message}`;
    if (mesaj && uygulamaKabi.hidden) {
      girisSayfasi.hidden = false;
      girisMesaji.textContent = mesaj;
    } else if (mesaj) bildir(mesaj);
    return;
  }
  girisSayfasi.hidden = true;
  uygulamaKabi.hidden = false;
  acikEkran = null;
  yonlendir();
}

async function uygulamayiBaslat() {
  if (!pb) {
    document.body.replaceChildren(el("p", { className: "kart dosyadan-acildi" },
      "Muhasebe klinik sunucusunun adresinden açılır: http://<sunucu>:8091/muhasebe/"));
    return;
  }
  if (!pb.authStore.isValid) {
    girisEkraniniGoster();
    return;
  }
  try {
    await pb.collection("users").authRefresh();
  } catch (hata) {
    if (agHatasiMi(hata)) baglantiSorunu(true);
    else girisEkraniniGoster("Oturumun süresi doldu. Lütfen yeniden giriş yapın.");
    return;
  }
  await oturumuAc();
}

oturumBittiIsleyicisi = oturumuBitir;
yenidenDeneIsleyicisi = () => (uygulamaKabi.hidden ? uygulamayiBaslat() : yenidenBaglandi());

girisFormu.addEventListener("submit", async (olay) => {
  olay.preventDefault();
  const dugme = girisFormu.querySelector('button[type="submit"]');
  dugme.disabled = true;
  girisMesaji.textContent = "Giriş yapılıyor...";
  try {
    const beniHatirla = girisFormu.elements.beniHatirla.checked;
    await girisYap(girisFormu.elements.eposta.value.trim(), girisFormu.elements.sifre.value, beniHatirla);
    girisFormu.reset();
    girisFormu.elements.beniHatirla.checked = beniHatirla;
    girisMesaji.textContent = "";
    await oturumuAc();
  } catch (hata) {
    girisMesaji.textContent = agHatasiMi(hata) ? "Sunucuya bağlanılamıyor." : "E-posta veya şifre hatalı.";
  } finally {
    dugme.disabled = false;
  }
});

document.getElementById("cikis-dugmesi").addEventListener("click", () => {
  if (acikFormDegisti() && !confirm("Kaydedilmemiş değişiklikler silinecek. Çıkış yapılsın mı?")) return;
  oturumuBitir("");
});

window.addEventListener("hashchange", yonlendir);

// Uygulama gün boyu açık kalır; gün dönünce "bugün"e bağlı ekranlar tazelenir
let sonGun = bugununTarihi();
setInterval(() => {
  if (bugununTarihi() === sonGun) return;
  sonGun = bugununTarihi();
  veriDegistiIsleyicisi();
}, 60 * 1000);
window.addEventListener("beforeunload", (olay) => {
  if (acikFormDegisti()) olay.preventDefault();
});

uygulamayiBaslat();

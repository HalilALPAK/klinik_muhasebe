# Alpotech Klinik Muhasebe

Diş kliniği için muhasebe uygulaması. Şunları yapar:
- **hasta borç/ödeme takibi:** paneldeki işlemleri ücretlendirme, ödeme alma, yürüyen bakiyeli hesap dökümü, ekstre yazdırma;
- **fiyat listesi:** tedavi adına göre diş başına fiyat;
- **kasa / gider:** günlük tahsilat ve giderler, ödeme yöntemine göre toplamlar;
- **raporlar:** dönem toplamları, doktora göre ciro, kategoriye göre gider, aylık özet, borçlu hastalar.

Klinik panelinden ([Klinik_app](https://github.com/HalilALPAK/Klinik_app)) ayrı bir uygulamadır ama aynı PocketBase sunucusunu ve aynı hasta kayıtlarını kullanır.

- Sunucu ile sözleşme: [SUNUCU-MUHASEBE.md](SUNUCU-MUHASEBE.md). Tablolar, kurallar ve göç taslağı oradadır.
- Panelin sözleşmesi: `Klinik_app/SUNUCU-BAGLANTISI.md`. O geçerlidir.

## Mimari

- **Adres:** Uygulama sunucuda `pb_public/muhasebe/` klasöründen yayınlanır ve `http://<sunucu>:8091/muhasebe/` adresinden açılır.
  - API adresi `location.origin` olur; kodda IP yoktur.
  - Panelle aynı adreste olduğu için oturum ortaktır: panelde giriş yapan muhasebeye de girişli gelir.
  - Üst çubuktaki "Klinik Paneli" düğmesi panele, hesap sayfasındaki "Panelde aç" düğmesi o hastanın panel sayfasına gider.
- **Hastalar salt okunur:** Muhasebe `hastalar` tablosunu yalnızca okur. Hasta ekleme, düzeltme ve işlem girme panelde yapılır.
- **Veri yalnızca sunucuda:** Tarayıcıda yalnızca oturum anahtarı ve "Beni hatırla" seçimi tutulur (panelle aynı anahtarlar).
- **Anlık güncelleme:** Beş tabloya abonelik vardır. Başka bilgisayarda yapılan değişiklik açık ekrana hemen yansır. Açık bir pencere (form) bundan etkilenmez.
- **Sunucu kapalıysa:** Kırmızı bant çıkar ve kayıt yapılmaz. Pencere açık kalır, yazılan kaybolmaz; bağlantı gelince tekrar "Kaydet"e basılır.
- **Yetki:** Rol ayrımı yok. Doktor ve sekreter her ekranı görür, her kaydı ekler, düzeltir ve siler; silmeden önce onay sorulur.

## Para ve hesaplama

- **Tutarlar** sunucuda **kuruş cinsinden tam sayı** olarak saklanır. Ekranda `1.250,50 ₺` biçiminde gösterilir.
- **Tutar yazımı:** Kutulara `1.250,50`, `1250,5`, `1250.50` ya da `1.250` yazılabilir (`ortak.js` → `paraOku`).
- **Hastanın borcu:** `Σ(ücret − indirim) − Σ ödeme`.
  - Bakiye saklanmaz, her seferinde hesaplanır.
  - Eksiye düşerse "Avans (fazla ödeme)" olarak gösterilir.
- **Ücretlendirme:** Paneldeki her işlem en fazla bir kez ücretlendirilir (`tahakkuklar.islemId`).
  - Fiyat, tedavi adıyla fiyat listesinden bulunur. Eşleşme Türkçe küçük harfle yapılır ve `ı` = `i` sayılır.
  - Önerilen tutar fiyat × diş sayısıdır (diş yoksa 1). Tutar ve adet pencerede değiştirilebilir.
- **Planlanan işlemler:** Hesap sayfasında listelenir, liste fiyatıyla tahmini tutarları gösterilir. İstenirse yapılmadan önce de ücretlendirilebilir.
- **Nakit kasa:** O günün nakit tahsilatı eksi nakit giderleri. Kart ve havale ayrı gösterilir.

## Dosyalar

| Dosya | Görevi |
|---|---|
| `index.html` | Tüm ekranlar ve pencereler |
| `stil.css` | Görünüm; renkler panelle aynı. Ekstre ve rapor için yazdırma stili |
| `vendor/pocketbase.umd.js` | PocketBase JS SDK 0.28.2 (MIT, lisans `vendor/pocketbase-LICENSE.md`), panelden kopya |
| `sunucu.js` | SDK istemcisi, "Beni hatırla" oturum deposu, bağlantı bandı, hata yönetimi, anlık abonelik. Panelin `sunucu.js`'inden uyarlandı |
| `ortak.js` | Para (`paraOku`, `paraGoster`), tarih, metin ve küçük DOM yardımcıları |
| `veri.js` | Beş tablonun bellekteki kopyası; yükleme, anlık olaylar, kaydet/sil, bakiye hesapları |
| `pencereler.js` | Ücret, ödeme, gider ve fiyat pencereleri |
| `hastalar.js` | Hasta hesapları listesi ve genel özet |
| `hesap.js` | Bir hastanın hesabı: ücretlendirilmemiş işlemler, döküm, ekstre |
| `kasa.js`, `raporlar.js`, `fiyatlar.js` | İlgili ekranlar |
| `uygulama.js` | Giriş, yönlendirme (`#`, `#hasta/<id>`, `#kasa`, `#raporlar`, `#fiyatlar`), açılış. En son yüklenir |

Derleme adımı yoktur. Betikler `index.html` sonundaki sırayla yüklenir ve ortak üst düzey adları paylaşır.

## Geliştirme ve deneme

- **Yerel çalıştırma:** PocketBase v0.40.6, `3_muhasebe.js` göçüyle çalıştırılır.
  - Panel klasörü `--publicDir` olarak verilir, bu klasör de onun içine `muhasebe/` adıyla kopyalanır (ya da bağlanır).
  - Uygulama `http://127.0.0.1:8091/muhasebe/` adresinden açılır.
- **Dosyadan açılış:** `index.html` dosyadan (`file://`) açılırsa uygulama çalışmaz, yalnızca sunucu adresini söyler.
- **Bu sürümün denenmesi:** Sözleşmeyi taklit eden bir test sunucusu ve Playwright ile iki oturumda yapıldı (60/60). Ayrıntı SUNUCU-MUHASEBE.md §4'te. Gerçek PocketBase ile deneme sunucuda yapılmalı (§6).

## Gizlilik

Depoya **gerçek hasta verisi, tutar, ekstre, rapor çıktısı, şifre ya da anahtar eklenmemeli**. Örneklerdeki ad ve tutarlar uydurmadır.

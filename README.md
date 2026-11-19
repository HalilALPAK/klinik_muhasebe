# Alpotech Klinik Muhasebe

Diş kliniği için muhasebe uygulaması. Şunları yapar:
- **hasta borç/ödeme takibi:** paneldeki işlemleri ücretlendirme, ödeme alma, yürüyen bakiyeli hesap dökümü, ekstre yazdırma;
- **telefon ve WhatsApp:** hastanın telefonu yalnızca burada girilir; her hastada WhatsApp düğmesi sohbeti açar;
- **hatırlatıcılar:** hastanın kliniğe tekrar gelmesi gereken işler (kontrol, devam seansı); günü gelenler menüde rozetle görünür, hazır mesajla WhatsApp'tan yazılır;
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
- **Telefon yalnızca burada:** Telefon `hastalar`'a değil muhasebeye ait `iletisim` tablosuna yazılır; klinik panelinde görünmez.
- **Veri yalnızca sunucuda:** Tarayıcıda yalnızca oturum anahtarı ve "Beni hatırla" seçimi tutulur (panelle aynı anahtarlar).
- **Anlık güncelleme:** Yedi tabloya abonelik vardır. Başka bilgisayarda yapılan değişiklik açık ekrana hemen yansır. Açık bir pencere (form) bundan etkilenmez.
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

## Telefon, WhatsApp ve hatırlatıcılar

**Telefon**
- **Nereden girilir:** Hasta hesabının başlığındaki "+ Telefon ekle" düğmesinden, telefonsuz hastanın gri WhatsApp simgesinden ya da hatırlatıcı ekranındaki "Telefon ekle" düğmesinden.
- **Yazım:** `0532 123 45 67`, `532 123 4567` ve `+90 532 …` aynı numara sayılır. Yurt dışı numarası `+` ile yazılır. Silmek için kutu boş bırakılır.
- **Liste:** Hasta listesinde TC'nin yanındaki sütunda görünür. Arama kutusu numarayla da arar.

**WhatsApp**
- **Nerede:** Hasta listesindeki, hasta hesabının başlığındaki ve her hatırlatıcıdaki yeşil simge.
- **Ne yapar:** Hastanın sohbetini `wa.me` ile yeni pencerede açar.
  - Hatırlatıcıdan açılınca mesaj hazır yazılı gelir; gönderilmeden önce değiştirilebilir. Otomatik gönderim yok.
  - Telefonu girilmemiş hastada simge gridir; tıklanınca telefon penceresi açılır.
- **Gerekenler:** Tıklanan bilgisayarda internet ve kliniğin numarasıyla girişli WhatsApp (masaüstü ya da Web) olmalı.

**Hatırlatıcılar**
- **Kurma:** Hasta hesabındaki "Hatırlatıcılar" bölümünden ya da planlanan bir işlemin yanındaki "Hatırlatıcı" düğmesinden kurulur.
  - Planlanan işlemden kurulunca konu işlemden gelir.
  - Tarih için "1 hafta / 2 hafta / 1 ay / 3 ay / 6 ay / 1 yıl" hızlı düğmeleri vardır.
- **"Hatırlatıcılar" ekranı:** Günü gelen ve geçenleri listeler; süzgeçle önümüzdeki 7/30 gün, tüm bekleyenler ve tamamlananlar da görülür.
  - Menüdeki kırmızı rozet, günü gelmiş ya da geçmiş bekleyenlerin sayısıdır.
- **Tamamlama:** Hasta gelince ✓ ile "Tamamlandı" yapılır, gerekirse geri alınır.
- **Gün dönümü:** Uygulama gece açık kalırsa gün dönünce "Bugün / Gecikti" etiketleri ve rozet kendiliğinden tazelenir.

## Dosyalar

| Dosya | Görevi |
|---|---|
| `index.html` | Tüm ekranlar ve pencereler |
| `stil.css` | Görünüm; renkler panelle aynı. Ekstre ve rapor için yazdırma stili |
| `vendor/pocketbase.umd.js` | PocketBase JS SDK 0.28.2 (MIT, lisans `vendor/pocketbase-LICENSE.md`), panelden kopya |
| `sunucu.js` | SDK istemcisi, "Beni hatırla" oturum deposu, bağlantı bandı, hata yönetimi, anlık abonelik. Panelin `sunucu.js`'inden uyarlandı |
| `ortak.js` | Para (`paraOku`, `paraGoster`), tarih, metin ve küçük DOM yardımcıları |
| `veri.js` | Yedi tablonun bellekteki kopyası; yükleme, anlık olaylar, kaydet/sil, bakiye hesapları, telefon biçimi (`telefonOku`, `telefonGoster`) |
| `pencereler.js` | Ücret, ödeme, gider, fiyat, telefon ve hatırlatıcı pencereleri; hatırlatıcı WhatsApp mesajı |
| `hatirlaticilar.js` | Hatırlatıcılar ekranı, hasta hesabındaki hatırlatıcı bölümü, menü rozeti |
| `hastalar.js` | Hasta hesapları listesi ve genel özet |
| `hesap.js` | Bir hastanın hesabı: ücretlendirilmemiş işlemler, döküm, ekstre |
| `kasa.js`, `raporlar.js`, `fiyatlar.js` | İlgili ekranlar |
| `uygulama.js` | Giriş, yönlendirme (`#`, `#hasta/<id>`, `#hatirlaticilar`, `#kasa`, `#raporlar`, `#fiyatlar`), açılış. En son yüklenir |

Derleme adımı yoktur. Betikler `index.html` sonundaki sırayla yüklenir ve ortak üst düzey adları paylaşır.

## Geliştirme ve deneme

- **Yerel çalıştırma:** PocketBase v0.40.6, `3_muhasebe.js` ve `4_muhasebe_iletisim.js` göçleriyle çalıştırılır.
  - Panel klasörü `--publicDir` olarak verilir, bu klasör de onun içine `muhasebe/` adıyla kopyalanır (ya da bağlanır).
  - Uygulama `http://127.0.0.1:8091/muhasebe/` adresinden açılır.
- **Dosyadan açılış:** `index.html` dosyadan (`file://`) açılırsa uygulama çalışmaz, yalnızca sunucu adresini söyler.
- **Bu sürümün denenmesi:** Sözleşmeyi taklit eden bir test sunucusu ve Playwright ile iki oturumda yapıldı (88/88). Ayrıntı SUNUCU-MUHASEBE.md §4'te. Gerçek PocketBase ile deneme sunucuda yapılmalı (§6).

## Gizlilik

Depoya **gerçek hasta verisi, telefon numarası, tutar, ekstre, rapor çıktısı, şifre ya da anahtar eklenmemeli**. Örneklerdeki ad ve tutarlar uydurmadır.

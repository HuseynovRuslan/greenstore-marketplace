/*
 * Support pages (footer «Dəstək»): rules, safe buying, help, terms, privacy. Sample text written for the demo — the
 * legal pages need the company's lawyer before launch (docs/handoff/pages-v2.md → open questions).
 */

export interface HelpSection {
  id: string
  title: string
  paragraphs?: string[]
  list?: string[]
}

export interface HelpPage {
  slug: string
  title: string
  lead: string
  updated: string
  sections: HelpSection[]
}

export const rulesPage: HelpPage = {
  slug: 'qaydalar',
  title: 'Elan qaydaları',
  lead: 'Qısa və aydın: alıcı nə görürsə, onu almalıdır. Qaydalar hamı üçün eynidir — fərdi satıcı, tingçilik və ya landşaft şirkəti.',
  updated: '2026-11-01',
  sections: [
    {
      id: 'ne-olar',
      title: 'Nə yerləşdirmək olar',
      list: [
        'Canlı bitkilər: ağac, kol, gül, otaq bitkisi, fidan, ting, toxum, rulon çəmən',
        'Bağ məhsulları: torpaq, gübrə, dibçək, alət, suvarma avadanlığı',
        'Bağ xidmətləri: landşaft dizaynı, əkin, çim salınması, suvarma, bağ baxımı',
      ],
    },
    {
      id: 'ne-olmaz',
      title: 'Nə olmaz',
      list: [
        'Qadağan olunmuş və ya karantin altında olan bitkilər, toxumlar və kimyəvi maddələr',
        'Təbiətdən icazəsiz çıxarılmış bitkilər (yabanı orxideya, qar çiçəyi və s.)',
        'Bağla əlaqəsi olmayan mal və xidmətlər, reklam, başqa saytlara keçidlər',
        'Eyni bitki üçün bir neçə elan: hər məhsul — bir elan',
      ],
    },
    {
      id: 'sekiller',
      title: 'Şəkillər',
      paragraphs: ['Ən azı 1, ən çoxu 12 şəkil. İlk şəkil örtük olur — bitki bütövlükdə, işıqlı yerdə görünsün.'],
      list: [
        'Yalnız satdığınız bitkinin və ya məhsulun öz şəkli',
        'Skrinşot, internetdən götürülmüş və ya süni intellektlə yaradılmış şəkil olmaz',
        'Şəkil üzərində telefon, loqo, başqa saytın adı olmaz',
      ],
    },
    {
      id: 'qiymet',
      title: 'Qiymət və məlumat',
      list: [
        'Qiyməti tam yazın: «1 ədəd üçün», «1 kisə üçün» — vahidi seçin',
        'Topdan qiymət adi qiymətdən aşağı olmalı, minimum miqdar göstərilməlidir',
        'Telefonu təsvirdə yazmayın — «Əlaqə» addımında göstərilir',
        'Hündürlük, yaş, kök sistemi düzgün olsun: alıcı seçimi buna görə edir',
      ],
    },
    {
      id: 'moderasiya',
      title: 'Yoxlama və müddət',
      paragraphs: [
        'Hər elan yoxlanılır, adətən 1 saat ərzində. Rədd edilsə, səbəbini kabinetdə görəcəksiniz: düzəldib yenidən göndərə bilərsiniz.',
        'Elan 30 gün saytda qalır. Müddət bitəndə kabinetdən pulsuz yeniləyin. Dəyişdirilmiş elan yenidən yoxlamaya gedir; dərc olunmuş elanın kateqoriyası dəyişdirilmir.',
      ],
    },
    {
      id: 'pozuntu',
      title: 'Qayda pozulanda',
      paragraphs: ['İlk dəfə xəbərdarlıq edirik və elanı dayandırırıq. Təkrar və ya dələduzluq halında hesab bağlanır. Şübhəli elanı «Elandan şikayət et» ilə bizə bildirin.'],
    },
  ],
}

export const safeBuyingPage: HelpPage = {
  slug: 'tehlukesiz-alis',
  title: 'Təhlükəsiz alış',
  lead: 'Bitki canlıdır: şəkil hər şeyi göstərmir. Bu qaydalar həm pulunuzu, həm də bağınızı qoruyur.',
  updated: '2026-11-01',
  sections: [
    {
      id: 'beh',
      title: 'Görmədən beh göndərməyin',
      paragraphs: ['Satıcı «başqa alıcı var, beh göndərin» deyirsə, ehtiyatlı olun. Ödənişi bitkini yerində gördükdən və ya çatdırılanda yoxladıqdan sonra edin.'],
    },
    {
      id: 'yoxlayin',
      title: 'Bitkini necə yoxlamalı',
      list: [
        'Kök: dibçəkdən yüngülcə çıxarın — köklər açıq rəngli, möhkəm, çürüksüz olsun',
        'Yarpaq və iynələr: ləkə, saralma, toz kimi ağ örtük, zərərverici olmasın',
        'Gövdə: çat, yumşaq yer, qabıq soyulması olmasın',
        'Ölçü: hündürlüyü dibçəklə birlikdə ölçün, elandakı ilə müqayisə edin',
        'Növ: latınca adını soruşun — eyni adla fərqli sortlar satılır',
      ],
    },
    {
      id: 'catdirilma',
      title: 'Çatdırılma və əkin',
      list: [
        'Böyük ağaclar üçün çatdırılma və əkin şərtlərini əvvəlcədən yazılı razılaşdırın',
        'Açıq köklü fidanları 1–2 gün ərzində əkin; kökləri nəm saxlayın',
        'Əkin xidməti varsa, bitkinin tutmasına zəmanət verilib-verilmədiyini soruşun',
      ],
    },
    {
      id: 'xidmetler',
      title: 'Bağ xidmətləri üçün',
      list: [
        'İşin həcmini, materialları, müddəti və qiyməti yazılı razılaşdırın',
        'Böyük işlərdə mərhələli ödəniş edin; tam ödənişi iş bitəndən sonra',
        'Ustanın əvvəlki işlərinə baxın — profildə «Tamamlanmış layihələr»',
      ],
    },
    {
      id: 'subheli',
      title: 'Şübhəli hallar',
      list: [
        'Qiymət bazardan çox aşağıdır və satıcı tələsdirir',
        'Satıcı görüşməkdən qaçır, yalnız kartla əvvəlcədən ödəniş istəyir',
        'Kart məlumatlarınızı, SMS kodunu istəyirlər — GreenStore heç vaxt kod istəmir',
      ],
      paragraphs: ['Belə elanı «Elandan şikayət et» ilə bildirin: moderatorlar 24 saat ərzində yoxlayır.'],
    },
  ],
}

export const termsPage: HelpPage = {
  slug: 'istifade-sertleri',
  title: 'İstifadə şərtləri',
  lead: 'GreenStore elan platformasıdır: alıcı ilə satıcını birləşdirir, alqı-satqının tərəfi deyil.',
  updated: '2026-11-01',
  sections: [
    { id: 'xidmet', title: 'Xidmətin mahiyyəti', paragraphs: ['Elanları istifadəçilər yerləşdirir və məlumatın doğruluğuna özləri cavabdehdir. Razılaşma, ödəniş və çatdırılma alıcı ilə satıcı arasında olur.'] },
    { id: 'hesab', title: 'Hesab', paragraphs: ['Hesab telefon nömrəsi ilə təsdiqlənir. Bir şəxs — bir fərdi hesab. Biznes hesabı tingçilik, bağ mərkəzi və landşaft şirkətləri üçündür.'] },
    { id: 'odenisli', title: 'Ödənişli xidmətlər', paragraphs: ['«İrəli çək» və «Önə çıxar» paketləri aktivləşəndən sonra geri qaytarılmır, elan qaydalara görə rədd edilibsə — ödəniş qaytarılır.'] },
    { id: 'mesuliyyet', title: 'Məsuliyyət', paragraphs: ['GreenStore qaydaları pozan elanı xəbərdarlıqsız dayandıra bilər. Platforma istifadəçilər arasındakı mübahisələrdə tərəf deyil, lakin şikayətləri araşdırır.'] },
  ],
}

export const privacyPage: HelpPage = {
  slug: 'mexfilik',
  title: 'Məxfilik siyasəti',
  lead: 'Hansı məlumatı toplayırıq, nə üçün və bunu necə idarə edə bilərsiniz.',
  updated: '2026-11-01',
  sections: [
    { id: 'toplanan', title: 'Nə toplayırıq', list: ['Ad, telefon, istəyə görə e-poçt', 'Elanlarınız və şəkilləriniz', 'Seçilmişlər və yadda saxlanılan axtarışlar', 'Sayt statistikası (anonim)'] },
    { id: 'meqsed', title: 'Nə üçün', list: ['Hesabı təsdiqləmək və qorumaq', 'Elanınızı alıcılara göstərmək', 'Bildiriş göndərmək (seçdiyiniz hallarda)'] },
    { id: 'nomre', title: 'Telefon nömrəniz', paragraphs: ['Nömrə yalnız «Nömrəni göstər» basılanda göstərilir və hər baxış sayılır. «Zəng qəbul etmirəm» seçsəniz, nömrə elanda göstərilmir.'] },
    { id: 'idare', title: 'İdarə etmək', paragraphs: ['Profil səhifəsində məlumatları dəyişə, bildirişləri bağlaya bilərsiniz. Hesabı silmək üçün «Bizimlə əlaqə» formasına yazın.'] },
  ],
}

export const faq: Array<{ group: string; items: Array<{ q: string; a: string }> }> = [
  {
    group: 'Elan yerləşdirmək',
    items: [
      { q: 'Elan yerləşdirmək pulsuzdur?', a: 'Bəli. Elan 30 gün saytda qalır, bitəndə pulsuz yeniləyə bilərsiniz. Pullu olan yalnız «İrəli çək» və «Önə çıxar» paketləridir.' },
      { q: 'Elanım nə vaxt görünəcək?', a: 'Yoxlamadan sonra — adətən 1 saat ərzində. Nəticəni «Elanlarım» bölməsində görəcəksiniz.' },
      { q: 'Elanım niyə rədd edildi?', a: 'Səbəb kabinetdə elanın altında yazılır. Ən çox: başqasının şəkli, təsvirdə telefon, yanlış kateqoriya. Düzəldib «Düzəlt və göndər» basın.' },
      { q: 'Yarımçıq elan itəcək?', a: 'Xeyr. Qaralama avtomatik saxlanılır: «Elanlarım» → «Qaralamalar» bölməsindən davam edin.' },
    ],
  },
  {
    group: 'Hesab',
    items: [
      { q: 'Şifrəni unutdum', a: '«Daxil ol» səhifəsində «Şifrəni unutmusunuz?» basın: telefonunuza SMS kodu gələcək.' },
      { q: 'Biznes hesabı nə verir?', a: 'Profil səhifəsi (iş saatları, ünvan, xidmətlər), bütün elanlar bir yerdə, «Satıcılar» siyahısında görünmək və təsdiq nişanı.' },
    ],
  },
  {
    group: 'Alıcılar üçün',
    items: [
      { q: 'Satıcı ilə necə əlaqə saxlayım?', a: 'Elanda «Nömrəni göstər» və ya «WhatsApp-a yaz» basın. Satıcı zəng qəbul etmirsə, yalnız WhatsApp göstərilir.' },
      { q: 'Yeni elanlardan necə xəbər tutum?', a: 'Axtarışda filtrləri seçin və «Axtarışı yadda saxla» basın: uyğun elan çıxanda xəbər verəcəyik.' },
      { q: 'Satıcıya güvənmək olar?', a: '«Təsdiqlənmiş» nişanına, profil məlumatına və «Təhlükəsiz alış» məsləhətlərinə baxın. Görmədən beh göndərməyin.' },
    ],
  },
]

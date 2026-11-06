@AGENTS.md

## Layihə qaydaları

- Rənglər, radiuslar, kölgələr və animasiya müddətləri yalnız `src/styles/index.css` (`@theme`) tokenlərindən. Komponentdə xam hex yazma.
- Animasiya: `motion` paketi (LazyMotion + `m`) icazəlidir; başqa UI kitabxanası əlavə etmə. `MotionConfig reducedMotion="user"` həmişə qalsın.
- `src/services/repository.ts` və `src/types` backend ilə müqavilədir. Dəyişmək lazımdırsa, əvvəl soruş və `docs/handoff/`-a qeyd yaz.
- UI mətnləri Azərbaycan dilində, düzgün hərflərlə. Önə çıxarılan elanların adı: «Önə çıxan». "VIP" sözü işlənmir.
- Hər commit-dən əvvəl: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.
- Commit yalnız mənim OK-dan sonra. Push etmə.
- Brauzerdə yoxlama: `playwright-cli`. Video və CLS ölçmək: `webapp-testing`.
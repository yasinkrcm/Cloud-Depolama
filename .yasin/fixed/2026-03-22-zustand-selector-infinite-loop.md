# Zustand Selector Infinite Loop Fix

**Tarih:** 2026-03-22
**Dosyalar:** `client/components/UploadList.tsx`, `client/hooks/useUpload.ts`

## Hata

1. **"getServerSnapshot should be cached"** - Zustand selector her render'da yeni referans döndürüyor
2. **"Maximum update depth exceeded"** - UploadList.tsx'te sonsuz re-render döngüsü

## Root Cause

Zustand store'da obje literal döndüren selector'lar her render'da yeni referans oluşturuyor:

```typescript
// ❌ YANLIŞ - Her render'da yeni array
const queue = useUploadStore((state) => Array.from(state.queue.values()))

// ❌ YANLIŞ - Her render'da yeni obje
const { clearCompleted } = useUploadStore()

// ❌ YANLIŞ - Object destructuring shallow equality sorunlu
const { addUpload, removeUpload } = useUploadStore()
```

## Çözüm

`zustand/react/shallow`'dan `useShallow` kullanarak stable referanslar oluştur:

```typescript
// ✅ DOĞRU
import { useShallow } from 'zustand/react/shallow'

const { queue, clearCompleted } = useUploadStore(
  useShallow((state) => ({
    queue: state.queue,
    clearCompleted: state.clearCompleted
  }))
)

// Array.from'u useMemo içine taşı
const sortedQueue = useMemo(() => {
  const uploads = Array.from(queue.values())
  return uploads.sort(...)
}, [queue])
```

## Değişen Dosyalar

### client/components/UploadList.tsx
- `useShallow` import eklendi
- `queue` Map'i ve `clearCompleted` fonksiyonu tek selector'da alındı
- `Array.from()` `useMemo` içine taşındı

### client/hooks/useUpload.ts
- `useShallow` import eklendi
- Store selector'ları `useShallow` ile sarıldı

## Test

```bash
# Client çalıştır
cd client && npm run dev

# Tarayıcı konsolunda şu hatalar olmamalı:
# - "getServerSnapshot should be cached"
# - "Maximum update depth exceeded"
```

## İlgili Kaynaklar

- [Zustand Shallow Pattern](https://github.com/pmndrs/zustand#selecting-multiple-state-slices)
- [useShallow API](https://zustand.docs.pmnd.rs/guides/performance#using-selectors-wisely)

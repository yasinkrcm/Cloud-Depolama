# Upload Pause/Resume Not Working

**Tarih:** 2026-03-23
**Dosyalar:** client/hooks/useUpload.ts

## Hata
Upload işlemi pause butonuna basılmasına rağmen durmuyor, chunk upload'lara devam ediyor.
Kullanıcı pause butonuna bastığında upload 'paused' statüsüne geçmiyor ve chunk'lar
upload edilmeye devam ediyor.

## Root Cause
1. `uploadChunkWithRetry` fonksiyonu (57-76 satırları) abort signal parametresi kabul
   etmiyordu - retry sırasında pause çalışmıyordu
2. Chunk döngüsünde (169-212 satırları) sadece `abortController.signal.aborted` kontrolü
   var, paused state kontrolü yok
3. Chunk upload tamamlandıktan sonra paused state kontrolü eksik

## Çözüm

### 1. `uploadChunkWithRetry` fonksiyonuna abort signal eklendi:
- `signal?: AbortSignal` parametresi eklendi
- Retry öncesi abort kontrolü eklendi
- Fetch'e signal pass edildi (strict TypeScript compatible şekilde)

### 2. Ana upload döngüsüne paused state kontrolü eklendi:
```typescript
// Check both abort signal AND paused state
const currentUpload = getUpload(uploadId)
if (abortController.signal.aborted || currentUpload?.status === 'paused') {
  throw new Error('Upload cancelled or paused')
}
```

### 3. Chunk upload sonrası kontrol eklendi:
```typescript
// Check again after chunk upload
const currentUploadAfterChunk = getUpload(uploadId)
if (abortController.signal.aborted || currentUploadAfterChunk?.status === 'paused') {
  throw new Error('Upload cancelled or paused')
}
```

### 4. Resume fonksiyonuna da aynı kontroller eklendi:
Resume döngüsüne (340-381 satırları) de paused state kontrolleri eklendi.

### 5. Error reporting'ten user-action'ları hariç tut (257-267, 433-445 satırları):
Paused/cancelled durumları gerçek hata değil, kullanıcı tarafından bilinçli yapılan
aksiyonlar. Bu durumları error reporting'ten hariç tuttuk:

```typescript
// Don't report user-initiated actions (pause/cancel) as errors
const isUserAction = errorMessage.includes('cancelled') || errorMessage.includes('paused')
if (!isUserAction) {
  reportError(error, ErrorSeverity.HIGH, { fileName: file.name, fileSize: file.size })
}
```

### 6. Catch bloğunda paused durumunun korunması (267-270, 448-451 satırları):
Paused/cancelled durumunda status 'failed' yapılmasın, mevcut status korunsun:

```typescript
// Only update status to failed if it's not a user action
if (!isUserAction) {
  updateUpload(uploadId, {
    status: 'failed',
    error: errorMessage
  })
}
```

Bu sayede pause fonksiyonunda status 'paused' yapıldıktan sonra, catch bloğunda
tekrar 'failed' yapılmıyor.

## Test
```bash
cd client && bun run typecheck  # Pas
cd client && bun run lint       # Pas
```

Manuel test adımları:
1. Upload başlat
2. 2-3 chunk yüklendikten sonra Pause butonuna tıkla
3. Upload'ın durduğunu ve status'un 'paused' olduğunu doğrula
4. Resume butonuna tıkla
5. Upload'ın kaldığı yerden devam ettiğini doğrula

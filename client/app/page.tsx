/**
 * @file page.tsx
 * @role Home page for Cloud Storage app
 * @depends None
 * @dataflow Server component → renders upload UI
 */

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">
          Cloud Storage
        </h1>
        <p className="text-gray-600">
          Secure, high-performance file storage system
        </p>
      </div>
    </main>
  )
}

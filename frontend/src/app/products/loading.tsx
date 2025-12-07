export default function ProductsLoading() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar Skeleton */}
      <div className="h-16 bg-white border-b border-gray-200 animate-pulse" />

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Header Skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <div className="h-8 w-48 bg-gray-200 rounded animate-pulse mb-2" />
            <div className="h-4 w-64 bg-gray-200 rounded animate-pulse" />
          </div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-32 bg-gray-200 rounded-lg animate-pulse" />
            <div className="h-10 w-28 bg-gray-200 rounded-lg animate-pulse" />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Form Skeleton */}
          <div className="lg:col-span-4">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 border-t-4 border-t-red-600">
              <div className="h-6 w-40 bg-gray-200 rounded animate-pulse mb-2" />
              <div className="h-4 w-48 bg-gray-200 rounded animate-pulse mb-6" />

              <div className="space-y-4">
                <div>
                  <div className="h-4 w-24 bg-gray-200 rounded animate-pulse mb-2" />
                  <div className="h-10 w-full bg-gray-100 rounded-lg animate-pulse" />
                </div>
                <div>
                  <div className="h-4 w-20 bg-gray-200 rounded animate-pulse mb-2" />
                  <div className="h-10 w-full bg-gray-100 rounded-lg animate-pulse" />
                </div>
                <div>
                  <div className="h-4 w-28 bg-gray-200 rounded animate-pulse mb-2" />
                  <div className="h-10 w-full bg-gray-100 rounded-lg animate-pulse" />
                </div>
                <div className="h-12 w-full bg-red-200 rounded-lg animate-pulse" />
              </div>
            </div>
          </div>

          {/* Product List Skeleton */}
          <div className="lg:col-span-8">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              {/* Header */}
              <div className="p-4 border-b bg-gradient-to-r from-red-50 to-orange-50">
                <div className="flex items-center gap-2">
                  <div className="h-5 w-32 bg-gray-200 rounded animate-pulse" />
                  <div className="h-5 w-16 bg-gray-200 rounded-full animate-pulse ml-auto" />
                </div>
              </div>

              {/* Product Rows */}
              <div className="divide-y divide-gray-100">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                  <div key={i} className="p-4 flex items-center gap-4">
                    <div className="w-10 h-10 bg-gray-200 rounded-full animate-pulse" />
                    <div className="flex-1">
                      <div className="h-4 w-32 bg-gray-200 rounded animate-pulse mb-1" />
                      <div className="h-3 w-24 bg-gray-200 rounded animate-pulse" />
                    </div>
                    <div className="hidden md:block w-16">
                      <div className="h-4 w-full bg-gray-200 rounded animate-pulse" />
                    </div>
                    <div className="h-6 w-20 bg-gray-200 rounded-full animate-pulse" />
                    <div className="w-5 h-5 bg-gray-200 rounded animate-pulse" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

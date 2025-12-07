export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="w-12 h-12 rounded-full border-4 border-gray-200"></div>
          <div className="w-12 h-12 rounded-full border-4 border-red-600 border-t-transparent animate-spin absolute top-0 left-0"></div>
        </div>
        <p className="text-gray-500 text-sm font-medium">Memuat...</p>
      </div>
    </div>
  );
}

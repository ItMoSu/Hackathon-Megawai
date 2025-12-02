"use client";

import { Modal } from "./ui/Modal";
import { Button } from "./ui/Button";
import { CheckCircle2, PlayCircle } from "lucide-react";

type OnboardingModalProps = {
  open: boolean;
  onClose: () => void;
};

export function OnboardingModal({ open, onClose }: OnboardingModalProps) {
  const steps = [
    {
      title: "Lihat Status Penjualan",
      desc: "Langsung tahu apakah penjualan sedang naik, turun, atau stabil.",
    },
    {
      title: "Cek Deteksi Lonjakan",
      desc: "Kami kasih tahu kalau ada tanda-tanda viral atau anomali.",
    },
    {
      title: "Baca Prediksi 7 Hari",
      desc: "Garis biru = prediksi paling mungkin, area hijau = rentang aman.",
    },
    {
      title: "Ikuti Saran",
      desc: "Saran praktis yang bisa langsung dijalankan (stok, promo, tim).",
    },
  ];

  return (
    <Modal isOpen={open} onClose={onClose} title="Cara pakai dashboard ini">
      <div className="space-y-4 text-sm text-gray-700">
        <div className="flex items-center gap-3 rounded-lg bg-blue-50 px-4 py-3 text-blue-800">
          <PlayCircle className="h-6 w-6" />
          <p>2 menit untuk paham: buka dashboard ini setiap pagi untuk update terbaru.</p>
        </div>
        <ol className="space-y-3">
          {steps.map((step, idx) => (
            <li key={step.title} className="flex gap-3">
              <CheckCircle2 className="mt-1 h-5 w-5 text-green-600" />
              <div>
                <p className="font-semibold text-gray-900">
                  {idx + 1}. {step.title}
                </p>
                <p className="text-gray-600">{step.desc}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="rounded-lg bg-gray-50 px-4 py-3 text-xs text-gray-600">
          Tips: Gunakan rekomendasi H-2 sebelum puncak untuk belanja bahan dan atur tim.
        </div>
        <div className="flex justify-end">
          <Button onClick={onClose} size="sm">
            Mengerti
          </Button>
        </div>
      </div>
    </Modal>
  );
}

"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LEGAL_DOCS, type LegalDocId } from "@/lib/legal-content";

/**
 * Dialog dokumen legal IndiGoo (Syarat & Ketentuan, Kebijakan Privasi,
 * Bantuan). Konten penuh dari src/lib/legal-content.ts; area isi di-scroll
 * agar tetap nyaman dibaca di layar kecil.
 */
export default function LegalDocsDialog({
  doc,
  onOpenChange,
}: {
  doc: LegalDocId | null;
  onOpenChange: (open: boolean) => void;
}) {
  const data = doc ? LEGAL_DOCS[doc] : null;

  return (
    <Dialog open={!!doc} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden" aria-describedby={data ? `${data.id}-updated` : undefined}>
        {data && (
          <div className="flex flex-col max-h-[85vh]">
            <DialogHeader className="px-5 pt-5 pb-3 border-b border-border bg-sidebar/60">
              <DialogTitle className="text-base text-left">{data.title}</DialogTitle>
              <DialogDescription id={`${data.id}-updated`} className="text-xs text-left">
                Terakhir diperbarui: {data.updated}
              </DialogDescription>
            </DialogHeader>
            <div className="overflow-y-auto px-5 py-4 space-y-4">
              <p className="text-[13px] leading-relaxed text-foreground/90 text-justify">{data.intro}</p>
              {data.sections.map((s) => (
                <section key={s.heading} className="space-y-1.5">
                  <h4 className="text-[13px] font-semibold text-foreground">{s.heading}</h4>
                  {s.paragraphs?.map((p, i) => (
                    <p key={i} className="text-[13px] leading-relaxed text-muted-foreground text-justify">
                      {p}
                    </p>
                  ))}
                  {s.bullets && (
                    <ul className="list-disc pl-4 space-y-1">
                      {s.bullets.map((b, i) => (
                        <li key={i} className="text-[13px] leading-relaxed text-muted-foreground text-justify">
                          {b}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              ))}
              <p className="text-[11px] text-muted-foreground/80 pt-1 border-t border-border">
                Dokumen ini merupakan bagian dari layanan IndiGoo dan tersedia kapan pun melalui halaman Masuk &amp; Daftar.
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

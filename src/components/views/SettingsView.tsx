"use client";

import { useState } from "react";
import { ChevronRight, FileText, HelpCircle, Settings, ShieldCheck, SquareUserRound } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SettingsPrivacyTab from "@/components/extras/SettingsPrivacyTab";
import SettingsNotificationsTab from "@/components/extras/SettingsNotificationsTab";
import SettingsAccountTab from "@/components/extras/SettingsAccountTab";
import SettingsDisplayTab from "@/components/extras/SettingsDisplayTab";
import IdCardView from "@/components/indigoo/IdCardView";
import LegalDocsDialog from "@/components/extras/LegalDocsDialog";
import type { LegalDocId } from "@/lib/legal-content";

export default function SettingsView() {
  const [tab, setTab] = useState("privasi");
  // Task 43: akses fitur yang sebelumnya tidak terjangkau dari app live —
  // Kartu ID (QR ID Akses) & dokumen legal (Syarat/Privasi/Bantuan).
  const [showIdCard, setShowIdCard] = useState(false);
  const [legalDoc, setLegalDoc] = useState<LegalDocId | null>(null);

  if (showIdCard) {
    return <IdCardView onBack={() => setShowIdCard(false)} />;
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header internal hanya desktop — di mobile judul tampil di top bar AppShell
          & logo pengaturan pindah ke pojok kanan atas (sesuai anotasi) */}
      <header className="hidden md:flex items-center gap-2 px-4 py-3 border-b border-border bg-card shrink-0">
        <div>
          <h1 className="text-lg font-bold tracking-tight flex items-center gap-2">
            <Settings className="h-4 w-4 text-primary" aria-hidden="true" /> Pengaturan
          </h1>
          <p className="text-xs text-muted-foreground">Privasi, notifikasi, dan kelola akun bisnis</p>
        </div>
      </header>

      {/* Konten */}
      <div className="flex-1 overflow-y-auto wa-scrollbar p-4">
        <div className="max-w-2xl mx-auto">
          <Tabs value={tab} onValueChange={setTab} className="w-full">
            <TabsList className="grid grid-cols-4 w-full mb-4">
              <TabsTrigger value="privasi">Privasi</TabsTrigger>
              <TabsTrigger value="tampilan">Tampilan</TabsTrigger>
              <TabsTrigger value="notifikasi">Notifikasi</TabsTrigger>
              <TabsTrigger value="akun">Akun</TabsTrigger>
            </TabsList>
            <TabsContent value="privasi" className="mt-0">
              <SettingsPrivacyTab />
            </TabsContent>
            <TabsContent value="tampilan" className="mt-0">
              <SettingsDisplayTab />
            </TabsContent>
            <TabsContent value="notifikasi" className="mt-0">
              <SettingsNotificationsTab />
            </TabsContent>
            <TabsContent value="akun" className="mt-0">
              <SettingsAccountTab />
            </TabsContent>
          </Tabs>

          {/* Lainnya — Kartu ID & dokumen legal */}
          <div className="mt-4 mb-2 px-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Lainnya</p>
          </div>
          <div className="rounded-xl border border-border divide-y overflow-hidden bg-card">
            <button
              type="button"
              className="flex w-full items-center gap-3 px-4 py-3 text-sm hover:bg-muted/50 transition-colors text-left"
              onClick={() => setShowIdCard(true)}
            >
              <SquareUserRound className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <span className="flex-1 min-w-0">
                <span className="font-medium">Kartu ID Digital</span>
                <span className="block text-xs text-muted-foreground">Tampilkan QR ID Akses milik Anda</span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-3 px-4 py-3 text-sm hover:bg-muted/50 transition-colors text-left"
              onClick={() => setLegalDoc("terms")}
            >
              <FileText className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <span className="flex-1 min-w-0">
                <span className="font-medium">Syarat &amp; Ketentuan</span>
                <span className="block text-xs text-muted-foreground">Aturan penggunaan aplikasi IndiGoo</span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-3 px-4 py-3 text-sm hover:bg-muted/50 transition-colors text-left"
              onClick={() => setLegalDoc("privacy")}
            >
              <ShieldCheck className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <span className="flex-1 min-w-0">
                <span className="font-medium">Kebijakan Privasi</span>
                <span className="block text-xs text-muted-foreground">Bagaimana data Anda dikelola</span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-3 px-4 py-3 text-sm hover:bg-muted/50 transition-colors text-left"
              onClick={() => setLegalDoc("help")}
            >
              <HelpCircle className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <span className="flex-1 min-w-0">
                <span className="font-medium">Bantuan</span>
                <span className="block text-xs text-muted-foreground">Pertanyaan umum &amp; kontak dukungan</span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      <LegalDocsDialog doc={legalDoc} onOpenChange={(open) => { if (!open) setLegalDoc(null); }} />
    </div>
  );
}

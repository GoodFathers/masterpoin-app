"use client";

import { useState } from "react";
import { CircleDashed, Radio } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import StatusView from "@/components/views/StatusView";
import ChannelsView from "@/components/views/ChannelsView";

/**
 * Tab Pembaruan — gabungan Status & Channel dalam satu tampilan bertab.
 * TabsList selalu menempel di atas (header shrink-0), konten scroll di bawahnya.
 */
export default function UpdatesTab() {
  const [tab, setTab] = useState<string>("status");

  return (
    <div className="flex h-full flex-col bg-background">
      <Tabs value={tab} onValueChange={setTab} className="flex h-full min-h-0 flex-col">
        <div className="shrink-0 border-b border-border bg-card px-4 pt-3">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold leading-tight tracking-tight">Pembaruan</h1>
          </div>
          <TabsList className="mt-2 grid h-10 w-full grid-cols-2 gap-1 rounded-t-xl rounded-b-none bg-secondary/60 p-1">
            <TabsTrigger
              value="status"
              aria-label="Tampilkan status"
              className="gap-1.5 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm"
            >
              <CircleDashed className="h-4 w-4" aria-hidden="true" />
              Status
            </TabsTrigger>
            <TabsTrigger
              value="channel"
              aria-label="Tampilkan channel"
              className="gap-1.5 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm"
            >
              <Radio className="h-4 w-4" aria-hidden="true" />
              Channel
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="status" className="mt-0 min-h-0 flex-1">
          <div className="wa-scrollbar h-full overflow-y-auto">
            <StatusView />
          </div>
        </TabsContent>
        <TabsContent value="channel" className="mt-0 min-h-0 flex-1">
          <div className="wa-scrollbar h-full overflow-y-auto">
            <ChannelsView />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

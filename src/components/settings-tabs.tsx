"use client";

import type { ReactNode } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export type SettingsTab = { value: string; label: string; content: ReactNode };

export function SettingsTabs({ tabs }: { tabs: SettingsTab[] }) {
  return (
    <Tabs defaultValue={tabs[0]?.value} className="w-full">
      <TabsList className="h-auto flex-wrap justify-start">
        {tabs.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value} className="flex-none px-3">
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((tab) => (
        <TabsContent key={tab.value} value={tab.value} className="space-y-6 pt-6">
          {tab.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}

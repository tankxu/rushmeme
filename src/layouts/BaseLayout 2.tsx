import React from "react";
import DragWindowRegion from "@/components/DragWindowRegion";

export default function BaseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-background flex h-screen flex-col">
      <DragWindowRegion title="RushMeme" />
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}

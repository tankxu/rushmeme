import React from "react";
import { openExternalLink } from "@/helpers/shell";

export default function Footer() {
  function handleOpenProfile(event: React.MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    openExternalLink("https://x.com/tankxu");
  }

  return (
    <footer className="font-tomorrow text-muted-foreground flex flex-wrap items-center justify-between gap-3 text-[0.7rem] uppercase">
      <span>
        Made by
        <a
          href="https://x.com/tankxu"
          onClick={handleOpenProfile}
          rel="noreferrer"
          className="ml-1 underline-offset-2 hover:underline"
        >
          0xTank
        </a>
      </span>
    </footer>
  );
}

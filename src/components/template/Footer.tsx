import React from "react";
import { openExternalLink } from "@/helpers/shell";

export default function Footer() {
  const handleOpenLink = (
    event: React.MouseEvent<HTMLAnchorElement>,
    url: string,
  ) => {
    event.preventDefault();
    openExternalLink(url);
  };

  return (
    <footer className="font-tomorrow text-muted-foreground flex flex-wrap items-center justify-between gap-3 text-[0.7rem] uppercase">
      <p>
        <span>
          <a
            href="https://rushmeme.vip"
            onClick={(event) =>
              handleOpenLink(event, "https://rushmeme.vip")
            }
            rel="noreferrer"
            className="ml-1 underline-offset-2 hover:underline"
          >
            RUSHMEME.VIP
          </a>
        </span>
        <span className="mx-2">|</span>
        <span>
          Made by
          <a
            href="https://x.com/tankxu"
            onClick={(event) =>
              handleOpenLink(event, "https://x.com/tankxu")
            }
            rel="noreferrer"
            className="ml-1 underline-offset-2 hover:underline"
          >
            0xTank
          </a>
        </span>
      </p>
    </footer>
  );
}

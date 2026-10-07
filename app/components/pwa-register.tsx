"use client";
import Image from "next/image";
import { useEffect, useState } from "react";
import img from "../assets/download icon.png"

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};

export default function PwaRegister() {
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      // Only reload after an UPDATE, never on the very first install
      const hadController = !!navigator.serviceWorker.controller;

      navigator.serviceWorker.register("/sw.js").then((reg) => {
        reg.addEventListener("updatefound", () => {
          const worker = reg.installing;
          worker?.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) {
              if (confirm("A new version of MyShop is available. Update now?")) {
                worker.postMessage("SKIP_WAITING");
              }
            }
          });
        });
      });

      let reloaded = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (!hadController || reloaded) return;
        reloaded = true;
        window.location.reload();
      });
    }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as InstallEvent);
    };
    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    if (!navigator.onLine) goOffline();

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  return (
    <>
      {installEvent && (
        <button
          className="fixed bottom-4 right-4 z-[9999] flex justify-center items-center shadow-2xl bg-black w-10 h-10 rounded-full text-white"
          onClick={async () => {
            await installEvent.prompt();
            await installEvent.userChoice;
            setInstallEvent(null);
          }}
        >
          <Image className="w-6 h-6" src={img} alt="" />
        </button>
      )}
      {offline && (
        <div className="fixed inset-x-0 bottom-0 z-[99999] bg-slate-800 p-2.5 text-center text-sm text-white">
          You are offline. Showing saved content.
        </div>
      )}
    </>
  );
}

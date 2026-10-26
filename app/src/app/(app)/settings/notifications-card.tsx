"use client";

import { Bell, BellOff, LoaderCircle, Send } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { removePushSubscription, savePushSubscription, saveWorkoutReminder, sendTestPush } from "./push-actions";

type Support = "checking" | "unsupported" | "ios-install" | "denied" | "off" | "on";

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
const TIMES = Array.from({ length: 34 }, (_, i) => {
  const minutes = 5 * 60 + i * 30; // 05:00 … 21:30
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${minutes % 60 ? "30" : "00"}`;
});

function base64ToBytes(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

async function currentSubscription() {
  const registration = await navigator.serviceWorker.getRegistration("/");
  return registration ? registration.pushManager.getSubscription() : null;
}

// Push needs a service worker and, on iPhone, the app installed on the home screen.
export function NotificationsCard({ isStudent, workoutTime }: { isStudent: boolean; workoutTime: string | null }) {
  const [support, setSupport] = useState<Support>("checking");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
      const standalone = window.matchMedia("(display-mode: standalone)").matches;
      let next: Support;
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !VAPID) next = ios && !standalone ? "ios-install" : "unsupported";
      else if (Notification.permission === "denied") next = "denied";
      else next = (await currentSubscription()) ? "on" : "off";
      if (!cancelled) setSupport(next);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function enable() {
    startTransition(async () => {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setSupport(permission === "denied" ? "denied" : "off");
        return;
      }
      const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ToBytes(VAPID) });
      const result = await savePushSubscription(subscription.toJSON());
      if (!result.ok) return void toast.error(result.message);
      setSupport("on");
      toast.success("Notificações ativadas neste aparelho.");
    });
  }

  function disable() {
    startTransition(async () => {
      const subscription = await currentSubscription();
      if (subscription) {
        await removePushSubscription(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setSupport("off");
      toast.success("Notificações desativadas neste aparelho.");
    });
  }

  return (
    <div className="grid gap-5">
      {support === "checking" ? (
        <p className="text-sm text-muted-foreground">Verificando este aparelho…</p>
      ) : support === "unsupported" ? (
        <p className="text-sm text-muted-foreground">Este navegador não aceita notificações. No Android, use o Chrome; no computador, Chrome, Edge ou Firefox.</p>
      ) : support === "ios-install" ? (
        <p className="text-sm text-muted-foreground">
          No iPhone, as notificações funcionam com o app instalado: toque em Compartilhar → <strong className="text-foreground">Adicionar à Tela de Início</strong>, abra o FitFlow por lá e volte aqui.
        </p>
      ) : support === "denied" ? (
        <p className="text-sm text-muted-foreground">As notificações estão bloqueadas para este site. Libere nas configurações do navegador e recarregue a página.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {support === "on" ? (
            <>
              <Button type="button" variant="outline" disabled={pending} onClick={() => startTransition(async () => {
                const result = await sendTestPush();
                if (result.ok) toast.success("Notificação de teste enviada.");
                else toast.error(result.message);
              })}>
                <Send aria-hidden />
                Enviar teste
              </Button>
              <Button type="button" variant="ghost" disabled={pending} onClick={disable}>
                <BellOff aria-hidden />
                Desativar neste aparelho
              </Button>
            </>
          ) : (
            <Button type="button" disabled={pending} onClick={enable}>
              {pending ? <LoaderCircle className="animate-spin" aria-hidden /> : <Bell aria-hidden />}
              Ativar notificações neste aparelho
            </Button>
          )}
        </div>
      )}

      {isStudent && (
        <div className="grid gap-2">
          <label htmlFor="workout-reminder" className="text-sm font-medium">Lembrete do treino do dia</label>
          <select
            id="workout-reminder"
            defaultValue={workoutTime ?? ""}
            onChange={(e) => {
              const time = e.target.value;
              startTransition(async () => {
                const result = await saveWorkoutReminder(time);
                if (result.ok) toast.success(time ? `Lembrete às ${time} nos dias de treino.` : "Lembrete de treino desligado.");
                else toast.error(result.message);
              });
            }}
            className="h-11 rounded-lg border border-input bg-transparent px-3 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:max-w-56 md:text-sm dark:bg-input/30 [&>option]:bg-popover"
          >
            <option value="">Desligado</option>
            {TIMES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <p className="text-xs text-muted-foreground">Só nos dias com treino no seu plano e se você ainda não treinou. Os lembretes de água ficam em Hidratação.</p>
        </div>
      )}
    </div>
  );
}

export function registerPwa() {
  if (!("serviceWorker" in navigator) || !import.meta.env.PROD) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(error => {
      console.warn("Clinova PWA registration failed:", error);
    });
  }, { once: true });
}

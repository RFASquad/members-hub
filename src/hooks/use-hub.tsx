import { useLocation } from "react-router-dom";
import { useEffect } from "react";

export function useHub() {
  const location = useLocation();
  const isCCK = location.pathname.startsWith("/communicake");
  const hub = isCCK ? "CCK" : "RFA";

  useEffect(() => {
    if (isCCK) {
      document.documentElement.classList.add("theme-cck");
    } else {
      document.documentElement.classList.remove("theme-cck");
    }
  }, [isCCK]);

  return {
    hub,
    isCCK,
    isRFA: !isCCK,
  };
}

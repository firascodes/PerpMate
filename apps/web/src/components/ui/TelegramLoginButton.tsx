"use client";
import { useEffect } from "react";

// Manually define the type for the Telegram user object
interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

declare global {
  interface Window {
    Telegram: {
      Login: {
        widgets: {
          [key: string]: {
            auth: (user: TelegramUser) => void;
          };
        };
      };
    };
  }
}

const TelegramLoginButton = () => {
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute(
      "data-telegram-login",
      process.env.NEXT_PUBLIC_TELEGRAM_BOT_NAME || "PerpMateBot"
    );
    script.setAttribute("data-size", "large");
    script.setAttribute("data-radius", "10");
    script.setAttribute(
      "data-auth-url",
      `${window.location.origin}/api/auth/telegram`
    );
    script.setAttribute("data-request-access", "write");

    const container = document.getElementById("telegram-login-container");
    if (container) {
      container.appendChild(script);
    }

    return () => {
      if (container && container.contains(script)) {
        container.removeChild(script);
      }
    };
  }, []);

  return <div id="telegram-login-container"></div>;
};

export default TelegramLoginButton;

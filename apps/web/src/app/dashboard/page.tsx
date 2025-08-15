"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Image from "next/image";
import Cookies from "js-cookie";
import { Button } from "@/components/ui/button";

// Real authentication check using cookies
const useAuth = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const session = Cookies.get("session");
    if (session) {
      try {
        const userData = JSON.parse(session);
        setUser(userData);
        setIsLoggedIn(true);
      } catch (error) {
        console.error("Failed to parse session cookie:", error);
        setIsLoggedIn(false);
      }
    } else {
      setIsLoggedIn(false);
    }
  }, []);

  return { isLoggedIn, user };
};

interface Position {
  asset: string;
  szi: string;
  entryPx: string;
  markPx: string;
  unrealizedPnl: string;
}

export default function Dashboard() {
  const { isLoggedIn, user } = useAuth();
  const [positions, setPositions] = useState<Position[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isLoggedIn) {
      const fetchPositions = async () => {
        try {
          const res = await fetch("/api/positions");
          if (res.ok) {
            const data = await res.json();
            setPositions(data.positions);
          }
        } catch (error) {
          console.error("Failed to fetch positions:", error);
        } finally {
          setIsLoading(false);
        }
      };
      fetchPositions();
    } else {
      setIsLoading(false);
    }
  }, [isLoggedIn]);

  const handleTelegramLogin = () => {
    window.open("https://t.me/PerpMateBot", "_blank");
  };

  // Remove duplicated html/body/layout, just return content for layout.tsx to wrap
  if (!isLoggedIn) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <Card className="bg-gray-800 border-gray-700 w-full max-w-md text-center">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-brand">
              Login Required
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-8">
            <p className="text-gray-300">
              Please log in to view your dashboard.
            </p>
            <Button
              onClick={handleTelegramLogin}
              variant="default"
              size="lg"
              className="flex w-full items-center gap-2 rounded-md bg-white hover:bg-white/90 text-gray-900 font-bold shadow-md transition-all duration-150 w"
            >
              <Image
                src="/assets/telegram-2.svg"
                alt="Telegram Logo"
                width={24}
                height={24}
                className="mr-1"
              />
              <span className="text-sm font-semibold">Login With Telegram</span>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <nav className="bg-gray-800 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Image
                src="/assets/ghost.svg"
                alt="PerpMate Logo"
                width={40}
                height={40}
                className="mr-2 mb-1"
              />
              <Image
                src="/assets/PerpMate.svg"
                alt="PerpMate Logo"
                width={120}
                height={40}
              />
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="space-y-8">
          <div>
            <h2 className="text-3xl font-bold mb-6">Your Dashboard</h2>
            {/* Placeholder for positions */}
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-brand">
                  Open Positions
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <p className="text-gray-400">Loading positions...</p>
                ) : positions && positions.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-700">
                      <thead className="bg-gray-800">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                            Asset
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                            Size
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                            Entry Price
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                            Mark Price
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                            Unrealized PnL
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-gray-900 divide-y divide-gray-700">
                        {positions.map((pos) => (
                          <tr key={pos.asset}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                              {pos.asset}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                              {parseFloat(pos.szi).toFixed(4)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                              ${parseFloat(pos.entryPx).toFixed(2)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                              ${parseFloat(pos.markPx).toFixed(2)}
                            </td>
                            <td
                              className={`px-6 py-4 whitespace-nowrap text-sm ${parseFloat(pos.unrealizedPnl) >= 0 ? "text-green-500" : "text-red-500"}`}
                            >
                              {parseFloat(pos.unrealizedPnl).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-gray-400">No Open Positions yet</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </>
  );
}

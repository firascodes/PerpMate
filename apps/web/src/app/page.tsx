"use client";
import { ShineBorder } from "@/components/ui/shine-border";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  const handleTelegramLogin = () => {
    // Redirect to PerpMate bot
    window.open("https://t.me/PerpMateBot", "_blank");
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <nav className="bg-gray-800 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Image
                src="/assets/ghost.svg"
                alt="PerpMate Logo"
                width={40}
                height={40}
                className="mr-2"
              />
              <Image
                src="/assets/PerpMate.svg"
                alt="PerpMate Logo"
                width={120}
                height={40}
              />
            </div>
            <div className="flex items-center">
              <Button
                onClick={handleTelegramLogin}
                variant="ghost"
                size="icon"
                className="rounded-full focus-ring"
              >
                <Image
                  src="/assets/telegram.svg"
                  alt="Telegram Logo"
                  width={32}
                  height={32}
                />
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="text-center space-y-8">
          <div>
            <h2 className="text-4xl font-bold mb-4">
              AI-Powered Cross-Chain Trading
            </h2>
            <p className="text-xl text-gray-300 mb-8">
              Get AI signals → Execute one-tap cross-chain trades → Track
              real-time analytics
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-brand">
                  🧠 AI Signals
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-300 text-sm">
                  Get technical analysis-based trading signals for BTC, ETH, SOL
                  with confidence scoring
                </p>
              </CardContent>
            </Card>

            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-brand">
                  ⚡ One-Tap Execution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-300 text-sm">
                  Bridge from Solana/Base and execute perp trades on Hyperliquid
                  in one command
                </p>
              </CardContent>
            </Card>

            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-brand">
                  📊 Real-Time Analytics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-300 text-sm">
                  Track positions, PnL, and signal performance with live
                  dashboard updates
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      <footer className="bg-gray-800 shadow-lg mt-12">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <div className="flex justify-center space-x-6">
            <a href="#" className="text-gray-400 hover:text-white focus-ring rounded-md">
              Docs
            </a>
            <a href="#" className="text-gray-400 hover:text-white focus-ring rounded-md">
              PRD
            </a>
            <a
              href="https://t.me/PerpMateBot"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-white focus-ring rounded-md"
            >
              Telegram
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

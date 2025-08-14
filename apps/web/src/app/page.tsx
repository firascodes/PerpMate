"use client";

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
              <h1 className="text-xl font-bold text-blue-400">PerpMate</h1>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto py-12 px-4">
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

          <div className="bg-gray-800 rounded-lg p-8 shadow-xl">
            <h3 className="text-2xl font-semibold mb-6">
              Access Your Dashboard
            </h3>
            <p className="text-gray-300 mb-6">
              Start trading with PerpMate Telegram bot to view your positions
              and analytics here.
            </p>

            <button
              onClick={handleTelegramLogin}
              className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              <svg
                className="w-5 h-5 mr-2"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.13-.31-1.09-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24-.01.37z" />
              </svg>
              Login with Telegram
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
            <div className="bg-gray-800 rounded-lg p-6">
              <h4 className="text-lg font-semibold mb-3 text-blue-400">
                🧠 AI Signals
              </h4>
              <p className="text-gray-300 text-sm">
                Get technical analysis-based trading signals for BTC, ETH, SOL
                with confidence scoring
              </p>
            </div>

            <div className="bg-gray-800 rounded-lg p-6">
              <h4 className="text-lg font-semibold mb-3 text-green-400">
                ⚡ One-Tap Execution
              </h4>
              <p className="text-gray-300 text-sm">
                Bridge from Solana/Base and execute perp trades on Hyperliquid
                in one command
              </p>
            </div>

            <div className="bg-gray-800 rounded-lg p-6">
              <h4 className="text-lg font-semibold mb-3 text-purple-400">
                📊 Real-Time Analytics
              </h4>
              <p className="text-gray-300 text-sm">
                Track positions, PnL, and signal performance with live dashboard
                updates
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

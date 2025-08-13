"use client";

import { usePrivy } from "@privy-io/react-auth";

export default function Home() {
  const { ready, authenticated, user, login, logout } = usePrivy();

  if (!ready) {
    return <div style={{ padding: 24 }}>Loading...</div>;
  }

  if (!authenticated) {
    return (
      <main style={{ padding: 24 }}>
        <h1>PerpMate Dashboard</h1>
        <p>Read-only dashboard for Telegram bot users.</p>
        <button onClick={login} style={{ padding: 12, marginTop: 16 }}>
          Connect Wallet
        </button>
      </main>
    );
  }

  const walletAddress = user?.wallet?.address;

  return (
    <main style={{ padding: 24 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
        }}
      >
        <h1>PerpMate Dashboard</h1>
        <button onClick={logout} style={{ padding: 8 }}>
          Logout
        </button>
      </div>

      <div style={{ marginBottom: 24 }}>
        <h2>Wallet Info</h2>
        <p>Address: {walletAddress || "No wallet connected"}</p>
      </div>

      <div style={{ marginBottom: 24 }}>
        <h2>Positions</h2>
        <p>Connect your Telegram bot wallet to see positions here.</p>
        <p>
          <em>Note: This is read-only. Use the Telegram bot for trading.</em>
        </p>
      </div>

      <div>
        <h2>Recent Trades</h2>
        <p>Trade history will appear here once implemented.</p>
      </div>
    </main>
  );
}

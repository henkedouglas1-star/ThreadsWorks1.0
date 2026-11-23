import React from "react";
import { useThreadsConnection } from "../context/ThreadsConnectionContext";
import { Link as LinkIcon, RefreshCw } from "lucide-react";
import { auth } from "../firebase";

interface ThreadsConnectButtonProps {
  returnTo: string;
  className?: string;
  icon?: React.ReactNode;
}

export default function ThreadsConnectButton({ 
  returnTo, 
  className = "inline-flex items-center justify-center gap-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold px-4 py-2.5 transition shadow-sm cursor-pointer hover:shadow-purple-500/20 disabled:opacity-50",
  icon = <LinkIcon className="h-4 w-4" />
}: ThreadsConnectButtonProps) {
  const { loading, connectThreads } = useThreadsConnection();
  const [isConnecting, setIsConnecting] = React.useState(false);
  
  const handleConnect = async () => {
    if (!auth.currentUser) {
      alert("Please sign in before connecting your Meta Threads account.");
      return;
    }
    setIsConnecting(true);
    try {
      const result = await connectThreads(returnTo);
      if (!result.success && result.error !== "Cancelled") {
        alert(`Connection Failed: ${result.error}`);
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const isLoading = loading || isConnecting;

  return (
    <button
      type="button"
      onClick={handleConnect}
      disabled={isLoading}
      className={className}
    >
      {isLoading ? (
        <>
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span>Connecting...</span>
        </>
      ) : (
        <>
          {icon}
          <span>Connect Threads Account</span>
        </>
      )}
    </button>
  );
}

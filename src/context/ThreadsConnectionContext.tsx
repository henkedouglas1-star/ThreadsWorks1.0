import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { auth } from "../firebase";
import { 
  checkThreadsConnection, 
  initiateThreadsOAuthFlow, 
  invalidateThreadsConnectionCache,
  clearThreadsLocalConnection,
  ThreadsConnectionInfo
} from "../utils/threadsApi";

interface ThreadsConnectionState {
  loading: boolean;
  connected: boolean;
  username?: string;
  profilePictureUrl?: string;
  biography?: string;
  isSandbox?: boolean;
  hasInsightsPermission?: boolean;
  hasPublishPermission?: boolean;
  connectionDetails: ThreadsConnectionInfo | null;
  connectThreads: (returnTo?: string) => Promise<{ success: boolean; error?: string }>;
  disconnectThreads: () => Promise<void>;
  refreshConnection: (forceServer?: boolean) => Promise<ThreadsConnectionInfo | null>;
}

const ThreadsConnectionContext = createContext<ThreadsConnectionState | undefined>(undefined);

export const ThreadsConnectionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [connectionDetails, setConnectionDetails] = useState<ThreadsConnectionInfo | null>(null);

  const refreshConnection = useCallback(async (forceServer = false) => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      setConnectionDetails(null);
      setLoading(false);
      return null;
    }
    setLoading(true);
    try {
      const info = await checkThreadsConnection(uid, forceServer);
      setConnectionDetails(info);
      return info;
    } catch (err) {
      console.warn("Could not load Threads connection info:", err);
      setConnectionDetails({ connected: false });
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        refreshConnection();
      } else {
        setConnectionDetails(null);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [refreshConnection]);

  useEffect(() => {
    const handleUpdate = () => refreshConnection(true);
    window.addEventListener("threads-connection-updated", handleUpdate);
    return () => window.removeEventListener("threads-connection-updated", handleUpdate);
  }, [refreshConnection]);

  const connectThreads = async (returnTo = window.location.pathname) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return { success: false, error: "Not signed in" };
    setLoading(true);
    try {
      const result = await initiateThreadsOAuthFlow({
        userId: uid,
        returnTo
      });
      if (result.success) {
        invalidateThreadsConnectionCache(uid);
        await refreshConnection(true);
        window.dispatchEvent(new CustomEvent("threads-connection-updated"));
        return { success: true };
      }
      return { success: false, error: result.error || "Cancelled" };
    } catch (err: any) {
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  const disconnectThreads = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    setLoading(true);
    try {
      await fetch("/api/threads/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: uid })
      });
      clearThreadsLocalConnection(uid);
      invalidateThreadsConnectionCache(uid);
      setConnectionDetails({ connected: false });
      window.dispatchEvent(new CustomEvent("threads-connection-updated"));
    } catch (err) {
      console.error("Disconnection error:", err);
    } finally {
      setLoading(false);
    }
  };

  const value: ThreadsConnectionState = {
    loading,
    connected: connectionDetails?.connected || false,
    username: connectionDetails?.threadsUsername,
    profilePictureUrl: connectionDetails?.threadsProfilePictureUrl,
    biography: connectionDetails?.threadsBiography,
    isSandbox: connectionDetails?.isSandbox,
    hasInsightsPermission: connectionDetails?.hasInsightsPermission,
    hasPublishPermission: connectionDetails?.hasPublishPermission,
    connectionDetails,
    connectThreads,
    disconnectThreads,
    refreshConnection
  };

  return (
    <ThreadsConnectionContext.Provider value={value}>
      {children}
    </ThreadsConnectionContext.Provider>
  );
};

export const useThreadsConnection = () => {
  const context = useContext(ThreadsConnectionContext);
  if (context === undefined) {
    throw new Error("useThreadsConnection must be used within a ThreadsConnectionProvider");
  }
  return context;
};

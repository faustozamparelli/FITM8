import React, { createContext, useContext, useState } from "react";

interface NotificationContextType {
  hasNewChat: boolean;
  setHasNewChat: (value: boolean) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined
);

export function NotificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [hasNewChat, setHasNewChat] = useState(false);

  return (
    <NotificationContext.Provider value={{ hasNewChat, setHasNewChat }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error(
      "useNotification must be used within a NotificationProvider"
    );
  }
  return context;
}

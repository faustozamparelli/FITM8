import React, { createContext, useContext, useState } from "react";

interface NotificationContextType {
  hasNewChat: boolean;
  setHasNewChat: (value: boolean) => void;
}

const NotificationContext = createContext<NotificationContextType>({
  hasNewChat: false,
  setHasNewChat: () => {},
});

export function useNotification() {
  return useContext(NotificationContext);
}

export default function NotificationProvider({
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

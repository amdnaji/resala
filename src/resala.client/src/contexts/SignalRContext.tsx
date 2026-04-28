import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import * as signalR from '@microsoft/signalr';
import { useAuth } from './AuthContext';

interface SignalRContextType {
  connection: signalR.HubConnection | null;
  isConnected: boolean;
}

const SignalRContext = createContext<SignalRContextType>({
  connection: null,
  isConnected: false,
});

export const SignalRProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [connection, setConnection] = useState<signalR.HubConnection | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!user) {
      if (connection) {
        connection.stop().then(() => {
          setConnection(null);
          setIsConnected(false);
        });
      }
      return;
    }

    const newConnection = new signalR.HubConnectionBuilder()
      .withUrl('https://localhost:5001/hubs/chat', {
        withCredentials: true
      })
      .withAutomaticReconnect([0, 2000, 10000, 30000]) // auto reconnect logic
      .configureLogging(signalR.LogLevel.Information)
      .build();

    newConnection.onreconnecting(() => {
      setIsConnected(false);
      console.log('SignalR reconnecting...');
    });

    newConnection.onreconnected(() => {
      setIsConnected(true);
      console.log('SignalR reconnected');
    });

    newConnection.onclose(() => {
      setIsConnected(false);
    });

    // Pre-register empty listeners to suppress "No client method found" warnings
    newConnection.on('userstatuschanged', () => {});
    newConnection.on('UserStatusChanged', () => {});
    newConnection.on('receivemessage', () => {});
    newConnection.on('messagesread', () => {});
    newConnection.on('usertyping', () => {});

    setConnection(newConnection);

    const startConnection = async () => {
      try {
        await newConnection.start();
        setIsConnected(true);
        console.log('SignalR Connected!');
      } catch (err) {
        console.error('SignalR Connection Error: ', err);
        setTimeout(startConnection, 5000);
      }
    };

    startConnection();

    return () => {
      if (newConnection) {
        newConnection.stop();
      }
    };
  }, [user]);

  return (
    <SignalRContext.Provider value={{ connection, isConnected }}>
      {children}
    </SignalRContext.Provider>
  );
};

export const useSignalR = () => useContext(SignalRContext);

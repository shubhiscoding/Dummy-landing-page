"use client";
import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useSearchParams } from 'next/navigation';
import './verify.css';

export default function Verify() {
  const [status, setStatus] = useState<string>('Waiting for wallet connection');
  const { publicKey, connected } = useWallet();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Check if wallet is connected and token is present
    if (connected && publicKey && searchParams) {
      const token = searchParams.get('token');
      if (token) {
        verifyTokenHolding(publicKey.toString(), token);
      }
    }
  }, [connected, publicKey, searchParams]);

  const verifyTokenHolding = async (publicKey: string, token: string) => {
    setStatus('Verifying token holdings...');

    try {
      const response = await fetch('/api/hello', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicKey, token }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Verification response:', data);
        if (data.message === 'Verification successful') {
          setStatus('Verification successful! You can now close this window and return to Discord.');
        } else {
          setStatus(data.message || 'Verification failed. Please ensure you hold the required tokens and try again.');
        }
      } else {
        console.log(response);
        setStatus('Verification failed. Please ensure you hold the required tokens and try again.');
      }
    } catch (error) {
      console.error('Verification error:', error);
      setStatus('An error occurred during verification. Please try again.');
    }
  };

  return (
    <div className="verify-container">
      <h1 className="verify-title">Verify Your Wallet</h1>
      {!connected && (
        <div className="wallet-button">
          <WalletMultiButton />
        </div>
      )}
      <p className="verify-status">{status}</p>
    </div>
  );
}

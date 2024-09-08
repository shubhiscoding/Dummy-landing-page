import { NextResponse } from 'next/server';
import { Connection, PublicKey } from '@solana/web3.js';
import { Pool } from 'pg';
import fetch from 'node-fetch';

const connection = new Connection("https://api.mainnet-beta.solana.com");
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function POST(request: Request) {
  try {
    const { publicKey, token } = await request.json();
    if (!publicKey || !token) {
      return NextResponse.json({ error: 'Missing public key or token' }, { status: 400 });
    }

    const verificationData = await getVerificationData(token);
    if (!verificationData) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
    }

    const hasTokens = await checkTokenHolding(publicKey);

    // Update verification status
    await updateVerification(verificationData.user_id, publicKey, token, hasTokens);

    // Notify the Discord bot with the verification result
    const status = await notifyDiscordBot(verificationData.user_id, hasTokens, token);
    console.log('Discord bot status:', status);

    if (hasTokens) {
      return NextResponse.json({ message: 'Verification successful' }, { status: 200 });
    } else {
      return NextResponse.json({ message: 'Insufficient token balance' }, { status: 400 });
    }
  } catch (error) {
    console.error('Verification error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function checkTokenHolding(walletAddress: string): Promise<boolean> {
  const publicKey = new PublicKey(walletAddress);
  const tokenMint = new PublicKey(process.env.TOKEN_MINT_ADDRESS || 'F7Hwf8ib5DVCoiuyGr618Y3gon429Rnd1r5F9R5upump');

  try {
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') });

    for (const tokenAccount of tokenAccounts.value) {
      const tokenInfo = tokenAccount.account.data.parsed.info;
      if (tokenInfo.mint === tokenMint.toBase58()) {
        const balance = tokenInfo.tokenAmount.uiAmount;
        if (balance >= 1) {
          return true;
        }
      }
    }
  } catch (error) {
    console.error('Error checking token holdings:', error);
    return false;
  }
  return false;
}

async function updateVerification(userId: string, publicKey: string, token: string, verified: boolean) {
  try {
    await pool.query(
      'UPDATE verifications SET public_key = $1, verified = $2, verified_at = CURRENT_TIMESTAMP WHERE user_id = $3 AND token = $4',
      [publicKey, verified, userId, token]
    );
  } catch (error) {
    console.error('Error updating verification:', error);
    throw new Error('Failed to update verification');
  }
}

async function notifyDiscordBot(userId: string, verified: boolean, token: string) {
  try {
    await fetch('http://localhost:3001/verify-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, userId, verified }),
    });
    console.log('Notified Discord bot');
  } catch (error) {
    console.error('Error notifying Discord bot:', error);
  }
}

async function getVerificationData(token: string): Promise<{ user_id: string } | null> {
  try {
    const res = await pool.query('SELECT user_id FROM verifications WHERE token = $1', [token]);
    return res.rows[0] || null;
  } catch (error) {
    console.error('Error getting verification data:', error);
    return null;
  }
}

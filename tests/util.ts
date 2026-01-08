import * as anchor from "@coral-xyz/anchor";
import { PublicKey, Transaction, SystemProgram } from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createSyncNativeInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

export async function initializeATA(
  mint: PublicKey,
  owner: PublicKey
): Promise<PublicKey> {
  const provider = anchor.getProvider();

  // Calculate ATA account address
  const ataAddress = await getAssociatedTokenAddress(
    mint,
    owner,
    true, // allowOwnerOffCurve
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  // Check if account already exists
  const accountInfo = await provider.connection.getAccountInfo(ataAddress);
  if (accountInfo) {
    console.log(
      `ATA account already exists: ${ataAddress.toBase58()} (mint: ${mint.toBase58()}, owner: ${owner.toBase58()})`
    );
    return ataAddress;
  }

  // Create ATA account instruction
  const createATAInstruction = createAssociatedTokenAccountInstruction(
    provider.wallet.publicKey, // payer
    ataAddress, // ata
    owner, // owner
    mint, // mint
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  // Build and send transaction
  const transaction = new Transaction().add(createATAInstruction);
  const signature = await provider.sendAndConfirm(transaction);

  console.log(
    `ATA account initialized successfully: ${ataAddress.toBase58()} (mint: ${mint.toBase58()}, owner: ${owner.toBase58()})`
  );
  return ataAddress;
}

export async function wrapSOL(
  tokenAccount: PublicKey,
  amount: number = 1_000_000_000,
  fromWallet?: PublicKey
): Promise<string> {
  const provider = anchor.getProvider();
  const wallet = fromWallet || provider.wallet.publicKey;

  // Create transfer instruction
  const transferInstruction = SystemProgram.transfer({
    fromPubkey: wallet,
    toPubkey: tokenAccount,
    lamports: amount,
  });

  // Create syncNative instruction to sync WSOL account balance
  const syncNativeInstruction = createSyncNativeInstruction(
    tokenAccount,
    TOKEN_PROGRAM_ID
  );

  // Build and send transfer and sync transaction
  const wrapTransaction = new Transaction().add(
    transferInstruction,
    syncNativeInstruction
  );
  const wrapSignature = await provider.sendAndConfirm(wrapTransaction);
  console.log(
    `Successfully transferred ${amount / 1_000_000_000} SOL to ${tokenAccount.toBase58()}`
  );

  return wrapSignature;
}
